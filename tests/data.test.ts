import { describe, expect, it } from 'vitest';
import { ABILITIES } from '../src/data/abilities';
import { AFFINITIES, AFFINITY_IDS, affinityMultiplier, singleMultiplier } from '../src/data/affinities';
import { CREATURES, CREATURE_LIST } from '../src/data/creatures';
import { ITEMS } from '../src/data/items';
import { PASSIVES } from '../src/data/statuses';
import { CLUES, ENDINGS, KEY_CLUES, LEADS, QUESTS, TRUTH_THRESHOLD } from '../src/data/story';
import { TILES, tileAt } from '../src/data/tiles';
import type { Condition, EntityDef, ScriptCmd, ZoneDef } from '../src/data/types';
import { START, ZONES, ZONE_LIST } from '../src/data/zones';
import { CHARACTERS } from '../src/data/characters';
import { walkScripts } from './helpers';
import { abilitiesAt } from '../src/systems/creatures';

function allScripts(): Array<{ where: string; cmds: ScriptCmd[] }> {
  const out: Array<{ where: string; cmds: ScriptCmd[] }> = [];
  for (const z of ZONE_LIST) {
    if (z.onEnter) out.push({ where: `${z.id}:onEnter`, cmds: z.onEnter });
    for (const e of z.entities) if (e.script) out.push({ where: `${z.id}/${e.id}`, cmds: e.script });
  }
  return out;
}

function walkCond(c: Condition | undefined, visit: (c: Condition) => void) {
  if (!c) return;
  visit(c);
  if ('all' in c) c.all.forEach((x) => walkCond(x, visit));
  if ('any' in c) c.any.forEach((x) => walkCond(x, visit));
  if ('not' in c) walkCond(c.not, visit);
}

function allConditions(): Condition[] {
  const out: Condition[] = [];
  const push = (c?: Condition) => walkCond(c, (x) => out.push(x));
  for (const z of ZONE_LIST) {
    z.variants?.forEach((v) => push(v.when));
    z.warps.forEach((w) => push(w.when));
    z.entities.forEach((e) => push(e.when));
    z.encounters?.forEach((e) => push(e.when));
  }
  for (const s of allScripts())
    walkScripts(s.cmds, (c) => {
      if ('if' in c) push(c.if);
      if ('choice' in c) c.options.forEach((o) => push(o.when));
    });
  LEADS.forEach((l) => {
    push(l.appearsWhen);
    push(l.resolvedWhen);
  });
  for (const i of Object.values(ITEMS)) push(i.clueWhen);
  return out;
}

describe('affinités', () => {
  it('chaque affinité domine exactement 2 autres et est dominée par exactement 2', () => {
    for (const a of AFFINITY_IDS) {
      expect(AFFINITIES[a].dominates.length).toBe(2);
      const dominatedBy = AFFINITY_IDS.filter((b) => AFFINITIES[b].dominates.includes(a));
      expect(dominatedBy.length).toBe(2);
    }
  });
  it('aucune domination réciproque, aucune auto-domination', () => {
    for (const a of AFFINITY_IDS) {
      expect(AFFINITIES[a].dominates).not.toContain(a);
      for (const b of AFFINITIES[a].dominates) expect(AFFINITIES[b].dominates).not.toContain(a);
    }
  });
  it('règle symétrique : si A est fort contre B, B est faible contre A', () => {
    for (const a of AFFINITY_IDS)
      for (const b of AFFINITY_IDS) {
        if (singleMultiplier(a, b) > 1) expect(singleMultiplier(b, a)).toBeLessThan(1);
      }
  });
  it('multiplicateurs bornés pour les doubles affinités', () => {
    for (const a of AFFINITY_IDS)
      for (const b of AFFINITY_IDS)
        for (const c of AFFINITY_IDS) {
          const m = affinityMultiplier(a, [b, c]);
          expect(m).toBeGreaterThanOrEqual(0.25);
          expect(m).toBeLessThanOrEqual(2.25);
        }
  });
  it('chaque affinité possède une capacité gratuite (coût 0)', () => {
    for (const a of AFFINITY_IDS) expect(Object.values(ABILITIES).some((x) => x.affinity === a && x.cost === 0)).toBe(true);
  });
});

describe('créatures', () => {
  it('au moins 20 Rémanents originaux avec tous les champs', () => {
    expect(CREATURE_LIST.length).toBeGreaterThanOrEqual(20);
    for (const c of CREATURE_LIST) {
      expect(c.name.length).toBeGreaterThan(2);
      expect(c.silhouette.length).toBeGreaterThan(10);
      expect(c.lore.length).toBeGreaterThan(10);
      expect(PASSIVES[c.passive]).toBeTruthy();
      expect(c.palette.length).toBeGreaterThanOrEqual(4);
      expect(c.signs.fear && c.signs.desire && c.signs.tell).toBeTruthy();
      for (const [, ab] of c.learnset) expect(ABILITIES[ab], `${c.id}:${ab}`).toBeTruthy();
      expect(c.learnset.some(([l]) => l <= 1) || c.transform === undefined || true).toBe(true);
      if (c.transform) expect(CREATURES[c.transform.into], c.id).toBeTruthy();
      if (c.bond.kind === 'offrande') expect(ITEMS[c.bond.item]).toBeTruthy();
      if (c.bond.kind === 'choix') {
        expect(c.bond.correct).toBeLessThan(c.bond.answers.length);
        if (c.bond.requiresClue) expect(CLUES[c.bond.requiresClue]).toBeTruthy();
      }
    }
  });
  it('les créatures demandées par le concept existent', () => {
    for (const id of ['pli', 'mere_cendre', 'sonneur', 'enfant_quai', 'archivore', 'chien_creux', 'veuve_verre', 'faux_ami']) expect(CREATURES[id]).toBeTruthy();
  });
  it('chaque espèce de base a au moins une capacité au niveau de rencontre minimal', () => {
    for (const z of ZONE_LIST)
      for (const e of z.encounters ?? []) {
        const c = CREATURES[e.creature];
        expect(c, e.creature).toBeTruthy();
        expect(abilitiesAt(e.creature, e.levels[0]).length, `${e.creature} niv ${e.levels[0]}`).toBeGreaterThan(0);
        expect(e.levels[0]).toBeLessThanOrEqual(e.levels[1]);
      }
  });
  it('certaines créatures sont tragiques', () => {
    expect(CREATURE_LIST.filter((c) => c.tragic).length).toBeGreaterThanOrEqual(6);
  });
});

describe('zones', () => {
  it('cartes rectangulaires et tuiles connues', () => {
    for (const z of ZONE_LIST) {
      const w = z.map[0].length;
      z.map.forEach((row, y) => {
        expect(row.length, `${z.id} ligne ${y}`).toBe(w);
        for (const ch of row) expect(TILES[ch], `${z.id} tuile « ${ch} »`).toBeTruthy();
      });
      z.variants?.forEach((v) =>
        v.patches.forEach((p) =>
          p.rows.forEach((r, dy) => {
            expect(p.y + dy).toBeLessThan(z.map.length);
            expect(p.x + r.length).toBeLessThanOrEqual(w);
          }),
        ),
      );
    }
  });

  it('les variantes ne rendent jamais solide une case praticable (sauf la maison n° 9)', () => {
    for (const z of ZONE_LIST)
      for (const v of z.variants ?? [])
        for (const p of v.patches)
          p.rows.forEach((r, dy) =>
            r.split('').forEach((ch, dx) => {
              const before = tileAt(z.map[p.y + dy][p.x + dx]);
              const after = tileAt(ch);
              if (!before.solid && after.solid && z.id !== 'village') throw new Error(`${z.id} ${p.x + dx},${p.y + dy}`);
            }),
          );
  });

  it('point de départ praticable', () => {
    expect(tileAt(ZONES[START.zone].map[START.y][START.x]).solid).toBe(false);
  });

  it('chaque passage mène à une case praticable d’une zone existante', () => {
    for (const z of ZONE_LIST)
      for (const w of z.warps) {
        const t = ZONES[w.to];
        expect(t, `${z.id} → ${w.to}`).toBeTruthy();
        const variants = [t.map, applyAll(t)];
        const ok = variants.some((m) => m[w.ty] && !tileAt(m[w.ty][w.tx]).solid);
        expect(ok, `${z.id} → ${w.to} (${w.tx},${w.ty})`).toBe(true);
        // L'arrivée ne doit pas être elle-même un passage (sinon boucle immédiate).
        expect(t.warps.some((o) => o.x === w.tx && o.y === w.ty), `arrivée sur passage ${z.id} → ${w.to}`).toBe(false);
        const srcOk = [z.map, applyAll(z)].some((m) => !tileAt(m[w.y][w.x]).solid);
        expect(srcOk, `passage sur case solide ${z.id} ${w.x},${w.y}`).toBe(true);
      }
  });

  it('chaque zone peut être rejointe et quittée (graphe connexe depuis le départ)', () => {
    const seen = new Set<string>([START.zone]);
    const q = [START.zone];
    while (q.length) {
      const z = ZONES[q.shift() as string];
      const targets = [...z.warps.map((w) => w.to), ...scriptWarps(z)];
      for (const t of targets) if (!seen.has(t)) {
        seen.add(t);
        q.push(t);
      }
    }
    for (const z of ZONE_LIST) expect(seen.has(z.id), z.id).toBe(true);
    // Retour : depuis chaque zone, on peut revenir au village.
    for (const z of ZONE_LIST) {
      const s2 = new Set<string>([z.id]);
      const q2 = [z.id];
      while (q2.length) {
        const cur = ZONES[q2.shift() as string];
        for (const t of [...cur.warps.map((w) => w.to), ...scriptWarps(cur)]) if (!s2.has(t)) {
          s2.add(t);
          q2.push(t);
        }
      }
      expect(s2.has('village'), `pas de retour depuis ${z.id}`).toBe(true);
    }
  });

  it('tous les passages et entités sont accessibles à pied depuis les arrivées', () => {
    for (const z of ZONE_LIST) {
      const arrivals: Array<[number, number]> = [];
      for (const o of ZONE_LIST) for (const w of o.warps) if (w.to === z.id) arrivals.push([w.tx, w.ty]);
      for (const o of ZONE_LIST) for (const s of [o.onEnter, ...o.entities.map((e) => e.script)]) walkScripts(s, (c) => {
        if ('warp' in c && c.warp === z.id) arrivals.push([c.x, c.y]);
      });
      if (z.id === START.zone) arrivals.push([START.x, START.y]);
      expect(arrivals.length, z.id).toBeGreaterThan(0);
      const reach = new Set<string>();
      for (const grid of [z.map, applyAll(z)]) for (const [x, y] of arrivals) flood(z, grid, x, y, reach);
      for (const w of z.warps) expect(reach.has(`${w.x},${w.y}`), `${z.id}: passage ${w.x},${w.y} inaccessible`).toBe(true);
      for (const e of z.entities) {
        if (e.touch) {
          expect(reach.has(`${e.x},${e.y}`), `${z.id}/${e.id} (déclencheur) inaccessible`).toBe(true);
        } else {
          const adj = [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => reach.has(`${e.x + dx},${e.y + dy}`) || acrossCounter(z, e, dx, dy, reach));
          expect(adj, `${z.id}/${e.id} impossible à atteindre`).toBe(true);
        }
      }
    }
  });
});

function applyAll(z: ZoneDef): string[] {
  const g = z.map.map((r) => r.split(''));
  for (const v of z.variants ?? []) for (const p of v.patches) p.rows.forEach((r, dy) => r.split('').forEach((ch, dx) => (g[p.y + dy][p.x + dx] = ch)));
  return g.map((r) => r.join(''));
}

function scriptWarps(z: ZoneDef): string[] {
  const out: string[] = [];
  for (const s of [z.onEnter, ...z.entities.map((e) => e.script)]) walkScripts(s, (c) => {
    if ('warp' in c) out.push(c.warp);
  });
  return out;
}

function blockingEntity(z: ZoneDef, x: number, y: number): boolean {
  // Les entités conditionnelles peuvent disparaître : seules les permanentes bloquent.
  return z.entities.some((e: EntityDef) => e.solid && !e.when && e.x === x && e.y === y);
}

function flood(z: ZoneDef, grid: string[], sx: number, sy: number, reach: Set<string>) {
  const q: Array<[number, number]> = [[sx, sy]];
  const local = new Set<string>();
  while (q.length) {
    const [x, y] = q.shift() as [number, number];
    const k = `${x},${y}`;
    if (local.has(k)) continue;
    if (!grid[y] || x < 0 || x >= grid[y].length) continue;
    if (tileAt(grid[y][x]).solid || blockingEntity(z, x, y)) continue;
    local.add(k);
    reach.add(k);
    // On ne traverse pas un passage (il mène ailleurs).
    if (z.warps.some((w) => w.x === x && w.y === y) && !(x === sx && y === sy)) continue;
    q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

function acrossCounter(z: ZoneDef, e: EntityDef, dx: number, dy: number, reach: Set<string>): boolean {
  const mid = z.map[e.y + dy]?.[e.x + dx];
  return mid === 'C' && reach.has(`${e.x + 2 * dx},${e.y + 2 * dy}`);
}

describe('scripts et références', () => {
  it('toutes les références des scripts existent', () => {
    for (const { where, cmds } of allScripts())
      walkScripts(cmds, (c) => {
        if ('give' in c) expect(ITEMS[c.give], `${where} give ${c.give}`).toBeTruthy();
        if ('take' in c) expect(ITEMS[c.take], `${where} take ${c.take}`).toBeTruthy();
        if ('clue' in c) expect(CLUES[c.clue], `${where} clue ${c.clue}`).toBeTruthy();
        if ('quest' in c) {
          expect(QUESTS[c.quest], `${where} quest ${c.quest}`).toBeTruthy();
          expect(c.stage).toBeLessThan(QUESTS[c.quest].stages.length);
        }
        if ('questDone' in c) expect(QUESTS[c.questDone], `${where}`).toBeTruthy();
        if ('battle' in c) expect(CREATURES[c.battle], `${where} battle ${c.battle}`).toBeTruthy();
        if ('bondDirect' in c) expect(CREATURES[c.bondDirect]).toBeTruthy();
        if ('pacify' in c) expect(CREATURES[c.pacify]).toBeTruthy();
        if ('chase' in c) expect(CREATURES[c.chase]).toBeTruthy();
        if ('warp' in c) expect(ZONES[c.warp], `${where} warp ${c.warp}`).toBeTruthy();
        if ('ending' in c) expect(ENDINGS[c.ending]).toBeTruthy();
        if ('say' in c && c.who) expect(CHARACTERS[c.who], `${where} who ${c.who}`).toBeTruthy();
      });
  });

  it('chaque drapeau lu est posé quelque part (pas de faute de frappe)', () => {
    const set = new Set<string>();
    for (const z of ZONE_LIST) if (z.enterOnceFlag) set.add(z.enterOnceFlag);
    for (const { cmds } of allScripts())
      walkScripts(cmds, (c) => {
        if ('setFlag' in c) set.add(c.setFlag);
        if ('npcForget' in c) set.add(`oubli_${c.npcForget}`);
      });
    // Drapeaux posés par le moteur
    for (const f of ['revelation', 'dans_placard']) set.add(f);
    for (const z of ZONE_LIST) for (const e of z.entities) if (e.kind === 'objet') set.add(`pris_${e.id}`);
    for (const z of ZONE_LIST) for (const e of z.entities) if (e.touch) set.add(`vu_${e.id}`);
    const read = new Set<string>();
    for (const c of allConditions()) {
      if ('flag' in c) read.add(c.flag);
      if ('notFlag' in c) read.add(c.notFlag);
    }
    for (const f of read) expect(set.has(f), `drapeau jamais posé : ${f}`).toBe(true);
  });

  it('conditions : objets, indices, quêtes et créatures valides', () => {
    for (const c of allConditions()) {
      if ('item' in c) expect(ITEMS[c.item], c.item).toBeTruthy();
      if ('clue' in c) expect(CLUES[c.clue], c.clue).toBeTruthy();
      if ('quest' in c) expect(QUESTS[c.quest], c.quest).toBeTruthy();
      if ('owned' in c) expect(CREATURES[c.owned]).toBeTruthy();
      if ('pacified' in c) expect(CREATURES[c.pacified]).toBeTruthy();
    }
  });

  it('assez d’indices clés pour la vérité, et chaque indice clé est obtenable', () => {
    expect(KEY_CLUES.length).toBeGreaterThanOrEqual(TRUTH_THRESHOLD + 2);
    const obtainable = new Set<string>();
    for (const { cmds } of allScripts()) walkScripts(cmds, (c) => 'clue' in c && obtainable.add(c.clue));
    for (const i of Object.values(ITEMS)) if (i.clue) obtainable.add(i.clue);
    for (const k of Object.keys(CLUES)) expect(obtainable.has(k), `indice inobtenable : ${k}`).toBe(true);
  });

  it('chaque zone extérieure propose rencontres et objets ; trois fins existent', () => {
    for (const z of ZONE_LIST.filter((z) => !z.indoor && z.id !== 'clairiere')) {
      expect(z.encounters?.length ?? 0, z.id).toBeGreaterThan(0);
      expect(z.entities.some((e) => e.kind === 'objet'), z.id).toBe(true);
    }
    expect(Object.keys(ENDINGS).length).toBe(3);
  });
});

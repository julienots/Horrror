import { ABILITIES } from '../data/abilities';
import { AFFINITY_IDS, affinityMultiplier, effectivenessLabel } from '../data/affinities';
import { CREATURES } from '../data/creatures';
import { ITEMS } from '../data/items';
import { STATUSES } from '../data/statuses';
import type { AbilityDef, AffinityId, StageKey, StatusId } from '../data/types';
import { Rng } from '../core/rng';
import { type BattleStatus, type CreatureInstance, type GameState, codexOf } from '../core/state';
import {
  addBonded,
  aliveCount,
  gainBond,
  gainXp,
  makeCreature,
  maxEnergy,
  maxHp,
  speciesOf,
  statOf,
  xpReward,
} from '../systems/creatures';
import { addItem, has, removeItem, useItemOn } from '../systems/inventory';

// ---------------------------------------------------------------- Types

export type Side = 'player' | 'foe';
export type BattleOutcome = 'win' | 'lose' | 'flee' | 'bond' | 'pacify' | 'repel';

export interface BattleSetup {
  species: string;
  level: number;
  boss?: boolean;
  noFlee?: boolean;
  scripted?: boolean;
}

export interface Fighter {
  c: CreatureInstance;
  stages: Record<StageKey, number>;
  statuses: BattleStatus[];
  affinities: AffinityId[];
  sealed?: string;
  hitTaken: boolean;
}

export interface Battle {
  setup: BattleSetup;
  foe: Fighter;
  player: Fighter;
  activeIndex: number;
  participants: string[];
  statusMemory: Record<string, BattleStatus[]>; // statuts conservés par créature lors des changements
  understanding: number; // 0..3
  fleeAttempts: number;
  turn: number;
  outcome: BattleOutcome | null;
  needSwitch: boolean;
  bonded?: CreatureInstance;
  bondDestination?: string;
  rng: Rng;
}

export type BEvent =
  | { t: 'text'; text: string }
  | { t: 'use'; side: Side; ability: string; name: string }
  | { t: 'fx'; fx: AbilityDef['fx']; target: Side; affinity: AffinityId }
  | { t: 'damage'; side: Side; amount: number; mult: number; crit: boolean; hp: number; max: number }
  | { t: 'heal'; side: Side; amount: number; hp: number; max: number }
  | { t: 'miss'; side: Side }
  | { t: 'status'; side: Side; status: StatusId }
  | { t: 'statusEnd'; side: Side; status: StatusId }
  | { t: 'stage'; side: Side; stat: StageKey; delta: number }
  | { t: 'faint'; side: Side }
  | { t: 'switch'; index: number }
  | { t: 'shake'; n: number }
  | { t: 'xp'; uid: string; amount: number; levels: number[]; learned: string[]; learnedInactive: string[] }
  | { t: 'bondUp'; uid: string; level: number }
  | { t: 'reveal'; level: number; text: string }
  | { t: 'outcome'; outcome: BattleOutcome };

export type PlayerAction =
  | { kind: 'ability'; id: string }
  | { kind: 'switch'; index: number }
  | { kind: 'item'; item: string; target: number }
  | { kind: 'flee' }
  | { kind: 'observe' }
  | { kind: 'pacify' }
  | { kind: 'pact'; item: string }
  | { kind: 'offer'; item: string }
  | { kind: 'answer'; index: number }
  | { kind: 'repel' };

const STRUGGLE: AbilityDef = {
  id: 'debattre',
  name: 'Se débattre',
  affinity: 'chair',
  category: 'physique',
  power: 30,
  accuracy: 1,
  cost: 0,
  fx: 'slash',
  description: 'Faute d’énergie, se débat comme il peut.',
  effect: { recoilFraction: 0.12 },
};

// ---------------------------------------------------------------- Création

function fighter(c: CreatureInstance, statuses: BattleStatus[] = []): Fighter {
  const f: Fighter = {
    c,
    stages: { atk: 0, def: 0, psy: 0, vit: 0 },
    statuses,
    affinities: [...speciesOf(c).affinities],
    hitTaken: false,
  };
  const eq = c.equip ? ITEMS[c.equip]?.equip : undefined;
  if (eq?.stat) for (const [k, v] of Object.entries(eq.stat)) f.stages[k as StageKey] += v ?? 0;
  return f;
}

export function firstAliveIndex(team: CreatureInstance[]): number {
  return team.findIndex((c) => c.hp > 0);
}

export function startBattle(state: GameState, setup: BattleSetup, rng: Rng): { battle: Battle; events: BEvent[] } {
  const idx = firstAliveIndex(state.team);
  if (idx < 0) throw new Error('Aucun Rémanent en état de combattre.');
  const foeC = makeCreature(null, setup.species, setup.level);
  const battle: Battle = {
    setup,
    foe: fighter(foeC),
    player: fighter(state.team[idx]),
    activeIndex: idx,
    participants: [state.team[idx].uid],
    statusMemory: {},
    understanding: 0,
    fleeAttempts: 0,
    turn: 0,
    outcome: null,
    needSwitch: false,
    rng,
  };
  const entry = codexOf(state, setup.species);
  entry.seen = true;
  const events: BEvent[] = [];
  const def = CREATURES[setup.species];
  events.push({ t: 'text', text: setup.boss ? `${def.name} se dresse devant vous.` : `Un Rémanent surgit : ${def.name} !` });
  events.push(...entryEffects(battle, 'foe'));
  events.push({ t: 'text', text: `${speciesOf(battle.player.c).name}, à vous.` });
  events.push(...entryEffects(battle, 'player'));
  return { battle, events };
}

function entryEffects(b: Battle, side: Side): BEvent[] {
  const me = side === 'player' ? b.player : b.foe;
  const other = side === 'player' ? b.foe : b.player;
  const ev: BEvent[] = [];
  const passive = speciesOf(me.c).passive;
  if (passive === 'glas' && b.rng.chance(0.5)) {
    ev.push({ t: 'text', text: `Les clochettes de ${speciesOf(me.c).name} sonnent le glas.` });
    ev.push(...inflict(b, other, otherSide(side), 'effroi', me));
  }
  if (passive === 'imitation') {
    me.affinities = [other.affinities[0]];
    ev.push({ t: 'text', text: `${speciesOf(me.c).name} prend le visage de son adversaire.` });
  }
  return ev;
}

const otherSide = (s: Side): Side => (s === 'player' ? 'foe' : 'player');
const nameOf = (f: Fighter) => speciesOf(f.c).name;

// ---------------------------------------------------------------- Calculs

export function stageMult(s: number): number {
  return s >= 0 ? 1 + 0.25 * s : 1 / (1 + 0.25 * -s);
}

function effStat(f: Fighter, key: StageKey): number {
  let v = statOf(f.c, key) * stageMult(f.stages[key]);
  if (key === 'atk' && hasStatus(f, 'cendres')) v *= 0.75;
  return Math.max(1, v);
}

export function hasStatus(f: Fighter, id: StatusId): boolean {
  return f.statuses.some((s) => s.id === id);
}

function resists(f: Fighter, id: StatusId): boolean {
  const p = speciesOf(f.c).passive;
  if (p === 'veille' && (id === 'effroi' || id === 'oubli')) return true;
  if (p === 'mimetisme' && id === 'effroi') return true;
  if (p === 'phare' && id === 'torpeur') return true;
  const eq = f.c.equip ? ITEMS[f.c.equip]?.equip : undefined;
  return eq?.resist === id;
}

function inflict(b: Battle, target: Fighter, side: Side, id: StatusId, source?: Fighter): BEvent[] {
  if (target.c.hp <= 0) return [];
  if (hasStatus(target, id)) return [];
  if (resists(target, id)) return [{ t: 'text', text: `${nameOf(target)} ne se laisse pas atteindre.` }];
  const def = STATUSES[id];
  let turns = b.rng.int(def.duration[0], def.duration[1]);
  if (source && speciesOf(source.c).passive === 'griffonnage') turns += 1;
  target.statuses.push({ id, turns });
  if (id === 'oubli') {
    const pool = target.c.abilities.filter((a) => a !== target.sealed);
    target.sealed = pool.length > 1 ? b.rng.pick(pool) : undefined;
  }
  return [{ t: 'status', side, status: id }];
}

export function computeDamage(
  b: Battle,
  atk: Fighter,
  def: Fighter,
  ab: AbilityDef,
  forceCrit?: boolean,
): { damage: number; mult: number; crit: boolean } {
  const physical = ab.category === 'physique';
  const A = physical ? effStat(atk, 'atk') : effStat(atk, 'psy');
  const D = physical ? effStat(def, 'def') : effStat(def, 'psy');
  const lvl = atk.c.level;
  let dmg = (ab.power * (lvl * 0.4 + 2) * A) / D / 30 + 2;
  if (atk.affinities.includes(ab.affinity)) dmg *= 1.2;
  const mult = ab.id === 'debattre' ? 1 : affinityMultiplier(ab.affinity, def.affinities);
  dmg *= mult;
  const critChance = 0.0625 + (ab.critBonus ?? 0) + atk.c.bond * 0.02;
  const crit = forceCrit ?? b.rng.chance(critChance);
  if (crit) dmg *= 1.5;
  dmg *= b.rng.range(0.88, 1);
  if (hasStatus(def, 'fele')) dmg *= 1.25;
  const pa = speciesOf(atk.c).passive;
  if (pa === 'meche' && ab.affinity === 'cendre' && atk.c.hp <= maxHp(atk.c) / 3) dmg *= 1.1;
  if (speciesOf(def.c).passive === 'coquille' && !def.hitTaken) dmg *= 0.8;
  return { damage: Math.max(1, Math.floor(dmg)), mult, crit };
}

function abilityCost(f: Fighter, ab: AbilityDef): number {
  let cost = ab.cost;
  if (ab.category === 'soutien' && speciesOf(f.c).passive === 'resonance') cost = Math.max(0, cost - 1);
  return cost;
}

export interface AbilityOption {
  id: string;
  def: AbilityDef;
  cost: number;
  usable: boolean;
  reason?: string;
}

export function abilityOptions(b: Battle): AbilityOption[] {
  const opts: AbilityOption[] = b.player.c.abilities
    .filter((id) => ABILITIES[id])
    .map((id) => {
      const def = ABILITIES[id];
      const cost = abilityCost(b.player, def);
      if (b.player.sealed === id && hasStatus(b.player, 'oubli')) return { id, def, cost, usable: false, reason: 'Oublié' };
      if (cost > b.player.c.energy) return { id, def, cost, usable: false, reason: 'Énergie' };
      return { id, def, cost, usable: true };
    });
  // Jamais sans action : sans capacité utilisable, on peut toujours se débattre.
  if (!opts.some((o) => o.usable)) opts.push({ id: STRUGGLE.id, def: STRUGGLE, cost: 0, usable: true });
  return opts;
}

// ---------------------------------------------------------------- Exécution d'une capacité

function useAbility(b: Battle, side: Side, ab: AbilityDef): BEvent[] {
  const me = side === 'player' ? b.player : b.foe;
  const foeSide = otherSide(side);
  const target = side === 'player' ? b.foe : b.player;
  const ev: BEvent[] = [];
  if (me.c.hp <= 0) return ev;

  // Statuts empêchant d'agir.
  const torpor = me.statuses.find((s) => s.id === 'torpeur');
  if (torpor) {
    ev.push({ t: 'text', text: `${nameOf(me)} est plongé dans la torpeur.` });
    return ev;
  }
  if (hasStatus(me, 'effroi') && b.rng.chance(0.3)) {
    ev.push({ t: 'text', text: `${nameOf(me)} est paralysé par l’effroi !` });
    return ev;
  }

  const cost = abilityCost(me, ab);
  me.c.energy = Math.max(0, me.c.energy - cost);
  ev.push({ t: 'use', side, ability: ab.id, name: ab.name });

  // Soutien sur soi-même
  const selfOnly = ab.category === 'soutien' && !ab.effect?.status && !ab.effect?.stages?.target?.startsWith('foe');
  if (selfOnly) {
    ev.push({ t: 'fx', fx: ab.fx, target: side, affinity: ab.affinity });
    ev.push(...applySelfEffects(b, me, side, ab, 0));
    return ev;
  }

  // Précision
  let acc = ab.accuracy;
  if (speciesOf(me.c).passive === 'mimetisme' && ab.affinity === 'echo') acc = Math.min(1, acc + 0.1);
  if (!b.rng.chance(acc)) {
    ev.push({ t: 'miss', side });
    ev.push({ t: 'text', text: `${nameOf(me)} manque sa cible.` });
    return ev;
  }

  if (ab.category === 'soutien') {
    ev.push({ t: 'fx', fx: ab.fx, target: foeSide, affinity: ab.affinity });
    const e = ab.effect;
    if (e?.status) {
      if (b.rng.chance(e.status.chance)) ev.push(...inflict(b, target, foeSide, e.status.id, me));
      else ev.push({ t: 'text', text: 'Sans effet.' });
    }
    if (e?.stages && e.stages.target === 'foe') ev.push(...applyStages(target, foeSide, e.stages.changes));
    return ev;
  }

  // Esquive passive
  if (ab.category === 'physique' && speciesOf(target.c).passive === 'repli' && b.rng.chance(0.15)) {
    ev.push({ t: 'text', text: `${nameOf(target)} se replie dans le mur. L’attaque passe à travers.` });
    return ev;
  }

  const hits = ab.effect?.multiHit ? b.rng.int(ab.effect.multiHit[0], ab.effect.multiHit[1]) : 1;
  let total = 0;
  let lastMult = 1;
  for (let i = 0; i < hits && target.c.hp > 0; i++) {
    const { damage, mult, crit } = computeDamage(b, me, target, ab);
    lastMult = mult;
    target.c.hp = Math.max(0, target.c.hp - damage);
    target.hitTaken = true;
    total += damage;
    ev.push({ t: 'fx', fx: ab.fx, target: foeSide, affinity: ab.affinity });
    ev.push({ t: 'damage', side: foeSide, amount: damage, mult, crit, hp: target.c.hp, max: maxHp(target.c) });
    if (crit) ev.push({ t: 'text', text: 'Un coup qui touche un souvenir précis !' });
    // La torpeur cesse au premier coup reçu.
    if (hasStatus(target, 'torpeur')) {
      target.statuses = target.statuses.filter((s) => s.id !== 'torpeur');
      ev.push({ t: 'statusEnd', side: foeSide, status: 'torpeur' });
    }
  }
  if (hits > 1) ev.push({ t: 'text', text: `Touché ${hits} fois.` });
  const label = effectivenessLabel(lastMult);
  if (label) ev.push({ t: 'text', text: label });

  // Passifs défensifs
  const pt = speciesOf(target.c).passive;
  if (ab.category === 'physique' && pt === 'eclats' && me.c.hp > 0) {
    const back = Math.max(1, Math.floor(total * 0.25));
    me.c.hp = Math.max(0, me.c.hp - back);
    ev.push({ t: 'text', text: `Des éclats de verre se retournent contre ${nameOf(me)}.` });
    ev.push({ t: 'damage', side, amount: back, mult: 1, crit: false, hp: me.c.hp, max: maxHp(me.c) });
  }
  if (ab.category === 'physique' && pt === 'epines' && me.c.hp > 0) {
    const back = Math.max(1, Math.floor(maxHp(me.c) / 16));
    me.c.hp = Math.max(0, me.c.hp - back);
    ev.push({ t: 'text', text: `${nameOf(me)} s’écorche sur les épines.` });
    ev.push({ t: 'damage', side, amount: back, mult: 1, crit: false, hp: me.c.hp, max: maxHp(me.c) });
  }

  // Passifs offensifs
  const pm = speciesOf(me.c).passive;
  if (target.c.hp > 0) {
    if (pm === 'devoreur' && b.rng.chance(0.2)) ev.push(...inflict(b, target, foeSide, 'oubli', me));
    if (pm === 'noyade' && ab.affinity === 'reve' && b.rng.chance(0.3)) ev.push(...applyStages(target, foeSide, { vit: -1 }));
    if (pm === 'parasite' && target.c.energy > 0) {
      target.c.energy -= 1;
      me.c.energy = Math.min(maxEnergy(me.c), me.c.energy + 1);
    }
    const e = ab.effect;
    if (e?.status && b.rng.chance(e.status.chance)) ev.push(...inflict(b, target, foeSide, e.status.id, me));
    if (e?.stages && e.stages.target === 'foe') ev.push(...applyStages(target, foeSide, e.stages.changes));
    if (e?.energyDrain) {
      const d = Math.min(target.c.energy, e.energyDrain);
      target.c.energy -= d;
      if (d > 0) ev.push({ t: 'text', text: `${nameOf(target)} perd ${d} d’énergie.` });
    }
  }
  ev.push(...applySelfEffects(b, me, side, ab, total));
  if (target.c.hp <= 0) ev.push({ t: 'faint', side: foeSide });
  if (me.c.hp <= 0) ev.push({ t: 'faint', side });
  return ev;
}

function applyStages(f: Fighter, side: Side, changes: Partial<Record<StageKey, number>>): BEvent[] {
  const ev: BEvent[] = [];
  for (const [k, v] of Object.entries(changes)) {
    const key = k as StageKey;
    const before = f.stages[key];
    f.stages[key] = Math.max(-3, Math.min(3, before + (v ?? 0)));
    const delta = f.stages[key] - before;
    if (delta !== 0) ev.push({ t: 'stage', side, stat: key, delta });
  }
  return ev;
}

function healAmount(b: Battle, receiver: Fighter, amount: number): number {
  const opp = receiver === b.player ? b.foe : b.player;
  if (speciesOf(opp.c).passive === 'effacement') amount = Math.floor(amount / 2);
  return amount;
}

function applySelfEffects(b: Battle, me: Fighter, side: Side, ab: AbilityDef, dealt: number): BEvent[] {
  const ev: BEvent[] = [];
  const e = ab.effect;
  if (!e) return ev;
  if (e.healFraction) {
    const amt = healAmount(b, me, Math.floor(maxHp(me.c) * e.healFraction));
    const before = me.c.hp;
    me.c.hp = Math.min(maxHp(me.c), me.c.hp + amt);
    ev.push({ t: 'heal', side, amount: me.c.hp - before, hp: me.c.hp, max: maxHp(me.c) });
  }
  if (e.drainFraction && dealt > 0) {
    const amt = healAmount(b, me, Math.floor(dealt * e.drainFraction));
    const before = me.c.hp;
    me.c.hp = Math.min(maxHp(me.c), me.c.hp + amt);
    if (me.c.hp > before) ev.push({ t: 'heal', side, amount: me.c.hp - before, hp: me.c.hp, max: maxHp(me.c) });
  }
  if (e.recoilFraction && dealt > 0) {
    const r = Math.max(1, Math.floor(dealt * e.recoilFraction));
    me.c.hp = Math.max(0, me.c.hp - r);
    ev.push({ t: 'text', text: `${nameOf(me)} est blessé par son propre élan.` });
    ev.push({ t: 'damage', side, amount: r, mult: 1, crit: false, hp: me.c.hp, max: maxHp(me.c) });
  }
  if (e.cleanse && me.statuses.length) {
    for (const s of me.statuses) ev.push({ t: 'statusEnd', side, status: s.id });
    me.statuses = [];
    me.sealed = undefined;
  }
  if (e.stages && e.stages.target === 'self') ev.push(...applyStages(me, side, e.stages.changes));
  return ev;
}

// ---------------------------------------------------------------- IA

export function chooseFoeAbility(b: Battle): AbilityDef {
  return chooseAbility(b, 'foe');
}

/** IA de choix de capacité, utilisable pour les deux camps (combat auto, tests). */
export function chooseAbility(b: Battle, side: Side): AbilityDef {
  const f = side === 'foe' ? b.foe : b.player;
  const opp = side === 'foe' ? b.player : b.foe;
  const opts = f.c.abilities
    .map((id) => ABILITIES[id])
    .filter((a): a is AbilityDef => !!a && abilityCost(f, a) <= f.c.energy && !(f.sealed === a.id && hasStatus(f, 'oubli')));
  if (!opts.length) return STRUGGLE;
  const hpRatio = f.c.hp / maxHp(f.c);
  const scored = opts.map((a) => {
    let score: number;
    if (a.category === 'soutien') {
      const e = a.effect;
      if (e?.healFraction) score = hpRatio < 0.5 ? 90 : 5;
      else if (e?.status) score = hasStatus(opp, e.status.id) ? 2 : 45;
      else if (e?.stages) score = Object.values(e.stages.changes).some((v) => (v ?? 0) > 0) && f.stages.atk < 2 ? 35 : 8;
      else score = 10;
    } else {
      const mult = affinityMultiplier(a.affinity, opp.affinities);
      const stab = f.affinities.includes(a.affinity) ? 1.2 : 1;
      score = a.power * mult * stab * a.accuracy;
    }
    return { a, score: score * b.rng.range(0.7, 1.3) };
  });
  scored.sort((x, y) => y.score - x.score);
  return scored[0].a;
}

// ---------------------------------------------------------------- Tour de jeu

function speedOf(f: Fighter): number {
  return effStat(f, 'vit');
}

function priorityOf(f: Fighter, ab: AbilityDef): number {
  let p = ab.priority ?? 0;
  if (speciesOf(f.c).passive === 'controle' && f.c.hp >= maxHp(f.c)) p += 1;
  return p;
}

export function playerTurn(state: GameState, b: Battle, action: PlayerAction): BEvent[] {
  if (b.outcome) return [];
  if (b.needSwitch && action.kind !== 'switch') return [{ t: 'text', text: 'Choisissez un Rémanent.' }];
  const ev: BEvent[] = [];
  b.turn += 1;

  if (action.kind === 'switch' && b.needSwitch) {
    ev.push(...doSwitch(state, b, action.index));
    b.needSwitch = false;
    return ev;
  }

  if (action.kind === 'ability') {
    const opt = abilityOptions(b).find((o) => o.id === action.id);
    if (!opt || !opt.usable) {
      b.turn -= 1;
      return [{ t: 'text', text: opt?.reason === 'Oublié' ? 'Cette capacité a été oubliée pour l’instant.' : 'Pas assez d’énergie.' }];
    }
    const foeAb = chooseFoeAbility(b);
    const pAb = opt.def;
    const pp = priorityOf(b.player, pAb);
    const fp = priorityOf(b.foe, foeAb);
    let playerFirst: boolean;
    if (pp !== fp) playerFirst = pp > fp;
    else if (speedOf(b.player) !== speedOf(b.foe)) playerFirst = speedOf(b.player) > speedOf(b.foe);
    else playerFirst = b.rng.chance(0.5);
    const order: Array<[Side, AbilityDef]> = playerFirst ? [['player', pAb], ['foe', foeAb]] : [['foe', foeAb], ['player', pAb]];
    for (const [side, ab] of order) {
      if (b.player.c.hp <= 0 || b.foe.c.hp <= 0) break;
      ev.push(...useAbility(b, side, ab));
    }
  } else {
    const r = nonAttackAction(state, b, action);
    ev.push(...r.events);
    if (r.consumedTurn === false) {
      b.turn -= 1;
      return ev;
    }
    if (!b.outcome && b.foe.c.hp > 0 && b.player.c.hp > 0) {
      ev.push(...useAbility(b, 'foe', chooseFoeAbility(b)));
    }
  }

  if (!b.outcome) ev.push(...endOfTurn(b));
  ev.push(...checkEnd(state, b));
  return ev;
}

function nonAttackAction(state: GameState, b: Battle, action: PlayerAction): { events: BEvent[]; consumedTurn?: boolean } {
  const ev: BEvent[] = [];
  const def = CREATURES[b.setup.species];
  switch (action.kind) {
    case 'switch': {
      const target = state.team[action.index];
      if (!target || target.hp <= 0 || action.index === b.activeIndex) return { events: [{ t: 'text', text: 'Impossible.' }], consumedTurn: false };
      ev.push(...doSwitch(state, b, action.index));
      return { events: ev };
    }
    case 'item': {
      const target = state.team[action.target];
      const itemDef = ITEMS[action.item];
      if (itemDef?.effect?.kind === 'cure') {
        if (!has(state, action.item)) return { events: [{ t: 'text', text: 'Vous n’en avez pas.' }], consumedTurn: false };
        const f = target?.uid === b.player.c.uid ? b.player : null;
        const mem = target ? b.statusMemory[target.uid] : undefined;
        const st = f ? f.statuses : mem ?? [];
        if (!st.length) return { events: [{ t: 'text', text: 'Aucun statut à chasser.' }], consumedTurn: false };
        removeItem(state, action.item);
        if (f) {
          for (const s of f.statuses) ev.push({ t: 'statusEnd', side: 'player', status: s.id });
          f.statuses = [];
          f.sealed = undefined;
        } else if (target) b.statusMemory[target.uid] = [];
        ev.push({ t: 'text', text: 'Une pincée de sel. Les statuts se dissipent.' });
        return { events: ev };
      }
      const res = useItemOn(state, action.item, target, 'combat');
      if (!res.ok) return { events: [{ t: 'text', text: res.message }], consumedTurn: false };
      ev.push({ t: 'text', text: `${itemDef?.name ?? 'Objet'} : ${res.message}` });
      if (target && target.uid === b.player.c.uid) ev.push({ t: 'heal', side: 'player', amount: 0, hp: target.hp, max: maxHp(target) });
      return { events: ev };
    }
    case 'flee': {
      if (b.setup.noFlee) return { events: [{ t: 'text', text: 'Impossible de fuir. Quelque chose vous retient ici.' }], consumedTurn: false };
      b.fleeAttempts += 1;
      const ratio = speedOf(b.player) / speedOf(b.foe);
      const chance = Math.min(1, 0.35 + 0.3 * ratio + 0.2 * (b.fleeAttempts - 1));
      if (b.rng.chance(chance)) {
        b.outcome = 'flee';
        ev.push({ t: 'text', text: 'Vous reculez dans la brume. Elle ne vous suit pas.' });
        ev.push({ t: 'outcome', outcome: 'flee' });
      } else ev.push({ t: 'text', text: 'Vos jambes refusent d’obéir. Pas de fuite possible cette fois.' });
      return { events: ev };
    }
    case 'observe': {
      const entry = codexOf(state, b.setup.species);
      if (b.understanding >= 3) {
        ev.push({ t: 'text', text: `Vous avez compris tout ce qu’il y avait à comprendre. Elle craint ${def.signs.fear} et désire ${def.signs.desire}.` });
        return { events: ev };
      }
      b.understanding += 1;
      entry.observed = Math.max(entry.observed, b.understanding);
      const text =
        b.understanding === 1
          ? `Vous observez… ${def.signs.tell}`
          : b.understanding === 2
            ? `Vous comprenez ce qu’elle craint : ${def.signs.fear}.`
            : `Vous comprenez ce qu’elle désire : ${def.signs.desire}.`;
      ev.push({ t: 'reveal', level: b.understanding, text });
      if (b.understanding === 3 && def.bond.kind === 'offrande') ev.push({ t: 'text', text: def.bond.hint });
      return { events: ev };
    }
    case 'pacify':
      return { events: tryPacify(state, b) };
    case 'pact':
      return tryPact(state, b, action.item);
    case 'offer':
      return tryOffer(state, b, action.item);
    case 'answer':
      return tryAnswer(state, b, action.index);
    case 'repel': {
      if (b.setup.boss) return { events: [{ t: 'text', text: `${def.name} ne recule pas. Pas devant vous.` }] };
      b.outcome = 'repel';
      codexOf(state, b.setup.species).repelled += 1;
      state.morality.shadow += 1;
      ev.push({ t: 'text', text: `Vous chassez ${def.name}. Elle se défait en brume, blessée de ne pas avoir été comprise.` });
      ev.push({ t: 'outcome', outcome: 'repel' });
      return { events: ev };
    }
  }
  return { events: ev, consumedTurn: false };
}

function doSwitch(state: GameState, b: Battle, index: number): BEvent[] {
  const target = state.team[index];
  if (!target || target.hp <= 0) return [{ t: 'text', text: 'Impossible.' }];
  const prev = b.player;
  b.statusMemory[prev.c.uid] = prev.statuses;
  if (speciesOf(prev.c).passive === 'chaleur' && prev.c.hp > 0) prev.c.hp = Math.min(maxHp(prev.c), prev.c.hp + Math.floor(maxHp(prev.c) / 10));
  b.player = fighter(target, b.statusMemory[target.uid] ?? []);
  b.activeIndex = index;
  if (!b.participants.includes(target.uid)) b.participants.push(target.uid);
  const ev: BEvent[] = [{ t: 'switch', index }, { t: 'text', text: `${speciesOf(target).name}, à vous.` }];
  ev.push(...entryEffects(b, 'player'));
  return ev;
}

function endOfTurn(b: Battle): BEvent[] {
  const ev: BEvent[] = [];
  for (const side of ['player', 'foe'] as Side[]) {
    const f = side === 'player' ? b.player : b.foe;
    if (f.c.hp <= 0) continue;
    for (const s of [...f.statuses]) {
      if (s.id === 'saignement' || s.id === 'cendres') {
        const d = Math.max(1, Math.floor(maxHp(f.c) / (s.id === 'saignement' ? 12 : 16)));
        f.c.hp = Math.max(0, f.c.hp - d);
        ev.push({ t: 'text', text: s.id === 'saignement' ? `${nameOf(f)} saigne.` : `Les cendres rongent ${nameOf(f)}.` });
        ev.push({ t: 'damage', side, amount: d, mult: 1, crit: false, hp: f.c.hp, max: maxHp(f.c) });
        if (f.c.hp <= 0) {
          ev.push({ t: 'faint', side });
          break;
        }
      }
    }
    if (f.c.hp <= 0) continue;
    if (speciesOf(f.c).passive === 'couvee' && f.c.hp < maxHp(f.c)) {
      const amt = healAmount(b, f, Math.max(1, Math.floor(maxHp(f.c) / 16)));
      f.c.hp = Math.min(maxHp(f.c), f.c.hp + amt);
      ev.push({ t: 'heal', side, amount: amt, hp: f.c.hp, max: maxHp(f.c) });
    }
    // Durées
    for (const s of f.statuses) s.turns -= 1;
    const ended = f.statuses.filter((s) => s.turns <= 0);
    f.statuses = f.statuses.filter((s) => s.turns > 0);
    for (const s of ended) {
      ev.push({ t: 'statusEnd', side, status: s.id });
      if (s.id === 'oubli') f.sealed = undefined;
    }
    f.c.energy = Math.min(maxEnergy(f.c), f.c.energy + 2);
    if (speciesOf(f.c).passive === 'seuil') {
      const next = b.rng.pick(AFFINITY_IDS.filter((a) => a !== f.affinities[0]));
      f.affinities = [next];
      ev.push({ t: 'text', text: `L’écran de ${nameOf(f)} change de couleur.` });
    }
  }
  return ev;
}

// ---------------------------------------------------------------- Lien

function hpRatio(f: Fighter): number {
  return f.c.hp / maxHp(f.c);
}

function tryPacify(state: GameState, b: Battle): BEvent[] {
  const def = CREATURES[b.setup.species];
  if (def.bond.kind === 'aucun' || speciesOf(b.foe.c).passive === 'seuil') return [{ t: 'text', text: 'Il n’y a rien à apaiser ici. Plus rien d’humain.' }];
  if (!has(state, 'cierge_apaisement')) return [{ t: 'text', text: 'Il vous faut un cierge d’apaisement.' }];
  if (b.understanding < 2) return [{ t: 'text', text: 'Vous ne la comprenez pas encore assez. Observez-la.' }];
  if (b.setup.boss && def.bond.kind !== 'pacte') {
    return [{ t: 'text', text: def.bond.kind === 'offrande' ? def.bond.hint : 'Un cierge ne suffira pas. Elle attend une réponse.' }];
  }
  removeItem(state, 'cierge_apaisement');
  let chance = 0.35 + 0.2 * (b.understanding - 2) + (1 - hpRatio(b.foe)) * 0.5;
  if (b.setup.boss) chance *= 0.6;
  const ev: BEvent[] = [{ t: 'text', text: 'Vous allumez le cierge et lui parlez doucement de ce qu’elle craint.' }];
  if (b.rng.chance(Math.min(0.95, chance))) {
    b.outcome = 'pacify';
    const e = codexOf(state, b.setup.species);
    e.pacified = true;
    state.morality.light += 1;
    ev.push({ t: 'text', text: `${def.name} cesse de trembler. Elle se défait lentement, apaisée, et vous laisse un souvenir.` });
    const got = addItem(state, 'fragment_memoire', 1);
    if (got.ok) ev.push({ t: 'text', text: 'Obtenu : Fragment de mémoire.' });
    ev.push({ t: 'outcome', outcome: 'pacify' });
  } else {
    ev.push({ t: 'text', text: 'La flamme vacille et s’éteint. Elle n’est pas prête.' });
  }
  return ev;
}

export function pactChance(b: Battle, power: number): number {
  const def = CREATURES[b.setup.species];
  let c = def.catchRate * (1 - hpRatio(b.foe) * 0.75) * (1 + 0.3 * b.understanding) * power;
  if (b.foe.statuses.some((s) => s.id === 'torpeur' || s.id === 'effroi')) c *= 1.3;
  if (b.setup.boss) c *= 0.6;
  return Math.max(0.03, Math.min(0.95, c));
}

function tryPact(state: GameState, b: Battle, item: string): { events: BEvent[]; consumedTurn?: boolean } {
  const def = CREATURES[b.setup.species];
  const itemDef = ITEMS[item];
  if (!itemDef || itemDef.effect?.kind !== 'bond') return { events: [{ t: 'text', text: 'Ce n’est pas un fil de lien.' }], consumedTurn: false };
  if (!has(state, item)) return { events: [{ t: 'text', text: `Vous n’avez plus de ${itemDef.name}.` }], consumedTurn: false };
  if (def.bond.kind === 'aucun' || speciesOf(b.foe.c).passive === 'seuil') return { events: [{ t: 'text', text: 'Le fil se consume avant même de la toucher.' }], consumedTurn: false };
  if (def.bond.kind !== 'pacte') {
    return {
      events: [{ t: 'text', text: def.bond.kind === 'offrande' ? `Le fil glisse sans accrocher. ${def.bond.hint}` : `Le fil glisse sans accrocher. ${def.bond.prompt}` }],
      consumedTurn: false,
    };
  }
  removeItem(state, item);
  const chance = pactChance(b, itemDef.effect.power);
  const ev: BEvent[] = [{ t: 'text', text: `Vous lancez le ${itemDef.name.toLowerCase()}. Il s’enroule autour de ${def.name}…` }];
  // Trois secousses : chaque secousse a la même probabilité, le produit vaut `chance`.
  const per = Math.cbrt(chance);
  let n = 0;
  while (n < 3 && b.rng.chance(per)) {
    n++;
    ev.push({ t: 'shake', n });
  }
  if (n === 3) ev.push(...bondFoe(state, b, 'Le nœud tient.'));
  else ev.push({ t: 'text', text: n === 0 ? 'Le fil casse net.' : 'Le nœud se défait au dernier moment.' });
  return { events: ev };
}

function tryOffer(state: GameState, b: Battle, item: string): { events: BEvent[]; consumedTurn?: boolean } {
  const def = CREATURES[b.setup.species];
  if (!has(state, item)) return { events: [{ t: 'text', text: 'Vous n’avez pas cet objet.' }], consumedTurn: false };
  if (def.bond.kind === 'offrande' && def.bond.item === item) {
    removeItem(state, item);
    const ev: BEvent[] = [{ t: 'text', text: `Vous tendez ${ITEMS[item].name.toLowerCase()}. ${def.name} s’immobilise.` }];
    ev.push(...bondFoe(state, b, 'Elle accepte. Elle vous suivra.'));
    return { events: ev };
  }
  return { events: [{ t: 'text', text: `${def.name} détourne la tête. Ce n’est pas ce qu’elle cherche.` }] };
}

export function answerOptions(state: GameState, b: Battle): Array<{ text: string; enabled: boolean }> | null {
  const def = CREATURES[b.setup.species];
  if (def.bond.kind !== 'choix') return null;
  const bond = def.bond;
  const missing = bond.requiresClue && !state.clues.includes(bond.requiresClue);
  return bond.answers.map((a, i) => ({ text: missing && i === bond.correct ? '« … ? » (un nom que vous ignorez)' : a, enabled: !(missing && i === bond.correct) }));
}

function tryAnswer(state: GameState, b: Battle, index: number): { events: BEvent[]; consumedTurn?: boolean } {
  const def = CREATURES[b.setup.species];
  if (def.bond.kind !== 'choix') return { events: [{ t: 'text', text: 'Elle ne vous écoute pas.' }], consumedTurn: false };
  const bond = def.bond;
  const missing = bond.requiresClue && !state.clues.includes(bond.requiresClue);
  const ev: BEvent[] = [{ t: 'text', text: bond.answers[index] ?? '…' }];
  if (index === bond.correct && !missing) {
    ev.push(...bondFoe(state, b, `${def.name} se calme. C’était la bonne réponse.`));
    return { events: ev };
  }
  const heal = Math.floor(maxHp(b.foe.c) * 0.15);
  b.foe.c.hp = Math.min(maxHp(b.foe.c), b.foe.c.hp + heal);
  ev.push({ t: 'text', text: `${def.name} se crispe. Ce n’était pas ça.` });
  ev.push({ t: 'heal', side: 'foe', amount: heal, hp: b.foe.c.hp, max: maxHp(b.foe.c) });
  ev.push(...inflict(b, b.player, 'player', 'effroi'));
  return { events: ev };
}

function bondFoe(state: GameState, b: Battle, text: string): BEvent[] {
  const def = CREATURES[b.setup.species];
  const c = makeCreature(state, b.setup.species, b.foe.c.level);
  c.hp = Math.max(1, Math.floor(maxHp(c) * Math.max(0.5, hpRatio(b.foe))));
  const dest = addBonded(state, c);
  b.bonded = c;
  b.bondDestination = dest;
  b.outcome = 'bond';
  const ev: BEvent[] = [{ t: 'text', text }];
  if (dest === 'equipe') ev.push({ t: 'text', text: `${def.name} rejoint votre équipe.` });
  else if (dest === 'reliquaire') ev.push({ t: 'text', text: `Votre équipe est complète. ${def.name} attend dans le Reliquaire.` });
  else ev.push({ t: 'text', text: `Le Reliquaire est plein… ${def.name} reste près de vous, invisible.` });
  ev.push({ t: 'outcome', outcome: 'bond' });
  return ev;
}

// ---------------------------------------------------------------- Fin de combat

function checkEnd(state: GameState, b: Battle): BEvent[] {
  const ev: BEvent[] = [];
  if (b.outcome && b.outcome !== 'bond' && b.outcome !== 'pacify') return ev;
  if (!b.outcome && b.foe.c.hp <= 0) {
    b.outcome = 'win';
    codexOf(state, b.setup.species).defeated += 1;
    ev.push({ t: 'text', text: `${CREATURES[b.setup.species].name} se disperse en brume.` });
    ev.push({ t: 'outcome', outcome: 'win' });
  }
  if (b.outcome === 'win' || b.outcome === 'bond' || b.outcome === 'pacify') {
    ev.push(...grantXp(state, b));
    return ev;
  }
  if (b.player.c.hp <= 0) {
    if (aliveCount(state.team) === 0) {
      b.outcome = 'lose';
      ev.push({ t: 'text', text: 'Tous vos Rémanents se sont dissipés. Le brouillard se referme sur vous…' });
      ev.push({ t: 'outcome', outcome: 'lose' });
    } else {
      b.needSwitch = true;
      ev.push({ t: 'text', text: `${nameOf(b.player)} se dissipe. Qui prend sa place ?` });
    }
  }
  return ev;
}

function grantXp(state: GameState, b: Battle): BEvent[] {
  const ev: BEvent[] = [];
  let amount = xpReward(b.setup.species, b.setup.level);
  if (b.outcome !== 'win') amount = Math.floor(amount * 0.6);
  const alive = b.participants.map((uid) => state.team.find((c) => c.uid === uid)).filter((c): c is CreatureInstance => !!c && c.hp > 0);
  const share = alive.length > 1 ? Math.floor(amount * 0.75) : amount;
  for (const c of alive) {
    const r = gainXp(c, share);
    ev.push({ t: 'xp', uid: c.uid, amount: share, levels: r.levels, learned: r.learned, learnedInactive: r.learnedInactive });
    if (gainBond(c, 1)) ev.push({ t: 'bondUp', uid: c.uid, level: c.bond });
  }
  return ev;
}

/** Nettoyage après combat : énergie restaurée, statuts oubliés. Les PV persistent. */
export function endBattleCleanup(state: GameState): void {
  for (const c of state.team) c.energy = maxEnergy(c);
}

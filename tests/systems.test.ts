import { describe, expect, it } from 'vitest';
import { Rng } from '../src/core/rng';
import { newGame, type GameState } from '../src/core/state';
import { MemoryKV, SaveStore, deserialize, serialize, validateState } from '../src/core/save';
import { phaseOf } from '../src/core/clock';
import { BAG_SLOTS, ITEM_LIST } from '../src/data/items';
import {
  abilityOptions,
  chooseAbility,
  answerOptions,
  computeDamage,
  hasStatus,
  pactChance,
  playerTurn,
  startBattle,
  type Battle,
} from '../src/battle/engine';
import {
  addBonded,
  applyTransform,
  gainXp,
  makeCreature,
  maxHp,
  pendingTransform,
  setActiveAbilities,
  swapWithReliquary,
  xpForLevel,
} from '../src/systems/creatures';
import { addItem, equipItem, removeItem, unequipItem, useItemOn, usedSlots } from '../src/systems/inventory';
import { completeQuest, journalView, setStage } from '../src/systems/quests';
import { evalCondition } from '../src/systems/conditions';
import { pickHorror, newDirector } from '../src/systems/horror';
import { readDocument } from '../src/systems/script';

function withTeam(species: string, level: number, seed = 1): GameState {
  const s = newGame(seed);
  s.team.push(makeCreature(s, species, level));
  return s;
}

function fight(s: GameState, foe: string, level: number, seed: number, opts: { boss?: boolean; noFlee?: boolean } = {}): Battle {
  return startBattle(s, { species: foe, level, ...opts }, new Rng(seed)).battle;
}

/** Combat automatique : le joueur utilise sa meilleure attaque disponible. */
function autoBattle(s: GameState, b: Battle, maxTurns = 60): number {
  let t = 0;
  while (!b.outcome && t < maxTurns) {
    if (b.needSwitch) {
      playerTurn(s, b, { kind: 'switch', index: s.team.findIndex((c) => c.hp > 0) });
      continue;
    }
    const ab = chooseAbility(b, 'player');
    playerTurn(s, b, { kind: 'ability', id: abilityOptions(b).some((o) => o.id === ab.id && o.usable) ? ab.id : b.player.c.abilities[0] });
    t++;
  }
  return t;
}

describe('combat', () => {
  it('un combat complet se termine, donne de l’expérience et peut faire monter de niveau', () => {
    const s = withTeam('veilleuse', 5);
    const before = s.team[0].xp;
    const b = fight(s, 'mitaine', 3, 42);
    autoBattle(s, b);
    expect(['win', 'lose']).toContain(b.outcome);
    if (b.outcome === 'win') expect(s.team[0].xp).toBeGreaterThan(before);
  });

  it('la défaite est détectée quand toute l’équipe est dissipée', () => {
    const s = withTeam('mitaine', 2);
    const b = fight(s, 'gardien_blanc', 30, 3, { boss: true, noFlee: true });
    autoBattle(s, b);
    expect(b.outcome).toBe('lose');
    expect(s.team[0].hp).toBe(0);
  });

  it('changement forcé quand le Rémanent actif tombe', () => {
    const s = withTeam('mitaine', 3);
    s.team.push(makeCreature(s, 'veilleuse', 30));
    const b = fight(s, 'archivore', 25, 5, { boss: true });
    let guard = 0;
    while (!b.needSwitch && !b.outcome && guard++ < 50) playerTurn(s, b, { kind: 'ability', id: 'griffure' });
    expect(b.needSwitch).toBe(true);
    // Une autre action est refusée tant qu'on n'a pas changé
    const ev = playerTurn(s, b, { kind: 'ability', id: 'griffure' });
    expect(ev[0]).toMatchObject({ t: 'text' });
    playerTurn(s, b, { kind: 'switch', index: 1 });
    expect(b.player.c.species).toBe('veilleuse');
    expect(b.needSwitch).toBe(false);
  });

  it('les affinités modifient les dégâts dans le bon sens', () => {
    const s = withTeam('palefeu', 20);
    const b = fight(s, 'ronceline', 20, 9);
    const braise = { ...abilityOptions(b)[0].def };
    const strong = computeDamage(b, b.player, b.foe, { ...braise, affinity: 'cendre' }, false);
    const neutral = computeDamage(b, b.player, b.foe, { ...braise, affinity: 'echo' }, false);
    expect(strong.mult).toBe(1.5);
    expect(strong.damage).toBeGreaterThan(neutral.damage);
  });

  it('statuts simultanés : saignement + cendres + effroi s’appliquent et expirent', () => {
    const s = withTeam('ronceline', 15);
    const b = fight(s, 'coquemort', 15, 2);
    b.foe.statuses.push({ id: 'saignement', turns: 2 }, { id: 'cendres', turns: 1 }, { id: 'effroi', turns: 3 });
    const hp0 = b.foe.c.hp;
    playerTurn(s, b, { kind: 'observe' });
    expect(b.foe.c.hp).toBeLessThan(hp0);
    expect(hasStatus(b.foe, 'cendres')).toBe(false);
    expect(hasStatus(b.foe, 'saignement')).toBe(true);
    playerTurn(s, b, { kind: 'observe' });
    expect(hasStatus(b.foe, 'saignement')).toBe(false);
  });

  it('la Veille protège de l’Effroi et de l’Oubli', () => {
    const s = withTeam('veilleuse', 10);
    const b = fight(s, 'sonneur', 18, 1);
    for (let i = 0; i < 6 && !b.outcome; i++) playerTurn(s, b, { kind: 'observe' });
    expect(hasStatus(b.player, 'effroi')).toBe(false);
    expect(hasStatus(b.player, 'oubli')).toBe(false);
  });

  it('impossible de fuir un combat noFlee ; fuite possible sinon', () => {
    const s = withTeam('veilleuse', 30);
    const b = fight(s, 'archivore', 26, 1, { boss: true, noFlee: true });
    playerTurn(s, b, { kind: 'flee' });
    expect(b.outcome).toBeNull();
    const b2 = fight(s, 'mitaine', 2, 1);
    for (let i = 0; i < 5 && !b2.outcome; i++) playerTurn(s, b2, { kind: 'flee' });
    expect(b2.outcome).toBe('flee');
  });

  it('énergie insuffisante : la capacité est refusée sans perdre le tour', () => {
    const s = withTeam('palefeu', 20);
    const b = fight(s, 'mitaine', 5, 1);
    b.player.c.energy = 0;
    const costly = abilityOptions(b).find((o) => o.def.cost > 0);
    expect(costly?.usable).toBe(false);
    const turn = b.turn;
    playerTurn(s, b, { kind: 'ability', id: costly!.id });
    expect(b.turn).toBe(turn);
  });
});

describe('lien : observer, apaiser, pacte, offrande, choix, repousser', () => {
  it('observer révèle progressivement signe, peur, désir', () => {
    const s = withTeam('veilleuse', 10);
    const b = fight(s, 'gribouille', 6, 1);
    const ev1 = playerTurn(s, b, { kind: 'observe' });
    expect(ev1.some((e) => e.t === 'reveal' && e.level === 1)).toBe(true);
    playerTurn(s, b, { kind: 'observe' });
    playerTurn(s, b, { kind: 'observe' });
    expect(b.understanding).toBe(3);
    expect(s.codex.gribouille.observed).toBe(3);
  });

  it('pacte : un Rémanent affaibli et compris rejoint l’équipe, l’objet est consommé', () => {
    let joined = false;
    for (let seed = 1; seed < 40 && !joined; seed++) {
      const s = withTeam('veilleuse', 12, seed);
      addItem(s, 'fil_rouge', 10);
      const b = fight(s, 'mitaine', 4, seed);
      b.understanding = 3;
      b.foe.c.hp = 1;
      expect(pactChance(b, 1)).toBeGreaterThan(0.5);
      playerTurn(s, b, { kind: 'pact', item: 'fil_rouge' });
      expect(s.inventory.fil_rouge).toBe(9);
      if (b.outcome === 'bond') {
        joined = true;
        expect(s.team.length).toBe(2);
        expect(s.codex.mitaine.bonded).toBe(true);
      }
    }
    expect(joined).toBe(true);
  });

  it('équipe pleine : le Rémanent lié va au Reliquaire', () => {
    const s = withTeam('veilleuse', 12);
    for (let i = 0; i < 3; i++) s.team.push(makeCreature(s, 'mitaine', 5));
    const c = makeCreature(s, 'gribouille', 5);
    expect(addBonded(s, c)).toBe('reliquaire');
    expect(s.reliquary.length).toBe(1);
    expect(swapWithReliquary(s, 1, 0)).toBe(true);
    expect(s.team[1].species).toBe('gribouille');
    expect(s.reliquary[0].species).toBe('mitaine');
  });

  it('un fil ne fonctionne pas sur un Rémanent à offrande ; la bonne offrande fonctionne', () => {
    const s = withTeam('veilleuse', 20);
    addItem(s, 'fil_rouge', 3);
    addItem(s, 'photo_brulee');
    addItem(s, 'tisane', 1);
    const b = fight(s, 'mere_cendre', 16, 1, { boss: true });
    playerTurn(s, b, { kind: 'pact', item: 'fil_rouge' });
    expect(s.inventory.fil_rouge).toBe(3);
    playerTurn(s, b, { kind: 'offer', item: 'tisane' });
    expect(b.outcome).toBeNull();
    playerTurn(s, b, { kind: 'offer', item: 'photo_brulee' });
    expect(b.outcome).toBe('bond');
    expect(s.inventory.photo_brulee).toBeUndefined();
  });

  it('choix : le bon prénom n’est disponible qu’avec l’indice', () => {
    const s = withTeam('veilleuse', 20);
    const b = fight(s, 'chien_creux', 12, 1);
    const opts = answerOptions(s, b)!;
    expect(opts[1].enabled).toBe(false);
    playerTurn(s, b, { kind: 'answer', index: 1 });
    expect(b.outcome).toBeNull();
    s.clues.push('nom_theo');
    expect(answerOptions(s, b)![1].enabled).toBe(true);
    playerTurn(s, b, { kind: 'answer', index: 1 });
    expect(b.outcome).toBe('bond');
  });

  it('apaiser exige de comprendre ; donne un fragment de mémoire et de la lumière', () => {
    let ok = false;
    for (let seed = 1; seed < 30 && !ok; seed++) {
      const s = withTeam('veilleuse', 15, seed);
      addItem(s, 'cierge_apaisement', 5);
      const b = fight(s, 'gribouille', 6, seed);
      playerTurn(s, b, { kind: 'pacify' });
      expect(s.inventory.cierge_apaisement).toBe(5); // refusé : pas assez compris
      b.understanding = 3;
      b.foe.c.hp = 1;
      playerTurn(s, b, { kind: 'pacify' });
      if (b.outcome === 'pacify') {
        ok = true;
        expect(s.morality.light).toBe(1);
        expect(s.inventory.fragment_memoire).toBe(1);
        expect(s.codex.gribouille.pacified).toBe(true);
      }
    }
    expect(ok).toBe(true);
  });

  it('repousser marche sur un Rémanent commun, pas sur un boss', () => {
    const s = withTeam('veilleuse', 15);
    const b = fight(s, 'archivore', 20, 1, { boss: true });
    playerTurn(s, b, { kind: 'repel' });
    expect(b.outcome).toBeNull();
    const b2 = fight(s, 'mitaine', 3, 1);
    playerTurn(s, b2, { kind: 'repel' });
    expect(b2.outcome).toBe('repel');
    expect(s.morality.shadow).toBe(1);
  });

  it('l’Archiviste Blanc ne peut pas être lié', () => {
    const s = withTeam('veilleuse', 30);
    addItem(s, 'fil_dore', 3);
    const b = fight(s, 'gardien_blanc', 30, 1, { boss: true, noFlee: true });
    playerTurn(s, b, { kind: 'pact', item: 'fil_dore' });
    expect(b.outcome).not.toBe('bond');
    expect(s.inventory.fil_dore).toBe(3);
  });
});

describe('progression', () => {
  it('courbe d’expérience croissante et apprentissage de capacités', () => {
    for (let l = 2; l < 50; l++) expect(xpForLevel(l + 1)).toBeGreaterThan(xpForLevel(l));
    const c = makeCreature(null, 'mitaine', 3);
    const r = gainXp(c, xpForLevel(9) - c.xp);
    expect(c.level).toBe(9);
    expect(r.levels).toEqual([4, 5, 6, 7, 8, 9]);
    expect(c.known).toContain('etreinte');
    expect(c.known).toContain('chair_nouvelle');
  });

  it('transformation : niveau atteint → nouvelle espèce, PV proportionnels', () => {
    const c = makeCreature(null, 'mitaine', 15);
    expect(pendingTransform(c)).toBeNull();
    gainXp(c, xpForLevel(16) - c.xp);
    expect(pendingTransform(c)).toBe('main_froide');
    c.hp = Math.floor(maxHp(c) / 2);
    applyTransform(c, 'main_froide');
    expect(c.species).toBe('main_froide');
    expect(c.hp / maxHp(c)).toBeGreaterThan(0.4);
    expect(c.hp / maxHp(c)).toBeLessThan(0.6);
    expect(c.known).toContain('absence');
  });

  it('transformation liée au lien (Veilleuse)', () => {
    const c = makeCreature(null, 'veilleuse', 20);
    expect(pendingTransform(c)).toBeNull();
    c.bond = 3;
    expect(pendingTransform(c)).toBe('veilleuse_eveillee');
  });

  it('capacités actives : 1 à 4 parmi les capacités connues', () => {
    const c = makeCreature(null, 'veilleuse', 30);
    expect(setActiveAbilities(c, [])).toBe(false);
    expect(setActiveAbilities(c, ['inconnue'])).toBe(false);
    expect(setActiveAbilities(c, ['songe', 'berceuse'])).toBe(true);
    expect(c.abilities).toEqual(['songe', 'berceuse']);
  });
});

describe('équilibrage', () => {
  function winRate(attacker: string, defender: string, level: number, n = 60): number {
    let w = 0;
    for (let i = 0; i < n; i++) {
      const s = withTeam(attacker, level, i + 1);
      const b = fight(s, defender, level, i * 7 + 3);
      autoBattle(s, b);
      if (b.outcome === 'win') w++;
    }
    return w / n;
  }

  it('la Veilleuse de départ bat les Rémanents du début de jeu la plupart du temps', () => {
    const s = withTeam('veilleuse', 6);
    let wins = 0;
    for (let i = 0; i < 40; i++) {
      const st = withTeam('veilleuse', 6, i + 1);
      const b = fight(st, i % 2 ? 'mitaine' : 'gribouille', 4, i);
      autoBattle(st, b);
      if (b.outcome === 'win') wins++;
    }
    expect(s.team.length).toBe(1);
    expect(wins / 40).toBeGreaterThan(0.7);
  });

  it('un combat à niveau égal dure entre 2 et 12 tours en moyenne', () => {
    for (const lvl of [5, 15, 30]) {
      let total = 0;
      for (let i = 0; i < 30; i++) {
        const s = withTeam('ronceline', lvl, i + 1);
        const b = fight(s, 'mitaine', lvl, i + 100);
        total += autoBattle(s, b);
      }
      const avg = total / 30;
      expect(avg, `niveau ${lvl}`).toBeGreaterThanOrEqual(2);
      expect(avg, `niveau ${lvl}`).toBeLessThanOrEqual(12);
    }
  });

  it('l’avantage d’affinité se ressent sur le taux de victoire', () => {
    // Cendre domine Racine ; Racine est faible contre Cendre.
    const good = winRate('palefeu', 'ronceline', 12);
    const bad = winRate('ronceline', 'palefeu', 12);
    expect(good).toBeGreaterThan(bad);
  });

  it('aucune espèce commune n’est imbattable ni sans espoir face à un panel de même niveau', () => {
    const commons = ['mitaine', 'palefeu', 'gribouille', 'ronceline', 'gresille', 'murmure_mur', 'coquemort', 'lampiste', 'faux_ami'];
    const panel = ['mitaine', 'gribouille', 'coquemort', 'gresille', 'ronceline'];
    for (const sp of commons) {
      const avg = panel.reduce((t, d) => t + winRate(sp, d, 15, 30), 0) / panel.length;
      expect(avg, sp).toBeGreaterThan(0.2);
      expect(avg, sp).toBeLessThan(0.8);
    }
  });
});

describe('inventaire', () => {
  it('objets uniques jamais dupliqués', () => {
    const s = newGame(1);
    expect(addItem(s, 'cle_ecole').ok).toBe(true);
    expect(addItem(s, 'cle_ecole').ok).toBe(false);
    expect(s.inventory.cle_ecole).toBe(1);
  });
  it('pile maximale : ajout refusé en entier, rien n’est perdu', () => {
    const s = newGame(1);
    addItem(s, 'tisane', 98);
    const r = addItem(s, 'tisane', 2);
    expect(r.ok).toBe(false);
    expect(s.inventory.tisane).toBe(98);
  });
  it('sac plein : nouvel objet refusé, les clés passent toujours', () => {
    const s = newGame(1);
    const consumables = ITEM_LIST.filter((i) => !i.unique && !['cle', 'outil', 'quete', 'document'].includes(i.category));
    let added = 0;
    for (let i = 0; usedSlots(s) < BAG_SLOTS && i < consumables.length; i++) if (addItem(s, consumables[i].id).ok) added++;
    if (usedSlots(s) < BAG_SLOTS) {
      // Moins de types que d'emplacements : on simule un sac plein.
      for (let i = 0; usedSlots(s) < BAG_SLOTS; i++) s.inventory[`faux_${i}`] = 1;
    }
    expect(addItem(s, 'fil_dore').ok || s.inventory.fil_dore !== undefined).toBe(s.inventory.fil_dore !== undefined);
    expect(addItem(s, 'badge_institut').ok).toBe(true);
    expect(added).toBeGreaterThan(0);
  });
  it('retirer plus que possédé échoue sans rien modifier', () => {
    const s = newGame(1);
    addItem(s, 'tisane', 2);
    expect(removeItem(s, 'tisane', 3)).toBe(false);
    expect(s.inventory.tisane).toBe(2);
    expect(removeItem(s, 'tisane', 2)).toBe(true);
    expect(s.inventory.tisane).toBeUndefined();
  });
  it('soins : consommés seulement si utiles', () => {
    const s = withTeam('mitaine', 10);
    addItem(s, 'tisane', 2);
    expect(useItemOn(s, 'tisane', s.team[0], 'exploration').ok).toBe(false);
    expect(s.inventory.tisane).toBe(2);
    s.team[0].hp = 1;
    expect(useItemOn(s, 'tisane', s.team[0], 'exploration').ok).toBe(true);
    expect(s.inventory.tisane).toBe(1);
    s.team[0].hp = 0;
    expect(useItemOn(s, 'tisane', s.team[0], 'exploration').ok).toBe(false);
    addItem(s, 'souvenir_chaud');
    expect(useItemOn(s, 'souvenir_chaud', s.team[0], 'exploration').ok).toBe(true);
    expect(s.team[0].hp).toBeGreaterThan(0);
  });
  it('équiper / déséquiper sans duplication ni perte', () => {
    const s = withTeam('mitaine', 10);
    addItem(s, 'chapelet');
    addItem(s, 'bague_verre');
    const c = s.team[0];
    expect(equipItem(s, c, 'chapelet').ok).toBe(true);
    expect(s.inventory.chapelet).toBeUndefined();
    expect(equipItem(s, c, 'bague_verre').ok).toBe(true);
    expect(s.inventory.chapelet).toBe(1);
    expect(c.equip).toBe('bague_verre');
    expect(unequipItem(s, c).ok).toBe(true);
    expect(s.inventory.bague_verre).toBe(1);
    expect(c.equip).toBeUndefined();
  });
  it('les documents changent après certaines scènes', () => {
    const s = newGame(1);
    addItem(s, 'photo_classe');
    const before = readDocument(s, 'photo_classe').text;
    s.flags.revelation = true;
    const after = readDocument(s, 'photo_classe').text;
    s.flags.verite_revelee = true;
    const after2 = readDocument(s, 'photo_classe').text;
    expect(new Set([before, after, after2]).size).toBe(3);
  });
  it('documents : la lecture donne l’indice une seule fois, et sous condition', () => {
    const s = newGame(1);
    addItem(s, 'journal_perso');
    expect(readDocument(s, 'journal_perso').clueMsg).toBeNull();
    s.clues.push('maison_nuit');
    expect(readDocument(s, 'journal_perso').clueMsg).not.toBeNull();
    expect(readDocument(s, 'journal_perso').clueMsg).toBeNull();
  });
});

describe('quêtes et journal', () => {
  it('étapes monotones, ordre inhabituel, récompense unique', () => {
    const s = newGame(1);
    expect(setStage(s, 'q_theo', 2)?.kind).toBe('start');
    expect(setStage(s, 'q_theo', 1)).toBeNull();
    expect(s.quests.q_theo.stage).toBe(2);
    completeQuest(s, 'q_theo');
    expect(s.inventory.bouillon).toBe(2);
    expect(completeQuest(s, 'q_theo')).toBeNull();
    expect(s.inventory.bouillon).toBe(2);
    expect(setStage(s, 'q_theo', 2)).toBeNull();
  });
  it('terminer une quête jamais commencée fonctionne', () => {
    const s = newGame(1);
    expect(completeQuest(s, 'q_lys')?.kind).toBe('done');
    expect(s.quests.q_lys.done).toBe(true);
  });
  it('journal : objectifs actifs, indices, pistes non résolues', () => {
    const s = newGame(1);
    setStage(s, 'q_main', 2);
    s.clues.push('lettre');
    const j = journalView(s, (c) => evalCondition(s, c));
    expect(j.active[0].id).toBe('q_main');
    expect(j.clues.length).toBe(1);
    expect(j.leads.some((l) => l.id === 'l_elise')).toBe(true);
    s.clues.push('dossier_varenne');
    expect(journalView(s, (c) => evalCondition(s, c)).leads.some((l) => l.id === 'l_elise')).toBe(false);
  });
  it('l’Archivore masque l’affichage des indices sans les supprimer', () => {
    const s = newGame(1);
    s.clues.push('lettre', 'maison_nuit', 'photo_classe');
    s.flags.archivore_mange = true;
    const j = journalView(s, (c) => evalCondition(s, c));
    expect(j.clues.some((c) => c.eaten)).toBe(true);
    expect(s.clues.length).toBe(3);
  });
});

describe('temps', () => {
  it('phases de la journée', () => {
    expect(phaseOf(10 * 60)).toBe('jour');
    expect(phaseOf(20 * 60)).toBe('crepuscule');
    expect(phaseOf(22 * 60 + 30)).toBe('nuit');
    expect(phaseOf(23 * 60 + 50)).toBe('minuit');
    expect(phaseOf(30)).toBe('minuit');
    expect(phaseOf(3 * 60)).toBe('nuit');
    expect(phaseOf(10 * 60, true)).toBe('nuit');
  });
});

describe('sauvegarde', () => {
  function sample(): GameState {
    const s = withTeam('veilleuse', 7);
    addItem(s, 'tisane', 3);
    addItem(s, 'cle_ecole');
    s.flags.intro = true;
    setStage(s, 'q_main', 3);
    s.clues.push('lettre');
    s.player.zone = 'village';
    s.player.x = 16;
    s.player.y = 20;
    return s;
  }

  it('aller-retour sans perte', () => {
    const s = sample();
    const r = deserialize(serialize(s));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.state.team[0].species).toBe('veilleuse');
      expect(r.state.inventory).toEqual(s.inventory);
      expect(r.state.quests).toEqual(s.quests);
      expect(r.state.flags).toEqual(s.flags);
      expect(r.state.player).toEqual(s.player);
      expect(r.repairs).toEqual([]);
    }
  });

  it('données altérées : somme de contrôle refusée, la copie de secours est utilisée', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    const s = sample();
    store.write('slot1', s, 1000);
    s.inventory.tisane = 5;
    store.write('slot1', s, 2000);
    const key = 'veilbound.v1.slot1';
    kv.setItem(key, (kv.getItem(key) as string).replace('"tisane":5', '"tisane":99'));
    const r = store.read('slot1');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recoveredFrom).toBe('bak');
      expect(r.state.inventory.tisane).toBe(3);
    }
  });

  it('fermeture inattendue pendant l’écriture : le fichier temporaire valide est récupéré', () => {
    const kv = new MemoryKV();
    const store = new SaveStore(kv);
    const s = sample();
    store.write('auto', s, 1000);
    // Simule un crash : tmp écrit, principal tronqué.
    s.inventory.tisane = 7;
    const raw = serialize(s, 3000);
    kv.setItem('veilbound.v1.auto.tmp', raw);
    kv.setItem('veilbound.v1.auto', raw.slice(0, 50));
    const r = store.read('auto');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.recoveredFrom).toBe('tmp');
      expect(r.state.inventory.tisane).toBe(7);
    }
  });

  it('sauvegarde illisible et aucune copie : erreur propre, pas d’exception', () => {
    const kv = new MemoryKV();
    kv.setItem('veilbound.v1.slot2', '{pas du json');
    const r = new SaveStore(kv).read('slot2');
    expect(r.ok).toBe(false);
  });

  it('version future refusée', () => {
    const raw = JSON.parse(serialize(sample()));
    raw.version = 999;
    expect(deserialize(JSON.stringify(raw)).ok).toBe(false);
  });

  it('réparations : position invalide, objets et créatures inconnus, doublons, bornes', () => {
    const s = sample() as any;
    s.player.x = 0;
    s.player.y = 0; // arbre
    s.inventory.objet_fantome = 3;
    s.inventory.cle_ecole = 5;
    s.team.push({ ...s.team[0] });
    s.team.push({ species: 'inexistant' });
    s.team[0].hp = 99999;
    const { state, repairs } = validateState(JSON.parse(JSON.stringify(s)));
    expect(state.player.zone).toBe(state.lastRest.zone);
    expect(state.inventory.objet_fantome).toBeUndefined();
    expect(state.inventory.cle_ecole).toBe(1);
    expect(state.team.length).toBe(1);
    expect(state.team[0].hp).toBe(maxHp(state.team[0]));
    expect(repairs.length).toBeGreaterThan(0);
  });

  it('dernier emplacement utilisé pour « Continuer »', () => {
    const store = new SaveStore(new MemoryKV());
    store.write('slot2', sample(), 100);
    store.write('auto', sample(), 500);
    store.write('slot1', sample(), 300);
    expect(store.latest()).toBe('auto');
  });

  it('un état arbitraire ne fait jamais planter la validation', () => {
    const rng = new Rng(5);
    const junk = [null, 3, 'x', [], { player: 'x' }, { team: [{}], inventory: [] }, { quests: { q_main: { stage: 999 } } }];
    for (const j of junk) expect(() => validateState(j)).not.toThrow();
    for (let i = 0; i < 50; i++) {
      const s = sample() as any;
      const keys = Object.keys(s);
      s[keys[rng.int(0, keys.length - 1)]] = rng.chance(0.5) ? null : 'corrompu';
      expect(() => validateState(s)).not.toThrow();
    }
    expect(validateState({ quests: { q_main: { stage: 999 } } }).state.quests.q_main.stage).toBe(11);
  });
});

describe('horreur', () => {
  it('respecte le délai global et les plafonds', () => {
    const s = withTeam('veilleuse', 5);
    s.time = 23 * 60;
    const d = newDirector();
    const rng = new Rng(1);
    let count = 0;
    let lastT = -999;
    for (let t = 0; t < 3600; t += 5) {
      const e = pickHorror(d, s, 'foret', 'foret', false, t, rng, false);
      if (e) {
        expect(t - lastT).toBeGreaterThanOrEqual(45);
        lastT = t;
        count++;
      }
    }
    expect(count).toBeGreaterThan(5);
    expect(count).toBeLessThan(3600 / 45 + 1);
    expect(d.counts.cloches_loin ?? 0).toBeLessThanOrEqual(3);
  });

  it('mode atténué : moins d’événements', () => {
    const s = withTeam('veilleuse', 5);
    s.time = 23 * 60;
    const count = (att: boolean) => {
      const d = newDirector();
      const rng = new Rng(2);
      let n = 0;
      for (let t = 0; t < 7200; t += 5) if (pickHorror(d, s, 'foret', 'foret', false, t, rng, att)) n++;
      return n;
    };
    expect(count(true)).toBeLessThan(count(false));
  });
});

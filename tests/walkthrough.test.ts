import { describe, expect, it } from 'vitest';
import { newGame, type GameState } from '../src/core/state';
import { keyClueCount } from '../src/systems/quests';
import { has } from '../src/systems/inventory';
import { evalCondition } from '../src/systems/conditions';
import { ZONES } from '../src/data/zones';
import { warpAt } from '../src/world/map';
import { HeadlessHost, enter, enterZoneScripts, interact, isPresent, touch } from './helpers';

const NIGHT = 22 * 60 + 10;
const MIDNIGHT = 23 * 60 + 45;
const DAY = 10 * 60;

/** Joue l'histoire principale de bout en bout, sans interface. */
async function playMainStory(host: HeadlessHost, opts: { reveal: boolean }) {
  const s = host.state;
  await enterZoneScripts(host, 'village');
  expect(s.team[0]?.species).toBe('veilleuse');
  expect(has(s, 'lettre_elise')).toBe(true);

  // Pension, mairie
  await enter(host, 'village', 5, 4);
  await interact(host, 'pension', 'breve');
  expect(s.quests.q_main.stage).toBe(1);
  await interact(host, 'pension', 'lit_pension', ['matin']);
  expect(s.flags.oubli_breve).toBe(true);
  await interact(host, 'pension', 'breve');
  expect(s.clues).toContain('oubli_villageois');
  await interact(host, 'mairie', 'odile');
  expect(has(s, 'fil_rouge', 5)).toBe(true);

  // Le n° 9 n'existe que la nuit
  s.time = DAY;
  await expect(enter(host, 'village', 25, 18)).rejects.toThrow();
  s.time = NIGHT;
  await enter(host, 'village', 25, 18);
  expect(s.player.zone).toBe('tilleuls9');
  await interact(host, 'tilleuls9', 'cle_ecole');
  await interact(host, 'tilleuls9', 'lit_enfant');
  expect(has(s, 'cle_ecole')).toBe(true);

  // École et couloir impossible
  await enter(host, 'ecole_cour', 10, 3);
  await interact(host, 'ecole', 'dessin_theo');
  await interact(host, 'ecole', 'miroir_toilettes');
  expect(s.clues).toContain('miroir_vide');
  // Mauvaise porte : retour au début
  await touch(host, 'ecole_couloir', 'porte_couloir_2');
  expect(s.player.zone).toBe('ecole_couloir');
  for (const n of [3, 1, 4]) await touch(host, 'ecole_couloir', `porte_couloir_${n}`);
  expect(s.player.zone).toBe('classe_absente');
  await enterZoneScripts(host, 'classe_absente');
  await interact(host, 'classe_absente', 'photo_classe');
  expect(host.battles.some((b) => b.species === 'pli')).toBe(true);
  expect(has(s, 'photo_classe')).toBe(true);

  // Pharmacie : la photo ouvre l'hôpital
  await interact(host, 'pharmacie', 'mireille');
  expect(has(s, 'cle_hopital')).toBe(true);
  await interact(host, 'pharmacie', 'ordonnance');

  // Gare
  await interact(host, 'gare_hall', 'tobias');
  expect(has(s, 'lampe_torche') && has(s, 'radio')).toBe(true);

  // Hôpital
  await enter(host, 'hopital_ext', 9, 3);
  host.codes.push('1234');
  await interact(host, 'hopital', 'cadenas_archives');
  expect(s.flags.archives_ouvertes).toBeFalsy();
  host.codes.push('0917');
  await interact(host, 'hopital', 'cadenas_archives');
  expect(s.flags.archives_ouvertes).toBe(true);
  for (const id of ['dossier_varenne', 'cassette_1', 'badge_institut', 'ticket_sans_date', 'cassette_2']) await interact(host, 'hopital', id);
  expect(isPresent(s, 'hopital', 'declencheur_sonneur')).toBe(true);
  await touch(host, 'hopital', 'declencheur_sonneur', ['Répondre', 'pacte']);
  expect(s.team.some((c) => c.species === 'sonneur')).toBe(true);
  expect(s.quests.q_sonnettes.done).toBe(true);

  // Train de 23 h 50
  s.time = NIGHT;
  expect(isPresent(s, 'gare', 'train_minuit')).toBe(false);
  s.time = MIDNIGHT;
  await interact(host, 'gare', 'train_minuit', ['Monter']);
  expect(s.player.zone).toBe('train');
  await expect(enter(host, 'train', 19, 2)).rejects.toThrow();
  await interact(host, 'train', 'controleur');
  await enter(host, 'train', 19, 2);
  expect(s.player.zone).toBe('cendriers');

  // Maison Varenne : la révélation
  await enter(host, 'cendriers', 27, 4);
  await interact(host, 'maison_varenne', 'miroir_varenne');
  expect(s.flags.revelation).toBe(true);
  await interact(host, 'maison_varenne', 'cassette_3');
  await interact(host, 'maison_varenne', 'bureau_varenne');

  // Institut
  s.player.zone = 'cendriers';
  await enter(host, 'cendriers', 15, 0);
  expect(s.flags.archivore_mange).toBe(true);
  await interact(host, 'institut', 'archivore');
  expect(s.flags.archivore_vaincu).toBe(true);
  expect(s.flags.archivore_mange).toBeFalsy();
  await interact(host, 'institut', 'cassette_4');
  expect(keyClueCount(s)).toBeGreaterThanOrEqual(6);

  if (opts.reveal) {
    await interact(host, 'mairie', 'odile', ['Tout lui raconter']);
    expect(s.flags.verite_revelee).toBe(true);
    expect(s.quests.q_archives.done).toBe(true);
  }
  // Descente au Seuil
  expect(warpAt(ZONES.institut, 24, 2)?.to).toBe('seuil');
}

describe('histoire principale jouable de bout en bout', () => {
  it('fin « Mémoire » quand la vérité a été révélée', async () => {
    const host = new HeadlessHost(newGame(7));
    await playMainStory(host, { reveal: true });
    await interact(host, 'seuil', 'archiviste_blanc', ['L’ouvrir']);
    expect(host.endingReached).toBe('memoire');
    expect(host.state.endings).toContain('memoire');
  });

  it('fin « Le Sceau »', async () => {
    const host = new HeadlessHost(newGame(8));
    await playMainStory(host, { reveal: false });
    await interact(host, 'seuil', 'archiviste_blanc', ['sceller']);
    expect(host.endingReached).toBe('sceau');
  });

  it('fin « Le Brouillard » si on ouvre le Voile sans que la ville se souvienne', async () => {
    const host = new HeadlessHost(newGame(9));
    await playMainStory(host, { reveal: false });
    await interact(host, 'seuil', 'archiviste_blanc', ['L’ouvrir', 'Ouvrir quand même']);
    expect(host.endingReached).toBe('brouillard');
  });

  it('« Pas encore » au Seuil ne termine pas la partie et permet de revenir', async () => {
    const host = new HeadlessHost(newGame(10));
    await playMainStory(host, { reveal: false });
    await interact(host, 'seuil', 'archiviste_blanc', ['Pas encore']);
    expect(host.endingReached).toBeNull();
    expect(isPresent(host.state, 'seuil', 'archiviste_blanc')).toBe(true);
    // Le boss vaincu ne se rejoue pas.
    const before = host.battles.length;
    await interact(host, 'seuil', 'archiviste_blanc', ['Pas encore']);
    expect(host.battles.length).toBe(before);
  });

  it('un combat perdu interrompt le script sans valider la suite', async () => {
    const host = new HeadlessHost(newGame(11));
    await playMainStory(host, { reveal: false });
    host.battleResult = 'lose';
    await interact(host, 'seuil', 'archiviste_blanc', []);
    expect(host.state.flags.kessin_vaincu).toBeFalsy();
    expect(host.endingReached).toBeNull();
  });
});

describe('chemin alternatif et quêtes secondaires', () => {
  it('la mine mène aux Cendriers avec la lampe et la bonne séquence de leviers', async () => {
    const host = new HeadlessHost(newGame(3));
    const s = host.state;
    await enterZoneScripts(host, 'village');
    await expect(enter(host, 'marais', 27, 3)).rejects.toThrow();
    await interact(host, 'gare_hall', 'tobias');
    await enter(host, 'marais', 27, 3);
    // Mauvais ordre
    await interact(host, 'mine', 'levier_milieu');
    expect(s.flags.cage_ouverte).toBeFalsy();
    for (const l of ['levier_gauche', 'levier_droite', 'levier_milieu']) await interact(host, 'mine', l);
    expect(s.flags.cage_ouverte).toBe(true);
    await enter(host, 'mine', 29, 2);
    expect(s.player.zone).toBe('cendriers');
  });

  it('Théo, le chien creux et Agnès (dans le désordre)', async () => {
    const host = new HeadlessHost(newGame(4));
    const s = host.state;
    await enterZoneScripts(host, 'village');
    // On trouve le dessin AVANT d'avoir parlé à Agnès.
    s.inventory.cle_ecole = 1;
    await interact(host, 'ecole', 'dessin_theo');
    expect(s.quests.q_theo.stage).toBe(1);
    expect(isPresent(s, 'foret', 'chien_creux_rencontre')).toBe(true);
    host.battleResult = 'bond';
    await interact(host, 'foret', 'chien_creux_rencontre');
    expect(s.quests.q_theo.stage).toBe(2);
    await interact(host, 'maison_morel', 'agnes', ['parler de Théo']);
    expect(s.quests.q_theo.done).toBe(true);
    expect(s.flags.agnes_sait).toBe(true);
    // Parler de nouveau ne relance rien.
    await interact(host, 'maison_morel', 'agnes');
    expect(s.quests.q_theo.done).toBe(true);
  });

  it('la clairière n’est accessible qu’à minuit, Mère-Cendre s’apaise avec la photo', async () => {
    const host = new HeadlessHost(newGame(5));
    const s = host.state;
    await enterZoneScripts(host, 'village');
    s.time = DAY;
    expect(evalCondition(s, warpAt(ZONES.foret, 15, 0)?.when)).toBe(false);
    s.time = MIDNIGHT;
    await interact(host, 'foret', 'photo_brulee');
    await enter(host, 'foret', 15, 0);
    expect(s.player.zone).toBe('clairiere');
    await interact(host, 'clairiere', 'mere_cendre', ['photo', 'apaiser']);
    expect(s.codex.mere_cendre.pacified).toBe(true);
    expect(has(s, 'mouchoir_brode')).toBe(true);
    expect(s.quests.q_chapelle.done).toBe(true);
    expect(isPresent(s, 'clairiere', 'mere_cendre')).toBe(false);
  });

  it('le ruban bleu et l’enfant du quai', async () => {
    const host = new HeadlessHost(newGame(6));
    const s = host.state;
    await enterZoneScripts(host, 'village');
    await interact(host, 'gare_hall', 'tobias');
    await interact(host, 'marais', 'enfant_quai');
    expect(s.quests.q_quai.stage).toBe(1);
    await interact(host, 'gare_hall', 'tobias');
    expect(has(s, 'ruban_bleu')).toBe(true);
    await interact(host, 'marais', 'enfant_quai', ['ruban', 'emmener']);
    expect(s.team.some((c) => c.species === 'enfant_quai')).toBe(true);
    expect(has(s, 'ruban_bleu')).toBe(false);
    expect(s.quests.q_quai.done).toBe(true);
  });

  it('les miroirs de Madame Lys puis la Veuve de Verre', async () => {
    const host = new HeadlessHost(newGame(12));
    const s = host.state;
    await enterZoneScripts(host, 'village');
    expect(isPresent(s, 'maison_lys', 'veuve_verre')).toBe(false);
    for (const n of [1, 2, 3]) await interact(host, 'maison_lys', `miroir_lys_${n}`, ['couvrir']);
    // Recouvrir deux fois ne compte pas double
    await interact(host, 'maison_lys', 'miroir_lys_1');
    expect(s.counters.lys).toBe(3);
    expect(isPresent(s, 'maison_lys', 'veuve_verre')).toBe(true);
    await interact(host, 'maison_lys', 'veuve_verre');
    expect(s.quests.q_lys.done).toBe(true);
  });

  it('radio : trois fréquences puis retour au chef de gare', async () => {
    const host = new HeadlessHost(newGame(13));
    const s = host.state;
    await enterZoneScripts(host, 'village');
    expect(isPresent(s, 'foret', 'radio_foret')).toBe(false);
    await interact(host, 'gare_hall', 'tobias');
    for (const [z, id] of [['foret', 'radio_foret'], ['marais', 'radio_marais'], ['hopital_ext', 'radio_hopital']]) await touch(host, z, id);
    expect(s.quests.q_radio.stage).toBe(1);
    await interact(host, 'gare_hall', 'tobias');
    expect(s.quests.q_radio.done).toBe(true);
    // Les déclencheurs ne se rejouent pas
    expect(isPresent(s, 'foret', 'radio_foret')).toBe(false);
  });

  it('ramasser un objet avec le sac plein ne le fait pas disparaître', async () => {
    const host = new HeadlessHost(newGame(14));
    const s: GameState = host.state;
    s.inventory.tisane = 99;
    await interact(host, 'ecole', 'ecole_tisane');
    expect(isPresent(s, 'ecole', 'ecole_tisane')).toBe(true);
    expect(s.inventory.tisane).toBe(99);
    s.inventory.tisane = 10;
    await interact(host, 'ecole', 'ecole_tisane');
    expect(s.inventory.tisane).toBe(12);
    expect(isPresent(s, 'ecole', 'ecole_tisane')).toBe(false);
  });
});

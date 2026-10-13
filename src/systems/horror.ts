import type { Condition, HorrorFx, ZoneTheme } from '../data/types';
import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';
import { evalCondition } from './conditions';

// Directeur d'horreur : événements d'ambiance contrôlés, avec délais de
// récupération, plafonds et conditions. Il ne modifie JAMAIS l'état de jeu
// persistant, à l'exception de compteurs d'affichage sans conséquence.

export interface HorrorEvent {
  id: string;
  themes?: ZoneTheme[];
  zones?: string[];
  when?: Condition;
  chance: number; // probabilité par vérification
  cooldown: number; // secondes avant de pouvoir se reproduire
  max?: number; // occurrences maximales par session
  fx: HorrorFx;
  text?: string;
}

export const HORROR_EVENTS: HorrorEvent[] = [
  { id: 'silhouette_bord', themes: ['village', 'foret', 'ecole', 'cendriers', 'marais'], when: { time: ['crepuscule', 'nuit', 'minuit'] }, chance: 0.25, cooldown: 90, fx: 'silhouette' },
  { id: 'coups_mur', themes: ['interieur', 'ecole', 'hopital', 'institut'], chance: 0.2, cooldown: 120, fx: 'coups', text: 'Trois coups, de l’autre côté du mur. Puis un quatrième, plus près.' },
  { id: 'lumieres', themes: ['ecole', 'hopital', 'institut', 'interieur', 'train'], chance: 0.2, cooldown: 100, fx: 'lumieres' },
  { id: 'radio_village', themes: ['village', 'gare', 'marais'], when: { item: 'radio' }, chance: 0.15, cooldown: 160, max: 4, fx: 'radio', text: 'La radio s’allume seule : « …si vous entendez ce message, ne dormez pas… » Grésillement.' },
  { id: 'pas_derriere', themes: ['foret', 'mine', 'hopital', 'cendriers'], chance: 0.2, cooldown: 110, fx: 'pas' },
  { id: 'souffle', themes: ['mine', 'seuil', 'institut', 'cendriers'], chance: 0.15, cooldown: 140, fx: 'souffle' },
  { id: 'cloches_loin', themes: ['foret', 'hopital', 'gare'], when: { time: ['nuit', 'minuit'] }, chance: 0.15, cooldown: 180, max: 3, fx: 'cloches', text: 'Des clochettes, très loin. Personne n’a sonné.' },
  { id: 'chuchote_nom', themes: ['ecole', 'seuil', 'cendriers'], chance: 0.12, cooldown: 200, max: 3, fx: 'chuchotement', text: 'Quelqu’un chuchote un prénom. Ce n’est pas le vôtre. Ou peut-être que si.' },
  { id: 'oubli_passant', themes: ['village'], when: { all: [{ flag: 'premiere_nuit' }, { time: 'jour' }] }, chance: 0.1, cooldown: 300, max: 2, fx: 'chuchotement', text: 'Un passant vous dévisage, perplexe, comme s’il essayait de se rappeler s’il vous a déjà vu(e). Il hausse les épaules.' },
];

export interface HorrorDirector {
  cooldowns: Record<string, number>; // timestamp (s) de dernière occurrence
  counts: Record<string, number>;
  globalNext: number; // pas d'événement avant ce moment
}

export function newDirector(): HorrorDirector {
  return { cooldowns: {}, counts: {}, globalNext: 30 };
}

export const GLOBAL_GAP = 45; // secondes minimales entre deux événements

/**
 * Choisit éventuellement un événement. `now` en secondes de jeu. Appelé
 * seulement quand le jeu est stable (exploration libre, pas de transition).
 */
export function pickHorror(
  dir: HorrorDirector,
  state: GameState,
  zoneId: string,
  theme: ZoneTheme,
  eternalNight: boolean,
  now: number,
  rng: Rng,
  attenuated: boolean,
): HorrorEvent | null {
  if (now < dir.globalNext) return null;
  const candidates = HORROR_EVENTS.filter((e) => {
    if (e.themes && !e.themes.includes(theme)) return false;
    if (e.zones && !e.zones.includes(zoneId)) return false;
    if (e.max !== undefined && (dir.counts[e.id] ?? 0) >= e.max) return false;
    const last = dir.cooldowns[e.id];
    if (last !== undefined && now - last < e.cooldown) return false;
    return evalCondition(state, e.when, { eternalNight });
  });
  for (const e of candidates) {
    const p = attenuated ? e.chance / 2 : e.chance;
    if (rng.chance(p)) {
      dir.cooldowns[e.id] = now;
      dir.counts[e.id] = (dir.counts[e.id] ?? 0) + 1;
      dir.globalNext = now + GLOBAL_GAP * (attenuated ? 2 : 1);
      return e;
    }
  }
  return null;
}

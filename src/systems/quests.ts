import { CLUES, KEY_CLUES, LEADS, QUESTS } from '../data/story';
import type { GameState } from '../core/state';
import { addItem } from './inventory';
import { gainXp } from './creatures';

export type QuestEvent = { kind: 'start' | 'update' | 'done'; quest: string; text: string } | null;

/**
 * Avance une quête à une étape. Les étapes ne reculent jamais : une quête
 * peut donc être mise à jour dans n'importe quel ordre sans régresser.
 */
export function setStage(state: GameState, id: string, stage: number): QuestEvent {
  const def = QUESTS[id];
  if (!def) return null;
  const s = Math.max(0, Math.min(stage, def.stages.length - 1));
  const cur = state.quests[id];
  if (cur?.done) return null;
  if (!cur) {
    state.quests[id] = { stage: s, done: false };
    return { kind: 'start', quest: id, text: `Nouvelle quête : ${def.name}` };
  }
  if (s <= cur.stage) return null;
  cur.stage = s;
  return { kind: 'update', quest: id, text: `Journal : ${def.name}` };
}

export function completeQuest(state: GameState, id: string): QuestEvent {
  const def = QUESTS[id];
  if (!def) return null;
  const cur = state.quests[id] ?? { stage: def.stages.length - 1, done: false };
  if (cur.done) return null;
  cur.done = true;
  cur.stage = def.stages.length - 1;
  state.quests[id] = cur;
  const r = def.reward;
  if (r) {
    for (const [item, qty] of r.items ?? []) addItem(state, item, qty);
    if (r.xp) for (const c of state.team) gainXp(c, r.xp);
    if (r.light) state.morality.light += r.light;
  }
  return { kind: 'done', quest: id, text: `Quête terminée : ${def.name}` };
}

export function addClue(state: GameState, id: string): string | null {
  if (!CLUES[id] || state.clues.includes(id)) return null;
  state.clues.push(id);
  return `Nouvel indice : ${CLUES[id].name}`;
}

export function keyClueCount(state: GameState): number {
  return state.clues.filter((c) => KEY_CLUES.includes(c)).length;
}

export interface JournalView {
  active: Array<{ id: string; name: string; objective: string; main: boolean }>;
  done: Array<{ id: string; name: string }>;
  clues: Array<{ id: string; name: string; text: string; key: boolean; eaten: boolean }>;
  leads: Array<{ id: string; text: string }>;
}

export function journalView(state: GameState, evalCond: (c: import('../data/types').Condition) => boolean): JournalView {
  const active: JournalView['active'] = [];
  const done: JournalView['done'] = [];
  for (const [id, q] of Object.entries(state.quests)) {
    const def = QUESTS[id];
    if (!def) continue;
    if (q.done) done.push({ id, name: def.name });
    else active.push({ id, name: def.name, objective: def.stages[q.stage] ?? '', main: !!def.main });
  }
  active.sort((a, b) => Number(b.main) - Number(a.main));
  // L'Archivore « mange » visuellement certains indices tant qu'il n'est pas vaincu.
  // Rien n'est retiré de la sauvegarde : c'est un simple masque d'affichage.
  const eatenMask = !!state.flags['archivore_mange'];
  const clues = state.clues
    .filter((c) => CLUES[c])
    .map((c, i) => ({ id: c, name: CLUES[c].name, text: CLUES[c].text, key: !!CLUES[c].key, eaten: eatenMask && i % 2 === 1 }));
  const leads = LEADS.filter((l) => evalCond(l.appearsWhen) && !evalCond(l.resolvedWhen)).map((l) => ({ id: l.id, text: l.text }));
  return { active, done, clues, leads };
}

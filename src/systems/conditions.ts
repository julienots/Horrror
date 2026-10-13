import { CREATURES } from '../data/creatures';
import type { Condition } from '../data/types';
import { phaseOf } from '../core/clock';
import type { GameState } from '../core/state';
import { fieldSkills, ownsSpecies } from './creatures';
import { count } from './inventory';
import { keyClueCount } from './quests';

export interface CondContext {
  eternalNight?: boolean;
  gaveOk?: boolean;
}

export function evalCondition(state: GameState, cond: Condition | undefined, ctx: CondContext = {}): boolean {
  if (!cond) return true;
  if ('all' in cond) return cond.all.every((c) => evalCondition(state, c, ctx));
  if ('any' in cond) return cond.any.some((c) => evalCondition(state, c, ctx));
  if ('not' in cond) return !evalCondition(state, cond.not, ctx);
  if ('flag' in cond) return !!state.flags[cond.flag];
  if ('notFlag' in cond) return !state.flags[cond.notFlag];
  if ('item' in cond) return count(state, cond.item) >= (cond.qty ?? 1);
  if ('notItem' in cond) return count(state, cond.notItem) <= 0;
  if ('clue' in cond) return state.clues.includes(cond.clue);
  if ('clueCount' in cond) return keyClueCount(state) >= cond.clueCount;
  if ('time' in cond) {
    const p = phaseOf(state.time, ctx.eternalNight);
    const list = Array.isArray(cond.time) ? cond.time : [cond.time];
    // Dans la nuit éternelle, « minuit » est aussi considéré comme vrai.
    if (ctx.eternalNight && list.includes('minuit')) return true;
    return list.includes(p);
  }
  if ('quest' in cond) {
    const q = state.quests[cond.quest];
    if (cond.done !== undefined) return cond.done ? !!q?.done : !q?.done;
    if (!q) return false;
    if (q.done) return cond.below === undefined; // une quête finie a dépassé toute étape
    if (cond.atLeast !== undefined && q.stage < cond.atLeast) return false;
    if (cond.below !== undefined && q.stage >= cond.below) return false;
    return true;
  }
  if ('owned' in cond) return ownsSpecies(state, cond.owned) || ownsTransformOf(state, cond.owned);
  if ('bonded' in cond) return !!state.codex[cond.bonded]?.bonded;
  if ('pacified' in cond) return !!state.codex[cond.pacified]?.pacified;
  if ('teamAffinity' in cond) return state.team.some((c) => CREATURES[c.species]?.affinities.includes(cond.teamAffinity as never));
  if ('fieldSkill' in cond) return fieldSkills(state).has(cond.fieldSkill);
  if ('counter' in cond) {
    const v = state.counters[cond.counter] ?? 0;
    if (cond.eq !== undefined && v !== cond.eq) return false;
    if (cond.atLeast !== undefined && v < cond.atLeast) return false;
    if (cond.below !== undefined && v >= cond.below) return false;
    return true;
  }
  if ('gaveOk' in cond) return !!ctx.gaveOk;
  return false;
}

/** Vrai si l'on possède une forme transformée de l'espèce (ex. Chien des Voix pour Chien Creux). */
function ownsTransformOf(state: GameState, species: string): boolean {
  let cur = CREATURES[species]?.transform?.into;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    seen.add(cur);
    if (ownsSpecies(state, cur)) return true;
    cur = CREATURES[cur]?.transform?.into;
  }
  return false;
}

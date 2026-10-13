import type { EncounterEntry, ZoneDef } from '../data/types';
import type { Rng } from '../core/rng';
import type { GameState } from '../core/state';
import { evalCondition } from './conditions';
import type { ZoneMap } from '../world/map';
import { warpAt } from '../world/map';

export interface EncounterRoll {
  species: string;
  level: number;
}

export function encounterTable(zone: ZoneDef, state: GameState): EncounterEntry[] {
  return (zone.encounters ?? []).filter((e) => evalCondition(state, e.when, { eternalNight: zone.eternalNight }));
}

/**
 * Tire une rencontre après un pas sur (x, y). `grace` = pas restants sans
 * rencontre (après un changement de zone ou un combat).
 */
export function rollEncounter(zone: ZoneDef, map: ZoneMap, state: GameState, x: number, y: number, rng: Rng, grace: number): EncounterRoll | null {
  if (grace > 0) return null;
  if (!state.team.some((c) => c.hp > 0)) return null;
  const tile = map.tile(x, y);
  if (tile.solid) return null;
  const onEncounterTile = tile.encounter || (zone.encounterAll && !warpAt(zone, x, y) && tile.ch !== 'D' && tile.ch !== 'S');
  if (!onEncounterTile) return null;
  const table = encounterTable(zone, state);
  if (!table.length) return null;
  const rate = zone.encounterRate ?? 0.08;
  if (!rng.chance(rate)) return null;
  const entry = rng.weighted(table, (e) => e.weight);
  if (!entry) return null;
  const level = rng.int(entry.levels[0], entry.levels[1]);
  // L'encens éloigne les Rémanents plus faibles que le premier membre de l'équipe.
  if (state.repelSteps > 0) {
    const lead = state.team.find((c) => c.hp > 0);
    if (lead && level < lead.level) return null;
  }
  return { species: entry.creature, level };
}

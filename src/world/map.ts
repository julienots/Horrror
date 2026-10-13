import { tileAt, type TileDef } from '../data/tiles';
import type { Dir, EntityDef, WarpDef, ZoneDef } from '../data/types';
import { ZONES } from '../data/zones';
import type { GameState } from '../core/state';
import { evalCondition } from '../systems/conditions';

export const DIRS: Record<Dir, [number, number]> = {
  up: [0, -1],
  down: [0, 1],
  left: [-1, 0],
  right: [1, 0],
};

/** Grille effective d'une zone (variantes appliquées selon l'état). */
export class ZoneMap {
  readonly w: number;
  readonly h: number;
  readonly grid: string[][];
  readonly variantKey: string;

  constructor(
    readonly zone: ZoneDef,
    state: GameState,
  ) {
    this.grid = zone.map.map((r) => r.split(''));
    this.h = this.grid.length;
    this.w = Math.max(...zone.map.map((r) => r.length));
    const active: number[] = [];
    zone.variants?.forEach((v, i) => {
      if (evalCondition(state, v.when, { eternalNight: zone.eternalNight })) {
        active.push(i);
        for (const p of v.patches) {
          p.rows.forEach((row, dy) => {
            row.split('').forEach((ch, dx) => {
              const y = p.y + dy;
              const x = p.x + dx;
              if (this.grid[y] && x < this.grid[y].length) this.grid[y][x] = ch;
            });
          });
        }
      }
    });
    this.variantKey = active.join(',');
  }

  ch(x: number, y: number): string {
    return this.grid[y]?.[x] ?? '#';
  }

  tile(x: number, y: number): TileDef {
    if (x < 0 || y < 0 || y >= this.h || x >= this.w) return tileAt('#');
    return tileAt(this.ch(x, y));
  }

  inBounds(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }
}

export function variantKey(zone: ZoneDef, state: GameState): string {
  const active: number[] = [];
  zone.variants?.forEach((v, i) => {
    if (evalCondition(state, v.when, { eternalNight: zone.eternalNight })) active.push(i);
  });
  return active.join(',');
}

export function removedFlag(zoneId: string, entityId: string): string {
  return `retire_${zoneId}_${entityId}`;
}

export function activeEntities(zone: ZoneDef, state: GameState): EntityDef[] {
  return zone.entities.filter((e) => !state.flags[removedFlag(zone.id, e.id)] && evalCondition(state, e.when, { eternalNight: zone.eternalNight }));
}

export function warpAt(zone: ZoneDef, x: number, y: number): WarpDef | undefined {
  return zone.warps.find((w) => w.x === x && w.y === y);
}

export function entityAt(entities: EntityDef[], x: number, y: number): EntityDef | undefined {
  return entities.find((e) => e.x === x && e.y === y);
}

export function isBlocked(map: ZoneMap, entities: EntityDef[], x: number, y: number): boolean {
  if (!map.inBounds(x, y)) return true;
  if (map.tile(x, y).solid) return true;
  return entities.some((e) => e.solid && e.x === x && e.y === y);
}

/** Case praticable la plus proche (pour ne jamais laisser le joueur coincé). */
export function nearestWalkable(map: ZoneMap, entities: EntityDef[], x: number, y: number): [number, number] | null {
  if (!isBlocked(map, entities, x, y)) return [x, y];
  const seen = new Set<string>([`${x},${y}`]);
  const q: Array<[number, number]> = [[x, y]];
  while (q.length) {
    const [cx, cy] = q.shift() as [number, number];
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx;
      const ny = cy + dy;
      const k = `${nx},${ny}`;
      if (seen.has(k) || !map.inBounds(nx, ny)) continue;
      seen.add(k);
      if (!isBlocked(map, entities, nx, ny) && !warpAt(map.zone, nx, ny)) return [nx, ny];
      q.push([nx, ny]);
    }
  }
  return null;
}

/** Premier pas d'un plus court chemin de (sx,sy) vers (tx,ty). */
export function stepToward(map: ZoneMap, entities: EntityDef[], sx: number, sy: number, tx: number, ty: number): [number, number] | null {
  if (sx === tx && sy === ty) return null;
  const key = (x: number, y: number) => y * map.w + x;
  const prev = new Map<number, number>();
  const q: Array<[number, number]> = [[sx, sy]];
  prev.set(key(sx, sy), -1);
  while (q.length) {
    const [cx, cy] = q.shift() as [number, number];
    if (cx === tx && cy === ty) break;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!map.inBounds(nx, ny) || prev.has(key(nx, ny))) continue;
      if (!(nx === tx && ny === ty) && isBlocked(map, entities, nx, ny)) continue;
      prev.set(key(nx, ny), key(cx, cy));
      q.push([nx, ny]);
    }
  }
  if (!prev.has(key(tx, ty))) return null;
  let cur = key(tx, ty);
  let p = prev.get(cur) as number;
  while (p !== key(sx, sy) && p !== -1) {
    cur = p;
    p = prev.get(cur) as number;
  }
  return [cur % map.w, Math.floor(cur / map.w)];
}

export function getZone(id: string): ZoneDef {
  const z = ZONES[id];
  if (!z) throw new Error(`Zone inconnue : ${id}`);
  return z;
}

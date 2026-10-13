import type { ZoneTheme } from '../data/types';
import { PALETTES, type ThemePalette } from './palette';
import { PixelCanvas, darken, hash, lighten, mix } from './pixel';

export const TS = 16; // taille d'une tuile en pixels

export interface TileContext {
  above: string;
  below: string;
  left: string;
  right: string;
  indoor: boolean;
}

const cache = new Map<string, HTMLCanvasElement>();

/** Nombre d'images d'animation d'une tuile. */
export function tileFrames(ch: string): number {
  if (ch === 'W' || ch === 'w') return 4;
  if (ch === '"' || ch === ':') return 2;
  if (ch === 'z' || ch === 'v') return 2;
  return 1;
}

const walkable = (ch: string) => !'#RTWfxrkblmpgoCPLvzc'.includes(ch);

export function tileCanvas(ch: string, theme: ZoneTheme, ctx: TileContext, seed: number, frame: number): HTMLCanvasElement {
  const variant = Math.floor(seed * 4);
  const form = formKey(ch, ctx);
  const key = `${theme}|${ch}|${form}|${variant}|${frame % tileFrames(ch)}`;
  let c = cache.get(key);
  if (!c) {
    const p = new PixelCanvas(TS, TS);
    drawTile(p, ch, PALETTES[theme], theme, ctx, variant, frame % tileFrames(ch));
    c = p.toCanvas();
    cache.set(key, c);
  }
  return c;
}

function formKey(ch: string, ctx: TileContext): string {
  switch (ch) {
    case '#':
      return `${ctx.indoor ? 'i' : 'e'}${walkable(ctx.below) ? 'f' : 't'}${ctx.above === 'R' ? 'r' : ''}`;
    case 'R':
      return ctx.below === 'R' ? 'm' : 'b';
    case 'T':
      return `${ctx.above === 'T' ? 't' : 'o'}${ctx.below === 'T' ? 't' : 'o'}`;
    case '-':
      return ctx.below === 'r' ? 'e' : 'n';
    case 'D':
      return ctx.indoor ? 'i' : 'e';
    case 'W':
      return walkable(ctx.above) && ctx.above !== 'W' ? 'shore' : 'deep';
    default:
      return ctx.indoor ? 'i' : 'e';
  }
}

function noise(p: PixelCanvas, colors: string[], seed: number, density = 0.25): void {
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      const n = hash(x, y, seed);
      if (n < density) p.set(x, y, colors[Math.floor(hash(y, x, seed + 3) * colors.length)]);
    }
}

function floorUnder(p: PixelCanvas, pal: ThemePalette, theme: ZoneTheme, ctx: TileContext, v: number): void {
  if (!ctx.indoor) {
    p.fill(pal.grass[0]);
    noise(p, [pal.grass[1], pal.grass[2]], 11 + v, 0.3);
    return;
  }
  if (theme === 'hopital' || theme === 'institut' || theme === 'train' || theme === 'seuil') tiled(p, pal, v);
  else if (theme === 'mine') {
    p.fill(pal.dirt[1]);
    noise(p, [pal.dirt[0], pal.dirt[2]], 5 + v, 0.3);
  } else planks(p, pal, v);
}

function planks(p: PixelCanvas, pal: ThemePalette, v: number): void {
  p.fill(pal.floor[0]);
  for (let y = 0; y < TS; y += 4) {
    p.rect(0, y + 3, TS, 1, pal.floor[2]);
    const off = ((y / 4 + v) % 2) * 8;
    p.set((off + 3) % TS, y + 1, pal.floor[1]);
    p.rect((off + 7) % TS, y, 1, 3, pal.floor[2]);
  }
  noise(p, [pal.floor[1]], 21 + v, 0.12);
}

function tiled(p: PixelCanvas, pal: ThemePalette, v: number): void {
  p.fill(pal.tileFloor[0]);
  for (let y = 0; y < TS; y++)
    for (let x = 0; x < TS; x++) {
      if (((x >> 3) + (y >> 3)) % 2 === 0) p.set(x, y, pal.tileFloor[1]);
      if (x % 8 === 0 || y % 8 === 0) p.set(x, y, darken(pal.tileFloor[1], 0.15));
    }
  // fissures et taches
  if (v === 1) p.line(3, 2, 9, 7, darken(pal.tileFloor[0], 0.3));
  if (v === 2) p.ellipse(11, 11, 2, 1, darken(pal.tileFloor[0], 0.2), 120);
  noise(p, [pal.tileFloor[2]], 31 + v, 0.06);
}

function drawTile(p: PixelCanvas, ch: string, pal: ThemePalette, theme: ZoneTheme, ctx: TileContext, v: number, f: number): void {
  switch (ch) {
    case ',': {
      p.fill(pal.grass[0]);
      noise(p, [pal.grass[1], pal.grass[2]], 1 + v, 0.35);
      for (let i = 0; i < 4; i++) {
        const x = Math.floor(hash(i, v, 7) * 15);
        const y = Math.floor(hash(v, i, 9) * 13) + 2;
        p.set(x, y, pal.tall[0]);
        p.set(x, y - 1, pal.tall[0]);
      }
      if (v === 3) {
        p.set(5, 9, '#6a6a5a');
        p.set(11, 4, '#5a4a5a');
      }
      return;
    }
    case '"': {
      p.fill(pal.grass[2]);
      noise(p, [pal.grass[0]], 3 + v, 0.3);
      for (let i = 0; i < 7; i++) {
        const x = 1 + Math.floor(hash(i, v, 17) * 14);
        const h = 6 + Math.floor(hash(v, i, 19) * 6);
        const sway = f === 1 ? (i % 2 ? 1 : -1) : 0;
        p.line(x, 15, x + sway, 15 - h, pal.tall[0]);
        p.set(x + sway, 15 - h, pal.tall[1]);
        p.line(x + 1, 15, x + 1 + sway, 16 - h, darken(pal.tall[0], 0.25));
      }
      return;
    }
    case '.': {
      p.fill(pal.dirt[0]);
      noise(p, [pal.dirt[1], pal.dirt[2]], 5 + v, 0.35);
      if (v % 2) {
        p.set(4, 6, lighten(pal.dirt[2], 0.15));
        p.set(12, 11, darken(pal.dirt[1], 0.2));
      }
      return;
    }
    case 'n': {
      p.fill(pal.dirt[1]);
      noise(p, [pal.dirt[0], darken(pal.dirt[1], 0.3)], 7 + v, 0.4);
      if (v === 2) {
        p.rect(0, 7, TS, 1, '#3a3530');
        p.rect(0, 11, TS, 1, '#3a3530');
        for (let x = 1; x < TS; x += 5) p.rect(x, 7, 2, 5, '#2a2018');
      }
      return;
    }
    case 'a':
    case ':': {
      p.fill(pal.ash[0]);
      noise(p, [pal.ash[1], '#625b55', '#3a3532'], 13 + v, 0.45);
      if (ch === ':') {
        for (let i = 0; i < 5; i++) {
          const x = 1 + Math.floor(hash(i, v, 23) * 13);
          const sway = f ? 1 : 0;
          p.ellipse(x + sway, 12, 2, 3, '#4a4440');
          p.set(x + sway, 9, '#6a625c');
        }
        if (v === 1) p.set(8, 4, '#b0704a');
      }
      return;
    }
    case 'T': {
      floorUnder(p, pal, theme, { ...ctx, indoor: false }, v);
      const top = ctx.above === 'T' ? -4 : 0;
      const bottom = ctx.below === 'T' ? 18 : 12;
      // Sous-bois sombre puis trois touffes de feuillage qui se chevauchent
      p.ellipse(8, (top + bottom) / 2, 8.6, (bottom - top) / 2 + 1, pal.tree[2]);
      const clumps: Array<[number, number, number]> = [
        [3 + (v % 2), top + 4 + (v % 3), 5],
        [11 - (v % 2), top + 3 + ((v + 1) % 3), 5],
        [7 + ((v + 2) % 3) - 1, top + 9, 6],
      ];
      for (const [cx, cy, r] of clumps) {
        if (cy - r > bottom + 2) continue;
        p.ellipse(cx, cy, r, r - 1, pal.tree[0]);
        p.ellipse(cx - 1, cy - 1, r - 2, r - 3, pal.tree[1]);
        for (let k = 0; k < 5; k++) p.set(cx - r + 2 + Math.floor(hash(k, cx, v + 3) * (r * 2 - 3)), cy - r + 2 + Math.floor(hash(cy, k, v + 7) * 3), lighten(pal.tree[1], 0.12));
        p.line(cx - r + 2, cy + r - 2, cx + r - 2, cy + r - 2, darken(pal.tree[2], 0.35));
      }
      if (ctx.below !== 'T') {
        p.rect(7, 12, 2, 4, pal.trunk);
        p.set(6, 15, pal.trunk);
        p.set(9, 15, pal.trunk);
        p.ellipse(8, 15, 5, 1, darken(pal.grass[2], 0.4), 140);
      }
      return;
    }
    case 'W': {
      p.fill(pal.water[0]);
      for (let i = 0; i < 6; i++) {
        const y = (Math.floor(hash(i, v, 51) * 16) + f) % 16;
        const x = Math.floor(hash(v, i, 53) * 12);
        p.rect(x, y, 3 + (i % 3), 1, pal.water[1]);
      }
      if (ctx.above !== 'W' && walkable(ctx.above)) {
        p.rect(0, 0, TS, 2, pal.water[2]);
        p.dither(0, 2, TS, 2, pal.water[2], 0.4, f);
      }
      return;
    }
    case 'w': {
      p.fill(pal.water[1]);
      noise(p, [pal.water[2], pal.water[0]], 61 + v + f, 0.2);
      for (let i = 0; i < 3; i++) {
        const x = 2 + Math.floor(hash(i, v, 63) * 12);
        p.line(x, 15, x + (f % 2), 9 + (i % 3), '#3a4a32');
      }
      p.rect(((f * 4) % 16), 6, 3, 1, lighten(pal.water[2], 0.2));
      return;
    }
    case '#': {
      if (ctx.indoor) {
        if (walkable(ctx.below) || ctx.below === 'C' || ctx.below === 'k' || ctx.below === 'b') {
          // Face de mur avec papier peint et plinthe
          p.fill(pal.wall[0]);
          for (let x = (v % 2) * 2; x < TS; x += 4) p.rect(x, 0, 1, 13, pal.wall[1]);
          p.rect(0, 0, TS, 2, darken(pal.wall[2], 0.3));
          p.rect(0, 13, TS, 3, pal.wall[2]);
          p.rect(0, 13, TS, 1, lighten(pal.wall[2], 0.15));
          if (v === 3) p.ellipse(10, 6, 2, 3, darken(pal.wall[0], 0.25), 160); // tache d'humidité
        } else {
          p.fill('#16130f');
          noise(p, ['#1d1914'], 71 + v, 0.2);
        }
        return;
      }
      // Extérieur : façade ou muret
      p.fill(pal.wall[0]);
      for (let y = 0; y < TS; y += 4) {
        p.rect(0, y + 3, TS, 1, pal.wall[2]);
        const off = (y / 4) % 2 ? 4 : 0;
        for (let x = off; x < TS; x += 8) p.rect(x, y, 1, 3, pal.wall[2]);
      }
      noise(p, [pal.wall[1]], 81 + v, 0.15);
      if (ctx.above === 'R' && v !== 0) {
        p.rect(4, 3, 8, 8, '#14161c');
        p.rect(4, 3, 8, 1, darken(pal.wall[2], 0.2));
        p.rect(7, 3, 1, 8, pal.wall[2]);
        p.rect(4, 7, 8, 1, pal.wall[2]);
        if (v === 2) {
          p.rect(5, 4, 2, 3, pal.window);
          p.rect(8, 4, 3, 3, mix(pal.window, '#14161c', 0.4));
          p.rect(5, 8, 2, 3, mix(pal.window, '#14161c', 0.3));
        }
      }
      p.rect(0, 15, TS, 1, darken(pal.wall[2], 0.4));
      return;
    }
    case 'R': {
      p.fill(pal.roof[0]);
      for (let y = 0; y < TS; y += 4) {
        const off = (y / 4) % 2 ? 2 : 0;
        for (let x = off; x < TS; x += 4) {
          p.rect(x, y, 3, 3, (x + y + v) % 8 < 4 ? pal.roof[1] : pal.roof[0]);
          p.set(x, y + 3, darken(pal.roof[1], 0.35));
        }
      }
      if (ctx.below !== 'R') {
        p.rect(0, 13, TS, 3, darken(pal.roof[1], 0.45));
        p.rect(0, 13, TS, 1, lighten(pal.roof[2], 0.1));
      }
      noise(p, [pal.roof[2]], 91 + v, 0.06);
      return;
    }
    case 'D': {
      if (ctx.indoor) {
        floorUnder(p, pal, theme, ctx, v);
        p.rect(2, 0, 12, 16, '#0c0a08');
        p.rect(2, 0, 1, 16, '#2a2018');
        p.rect(13, 0, 1, 16, '#2a2018');
        p.rect(4, 12, 8, 3, '#5a2f2f');
      } else {
        p.fill(pal.wall[0]);
        p.rect(3, 1, 10, 15, '#2a1d14');
        p.rect(4, 2, 8, 14, '#3e2a1c');
        p.rect(4, 8, 8, 1, '#2a1d14');
        p.set(10, 9, '#c9b458');
        p.rect(3, 0, 10, 1, darken(pal.wall[2], 0.3));
      }
      return;
    }
    case '=':
      planks(p, pal, v);
      return;
    case '+': {
      p.fill('#4a2226');
      for (let y = 0; y < TS; y++) for (let x = 0; x < TS; x++) if ((x + y) % 6 === 0 || (x - y + 16) % 6 === 0) p.set(x, y, '#5a2c30');
      p.rect(0, 0, TS, 1, '#2e1416');
      p.rect(0, 15, TS, 1, '#2e1416');
      return;
    }
    case '_':
      tiled(p, pal, v);
      return;
    case 'S': {
      floorUnder(p, pal, theme, ctx, v);
      for (let y = 1; y < TS; y += 3) {
        p.rect(1, y, 14, 2, darken(pal.wall[0], 0.1 + y * 0.03));
        p.rect(1, y + 2, 14, 1, '#0e0c0a');
      }
      return;
    }
    case 'f': {
      floorUnder(p, pal, theme, { ...ctx, indoor: false }, v);
      p.rect(0, 5, TS, 2, '#3a2e22');
      p.rect(0, 10, TS, 2, '#3a2e22');
      p.rect(2, 2, 2, 13, '#4a3a2a');
      p.rect(12, 2, 2, 13, '#4a3a2a');
      p.set(2, 2, '#5a4a38');
      p.set(12, 2, '#5a4a38');
      return;
    }
    case 'x':
      p.fill('#050506');
      p.dither(0, 0, TS, 4, '#121216', 0.4, v);
      return;
    case 'v': {
      p.fill(pal.void[0]);
      noise(p, [pal.void[1], '#f4f2ee'], 101 + v + f * 7, 0.2);
      if (v === 3) p.rect(0, 5 + f * 3, TS, 1, '#c8c6c1');
      return;
    }
    case 'u': {
      p.fill('#d8d6d1');
      for (let i = 0; i < TS; i += 8) {
        p.rect(i, 0, 1, TS, '#cac8c3');
        p.rect(0, i, TS, 1, '#cac8c3');
      }
      noise(p, ['#e8e6e1', '#bcbab5'], 111 + v, 0.12);
      return;
    }
    case 'r': {
      p.fill('#3a3632');
      noise(p, ['#2e2a27', '#46413c'], 121 + v, 0.5);
      for (let x = 1; x < TS; x += 5) p.rect(x, 3, 3, 10, '#3a2a1e');
      p.rect(0, 5, TS, 1, '#7a7a80');
      p.rect(0, 11, TS, 1, '#7a7a80');
      return;
    }
    case '-': {
      p.fill('#5a5853');
      noise(p, ['#504e4a', '#64625d'], 131 + v, 0.3);
      if (ctx.below === 'r') {
        p.rect(0, 13, TS, 2, '#a89a3a');
        p.rect(0, 15, TS, 1, '#2a2826');
      }
      if (v === 2) p.line(2, 3, 7, 5, '#45433f');
      return;
    }
    case 'k': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(1, 4, 14, 8, '#4a3220');
      p.rect(1, 4, 14, 2, '#5e4130');
      p.rect(2, 12, 2, 4, '#2e2016');
      p.rect(12, 12, 2, 4, '#2e2016');
      if (v % 2) p.rect(4, 5, 4, 2, '#d8d0bc');
      if (v === 2) p.rect(10, 4, 3, 2, '#7a3a3a');
      return;
    }
    case 'c': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(3, 4, 10, 6, '#4f3828');
      p.rect(3, 4, 10, 1, '#654a36');
      p.rect(4, 10, 1, 5, '#2e2016');
      p.rect(11, 10, 1, 5, '#2e2016');
      return;
    }
    case 'b': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(1, 1, 14, 15, '#3a2a20');
      p.rect(2, 2, 12, 13, theme === 'hopital' || theme === 'institut' ? '#b8bcb8' : '#5a6a8a');
      p.rect(3, 2, 10, 3, '#d8d8d0');
      p.rect(2, 9, 12, 1, darken('#5a6a8a', 0.3));
      return;
    }
    case 'l': {
      p.fill('#2e2016');
      p.rect(1, 1, 14, 14, '#3e2c1e');
      for (let y = 2; y < 14; y += 4) {
        p.rect(1, y + 3, 14, 1, '#24180f');
        for (let x = 2; x < 14; x += 2) {
          if (hash(x, y, v) < 0.8) p.rect(x, y, 1, 3, ['#6a3a3a', '#3a4a6a', '#5a5a3a', '#4a3a5a', '#8a7a5a'][Math.floor(hash(y, x, v + 5) * 5)]);
        }
      }
      return;
    }
    case 'm': {
      p.fill(ctx.indoor ? pal.wall[0] : pal.wall[1]);
      p.rect(3, 1, 10, 14, '#2a2018');
      p.rect(4, 2, 8, 12, '#3a4a52');
      p.rect(5, 3, 2, 6, '#5a6e78');
      p.line(9, 5, 11, 12, '#283238');
      return;
    }
    case 'p': {
      floorUnder(p, pal, theme, { ...ctx, indoor: false }, v);
      p.rect(7, 4, 2, 12, '#26262c');
      p.rect(5, 1, 6, 4, '#1e1e24');
      p.rect(6, 2, 4, 2, '#e8d48a');
      p.ellipse(8, 15, 3, 1, '#151515', 140);
      return;
    }
    case 'g': {
      floorUnder(p, pal, theme, { ...ctx, indoor: false }, v);
      p.rect(4, 4, 8, 11, '#55585c');
      p.ellipse(8, 5, 4, 3, '#55585c');
      p.rect(5, 6, 6, 1, '#3e4144');
      p.rect(7, 4, 2, 6, '#3e4144');
      p.rect(3, 15, 10, 1, '#2a2c2e');
      return;
    }
    case 'o': {
      floorUnder(p, pal, theme, ctx, v);
      p.ellipse(8, 9, 7, 6, '#4a4844');
      p.ellipse(6, 7, 3, 2, '#5a5853');
      p.line(9, 6, 12, 11, '#363430');
      return;
    }
    case 'C': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(0, 3, TS, 12, '#3e2a1c');
      p.rect(0, 3, TS, 3, '#5a4030');
      p.rect(0, 14, TS, 2, '#24180f');
      if (v === 1) p.rect(6, 1, 4, 3, '#c9c9c0');
      return;
    }
    case 'P': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(4, 0, 8, 16, '#5a5850');
      p.rect(4, 0, 2, 16, '#6a685f');
      p.rect(10, 0, 2, 16, '#46443e');
      return;
    }
    case 'L': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(2, 1, 12, 15, '#4a5258');
      p.rect(7, 1, 1, 15, '#353b40');
      p.rect(4, 3, 2, 1, '#2a2e32');
      p.rect(10, 3, 2, 1, '#2a2e32');
      if (v === 2) p.rect(8, 2, 5, 13, '#1a1c1e');
      return;
    }
    case 'z': {
      floorUnder(p, pal, theme, ctx, v);
      p.rect(1, 2, 14, 13, '#3a4046');
      p.rect(2, 3, 12, 5, '#1e2428');
      for (let i = 0; i < 4; i++) p.set(3 + i * 3, 10, (i + f + v) % 3 === 0 ? '#c94a4a' : '#5a8a5a');
      p.rect(3, 4, 4, 1, f ? '#7ab07a' : '#4a7a4a');
      p.rect(2, 12, 12, 1, '#2a3036');
      return;
    }
  }
  // Inconnu : damier visible pour repérer l'erreur
  p.fill('#ff00ff');
}

/** Lumières émises par certaines tuiles (rayon en tuiles). */
export function tileLight(ch: string): number {
  if (ch === 'p') return 3.2;
  if (ch === 'z') return 1.4;
  return 0;
}

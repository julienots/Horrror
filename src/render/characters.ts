import { CHARACTERS, type CharacterDef } from '../data/characters';
import type { Dir, Mood } from '../data/types';
import { PixelCanvas, darken, lighten } from './pixel';

export const CHAR_W = 16;
export const CHAR_H = 20;
const OUTLINE = '#0c0b10';

const spriteCache = new Map<string, HTMLCanvasElement>();
const portraitCache = new Map<string, HTMLCanvasElement>();

export function characterSprite(id: string, dir: Dir, frame: number): HTMLCanvasElement {
  const key = `${id}|${dir}|${frame}`;
  let c = spriteCache.get(key);
  if (!c) {
    const def = CHARACTERS[id] ?? CHARACTERS.habitant;
    c = drawCharacter(def, dir, frame).toCanvas();
    spriteCache.set(key, c);
  }
  return c;
}

function drawCharacter(def: CharacterDef, dir: Dir, frame: number): PixelCanvas {
  const p = new PixelCanvas(CHAR_W, CHAR_H);
  const L = def.look;
  const child = L.height === 'enfant';
  const oy = child ? 4 : 0;
  const walk = frame % 2 === 1;
  const coatD = darken(L.coat, 0.3);
  const skinD = darken(L.skin, 0.2);
  // Jambes
  const legY = 14 + (child ? 1 : 0);
  const legH = child ? 3 : 4;
  const legC = darken(L.coat, 0.55);
  if (dir === 'left' || dir === 'right') {
    p.rect(7, legY, 2, legH, legC);
    if (walk) p.rect(dir === 'left' ? 5 : 9, legY, 2, legH - 1, legC);
  } else {
    p.rect(5, legY + (walk ? 0 : 0), 2, legH - (walk ? 1 : 0), legC);
    p.rect(9, legY, 2, legH - (walk ? 0 : 1), legC);
  }
  // Corps
  const bodyTop = 8 + oy;
  const bodyH = legY - bodyTop;
  p.rect(4, bodyTop, 8, bodyH, L.coat);
  p.rect(4, bodyTop + bodyH - 1, 8, 1, coatD);
  if (dir === 'down') {
    p.rect(7, bodyTop, 2, bodyH - 1, darken(L.coat, 0.12));
    p.set(7, bodyTop + 1, L.accent);
  }
  // Bras
  const armSwing = walk ? 1 : 0;
  if (dir === 'down' || dir === 'up') {
    p.rect(3, bodyTop + 1, 1, bodyH - 2 + armSwing, coatD);
    p.rect(12, bodyTop + 1, 1, bodyH - 2 + (1 - armSwing), coatD);
    p.set(3, bodyTop + bodyH - 1 + armSwing, L.skin);
    p.set(12, bodyTop + bodyH - (1 - armSwing) - 0, L.skin);
  } else {
    const ax = dir === 'left' ? 8 + armSwing : 7 - armSwing;
    p.rect(ax, bodyTop + 1, 1, bodyH - 2, coatD);
  }
  // Tête
  const hy = 2 + oy;
  const headC = L.faceless ? lighten(L.skin, 0.1) : L.skin;
  p.rect(5, hy, 6, 6, headC);
  p.rect(5, hy + 5, 6, 1, skinD);
  // Cheveux
  hair(p, L, dir, hy);
  // Visage
  if (!L.faceless && dir !== 'up' && L.hairStyle !== 'voile') {
    const ey = hy + 3;
    if (dir === 'down') {
      p.set(6, ey, '#1a1414');
      p.set(9, ey, '#1a1414');
      if (L.glasses) {
        p.rect(5, ey, 3, 1, '#9aa0a8', 160);
        p.rect(8, ey, 3, 1, '#9aa0a8', 160);
        p.set(6, ey, '#1a1414');
        p.set(9, ey, '#1a1414');
      }
    } else {
      const ex = dir === 'left' ? 6 : 9;
      p.set(ex, ey, '#1a1414');
      if (L.glasses) p.set(dir === 'left' ? 5 : 10, ey, '#9aa0a8');
    }
  }
  p.outline(OUTLINE);
  // Ombre au sol (après le contour pour rester discrète)
  for (let x = 3; x <= 12; x++) if (!p.alphaAt(x, 19)) p.set(x, 19, '#000000', 90);
  return p;
}

function hair(p: PixelCanvas, L: CharacterDef['look'], dir: Dir, hy: number): void {
  const h = L.hair;
  const hd = darken(h, 0.25);
  switch (L.hairStyle) {
    case 'chauve':
      return;
    case 'court':
      p.rect(5, hy, 6, 2, h);
      if (dir === 'up') p.rect(5, hy, 6, 5, h);
      if (dir === 'left') p.rect(9, hy, 2, 4, h);
      if (dir === 'right') p.rect(5, hy, 2, 4, h);
      p.set(5, hy + 2, hd);
      return;
    case 'chignon':
      p.rect(5, hy, 6, 2, h);
      p.rect(6, hy - 2, 4, 2, h);
      p.set(7, hy - 2, hd);
      if (dir === 'up') p.rect(5, hy, 6, 4, h);
      if (dir === 'left') p.rect(9, hy, 2, 3, h);
      if (dir === 'right') p.rect(5, hy, 2, 3, h);
      return;
    case 'long':
      p.rect(4, hy, 8, 2, h);
      p.rect(4, hy + 2, 1, 6, h);
      p.rect(11, hy + 2, 1, 6, h);
      if (dir === 'up') p.rect(4, hy, 8, 8, h);
      if (dir === 'left') p.rect(9, hy, 3, 7, h);
      if (dir === 'right') p.rect(4, hy, 3, 7, h);
      p.rect(4, hy + 7, 1, 1, hd);
      return;
    case 'casquette':
      p.rect(5, hy - 1, 6, 2, L.coat);
      p.rect(5, hy + 1, 6, 1, darken(L.coat, 0.4));
      if (dir === 'down') p.rect(4, hy + 1, 8, 1, darken(L.coat, 0.5));
      if (dir === 'left') p.rect(3, hy + 1, 3, 1, darken(L.coat, 0.5));
      if (dir === 'right') p.rect(10, hy + 1, 3, 1, darken(L.coat, 0.5));
      p.set(7, hy - 1, L.accent);
      if (dir === 'up') p.rect(5, hy + 2, 6, 2, h);
      return;
    case 'capuche':
      p.rect(4, hy - 1, 8, 3, L.coat);
      p.rect(4, hy + 2, 1, 5, L.coat);
      p.rect(11, hy + 2, 1, 5, L.coat);
      if (dir === 'up') p.rect(4, hy - 1, 8, 8, L.coat);
      p.set(5, hy + 2, h);
      p.set(10, hy + 2, h);
      return;
    case 'voile':
      p.rect(4, hy - 1, 8, 9, h, 230);
      p.rect(5, hy + 2, 6, 3, darken(h, 0.2), 200);
      return;
  }
}

// ---------------------------------------------------------------- Portraits

export const PORTRAIT = 48;

export function portrait(id: string, mood: Mood): HTMLCanvasElement {
  const key = `${id}|${mood}`;
  let c = portraitCache.get(key);
  if (!c) {
    const def = CHARACTERS[id] ?? CHARACTERS.habitant;
    c = drawPortrait(def, mood).toCanvas();
    portraitCache.set(key, c);
  }
  return c;
}

function drawPortrait(def: CharacterDef, mood: Mood): PixelCanvas {
  const p = new PixelCanvas(PORTRAIT, PORTRAIT);
  const L = def.look;
  const S = PORTRAIT;
  // Fond
  for (let y = 0; y < S; y++) p.rect(0, y, S, 1, darken('#1b2028', y / S * 0.6));
  p.dither(0, 0, S, S, '#232934', 0.12, 3);
  const child = L.height === 'enfant';
  const cx = 24;
  const headY = child ? 22 : 19;
  const rx = child ? 10 : 11;
  const ry = child ? 11 : 13;
  // Épaules
  p.ellipse(cx, 50, 20, 13, L.coat);
  p.ellipse(cx, 50, 20, 13, darken(L.coat, 0.15), 0);
  p.rect(cx - 1, 38, 2, 10, darken(L.coat, 0.3));
  p.set(cx + 4, 42, L.accent);
  p.set(cx + 5, 42, L.accent);
  // Cou
  p.rect(cx - 4, headY + ry - 4, 8, 8, darken(L.skin, 0.2));
  // Tête
  const skin = L.faceless && L.skin !== '#0c0b10' ? '#e8e8e8' : L.skin;
  p.ellipse(cx, headY, rx, ry, skin);
  p.ellipse(cx + 3, headY + 3, rx - 3, ry - 2, darken(skin, 0.08));
  p.ellipse(cx - 2, headY - 2, rx - 4, ry - 4, lighten(skin, 0.05));
  // Cheveux
  portraitHair(p, L, cx, headY, rx, ry);
  if (L.faceless && L.skin === '#0c0b10') {
    // Silhouette : un visage d'ombre, deux points pâles.
    p.ellipse(cx, headY + 1, rx - 2, ry - 3, '#050407');
    p.set(cx - 4, headY, '#d8d0c0');
    p.set(cx + 3, headY, '#d8d0c0');
  } else if (L.faceless) {
    // Écran blanc / visage absent
    p.ellipse(cx, headY + 1, rx - 3, ry - 4, '#f4f4f4');
    for (let y = headY - 8; y < headY + 9; y += 2) p.rect(cx - 7, y, 14, 1, '#dcdcdc', 180);
    if (mood === 'colere') p.rect(cx - 6, headY, 12, 1, '#c94a4a');
  } else if (L.hairStyle !== 'voile') {
    face(p, L, mood, cx, headY);
  } else {
    p.ellipse(cx - 4, headY + 1, 2, 1, '#8fb3b0', 160);
    p.ellipse(cx + 4, headY + 1, 2, 1, '#8fb3b0', 160);
  }
  p.outline('#07070a');
  // Vignette
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      const d = Math.hypot(x - S / 2, y - S / 2) / (S * 0.7);
      if (d > 0.6) p.set(x, y, '#000000', Math.min(200, (d - 0.6) * 500));
    }
  return p;
}

function portraitHair(p: PixelCanvas, L: CharacterDef['look'], cx: number, cy: number, rx: number, ry: number): void {
  const h = L.hair;
  const hd = darken(h, 0.3);
  const hl = lighten(h, 0.12);
  switch (L.hairStyle) {
    case 'chauve':
      p.ellipse(cx - 3, cy - ry + 4, 4, 2, lighten(L.skin, 0.15));
      return;
    case 'court':
      p.ellipse(cx, cy - ry + 5, rx + 1, 6, h);
      p.rect(cx - rx - 1, cy - ry + 5, 3, 8, h);
      p.rect(cx + rx - 2, cy - ry + 5, 3, 8, h);
      p.line(cx - 4, cy - ry + 2, cx + 2, cy - ry + 8, hd);
      p.line(cx - 6, cy - ry + 3, cx - 2, cy - ry + 3, hl);
      return;
    case 'chignon':
      p.ellipse(cx, cy - ry - 2, 6, 5, h);
      p.ellipse(cx, cy - ry + 4, rx + 1, 5, h);
      p.rect(cx - rx - 1, cy - ry + 4, 2, 9, h);
      p.rect(cx + rx - 1, cy - ry + 4, 2, 9, h);
      p.line(cx - 3, cy - ry - 4, cx + 3, cy - ry, hd);
      p.set(cx - 2, cy - ry - 4, hl);
      return;
    case 'long':
      p.ellipse(cx, cy - ry + 5, rx + 2, 7, h);
      p.rect(cx - rx - 2, cy - ry + 5, 4, 26, h);
      p.rect(cx + rx - 2, cy - ry + 5, 4, 26, h);
      p.line(cx - rx, cy - ry + 10, cx - rx, cy + 12, hd);
      p.line(cx + rx, cy - ry + 10, cx + rx, cy + 12, hd);
      p.line(cx - 5, cy - ry + 2, cx + 6, cy - ry + 9, hd);
      return;
    case 'casquette':
      p.ellipse(cx, cy - ry + 4, rx + 1, 6, L.coat);
      p.rect(cx - rx - 4, cy - ry + 7, rx * 2 + 8, 2, darken(L.coat, 0.45));
      p.rect(cx - 2, cy - ry + 1, 4, 3, L.accent);
      p.rect(cx - rx, cy - ry + 9, 3, 6, h);
      p.rect(cx + rx - 3, cy - ry + 9, 3, 6, h);
      return;
    case 'capuche':
      p.ellipse(cx, cy - 2, rx + 4, ry + 3, L.coat);
      p.ellipse(cx, cy + 1, rx - 1, ry - 2, L.skin);
      p.ellipse(cx + 3, cy + 4, rx - 4, ry - 4, darken(L.skin, 0.08));
      p.line(cx - rx - 2, cy + 4, cx - rx + 2, cy + 14, darken(L.coat, 0.3));
      p.rect(cx - 6, cy - ry + 4, 12, 2, h);
      return;
    case 'voile':
      p.ellipse(cx, cy, rx + 3, ry + 3, h, 235);
      p.ellipse(cx, cy + 2, rx, ry, darken(h, 0.1), 220);
      p.line(cx - 8, cy - 6, cx + 6, cy + 8, '#8fb3b0', 1, 150);
      return;
  }
}

function face(p: PixelCanvas, L: CharacterDef['look'], mood: Mood, cx: number, cy: number): void {
  const ey = cy + 1;
  const lx = cx - 5;
  const rxp = cx + 4;
  const dark = '#1a1214';
  const white = '#e8e2d8';
  // Sourcils
  const brow = darken(L.hair, 0.2);
  const browY = ey - 4;
  if (mood === 'colere') {
    p.line(lx - 2, browY - 1, lx + 2, browY + 1, brow);
    p.line(rxp - 1, browY + 1, rxp + 3, browY - 1, brow);
  } else if (mood === 'triste' || mood === 'peur') {
    p.line(lx - 2, browY + 1, lx + 2, browY - 1, brow);
    p.line(rxp - 1, browY - 1, rxp + 3, browY + 1, brow);
  } else {
    p.rect(lx - 2, browY, 4, 1, brow);
    p.rect(rxp - 1, browY, 4, 1, brow);
  }
  // Yeux
  for (const x of [lx, rxp]) {
    if (mood === 'vide') {
      p.rect(x - 1, ey - 1, 3, 2, '#f4f4f0');
    } else if (mood === 'peur') {
      p.rect(x - 1, ey - 1, 3, 3, white);
      p.set(x, ey, dark);
    } else if (mood === 'sourire') {
      p.line(x - 1, ey, x, ey - 1, dark);
      p.line(x, ey - 1, x + 1, ey, dark);
    } else {
      p.rect(x - 1, ey - 1, 3, 2, white);
      p.rect(x, ey - 1, 1, 2, dark);
      if (mood === 'triste') p.set(x + 1, ey + 2, '#8fb3d0');
    }
  }
  if (L.glasses) {
    p.ring(lx, ey, 3, 2.5, '#a0a6ae');
    p.ring(rxp, ey, 3, 2.5, '#a0a6ae');
    p.rect(lx + 3, ey - 1, rxp - lx - 6, 1, '#a0a6ae');
  }
  // Nez
  p.line(cx, ey + 1, cx - 1, ey + 4, darken(L.skin, 0.25));
  // Bouche
  const my = cy + 8;
  const mouth = darken(L.skin, 0.45);
  switch (mood) {
    case 'sourire':
      // Un sourire un peu trop large.
      p.line(cx - 5, my - 1, cx - 2, my + 1, mouth);
      p.line(cx - 2, my + 1, cx + 3, my + 1, mouth);
      p.line(cx + 3, my + 1, cx + 6, my - 1, mouth);
      return;
    case 'peur':
      p.ellipse(cx, my + 1, 2, 2, '#2a1214');
      return;
    case 'triste':
      p.line(cx - 3, my + 1, cx, my, mouth);
      p.line(cx, my, cx + 3, my + 1, mouth);
      return;
    case 'colere':
      p.rect(cx - 3, my, 6, 1, mouth);
      p.rect(cx - 2, my + 1, 4, 1, '#2a1214');
      return;
    case 'vide':
      p.rect(cx - 2, my, 4, 1, darken(L.skin, 0.2));
      return;
    default:
      p.rect(cx - 2, my, 5, 1, mouth);
  }
}

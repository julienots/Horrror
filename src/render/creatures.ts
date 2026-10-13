import { CREATURES } from '../data/creatures';
import { PixelCanvas, darken, hash, lighten, mix } from './pixel';

// Sprites de combat des Rémanents (64×64), dessinés procéduralement.
// Deux images par créature pour une petite animation d'attente.

export const CS = 64;
const cache = new Map<string, HTMLCanvasElement>();
const iconCache = new Map<string, HTMLCanvasElement>();
const silhouetteCache = new Map<string, HTMLCanvasElement>();

export function creatureSprite(species: string, frame: number): HTMLCanvasElement {
  const key = `${species}|${frame % 2}`;
  let c = cache.get(key);
  if (!c) {
    c = buildSprite(species, frame % 2).toCanvas();
    cache.set(key, c);
  }
  return c;
}

/** Silhouette noire (collection : « vu mais inconnu », ou transformation). */
export function creatureSilhouette(species: string, color = '#0c0b10'): HTMLCanvasElement {
  const key = `${species}|${color}`;
  let c = silhouetteCache.get(key);
  if (!c) {
    const p = buildSprite(species, 0);
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) if (p.alphaAt(x, y) > 40) p.set(x, y, color);
    c = p.toCanvas();
    silhouetteCache.set(key, c);
  }
  return c;
}

const tintCache = new Map<string, HTMLCanvasElement>();

/** Version teintée d'une seule couleur (éclair d'impact), en conservant la forme. */
export function creatureTint(species: string, frame: number, color: string): HTMLCanvasElement {
  const key = `${species}|${frame % 2}|${color}`;
  let c = tintCache.get(key);
  if (!c) {
    const p = buildSprite(species, frame % 2);
    for (let y = 0; y < CS; y++) for (let x = 0; x < CS; x++) if (p.alphaAt(x, y) > 0) p.set(x, y, color);
    c = p.toCanvas();
    tintCache.set(key, c);
  }
  return c;
}

/** Petite version 16×16 pour la carte (réduction par échantillonnage majoritaire). */
export function creatureIcon(species: string, frame: number): HTMLCanvasElement {
  const key = `${species}|${frame % 2}`;
  let c = iconCache.get(key);
  if (!c) {
    const big = buildSprite(species, frame % 2);
    const out = new PixelCanvas(24, 24);
    const f = CS / 24;
    for (let y = 0; y < 24; y++)
      for (let x = 0; x < 24; x++) {
        let best: [number, number, number, number] | null = null;
        let count = 0;
        for (let j = 0; j < 3; j++)
          for (let i = 0; i < 3; i++) {
            const px = big.get(Math.floor(x * f + i), Math.floor(y * f + j));
            if (px && px[3] > 100) {
              count++;
              if (!best || px[0] + px[1] + px[2] < best[0] + best[1] + best[2] + 60) best = px;
            }
          }
        if (best && count >= 3) out.set(x, y, best);
      }
    out.outline('#07070a');
    c = out.toCanvas();
    iconCache.set(key, c);
  }
  return c;
}

function buildSprite(species: string, f: number): PixelCanvas {
  const def = CREATURES[species];
  const p = new PixelCanvas(CS, CS);
  const pal = def?.palette ?? ['#888888', '#666666', '#aaaaaa', '#222222', '#ffffff'];
  const draw = DRAWERS[species] ?? DRAWERS[species.replace(/_.*$/, '')] ?? drawGeneric;
  draw(p, pal, f);
  return p;
}

type Drawer = (p: PixelCanvas, pal: string[], f: number) => void;

const OUT = '#07070a';

function finish(p: PixelCanvas, light = 0.18, dark = 0.3): void {
  p.shade(light, dark);
  p.outline(OUT);
}

function drawGeneric(p: PixelCanvas, pal: string[], f: number): void {
  p.ellipse(32, 36 + f, 18, 20, pal[0]);
  p.ellipse(26, 30, 3, 3, pal[4]);
  p.ellipse(38, 30, 3, 3, pal[4]);
  finish(p);
}

// ---------------------------------------------------------------- Veilleuse

function moth(p: PixelCanvas, pal: string[], f: number, glass: boolean): void {
  const up = f ? -2 : 0;
  const wings: Array<[number, number, number, number]> = [
    [18, 26 + up, 15, 11],
    [46, 26 + up, 15, 11],
    [21, 42, 11, 8],
    [43, 42, 11, 8],
  ];
  for (const [x, y, rx, ry] of wings) {
    p.ellipse(x, y, rx, ry, glass ? pal[1] : pal[0]);
    if (glass) {
      // Vitrail : cellules colorées séparées par des plombs
      for (let i = 0; i < 6; i++) {
        const cx = x + (hash(i, x, 3) - 0.5) * rx * 1.4;
        const cy = y + (hash(x, i, 5) - 0.5) * ry * 1.2;
        p.ellipse(cx, cy, 3, 2, [pal[2], pal[0], '#c9b458', '#8fb3b0'][i % 4]);
      }
      p.line(x - rx + 2, y, x + rx - 2, y, '#2c2840');
      p.line(x, y - ry + 2, x, y + ry - 2, '#2c2840');
      p.line(x + 6, y - 2, x + 2, y + 9, '#2c2840');
    } else {
      p.ellipse(x, y, rx - 4, ry - 4, lighten(pal[0], 0.1));
      p.ellipse(x + (x < 32 ? -3 : 3), y - 1, 3, 3, pal[2]);
      p.ellipse(x + (x < 32 ? -3 : 3), y - 1, 1, 1, pal[3]);
    }
  }
  // Corps : ampoule de veilleuse
  p.ellipse(32, 30, 6, 7, pal[1]);
  p.ellipse(32, 42, 7, 9, pal[4]);
  p.ellipse(31, 40, 4, 5, '#ffffff');
  p.rect(29, 34, 7, 2, '#9a8a6a');
  // Antennes
  p.line(30, 24, 24, 12 + up, pal[3]);
  p.line(34, 24, 40, 12 + up, pal[3]);
  p.set(24, 12 + up, pal[2]);
  p.set(40, 12 + up, pal[2]);
  p.set(30, 29, pal[3]);
  p.set(34, 29, pal[3]);
  finish(p, 0.2, 0.25);
  // Halo de lumière
  for (let y = 0; y < CS; y++)
    for (let x = 0; x < CS; x++) {
      if (p.alphaAt(x, y)) continue;
      const d = Math.hypot(x - 32, y - 42);
      if (d < 16) p.set(x, y, pal[4], Math.max(0, 70 - d * 4 - f * 8));
    }
}

// ---------------------------------------------------------------- Mitaine / Main-Froide

function mitaine(p: PixelCanvas, pal: string[], f: number): void {
  const b = f ? 1 : 0;
  p.ellipse(34, 30 + b, 15, 17, pal[0]);
  p.rect(19, 30 + b, 30, 16, pal[0]);
  p.ellipse(16, 34 + b, 6, 9, pal[0]); // pouce
  p.rect(20, 46 + b, 28, 8, pal[2]); // poignet
  for (let y = 48; y < 54; y += 2) for (let x = 21; x < 47; x += 3) p.set(x, y + b, darken(pal[2], 0.2));
  // Maille
  for (let y = 16; y < 46; y += 4)
    for (let x = 20; x < 49; x += 4) {
      if (!p.alphaAt(x, y + b)) continue;
      p.set(x, y + b, darken(pal[0], 0.18));
      p.set(x + 1, y + 1 + b, darken(pal[0], 0.18));
      p.set(x + 2, y + b, darken(pal[0], 0.18));
    }
  // Chair qui affleure
  p.ellipse(40, 38 + b, 5, 3, pal[1]);
  p.line(36, 38 + b, 44, 38 + b, darken(pal[1], 0.4));
  p.set(28, 28 + b, pal[3]);
  p.set(36, 28 + b, pal[3]);
  finish(p);
}

function mainFroide(p: PixelCanvas, pal: string[], f: number): void {
  const b = f ? 1 : 0;
  // Manche vide flottante
  p.poly([[18, 60], [46, 60], [42, 38], [22, 38]], pal[3]);
  p.poly([[20, 58], [44, 58], [41, 40], [23, 40]], darken(pal[4], 0.2));
  p.ellipse(32, 40, 9, 3, '#000000');
  // Main grise aux doigts trop longs
  p.ellipse(32, 30 + b, 10, 9, pal[0]);
  const fingers: Array<[number, number]> = [[20, 4], [27, 1], [34, 0], [41, 3]];
  fingers.forEach(([x, top], i) => {
    p.line(x + 4, 26 + b, x + 1, top + 6 + b + (i === 2 && f ? 1 : 0), pal[0], 3);
    p.set(x + 1, top + 5 + b, pal[2]);
  });
  p.line(22, 32 + b, 12, 24 + b, pal[0], 3); // pouce
  p.line(28, 28 + b, 36, 30 + b, pal[1]);
  finish(p, 0.15, 0.35);
}

// ---------------------------------------------------------------- Pâlefeu / Grand Cierge

function candle(p: PixelCanvas, pal: string[], f: number, tall: boolean): void {
  const top = tall ? 24 : 34;
  const w = tall ? 9 : 11;
  p.rect(32 - w, top, w * 2, 58 - top, pal[0]);
  p.ellipse(32, 58, w + 3, 3, darken(pal[0], 0.15));
  // Coulures
  for (let i = 0; i < (tall ? 7 : 4); i++) {
    const x = 32 - w + Math.floor(hash(i, 1, 9) * w * 2);
    const len = 4 + Math.floor(hash(1, i, 7) * (tall ? 18 : 10));
    p.rect(x, top, 2, len, lighten(pal[0], 0.1));
    p.ellipse(x + 1, top + len, 1.5, 1.5, lighten(pal[0], 0.1));
  }
  if (tall) {
    // Prénoms gravés et raturés
    for (let y = top + 6; y < 52; y += 5) {
      const x0 = 32 - w + 3;
      p.line(x0, y, x0 + 4 + Math.floor(hash(y, 3, 1) * 8), y, darken(pal[0], 0.35));
      if (hash(y, 4, 2) > 0.5) p.line(x0, y - 1, x0 + 10, y + 1, pal[4]);
    }
  }
  // Mèche + flamme pâle
  p.rect(31, top - 3, 2, 3, pal[3]);
  const fl = f ? 1 : 0;
  const fh = tall ? 18 : 14;
  p.ellipse(32 + fl, top - 3 - fh / 2, tall ? 8 : 6, fh / 2 + 2, pal[2]);
  p.ellipse(32 + fl, top - 2 - fh / 2, tall ? 5 : 4, fh / 2 - 1, pal[4]);
  p.ellipse(32 + fl * 2, top - fh - 1, 2, 3, pal[2]);
  // Yeux creux dans la flamme
  p.ellipse(29 + fl, top - fh / 2 - 2, 1.5, 2, pal[3]);
  p.ellipse(35 + fl, top - fh / 2 - 2, 1.5, 2, pal[3]);
  finish(p, 0.12, 0.25);
}

// ---------------------------------------------------------------- Gribouille / Dessin Fini

function gribouille(p: PixelCanvas, pal: string[], f: number): void {
  const ink = pal[1];
  const j = (i: number) => (hash(i, f, 77) - 0.5) * 3;
  // Tête griffonnée
  for (let k = 0; k < 4; k++) p.ring(32 + j(k), 16 + j(k + 9), 8 + j(k + 3) * 0.5, 8 + j(k + 4) * 0.5, ink);
  // Corps
  for (let k = 0; k < 3; k++) {
    p.line(32 + j(k), 24, 31 + j(k + 1), 44, ink);
    p.line(31 + j(k + 2), 30, 16 + j(k), 38 + j(k + 5), ink); // bras
    p.line(33 + j(k + 3), 30, 48 + j(k), 22 + j(k + 6), ink);
    p.line(31, 44, 22 + j(k), 60, ink); // jambes
    p.line(32, 44, 42 + j(k), 60, ink);
  }
  // Gribouillis de remplissage
  for (let k = 0; k < 14; k++) p.line(26 + j(k) * 2, 26 + k, 38 + j(k + 1) * 2, 27 + k, ink);
  // Yeux (craie blanche) et cœur rouge
  p.rect(28, 14, 2, 2, pal[0]);
  p.rect(34, 14, 2, 2, pal[0]);
  p.line(28, 20, 36, 19, pal[2]);
  p.ellipse(31, 33, 2.5, 2, pal[2]);
  p.ellipse(34, 33, 2.5, 2, pal[2]);
  p.poly([[28.5, 33.5], [36.5, 33.5], [32.5, 38]], pal[2]);
  // Découpé dans une feuille de cahier : liseré de papier.
  p.outline(pal[0]);
}

function dessinFini(p: PixelCanvas, pal: string[], f: number): void {
  const b = f ? 1 : 0;
  p.ellipse(32, 16 + b, 10, 10, pal[0]);
  p.poly([[22, 28 + b], [42, 28 + b], [46, 50], [18, 50]], pal[3]);
  p.line(22, 30 + b, 10, 44, pal[0], 3);
  p.line(42, 30 + b, 54, 44, pal[0], 3);
  p.line(26, 50, 22, 62, pal[1], 3);
  p.line(38, 50, 42, 62, pal[1], 3);
  // Visage : sourire plein de dents
  p.rect(27, 13 + b, 3, 3, pal[1]);
  p.rect(34, 13 + b, 3, 3, pal[1]);
  p.rect(25, 20 + b, 14, 4, '#f0e8e0');
  for (let x = 26; x < 39; x += 2) p.set(x, 22 + b, pal[1]);
  // Prénom sur le torse
  p.rect(25, 36, 14, 5, '#e9e4d6');
  for (let x = 26; x < 38; x += 2) p.set(x, 38, pal[1]);
  // Traits de feutre qui débordent
  p.line(20, 26, 44, 30, pal[1]);
  p.line(18, 52, 46, 48, pal[1]);
  finish(p, 0.1, 0.25);
}

// ---------------------------------------------------------------- Ronceline / Ronce-Reine

function ronceline(p: PixelCanvas, pal: string[], f: number): void {
  const b = f ? 1 : 0;
  p.ellipse(32, 18 + b, 8, 8, pal[0]); // tête de paille
  for (let i = 0; i < 10; i++) p.line(26 + i, 11 + b, 25 + i + (i % 3), 6 + b, darken(pal[0], 0.2));
  p.poly([[25, 26 + b], [39, 26 + b], [42, 50], [22, 50]], darken(pal[0], 0.15));
  for (let y = 28; y < 50; y += 3) p.line(24, y, 40, y + 1, darken(pal[0], 0.3));
  // Bras de ronces
  for (const side of [-1, 1]) {
    let x = 32 + side * 8;
    let y = 28 + b;
    for (let k = 0; k < 6; k++) {
      const nx = x + side * 4;
      const ny = y + (k % 2 ? 3 : -1) + (f ? side : 0);
      p.line(x, y, nx, ny, pal[1], 2);
      p.set(nx, ny - 2, pal[2]);
      p.set(nx + side, ny + 2, pal[2]);
      x = nx;
      y = ny;
    }
  }
  p.line(28, 50, 27, 60, darken(pal[0], 0.2), 3);
  p.line(36, 50, 37, 60, darken(pal[0], 0.2), 3);
  p.ellipse(37, 60, 4, 2, '#101010'); // une seule chaussure vernie
  p.set(36, 59, '#5a5a6a');
  // Yeux-boutons
  p.ellipse(29, 18 + b, 2, 2, pal[3]);
  p.ellipse(35, 18 + b, 2, 2, pal[3]);
  p.line(28, 23 + b, 36, 23 + b, pal[4]);
  finish(p);
}

function ronceReine(p: PixelCanvas, pal: string[], f: number): void {
  const b = f ? 1 : 0;
  p.poly([[22, 60], [42, 60], [40, 22], [24, 22]], darken(pal[0], 0.2));
  for (let y = 24; y < 60; y += 4) p.line(24, y, 40, y + 2, darken(pal[0], 0.45));
  p.ellipse(32, 16 + b, 9, 9, darken(pal[0], 0.1));
  // Couronne d'épines
  for (let i = 0; i < 7; i++) {
    const x = 23 + i * 3;
    p.line(x, 9 + b, x + 1, 2 + b + (i % 2) * 2, pal[1], 2);
  }
  p.rect(22, 8 + b, 20, 2, pal[1]);
  // Bras-branches et sève rouge
  p.line(24, 28, 6, 14 + b * 2, pal[1], 3);
  p.line(40, 28, 58, 14 + b * 2, pal[1], 3);
  p.line(10, 18, 4, 22, pal[1]);
  p.line(54, 18, 60, 22, pal[1]);
  for (const x of [27, 33, 38]) p.line(x, 30, x, 38 + (x % 5), pal[4]);
  p.ellipse(29, 16 + b, 1.5, 2, pal[4]);
  p.ellipse(35, 16 + b, 1.5, 2, pal[4]);
  finish(p);
}

// ---------------------------------------------------------------- Grésille / Antenne Pâle

function screenWing(p: PixelCanvas, x: number, y: number, w: number, h: number, pal: string[], f: number): void {
  p.rect(x, y, w, h, pal[3]);
  p.rect(x + 1, y + 1, w - 2, h - 2, '#101014');
  for (let j = y + 2; j < y + h - 2; j++)
    for (let i = x + 2; i < x + w - 2; i++) if (hash(i, j, f * 13 + x) < 0.45) p.set(i, j, hash(j, i, f) < 0.5 ? pal[2] : pal[1]);
  p.rect(x + 2, y + 2 + ((f * 3) % (h - 4)), w - 4, 1, '#ffffff', 120);
}

function gresille(p: PixelCanvas, pal: string[], f: number): void {
  const up = f ? -1 : 0;
  screenWing(p, 8, 16 + up, 20, 16, pal, f);
  screenWing(p, 36, 16 + up, 20, 16, pal, f + 1);
  screenWing(p, 13, 34, 14, 11, pal, f + 2);
  screenWing(p, 37, 34, 14, 11, pal, f + 3);
  p.ellipse(32, 32, 4, 13, pal[0]);
  for (let y = 22; y < 44; y += 3) p.rect(28, y, 8, 1, darken(pal[0], 0.3));
  p.line(30, 20, 24, 8 + up, pal[0]);
  p.line(34, 20, 40, 8 + up, pal[0]);
  p.ellipse(30, 22, 1.5, 1.5, '#e8e8e8');
  p.ellipse(34, 22, 1.5, 1.5, '#e8e8e8');
  p.outline(OUT);
}

function antennePale(p: PixelCanvas, pal: string[], f: number): void {
  p.rect(30, 6, 4, 56, pal[3]);
  p.rect(31, 6, 2, 56, pal[4]);
  for (let y = 12; y < 60; y += 10) {
    p.line(26, y, 38, y, pal[4]);
    p.line(26, y, 32, y - 6, pal[3]);
    p.line(38, y, 32, y - 6, pal[3]);
  }
  p.ellipse(32, 5, 3, 3, '#c94a4a');
  const moths: Array<[number, number]> = [[14, 16], [46, 22], [12, 40], [48, 44], [20, 54]];
  moths.forEach(([x, y], i) => {
    screenWing(p, x - 7, y - 4 + (f && i % 2 ? 1 : 0), 7, 6, pal, f + i);
    screenWing(p, x, y - 4 + (f && i % 2 ? 1 : 0), 7, 6, pal, f + i + 5);
  });
  p.outline(OUT);
}

// ---------------------------------------------------------------- Bouche-du-Mur

function bouche(p: PixelCanvas, pal: string[], f: number): void {
  // Morceau de mur fissuré
  p.rect(4, 44, 56, 18, darken(pal[0], 0.3));
  for (let y = 46; y < 62; y += 5) p.rect(4, y, 56, 1, darken(pal[0], 0.5));
  p.line(30, 44, 34, 62, '#1a1616', 2);
  // Tige de plâtre ondulante
  const sway = f ? 2 : -1;
  for (let y = 44; y > 20; y--) {
    const x = 32 + Math.sin(y / 5) * 3 + ((44 - y) / 24) * sway;
    p.ellipse(x, y, 4 - (44 - y) / 14, 1, pal[0]);
  }
  // Bouche humaine
  const mx = 32 + sway;
  p.ellipse(mx, 16, 12, 8, pal[4]);
  p.ellipse(mx, 16, 10, 6, pal[1]);
  p.ellipse(mx, 16, 7, f ? 3 : 2, '#1a0808');
  for (let x = mx - 5; x <= mx + 5; x += 2) p.rect(x, 14 - (f ? 1 : 0), 1, 2, '#e8e0d0');
  p.line(mx - 10, 13, mx + 10, 13, darken(pal[1], 0.3));
  finish(p, 0.12, 0.3);
}

// ---------------------------------------------------------------- Le Pli / Le Grand Pli

function pli(p: PixelCanvas, pal: string[], f: number): void {
  // Pan de mur
  p.rect(0, 0, 10, 64, darken(pal[1], 0.4));
  p.rect(54, 0, 10, 64, darken(pal[1], 0.4));
  // Silhouette trop étroite
  const lean = f ? 1 : 0;
  p.ellipse(32 + lean, 10, 3, 5, pal[0]);
  p.rect(30 + lean, 15, 4, 30, pal[0]);
  p.rect(29, 44, 2, 18, pal[0]);
  p.rect(33, 44, 2, 18, pal[0]);
  // Bras démesurés
  p.line(30 + lean, 18, 22, 40, pal[0]);
  p.line(22, 40, 20, 54, pal[0]);
  p.line(34 + lean, 18, 42, 38, pal[0]);
  p.line(42, 38, 46, 52, pal[0]);
  for (const [x, y] of [[20, 54], [46, 52]]) {
    p.line(x, y, x - 2, y + 5, pal[0]);
    p.line(x, y, x + 1, y + 6, pal[0]);
  }
  // Plis
  for (let y = 18; y < 44; y += 6) p.line(30 + lean, y, 34 + lean, y + 2, pal[1]);
  // Yeux minuscules
  p.set(31 + lean, 9, pal[3]);
  p.set(33 + lean, 9, pal[3]);
  p.outline(lighten(pal[1], 0.25));
}

function grandPli(p: PixelCanvas, pal: string[], f: number): void {
  const w = f ? 1 : 0;
  p.poly([[14 - w, 2], [50 + w, 4], [52, 62], [12, 60]], pal[0]);
  for (let x = 16; x < 50; x += 7) p.line(x, 4, x + 1, 60, pal[1]);
  for (let y = 10; y < 58; y += 9) p.line(14, y, 50, y + 1, pal[1]);
  // Visages d'élèves
  for (let i = 0; i < 12; i++) {
    const x = 18 + (i % 4) * 8;
    const y = 10 + Math.floor(i / 4) * 16;
    p.ellipse(x, y, 3, 3.5, pal[2]);
    p.set(x - 1, y - 1, pal[3] === '#e8e8e8' ? '#101010' : pal[4]);
    p.set(x + 1, y - 1, '#101010');
    p.rect(x - 1, y + 1, 3, 1, '#101010');
  }
  p.ellipse(32, 30, 4, 4, pal[3]);
  p.set(31, 29, '#000000');
  p.set(33, 29, '#000000');
  finish(p, 0.08, 0.3);
}

// ---------------------------------------------------------------- Mère-Cendre

function mereCendre(p: PixelCanvas, pal: string[], f: number): void {
  // Masse de racines et de châles
  p.ellipse(28, 40, 20, 18, pal[0]);
  p.ellipse(24, 26, 10, 11, darken(pal[0], 0.1));
  for (let i = 0; i < 8; i++) {
    const x = 10 + i * 5;
    p.line(x, 50, x - 4 + (i % 3) * 3, 63, pal[2], 2);
  }
  for (let i = 0; i < 6; i++) p.line(14 + i * 6, 28, 18 + i * 5, 54, darken(pal[1], 0.3));
  // Châle
  p.poly([[10, 34], [44, 30], [40, 46], [14, 48]], darken(pal[4], 0.45));
  for (let x = 12; x < 42; x += 3) p.set(x, 46, pal[4]);
  // Tête penchée, sans visage
  p.ellipse(22, 22, 6, 7, pal[3]);
  p.ellipse(22, 20, 7, 8, darken(pal[4], 0.55), 0);
  // Bras de racine qui bercent
  p.line(34, 36, 46, 44 + f, pal[2], 3);
  // Berceau de fer
  p.rect(44, 46 + f, 16, 8, '#2a2622');
  p.ring(52, 54 + f, 8, 3, '#3e3a34');
  p.line(44, 46 + f, 44, 56, '#3e3a34');
  p.line(59, 46 + f, 59, 56, '#3e3a34');
  // Braises
  p.set(30, 40, pal[1]);
  p.set(18, 44, pal[1]);
  p.set(26, 52, '#e8a050');
  finish(p, 0.1, 0.3);
  // Cendres qui tombent
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(hash(i, 2, 5) * 64);
    const y = (Math.floor(hash(2, i, 7) * 64) + f * 3) % 64;
    if (!p.alphaAt(x, y)) p.set(x, y, '#9a928a', 170);
  }
}

// ---------------------------------------------------------------- Le Sonneur

function sonneur(p: PixelCanvas, pal: string[], f: number): void {
  p.poly([[22, 14], [42, 14], [50, 62], [14, 62]], pal[0]);
  for (let x = 18; x < 48; x += 5) p.line(x, 20, x - 2 + (x % 3), 62, darken(pal[0], 0.2));
  // Tête sans visage
  p.ellipse(32, 9, 7, 9, pal[2]);
  p.ellipse(33, 10, 5, 6, darken(pal[2], 0.08));
  // Bras qui pendent
  p.line(22, 18, 14, 46, pal[0], 3);
  p.line(42, 18, 50, 46, pal[0], 3);
  finish(p, 0.1, 0.25);
  // Clochettes de chevet
  for (let i = 0; i < 16; i++) {
    const x = 16 + Math.floor(hash(i, 1, 31) * 32);
    const y = 18 + Math.floor(hash(1, i, 33) * 40);
    if (!p.alphaAt(x, y)) continue;
    const s = (i + f) % 2 ? 1 : 0;
    p.ellipse(x + s, y, 2, 2, pal[1]);
    p.set(x + s, y + 2, pal[3]);
    p.set(x + s - 1, y - 1, lighten(pal[1], 0.4));
  }
}

// ---------------------------------------------------------------- L'Enfant du Quai

function enfantQuai(p: PixelCanvas, pal: string[], f: number): void {
  // Flaque
  p.ellipse(32, 60, 20, 3, pal[1], 160);
  // Robe trempée
  p.poly([[24, 28], [40, 28], [44, 58], [20, 58]], pal[0]);
  for (let x = 22; x < 44; x += 4) p.line(x, 34, x + 1, 58, darken(pal[0], 0.3));
  p.line(24, 30, 18, 46, pal[0], 3);
  p.line(40, 30, 46, 46, pal[0], 3);
  // Tête, cheveux collés sur le visage
  p.ellipse(32, 18, 8, 9, pal[4]);
  for (let i = 0; i < 9; i++) p.line(25 + i * 2, 10, 24 + i * 2 + (i % 2), 30 + (i % 3) * 2, pal[3], 1);
  p.ellipse(32, 11, 9, 4, pal[3]);
  p.set(30, 20, '#ffffff');
  finish(p, 0.08, 0.3);
  // Gouttes
  for (let i = 0; i < 6; i++) {
    const x = 20 + Math.floor(hash(i, 4, 9) * 24);
    const y = 40 + ((Math.floor(hash(4, i, 3) * 20) + f * 4) % 20);
    p.set(x, y, pal[4], 200);
  }
}

// ---------------------------------------------------------------- L'Archivore

function archivore(p: PixelCanvas, pal: string[], f: number): void {
  p.rect(16, 6, 32, 54, pal[0]);
  p.rect(16, 6, 32, 2, lighten(pal[0], 0.2));
  for (let i = 0; i < 4; i++) {
    const y = 10 + i * 12;
    const open = (i + f) % 2 === 0 ? 6 : 2;
    p.rect(14 - open, y, 36 + open, 10, darken(pal[0], 0.15));
    p.rect(14 - open, y + 7, 36 + open, 3, '#101014');
    p.rect(28, y + 3, 8, 2, pal[3]);
    // Fiches qui débordent
    for (let k = 0; k < 3; k++) p.rect(16 - open + k * 4, y + 1 - k, 3, 6, pal[3]);
    // Bande magnétique
    if (i % 2 === 0) p.line(14 - open, y + 9, 4, y + 14 + f * 2, pal[2], 2);
  }
  // Œil rouge
  p.ellipse(32, 30, 4, 3, '#1a0808');
  p.ellipse(32, 30, 2, 2, pal[4]);
  p.rect(18, 60, 4, 3, '#202024');
  p.rect(42, 60, 4, 3, '#202024');
  finish(p, 0.15, 0.3);
}

// ---------------------------------------------------------------- Chien Creux / Chien des Voix

function chien(p: PixelCanvas, pal: string[], f: number, voices: boolean): void {
  const b = f ? 1 : 0;
  // Pattes décharnées
  for (const [x, ox] of [[16, -2], [22, 2], [42, -2], [48, 2]]) p.line(x, 40, x + ox, 60, pal[0], 2);
  // Colonne et cage thoracique vide
  p.line(14, 30 + b, 50, 28 + b, pal[0], 3);
  for (let x = 20; x <= 42; x += 4) {
    p.line(x, 30 + b, x - 2, 42, pal[2]);
    p.line(x - 2, 42, x + 3, 44, pal[2]);
  }
  p.line(18, 44, 46, 42, pal[0]);
  if (voices) {
    for (let x = 22; x < 44; x += 5) {
      p.ellipse(x, 37, 2, 1.5, pal[4]);
      p.set(x, 37, '#1a0808');
    }
  }
  // Hanches et queue
  p.ellipse(48, 32 + b, 5, 5, pal[0]);
  p.line(52, 30, 60, 20 + b * 2, pal[0], 2);
  // Tête
  p.ellipse(12, 24 + b, 8, 6, pal[0]);
  p.poly([[4, 24 + b], [0, 30 + b], [8, 30 + b]], pal[0]);
  p.poly([[10, 18 + b], [14, 10 + b], [16, 19 + b]], pal[0]);
  p.ellipse(10, 23 + b, 1.5, 1.5, '#e8e0d0');
  // Gueule ouverte qui imite une voix
  p.line(2, 30 + b, 10, 29 + b + (f ? 2 : 0), '#1a0808', 2);
  finish(p, 0.12, 0.3);
}

// ---------------------------------------------------------------- La Veuve de Verre

function veuve(p: PixelCanvas, pal: string[], f: number): void {
  // Robe de vitre teintée (translucide)
  p.poly([[24, 24], [40, 24], [52, 62], [12, 62]], pal[0], 200);
  for (let x = 14; x < 52; x += 6) p.line(32, 26, x, 62, pal[1], 1, 220);
  p.line(18, 44, 46, 44, pal[1]);
  p.line(24, 30, 14, 50, pal[0], 3, 220);
  p.line(40, 30, 50, 50, pal[0], 3, 220);
  // Voile-miroir fendu
  p.ellipse(32, 14, 10, 12, '#b8c8c8');
  p.ellipse(31, 13, 7, 9, pal[2]);
  p.line(28, 4, 34, 14, '#5a6a6a');
  p.line(34, 14, 30, 24, '#5a6a6a');
  p.line(34, 14, 40, 18, '#5a6a6a');
  // Reflet en retard
  p.ellipse(35 + (f ? 1 : 0), 15, 2, 3, darken(pal[1], 0.2), 160);
  p.outline(OUT);
  // Éclats autour
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + f * 0.3;
    const x = 32 + Math.cos(a) * 26;
    const y = 36 + Math.sin(a) * 22;
    p.poly([[x, y], [x + 2, y + 3], [x - 1, y + 2]], pal[2], 200);
  }
}

// ---------------------------------------------------------------- Le Faux-Ami

function fauxAmi(p: PixelCanvas, pal: string[], f: number): void {
  p.poly([[22, 26], [42, 26], [46, 60], [18, 60]], pal[0]);
  p.line(22, 28, 12, 50, pal[0], 3);
  p.line(42, 28, 52, 50, pal[0], 3);
  p.ellipse(32, 16, 10, 11, pal[0]);
  finish(p, 0.08, 0.2);
  // Masque en carton découpé dans une photo de classe
  p.rect(23, 8, 18, 16, pal[1]);
  p.rect(24, 9, 16, 14, mix(pal[1], '#e8dcc0', 0.4));
  const eyes = f ? [[27, 14], [36, 14]] : [[28, 13], [35, 14]];
  for (const [x, y] of eyes) p.ellipse(x, y, 1.5, 1.5, pal[3]);
  p.line(28, 19, 36, 19 + (f ? 1 : 0), pal[4]);
  p.rect(23, 23, 18, 1, darken(pal[1], 0.3));
  p.set(22, 15, '#c9c9c0');
  p.set(41, 15, '#c9c9c0');
}

// ---------------------------------------------------------------- Lampiste

function lampiste(p: PixelCanvas, pal: string[], f: number): void {
  p.rect(26, 6, 12, 4, pal[4]);
  p.ring(32, 4, 5, 3, pal[4]);
  p.rect(22, 10, 20, 6, pal[0]);
  p.rect(24, 16, 16, 30, pal[1], 170);
  for (const x of [24, 31, 39]) p.rect(x, 16, 1, 30, pal[0]);
  p.rect(22, 46, 20, 8, pal[0]);
  p.rect(20, 54, 24, 4, darken(pal[0], 0.3));
  // Flamme avec un œil
  p.ellipse(32, 32 + (f ? -1 : 0), 5, 9, pal[2]);
  p.ellipse(32, 34, 3, 5, '#fff6d0');
  p.ellipse(32, 31, 2.5, 2, '#f0f0f0');
  p.ellipse(32 + (f ? 1 : 0), 31, 1, 1.5, '#101010');
  finish(p, 0.15, 0.3);
  for (let y = 0; y < CS; y++)
    for (let x = 0; x < CS; x++) {
      if (p.alphaAt(x, y)) continue;
      const d = Math.hypot(x - 32, y - 32);
      if (d < 22) p.set(x, y, pal[2], Math.max(0, 50 - d * 2.2));
    }
}

// ---------------------------------------------------------------- Coquemort

function coquemort(p: PixelCanvas, pal: string[], f: number): void {
  for (const [x, ox] of [[24, -6], [40, 6]]) {
    p.line(x, 44, x + ox, 56 + (f && ox > 0 ? -1 : 0), pal[1], 2);
    p.line(x + ox, 56, x + ox - 4, 62, pal[1]);
    p.line(x + ox, 56, x + ox + 3, 62, pal[1]);
  }
  p.ellipse(32, 28 + (f ? 1 : 0), 17, 22, pal[0]);
  p.ellipse(27, 20, 6, 8, lighten(pal[0], 0.1));
  // Fêlure noire
  p.line(20, 22, 26, 28, pal[3], 2);
  p.line(26, 28, 31, 23, pal[3], 2);
  p.line(31, 23, 38, 31, pal[3], 2);
  p.line(38, 31, 46, 25, pal[3], 2);
  p.ellipse(34, 28, 1.5, 1.5, pal[4]);
  p.set(33, 27, '#ffffff');
  finish(p, 0.1, 0.25);
}

// ---------------------------------------------------------------- Le Contrôleur

function controleur(p: PixelCanvas, pal: string[], f: number): void {
  const b = f ? 1 : 0;
  // Casquette sans tête
  p.rect(24, 6 + b, 16, 6, pal[0]);
  p.rect(22, 12 + b, 20, 2, darken(pal[0], 0.4));
  p.rect(30, 7 + b, 4, 3, pal[1]);
  // Veste vide
  p.poly([[20, 20], [44, 20], [46, 50], [18, 50]], pal[0]);
  p.poly([[28, 20], [36, 20], [32, 30]], '#000000');
  for (let y = 26; y < 48; y += 6) {
    p.set(29, y, pal[1]);
    p.set(35, y, pal[1]);
  }
  p.rect(18, 50, 28, 2, darken(pal[0], 0.4));
  // Manches qui flottent
  p.line(20, 22, 12, 40 + b, pal[0], 4);
  p.line(44, 22, 52, 36 - b, pal[0], 4);
  // Poinçon
  p.rect(50, 30 - b, 6, 3, pal[1]);
  p.line(52, 33 - b, 56, 36 - b, pal[2]);
  // Pantalon flottant
  p.rect(22, 52, 7, 10, darken(pal[0], 0.2));
  p.rect(35, 52, 7, 10, darken(pal[0], 0.2));
  finish(p, 0.15, 0.3);
}

// ---------------------------------------------------------------- L'Archiviste Blanc

function gardien(p: PixelCanvas, pal: string[], f: number): void {
  // Fiches flottantes
  for (let i = 0; i < 18; i++) {
    const x = Math.floor(hash(i, 8, 3) * 58);
    const y = (Math.floor(hash(8, i, 5) * 60) + f * 2) % 60;
    p.rect(x, y, 4, 3, pal[1], 200);
    p.set(x + 1, y + 1, pal[2]);
  }
  // Blouse
  p.poly([[20, 22], [44, 22], [50, 62], [14, 62]], pal[0]);
  p.line(32, 24, 32, 62, pal[1]);
  p.line(20, 24, 10, 52, pal[0], 4);
  p.line(44, 24, 54, 52, pal[0], 4);
  p.rect(36, 30, 5, 2, pal[4]);
  // Tête-écran blanc
  p.rect(22, 2, 20, 18, '#2a2a30');
  p.rect(24, 4, 16, 14, '#f8f8f8');
  for (let y = 4; y < 18; y += 2) p.rect(24, y, 16, 1, f ? '#e0e0e0' : '#ececec');
  if (f) p.rect(24, 10, 16, 1, pal[4]);
  finish(p, 0.08, 0.2);
}

const DRAWERS: Record<string, Drawer> = {
  veilleuse: (p, pal, f) => moth(p, pal, f, false),
  veilleuse_eveillee: (p, pal, f) => moth(p, pal, f, true),
  mitaine,
  main_froide: mainFroide,
  palefeu: (p, pal, f) => candle(p, pal, f, false),
  grand_cierge: (p, pal, f) => candle(p, pal, f, true),
  gribouille,
  dessin_fini: dessinFini,
  ronceline,
  ronce_reine: ronceReine,
  gresille,
  antenne_pale: antennePale,
  murmure_mur: bouche,
  pli,
  grand_pli: grandPli,
  mere_cendre: mereCendre,
  sonneur,
  enfant_quai: enfantQuai,
  archivore,
  chien_creux: (p, pal, f) => chien(p, pal, f, false),
  chien_des_voix: (p, pal, f) => chien(p, pal, f, true),
  veuve_verre: veuve,
  faux_ami: fauxAmi,
  lampiste,
  coquemort,
  controleur,
  gardien_blanc: gardien,
};

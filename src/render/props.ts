import { PixelCanvas, darken, hash } from './pixel';

// Accessoires de décor et textures d'effets.

const cache = new Map<string, HTMLCanvasElement>();

function cached(key: string, make: () => PixelCanvas): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make().toCanvas();
    cache.set(key, c);
  }
  return c;
}

export function signpost(): HTMLCanvasElement {
  return cached('sign', () => {
    const p = new PixelCanvas(16, 16);
    p.rect(7, 7, 2, 9, '#3a2a1c');
    p.rect(2, 2, 12, 7, '#5a4430');
    p.rect(2, 2, 12, 1, '#6e5640');
    for (let x = 4; x < 12; x += 2) p.set(x, 5, '#2a1d14');
    p.outline('#0c0a08');
    return p;
  });
}

export function itemGlint(frame: number): HTMLCanvasElement {
  return cached(`glint${frame % 4}`, () => {
    const p = new PixelCanvas(16, 16);
    p.ellipse(8, 12, 4, 2, '#000000', 90);
    p.rect(5, 7, 6, 5, '#6a5a44');
    p.rect(5, 7, 6, 1, '#8a7658');
    p.rect(7, 6, 2, 1, '#4a3a2a');
    const s = frame % 4;
    if (s < 2) {
      const cx = 11;
      const cy = 5;
      p.set(cx, cy, '#fff6d8');
      p.set(cx - 1, cy, '#c9b458');
      p.set(cx + 1, cy, '#c9b458');
      p.set(cx, cy - 1, '#c9b458');
      p.set(cx, cy + 1, '#c9b458');
    }
    p.outline('#0c0a08');
    return p;
  });
}

export function brambles(): HTMLCanvasElement {
  return cached('ronces', () => {
    const p = new PixelCanvas(16, 16);
    for (let i = 0; i < 9; i++) {
      const x0 = Math.floor(hash(i, 1, 3) * 16);
      const y0 = Math.floor(hash(1, i, 5) * 16);
      p.line(x0, y0, (x0 + 9) % 16, (y0 + 7) % 16, '#1e2a18', 2);
      p.set((x0 + 4) % 16, (y0 + 3) % 16, '#5a6a3a');
    }
    p.outline('#07090a');
    return p;
  });
}

export function padlock(): HTMLCanvasElement {
  return cached('cadenas', () => {
    const p = new PixelCanvas(16, 16);
    p.ring(8, 6, 3, 3, '#8a8a90');
    p.rect(4, 7, 8, 7, '#a08a3a');
    p.rect(7, 9, 2, 3, '#2a2210');
    p.outline('#0c0a08');
    return p;
  });
}

/** Le train de 23 h 50 (dessiné sur plusieurs tuiles). */
export function trainSprite(): HTMLCanvasElement {
  return cached('train', () => {
    const W = 16 * 14;
    const p = new PixelCanvas(W, 26);
    p.rect(0, 2, W, 20, '#2a3040');
    p.rect(0, 2, W, 2, '#3a4254');
    p.rect(0, 20, W, 2, '#14161c');
    for (let x = 8; x < W - 8; x += 18) {
      p.rect(x, 6, 12, 8, '#0e1014');
      p.rect(x + 1, 7, 10, 6, '#3a4a52');
      // Silhouettes d'enfants derrière les vitres embuées
      if (hash(x, 1, 3) > 0.35) {
        p.ellipse(x + 6, 10, 2, 2, '#1a1e24');
        p.rect(x + 4, 12, 4, 2, '#1a1e24');
      }
      p.rect(x + 1, 7, 10, 2, '#5a6a72', 120);
    }
    // Portes ouvertes
    p.rect(W / 2 - 6, 4, 12, 16, '#08090c');
    p.rect(W / 2 - 6, 4, 1, 16, '#c9b458');
    // Roues
    for (let x = 10; x < W; x += 30) {
      p.ellipse(x, 23, 4, 3, '#101014');
      p.set(x, 23, '#6a6a70');
    }
    // Phares
    p.rect(W - 4, 10, 3, 4, '#f0e8b0');
    p.outline('#060608');
    return p;
  });
}

/** Silhouette d'apparition en bord d'écran. */
export function edgeSilhouette(variant: number): HTMLCanvasElement {
  return cached(`edge${variant}`, () => {
    const p = new PixelCanvas(28, 64);
    const thin = variant % 2 === 1;
    const w = thin ? 3 : 5;
    p.ellipse(14, 8, thin ? 3 : 5, 6, '#030304');
    p.rect(14 - w, 13, w * 2, 26, '#030304');
    p.rect(14 - w, 38, w - 1, 26, '#030304');
    p.rect(15, 38, w - 1, 26, '#030304');
    p.line(14 - w, 15, 3, 44, '#030304', 2);
    p.line(14 + w, 15, 25, 44, '#030304', 2);
    if (variant === 2) {
      p.set(12, 7, '#d8d0c0');
      p.set(16, 7, '#d8d0c0');
    }
    return p;
  });
}

/** Texture de brume tuilable 128×128. */
export function fogTexture(seed: number): HTMLCanvasElement {
  return cached(`fog${seed}`, () => {
    const S = 128;
    const p = new PixelCanvas(S, S);
    // Bruit de valeur à plusieurs octaves, périodique.
    const val = (x: number, y: number, period: number) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const fx = x - xi;
      const fy = y - yi;
      const g = (a: number, b: number) => hash(((a % period) + period) % period, ((b % period) + period) % period, seed);
      const sm = (t: number) => t * t * (3 - 2 * t);
      const a = g(xi, yi) + (g(xi + 1, yi) - g(xi, yi)) * sm(fx);
      const b = g(xi, yi + 1) + (g(xi + 1, yi + 1) - g(xi, yi + 1)) * sm(fx);
      return a + (b - a) * sm(fy);
    };
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        let n = 0;
        let amp = 1;
        let tot = 0;
        for (const per of [4, 8, 16]) {
          n += val((x / S) * per, (y / S) * per, per) * amp;
          tot += amp;
          amp *= 0.5;
        }
        n /= tot;
        const a = Math.max(0, (n - 0.42) * 2.2);
        if (a > 0) p.set(x, y, '#b8c0c8', Math.min(255, a * 255));
      }
    return p;
  });
}

/** Grain de pellicule (plusieurs images). */
export function grainTexture(frame: number): HTMLCanvasElement {
  return cached(`grain${frame % 4}`, () => {
    const p = new PixelCanvas(160, 90);
    for (let y = 0; y < 90; y++)
      for (let x = 0; x < 160; x++) {
        const n = hash(x, y, frame * 31 + 7);
        if (n < 0.06) p.set(x, y, n < 0.03 ? '#ffffff' : '#000000', 40);
      }
    return p;
  });
}

export function battleBackdrop(theme: string, w: number, h: number): HTMLCanvasElement {
  return cached(`bd|${theme}|${w}x${h}`, () => {
    const p = new PixelCanvas(w, h);
    const sky: Record<string, [string, string]> = {
      village: ['#0e1218', '#232a30'],
      interieur: ['#140f0c', '#2a201a'],
      foret: ['#0a100c', '#1c2a20'],
      ecole: ['#12120e', '#2a2a22'],
      hopital: ['#0e1414', '#28322f'],
      gare: ['#0c0e14', '#222834'],
      marais: ['#0a1010', '#1e2a28'],
      mine: ['#080706', '#1a1612'],
      cendriers: ['#0c0a0e', '#241e26'],
      institut: ['#0e1012', '#2a3034'],
      seuil: ['#d8d6d1', '#f0eee9'],
      train: ['#100c0a', '#2a2018'],
    };
    const [a, b] = sky[theme] ?? sky.village;
    for (let y = 0; y < h; y++) {
      const t = y / h;
      p.rect(0, y, w, 1, t < 0.6 ? mixc(a, b, t / 0.6) : mixc(b, darken(b, 0.5), (t - 0.6) / 0.4));
    }
    // Éléments de décor lointains
    const ground = Math.floor(h * 0.62);
    if (theme === 'foret' || theme === 'village' || theme === 'marais') {
      for (let x = 0; x < w; x += 6) {
        const th = 20 + Math.floor(hash(x, 2, 5) * 30);
        p.rect(x, ground - th, 3, th, darken(b, 0.55));
        p.ellipse(x + 1, ground - th, 6, 8, darken(b, 0.6));
      }
    } else if (theme === 'ecole' || theme === 'hopital' || theme === 'institut' || theme === 'interieur' || theme === 'train') {
      for (let x = 10; x < w; x += 40) {
        p.rect(x, 18, 22, 28, darken(b, 0.4));
        p.rect(x + 2, 20, 18, 24, theme === 'hopital' ? '#3a4846' : '#1c2024');
        p.rect(x + 10, 20, 2, 24, darken(b, 0.4));
      }
    } else if (theme === 'gare' || theme === 'cendriers') {
      for (let x = 0; x < w; x += 30) {
        const hh = 24 + Math.floor(hash(x, 1, 9) * 20);
        p.rect(x, ground - hh, 24, hh, darken(b, 0.5));
        if (hash(x, 3, 1) > 0.4) p.rect(x + 8, ground - hh + 6, 4, 4, '#a89a4a');
      }
    } else if (theme === 'mine') {
      for (let x = 0; x < w; x += 36) {
        p.rect(x, 10, 4, ground - 10, '#2a2018');
        p.rect(x - 6, 10, 20, 3, '#2a2018');
      }
    } else if (theme === 'seuil') {
      for (let i = 0; i < 40; i++) p.rect(Math.floor(hash(i, 1, 2) * w), Math.floor(hash(1, i, 2) * h), 5, 3, '#c8c6c1');
    }
    // Sol et plateformes
    p.rect(0, ground, w, h - ground, theme === 'seuil' ? '#cfccc6' : darken(b, 0.35));
    p.ellipse(w * 0.72, h * 0.5, 50, 9, theme === 'seuil' ? '#bdbab4' : darken(b, 0.15));
    p.ellipse(w * 0.24, h * 0.74, 56, 9, theme === 'seuil' ? '#bdbab4' : darken(b, 0.15));
    p.dither(0, ground, w, h - ground, darken(b, 0.6), 0.2, 4);
    return p;
  });
}

function mixc(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) + (((pb >> s) & 255) - ((pa >> s) & 255)) * Math.max(0, Math.min(1, t)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, '0')).join('')}`;
}

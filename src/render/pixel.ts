// Petit atelier de pixel art procédural. Tous les graphismes du jeu sont
// dessinés ici, pixel par pixel, à partir de formes simples : aucun asset
// externe, donc aucun problème de licence.

export type RGBA = [number, number, number, number];

const cache = new Map<string, RGBA>();
export function rgba(hex: string, a = 255): RGBA {
  const k = hex + a;
  const c = cache.get(k);
  if (c) return c;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const v: RGBA = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), a];
  cache.set(k, v);
  return v;
}

export function mix(a: string, b: string, t: number): string {
  const A = rgba(a);
  const B = rgba(b);
  const r = (i: number) => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0');
  return `#${r(0)}${r(1)}${r(2)}`;
}

export function darken(c: string, t: number): string {
  return mix(c, '#000000', t);
}

export function lighten(c: string, t: number): string {
  return mix(c, '#ffffff', t);
}

/** Bruit déterministe 0..1 pour (x, y, graine). */
export function hash(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export class PixelCanvas {
  readonly data: Uint8ClampedArray;
  constructor(
    readonly w: number,
    readonly h: number,
  ) {
    this.data = new Uint8ClampedArray(w * h * 4);
  }

  inside(x: number, y: number): boolean {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  set(x: number, y: number, color: string | RGBA, alpha = 255): void {
    x = Math.round(x);
    y = Math.round(y);
    if (!this.inside(x, y)) return;
    const c = typeof color === 'string' ? rgba(color, alpha) : color;
    const i = (y * this.w + x) * 4;
    if (c[3] >= 255) {
      this.data[i] = c[0];
      this.data[i + 1] = c[1];
      this.data[i + 2] = c[2];
      this.data[i + 3] = 255;
      return;
    }
    const a = c[3] / 255;
    const da = this.data[i + 3] / 255;
    const oa = a + da * (1 - a);
    if (oa <= 0) return;
    for (let k = 0; k < 3; k++) this.data[i + k] = (c[k] * a + this.data[i + k] * da * (1 - a)) / oa;
    this.data[i + 3] = oa * 255;
  }

  get(x: number, y: number): RGBA | null {
    if (!this.inside(x, y)) return null;
    const i = (y * this.w + x) * 4;
    return [this.data[i], this.data[i + 1], this.data[i + 2], this.data[i + 3]];
  }

  alphaAt(x: number, y: number): number {
    if (!this.inside(x, y)) return 0;
    return this.data[(y * this.w + x) * 4 + 3];
  }

  clearPx(x: number, y: number): void {
    if (!this.inside(x, y)) return;
    this.data[(y * this.w + x) * 4 + 3] = 0;
  }

  rect(x: number, y: number, w: number, h: number, c: string, a = 255): void {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }

  fill(c: string): void {
    this.rect(0, 0, this.w, this.h, c);
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, c: string, a = 255): void {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / Math.max(0.5, rx);
        const dy = (y - cy) / Math.max(0.5, ry);
        if (dx * dx + dy * dy <= 1) this.set(x, y, c, a);
      }
  }

  ring(cx: number, cy: number, rx: number, ry: number, c: string): void {
    const steps = Math.max(16, Math.ceil((rx + ry) * 4));
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      this.set(cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, c);
    }
  }

  line(x0: number, y0: number, x1: number, y1: number, c: string, thick = 1, a = 255): void {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      if (thick <= 1) this.set(x0, y0, c, a);
      else this.ellipse(x0, y0, thick / 2, thick / 2, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  /** Remplit un polygone (règle pair-impair). */
  poly(pts: Array<[number, number]>, c: string, a = 255): void {
    const minY = Math.floor(Math.min(...pts.map((p) => p[1])));
    const maxY = Math.ceil(Math.max(...pts.map((p) => p[1])));
    for (let y = minY; y <= maxY; y++) {
      const xs: number[] = [];
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i];
        const [x1, y1] = pts[(i + 1) % pts.length];
        if ((y0 <= y + 0.5 && y1 > y + 0.5) || (y1 <= y + 0.5 && y0 > y + 0.5)) xs.push(x0 + ((y + 0.5 - y0) / (y1 - y0)) * (x1 - x0));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++) this.set(x, y, c, a);
    }
  }

  /** Ajoute un contour d'une couleur autour des pixels opaques. */
  outline(c: string, diagonal = false): void {
    const add: Array<[number, number]> = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        if (this.alphaAt(x, y) > 0) continue;
        const n = [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
          ...(diagonal ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : []),
        ].some(([dx, dy]) => this.alphaAt(x + dx, y + dy) > 128);
        if (n) add.push([x, y]);
      }
    for (const [x, y] of add) this.set(x, y, c);
  }

  /** Ombrage simple : assombrit le bas-droit des formes, éclaire le haut-gauche. */
  shade(light: number, dark: number): void {
    const copy = new Uint8ClampedArray(this.data);
    const a = (x: number, y: number) => (x < 0 || y < 0 || x >= this.w || y >= this.h ? 0 : copy[(y * this.w + x) * 4 + 3]);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (copy[i + 3] === 0) continue;
        let f = 0;
        if (a(x - 1, y - 1) === 0 || a(x, y - 1) === 0) f = light;
        else if (a(x + 1, y + 1) === 0 || a(x, y + 1) === 0) f = -dark;
        if (f > 0) for (let k = 0; k < 3; k++) this.data[i + k] = copy[i + k] + (255 - copy[i + k]) * f;
        else if (f < 0) for (let k = 0; k < 3; k++) this.data[i + k] = copy[i + k] * (1 + f);
      }
  }

  /** Grain de matière : variation de luminosité pixel par pixel sur les zones opaques. */
  grain(amount: number, seed = 1): void {
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const i = (y * this.w + x) * 4;
        if (this.data[i + 3] === 0) continue;
        const n = (hash(x, y, seed) - 0.5) * 2 * amount * 255;
        for (let k = 0; k < 3; k++) this.data[i + k] = this.data[i + k] + n;
      }
  }

  dither(x: number, y: number, w: number, h: number, c: string, density = 0.5, seed = 0): void {
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][((y + j) % 4) * 4 + ((x + i) % 4)] / 16;
        if (bayer + (hash(x + i, y + j, seed) - 0.5) * 0.15 < density) this.set(x + i, y + j, c);
      }
  }

  flipH(): PixelCanvas {
    const out = new PixelCanvas(this.w, this.h);
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++) {
        const s = (y * this.w + x) * 4;
        const d = (y * this.w + (this.w - 1 - x)) * 4;
        for (let k = 0; k < 4; k++) out.data[d + k] = this.data[s + k];
      }
    return out;
  }

  blit(src: PixelCanvas, dx: number, dy: number): void {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (src.data[i + 3] === 0) continue;
        this.set(dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2], src.data[i + 3]]);
      }
  }

  toCanvas(): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = this.w;
    c.height = this.h;
    const ctx = c.getContext('2d') as CanvasRenderingContext2D;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(this.data);
    ctx.putImageData(img, 0, 0);
    return c;
  }
}

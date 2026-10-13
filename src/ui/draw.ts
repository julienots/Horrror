// Outils de dessin de l'interface (couche UI, coordonnées logiques 640×360).

export const UI_W = 640;
export const UI_H = 360;

export interface UiTheme {
  bg: string;
  bgSolid: string;
  border: string;
  borderHi: string;
  text: string;
  dim: string;
  accent: string;
  danger: string;
  good: string;
  select: string;
}

export const THEME: UiTheme = {
  bg: 'rgba(9,10,14,0.88)',
  bgSolid: '#0a0b0f',
  border: '#3e4350',
  borderHi: '#8a8f9a',
  text: '#d9d4c7',
  dim: '#8b877d',
  accent: '#c9b458',
  danger: '#b04848',
  good: '#7aa06a',
  select: 'rgba(201,180,88,0.14)',
};

export const THEME_CONTRAST: UiTheme = {
  bg: 'rgba(0,0,0,0.97)',
  bgSolid: '#000000',
  border: '#d0d0d0',
  borderHi: '#ffffff',
  text: '#ffffff',
  dim: '#d0d0d0',
  accent: '#ffe066',
  danger: '#ff6b6b',
  good: '#9be37a',
  select: 'rgba(255,224,102,0.25)',
};

export const FONT = '"VT323", "Courier New", monospace';

export class Painter {
  t: UiTheme = THEME;
  scale = 1; // facteur taille de texte (accessibilité)

  constructor(public ctx: CanvasRenderingContext2D) {}

  font(size: number): void {
    this.ctx.font = `${Math.round(size * this.scale)}px ${FONT}`;
  }

  text(s: string, x: number, y: number, opts: { size?: number; color?: string; align?: CanvasTextAlign; shadow?: boolean; alpha?: number } = {}): void {
    const c = this.ctx;
    this.font(opts.size ?? 16);
    c.textAlign = opts.align ?? 'left';
    c.textBaseline = 'top';
    const a = opts.alpha ?? 1;
    c.globalAlpha = a;
    if (opts.shadow !== false) {
      c.fillStyle = 'rgba(0,0,0,0.85)';
      c.fillText(s, x + 1, y + 1);
    }
    c.fillStyle = opts.color ?? this.t.text;
    c.fillText(s, x, y);
    c.globalAlpha = 1;
  }

  measure(s: string, size = 16): number {
    this.font(size);
    return this.ctx.measureText(s).width;
  }

  wrap(s: string, maxW: number, size = 16): string[] {
    const out: string[] = [];
    for (const para of s.split('\n')) {
      const words = para.split(' ');
      let line = '';
      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        if (this.measure(test, size) > maxW && line) {
          out.push(line);
          line = w;
        } else line = test;
      }
      out.push(line);
    }
    return out;
  }

  lineH(size = 16): number {
    return Math.round(size * this.scale * 1.05);
  }

  panel(x: number, y: number, w: number, h: number, opts: { title?: string; solid?: boolean; alpha?: number } = {}): void {
    const c = this.ctx;
    c.globalAlpha = opts.alpha ?? 1;
    c.fillStyle = opts.solid ? this.t.bgSolid : this.t.bg;
    c.fillRect(x, y, w, h);
    c.strokeStyle = this.t.border;
    c.lineWidth = 1;
    c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    c.strokeStyle = 'rgba(255,255,255,0.05)';
    c.strokeRect(x + 2.5, y + 2.5, w - 5, h - 5);
    // coins
    c.fillStyle = this.t.borderHi;
    for (const [cx, cy] of [[x, y], [x + w - 2, y], [x, y + h - 2], [x + w - 2, y + h - 2]]) c.fillRect(cx, cy, 2, 2);
    c.globalAlpha = 1;
    if (opts.title) {
      this.text(opts.title, x + 8, y + 4, { size: 16, color: this.t.accent });
      c.fillStyle = this.t.border;
      c.fillRect(x + 6, y + 21, w - 12, 1);
    }
  }

  bar(x: number, y: number, w: number, h: number, v: number, max: number, color: string, back = '#1a1c22'): void {
    const c = this.ctx;
    c.fillStyle = back;
    c.fillRect(x, y, w, h);
    const f = max > 0 ? Math.max(0, Math.min(1, v / max)) : 0;
    c.fillStyle = color;
    c.fillRect(x, y, Math.round(w * f), h);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(x, y, Math.round(w * f), 1);
    c.strokeStyle = '#000';
    c.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
  }

  hpColor(v: number, max: number): string {
    const f = max ? v / max : 0;
    return f > 0.5 ? '#7aa06a' : f > 0.2 ? '#c9a04a' : '#b04848';
  }

  /** Liste verticale avec curseur. Retourne la hauteur utilisée. */
  list(items: Array<{ label: string; right?: string; disabled?: boolean; color?: string }>, sel: number, x: number, y: number, w: number, opts: { size?: number; scroll?: number; visible?: number } = {}): number {
    const size = opts.size ?? 16;
    const lh = this.lineH(size) + 3;
    const start = opts.scroll ?? 0;
    const visible = opts.visible ?? items.length;
    for (let i = start; i < Math.min(items.length, start + visible); i++) {
      const it = items[i];
      const yy = y + (i - start) * lh;
      if (i === sel) {
        this.ctx.fillStyle = this.t.select;
        this.ctx.fillRect(x - 4, yy - 1, w + 8, lh);
        this.text('›', x - 2, yy, { size, color: this.t.accent });
      }
      const col = it.disabled ? '#5a5852' : it.color ?? (i === sel ? this.t.accent : this.t.text);
      this.text(it.label, x + 10, yy, { size, color: col });
      if (it.right) this.text(it.right, x + w, yy, { size, color: it.disabled ? '#5a5852' : this.t.dim, align: 'right' });
    }
    if (start > 0) this.text('▲', x + w, y - 12, { size: 12, color: this.t.dim, align: 'right' });
    if (start + visible < items.length) this.text('▼', x + w, y + visible * lh - 4, { size: 12, color: this.t.dim, align: 'right' });
    return Math.min(items.length, visible) * lh;
  }

  image(img: CanvasImageSource, x: number, y: number, w: number, h: number, alpha = 1): void {
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, x, y, w, h);
    this.ctx.globalAlpha = 1;
  }

  /** Petite pastille d'affinité. */
  chip(label: string, x: number, y: number, color: string, size = 13): number {
    const w = Math.ceil(this.measure(label, size)) + 8;
    this.ctx.fillStyle = color;
    this.ctx.globalAlpha = 0.85;
    this.ctx.fillRect(x, y, w, this.lineH(size) + 1);
    this.ctx.globalAlpha = 1;
    this.text(label, x + 4, y, { size, color: '#0b0b0e', shadow: false });
    return w;
  }
}

/** Pagination simple pour garder la sélection visible. */
export function scrollFor(sel: number, visible: number, current: number): number {
  if (sel < current) return sel;
  if (sel >= current + visible) return sel - visible + 1;
  return current;
}

import { CHARACTERS } from '../data/characters';
import type { Mood } from '../data/types';
import type { Game, Scene } from '../game';
import { portrait } from '../render/characters';
import { UI_H, UI_W, type Painter } from '../ui/draw';

const SPEED: Record<string, number> = { lent: 28, normal: 55, rapide: 110, instantane: 100000 };

function speakerName(who: string): string {
  if (!who) return '';
  return CHARACTERS[who]?.name ?? who;
}

/** Boîte de dialogue avec texte progressif, portrait et pagination. */
export class DialogueScene implements Scene {
  readonly kind = 'dialogue';
  opaque = false;
  private pages: string[][] = [];
  private page = 0;
  private shown = 0;
  private blink = 0;
  private tickSound = 0;
  private laid = false;

  constructor(
    private text: string,
    private who: string,
    private mood: Mood,
    private done: () => void,
  ) {}

  private layout(p: Painter): void {
    const hasPortrait = !!this.who && this.who !== '';
    const width = hasPortrait ? UI_W - 150 : UI_W - 70;
    const lines = p.wrap(this.text, width, 18);
    const perPage = p.scale > 1 ? 3 : 4;
    this.pages = [];
    for (let i = 0; i < lines.length; i += perPage) this.pages.push(lines.slice(i, i + perPage));
    if (!this.pages.length) this.pages = [['']];
    this.laid = true;
  }

  private pageLength(): number {
    return this.pages[this.page].join(' ').length;
  }

  update(dt: number, g: Game): void {
    if (!this.laid) this.layout(g.painter);
    const total = this.pageLength();
    if (this.shown < total) {
      const before = Math.floor(this.shown);
      this.shown = Math.min(total, this.shown + SPEED[g.options.textSpeed] * dt);
      this.tickSound -= dt;
      if (Math.floor(this.shown) > before && this.tickSound <= 0 && g.options.textSpeed !== 'instantane') {
        g.audio.sfx('texte');
        this.tickSound = 0.05;
      }
    }
    this.blink += dt;
    if (g.input.consume('confirm') || g.input.consume('cancel')) {
      if (this.shown < total) this.shown = total;
      else if (this.page < this.pages.length - 1) {
        this.page++;
        this.shown = 0;
      } else {
        g.pop(this);
        this.done();
      }
    }
  }

  renderUI(p: Painter): void {
    if (!this.laid) this.layout(p);
    const h = 104;
    const y = UI_H - h - 8;
    p.panel(8, y, UI_W - 16, h);
    let tx = 24;
    if (this.who) {
      const img = portrait(this.who, this.mood);
      p.ctx.fillStyle = '#000';
      p.ctx.fillRect(18, y + 10, 84, 84);
      p.image(img, 20, y + 12, 80, 80);
      tx = 116;
      const name = speakerName(this.who);
      p.panel(tx - 6, y - 18, Math.max(90, p.measure(name, 16) + 20), 22, { solid: true });
      p.text(name, tx + 4, y - 15, { size: 16, color: p.t.accent });
    }
    let remaining = Math.floor(this.shown);
    const lines = this.pages[this.page];
    lines.forEach((line, i) => {
      const part = line.slice(0, Math.max(0, remaining));
      remaining -= line.length + 1;
      p.text(part, tx, y + 14 + i * p.lineH(18) * 1.1, { size: 18 });
    });
    if (this.shown >= this.pageLength() && Math.floor(this.blink * 2) % 2 === 0) p.text(this.page < this.pages.length - 1 ? '▼' : '■', UI_W - 30, y + h - 22, { size: 14, color: p.t.accent });
  }
}

/** Choix multiple, avec question au-dessus. */
export class ChoiceScene implements Scene {
  readonly kind = 'choice';
  opaque = false;
  private sel = 0;
  constructor(
    private prompt: string,
    private options: string[],
    private who: string,
    private done: (i: number) => void,
  ) {}

  update(_dt: number, g: Game): void {
    const n = this.options.length;
    if (g.input.consume('up')) {
      this.sel = (this.sel + n - 1) % n;
      g.audio.sfx('menu');
    }
    if (g.input.consume('down')) {
      this.sel = (this.sel + 1) % n;
      g.audio.sfx('menu');
    }
    if (g.input.consume('confirm')) {
      g.audio.sfx('confirm');
      g.pop(this);
      this.done(this.sel);
    }
  }

  renderUI(p: Painter): void {
    const lines = p.wrap(this.prompt, UI_W - 60, 18);
    const h = 104;
    const y = UI_H - h - 8;
    p.panel(8, y, UI_W - 16, h);
    lines.slice(0, 4).forEach((l, i) => p.text(l, 24, y + 14 + i * p.lineH(18) * 1.1, { size: 18 }));
    const w = Math.min(UI_W - 40, Math.max(220, ...this.options.map((o) => p.measure(o, 17) + 40)));
    const lh = p.lineH(17) + 3;
    const ch = this.options.length * lh + 16;
    const cx = UI_W - w - 16;
    const cy = y - ch - 6;
    p.panel(cx, cy, w, ch, { solid: true });
    p.list(this.options.map((o) => ({ label: o })), this.sel, cx + 10, cy + 8, w - 24, { size: 17 });
    if (this.who) p.text(CHARACTERS[this.who]?.name ?? '', 24, y - 18, { size: 15, color: p.t.accent });
  }
}

/** Saisie d'un code chiffré (cadenas). Annuler renvoie une chaîne vide. */
export class CodeScene implements Scene {
  readonly kind = 'code';
  opaque = false;
  private digits: number[];
  private pos = 0;
  constructor(
    private prompt: string,
    length: number,
    private done: (code: string) => void,
  ) {
    this.digits = new Array(length).fill(0);
  }

  update(_dt: number, g: Game): void {
    const i = g.input;
    if (i.consume('left')) this.pos = Math.max(0, this.pos - 1);
    if (i.consume('right')) this.pos = Math.min(this.digits.length - 1, this.pos + 1);
    if (i.consume('up')) {
      this.digits[this.pos] = (this.digits[this.pos] + 1) % 10;
      g.audio.sfx('menu');
    }
    if (i.consume('down')) {
      this.digits[this.pos] = (this.digits[this.pos] + 9) % 10;
      g.audio.sfx('menu');
    }
    if (i.consume('confirm')) {
      g.audio.sfx('mecanisme');
      g.pop(this);
      this.done(this.digits.join(''));
    } else if (i.consume('cancel')) {
      g.audio.sfx('cancel');
      g.pop(this);
      this.done('');
    }
  }

  renderUI(p: Painter): void {
    const w = 300;
    const h = 150;
    const x = (UI_W - w) / 2;
    const y = (UI_H - h) / 2 - 20;
    p.panel(x, y, w, h, { title: this.prompt, solid: true });
    const dw = 44;
    const sx = x + (w - this.digits.length * (dw + 10)) / 2;
    this.digits.forEach((d, i) => {
      const dx = sx + i * (dw + 10);
      p.ctx.fillStyle = i === this.pos ? '#2a2a20' : '#141418';
      p.ctx.fillRect(dx, y + 40, dw, 56);
      p.ctx.strokeStyle = i === this.pos ? p.t.accent : p.t.border;
      p.ctx.strokeRect(dx + 0.5, y + 40.5, dw - 1, 55);
      p.text(String(d), dx + dw / 2, y + 48, { size: 40, align: 'center', color: i === this.pos ? p.t.accent : p.t.text });
      if (i === this.pos) {
        p.text('▲', dx + dw / 2, y + 28, { size: 12, align: 'center', color: p.t.accent });
        p.text('▼', dx + dw / 2, y + 98, { size: 12, align: 'center', color: p.t.accent });
      }
    });
    p.text('↑↓ chiffre   ←→ position   Valider   Échap : annuler', x + w / 2, y + h - 22, { size: 13, align: 'center', color: p.t.dim });
  }
}

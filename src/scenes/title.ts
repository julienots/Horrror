import { ENDINGS } from '../data/story';
import type { EndingId } from '../data/types';
import type { Game, Scene } from '../game';
import { WORLD_H, WORLD_W } from '../game';
import { creatureSprite } from '../render/creatures';
import { fogTexture } from '../render/props';
import { hash } from '../render/pixel';
import { UI_H, UI_W, type Painter } from '../ui/draw';
import { OptionsPanel, SlotsPanel } from './panels';

type Mode = 'press' | 'main' | 'load' | 'options' | 'credits' | 'confirmNew';

/** Fond animé partagé : rue de Saint-Ormel dans la brume, réverbère vacillant. */
function drawFoggyStreet(w: CanvasRenderingContext2D, t: number, white = false): void {
  const g = w.createLinearGradient(0, 0, 0, WORLD_H);
  g.addColorStop(0, white ? '#d8d6d1' : '#06070a');
  g.addColorStop(1, white ? '#f0eee9' : '#141820');
  w.fillStyle = g;
  w.fillRect(0, 0, WORLD_W, WORLD_H);
  // Maisons
  for (let i = 0; i < 9; i++) {
    const x = i * 38 - 10;
    const h = 40 + Math.floor(hash(i, 1, 3) * 30);
    const y = 130 - h;
    w.fillStyle = white ? '#c8c6c1' : '#0b0d12';
    w.fillRect(x, y, 34, h + 50);
    w.beginPath();
    w.moveTo(x - 3, y);
    w.lineTo(x + 17, y - 14);
    w.lineTo(x + 37, y);
    w.fill();
    if (hash(i, 2, 5) > 0.55 && !white) {
      const flick = Math.sin(t * 3 + i * 7) > -0.85 ? 1 : 0.2;
      w.fillStyle = `rgba(201,180,88,${0.55 * flick})`;
      w.fillRect(x + 10, y + 14, 6, 8);
    }
  }
  // Réverbère
  w.fillStyle = white ? '#9a9892' : '#15161a';
  w.fillRect(226, 70, 3, 80);
  const on = Math.sin(t * 9) > -0.9;
  if (on && !white) {
    const rg = w.createRadialGradient(227, 72, 2, 227, 72, 60);
    rg.addColorStop(0, 'rgba(232,212,138,0.5)');
    rg.addColorStop(1, 'rgba(232,212,138,0)');
    w.fillStyle = rg;
    w.fillRect(160, 10, 140, 140);
  }
  w.fillStyle = white ? '#bdbab4' : '#0e1014';
  w.fillRect(0, 150, WORLD_W, 30);
  // Brume
  const tex = fogTexture(1);
  for (let k = 0; k < 2; k++) {
    const off = ((t * (8 + k * 6)) % 256) - 256;
    w.globalAlpha = 0.28 + k * 0.08;
    for (let x = off; x < WORLD_W; x += 256) w.drawImage(tex, x, 60 + k * 40, 256, 140);
  }
  w.globalAlpha = 1;
}

export class TitleScene implements Scene {
  readonly kind = 'title';
  opaque = true;
  private mode: Mode = 'press';
  private sel = 0;
  private options = new OptionsPanel();
  private slots = new SlotsPanel('load', ['auto', 'slot1', 'slot2', 'slot3']);
  private message = '';

  constructor(private g: Game) {
    g.audio.playMusic('berceuse');
    g.audio.ambience('vent');
  }

  private items(): Array<{ id: string; label: string; disabled?: boolean }> {
    const latest = this.g.store.latest();
    return [
      { id: 'continuer', label: 'Continuer', disabled: !latest },
      { id: 'nouvelle', label: 'Nouvelle partie' },
      { id: 'charger', label: 'Charger' },
      { id: 'options', label: 'Options' },
      { id: 'credits', label: 'À propos' },
    ];
  }

  update(_dt: number, g: Game): void {
    const i = g.input;
    switch (this.mode) {
      case 'press':
        if (i.anyKeyPressed || i.consume('confirm')) {
          i.clear();
          this.mode = 'main';
          this.sel = g.store.latest() ? 0 : 1;
          g.audio.sfx('confirm');
        }
        return;
      case 'main': {
        const items = this.items();
        if (i.consume('up')) {
          this.sel = (this.sel + items.length - 1) % items.length;
          g.audio.sfx('menu');
        }
        if (i.consume('down')) {
          this.sel = (this.sel + 1) % items.length;
          g.audio.sfx('menu');
        }
        if (i.consume('confirm')) {
          const it = items[this.sel];
          if (it.disabled) return g.audio.sfx('echec');
          g.audio.sfx('confirm');
          if (it.id === 'continuer') {
            const slot = g.store.latest();
            if (slot) {
              const r = g.loadSlot(slot);
              if (!r.ok) this.message = r.message;
            }
          } else if (it.id === 'nouvelle') {
            if (g.store.latest()) this.mode = 'confirmNew';
            else g.newGame();
          } else if (it.id === 'charger') this.mode = 'load';
          else if (it.id === 'options') this.mode = 'options';
          else this.mode = 'credits';
        }
        return;
      }
      case 'confirmNew':
        if (i.consume('confirm')) g.newGame();
        else if (i.consume('cancel')) this.mode = 'main';
        return;
      case 'load':
        if (
          !this.slots.update(g, (slot) => {
            const r = g.loadSlot(slot);
            if (!r.ok) this.slots.message = r.message;
          })
        )
          this.mode = 'main';
        return;
      case 'options':
        if (!this.options.update(g)) this.mode = 'main';
        return;
      case 'credits':
        if (i.consume('cancel') || i.consume('confirm')) this.mode = 'main';
        return;
    }
  }

  renderWorld(w: CanvasRenderingContext2D, g: Game): void {
    drawFoggyStreet(w, g.time);
    // Une silhouette apparaît parfois sous le réverbère.
    const cycle = g.time % 14;
    if (cycle > 9 && cycle < 11.5) {
      w.globalAlpha = Math.min(1, (cycle - 9) * 2, (11.5 - cycle) * 2) * 0.8;
      w.fillStyle = '#020203';
      w.fillRect(232, 118, 4, 30);
      w.beginPath();
      w.arc(234, 114, 4, 0, Math.PI * 2);
      w.fill();
      w.globalAlpha = 1;
    }
    // La Veilleuse flotte au premier plan
    w.globalAlpha = 0.9;
    w.drawImage(creatureSprite('veilleuse', Math.floor(g.time * 2)), 40, 96 + Math.sin(g.time * 1.4) * 4, 48, 48);
    w.globalAlpha = 1;
  }

  renderUI(p: Painter, g: Game): void {
    p.text('VEILBOUND', UI_W / 2, 52, { size: 64, align: 'center', color: '#e4dccb' });
    p.text('Les Enfants du Brouillard', UI_W / 2, 112, { size: 22, align: 'center', color: '#b04848' });
    if (this.mode === 'press') {
      if (Math.floor(g.time * 1.5) % 2 === 0) p.text('Appuyez sur une touche', UI_W / 2, 250, { size: 20, align: 'center', color: p.t.dim });
      p.text('Clavier (ZQSD / WASD / flèches) ou manette', UI_W / 2, UI_H - 26, { size: 14, align: 'center', color: '#5a5852' });
      return;
    }
    if (this.mode === 'main' || this.mode === 'confirmNew') {
      const items = this.items();
      p.panel(UI_W / 2 - 110, 168, 220, 136, { alpha: 0.85 });
      p.list(items.map((it) => ({ label: it.label, disabled: it.disabled })), this.sel, UI_W / 2 - 90, 180, 180, { size: 19 });
      if (this.mode === 'confirmNew') {
        p.panel(UI_W / 2 - 200, 140, 400, 80, { solid: true });
        p.text('Commencer une nouvelle partie ?', UI_W / 2, 154, { size: 18, align: 'center' });
        p.text('Vos sauvegardes existantes ne seront pas effacées.', UI_W / 2, 176, { size: 14, align: 'center', color: p.t.dim });
        p.text('Entrée : oui · Échap : non', UI_W / 2, 196, { size: 14, align: 'center', color: p.t.accent });
      }
      if (this.message) p.text(this.message, UI_W / 2, 312, { size: 15, align: 'center', color: p.t.danger });
      if (g.endingsSeen.length) p.text(`Fins découvertes : ${g.endingsSeen.map((e) => ENDINGS[e as EndingId]?.title.replace('Fin — ', '') ?? e).join(', ')}`, UI_W / 2, UI_H - 24, { size: 14, align: 'center', color: p.t.dim });
      return;
    }
    p.panel(80, 128, UI_W - 160, 226, { solid: true, title: this.mode === 'load' ? 'Charger une partie' : this.mode === 'options' ? 'Options' : 'À propos' });
    if (this.mode === 'load') this.slots.render(p, g, 96, 160, UI_W - 192);
    else if (this.mode === 'options') this.options.render(p, g, 96, 158, UI_W - 192);
    else {
      const lines = [
        'VEILBOUND — Les Enfants du Brouillard.',
        'Un RPG d’exploration et de lien avec des créatures horrifiques originales.',
        'Graphismes, musiques et sons générés par le code du jeu.',
        'Police VT323 (licence SIL Open Font).',
        '',
        'Flèches/ZQSD : marcher · Maj : courir · Entrée/Espace : agir',
        'Échap : menu/retour · Q/R : changer d’onglet · Manette compatible.',
      ];
      lines.forEach((l, i) => p.text(l, 96, 162 + i * 20, { size: 15, color: i === 0 ? p.t.accent : p.t.text }));
    }
  }
}

export class EndingScene implements Scene {
  readonly kind = 'ending';
  opaque = true;
  private line = 0;
  private t = 0;
  private finished = false;

  constructor(
    g: Game,
    private id: EndingId,
  ) {
    g.audio.playMusic(id === 'brouillard' ? 'seuil' : 'fin');
    g.audio.ambience(id === 'brouillard' ? 'cendriers' : 'vent');
  }

  update(dt: number, g: Game): void {
    this.t += dt;
    const lines = ENDINGS[this.id].lines;
    if (g.input.consume('confirm') || this.t > 7 / g.anim) {
      if (this.finished) {
        g.backToTitle();
        return;
      }
      this.t = 0;
      this.line++;
      if (this.line >= lines.length) this.finished = true;
    }
  }

  renderWorld(w: CanvasRenderingContext2D, g: Game): void {
    drawFoggyStreet(w, g.time, this.id === 'brouillard');
    w.fillStyle = 'rgba(0,0,0,0.55)';
    w.fillRect(0, 0, WORLD_W, WORLD_H);
    if (this.id === 'memoire') {
      w.globalAlpha = 0.85;
      w.drawImage(creatureSprite('veilleuse', Math.floor(g.time * 2)), WORLD_W / 2 - 32, 20, 64, 64);
      w.globalAlpha = 1;
    }
  }

  renderUI(p: Painter, g: Game): void {
    const e = ENDINGS[this.id];
    p.text(e.title, UI_W / 2, 30, { size: 28, align: 'center', color: p.t.accent });
    const shown = e.lines.slice(0, Math.min(e.lines.length, this.line + 1));
    let y = 190;
    const visible = shown.slice(-3);
    visible.forEach((l, i) => {
      const a = i === visible.length - 1 && !this.finished ? Math.min(1, this.t * 1.5) : 0.55 + i * 0.15;
      for (const w of p.wrap(l, UI_W - 120, 18)) {
        p.text(w, UI_W / 2, y, { size: 18, align: 'center', alpha: a });
        y += 21;
      }
      y += 8;
    });
    if (this.finished) {
      p.text('FIN', UI_W / 2, UI_H - 60, { size: 30, align: 'center', color: '#b04848' });
      const s = g.state;
      if (s) {
        const bonded = Object.values(s.codex).filter((c) => c.bonded).length;
        const pac = Object.values(s.codex).filter((c) => c.pacified).length;
        p.text(`Rémanents liés : ${bonded} · apaisés : ${pac} · indices : ${s.clues.length}`, UI_W / 2, UI_H - 26, { size: 14, align: 'center', color: p.t.dim });
      }
    }
  }
}

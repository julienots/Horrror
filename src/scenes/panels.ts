import { formatTime } from '../core/clock';
import type { SlotId } from '../core/save';
import type { Options } from '../core/state';
import type { Game } from '../game';
import type { Painter } from '../ui/draw';

// Panneaux partagés entre le menu de pause et l'écran titre.

interface OptRow {
  label: string;
  value: (o: Options) => string;
  change: (o: Options, dir: number) => void;
  help: string;
}

const cycle = <T,>(list: readonly T[], cur: T, dir: number): T => list[(list.indexOf(cur) + dir + list.length) % list.length];
const pct = (v: number) => `${Math.round(v * 100)} %`;
const vol = (v: number, dir: number) => Math.max(0, Math.min(1, Math.round((v + dir * 0.1) * 10) / 10));

const ROWS: OptRow[] = [
  { label: 'Vitesse du texte', value: (o) => ({ lent: 'Lente', normal: 'Normale', rapide: 'Rapide', instantane: 'Instantanée' })[o.textSpeed], change: (o, d) => (o.textSpeed = cycle(['lent', 'normal', 'rapide', 'instantane'] as const, o.textSpeed, d)), help: 'Vitesse d’apparition des dialogues.' },
  { label: 'Vitesse des animations', value: (o) => `×${o.animSpeed}`, change: (o, d) => (o.animSpeed = cycle([1, 2, 4] as const, o.animSpeed, d)), help: 'Accélère les combats, fondus et transitions.' },
  { label: 'Musique', value: (o) => pct(o.musicVol), change: (o, d) => (o.musicVol = vol(o.musicVol, d)), help: 'Volume de la musique.' },
  { label: 'Effets', value: (o) => pct(o.sfxVol), change: (o, d) => (o.sfxVol = vol(o.sfxVol, d)), help: 'Volume des effets sonores et des cris.' },
  { label: 'Ambiance', value: (o) => pct(o.ambVol), change: (o, d) => (o.ambVol = vol(o.ambVol, d)), help: 'Volume des ambiances (vent, gouttes, bourdonnements).' },
  { label: 'Taille du texte', value: (o) => (o.textSize === 'grand' ? 'Grande' : 'Normale'), change: (o) => (o.textSize = o.textSize === 'grand' ? 'normal' : 'grand'), help: 'Agrandit tous les textes de l’interface.' },
  { label: 'Réduire les flashs', value: (o) => (o.reduceFlashes ? 'Oui' : 'Non'), change: (o) => (o.reduceFlashes = !o.reduceFlashes), help: 'Remplace les éclairs blancs par de légers assombrissements.' },
  { label: 'Réduire les secousses', value: (o) => (o.reduceShake ? 'Oui' : 'Non'), change: (o) => (o.reduceShake = !o.reduceShake), help: 'Désactive les tremblements d’écran.' },
  { label: 'Intensité horrifique', value: (o) => (o.horror === 'attenue' ? 'Atténuée' : 'Normale'), change: (o) => (o.horror = o.horror === 'attenue' ? 'normal' : 'attenue'), help: 'Atténuée : événements d’ambiance deux fois plus rares, sans flash.' },
  { label: 'Contraste élevé', value: (o) => (o.highContrast ? 'Oui' : 'Non'), change: (o) => (o.highContrast = !o.highContrast), help: 'Interface plus contrastée et opaque.' },
];

export class OptionsPanel {
  sel = 0;

  /** Retourne false si l'utilisateur quitte le panneau. */
  update(g: Game): boolean {
    const i = g.input;
    if (i.consume('up')) {
      this.sel = (this.sel + ROWS.length - 1) % ROWS.length;
      g.audio.sfx('menu');
    }
    if (i.consume('down')) {
      this.sel = (this.sel + 1) % ROWS.length;
      g.audio.sfx('menu');
    }
    const dir = i.consume('left') ? -1 : i.consume('right') || i.consume('confirm') ? 1 : 0;
    if (dir) {
      ROWS[this.sel].change(g.options, dir);
      g.saveOptions();
      g.audio.sfx('menu');
    }
    if (i.consume('cancel')) {
      g.audio.sfx('cancel');
      return false;
    }
    return true;
  }

  render(p: Painter, g: Game, x: number, y: number, w: number): void {
    const lh = p.lineH(16) + 6;
    ROWS.forEach((r, i) => {
      const yy = y + i * lh;
      if (i === this.sel) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(x - 4, yy - 2, w + 8, lh);
      }
      p.text(r.label, x + 8, yy, { size: 16, color: i === this.sel ? p.t.accent : p.t.text });
      p.text(`‹ ${r.value(g.options)} ›`, x + w, yy, { size: 16, align: 'right', color: i === this.sel ? p.t.accent : p.t.dim });
    });
    p.wrap(ROWS[this.sel].help, w, 14).forEach((l, i) => p.text(l, x + 8, y + ROWS.length * lh + 8 + i * 15, { size: 14, color: p.t.dim }));
  }
}

export function slotLabel(slot: SlotId): string {
  return slot === 'auto' ? 'Sauvegarde automatique' : `Emplacement ${slot.slice(-1)}`;
}

export function playTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Liste d'emplacements (chargement ou sauvegarde). */
export class SlotsPanel {
  sel = 0;
  message = '';
  confirmOverwrite = false;

  constructor(
    private mode: 'load' | 'save',
    private slots: SlotId[],
  ) {}

  update(g: Game, onLoad: (slot: SlotId) => void): boolean {
    const i = g.input;
    if (this.confirmOverwrite) {
      if (i.consume('confirm')) {
        this.confirmOverwrite = false;
        const r = g.saveTo(this.slots[this.sel]);
        this.message = r.message;
        g.audio.sfx(r.ok ? 'objet' : 'echec');
      } else if (i.consume('cancel')) {
        this.confirmOverwrite = false;
        this.message = '';
      }
      return true;
    }
    if (i.consume('up')) {
      this.sel = (this.sel + this.slots.length - 1) % this.slots.length;
      g.audio.sfx('menu');
      this.message = '';
    }
    if (i.consume('down')) {
      this.sel = (this.sel + 1) % this.slots.length;
      g.audio.sfx('menu');
      this.message = '';
    }
    if (i.consume('confirm')) {
      const slot = this.slots[this.sel];
      const sum = g.store.summary(slot);
      if (this.mode === 'load') {
        if (!sum) {
          g.audio.sfx('echec');
          this.message = 'Emplacement vide.';
        } else onLoad(slot);
      } else {
        if (!g.canSave()) {
          this.message = 'Impossible de sauvegarder maintenant.';
          g.audio.sfx('echec');
        } else if (sum) this.confirmOverwrite = true;
        else {
          const r = g.saveTo(slot);
          this.message = r.message;
          g.audio.sfx(r.ok ? 'objet' : 'echec');
        }
      }
    }
    if (i.consume('cancel')) {
      g.audio.sfx('cancel');
      return false;
    }
    return true;
  }

  render(p: Painter, g: Game, x: number, y: number, w: number): void {
    this.slots.forEach((slot, i) => {
      const yy = y + i * 50;
      const sum = g.store.summary(slot);
      if (i === this.sel) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(x - 4, yy - 2, w + 8, 48);
      }
      p.text(slotLabel(slot), x + 8, yy, { size: 17, color: i === this.sel ? p.t.accent : p.t.text });
      if (sum) {
        const d = new Date(sum.savedAt);
        p.text(`${sum.zoneName} · jour ${sum.day} · ${playTime(sum.playSeconds)}`, x + 8, yy + 17, { size: 14, color: p.t.dim });
        p.text(`Équipe : niv. ${sum.teamLevels.join(', ') || '—'}${sum.recovered ? ' · récupérée' : ''}`, x + 8, yy + 30, { size: 13, color: p.t.dim });
        p.text(`${d.toLocaleDateString('fr-FR')} ${formatTime(d.getHours() * 60 + d.getMinutes())}`, x + w, yy + 2, { size: 13, align: 'right', color: p.t.dim });
      } else p.text('— vide —', x + 8, yy + 18, { size: 14, color: '#5a5852' });
    });
    if (this.confirmOverwrite) p.text('Écraser cette sauvegarde ? (Entrée : oui · Échap : non)', x + 8, y + this.slots.length * 50 + 4, { size: 15, color: p.t.danger });
    else if (this.message) p.text(this.message, x + 8, y + this.slots.length * 50 + 4, { size: 15, color: p.t.accent });
  }
}

import { ABILITIES } from '../data/abilities';
import { AFFINITIES } from '../data/affinities';
import { COLLECTION_ORDER, CREATURES } from '../data/creatures';
import { ITEMS } from '../data/items';
import { PASSIVES } from '../data/statuses';
import type { ItemCategory } from '../data/types';
import { ZONES, ZONE_LIST } from '../data/zones';
import type { CreatureInstance } from '../core/state';
import { RELIQUARY_MAX, TEAM_MAX } from '../core/state';
import { evalCondition } from '../systems/conditions';
import { depositToReliquary, gainXp, maxEnergy, maxHp, setActiveAbilities, speciesOf, statOf, swapWithReliquary, xpForLevel } from '../systems/creatures';
import { CATEGORY_LABEL, equipItem, itemsByCategory, removeItem, unequipItem, useItemOn } from '../systems/inventory';
import { journalView, keyClueCount } from '../systems/quests';
import { readDocument } from '../systems/script';
import type { Game, Scene } from '../game';
import { creatureIcon, creatureSilhouette, creatureSprite } from '../render/creatures';
import { UI_H, UI_W, type Painter, scrollFor } from '../ui/draw';
import { OptionsPanel, SlotsPanel, playTime } from './panels';
import { DialogueScene } from './dialogue';
import { TRUTH_THRESHOLD } from '../data/story';

type Tab = 'equipe' | 'collection' | 'sac' | 'journal' | 'carte' | 'options' | 'sauver' | 'titre';
const TABS: Array<[Tab, string]> = [
  ['equipe', 'Équipe'],
  ['collection', 'Collection'],
  ['sac', 'Sac'],
  ['journal', 'Journal'],
  ['carte', 'Carte'],
  ['options', 'Options'],
  ['sauver', 'Sauvegarder'],
  ['titre', 'Retour au titre'],
];

type Sub =
  | { kind: 'teamActions'; index: number; sel: number }
  | { kind: 'abilities'; index: number; sel: number }
  | { kind: 'equip'; index: number; sel: number }
  | { kind: 'reliquary'; index: number; sel: number; scroll: number }
  | { kind: 'itemActions'; item: string; sel: number }
  | { kind: 'itemTarget'; item: string; mode: 'use' | 'equip'; sel: number }
  | { kind: 'confirmTitle' };

export class MenuScene implements Scene {
  readonly kind = 'menu';
  opaque = false;
  private tab = 0;
  private inContent = false;
  private sel = 0;
  private scroll = 0;
  private sub: Sub | null = null;
  private bagCat = 0;
  private journalSec = 0;
  private options = new OptionsPanel();
  private slots = new SlotsPanel('save', ['slot1', 'slot2', 'slot3']);
  private note = '';

  constructor(private g: Game) {}

  private get s() {
    return this.g.state!;
  }

  update(_dt: number, g: Game): void {
    const i = g.input;
    if (!this.inContent) {
      if (i.consume('up')) {
        this.tab = (this.tab + TABS.length - 1) % TABS.length;
        g.audio.sfx('menu');
      }
      if (i.consume('down')) {
        this.tab = (this.tab + 1) % TABS.length;
        g.audio.sfx('menu');
      }
      if (i.consume('confirm') || i.consume('right')) {
        g.audio.sfx('confirm');
        this.inContent = true;
        this.sel = 0;
        this.scroll = 0;
        this.note = '';
        if (TABS[this.tab][0] === 'titre') this.sub = { kind: 'confirmTitle' };
      }
      if (i.consume('cancel') || i.consume('menu')) {
        g.audio.sfx('cancel');
        g.pop(this);
      }
      return;
    }
    if (i.consume('tabPrev')) return this.switchTab(-1);
    if (i.consume('tabNext')) return this.switchTab(1);
    if (this.sub) return this.updateSub(g);
    switch (TABS[this.tab][0]) {
      case 'equipe':
        return this.updateTeam(g);
      case 'collection':
        return this.updateList(g, COLLECTION_ORDER.length, 8);
      case 'sac':
        return this.updateBag(g);
      case 'journal':
        return this.updateJournal(g);
      case 'carte':
        if (i.consume('cancel') || i.consume('confirm')) this.leave();
        return;
      case 'options':
        if (!this.options.update(g)) this.leave(false);
        return;
      case 'sauver':
        if (!this.slots.update(g, () => undefined)) this.leave(false);
        return;
    }
  }

  private switchTab(d: number): void {
    this.tab = (this.tab + d + TABS.length) % TABS.length;
    this.sel = 0;
    this.scroll = 0;
    this.sub = TABS[this.tab][0] === 'titre' ? { kind: 'confirmTitle' } : null;
    this.g.audio.sfx('menu');
  }

  private leave(sound = true): void {
    if (sound) this.g.audio.sfx('cancel');
    this.inContent = false;
    this.sub = null;
  }

  private updateList(g: Game, n: number, visible: number): void {
    const i = g.input;
    if (n === 0) {
      if (i.consume('cancel') || i.consume('confirm')) this.leave();
      return;
    }
    if (i.consume('up')) this.sel = (this.sel + n - 1) % n;
    if (i.consume('down')) this.sel = (this.sel + 1) % n;
    this.scroll = scrollFor(this.sel, visible, this.scroll);
    if (i.consume('cancel')) this.leave();
  }

  // ------------------------------------------------------------ Équipe

  private updateTeam(g: Game): void {
    const n = this.s.team.length;
    const i = g.input;
    if (i.consume('confirm') && n) {
      g.audio.sfx('confirm');
      this.sub = { kind: 'teamActions', index: this.sel, sel: 0 };
      return;
    }
    this.updateList(g, n, 4);
  }

  private teamActions(index: number): Array<{ id: string; label: string; disabled?: boolean }> {
    const c = this.s.team[index];
    return [
      { id: 'capacites', label: 'Capacités actives' },
      { id: 'objet', label: c?.equip ? `Objet tenu : ${ITEMS[c.equip].name}` : 'Donner un objet à tenir' },
      { id: 'fragment', label: 'Utiliser un Fragment de mémoire', disabled: !this.s.inventory.fragment_memoire },
      { id: 'tete', label: 'Mettre en tête de l’équipe', disabled: index === 0 },
      { id: 'reliquaire', label: 'Échanger avec le Reliquaire', disabled: this.s.reliquary.length === 0 },
      { id: 'deposer', label: 'Déposer au Reliquaire', disabled: this.s.team.length <= 1 || this.s.reliquary.length >= RELIQUARY_MAX },
    ];
  }

  private updateSub(g: Game): void {
    const i = g.input;
    const sub = this.sub!;
    const nav = (n: number) => {
      if (n <= 0) return;
      if (i.consume('up')) (sub as { sel: number }).sel = ((sub as { sel: number }).sel + n - 1) % n;
      if (i.consume('down')) (sub as { sel: number }).sel = ((sub as { sel: number }).sel + 1) % n;
    };
    switch (sub.kind) {
      case 'confirmTitle':
        if (i.consume('confirm')) {
          g.audio.sfx('confirm');
          g.backToTitle();
        } else if (i.consume('cancel')) this.leave();
        return;
      case 'teamActions': {
        const acts = this.teamActions(sub.index);
        nav(acts.length);
        if (i.consume('cancel')) {
          this.sub = null;
          g.audio.sfx('cancel');
          return;
        }
        if (i.consume('confirm')) {
          const a = acts[sub.sel];
          if (a.disabled) return g.audio.sfx('echec');
          g.audio.sfx('confirm');
          const c = this.s.team[sub.index];
          if (a.id === 'capacites') this.sub = { kind: 'abilities', index: sub.index, sel: 0 };
          else if (a.id === 'objet') this.sub = { kind: 'equip', index: sub.index, sel: 0 };
          else if (a.id === 'fragment') {
            removeItem(this.s, 'fragment_memoire', 1);
            const r = gainXp(c, 120);
            this.note = `${speciesOf(c).name} absorbe le souvenir.${r.levels.length ? ` Niveau ${c.level} !` : ''}`;
            g.audio.sfx(r.levels.length ? 'niveau' : 'soin');
            this.sub = null;
          } else if (a.id === 'tete') {
            const [x] = this.s.team.splice(sub.index, 1);
            this.s.team.unshift(x);
            this.sel = 0;
            this.sub = null;
          } else if (a.id === 'reliquaire') this.sub = { kind: 'reliquary', index: sub.index, sel: 0, scroll: 0 };
          else if (a.id === 'deposer') {
            if (depositToReliquary(this.s, sub.index)) this.note = `${speciesOf(c).name} rejoint le Reliquaire.`;
            this.sel = 0;
            this.sub = null;
          }
        }
        return;
      }
      case 'abilities': {
        const c = this.s.team[sub.index];
        nav(c.known.length);
        if (i.consume('cancel')) {
          this.sub = { kind: 'teamActions', index: sub.index, sel: 0 };
          return;
        }
        if (i.consume('confirm')) {
          const id = c.known[sub.sel];
          const active = c.abilities.includes(id);
          const next = active ? c.abilities.filter((a) => a !== id) : [...c.abilities, id];
          if (next.length > 4) this.note = 'Quatre capacités actives au maximum.';
          else if (!setActiveAbilities(c, next)) this.note = 'Il faut au moins une capacité active.';
          else this.note = '';
          g.audio.sfx('menu');
        }
        return;
      }
      case 'equip': {
        const c = this.s.team[sub.index];
        const opts = this.equipOptions(c);
        nav(opts.length);
        if (i.consume('cancel')) {
          this.sub = { kind: 'teamActions', index: sub.index, sel: 1 };
          return;
        }
        if (i.consume('confirm')) {
          const id = opts[sub.sel];
          const r = id === '__retirer' ? unequipItem(this.s, c) : equipItem(this.s, c, id);
          this.note = r.message;
          g.audio.sfx(r.ok ? 'confirm' : 'echec');
          this.sub = { kind: 'teamActions', index: sub.index, sel: 1 };
        }
        return;
      }
      case 'reliquary': {
        const n = this.s.reliquary.length;
        nav(n);
        sub.scroll = scrollFor(sub.sel, 6, sub.scroll);
        if (i.consume('cancel')) {
          this.sub = { kind: 'teamActions', index: sub.index, sel: 4 };
          return;
        }
        if (i.consume('confirm') && n) {
          if (swapWithReliquary(this.s, sub.index, sub.sel)) this.note = 'Échange effectué.';
          g.audio.sfx('confirm');
          this.sub = null;
        }
        return;
      }
      case 'itemActions': {
        const acts = this.itemActions(sub.item);
        nav(acts.length);
        if (i.consume('cancel')) {
          this.sub = null;
          return;
        }
        if (i.consume('confirm')) {
          const a = acts[sub.sel];
          if (a.disabled) return g.audio.sfx('echec');
          if (a.id === 'lire') {
            const r = readDocument(this.s, sub.item);
            g.push(new DialogueScene(r.text, '', 'neutre', () => (r.clueMsg ? g.toast(r.clueMsg) : undefined)));
            if (r.clueMsg) g.audio.sfx('indice');
            this.sub = null;
          } else if (a.id === 'utiliser') {
            const def = ITEMS[sub.item];
            if (def.effect?.kind === 'repel') {
              const r = useItemOn(this.s, sub.item, undefined, 'exploration');
              this.note = r.message;
              this.sub = null;
            } else if (def.effect?.kind === 'xp') this.sub = { kind: 'itemTarget', item: sub.item, mode: 'use', sel: 0 };
            else this.sub = { kind: 'itemTarget', item: sub.item, mode: 'use', sel: 0 };
          } else if (a.id === 'equiper') this.sub = { kind: 'itemTarget', item: sub.item, mode: 'equip', sel: 0 };
        }
        return;
      }
      case 'itemTarget': {
        nav(this.s.team.length);
        if (i.consume('cancel')) {
          this.sub = { kind: 'itemActions', item: sub.item, sel: 0 };
          return;
        }
        if (i.consume('confirm')) {
          const c = this.s.team[sub.sel];
          const def = ITEMS[sub.item];
          let msg: string;
          let ok: boolean;
          if (sub.mode === 'equip') ({ message: msg, ok } = equipItem(this.s, c, sub.item));
          else if (def.effect?.kind === 'xp') {
            removeItem(this.s, sub.item, 1);
            const r = gainXp(c, def.effect.amount);
            ok = true;
            msg = `${speciesOf(c).name} absorbe le souvenir.${r.levels.length ? ` Niveau ${c.level} !` : ''}`;
          } else ({ message: msg, ok } = useItemOn(this.s, sub.item, c, 'exploration'));
          this.note = msg;
          g.audio.sfx(ok ? 'soin' : 'echec');
          if (!this.s.inventory[sub.item]) this.sub = null;
        }
        return;
      }
    }
  }

  private equipOptions(c: CreatureInstance): string[] {
    const list = Object.keys(this.s.inventory).filter((id) => ITEMS[id]?.equip);
    if (c.equip) list.unshift('__retirer');
    return list;
  }

  // ------------------------------------------------------------ Sac

  private bagCats(): Array<[ItemCategory, Array<[string, number]>]> {
    return itemsByCategory(this.s);
  }

  private updateBag(g: Game): void {
    const cats = this.bagCats();
    const i = g.input;
    if (!cats.length) {
      if (i.consume('cancel') || i.consume('confirm')) this.leave();
      return;
    }
    if (this.bagCat >= cats.length) this.bagCat = 0;
    if (i.consume('left')) {
      this.bagCat = (this.bagCat + cats.length - 1) % cats.length;
      this.sel = 0;
      g.audio.sfx('menu');
    }
    if (i.consume('right')) {
      this.bagCat = (this.bagCat + 1) % cats.length;
      this.sel = 0;
      g.audio.sfx('menu');
    }
    const items = cats[this.bagCat][1];
    if (i.consume('confirm') && items[this.sel]) {
      g.audio.sfx('confirm');
      this.sub = { kind: 'itemActions', item: items[this.sel][0], sel: 0 };
      return;
    }
    this.updateList(g, items.length, 9);
  }

  private itemActions(id: string): Array<{ id: string; label: string; disabled?: boolean }> {
    const def = ITEMS[id];
    const out: Array<{ id: string; label: string; disabled?: boolean }> = [];
    if (def.document) out.push({ id: 'lire', label: def.category === 'document' && id.startsWith('cassette') ? 'Écouter' : 'Lire' });
    if (def.usableIn?.includes('exploration')) out.push({ id: 'utiliser', label: 'Utiliser' });
    if (def.equip) out.push({ id: 'equiper', label: 'Faire tenir' });
    if (!out.length) out.push({ id: 'rien', label: 'Rien à faire maintenant', disabled: true });
    return out;
  }

  // ------------------------------------------------------------ Journal

  private updateJournal(g: Game): void {
    const i = g.input;
    if (i.consume('left')) {
      this.journalSec = (this.journalSec + 3) % 4;
      this.sel = 0;
      this.scroll = 0;
      g.audio.sfx('menu');
    }
    if (i.consume('right')) {
      this.journalSec = (this.journalSec + 1) % 4;
      this.sel = 0;
      this.scroll = 0;
      g.audio.sfx('menu');
    }
    const j = journalView(this.s, (c) => evalCondition(this.s, c));
    const n = [j.active.length, j.clues.length, j.leads.length, j.done.length][this.journalSec];
    this.updateList(g, n, 5);
  }

  // ------------------------------------------------------------ Rendu

  renderUI(p: Painter, g: Game): void {
    p.ctx.fillStyle = 'rgba(0,0,0,0.55)';
    p.ctx.fillRect(0, 0, UI_W, UI_H);
    p.panel(10, 10, 150, UI_H - 20, { solid: true });
    p.text('VEILBOUND', 85, 18, { size: 20, align: 'center', color: p.t.accent });
    p.list(TABS.map(([, l]) => ({ label: l })), this.tab, 22, 48, 126, { size: 17 });
    const s = this.s;
    p.text(`Jour ${s.day}`, 22, UI_H - 66, { size: 14, color: p.t.dim });
    p.text(`Temps : ${playTime(s.playSeconds)}`, 22, UI_H - 50, { size: 14, color: p.t.dim });
    p.text(`Lumière ${s.morality.light} · Ombre ${s.morality.shadow}`, 22, UI_H - 34, { size: 13, color: p.t.dim });
    const x = 170;
    const y = 10;
    const w = UI_W - 180;
    const h = UI_H - 20;
    p.panel(x, y, w, h, { title: TABS[this.tab][1], solid: true });
    const cx = x + 14;
    const cy = y + 32;
    const cw = w - 28;
    switch (TABS[this.tab][0]) {
      case 'equipe':
        this.renderTeam(p, cx, cy, cw);
        break;
      case 'collection':
        this.renderCollection(p, cx, cy, cw);
        break;
      case 'sac':
        this.renderBag(p, cx, cy, cw);
        break;
      case 'journal':
        this.renderJournal(p, cx, cy, cw);
        break;
      case 'carte':
        this.renderMap(p, cx, cy, cw, h - 44);
        break;
      case 'options':
        this.options.render(p, g, cx, cy + 4, cw);
        break;
      case 'sauver':
        if (!g.canSave()) p.text('Impossible de sauvegarder pendant une transition.', cx, cy + 250, { size: 14, color: p.t.danger });
        this.slots.render(p, g, cx, cy + 6, cw);
        break;
      case 'titre':
        p.text('Retourner à l’écran titre ?', cx, cy + 10, { size: 18 });
        p.text('La progression depuis la dernière sauvegarde sera perdue.', cx, cy + 34, { size: 15, color: p.t.dim });
        p.text('Entrée : confirmer · Échap : annuler', cx, cy + 62, { size: 15, color: p.t.accent });
        break;
    }
    if (this.note) p.text(this.note, x + 12, y + h - 22, { size: 14, color: p.t.accent });
    if (!this.inContent) p.text('Entrée : ouvrir · Échap : fermer', x + w - 12, y + h - 22, { size: 13, align: 'right', color: p.t.dim });
    else p.text('Q/R : onglets · Échap : retour', x + w - 12, y + h - 22, { size: 13, align: 'right', color: p.t.dim });
  }

  private renderTeam(p: Painter, x: number, y: number, w: number): void {
    const team = this.s.team;
    if (!team.length) {
      p.text('Aucun Rémanent ne vous accompagne.', x, y, { size: 16, color: p.t.dim });
      return;
    }
    const lw = 210;
    team.forEach((c, i) => {
      const yy = y + i * 64;
      if (this.inContent && i === this.sel) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(x - 4, yy - 2, lw + 8, 60);
      }
      p.image(creatureIcon(c.species, Math.floor(this.g.time * 2)), x, yy + 4, 40, 40);
      p.text(speciesOf(c).name, x + 46, yy, { size: 16, color: c.hp > 0 ? p.t.text : p.t.danger });
      p.text(`Niv. ${c.level}`, x + lw, yy, { size: 14, align: 'right', color: p.t.dim });
      p.bar(x + 46, yy + 20, lw - 46, 6, c.hp, maxHp(c), p.hpColor(c.hp, maxHp(c)));
      p.text(c.hp > 0 ? `${c.hp}/${maxHp(c)} PV` : 'Dissipé', x + 46, yy + 28, { size: 13, color: p.t.dim });
      p.text(`${'♥'.repeat(c.bond)}${'♡'.repeat(5 - c.bond)}`, x + lw, yy + 28, { size: 13, align: 'right', color: '#b05a5a' });
      p.bar(x + 46, yy + 46, lw - 46, 2, c.xp - xpForLevel(c.level), xpForLevel(c.level + 1) - xpForLevel(c.level), '#8a7aa8');
    });
    p.text(`${team.length}/${TEAM_MAX} · Reliquaire : ${this.s.reliquary.length}`, x, y + 4 * 64 + 4, { size: 13, color: p.t.dim });
    // Détail
    const c = team[Math.min(this.sel, team.length - 1)];
    const dx = x + lw + 24;
    const dw = w - lw - 24;
    const def = speciesOf(c);
    p.image(creatureSprite(c.species, Math.floor(this.g.time * 2)), dx - 6, y - 8, 76, 76);
    let ax = dx + 72;
    p.text(def.name, ax, y, { size: 17, color: p.t.accent });
    for (const a of def.affinities) ax += p.chip(AFFINITIES[a].name, ax, y + 21, AFFINITIES[a].color, 12) + 4;
    p.text(`Énergie ${c.energy}/${maxEnergy(c)}`, dx + 72, y + 42, { size: 13, color: '#8aa0c8' });
    const stats: Array<[string, number]> = [['PV', maxHp(c)], ['ATQ', statOf(c, 'atk')], ['DÉF', statOf(c, 'def')], ['PSY', statOf(c, 'psy')], ['VIT', statOf(c, 'vit')]];
    stats.forEach(([k, v], i) => p.text(`${k} ${v}`, dx + (i % 3) * Math.floor(dw / 3), y + 72 + Math.floor(i / 3) * 16, { size: 14 }));
    const pas = PASSIVES[def.passive];
    let ly = y + 108;
    p.text(`Passif — ${pas.name}`, dx, ly, { size: 15, color: p.t.accent });
    ly += 17;
    for (const l of p.wrap(pas.description, dw, 13).slice(0, 2)) {
      p.text(l, dx, ly, { size: 13, color: p.t.dim });
      ly += 14;
    }
    p.text(`Objet : ${c.equip ? ITEMS[c.equip].name : '—'}`, dx, ly + 4, { size: 14 });
    ly += 24;
    p.text('Capacités :', dx, ly, { size: 14, color: p.t.dim });
    ly += 16;
    c.abilities.forEach((a, i) => p.text(`• ${ABILITIES[a]?.name ?? a}`, dx + 4, ly + i * 15, { size: 14 }));
    ly += Math.max(1, c.abilities.length) * 15 + 6;
    if (def.transform) {
      const t = def.transform;
      const req = [t.level ? `niv. ${t.level}` : '', t.bondLevel ? `lien ${t.bondLevel}` : ''].filter(Boolean).join(', ');
      for (const l of p.wrap(`Quelque chose sommeille en lui… (${req})`, dw, 13)) {
        p.text(l, dx, ly, { size: 13, color: '#9a8ab0' });
        ly += 14;
      }
    }
    if (def.fieldSkill) {
      const fs = { eclairer: 'éclaire les lieux sombres', glisser: 'se glisse dans les fissures', bruler: 'brûle les ronces', ecouter: 'entend à travers les murs' }[def.fieldSkill];
      for (const l of p.wrap(`Hors combat : ${fs}`, dw, 13)) {
        p.text(l, dx, ly, { size: 13, color: p.t.good });
        ly += 14;
      }
    }
    // Sous-menus
    const sub = this.sub;
    if (!sub) return;
    const bx = dx;
    const by = y + 120;
    const bw = dw;
    if (sub.kind === 'teamActions') {
      p.panel(bx - 8, by - 8, bw + 16, 140, { solid: true });
      p.list(this.teamActions(sub.index).map((a) => ({ label: a.label, disabled: a.disabled })), sub.sel, bx, by, bw - 10, { size: 15 });
    } else if (sub.kind === 'abilities') {
      const cc = team[sub.index];
      p.panel(bx - 8, by - 8, bw + 16, 150, { solid: true, title: 'Capacités (4 max)' });
      const items = cc.known.map((a) => ({ label: `${cc.abilities.includes(a) ? '■' : '□'} ${ABILITIES[a]?.name ?? a}`, right: `EN ${ABILITIES[a]?.cost ?? 0}` }));
      const sc = scrollFor(sub.sel, 6, 0);
      p.list(items, sub.sel, bx, by + 22, bw - 10, { size: 14, scroll: sc, visible: 6 });
    } else if (sub.kind === 'equip') {
      const cc = team[sub.index];
      const opts = this.equipOptions(cc);
      p.panel(bx - 8, by - 8, bw + 16, 120, { solid: true, title: 'Objet à tenir' });
      if (!opts.length) p.text('Aucun objet à tenir.', bx, by + 24, { size: 14, color: p.t.dim });
      p.list(opts.map((id) => ({ label: id === '__retirer' ? 'Retirer l’objet' : ITEMS[id].name, right: id === '__retirer' ? '' : ITEMS[id].equip?.desc })), sub.sel, bx, by + 22, bw - 10, { size: 14 });
    } else if (sub.kind === 'reliquary') {
      p.panel(bx - 8, by - 40, bw + 16, 180, { solid: true, title: 'Reliquaire' });
      p.list(this.s.reliquary.map((r) => ({ label: speciesOf(r).name, right: `niv. ${r.level}` })), sub.sel, bx, by - 10, bw - 10, { size: 14, scroll: sub.scroll, visible: 6 });
    }
  }

  private renderCollection(p: Painter, x: number, y: number, w: number): void {
    const s = this.s;
    const ids = COLLECTION_ORDER;
    const seen = ids.filter((id) => s.codex[id]?.seen).length;
    const bonded = ids.filter((id) => s.codex[id]?.bonded).length;
    const pac = ids.filter((id) => s.codex[id]?.pacified).length;
    p.text(`Vus ${seen}/${ids.length} · Liés ${bonded} · Apaisés ${pac}`, x, y, { size: 14, color: p.t.dim });
    const lw = 190;
    const items = ids.map((id, i) => {
      const e = s.codex[id];
      const mark = e?.bonded ? ' ★' : e?.pacified ? ' ✿' : '';
      return { label: e?.seen ? `${String(i + 1).padStart(2, '0')} ${CREATURES[id].name}${mark}` : `${String(i + 1).padStart(2, '0')} ???`, color: e?.seen ? undefined : '#5a5852' };
    });
    p.list(items, this.inContent ? this.sel : -1, x, y + 22, lw, { size: 14, scroll: this.scroll, visible: 13 });
    const id = ids[this.sel];
    const def = CREATURES[id];
    const e = s.codex[id];
    const dx = x + lw + 24;
    const dw = w - lw - 24;
    if (!e?.seen) {
      p.text('Jamais rencontré.', dx, y + 30, { size: 16, color: p.t.dim });
      return;
    }
    const known = e.bonded || e.pacified;
    p.image(known || e.defeated ? creatureSprite(id, Math.floor(this.g.time * 2)) : creatureSilhouette(id, '#2a2836'), dx, y + 16, 112, 112);
    let ax = dx + 120;
    p.text(def.name, ax, y + 20, { size: 18, color: p.t.accent });
    for (const a of def.affinities) ax += p.chip(AFFINITIES[a].name, ax, y + 42, AFFINITIES[a].color, 12) + 4;
    p.text(`Rareté : ${def.rarity}`, dx + 120, y + 62, { size: 13, color: p.t.dim });
    p.text(`Vaincu ${e.defeated} · Repoussé ${e.repelled}`, dx + 120, y + 78, { size: 13, color: p.t.dim });
    let ly = y + 136;
    const para = (t: string, color = p.t.text) => {
      for (const l of p.wrap(t, dw, 13)) {
        if (ly > y + 280) return;
        p.text(l, dx, ly, { size: 13, color });
        ly += 14;
      }
      ly += 4;
    };
    para(def.silhouette, p.t.dim);
    if (e.observed >= 1) para(`Signe : ${def.signs.tell}`);
    if (e.observed >= 2) para(`Peur : ${def.signs.fear}.`);
    if (e.observed >= 3) para(`Désir : ${def.signs.desire}.`);
    if (e.observed >= 1 || known) {
      const b = def.bond;
      para(b.kind === 'pacte' ? 'Lien : un fil rouge sur une forme affaiblie.' : b.kind === 'offrande' ? `Lien : ${b.hint}` : b.kind === 'choix' ? 'Lien : il attend une réponse, pas un combat.' : `Lien : ${b.reason}`, '#9ab0c0');
    }
    if (known || e.observed >= 3) para(def.lore, '#c9c3b5');
  }

  private renderBag(p: Painter, x: number, y: number, w: number): void {
    const cats = this.bagCats();
    if (!cats.length) {
      p.text('Votre sac est vide.', x, y, { size: 16, color: p.t.dim });
      return;
    }
    if (this.bagCat >= cats.length) this.bagCat = 0;
    let tx = x;
    cats.forEach(([cat], i) => {
      const label = CATEGORY_LABEL[cat];
      const lw = p.measure(label, 14) + 12;
      if (i === this.bagCat) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(tx - 2, y - 2, lw, 18);
      }
      p.text(label, tx + 4, y, { size: 14, color: i === this.bagCat ? p.t.accent : p.t.dim });
      tx += lw + 4;
    });
    const items = cats[this.bagCat][1];
    const lw = 220;
    p.list(items.map(([id, n]) => ({ label: ITEMS[id].name, right: ITEMS[id].unique ? '' : `×${n}` })), this.inContent ? this.sel : -1, x, y + 26, lw, { size: 15, scroll: this.scroll, visible: 9 });
    const sel = items[Math.min(this.sel, items.length - 1)];
    if (!sel) return;
    const def = ITEMS[sel[0]];
    const dx = x + lw + 24;
    const dw = w - lw - 24;
    p.text(def.name, dx, y + 26, { size: 17, color: p.t.accent });
    let ly = y + 48;
    for (const l of p.wrap(def.description, dw, 14)) {
      p.text(l, dx, ly, { size: 14 });
      ly += 15;
    }
    if (def.equip) p.text(`À tenir : ${def.equip.desc}`, dx, ly + 6, { size: 13, color: p.t.good });
    if (def.requirement) p.text(`Prérequis : ${def.requirement}`, dx, ly + 22, { size: 13, color: p.t.danger });
    if (def.document) p.text(this.s.readDocs.includes(sel[0]) ? 'Déjà lu.' : 'Pas encore lu.', dx, ly + 40, { size: 13, color: p.t.dim });
    const sub = this.sub;
    if (sub?.kind === 'itemActions') {
      p.panel(dx - 8, y + 170, dw + 16, 80, { solid: true });
      p.list(this.itemActions(sub.item).map((a) => ({ label: a.label, disabled: a.disabled })), sub.sel, dx, y + 180, dw - 10, { size: 15 });
    } else if (sub?.kind === 'itemTarget') {
      p.panel(dx - 8, y + 150, dw + 16, 110, { solid: true, title: sub.mode === 'equip' ? 'Faire tenir à…' : 'Utiliser sur…' });
      p.list(this.s.team.map((c) => ({ label: speciesOf(c).name, right: c.hp > 0 ? `${c.hp}/${maxHp(c)}` : 'dissipé' })), sub.sel, dx, y + 176, dw - 10, { size: 14 });
    }
  }

  private renderJournal(p: Painter, x: number, y: number, w: number): void {
    const s = this.s;
    const j = journalView(s, (c) => evalCondition(s, c));
    const secs = ['Objectifs', 'Indices', 'Pistes', 'Terminées'];
    let tx = x;
    secs.forEach((label, i) => {
      const lw = p.measure(label, 15) + 14;
      if (i === this.journalSec) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(tx - 2, y - 2, lw, 19);
      }
      p.text(label, tx + 5, y, { size: 15, color: i === this.journalSec ? p.t.accent : p.t.dim });
      tx += lw + 6;
    });
    p.text(`Preuves clés : ${keyClueCount(s)}/${TRUTH_THRESHOLD}`, x + w, y, { size: 13, align: 'right', color: '#9ab0c0' });
    const entries: Array<{ title: string; body: string; color?: string }> =
      this.journalSec === 0
        ? j.active.map((q) => ({ title: `${q.main ? '◆ ' : ''}${q.name}`, body: q.objective }))
        : this.journalSec === 1
          ? j.clues.map((c) => ({ title: `${c.key ? '✦ ' : ''}${c.eaten ? '[effacé]' : c.name}`, body: c.eaten ? 'Les lignes se sont vidées. Quelque chose les a mangées.' : c.text, color: c.eaten ? '#6a6a6a' : undefined }))
          : this.journalSec === 2
            ? j.leads.map((l) => ({ title: 'Piste non résolue', body: l.text }))
            : j.done.map((q) => ({ title: q.name, body: 'Terminée.' }));
    if (!entries.length) {
      p.text('Rien pour l’instant.', x, y + 30, { size: 15, color: p.t.dim });
      return;
    }
    let ly = y + 28;
    for (let i = this.scroll; i < entries.length && ly < y + 270; i++) {
      const e = entries[i];
      const selected = this.inContent && i === this.sel;
      const lines = p.wrap(e.body, w - 20, 14);
      const hgt = 20 + lines.length * 15;
      if (selected) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(x - 4, ly - 2, w + 8, hgt);
      }
      p.text(e.title, x + 4, ly, { size: 15, color: e.color ?? (selected ? p.t.accent : p.t.text) });
      lines.forEach((l, k) => p.text(l, x + 14, ly + 18 + k * 15, { size: 14, color: e.color ?? p.t.dim }));
      ly += hgt + 6;
    }
  }

  private renderMap(p: Painter, x: number, y: number, w: number, h: number): void {
    const s = this.s;
    const ext = ZONE_LIST.filter((z) => z.mapPos);
    const cell = Math.min(w / 8, h / 7);
    const pos = (z: (typeof ext)[number]) => [x + 20 + z.mapPos![0] * cell, y + 10 + z.mapPos![1] * cell] as const;
    const hasMap = !!s.inventory.carte_region;
    // Liaisons
    p.ctx.strokeStyle = '#3a3e48';
    p.ctx.lineWidth = 2;
    for (const z of ext)
      for (const wv of z.warps) {
        const t = ZONES[wv.to];
        if (!t?.mapPos || t.id < z.id) continue;
        if (!hasMap && !(s.flags[`visite_${z.id}`] && s.flags[`visite_${t.id}`])) continue;
        const [x1, y1] = pos(z);
        const [x2, y2] = pos(t);
        p.ctx.beginPath();
        p.ctx.moveTo(x1, y1);
        p.ctx.lineTo(x2, y2);
        p.ctx.stroke();
      }
    // Liaisons spéciales (train, cage de mine)
    const special: Array<[string, string]> = [['gare', 'cendriers'], ['marais', 'cendriers']];
    p.ctx.setLineDash([3, 4]);
    for (const [a, b] of special) {
      if (!s.flags[`visite_${a}`] || !s.flags[`visite_${b}`]) continue;
      const [x1, y1] = pos(ZONES[a]);
      const [x2, y2] = pos(ZONES[b]);
      p.ctx.beginPath();
      p.ctx.moveTo(x1, y1);
      p.ctx.lineTo(x2, y2);
      p.ctx.stroke();
    }
    p.ctx.setLineDash([]);
    // Lieux
    const here = ZONES[s.player.zone];
    for (const z of ext) {
      const visited = !!s.flags[`visite_${z.id}`];
      if (!visited && !hasMap) continue;
      const [cx, cy] = pos(z);
      const current = here?.id === z.id || (here && !here.mapPos && this.parentOf(here.id) === z.id);
      p.ctx.fillStyle = current ? p.t.accent : visited ? '#8a8f9a' : '#3a3e48';
      p.ctx.fillRect(cx - 5, cy - 5, 10, 10);
      p.text(visited ? z.name : '???', cx, cy + 8, { size: 13, align: 'center', color: visited ? p.t.text : '#5a5852' });
      if (current && Math.floor(this.g.time * 2) % 2 === 0) p.text('▼', cx, cy - 22, { size: 14, align: 'center', color: p.t.accent });
    }
    if (!hasMap) p.text('Odile, à la mairie, possède une carte de la région.', x, y + h - 30, { size: 13, color: p.t.dim });
  }

  private parentOf(zoneId: string, seen = new Set<string>()): string | undefined {
    // Zone extérieure qui mène à cette zone intérieure.
    seen.add(zoneId);
    for (const z of ZONE_LIST) if (z.mapPos && z.warps.some((w) => w.to === zoneId)) return z.id;
    for (const z of ZONE_LIST) {
      if (z.mapPos || seen.has(z.id) || !z.warps.some((w) => w.to === zoneId)) continue;
      const r = this.parentOf(z.id, seen);
      if (r) return r;
    }
    return undefined;
  }
}

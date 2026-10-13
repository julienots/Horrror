import { ABILITIES } from '../data/abilities';
import { AFFINITIES, affinityMultiplier } from '../data/affinities';
import { CREATURES } from '../data/creatures';
import { ITEMS } from '../data/items';
import { STATUSES } from '../data/statuses';
import type { AbilityDef, StageKey } from '../data/types';
import { ZONES } from '../data/zones';
import {
  type BEvent,
  type Battle,
  type BattleOutcome,
  type PlayerAction,
  abilityOptions,
  answerOptions,
  endBattleCleanup,
  playerTurn,
  startBattle,
} from '../battle/engine';
import { codexOf } from '../core/state';
import { applyTransform, maxEnergy, maxHp, pendingTransform, speciesOf, xpForLevel } from '../systems/creatures';
import { count } from '../systems/inventory';
import type { Game, Scene } from '../game';
import { WORLD_H, WORLD_W } from '../game';
import { CS, creatureSilhouette, creatureSprite, creatureTint } from '../render/creatures';
import { battleBackdrop } from '../render/props';
import { UI_H, UI_W, type Painter, scrollFor } from '../ui/draw';

type Phase = 'intro' | 'events' | 'menu' | 'abilities' | 'bond' | 'team' | 'bag' | 'bagTarget' | 'offer' | 'answer' | 'forcedSwitch' | 'transform' | 'end';

interface Fx {
  kind: AbilityDef['fx'];
  target: 'player' | 'foe';
  t: number;
  color: string;
}

const STAGE_LABEL: Record<StageKey, string> = { atk: 'L’attaque', def: 'La défense', psy: 'La psyché', vit: 'La vitesse' };

export class BattleScene implements Scene {
  readonly kind = 'battle';
  opaque = true;
  private b: Battle;
  private phase: Phase = 'intro';
  private queue: BEvent[] = [];
  private current: BEvent | null = null;
  private timer = 0;
  private message = '';
  private sel = 0;
  private subSel = 0;
  private scroll = 0;
  private bagItem: string | null = null;
  private introT = 1.1;
  private dispHp = { player: 0, foe: 0 };
  private targetHp = { player: 0, foe: 0 };
  private hit = { player: 0, foe: 0 };
  private lunge = { player: 0, foe: 0 };
  private gone = { player: false, foe: false };
  private vanish = { player: 0, foe: 0 };
  private fxs: Fx[] = [];
  private shakeN = 0;
  private outcome: BattleOutcome | null = null;
  private transforms: Array<{ uid: string; into: string }> = [];
  private transformT = 0;
  private finished = false;
  private theme: string;

  constructor(
    private g: Game,
    private species: string,
    level: number,
    private opts: { boss: boolean; noFlee: boolean },
    private done: (o: BattleOutcome) => void,
  ) {
    const s = g.state!;
    const r = startBattle(s, { species, level, boss: opts.boss, noFlee: opts.noFlee }, g.rng);
    this.b = r.battle;
    this.queue.push(...r.events);
    this.dispHp.player = this.targetHp.player = this.b.player.c.hp;
    this.dispHp.foe = this.targetHp.foe = this.b.foe.c.hp;
    this.theme = ZONES[s.player.zone]?.theme ?? 'village';
    g.audio.playMusic(opts.boss || CREATURES[species]?.boss ? 'boss' : 'combat');
    g.audio.cry(species);
    if (g.options.animSpeed === 1 && !g.options.reduceFlashes) g.flash('#ffffff', 0.15);
  }

  private get s() {
    return this.g.state!;
  }

  private dur(base: number): number {
    return base / this.g.anim;
  }

  // ------------------------------------------------------------ Logique

  update(dt: number, g: Game): void {
    this.animateBars(dt);
    if (this.phase === 'intro') {
      this.introT -= dt * g.anim;
      if (this.introT <= 0 || g.input.consume('confirm')) this.phase = 'events';
      return;
    }
    if (this.phase === 'events') return this.updateEvents(dt, g);
    if (this.phase === 'transform') return this.updateTransform(dt, g);
    if (this.phase === 'end') return;
    this.updateMenus(g);
  }

  private animateBars(dt: number): void {
    for (const side of ['player', 'foe'] as const) {
      const d = this.targetHp[side] - this.dispHp[side];
      if (Math.abs(d) < 0.5) this.dispHp[side] = this.targetHp[side];
      else this.dispHp[side] += d * Math.min(1, dt * 8 * this.g.anim);
      this.hit[side] = Math.max(0, this.hit[side] - dt * this.g.anim);
      this.lunge[side] = Math.max(0, this.lunge[side] - dt * this.g.anim * 3);
      this.vanish[side] = Math.max(0, this.vanish[side] - dt * this.g.anim);
    }
    for (const f of this.fxs) f.t -= dt * this.g.anim;
    this.fxs = this.fxs.filter((f) => f.t > 0);
  }

  private updateEvents(dt: number, g: Game): void {
    if (this.current) {
      this.timer -= dt;
      const skip = g.input.consume('confirm');
      if (this.timer <= 0 || (skip && this.current.t === 'text')) this.current = null;
      else return;
    }
    const ev = this.queue.shift();
    if (!ev) {
      this.afterEvents();
      return;
    }
    this.current = ev;
    this.timer = this.play(ev);
  }

  /** Joue un événement et renvoie sa durée d'affichage. */
  private play(ev: BEvent): number {
    const g = this.g;
    const name = (side: 'player' | 'foe') => speciesOf(side === 'player' ? this.b.player.c : this.b.foe.c).name;
    switch (ev.t) {
      case 'text':
        this.message = ev.text;
        return this.dur(Math.min(3.2, 0.9 + ev.text.length * 0.028));
      case 'use':
        this.message = `${name(ev.side)} utilise ${ev.name} !`;
        this.lunge[ev.side] = 1;
        return this.dur(0.7);
      case 'fx':
        this.fxs.push({ kind: ev.fx, target: ev.target, t: 0.45, color: AFFINITIES[ev.affinity].color });
        g.audio.attack(ev.fx);
        return this.dur(0.35);
      case 'damage':
        this.targetHp[ev.side] = ev.hp;
        this.hit[ev.side] = 0.5;
        g.audio.sfx(ev.crit ? 'critique' : 'coup');
        if (ev.crit || ev.mult >= 1.5) g.shake(ev.crit ? 0.6 : 0.35, 0.25);
        return this.dur(0.45);
      case 'heal':
        this.targetHp[ev.side] = ev.hp;
        if (ev.amount > 0) {
          this.message = `${name(ev.side)} récupère ${ev.amount} PV.`;
          g.audio.sfx('soin');
          return this.dur(0.8);
        }
        return 0.05;
      case 'miss':
        g.audio.sfx('rate');
        return this.dur(0.2);
      case 'status':
        this.message = `${name(ev.side)} : ${STATUSES[ev.status].name} !`;
        g.audio.sfx('statut');
        return this.dur(1);
      case 'statusEnd':
        this.message = `${name(ev.side)} n’est plus sous l’effet de ${STATUSES[ev.status].name}.`;
        return this.dur(0.8);
      case 'stage':
        this.message = `${STAGE_LABEL[ev.stat]} de ${name(ev.side)} ${ev.delta > 0 ? 'augmente' : 'diminue'}.`;
        return this.dur(0.9);
      case 'faint':
        this.gone[ev.side] = true;
        this.vanish[ev.side] = 0.9;
        g.audio.sfx('dissipe');
        return this.dur(0.9);
      case 'switch':
        this.dispHp.player = this.targetHp.player = this.b.player.c.hp;
        this.gone.player = false;
        g.audio.cry(this.b.player.c.species);
        return this.dur(0.5);
      case 'shake':
        this.shakeN = ev.n;
        g.audio.sfx('shake');
        return this.dur(0.6);
      case 'reveal':
        this.message = ev.text;
        g.audio.sfx('indice');
        return this.dur(Math.min(3.6, 1.2 + ev.text.length * 0.03));
      case 'xp': {
        const c = this.s.team.find((x) => x.uid === ev.uid);
        const n = c ? speciesOf(c).name : 'Votre Rémanent';
        const parts = [`${n} gagne ${ev.amount} points d’expérience.`];
        if (ev.levels.length) {
          parts.push(`Niveau ${ev.levels[ev.levels.length - 1]} !`);
          g.audio.sfx('niveau');
        }
        for (const a of ev.learned) parts.push(`Nouvelle capacité : ${ABILITIES[a]?.name}.`);
        for (const a of ev.learnedInactive) parts.push(`${ABILITIES[a]?.name} apprise (à activer dans le menu Équipe).`);
        this.message = parts.join(' ');
        if (c && c.uid === this.b.player.c.uid) this.dispHp.player = this.targetHp.player = c.hp;
        return this.dur(1.2 + parts.length * 0.5);
      }
      case 'bondUp': {
        const c = this.s.team.find((x) => x.uid === ev.uid);
        this.message = `Le lien avec ${c ? speciesOf(c).name : '…'} se renforce (lien ${ev.level}).`;
        g.audio.sfx('lien');
        return this.dur(1.3);
      }
      case 'outcome':
        this.outcome = ev.outcome;
        if (ev.outcome === 'bond' || ev.outcome === 'pacify' || ev.outcome === 'repel' || ev.outcome === 'flee') {
          this.gone.foe = true;
          this.vanish.foe = 0.9;
          g.audio.sfx(ev.outcome === 'bond' ? 'lien' : ev.outcome === 'pacify' ? 'soin' : 'cancel');
        }
        if (ev.outcome === 'win') g.audio.playMusic(null);
        return this.dur(0.4);
    }
    return 0.1;
  }

  private afterEvents(): void {
    if (this.outcome || this.b.outcome) {
      this.outcome = this.outcome ?? this.b.outcome;
      this.startTransforms();
      return;
    }
    if (this.b.needSwitch) {
      this.phase = 'forcedSwitch';
      this.subSel = Math.max(0, this.s.team.findIndex((c) => c.hp > 0));
      this.message = 'Qui prend sa place ?';
      return;
    }
    this.phase = 'menu';
    this.message = `Que fait ${speciesOf(this.b.player.c).name} ?`;
  }

  private act(a: PlayerAction): void {
    const ev = playerTurn(this.s, this.b, a);
    this.queue.push(...ev);
    this.phase = 'events';
  }

  private updateMenus(g: Game): void {
    const i = g.input;
    const nav = (n: number, cols = 1) => {
      if (i.consume('up')) this.subSel = (this.subSel - cols + n) % n;
      if (i.consume('down')) this.subSel = (this.subSel + cols) % n;
      if (cols > 1 && i.consume('left')) this.subSel = (this.subSel - 1 + n) % n;
      if (cols > 1 && i.consume('right')) this.subSel = (this.subSel + 1) % n;
    };
    switch (this.phase) {
      case 'menu': {
        const items = this.mainMenu();
        const before = this.sel;
        if (i.consume('up')) this.sel = (this.sel + items.length - 1) % items.length;
        if (i.consume('down')) this.sel = (this.sel + 1) % items.length;
        if (i.consume('left')) this.sel = (this.sel + items.length - 1) % items.length;
        if (i.consume('right')) this.sel = (this.sel + 1) % items.length;
        if (before !== this.sel) g.audio.sfx('menu');
        if (i.consume('confirm')) {
          const it = items[this.sel];
          if (it.disabled) {
            g.audio.sfx('echec');
            this.message = it.reason ?? 'Impossible.';
            return;
          }
          g.audio.sfx('confirm');
          this.subSel = 0;
          this.scroll = 0;
          if (it.id === 'attaque') this.phase = 'abilities';
          else if (it.id === 'lien') this.phase = 'bond';
          else if (it.id === 'equipe') this.phase = 'team';
          else if (it.id === 'sac') this.phase = 'bag';
          else if (it.id === 'fuir') this.act({ kind: 'flee' });
        }
        return;
      }
      case 'abilities': {
        const opts = abilityOptions(this.b);
        if (!opts.length) {
          this.phase = 'menu';
          return;
        }
        nav(opts.length);
        if (i.consume('cancel')) return this.back();
        if (i.consume('confirm')) {
          const o = opts[this.subSel];
          if (!o.usable) {
            g.audio.sfx('echec');
            this.message = o.reason === 'Oublié' ? 'Cette capacité a été oubliée pour l’instant.' : 'Pas assez d’énergie.';
            return;
          }
          g.audio.sfx('confirm');
          this.act({ kind: 'ability', id: o.id });
        }
        return;
      }
      case 'bond': {
        const opts = this.bondMenu();
        nav(opts.length);
        if (i.consume('cancel')) return this.back();
        if (i.consume('confirm')) {
          const o = opts[this.subSel];
          if (o.disabled) {
            g.audio.sfx('echec');
            this.message = o.reason ?? 'Impossible.';
            return;
          }
          g.audio.sfx('confirm');
          if (o.id === 'offrir') {
            this.phase = 'offer';
            this.subSel = 0;
            return;
          }
          if (o.id === 'parler') {
            this.phase = 'answer';
            this.subSel = 0;
            return;
          }
          if (o.action) this.act(o.action);
        }
        return;
      }
      case 'offer': {
        const items = this.offerables();
        if (!items.length) return this.back('bond');
        nav(items.length);
        if (i.consume('cancel')) return this.back('bond');
        if (i.consume('confirm')) this.act({ kind: 'offer', item: items[this.subSel] });
        return;
      }
      case 'answer': {
        const ans = answerOptions(this.s, this.b) ?? [];
        if (!ans.length) return this.back('bond');
        nav(ans.length);
        if (i.consume('cancel')) return this.back('bond');
        if (i.consume('confirm')) {
          if (!ans[this.subSel].enabled) {
            g.audio.sfx('echec');
            this.message = 'Vous ne connaissez pas ce nom. Il doit être écrit quelque part.';
            return;
          }
          this.act({ kind: 'answer', index: this.subSel });
        }
        return;
      }
      case 'team':
      case 'forcedSwitch': {
        const team = this.s.team;
        nav(team.length);
        if (this.phase === 'team' && i.consume('cancel')) return this.back();
        if (i.consume('confirm')) {
          const c = team[this.subSel];
          if (!c || c.hp <= 0 || (this.subSel === this.b.activeIndex && this.phase === 'team')) {
            g.audio.sfx('echec');
            this.message = c && c.hp <= 0 ? 'Il est dissipé.' : 'Il est déjà là.';
            return;
          }
          g.audio.sfx('confirm');
          this.act({ kind: 'switch', index: this.subSel });
        }
        return;
      }
      case 'bag': {
        const items = this.bagItems();
        if (!items.length) {
          this.message = 'Rien d’utilisable en combat.';
          return this.back();
        }
        nav(items.length);
        this.scroll = scrollFor(this.subSel, 5, this.scroll);
        if (i.consume('cancel')) return this.back();
        if (i.consume('confirm')) {
          this.bagItem = items[this.subSel];
          this.phase = 'bagTarget';
          this.subSel = this.b.activeIndex;
        }
        return;
      }
      case 'bagTarget': {
        nav(this.s.team.length);
        if (i.consume('cancel')) {
          this.phase = 'bag';
          this.subSel = 0;
          return;
        }
        if (i.consume('confirm') && this.bagItem) this.act({ kind: 'item', item: this.bagItem, target: this.subSel });
        return;
      }
    }
  }

  private back(to: Phase = 'menu'): void {
    this.g.audio.sfx('cancel');
    this.phase = to;
    this.subSel = 0;
    this.message = `Que fait ${speciesOf(this.b.player.c).name} ?`;
  }

  private mainMenu(): Array<{ id: string; label: string; disabled?: boolean; reason?: string }> {
    return [
      { id: 'attaque', label: 'Attaquer' },
      { id: 'lien', label: 'Lien' },
      { id: 'equipe', label: 'Équipe', disabled: this.s.team.filter((c) => c.hp > 0).length < 2, reason: 'Aucun autre Rémanent disponible.' },
      { id: 'sac', label: 'Sac' },
      { id: 'fuir', label: 'Fuir', disabled: !!this.opts.noFlee, reason: 'Impossible de fuir. Quelque chose vous retient ici.' },
    ];
  }

  private bondMenu(): Array<{ id: string; label: string; right?: string; action?: PlayerAction; disabled?: boolean; reason?: string }> {
    const def = CREATURES[this.species];
    const s = this.s;
    const out: Array<{ id: string; label: string; right?: string; action?: PlayerAction; disabled?: boolean; reason?: string }> = [];
    out.push({ id: 'observer', label: 'Observer', right: `${'◉'.repeat(this.b.understanding)}${'○'.repeat(3 - this.b.understanding)}`, action: { kind: 'observe' } });
    const cierges = count(s, 'cierge_apaisement');
    out.push({
      id: 'apaiser',
      label: 'Apaiser (cierge)',
      right: `×${cierges}`,
      action: { kind: 'pacify' },
      disabled: cierges <= 0 || this.b.understanding < 2,
      reason: cierges <= 0 ? 'Il vous faut un cierge d’apaisement.' : 'Observez-la d’abord pour la comprendre.',
    });
    for (const fil of ['fil_rouge', 'fil_dore']) {
      const n = count(s, fil);
      if (n > 0 || fil === 'fil_rouge') out.push({ id: fil, label: `Pacte (${ITEMS[fil].name})`, right: `×${n}`, action: { kind: 'pact', item: fil }, disabled: n <= 0, reason: 'Vous n’avez plus de fil.' });
    }
    out.push({ id: 'offrir', label: 'Offrir un objet…', disabled: !this.offerables().length, reason: 'Vous n’avez rien à offrir.' });
    if (def.bond.kind === 'choix') out.push({ id: 'parler', label: 'Lui répondre…' });
    out.push({ id: 'repousser', label: 'Repousser', action: { kind: 'repel' } });
    return out;
  }

  private offerables(): string[] {
    return Object.keys(this.s.inventory).filter((id) => ['quete', 'cle'].includes(ITEMS[id]?.category) && !['lettre_elise', 'journal_perso'].includes(id));
  }

  private bagItems(): string[] {
    return Object.keys(this.s.inventory).filter((id) => ITEMS[id]?.usableIn?.includes('combat') && ITEMS[id].category === 'soin');
  }

  // ------------------------------------------------------------ Transformations et fin

  private startTransforms(): void {
    if (this.outcome === 'win' || this.outcome === 'bond' || this.outcome === 'pacify') {
      for (const c of this.s.team) {
        const into = pendingTransform(c, this.s);
        if (into && c.hp > 0) this.transforms.push({ uid: c.uid, into });
      }
    }
    if (this.transforms.length) {
      this.phase = 'transform';
      this.transformT = 0;
      const c = this.s.team.find((x) => x.uid === this.transforms[0].uid)!;
      this.message = `Quelque chose change en ${speciesOf(c).name}… (Échap pour l’en empêcher)`;
      this.g.audio.sfx('transformation');
      return;
    }
    void this.finish();
  }

  private updateTransform(dt: number, g: Game): void {
    const tr = this.transforms[0];
    if (!tr) {
      void this.finish();
      return;
    }
    const c = this.s.team.find((x) => x.uid === tr.uid);
    this.transformT += dt * g.anim;
    if (c && g.input.consume('cancel') && this.transformT < 2.4) {
      this.message = `${speciesOf(c).name} reste tel qu’il est. Pour l’instant.`;
      this.transforms.shift();
      this.transformT = -1.2;
      return;
    }
    if (this.transformT >= 2.6 && c && c.species !== tr.into) {
      const oldName = speciesOf(c).name;
      const learned = applyTransform(c, tr.into);
      const e = codexOf(this.s, tr.into);
      e.seen = true;
      e.bonded = true;
      this.message = `${oldName} est devenu ${speciesOf(c).name} !${learned.length ? ` Nouvelle capacité : ${learned.map((a) => ABILITIES[a]?.name).join(', ')}.` : ''}`;
      g.audio.cry(tr.into);
      if (!g.options.reduceFlashes) g.flash('#ffffff', 0.4);
    }
    if (this.transformT >= 4.4) {
      this.transforms.shift();
      this.transformT = 0;
      const next = this.transforms[0];
      if (next) {
        const nc = this.s.team.find((x) => x.uid === next.uid);
        this.message = `Quelque chose change en ${nc ? speciesOf(nc).name : '…'}… (Échap pour l’en empêcher)`;
        g.audio.sfx('transformation');
      }
    }
  }

  private async finish(): Promise<void> {
    if (this.finished) return;
    this.finished = true;
    this.phase = 'end';
    endBattleCleanup(this.s);
    await this.g.fadeTo(1, 0.4);
    this.done(this.outcome ?? 'flee');
  }

  // ------------------------------------------------------------ Rendu monde

  renderWorld(w: CanvasRenderingContext2D, g: Game): void {
    w.imageSmoothingEnabled = false;
    w.drawImage(battleBackdrop(this.theme, WORLD_W, WORLD_H), 0, 0);
    const t = g.time;
    const frame = Math.floor(t * 2) % 2;
    // Adversaire
    const foe = this.b.foe.c;
    const fs = foe.species;
    const shakeX = this.hit.foe > 0 ? Math.round(Math.sin(t * 60) * 3) : 0;
    const lungeF = Math.round(Math.sin(this.lunge.foe * Math.PI) * -10);
    const foeX = 200 + shakeX + lungeF;
    const foeY = 22 - Math.round(Math.sin(this.lunge.foe * Math.PI) * -6);
    this.drawCreature(w, fs, frame, foeX, foeY, false, 'foe');
    // Rémanent du joueur (vu de dos : miroir et légère ombre)
    const pc = this.b.player.c;
    const shakeP = this.hit.player > 0 ? Math.round(Math.sin(t * 60) * 3) : 0;
    const lungeP = Math.round(Math.sin(this.lunge.player * Math.PI) * 10);
    this.drawCreature(w, pc.species, frame, 44 + shakeP + lungeP, 64 - Math.round(Math.sin(this.lunge.player * Math.PI) * 4), true, 'player');
    // Effets
    for (const f of this.fxs) this.drawFx(w, f);
    // Fil du pacte
    if (this.shakeN > 0 && this.phase === 'events' && this.current?.t === 'shake') {
      w.strokeStyle = '#b03030';
      w.lineWidth = 1;
      w.beginPath();
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2 + t * 6;
        const x = foeX + 32 + Math.cos(a) * 24;
        const y = foeY + 34 + Math.sin(a) * 26;
        if (i === 0) w.moveTo(x, y);
        else w.lineTo(x, y);
      }
      w.stroke();
    }
    // Transition d'entrée : bandes qui s'écartent comme des paupières
    if (this.phase === 'intro') {
      const k = Math.max(0, this.introT / 1.1);
      if (g.options.reduceFlashes) {
        w.fillStyle = `rgba(0,0,0,${k})`;
        w.fillRect(0, 0, WORLD_W, WORLD_H);
      } else {
        const hgt = Math.round((WORLD_H / 2) * k);
        w.fillStyle = '#000';
        w.fillRect(0, 0, WORLD_W, hgt);
        w.fillRect(0, WORLD_H - hgt, WORLD_W, hgt);
        for (let i = 0; i < 8; i++) {
          const y = (i * 23 + Math.floor(t * 300)) % WORLD_H;
          w.fillStyle = `rgba(160,40,40,${0.3 * k})`;
          w.fillRect(0, y, WORLD_W, 2);
        }
      }
    }
    // Transformation : alternance silhouette / nouvelle forme
    if (this.phase === 'transform' && this.transforms[0] && this.transformT > 0 && this.transformT < 2.6) {
      const tr = this.transforms[0];
      const speedup = 2 + this.transformT * 5;
      const showNew = Math.sin(this.transformT * speedup) > 0;
      const c = this.s.team.find((x) => x.uid === tr.uid);
      if (c) {
        w.fillStyle = 'rgba(0,0,0,0.6)';
        w.fillRect(0, 0, WORLD_W, WORLD_H);
        const img = creatureSilhouette(showNew ? tr.into : c.species, showNew ? '#e8e6e1' : '#2a2840');
        w.drawImage(img, WORLD_W / 2 - CS, 30, CS * 2, CS * 2);
      }
    }
  }

  private drawCreature(w: CanvasRenderingContext2D, species: string, frame: number, x: number, y: number, mirror: boolean, side: 'player' | 'foe'): void {
    if (this.gone[side] && this.vanish[side] <= 0) return;
    const img = creatureSprite(species, frame);
    w.save();
    // Halo discret derrière la créature pour la détacher des fonds sombres.
    const halo = w.createRadialGradient(x + CS / 2, y + CS / 2, 4, x + CS / 2, y + CS / 2, CS * 0.7);
    halo.addColorStop(0, this.theme === 'seuil' ? 'rgba(0,0,0,0.12)' : 'rgba(150,160,180,0.16)');
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    w.fillStyle = halo;
    w.fillRect(x - 16, y - 16, CS + 32, CS + 32);
    w.globalAlpha = this.gone[side] ? this.vanish[side] / 0.9 : 1;
    if (mirror) {
      w.translate(x + CS, y);
      w.scale(-1, 1);
      w.drawImage(img, 0, 0);
    } else w.drawImage(img, x, y);
    if (this.hit[side] > 0.25) {
      w.globalAlpha = this.g.options.reduceFlashes ? 0.3 : 0.75;
      const tint = creatureTint(species, frame, this.g.options.reduceFlashes ? '#3a0c0c' : '#ffffff');
      if (mirror) w.drawImage(tint, 0, 0);
      else w.drawImage(tint, x, y);
    }
    w.restore();
  }

  private drawFx(w: CanvasRenderingContext2D, f: Fx): void {
    const cx = f.target === 'foe' ? 232 : 76;
    const cy = f.target === 'foe' ? 54 : 96;
    const k = 1 - f.t / 0.45;
    w.save();
    w.globalAlpha = Math.max(0, 1 - k);
    w.fillStyle = f.color;
    w.strokeStyle = f.color;
    switch (f.kind) {
      case 'slash':
        w.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          w.beginPath();
          w.moveTo(cx - 20 + i * 8, cy - 20 + k * 10);
          w.lineTo(cx + 6 + i * 8, cy + 20 + k * 10);
          w.stroke();
        }
        break;
      case 'wave':
      case 'bell':
        w.lineWidth = 1;
        for (let i = 0; i < 3; i++) {
          w.beginPath();
          w.arc(cx, cy, 6 + (k * 30 + i * 8), 0, Math.PI * 2);
          w.stroke();
        }
        break;
      case 'shards':
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          w.fillRect(cx + Math.cos(a) * k * 30, cy + Math.sin(a) * k * 30, 3, 2);
        }
        break;
      case 'ash':
        for (let i = 0; i < 16; i++) w.fillRect(cx - 24 + ((i * 7) % 48), cy - 30 + ((i * 13) % 30) + k * 30, 2, 2);
        break;
      case 'void':
        w.fillStyle = '#000';
        w.globalAlpha = 0.8 * (1 - Math.abs(k - 0.5) * 2);
        w.beginPath();
        w.arc(cx, cy, 26 * (1 - Math.abs(k - 0.5)), 0, Math.PI * 2);
        w.fill();
        break;
      case 'dream':
        for (let i = 0; i < 8; i++) {
          w.beginPath();
          w.arc(cx - 20 + i * 6, cy + Math.sin(i + k * 6) * 12, 2, 0, Math.PI * 2);
          w.fill();
        }
        break;
      case 'roots':
        w.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
          w.beginPath();
          w.moveTo(cx - 24 + i * 16, cy + 34);
          w.lineTo(cx - 20 + i * 14, cy + 34 - k * 50);
          w.stroke();
        }
        break;
      case 'static':
        for (let i = 0; i < 40; i++) w.fillRect(cx - 28 + Math.random() * 56, cy - 28 + Math.random() * 56, 2, 1);
        break;
      case 'heal':
      case 'buff':
        for (let i = 0; i < 8; i++) w.fillRect(cx - 20 + i * 6, cy + 20 - k * 40 - (i % 3) * 6, 2, 3);
        break;
    }
    w.restore();
  }

  // ------------------------------------------------------------ Rendu interface

  renderUI(p: Painter): void {
    const b = this.b;
    // Adversaire
    const fd = CREATURES[this.species];
    p.panel(14, 12, 250, 62);
    p.text(fd.name, 24, 16, { size: 18, color: '#e8e2d2' });
    p.text(`Niv. ${b.foe.c.level}`, 254, 18, { size: 15, align: 'right', color: p.t.dim });
    let cx = 24;
    for (const a of b.foe.affinities) cx += p.chip(AFFINITIES[a].name, cx, 37, AFFINITIES[a].color, 12) + 4;
    p.text(`${'◉'.repeat(b.understanding)}${'○'.repeat(3 - b.understanding)}`, 254, 36, { size: 13, align: 'right', color: '#9ab0c0' });
    p.bar(24, 56, 230, 7, this.dispHp.foe, maxHp(b.foe.c), p.hpColor(this.dispHp.foe, maxHp(b.foe.c)));
    this.statusRow(p, b.foe.statuses.map((s) => s.id), 150, 16);

    // Joueur
    const pc = b.player.c;
    const px = 376;
    const py = 186;
    p.panel(px, py, 250, 72);
    p.text(speciesOf(pc).name, px + 10, py + 4, { size: 18, color: '#e8e2d2' });
    p.text(`Niv. ${pc.level}`, px + 240, py + 6, { size: 15, align: 'right', color: p.t.dim });
    p.bar(px + 10, py + 28, 230, 7, this.dispHp.player, maxHp(pc), p.hpColor(this.dispHp.player, maxHp(pc)));
    p.text(`${Math.ceil(this.dispHp.player)}/${maxHp(pc)} PV`, px + 10, py + 37, { size: 14 });
    p.bar(px + 120, py + 42, 120, 5, pc.energy, maxEnergy(pc), '#5a7aa8');
    p.text(`EN ${pc.energy}/${maxEnergy(pc)}`, px + 240, py + 48, { size: 13, align: 'right', color: '#8aa0c8' });
    const xp0 = xpForLevel(pc.level);
    const xp1 = xpForLevel(pc.level + 1);
    p.bar(px + 10, py + 64, 230, 2, pc.xp - xp0, xp1 - xp0, '#8a7aa8');
    this.statusRow(p, b.player.statuses.map((s) => s.id), px + 110, py + 6);

    // Zone de texte et menus
    const by = 268;
    p.panel(8, by, UI_W - 16, 84);
    const menuW = 210;
    const showMenu = !['events', 'intro', 'transform', 'end'].includes(this.phase);
    const textW = showMenu ? UI_W - menuW - 50 : UI_W - 50;
    p.wrap(this.message, textW, 17)
      .slice(0, 4)
      .forEach((l, i) => p.text(l, 22, by + 10 + i * 18, { size: 17 }));
    if (!showMenu) return;
    const mx = UI_W - menuW - 14;
    p.ctx.fillStyle = p.t.border;
    p.ctx.fillRect(mx - 10, by + 6, 1, 72);
    switch (this.phase) {
      case 'menu': {
        const items = this.mainMenu();
        const cols = [items.slice(0, 3), items.slice(3)];
        cols.forEach((col, ci) =>
          col.forEach((it, ri) => {
            const idx = ci * 3 + ri;
            const x = mx + ci * 105;
            const y = by + 10 + ri * 22;
            if (idx === this.sel) {
              p.ctx.fillStyle = p.t.select;
              p.ctx.fillRect(x - 4, y - 1, 100, 21);
              p.text('›', x - 2, y, { size: 17, color: p.t.accent });
            }
            p.text(it.label, x + 10, y, { size: 17, color: it.disabled ? '#5a5852' : idx === this.sel ? p.t.accent : p.t.text });
          }),
        );
        return;
      }
      case 'abilities':
        return this.renderAbilities(p, by);
      case 'bond': {
        const opts = this.bondMenu();
        this.scroll = scrollFor(this.subSel, 3, this.scroll);
        p.list(opts.map((o) => ({ label: o.label, right: o.right, disabled: o.disabled })), this.subSel, mx, by + 10, menuW - 10, { size: 15, scroll: this.scroll, visible: 3 });
        return;
      }
      case 'offer': {
        const items = this.offerables();
        this.scroll = scrollFor(this.subSel, 3, this.scroll);
        p.list(items.map((id) => ({ label: ITEMS[id].name })), this.subSel, mx, by + 10, menuW - 10, { size: 15, scroll: this.scroll, visible: 3 });
        return;
      }
      case 'answer': {
        const def = CREATURES[this.species];
        const ans = answerOptions(this.s, this.b) ?? [];
        if (def.bond.kind === 'choix') p.text(def.bond.prompt, 22, by + 62, { size: 14, color: p.t.dim });
        p.list(ans.map((a) => ({ label: a.text, disabled: !a.enabled })), this.subSel, mx, by + 10, menuW - 10, { size: 14 });
        return;
      }
      case 'team':
      case 'forcedSwitch':
      case 'bagTarget': {
        const team = this.s.team;
        this.scroll = scrollFor(this.subSel, 3, this.scroll);
        p.list(
          team.map((c, i) => ({ label: `${speciesOf(c).name}${i === this.b.activeIndex ? ' •' : ''}`, right: c.hp > 0 ? `${c.hp}/${maxHp(c)}` : 'dissipé', disabled: c.hp <= 0 && this.phase !== 'bagTarget' })),
          this.subSel,
          mx,
          by + 10,
          menuW - 10,
          { size: 15, scroll: this.scroll, visible: 3 },
        );
        if (this.phase === 'bagTarget' && this.bagItem) p.text(`Utiliser ${ITEMS[this.bagItem].name} sur…`, 22, by + 62, { size: 14, color: p.t.dim });
        return;
      }
      case 'bag': {
        const items = this.bagItems();
        this.scroll = scrollFor(this.subSel, 3, this.scroll);
        p.list(items.map((id) => ({ label: ITEMS[id].name, right: `×${this.s.inventory[id]}` })), this.subSel, mx, by + 10, menuW - 10, { size: 15, scroll: this.scroll, visible: 3 });
        const sel = items[this.subSel];
        if (sel) p.text(ITEMS[sel].description, 22, by + 62, { size: 13, color: p.t.dim });
        return;
      }
    }
  }

  private renderAbilities(p: Painter, by: number): void {
    const opts = abilityOptions(this.b);
    // On remplace toute la zone de texte par la liste et le détail.
    p.panel(8, by, UI_W - 16, 84, { solid: true });
    opts.forEach((o, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const x = 22 + col * 160;
      const y = by + 10 + row * 34;
      if (i === this.subSel) {
        p.ctx.fillStyle = p.t.select;
        p.ctx.fillRect(x - 6, y - 2, 154, 32);
      }
      p.text(o.def.name, x + 4, y, { size: 16, color: !o.usable ? '#5a5852' : i === this.subSel ? p.t.accent : p.t.text });
      p.chip(AFFINITIES[o.def.affinity].name, x + 4, y + 16, AFFINITIES[o.def.affinity].color, 11);
      p.text(`EN ${o.cost}`, x + 146, y + 16, { size: 13, align: 'right', color: o.cost > this.b.player.c.energy ? p.t.danger : '#8aa0c8' });
    });
    if (this.subSel >= opts.length) this.subSel = 0;
    const o = opts[this.subSel];
    if (!o) return;
    const dx = 352;
    const cat = o.def.category === 'physique' ? 'Physique' : o.def.category === 'psychique' ? 'Psychique' : 'Soutien';
    p.text(`${cat}${o.def.power ? ` · Puissance ${o.def.power}` : ''} · Précision ${Math.round(o.def.accuracy * 100)} %`, dx, by + 8, { size: 14, color: p.t.dim });
    p.wrap(o.def.description, UI_W - dx - 24, 14).slice(0, 2).forEach((l, i) => p.text(l, dx, by + 26 + i * 15, { size: 14 }));
    if (o.def.power > 0) {
      const m = affinityMultiplier(o.def.affinity, this.b.foe.affinities);
      const label = m >= 1.5 ? 'Très efficace' : m > 1 ? 'Efficace' : m <= 0.5 ? 'Presque sans effet' : m < 1 ? 'Peu efficace' : 'Efficacité normale';
      p.text(label, dx, by + 62, { size: 14, color: m > 1 ? p.t.good : m < 1 ? p.t.danger : p.t.dim });
    }
  }

  private statusRow(p: Painter, ids: string[], x: number, y: number): void {
    let cx = x;
    for (const id of ids) {
      const st = STATUSES[id as keyof typeof STATUSES];
      if (!st) continue;
      cx += p.chip(st.short, cx, y, st.color, 11) + 3;
    }
  }
}

export { UI_H };

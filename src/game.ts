import { AudioEngine } from './audio/audio';
import type { BattleOutcome } from './battle/engine';
import { CREATURES } from './data/creatures';
import type { Dir, EndingId, HorrorFx, Mood } from './data/types';
import { Rng } from './core/rng';
import { OPTIONS_KEY, SaveStore, type KV, type SlotId, sanitizeOptions } from './core/save';
import { DEFAULT_OPTIONS, type GameState, type Options, newGame } from './core/state';
import { healTeam } from './systems/creatures';
import type { ScriptHost } from './systems/script';
import { Input } from './engine/input';
import { Painter, THEME, THEME_CONTRAST, UI_H, UI_W } from './ui/draw';
import { edgeSilhouette, grainTexture } from './render/props';
import { ChoiceScene, CodeScene, DialogueScene } from './scenes/dialogue';
import type { ExploreScene } from './scenes/explore';

export const WORLD_W = 320;
export const WORLD_H = 180;

export interface Scene {
  readonly kind?: string;
  opaque: boolean;
  update(dt: number, g: Game): void;
  animate?(dt: number, g: Game): void;
  renderWorld?(w: CanvasRenderingContext2D, g: Game): void;
  renderUI?(p: Painter, g: Game): void;
}

interface Toast {
  text: string;
  t: number;
}

class SafeKV implements KV {
  getItem(k: string) {
    try {
      return window.localStorage.getItem(k);
    } catch {
      return null;
    }
  }
  setItem(k: string, v: string) {
    window.localStorage.setItem(k, v);
  }
  removeItem(k: string) {
    try {
      window.localStorage.removeItem(k);
    } catch {
      /* ignoré */
    }
  }
}

export class Game implements ScriptHost {
  readonly world: HTMLCanvasElement;
  readonly wctx: CanvasRenderingContext2D;
  readonly ctx: CanvasRenderingContext2D;
  readonly painter: Painter;
  readonly input = new Input();
  readonly audio = new AudioEngine();
  readonly store: SaveStore;
  options: Options = { ...DEFAULT_OPTIONS };
  state: GameState | null = null;
  rng = new Rng();
  stack: Scene[] = [];
  explore: ExploreScene | null = null;
  inBattle = false;
  time = 0; // horloge réelle de la session (secondes)
  private toasts: Toast[] = [];
  private fadeAlpha = 0;
  private fadeTarget = 0;
  private fadeSpeed = 4;
  private fadeResolve: (() => void) | null = null;
  private shakeT = 0;
  private shakeAmp = 0;
  private flashT = 0;
  private flashColor = '#ffffff';
  private silhouettes: Array<{ side: 'left' | 'right'; t: number; variant: number; y: number }> = [];
  private pendingSave = false;
  private grainFrame = 0;
  endingsSeen: string[] = [];
  makeTitle: (() => Scene) | null = null;
  makeEnding: ((id: EndingId) => Scene) | null = null;
  makeBattle: ((species: string, level: number, opts: { boss: boolean; noFlee: boolean }, done: (o: BattleOutcome) => void) => Scene) | null = null;
  makeExplore: (() => ExploreScene) | null = null;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    this.world = document.createElement('canvas');
    this.world.width = WORLD_W;
    this.world.height = WORLD_H;
    this.wctx = this.world.getContext('2d') as CanvasRenderingContext2D;
    this.painter = new Painter(this.ctx);
    this.store = new SaveStore(new SafeKV());
    this.loadOptions();
    this.input.attach(window);
    this.input.onFirstInput = () => {
      this.audio.init();
      this.applyOptions();
    };
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') this.autosave();
      else this.audio.resume();
    });
    window.addEventListener('pagehide', () => this.autosave());
  }

  // ------------------------------------------------------------ Options

  loadOptions(): void {
    try {
      const raw = window.localStorage.getItem(OPTIONS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      this.options = sanitizeOptions(parsed?.options ?? parsed);
      this.endingsSeen = Array.isArray(parsed?.endings) ? parsed.endings : [];
    } catch {
      this.options = { ...DEFAULT_OPTIONS };
    }
    this.applyOptions();
  }

  saveOptions(): void {
    try {
      window.localStorage.setItem(OPTIONS_KEY, JSON.stringify({ options: this.options, endings: this.endingsSeen }));
    } catch {
      /* stockage indisponible : les options restent pour la session */
    }
    if (this.state) this.state.options = { ...this.options };
    this.applyOptions();
  }

  applyOptions(): void {
    this.audio.setVolumes(this.options.musicVol, this.options.sfxVol, this.options.ambVol);
    this.painter.scale = this.options.textSize === 'grand' ? 1.2 : 1;
    this.painter.t = this.options.highContrast ? THEME_CONTRAST : THEME;
  }

  get anim(): number {
    return this.options.animSpeed;
  }

  // ------------------------------------------------------------ Scènes

  push(s: Scene): void {
    this.stack.push(s);
    this.input.clear();
  }

  pop(s?: Scene): void {
    if (s) {
      const i = this.stack.lastIndexOf(s);
      if (i >= 0) this.stack.splice(i, 1);
    } else this.stack.pop();
    this.input.clear();
  }

  top(): Scene | undefined {
    return this.stack[this.stack.length - 1];
  }

  resetTo(s: Scene): void {
    this.stack = [s];
    this.input.clear();
  }

  // ------------------------------------------------------------ Boucle

  start(): void {
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      try {
        this.tick(dt);
      } catch (e) {
        // Une erreur de rendu ne doit jamais bloquer la partie ni corrompre la sauvegarde.
        console.error(e);
        this.toast('Une erreur est survenue. La partie continue.');
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  tick(dt: number): void {
    this.time += dt;
    this.input.poll(dt);
    this.audio.update(dt);
    for (const s of this.stack) s.animate?.(dt, this);
    const top = this.top();
    top?.update(dt, this);
    if (this.state && !this.inBattle) this.state.playSeconds += dt;
    // Fondu
    if (this.fadeAlpha !== this.fadeTarget) {
      const d = this.fadeSpeed * dt;
      this.fadeAlpha = this.fadeAlpha < this.fadeTarget ? Math.min(this.fadeTarget, this.fadeAlpha + d) : Math.max(this.fadeTarget, this.fadeAlpha - d);
      if (this.fadeAlpha === this.fadeTarget && this.fadeResolve) {
        const r = this.fadeResolve;
        this.fadeResolve = null;
        r();
      }
    }
    this.shakeT = Math.max(0, this.shakeT - dt);
    this.flashT = Math.max(0, this.flashT - dt);
    for (const t of this.toasts) t.t -= dt;
    this.toasts = this.toasts.filter((t) => t.t > 0);
    for (const s of this.silhouettes) s.t -= dt;
    this.silhouettes = this.silhouettes.filter((s) => s.t > 0);
    if (this.pendingSave && this.canSave()) this.autosave();
    this.render();
    this.input.endFrame();
  }

  private visibleScenes(): Scene[] {
    let i = this.stack.length - 1;
    while (i > 0 && !this.stack[i].opaque) i--;
    return this.stack.slice(Math.max(0, i));
  }

  render(): void {
    const ctx = this.ctx;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const vis = this.visibleScenes();
    const w = this.wctx;
    w.setTransform(1, 0, 0, 1, 0, 0);
    w.fillStyle = '#000';
    w.fillRect(0, 0, WORLD_W, WORLD_H);
    for (const s of vis) s.renderWorld?.(w, this);
    // Silhouettes en bord d'écran
    for (const s of this.silhouettes) {
      const a = Math.min(1, s.t, (2.4 - s.t) * 2);
      w.globalAlpha = Math.max(0, a) * 0.85;
      const img = edgeSilhouette(s.variant);
      w.drawImage(img, s.side === 'left' ? -6 : WORLD_W - 22, s.y);
      w.globalAlpha = 1;
    }
    // Grain de pellicule
    this.grainFrame += 1;
    if (!this.options.reduceFlashes || this.grainFrame % 2 === 0) {
      const g = grainTexture(Math.floor(this.grainFrame / 3));
      w.globalAlpha = 0.6;
      w.drawImage(g, 0, 0, WORLD_W, WORLD_H);
      w.globalAlpha = 1;
    }
    // Composition
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;
    let sx = 0;
    let sy = 0;
    if (this.shakeT > 0 && !this.options.reduceShake) {
      sx = (Math.random() - 0.5) * this.shakeAmp * 8;
      sy = (Math.random() - 0.5) * this.shakeAmp * 8;
    }
    ctx.drawImage(this.world, sx, sy, W, H);
    if (this.flashT > 0) {
      ctx.globalAlpha = Math.min(1, this.flashT * 2) * (this.options.reduceFlashes ? 0.25 : 0.8);
      ctx.fillStyle = this.options.reduceFlashes ? '#000000' : this.flashColor;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    ctx.setTransform(W / UI_W, 0, 0, H / UI_H, 0, 0);
    for (const s of vis) s.renderUI?.(this.painter, this);
    this.renderToasts();
    if (this.fadeAlpha > 0) {
      ctx.globalAlpha = this.fadeAlpha;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, UI_W, UI_H);
      ctx.globalAlpha = 1;
    }
  }

  private renderToasts(): void {
    const p = this.painter;
    let y = 8;
    for (const t of this.toasts.slice(-4)) {
      const a = Math.min(1, t.t * 2, (3.2 - t.t) * 4);
      const w = Math.min(300, p.measure(t.text, 15) + 20);
      p.ctx.globalAlpha = Math.max(0, a);
      p.panel(UI_W - w - 8, y, w, 24, { alpha: Math.max(0, a) });
      p.text(t.text, UI_W - w + 2, y + 4, { size: 15, color: p.t.accent, alpha: Math.max(0, a) });
      p.ctx.globalAlpha = 1;
      y += 28;
    }
  }

  // ------------------------------------------------------------ Effets globaux

  toast(text: string): void {
    this.toasts.push({ text, t: 3.2 });
  }

  fadeTo(target: number, duration = 0.3): Promise<void> {
    this.fadeTarget = target;
    this.fadeSpeed = 1 / Math.max(0.05, duration / this.anim);
    if (this.fadeAlpha === target) return Promise.resolve();
    return new Promise((r) => (this.fadeResolve = r));
  }

  shake(amp: number, dur: number): void {
    if (this.options.reduceShake) return;
    this.shakeAmp = amp;
    this.shakeT = dur;
  }

  flash(color: string, dur: number): void {
    this.flashColor = color;
    this.flashT = dur;
  }

  spawnSilhouette(): void {
    this.silhouettes.push({ side: Math.random() < 0.5 ? 'left' : 'right', t: 2.4, variant: Math.floor(Math.random() * 3), y: 40 + Math.random() * 60 });
  }

  // ------------------------------------------------------------ Partie

  newGame(): void {
    this.state = newGame();
    this.state.options = { ...this.options };
    this.rng = new Rng(this.state.rngState);
    this.enterExplore();
  }

  loadSlot(slot: SlotId): { ok: boolean; message: string } {
    const r = this.store.read(slot);
    if (!r.ok) return { ok: false, message: 'Cette sauvegarde est illisible.' };
    this.state = r.state;
    this.rng = new Rng(this.state.rngState);
    // Les options de l'appareil priment sur celles de la sauvegarde.
    this.state.options = { ...this.options };
    this.enterExplore();
    if (r.recoveredFrom) this.toast('Sauvegarde récupérée depuis une copie de secours.');
    if (r.repairs.length) this.toast('Certaines données ont été réparées.');
    return { ok: true, message: '' };
  }

  private enterExplore(): void {
    if (!this.makeExplore) return;
    const ex = this.makeExplore();
    this.explore = ex;
    this.resetTo(ex);
    this.fadeAlpha = 1;
    void this.fadeTo(0, 0.8);
  }

  backToTitle(): void {
    this.explore = null;
    this.state = null;
    this.inBattle = false;
    if (this.makeTitle) this.resetTo(this.makeTitle());
    this.fadeAlpha = 1;
    void this.fadeTo(0, 0.6);
  }

  canSave(): boolean {
    return !!this.state && !!this.explore && !this.inBattle && !this.explore.transitioning && !this.explore.chasing;
  }

  saveTo(slot: SlotId): { ok: boolean; message: string } {
    if (!this.state) return { ok: false, message: 'Aucune partie en cours.' };
    if (!this.canSave()) return { ok: false, message: 'Impossible de sauvegarder maintenant.' };
    this.state.rngState = this.rng.state;
    const r = this.store.write(slot, this.state);
    return r.ok ? { ok: true, message: 'Partie sauvegardée.' } : { ok: false, message: 'La sauvegarde a échoué (stockage indisponible ?).' };
  }

  /** Sauvegarde automatique : différée si le jeu n'est pas dans un état stable. */
  autosave(): void {
    if (!this.state) return;
    // Jamais pendant une transition, un combat, une poursuite ou un script en cours.
    if (!this.canSave() || this.explore?.busy) {
      this.pendingSave = true;
      return;
    }
    this.pendingSave = false;
    this.saveTo('auto');
  }

  /** Défaite : retour au dernier lieu de repos, équipe soignée, rien n'est perdu. */
  async whiteout(): Promise<void> {
    const s = this.state;
    if (!s || !this.explore) return;
    await this.fadeTo(1, 0.8);
    healTeam(s);
    s.time = (s.time + 6 * 60) % 1440;
    await this.explore.teleport(s.lastRest.zone, s.lastRest.x, s.lastRest.y, 'down', false);
    await this.fadeTo(0, 0.8);
    await this.say('Vous vous réveillez, la bouche pleine de brume. Quelqu’un vous a ramené(e) ici. Vos Rémanents veillent sur vous.', '', 'neutre');
    this.autosave();
  }

  // ------------------------------------------------------------ Hôte de script

  say(text: string, who: string, mood: Mood): Promise<void> {
    return new Promise((resolve) => this.push(new DialogueScene(text, who, mood, resolve)));
  }

  choose(prompt: string, options: string[], who: string): Promise<number> {
    return new Promise((resolve) => this.push(new ChoiceScene(prompt, options, who, resolve)));
  }

  codeInput(prompt: string, length: number): Promise<string> {
    return new Promise((resolve) => this.push(new CodeScene(prompt, length, resolve)));
  }

  notify(text: string): void {
    this.toast(text);
  }

  battle(species: string, level: number, opts: { boss: boolean; noFlee: boolean }): Promise<BattleOutcome> {
    return new Promise((resolve) => {
      if (!this.state || !this.makeBattle || !this.state.team.some((c) => c.hp > 0)) {
        // Sécurité : sans Rémanent valide, le combat est évité.
        resolve('flee');
        return;
      }
      this.inBattle = true;
      const scene = this.makeBattle(species, level, opts, async (outcome) => {
        this.pop(scene);
        this.inBattle = false;
        this.explore?.afterBattle();
        if (outcome === 'lose') await this.whiteout();
        else await this.fadeTo(0, 0.3);
        resolve(outcome);
      });
      this.push(scene);
    });
  }

  async warp(zone: string, x: number, y: number, dir?: Dir): Promise<void> {
    await this.explore?.teleport(zone, x, y, dir ?? 'down', true);
  }

  fade(dir: 'out' | 'in'): Promise<void> {
    return this.fadeTo(dir === 'out' ? 1 : 0, 0.5);
  }

  wait(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms / this.anim));
  }

  sound(id: string): void {
    this.audio.sfx(id);
  }

  music(id: string | null): void {
    this.audio.playMusic(id);
  }

  async horror(fx: HorrorFx): Promise<void> {
    const attenuated = this.options.horror === 'attenue';
    switch (fx) {
      case 'silhouette':
        this.spawnSilhouette();
        this.audio.sfx('silhouette');
        break;
      case 'lumieres':
        this.explore?.flicker(1.4);
        this.audio.sfx('lumieres');
        break;
      case 'flash':
        if (!attenuated) this.flash('#e8e6e1', 0.35);
        this.audio.sfx('flash');
        break;
      case 'secousse':
        this.shake(attenuated ? 0.3 : 0.8, 0.5);
        this.audio.sfx('secousse');
        break;
      default:
        this.audio.sfx(fx);
    }
  }

  async ending(id: EndingId): Promise<void> {
    if (!this.endingsSeen.includes(id)) this.endingsSeen.push(id);
    this.saveOptions();
    await this.fadeTo(1, 1.5);
    if (this.makeEnding) this.resetTo(this.makeEnding(id));
    this.explore = null;
    await this.fadeTo(0, 1.5);
  }

  /** Commande de script « save » : point de sauvegarde volontaire (lieu de repos). */
  save(): void {
    if (!this.state) return;
    if (this.explore) {
      const p = this.state.player;
      this.state.lastRest = { zone: p.zone, x: p.x, y: p.y };
    }
    if (this.canSave()) {
      const r = this.saveTo('auto');
      this.toast(r.ok ? 'Partie sauvegardée.' : r.message);
    } else this.pendingSave = true;
  }

  async chase(species: string, from: [number, number], escape: [number, number, number, number]): Promise<'caught' | 'escaped'> {
    if (!this.explore) return 'escaped';
    return this.explore.chase(species, from, escape);
  }

  removeEntity(id: string): void {
    this.explore?.removeEntity(id);
  }

  zoneEternalNight(): boolean {
    return !!this.explore?.zone.eternalNight;
  }

  creatureName(species: string): string {
    return CREATURES[species]?.name ?? species;
  }
}

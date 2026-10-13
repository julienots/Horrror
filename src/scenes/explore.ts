import { ZONE_MUSIC } from '../audio/audio';
import { ambientLight, formatTime, phaseOf, PHASE_LABEL } from '../core/clock';
import { CHARACTERS } from '../data/characters';
import { CREATURES } from '../data/creatures';
import { QUESTS } from '../data/story';
import type { Dir, EntityDef, ZoneDef } from '../data/types';
import { ZONES } from '../data/zones';
import type { Game, Scene } from '../game';
import { WORLD_H, WORLD_W } from '../game';
import { CHAR_H, characterSprite } from '../render/characters';
import { creatureIcon } from '../render/creatures';
import { brambles, fogTexture, itemGlint, padlock, signpost, trainSprite } from '../render/props';
import { TS, tileCanvas, tileFrames, tileLight } from '../render/tiles';
import { hash } from '../render/pixel';
import { evalCondition } from '../systems/conditions';
import { fieldSkills } from '../systems/creatures';
import { rollEncounter } from '../systems/encounters';
import { newDirector, pickHorror, type HorrorDirector } from '../systems/horror';
import { has } from '../systems/inventory';
import { runScript } from '../systems/script';
import { UI_H, UI_W, type Painter } from '../ui/draw';
import { DIRS, ZoneMap, activeEntities, isBlocked, nearestWalkable, removedFlag, stepToward, variantKey, warpAt } from '../world/map';

const WALK = 0.2;
const RUN = 0.12;

interface Move {
  fx: number;
  fy: number;
  tx: number;
  ty: number;
  t: number;
  dur: number;
}

interface Chaser {
  species: string;
  x: number;
  y: number;
  px: number;
  py: number;
  t: number;
  escape: [number, number, number, number];
  resolve: (r: 'caught' | 'escaped') => void;
}

export class ExploreScene implements Scene {
  readonly kind = 'explore';
  opaque = true;
  zone!: ZoneDef;
  map!: ZoneMap;
  entities: EntityDef[] = [];
  busy = false;
  transitioning = false;
  chasing = false;
  private move: Move | null = null;
  private walkT = 0;
  private grace = 3;
  private bannerT = 0;
  private flickerT = 0;
  private timeAcc = 0;
  private variantT = 0;
  private variant = '';
  private stepsSinceHorror = 0;
  private director: HorrorDirector = newDirector();
  private npcDir = new Map<string, Dir>();
  private chaser: Chaser | null = null;
  private subtitle: { text: string; t: number } | null = null;
  private autosaveT = 0;
  private bumpT = 0;
  private menuFactory: (() => Scene) | null = null;

  constructor(private g: Game) {
    const s = g.state;
    if (!s) throw new Error('Pas de partie');
    this.loadZone(s.player.zone);
    void this.enterScripts();
  }

  setMenuFactory(f: () => Scene): void {
    this.menuFactory = f;
  }

  private get s() {
    return this.g.state!;
  }

  // ------------------------------------------------------------ Zones

  private loadZone(id: string): void {
    const z = ZONES[id] ?? ZONES.village;
    this.zone = z;
    this.map = new ZoneMap(z, this.s);
    this.variant = this.map.variantKey;
    this.refresh();
    this.s.flags[`visite_${z.id}`] = true;
    this.bannerT = 3;
    const music = z.music ? (z.music in ZONE_MUSIC ? ZONE_MUSIC[z.music] : z.music) : null;
    this.g.audio.playMusic(music ?? null);
    this.g.audio.ambience(z.ambience);
    // Sécurité : ne jamais apparaître dans un mur.
    const p = this.s.player;
    const spot = nearestWalkable(this.map, this.entities, p.x, p.y);
    if (spot && (spot[0] !== p.x || spot[1] !== p.y) && !warpAt(z, p.x, p.y)) {
      p.x = spot[0];
      p.y = spot[1];
    }
  }

  refresh(): void {
    this.entities = activeEntities(this.zone, this.s);
  }

  private async enterScripts(): Promise<void> {
    const z = this.zone;
    if (!z.onEnter) return;
    if (z.enterOnceFlag && this.s.flags[z.enterOnceFlag]) return;
    if (z.enterOnceFlag) this.s.flags[z.enterOnceFlag] = true;
    await this.run(z.onEnter);
  }

  private async run(cmds: NonNullable<EntityDef['script']>): Promise<void> {
    const wasBusy = this.busy;
    this.busy = true;
    try {
      await runScript(cmds, this.s, this.g);
    } catch (e) {
      console.error(e);
    } finally {
      this.busy = wasBusy;
      this.refresh();
      this.checkVariant();
    }
  }

  /** Changement de zone (ou déplacement interne) avec fondu. */
  async teleport(zoneId: string, x: number, y: number, dir: Dir, runEnter: boolean): Promise<void> {
    this.transitioning = true;
    this.move = null;
    await this.g.fadeTo(1, 0.25);
    const changed = zoneId !== this.zone.id;
    const p = this.s.player;
    p.zone = zoneId;
    p.x = x;
    p.y = y;
    p.dir = dir;
    if (changed) this.loadZone(zoneId);
    else this.refresh();
    this.grace = 4;
    await this.g.fadeTo(0, 0.25);
    this.transitioning = false;
    if (changed && runEnter) await this.enterScripts();
    if (changed) this.g.autosave();
  }

  removeEntity(id: string): void {
    this.s.flags[removedFlag(this.zone.id, id)] = true;
    this.refresh();
  }

  flicker(t: number): void {
    this.flickerT = t;
  }

  afterBattle(): void {
    this.grace = 3;
    this.refresh();
    this.restoreMusic();
  }

  restoreMusic(): void {
    const m = this.zone.music ? (this.zone.music in ZONE_MUSIC ? ZONE_MUSIC[this.zone.music] : this.zone.music) : null;
    this.g.audio.playMusic(m ?? null);
    this.g.audio.ambience(this.zone.ambience);
  }

  say(text: string): void {
    this.subtitle = { text, t: 4.5 };
  }

  private checkVariant(): void {
    const k = variantKey(this.zone, this.s);
    if (k === this.variant) return;
    this.map = new ZoneMap(this.zone, this.s);
    this.variant = k;
    this.refresh();
    // Si une case devient solide sous le joueur (maison n° 9), on le décale.
    const p = this.s.player;
    if (isBlocked(this.map, this.entities, p.x, p.y)) {
      const spot = nearestWalkable(this.map, this.entities, p.x, p.y);
      if (spot) {
        p.x = spot[0];
        p.y = spot[1];
        this.move = null;
      }
    }
  }

  // ------------------------------------------------------------ Poursuite

  chase(species: string, from: [number, number], escape: [number, number, number, number]): Promise<'caught' | 'escaped'> {
    return new Promise((resolve) => {
      this.chasing = true;
      this.g.audio.playMusic('boss');
      this.chaser = { species, x: from[0], y: from[1], px: from[0], py: from[1], t: 0.6, escape, resolve };
    });
  }

  private endChase(r: 'caught' | 'escaped'): void {
    const c = this.chaser;
    this.chaser = null;
    this.chasing = false;
    const music = this.zone.music ? (this.zone.music in ZONE_MUSIC ? ZONE_MUSIC[this.zone.music] : this.zone.music) : null;
    this.g.audio.playMusic(music ?? null);
    c?.resolve(r);
  }

  private updateChase(dt: number): void {
    const c = this.chaser;
    if (!c) return;
    const p = this.s.player;
    const [x1, y1, x2, y2] = c.escape;
    if (p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2) {
      this.endChase('escaped');
      return;
    }
    c.px += (c.x - c.px) * Math.min(1, dt * 10);
    c.py += (c.y - c.py) * Math.min(1, dt * 10);
    c.t -= dt;
    if (c.t <= 0) {
      c.t = 0.27;
      const next = stepToward(this.map, this.entities, c.x, c.y, p.x, p.y);
      if (next) {
        c.x = next[0];
        c.y = next[1];
      }
      if (Math.random() < 0.3) this.g.audio.sfx('cloches');
    }
    if (Math.abs(c.x - p.x) + Math.abs(c.y - p.y) <= 1) this.endChase('caught');
  }

  // ------------------------------------------------------------ Mise à jour

  update(dt: number, g: Game): void {
    if (this.transitioning) return;
    if (this.chasing) this.updateChase(dt);
    if (this.busy && !this.chasing) return;

    if (!this.chasing && (g.input.consume('menu') || g.input.consume('cancel')) && !this.move && this.menuFactory) {
      g.audio.sfx('confirm');
      g.push(this.menuFactory());
      return;
    }

    // Le temps passe (plus lentement à l'intérieur, figé dans la nuit éternelle)
    if (!this.zone.eternalNight) {
      this.timeAcc += dt;
      const rate = this.zone.indoor ? 3 : 1.2;
      while (this.timeAcc >= rate) {
        this.timeAcc -= rate;
        this.s.time += 1;
        if (this.s.time >= 1440) {
          this.s.time -= 1440;
          this.s.day += 1;
        }
      }
    }
    this.variantT -= dt;
    if (this.variantT <= 0) {
      this.variantT = 1;
      this.checkVariant();
    }
    this.autosaveT += dt;
    if (this.autosaveT > 120) {
      this.autosaveT = 0;
      g.autosave();
    }

    if (this.move) {
      this.move.t += dt;
      this.walkT += dt;
      if (this.move.t >= this.move.dur) {
        const m = this.move;
        this.move = null;
        this.s.player.x = m.tx;
        this.s.player.y = m.ty;
        void this.onStep(m.fx, m.fy);
      }
      return;
    }

    const dir = g.input.heldDir();
    if (dir) {
      const p = this.s.player;
      p.dir = dir;
      const [dx, dy] = DIRS[dir];
      const nx = p.x + dx;
      const ny = p.y + dy;
      if (!this.blockedForPlayer(nx, ny)) {
        const run = g.input.isHeld('run');
        this.move = { fx: p.x, fy: p.y, tx: nx, ty: ny, t: 0, dur: run ? RUN : WALK };
      } else {
        this.bumpT -= dt;
        if (this.bumpT <= 0) {
          g.audio.sfx('bump');
          this.bumpT = 0.35;
        }
      }
    }

    if (!this.chasing && g.input.consume('confirm')) void this.interact();
  }

  private blockedForPlayer(x: number, y: number): boolean {
    if (isBlocked(this.map, this.entities, x, y)) return true;
    if (this.chaser && this.chaser.x === x && this.chaser.y === y) return true;
    return false;
  }

  private async onStep(fromX: number, fromY: number): Promise<void> {
    const s = this.s;
    const p = s.player;
    s.steps += 1;
    if (s.repelSteps > 0) {
      s.repelSteps -= 1;
      if (s.repelSteps === 0) this.g.toast('L’encens s’est consumé.');
    }
    this.g.audio.footstep(this.map.tile(p.x, p.y).ground, this.g.input.isHeld('run'));
    if (this.grace > 0) this.grace -= 1;

    // Passage
    const w = warpAt(this.zone, p.x, p.y);
    if (w && !this.chasing) {
      if (evalCondition(s, w.when, { eternalNight: this.zone.eternalNight })) {
        if (w.sound && w.sound !== 'pas') this.g.audio.sfx(w.sound);
        this.busy = true;
        await this.teleport(w.to, w.tx, w.ty, w.dir ?? p.dir, true);
        this.busy = false;
      } else {
        this.busy = true;
        await this.g.say(w.locked ?? 'Le passage est bloqué.', '', 'neutre');
        // On recule d'un pas pour ne pas rester sur le passage.
        p.x = fromX;
        p.y = fromY;
        this.busy = false;
      }
      return;
    }

    // Déclencheurs au passage
    const trig = this.entities.find((e) => e.touch && e.x === p.x && e.y === p.y);
    if (trig?.script && !this.chasing) {
      await this.run(trig.script);
      return;
    }

    if (this.chasing) return;

    // Rencontre
    const roll = rollEncounter(this.zone, this.map, s, p.x, p.y, this.g.rng, this.grace);
    if (roll) {
      this.busy = true;
      this.g.audio.sfx('rencontre');
      await this.g.battle(roll.species, roll.level, { boss: false, noFlee: false });
      this.busy = false;
      return;
    }

    // Événements d'horreur contrôlés
    this.stepsSinceHorror += 1;
    if (this.stepsSinceHorror >= 6) {
      this.stepsSinceHorror = 0;
      const ev = pickHorror(this.director, s, this.zone.id, this.zone.theme, !!this.zone.eternalNight, this.g.time, this.g.rng, this.g.options.horror === 'attenue');
      if (ev) {
        void this.g.horror(ev.fx);
        if (ev.text) this.say(ev.text);
      }
    }
  }

  private facing(): [number, number] {
    const p = this.s.player;
    const [dx, dy] = DIRS[p.dir];
    return [p.x + dx, p.y + dy];
  }

  private interactable(): EntityDef | undefined {
    const p = this.s.player;
    const [fx, fy] = this.facing();
    let e = this.entities.find((x) => x.x === fx && x.y === fy && x.script && !x.touch);
    if (!e && this.map.ch(fx, fy) === 'C') {
      const [dx, dy] = DIRS[p.dir];
      e = this.entities.find((x) => x.x === fx + dx && x.y === fy + dy && x.script && !x.touch);
    }
    return e;
  }

  private async interact(): Promise<void> {
    const e = this.interactable();
    if (!e?.script) return;
    const p = this.s.player;
    if (e.kind === 'npc') {
      const opposite: Record<Dir, Dir> = { up: 'down', down: 'up', left: 'right', right: 'left' };
      this.npcDir.set(e.id, opposite[p.dir]);
    }
    if (e.kind === 'apparition' && e.sprite && CREATURES[e.sprite]) this.g.audio.cry(e.sprite);
    await this.run(e.script);
    this.npcDir.delete(e.id);
  }

  // ------------------------------------------------------------ Rendu

  private playerPixel(): [number, number] {
    const p = this.s.player;
    if (this.move) {
      const k = Math.min(1, this.move.t / this.move.dur);
      return [(this.move.fx + (this.move.tx - this.move.fx) * k) * TS, (this.move.fy + (this.move.ty - this.move.fy) * k) * TS];
    }
    return [p.x * TS, p.y * TS];
  }

  private camera(): [number, number] {
    const [px, py] = this.playerPixel();
    const mw = this.map.w * TS;
    const mh = this.map.h * TS;
    const cx = mw <= WORLD_W ? (mw - WORLD_W) / 2 : Math.max(0, Math.min(mw - WORLD_W, px + 8 - WORLD_W / 2));
    const cy = mh <= WORLD_H ? (mh - WORLD_H) / 2 : Math.max(0, Math.min(mh - WORLD_H, py + 8 - WORLD_H / 2));
    return [Math.round(cx), Math.round(cy)];
  }

  animate(dt: number): void {
    this.flickerT = Math.max(0, this.flickerT - dt);
    this.bannerT = Math.max(0, this.bannerT - dt);
    if (this.subtitle) {
      this.subtitle.t -= dt;
      if (this.subtitle.t <= 0) this.subtitle = null;
    }
  }

  renderWorld(w: CanvasRenderingContext2D, g: Game): void {
    const [cx, cy] = this.camera();
    const z = this.zone;
    const t = g.time;
    w.imageSmoothingEnabled = false;
    w.fillStyle = z.theme === 'seuil' ? '#e8e6e1' : '#050506';
    w.fillRect(0, 0, WORLD_W, WORLD_H);
    const x0 = Math.floor(cx / TS) - 1;
    const y0 = Math.floor(cy / TS) - 1;
    const x1 = Math.ceil((cx + WORLD_W) / TS) + 1;
    const y1 = Math.ceil((cy + WORLD_H) / TS) + 1;
    const indoor = !!z.indoor;
    for (let y = Math.max(0, y0); y < Math.min(this.map.h, y1); y++)
      for (let x = Math.max(0, x0); x < Math.min(this.map.w, x1); x++) {
        const ch = this.map.ch(x, y);
        const seed = hash(x, y, 17);
        const frame = Math.floor(t * 2 + seed * 4) % tileFrames(ch);
        const img = tileCanvas(ch, z.theme, { above: this.map.ch(x, y - 1), below: this.map.ch(x, y + 1), left: this.map.ch(x - 1, y), right: this.map.ch(x + 1, y), indoor }, seed, frame);
        w.drawImage(img, x * TS - cx, y * TS - cy);
      }

    // Entités et joueur triés par profondeur
    type Drawable = { y: number; draw: () => void };
    const list: Drawable[] = [];
    const frame2 = Math.floor(t * 2) % 2;
    for (const e of this.entities) {
      const ex = e.x * TS - cx;
      const ey = e.y * TS - cy;
      if (ex < -240 || ex > WORLD_W + 32 || ey < -40 || ey > WORLD_H + 32) continue;
      list.push({ y: e.y + 0.1, draw: () => this.drawEntity(w, e, ex, ey, t, frame2) });
    }
    const [ppx, ppy] = this.playerPixel();
    const moving = !!this.move;
    const pf = moving ? 1 + (Math.floor(this.walkT / 0.14) % 2) : 0;
    list.push({
      y: ppy / TS + 0.2,
      draw: () => {
        const img = characterSprite('joueur', this.s.player.dir, pf === 2 ? 0 : pf);
        w.drawImage(img, Math.round(ppx - cx), Math.round(ppy - cy - (CHAR_H - TS)));
      },
    });
    if (this.chaser) {
      const c = this.chaser;
      list.push({ y: c.py + 0.15, draw: () => w.drawImage(creatureIcon(c.species, frame2), Math.round(c.px * TS - cx - 4), Math.round(c.py * TS - cy - 10)) });
    }
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    this.renderLighting(w, cx, cy, ppx - cx + 8, ppy - cy + 6, t);
    this.renderFog(w, cx, cy, t);
    if (z.theme === 'seuil') this.renderGlitch(w, t);
    // Vignette
    const vg = w.createRadialGradient(WORLD_W / 2, WORLD_H / 2, WORLD_H * 0.35, WORLD_W / 2, WORLD_H / 2, WORLD_W * 0.62);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, z.theme === 'seuil' ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.65)');
    w.fillStyle = vg;
    w.fillRect(0, 0, WORLD_W, WORLD_H);
  }

  private drawEntity(w: CanvasRenderingContext2D, e: EntityDef, ex: number, ey: number, t: number, frame2: number): void {
    const p = this.s.player;
    const dist = Math.abs(e.x - p.x) + Math.abs(e.y - p.y);
    if (e.sprite === 'train') {
      w.drawImage(trainSprite(), ex - 7 * TS + 8, ey - 8);
      return;
    }
    if (e.sprite === 'ronces') {
      w.drawImage(brambles(), ex, ey);
      return;
    }
    if (e.sprite === 'cadenas') {
      w.drawImage(padlock(), ex, ey);
      return;
    }
    if (e.sprite && CHARACTERS[e.sprite]) {
      const dir = this.npcDir.get(e.id) ?? e.dir ?? 'down';
      const flick = e.sprite === 'silhouette' || e.sprite === 'elise' ? (Math.sin(t * 7 + e.x) > 0.6 ? 0.55 : 0.9) : 1;
      w.globalAlpha = flick;
      w.drawImage(characterSprite(e.sprite, dir, 0), ex, ey - (CHAR_H - TS));
      w.globalAlpha = 1;
      return;
    }
    if (e.sprite && CREATURES[e.sprite]) {
      const icon = creatureIcon(e.sprite, frame2);
      const beh = e.behavior ?? 'immobile';
      if (beh === 'reflet') {
        // Visible d'abord dans l'eau : reflet inversé et bleuté.
        w.save();
        w.globalAlpha = 0.45 + Math.sin(t * 2) * 0.1;
        w.translate(ex - 4, ey + 30);
        w.scale(1, -1);
        w.drawImage(icon, 0, 0);
        w.restore();
        if (dist <= 2) {
          w.globalAlpha = 0.35;
          w.drawImage(icon, ex - 4, ey - 10);
          w.globalAlpha = 1;
        }
        return;
      }
      if (beh === 'traque') {
        if (dist > 6) return;
        const jx = Math.sin(t * 13) > 0.92 ? 2 : 0;
        w.globalAlpha = dist > 3 ? 0.6 : 1;
        w.drawImage(icon, ex - 4 + jx, ey - 10);
        w.globalAlpha = 1;
        return;
      }
      const bob = Math.round(Math.sin(t * 2 + e.x) * 1);
      w.drawImage(icon, ex - 4, ey - 10 + bob);
      return;
    }
    if (e.kind === 'objet') {
      w.drawImage(itemGlint(Math.floor(t * 3 + e.x)), ex, ey);
      return;
    }
    if (e.sprite === 'panneau' && !this.map.tile(e.x, e.y).solid) w.drawImage(signpost(), ex, ey);
  }

  private lightCanvas: HTMLCanvasElement | null = null;

  private darkness(): number {
    const z = this.zone;
    const base = z.dark ?? 0;
    if (z.indoor) return base;
    const amb = ambientLight(this.s.time, z.eternalNight);
    return Math.max(base, (1 - amb) * 0.92);
  }

  private renderLighting(w: CanvasRenderingContext2D, cx: number, cy: number, plx: number, ply: number, t: number): void {
    let dark = this.darkness();
    if (this.flickerT > 0) dark = Math.min(0.97, dark + (Math.sin(t * 40) > 0 ? 0.55 : 0.2));
    if (dark < 0.03) return;
    if (!this.lightCanvas) {
      this.lightCanvas = document.createElement('canvas');
      this.lightCanvas.width = WORLD_W;
      this.lightCanvas.height = WORLD_H;
    }
    const lc = this.lightCanvas.getContext('2d') as CanvasRenderingContext2D;
    lc.globalCompositeOperation = 'source-over';
    lc.clearRect(0, 0, WORLD_W, WORLD_H);
    const tint = this.zone.eternalNight ? '8,10,22' : this.zone.theme === 'seuil' ? '240,238,233' : '4,5,10';
    lc.fillStyle = `rgba(${tint},${dark})`;
    lc.fillRect(0, 0, WORLD_W, WORLD_H);
    lc.globalCompositeOperation = 'destination-out';
    const hole = (x: number, y: number, r: number, strength = 1) => {
      const gr = lc.createRadialGradient(x, y, r * 0.15, x, y, r);
      gr.addColorStop(0, `rgba(0,0,0,${strength})`);
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      lc.fillStyle = gr;
      lc.fillRect(x - r, y - r, r * 2, r * 2);
    };
    // Lumière du joueur : la Veilleuse, la lampe, une compétence d'éclairage
    let r = 30;
    if (has(this.s, 'lampe_torche')) r += 34;
    if (fieldSkills(this.s).has('eclairer')) r += 22;
    if (this.flickerT > 0) r *= 0.6;
    r += Math.sin(t * 3.1) * 1.5;
    hole(plx, ply, r);
    // Tuiles lumineuses
    const x0 = Math.floor(cx / TS) - 4;
    const y0 = Math.floor(cy / TS) - 4;
    for (let y = Math.max(0, y0); y < Math.min(this.map.h, y0 + 20); y++)
      for (let x = Math.max(0, x0); x < Math.min(this.map.w, x0 + 30); x++) {
        const ch = this.map.ch(x, y);
        const L = tileLight(ch);
        if (L > 0) hole(x * TS - cx + 8, y * TS - cy + 4, L * TS * (0.92 + Math.sin(t * 5 + x) * 0.05), 0.9);
        // Fenêtres allumées des maisons (façade sous un toit)
        else if (ch === '#' && !this.zone.indoor && this.map.ch(x, y - 1) === 'R' && Math.floor(hash(x, y, 17) * 4) === 2) {
          const flick = Math.sin(t * 2.3 + x * 3) > -0.92 ? 1 : 0.3;
          hole(x * TS - cx + 6, y * TS - cy + 6, 1.4 * TS * flick, 0.7);
        }
      }
    for (const e of this.entities) if (e.light) hole(e.x * TS - cx + 8, e.y * TS - cy + 8, e.light * TS, 0.8);
    w.drawImage(this.lightCanvas, 0, 0);
    // Lueur chaude autour des lampes
    w.globalCompositeOperation = 'lighter';
    const glow = w.createRadialGradient(plx, ply, 0, plx, ply, r * 0.8);
    glow.addColorStop(0, `rgba(80,70,40,${0.12 * dark})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    w.fillStyle = glow;
    w.fillRect(plx - r, ply - r, r * 2, r * 2);
    w.globalCompositeOperation = 'source-over';
  }

  private renderFog(w: CanvasRenderingContext2D, cx: number, cy: number, t: number): void {
    const f = this.zone.fog ?? 0;
    if (f <= 0) return;
    const layers: Array<[number, number, number, number]> = [
      [1, 6, 0.32, 0.6],
      [2, -10, 0.22, 1.1],
    ];
    for (const [seed, speed, alpha, par] of layers) {
      const tex = fogTexture(seed);
      const S = 256;
      const ox = ((-(cx * par) + t * speed) % S + S) % S;
      const oy = ((-(cy * par) + t * speed * 0.3) % S + S) % S;
      w.globalAlpha = Math.min(0.9, f * alpha * (this.zone.theme === 'seuil' ? 0.6 : 1));
      for (let y = oy - S; y < WORLD_H; y += S) for (let x = ox - S; x < WORLD_W; x += S) w.drawImage(tex, x, y, S, S);
    }
    w.globalAlpha = 1;
  }

  private renderGlitch(w: CanvasRenderingContext2D, t: number): void {
    if (this.g.options.reduceFlashes) return;
    const n = Math.floor(t * 8);
    for (let i = 0; i < 3; i++) {
      if (hash(i, n, 3) < 0.6) continue;
      const y = Math.floor(hash(n, i, 5) * WORLD_H);
      const h = 1 + Math.floor(hash(i, n, 7) * 3);
      const dx = Math.floor((hash(n, i, 9) - 0.5) * 10);
      w.drawImage(this.g.world, 0, y, WORLD_W, h, dx, y, WORLD_W, h);
    }
  }

  renderUI(p: Painter, g: Game): void {
    const s = this.s;
    // Horloge
    const phase = phaseOf(s.time, this.zone.eternalNight);
    const label = this.zone.eternalNight ? '— h — · Nuit éternelle' : `${formatTime(s.time)} · ${PHASE_LABEL[phase]}`;
    p.panel(6, 6, Math.max(150, p.measure(label, 15) + 18), 22, { alpha: 0.85 });
    p.text(label, 14, 9, { size: 15, color: phase === 'minuit' ? '#c98a8a' : p.t.text });
    // Objectif principal
    const q = s.quests.q_main;
    if (q && !q.done) {
      const obj = QUESTS.q_main.stages[q.stage];
      const lines = p.wrap(obj, 300, 13).slice(0, 2);
      lines.forEach((l, i) => p.text(l, 10, 32 + i * 14, { size: 13, color: p.t.dim }));
    }
    // Bannière de zone
    if (this.bannerT > 0) {
      const a = Math.min(1, this.bannerT, (3 - this.bannerT) * 3);
      p.text(this.zone.name, UI_W / 2, 64, { size: 28, align: 'center', color: '#e8e2d2', alpha: a });
      p.text(this.zone.region, UI_W / 2, 92, { size: 15, align: 'center', color: p.t.dim, alpha: a });
    }
    // Sous-titres d'ambiance
    if (this.subtitle) {
      const a = Math.min(1, this.subtitle.t);
      const lines = p.wrap(this.subtitle.text, 460, 16);
      lines.forEach((l, i) => p.text(l, UI_W / 2, UI_H - 70 + i * 18 - lines.length * 9, { size: 16, align: 'center', color: '#c9c3b5', alpha: a }));
    }
    // Indication d'interaction
    if (!this.busy && !this.move && !this.chasing) {
      const e = this.interactable();
      if (e) p.text(g.input.lastDevice === 'manette' ? 'A : examiner' : 'Entrée : examiner', UI_W - 12, UI_H - 22, { size: 14, align: 'right', color: p.t.accent });
    }
    if (this.chasing) p.text('FUYEZ', UI_W / 2, 40, { size: 26, align: 'center', color: '#c94a4a', alpha: 0.6 + Math.sin(g.time * 8) * 0.3 });
    if (s.repelSteps > 0) p.text(`Encens : ${s.repelSteps}`, 10, UI_H - 20, { size: 13, color: p.t.dim });
  }
}

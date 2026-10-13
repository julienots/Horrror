import { CREATURES } from '../data/creatures';
import type { Ground } from '../data/tiles';

// Moteur audio entièrement synthétisé (WebAudio) : ambiances, musiques,
// effets, cris des Rémanents. Trois bus séparés : musique, effets, ambiance.

type Track = {
  bpm: number;
  steps: number; // longueur du motif en doubles-croches
  step: (a: AudioEngine, i: number, t: number) => void;
};

const A4 = 440;
const freq = (semi: number) => A4 * Math.pow(2, semi / 12);

// La berceuse d'Élise (fil rouge musical) : demi-tons depuis La4, null = tenue
const LULLABY: Array<number | null> = [7, 5, 3, 2, null, 0, 3, 2, 0, -1, null, null, 0, 2, 3, 5, 3, 2, 3, null, 0, 0, null, null];

export const ZONE_MUSIC: Record<string, string | null> = {
  village: 'berceuse',
  ecole: 'couloirs',
  foret: 'brume',
  marais: 'brume',
  mine: 'brume',
  gare: 'quai',
  hopital: 'couloirs',
  cendriers: 'quai',
  institut: 'couloirs',
  seuil: 'seuil',
  silence: null,
};

export class AudioEngine {
  ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfxBus!: GainNode;
  private amb!: GainNode;
  private echo!: DelayNode;
  private noise!: AudioBuffer;
  private ambNodes: AudioNode[] = [];
  private ambId: string | null = null;
  private ambTimer = 0;
  private track: Track | null = null;
  private trackId: string | null = null;
  private nextStep = 0;
  private stepIndex = 0;
  private musicDuck = 1;
  vol = { music: 0.6, sfx: 0.7, amb: 0.6 };

  init(): void {
    if (this.ctx) return;
    const AC = (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext) as typeof AudioContext | undefined;
    if (!AC) return;
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.music = c.createGain();
    this.sfxBus = c.createGain();
    this.amb = c.createGain();
    // Écho discret partagé (donne de l'espace aux couloirs vides)
    this.echo = c.createDelay(1.5);
    this.echo.delayTime.value = 0.38;
    const fb = c.createGain();
    fb.gain.value = 0.35;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1800;
    this.echo.connect(lp).connect(fb).connect(this.echo);
    const wet = c.createGain();
    wet.gain.value = 0.5;
    lp.connect(wet).connect(this.master);
    for (const g of [this.music, this.sfxBus, this.amb]) g.connect(this.master);
    this.noise = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.applyVolumes();
    if (this.pendingAmb) this.ambience(this.pendingAmb);
    if (this.pendingMusic !== undefined) this.playMusic(this.pendingMusic);
  }

  private pendingAmb: string | null = null;
  private pendingMusic: string | null | undefined = undefined;

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number, amb: number): void {
    this.vol = { music, sfx, amb };
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(this.vol.music * 0.55 * this.musicDuck, t, 0.1);
    this.sfxBus.gain.setTargetAtTime(this.vol.sfx * 0.8, t, 0.05);
    this.amb.gain.setTargetAtTime(this.vol.amb * 0.6, t, 0.2);
  }

  /** Baisse temporaire de la musique (moments de tension). */
  duck(on: boolean): void {
    this.musicDuck = on ? 0.25 : 1;
    this.applyVolumes();
  }

  // ------------------------------------------------------------ Primitives

  private env(g: GainNode, t: number, a: number, peak: number, decay: number, sustain = 0): void {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, sustain || 0.0001), t + a + decay);
  }

  tone(
    f: number,
    t: number,
    dur: number,
    opts: { type?: OscillatorType; gain?: number; bus?: 'music' | 'sfx' | 'amb'; attack?: number; glide?: number; detune?: number; echo?: number; filter?: number } = {},
  ): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const o = c.createOscillator();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(f, t);
    if (opts.glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * opts.glide), t + dur);
    if (opts.detune) o.detune.value = opts.detune;
    const g = c.createGain();
    this.env(g, t, opts.attack ?? 0.005, opts.gain ?? 0.2, dur);
    let node: AudioNode = o.connect(g);
    if (opts.filter) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = opts.filter;
      node = g.connect(lp);
    }
    const bus = opts.bus === 'music' ? this.music : opts.bus === 'amb' ? this.amb : this.sfxBus;
    node.connect(bus);
    if (opts.echo) {
      const e = c.createGain();
      e.gain.value = opts.echo;
      node.connect(e).connect(this.echo);
    }
    o.start(t);
    o.stop(t + (opts.attack ?? 0.005) + dur + 0.05);
  }

  noiseHit(
    t: number,
    dur: number,
    opts: { type?: BiquadFilterType; freq?: number; q?: number; gain?: number; bus?: 'music' | 'sfx' | 'amb'; attack?: number; sweep?: number; echo?: number } = {},
  ): void {
    if (!this.ctx) return;
    const c = this.ctx;
    const s = c.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = c.createBiquadFilter();
    f.type = opts.type ?? 'bandpass';
    f.frequency.setValueAtTime(opts.freq ?? 1000, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(Math.max(30, (opts.freq ?? 1000) * opts.sweep), t + dur);
    f.Q.value = opts.q ?? 1;
    const g = c.createGain();
    this.env(g, t, opts.attack ?? 0.003, opts.gain ?? 0.2, dur);
    const bus = opts.bus === 'music' ? this.music : opts.bus === 'amb' ? this.amb : this.sfxBus;
    s.connect(f).connect(g).connect(bus);
    if (opts.echo) {
      const e = c.createGain();
      e.gain.value = opts.echo;
      g.connect(e).connect(this.echo);
    }
    s.start(t, Math.random() * 1.5);
    s.stop(t + (opts.attack ?? 0.003) + dur + 0.05);
  }

  private now(): number {
    return this.ctx ? this.ctx.currentTime + 0.01 : 0;
  }

  // ------------------------------------------------------------ Effets

  sfx(id: string): void {
    if (!this.ctx) return;
    const t = this.now();
    switch (id) {
      case 'menu':
        this.tone(660, t, 0.05, { type: 'square', gain: 0.04, filter: 2000 });
        break;
      case 'confirm':
        this.tone(520, t, 0.06, { type: 'square', gain: 0.05, filter: 2500 });
        this.tone(780, t + 0.05, 0.08, { type: 'square', gain: 0.04, filter: 2500 });
        break;
      case 'cancel':
        this.tone(400, t, 0.08, { type: 'square', gain: 0.05, glide: 0.7, filter: 1800 });
        break;
      case 'bump':
        this.noiseHit(t, 0.06, { type: 'lowpass', freq: 300, gain: 0.12 });
        break;
      case 'texte':
        this.tone(300 + Math.random() * 40, t, 0.02, { type: 'square', gain: 0.012, filter: 1200 });
        break;
      case 'porte':
        this.tone(180, t, 0.5, { type: 'sawtooth', gain: 0.05, glide: 1.6, filter: 900, attack: 0.05 });
        this.noiseHit(t + 0.45, 0.12, { type: 'lowpass', freq: 200, gain: 0.25 });
        break;
      case 'escalier':
        for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.13, 0.06, { type: 'lowpass', freq: 400 - i * 40, gain: 0.15 });
        break;
      case 'objet':
        [0, 4, 7, 12].forEach((s, i) => this.tone(freq(s + 3), t + i * 0.07, 0.25, { type: 'triangle', gain: 0.07, echo: 0.3 }));
        break;
      case 'indice':
        this.tone(freq(-5), t, 1.6, { type: 'sine', gain: 0.1, echo: 0.6 });
        this.tone(freq(1), t + 0.02, 1.4, { type: 'sine', gain: 0.06, echo: 0.6 });
        this.tone(freq(6), t + 0.3, 1.2, { type: 'triangle', gain: 0.04, echo: 0.6 });
        break;
      case 'quete':
        [0, 3, 7, 10].forEach((s, i) => this.tone(freq(s - 2), t + i * 0.12, 0.5, { type: 'triangle', gain: 0.06, echo: 0.4 }));
        break;
      case 'soin':
        [0, 5, 9, 12, 17].forEach((s, i) => this.tone(freq(s), t + i * 0.06, 0.35, { type: 'sine', gain: 0.05, echo: 0.4 }));
        break;
      case 'lien':
        [0, 3, 7, 12, 15, 19].forEach((s, i) => this.tone(freq(s - 5), t + i * 0.09, 0.6, { type: 'triangle', gain: 0.06, echo: 0.5 }));
        break;
      case 'secousse':
        this.noiseHit(t, 0.3, { type: 'lowpass', freq: 600, gain: 0.25, sweep: 0.3 });
        break;
      case 'shake':
        this.tone(220, t, 0.15, { type: 'triangle', gain: 0.08, glide: 0.8 });
        this.noiseHit(t, 0.1, { type: 'highpass', freq: 3000, gain: 0.05 });
        break;
      case 'echec':
        this.tone(300, t, 0.4, { type: 'sawtooth', gain: 0.06, glide: 0.4, filter: 1200 });
        break;
      case 'telephone':
        for (let r = 0; r < 2; r++)
          for (let i = 0; i < 14; i++) {
            this.tone(1100, t + r * 0.9 + i * 0.04, 0.02, { type: 'square', gain: 0.04, filter: 3000 });
            this.tone(1300, t + r * 0.9 + i * 0.04 + 0.02, 0.02, { type: 'square', gain: 0.03, filter: 3000 });
          }
        break;
      case 'cloches':
        this.bells(t, 3);
        break;
      case 'coups':
        for (let i = 0; i < 3; i++) this.noiseHit(t + i * 0.45, 0.12, { type: 'lowpass', freq: 160, gain: 0.45, echo: 0.4 });
        this.noiseHit(t + 1.6, 0.12, { type: 'lowpass', freq: 200, gain: 0.6, echo: 0.4 });
        break;
      case 'pas':
        for (let i = 0; i < 5; i++) this.noiseHit(t + i * 0.42, 0.05, { type: 'lowpass', freq: 500, gain: 0.12 - i * 0.015, echo: 0.3 });
        break;
      case 'souffle':
        this.noiseHit(t, 2.2, { type: 'bandpass', freq: 500, q: 0.7, gain: 0.12, attack: 0.9, sweep: 0.6, echo: 0.3 });
        break;
      case 'radio':
        this.noiseHit(t, 1.4, { type: 'bandpass', freq: 2200, q: 0.5, gain: 0.12, sweep: 0.8 });
        this.tone(freq(-12), t + 0.3, 0.6, { type: 'square', gain: 0.025, filter: 900, detune: 30 });
        this.tone(freq(-9), t + 0.6, 0.4, { type: 'square', gain: 0.02, filter: 900, detune: -20 });
        break;
      case 'chuchotement':
        for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.18 + Math.random() * 0.05, 0.14, { type: 'bandpass', freq: 2500 + Math.random() * 1500, q: 4, gain: 0.05, echo: 0.6 });
        break;
      case 'lumieres':
        for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.09, 0.04, { type: 'highpass', freq: 4000, gain: 0.05 });
        this.tone(120, t, 0.6, { type: 'sawtooth', gain: 0.03, filter: 400 });
        break;
      case 'flash':
        this.noiseHit(t, 0.8, { type: 'highpass', freq: 1500, gain: 0.12, sweep: 2 });
        this.tone(freq(-24), t, 1.2, { type: 'sawtooth', gain: 0.08, filter: 600 });
        this.tone(freq(-18), t, 1.2, { type: 'sawtooth', gain: 0.06, filter: 600 });
        break;
      case 'silhouette':
        this.tone(freq(-30), t, 2, { type: 'sine', gain: 0.12, attack: 0.5 });
        this.tone(freq(-29), t, 2, { type: 'sine', gain: 0.1, attack: 0.5 });
        break;
      case 'train':
        [0, 4, 7].forEach((s) => this.tone(freq(s - 17), t, 1.6, { type: 'sawtooth', gain: 0.05, filter: 900, attack: 0.1 }));
        for (let i = 0; i < 8; i++) this.noiseHit(t + 1.2 + i * 0.25, 0.06, { type: 'bandpass', freq: 700, gain: 0.1 });
        break;
      case 'mecanisme':
        this.noiseHit(t, 0.08, { type: 'bandpass', freq: 1800, q: 3, gain: 0.2 });
        this.noiseHit(t + 0.12, 0.2, { type: 'lowpass', freq: 300, gain: 0.25 });
        this.tone(140, t + 0.1, 0.3, { type: 'square', gain: 0.04, filter: 500 });
        break;
      case 'feu':
        for (let i = 0; i < 12; i++) this.noiseHit(t + Math.random() * 1.2, 0.03, { type: 'highpass', freq: 2000 + Math.random() * 3000, gain: 0.08 });
        this.noiseHit(t, 1.2, { type: 'lowpass', freq: 500, gain: 0.08, attack: 0.2 });
        break;
      case 'tissu':
        this.noiseHit(t, 0.4, { type: 'bandpass', freq: 1200, q: 0.5, gain: 0.08, attack: 0.1 });
        break;
      case 'rencontre':
        this.tone(freq(-12), t, 0.9, { type: 'sawtooth', gain: 0.08, glide: 0.5, filter: 1400 });
        this.tone(freq(-6), t, 0.9, { type: 'sawtooth', gain: 0.06, glide: 0.5, filter: 1400 });
        this.noiseHit(t, 0.7, { type: 'highpass', freq: 2500, gain: 0.08, sweep: 0.3 });
        break;
      case 'coup':
        this.noiseHit(t, 0.12, { type: 'lowpass', freq: 900, gain: 0.3, sweep: 0.3 });
        this.tone(140, t, 0.15, { type: 'square', gain: 0.06, glide: 0.5, filter: 800 });
        break;
      case 'critique':
        this.noiseHit(t, 0.2, { type: 'bandpass', freq: 2400, q: 1, gain: 0.25 });
        this.tone(90, t, 0.3, { type: 'sawtooth', gain: 0.1, glide: 0.5, filter: 900 });
        break;
      case 'rate':
        this.noiseHit(t, 0.25, { type: 'bandpass', freq: 600, gain: 0.08, sweep: 3 });
        break;
      case 'dissipe':
        this.tone(freq(-5), t, 1.2, { type: 'triangle', gain: 0.1, glide: 0.3, echo: 0.4 });
        this.noiseHit(t, 1.0, { type: 'bandpass', freq: 800, gain: 0.08, sweep: 0.2 });
        break;
      case 'niveau':
        [0, 4, 7, 12].forEach((s, i) => this.tone(freq(s), t + i * 0.08, 0.3, { type: 'square', gain: 0.04, filter: 2200 }));
        break;
      case 'transformation':
        for (let i = 0; i < 16; i++) this.tone(freq(-12 + i), t + i * 0.12, 0.3, { type: 'triangle', gain: 0.05, echo: 0.4 });
        this.noiseHit(t + 1.9, 1.2, { type: 'highpass', freq: 800, gain: 0.12, sweep: 3 });
        break;
      case 'statut':
        this.tone(freq(-8), t, 0.4, { type: 'sine', gain: 0.07, glide: 1.06 });
        this.tone(freq(-7), t, 0.4, { type: 'sine', gain: 0.07, glide: 0.94 });
        break;
    }
  }

  /** Sons d'attaque selon l'effet visuel. */
  attack(fx: string): void {
    if (!this.ctx) return;
    const t = this.now();
    switch (fx) {
      case 'slash':
        this.noiseHit(t, 0.18, { type: 'highpass', freq: 1800, gain: 0.15, sweep: 0.4 });
        break;
      case 'wave':
        this.tone(freq(-10), t, 0.5, { type: 'sine', gain: 0.1, glide: 1.5, echo: 0.4 });
        this.tone(freq(-9), t, 0.5, { type: 'sine', gain: 0.08, glide: 1.45, echo: 0.4 });
        break;
      case 'shards':
        for (let i = 0; i < 6; i++) this.tone(2000 + Math.random() * 2000, t + i * 0.04, 0.08, { type: 'triangle', gain: 0.04 });
        break;
      case 'ash':
        this.sfx('feu');
        break;
      case 'void':
        this.tone(freq(-26), t, 0.7, { type: 'sine', gain: 0.18, glide: 0.5 });
        this.noiseHit(t, 0.6, { type: 'lowpass', freq: 300, gain: 0.1, sweep: 0.3 });
        break;
      case 'dream':
        [0, 5, 10].forEach((s, i) => this.tone(freq(s + 3), t + i * 0.08, 0.5, { type: 'sine', gain: 0.05, echo: 0.6, detune: 15 }));
        break;
      case 'roots':
        this.noiseHit(t, 0.35, { type: 'lowpass', freq: 400, gain: 0.2, sweep: 0.5 });
        this.noiseHit(t + 0.1, 0.1, { type: 'bandpass', freq: 1500, q: 3, gain: 0.1 });
        break;
      case 'static':
        this.noiseHit(t, 0.4, { type: 'bandpass', freq: 3000, q: 0.5, gain: 0.12 });
        this.tone(60, t, 0.4, { type: 'square', gain: 0.05, filter: 500 });
        break;
      case 'bell':
        this.bells(t, 3);
        break;
      case 'heal':
        this.sfx('soin');
        break;
      case 'buff':
        [0, 7, 12].forEach((s, i) => this.tone(freq(s - 5), t + i * 0.06, 0.25, { type: 'triangle', gain: 0.05 }));
        break;
    }
  }

  private bells(t: number, n: number): void {
    for (let i = 0; i < n; i++) {
      const b = freq(10 + (i % 2) * 3);
      for (const [m, g] of [[1, 0.06], [2.76, 0.03], [5.4, 0.015]] as Array<[number, number]>) this.tone(b * m, t + i * 0.55, 1.6, { type: 'sine', gain: g, echo: 0.5 });
    }
  }

  cry(species: string): void {
    const d = CREATURES[species];
    if (!this.ctx || !d) return;
    const t = this.now();
    d.cry.pattern.forEach((m, i) => {
      this.tone(d.cry.base * m, t + i * 0.12, 0.22, { type: d.cry.shape, gain: 0.06, glide: 0.92, filter: 2600, echo: 0.3 });
      this.tone(d.cry.base * m * 1.01, t + i * 0.12, 0.22, { type: 'sine', gain: 0.03, glide: 0.9 });
    });
    if (d.cry.noise) this.noiseHit(t, 0.12 * d.cry.pattern.length, { type: 'bandpass', freq: d.cry.base * 2, q: 1.5, gain: 0.08 * d.cry.noise * 2 });
  }

  footstep(ground: Ground, run: boolean): void {
    if (!this.ctx) return;
    const t = this.now();
    const g = run ? 0.09 : 0.065;
    switch (ground) {
      case 'herbe':
        this.noiseHit(t, 0.07, { type: 'highpass', freq: 2500, gain: g * 0.6 });
        break;
      case 'terre':
        this.noiseHit(t, 0.06, { type: 'bandpass', freq: 700, gain: g });
        break;
      case 'bois':
        this.noiseHit(t, 0.05, { type: 'lowpass', freq: 500, gain: g * 1.4 });
        this.tone(160, t, 0.05, { type: 'triangle', gain: g * 0.4 });
        break;
      case 'pierre':
      case 'carrelage':
        this.noiseHit(t, 0.035, { type: 'bandpass', freq: ground === 'carrelage' ? 3200 : 1800, q: 2, gain: g * 1.2, echo: 0.15 });
        break;
      case 'eau':
        this.noiseHit(t, 0.16, { type: 'bandpass', freq: 1100, q: 0.8, gain: g * 1.2, sweep: 0.6 });
        break;
      case 'cendre':
        this.noiseHit(t, 0.1, { type: 'highpass', freq: 1200, gain: g * 0.8 });
        break;
      case 'metal':
        this.tone(900, t, 0.06, { type: 'triangle', gain: g * 0.5 });
        break;
      case 'vide':
        this.tone(freq(12) + Math.random() * 20, t, 0.25, { type: 'sine', gain: g * 0.3, echo: 0.5 });
        break;
    }
  }

  // ------------------------------------------------------------ Ambiances

  ambience(id: string | null): void {
    if (!this.ctx) {
      this.pendingAmb = id;
      return;
    }
    if (id === this.ambId) return;
    const c = this.ctx;
    const t = c.currentTime;
    for (const n of this.ambNodes) {
      if (n instanceof GainNode) {
        n.gain.setTargetAtTime(0, t, 0.6);
      }
      const stop = n as AudioScheduledSourceNode;
      if (typeof stop.stop === 'function') {
        try {
          stop.stop(t + 3);
        } catch {
          /* déjà arrêté */
        }
      }
    }
    this.ambNodes = [];
    this.ambId = id;
    if (!id || id === 'silence') return;
    const cfg = AMBIENCES[id] ?? AMBIENCES.vent;
    const out = c.createGain();
    out.gain.value = 0;
    out.gain.setTargetAtTime(cfg.level, t, 1.2);
    out.connect(this.amb);
    this.ambNodes.push(out);
    if (cfg.noise) {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const f = c.createBiquadFilter();
      f.type = cfg.noise.type;
      f.frequency.value = cfg.noise.freq;
      f.Q.value = cfg.noise.q;
      const g = c.createGain();
      g.gain.value = cfg.noise.gain;
      // Lente modulation (vent qui respire)
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.07 + Math.random() * 0.05;
      const lg = c.createGain();
      lg.gain.value = cfg.noise.freq * 0.4;
      lfo.connect(lg).connect(f.frequency);
      s.connect(f).connect(g).connect(out);
      s.start();
      lfo.start();
      this.ambNodes.push(s, lfo);
    }
    for (const dr of cfg.drones ?? []) {
      const o = c.createOscillator();
      o.type = dr.type;
      o.frequency.value = dr.freq;
      const g = c.createGain();
      g.gain.value = dr.gain;
      const lfo = c.createOscillator();
      lfo.frequency.value = 0.05 + Math.random() * 0.1;
      const lg = c.createGain();
      lg.gain.value = dr.gain * 0.6;
      lfo.connect(lg).connect(g.gain);
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 700;
      o.connect(lp).connect(g).connect(out);
      o.start();
      lfo.start();
      this.ambNodes.push(o, lfo);
    }
  }

  /** Petits sons ponctuels d'ambiance (gouttes, craquements, tic-tac). */
  private ambEvents(dt: number): void {
    if (!this.ctx || !this.ambId) return;
    const cfg = AMBIENCES[this.ambId];
    if (!cfg?.events) return;
    this.ambTimer -= dt;
    if (this.ambTimer > 0) return;
    this.ambTimer = cfg.every * (0.5 + Math.random());
    const t = this.now();
    const e = cfg.events[Math.floor(Math.random() * cfg.events.length)];
    switch (e) {
      case 'goutte':
        this.tone(1400 + Math.random() * 900, t, 0.12, { type: 'sine', gain: 0.05, glide: 0.5, bus: 'amb', echo: 0.5 });
        break;
      case 'craquement':
        this.noiseHit(t, 0.2, { type: 'bandpass', freq: 400 + Math.random() * 300, q: 6, gain: 0.08, bus: 'amb' });
        break;
      case 'tictac':
        for (let i = 0; i < 6; i++) this.noiseHit(t + i * 0.5, 0.015, { type: 'highpass', freq: 5000, gain: 0.05, bus: 'amb' });
        break;
      case 'oiseau':
        this.tone(1800 + Math.random() * 600, t, 0.15, { type: 'sine', gain: 0.02, glide: 0.7, bus: 'amb', echo: 0.6 });
        break;
      case 'grenouille':
        this.tone(140, t, 0.12, { type: 'square', gain: 0.02, filter: 500, bus: 'amb' });
        this.tone(130, t + 0.15, 0.12, { type: 'square', gain: 0.02, filter: 500, bus: 'amb' });
        break;
      case 'bip':
        this.tone(1760, t, 0.06, { type: 'square', gain: 0.012, filter: 3000, bus: 'amb' });
        break;
      case 'grondement':
        this.noiseHit(t, 2.5, { type: 'lowpass', freq: 90, gain: 0.25, attack: 1, bus: 'amb' });
        break;
      case 'metal':
        this.tone(220 + Math.random() * 200, t, 1.2, { type: 'triangle', gain: 0.02, bus: 'amb', echo: 0.6 });
        break;
      case 'chant':
        LULLABY.slice(0, 6).forEach((n, i) => n !== null && this.tone(freq(n - 12), t + i * 0.6, 0.8, { type: 'sine', gain: 0.012, bus: 'amb', echo: 0.8, detune: 20 }));
        break;
      case 'clac':
        for (let i = 0; i < 4; i++) this.noiseHit(t + i * 0.3, 0.05, { type: 'bandpass', freq: 600, gain: 0.08, bus: 'amb' });
        break;
    }
  }

  // ------------------------------------------------------------ Musique

  playMusic(id: string | null): void {
    if (!this.ctx) {
      this.pendingMusic = id;
      return;
    }
    if (id === this.trackId) return;
    this.trackId = id;
    this.track = id ? TRACKS[id] ?? null : null;
    this.stepIndex = 0;
    this.nextStep = this.ctx.currentTime + 0.3;
  }

  get currentMusic(): string | null {
    return this.trackId;
  }

  update(dt: number): void {
    if (!this.ctx) return;
    this.ambEvents(dt);
    if (!this.track) return;
    const spb = 60 / this.track.bpm / 4;
    while (this.nextStep < this.ctx.currentTime + 0.25) {
      this.track.step(this, this.stepIndex % this.track.steps, this.nextStep);
      this.stepIndex++;
      this.nextStep += spb;
    }
  }
}

interface AmbienceDef {
  level: number;
  noise?: { type: BiquadFilterType; freq: number; q: number; gain: number };
  drones?: Array<{ type: OscillatorType; freq: number; gain: number }>;
  events?: string[];
  every: number;
}

const AMBIENCES: Record<string, AmbienceDef> = {
  vent: { level: 0.5, noise: { type: 'bandpass', freq: 420, q: 0.6, gain: 0.25 }, every: 9, events: ['craquement'] },
  village: { level: 0.5, noise: { type: 'bandpass', freq: 380, q: 0.5, gain: 0.22 }, drones: [{ type: 'sine', freq: 55, gain: 0.05 }], every: 7, events: ['oiseau', 'craquement', 'metal'] },
  foret: { level: 0.6, noise: { type: 'bandpass', freq: 600, q: 0.4, gain: 0.25 }, drones: [{ type: 'sine', freq: 49, gain: 0.05 }], every: 5, events: ['craquement', 'oiseau', 'craquement'] },
  ecole: { level: 0.4, noise: { type: 'lowpass', freq: 200, q: 0.5, gain: 0.12 }, every: 6, events: ['tictac', 'craquement', 'chant'] },
  hopital: { level: 0.45, noise: { type: 'highpass', freq: 3000, q: 0.5, gain: 0.03 }, drones: [{ type: 'sawtooth', freq: 120, gain: 0.012 }, { type: 'sine', freq: 60, gain: 0.03 }], every: 5, events: ['goutte', 'bip', 'metal'] },
  gare: { level: 0.5, noise: { type: 'bandpass', freq: 300, q: 0.7, gain: 0.25 }, drones: [{ type: 'sine', freq: 41, gain: 0.04 }], every: 8, events: ['metal', 'craquement'] },
  marais: { level: 0.6, noise: { type: 'lowpass', freq: 500, q: 0.5, gain: 0.18 }, drones: [{ type: 'sine', freq: 46, gain: 0.04 }], every: 4, events: ['grenouille', 'goutte', 'grenouille'] },
  mine: { level: 0.55, noise: { type: 'lowpass', freq: 140, q: 0.6, gain: 0.25 }, drones: [{ type: 'sine', freq: 36, gain: 0.06 }], every: 4, events: ['goutte', 'goutte', 'grondement', 'chant'] },
  cendriers: { level: 0.5, noise: { type: 'bandpass', freq: 1800, q: 0.3, gain: 0.05 }, drones: [{ type: 'triangle', freq: 58, gain: 0.04 }, { type: 'sine', freq: 87, gain: 0.02 }], every: 9, events: ['chant', 'metal', 'craquement'] },
  institut: { level: 0.5, drones: [{ type: 'sawtooth', freq: 100, gain: 0.015 }, { type: 'sine', freq: 50, gain: 0.04 }], every: 3, events: ['bip', 'bip', 'metal'] },
  seuil: { level: 0.5, drones: [{ type: 'sine', freq: 880, gain: 0.008 }, { type: 'sine', freq: 1320.5, gain: 0.006 }, { type: 'sine', freq: 55, gain: 0.05 }], every: 7, events: ['chant'] },
  interieur: { level: 0.35, noise: { type: 'lowpass', freq: 180, q: 0.5, gain: 0.1 }, every: 8, events: ['tictac', 'craquement'] },
  maison_nuit: { level: 0.35, drones: [{ type: 'sine', freq: 50, gain: 0.04 }], every: 6, events: ['tictac', 'craquement'] },
  cendres: { level: 0.5, noise: { type: 'highpass', freq: 1500, q: 0.5, gain: 0.06 }, drones: [{ type: 'sine', freq: 44, gain: 0.05 }], every: 3, events: ['craquement'] },
  train: { level: 0.55, noise: { type: 'lowpass', freq: 250, q: 0.5, gain: 0.2 }, every: 2.4, events: ['clac'] },
  silence: { level: 0, every: 999 },
};

const TRACKS: Record<string, Track> = {
  berceuse: {
    bpm: 66,
    steps: 96, // 24 noires
    step(a, i, t) {
      if (i % 4 === 0) {
        const n = LULLABY[(i / 4) % LULLABY.length];
        if (n !== null) {
          a.tone(freq(n), t, 1.2, { type: 'triangle', gain: 0.07, bus: 'music', echo: 0.35 });
          a.tone(freq(n + 12), t, 0.4, { type: 'sine', gain: 0.02, bus: 'music', echo: 0.35, detune: 8 });
        }
      }
      if (i % 48 === 0) {
        a.tone(freq(-24), t, 6, { type: 'sine', gain: 0.06, bus: 'music', attack: 1.5 });
        a.tone(freq(-17), t, 6, { type: 'sine', gain: 0.03, bus: 'music', attack: 1.5 });
      }
      if (i % 48 === 24) a.tone(freq(-28), t, 6, { type: 'sine', gain: 0.05, bus: 'music', attack: 1.5 });
    },
  },
  brume: {
    bpm: 50,
    steps: 128,
    step(a, i, t) {
      const chords = [[-24, -12, -9, -5], [-28, -16, -12, -9], [-31, -19, -14, -10], [-29, -17, -13, -8]];
      if (i % 32 === 0) for (const s of chords[(i / 32) % 4]) a.tone(freq(s), t, 7, { type: 'sawtooth', gain: 0.012, bus: 'music', attack: 2.5, filter: 600 });
      if (i % 64 === 40) {
        const k = Math.floor(Math.random() * (LULLABY.length - 4));
        LULLABY.slice(k, k + 3).forEach((n, j) => n !== null && a.tone(freq(n), t + j * 0.9, 1.3, { type: 'sine', gain: 0.03, bus: 'music', echo: 0.6, detune: -25 }));
      }
    },
  },
  couloirs: {
    bpm: 58,
    steps: 64,
    step(a, i, t) {
      if (i % 16 === 0) {
        a.tone(55, t, 0.25, { type: 'sine', gain: 0.12, bus: 'music' });
        a.tone(52, t + 0.28, 0.3, { type: 'sine', gain: 0.08, bus: 'music' });
      }
      if (i % 8 === 4 && Math.random() < 0.45) {
        const scale = [0, 1, 3, 5, 7, 8, 11];
        a.tone(freq(scale[Math.floor(Math.random() * scale.length)] + (Math.random() < 0.5 ? 0 : -12)), t, 1.5, { type: 'sine', gain: 0.035, bus: 'music', echo: 0.7 });
      }
      if (i === 32) a.tone(freq(-18), t, 4, { type: 'triangle', gain: 0.02, bus: 'music', attack: 1 });
    },
  },
  quai: {
    bpm: 72,
    steps: 64,
    step(a, i, t) {
      const bass = [-24, null, -24, -21, null, -19, -17, null];
      if (i % 4 === 0) {
        const n = bass[(i / 4) % bass.length];
        if (n !== null) a.tone(freq(n), t, 0.7, { type: 'triangle', gain: 0.06, bus: 'music', filter: 500 });
      }
      if (i % 32 === 16) for (const [m, g] of [[1, 0.025], [2.76, 0.012]] as Array<[number, number]>) a.tone(freq(7) * m, t, 2.5, { type: 'sine', gain: g, bus: 'music', echo: 0.6 });
    },
  },
  seuil: {
    bpm: 40,
    steps: 96,
    step(a, i, t) {
      if (i % 4 === 0) {
        const n = LULLABY[LULLABY.length - 1 - ((i / 4) % LULLABY.length)];
        if (n !== null) a.tone(freq(n + 12), t, 2.5, { type: 'sine', gain: 0.035, bus: 'music', echo: 0.8, attack: 0.4 });
      }
      if (i % 48 === 0) a.noiseHit(t, 5, { type: 'bandpass', freq: 1200, q: 0.3, gain: 0.03, attack: 2.5, bus: 'music' });
    },
  },
  combat: {
    bpm: 138,
    steps: 64,
    step(a, i, t) {
      const bass = [-33, -33, -21, -33, -32, -33, -21, -28];
      if (i % 2 === 0) a.tone(freq(bass[(i / 2) % bass.length]), t, 0.12, { type: 'sawtooth', gain: 0.05, bus: 'music', filter: 700 });
      if (i % 8 === 4) a.noiseHit(t, 0.1, { type: 'bandpass', freq: 1800, gain: 0.08, bus: 'music' });
      if (i % 8 === 0) a.noiseHit(t, 0.08, { type: 'lowpass', freq: 150, gain: 0.2, bus: 'music' });
      if (i % 32 === 0) for (const s of [-9, -3]) a.tone(freq(s), t, 0.5, { type: 'square', gain: 0.02, bus: 'music', filter: 1500 });
      if (i % 32 === 24) a.tone(freq(-2), t, 0.4, { type: 'square', gain: 0.02, bus: 'music', filter: 1500, glide: 0.94 });
    },
  },
  boss: {
    bpm: 112,
    steps: 64,
    step(a, i, t) {
      if (i % 16 === 0) {
        a.tone(freq(-36), t, 2, { type: 'sawtooth', gain: 0.05, bus: 'music', filter: 400 });
        a.tone(freq(-30), t, 2, { type: 'sawtooth', gain: 0.04, bus: 'music', filter: 400 });
      }
      if (i % 4 === 0) a.noiseHit(t, 0.08, { type: 'lowpass', freq: 120, gain: i % 16 === 0 ? 0.3 : 0.12, bus: 'music' });
      if (i % 16 === 10) a.tone(freq(-6), t, 0.3, { type: 'square', gain: 0.025, bus: 'music', filter: 1600 });
      if (i % 64 === 48) LULLABY.slice(0, 4).forEach((n, j) => n !== null && a.tone(freq(n - 1), t + j * 0.25, 0.3, { type: 'square', gain: 0.018, bus: 'music', filter: 1800 }));
    },
  },
  fin: {
    bpm: 60,
    steps: 96,
    step(a, i, t) {
      if (i % 4 === 0) {
        const n = LULLABY[(i / 4) % LULLABY.length];
        if (n !== null) a.tone(freq(n === -1 ? -1 : n === 3 ? 4 : n), t, 1.6, { type: 'sine', gain: 0.06, bus: 'music', echo: 0.5 });
      }
      if (i % 24 === 0) a.tone(freq(-24), t, 4, { type: 'sine', gain: 0.05, bus: 'music', attack: 1 });
    },
  },
};

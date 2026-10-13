// Entrées : clavier (QWERTY et AZERTY), manette, et répétition des
// directions dans les menus. Les scènes lisent des « actions », jamais des touches.

export type Action = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'cancel' | 'menu' | 'run' | 'tabPrev' | 'tabNext';

const KEYMAP: Record<string, Action> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up', // W en QWERTY = Z en AZERTY (code physique identique)
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
  Enter: 'confirm',
  NumpadEnter: 'confirm',
  Space: 'confirm',
  KeyE: 'confirm',
  Escape: 'cancel',
  Backspace: 'cancel',
  KeyX: 'cancel',
  KeyM: 'menu',
  Tab: 'menu',
  ShiftLeft: 'run',
  ShiftRight: 'run',
  KeyQ: 'tabPrev',
  PageUp: 'tabPrev',
  KeyR: 'tabNext',
  PageDown: 'tabNext',
};

export class Input {
  private held = new Set<Action>();
  private pressedNow = new Set<Action>();
  private repeatTimers = new Map<Action, number>();
  private padPrev = new Set<Action>();
  anyKeyPressed = false;
  onFirstInput: (() => void) | null = null;
  lastDevice: 'clavier' | 'manette' = 'clavier';

  attach(target: Window): void {
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      this.firstInput();
      this.anyKeyPressed = true;
      this.lastDevice = 'clavier';
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) {
        this.held.add(a);
        this.pressedNow.add(a);
        this.repeatTimers.set(a, 0);
      }
    });
    target.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      this.held.delete(a);
      this.repeatTimers.delete(a);
    });
    target.addEventListener('blur', () => {
      this.held.clear();
      this.repeatTimers.clear();
    });
    target.addEventListener('pointerdown', () => {
      this.firstInput();
      this.anyKeyPressed = true;
    });
  }

  private firstInput() {
    if (this.onFirstInput) {
      const f = this.onFirstInput;
      this.onFirstInput = null;
      f();
    }
  }

  /** Appelé une fois par image, avant la mise à jour des scènes. */
  poll(dt: number): void {
    this.pollGamepad();
    // Répétition automatique des directions (menus)
    for (const [a, t] of this.repeatTimers) {
      if (!['up', 'down', 'left', 'right'].includes(a)) continue;
      const nt = t + dt;
      const first = 0.35;
      const every = 0.09;
      if (t < first && nt >= first) this.pressedNow.add(a);
      else if (nt > first && Math.floor((nt - first) / every) > Math.floor((t - first) / every)) this.pressedNow.add(a);
      this.repeatTimers.set(a, nt);
    }
  }

  private pollGamepad(): void {
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    const pad = pads && Array.from(pads).find((p) => p);
    if (!pad) return;
    const now = new Set<Action>();
    const b = (i: number) => !!pad.buttons[i]?.pressed;
    const ax = pad.axes[0] ?? 0;
    const ay = pad.axes[1] ?? 0;
    if (b(12) || ay < -0.5) now.add('up');
    if (b(13) || ay > 0.5) now.add('down');
    if (b(14) || ax < -0.5) now.add('left');
    if (b(15) || ax > 0.5) now.add('right');
    if (b(0)) now.add('confirm');
    if (b(1)) now.add('cancel');
    if (b(9) || b(3)) now.add('menu');
    if (b(2) || b(7)) now.add('run');
    if (b(4)) now.add('tabPrev');
    if (b(5)) now.add('tabNext');
    for (const a of now) {
      if (!this.padPrev.has(a)) {
        this.pressedNow.add(a);
        this.held.add(a);
        this.repeatTimers.set(a, 0);
        this.firstInput();
        this.anyKeyPressed = true;
        this.lastDevice = 'manette';
      }
    }
    for (const a of this.padPrev) {
      if (!now.has(a)) {
        this.held.delete(a);
        this.repeatTimers.delete(a);
      }
    }
    this.padPrev = now;
  }

  /** Commandes tactiles virtuelles (écrans tactiles). */
  virtual(a: Action, down: boolean): void {
    this.firstInput();
    if (down) {
      if (!this.held.has(a)) {
        this.held.add(a);
        this.pressedNow.add(a);
        this.repeatTimers.set(a, 0);
        this.anyKeyPressed = true;
      }
    } else {
      this.held.delete(a);
      this.repeatTimers.delete(a);
    }
  }

  pressed(a: Action): boolean {
    return this.pressedNow.has(a);
  }

  isHeld(a: Action): boolean {
    return this.held.has(a);
  }

  /** Consomme une pression (évite qu'une même touche serve à deux scènes). */
  consume(a: Action): boolean {
    if (this.pressedNow.has(a)) {
      this.pressedNow.delete(a);
      return true;
    }
    return false;
  }

  heldDir(): 'up' | 'down' | 'left' | 'right' | null {
    // La dernière direction pressée est prioritaire.
    for (const d of ['up', 'down', 'left', 'right'] as const) if (this.pressedNow.has(d)) return d;
    for (const d of ['up', 'down', 'left', 'right'] as const) if (this.held.has(d)) return d;
    return null;
  }

  endFrame(): void {
    this.pressedNow.clear();
    this.anyKeyPressed = false;
  }

  clear(): void {
    this.pressedNow.clear();
  }
}

import '@fontsource/vt323/400.css';
import { Game } from './game';
import { BattleScene } from './scenes/battle';
import { ExploreScene } from './scenes/explore';
import { MenuScene } from './scenes/menu';
import { EndingScene, TitleScene } from './scenes/title';

const canvas = document.getElementById('jeu') as HTMLCanvasElement;
const game = new Game(canvas);

game.makeTitle = () => new TitleScene(game);
game.makeEnding = (id) => new EndingScene(game, id);
game.makeBattle = (species, level, opts, done) => new BattleScene(game, species, level, opts, done);
game.makeExplore = () => {
  const ex = new ExploreScene(game);
  ex.setMenuFactory(() => new MenuScene(game));
  return ex;
};

// Commandes tactiles : croix directionnelle et boutons, seulement sur écran tactile.
function touchControls(): void {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (!coarse) return;
  const pad = document.createElement('div');
  pad.id = 'tactile';
  const buttons: Array<[string, import('./engine/input').Action, string]> = [
    ['▲', 'up', 'dpad up'],
    ['▼', 'down', 'dpad down'],
    ['◀', 'left', 'dpad left'],
    ['▶', 'right', 'dpad right'],
    ['A', 'confirm', 'btn a'],
    ['B', 'cancel', 'btn b'],
    ['☰', 'menu', 'btn menu'],
    ['»', 'run', 'btn run'],
  ];
  for (const [label, action, cls] of buttons) {
    const b = document.createElement('button');
    b.textContent = label;
    b.className = cls;
    b.setAttribute('aria-label', action);
    const down = (e: Event) => {
      e.preventDefault();
      game.input.virtual(action, true);
    };
    const up = (e: Event) => {
      e.preventDefault();
      game.input.virtual(action, false);
    };
    b.addEventListener('pointerdown', down);
    b.addEventListener('pointerup', up);
    b.addEventListener('pointerleave', up);
    b.addEventListener('pointercancel', up);
    pad.appendChild(b);
  }
  document.body.appendChild(pad);
}
touchControls();

function fit(): void {
  // Le canevas garde un format 16:9 et s'adapte à la fenêtre.
  const ratio = 16 / 9;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cw = w / h > ratio ? h * ratio : w;
  canvas.style.width = `${Math.floor(cw)}px`;
  canvas.style.height = `${Math.floor(cw / ratio)}px`;
}
window.addEventListener('resize', fit);
fit();

// Attendre la police pour un premier rendu net (sans bloquer si elle échoue).
const fontReady = (document as Document & { fonts?: FontFaceSet }).fonts?.load('16px "VT323"').catch(() => undefined) ?? Promise.resolve();
void Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(() => {
  game.resetTo(new TitleScene(game));
  game.start();
});

// Accès de débogage pour les tests automatisés (lecture seule de l'état).
(window as unknown as { __veilbound: Game }).__veilbound = game;

// Outils de capture pour les tests visuels automatisés (sans effet sur le jeu).
import { CREATURE_LIST } from './data/creatures';
import { CHARACTERS } from './data/characters';
import { ZONE_LIST } from './data/zones';
import { creatureSprite } from './render/creatures';
import { portrait } from './render/characters';
(window as unknown as { __veilboundDebug: unknown }).__veilboundDebug = {
  creatures: () => CREATURE_LIST.map((c) => c.id),
  characters: () => Object.keys(CHARACTERS),
  zones: () => ZONE_LIST.map((z) => z.id),
  creatureSprite,
  portrait,
};
// Points d'arrivée par zone (premier passage entrant), pour la galerie de captures.
const arrivals: Record<string, [number, number]> = {};
for (const z of ZONE_LIST) for (const w of z.warps) if (!arrivals[w.to]) arrivals[w.to] = [w.tx, w.ty];
arrivals.village = [16, 12];
(window as unknown as { __arrivals: unknown }).__arrivals = arrivals;

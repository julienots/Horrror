// Test de fumée : lance le jeu compilé dans Chromium, joue quelques actions
// au clavier, fait des captures et échoue s'il y a des erreurs JavaScript.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const out = process.env.SMOKE_OUT ?? 'test-results/smoke';
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 4179, strictPort: true }, logLevel: 'error' });
const url = 'http://localhost:4179/';
const exe = process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const browser = await chromium.launch({ executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
const wait = (ms) => page.waitForTimeout(ms);
const key = async (k, n = 1, gap = 120) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(k);
    await wait(gap);
  }
};
const shot = (name) => page.screenshot({ path: `${out}/${name}.png` });
const state = () => page.evaluate(() => {
  const g = window.__veilbound;
  const s = g.state;
  return s ? { zone: s.player.zone, x: s.player.x, y: s.player.y, team: s.team.map((c) => c.species), top: g.stack[g.stack.length - 1]?.kind, quest: s.quests.q_main?.stage } : { top: g.stack[g.stack.length - 1]?.kind };
});

try {
  await page.goto(url);
  await wait(1500);
  await shot('01-titre');
  await key('Enter');
  await wait(400);
  await shot('02-menu-titre');
  // Nouvelle partie (sélectionnée par défaut sans sauvegarde)
  await key('Enter');
  await wait(300);
  await key('Enter');
  await wait(1500);
  await shot('03-intro');
  // Faire défiler les dialogues d'intro
  for (let i = 0; i < 30; i++) {
    const s = await state();
    if (s.top === 'explore') break;
    await key('Enter', 1, 200);
  }
  await wait(600);
  await shot('04-village');
  let s = await state();
  console.log('Après intro :', JSON.stringify(s));
  if (s.top !== 'explore' || s.team[0] !== 'veilleuse') throw new Error('Intro non terminée correctement');
  // Marcher vers le nord (rue principale) puis vers la pension
  for (let i = 0; i < 8; i++) await page.keyboard.down('ArrowUp'), await wait(230), await page.keyboard.up('ArrowUp');
  await wait(300);
  s = await state();
  console.log('Après marche :', JSON.stringify(s));
  await shot('05-marche');
  // Menu de pause
  await key('Escape');
  await wait(300);
  await shot('06-menu-equipe');
  await key('Enter');
  await wait(200);
  await shot('07-equipe-detail');
  await key('Escape');
  await key('ArrowDown');
  await key('Enter');
  await wait(200);
  await shot('08-collection');
  await key('Escape');
  await key('ArrowDown');
  await key('Enter');
  await wait(200);
  await shot('09-sac');
  await key('Escape');
  await key('ArrowDown');
  await key('Enter');
  await wait(200);
  await shot('10-journal');
  await key('Escape');
  await key('ArrowDown');
  await key('Enter');
  await wait(200);
  await shot('11-carte');
  await key('Escape');
  await key('ArrowDown');
  await key('Enter');
  await wait(200);
  await shot('12-options');
  await key('Escape');
  await key('Escape');
  await wait(300);
  // Combat forcé
  await page.evaluate(() => void window.__veilbound.battle('gribouille', 4, { boss: false, noFlee: false }));
  await wait(1800);
  await shot('13-combat');
  for (let i = 0; i < 6; i++) await key('Enter', 1, 250);
  await wait(500);
  await shot('14-combat-capacites');
  for (let i = 0; i < 160; i++) {
    const t = await state();
    if (t.top === 'explore') break;
    await key('Enter', 1, 250);
  }
  await wait(800);
  s = await state();
  console.log('Après combat :', JSON.stringify(s));
  if (s.top !== 'explore') throw new Error('Le combat ne s’est pas terminé');
  await shot('15-apres-combat');
  // Sauvegarde automatique présente ?
  const saved = await page.evaluate(() => !!localStorage.getItem('veilbound.v1.auto'));
  console.log('Sauvegarde auto présente :', saved);
  // Performance : temps moyen d'une image sur 120 images
  const perf = await page.evaluate(async () => {
    const g = window.__veilbound;
    const t0 = performance.now();
    for (let i = 0; i < 120; i++) g.render();
    return (performance.now() - t0) / 120;
  });
  console.log(`Rendu moyen : ${perf.toFixed(2)} ms/image`);
  // Session prolongée : 3000 images simulées (≈ 50 s de jeu) sans erreur ni dérive
  const long = await page.evaluate(() => {
    const g = window.__veilbound;
    const t0 = performance.now();
    const before = g.state.time;
    for (let i = 0; i < 3000; i++) g.tick(1 / 60);
    return { ms: (performance.now() - t0) / 3000, advanced: g.state.time !== before, stack: g.stack.length };
  });
  console.log(`Session prolongée : ${long.ms.toFixed(2)} ms/image, temps qui passe : ${long.advanced}, pile de scènes : ${long.stack}`);
  if (long.stack !== 1) throw new Error('La pile de scènes a grossi pendant la session prolongée');
  // Résolutions : le canevas reste entier dans la fenêtre, au format 16:9
  for (const [w, h] of [[800, 600], [1920, 1080], [390, 844], [1366, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await wait(250);
    const r = await page.evaluate(() => {
      const b = document.getElementById('jeu').getBoundingClientRect();
      return { w: b.width, h: b.height, top: b.top, left: b.left };
    });
    const ok = r.w <= w + 1 && r.h <= h + 1 && r.top >= -1 && r.left >= -1 && Math.abs(r.w / r.h - 16 / 9) < 0.02;
    console.log(`Résolution ${w}×${h} : canevas ${Math.round(r.w)}×${Math.round(r.h)} ${ok ? 'OK' : 'ÉCHEC'}`);
    if (!ok) throw new Error(`Mise à l’échelle incorrecte en ${w}×${h}`);
    await shot(`res-${w}x${h}`);
  }
  if (errors.length) throw new Error(`Erreurs JS :\n${errors.join('\n')}`);
  console.log('SMOKE OK');
} catch (e) {
  console.error('SMOKE ÉCHEC :', e.message);
  if (errors.length) console.error(errors.join('\n'));
  await shot('zz-echec').catch(() => {});
  process.exitCode = 1;
} finally {
  await browser.close();
  await server.close();
}

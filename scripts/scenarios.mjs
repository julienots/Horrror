// Scénarios joués au clavier dans le vrai jeu : dialogue au comptoir, sommeil
// et sauvegarde, cadenas à code, poursuite du Sonneur, défaite et retour au repos.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const out = 'test-results/scenarios';
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 4181, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const wait = (ms) => page.waitForTimeout(ms);
const press = async (k, n = 1, gap = 140) => {
  for (let i = 0; i < n; i++) {
    await page.keyboard.press(k);
    await wait(gap);
  }
};
const hold = async (k, ms) => {
  await page.keyboard.down(k);
  await wait(ms);
  await page.keyboard.up(k);
};
const top = () => page.evaluate(() => window.__veilbound.top()?.kind);
const st = (fn) => page.evaluate(fn);
/** Attend le retour à l'exploration libre (aucun dialogue, transition ni script). */
async function untilExplore(max = 80, k = 'Enter') {
  let stable = 0;
  for (let i = 0; i < max; i++) {
    const free = await page.evaluate(() => {
      const g = window.__veilbound;
      return g.top()?.kind === 'explore' && !g.explore.transitioning && !g.explore.busy;
    });
    if (free) {
      if (++stable >= 3) return true;
      await wait(150);
      continue;
    }
    stable = 0;
    if ((await top()) === 'explore') await wait(150);
    else await press(k, 1, 160);
  }
  return false;
}
async function place(zone, x, y, dir) {
  await page.evaluate(async ([zone, x, y, dir]) => {
    const g = window.__veilbound;
    await g.explore.teleport(zone, x, y, dir, false);
  }, [zone, x, y, dir]);
  await wait(400);
}
const results = [];
const check = (name, ok, detail = '') => {
  results.push(`${ok ? 'OK  ' : 'ÉCHEC'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) process.exitCode = 1;
};

try {
  await page.goto('http://localhost:4181/');
  await wait(1200);
  await press('Enter');
  await press('Enter');
  await wait(800);
  await untilExplore();

  // 1. Entrer dans la pension par la porte, parler à Madame Brève au comptoir
  await place('village', 5, 5, 'up');
  await hold('ArrowUp', 260);
  await wait(900);
  check('porte de la pension', (await st(() => window.__veilbound.state.player.zone)) === 'pension');
  await place('pension', 2, 6, 'up');
  await press('Enter');
  await wait(300);
  check('dialogue au comptoir', (await top()) === 'dialogue');
  await untilExplore();
  check('quête après Brève', (await st(() => window.__veilbound.state.quests.q_main.stage)) === 1);

  // 2. Dormir jusqu'au matin : temps, oubli de Brève, sauvegarde et lieu de repos
  await place('pension', 8, 2, 'up');
  await press('Enter');
  await wait(300);
  for (let i = 0; i < 10 && (await top()) !== 'choice'; i++) await press('Enter', 1, 200);
  check('choix « Dormir ? »', (await top()) === 'choice');
  await press('Enter');
  await wait(2500);
  await untilExplore();
  const sleep = await st(() => {
    const s = window.__veilbound.state;
    return { time: Math.floor(s.time), forgot: !!s.flags.oubli_breve, rest: s.lastRest, saved: !!localStorage.getItem('veilbound.v1.auto') };
  });
  check('sommeil', sleep.time >= 480 && sleep.time < 490 && sleep.forgot && sleep.saved && sleep.rest.zone === 'pension', JSON.stringify(sleep));
  await page.screenshot({ path: `${out}/01-pension.png` });

  // 3. Cadenas à code de l'hôpital, composé au clavier
  await st(() => {
    const s = window.__veilbound.state;
    s.inventory.cle_hopital = 1;
    s.flags.hopital_entre = true;
  });
  await place('hopital', 21, 5, 'up');
  await press('Enter');
  for (let i = 0; i < 10 && (await top()) !== 'code'; i++) await press('Enter', 1, 200);
  check('saisie du code ouverte', (await top()) === 'code');
  await page.screenshot({ path: `${out}/02-code.png` });
  // 0 9 1 7
  await press('ArrowRight');
  await press('ArrowDown');
  await press('ArrowRight');
  await press('ArrowUp');
  await press('ArrowRight');
  await press('ArrowUp', 7);
  await press('Enter');
  await untilExplore();
  check('archives ouvertes', await st(() => !!window.__veilbound.state.flags.archives_ouvertes));

  // 4. Poursuite du Sonneur : fuir en courant vers le hall
  await st(() => (window.__veilbound.state.flags.bureau_vu = true));
  await place('hopital', 25, 5, 'right');
  await hold('ArrowRight', 240);
  for (let i = 0; i < 10 && (await top()) !== 'choice'; i++) await press('Enter', 1, 200);
  check('choix face au Sonneur', (await top()) === 'choice');
  await press('Enter'); // « Fuir vers le hall »
  await wait(200);
  await page.keyboard.down('Shift');
  await hold('ArrowLeft', 14 * 125);
  await hold('ArrowDown', 4 * 125);
  await page.keyboard.up('Shift');
  await wait(400);
  await page.screenshot({ path: `${out}/03-poursuite.png` });
  await untilExplore(20);
  const chase = await st(() => ({ fui: !!window.__veilbound.state.flags.sonneur_fui, pos: window.__veilbound.state.player, chasing: window.__veilbound.explore.chasing }));
  check('fuite réussie', chase.fui && !chase.chasing && chase.pos.y >= 8, JSON.stringify(chase));

  // 5. Défaite : retour au dernier repos, équipe soignée, aucun objet perdu
  const before = await st(() => JSON.stringify(window.__veilbound.state.inventory));
  await st(() => void window.__veilbound.battle('gardien_blanc', 40, { boss: true, noFlee: true }));
  await wait(1500);
  for (let i = 0; i < 300 && (await top()) !== 'explore'; i++) await press('Enter', 1, 120);
  await untilExplore();
  const after = await st(() => {
    const s = window.__veilbound.state;
    return { zone: s.player.zone, hp: s.team.map((c) => c.hp), inv: JSON.stringify(s.inventory) };
  });
  check('défaite → repos', after.zone === 'pension' && after.hp.every((h) => h > 0) && after.inv === before, JSON.stringify({ zone: after.zone, hp: after.hp }));

  const savedZone = await st(() => JSON.parse(localStorage.getItem('veilbound.v1.auto')).data.player.zone);
  check('sauvegarde après défaite au lieu de repos', savedZone === 'pension', savedZone);
  // 6. Rechargement : la sauvegarde automatique se relit sans erreur
  await page.reload();
  await wait(1200);
  await press('Enter');
  await press('Enter'); // Continuer
  await wait(1200);
  await untilExplore();
  const reloaded = await st(() => window.__veilbound.state?.player.zone);
  check('rechargement de la sauvegarde', reloaded === savedZone, reloaded);
  check('aucune erreur JavaScript', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('scénario', false, e.message);
} finally {
  console.log(results.join('\n'));
  await browser.close();
  await server.close();
}

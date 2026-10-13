// Galerie visuelle : capture chaque zone (jour/nuit) et les planches de sprites.
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { mkdirSync } from 'node:fs';

const out = process.env.GALLERY_OUT ?? 'test-results/gallery';
mkdirSync(out, { recursive: true });
const server = await preview({ preview: { port: 4180, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto('http://localhost:4180/');
await page.waitForTimeout(1200);
// Planche des créatures
await page.evaluate(() => {
  const d = window.__veilboundDebug;
  const ids = d.creatures();
  const c = document.createElement('canvas');
  c.width = 1280;
  c.height = 720;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.fillStyle = '#20232a';
  x.fillRect(0, 0, 1280, 720);
  ids.forEach((id, i) => {
    const col = i % 9, row = Math.floor(i / 9);
    x.fillStyle = (col + row) % 2 ? '#14161b' : '#2a2e36';
    x.fillRect(col * 140, row * 170, 140, 170);
    x.drawImage(d.creatureSprite(id, 0), col * 140 + 6, row * 170 + 4, 128, 128);
    x.fillStyle = '#ddd';
    x.font = '14px monospace';
    x.fillText(id, col * 140 + 6, row * 170 + 150);
  });
  c.id = 'sheet';
  c.style.position = 'fixed';
  c.style.left = '0';
  c.style.top = '0';
  c.style.zIndex = '10';
  document.body.appendChild(c);
});
await page.screenshot({ path: `${out}/creatures.png` });
await page.evaluate(() => {
  const d = window.__veilboundDebug;
  const c = document.getElementById('sheet');
  const x = c.getContext('2d');
  x.fillStyle = '#20232a';
  x.fillRect(0, 0, 1280, 720);
  const ids = d.characters();
  const moods = ['neutre', 'peur', 'triste', 'sourire', 'vide', 'colere'];
  ids.forEach((id, i) => {
    moods.forEach((m, k) => x.drawImage(d.portrait(id, m), k * 100 + (i >= 7 ? 640 : 0), (i % 7) * 100 + 4, 96, 96));
  });
});
await page.screenshot({ path: `${out}/portraits.png` });
await page.evaluate(() => document.getElementById('sheet').remove());
// Nouvelle partie puis visite des zones
await page.keyboard.press('Enter');
await page.waitForTimeout(300);
await page.keyboard.press('Enter');
await page.waitForTimeout(800);
for (let i = 0; i < 30; i++) {
  const top = await page.evaluate(() => window.__veilbound.top()?.kind);
  if (top === 'explore') break;
  await page.keyboard.press('Enter');
  await page.waitForTimeout(150);
}
const zones = await page.evaluate(() => window.__veilboundDebug.zones());
for (const z of zones) {
  for (const [label, time] of [['jour', 12 * 60], ['nuit', 23 * 60 + 45]]) {
    const ok = await page.evaluate(async ([zone, t]) => {
      const g = window.__veilbound;
      const s = g.state;
      s.flags.intro = true;
      // Point d'arrivée : premier passage menant à cette zone
      const all = window.__veilboundDebug;
      void all;
      const ex = g.explore;
      const zoneDef = ex.zone.constructor && null;
      void zoneDef;
      s.time = t;
      // Recherche d'une arrivée valide via les données chargées dans la scène
      const arr = window.__arrivals?.[zone];
      if (!arr) return false;
      // Marquer les drapeaux d'entrée comme vus pour ne pas déclencher de scripts
      for (const f of ['tilleuls_vu', 'couloir_vu', 'classe_vue', 'clairiere_vue', 'mine_entree', 'hopital_entre', 'cendriers_vu', 'lys_entree', 'varenne_entree', 'institut_entre', 'seuil_entre']) s.flags[f] = true;
      await ex.teleport(zone, arr[0], arr[1], 'down', false);
      return true;
    }, [z, time]);
    if (!ok) continue;
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${out}/zone-${z}-${label}.png` });
    const indoor = await page.evaluate(() => !!window.__veilbound.explore.zone.indoor);
    if (indoor) break;
  }
}
console.log(errors.length ? `ERREURS:\n${errors.join('\n')}` : 'GALERIE OK');
await browser.close();
await server.close();

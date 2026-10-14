// Génère les icônes Android à partir du sprite de la Veilleuse (dessiné par le jeu).
import { chromium } from 'playwright-core';
import { preview } from 'vite';
import { writeFileSync } from 'node:fs';

const res = 'android/app/src/main/res';
const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
const server = await preview({ preview: { port: 4183, strictPort: true }, logLevel: 'error' });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
await page.goto('http://localhost:4183/');
await page.waitForTimeout(1000);
for (const [d, k] of Object.entries(dens)) {
  for (const [name, size, scale, bg] of [['ic_launcher', 48 * k, 0.9, true], ['ic_launcher_round', 48 * k, 0.9, true], ['ic_launcher_foreground', 108 * k, 0.6, false]]) {
    const b64 = await page.evaluate(([size, scale, bg, round]) => {
      const c = document.createElement('canvas');
      c.width = c.height = size;
      const x = c.getContext('2d');
      x.imageSmoothingEnabled = false;
      if (bg) {
        x.fillStyle = '#0b0c12';
        if (round) { x.beginPath(); x.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); x.fill(); } else x.fillRect(0, 0, size, size);
        const g = x.createRadialGradient(size / 2, size * 0.6, 1, size / 2, size * 0.6, size * 0.5);
        g.addColorStop(0, 'rgba(242,230,201,0.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.fillRect(0, 0, size, size);
      }
      const s = Math.floor(size * scale);
      x.drawImage(window.__veilboundDebug.creatureSprite('veilleuse', 0), (size - s) / 2, (size - s) / 2, s, s);
      return c.toDataURL('image/png').split(',')[1];
    }, [size, scale, bg, name === 'ic_launcher_round']);
    writeFileSync(`${res}/mipmap-${d}/${name}.png`, Buffer.from(b64, 'base64'));
  }
}
await browser.close();
await server.close();
console.log('Icônes générées');

// Régénère les PNG d'icônes à partir des SVG sources via Playwright (Chromium).
// Usage : node scripts/gen-icons.mjs
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = resolve(root, 'public/icons');

// [fichier SVG source, fichier PNG sortie, taille px, fond transparent ?]
const jobs = [
  ['favicon.svg', 'favicon-16.png', 16, true],
  ['favicon.svg', 'favicon-32.png', 32, true],
  ['favicon.svg', 'favicon-48.png', 48, true],
  ['icon-source.svg', 'apple-touch-icon-180.png', 180, false],
  ['icon-source.svg', 'icon-192.png', 192, false],
  ['icon-source.svg', 'icon-512.png', 512, false],
  ['icon-maskable-source.svg', 'icon-maskable-512.png', 512, false],
];

const browser = await chromium.launch();
for (const [src, out, size, transparent] of jobs) {
  const svg = readFileSync(resolve(iconsDir, src), 'utf8');
  const page = await browser.newPage({
    viewport: { width: size, height: size },
    deviceScaleFactor: 1,
  });
  const html = `<!doctype html><html><head><style>
    *{margin:0;padding:0}
    html,body{width:${size}px;height:${size}px;${transparent ? '' : ''}}
    svg{display:block;width:${size}px;height:${size}px}
  </style></head><body>${svg}</body></html>`;
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.screenshot({
    path: resolve(iconsDir, out),
    omitBackground: transparent,
    clip: { x: 0, y: 0, width: size, height: size },
  });
  await page.close();
  console.log(`✓ ${out} (${size}px)`);
}
await browser.close();
console.log('Terminé.');

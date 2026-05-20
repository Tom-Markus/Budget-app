import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';

await mkdir('/tmp/screenshots', { recursive: true });

const BASE = 'http://localhost:4173/news';
const browser = await chromium.launch();

async function shot(page, name) {
  await page.screenshot({ path: `/tmp/screenshots/${name}.png`, fullPage: false });
  console.log(`📸 ${name}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. DESKTOP 1440×900
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── DESKTOP 1440×900 ──');
const desktop = await browser.newPage();
await desktop.setViewportSize({ width: 1440, height: 900 });
await desktop.goto(BASE, { waitUntil: 'domcontentloaded' });
await desktop.waitForTimeout(3000);
await shot(desktop, '01_desktop_initial');

const title = await desktop.locator('h1').first().textContent().catch(() => 'NOT FOUND');
console.log('H1:', title);

// Wait for markets bar
await desktop.waitForSelector('text=Marchés — temps réel', { timeout: 15000 })
  .then(() => console.log('✅ Barre marchés header présente'))
  .catch(() => console.log('❌ Barre marchés header absente'));

await desktop.waitForTimeout(4000); // let APIs load
await shot(desktop, '02_desktop_loaded');

// ── Vérifier présence de chaque widget ──
const checks = [
  ['Barre marchés',             'text=Marchés — temps réel'],
  ['Widget BCE/Fed',            'text=Décisions de politique monétaire'],
  ['Fear & Greed',              'text=Fear & Greed'],
  ['Taux de change',            'text=Taux de change'],
  ['Convertisseur',             'text=Convertisseur'],
  ['Colonne Finance',           'text=Finance'],
  ['Bouton Actualiser',         'button[aria-label="Actualiser les données"]'],
  ['J- countdown BCE ou Fed',   'text=/J-\\d+/'],
];
for (const [name, sel] of checks) {
  const n = await desktop.locator(sel).count();
  console.log(`${n > 0 ? '✅' : '❌'} ${name} (${sel}) → ${n}`);
}

// Météo : peut être chargée ou afficher "indisponible"
const meteoOk  = await desktop.locator('text=/°C/').count();
const meteoDis = await desktop.locator('text=Météo indisponible').count();
console.log(`${meteoOk || meteoDis ? '✅' : '❌'} Widget Météo présent (°C=${meteoOk} / indispo=${meteoDis})`);

// ── Barre marchés scrollable ──
const scrollRow = desktop.locator('.overflow-x-auto').first();
if (await scrollRow.count()) {
  const before = await scrollRow.evaluate(el => el.scrollLeft);
  await scrollRow.evaluate(el => el.scrollLeft += 400);
  await desktop.waitForTimeout(200);
  const after = await scrollRow.evaluate(el => el.scrollLeft);
  console.log(`${after > before ? '✅' : '⚠️'} Barre marchés scrollable (${before}→${after})`);
} else {
  console.log('❌ .overflow-x-auto introuvable');
}
await shot(desktop, '03_markets_scroll');

// ── Clic sur Bitcoin → modale graphe ──
await desktop.evaluate(() => window.scrollTo(0, 0));
const btcBtn = desktop.locator('button').filter({ hasText: /^Bitcoin$/ }).first();
const btcCount = await btcBtn.count();
console.log(`\nBitcoin button count: ${btcCount}`);
if (btcCount) {
  await btcBtn.click();
  await desktop.waitForTimeout(1200);
  const modalEl = desktop.locator('.fixed.inset-0');
  const mCount = await modalEl.count();
  console.log(`${mCount ? '✅' : '❌'} Modale ouverte (count=${mCount})`);
  await shot(desktop, '04_modal_open');

  // Contenu modale
  const hist7 = await desktop.locator('text=Historique 7 jours').count();
  console.log(`${hist7 ? '✅' : '❌'} Titre "Historique 7 jours" dans modale`);

  // Toggle bougies
  const candleBtn = desktop.locator('button[title="Graphique en bougies"]');
  if (await candleBtn.count()) {
    await candleBtn.click();
    await desktop.waitForTimeout(2000);
    console.log('✅ Toggle bougies cliqué');
    await shot(desktop, '05_modal_candle');
  } else {
    console.log('❌ Bouton bougies absent');
  }

  // Fermer via Escape
  await desktop.keyboard.press('Escape');
  await desktop.waitForTimeout(500);
  const gone = await desktop.locator('.fixed.inset-0').count();
  console.log(`${gone === 0 ? '✅' : '❌'} Modale fermée avec Escape`);
} else {
  console.log('⚠️ Bouton Bitcoin absent (API pas encore chargée ?)');
}

// ── Colonnes actualités desktop ──
await desktop.evaluate(() => window.scrollTo(0, 9999));
await desktop.waitForTimeout(500);
await shot(desktop, '06_desktop_news');
const desktopGrid = await desktop.locator('.hidden.md\\:grid').count();
const articles    = await desktop.locator('a[target="_blank"]').count();
console.log(`\n${desktopGrid ? '✅' : '❌'} Grille desktop présente (count=${desktopGrid})`);
console.log(`${articles > 0 ? '✅' : '⚠️'} Articles chargés (count=${articles})`);

// ── Bouton actualiser ──
await desktop.evaluate(() => window.scrollTo(0, 0));
const refBtn = desktop.locator('button[aria-label="Actualiser les données"]');
if (await refBtn.count()) {
  await refBtn.click();
  await desktop.waitForTimeout(600);
  const spinning = await desktop.locator('.animate-spin').count();
  console.log(`\n${spinning ? '✅' : '⚠️'} Spinner au clic Actualiser (count=${spinning})`);
  await shot(desktop, '07_refresh_spinning');
  // Attendre fin spinner
  await desktop.waitForFunction(() => !document.querySelector('.animate-spin'), { timeout: 15000 }).catch(() => {});
  console.log('✅ Spinner terminé');
} else {
  console.log('❌ Bouton Actualiser absent');
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. MOBILE 390×844
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n── MOBILE 390×844 ──');
const mobile = await browser.newPage();
await mobile.setViewportSize({ width: 390, height: 844 });
await mobile.goto(BASE, { waitUntil: 'domcontentloaded' });
await mobile.waitForTimeout(4000);
await shot(mobile, '08_mobile_initial');

// Tabs mobile
const tablist = mobile.locator('[role="tablist"]');
const hasTabs = await tablist.count();
const tabLabels = await tablist.locator('button').allTextContents().catch(() => []);
console.log(`${hasTabs ? '✅' : '❌'} Tablist mobile présent`);
console.log('Tabs:', tabLabels);

// Widgets sur mobile
const mChecks = [
  ['BCE/Fed',       'text=Décisions de politique monétaire'],
  ['Fear & Greed',  'text=Fear & Greed'],
  ['Convertisseur', 'text=Convertisseur'],
  ['Taux de change','text=Taux de change'],
];
for (const [name, sel] of mChecks) {
  const n = await mobile.locator(sel).count();
  console.log(`${n > 0 ? '✅' : '❌'} ${name} sur mobile → ${n}`);
}

// Cliquer onglet Tech
const techTab = tablist.locator('button').filter({ hasText: /tech/i }).first();
if (await techTab.count()) {
  await techTab.click();
  await mobile.waitForTimeout(700);
  console.log('✅ Onglet Tech cliqué');
  await shot(mobile, '09_mobile_tech_tab');
}

// Ouvrir modale sur mobile
const mobileBtc = mobile.locator('button').filter({ hasText: /^Bitcoin$/ }).first();
if (await mobileBtc.count()) {
  await mobileBtc.click();
  await mobile.waitForTimeout(1000);
  const mModal = await mobile.locator('.fixed.inset-0').count();
  console.log(`${mModal ? '✅' : '❌'} Modale ouverte sur mobile`);
  await shot(mobile, '10_mobile_modal');
  await mobile.keyboard.press('Escape');
  await mobile.waitForTimeout(300);
} else {
  console.log('⚠️ Bouton Bitcoin absent sur mobile');
}

// Scroll + screenshot basse de page mobile
await mobile.evaluate(() => window.scrollTo(0, 9999));
await mobile.waitForTimeout(400);
await shot(mobile, '11_mobile_bottom');

console.log('\n✅ Vérification complète');
await browser.close();

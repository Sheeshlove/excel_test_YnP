/* Drives the trainer as an iPhone would: a 393x852 touch viewport, no hardware
 * keyboard, tapping instead of clicking. Also checks the home screen app bits —
 * the manifest, the icons and the service worker that makes it work offline. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.png': 'image/png', '.json': 'application/json'
};

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { rq.writeHead(404); return rq.end('no'); }
      rq.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      rq.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port }));
  });
}

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('  x ' + msg); } }

(async () => {
  const { srv, port } = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  // an iPhone 15 viewport, touch only, no physical keyboard
  const ctx = await browser.newContext({
    viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  const base = `http://127.0.0.1:${port}/index.html`;
  const noOverflow = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

  /* ---------- home screen app metadata ---------- */
  const manifest = await (await page.request.get(`http://127.0.0.1:${port}/manifest.webmanifest`)).json();
  check(manifest.display === 'standalone', 'the manifest asks for a standalone window');
  check(!!manifest.name && !!manifest.short_name, 'the manifest names the app');
  check(manifest.icons.some(i => i.sizes === '192x192') && manifest.icons.some(i => i.sizes === '512x512'),
    'the manifest carries 192 and 512 icons');
  check(manifest.icons.some(i => i.purpose === 'maskable'), 'the manifest carries a maskable icon');
  for (const icon of manifest.icons) {
    const r = await page.request.get(`http://127.0.0.1:${port}/${icon.src}`);
    check(r.ok(), 'icon exists: ' + icon.src);
  }

  await page.goto(base);
  await page.waitForSelector('.levels');
  const head = await page.evaluate(() => ({
    appleCapable: !!document.querySelector('meta[name="apple-mobile-web-app-capable"][content="yes"]'),
    title: !!document.querySelector('meta[name="apple-mobile-web-app-title"]'),
    touchIcon: !!document.querySelector('link[rel="apple-touch-icon"]'),
    viewportFit: (document.querySelector('meta[name=viewport]') || {}).content || '',
    themeColor: !!document.querySelector('meta[name="theme-color"]')
  }));
  check(head.appleCapable, 'apple-mobile-web-app-capable is set, so iOS opens it without Safari chrome');
  check(head.title, 'the home screen name is set');
  check(head.touchIcon, 'an apple-touch-icon is declared');
  check(/viewport-fit=cover/.test(head.viewportFit), 'the viewport covers the notch area');
  check(head.themeColor, 'a theme colour is declared');

  /* ---------- phone layout ---------- */
  check(await noOverflow(), 'the home screen does not scroll sideways');
  const nav = await page.evaluate(() => ({
    tabbar: getComputedStyle(document.querySelector('.tabbar')).display,
    mainnav: getComputedStyle(document.querySelector('.mainnav')).display,
    body: document.body.className
  }));
  check(nav.tabbar === 'flex', 'the bottom tab bar is shown on a phone');
  check(nav.mainnav === 'none', 'the desktop menu is hidden on a phone');
  check(/is-touch/.test(nav.body), 'the app knows it is on a touch device');

  await page.locator('.tabbar button[data-nav="dojo"]').tap();
  await page.waitForSelector('.dojo-options');
  check(await noOverflow(), 'the dojo fits the screen');
  check((await page.locator('.tabbar button.active').innerText()).includes('Dojo'), 'the active tab is marked');

  await page.locator('.tabbar button[data-nav="home"]').tap();
  await page.waitForSelector('.levels');

  /* ---------- solving a task with fingers only ---------- */
  await page.locator('.level-card[data-level="1"]').tap();
  await page.waitForSelector('.task-list');
  await page.locator('.task-row').first().tap();
  await page.waitForSelector('table.sheet');
  check(await noOverflow(), 'the task screen does not scroll sideways');

  const layout = await page.evaluate(() => ({
    tabbar: getComputedStyle(document.querySelector('.tabbar')).display,
    panel: Math.round(document.querySelector('.task-panel').getBoundingClientRect().height),
    grid: Math.round(document.querySelector('.grid-wrap').getBoundingClientRect().height),
    tools: !!document.querySelector('.touch-tools'),
    legend: document.querySelector('.shortcut-legend').textContent
  }));
  check(layout.tabbar === 'none', 'the tab bar gets out of the way while a task is open');
  check(layout.panel <= 380, 'the question panel is capped so the sheet is visible (' + layout.panel + 'px)');
  check(layout.grid > 250, 'the sheet gets real room (' + layout.grid + 'px)');
  check(layout.tools, 'the touch toolbar is there');
  check(/Tap a cell/.test(layout.legend) && /Fill ↓/.test(layout.legend),
    'the keyboard legend is replaced by touch instructions');

  const toolLabels = await page.locator('.tt-btn').allInnerTexts();
  check(toolLabels.join(' ').includes('Fill ↓') && toolLabels.join(' ').includes('Fill →'),
    'fill down and fill right are on buttons');
  check(toolLabels.includes('$'), 'the dollar-sign cycle is on a button');

  // tap the cell, tap Edit, type in the formula bar
  await page.locator('td[data-r="1"][data-c="3"]').tap();
  check((await page.locator('#fb-addr').textContent()) === 'D2', 'tapping a cell selects it');
  await page.locator('.tt-btn', { hasText: 'Edit' }).tap();
  check(await page.evaluate(() => document.activeElement.classList.contains('fb-input')),
    'Edit puts the cursor in the formula bar');
  await page.waitForSelector('.assist-row:not([hidden])');
  check(await page.locator('.assist-row').isVisible(), 'the character row appears while typing');
  const keys = await page.locator('.assist-key').allInnerTexts();
  check(keys.includes('=') && keys.includes('$') && keys.includes(':'),
    'the character row offers the symbols iOS hides');

  await page.keyboard.type('=B2-C2');
  await page.keyboard.press('Enter');
  check((await page.locator('td[data-r="1"][data-c="3"] .cv').textContent()) === '1700',
    'a formula typed in the formula bar lands in the cell');

  // one tap fills the rest of the column, the way double-clicking the fill handle does
  await page.locator('td[data-r="1"][data-c="3"]').tap();
  await page.locator('.tt-btn', { hasText: 'Fill ↓' }).tap();
  check((await page.locator('td[data-r="5"][data-c="3"] .cv').textContent()) === '1200',
    'Fill ↓ runs the formula to the end of the answer block with one tap');

  await page.locator('#btn-check').tap();
  await page.waitForSelector('.result.ok');
  check(true, 'the task can be completed entirely by touch');
  check(await noOverflow(), 'the explanation panel does not break the layout');

  // folding the question away gives the sheet the whole screen
  const gridBefore = await page.evaluate(() => document.querySelector('.grid-wrap').getBoundingClientRect().height);
  await page.locator('.panel-toggle').tap();
  const gridAfter = await page.evaluate(() => document.querySelector('.grid-wrap').getBoundingClientRect().height);
  check(gridAfter > gridBefore + 100, 'folding the question away gives the sheet more room');

  /* ---------- the $ button cycles anchors ---------- */
  await page.goto(base + '#/1/1.4');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="1"][data-c="2"]').tap();
  await page.locator('.tt-btn', { hasText: 'Edit' }).tap();
  await page.keyboard.type('=B2/B8');
  await page.locator('.tt-btn', { hasText: '$' }).tap();
  check((await page.locator('#fb-input').inputValue()) === '=B2/$B$8',
    'the $ button turns B8 into $B$8 without a keyboard');

  /* ---------- filtering by touch ---------- */
  await page.goto(base + '#/7/7.2');
  await page.waitForSelector('table.sheet');
  const filterBtn = page.locator('.tt-btn', { hasText: 'Filter' });
  check(await filterBtn.count() === 1, 'a table task offers a Filter button');
  await filterBtn.tap();
  await page.waitForSelector('.filter-btn');
  check((await page.locator('.filter-btn').count()) === 7, 'the filter arrows appear on the headers');
  await page.locator('.filter-btn').nth(1).tap();
  await page.waitForSelector('.filter-menu');
  check(await page.locator('.filter-menu').isVisible(), 'the filter menu opens by touch');
  const menuBox = await page.locator('.filter-menu').boundingBox();
  check(menuBox.x >= 0 && menuBox.x + menuBox.width <= 393 + 1, 'the filter menu stays on screen');

  /* ---------- a pivot table by touch ---------- */
  await page.goto(base + '#/8/8.1');
  await page.waitForSelector('.pivot-wrap');
  check(await noOverflow(), 'the pivot builder fits the screen');
  const cols = await page.evaluate(() => getComputedStyle(document.querySelector('.pivot-wrap')).gridTemplateColumns);
  check(cols.split(' ').length === 1, 'the pivot builder stacks into one column on a phone');
  await page.locator('.pf-row', { hasText: 'Region' }).first().locator('.pf-btn', { hasText: 'Rows' }).tap();
  await page.locator('.pf-row', { hasText: 'Revenue' }).first().locator('.pf-btn', { hasText: 'Σ' }).tap();
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('table.pivot-table').innerText()).includes('41,800'),
    'a pivot can be built with taps');
  await page.locator('#btn-check').tap();
  await page.waitForSelector('.result.ok');
  check(true, 'the pivot task passes on a phone');

  /* ---------- works with no network at all ---------- */
  await page.goto(base);
  await page.waitForSelector('.levels');
  const swReady = await page.evaluate(() =>
    navigator.serviceWorker.ready.then(r => !!r.active).catch(() => false));
  check(swReady, 'the service worker installs');
  // give it a moment to finish filling the cache
  await page.waitForTimeout(700);
  await ctx.setOffline(true);
  await page.reload();
  await page.waitForSelector('.levels', { timeout: 8000 });
  check((await page.locator('.level-card').count()) === 12, 'the whole app loads with the network off');
  await page.goto(base + '#/1/1.1');
  await page.waitForSelector('table.sheet');
  check(await page.locator('td[data-r="1"][data-c="1"]').isVisible(), 'tasks open offline too');
  await ctx.setOffline(false);

  check(errors.filter(e => !/Failed to load resource/.test(e)).length === 0,
    'no console errors: ' + errors.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();
  console.log(`\niPhone: ${pass} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

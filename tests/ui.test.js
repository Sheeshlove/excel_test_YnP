/* Drives the real interface in a real browser: typing formulas, ⌘D, ⌘T, ⌘Z,
 * sorting, filtering, building a pivot table, the explanation panel, and the
 * 20-question mock test. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'app');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function serve() {
  // the trainer saves through /api/progress, exactly as it does against
  // packaging/server.py, so the real saving path is what gets exercised here
  let stored = null;
  return new Promise(res => {
    const srv = http.createServer((req, rq) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/api/progress') {
        if (req.method === 'GET') {
          rq.writeHead(200, { 'Content-Type': 'application/json' });
          return rq.end(JSON.stringify({ ok: true, data: stored, path: '(in the test)' }));
        }
        let body = '';
        req.on('data', c => { body += c; });
        return req.on('end', () => {
          try { stored = JSON.parse(body); } catch (e) { /* leave the last good one */ }
          rq.writeHead(200, { 'Content-Type': 'application/json' });
          rq.end(JSON.stringify({ ok: true }));
        });
      }
      if (p === '/') p = '/index.html';
      const file = path.join(ROOT, p);
      if (!file.startsWith(ROOT) || !fs.existsSync(file)) { rq.writeHead(404); return rq.end('no'); }
      rq.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      rq.end(fs.readFileSync(file));
    });
    srv.listen(0, '127.0.0.1', () => res({ srv, port: srv.address().port, saved: () => stored }));
  });
}

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('  x ' + msg); } }

(async () => {
  const { srv, port, saved } = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('dialog', d => d.accept());

  const base = `http://127.0.0.1:${port}/index.html`;
  await page.goto(base);
  await page.waitForSelector('.levels');

  /* ---------- home ---------- */
  check((await page.locator('.level-card').count()) === 12, 'the home screen shows 12 levels');
  check(await page.locator('.level-card.locked').count() === 0, 'no level starts locked');
  check(await page.locator('.level-card[data-level]').count() === 12, 'every level is open from the start');
  check((await page.locator('.notice').innerText()).includes('open from the start'),
    'the home screen says everything is open from the start');
  check((await page.locator('.notice').innerText()).includes('Nothing here can be lost'),
    'the home screen states that progress cannot be lost');
  check(!/[А-Яа-яЁё]/.test(await page.locator('body').innerText()), 'the interface is entirely in English');

  /* ---------- the mock tests are open before anything is solved ---------- */
  await page.locator('.level-card[data-level="12"]').click();
  await page.waitForSelector('.paper-grid');
  check((await page.locator('.paper-chip').count()) === 50, 'all 50 mock papers are offered');
  check((await page.locator('.task-row').count()) === 20, 'a paper shows its 20 questions');
  check((await page.locator('#start-exam').count()) === 1, 'a fresh install can start a mock test at once');
  await page.locator('.paper-chip').nth(23).click();
  await page.waitForFunction(() => location.hash === '#/level/12/M24');
  await page.waitForSelector('.paper-grid');
  check((await page.locator('.task-row').count()) === 20, 'paper 24 also has 20 questions');
  const paper24 = await page.locator('.task-list').innerText();
  await page.goto(base + '#/level/12/M37');
  await page.waitForSelector('.paper-grid');
  check((await page.locator('.task-list').innerText()) !== paper24, 'a different paper asks different questions');
  await page.goto(base);
  await page.waitForSelector('.levels');

  /* ---------- level 1 ---------- */
  await page.locator('.level-card[data-level="1"]').click();
  await page.waitForSelector('.task-list');
  check((await page.locator('.task-row').count()) === 5, 'level 1 has 5 tasks');
  check((await page.locator('.theory-item').count()) >= 3, 'the theory panel is populated');

  /* ---------- task 1.1: typing and filling down ---------- */
  await page.locator('.task-row').first().click();
  await page.waitForSelector('table.sheet');
  check((await page.locator('td.target').count()) === 5, 'the five target cells are highlighted');
  check((await page.locator('td[data-r="1"][data-c="1"] .cv').textContent()) === '4200', 'source data is visible');

  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.type('=B2-C2');
  await page.keyboard.press('Enter');
  check((await page.locator('td[data-r="1"][data-c="3"] .cv').textContent()) === '1700', 'a typed formula calculates');

  await page.locator('#btn-check').click();
  await page.waitForSelector('.result');
  check(await page.locator('.result.bad').count() === 1, 'a partial answer is not accepted');
  check((await page.locator('.result.bad').innerText()).includes('Nothing is lost'),
    'a wrong answer says nothing is lost');

  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+d');
  check((await page.locator('td[data-r="5"][data-c="3"] .cv').textContent()) === '1200',
    'fill down shifts the relative references');

  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(await page.locator('.result.ok').count() === 1, 'the complete answer is accepted');
  check(Number(await page.locator('#xp-value').textContent()) > 0, 'XP is awarded');

  /* ---------- the explanation appears automatically ---------- */
  await page.waitForSelector('.explain');
  const ex = await page.locator('.explain').innerText();
  check(ex.includes('How this works'), 'the explanation panel opens after a correct answer');
  check((await page.locator('.ex-walk li').count()) >= 3, 'the explanation walks through the steps');
  check((await page.locator('.ex-mistakes li').count()) >= 2, 'the explanation lists common mistakes');
  check(ex.includes('On a real project'), 'the explanation ties the task to real work');
  const anatomy = await page.locator('.ex-formula').first().innerText();
  check(anatomy.includes('=B2-C2'), 'the explanation takes the learner\'s own formula apart');
  check((await page.locator('.ex-step').count()) >= 2, 'the formula is broken into steps with values');

  /* ---------- a wrong attempt after a correct one cannot lower the score ---- */
  const xpSolved = Number(await page.locator('#xp-value').textContent());
  await page.locator('#btn-reset').click();
  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.type('999');
  await page.keyboard.press('Enter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.bad');
  check(Number(await page.locator('#xp-value').textContent()) === xpSolved,
    'a wrong attempt after a correct one does not reduce XP');
  check(await page.evaluate(() => window.XLStore.task('1.1').best) === 1,
    'the best attempt at a task is kept even after a later failure');
  await page.goto(base + '#/level/1');
  await page.waitForFunction(() => location.hash === '#/level/1');
  check((await page.locator('.task-status.done').count()) >= 1,
    'the task is still shown as solved after a failed retry');
  await page.goto(base + '#/1/1.1');
  await page.waitForFunction(() => location.hash === '#/1/1.1');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.type('=B2-C2');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+d');

  /* ---------- ⌘Z ---------- */
  await page.locator('td[data-r="3"][data-c="3"]').click();
  await page.keyboard.press('Meta+z');
  check((await page.locator('td[data-r="3"][data-c="3"] .cv').textContent()) === '', 'undo reverses a fill');

  /* ---------- ⌘T toggles the dollars ---------- */
  await page.goto(base + '#/1/1.4');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="1"][data-c="2"]').click();
  await page.keyboard.type('=B2/B8');
  await page.keyboard.press('Meta+t');
  check((await page.locator('.cell-input').inputValue()) === '=B2/$B$8', 'Cmd+T inserts the dollar signs');
  await page.keyboard.press('Enter');
  await page.locator('#btn-hint').click();
  check(await page.locator('.hintbox').count() === 1, 'the hint can be revealed');

  /* ---------- clearing one task does not touch progress ---------- */
  const xpBeforeReset = Number(await page.locator('#xp-value').textContent());
  await page.locator('#btn-reset').click();
  check(Number(await page.locator('#xp-value').textContent()) === xpBeforeReset,
    'clearing the sheet does not reduce XP');
  await page.goto(base + '#/1/1.1');
  await page.waitForFunction(() => location.hash === '#/1/1.1');
  await page.waitForSelector('table.sheet');
  check((await page.locator('td[data-r="1"][data-c="3"] .cv').textContent()) === '',
    'opening a task again starts from a clean sheet');
  check((await page.locator('.task-status.done, .solved-note').count()) > 0,
    'the clean sheet does not cost the points already earned for it');

  /* ---------- level 4: one formula over a whole grid ---------- */
  await page.goto(base + '#/4/4.5');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="2"][data-c="9"]').click();
  await page.keyboard.type('=SUMIFS($F$2:$F$21,$B$2:$B$21,$I3,$C$2:$C$21,J$2)');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="2"][data-c="9"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+r');
  await page.keyboard.press('Meta+d');
  check((await page.locator('td[data-r="2"][data-c="10"] .cv').textContent()).replace(/,/g, '') === '10200',
    'the summary grid fills from a single formula');
  await page.locator('td[data-r="8"][data-c="9"]').click();
  await page.keyboard.type('=SUM(J3:N7)');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="9"][data-c="9"]').click();
  await page.keyboard.type('=SUM(F2:F21)');
  await page.keyboard.press('Enter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the cross-tab task is accepted');

  /* ---------- level 7: sorting ---------- */
  await page.goto(base + '#/7/7.1');
  await page.waitForSelector('table.sheet');
  await page.locator('#btn-filter').click();
  await page.waitForSelector('.filter-btn');
  check((await page.locator('.filter-btn').count()) === 7, 'the filter arrows appear on every header');
  await page.locator('th, td').first().waitFor();
  await page.locator('.filter-btn').nth(5).click();          // the Revenue column
  await page.waitForSelector('.filter-menu');
  await page.locator('.fm-item[data-act="desc"]').click();
  check((await page.locator('td[data-r="1"][data-c="0"] .cv').textContent()) === 'D-008',
    'sorting largest first moves the biggest deal to the top');
  await page.locator('td[data-r="1"][data-c="9"]').click();
  await page.keyboard.type('=A2');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="2"][data-c="9"]').click();
  await page.keyboard.type('=SUM(F2:F6)/SUM(F2:F21)');
  await page.keyboard.press('Enter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the sorting task is accepted');

  /* ---------- level 7: filtering and SUBTOTAL ---------- */
  await page.goto(base + '#/7/7.2');
  await page.waitForSelector('table.sheet');
  await page.locator('#btn-filter').click();
  await page.locator('.filter-btn').nth(1).click();           // the Region column
  await page.waitForSelector('.filter-menu');
  await page.locator('.fm-opt input').first().uncheck();      // clear all
  const boxes = page.locator('.fm-list .fm-opt input');
  const labels = await page.locator('.fm-list .fm-opt').allInnerTexts();
  const moscow = labels.findIndex(l => l.trim() === 'Moscow');
  await boxes.nth(moscow).check();
  await page.locator('.fm-ok').click();
  const hidden = await page.locator('table.sheet tbody tr.row-hidden').count();
  check(hidden === 14, 'the filter hides the 14 non-Moscow rows');
  // the summary block lives below the table, where the filter cannot reach it
  await page.locator('td[data-r="23"][data-c="1"]').click();
  await page.keyboard.type('=SUBTOTAL(9,F2:F21)');
  await page.keyboard.press('Enter');
  check((await page.locator('td[data-r="23"][data-c="1"] .cv').textContent()).replace(/,/g, '') === '41800',
    'SUBTOTAL adds only the visible rows');
  await page.locator('td[data-r="25"][data-c="1"]').click();
  await page.keyboard.type('=SUM(F2:F21)');
  await page.keyboard.press('Enter');
  check((await page.locator('td[data-r="25"][data-c="1"] .cv').textContent()).replace(/,/g, '') === '102600',
    'a plain SUM ignores the filter');
  await page.locator('td[data-r="24"][data-c="1"]').click();
  await page.keyboard.type('=SUBTOTAL(3,A2:A21)');
  await page.keyboard.press('Enter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the filtering task is accepted');

  /* ---------- level 8: the pivot builder ---------- */
  // Helpers that drive the field list and the chip menus the way a learner does.
  async function menuPick(label) {
    await page.locator('.pv-menu .pv-mitem', { hasText: label }).first().click();
  }
  async function fieldTo(name, label) {
    await page.locator('.pf-row', { hasText: name }).first().locator('.pf-menu').click();
    await page.waitForSelector('.pv-menu');
    await menuPick(label);
  }
  async function chipMenu(area, index, label) {
    await page.locator('.pv-area[data-area="' + area + '"] .chip').nth(index).locator('.chip-menu').click();
    await page.waitForSelector('.pv-menu');
    await menuPick(label);
  }
  function pivotText() { return page.locator('table.pivot-table').innerText(); }
  // Going to a hash the page is already on does not re-render the view, and two
  // of the checks below open the same task twice, so step via the level first.
  async function openPivot(id) {
    await page.goto(base + '#/level/' + id.split('.')[0]);
    await page.goto(base + '#/' + id.split('.')[0] + '/' + id);
    await page.waitForSelector('.pv-shell');
  }
  async function tableIsRectangular() {
    return page.evaluate(() => {
      const t = document.querySelector('table.pivot-table');
      const widths = [...t.rows].map(r => [...r.cells].map(c => c.colSpan).reduce((a, b) => a + b, 0));
      return widths.every(w => w === widths[0]);
    });
  }

  await openPivot('8.1');
  check((await page.locator('.pf-row').count()) === 7, 'the field list shows every column of the source');
  check((await page.locator('.pv-area').count()) === 4, 'the four areas are present');
  check((await page.locator('.pv-ribbon .pv-rbtn').count()) >= 5,
    'the ribbon offers Refresh, Report Layout, Subtotals, Grand Totals and the Field List');

  // Excel's rule: ticking a text field groups the rows, ticking a number sums it
  await page.locator('.pf-row', { hasText: 'Region' }).first().locator('.pf-check').check();
  await page.locator('.pf-row', { hasText: 'Revenue' }).first().locator('.pf-check').check();
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('.pv-area[data-area="rows"] .chip').count()) === 1,
    'a ticked text field goes to Rows');
  check((await page.locator('.pv-area[data-area="values"] .chip').count()) === 1,
    'a ticked numeric field goes to Values');
  let txt = await pivotText();
  check(txt.includes('Moscow') && txt.includes('41,800'), 'the pivot groups revenue by region');
  check(txt.includes('Grand Total') && txt.includes('102,600'), 'the pivot shows a grand total');
  check(txt.includes('Row Labels'), 'the report carries Excel\'s Row Labels header');
  check(await tableIsRectangular(), 'the report has no phantom column: every row is the same width');
  check(!/41,800\s+41,800/.test(txt), 'and no number is printed twice');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the pivot task is accepted');

  /* a pivot built the wrong way round is rejected, and the message says why */
  await openPivot('8.2');
  await fieldTo('Industry', 'Add to Row Labels');
  await fieldTo('Region', 'Add to Column Labels');
  await fieldTo('Revenue', 'Add to Values');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result');
  const wrongMsg = await page.locator('.result').innerText();
  check(await page.locator('.result.bad').count() === 1, 'a transposed pivot is rejected');
  check(/Rows area/.test(wrongMsg), 'the rejection names the area: ' + wrongMsg.slice(0, 70));

  /* the two-dimensional pivot, with a grand total column this time */
  await openPivot('8.2');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Industry', 'Add to Column Labels');
  await fieldTo('Revenue', 'Add to Values');
  await page.waitForSelector('table.pivot-table');
  txt = await pivotText();
  check(txt.includes('Column Labels'), 'a column field brings Excel\'s Column Labels header');
  check(await tableIsRectangular(), 'the two-dimensional report lines up with its header');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the cross-tab is accepted');

  /* a report filter, driven from the tick list */
  await openPivot('8.3');
  await fieldTo('Manager', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await fieldTo('Stage', 'Add to Report Filter');
  await page.locator('.pv-fbtn').first().click();
  await page.waitForSelector('.pv-picker');
  await page.locator('.pv-picker .fm-all input').uncheck();
  await page.locator('.pv-picker .fm-opt:not(.fm-all)', { hasText: 'Won' }).first().locator('input').check();
  await page.locator('.pv-picker .btn-primary').click();
  await page.waitForSelector('table.pivot-table');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the report filter task is accepted');

  /* % of grand total, from the Value Field Settings dialog */
  await openPivot('8.4');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await chipMenu('values', 0, 'Value Field Settings');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-show').selectOption({ label: '% of grand total' });
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  txt = await pivotText();
  check(txt.includes('40.7%'), 'the shares are shown as percentages');
  check(txt.includes('100.0%') && !/Grand Total\t1$/m.test(txt),
    'and the grand total reads 100.0%, not "1"');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the percentage task is accepted');

  /* a calculated field, from Excel's Insert Calculated Field dialog */
  await openPivot('8.6');
  await fieldTo('Region', 'Add to Row Labels');
  await page.locator('.pa-calc').click();
  await page.waitForSelector('.pv-modal');
  await page.locator('.cf-name').fill('Gross profit');
  await page.locator('.cf-formula').fill('Revenue*Margin');          // no spaces on purpose
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  check((await pivotText()).includes('75,240'), 'the calculated field computes revenue times margin');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'a calculated field is marked on its numbers, not on its spacing');

  /* nesting and subtotals */
  await openPivot('8.7');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Industry', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('tr.pt-subtotal').count()) === 5, 'nested rows produce a subtotal per region');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the nesting task is accepted');
  // and Tabular form is the same report
  await page.locator('.pv-rbtn', { hasText: 'Report Layout' }).click();
  await menuPick('Show in Tabular Form');
  await page.waitForSelector('table.pivot-table');
  check((await pivotText()).includes('Moscow Total'), 'Tabular form labels the subtotal "Moscow Total"');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'and Tabular form is marked correct too');

  /* sorting by value */
  await openPivot('8.8');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.bad');
  check(/rows read/.test(await page.locator('.result').innerText()),
    'an unsorted pivot is rejected, and the message shows the order it found');
  await chipMenu('rows', 0, 'More Sort Options');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-modal .pv-radio', { hasText: 'Largest to Smallest' }).locator('input').check();
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  const sortedRows = await page.locator('table.pivot-table tbody th.pt-rowlabel').allInnerTexts();
  check(sortedRows.slice(0, 3).join(',') === 'Moscow,Siberia,Urals', 'sorting by value ranks the regions');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the sort-by-value task is accepted');

  /* grouping dates into quarters — Excel's Group Field */
  await openPivot('8.9');
  await fieldTo('Date', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('table.pivot-table tbody tr').count()) > 20,
    'an ungrouped date field gives one line per order');
  await chipMenu('rows', 0, 'Group');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-grouplist input[value="months"]').uncheck();
  await page.locator('.pv-grouplist input[value="quarters"]').check();
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  const quarters = await page.locator('table.pivot-table tbody th.pt-rowlabel').allInnerTexts();
  check(quarters.join(',') === 'Q1,Q2,Q3,Q4,Grand Total', 'grouping by quarters gives four lines in calendar order');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the date grouping task is accepted');

  /* years and quarters together */
  await openPivot('8.10');
  await fieldTo('Date', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await chipMenu('rows', 0, 'Group');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-grouplist input[value="months"]').uncheck();
  await page.locator('.pv-grouplist input[value="years"]').check();
  await page.locator('.pv-grouplist input[value="quarters"]').check();
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('.pv-area[data-area="rows"] .chip').count()) === 2,
    'ticking two boxes in the Group dialog creates two nested fields');
  check((await pivotText()).includes('747,500'), 'and the year subtotals appear');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the years-and-quarters task is accepted');

  /* % of row total in a grid */
  await openPivot('8.11');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Product', 'Add to Column Labels');
  await fieldTo('Revenue', 'Add to Values');
  await chipMenu('values', 0, 'Value Field Settings');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-show').selectOption({ label: '% of row total' });
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  check((await pivotText()).includes('39.2%'), 'the mix is shown as a percentage of each row');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the % of row total task is accepted');

  /* a Top N value filter */
  await openPivot('8.12');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await chipMenu('rows', 0, 'Top 10');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-topn').fill('3');
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  txt = await pivotText();
  check(!txt.includes('Urals'), 'the Top 3 filter drops the smallest region');
  check(txt.includes('1,281,500'), 'and the grand total falls to what survived the filter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the Top N task is accepted');

  /* Max and Min side by side */
  await openPivot('8.13');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await fieldTo('Revenue', 'Add to Values');
  check((await page.locator('.pv-area[data-area="values"] .chip').count()) === 2,
    'the same field can sit in Values twice');
  await chipMenu('values', 0, 'Value Field Settings');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-agg').selectOption({ label: 'Max' });
  await page.locator('.pv-ok').click();
  await chipMenu('values', 1, 'Value Field Settings');
  await page.waitForSelector('.pv-modal');
  await page.locator('.pv-agg').selectOption({ label: 'Min' });
  await page.locator('.pv-ok').click();
  await page.waitForSelector('table.pivot-table');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the Max and Min task is accepted');

  /* dragging: the field list into an area, and between areas */
  await openPivot('8.1');
  await page.locator('.pf-row', { hasText: 'Region' }).first()
    .dragTo(page.locator('.pv-area[data-area="rows"]'));
  await page.locator('.pf-row', { hasText: 'Revenue' }).first()
    .dragTo(page.locator('.pv-area[data-area="values"]'));
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('.pv-area[data-area="rows"] .chip').count()) === 1 &&
        (await page.locator('.pv-area[data-area="values"] .chip').count()) === 1,
    'a field can be dragged from the list into an area');
  check((await pivotText()).includes('41,800'), 'and the dragged-in pivot computes');
  await page.locator('.pv-area[data-area="rows"] .chip').first()
    .dragTo(page.locator('.pv-area[data-area="cols"]'));
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('.pv-area[data-area="rows"] .chip').count()) === 0 &&
        (await page.locator('.pv-area[data-area="cols"] .chip').count()) === 1,
    'and a chip can be dragged from one area to another');
  // unticking a field takes it out of the report again
  await page.locator('.pf-row', { hasText: 'Revenue' }).first().locator('.pf-check').uncheck();
  check((await page.locator('.pv-area[data-area="values"] .chip').count()) === 0,
    'unticking a field removes it from the report');

  /* the Grand Totals and Subtotals commands from the ribbon */
  await openPivot('8.1');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Revenue', 'Add to Values');
  await page.locator('.pv-rbtn', { hasText: 'Grand Totals' }).click();
  await menuPick('Off for Rows and Columns');
  await page.waitForSelector('table.pivot-table');
  check(!(await pivotText()).includes('Grand Total'), 'the grand total row can be switched off');

  /* a field may group the rows and be summarised at the same time, as in Excel */
  await openPivot('8.1');
  await fieldTo('Region', 'Add to Row Labels');
  await fieldTo('Region', 'Add to Values');
  check((await page.locator('.pv-area[data-area="rows"] .chip').count()) === 1,
    'sending a field to Values leaves it grouping the rows');
  check((await page.locator('.pv-area[data-area="values"] .chip').count()) === 1,
    'and it is summarised as well');
  check((await page.locator('.pv-area[data-area="values"] .chip-name').first().innerText()).indexOf('Count of') === 0,
    'a text field dropped into Values defaults to Count, as Excel defaults it');

  /* ---------- marking is on the value, never on the formula ---------- */
  await page.goto(base + '#/4/4.1');
  await page.waitForSelector('table.sheet');
  // 4.1 is the SUMIF drill; type the five answers in as plain numbers instead
  const typedAnswers = ['41800', '15000', '16600', '7950', '21250'];
  for (let i = 0; i < typedAnswers.length; i++) {
    await page.locator('td[data-r="' + (i + 1) + '"][data-c="9"]').click();
    await page.keyboard.type(typedAnswers[i]);
    await page.keyboard.press('Enter');
  }
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'a typed-in number is marked correct: the test scores the value, not the formula');
  check((await page.locator('.result.note').count()) === 1,
    'and a note says what the task was drilling');
  check(/typed in/.test(await page.locator('.result.note').innerText()),
    'the note is about the method, not a penalty: ' +
    (await page.locator('.result.note').innerText()).slice(0, 60));

  // a formula that gets there another way is equally fine
  await page.goto(base + '#/level/4');
  await page.goto(base + '#/4/4.1');
  await page.waitForSelector('table.sheet');
  for (let i = 0; i < 5; i++) {
    await page.locator('td[data-r="' + (i + 1) + '"][data-c="9"]').click();
    await page.keyboard.type('=SUMPRODUCT(($B$2:$B$21=$I' + (i + 2) + ')*$F$2:$F$21)');
    await page.keyboard.press('Enter');
  }
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'SUMPRODUCT is accepted where the task was drilling SUMIF');

  // the wrong number is still wrong
  await page.goto(base + '#/level/4');
  await page.goto(base + '#/4/4.1');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="1"][data-c="9"]').click();
  await page.keyboard.type('123');
  await page.keyboard.press('Enter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.bad');
  check(/does not match/.test(await page.locator('.result').innerText()),
    'a wrong value still fails, and the reason is the value');

  /* ---------- a pivot table is available beside every question ---------- */
  const sampleTasks = [['1', '1.1'], ['4', '4.1'], ['7', '7.1'], ['9', '9.1'], ['11', '11.1']];
  let missingPivot = [];
  for (const [lid, tid] of sampleTasks) {
    await page.goto(base + '#/level/' + lid);
    await page.goto(base + '#/' + lid + '/' + tid);
    await page.waitForSelector('table.sheet');
    const tabCount = await page.locator('.work-tabs button[data-tab="pivot"]').count();
    if (!tabCount) missingPivot.push(lid + '/' + tid);
  }
  check(missingPivot.length === 0,
    'every question offers a pivot table tab: ' + (missingPivot.join(', ') || 'all present'));

  /* the scratch pivot works, and answers a question it was not built for */
  await page.goto(base + '#/level/4');
  await page.goto(base + '#/4/4.1');
  await page.waitForSelector('table.sheet');
  await page.locator('.work-tabs button[data-tab="pivot"]').click();
  await page.waitForSelector('.pv-shell');
  check((await page.locator('.pv-scratch').count()) === 1,
    'it says plainly that a scratch pivot is not what gets marked');
  await page.locator('.pf-row', { hasText: 'Region' }).first().locator('.pf-check').check();
  await page.locator('.pf-row', { hasText: 'Revenue' }).first().locator('.pf-check').check();
  await page.waitForSelector('table.pivot-table');
  const scratch = await page.locator('table.pivot-table').innerText();
  check(scratch.includes('Moscow') && scratch.includes('41,800'),
    'a pivot built beside a formula question gives the same answer the formula would');
  // read it off and type it in — which is exactly how the real test would be sat
  await page.locator('.work-tabs button[data-tab="sheet"]').click();
  await page.waitForSelector('table.sheet');
  for (let i = 0; i < typedAnswers.length; i++) {
    await page.locator('td[data-r="' + (i + 1) + '"][data-c="9"]').click();
    await page.keyboard.type(typedAnswers[i]);
    await page.keyboard.press('Enter');
  }
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'and the answer read off that pivot is marked correct');

  /* Change Data Source, for a sheet the guess got wrong */
  await page.goto(base + '#/level/9');
  await page.goto(base + '#/9/9.1');
  await page.waitForSelector('table.sheet');
  await page.locator('.work-tabs button[data-tab="pivot"]').click();
  await page.waitForSelector('.pv-shell');
  await page.locator('.pv-rbtn', { hasText: 'Data Source' }).click();
  await page.waitForSelector('.pv-menu');
  await page.locator('.pv-menu .pv-mitem', { hasText: 'Change Data Source' }).first().click();
  await page.waitForSelector('.pv-modal');
  check((await page.locator('.pv-source').count()) === 1,
    'Change Data Source asks for a Table/Range, as Excel asks for it');
  await page.locator('.pv-cancel').click();

  /* ---------- every task opens, plus a spread of generated questions ---------- */
  const allTasks = await page.evaluate(() => {
    const own = window.XLCurriculum.levels.flatMap(l => l.tasks.map(t => [l.id, t.id]));
    // one question from every fifth paper, and every question of two whole papers
    const papers = window.XLCurriculum.papers;
    const sample = papers.filter((p, i) => i % 5 === 0).map(p => [12, p.tasks[3].id]);
    const whole = [papers[1], papers[49]].flatMap(p => p.tasks.map(t => [12, t.id]));
    return own.concat(sample, whole);
  });
  let broken = [];
  for (const [lid, tid] of allTasks) {
    const before = errors.length;
    await page.goto(base + '#/' + lid + '/' + tid);
    try {
      await page.waitForSelector('table.sheet, .pv-shell', { timeout: 4000 });
      if (!(await page.locator('.brief').count())) broken.push(lid + '/' + tid + ' (no brief)');
    } catch (e) {
      broken.push(lid + '/' + tid + ' (did not open)');
    }
    if (errors.length > before) broken.push(lid + '/' + tid + ': ' + errors[before]);
  }
  check(broken.length === 0, 'all ' + allTasks.length + ' tasks open cleanly: ' + broken.slice(0, 4).join(' | '));
  console.log('  · tasks opened in the browser: ' + allTasks.length);

  /* ---------- the mock test ---------- */
  await page.goto(base + '#/level/12/M01');
  await page.waitForSelector('#start-exam');
  check((await page.locator('.task-row').count()) === 20, 'the mock test has 20 questions');
  check((await page.locator('.card').first().innerText()).includes('60 minutes'), 'the mock test runs for 60 minutes');
  await page.locator('#start-exam').click();
  await page.waitForSelector('#exam-timer');
  check(/(59|60):/.test(await page.locator('#exam-timer').textContent()), 'the exam timer starts at 60 minutes');
  check(await page.locator('#btn-check').count() === 0, 'there is no Check button during the exam');
  check(await page.locator('#btn-hint').count() === 0, 'there are no hints during the exam');
  check((await page.locator('.exam-chip').count()) === 20, 'the exam has a 20-question navigator');

  await page.locator('td[data-r="1"][data-c="9"]').click();
  await page.keyboard.type('=SUMIFS($G$2:$G$16,$B$2:$B$16,"Moscow",$A$2:$A$16,">="&$J$4,$A$2:$A$16,"<="&$J$5)');
  await page.keyboard.press('Enter');
  check((await page.locator('td[data-r="1"][data-c="9"] .cv').textContent()).replace(/,/g, '') === '646000',
    'question 1 of the exam computes correctly');
  await page.locator('#btn-next').click();
  await page.waitForFunction(() => location.hash === '#/12/E2');
  await page.locator('.exam-chip').first().click();
  // the hash changes before the view redraws, and question 2 also has a sheet,
  // so wait for question 1 itself rather than for any sheet at all
  await page.waitForFunction(() => {
    const c = document.querySelector('.crumbs');
    return location.hash === '#/12/E1' && c && /Question 1 of/.test(c.textContent);
  });
  check((await page.locator('td[data-r="1"][data-c="9"] .cv').textContent()).replace(/,/g, '') === '646000',
    'answers survive moving between exam questions');
  await page.locator('#btn-finish').click();
  await page.waitForSelector('.task-list');
  check(/Passed|Not passed/.test(await page.locator('.page-head h1').textContent()), 'the exam result screen appears');
  check((await page.locator('.task-row').count()) === 20, 'the result screen lists all 20 questions');

  /* a failed exam must not wipe anything */
  const xpAfterExam = await page.evaluate(() => window.XLStore.data.xp);
  check(xpAfterExam > 0, 'a failed exam does not erase progress');

  /* ---------- entering a test again always starts it over ---------- */
  await page.goto(base + '#/12/E1');
  await page.waitForSelector('table.sheet');
  check((await page.locator('td[data-r="1"][data-c="9"] .cv').textContent()) === '',
    'a question of a finished paper opens clean, not with the old answer');
  check(await page.locator('#exam-timer').count() === 0, 'and not inside a sitting');

  await page.goto(base + '#/level/12/M01');
  await page.waitForSelector('#start-exam');
  await page.locator('#start-exam').click();
  await page.waitForSelector('#exam-timer');
  check((await page.locator('td[data-r="1"][data-c="9"] .cv').textContent()) === '',
    'starting the paper again gives a clean sheet');
  check(/(59|60):/.test(await page.locator('#exam-timer').textContent()),
    'and a full hour again');

  /* walking out of a started sitting ends it, so the next entry is a new attempt */
  await page.locator('td[data-r="1"][data-c="9"]').click();
  await page.keyboard.type('12345');
  await page.keyboard.press('Enter');
  await page.locator('.mainnav [data-nav="home"]').click();   // the dialog handler accepts
  await page.waitForSelector('.levels');
  check((await page.locator('#toast').textContent()).includes('new attempt'),
    'leaving a sitting says that the next entry starts over');
  await page.goto(base + '#/12/E1');
  await page.waitForSelector('table.sheet');
  check((await page.locator('td[data-r="1"][data-c="9"] .cv').textContent()) === '',
    'the abandoned answers are gone when the question is opened again');
  check(await page.locator('#exam-timer').count() === 0, 'and the abandoned clock is not still running');

  await page.goto(base + '#/stats');
  await page.waitForSelector('.stat-grid');
  check((await page.locator('table.ref tbody tr').count()) >= 1, 'the exam is recorded in the history');
  check((await page.locator('table.ref').innerText()).includes('Mock test 1'),
    'the history says which paper was sat');
  check(await page.evaluate(() => window.XLStore.data.exams[0].paper) === 'M01',
    'the sitting is filed against its paper');
  check((await page.locator('.stat').count()) === 6, 'the progress page renders');

  /* a sat paper is marked on the picker, and the next one is offered */
  await page.goto(base + '#/level/12');
  await page.waitForSelector('.paper-grid');
  check((await page.locator('.paper-chip.tried, .paper-chip.passed').count()) === 1,
    'the paper just sat is marked on the picker');
  check((await page.locator('#start-exam').innerText()).includes('mock test 2'),
    'the next unsat paper is the one offered: ' + (await page.locator('#start-exam').innerText()));

  /* ---------- persistence ---------- */
  const xpBefore = await page.evaluate(() => window.XLStore.data.xp);
  await page.goto(base);
  await page.waitForSelector('.levels');
  const xpAfter = await page.evaluate(() => window.XLStore.data.xp);
  check(xpBefore === xpAfter && xpAfter > 0, 'progress survives a reload');

  /* the macOS case: progress is written to a file through the local server, so
   * it survives the browser's own storage being empty — which is what happens
   * when the app is relaunched on a different port, or in Safari, or as a file */
  check(saved() && saved().xp === xpBefore, 'progress is written out to the store behind the server');
  check(await page.evaluate(() => window.XLStore.persistent) === true, 'the store reports itself as durable');
  check(/file|machine|browser/.test(await page.evaluate(() => window.XLStore.storedIn)),
    'the app can say where progress is kept: ' + (await page.evaluate(() => window.XLStore.storedIn)));
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(base);
  await page.waitForSelector('.levels');
  check(await page.evaluate(() => window.XLStore.data.xp) === xpBefore,
    'progress comes back from the store even with the browser storage wiped');
  check(await page.evaluate(() => window.XLStore.data.exams.length) >= 1,
    'the mock test history comes back with it');

  /* ---------- reference and dojo ---------- */
  await page.goto(base + '#/reference');
  await page.waitForSelector('table.ref');
  check((await page.locator('table.ref tbody tr').count()) > 20, 'the reference is populated');
  await page.locator('.ref-tabs button[data-tab="pivot"]').click();
  await page.waitForSelector('table.ref');
  check((await page.locator('table.ref tbody tr').count()) > 15, 'the reference has a pivot table section');
  await page.locator('.ref-search').fill('grouping');
  check((await page.locator('table.ref tbody tr').count()) > 0, 'and searching it for "grouping" finds something');
  await page.goto(base + '#/dojo');
  await page.waitForSelector('.dojo-options');
  check((await page.locator('.opt').count()) === 4, 'the dojo offers four answers');
  await page.keyboard.press('1');
  await page.waitForSelector('.dojo-why');
  check(await page.locator('.opt.correct').count() === 1, 'the dojo marks the right answer');

  check(errors.length === 0, 'no console errors: ' + errors.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();
  console.log(`\ninterface: ${pass} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

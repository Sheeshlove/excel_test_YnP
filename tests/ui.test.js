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
  check(await page.locator('.level-card.locked').count() > 0, 'later levels start locked');
  check((await page.locator('.notice').innerText()).includes('Nothing here can be lost'),
    'the home screen states that progress cannot be lost');
  check(!/[А-Яа-яЁё]/.test(await page.locator('body').innerText()), 'the interface is entirely in English');

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
  check((await page.locator('td[data-r="1"][data-c="3"] .cv').textContent()) === '1700',
    'work in progress on another task survives untouched');

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

  /* ---------- level 8: building a pivot table ---------- */
  await page.goto(base + '#/8/8.1');
  await page.waitForSelector('.pivot-wrap');
  check((await page.locator('.pf-row').count()) === 7, 'the pivot field list shows every column');
  check((await page.locator('.pivot-area').count()) === 4, 'the four pivot areas are present');
  async function sendField(name, which) {
    const row = page.locator('.pf-row', { hasText: name }).first();
    await row.locator('.pf-btn', { hasText: which }).click();
  }
  await sendField('Region', 'Rows');
  await sendField('Revenue', 'Σ');
  await page.waitForSelector('table.pivot-table');
  const pivotText = await page.locator('table.pivot-table').innerText();
  check(pivotText.includes('Moscow') && pivotText.includes('41,800'), 'the pivot groups revenue by region');
  check(pivotText.includes('Grand Total') && pivotText.includes('102,600'), 'the pivot shows a grand total');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the pivot task is accepted');

  /* a pivot built the wrong way round is rejected */
  await page.goto(base + '#/8/8.2');
  await page.waitForSelector('.pivot-wrap');
  await sendField('Industry', 'Rows');
  await sendField('Region', 'Cols');
  await sendField('Revenue', 'Σ');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result');
  const wrongMsg = await page.locator('.result').innerText();
  check(await page.locator('.result.bad').count() === 1, 'a transposed pivot is rejected');
  check(/Rows area/.test(wrongMsg), 'the rejection explains which area is wrong: ' + wrongMsg.slice(0, 80));

  /* ---------- calculated field ---------- */
  await page.goto(base + '#/8/8.6');
  await page.waitForSelector('.pivot-wrap');
  await sendField('Region', 'Rows');
  await page.locator('.pa-calc').click();
  await page.locator('.cf-name').fill('Gross profit');
  await page.locator('.cf-formula').fill('Revenue * Margin');
  await page.locator('.cf-ok').click();
  await page.waitForSelector('table.pivot-table');
  check((await page.locator('table.pivot-table').innerText()).includes('75,240'),
    'the calculated field computes revenue times margin');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(true, 'the calculated field task is accepted');

  /* ---------- every task opens ---------- */
  const allTasks = await page.evaluate(() =>
    window.XLCurriculum.levels.flatMap(l => l.tasks.map(t => [l.id, t.id])));
  let broken = [];
  for (const [lid, tid] of allTasks) {
    const before = errors.length;
    await page.goto(base + '#/' + lid + '/' + tid);
    try {
      await page.waitForSelector('table.sheet, .pivot-wrap', { timeout: 4000 });
      if (!(await page.locator('.brief').count())) broken.push(lid + '/' + tid + ' (no brief)');
    } catch (e) {
      broken.push(lid + '/' + tid + ' (did not open)');
    }
    if (errors.length > before) broken.push(lid + '/' + tid + ': ' + errors[before]);
  }
  check(broken.length === 0, 'all ' + allTasks.length + ' tasks open cleanly: ' + broken.slice(0, 4).join(' | '));
  console.log('  · tasks opened in the browser: ' + allTasks.length);

  /* ---------- the mock test ---------- */
  await page.evaluate(() => {
    window.XLCurriculum.levels.slice(0, 11).forEach(l => l.tasks.forEach(t => {
      window.XLStore.data.tasks[t.id] = { best: 1, attempts: 1, hinted: false, seenSolution: false, solvedAt: new Date().toISOString() };
    }));
    window.XLStore.flush();
  });
  await page.goto(base + '#/level/12');
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
  await page.waitForFunction(() => location.hash === '#/12/E1');
  await page.waitForSelector('table.sheet');
  check((await page.locator('td[data-r="1"][data-c="9"] .cv').textContent()).replace(/,/g, '') === '646000',
    'answers survive moving between exam questions');
  await page.locator('#btn-finish').click();
  await page.waitForSelector('.task-list');
  check(/Passed|Not passed/.test(await page.locator('.page-head h1').textContent()), 'the exam result screen appears');
  check((await page.locator('.task-row').count()) === 20, 'the result screen lists all 20 questions');

  /* a failed exam must not wipe anything */
  const xpAfterExam = await page.evaluate(() => window.XLStore.data.xp);
  check(xpAfterExam > 0, 'a failed exam does not erase progress');

  await page.goto(base + '#/stats');
  await page.waitForSelector('.stat-grid');
  check((await page.locator('table.ref tbody tr').count()) >= 1, 'the exam is recorded in the history');
  check((await page.locator('.stat').count()) === 6, 'the progress page renders');

  /* ---------- persistence ---------- */
  const xpBefore = await page.evaluate(() => window.XLStore.data.xp);
  await page.goto(base);
  await page.waitForSelector('.levels');
  const xpAfter = await page.evaluate(() => window.XLStore.data.xp);
  check(xpBefore === xpAfter && xpAfter > 0, 'progress survives a reload');

  /* ---------- reference and dojo ---------- */
  await page.goto(base + '#/reference');
  await page.waitForSelector('table.ref');
  check((await page.locator('table.ref tbody tr').count()) > 20, 'the reference is populated');
  await page.locator('.ref-search').fill('pivot');
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

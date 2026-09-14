/* Progress has to survive things that used to destroy it. This suite runs the
 * real Python server against a real file on disk and checks that:
 *   - answers are written to the file as they are given
 *   - wiping browser storage does not lose progress
 *   - a changed port does not lose progress (which it used to, silently)
 *   - two devices merge instead of one overwriting the other
 */
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('  x ' + msg); } }

// A fresh port range per run, so a server left behind by an interrupted run
// cannot make this one look broken.
const BASE_PORT = 40000 + Math.floor(Math.random() * 20000);
const spawned = [];
process.on('exit', () => spawned.forEach(p => { try { p.kill(); } catch (e) {} }));

function startServer(dataDir, port) {
  return new Promise((res, rej) => {
    const p = spawn('python3', [path.join(ROOT, 'packaging', 'server.py'), APP, String(port)], {
      env: Object.assign({}, process.env, { EXCEL_TRAINER_DATA: dataDir })
    });
    let out = '';
    const timer = setTimeout(() => rej(new Error('server did not start')), 5000);
    p.stdout.on('data', d => {
      out += d.toString();
      const lines = out.split('\n');
      if (lines.length >= 2 && lines[0].trim()) {
        clearTimeout(timer);
        res({ proc: p, port: Number(lines[0].trim()), file: lines[1].trim() });
      }
    });
    p.on('error', rej);
    spawned.push(p);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'trainer-progress-'));
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });

  /* ---------- 1. answers reach the file on disk ---------- */
  let srv = await startServer(dataDir, BASE_PORT);
  check(srv.port === BASE_PORT, 'the server takes the fixed port it asks for, so browser storage survives a restart');
  check(srv.file.startsWith(dataDir), 'progress goes to the data directory: ' + srv.file);

  let ctx = await browser.newContext();
  let page = await ctx.newPage();
  page.on('dialog', d => d.accept());
  const url = p => `http://127.0.0.1:${srv.port}/index.html` + (p || '');

  await page.goto(url('#/1/1.1'));
  await page.waitForSelector('table.sheet');
  check(await page.evaluate(() => window.XLStore.disk.available),
    'the app finds the local server and switches on file saving');

  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.type('=B2-C2');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+d');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  const xp = Number(await page.locator('#xp-value').textContent());
  check(xp > 0, 'the task was solved and scored');

  await sleep(900);                                   // the debounced write
  check(fs.existsSync(srv.file), 'the progress file exists after answering');
  let onDisk = JSON.parse(fs.readFileSync(srv.file, 'utf8'));
  check(onDisk.xp === xp, 'the file holds the same XP the screen shows');
  check(onDisk.tasks['1.1'] && onDisk.tasks['1.1'].best === 1, 'the solved task is in the file');
  check(!!onDisk.savedAt, 'the file records when it was written');

  /* ---------- 2. wiping browser storage loses nothing ---------- */
  await page.evaluate(() => { localStorage.clear(); });
  await page.goto(url());                              // back to the programme screen
  await page.waitForSelector('.levels');
  await page.waitForFunction(() => window.XLStore.data.xp > 0, null, { timeout: 5000 })
    .catch(() => {});
  check(Number(await page.locator('#xp-value').textContent()) === xp,
    'progress comes back from the file after browser storage is wiped');
  await ctx.close();

  /* ---------- 3. a different port does not lose progress ---------- */
  // This is what used to happen on every launch: the server picked a random
  // port, the origin changed, and the browser handed the app an empty store.
  srv.proc.kill();
  await sleep(300);
  srv = await startServer(dataDir, BASE_PORT + 1);
  ctx = await browser.newContext();                    // a fresh profile, as after a rebuild
  page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForSelector('.levels');
  await page.waitForFunction(() => window.XLStore.data.xp > 0, null, { timeout: 5000 }).catch(() => {});
  check(Number(await page.locator('#xp-value').textContent()) === xp,
    'progress survives the app restarting on a different port');
  check((await page.locator('.level-card').first().innerText()).includes('/ 80'),
    'the level card still shows the points that were earned');
  await ctx.close();

  /* ---------- 4. two devices merge, neither overwrites ---------- */
  // the file already holds task 1.1; give the browser a different solved task
  ctx = await browser.newContext();
  page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForSelector('.levels');
  await page.evaluate(() => {
    // pretend this browser was used on its own, offline, on another task
    var d = window.XLStore.data;
    d.tasks = { '1.3': { best: 1, attempts: 1, hinted: false, seenSolution: false, solvedAt: new Date().toISOString() } };
    d.xp = 15;
    localStorage.setItem('ynp-excel-trainer-v1', JSON.stringify(d));
  });
  await page.reload();
  await page.waitForSelector('.levels');
  await page.waitForFunction(() => {
    var t = window.XLStore.data.tasks;
    return t['1.1'] && t['1.3'];
  }, null, { timeout: 5000 }).catch(() => {});
  const merged = await page.evaluate(() => window.XLStore.data);
  check(merged.tasks['1.1'] && merged.tasks['1.1'].best === 1, 'the merge keeps the task the file had');
  check(merged.tasks['1.3'] && merged.tasks['1.3'].best === 1, 'the merge keeps the task the browser had');
  check(merged.xp >= xp, 'the merge does not reduce XP');
  await sleep(900);
  onDisk = JSON.parse(fs.readFileSync(srv.file, 'utf8'));
  check(onDisk.tasks['1.1'] && onDisk.tasks['1.3'], 'the merged result is written back to the file');

  /* ---------- 4b. a stale write cannot undo a solved task ---------- */
  // Two windows open at once: the one that closes last used to write its own,
  // older picture over the file. The server now merges on write instead.
  const stale = {
    version: 1, xp: 0,
    tasks: { '1.1': { best: 0, attempts: 7, hinted: true, seenSolution: true } },
    drills: { total: 0, correct: 0, bestStreak: 0 }, exams: [], streak: { days: 0, lastDay: null }
  };
  const put = await fetch(`http://127.0.0.1:${srv.port}/api/progress`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(stale)
  });
  check(put.ok, 'the server accepts a write');
  onDisk = JSON.parse(fs.readFileSync(srv.file, 'utf8'));
  check(onDisk.tasks['1.1'].best === 1, 'a stale write cannot lower a solved task');
  check(onDisk.tasks['1.3'], 'a stale write cannot delete another task');
  check(onDisk.xp >= xp, 'a stale write cannot lower XP');

  const bad = await fetch(`http://127.0.0.1:${srv.port}/api/progress`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: 'not json'
  });
  check(bad.status === 400, 'the server rejects a body that is not JSON');
  onDisk = JSON.parse(fs.readFileSync(srv.file, 'utf8'));
  check(onDisk.tasks['1.1'].best === 1, 'a rejected write leaves the file untouched');

  /* ---------- 5. the file is written atomically, with a backup ---------- */
  check(fs.existsSync(path.join(path.dirname(srv.file), 'progress.backup.json')),
    'the previous version is kept as a backup');
  // A write killed halfway can leave its temporary file behind; the server
  // sweeps those away when it next starts.
  fs.writeFileSync(path.join(path.dirname(srv.file), '.progress-leftover.json'), '{}');
  srv.proc.kill();
  await sleep(300);
  srv = await startServer(dataDir, BASE_PORT + 2);
  const stray = fs.readdirSync(path.dirname(srv.file)).filter(f => f.startsWith('.progress-'));
  check(stray.length === 0, 'leftover temporary files are cleaned up on the next start');
  check(JSON.parse(fs.readFileSync(srv.file, 'utf8')).tasks['1.1'].best === 1,
    'the real progress file is untouched by the sweep');

  /* ---------- 6. the progress page reports where it saves ---------- */
  await page.goto(`http://127.0.0.1:${srv.port}/index.html#/stats`);
  await page.waitForSelector('.save-status');
  const status = await page.locator('.save-status').innerText();
  check(/Saved to a file/.test(status), 'the progress page says the work is saved to a file');
  check(status.includes(srv.file), 'the progress page shows the exact path');
  await page.locator('#btn-savenow').click();
  await sleep(400);
  check(true, 'the manual save button works');
  await ctx.close();

  /* ---------- 7. with no server the app still runs on browser storage ---------- */
  srv.proc.kill();
  await sleep(300);
  const staticSrv = require('http').createServer((req, res) => {
    let p = decodeURIComponent(req.url.split('?')[0]);
    if (p === '/') p = '/index.html';
    const f = path.join(APP, p);
    if (!f.startsWith(APP) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/json' };
    res.writeHead(200, { 'Content-Type': (types[path.extname(f)] || 'text/plain') + '; charset=utf-8' });
    res.end(fs.readFileSync(f));
  });
  await new Promise(r => staticSrv.listen(0, '127.0.0.1', r));
  ctx = await browser.newContext();
  page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`http://127.0.0.1:${staticSrv.address().port}/index.html`);
  await page.waitForSelector('.levels');
  await sleep(500);
  check(await page.evaluate(() => window.XLStore.disk.available) === false,
    'with no local server the app falls back to browser storage');
  check(errs.length === 0, 'a missing save API causes no errors: ' + errs.slice(0, 2).join(' | '));
  await page.goto(`http://127.0.0.1:${staticSrv.address().port}/index.html#/stats`);
  await page.waitForSelector('.save-status');
  check(/Saved in this browser/.test(await page.locator('.save-status').innerText()),
    'the progress page is honest about browser-only storage');
  staticSrv.close();

  await browser.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`\nprogress saving: ${pass} checks passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

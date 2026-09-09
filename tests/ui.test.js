/* Проверка интерфейса в настоящем браузере: навигация, ввод формул,
 * протягивание ⌘D, переключение $, проверка задачи, додзё. */
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
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('  ✗ ' + msg); } }

(async () => {
  const { srv, port } = await serve();
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const base = `http://127.0.0.1:${port}/index.html`;
  await page.goto(base);
  await page.waitForSelector('.levels');

  // --- главная
  check((await page.locator('.level-card').count()) === 10, 'на главной должно быть 10 уровней');
  check(await page.locator('.level-card.locked').count() > 0, 'закрытые уровни должны быть заблокированы');

  // --- открываем уровень 1
  await page.locator('.level-card[data-level="1"]').click();
  await page.waitForSelector('.task-list');
  check((await page.locator('.task-row').count()) === 5, 'на уровне 1 должно быть 5 задач');
  check((await page.locator('.theory-item').count()) >= 3, 'теория должна отображаться');

  // --- открываем задачу 1.1
  await page.locator('.task-row').first().click();
  await page.waitForSelector('table.sheet');
  const cellCount = await page.locator('table.sheet td').count();
  check(cellCount > 20, 'таблица отрисована');
  check((await page.locator('td.target').count()) === 5, 'должно быть 5 целевых ячеек (D2:D6)');
  check((await page.locator('td.hdr').count()) >= 4, 'заголовки таблицы оформлены');
  // данные видны
  check((await page.locator('td[data-r="1"][data-c="1"] .cv').textContent()) === '4200', 'данные исходной таблицы видны');

  // --- вводим формулу в D2 через клавиатуру
  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.type('=B2-C2');
  await page.keyboard.press('Enter');
  const d2 = await page.locator('td[data-r="1"][data-c="3"] .cv').textContent();
  check(d2 === '1700', 'формула =B2-C2 посчиталась (получено ' + d2 + ')');

  // --- проверка неполного решения
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result');
  check(await page.locator('.result.bad').count() === 1, 'неполное решение не принимается');

  // --- протягивание вниз ⌘D: выделяем D2:D6 и заполняем
  await page.locator('td[data-r="1"][data-c="3"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+d');
  const d6 = await page.locator('td[data-r="5"][data-c="3"] .cv').textContent();
  check(d6 === '1200', 'протягивание ⌘D перенесло относительные ссылки (D6 = ' + d6 + ')');

  // --- теперь задача должна быть засчитана
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result.ok');
  check(await page.locator('.result.ok').count() === 1, 'полное решение засчитано');
  const xp = await page.locator('#xp-value').textContent();
  check(Number(xp) > 0, 'начислены XP (' + xp + ')');

  // --- строка формул показывает исходную формулу
  await page.locator('td[data-r="2"][data-c="3"]').click();
  check((await page.locator('#fb-input').inputValue()) === '=B3-C3', 'строка формул показывает формулу ячейки');

  // --- статусбар считает выделение
  await page.locator('td[data-r="1"][data-c="1"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  const status = await page.locator('#statusbar').textContent();
  check(/10\s?850/.test(status.replace(/ /g, ' ')), 'статусбар считает сумму выделения: ' + status.slice(0, 60));

  // --- защита исходных данных
  await page.locator('td[data-r="1"][data-c="1"]').click();
  await page.keyboard.type('999');
  await page.keyboard.press('Enter');
  check((await page.locator('td[data-r="1"][data-c="1"] .cv').textContent()) === '4200', 'исходные данные защищены от изменения');

  // --- ⌘T переключает доллары при вводе
  await page.goto(base + '#/1/1.4');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="1"][data-c="2"]').click();
  await page.keyboard.type('=B2/B8');
  await page.keyboard.press('Meta+t');
  const editVal = await page.locator('.cell-input').inputValue();
  check(editVal === '=B2/$B$8', '⌘T проставил доллары: ' + editVal);
  await page.keyboard.press('Enter');

  // --- подсказка
  await page.locator('#btn-hint').click();
  check(await page.locator('.hintbox').count() === 1, 'подсказка показывается');

  // --- переход к сложной задаче с СУММЕСЛИМН и проверка кросс-таблицы
  await page.goto(base + '#/4/4.1');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="1"][data-c="9"]').click();
  await page.keyboard.type('=СУММЕСЛИ($B$2:$B$21;I2;$F$2:$F$21)');
  await page.keyboard.press('Enter');
  const j2 = await page.locator('td[data-r="1"][data-c="9"] .cv').textContent();
  check(j2.replace(/\s/g, '') === '41800', 'СУММЕСЛИ по Москве = 41800 (получено ' + j2 + ')');

  // --- решение показывается по кнопке
  page.on('dialog', d => d.accept());
  await page.locator('#btn-solution').click();
  await page.waitForSelector('.solution-box');
  check(await page.locator('.solution-box').count() === 1, 'кнопка «Решение» показывает эталон');

  // --- додзё
  await page.goto(base + '#/dojo');
  await page.waitForSelector('.dojo-options');
  check((await page.locator('.opt').count()) === 4, 'в додзё четыре варианта ответа');
  await page.keyboard.press('1');
  await page.waitForSelector('.dojo-why');
  check(await page.locator('.opt.correct').count() === 1, 'правильный ответ подсвечивается');
  await page.keyboard.press('Enter');
  check(await page.locator('.dojo-prompt').count() === 1, 'переход к следующему вопросу работает');

  // --- справочник
  await page.goto(base + '#/reference');
  await page.waitForSelector('table.ref');
  check((await page.locator('table.ref tbody tr').count()) > 20, 'справочник заполнен');
  await page.locator('.ref-search').fill('доллар');
  check((await page.locator('table.ref tbody tr').count()) >= 1, 'поиск по справочнику работает');

  // --- прогресс
  await page.goto(base + '#/stats');
  await page.waitForSelector('.stat-grid');
  check((await page.locator('.stat').count()) === 6, 'страница прогресса отрисована');

  // --- экзамен закрыт, пока не пройдены уровни
  await page.goto(base + '#/level/10');
  await page.waitForTimeout(200);
  check(await page.locator('.levels').count() === 1, 'экзамен закрыт до прохождения программы');

  // --- прогресс сохраняется между перезагрузками
  const xpBefore = await page.evaluate(() => window.XLStore.data.xp);
  await page.goto(base);
  await page.waitForSelector('.levels');
  const xpAfter = await page.evaluate(() => window.XLStore.data.xp);
  check(xpBefore === xpAfter && xpAfter > 0, 'прогресс сохраняется между перезагрузками');

  // --- матрица 4.5: одна формула на 25 ячеек через ⌘D и ⌘R
  await page.goto(base + '#/4/4.5');
  await page.waitForSelector('table.sheet');
  await page.locator('td[data-r="2"][data-c="9"]').click();               // J3
  await page.keyboard.type('=СУММЕСЛИМН($F$2:$F$21;$B$2:$B$21;$I3;$C$2:$C$21;J$2)');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="2"][data-c="9"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+r');                                    // растянуть вправо
  await page.locator('td[data-r="2"][data-c="9"]').click();
  await page.keyboard.down('Shift');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowRight');
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await page.keyboard.press('Meta+d');                                    // растянуть вниз
  const n7 = await page.locator('td[data-r="6"][data-c="13"] .cv').textContent();
  check(n7.replace(/\s/g, '') === '0', 'матрица растянулась: Сибирь×Госсектор = 0 (получено ' + n7 + ')');
  const k3 = await page.locator('td[data-r="2"][data-c="10"] .cv').textContent();
  check(k3.replace(/\s/g, '') === '10200', 'Москва×Промышленность = 10200 (получено ' + k3 + ')');
  // контрольные суммы
  await page.locator('td[data-r="8"][data-c="9"]').click();
  await page.keyboard.type('=СУММ(J3:N7)');
  await page.keyboard.press('Enter');
  await page.locator('td[data-r="9"][data-c="9"]').click();
  await page.keyboard.type('=СУММ(F2:F21)');
  await page.keyboard.press('Enter');
  await page.locator('#btn-check').click();
  await page.waitForSelector('.result');
  check(await page.locator('.result.ok').count() === 1, 'задача с кросс-таблицей засчитана одной формулой');

  // --- экзамен: разблокируем программу и прогоняем сессию
  await page.evaluate(() => {
    const cur = window.XLCurriculum;
    cur.levels.slice(0, 9).forEach(l => l.tasks.forEach(t => {
      window.XLStore.data.tasks[t.id] = { best: 1, attempts: 1, hinted: false, seenSolution: false, solvedAt: new Date().toISOString() };
    }));
    window.XLStore.flush();
  });
  await page.goto(base + '#/level/10');
  await page.waitForSelector('#start-exam');
  check(await page.locator('#start-exam').count() === 1, 'экзамен открывается после прохождения программы');
  await page.locator('#start-exam').click();
  await page.waitForSelector('#exam-timer');
  const timer = await page.locator('#exam-timer').textContent();
  check(/Осталось 4[45]:/.test(timer), 'таймер экзамена идёт: ' + timer);
  check(await page.locator('#btn-check').count() === 0, 'на экзамене нет кнопки «Проверить»');
  check(await page.locator('#btn-hint').count() === 0, 'на экзамене нет подсказок');

  // решаем первую задачу верно
  await page.locator('td[data-r="1"][data-c="9"]').click();
  await page.keyboard.type('=СУММЕСЛИМН($G$2:$G$16;$B$2:$B$16;"Москва";$A$2:$A$16;">="&$J$4;$A$2:$A$16;"<="&$J$5)');
  await page.keyboard.press('Enter');
  const e1 = await page.locator('td[data-r="1"][data-c="9"] .cv').textContent();
  check(e1.replace(/\s/g, '') === '646000', 'экзамен: E1 = 646000 (получено ' + e1 + ')');

  // переключаемся на другую задачу и обратно — ответ должен сохраниться
  await page.locator('#btn-next').click();
  await page.waitForSelector('table.sheet');
  await page.locator('.task-panel button[data-go="10/E1"]').click();
  await page.waitForSelector('table.sheet');
  const e1again = await page.locator('td[data-r="1"][data-c="9"] .cv').textContent();
  check(e1again.replace(/\s/g, '') === '646000', 'ответы сохраняются при переключении задач экзамена');

  await page.locator('#btn-finish').click();
  await page.waitForSelector('.task-list');
  const head = await page.locator('.page-head h1').textContent();
  check(/Экзамен (сдан|не сдан)/.test(head), 'экран результатов экзамена показан: ' + head);
  check((await page.locator('.task-row').count()) === 10, 'в результатах 10 задач');
  check((await page.locator('.task-status.done').count()) >= 1, 'решённая задача отмечена верной');

  await page.goto(base + '#/stats');
  await page.waitForSelector('.stat-grid');
  check((await page.locator('table.ref tbody tr').count()) >= 1, 'экзамен записан в историю');

  // --- каждая задача программы должна открываться без ошибок
  const allTasks = await page.evaluate(() =>
    window.XLCurriculum.levels.flatMap(l => l.tasks.map(t => [l.id, t.id])));
  let broken = [];
  for (const [lid, tid] of allTasks) {
    const before = errors.length;
    await page.goto(base + '#/' + lid + '/' + tid);
    try {
      await page.waitForSelector('table.sheet', { timeout: 4000 });
      const cells = await page.locator('td.target').count();
      const hasBrief = await page.locator('.brief').count();
      if (!cells || !hasBrief) broken.push(lid + '/' + tid + ' (нет целевых ячеек или условия)');
    } catch (e) {
      broken.push(lid + '/' + tid + ' (не открылась)');
    }
    if (errors.length > before) broken.push(lid + '/' + tid + ': ' + errors[before]);
  }
  check(broken.length === 0, 'все ' + allTasks.length + ' задач открываются: ' + broken.slice(0, 5).join(' | '));
  console.log('  · открыто задач в браузере: ' + allTasks.length);

  check(errors.length === 0, 'ошибок в консоли быть не должно: ' + errors.slice(0, 3).join(' | '));

  await browser.close();
  srv.close();
  console.log(`\nинтерфейс: ${pass} проверок прошло, ${fail} упало`);
  process.exit(fail ? 1 : 0);
})();

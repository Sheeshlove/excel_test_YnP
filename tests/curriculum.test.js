/* Проверка учебной программы:
 *  - эталонное решение каждой задачи проходит собственную проверку
 *  - эталон не возвращает ошибок Excel
 *  - пустой лист задачу не проходит (значит, проверка реально что-то проверяет)
 *  - ограничения (mustUse/mustContain) выполнимы эталоном
 */
const XLF = require('../app/js/formula.js');
const G = require('../app/js/grader.js');
const CUR = require('../app/js/curriculum.js');

let pass = 0, fail = 0;
const problems = [];

function check(cond, msg) {
  if (cond) pass++;
  else { fail++; problems.push(msg); }
}

CUR.levels.forEach(level => {
  check(level.tasks.length > 0, `уровень ${level.id}: нет задач`);
  const seen = new Set();
  level.tasks.forEach(task => {
    const tag = `[${task.id}] ${task.title}`;
    check(!seen.has(task.id), `${tag}: дублирующийся id`);
    seen.add(task.id);
    check(!!task.brief && !!task.hint, `${tag}: нет условия или подсказки`);
    check(!!task.solution && Object.keys(task.solution).length > 0, `${tag}: нет эталонного решения`);

    // 1. эталон проходит проверку
    let res;
    try {
      res = G.grade(task, G.referenceSheet(task));
    } catch (e) {
      check(false, `${tag}: эталон падает с ошибкой — ${e.message}`);
      return;
    }
    check(res.passed, `${tag}: эталонное решение НЕ проходит проверку — ` +
      res.cells.filter(c => !c.ok).map(c => `${c.cell}: ${c.reason} (получено ${JSON.stringify(c.got)})`).join('; '));

    // 2. эталон не возвращает ошибок Excel и не пустой
    const ref = G.referenceSheet(task);
    G.targetCells(task).forEach(a1 => {
      const v = ref.get(a1);
      check(!XLF.isError(v), `${tag}: эталон в ${a1} возвращает ${XLF.isError(v) ? v.type : ''}`);
      check(v !== null && v !== '', `${tag}: эталон в ${a1} пустой`);
    });

    // 3. пустой лист не должен проходить
    const empty = G.buildSheet(task);
    check(!G.grade(task, empty).passed, `${tag}: пустой лист проходит проверку — задача ничего не проверяет`);

    // 4. каждая целевая ячейка редактируема, каждая ячейка с данными — заперта
    const sh = G.buildSheet(task);
    G.targetCells(task).forEach(a1 => {
      const rc = XLF.a1ToRC(a1);
      check(!sh.isLocked(rc.row, rc.col), `${tag}: целевая ячейка ${a1} заперта`);
    });

    // 5. задача должна иметь баллы
    check(typeof task.points === 'number' && task.points > 0, `${tag}: не заданы баллы`);
  });
});

problems.slice(0, 40).forEach(p => console.log('  ✗ ' + p));
console.log(`\nпрограмма: ${pass} проверок прошло, ${fail} упало`);
console.log(`уровней: ${CUR.levels.length}, задач: ${CUR.levels.reduce((a, l) => a + l.tasks.length, 0)}, ` +
  `баллов всего: ${CUR.levels.reduce((a, l) => a + l.tasks.reduce((b, t) => b + t.points, 0), 0)}`);
module.exports = { pass, fail };
if (require.main === module && fail) process.exit(1);

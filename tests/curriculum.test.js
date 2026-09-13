/* Checks on the training programme itself:
 *  - the reference answer to every task passes that task's own marking
 *  - the reference answer never produces an Excel error
 *  - an untouched sheet does NOT pass, so the marking really tests something
 *  - every cell address mentioned in the wording actually exists on the sheet
 *  - every task carries a worked explanation
 */
const XLF = require('../app/js/formula.js');
const G = require('../app/js/grader.js');
const PV = require('../app/js/pivot.js');
const CUR = require('../app/js/curriculum.js');

let pass = 0, fail = 0;
const problems = [];
function check(cond, msg) {
  if (cond) pass++;
  else { fail++; problems.push(msg); }
}

const EMPTY_PIVOT = { rows: [], cols: [], values: [], filters: [] };

CUR.levels.forEach(level => {
  check(level.tasks.length > 0, `level ${level.id}: no tasks`);
  check((level.theory || []).length >= 3, `level ${level.id}: not enough theory`);
  const seen = new Set();

  level.tasks.forEach(task => {
    const tag = `[${task.id}] ${task.title}`;
    check(!seen.has(task.id), `${tag}: duplicate id`);
    seen.add(task.id);
    check(!!task.brief && !!task.hint, `${tag}: missing brief or hint`);

    const needsFormulas = (task.target || []).length > 0;
    check(!needsFormulas || Object.keys(task.solution || {}).length > 0, `${tag}: no reference answer`);
    check(!!task.explain && !!task.explain.idea && (task.explain.walk || []).length > 0,
      `${tag}: no explanation (needs explain.idea and explain.walk)`);
    check((task.explain.mistakes || []).length > 0, `${tag}: explanation lists no common mistakes`);
    check(typeof task.points === 'number' && task.points > 0, `${tag}: no points`);
    check(needsFormulas || !!(task.expect && (task.expect.pivot || task.expect.sortedBy || task.expect.filtered)),
      `${tag}: the task asks the learner for nothing`);

    // 1. the reference answer passes the task's own marking
    const extra = task.expect && task.expect.pivot ? { pivot: task.expect.pivot } : undefined;
    let res;
    try {
      res = G.grade(task, G.referenceSheet(task), extra);
    } catch (e) {
      check(false, `${tag}: the reference answer throws — ${e.message}`);
      return;
    }
    check(res.passed, `${tag}: the reference answer does NOT pass — ` +
      res.cells.filter(c => !c.ok).map(c => `${c.cell}: ${c.reason}`).join('; '));

    // 2. no Excel errors and no empty results in the reference answer
    const ref = G.referenceSheet(task);
    G.targetCells(task).forEach(a1 => {
      const v = ref.get(a1);
      check(!XLF.isError(v), `${tag}: the reference answer in ${a1} returns ${XLF.isError(v) ? v.type : ''}`);
      check(v !== null && v !== '', `${tag}: the reference answer in ${a1} is empty`);
    });

    // 3. an untouched sheet must not pass
    const empty = G.buildSheet(task);
    check(!G.grade(task, empty, { pivot: EMPTY_PIVOT }).passed,
      `${tag}: an untouched sheet passes — the marking tests nothing`);

    // 4. target cells are editable
    const sh = G.buildSheet(task);
    G.targetCells(task).forEach(a1 => {
      const rc = XLF.a1ToRC(a1);
      check(!sh.isLocked(rc.row, rc.col), `${tag}: target cell ${a1} is locked`);
    });

    // 5. every address named in the wording exists on the sheet
    const targets = new Set(G.targetCells(task));
    const data = new Set(Object.keys((task.sheet && task.sheet.cells) || {}));
    const text = (task.brief + ' ' + task.hint)
      .replace(/«[^»]*»/g, '').replace(/"[^"]*"/g, '').replace(/“[^”]*”/g, '');
    const refs = text.match(/(?<![A-Za-z0-9])\$?[A-Z]{1,2}\$?\d{1,3}(?::\$?[A-Z]{1,2}\$?\d{1,3})?(?![A-Za-z0-9])/g) || [];
    refs.forEach(r => {
      const cells = G.expandRange(r.replace(/\$/g, ''));
      check(cells.every(c => targets.has(c) || data.has(c)),
        `${tag}: the wording mentions ${r} but there is no such cell on the sheet`);
    });

    // 6. pivot tasks: the reference layout must actually produce numbers
    if (task.expect && task.expect.pivot) {
      const cfg = task.expect.pivot;
      const built = PV.build(G.referenceSheet(task), Object.assign({ source: cfg.source || task.table }, cfg));
      check(built.rowKeys.length > 0, `${tag}: the reference pivot produces no rows`);
      check(built.body.some(line => line.some(v => v !== null && v !== 0)),
        `${tag}: the reference pivot produces no numbers`);
      check(cfg.values.length > 0, `${tag}: the reference pivot has nothing in Values`);
      // a pivot built the wrong way round must be rejected
      if (cfg.rows.length && !cfg.cols.length) {
        const swapped = Object.assign({}, cfg, { rows: [], cols: cfg.rows });
        const bad = PV.build(G.referenceSheet(task), Object.assign({ source: cfg.source || task.table }, swapped));
        check(!PV.compare(built, bad).ok, `${tag}: a transposed pivot is accepted as correct`);
      }
    }
  });
});

/* the exam must match the format the firm publishes */
const exam = CUR.levels.find(l => l.exam);
check(!!exam, 'there is no mock test level');
check(exam.tasks.length === 20, `the mock test has ${exam.tasks.length} questions, the real one has 20`);
check(exam.timeLimitSec === 3600, `the mock test allows ${exam.timeLimitSec / 60} minutes, the real one allows 60`);
check(exam.tasks.some(t => t.mode === 'pivot'), 'the mock test contains no pivot table question');
check(exam.tasks.some(t => t.expect && t.expect.filtered), 'the mock test contains no filtering question');
check(exam.tasks.some(t => t.expect && t.expect.sortedBy), 'the mock test contains no sorting question');

/* the syllabus must cover everything the firm says it assesses */
const allSolutions = CUR.levels.flatMap(l => l.tasks.flatMap(t => Object.values(t.solution || {}))).join(' ');
['SUM(', 'AVERAGE(', 'COUNT', 'IF(', 'SUMIF', 'VLOOKUP(', 'INDEX(', 'MATCH(', 'SUBTOTAL(']
  .forEach(fn => check(allSolutions.indexOf(fn) >= 0, `no task in the programme uses ${fn}`));
check(CUR.levels.some(l => l.tasks.some(t => t.mode === 'pivot')), 'the programme has no pivot table tasks');

problems.slice(0, 40).forEach(p => console.log('  x ' + p));
console.log(`\nprogramme: ${pass} checks passed, ${fail} failed`);
console.log(`levels: ${CUR.levels.length}, tasks: ${CUR.levels.reduce((a, l) => a + l.tasks.length, 0)}, ` +
  `points: ${CUR.levels.reduce((a, l) => a + l.tasks.reduce((b, t) => b + t.points, 0), 0)}`);
module.exports = { pass, fail };
if (require.main === module && fail) process.exit(1);

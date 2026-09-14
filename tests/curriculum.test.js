/* Checks on the training programme itself:
 *  - the reference answer to every task passes that task's own marking
 *  - the reference answer never produces an Excel error
 *  - an untouched sheet does NOT pass, so the marking really tests something
 *  - every cell address mentioned in the wording actually exists on the sheet
 *  - every task carries a worked explanation
 *
 * Everything below runs over the twelve levels AND over all fifty mock papers,
 * so a generated question is held to exactly the same standard as a written one.
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

function checkTask(task, seen) {
  {
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
  }
}

CUR.levels.forEach(level => {
  check(level.tasks.length > 0, `level ${level.id}: no tasks`);
  check((level.theory || []).length >= 3, `level ${level.id}: not enough theory`);
  const seen = new Set();
  level.tasks.forEach(task => checkTask(task, seen));
});

/* every one of the fifty mock papers, question by question */
const allIds = new Set();
CUR.papers.forEach(paper => {
  const seen = new Set();
  paper.tasks.forEach(task => {
    check(!allIds.has(task.id), `${paper.id}: task id ${task.id} is used twice in the bank`);
    allIds.add(task.id);
    checkTask(task, seen);
  });
});

/* every paper must match the format the firm publishes */
const exam = CUR.levels.find(l => l.exam);
check(!!exam, 'there is no mock test level');
check(exam.papers.length === 50, `the bank holds ${exam.papers.length} papers, not 50`);
check(exam.timeLimitSec === 3600, `the mock test allows ${exam.timeLimitSec / 60} minutes, the real one allows 60`);

exam.papers.forEach(paper => {
  const tag = `paper ${paper.id}`;
  check(paper.tasks.length === 20, `${tag} has ${paper.tasks.length} questions, the real test has 20`);
  check((paper.timeLimitSec || exam.timeLimitSec) === 3600, `${tag} does not run for 60 minutes`);
  check(paper.tasks.some(t => t.mode === 'pivot'), `${tag} contains no pivot table question`);
  check(paper.tasks.some(t => t.expect && t.expect.filtered), `${tag} contains no filtering question`);
  check(paper.tasks.some(t => t.expect && t.expect.sortedBy), `${tag} contains no sorting question`);
  const formulas = paper.tasks.flatMap(t => Object.values(t.solution || {})).join(' ');
  ['SUM(', 'AVERAGE(', 'IF(', 'SUMIF'].forEach(fn =>
    check(formulas.indexOf(fn) >= 0, `${tag} never asks for ${fn}`));
  check(/VLOOKUP\(|INDEX\(|MATCH\(/.test(formulas), `${tag} contains no lookup question`);
  check(paper.tasks.every(t => t.points >= 20), `${tag} has a question worth less than 20 points`);
});

/* a paper is the same paper every time it is opened, or a score means nothing */
const again = require('../app/js/mocktests.js');
const twice = again.paper(17);
check(twice.tasks.map(t => t.title).join('|') === exam.papers[16].tasks.map(t => t.title).join('|'),
  'paper 17 is not reproducible: asking for it twice gives different questions');
check(JSON.stringify(again.makeData(23).rows) === JSON.stringify(again.makeData(23).rows),
  'the data of a paper is not reproducible');

/* and no two papers are the same paper */
const shapes = new Set(exam.papers.map(p =>
  p.tasks.map(t => t.kind || t.id).join(',') + '/' +
  JSON.stringify((p.tasks[0].sheet.cells || {}).G2)));
check(shapes.size === exam.papers.length,
  `only ${shapes.size} of the ${exam.papers.length} papers are distinct`);

/* the syllabus must cover everything the firm says it assesses */
const allSolutions = CUR.levels.flatMap(l => l.tasks.flatMap(t => Object.values(t.solution || {}))).join(' ');
['SUM(', 'AVERAGE(', 'COUNT', 'IF(', 'SUMIF', 'VLOOKUP(', 'INDEX(', 'MATCH(', 'SUBTOTAL(']
  .forEach(fn => check(allSolutions.indexOf(fn) >= 0, `no task in the programme uses ${fn}`));
check(CUR.levels.some(l => l.tasks.some(t => t.mode === 'pivot')), 'the programme has no pivot table tasks');

problems.slice(0, 40).forEach(p => console.log('  x ' + p));
console.log(`\nprogramme: ${pass} checks passed, ${fail} failed`);
console.log(`levels: ${CUR.levels.length}, tasks: ${CUR.levels.reduce((a, l) => a + l.tasks.length, 0)}, ` +
  `points: ${CUR.levels.reduce((a, l) => a + l.tasks.reduce((b, t) => b + t.points, 0), 0)}`);
console.log(`mock papers: ${CUR.papers.length}, questions: ${CUR.papers.reduce((a, p) => a + p.tasks.length, 0)}`);
module.exports = { pass, fail };
if (require.main === module && fail) process.exit(1);

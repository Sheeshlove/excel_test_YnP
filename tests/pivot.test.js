/* Checks on the pivot engine itself, against what Excel actually does:
 * grouping, nesting and subtotals, sorting by label and by value, Top N,
 * every aggregation, "Show values as", number formats, and the rule that
 * marking compares the report rather than the captions. */
const XLF = require('../app/js/formula.js');
const ENG = require('../app/js/engine.js');
const PV = require('../app/js/pivot.js');

let pass = 0, fail = 0;
function check(cond, msg) { if (cond) pass++; else { fail++; console.log('  x ' + msg); } }
function eq(got, want, msg) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  check(a === b, `${msg}\n      expected ${b}\n      got      ${a}`);
}

/* ------------------------------------------------------------ a test sheet */
const HEAD = ['Deal', 'Region', 'Industry', 'Date', 'Revenue', 'Units'];
const ROWS = [
  ['D-1', 'Moscow', 'Retail', '15/01/2024', 4200, 10],
  ['D-2', 'Moscow', 'Energy', '20/02/2024', 9500, 25],
  ['D-3', 'Siberia', 'Retail', '05/04/2024', 12400, 40],
  ['D-4', 'Volga', 'Energy', '11/07/2024', 2450, 7],
  ['D-5', 'Moscow', 'Retail', '02/08/2024', 1800, 6],
  ['D-6', 'Siberia', 'Energy', '19/11/2024', 5100, 15],
  ['D-7', 'Volga', 'Retail', '28/12/2025', 3400, 12],
  ['D-8', 'Urals', 'Energy', '03/03/2025', 6700, 20]
];
function sheet(opts) {
  const s = new ENG.Sheet({ rows: 20, cols: 10 });
  const cells = {};
  HEAD.forEach((h, i) => { cells[String.fromCharCode(65 + i) + '1'] = h; });
  ROWS.forEach((row, r) => row.forEach((v, i) => {
    if (opts && opts.blank && opts.blank.r === r && opts.blank.c === i) return;
    cells[String.fromCharCode(65 + i) + (r + 2)] = v;
  }));
  s.load({ cells, formats: { 'D2:D9': 'dd/mm/yyyy' } });
  return s;
}
const SRC = 'A1:F9';
const P = (cfg, sh) => PV.build(sh || sheet(), Object.assign({ source: SRC }, cfg));
const labels = p => p.rowLines.map(l => l.caption);
const r6 = v => (v === null || v === undefined) ? null : Math.round(v * 1e6) / 1e6;
const nums = p => p.body.map(line => line.map(r6));

/* ============================== the shape of a one-dimensional pivot ===== */
{
  const p = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(p), ['Moscow', 'Siberia', 'Urals', 'Volga', 'Grand Total'], 'rows are the distinct regions plus a grand total');
  check(!p.showGrandCol, 'with nothing in Columns there is no Grand Total COLUMN (as in Excel)');
  eq(p.body.map(l => l.length), [1, 1, 1, 1, 1], 'each row holds exactly one number, not two');
  eq(nums(p), [[15500], [17500], [6700], [5850], [45550]], 'the sums and the grand total');
}

/* ============================== two dimensions =========================== */
{
  const p = P({ rows: ['Region'], cols: ['Industry'], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(p.colLines.map(l => l.caption), ['Energy', 'Retail', 'Grand Total'], 'columns plus a grand total column');
  check(p.showGrandCol, 'a column field brings a Grand Total column with it');
  eq(nums(p)[0], [9500, 6000, 15500], 'Moscow: energy, retail, total');
  eq(nums(p)[4], [23750, 21800, 45550], 'the grand total row');
}

/* ============================== Count is COUNTA ========================== */
{
  const p = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'count' }] });
  eq(nums(p).map(l => l[0]), [3, 2, 1, 2, 8], 'Count of Revenue counts the rows');
  const holed = sheet({ blank: { r: 0, c: 4 } });           // D-1 has no revenue
  const q = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'count' }] }, holed);
  eq(nums(q).map(l => l[0]), [2, 2, 1, 2, 7], 'Count skips a blank in the counted field, exactly as COUNTA does');
  const r = P({ rows: ['Region'], values: [{ field: 'Deal', agg: 'count' }] }, holed);
  eq(nums(r).map(l => l[0]), [3, 2, 1, 2, 8], 'Count of a different field is unaffected by that blank');
  const cn = P({ rows: ['Region'], values: [{ field: 'Deal', agg: 'countNums' }] });
  eq(nums(cn).map(l => l[0]), [0, 0, 0, 0, 0], 'Count Numbers on a text column finds no numbers');
}

/* ============================== every aggregation ======================== */
{
  const got = {};
  Object.keys(PV.AGGS).forEach(a => {
    const p = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: a }] });
    got[a] = nums(p)[0][0];
  });
  eq(got.sum, 15500, 'Sum of Moscow');
  check(Math.abs(got.average - 15500 / 3) < 1e-6, 'Average of Moscow');
  eq(got.max, 9500, 'Max of Moscow');
  eq(got.min, 1800, 'Min of Moscow');
  eq(got.count, 3, 'Count of Moscow');
  eq(got.countNums, 3, 'Count Numbers of Moscow');
  eq(got.product, 4200 * 9500 * 1800, 'Product of Moscow');
  check(Math.abs(got.stdDev - 3939.9662) < 0.01, 'StdDev of Moscow is the sample standard deviation');
  check(Math.abs(got.stdDevp - 3216.9661) < 0.01, 'StdDevp of Moscow is the population one');
  check(Math.abs(got.varr - got.stdDev * got.stdDev) < 0.01, 'Var is StdDev squared');
}

/* ============================== label order ============================== */
{
  const p = P({ rows: ['Revenue'], values: [{ field: 'Units', agg: 'sum' }] });
  eq(labels(p).slice(0, 4), ['1800', '2450', '3400', '4200'],
    'a number field in Rows sorts numerically, not as text');
  const d = P({ rows: ['Date'], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(d).slice(0, 3), ['15/01/2024', '20/02/2024', '05/04/2024'],
    'a date field in Rows sorts chronologically');
}

/* ============================== Group Field ============================== */
{
  const y = P({ rows: [{ field: 'Date', group: 'years' }], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(y), ['2024', '2025', 'Grand Total'], 'dates grouped into years');
  eq(nums(y).map(l => l[0]), [35450, 10100, 45550], 'the yearly totals');
  eq(y.rowFields[0].caption, 'Years', 'a field grouped by years is captioned Years, as Excel captions it');

  const q = P({ rows: [{ field: 'Date', group: 'quarters' }], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(q), ['Q1', 'Q2', 'Q3', 'Q4', 'Grand Total'], 'dates grouped into quarters, in calendar order');
  eq(nums(q).map(l => l[0]), [20400, 12400, 4250, 8500, 45550], 'the quarterly totals');

  const m = P({ rows: [{ field: 'Date', group: 'months' }], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(m), ['Jan', 'Feb', 'Mar', 'Apr', 'Jul', 'Aug', 'Nov', 'Dec', 'Grand Total'],
    'months come out in calendar order, not alphabetical');

  const dd = P({ rows: [{ field: 'Date', group: 'days' }], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(dd).slice(0, 3), ['15-Jan', '20-Feb', '3-Mar'], 'days are labelled and ordered as Excel labels them');

  // years outside, quarters inside — what Excel builds when you tick both
  const both = P({
    rows: [{ field: 'Date', group: 'years' }, { field: 'Date', group: 'quarters' }],
    values: [{ field: 'Revenue', agg: 'sum' }], layout: 'tabular'
  });
  eq(both.rowLines.filter(l => l.kind === 'subtotal').map(l => l.caption), ['2024 Total', '2025 Total'],
    'grouping by years and quarters nests, with a subtotal per year');

  const bins = P({ rows: [{ field: 'Revenue', group: { by: 5000, start: 0 } }], values: [{ field: 'Revenue', agg: 'count' }] });
  eq(labels(bins), ['0-4999', '5000-9999', '10000-14999', 'Grand Total'], 'numbers group into bins');
  eq(nums(bins).map(l => l[0]), [4, 3, 1, 8], 'and every row lands in exactly one bin');
}

/* ============================== nesting and subtotals ==================== */
{
  const c = P({ rows: ['Region', 'Industry'], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(c.rowLines.map(l => l.caption + '/' + l.kind + '/' + l.depth).slice(0, 4),
    ['Moscow/subtotal/0', 'Energy/item/1', 'Retail/item/1', 'Siberia/subtotal/0'],
    'compact form: the parent line carries the subtotal and the children sit under it');
  eq(nums(c)[0], [15500], 'the Moscow line shows the Moscow subtotal');
  eq(nums(c)[1], [9500], 'the line under it is Moscow Energy');

  const t = P({ rows: ['Region', 'Industry'], values: [{ field: 'Revenue', agg: 'sum' }], layout: 'tabular' });
  eq(t.rowLines.map(l => l.caption).slice(0, 3), ['Energy', 'Retail', 'Moscow Total'],
    'tabular form puts the subtotal under the group, labelled "Moscow Total"');

  const off = P({ rows: ['Region', 'Industry'], values: [{ field: 'Revenue', agg: 'sum' }], subtotals: false });
  check(!off.rowLines.some(l => l.kind === 'subtotal'), 'subtotals can be turned off');
}

/* ============================== sorting ================================== */
{
  const desc = P({
    rows: [{ field: 'Region', sort: { by: 'value', value: 0, asc: false } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  eq(labels(desc), ['Siberia', 'Moscow', 'Urals', 'Volga', 'Grand Total'],
    'sorting by the value field puts the biggest region first');
  const asc = P({
    rows: [{ field: 'Region', sort: { by: 'value', value: 0, asc: true } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  eq(labels(asc), ['Volga', 'Urals', 'Moscow', 'Siberia', 'Grand Total'], 'and smallest first the other way');
  const za = P({ rows: [{ field: 'Region', sort: { by: 'label', asc: false } }], values: [{ field: 'Revenue', agg: 'sum' }] });
  eq(labels(za), ['Volga', 'Urals', 'Siberia', 'Moscow', 'Grand Total'], 'Z to A by label');

  const nested = P({
    rows: ['Region', { field: 'Industry', sort: { by: 'value', value: 0, asc: false } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  eq(nested.rowLines.slice(0, 3).map(l => l.caption), ['Moscow', 'Energy', 'Retail'],
    'sorting an inner field sorts inside each group');
}

/* ============================== Top N ==================================== */
{
  const top2 = P({
    rows: [{ field: 'Region', filter: { top: { n: 2, value: 0, largest: true } } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  eq(labels(top2), ['Moscow', 'Siberia', 'Grand Total'], 'Top 2 by revenue keeps Moscow and Siberia');
  eq(nums(top2)[2], [33000], 'and the grand total reflects only what the filter left');
  const bottom1 = P({
    rows: [{ field: 'Region', filter: { top: { n: 1, value: 0, largest: false } } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  eq(labels(bottom1), ['Volga', 'Grand Total'], 'Bottom 1 keeps the smallest');
  const ticked = P({
    rows: [{ field: 'Region', filter: { values: ['Moscow', 'Volga'] } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  eq(labels(ticked), ['Moscow', 'Volga', 'Grand Total'], 'a tick-list filter on a row field');
}

/* ============================== report filters =========================== */
{
  const p = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Industry', values: ['Energy'] }] });
  eq(labels(p), ['Moscow', 'Siberia', 'Urals', 'Volga', 'Grand Total'], 'the report filter leaves the regions that have energy deals');
  eq(nums(p)[4], [23750], 'and scopes the grand total');
  const none = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Industry', values: [] }] });
  eq(none.rowCount, 0, 'a filter with nothing ticked shows an empty report, not the whole table');
  const all = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Industry', values: ['Energy', 'Retail'] }] });
  eq(all.rowCount, 8, 'a filter with everything ticked changes nothing');
}

/* ============================== show values as =========================== */
{
  const pct = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum', show: 'pctTotal' }] });
  eq(nums(pct).map(l => l[0]), [15500, 17500, 6700, 5850, 45550].map(v => r6(v / 45550)),
    '% of grand total, ending at exactly 1');
  eq(PV.format(1, { show: 'pctTotal' }), '100.0%', 'and 1 renders as 100.0%, never as "1"');
  eq(PV.format(0.340285, { show: 'pctTotal' }), '34.0%', 'a share renders as a percentage');
  eq(PV.format(0.85, {}), '0.85', 'but a plain number below 1 is NOT turned into a percentage');
  eq(PV.format(41800, {}), '41,800', 'and a sum keeps its thousands separators');

  const row = P({ rows: ['Region'], cols: ['Industry'], values: [{ field: 'Revenue', agg: 'sum', show: 'pctRow' }] });
  eq(nums(row)[0], [r6(9500 / 15500), r6(6000 / 15500), 1], '% of row total across a two-dimensional pivot');
  const col = P({ rows: ['Region'], cols: ['Industry'], values: [{ field: 'Revenue', agg: 'sum', show: 'pctCol' }] });
  eq(nums(col)[4], [1, 1, 1], 'the grand total row of a % of column total pivot is all 100%');

  const par = P({
    rows: ['Region', 'Industry'], layout: 'tabular',
    values: [{ field: 'Revenue', agg: 'sum', show: 'pctParentRow' }]
  });
  eq(nums(par)[0], [r6(9500 / 15500)], '% of parent row total divides by the group the line sits in');

  const run = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum', show: 'runTotal' }] });
  eq(nums(run).map(l => l[0]), [15500, 33000, 39700, 45550, 45550], 'a running total accumulates down the rows');
  const prun = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum', show: 'pctRunTotal' }] });
  eq(nums(prun)[3][0], 1, 'and the % running total reaches 100% on the last row');

  const rank = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum', show: 'rankDesc' }] });
  eq(nums(rank).map(l => l[0]), [2, 1, 3, 4, 1], 'rank largest to smallest');
  const idx = P({ rows: ['Region'], cols: ['Industry'], values: [{ field: 'Revenue', agg: 'sum', show: 'index' }] });
  check(Math.abs(idx.body[0][0] - (9500 * 45550) / (15500 * 23750)) < 1e-9, 'the index');
}

/* ============================== calculated fields ======================== */
{
  const p = P({ rows: ['Region'], values: [{ calc: 'Revenue / Units', name: 'Price' }] });
  eq(nums(p).map(l => l[0]), [15500 / 41, 17500 / 55, 6700 / 20, 5850 / 19, 45550 / 135].map(r6),
    'a calculated field divides the group totals, which is what Excel does');
  const sp = P({ rows: ['Region'], values: [{ calc: 'Revenue/Units', name: 'Price' }] });
  eq(nums(sp), nums(p), 'the spacing of the formula makes no difference');
  const ci = P({ rows: ['Region'], values: [{ calc: 'revenue / units', name: 'Price' }] });
  eq(nums(ci), nums(p), 'nor does the case of the field names');
}

/* ============================== marking ================================== */
{
  const ref = P({ rows: ['Region'], values: [{ field: 'Deal', agg: 'count' }, { field: 'Revenue', agg: 'average' }] });

  const swapped = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'average' }, { field: 'Deal', agg: 'count' }] });
  check(PV.compare(ref, swapped).ok, 'the two value fields may be added in either order');

  const otherField = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'count' }, { field: 'Revenue', agg: 'average' }] });
  check(PV.compare(ref, otherField).ok, 'Count of Revenue is accepted where Count of Deal was expected: same numbers');

  const wrongAgg = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }, { field: 'Revenue', agg: 'average' }] });
  check(!PV.compare(ref, wrongAgg).ok, 'but Sum where Count was wanted is still wrong');

  const calcRef = P({ rows: ['Region'], values: [{ calc: 'Revenue * Units' }] });
  check(PV.compare(calcRef, P({ rows: ['Region'], values: [{ calc: 'Revenue*Units' }] })).ok,
    'a calculated field is marked on its numbers, not on its spacing');
  check(PV.compare(calcRef, P({ rows: ['Region'], values: [{ calc: 'Units * Revenue' }] })).ok,
    'nor on the order of a commutative formula');
  check(!PV.compare(calcRef, P({ rows: ['Region'], values: [{ calc: 'Revenue + Units' }] })).ok,
    'a calculated field that computes something else is wrong');

  const plain = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }] });
  const allTicked = P({
    rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }],
    filters: [{ field: 'Industry', values: ['Energy', 'Retail'] }]
  });
  check(PV.compare(plain, allTicked).ok, 'a report filter with every value ticked is the same report');

  const transposed = P({ cols: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }] });
  check(!PV.compare(plain, transposed).ok, 'a transposed pivot is rejected');
  check(/Rows area/.test(PV.compare(plain, transposed).issues.join(' ')), 'and the rejection names the area');

  const sortedRef = P({
    rows: [{ field: 'Region', sort: { by: 'value', value: 0, asc: false } }],
    values: [{ field: 'Revenue', agg: 'sum' }]
  });
  check(!PV.compare(sortedRef, plain).ok, 'an unsorted pivot fails a task that asked for it sorted');
  check(/rows read/.test(PV.compare(sortedRef, plain).issues.join(' ')), 'and the message shows the order it found');

  const filtered = P({ rows: ['Region'], values: [{ field: 'Revenue', agg: 'sum' }], filters: [{ field: 'Industry', values: ['Energy'] }] });
  check(!PV.compare(filtered, plain).ok, 'a missing report filter is caught');
  check(/source rows/.test(PV.compare(filtered, plain).issues.join(' ')), 'and reported as a coverage problem');

  const empty = P({});
  check(!PV.compare(plain, empty).ok, 'an empty pivot never passes');

  // Compact and Tabular are the same report drawn two ways
  const nestC = P({ rows: ['Region', 'Industry'], values: [{ field: 'Revenue', agg: 'sum' }] });
  const nestT = P({ rows: ['Region', 'Industry'], values: [{ field: 'Revenue', agg: 'sum' }], layout: 'tabular' });
  check(PV.compare(nestC, nestT).ok, 'choosing Tabular form instead of Compact is not an error');
  const nestNo = P({ rows: ['Region', 'Industry'], values: [{ field: 'Revenue', agg: 'sum' }], subtotals: false });
  check(!PV.compare(nestC, nestNo).ok, 'but switching the subtotals off does change the report');
}

console.log(`\npivot engine: ${pass} checks passed, ${fail} failed`);
module.exports = { pass, fail };
if (require.main === module && fail) process.exit(1);

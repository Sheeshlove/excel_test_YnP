/* =============================================================================
 * mocktests.js — the bank of mock tests
 *
 * Fifty papers, each one twenty questions in sixty minutes, in the format the
 * firm publishes. Paper 1 is written by hand and lives in curriculum.js; papers
 * 2 to 50 are built here.
 *
 * Every paper gets its own transaction book — its own regions, products,
 * managers, dates and numbers — and draws its twenty questions from a bank of
 * question types, with fixed quotas so that each paper covers what the real
 * test covers: basic and advanced formulas, logic, lookups, text and dates,
 * analysis, sorting, filtering and pivot tables.
 *
 * Everything is derived from the paper's number through a seeded generator, so
 * paper 7 is the same paper 7 on every machine and after every relaunch — a
 * score is comparable with the last time you sat it — while no two papers ask
 * the same question of the same numbers.
 *
 * Answers are never stored: each question carries the formula that solves it
 * and the marking works out the expected value by running that formula, exactly
 * as for the hand-written levels.
 * ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.XLMockTests = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var H = { header: true };
  var COLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  var HEAD = ['Date', 'Region', 'Product', 'Manager', 'Units', 'Price', 'Revenue'];
  var LAST = 16;                    // the data occupies rows 2..16
  var TABLE = 'A1:G' + LAST;

  /* --------------------------------------------------------------- random */
  // mulberry32: small, fast and — the point here — identical everywhere.
  function seeded(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffled(rnd, list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(rnd() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function someOf(rnd, list, n) { return shuffled(rnd, list).slice(0, n); }
  function oneOf(rnd, list) { return list[Math.floor(rnd() * list.length)]; }

  /* ------------------------------------------------------------- numbers */
  function money(n) {
    return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function pct(x) { return (Math.round(x * 1000) / 10) + '%'; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  /* ----------------------------------------------------- A1 arithmetic --- */
  function colLetters(i) {
    var s = '';
    i = i + 1;
    while (i > 0) { var r = (i - 1) % 26; s = COLS[r] + s; i = Math.floor((i - 1) / 26); }
    return s;
  }
  function colIndex(letters) {
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.charCodeAt(i) - 64);
    return n - 1;
  }
  function expand(ref) {
    var parts = String(ref).split(':');
    if (parts.length === 1) return [ref];
    var a = /^([A-Z]+)(\d+)$/.exec(parts[0]), b = /^([A-Z]+)(\d+)$/.exec(parts[1]);
    if (!a || !b) return [ref];
    var c1 = colIndex(a[1]), c2 = colIndex(b[1]), r1 = +a[2], r2 = +b[2], out = [];
    for (var r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
      for (var c = Math.min(c1, c2); c <= Math.max(c1, c2); c++) out.push(colLetters(c) + r);
    return out;
  }
  // the same marking rule applied to every cell of a range
  function over(ref, rule) {
    var out = {};
    expand(ref).forEach(function (a1) { out[a1] = rule; });
    return out;
  }

  /* ------------------------------------------------------- the data pool */
  var REGIONS = ['Moscow', 'St Petersburg', 'Urals', 'Siberia', 'Volga', 'South',
                 'Far East', 'North West', 'Central', 'Kuban'];
  var PRODUCTS = ['Software', 'Services', 'Licences', 'Hardware', 'Support',
                  'Training', 'Analytics', 'Maintenance'];
  var MANAGERS = ['Ivanov', 'Petrova', 'Sidorov', 'Kuznetsov', 'Volkova',
                  'Smirnov', 'Orlova', 'Nikitin', 'Baranov', 'Lebedeva'];
  var PRICE_BANDS = [450, 800, 1200, 2400, 3500, 6500, 8800];
  var QUARTER_NAME = ['the first quarter', 'the second quarter', 'the third quarter', 'the fourth quarter'];

  /* One paper's transaction book: fifteen rows, four regions, three products,
   * four managers, all revenues distinct so that "the largest" is never a tie. */
  function makeData(paperNo) {
    var rnd = seeded(paperNo * 7919 + 104729);
    var regions = someOf(rnd, REGIONS, 4);
    var products = someOf(rnd, PRODUCTS, 3);
    var managers = someOf(rnd, MANAGERS, 4);
    var year = 2023 + Math.floor(rnd() * 3);

    var bands = someOf(rnd, PRICE_BANDS, 3);
    var basePrice = {};
    products.forEach(function (p, i) { basePrice[p] = bands[i]; });

    var regionSlots = shuffled(rnd, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);
    var productSlots = shuffled(rnd, [0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2]);
    var managerSlots = shuffled(rnd, [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);

    // three or four dates in every quarter, so any quarter can be asked about
    var dates = [];
    [4, 4, 4, 3].forEach(function (count, q) {
      var used = {};
      for (var k = 0; k < count; k++) {
        var m, d, key;
        do {
          m = q * 3 + 1 + Math.floor(rnd() * 3);
          d = 1 + Math.floor(rnd() * 28);
          key = m + '/' + d;
        } while (used[key]);
        used[key] = true;
        dates.push({ m: m, d: d, q: q + 1 });
      }
    });
    dates = shuffled(rnd, dates);

    var rows = [], seen = {};
    for (var i = 0; i < 15; i++) {
      var product = products[productSlots[i]];
      var units, price, revenue, guard = 0;
      do {
        units = 5 * (2 + Math.floor(rnd() * 70));                    // 10 … 355
        price = Math.max(50, Math.round(basePrice[product] * (0.85 + rnd() * 0.45) / 50) * 50);
        revenue = units * price;
        guard++;
      } while (seen[revenue] && guard < 40);
      seen[revenue] = true;
      rows.push({
        date: pad(dates[i].d) + '/' + pad(dates[i].m) + '/' + year,
        month: dates[i].m, quarter: dates[i].q,
        region: regions[regionSlots[i]],
        product: product,
        manager: managers[managerSlots[i]],
        units: units, price: price, revenue: revenue,
        row: i + 2
      });
    }

    var totalRevenue = rows.reduce(function (a, r) { return a + r.revenue; }, 0);
    var totalUnits = rows.reduce(function (a, r) { return a + r.units; }, 0);
    var byRevenue = rows.slice().sort(function (a, b) { return b.revenue - a.revenue; });

    return {
      paperNo: paperNo, rnd: rnd, year: year,
      head: HEAD, rows: rows, regions: regions, products: products, managers: managers,
      totalRevenue: totalRevenue, totalUnits: totalUnits,
      top: byRevenue[0], byRevenue: byRevenue,
      sumWhere: function (fn) {
        return rows.reduce(function (a, r) { return a + (fn(r) ? r.revenue : 0); }, 0);
      },
      countWhere: function (fn) {
        return rows.filter(fn).length;
      },
      // the value that most rows share, so a question about it is never empty
      commonest: function (field) {
        var tally = {};
        rows.forEach(function (r) { tally[r[field]] = (tally[r[field]] || 0) + 1; });
        return Object.keys(tally).sort(function (a, b) {
          return tally[b] - tally[a] || (a < b ? -1 : 1);
        })[0];
      }
    };
  }

  /* --------------------------------------------------------- sheet specs */
  function sheetFor(data, extra, opts) {
    opts = opts || {};
    var cells = {};
    HEAD.forEach(function (h, i) { cells[COLS[i] + '1'] = h; });
    data.rows.forEach(function (r) {
      cells['A' + r.row] = r.date;
      cells['B' + r.row] = r.region;
      cells['C' + r.row] = r.product;
      cells['D' + r.row] = r.manager;
      cells['E' + r.row] = r.units;
      cells['F' + r.row] = r.price;
      cells['G' + r.row] = r.revenue;
    });
    Object.keys(extra || {}).forEach(function (k) { cells[k] = extra[k]; });
    var spec = {
      rows: opts.rows || 20,
      cols: opts.cols || 14,
      styles: Object.assign({ 'A1:G1': H }, opts.styles || {}),
      formats: Object.assign({ 'A2:A16': 'dd/mm/yyyy' }, opts.formats || {}),
      colWidths: Object.assign({ A: 110, B: 140, C: 110, D: 110, E: 90, F: 90, G: 110 },
                               opts.colWidths || {}),
      cells: cells
    };
    return spec;
  }
  // the label column of an answer block on the right of the data
  function metricBlock(labels, first) {
    var cells = { I1: 'Metric', J1: 'Value' };
    labels.forEach(function (text, i) { cells['I' + ((first || 2) + i)] = text; });
    return cells;
  }

  /* =========================================================================
   * The question bank. Every entry builds one question out of one paper's
   * data: its wording, its sheet, the formula that answers it, the marking
   * rules and the walk-through shown afterwards.
   * ====================================================================== */
  var BANK = [];
  function question(id, group, points, make) {
    BANK.push({ id: id, group: group, points: points, make: make });
  }

  /* ------------------------------------------------------------- basics --- */
  question('total-average-count', 'basics', 20, function (d) {
    return {
      title: 'Total, average and count',
      brief: 'Fill the answer block: J2 total revenue, J3 the average transaction, ' +
        'J4 how many transactions there are, J5 the largest one.',
      hint: 'SUM, AVERAGE, COUNT and MAX over the Revenue column G2:G16.',
      sheet: sheetFor(d, metricBlock(['Total revenue', 'Average transaction',
        'Number of transactions', 'Largest transaction']),
        { colWidths: { I: 200, J: 140 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4', 'J5'],
      solution: {
        J2: '=SUM($G$2:$G$16)', J3: '=AVERAGE($G$2:$G$16)',
        J4: '=COUNT($G$2:$G$16)', J5: '=MAX($G$2:$G$16)'
      },
      check: {
        J2: { mustUse: ['SUM'] }, J3: { mustUse: ['AVERAGE'] },
        J4: { mustUseAny: ['COUNT', 'COUNTA'] }, J5: { mustUse: ['MAX'] }
      },
      explain: {
        idea: 'The four aggregates every test opens with. COUNT counts numbers, COUNTA counts anything ' +
          'that is not empty — on a numeric column they agree, on a text column they do not.',
        walk: [
          'SUM over G2:G16 adds the fifteen transactions: ' + money(d.totalRevenue) + '.',
          'AVERAGE is that total divided by the count, so ' + money(d.totalRevenue) + ' / 15 = ' +
            money(d.totalRevenue / 15) + '.',
          'COUNT returns 15 because every cell in the column holds a number.',
          'MAX finds the biggest single transaction: ' + money(d.top.revenue) + ', booked by ' +
            d.top.manager + ' in ' + d.top.region + '.'
        ],
        mistakes: [
          'Selecting G1:G16 and pulling the header into the range. SUM ignores text, but COUNT would be off by one if the header were a number, and AVERAGE would change.',
          'Typing the total in by hand after adding it up in the status bar. It is right until the data changes.'
        ],
        onTheJob: 'These four numbers are the first thing to compute on any new file: they tell you the size of the thing and expose a mis-read column straight away.'
      }
    };
  });

  question('median-spread', 'basics', 20, function (d) {
    var sorted = d.rows.map(function (r) { return r.revenue; }).sort(function (a, b) { return a - b; });
    return {
      title: 'Median against the mean',
      brief: 'J2 the median transaction, J3 the mean transaction, J4 the smallest one, ' +
        'J5 the second largest.',
      hint: 'MEDIAN, AVERAGE, MIN and LARGE. The second largest is LARGE(range, 2), not MAX.',
      sheet: sheetFor(d, metricBlock(['Median transaction', 'Mean transaction',
        'Smallest transaction', 'Second largest transaction']),
        { colWidths: { I: 220, J: 140 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4', 'J5'],
      solution: {
        J2: '=MEDIAN($G$2:$G$16)', J3: '=AVERAGE($G$2:$G$16)',
        J4: '=MIN($G$2:$G$16)', J5: '=LARGE($G$2:$G$16,2)'
      },
      check: {
        J2: { mustUse: ['MEDIAN'] }, J3: { mustUse: ['AVERAGE'] },
        J4: { mustUse: ['MIN'] }, J5: { mustUseAny: ['LARGE', 'SMALL'] }
      },
      explain: {
        idea: 'The mean is pulled about by a single large deal; the median is not. Quoting both, and ' +
          'saying which you used, is the difference between an analysis and a number.',
        walk: [
          'Sorted, the middle of fifteen transactions is the eighth: the median is ' + money(sorted[7]) + '.',
          'The mean is ' + money(d.totalRevenue / 15) + '. The gap between the two is the skew of the book.',
          'MIN is ' + money(sorted[0]) + ' and LARGE(range, 2) is ' + money(sorted[13]) + ' — the runner-up, which MAX cannot give you.',
          'LARGE(range, 1) would be the same as MAX; the second argument is what makes it useful.'
        ],
        mistakes: [
          'Using MAX where the question asked for the second largest.',
          'Reporting the mean of a skewed book as "the typical deal" without looking at the median.'
        ],
        onTheJob: 'Average revenue per customer is nearly always quoted when the median would tell a very different and more honest story.'
      }
    };
  });

  question('control-total', 'basics', 20, function (d) {
    return {
      title: 'Rebuild revenue and reconcile',
      brief: 'J2 the total units sold. J3 revenue rebuilt from units × price, in one formula, without ' +
        'a helper column. J4 the difference between that and the Revenue column — it must come out at zero.',
      hint: 'SUMPRODUCT multiplies two ranges row by row and adds the results. The check in J4 is J3 minus SUM of the Revenue column.',
      sheet: sheetFor(d, metricBlock(['Total units', 'Revenue rebuilt from units × price',
        'Difference from the Revenue column']),
        { colWidths: { I: 260, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4'],
      solution: {
        J2: '=SUM($E$2:$E$16)',
        J3: '=SUMPRODUCT($E$2:$E$16,$F$2:$F$16)',
        J4: '=$J$3-SUM($G$2:$G$16)'
      },
      check: { J2: { mustUse: ['SUM'] }, J3: { mustUse: ['SUMPRODUCT'] }, J4: { tol: 0.5 } },
      explain: {
        idea: 'SUMPRODUCT does a whole column of multiplications and their total in one cell. Used against a ' +
          'column somebody else computed, it is a control total.',
        walk: [
          'SUM of the Units column gives ' + money(d.totalUnits) + ' units across the fifteen transactions.',
          'SUMPRODUCT(E2:E16, F2:F16) multiplies units by price row by row and adds the fifteen results: ' +
            money(d.totalRevenue) + '.',
          'The Revenue column adds to the same ' + money(d.totalRevenue) + ', so J4 is zero and the column is trustworthy.',
          'Had somebody overtyped one revenue cell with a hard-coded number, this one cell would have caught it.'
        ],
        mistakes: [
          'Writing =SUM(E2:E16*F2:F16), which needs to be entered as an array formula in older Excel and returns a single wrong number otherwise.',
          'Skipping the check. A reconciliation you did not run is a reconciliation that failed.'
        ],
        onTheJob: 'Client files arrive with a revenue column that somebody has been "fixing" by hand for months. This is how you find out in thirty seconds.'
      }
    };
  });

  /* ------------------------------------------ conditional aggregates --- */
  question('sumifs-period', 'condagg', 25, function (d) {
    // the region with the most rows in the busiest quarter: never an empty answer
    var q = [1, 2, 3, 4].map(function (qq) {
      return { q: qq, n: d.countWhere(function (r) { return r.quarter === qq; }) };
    }).sort(function (a, b) { return b.n - a.n; })[0].q;
    var tally = {};
    d.rows.forEach(function (r) { if (r.quarter === q) tally[r.region] = (tally[r.region] || 0) + 1; });
    var region = Object.keys(tally).sort(function (a, b) { return tally[b] - tally[a] || (a < b ? -1 : 1); })[0];
    var startM = (q - 1) * 3 + 1, endM = q * 3;
    var endD = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][endM - 1];
    var answer = d.sumWhere(function (r) { return r.region === region && r.quarter === q; });
    var hits = d.countWhere(function (r) { return r.region === region && r.quarter === q; });
    return {
      title: 'Revenue for a quarter in one region',
      brief: 'J2 — the revenue of ' + region + ' transactions dated inside ' + QUARTER_NAME[q - 1] +
        ' of ' + d.year + '. The two dates bounding the period are given in J4 and J5, and both ends count.',
      hint: 'SUMIFS with three conditions: the region, then the same date column twice — once with ">="&$J$4 and once with "<="&$J$5.',
      sheet: sheetFor(d, Object.assign(metricBlock([region + ' revenue in the quarter']), {
        I4: 'Period start', J4: '01/' + pad(startM) + '/' + d.year,
        I5: 'Period end', J5: pad(endD) + '/' + pad(endM) + '/' + d.year
      }), { colWidths: { I: 240, J: 150 }, formats: { J4: 'dd/mm/yyyy', J5: 'dd/mm/yyyy' } }),
      table: TABLE,
      target: ['J2'],
      solution: { J2: '=SUMIFS($G$2:$G$16,$B$2:$B$16,"' + region + '",$A$2:$A$16,">="&$J$4,$A$2:$A$16,"<="&$J$5)' },
      check: { J2: { mustUseAny: ['SUMIFS', 'SUMPRODUCT'] } },
      explain: {
        idea: 'A date range is two conditions on one column: not before the start and not after the end. ' +
          'Dates are numbers underneath, so the ordinary comparison operators work on them.',
        walk: [
          'The same range $A$2:$A$16 is named twice in the SUMIFS, once with ">=" and once with "<=". That is normal — SUMIFS applies both.',
          'The bounds are glued on from cells with &, so the period can be changed in J4 and J5 without touching the formula.',
          hits + ' transaction(s) in ' + region + ' fall inside the period, adding to ' + money(answer) + '.',
          'Change ">=" to ">" and any transaction landing exactly on the first day of the quarter silently disappears.'
        ],
        mistakes: [
          'Using > and < instead of >= and <=, which drops the transactions on the boundary dates.',
          'Writing the dates into the formula as ">=01/04/' + d.year + '". Whether that works depends on the machine\'s locale, which on a test machine you did not set up is a gamble. Point at the cells instead.'
        ],
        onTheJob: 'Every monthly and quarterly pack is this formula. Put the period in two cells once and the whole sheet re-runs for any period you like.'
      }
    };
  });

  question('average-count-ifs', 'condagg', 25, function (d) {
    var product = d.commonest('product');
    var units = d.rows.filter(function (r) { return r.product === product; })
      .map(function (r) { return r.units; }).sort(function (a, b) { return b - a; });
    var threshold = Math.max(10, Math.floor((units[1] - 1) / 10) * 10);
    var hit = d.rows.filter(function (r) { return r.product === product && r.units > threshold; });
    var avg = hit.reduce(function (a, r) { return a + r.revenue; }, 0) / hit.length;
    return {
      title: 'Average and count on two conditions',
      brief: 'J2 — the average revenue of ' + product + ' transactions of more than ' + threshold +
        ' units. J3 — how many transactions that is.',
      hint: 'AVERAGEIFS and COUNTIFS take the same condition pairs; only AVERAGEIFS needs a range to average first. The units condition is ">' + threshold + '".',
      sheet: sheetFor(d, metricBlock(['Average revenue', 'Number of transactions']),
        { colWidths: { I: 210, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3'],
      solution: {
        J2: '=AVERAGEIFS($G$2:$G$16,$C$2:$C$16,"' + product + '",$E$2:$E$16,">' + threshold + '")',
        J3: '=COUNTIFS($C$2:$C$16,"' + product + '",$E$2:$E$16,">' + threshold + '")'
      },
      check: { J2: { mustUseAny: ['AVERAGEIFS', 'AVERAGEIF'] }, J3: { mustUseAny: ['COUNTIFS', 'COUNTIF'] } },
      explain: {
        idea: 'AVERAGEIFS averages only the rows that meet every condition — it divides by the number of ' +
          'matching rows, not by the whole table. COUNTIFS on the same conditions tells you what that ' +
          'number is, which is why the two belong together.',
        walk: [
          hit.length + ' of the ' + d.countWhere(function (r) { return r.product === product; }) +
            ' ' + product + ' transactions clear ' + threshold + ' units.',
          'Their revenues average ' + money(avg) + '.',
          'Computing the count next to the average is a free sanity check: if COUNTIFS came back zero, ' +
            'AVERAGEIFS would be showing #DIV/0! rather than a number.',
          'The condition is a piece of text, ">' + threshold + '", not a comparison written in Excel syntax.'
        ],
        mistakes: [
          'Averaging the Price column instead of Revenue. The question asks what a transaction was worth, not what a unit cost.',
          'Using ">=' + threshold + '" and quietly including a transaction of exactly ' + threshold + ' units that the wording excluded.'
        ],
        onTheJob: 'Large orders and small orders behave differently in almost every business; splitting them on a threshold is the first cut of any commercial analysis.'
      }
    };
  });

  question('crosstab', 'condagg', 35, function (d) {
    var regions = d.regions, products = d.products;
    var extra = {
      I2: 'Region \\ Product', M2: 'Total', I7: 'Total', I9: 'Check (must be 0)'
    };
    products.forEach(function (p, i) { extra[COLS[9 + i] + '2'] = p; });     // J2, K2, L2
    regions.forEach(function (r, i) { extra['I' + (3 + i)] = r; });          // I3 … I6
    return {
      title: 'Region by product summary',
      brief: 'Fill J3:L6 with a single formula — revenue by region down the side and product across the top. ' +
        'Add the row totals in M3:M6 and the column totals in J7:M7. J9 must show the grid total minus the ' +
        'raw total, which has to be zero.',
      hint: 'Mixed references: $I3 pins the column of the region label, J$2 pins the row of the product label. The check is the grid total minus SUM of the Revenue column.',
      sheet: sheetFor(d, extra, {
        cols: 15,
        styles: { 'I2:M2': H, 'I3:I7': H },
        colWidths: { I: 170, J: 115, K: 115, L: 115, M: 125 }
      }),
      table: TABLE,
      target: ['J3:L6', 'M3:M6', 'J7:M7', 'J9'],
      solution: {
        'J3:L6': '=SUMIFS($G$2:$G$16,$B$2:$B$16,$I3,$C$2:$C$16,J$2)',
        'M3:M6': '=SUM(J3:L3)',
        'J7:M7': '=SUM(J3:J6)',
        J9: '=SUM($J$3:$L$6)-SUM($G$2:$G$16)'
      },
      check: {
        J3: { mustUse: ['SUMIFS'], mustContain: ['$I3', 'J$2'],
              containHint: 'the body of the grid needs mixed references: $I3 for the region and J$2 for the product' },
        J9: { tol: 0.5 }
      },
      explain: {
        idea: 'The classic matrix question. One formula with half-pinned references fills the body; the ' +
          'totals are ordinary sums; the check proves nothing fell between the cells.',
        walk: [
          '$I3 locks the column so the region label cannot drift sideways as the formula is filled right. ' +
            'J$2 locks the row so the product label cannot drift downwards as it is filled down.',
          'Row totals add across the three product columns; column totals add down the four regions.',
          'M7 is the grand total reached two different ways — across and down — which is itself a check.',
          'J9 compares the ' + money(d.totalRevenue) + ' in the grid with the ' + money(d.totalRevenue) +
            ' in the raw column. Zero means every transaction landed in exactly one cell.'
        ],
        mistakes: [
          'Writing the formula with no dollars at all, so it works in J3 and is nonsense everywhere else.',
          'Pinning everything as $I$3 and $J$2, which fills the whole grid with the same number.',
          'Skipping J9. A twelve-cell grid that misses a region is very hard to spot by eye and trivial to spot with one subtraction.'
        ],
        onTheJob: 'Revenue by region by product is the first exhibit of most commercial diagnostics, and the control total is what lets you put your name on it.'
      }
    };
  });

  question('two-condition-sum', 'condagg', 20, function (d) {
    var row = d.byRevenue[Math.min(2, d.byRevenue.length - 1)];
    var product = row.product, manager = row.manager;
    var total = d.sumWhere(function (r) { return r.product === product && r.manager === manager; });
    var n = d.countWhere(function (r) { return r.product === product && r.manager === manager; });
    return {
      title: 'One product, one manager',
      brief: 'J2 — the revenue ' + manager + ' booked on ' + product + '. J3 — how many such transactions there are.',
      hint: 'SUMIFS and COUNTIFS with two conditions: the Product column and the Manager column.',
      sheet: sheetFor(d, metricBlock([product + ' revenue booked by ' + manager, 'Number of transactions']),
        { colWidths: { I: 260, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3'],
      solution: {
        J2: '=SUMIFS($G$2:$G$16,$C$2:$C$16,"' + product + '",$D$2:$D$16,"' + manager + '")',
        J3: '=COUNTIFS($C$2:$C$16,"' + product + '",$D$2:$D$16,"' + manager + '")'
      },
      check: { J2: { mustUseAny: ['SUMIFS', 'SUMPRODUCT'] }, J3: { mustUseAny: ['COUNTIFS', 'COUNTIF'] } },
      explain: {
        idea: 'SUMIFS takes the range to add first and then condition pairs — range, criterion, range, ' +
          'criterion. COUNTIFS takes the pairs only, because there is nothing to add.',
        walk: [
          'Excel walks all fifteen rows and keeps only those where the product is ' + product +
            ' AND the manager is ' + manager + '.',
          n + ' row(s) survive both conditions, worth ' + money(total) + '.',
          'The conditions are joined by AND, never by OR. For OR you add two SUMIFS together.',
          'Text conditions are not case sensitive, so "' + product.toLowerCase() + '" would match just as well.'
        ],
        mistakes: [
          'Swapping the argument order and writing the conditions before the range to add — that is SUMIF, not SUMIFS.',
          'Expecting two conditions on the same column to behave like OR. They cannot both be true at once, so the answer comes back zero.'
        ],
        onTheJob: '"What did this person sell of that thing" is the single most common question asked of a sales file, usually in a meeting, usually right now.'
      }
    };
  });

  question('wildcard-count', 'condagg', 20, function (d) {
    var letter = d.commonest('manager').charAt(0);
    var hit = d.rows.filter(function (r) { return r.manager.charAt(0) === letter; });
    var names = {};
    hit.forEach(function (r) { names[r.manager] = true; });
    return {
      title: 'Counting with a wildcard',
      brief: 'J2 — how many transactions were booked by a manager whose surname starts with ' + letter +
        '. J3 — their total revenue.',
      hint: 'A criterion may contain wildcards: "' + letter + '*" means "starts with ' + letter + '". Use COUNTIF and SUMIF.',
      sheet: sheetFor(d, metricBlock(['Transactions by a manager starting with ' + letter,
        'Their revenue']), { colWidths: { I: 300, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3'],
      solution: {
        J2: '=COUNTIF($D$2:$D$16,"' + letter + '*")',
        J3: '=SUMIF($D$2:$D$16,"' + letter + '*",$G$2:$G$16)'
      },
      check: { J2: { mustUseAny: ['COUNTIF', 'COUNTIFS'] }, J3: { mustUseAny: ['SUMIF', 'SUMIFS'] } },
      explain: {
        idea: '* stands for any run of characters and ? for exactly one. They work inside the criterion of ' +
          'every IF-family function, which saves building a helper column of LEFT().',
        walk: [
          Object.keys(names).sort().join(' and ') + ' match "' + letter + '*".',
          'COUNTIF returns ' + hit.length + ' transactions.',
          'SUMIF takes the range to test first, then the criterion, then the range to add — the opposite order to SUMIFS.',
          'Their revenue is ' + money(hit.reduce(function (a, r) { return a + r.revenue; }, 0)) + '.'
        ],
        mistakes: [
          'Forgetting that SUMIF puts the range to add last while SUMIFS puts it first. Mixing the two is the commonest formula error on this test.',
          'Expecting "' + letter + '" on its own to match. Without the star it means exactly that one letter and matches nothing.'
        ],
        onTheJob: 'Real exports are full of codes with a meaningful prefix — cost centres, SKUs, ledger accounts. Wildcards read them without a single helper column.'
      }
    };
  });

  question('above-average', 'condagg', 25, function (d) {
    var avg = d.totalRevenue / 15;
    var above = d.rows.filter(function (r) { return r.revenue > avg; });
    return {
      title: 'Everything above the average',
      brief: 'J2 — the average transaction. J3 — the revenue of the transactions above that average. ' +
        'J4 — how many of them there are. J3 and J4 must read the average from J2, not repeat it.',
      hint: 'Build the criterion by gluing the operator to the cell: ">"&$J$2.',
      sheet: sheetFor(d, metricBlock(['Average transaction', 'Revenue above the average',
        'How many are above it']), { colWidths: { I: 240, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4'],
      solution: {
        J2: '=AVERAGE($G$2:$G$16)',
        J3: '=SUMIF($G$2:$G$16,">"&$J$2)',
        J4: '=COUNTIF($G$2:$G$16,">"&$J$2)'
      },
      check: {
        J2: { mustUse: ['AVERAGE'] },
        J3: { mustUseAny: ['SUMIF', 'SUMIFS', 'SUMPRODUCT'], mustContain: ['$J$2'],
              containHint: 'read the average out of J2 rather than typing the number in again' },
        J4: { mustUseAny: ['COUNTIF', 'COUNTIFS', 'SUMPRODUCT'], mustContain: ['$J$2'],
              containHint: 'read the average out of J2 rather than typing the number in again' }
      },
      explain: {
        idea: 'A criterion is a piece of text. To compare against something that can change you build that ' +
          'text on the fly: the operator in quotes, then &, then the cell.',
        walk: [
          'The average of the fifteen transactions is ' + money(avg) + '.',
          '">"&$J$2 produces the text ">' + Math.round(avg) + '" at the moment the formula runs, and SUMIF uses it as the condition.',
          above.length + ' transactions are above the average, worth ' + money(above.reduce(function (a, r) { return a + r.revenue; }, 0)) + '.',
          'Fewer than half the transactions being above the average is normal, and is exactly the skew the median question is about.'
        ],
        mistakes: [
          'Writing ">$J$2", which compares against the literal text "$J$2" and returns zero.',
          'Rounding the average and typing it into the criterion. The sheet stops updating itself, which is the whole point of a spreadsheet.'
        ],
        onTheJob: 'Thresholds in a model belong in cells. The moment a partner asks "and if we set the bar at the median instead", you change one cell.'
      }
    };
  });

  question('sumproduct-conditions', 'condagg', 30, function (d) {
    var region = d.commonest('region');
    var rows = d.rows.filter(function (r) { return r.region === region; })
      .sort(function (a, b) { return b.units - a.units; });
    var limit = Math.max(10, Math.floor((rows[Math.min(1, rows.length - 1)].units - 1) / 10) * 10);
    var hit = d.rows.filter(function (r) { return r.region === region && r.units > limit; });
    return {
      title: 'Two conditions without SUMIFS',
      brief: 'J2 — the revenue of ' + region + ' transactions of more than ' + limit +
        ' units, using SUMPRODUCT rather than SUMIFS.',
      hint: 'SUMPRODUCT(($B$2:$B$16="' + region + '")*($E$2:$E$16>' + limit + ')*$G$2:$G$16). Each bracket becomes a column of TRUE/FALSE, which multiply as 1 and 0.',
      sheet: sheetFor(d, metricBlock([region + ' revenue over ' + limit + ' units']),
        { colWidths: { I: 280, J: 150 } }),
      table: TABLE,
      target: ['J2'],
      solution: { J2: '=SUMPRODUCT(($B$2:$B$16="' + region + '")*($E$2:$E$16>' + limit + ')*$G$2:$G$16)' },
      check: { J2: { mustUse: ['SUMPRODUCT'] } },
      explain: {
        idea: 'SUMPRODUCT is the general case that SUMIFS is a special case of. Conditions in brackets ' +
          'evaluate to TRUE and FALSE, multiplying turns them into 1 and 0, and everything multiplied by ' +
          'zero drops out of the total.',
        walk: [
          '($B$2:$B$16="' + region + '") produces fifteen TRUE/FALSE values, one per row.',
          '($E$2:$E$16>' + limit + ') produces fifteen more.',
          'Multiplying the three columns together leaves the revenue only on rows where both conditions held: ' +
            hit.length + ' row(s), ' + money(hit.reduce(function (a, r) { return a + r.revenue; }, 0)) + '.',
          'Where SUMIFS cannot go — a condition comparing two columns to each other, say — SUMPRODUCT still can.'
        ],
        mistakes: [
          'Using commas between the brackets instead of multiplication signs. SUMPRODUCT(a, b) needs both to be numbers; conditions have to be multiplied so TRUE becomes 1.',
          'Ranges of different heights. Every column inside a SUMPRODUCT must be the same size or it returns #VALUE!.'
        ],
        onTheJob: 'Weighted scores, conditional weighted averages, anything comparing two columns row by row: SUMPRODUCT is the tool, and interviewers know it separates the confident from the memorised.'
      }
    };
  });

  /* --------------------------------------------------------------- logic --- */
  question('if-flag', 'logic', 25, function (d) {
    var sorted = d.rows.map(function (r) { return r.revenue; }).sort(function (a, b) { return a - b; });
    var cut = Math.round(sorted[7] / 1000) * 1000;
    var big = d.rows.filter(function (r) { return r.revenue >= cut; }).length;
    return {
      title: 'Flag the large transactions',
      brief: 'Fill H2:H16 with "Large" where the revenue reaches the threshold in J2 and "Small" ' +
        'where it does not. The threshold must be read from J2, so that changing it re-labels the column.',
      hint: 'One IF, filled down. Pin the threshold as $J$2 or the reference slides down the column with the formula.',
      sheet: sheetFor(d, { H1: 'Size', I1: 'Parameter', J1: 'Value', I2: 'Large from', J2: cut },
        { styles: { H1: H, 'I1:J1': H }, colWidths: { H: 110, I: 160, J: 130 } }),
      table: TABLE,
      target: ['H2:H16'],
      solution: { 'H2:H16': '=IF(G2>=$J$2,"Large","Small")' },
      check: over('H2:H16', { mustUse: ['IF'], mustContain: ['$J$2'],
        containHint: 'the threshold must be pinned as $J$2 so it does not slide down the column' }),
      explain: {
        idea: 'IF is a question with two answers: the test, what to do when it is true, what to do when it ' +
          'is not. Everything else in the IF family is this one shape repeated.',
        walk: [
          'The threshold sits in J2 at ' + money(cut) + ' rather than inside the formula.',
          '$J$2 is pinned; G2 is not, so filling down turns it into G3, G4 and so on.',
          big + ' of the fifteen transactions reach the threshold and are labelled Large.',
          'Change J2 and the whole column re-labels itself — which is exactly what a reviewer will try.'
        ],
        mistakes: [
          'Writing =IF(G2>=' + cut + ', …) with the number inside the formula. Fifteen cells then need editing to change one assumption.',
          'Forgetting the dollars, so row 3 compares against J3, which is empty, and everything comes out Large.'
        ],
        onTheJob: 'Segmenting a book into large and small accounts is the first slide of half the commercial work there is, and the cut-off always moves at least twice.'
      }
    };
  });

  question('nested-if-band', 'logic', 25, function (d) {
    var sorted = d.rows.map(function (r) { return r.revenue; }).sort(function (a, b) { return a - b; });
    var t1 = Math.round(sorted[4] / 1000) * 1000;
    var t2 = Math.round(sorted[9] / 1000) * 1000;
    var small = d.rows.filter(function (r) { return r.revenue <= t1; }).length;
    var mid = d.rows.filter(function (r) { return r.revenue > t1 && r.revenue <= t2; }).length;
    return {
      title: 'Three bands from one formula',
      brief: 'Fill H2:H16 with "Small" up to the limit in J2, "Medium" up to the limit in J3, and ' +
        '"Large" above that.',
      hint: 'Nest one IF inside the other: =IF(G2<=$J$2,"Small",IF(G2<=$J$3,"Medium","Large")). The inner IF only runs when the first test fails, so it does not need to repeat it.',
      sheet: sheetFor(d, { H1: 'Band', I1: 'Parameter', J1: 'Value', I2: 'Small up to', J2: t1,
        I3: 'Medium up to', J3: t2 },
        { styles: { H1: H, 'I1:J1': H }, colWidths: { H: 110, I: 170, J: 130 } }),
      table: TABLE,
      target: ['H2:H16'],
      solution: { 'H2:H16': '=IF(G2<=$J$2,"Small",IF(G2<=$J$3,"Medium","Large"))' },
      check: over('H2:H16', { mustUseAny: ['IF', 'IFS'] }),
      explain: {
        idea: 'Nesting works because the second test is only reached once the first has failed. The ladder ' +
          'must therefore be written in order, from one end of the range to the other.',
        walk: [
          'Anything at or below ' + money(t1) + ' is Small: ' + small + ' transactions.',
          'What is left is tested against ' + money(t2) + '. Passing that makes it Medium: ' + mid + ' transactions.',
          'Everything that failed both tests is Large: ' + (15 - small - mid) + ' transactions.',
          'IFS does the same in one call: =IFS(G2<=$J$2,"Small",G2<=$J$3,"Medium",TRUE,"Large").'
        ],
        mistakes: [
          'Writing the bands out of order, so the first test catches rows meant for the second and the middle band comes out empty.',
          'Repeating the first condition inside the second — harmless but a sign of not trusting the nesting, and it doubles the length of every ladder you write.'
        ],
        onTheJob: 'Banding is everywhere: customer tiers, discount ladders, risk ratings. The order of the tests is what auditors check first.'
      }
    };
  });

  question('if-and', 'logic', 25, function (d) {
    var revs = d.rows.map(function (r) { return r.revenue; }).sort(function (a, b) { return a - b; });
    var uns = d.rows.map(function (r) { return r.units; }).sort(function (a, b) { return a - b; });
    var rCut = Math.round(revs[6] / 1000) * 1000;
    var uCut = Math.round(uns[6] / 10) * 10;
    var hit = d.rows.filter(function (r) { return r.revenue >= rCut && r.units >= uCut; }).length;
    return {
      title: 'Two tests at once',
      brief: 'Fill H2:H16 with "Yes" where a transaction is both worth at least the revenue in J2 and ' +
        'at least the number of units in J3, and "No" otherwise.',
      hint: 'AND inside IF: =IF(AND(G2>=$J$2,E2>=$J$3),"Yes","No"). AND is TRUE only when everything inside it is.',
      sheet: sheetFor(d, { H1: 'Priority', I1: 'Parameter', J1: 'Value',
        I2: 'Revenue at least', J2: rCut, I3: 'Units at least', J3: uCut },
        { styles: { H1: H, 'I1:J1': H }, colWidths: { H: 110, I: 170, J: 130 } }),
      table: TABLE,
      target: ['H2:H16'],
      solution: { 'H2:H16': '=IF(AND(G2>=$J$2,E2>=$J$3),"Yes","No")' },
      check: over('H2:H16', { mustUse: ['IF'], mustUseAny: ['AND', 'OR'] }),
      explain: {
        idea: 'AND and OR do not decide anything on their own — they hand a single TRUE or FALSE to the IF ' +
          'that wraps them. AND needs everything to hold; OR needs one thing to hold.',
        walk: [
          'AND(G2>=$J$2, E2>=$J$3) is one value, not two: TRUE only when both comparisons hold.',
          hit + ' of the fifteen transactions clear both bars.',
          'Both thresholds are pinned, so the formula fills down without either of them moving.',
          'Swap AND for OR and the count jumps, because either condition alone would then be enough.'
        ],
        mistakes: [
          'Writing =IF(G2>=$J$2 AND E2>=$J$3, …) as if it were English. AND is a function and takes its arguments in brackets.',
          'Nesting two IFs where one AND would do. It works, but it is twice as long and twice as easy to get wrong.'
        ],
        onTheJob: 'Qualification rules — big enough, recent enough, in the right segment — are always several conditions at once, and always change the week after you build them.'
      }
    };
  });

  /* -------------------------------------------------------------- lookup --- */
  question('vlookup-targets', 'lookup', 30, function (d) {
    var order = shuffled(seeded(d.paperNo * 31 + 5), d.managers);
    var booked = {};
    d.managers.forEach(function (m) {
      booked[m] = d.sumWhere(function (r) { return r.manager === m; });
    });
    var targets = {};
    d.managers.forEach(function (m, i) {
      targets[m] = Math.round(booked[m] * (i % 2 ? 1.2 : 0.8) / 1000) * 1000;
    });
    var extra = { I1: 'Manager', J1: 'Quarterly target', L1: 'Manager', M1: 'Target',
                  N1: 'Booked', O1: 'Target met?' };
    d.managers.forEach(function (m, i) {
      extra['I' + (2 + i)] = m;
      extra['J' + (2 + i)] = targets[m];
    });
    order.forEach(function (m, i) { extra['L' + (2 + i)] = m; });
    return {
      title: 'Targets, bookings and who made it',
      brief: 'For each manager in L2:L5 pull the target out of the table in I2:J5 into M2:M5, ' +
        'total what they actually booked into N2:N5, and say in O2:O5 whether they made it.',
      hint: 'VLOOKUP for the target, SUMIF over the Manager column for what was booked, then IF to compare the two.',
      sheet: sheetFor(d, extra, {
        cols: 17,
        styles: { 'I1:J1': H, 'L1:O1': H },
        colWidths: { I: 130, J: 150, L: 130, M: 120, N: 120, O: 120 }
      }),
      table: TABLE,
      target: ['M2:M5', 'N2:N5', 'O2:O5'],
      solution: {
        'M2:M5': '=VLOOKUP($L2,$I$2:$J$5,2,FALSE)',
        'N2:N5': '=SUMIF($D$2:$D$16,$L2,$G$2:$G$16)',
        'O2:O5': '=IF(N2>=M2,"yes","no")'
      },
      check: Object.assign(
        over('M2:M5', { mustUseAny: ['VLOOKUP', 'XLOOKUP', 'INDEX'] }),
        over('N2:N5', { mustUseAny: ['SUMIF', 'SUMIFS', 'SUMPRODUCT'] }),
        over('O2:O5', { mustUse: ['IF'] })),
      explain: {
        idea: 'Three different jobs in three columns: a lookup fetches a value someone else set, an ' +
          'aggregate computes one from the data, and a comparison turns the pair into an answer.',
        walk: [
          'The names in L2:L5 are deliberately in a different order from I2:I5, so the lookup has to ' +
            'actually search rather than sit next to its answer.',
          'VLOOKUP($L2, $I$2:$J$5, 2, FALSE) searches the first column of the block and returns the second. ' +
            'FALSE means exact match, which is what you want every time except on a ladder.',
          'SUMIF adds the revenue of every row belonging to that manager — ' +
            d.managers[0] + ' booked ' + money(booked[d.managers[0]]) + '.',
          'The IF then compares the two cells you just built, which is why they were worth building separately.'
        ],
        mistakes: [
          'Leaving the fourth argument out. VLOOKUP then does an approximate match on unsorted names and returns whatever it stumbled over.',
          'Forgetting the dollars on the block, so filling down turns $I$2:$J$5 into I3:J6 and the last name is not found.',
          'Counting the column index from the sheet rather than from the block: it is the second column of the block, not column J.'
        ],
        onTheJob: 'Target versus actual by owner is the most requested table in existence, and it is always assembled out of two files that do not share a row order.'
      }
    };
  });

  question('index-match-top', 'lookup', 30, function (d) {
    return {
      title: 'Who booked the biggest transaction',
      brief: 'J2 — the largest transaction. J3 — the manager who booked it. J4 — the region it was in. ' +
        'J3 and J4 must find the row themselves, not be typed in.',
      hint: 'MATCH finds which row holds the number in J2; INDEX reads that position out of another column. Exact match, so the third argument of MATCH is 0.',
      sheet: sheetFor(d, metricBlock(['Largest transaction', 'Manager who booked it',
        'Region it was in']), { colWidths: { I: 220, J: 160 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4'],
      solution: {
        J2: '=MAX($G$2:$G$16)',
        J3: '=INDEX($D$2:$D$16,MATCH($J$2,$G$2:$G$16,0))',
        J4: '=INDEX($B$2:$B$16,MATCH($J$2,$G$2:$G$16,0))'
      },
      check: {
        J2: { mustUse: ['MAX'] },
        J3: { mustUseAny: ['INDEX', 'XLOOKUP', 'VLOOKUP'] },
        J4: { mustUseAny: ['INDEX', 'XLOOKUP', 'VLOOKUP'] }
      },
      explain: {
        idea: 'INDEX and MATCH split the lookup in two: MATCH answers "which position", INDEX answers ' +
          '"what is at this position". Unlike VLOOKUP, the answer can sit to the left of what you searched.',
        walk: [
          'MAX finds ' + money(d.top.revenue) + ' in the Revenue column.',
          'MATCH looks for that number in G2:G16 and returns its position — the ' +
            (d.top.row - 1) + 'th row of the range.',
          'INDEX then reads the same position out of the Manager column: ' + d.top.manager + '.',
          'The region comes from the same MATCH applied to a different INDEX: ' + d.top.region + '. ' +
            'VLOOKUP could not do this, because both columns sit to the left of Revenue.'
        ],
        mistakes: [
          'Leaving MATCH\'s third argument out. It defaults to 1, an approximate match, which on an unsorted column returns nonsense.',
          'Giving INDEX and MATCH ranges of different heights, so the position points at the wrong row.',
          'Reading the answer off the screen and typing it in. It is right until the data changes, and the marking here is on the formula as well as the value.'
        ],
        onTheJob: 'INDEX and MATCH is the professional default: it survives columns being inserted, and it works in both directions. Interviewers ask for it by name.'
      }
    };
  });

  question('two-way-lookup', 'lookup', 30, function (d) {
    var rates = {};
    var extra = { I1: 'Product \\ Region', I6: 'Look up', I7: 'Product', I8: 'Region', I9: 'Commission rate' };
    d.regions.forEach(function (rg, i) { extra[COLS[9 + i] + '1'] = rg; });      // J1 … M1
    d.products.forEach(function (p, i) {
      extra['I' + (2 + i)] = p;
      d.regions.forEach(function (rg, j) {
        var rate = Math.round((2 + ((i * 3 + j * 5) % 7)) * 100) / 10000;        // 0.02 … 0.008
        rates[p + '|' + rg] = rate;
        extra[COLS[9 + j] + (2 + i)] = rate;
      });
    });
    var wantP = d.products[1], wantR = d.regions[2];
    extra.J7 = wantP;
    extra.J8 = wantR;
    return {
      title: 'A rate at the crossing of two labels',
      brief: 'J9 — the commission rate for the product in J7 and the region in J8, read out of the ' +
        'matrix J2:M4. Changing either label must change the answer.',
      hint: 'INDEX over the body of the matrix, with one MATCH down the product labels in I2:I4 and another across the region labels in J1:M1.',
      sheet: sheetFor(d, extra, {
        cols: 15,
        styles: { 'I1:M1': H, 'I2:I4': H, I6: H },
        colWidths: { I: 170, J: 120, K: 120, L: 120, M: 120 },
        formats: { 'J2:M4': '0.0%', J9: '0.0%' }
      }),
      table: TABLE,
      target: ['J9'],
      solution: { J9: '=INDEX($J$2:$M$4,MATCH($J$7,$I$2:$I$4,0),MATCH($J$8,$J$1:$M$1,0))' },
      check: { J9: { mustUseAny: ['INDEX', 'XLOOKUP'] } },
      explain: {
        idea: 'INDEX takes a row number and a column number. Work each out with its own MATCH and you have ' +
          'a lookup that reads a grid in both directions at once.',
        walk: [
          'The first MATCH searches the product labels down the side and returns which row of the matrix to use.',
          'The second searches the region labels across the top and returns which column.',
          'INDEX takes the body of the matrix — J2:M4, labels excluded — and reads the cell where the two meet: ' +
            pct(rates[wantP + '|' + wantR]) + '.',
          'Both MATCHes end in 0 for an exact match, because labels are text and are not sorted.'
        ],
        mistakes: [
          'Including the labels in the INDEX range, which shifts every answer by one row and one column.',
          'Hard-coding one of the two positions, so the formula stops working the moment the other label changes.'
        ],
        onTheJob: 'Price grids, discount matrices, FX tables, tariff schedules — a two-way lookup is how you read any of them without rebuilding the sheet.'
      }
    };
  });

  question('approx-lookup', 'lookup', 30, function (d) {
    var sorted = d.rows.map(function (r) { return r.revenue; }).sort(function (a, b) { return a - b; });
    var t1 = Math.round(sorted[4] / 1000) * 1000;
    var t2 = Math.round(sorted[9] / 1000) * 1000;
    var t3 = Math.round(sorted[12] / 1000) * 1000;
    return {
      title: 'A commission ladder',
      brief: 'Fill H2:H16 with the commission earned on each transaction: its revenue times the rate ' +
        'from the ladder in I2:J5. The ladder gives the rate that applies from each level upwards.',
      hint: 'VLOOKUP with TRUE as the fourth argument finds the largest level not above the value — which is exactly what a ladder means. Multiply the rate by the revenue.',
      sheet: sheetFor(d, {
        H1: 'Commission', I1: 'Revenue from', J1: 'Rate',
        I2: 0, J2: 0.01, I3: t1, J3: 0.02, I4: t2, J4: 0.035, I5: t3, J5: 0.05
      }, {
        styles: { H1: H, 'I1:J1': H },
        colWidths: { H: 130, I: 150, J: 110 },
        formats: { 'J2:J5': '0.0%' }
      }),
      table: TABLE,
      target: ['H2:H16'],
      solution: { 'H2:H16': '=VLOOKUP(G2,$I$2:$J$5,2,TRUE)*G2' },
      check: over('H2:H16', { mustUseAny: ['VLOOKUP', 'LOOKUP', 'XLOOKUP', 'INDEX'] }),
      explain: {
        idea: 'An approximate lookup is not a fuzzy one. Given a sorted first column it finds the last ' +
          'entry that does not exceed the value — the definition of a banded rate.',
        walk: [
          'The ladder starts at 0 so that every possible revenue lands on a band. A ladder with a hole in it returns #N/A.',
          'A transaction of ' + money(sorted[0]) + ' falls on the ' + (sorted[0] >= t1 ? '2%' : '1%') + ' band; ' +
            'the largest, ' + money(d.top.revenue) + ', falls on the ' + (d.top.revenue >= t3 ? '5%' : '3.5%') + ' band.',
          'The rate is then multiplied by the revenue in the same formula, so the column is commission in money.',
          'The block is pinned as $I$2:$J$5 because the formula is filled down fifteen rows.'
        ],
        mistakes: [
          'Passing FALSE, which demands an exact revenue match against the ladder and returns #N/A on every row.',
          'Leaving the ladder unsorted. An approximate VLOOKUP over an unsorted column returns a wrong answer silently — no error, just nonsense.'
        ],
        onTheJob: 'Tax bands, volume discounts, bonus schedules, shipping tariffs: every one of them is a sorted ladder and an approximate lookup.'
      }
    };
  });

  question('iferror-lookup', 'lookup', 25, function (d) {
    var missing = PRODUCTS.filter(function (p) { return d.products.indexOf(p) < 0; })[0] || 'Hosting';
    var extra = { I1: 'Product', J1: 'List price', L1: 'Asked for', M1: 'List price' };
    d.products.forEach(function (p, i) {
      extra['I' + (2 + i)] = p;
      extra['J' + (2 + i)] = 100 * (2 + i * 3);
    });
    [d.products[1], missing, d.products[0], d.products[2]].forEach(function (p, i) {
      extra['L' + (2 + i)] = p;
    });
    return {
      title: 'A lookup that is allowed to fail',
      brief: 'Fill M2:M5 with the list price of each product named in L2:L5, taken from I2:J4. ' +
        'One of them is not on the list: that cell must read "not on the list" rather than an error.',
      hint: 'Wrap the VLOOKUP in IFERROR: =IFERROR(VLOOKUP(...),"not on the list").',
      sheet: sheetFor(d, extra, {
        cols: 15,
        styles: { 'I1:J1': H, 'L1:M1': H },
        colWidths: { I: 130, J: 130, L: 140, M: 170 }
      }),
      table: TABLE,
      target: ['M2:M5'],
      solution: { 'M2:M5': '=IFERROR(VLOOKUP($L2,$I$2:$J$4,2,FALSE),"not on the list")' },
      check: over('M2:M5', { mustUse: ['IFERROR'], mustUseAny: ['VLOOKUP', 'XLOOKUP', 'INDEX'] }),
      explain: {
        idea: 'IFERROR catches whatever the formula inside it throws and substitutes your own answer. ' +
          'It is the difference between a report with a #N/A in it and a report that says what happened.',
        walk: [
          'Three of the four names are in the list and return their price.',
          '"' + missing + '" is not, so the VLOOKUP raises #N/A and IFERROR replaces it with the wording the question asked for.',
          'The block is pinned as $I$2:$J$4 and the lookup value as $L2 — column pinned, row free — so the formula fills down cleanly.',
          'One #N/A left visible in a table of prices is enough for a client to stop reading the page.'
        ],
        mistakes: [
          'Wrapping everything in IFERROR out of habit, which hides real mistakes as well as expected ones. Use it where a miss is legitimate, not to tidy up.',
          'Using IFNA when the formula can throw other errors too, or IFERROR when you specifically wanted to see them.'
        ],
        onTheJob: 'Two systems never hold exactly the same list of products. The gaps are the interesting part of the analysis, so they have to be visible and labelled, not hidden behind an error.'
      }
    };
  });

  /* ------------------------------------------------------ text and dates --- */
  question('composite-key', 'textdate', 20, function (d) {
    var first = d.rows[0];
    var key = first.region.slice(0, 3).toUpperCase() + '-' + first.product.slice(0, 2).toUpperCase();
    var same = d.rows.filter(function (r) {
      return r.region.slice(0, 3).toUpperCase() + '-' + r.product.slice(0, 2).toUpperCase() === key;
    }).length;
    return {
      title: 'Build a key out of two columns',
      brief: 'Fill H2:H16 with a key made of the first three letters of the region, a hyphen, and the ' +
        'first two letters of the product, all in capitals. J2 — how many rows share the key that row 2 produced.',
      hint: 'LEFT takes characters from the start of a piece of text, UPPER puts them in capitals, and & glues pieces together. Then COUNTIF the column against H2.',
      sheet: sheetFor(d, Object.assign({ H1: 'Key' }, metricBlock(['Rows sharing the first key'])),
        { styles: { H1: H }, colWidths: { H: 120, I: 230, J: 130 } }),
      table: TABLE,
      target: ['H2:H16', 'J2'],
      solution: {
        'H2:H16': '=UPPER(LEFT($B2,3))&"-"&UPPER(LEFT($C2,2))',
        J2: '=COUNTIF($H$2:$H$16,$H$2)'
      },
      check: Object.assign(
        over('H2:H16', { mustUse: ['LEFT'] }),
        { J2: { mustUseAny: ['COUNTIF', 'COUNTIFS', 'SUMPRODUCT'] } }),
      explain: {
        idea: 'A composite key is how two tables that share no single identifying column are joined. ' +
          'Building one is three text functions and an ampersand.',
        walk: [
          'LEFT($B2,3) takes the first three characters of the region and UPPER puts them in capitals.',
          '& glues the pieces into one string, with the hyphen as a literal in quotes.',
          'Row 2 produces ' + key + '; ' + same + ' of the fifteen rows produce the same key.',
          'COUNTIF against $H$2 counts them without you having to read the column.'
        ],
        mistakes: [
          'Forgetting the quotes around the hyphen, so Excel reads it as a minus sign and the formula fails.',
          'Building a key that is not unique and then using it for a lookup. Always count the duplicates first — which is exactly what J2 is for.'
        ],
        onTheJob: 'Joining a CRM export to a finance export usually means building a key by hand out of two or three columns, and checking for duplicates before trusting it.'
      }
    };
  });

  question('quarter-from-date', 'textdate', 30, function (d) {
    var counts = [0, 0, 0, 0];
    d.rows.forEach(function (r) { counts[r.quarter - 1]++; });
    var q = counts.indexOf(Math.max.apply(null, counts)) + 1;
    var total = d.sumWhere(function (r) { return r.quarter === q; });
    return {
      title: 'Work the quarter out from the date',
      brief: 'Fill H2:H16 with the quarter number of each transaction, computed from its date. ' +
        'J3 — the revenue of the quarter whose number is in J2.',
      hint: 'MONTH gives 1 to 12; divide by three and round up with ROUNDUP to get 1 to 4. Then SUMIF the quarter column against J2.',
      sheet: sheetFor(d, Object.assign({ H1: 'Quarter', J2: q },
        metricBlock(['Quarter to report on', 'Revenue in that quarter'])),
        { styles: { H1: H }, colWidths: { H: 110, I: 200, J: 140 } }),
      table: TABLE,
      target: ['H2:H16', 'J3'],
      solution: {
        'H2:H16': '=ROUNDUP(MONTH($A2)/3,0)',
        J3: '=SUMIF($H$2:$H$16,$J$2,$G$2:$G$16)'
      },
      check: Object.assign(
        over('H2:H16', { mustUse: ['MONTH'] }),
        { J3: { mustUseAny: ['SUMIF', 'SUMIFS', 'SUMPRODUCT'] } }),
      explain: {
        idea: 'A date is a number — the count of days since the start of 1900 — which is why MONTH can pull ' +
          'a piece out of it and why dates can be compared and subtracted like any other number.',
        walk: [
          'MONTH returns 1 to 12. Dividing by three gives 0.33 for January, 0.67 for February and exactly 1 for March.',
          'ROUNDUP pushes all three to 1: the first quarter. April, May and June give 1.33, 1.67 and 2, all rounding up to 2.',
          'Quarter ' + q + ' is the busiest in this book with ' + counts[q - 1] + ' transactions, worth ' + money(total) + '.',
          'J2 holds the quarter to report on, so the answer in J3 follows whatever you put there.'
        ],
        mistakes: [
          'Using ROUND instead of ROUNDUP. April would then come out as quarter 1, which is wrong.',
          'Reading the quarter off the date as text. The moment the file arrives with real dates rather than strings, that breaks.'
        ],
        onTheJob: 'Data arrives daily and gets reported quarterly. A derived period column is the first thing to add, and everything downstream depends on it being right.'
      }
    };
  });

  question('date-arithmetic', 'textdate', 25, function (d) {
    return {
      title: 'First, last and how far apart',
      brief: 'J2 — the date of the first transaction. J3 — the date of the last. J4 — how many days ' +
        'apart they are. J5 — the last day of the month in which the last transaction falls.',
      hint: 'MIN and MAX work on dates because dates are numbers. Subtract one from the other for the gap, and use EOMONTH with 0 for the end of that same month.',
      sheet: sheetFor(d, metricBlock(['First transaction', 'Last transaction',
        'Days between them', 'End of that month']),
        { colWidths: { I: 210, J: 150 },
          formats: { J2: 'dd/mm/yyyy', J3: 'dd/mm/yyyy', J5: 'dd/mm/yyyy' } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4', 'J5'],
      solution: {
        J2: '=MIN($A$2:$A$16)', J3: '=MAX($A$2:$A$16)',
        J4: '=$J$3-$J$2', J5: '=EOMONTH($J$3,0)'
      },
      check: {
        J2: { mustUse: ['MIN'] }, J3: { mustUse: ['MAX'] },
        J4: { tol: 0.5 }, J5: { mustUseAny: ['EOMONTH', 'DATE'] }
      },
      explain: {
        idea: 'Dates are stored as day counts, so every ordinary numeric tool works on them: MIN, MAX, ' +
          'subtraction, comparison. Only the formatting makes them look like dates.',
        walk: [
          'MIN over the date column gives the earliest transaction of ' + d.year + ', MAX the latest.',
          'Subtracting one from the other gives a plain number of days. If the cell shows a date instead, ' +
            'the answer is right and only the number format is wrong.',
          'EOMONTH with a second argument of 0 means "the end of this month"; 1 would mean the end of next month, -1 last month.',
          'Cells J2, J3 and J5 are formatted as dates and J4 deliberately is not.'
        ],
        mistakes: [
          'Using COUNT or a hand count instead of MIN and MAX, which stops working the moment a row is added.',
          'Panicking when a subtraction of two dates displays as 05/01/1900. That is 5 days shown with the wrong format.'
        ],
        onTheJob: 'Ageing a receivables ledger, measuring time to close, cutting a period at month end — all of it is date subtraction and EOMONTH.'
      }
    };
  });

  /* ------------------------------------------------------------ analysis --- */
  question('share-of-total', 'analysis', 25, function (d) {
    return {
      title: 'Each transaction as a share of the whole',
      brief: 'J2 — total revenue. Then fill H2:H16 with each transaction as a share of that total. ' +
        'The shares must add up to exactly 100%.',
      hint: 'The divisor is the same cell for every row, so it must be pinned: =G2/$J$2. Use ⌘T while typing to add the dollars.',
      sheet: sheetFor(d, Object.assign({ H1: 'Share of total' }, metricBlock(['Total revenue'])),
        { styles: { H1: H }, colWidths: { H: 130, I: 180, J: 150 },
          formats: { 'H2:H16': '0.0%' } }),
      table: TABLE,
      target: ['J2', 'H2:H16'],
      solution: { J2: '=SUM($G$2:$G$16)', 'H2:H16': '=G2/$J$2' },
      check: Object.assign(
        { J2: { mustUse: ['SUM'] } },
        over('H2:H16', { mustContain: ['$J$2'],
          containHint: 'the total has to be pinned as $J$2, or every row divides by a different cell' })),
      explain: {
        idea: 'The one thing that has to be pinned in a column of shares is the denominator. This is the ' +
          'question the dollar sign exists for.',
        walk: [
          'J2 totals the fifteen transactions: ' + money(d.totalRevenue) + '.',
          'H2 divides the first transaction by that total. Filling down moves G2 to G3 — which is what you want — ' +
            'but $J$2 stays put, which is the whole trick.',
          'Without the dollars, H3 would divide by J3, which is empty, and the column would fill with #DIV/0!.',
          'The largest transaction, ' + money(d.top.revenue) + ', is ' + pct(d.top.revenue / d.totalRevenue) +
            ' of the book on its own.'
        ],
        mistakes: [
          'Typing the total into every formula as a number. The column stops being alive and a single new row makes every share wrong.',
          'Formatting as a percentage without dividing, so the column reads 4,200,000%.'
        ],
        onTheJob: 'Every mix chart in every deck is this column. Being unable to produce it in ten seconds is noticed immediately.'
      }
    };
  });

  question('weighted-price', 'analysis', 30, function (d) {
    var weighted = d.totalRevenue / d.totalUnits;
    var simple = d.rows.reduce(function (a, r) { return a + r.price; }, 0) / 15;
    return {
      title: 'Weighted against simple average price',
      brief: 'J2 — the average price a unit actually sold for, weighting every transaction by its units. ' +
        'J3 — the plain average of the Price column. J4 — the difference between the two.',
      hint: 'The weighted price is total revenue over total units: SUMPRODUCT of units and price, divided by SUM of units.',
      sheet: sheetFor(d, metricBlock(['Weighted average price', 'Simple average price',
        'Difference']), { colWidths: { I: 220, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4'],
      solution: {
        J2: '=SUMPRODUCT($E$2:$E$16,$F$2:$F$16)/SUM($E$2:$E$16)',
        J3: '=AVERAGE($F$2:$F$16)',
        J4: '=$J$2-$J$3'
      },
      check: {
        J2: { mustUseAny: ['SUMPRODUCT', 'SUM'] },
        J3: { mustUse: ['AVERAGE'] },
        J4: { tol: 0.5 }
      },
      explain: {
        idea: 'The average of a column of prices answers "what was a typical price tag". The weighted ' +
          'average answers "what did a unit actually sell for". They are different questions and usually ' +
          'different numbers.',
        walk: [
          'SUMPRODUCT of units and price is total revenue: ' + money(d.totalRevenue) + '.',
          'Dividing by ' + money(d.totalUnits) + ' units gives ' + money(weighted) + ' per unit.',
          'The plain average of the price column is ' + money(simple) + '.',
          'The gap is ' + money(weighted - simple) + ', and it exists because the big orders were not sold at the average price.'
        ],
        mistakes: [
          'Averaging a column of averages or a column of ratios. Rates have to be weighted by whatever they are rates of.',
          'Weighting by revenue instead of units, which double-counts price and produces a number that means nothing.'
        ],
        onTheJob: 'Average price, average margin, average rate — in consulting these are weighted by default, and quoting the unweighted one is the classic first-week mistake.'
      }
    };
  });

  question('concentration', 'analysis', 30, function (d) {
    var top3 = d.byRevenue.slice(0, 3).reduce(function (a, r) { return a + r.revenue; }, 0);
    return {
      title: 'How concentrated is the book',
      brief: 'J2, J3 and J4 — the largest, second largest and third largest transactions. ' +
        'J5 — what share of total revenue those three make up.',
      hint: 'LARGE with 1, 2 and 3 as the second argument. The share is the sum of J2:J4 over the total of the Revenue column.',
      sheet: sheetFor(d, metricBlock(['Largest transaction', 'Second largest', 'Third largest',
        'Share of the top three']), { colWidths: { I: 210, J: 150 }, formats: { J5: '0.0%' } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4', 'J5'],
      solution: {
        J2: '=LARGE($G$2:$G$16,1)', J3: '=LARGE($G$2:$G$16,2)',
        J4: '=LARGE($G$2:$G$16,3)', J5: '=SUM($J$2:$J$4)/SUM($G$2:$G$16)'
      },
      check: {
        J2: { mustUseAny: ['LARGE', 'MAX'] }, J3: { mustUse: ['LARGE'] },
        J4: { mustUse: ['LARGE'] }, J5: { tol: 0.0005 }
      },
      explain: {
        idea: 'Concentration is the first question to ask of any revenue book: is this a business or is it ' +
          'three customers. LARGE gives you the top of the distribution without sorting anything.',
        walk: [
          'LARGE(range, 1) is the same as MAX: ' + money(d.byRevenue[0].revenue) + '.',
          'LARGE(range, 2) and LARGE(range, 3) give ' + money(d.byRevenue[1].revenue) + ' and ' +
            money(d.byRevenue[2].revenue) + ' — MAX cannot reach either.',
          'Together the top three are ' + money(top3) + ' of ' + money(d.totalRevenue) + ': ' +
            pct(top3 / d.totalRevenue) + ' of the book.',
          'LARGE does not care about the order of the data, which is why it beats sorting when you only want the top of the list.'
        ],
        mistakes: [
          'Sorting the data and reading the top three off the screen. It works until somebody re-sorts the sheet.',
          'Using SMALL when the question wanted the top, or counting the ranks from zero.'
        ],
        onTheJob: 'Top-three and top-ten shares go on the first page of every commercial due diligence, because a concentrated book is a different risk entirely.'
      }
    };
  });

  question('growth-cagr', 'analysis', 30, function (d) {
    var rnd = seeded(d.paperNo * 977 + 13);
    var start = 1000 * (40 + Math.floor(rnd() * 60));
    var series = [start];
    for (var i = 1; i < 5; i++) {
      series.push(Math.round(series[i - 1] * (1.04 + rnd() * 0.22) / 1000) * 1000);
    }
    var years = [];
    var extra = { I1: 'Year', J1: 'Revenue', K1: 'Growth', L2: 'Metric', M2: 'Value',
                  L3: 'Compound annual growth over the four years' };
    for (i = 0; i < 5; i++) {
      years.push(d.year - 4 + i);
      extra['I' + (2 + i)] = d.year - 4 + i;
      extra['J' + (2 + i)] = series[i];
    }
    var cagr = Math.pow(series[4] / series[0], 1 / 4) - 1;
    return {
      title: 'Year-on-year growth and the CAGR',
      brief: 'Fill K3:K6 with each year\'s growth against the year before it. M3 — the compound annual ' +
        'growth rate across the whole period, from the first year in J2 to the last in J6.',
      hint: 'Growth is this year over last year minus one. A CAGR over four steps is the ratio of the ends raised to the power of one quarter, minus one.',
      sheet: sheetFor(d, extra, {
        cols: 16,
        styles: { 'I1:K1': H, 'L2:M2': H },
        colWidths: { I: 90, J: 130, K: 110, L: 300, M: 120 },
        formats: { 'K3:K6': '0.0%', M3: '0.0%' }
      }),
      table: TABLE,
      target: ['K3:K6', 'M3'],
      solution: { 'K3:K6': '=J3/J2-1', M3: '=($J$6/$J$2)^(1/4)-1' },
      check: Object.assign(
        over('K3:K6', { tol: 0.0005 }),
        { M3: { tol: 0.0005 } }),
      explain: {
        idea: 'Growth compounds, so a series of yearly rates cannot be averaged. The CAGR is the single ' +
          'rate that would have taken you from the first number to the last in the same number of steps.',
        walk: [
          'K3 compares ' + years[1] + ' with ' + years[0] + ': ' + money(series[1]) + ' over ' +
            money(series[0]) + ' minus one, which is ' + pct(series[1] / series[0] - 1) + '.',
          'K2 stays empty on purpose — there is no year before the first one to compare against.',
          'The CAGR uses four steps between five years, so the exponent is one quarter, not one fifth. Counting the years instead of the gaps is the classic error.',
          'It comes out at ' + pct(cagr) + ', which is not the average of the four yearly rates.'
        ],
        mistakes: [
          'Averaging the yearly growth rates. That overstates the answer whenever the rates vary, which is always.',
          'Dividing by the number of years rather than the number of periods between them.'
        ],
        onTheJob: 'Every market-sizing page quotes a CAGR, and the first question asked of it is which two years it runs between.'
      }
    };
  });

  question('npv-irr', 'analysis', 30, function (d) {
    var rnd = seeded(d.paperNo * 613 + 29);
    var invest = -1000 * (200 + Math.floor(rnd() * 300));
    var flows = [];
    for (var i = 0; i < 5; i++) {
      flows.push(1000 * Math.round(Math.abs(invest) * (0.25 + rnd() * 0.16) / 1000));
    }
    var rate = 0.1 + Math.floor(rnd() * 4) / 100;
    var extra = { I1: 'Year', J1: 'Cash flow', I2: 0, J2: invest,
                  L2: 'Metric', M2: 'Value', L3: 'Discount rate', M3: rate,
                  L4: 'Net present value', L5: 'Internal rate of return' };
    flows.forEach(function (f, i) { extra['I' + (3 + i)] = i + 1; extra['J' + (3 + i)] = f; });
    var npv = invest + flows.reduce(function (a, f, i) { return a + f / Math.pow(1 + rate, i + 1); }, 0);
    return {
      title: 'Is the investment worth making',
      brief: 'M4 — the net present value of the cash flows in J2:J7 at the discount rate in M3. ' +
        'M5 — the internal rate of return of the same cash flows.',
      hint: 'Excel\'s NPV discounts from period one, so the year-zero outlay is added outside it: =J2+NPV(M3,J3:J7). IRR takes the whole range including year zero.',
      sheet: sheetFor(d, extra, {
        cols: 16,
        styles: { 'I1:J1': H, 'L2:M2': H },
        colWidths: { I: 90, J: 140, L: 200, M: 140 },
        formats: { M3: '0.0%', M5: '0.0%' }
      }),
      table: TABLE,
      target: ['M4', 'M5'],
      solution: { M4: '=$J$2+NPV($M$3,$J$3:$J$7)', M5: '=IRR($J$2:$J$7)' },
      check: { M4: { mustUse: ['NPV'], tol: 1 }, M5: { mustUse: ['IRR'], tol: 0.0005 } },
      explain: {
        idea: 'Money now is worth more than money later. NPV prices that; the IRR is the discount rate at ' +
          'which the NPV would be exactly zero, which is why the two always answer together.',
        walk: [
          'The outlay of ' + money(invest) + ' happens at time zero, so it is not discounted at all.',
          'Excel\'s NPV assumes its first value is already one period away, so year zero is added outside the function. ' +
            'Including it inside is the commonest mistake in finance modelling.',
          'At ' + pct(rate) + ' the net present value is ' + money(npv) + '.',
          'IRR takes the complete range, year zero included, and needs at least one sign change to converge.'
        ],
        mistakes: [
          'Writing =NPV(M3, J2:J7), which discounts the initial outlay by one year and understates it.',
          'Reading a positive NPV and a tiny IRR as agreeing. If they disagree, the ranges are wrong.'
        ],
        onTheJob: 'Any capital request, any pricing of a contract with a long tail: NPV for the decision, IRR for the conversation.'
      }
    };
  });

  question('breakeven', 'analysis', 25, function (d) {
    var rnd = seeded(d.paperNo * 449 + 7);
    var price = 50 * (20 + Math.floor(rnd() * 40));
    var variable = Math.round(price * (0.45 + rnd() * 0.2) / 10) * 10;
    var fixed = 1000 * (150 + Math.floor(rnd() * 250));
    var volume = 100 * (10 + Math.floor(rnd() * 40));
    var contribution = price - variable;
    return {
      title: 'Break-even on a unit economics sheet',
      brief: 'M3 — the contribution one unit makes. M4 — how many units must be sold to cover the fixed ' +
        'costs. M5 — the profit at the volume in J5.',
      hint: 'Contribution is price minus variable cost. Break-even is fixed costs divided by that contribution. Profit is contribution times volume, less fixed costs.',
      sheet: sheetFor(d, {
        I1: 'Assumption', J1: 'Value',
        I2: 'Price per unit', J2: price,
        I3: 'Variable cost per unit', J3: variable,
        I4: 'Fixed costs', J4: fixed,
        I5: 'Units sold', J5: volume,
        L2: 'Metric', M2: 'Value',
        L3: 'Contribution per unit', L4: 'Break-even units', L5: 'Profit at the volume sold'
      }, {
        cols: 16,
        styles: { 'I1:J1': H, 'L2:M2': H },
        colWidths: { I: 200, J: 120, L: 210, M: 140 }
      }),
      table: TABLE,
      target: ['M3', 'M4', 'M5'],
      solution: {
        M3: '=$J$2-$J$3',
        M4: '=$J$4/$M$3',
        M5: '=$J$5*$M$3-$J$4'
      },
      check: { M3: { tol: 0.5 }, M4: { tol: 0.5 }, M5: { tol: 0.5 } },
      explain: {
        idea: 'Unit economics is three numbers: what a unit earns, what it costs to make, and what has to ' +
          'be paid whatever happens. Everything else follows from those.',
        walk: [
          'Each unit sells at ' + money(price) + ' and costs ' + money(variable) + ' to make, so it contributes ' +
            money(contribution) + ' towards the fixed costs.',
          'Fixed costs of ' + money(fixed) + ' divided by that contribution means ' +
            money(fixed / contribution) + ' units before the business breaks even.',
          'At ' + money(volume) + ' units the profit is ' + money(volume * contribution - fixed) + '.',
          'M4 and M5 both point at M3 rather than repeating the subtraction, so one change to the price flows everywhere.'
        ],
        mistakes: [
          'Dividing the fixed costs by the price rather than by the contribution, which ignores the cost of making the thing.',
          'Rebuilding the same subtraction in three places. One cell, one meaning: it is what makes a model reviewable.'
        ],
        onTheJob: 'Break-even volume is the number a client remembers from the whole deck, and it is always recomputed live in the room at a different price.'
      }
    };
  });

  /* ------------------------------------------------------------- sorting --- */
  question('sort-top', 'sort', 25, function (d) {
    var top5 = d.byRevenue.slice(0, 5).reduce(function (a, r) { return a + r.revenue; }, 0);
    return {
      title: 'Sort and read off the top',
      brief: 'Sort the table by Revenue, largest first. Then J2 — the region of the biggest transaction, ' +
        'J3 — the manager who booked it, J4 — the share of total revenue held by the top five.',
      hint: 'Turn the filter on with ⌘⇧F and sort on the Revenue header. After sorting, J2 is simply =B2 and J4 is the sum of the first five revenues over the whole column.',
      sheet: sheetFor(d, metricBlock(['Region of the largest', 'Manager who booked it',
        'Share of the top five']), { colWidths: { I: 210, J: 150 }, formats: { J4: '0.0%' } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4'],
      solution: { J2: '=B2', J3: '=D2', J4: '=SUM(G2:G6)/SUM($G$2:$G$16)' },
      expect: { sortedBy: { col: 'G', asc: false } },
      check: { J4: { tol: 0.0005 } },
      explain: {
        idea: 'Sorting is not decoration. It is what makes a positional formula — "the first row", "the ' +
          'top five" — mean anything at all.',
        walk: [
          'Sorting by revenue descending brings the ' + money(d.top.revenue) + ' transaction to row 2.',
          'J2 reads the region out of whatever row is now first: ' + d.top.region + '. J3 does the same for the manager.',
          'J4 adds the first five revenue cells and divides by the whole column: ' + pct(top5 / d.totalRevenue) +
            ' of the book sits in five transactions.',
          'Run the same formulas before sorting and they return a different, meaningless answer — which is the point of the question.'
        ],
        mistakes: [
          'Sorting ascending and reporting the smallest transaction with complete confidence.',
          'Sorting one column on its own rather than the whole table, which detaches every row from its own data. This is the single most destructive mistake possible in Excel.'
        ],
        onTheJob: 'Sort, read the top ten, read the bottom ten. That is the first two minutes with any new file, every time.'
      }
    };
  });

  question('sort-smallest', 'sort', 25, function (d) {
    var byUnits = d.rows.slice().sort(function (a, b) { return a.units - b.units; });
    var avg5 = byUnits.slice(0, 5).reduce(function (a, r) { return a + r.revenue; }, 0) / 5;
    return {
      title: 'Sort the other way and read the tail',
      brief: 'Sort the table by Units, smallest first. Then J2 — the manager on the smallest order, ' +
        'J3 — the product it was, J4 — the average revenue of the five smallest orders.',
      hint: 'Sort ascending on the Units header. J2 is then =D2 and J4 averages the first five cells of the Revenue column.',
      sheet: sheetFor(d, metricBlock(['Manager on the smallest order', 'Product it was',
        'Average revenue of the five smallest']), { colWidths: { I: 260, J: 150 } }),
      table: TABLE,
      target: ['J2', 'J3', 'J4'],
      solution: { J2: '=D2', J3: '=C2', J4: '=AVERAGE(G2:G6)' },
      expect: { sortedBy: { col: 'E', asc: true } },
      check: { J4: { mustUse: ['AVERAGE'] } },
      explain: {
        idea: 'The bottom of a distribution is as informative as the top, and usually less examined. ' +
          'Sorting ascending costs nothing and answers a different set of questions.',
        walk: [
          'Ascending on Units puts the ' + byUnits[0].units + '-unit order in row 2.',
          'J2 and J3 read the manager and the product off that row rather than being typed in.',
          'J4 averages the revenue of the five smallest orders: ' + money(avg5) + '.',
          'Note that the smallest order by units is not the smallest by revenue — a cheap column and an expensive one rank differently, which is exactly why the sort column matters.'
        ],
        mistakes: [
          'Sorting by Revenue when the question said Units. Read which column the question names before touching anything.',
          'Leaving the sort from a previous question in place and answering the new one against the old order.'
        ],
        onTheJob: 'Small orders are where the cost to serve hides. A sort ascending on volume is how that conversation usually starts.'
      }
    };
  });

  /* ----------------------------------------------------------- filtering --- */
  question('filter-product', 'filter', 30, function (d) {
    var product = d.commonest('product');
    var rows = d.rows.filter(function (r) { return r.product === product; });
    var rev = rows.reduce(function (a, r) { return a + r.revenue; }, 0);
    return {
      title: 'Filter, and total what is visible',
      brief: 'Filter the table down to ' + product + '. The answer block sits below the table, out of ' +
        'the filter\'s reach: B19 — the revenue of the visible rows, B20 — how many rows are visible, ' +
        'B21 — their average revenue.',
      hint: 'SUBTOTAL with the function numbers 9 for a sum, 3 for a count and 1 for an average. A plain SUM would ignore the filter completely.',
      sheet: sheetFor(d, {
        A18: 'Summary', A19: 'Visible revenue', A20: 'Visible rows', A21: 'Average visible revenue'
      }, { rows: 24, styles: { A18: H }, colWidths: { A: 220 } }),
      table: TABLE,
      target: ['B19', 'B20', 'B21'],
      solution: {
        B19: '=SUBTOTAL(9,$G$2:$G$16)',
        B20: '=SUBTOTAL(3,$A$2:$A$16)',
        B21: '=SUBTOTAL(1,$G$2:$G$16)'
      },
      expect: { filtered: { col: 'C', values: [product] } },
      check: over('B19:B21', { mustUse: ['SUBTOTAL'] }),
      explain: {
        idea: 'A total underneath a filtered table must be a SUBTOTAL, or it silently reports rows the ' +
          'reader cannot see. This is one of the most common real errors in client reporting.',
        walk: [
          'Filtering to ' + product + ' leaves ' + rows.length + ' rows visible.',
          'SUBTOTAL(9, …) adds only those: ' + money(rev) + '.',
          'SUBTOTAL(3, …) counts them — function 3 is COUNTA, which works on the text in the Date column.',
          'SUBTOTAL(1, …) averages them: ' + money(rev / rows.length) + '. Swap any of the three for SUM, COUNTA or AVERAGE and the answer jumps to the whole table.'
        ],
        mistakes: [
          'Using SUM under a filter and reporting ' + money(d.totalRevenue) + ' for a view showing ' + money(rev) + '.',
          'Using function number 2 (COUNT) on a text column and getting zero.'
        ],
        onTheJob: 'A filtered sheet with a plain SUM underneath is the error a reviewer looks for first, because it is so easy to make and so hard to see.'
      }
    };
  });

  question('filter-regions', 'filter', 30, function (d) {
    var pair = [d.regions[0], d.regions[2]];
    var rows = d.rows.filter(function (r) { return pair.indexOf(r.region) >= 0; });
    var rev = rows.reduce(function (a, r) { return a + r.revenue; }, 0);
    var units = rows.reduce(function (a, r) { return a + r.units; }, 0);
    return {
      title: 'Filter on two values at once',
      brief: 'Filter the table to show ' + pair[0] + ' and ' + pair[1] + ' only. Below the table, ' +
        'B19 — the revenue of the visible rows, B20 — their units, B21 — how many rows are visible.',
      hint: 'Open the filter on the Region column, clear everything, then tick the two regions. All three answers are SUBTOTAL: 9 for the sums, 3 for the count.',
      sheet: sheetFor(d, {
        A18: 'Summary', A19: 'Visible revenue', A20: 'Visible units', A21: 'Visible transactions'
      }, { rows: 24, styles: { A18: H }, colWidths: { A: 220 } }),
      table: TABLE,
      target: ['B19', 'B20', 'B21'],
      solution: {
        B19: '=SUBTOTAL(9,$G$2:$G$16)',
        B20: '=SUBTOTAL(9,$E$2:$E$16)',
        B21: '=SUBTOTAL(3,$A$2:$A$16)'
      },
      expect: { filtered: { col: 'B', values: pair } },
      check: over('B19:B21', { mustUse: ['SUBTOTAL'] }),
      explain: {
        idea: 'A filter is a set of allowed values, not a single one. Ticking two boxes is an OR, and ' +
          'SUBTOTAL follows whatever the filter currently shows without being told about it.',
        walk: [
          'Clear the select-all box first, then tick ' + pair[0] + ' and ' + pair[1] + ' — it is much faster than unticking everything else.',
          rows.length + ' rows stay visible, worth ' + money(rev) + ' across ' + money(units) + ' units.',
          'All three answers are SUBTOTAL over the full ranges. The ranges never change; only what the filter shows does.',
          'Change the filter to one region and every one of the three answers updates itself.'
        ],
        mistakes: [
          'Filtering by typing the two names into a formula instead, which answers the question but not the one that was asked.',
          'Deleting the rows you did not want. A filter hides; deleting destroys, and there is no undo once the file is saved.'
        ],
        onTheJob: 'Filter to a segment, read the subtotals, filter to the next: that loop is how most of the analysis in a first week actually gets done.'
      }
    };
  });

  /* ---------------------------------------------------------- pivot tables --- */
  question('pivot-region', 'pivot', 25, function (d) {
    var best = d.regions.map(function (rg) {
      return { name: rg, v: d.sumWhere(function (r) { return r.region === rg; }) };
    }).sort(function (a, b) { return b.v - a.v; })[0];
    return {
      title: 'Pivot: revenue by region',
      mode: 'pivot',
      brief: 'Build a pivot table with Region in ROWS and Sum of Revenue in VALUES.',
      hint: 'Send Region to Rows and Revenue to Values, with the aggregation left on Sum.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Region'], cols: [],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'The fastest possible answer to "revenue by X". Two fields, no formulas, no dollar signs to get wrong.',
        walk: [
          'Region in Rows produces one line per distinct region, read straight out of the data.',
          'Sum of Revenue fills them in. ' + best.name + ' leads on ' + money(best.v) + '.',
          'The grand total must be ' + money(d.totalRevenue) + ' — the same number SUM gives on the raw column. Always check the corner.',
          'On a timed test, a question that says "by region" and does not name a cell is nearly always faster as a pivot than as SUMIFS.'
        ],
        mistakes: [
          'Dropping Revenue into Rows, which produces fifteen lines of individual amounts instead of four totals.',
          'Leaving the aggregation on Count and reporting the number of transactions as revenue.'
        ],
        onTheJob: 'The published brief for this test names pivot tables explicitly. Expect a question of exactly this shape and do not spend two minutes writing SUMIFS for it.'
      }
    };
  });

  question('pivot-cross', 'pivot', 30, function (d) {
    return {
      title: 'Pivot: manager by region',
      mode: 'pivot',
      brief: 'Build a pivot with Manager in ROWS, Region in COLUMNS and Sum of Revenue in VALUES.',
      hint: 'Three areas: what goes down the side, what goes across the top, and what gets added up.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Manager'], cols: ['Region'],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'Rows and columns at once turns a list into a matrix. Which field goes where is a question ' +
          'about what you want to compare, not about the data.',
        walk: [
          'Manager down the side and Region across the top shows who sells where.',
          'An empty intersection means that manager booked nothing in that region — information, not a gap in the data.',
          'The grand total is unchanged at ' + money(d.totalRevenue) + ' however the cube is cut, which is the check.',
          'Swapping the two areas transposes the report. It is the same numbers and a completely different reading.'
        ],
        mistakes: [
          'Putting both fields in Rows, which nests them instead of crossing them.',
          'Reading a blank cell as a zero without checking whether the source simply has no such row.'
        ],
        onTheJob: 'Manager by region by product is a standard sales cube. Being able to re-cut it live in a meeting is worth more than any pre-built slide.'
      }
    };
  });

  question('pivot-filtered', 'pivot', 30, function (d) {
    var product = d.commonest('product');
    var total = d.sumWhere(function (r) { return r.product === product; });
    return {
      title: 'Pivot with a report filter',
      mode: 'pivot',
      brief: 'Build a pivot with Manager in ROWS, Region in COLUMNS, Sum of Revenue in VALUES, and a ' +
        'report filter on Product set to ' + product + ' only.',
      hint: 'Send Product to the Filters area, then tick ' + product + ' alone.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Manager'], cols: ['Region'],
        values: [{ field: 'Revenue', agg: 'sum' }],
        filters: [{ field: 'Product', values: [product] }] } },
      explain: {
        idea: 'All four areas in one report: what goes down, what goes across, what gets added, and what ' +
          'the whole report is scoped to.',
        walk: [
          'The filter removes every other product before anything is aggregated, so every number in the report is ' + product + ' only.',
          'The grand total falls to ' + money(total) + ', which is the answer a SUMIF on the product would also give — two techniques agreeing is a good sign.',
          'Manager by region within one product shows who owns that product where.',
          'Putting Product in Rows instead would give a report about all products, with one extra line, rather than a report scoped to one.'
        ],
        mistakes: [
          'Confusing the Filters area with a filter on the source data. The report filter belongs to the pivot and can be changed without touching the sheet.',
          'Forgetting to untick the other products, so the filter is there but scopes nothing.'
        ],
        onTheJob: 'A report filter is what turns one pivot into a deck of twenty slides: same layout, one dropdown, one page per product.'
      }
    };
  });

  question('pivot-share', 'pivot', 25, function (d) {
    var shares = d.products.map(function (p) {
      return p + ' ' + pct(d.sumWhere(function (r) { return r.product === p; }) / d.totalRevenue);
    });
    return {
      title: 'Pivot: the revenue mix',
      mode: 'pivot',
      brief: 'Build a pivot with Product in ROWS and Revenue in VALUES, shown as a percentage of the ' +
        'grand total rather than as an amount.',
      hint: 'Add Revenue as a Sum, then change "Show values as" to % of grand total.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Product'], cols: [],
        values: [{ field: 'Revenue', agg: 'sum', show: 'pctTotal' }], filters: [] } },
      explain: {
        idea: 'Same aggregation, different presentation. The dropdown does the division for you and ' +
          'guarantees the shares add to exactly 100%.',
        walk: [
          'The mix comes out as ' + shares.join(', ') + '.',
          'The percentages are computed against the grand total, so there is no rounding argument to have.',
          'Doing this with formulas would mean a column of divisions by a pinned total. This is one dropdown.',
          'Switching back to "No calculation" restores the amounts; nothing about the underlying aggregation changed.'
        ],
        mistakes: [
          'Choosing % of row total when there is no column field, which makes every line 100%.',
          'Showing only shares, with no absolute number anywhere on the page, so the reader cannot tell whether the biggest slice is large or trivial.'
        ],
        onTheJob: 'Revenue mix is on the first page of most commercial diagnostics, and it is always shown as a share.'
      }
    };
  });

  question('pivot-calc', 'pivot', 30, function (d) {
    return {
      title: 'Pivot: a metric that is not in the data',
      mode: 'pivot',
      brief: 'Average price per unit is not a column in this table. Build a pivot with Region in ROWS ' +
        'and a CALCULATED FIELD "Revenue / Units" in VALUES.',
      hint: 'Use "Add calculated field" in the Values area and write the formula over the field names exactly as they appear in the header.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Region'], cols: [],
        values: [{ calc: 'Revenue / Units', name: 'Average price' }], filters: [] } },
      explain: {
        idea: 'A calculated field creates a metric the source table does not contain. Here it is a ratio, ' +
          'which is exactly the case where it matters how the pivot computes it.',
        walk: [
          'The pivot totals Revenue and totals Units for each region, and then divides the two totals.',
          'That is the volume-weighted average price — the right answer to "what did a unit sell for here".',
          'It is NOT the average of the per-transaction prices. For a region with one huge cheap order and one tiny expensive one those two numbers differ a lot.',
          'Across the whole book the weighted price is ' + money(d.totalRevenue / d.totalUnits) + ' per unit.'
        ],
        mistakes: [
          'Expecting the field to average the per-row ratios. Calculated fields work on the aggregated totals, which is a genuine gotcha worth remembering.',
          'Misspelling a field name, which silently produces zero rather than an error.'
        ],
        onTheJob: 'Price per unit, cost per order, revenue per head: the metrics clients ask about are nearly always derived ratios, and the weighting question is always the same one.'
      }
    };
  });

  question('pivot-count', 'pivot', 25, function (d) {
    var busiest = d.commonest('manager');
    return {
      title: 'Pivot: how many and how much',
      mode: 'pivot',
      brief: 'Build a pivot with Manager in ROWS and two value fields: the count of transactions and ' +
        'the sum of Revenue.',
      hint: 'Send Revenue to Values twice, and set the first one\'s aggregation to Count and the second\'s to Sum.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Manager'], cols: [],
        values: [{ field: 'Revenue', agg: 'count' }, { field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'Volume and value side by side is the whole point of a pivot. Many small deals and one huge ' +
          'deal produce the same revenue and mean entirely different things.',
        walk: [
          'Manager in Rows gives one line each. The same field can go into Values more than once with a different aggregation.',
          'Count answers "how many transactions"; Sum answers "worth how much".',
          busiest + ' has the most transactions in this book.',
          'The counts must add to 15 and the sums to ' + money(d.totalRevenue) + '. Two grand totals, two checks.'
        ],
        mistakes: [
          'Using Count on a column with blanks in it and wondering why the total is short. Count of a numeric field skips empty cells.',
          'Reading the ranking off the sum alone. The manager with the biggest number may have had one lucky transaction.'
        ],
        onTheJob: 'Deal count against deal value is the first cut of any sales-performance discussion, and the two rankings are rarely the same.'
      }
    };
  });


  var MONTH_NAME = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  question('pivot-quarters', 'pivot', 30, function (d) {
    var q = [1, 2, 3, 4].map(function (n) {
      return { n: n, v: d.sumWhere(function (r) { return r.quarter === n; }) };
    });
    var best = q.slice().sort(function (a, b) { return b.v - a.v; })[0];
    return {
      title: 'Pivot: group the dates into quarters',
      mode: 'pivot',
      brief: 'Build revenue by quarter. Put Date into ROWS, use Group Field to group it by quarters, ' +
        'and put Sum of Revenue into VALUES.',
      hint: 'Dropped in raw, Date gives one line per transaction. Open the field menu, choose Group, and tick Quarters.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: [{ field: 'Date', group: 'quarters' }], cols: [],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'A date column is useless down the side of a report until it is grouped. Group Field is the ' +
          'command that does it, and "grouping" in the published test brief is exactly this.',
        walk: [
          'Ungrouped you get fifteen lines, one per transaction — a list, not a report. That is the signal to group.',
          'Grouped by quarters it collapses to four: ' + q.map(function (x) { return 'Q' + x.n + ' ' + money(x.v); }).join(', ') + '.',
          'The strongest quarter is the ' + ['first', 'second', 'third', 'fourth'][best.n - 1] +
            ', on ' + money(best.v) + ' of the ' + money(d.totalRevenue) + ' booked in the year.',
          'The quarters come out in calendar order because the pivot sorts on the underlying date, not on the text of the label.'
        ],
        mistakes: [
          'Building a helper column of quarter numbers with a formula. It works, and on a timed test it costs you two minutes you did not have.',
          'Leaving the dates ungrouped and reading the first four lines as if they were quarters.'
        ],
        onTheJob: 'Every transaction extract arrives with a date and no period column. Grouping it is the first thing you do.'
      }
    };
  });

  question('pivot-months', 'pivot', 30, function (d) {
    var months = {};
    d.rows.forEach(function (r) { months[r.month] = (months[r.month] || 0) + r.revenue; });
    var keys = Object.keys(months).map(Number).sort(function (a, b) { return a - b; });
    var peak = keys.slice().sort(function (a, b) { return months[b] - months[a]; })[0];
    return {
      title: 'Pivot: the monthly shape of the year',
      mode: 'pivot',
      brief: 'Build revenue by month: Date in ROWS grouped by months, Sum of Revenue in VALUES.',
      hint: 'Group the Date field by Months. The months must come out in calendar order, not alphabetical order.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: [{ field: 'Date', group: 'months' }], cols: [],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'Months are the standard grain for a trend. The pivot groups them from the date column itself, ' +
          'so nothing has to be added to the source data.',
        walk: [
          'The busiest month is ' + MONTH_NAME[peak - 1] + ' on ' + money(months[peak]) + '.',
          'Only the months that actually contain a transaction appear. A month with no sales is simply absent, ' +
            'which is worth saying out loud on a chart rather than leaving the reader to assume it was zero.',
          'The order is Jan, Feb, Mar — calendar order. A month column built as text would have sorted Apr, Aug, Dec, ' +
            'which is the classic way a monthly chart ends up nonsense.',
          'The whole year still adds to ' + money(d.totalRevenue) + ': grouping never changes a total.'
        ],
        mistakes: [
          'Grouping by months on an extract covering several years, which adds each January to every other January.',
          'Sorting the month labels A to Z and producing a chart that starts in April.'
        ],
        onTheJob: 'Monthly revenue is the first chart in nearly every commercial pack, and it comes out of exactly this pivot.'
      }
    };
  });

  question('pivot-sorted', 'pivot', 30, function (d) {
    var ranked = d.regions.map(function (rg) {
      return { name: rg, v: d.sumWhere(function (r) { return r.region === rg; }) };
    }).sort(function (a, b) { return b.v - a.v; });
    return {
      title: 'Pivot: ranked, not alphabetical',
      mode: 'pivot',
      brief: 'Build revenue by region — Region in ROWS, Sum of Revenue in VALUES — and sort it so the largest ' +
        'region is the first line.',
      hint: 'Use the arrow on Row Labels, then More Sort Options, and sort Largest to Smallest by Sum of Revenue. ' +
        'Sort Z to A is a different thing: it sorts the names backwards.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE,
        rows: [{ field: 'Region', sort: { by: 'value', value: 0, asc: false } }], cols: [],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'A pivot sorts its labels alphabetically until told otherwise, and alphabetical order says nothing ' +
          'about the business. Sorting by the value field is what turns a table into a ranking.',
        walk: [
          'The ranking is ' + ranked.map(function (x) { return x.name + ' ' + money(x.v); }).join(', ') + '.',
          ranked[0].name + ' leads on ' + money(ranked[0].v) + ', which is ' +
            pct(ranked[0].v / d.totalRevenue) + ' of the book.',
          'The sort belongs to the field, not to the numbers on screen, so it survives a change of filter or a refresh.',
          'Sorting the source data instead would have achieved nothing: the pivot re-groups the rows whatever order they are in.'
        ],
        mistakes: [
          'Choosing Sort Z to A and getting the alphabet backwards rather than the biggest first.',
          'Sorting by the wrong value field when the report has more than one.'
        ],
        onTheJob: 'Every ranking slide is a pivot sorted by its value field. Doing it in the pivot rather than by hand is what keeps it right after the numbers change.'
      }
    };
  });

  question('pivot-nested', 'pivot', 30, function (d) {
    var top = d.regions.map(function (rg) {
      return { name: rg, v: d.sumWhere(function (r) { return r.region === rg; }) };
    }).sort(function (a, b) { return b.v - a.v; })[0];
    return {
      title: 'Pivot: one field nested inside another',
      mode: 'pivot',
      brief: 'Put Region into ROWS and then Product into ROWS underneath it, with Sum of Revenue in VALUES. ' +
        'The result is a nested list with a subtotal per region, not a grid.',
      hint: 'Both fields go into the Rows area, Region first. The order of the chips decides which is nested inside which.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Region', 'Product'], cols: [],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'Two fields in Rows nest; one field in Rows and one in Columns cross. Same two fields, two different reports, ' +
          'and only one of them is what the question asked for.',
        walk: [
          'Region is the outer field, so each region gets a group with one line per product inside it, and a subtotal.',
          top.name + ' subtotals to ' + money(top.v) + ', and the region subtotals add to ' + money(d.totalRevenue) + '.',
          'In Compact form the subtotal sits on the region line with the products indented underneath; in Tabular form it ' +
            'moves to the foot of each group. The numbers are identical, and either is accepted.',
          'Swap the two chips and the report inverts: products at the top level with regions inside them.'
        ],
        mistakes: [
          'Putting Product in Columns instead, which gives a grid — a perfectly good report, and not this one.',
          'Reading a subtotal line as if it were another product.'
        ],
        onTheJob: 'Nesting is how you walk down a hierarchy — region, then product, then customer — without building three tables.'
      }
    };
  });

  question('pivot-pctrow', 'pivot', 30, function (d) {
    var rg = d.commonest('region');
    var total = d.sumWhere(function (r) { return r.region === rg; });
    var mix = d.products.map(function (p) {
      return p + ' ' + pct(d.sumWhere(function (r) { return r.region === rg && r.product === p; }) / total);
    });
    return {
      title: 'Pivot: the product mix of each region',
      mode: 'pivot',
      brief: 'Region in ROWS, Product in COLUMNS, Revenue in VALUES — and show each number as a percentage of its ' +
        'ROW total, so that every region’s mix adds to 100%.',
      hint: 'Value Field Settings, then "Show values as" → % of row total. With a field in Columns this is a ' +
        'different answer from % of grand total.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Region'], cols: ['Product'],
        values: [{ field: 'Revenue', agg: 'sum', show: 'pctRow' }], filters: [] } },
      explain: {
        idea: '% of grand total, % of row total and % of column total are three different questions asked of the same ' +
          'grid. Row total gives you a mix per row.',
        walk: [
          'Every row now adds to 100%, and the Grand Total column is 100% all the way down by construction.',
          rg + ' splits ' + mix.join(', ') + '.',
          'Switch to % of column total and the question becomes "where does each product sell", with the columns adding to 100% instead.',
          'The absolute amounts are one dropdown away — No calculation brings them straight back.'
        ],
        mistakes: [
          'Choosing % of column total when the sentence you want to write is about a region.',
          'Showing a mix with no size beside it, so the reader cannot tell whether the biggest slice is large or trivial.'
        ],
        onTheJob: 'A mix table is how you show that two regions of the same size are completely different businesses.'
      }
    };
  });

  question('pivot-top', 'pivot', 30, function (d) {
    var ranked = d.managers.map(function (m) {
      return { name: m, v: d.sumWhere(function (r) { return r.manager === m; }) };
    }).sort(function (a, b) { return b.v - a.v; });
    var kept = ranked.slice(0, 2);
    var keptTotal = kept.reduce(function (a, x) { return a + x.v; }, 0);
    return {
      title: 'Pivot: keep only the top two',
      mode: 'pivot',
      brief: 'Build revenue by manager, then apply a Top 2 value filter so that only the two largest managers ' +
        'remain in the report.',
      hint: 'The arrow on Row Labels offers Top 10 — the dialog lets you change the number to 2 and choose which ' +
        'value field to rank by.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE,
        rows: [{ field: 'Manager', filter: { top: { n: 2, value: 0, largest: true } } }], cols: [],
        values: [{ field: 'Revenue', agg: 'sum' }], filters: [] } },
      explain: {
        idea: 'A value filter keeps the N largest items of a field and drops the rest from the report entirely — ' +
          'which means every total moves with it.',
        walk: [
          'The two that survive are ' + kept.map(function (x) { return x.name + ' ' + money(x.v); }).join(' and ') + '.',
          'The grand total falls from ' + money(d.totalRevenue) + ' to ' + money(keptTotal) +
            ', because the filtered-out rows have left the report. That is ' + pct(keptTotal / d.totalRevenue) +
            ' of revenue in two of the ' + d.managers.length + ' managers.',
          'Top N ranks the GROUPS of the field it is applied to, not the individual transactions.',
          'Filtering is not sorting: the survivors still come out in alphabetical order unless you sort as well.'
        ],
        mistakes: [
          'Quoting the filtered grand total as the total of the business.',
          'Expecting Top 2 to give you the two biggest transactions rather than the two biggest managers.'
        ],
        onTheJob: '"Top ten customers" is followed by "and what share is that?" every single time. The filter gives the first number, the unfiltered total the second.'
      }
    };
  });

  question('pivot-maxmin', 'pivot', 25, function (d) {
    var big = d.byRevenue[0], small = d.byRevenue[d.byRevenue.length - 1];
    return {
      title: 'Pivot: the largest and smallest transaction',
      mode: 'pivot',
      brief: 'Region in ROWS, and Revenue in VALUES twice: summarised once as Max and once as Min, so the report ' +
        'shows the biggest and the smallest single transaction in each region.',
      hint: 'Add Revenue to Values twice, then use Value Field Settings on each chip — Max on one, Min on the other.',
      sheet: sheetFor(d, {}),
      table: TABLE,
      target: [],
      solution: {},
      expect: { pivot: { source: TABLE, rows: ['Region'], cols: [],
        values: [{ field: 'Revenue', agg: 'max' }, { field: 'Revenue', agg: 'min' }], filters: [] } },
      explain: {
        idea: 'Sum and Average describe the middle of a group; Max and Min describe its edges. On a short book the ' +
          'edges are usually where the story is.',
        walk: [
          'The largest transaction in the book is ' + money(big.revenue) + ' in ' + big.region +
            '; the smallest is ' + money(small.revenue) + ' in ' + small.region + '.',
          'The Grand Total line carries those two numbers, because it is computed from the raw transactions rather than from the lines above it.',
          'The same field sits in the Values area twice with a different summary each time. That is what the Values area is for.',
          'A wide gap between Max and Min in one region is the sign that its average tells you nothing about a typical order.'
        ],
        mistakes: [
          'Reading Max as the region total.',
          'Adding Revenue twice and forgetting to change the second summary, so the report shows the same column twice.'
        ],
        onTheJob: 'Deal size distribution is the first cut of any pricing question, and it is four dropdowns in one pivot.'
      }
    };
  });

  /* =========================================================================
   * Assembling a paper
   * ====================================================================== */
  // The quotas below are what makes every paper cover the published syllabus:
  // basic and advanced formulas, logic, lookups, text and dates, analysis, and
  // the three things the firm names explicitly — sorting, filtering, pivots.
  var QUOTA = [
    ['basics', 2], ['condagg', 4], ['logic', 2], ['lookup', 3],
    ['textdate', 2], ['analysis', 3], ['sort', 1], ['filter', 1], ['pivot', 2]
  ];

  function buildPaper(n) {
    var data = makeData(n);
    var rnd = seeded(n * 2654435761 + 11);
    var chosen = [];
    QUOTA.forEach(function (q) {
      var pool = BANK.filter(function (t) { return t.group === q[0]; });
      chosen = chosen.concat(someOf(rnd, pool, q[1]));
    });
    chosen = shuffled(rnd, chosen);

    var id = 'M' + (n < 10 ? '0' : '') + n;
    var tasks = chosen.map(function (tpl, i) {
      var task = tpl.make(data);
      task.id = id + '.' + (i + 1);
      task.points = tpl.points;
      task.kind = tpl.id;
      return task;
    });

    return {
      id: id,
      n: n,
      title: 'Mock test ' + n,
      subtitle: data.regions.slice(0, 2).join(' and ') + ' · ' + data.products.join(', ') + ' · ' + data.year,
      generated: true,
      timeLimitSec: 60 * 60,
      passScore: 0.7,
      tasks: tasks
    };
  }

  /* A paper is assembled once and kept, so asking for paper 7 twice gives the
   * same object — the app compares questions by identity when it works out
   * which paper one belongs to. Building all forty-nine takes a few tens of
   * milliseconds, so the curriculum simply asks for them at load. */
  var cache = {};
  function paper(n) {
    if (!cache[n]) cache[n] = buildPaper(n);
    return cache[n];
  }
  function papers(from, to) {
    var out = [];
    for (var n = from; n <= to; n++) out.push(paper(n));
    return out;
  }

  return {
    COUNT: 50,
    QUESTIONS_PER_PAPER: 20,
    bank: BANK,
    makeData: makeData,
    paper: paper,
    papers: papers
  };
});

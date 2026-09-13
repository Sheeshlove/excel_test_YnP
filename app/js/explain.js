/* =============================================================================
 * explain.js — takes a formula apart and explains it in plain English
 * Works on ANY formula, not only the reference answer: it walks the parse tree,
 * evaluates every piece separately and reports what each piece produced.
 * ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module === 'object' && module.exports);
  var XLF = isNode ? require('./formula.js') : root.XLF;
  var mod = factory(XLF);
  if (isNode) module.exports = mod; else root.XLExplain = mod;
})(typeof self !== 'undefined' ? self : this, function (XLF) {
  'use strict';

  /* ------------------------------- what each function does, in one sentence */
  var INFO = {
    SUM: { what: 'adds up every number in what you give it', args: ['number or range', 'more numbers'] },
    AVERAGE: { what: 'adds the numbers up and divides by how many there were', args: ['number or range', 'more numbers'] },
    COUNT: { what: 'counts how many cells hold a number (text and blanks are ignored)', args: ['range'] },
    COUNTA: { what: 'counts how many cells are not empty, text included', args: ['range'] },
    COUNTBLANK: { what: 'counts how many cells are empty', args: ['range'] },
    MIN: { what: 'returns the smallest number', args: ['range'] },
    MAX: { what: 'returns the largest number', args: ['range'] },
    MEDIAN: { what: 'returns the middle value once the numbers are lined up in order', args: ['range'] },
    ROUND: { what: 'rounds to the number of decimals you ask for', args: ['number', 'decimals'] },
    ROUNDUP: { what: 'rounds away from zero — always up in size', args: ['number', 'decimals'] },
    ROUNDDOWN: { what: 'rounds towards zero — always down in size', args: ['number', 'decimals'] },
    ABS: { what: 'drops the minus sign', args: ['number'] },
    POWER: { what: 'raises the first number to the power of the second', args: ['number', 'power'] },
    SQRT: { what: 'square root', args: ['number'] },
    MOD: { what: 'the remainder after division', args: ['number', 'divisor'] },
    SUMPRODUCT: { what: 'multiplies the ranges cell by cell, then adds up all the products', args: ['range 1', 'range 2'] },
    IF: { what: 'checks a condition and returns one thing when it is true, another when it is false', args: ['condition', 'value if true', 'value if false'] },
    IFS: { what: 'checks conditions one by one and returns the value of the first one that is true', args: ['condition', 'value to use'], cycleFrom: 0 },
    IFERROR: { what: 'returns the formula’s result, unless it errored — then it returns your fallback', args: ['formula', 'value if error'] },
    IFNA: { what: 'same as IFERROR but only catches #N/A', args: ['formula', 'value if #N/A'] },
    AND: { what: 'true only when every condition is true', args: ['condition 1', 'condition 2'] },
    OR: { what: 'true when at least one condition is true', args: ['condition 1', 'condition 2'] },
    NOT: { what: 'flips true into false and back', args: ['condition'] },
    SWITCH: { what: 'compares one value against a list of options and returns the match', args: ['value', 'option', 'result'] },
    SUMIF: { what: 'adds up only the rows that meet one condition', args: ['range to test', 'condition', 'range to add'] },
    SUMIFS: { what: 'adds up only the rows that meet every condition', args: ['range to add', 'range to test', 'condition'], cycleFrom: 1 },
    COUNTIF: { what: 'counts the rows that meet one condition', args: ['range to test', 'condition'] },
    COUNTIFS: { what: 'counts the rows that meet every condition', args: ['range to test', 'condition'], cycleFrom: 0 },
    AVERAGEIF: { what: 'averages only the rows that meet one condition', args: ['range to test', 'condition', 'range to average'] },
    AVERAGEIFS: { what: 'averages only the rows that meet every condition', args: ['range to average', 'range to test', 'condition'], cycleFrom: 1 },
    MAXIFS: { what: 'largest value among the rows that meet the conditions', args: ['range', 'range to test', 'condition'], cycleFrom: 1 },
    MINIFS: { what: 'smallest value among the rows that meet the conditions', args: ['range', 'range to test', 'condition'], cycleFrom: 1 },
    SUBTOTAL: { what: 'aggregates visible rows only — rows hidden by a filter are skipped', args: ['function number', 'range'] },
    VLOOKUP: { what: 'finds a key in the first column of a table and returns a value from the column you name', args: ['what to find', 'table', 'column number', 'match mode (0 = exact)'] },
    HLOOKUP: { what: 'the same as VLOOKUP but searches along the first row', args: ['what to find', 'table', 'row number', 'match mode (0 = exact)'] },
    INDEX: { what: 'returns the value sitting at a given row (and column) of a range', args: ['range', 'row number', 'column number'] },
    MATCH: { what: 'reports the position of a value inside a row or column', args: ['what to find', 'where to look', 'match mode (0 = exact)'] },
    XLOOKUP: { what: 'searches one range and returns the matching item from another range', args: ['what to find', 'where to look', 'what to return', 'if not found'] },
    XMATCH: { what: 'position of a value, with a friendlier set of matching modes than MATCH', args: ['what to find', 'where to look', 'match mode'] },
    CHOOSE: { what: 'picks the n-th item from a list you write out', args: ['number', 'option 1', 'option 2'] },
    OFFSET: { what: 'starts from a cell and steps a given number of rows and columns away', args: ['starting cell', 'rows down', 'columns right', 'height', 'width'] },
    INDIRECT: { what: 'turns a piece of text such as "C3" into a real reference', args: ['address as text'] },
    ROWS: { what: 'how many rows a range has', args: ['range'] },
    COLUMNS: { what: 'how many columns a range has', args: ['range'] },
    LEN: { what: 'how many characters the text has', args: ['text'] },
    LEFT: { what: 'takes characters from the left end', args: ['text', 'how many'] },
    RIGHT: { what: 'takes characters from the right end', args: ['text', 'how many'] },
    MID: { what: 'takes characters out of the middle', args: ['text', 'start position', 'how many'] },
    FIND: { what: 'position of one piece of text inside another (case sensitive)', args: ['what to find', 'where to look', 'start from'] },
    SEARCH: { what: 'position of one piece of text inside another (ignores case)', args: ['what to find', 'where to look', 'start from'] },
    SUBSTITUTE: { what: 'replaces every occurrence of a fragment with something else', args: ['text', 'old fragment', 'new fragment'] },
    TRIM: { what: 'removes leading, trailing and doubled-up spaces', args: ['text'] },
    UPPER: { what: 'upper case', args: ['text'] },
    LOWER: { what: 'lower case', args: ['text'] },
    PROPER: { what: 'capitalises the first letter of every word', args: ['text'] },
    CONCAT: { what: 'glues pieces of text together', args: ['text 1', 'text 2'] },
    TEXTJOIN: { what: 'glues text together putting a separator between the pieces', args: ['separator', 'ignore empty', 'text'] },
    TEXT: { what: 'turns a number into text using a display format', args: ['number', 'format'] },
    VALUE: { what: 'turns text that looks like a number into an actual number', args: ['text'] },
    DATE: { what: 'builds a date out of year, month and day', args: ['year', 'month', 'day'] },
    YEAR: { what: 'pulls the year out of a date', args: ['date'] },
    MONTH: { what: 'pulls the month number out of a date', args: ['date'] },
    DAY: { what: 'pulls the day of the month out of a date', args: ['date'] },
    EOMONTH: { what: 'last calendar day of the month, a given number of months away', args: ['date', 'months to shift'] },
    EDATE: { what: 'the same day of the month, a given number of months away', args: ['date', 'months to shift'] },
    DATEDIF: { what: 'distance between two dates in whole years, months or days', args: ['start', 'end', 'unit'] },
    YEARFRAC: { what: 'distance between two dates expressed as a fraction of a year', args: ['start', 'end', 'basis'] },
    WEEKDAY: { what: 'which day of the week a date falls on', args: ['date', 'numbering system'] },
    DAYS: { what: 'how many days between two dates', args: ['end', 'start'] },
    NETWORKDAYS: { what: 'how many working days between two dates', args: ['start', 'end', 'holidays'] },
    NPV: { what: 'discounts the cash flows to today’s money — starting one period ahead', args: ['rate', 'cash flows'] },
    IRR: { what: 'the rate at which the project’s NPV comes out to exactly zero', args: ['cash flows'] },
    PMT: { what: 'the level payment on a loan', args: ['rate per period', 'number of periods', 'amount borrowed'] },
    PV: { what: 'what a future stream of money is worth today', args: ['rate', 'periods', 'payment'] },
    FV: { what: 'what money today grows into', args: ['rate', 'periods', 'payment', 'present value'] },
    NPER: { what: 'how many periods it takes', args: ['rate', 'payment', 'present value'] },
    RATE: { what: 'the interest rate implied by a payment schedule', args: ['periods', 'payment', 'present value'] },
    LARGE: { what: 'the k-th biggest value', args: ['range', 'k'] },
    SMALL: { what: 'the k-th smallest value', args: ['range', 'k'] },
    RANK: { what: 'what place a value takes in the list', args: ['value', 'range', 'order'] },
    'PERCENTILE.INC': { what: 'the value below which a given share of the data sits', args: ['range', 'share'] },
    'STDEV.S': { what: 'how spread out the numbers are (sample)', args: ['range'] },
    ISNUMBER: { what: 'true when the value is a number', args: ['value'] },
    ISBLANK: { what: 'true when the cell is empty', args: ['value'] },
    ISERROR: { what: 'true when the value is an error', args: ['value'] }
  };

  var OPS = {
    '+': 'addition', '-': 'subtraction', '*': 'multiplication', '/': 'division',
    '^': 'raising to a power', '&': 'glueing text together',
    '=': 'equal to', '<>': 'not equal to', '<': 'less than', '>': 'greater than',
    '<=': 'less than or equal to', '>=': 'greater than or equal to'
  };

  /* ------------------------------------------- rebuilding the source text */
  function unparse(node) {
    switch (node.type) {
      case 'num': return String(node.v);
      case 'str': return '"' + node.v + '"';
      case 'bool': return node.v ? 'TRUE' : 'FALSE';
      case 'errlit': return node.v;
      case 'ref': return node.a;
      case 'range': return node.a + ':' + node.b;
      case 'name': return node.v;
      case 'missing': return '';
      case 'paren': return '(' + unparse(node.e) + ')';
      case 'unary': return node.op + unparse(node.e);
      case 'percent': return unparse(node.e) + '%';
      case 'bin': return unparse(node.l) + ' ' + node.op + ' ' + unparse(node.r);
      case 'call': return node.name + '(' + node.args.map(unparse).join(', ') + ')';
    }
    return '?';
  }

  /* --------------------------------------------------- describing a value */
  function fmtNum(n) {
    if (!isFinite(n)) return String(n);
    var r = Math.round(n * 1e6) / 1e6;
    if (Math.abs(r) >= 1000) return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
    return String(r);
  }

  function describe(v) {
    if (v === null || v === undefined || v === '') return 'empty';
    if (XLF.isError(v)) return v.type + ' (an error)';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'number') return fmtNum(v);
    if (Array.isArray(v)) {
      var flat = XLF.flat(v);
      var nums = flat.filter(function (x) { return typeof x === 'number'; });
      var filled = flat.filter(function (x) { return x !== null && x !== undefined && x !== ''; });
      var head = flat.slice(0, 4).map(function (x) {
        if (x === null || x === undefined || x === '') return '(blank)';
        if (typeof x === 'number') return fmtNum(x);
        if (typeof x === 'boolean') return x ? 'TRUE' : 'FALSE';
        return '"' + x + '"';
      }).join(', ');
      var tail = flat.length > 4 ? ', …' : '';
      var summary = flat.length + ' cells [' + head + tail + ']';
      if (nums.length && nums.length === flat.length) {
        var total = nums.reduce(function (a, b) { return a + b; }, 0);
        summary += ' — all numbers, they add up to ' + fmtNum(total);
      } else if (nums.length) {
        summary += ' — ' + nums.length + ' of them numbers';
      } else if (filled.length) {
        summary += ' — text values';
      }
      return summary;
    }
    return '"' + v + '"';
  }

  /* ------------------------------------------ extra narration per function */
  function narrate(name, node, args, result, ctx) {
    function val(i) { return args[i]; }
    function count(arr) { return XLF.flat(arr).length; }
    try {
      if (name === 'SUMIFS' || name === 'COUNTIFS' || name === 'AVERAGEIFS' || name === 'MAXIFS' || name === 'MINIFS') {
        var start = (name === 'COUNTIFS') ? 0 : 1;
        var pairs = [];
        for (var i = start; i + 1 < args.length; i += 2) {
          pairs.push({ grid: XLF.flat(args[i]), test: XLF.makeCriteria(args[i + 1]), text: describeCriteria(args[i + 1]) });
        }
        if (!pairs.length) return null;
        var n = pairs[0].grid.length, hits = 0;
        for (var r = 0; r < n; r++) {
          if (pairs.every(function (p) { return p.test(p.grid[r]); })) hits++;
        }
        return 'Excel walked through all ' + n + ' rows, kept the ' + hits +
          ' row' + (hits === 1 ? '' : 's') + ' where ' +
          pairs.map(function (p) { return p.text; }).join(' AND ') +
          ', and then ' + (name === 'COUNTIFS' ? 'counted them' : 'worked only on those') + '.';
      }
      if (name === 'SUMIF' || name === 'COUNTIF' || name === 'AVERAGEIF') {
        var grid = XLF.flat(args[0]), test = XLF.makeCriteria(args[1]), hit = 0;
        grid.forEach(function (x) { if (test(x)) hit++; });
        return 'Out of ' + grid.length + ' rows, ' + hit + ' matched ' + describeCriteria(args[1]) + '.';
      }
      if (name === 'VLOOKUP') {
        var table = XLF.flat(args[1]);
        return 'It looked for ' + describe(XLF.single(args[0])) + ' down the first column of the table, ' +
          'then stepped ' + (XLF.toNum(XLF.single(args[2])) - 1) + ' column(s) to the right to read the answer.' +
          (args.length < 4 || XLF.toBool(XLF.single(args[3])) !== false
            ? ' Careful: without a final 0 (FALSE) VLOOKUP does an approximate match.'
            : ' The final 0 forces an exact match, which is what you almost always want.');
      }
      if (name === 'MATCH' || name === 'XMATCH') {
        return 'It reports a position, not a value: the answer ' + describe(result) +
          ' means the item sits in place number ' + describe(result) + ' of that range.';
      }
      if (name === 'INDEX') {
        return 'INDEX is the "go and fetch" half: it reads the range and returns whatever sits at the position handed to it.';
      }
      if (name === 'IF') {
        var cond = XLF.toBool(XLF.single(args[0]));
        return 'The condition came out ' + (cond === true ? 'TRUE, so Excel returned the second argument' :
          'FALSE, so Excel returned the third argument') + '.';
      }
      if (name === 'IFERROR') {
        return XLF.isError(XLF.single(args[0]))
          ? 'The inner formula did error, so the fallback value was returned instead.'
          : 'The inner formula worked fine, so IFERROR simply passed its result through.';
      }
      if (name === 'SUBTOTAL') {
        return 'Unlike SUM, SUBTOTAL skips rows hidden by the filter — that is exactly why it exists.';
      }
      if (name === 'NPV') {
        return 'NPV discounts the FIRST value you pass it by one period already. A year-0 investment therefore has to be added outside the function.';
      }
      if (name === 'ROUND' || name === 'ROUNDUP' || name === 'ROUNDDOWN') {
        var d = args.length > 1 ? XLF.toNum(XLF.single(args[1])) : 0;
        return d < 0 ? 'A negative number of decimals rounds to the left of the point: -3 means to the nearest thousand.'
          : 'The second argument is how many digits are kept after the decimal point.';
      }
      if (name === 'SUMPRODUCT') {
        return 'Each comparison inside produces TRUE/FALSE, multiplying turns those into 1/0, and the 0 rows drop out of the sum by themselves.';
      }
    } catch (e) { /* narration is a bonus, never a failure */ }
    return null;
  }

  function describeCriteria(c) {
    var v = XLF.single(c);
    if (typeof v === 'string') {
      var m = /^(<>|>=|<=|>|<|=)\s*(.*)$/.exec(v.trim());
      if (m) {
        var names = { '>': 'is greater than', '<': 'is less than', '>=': 'is at least', '<=': 'is at most', '<>': 'is not', '=': 'equals' };
        return 'the value ' + names[m[1]] + ' ' + m[2];
      }
      if (/[*?]/.test(v)) return 'the text matches the pattern ' + v;
      return 'the value equals "' + v + '"';
    }
    return 'the value equals ' + describe(v);
  }

  /* --------------------------------------------------------------- walking */
  function explain(src, sheet, cell) {
    var text = String(src || '');
    if (text.charAt(0) !== '=') {
      return { ok: false, reason: 'This cell holds a typed-in value, not a formula, so there is nothing to take apart.' };
    }
    var ast;
    try { ast = XLF.parse(text.slice(1)); }
    catch (e) { return { ok: false, reason: 'The formula could not be parsed: ' + e.message }; }

    var ctx = {
      getCell: function (r, c) { return sheet.value(r, c); },
      isHiddenRow: function (r) { return sheet.isHidden ? sheet.isHidden(r) : false; },
      names: sheet.names || {},
      cur: cell || { row: 0, col: 0 }
    };
    function evalNode(n) {
      try { return XLF.evaluate(n, ctx); } catch (e) { return XLF.ERR.value(); }
    }

    var steps = [];
    // Conditional aggregates take the same pair of arguments over and over,
    // so their labels repeat rather than running out.
    function labelFor(info, i) {
      if (i < info.args.length) return info.args[i];
      if (info.cycleFrom !== undefined) {
        var period = info.args.length - info.cycleFrom;
        if (period > 0) return info.args[info.cycleFrom + ((i - info.cycleFrom) % period)];
      }
      return info.args[info.args.length - 1] || ('argument ' + (i + 1));
    }
    function walk(node, depth, label) {
      if (node.type === 'paren') return walk(node.e, depth, label);
      if (node.type === 'call') {
        var fname = XLF.normFn(node.name);
        var info = INFO[fname] || { what: 'is applied to the arguments below', args: [] };
        var args = node.args.map(evalNode);
        var result = evalNode(node);
        steps.push({
          depth: depth, label: label || null, expr: unparse(node), kind: 'call',
          title: fname + ' — ' + info.what,
          value: describe(result),
          note: narrate(fname, node, args, result, ctx)
        });
        node.args.forEach(function (arg, i) {
          if (arg.type === 'missing') return;
          var argLabel = labelFor(info, i);
          if (arg.type === 'call' || (arg.type === 'bin' && hasCall(arg))) {
            walk(arg, depth + 1, argLabel);
          } else {
            steps.push({
              depth: depth + 1, kind: 'arg', label: argLabel,
              expr: unparse(arg), value: describe(evalNode(arg))
            });
          }
        });
        return;
      }
      if (node.type === 'bin') {
        var res = evalNode(node);
        steps.push({
          depth: depth, label: label || null, expr: unparse(node), kind: 'op',
          title: OPS[node.op] ? 'Arithmetic step — ' + OPS[node.op] : 'Operator ' + node.op,
          value: describe(res)
        });
        [node.l, node.r].forEach(function (side) {
          if (side.type === 'call' || side.type === 'bin' || side.type === 'paren') walk(side, depth + 1, null);
          else steps.push({ depth: depth + 1, kind: 'arg', label: null, expr: unparse(side), value: describe(evalNode(side)) });
        });
        return;
      }
      steps.push({ depth: depth, kind: 'arg', label: label || null, expr: unparse(node), value: describe(evalNode(node)) });
    }
    function hasCall(n) {
      if (!n || typeof n !== 'object') return false;
      if (n.type === 'call') return true;
      return ['l', 'r', 'e'].some(function (k) { return n[k] && hasCall(n[k]); });
    }

    walk(ast, 0, null);
    var final = evalNode(ast);
    return {
      ok: true,
      formula: text,
      steps: steps,
      result: describe(final),
      isError: XLF.isError(XLF.single(final))
    };
  }

  return { explain: explain, unparse: unparse, describe: describe, INFO: INFO };
});

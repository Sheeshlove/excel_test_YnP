/* =============================================================================
 * drills.js — the shortcut dojo and the rapid-fire quizzes
 * Shortcuts are given for Excel on macOS, with the Windows equivalent beside.
 * ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.XLDrills = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* Shape: mac, win, what it does, group, why a consultant cares */
  var SHORTCUTS = [
    { mac: '⌘ + ↓', win: 'Ctrl + ↓', action: 'Jump to the last filled cell of the column', cat: 'Navigation', why: 'Find out how many rows the export really has, instead of scrolling.' },
    { mac: '⌘ + ⇧ + ↓', win: 'Ctrl + Shift + ↓', action: 'Select down to the end of the data', cat: 'Navigation', why: 'The standard way to select a column for a formula without touching the mouse.' },
    { mac: '⌘ + ⇧ + →', win: 'Ctrl + Shift + →', action: 'Select right to the end of the data', cat: 'Navigation', why: 'Selects a header row or a whole table in two keystrokes.' },
    { mac: '⌃ + Space', win: 'Ctrl + Space', action: 'Select the entire column', cat: 'Navigation', why: 'Format or delete a whole column at once.' },
    { mac: '⇧ + Space', win: 'Shift + Space', action: 'Select the entire row', cat: 'Navigation', why: 'Insert and delete rows without the mouse.' },
    { mac: '⌃ + A', win: 'Ctrl + A', action: 'Select the current table', cat: 'Navigation', why: 'Once selects the table, twice selects the whole sheet.' },
    { mac: 'fn + ⌃ + ←', win: 'Ctrl + Home', action: 'Go to cell A1', cat: 'Navigation', why: 'Leave every sheet at A1 before saving — the mark of a tidy file.' },
    { mac: '⌃ + Page Down', win: 'Ctrl + Page Down', action: 'Move to the next worksheet', cat: 'Navigation', why: 'In a fifteen-tab model the mouse is pure waste.' },

    { mac: '⌘ + T', win: 'F4', action: 'Toggle absolute / relative reference ($)', cat: 'Formulas', why: 'Puts the dollars in. The most-used key while writing formulas — on a Mac it is ⌘T, not F4.' },
    { mac: '⌘ + D', win: 'Ctrl + D', action: 'Fill down — copy the formula from the cell above', cat: 'Formulas', why: 'Pulls a formula down five thousand rows in one keystroke.' },
    { mac: '⌘ + R', win: 'Ctrl + R', action: 'Fill right', cat: 'Formulas', why: 'Stretches a model across months or years.' },
    { mac: '⌃ + U', win: 'F2', action: 'Edit the cell in place', cat: 'Formulas', why: 'Check a formula and see its ranges highlighted.' },
    { mac: '⌘ + ⇧ + T', win: 'Alt + =', action: 'AutoSum', cat: 'Formulas', why: 'A total under a column in one second.' },
    { mac: '⌃ + `', win: 'Ctrl + `', action: 'Show formulas instead of values', cat: 'Formulas', why: 'First thing to do with somebody else\'s file: every hard-coded number becomes visible.' },
    { mac: '⌘ + =', win: 'F9', action: 'Recalculate the workbook', cat: 'Formulas', why: 'For heavy models switched to manual calculation.' },
    { mac: '⇧ + F3', win: 'Shift + F3', action: 'Insert function (the function wizard)', cat: 'Formulas', why: 'Argument prompts, for when you forget the order inside SUMIFS.' },
    { mac: '⌃ + ⇧ + Return', win: 'Ctrl + Shift + Enter', action: 'Enter an array formula', cat: 'Formulas', why: 'Older versions need this for array calculations.' },

    { mac: '⌘ + 1', win: 'Ctrl + 1', action: 'Open the Format Cells dialog', cat: 'Formatting', why: 'The only way to build a custom number format.' },
    { mac: '⌃ + ⇧ + %', win: 'Ctrl + Shift + %', action: 'Percentage format', cat: 'Formatting', why: 'Shares on a slide are percentages, never 0.1234.' },
    { mac: '⌃ + ⇧ + !', win: 'Ctrl + Shift + !', action: 'Number format with thousands separators', cat: 'Formatting', why: 'Numbers without separators are unreadable on a slide.' },
    { mac: '⌃ + ⇧ + $', win: 'Ctrl + Shift + $', action: 'Currency format', cat: 'Formatting', why: 'One consistent format across the model.' },
    { mac: '⌘ + B', win: 'Ctrl + B', action: 'Bold', cat: 'Formatting', why: 'Marks the total rows.' },
    { mac: '⌘ + ⌥ + 0', win: 'Ctrl + Shift + 7', action: 'Add an outline border', cat: 'Formatting', why: 'Boxes off the assumptions block.' },

    { mac: '⌘ + C', win: 'Ctrl + C', action: 'Copy', cat: 'Editing', why: '' },
    { mac: '⌃ + ⌘ + V', win: 'Ctrl + Alt + V', action: 'Paste special — values, formats, transpose', cat: 'Editing', why: 'Pasting values only is a compulsory step before a file goes to a client.' },
    { mac: '⌘ + Z', win: 'Ctrl + Z', action: 'Undo', cat: 'Editing', why: '' },
    { mac: '⌘ + Y', win: 'Ctrl + Y', action: 'Repeat the last action', cat: 'Editing', why: 'Insert one row, then repeat it nine times.' },
    { mac: '⌃ + ⇧ + =', win: 'Ctrl + Shift + +', action: 'Insert cells, rows or columns', cat: 'Editing', why: '' },
    { mac: '⌘ + −', win: 'Ctrl + −', action: 'Delete cells, rows or columns', cat: 'Editing', why: '' },
    { mac: '⌘ + F', win: 'Ctrl + F', action: 'Find', cat: 'Editing', why: 'Hunt for hard-coded numbers and external links in somebody else\'s model.' },
    { mac: '⌃ + ⌘ + F', win: 'Ctrl + H', action: 'Find and replace', cat: 'Editing', why: 'Bulk clean-up of an export.' },

    { mac: '⌘ + ⇧ + F', win: 'Ctrl + Shift + L', action: 'Turn the autofilter on or off', cat: 'Data', why: 'The first thing you do to any new table.' },
    { mac: '⌥ + ↓', win: 'Alt + ↓', action: 'Open the filter dropdown', cat: 'Data', why: 'Filtering without the mouse.' },
    { mac: '⌘ + ⇧ + O', win: 'Ctrl + G → Special', action: 'Select the cells that carry comments', cat: 'Data', why: 'Quick audit of the notes left in a model.' },
    { mac: '⌃ + ⇧ + [', win: 'Ctrl + [', action: 'Trace the precedents of a formula', cat: 'Audit', why: 'Unpicking someone else\'s model: where did this number come from?' },
    { mac: '⌘ + P', win: 'Ctrl + P', action: 'Print and print preview', cat: 'Other', why: 'Check the table fits on the page.' },
    { mac: '⌘ + S', win: 'Ctrl + S', action: 'Save', cat: 'Other', why: 'Every five minutes. No exceptions.' }
  ];

  /* Rapid fire: which function solves this */
  var FUNCTION_QUIZ = [
    { q: 'Add up revenue for deals from Moscow only', options: ['SUMIF', 'SUM', 'COUNTIF', 'VLOOKUP'], answer: 0, why: 'SUMIF(range to test, criterion, range to add).' },
    { q: 'Add up revenue for Moscow AND won deals only', options: ['SUMIFS', 'SUMIF', 'SUMPRODUCT', 'SUBTOTAL'], answer: 0, why: 'Two or more conditions means SUMIFS — and its range to add comes first.' },
    { q: 'Pull a price out of a reference table by product code', options: ['VLOOKUP', 'SUMIF', 'MATCH', 'CONCAT'], answer: 0, why: 'VLOOKUP(code, table, column number, 0). Never forget the final 0.' },
    { q: 'Return a value when the key sits to the RIGHT of what you need', options: ['INDEX + MATCH', 'VLOOKUP', 'HLOOKUP', 'OFFSET'], answer: 0, why: 'VLOOKUP only looks right of the key. INDEX+MATCH works in any direction.' },
    { q: 'Find which row of a list a value sits in', options: ['MATCH', 'INDEX', 'COUNTIF', 'FIND'], answer: 0, why: 'MATCH returns a position; INDEX returns the value at a position.' },
    { q: 'Count the deals above one million', options: ['COUNTIF', 'COUNT', 'COUNTA', 'SUM'], answer: 0, why: 'COUNTIF(range, ">1000000"). A criterion with an operator goes in quotes.' },
    { q: 'Total only the rows left visible by a filter', options: ['SUBTOTAL', 'SUM', 'SUMIF', 'AGGREGATE'], answer: 0, why: 'SUBTOTAL(9, range). A plain SUM includes the rows the filter is hiding.' },
    { q: 'Strip the double spaces out of an export', options: ['TRIM', 'SUBSTITUTE', 'CLEAN', 'CONCAT'], answer: 0, why: 'TRIM removes leading, trailing and repeated spaces, leaving single ones between words.' },
    { q: 'Turn the text "1 250 USD" into a number', options: ['VALUE + SUBSTITUTE', 'TEXT', 'ROUND', 'LEFT'], answer: 0, why: 'SUBSTITUTE strips the rubbish first, then VALUE makes it a number.' },
    { q: 'Get the month number out of a date', options: ['MONTH', 'TEXT', 'WEEKDAY', 'DATE'], answer: 0, why: 'MONTH(date) returns 1 to 12.' },
    { q: 'Get the last day of the month three months out', options: ['EOMONTH', 'EDATE', 'DATE', 'TODAY'], answer: 0, why: 'EOMONTH(date, 3). EDATE would give the same day number, not the month end.' },
    { q: 'Hide a #DIV/0! and show 0 instead', options: ['IFERROR', 'IF', 'ISERROR', 'IFNA'], answer: 0, why: 'IFERROR(formula, 0) — but understand the error before you hide it.' },
    { q: 'NPV of a project with an investment in year 0', options: ['B0 + NPV(rate, flows 1..n)', 'NPV(rate, all flows)', 'IRR(flows)', 'PV(rate, n, flow)'], answer: 0, why: 'NPV discounts the first value you give it by a full period, so year 0 is added separately.' },
    { q: 'The rate at which NPV comes out to zero', options: ['IRR', 'NPV', 'RATE', 'PMT'], answer: 0, why: 'IRR — the internal rate of return.' },
    { q: 'The monthly payment on a loan', options: ['PMT', 'PV', 'FV', 'NPER'], answer: 0, why: 'PMT(annual rate/12, years*12, amount).' },
    { q: 'Add up price × volume across two columns', options: ['SUMPRODUCT', 'SUM', 'PRODUCT', 'SUMIF'], answer: 0, why: 'SUMPRODUCT(prices, volumes) — one formula instead of a helper column.' },
    { q: 'Take the third largest value in a range', options: ['LARGE', 'MAX', 'RANK', 'PERCENTILE.INC'], answer: 0, why: 'LARGE(range, 3).' },
    { q: 'Round a number of trucks so none is left behind', options: ['ROUNDUP', 'ROUND', 'INT', 'TRUNC'], answer: 0, why: 'ROUNDUP(x, 0). Plain ROUND turns 3.2 into 3 and leaves a load on the dock.' },
    { q: 'Build a key out of two columns for a lookup', options: ['A2 & "|" & B2', 'SUM(A2, B2)', 'CONCAT with no separator', 'TEXT(A2, B2)'], answer: 0, why: 'The separator is essential, otherwise different pairs can produce identical keys.' },
    { q: 'Revenue of deals whose margin beats the average margin', options: ['SUMPRODUCT with a condition', 'SUMIF against the average', 'AVERAGEIF', 'SUM'], answer: 0, why: 'A criterion that is itself a calculation cannot go into SUMIFS — that is SUMPRODUCT territory.' },
    { q: 'Whole years between two dates', options: ['DATEDIF with "y"', 'YEAR(b)-YEAR(a)', 'DAYS/365', 'YEARFRAC'], answer: 0, why: 'YEAR(b)−YEAR(a) is wrong whenever the anniversary has not happened yet this year.' },
    { q: 'Group revenue by region and product in fifteen seconds', options: ['A pivot table', 'Twenty-five SUMIFS', 'Sorting and reading it off', 'A chart'], answer: 0, why: 'Region to Rows, Product to Columns, Revenue to Values. This is exactly what the test means by "pivot tables".' },
    { q: 'In a pivot, which area scopes the WHOLE report', options: ['Filters', 'Rows', 'Columns', 'Values'], answer: 0, why: 'A field in Filters decides which records the pivot may see at all.' },
    { q: 'A pivot shows Count where you expected Sum. Why?', options: ['The column contains text', 'The pivot is broken', 'The filter is on', 'The data is unsorted'], answer: 0, why: 'Excel defaults to Count when the field is not purely numeric — treat it as a data quality warning.' },
    { q: 'Show each region as a share of total revenue in a pivot', options: ['Show values as % of grand total', 'A column of divisions beside it', 'Percentage number format', 'A calculated field'], answer: 0, why: 'One dropdown, and the shares are guaranteed to add to 100%.' },
    { q: 'Gross profit is not a column in the data. In a pivot you', options: ['add a calculated field', 'sort by margin', 'add a report filter', 'change the aggregation'], answer: 0, why: 'A calculated field is a formula over field names, evaluated for every group.' },
    { q: 'Sorting a single column while leaving the rest alone', options: ['destroys the data', 'is the correct way to sort', 'is faster', 'keeps the records intact'], answer: 0, why: 'Rows must move together. Always sort the table, never one selected column.' }
  ];

  /* Excel errors and what they mean */
  var ERROR_QUIZ = [
    { q: '#N/A', options: ['The value being looked up was not found', 'Division by zero', 'Wrong type of argument', 'Reference to a deleted cell'], answer: 0, why: 'Usually a trailing space or a number stored as text rather than a genuinely missing key.' },
    { q: '#DIV/0!', options: ['Division by zero or by an empty cell', 'Value not found', 'Unknown function name', 'Circular reference'], answer: 0, why: 'Wrap it in IFERROR only after you understand why it happened.' },
    { q: '#VALUE!', options: ['Wrong type of argument — text where a number was expected', 'Value not found', 'Lost reference', 'Number too large'], answer: 0, why: 'Classic cause: summing a column where the numbers are stored as text.' },
    { q: '#REF!', options: ['The formula points at a cell that was deleted', 'Typo in a function name', 'Division by zero', 'Too many arguments'], answer: 0, why: 'Appears after rows or columns are deleted — the most dangerous error in somebody else’s model.' },
    { q: '#NAME?', options: ['Typo in a function name, or an unknown name', 'Value not found', 'Wrong data type', 'Numeric error'], answer: 0, why: 'Check the spelling, and check the keyboard language.' },
    { q: '#NUM!', options: ['The calculation has no valid result — square root of a negative, no solution', 'Text instead of a number', 'Deleted reference', 'Value not found'], answer: 0, why: 'Common with IRR when the cash flows never change sign.' }
  ];

  /* ------------------------------------------------- question generator */
  function shuffle(arr, rnd) {
    var a = arr.slice(), i, j, t;
    for (i = a.length - 1; i > 0; i--) {
      j = Math.floor((rnd ? rnd() : Math.random()) * (i + 1));
      t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function shortcutQuestions(count, platform) {
    var key = platform === 'win' ? 'win' : 'mac';
    var pool = shuffle(SHORTCUTS).slice(0, count);
    return pool.map(function (s) {
      var wrong = shuffle(SHORTCUTS.filter(function (x) { return x.action !== s.action; })).slice(0, 3);
      var dir = Math.random() < 0.5 ? 'whatDoes' : 'howTo';
      if (dir === 'whatDoes') {
        var opts = shuffle([s].concat(wrong));
        return {
          kind: 'shortcut', prompt: 'What does this shortcut do?',
          keys: s[key], options: opts.map(function (o) { return o.action; }),
          answer: opts.indexOf(s), why: s.why, item: s
        };
      }
      var opts2 = shuffle([s].concat(wrong));
      return {
        kind: 'shortcut', prompt: 'Which shortcut does this: ' + s.action + '?',
        options: opts2.map(function (o) { return o[key]; }),
        answer: opts2.indexOf(s), why: s.why, item: s
      };
    });
  }

  function quizQuestions(pool, count, label) {
    return shuffle(pool).slice(0, count).map(function (q) {
      var idx = q.options.map(function (o, i) { return i; });
      var order = shuffle(idx);
      return {
        kind: label, prompt: q.q,
        options: order.map(function (i) { return q.options[i]; }),
        answer: order.indexOf(q.answer), why: q.why
      };
    });
  }

  function buildDrill(opts) {
    opts = opts || {};
    var n = opts.count || 12;
    var platform = opts.platform || 'mac';
    var parts = [];
    if (opts.mode === 'shortcuts') parts = shortcutQuestions(n, platform);
    else if (opts.mode === 'functions') parts = quizQuestions(FUNCTION_QUIZ, n, 'function');
    else if (opts.mode === 'errors') parts = quizQuestions(ERROR_QUIZ, n, 'error');
    else {
      parts = shuffle(
        shortcutQuestions(Math.ceil(n / 2), platform)
          .concat(quizQuestions(FUNCTION_QUIZ, Math.ceil(n / 3), 'function'))
          .concat(quizQuestions(ERROR_QUIZ, Math.ceil(n / 6), 'error'))
      ).slice(0, n);
    }
    return parts;
  }

  return {
    SHORTCUTS: SHORTCUTS, FUNCTION_QUIZ: FUNCTION_QUIZ, ERROR_QUIZ: ERROR_QUIZ,
    buildDrill: buildDrill, shuffle: shuffle
  };
});

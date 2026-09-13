/* =============================================================================
 * grader.js — marking the learner's work
 * The right answer is computed from task.solution at run time, so the wording of
 * a task and its answer can never drift apart: correctness is defined by a
 * working formula, not by a stored constant.
 * ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module === 'object' && module.exports);
  var XLF = isNode ? require('./formula.js') : root.XLF;
  var ENG = isNode ? require('./engine.js') : root.XLEngine;
  var PV = isNode ? require('./pivot.js') : root.XLPivot;
  var mod = factory(XLF, ENG, PV);
  if (isNode) module.exports = mod; else root.XLGrader = mod;
})(typeof self !== 'undefined' ? self : this, function (XLF, ENG, PV) {
  'use strict';

  function expandRange(ref) {
    var parts = String(ref).split(':');
    if (parts.length === 1) return [ref];
    var A = XLF.a1ToRC(parts[0]), B = XLF.a1ToRC(parts[1]);
    if (!A || !B) return [ref];
    var out = [];
    for (var r = Math.min(A.row, B.row); r <= Math.max(A.row, B.row); r++)
      for (var c = Math.min(A.col, B.col); c <= Math.max(A.col, B.col); c++)
        out.push(XLF.rcToA1(r, c));
    return out;
  }

  function targetCells(task) {
    var out = [];
    (task.target || []).forEach(function (t) { out = out.concat(expandRange(t)); });
    return out;
  }

  function columnOf(letter) {
    var rc = XLF.a1ToRC(String(letter) + '1');
    return rc ? rc.col : -1;
  }

  function buildSheet(task) {
    var s = new ENG.Sheet({ rows: (task.sheet && task.sheet.rows) || 20, cols: (task.sheet && task.sheet.cols) || 10 });
    s.load(task.sheet || {});
    if (task.table) s.attachTable(task.table);
    // the target cells start empty and editable
    targetCells(task).forEach(function (a1) {
      var rc = XLF.a1ToRC(a1);
      var cell = s.cell(rc.row, rc.col);
      if (cell) cell.locked = false;
      else s.set(rc.row, rc.col, '', { locked: false });
    });
    return s;
  }

  // Applies the reference answer. A formula given for a range is written into
  // its first cell and stretched over the rest, shifting relative references.
  function applySolution(sheet, task) {
    var sol = task.solution || {};
    Object.keys(sol).forEach(function (ref) {
      var cells = expandRange(ref);
      var base = XLF.a1ToRC(cells[0]);
      cells.forEach(function (a1) {
        var rc = XLF.a1ToRC(a1);
        var src = sol[ref];
        if (typeof src === 'string' && src.charAt(0) === '=' && cells.length > 1) {
          src = '=' + XLF.translate(src.slice(1), rc.row - base.row, rc.col - base.col);
        }
        sheet.set(rc.row, rc.col, src, { locked: false });
      });
    });
    return sheet;
  }

  // The reference sheet is the task solved completely: formulas filled in and,
  // where the task asks for it, the table sorted and filtered as well.
  function referenceSheet(task) {
    var sheet = applySolution(buildSheet(task), task);
    var exp = task.expect || {};
    if (exp.sortedBy) sheet.sortBy(columnOf(exp.sortedBy.col), exp.sortedBy.asc);
    if (exp.filtered) sheet.setFilter(columnOf(exp.filtered.col), exp.filtered.values);
    return sheet;
  }

  /* ------------------------------------------------------- comparing values */
  function sameValue(a, b, tol) {
    if (XLF.isError(a) || XLF.isError(b)) {
      return XLF.isError(a) && XLF.isError(b) && a.type === b.type;
    }
    if (typeof b === 'number') {
      if (typeof a !== 'number') return false;
      var t = tol === undefined ? 0.005 : tol;
      var scale = Math.max(1, Math.abs(b));
      return Math.abs(a - b) <= Math.max(t, Math.abs(b) * 1e-9) || Math.abs(a - b) / scale <= 1e-9;
    }
    if (typeof b === 'boolean') return a === b;
    if (b === null || b === '') return a === null || a === '' || a === undefined;
    return String(a).trim().toLowerCase().replace(/\s+/g, ' ') ===
           String(b).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function usedFunctions(raw) {
    if (!raw || raw.charAt(0) !== '=') return [];
    var out = [], re = /([A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё0-9_.]*)\s*\(/g, m;
    var body = raw.replace(/"(?:[^"]|"")*"/g, '""');
    while ((m = re.exec(body))) out.push(XLF.normFn(m[1]));
    return out;
  }
  function hasCellRef(raw) {
    if (!raw) return false;
    var body = raw.replace(/"(?:[^"]|"")*"/g, '""');
    return /\$?[A-Za-z]{1,3}\$?[0-9]{1,7}(?![A-Za-zА-Яа-яЁё0-9_(])/.test(body);
  }

  /* ------------------------------------------------------------- marking */
  // Did the learner sort the table the way the task asked?
  function checkSort(task, sheet) {
    var want = task.expect.sortedBy;
    var col = columnOf(want.col);
    var t = sheet.table;
    if (!t) return { ok: false, reason: 'the table has no filter attached yet' };
    var seq = [];
    for (var r = t.r1 + 1; r <= t.r2; r++) seq.push(sheet.value(r, col));
    for (var i = 1; i < seq.length; i++) {
      var cmp = XLF.cmp(seq[i - 1] === null ? '' : seq[i - 1], seq[i] === null ? '' : seq[i]);
      if (want.asc && cmp > 0) return { ok: false, reason: 'column ' + want.col + ' is not sorted from smallest to largest' };
      if (!want.asc && cmp < 0) return { ok: false, reason: 'column ' + want.col + ' is not sorted from largest to smallest' };
    }
    return { ok: true };
  }

  // Did the learner leave exactly the rows the task asked for visible?
  function checkFilter(task, sheet) {
    var want = task.expect.filtered;
    var col = columnOf(want.col);
    var t = sheet.table;
    if (!t) return { ok: false, reason: 'the table has no filter attached yet' };
    var wrong = 0, visible = 0;
    for (var r = t.r1 + 1; r <= t.r2; r++) {
      var shown = !sheet.isHidden(r);
      var should = want.values.indexOf(sheet.display(r, col)) >= 0;
      if (shown) visible++;
      if (shown !== should) wrong++;
    }
    if (wrong) {
      return { ok: false, reason: wrong + ' row(s) are shown or hidden wrongly — ' +
        'the filter on ' + want.col + ' should leave only: ' + want.values.join(', ') };
    }
    if (!visible) return { ok: false, reason: 'the filter hid every row' };
    return { ok: true };
  }

  // Did the learner lay the pivot out the way the task asked?
  function checkPivot(task, sheet, pivotConfig) {
    if (!pivotConfig || (!pivotConfig.rows.length && !pivotConfig.cols.length && !pivotConfig.values.length)) {
      return { ok: false, reason: 'the pivot is still empty — drop fields into Rows, Columns and Values' };
    }
    var source = task.expect.pivot.source || task.table;
    var expected = PV.build(referenceSheet(task), Object.assign({ source: source }, task.expect.pivot));
    var actual = PV.build(sheet, Object.assign({ source: source }, pivotConfig));
    var res = PV.compare(expected, actual);
    return { ok: res.ok, reason: res.issues.join('; ') };
  }

  function grade(task, userSheet, extra) {
    var ref = referenceSheet(task);
    var cells = targetCells(task);
    var results = [], allOk = true;
    var checks = task.check || {};

    cells.forEach(function (a1) {
      var rc = XLF.a1ToRC(a1);
      var chk = checks[a1] || checks['*'] || {};
      var raw = userSheet.raw(rc.row, rc.col);
      var got = userSheet.value(rc.row, rc.col);
      var want = ref.value(rc.row, rc.col);
      var ok = true, reason = '';

      if (raw === '' || raw === null) { ok = false; reason = 'the cell is empty'; }
      else if (chk.requireFormula !== false && raw.charAt(0) !== '=') {
        ok = false; reason = 'this needs a formula (start with =), not a typed-in number';
      } else if (chk.noHardcode !== false && raw.charAt(0) === '=' && !hasCellRef(raw)) {
        ok = false; reason = 'the formula must refer to cells instead of containing hard-coded numbers';
      } else {
        var used = usedFunctions(raw);
        var must = (chk.mustUse || []).map(XLF.normFn);
        var missing = must.filter(function (f) { return used.indexOf(f) < 0; });
        var anyOf = (chk.mustUseAny || []).map(XLF.normFn);
        var forbidden = (chk.forbid || []).map(XLF.normFn).filter(function (f) { return used.indexOf(f) >= 0; });
        var body = raw.replace(/\s+/g, '').toUpperCase();
        var lack = (chk.mustContain || []).filter(function (frag) { return body.indexOf(String(frag).replace(/\s+/g, '').toUpperCase()) < 0; });
        var banned = (chk.mustNotContain || []).filter(function (frag) { return body.indexOf(String(frag).replace(/\s+/g, '').toUpperCase()) >= 0; });
        if (missing.length) { ok = false; reason = 'this task wants you to use ' + missing.join(', '); }
        else if (lack.length) { ok = false; reason = chk.containHint || ('the formula should contain: ' + lack.join(', ')); }
        else if (banned.length) { ok = false; reason = chk.containHint || ('the formula must not contain: ' + banned.join(', ')); }
        else if (anyOf.length && !anyOf.some(function (f) { return used.indexOf(f) >= 0; })) {
          ok = false; reason = 'use one of these functions: ' + anyOf.join(' / ');
        } else if (forbidden.length) { ok = false; reason = 'you may not use ' + forbidden.join(', ') + ' here'; }
        else if (XLF.isError(got) && !XLF.isError(want)) { ok = false; reason = 'the formula returns the error ' + got.type; }
        else if (!sameValue(got, want, chk.tol)) { ok = false; reason = 'the value does not match the expected answer'; }
      }
      if (!ok) allOk = false;
      results.push({ cell: a1, ok: ok, reason: reason, got: got, want: want, raw: raw });
    });

    // expectations about the sheet itself rather than about a formula
    var exp = task.expect || {};
    if (exp.sortedBy) {
      var sres = checkSort(task, userSheet);
      if (!sres.ok) allOk = false;
      results.push({ cell: 'Sorting', ok: sres.ok, reason: sres.reason || '', raw: '' });
    }
    if (exp.filtered) {
      var fres = checkFilter(task, userSheet);
      if (!fres.ok) allOk = false;
      results.push({ cell: 'Filter', ok: fres.ok, reason: fres.reason || '', raw: '' });
    }
    if (exp.pivot) {
      var pres = checkPivot(task, userSheet, extra && extra.pivot);
      if (!pres.ok) allOk = false;
      results.push({ cell: 'Pivot table', ok: pres.ok, reason: pres.reason || '', raw: '' });
    }

    var okCount = results.filter(function (r) { return r.ok; }).length;
    return {
      passed: allOk,
      cells: results,
      okCount: okCount,
      total: results.length,
      score: results.length ? okCount / results.length : 0
    };
  }

  // Applies the reference answer for the non-formula parts too, so that the
  // "Show me the answer" button can demonstrate sorting, filters and pivots.
  // Used by the "show me the answer" button: solves the sheet in front of the
  // learner, including the sorting and the filter.
  function applyFullSolution(sheet, task) {
    applySolution(sheet, task);
    var exp = task.expect || {};
    if (exp.sortedBy) sheet.sortBy(columnOf(exp.sortedBy.col), exp.sortedBy.asc);
    if (exp.filtered) sheet.setFilter(columnOf(exp.filtered.col), exp.filtered.values);
    return exp.pivot || null;
  }

  return {
    grade: grade, buildSheet: buildSheet, referenceSheet: referenceSheet,
    applySolution: applySolution, applyFullSolution: applyFullSolution,
    expandRange: expandRange, targetCells: targetCells,
    usedFunctions: usedFunctions, sameValue: sameValue, columnOf: columnOf
  };
});

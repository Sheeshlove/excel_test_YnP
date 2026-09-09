/* =============================================================================
 * grader.js — проверка решений задач
 * Эталон считается на лету из task.solution, поэтому ответы не могут разойтись
 * с условием: правильный ответ определяется работающей формулой, а не константой.
 * ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module === 'object' && module.exports);
  var XLF = isNode ? require('./formula.js') : root.XLF;
  var ENG = isNode ? require('./engine.js') : root.XLEngine;
  var mod = factory(XLF, ENG);
  if (isNode) module.exports = mod; else root.XLGrader = mod;
})(typeof self !== 'undefined' ? self : this, function (XLF, ENG) {
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

  function buildSheet(task) {
    var s = new ENG.Sheet({ rows: (task.sheet && task.sheet.rows) || 20, cols: (task.sheet && task.sheet.cols) || 10 });
    s.load(task.sheet || {});
    // целевые ячейки — редактируемые и пустые
    targetCells(task).forEach(function (a1) {
      var rc = XLF.a1ToRC(a1);
      var cell = s.cell(rc.row, rc.col);
      if (cell) cell.locked = false;
      else s.set(rc.row, rc.col, '', { locked: false });
    });
    return s;
  }

  // Применяет эталонное решение; формула для первой ячейки диапазона
  // растягивается на остальные с переносом относительных ссылок.
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

  function referenceSheet(task) {
    return applySolution(buildSheet(task), task);
  }

  /* ------------------------------------------------------- сравнение значений */
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

  /* --------------------------------------------------------------- проверка */
  function grade(task, userSheet) {
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

      if (raw === '' || raw === null) { ok = false; reason = 'ячейка пустая'; }
      else if (chk.requireFormula !== false && raw.charAt(0) !== '=') {
        ok = false; reason = 'нужна формула (начните с «=»), а не готовое число';
      } else if (chk.noHardcode !== false && raw.charAt(0) === '=' && !hasCellRef(raw)) {
        ok = false; reason = 'формула должна ссылаться на ячейки, а не содержать вбитые числа';
      } else {
        var used = usedFunctions(raw);
        var must = (chk.mustUse || []).map(XLF.normFn);
        var missing = must.filter(function (f) { return used.indexOf(f) < 0; });
        var anyOf = (chk.mustUseAny || []).map(XLF.normFn);
        var forbidden = (chk.forbid || []).map(XLF.normFn).filter(function (f) { return used.indexOf(f) >= 0; });
        var body = raw.replace(/\s+/g, '').toUpperCase();
        var lack = (chk.mustContain || []).filter(function (frag) { return body.indexOf(String(frag).replace(/\s+/g, '').toUpperCase()) < 0; });
        var banned = (chk.mustNotContain || []).filter(function (frag) { return body.indexOf(String(frag).replace(/\s+/g, '').toUpperCase()) >= 0; });
        if (missing.length) { ok = false; reason = 'в этой задаче нужна функция ' + missing.join(', '); }
        else if (lack.length) { ok = false; reason = chk.containHint || ('в формуле должно быть: ' + lack.join(', ')); }
        else if (banned.length) { ok = false; reason = chk.containHint || ('в формуле не должно быть: ' + banned.join(', ')); }
        else if (anyOf.length && !anyOf.some(function (f) { return used.indexOf(f) >= 0; })) {
          ok = false; reason = 'используйте одну из функций: ' + anyOf.join(' / ');
        } else if (forbidden.length) { ok = false; reason = 'здесь нельзя использовать ' + forbidden.join(', '); }
        else if (XLF.isError(got) && !XLF.isError(want)) { ok = false; reason = 'формула возвращает ошибку ' + got.type; }
        else if (!sameValue(got, want, chk.tol)) { ok = false; reason = 'значение не совпадает с ожидаемым'; }
      }
      if (!ok) allOk = false;
      results.push({ cell: a1, ok: ok, reason: reason, got: got, want: want, raw: raw });
    });

    var okCount = results.filter(function (r) { return r.ok; }).length;
    return {
      passed: allOk,
      cells: results,
      okCount: okCount,
      total: results.length,
      score: results.length ? okCount / results.length : 0
    };
  }

  return {
    grade: grade, buildSheet: buildSheet, referenceSheet: referenceSheet,
    applySolution: applySolution, expandRange: expandRange, targetCells: targetCells,
    usedFunctions: usedFunctions, sameValue: sameValue
  };
});

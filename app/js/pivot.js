/* =============================================================================
 * pivot.js — pivot table engine
 * Builds a pivot out of a flat range exactly the way Excel does: rows, columns,
 * values with an aggregation, report filters, and calculated fields.
 * ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module === 'object' && module.exports);
  var XLF = isNode ? require('./formula.js') : root.XLF;
  var mod = factory(XLF);
  if (isNode) module.exports = mod; else root.XLPivot = mod;
})(typeof self !== 'undefined' ? self : this, function (XLF) {
  'use strict';

  var AGGS = {
    sum:     { label: 'Sum',     apply: function (a) { return a.reduce(function (x, y) { return x + y; }, 0); } },
    count:   { label: 'Count',   apply: function (a, all) { return all.length; } },
    average: { label: 'Average', apply: function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; } },
    max:     { label: 'Max',     apply: function (a) { return a.length ? Math.max.apply(null, a) : null; } },
    min:     { label: 'Min',     apply: function (a) { return a.length ? Math.min.apply(null, a) : null; } }
  };

  var SHOW = {
    raw: 'No calculation',
    pctTotal: '% of grand total',
    pctRow: '% of row total',
    pctCol: '% of column total'
  };

  var SEP = ' / ';

  /* ------------------------------------------------------------ source data */
  function readSource(sheet, ref) {
    var parts = String(ref).split(':');
    var A = XLF.a1ToRC(parts[0]), B = XLF.a1ToRC(parts[1] || parts[0]);
    if (!A || !B) return { fields: [], rows: [] };
    var r1 = Math.min(A.row, B.row), r2 = Math.max(A.row, B.row);
    var c1 = Math.min(A.col, B.col), c2 = Math.max(A.col, B.col);
    var fields = [], c, r;
    for (c = c1; c <= c2; c++) fields.push(String(sheet.display(r1, c) || XLF.colToLetters(c)));
    var rows = [];
    for (r = r1 + 1; r <= r2; r++) {
      var rec = { __row: r }, empty = true;
      for (c = c1; c <= c2; c++) {
        rec[fields[c - c1]] = { v: sheet.value(r, c), text: sheet.display(r, c) };
        if (sheet.display(r, c) !== '') empty = false;
      }
      if (!empty) rows.push(rec);
    }
    return { fields: fields, rows: rows, r1: r1, c1: c1, r2: r2, c2: c2 };
  }

  function labelOf(rec, field) {
    var cell = rec[field];
    if (!cell) return '';
    return cell.text === '' ? '(blank)' : cell.text;
  }
  function numberOf(rec, field) {
    var cell = rec[field];
    if (!cell) return null;
    return typeof cell.v === 'number' ? cell.v : null;
  }

  /* --------------------------------------------------- calculated fields */
  // A calculated field is a formula written over field names:
  //   "Revenue - Cost"   or   "Revenue * Margin"
  // Field names are replaced with the group's aggregated numbers and the usual
  // formula engine evaluates what is left.
  function evalCalc(formula, groupTotals, fields) {
    var src = String(formula);
    var names = fields.slice().sort(function (a, b) { return b.length - a.length; });
    names.forEach(function (f) {
      var val = groupTotals[f];
      var num = (typeof val === 'number' && isFinite(val)) ? val : 0;
      var safe = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      src = src.replace(new RegExp('(^|[^A-Za-z0-9_])' + safe + '($|[^A-Za-z0-9_])', 'g'),
        function (m, a, b) { return a + '(' + num + ')' + b; });
    });
    try {
      var v = XLF.single(XLF.evaluate(XLF.parse(src), { getCell: function () { return null; }, names: {} }));
      return XLF.isError(v) ? null : v;
    } catch (e) { return null; }
  }

  /* ------------------------------------------------------------ the pivot */
  function build(sheet, config) {
    config = config || {};
    var src = readSource(sheet, config.source);
    var rowFields = (config.rows || []).slice();
    var colFields = (config.cols || []).slice();
    var values = (config.values || []).slice();
    var filters = (config.filters || []).slice();

    var data = src.rows.filter(function (rec) {
      return filters.every(function (f) {
        if (!f.values || !f.values.length) return true;
        return f.values.indexOf(labelOf(rec, f.field)) >= 0;
      });
    });

    function keyOf(rec, fields) {
      return fields.map(function (f) { return labelOf(rec, f); }).join(SEP);
    }
    function distinct(fields) {
      if (!fields.length) return [''];
      var seen = {}, out = [];
      data.forEach(function (rec) {
        var k = keyOf(rec, fields);
        if (!seen[k]) { seen[k] = 1; out.push(k); }
      });
      return out.sort(function (a, b) { return XLF.cmp(a, b); });
    }

    var rowKeys = distinct(rowFields);
    var colKeys = distinct(colFields);

    var buckets = {};
    function push(key, rec) { (buckets[key] = buckets[key] || []).push(rec); }
    data.forEach(function (rec) {
      var rk = keyOf(rec, rowFields), ck = keyOf(rec, colFields);
      push(rk + '|' + ck, rec);
      push(rk + '|__all', rec);
      push('__all|' + ck, rec);
      push('__all|__all', rec);
    });

    function aggregate(recs, spec) {
      if (!recs || !recs.length) return null;
      if (spec.calc) {
        var totals = {};
        src.fields.forEach(function (f) {
          totals[f] = recs.reduce(function (acc, rec) {
            var n = numberOf(rec, f);
            return n === null ? acc : acc + n;
          }, 0);
        });
        return evalCalc(spec.calc, totals, src.fields);
      }
      var nums = [];
      recs.forEach(function (rec) {
        var n = numberOf(rec, spec.field);
        if (n !== null) nums.push(n);
      });
      var agg = AGGS[spec.agg || 'sum'] || AGGS.sum;
      return agg.apply(nums, recs);
    }

    function cellAt(rk, ck, spec) {
      var raw = aggregate(buckets[rk + '|' + ck], spec);
      if (raw === null) return null;
      var show = spec.show || 'raw';
      if (show === 'raw') return raw;
      var base;
      if (show === 'pctTotal') base = aggregate(buckets['__all|__all'], spec);
      else if (show === 'pctRow') base = aggregate(buckets[rk + '|__all'], spec);
      else base = aggregate(buckets['__all|' + ck], spec);
      if (!base) return null;
      return raw / base;
    }

    var body = rowKeys.map(function (rk) {
      var line = [];
      colKeys.forEach(function (ck) {
        values.forEach(function (spec) { line.push(cellAt(rk, ck, spec)); });
      });
      values.forEach(function (spec) { line.push(cellAt(rk, '__all', spec)); });
      return line;
    });
    var grand = [];
    colKeys.forEach(function (ck) {
      values.forEach(function (spec) { grand.push(cellAt('__all', ck, spec)); });
    });
    values.forEach(function (spec) { grand.push(cellAt('__all', '__all', spec)); });

    return {
      fields: src.fields, sourceRows: src.rows.length,
      rowFields: rowFields, colFields: colFields, values: values, filters: filters,
      rowKeys: rowKeys, colKeys: colKeys, body: body, grand: grand, rowCount: data.length
    };
  }

  /* ------------------------------------------------------- comparing pivots */
  function sameList(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (String(a[i]) !== String(b[i])) return false;
    return true;
  }
  function specLabel(spec) {
    if (spec.calc) return 'calculated field "' + spec.calc + '"';
    return (AGGS[spec.agg || 'sum'] || AGGS.sum).label + ' of ' + spec.field +
      (spec.show && spec.show !== 'raw' ? ' shown as ' + SHOW[spec.show] : '');
  }

  // Compares the learner's pivot with the reference one and says what differs
  // in words, instead of returning a bare true/false.
  function compare(expected, actual) {
    var issues = [];
    if (!sameList(expected.rowFields, actual.rowFields)) {
      issues.push('Rows area: expected ' + (expected.rowFields.join(', ') || '(empty)') +
        ', found ' + (actual.rowFields.join(', ') || '(empty)'));
    }
    if (!sameList(expected.colFields, actual.colFields)) {
      issues.push('Columns area: expected ' + (expected.colFields.join(', ') || '(empty)') +
        ', found ' + (actual.colFields.join(', ') || '(empty)'));
    }
    if (expected.values.length !== actual.values.length) {
      issues.push('Values area: expected ' + expected.values.length + ' field(s), found ' + actual.values.length);
    } else {
      expected.values.forEach(function (spec, i) {
        if (specLabel(spec) !== specLabel(actual.values[i])) {
          issues.push('Values area: expected ' + specLabel(spec) + ', found ' + specLabel(actual.values[i]));
        }
      });
    }
    var ef = expected.filters.map(function (f) { return f.field + '=' + (f.values || []).join('/'); }).sort();
    var af = actual.filters.map(function (f) { return f.field + '=' + (f.values || []).join('/'); }).sort();
    if (!sameList(ef, af)) {
      issues.push('Report filter: expected ' + (ef.join('; ') || '(none)') + ', found ' + (af.join('; ') || '(none)'));
    }
    if (!issues.length) {
      var mismatch = 0;
      expected.body.forEach(function (line, r) {
        line.forEach(function (v, c) {
          var got = actual.body[r] && actual.body[r][c];
          var a = (v === null || v === undefined) ? null : Math.round(v * 1e6) / 1e6;
          var b = (got === null || got === undefined) ? null : Math.round(got * 1e6) / 1e6;
          if (a !== b) mismatch++;
        });
      });
      if (mismatch) issues.push(mismatch + ' cell(s) in the pivot body hold a different number');
    }
    return { ok: !issues.length, issues: issues };
  }

  return { build: build, compare: compare, readSource: readSource, AGGS: AGGS, SHOW: SHOW, specLabel: specLabel, SEP: SEP };
});

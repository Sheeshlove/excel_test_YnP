/* =============================================================================
 * pivot.js — pivot table engine
 *
 * Builds a pivot out of a flat range the way Excel does, and means it:
 *
 *   • four areas — Filters, Columns, Rows, Values
 *   • nested row and column fields, with subtotals, in Compact or Tabular form
 *   • Group Field: dates into Years / Quarters / Months / Days, numbers into bins
 *   • sorting each field A→Z, Z→A or by one of the value fields
 *   • field-level filters: a tick list, or Top / Bottom N by a value field
 *   • eleven aggregations, Excel's own list, with Count meaning COUNTA
 *   • "Show values as": % of grand / row / column / parent total, running totals,
 *     rank and index
 *   • calculated fields, evaluated on each group's totals exactly as Excel does
 *   • a Grand Total row and column, each of which can be switched off — and no
 *     Grand Total column at all when there is nothing across the top to total
 *
 * A field entry in `rows` / `cols` is either a plain field name or
 *   { field, group, sort, filter, subtotals }
 * and a value entry is either
 *   { field, agg, show, name, fmt }   or   { calc, name, fmt }
 * so the short forms written by older tasks keep working unchanged.
 * ========================================================================== */
(function (root, factory) {
  var isNode = (typeof module === 'object' && module.exports);
  var XLF = isNode ? require('./formula.js') : root.XLF;
  var mod = factory(XLF);
  if (isNode) module.exports = mod; else root.XLPivot = mod;
})(typeof self !== 'undefined' ? self : this, function (XLF) {
  'use strict';

  var SEP = ' / ';          // joins the labels of nested fields into one caption
  var PATH = '';      // joins path segments into a bucket key
  var AXIS = '';      // joins the row path to the column path
  var BLANK = '(blank)';

  /* =========================================================================
   * Aggregations — Excel's own list, in Excel's order, with Excel's captions
   * ====================================================================== */
  function sum(a) { return a.reduce(function (x, y) { return x + y; }, 0); }
  function mean(a) { return a.length ? sum(a) / a.length : null; }
  function variance(a, sample) {
    if (a.length < (sample ? 2 : 1)) return null;
    var m = mean(a);
    var ss = a.reduce(function (acc, x) { return acc + (x - m) * (x - m); }, 0);
    return ss / (a.length - (sample ? 1 : 0));
  }

  var AGGS = {
    sum:       { label: 'Sum',          apply: function (n) { return n.length ? sum(n) : null; } },
    count:     { label: 'Count',        apply: function (n, texts) { return texts.length; } },
    average:   { label: 'Average',      apply: function (n) { return mean(n); } },
    max:       { label: 'Max',          apply: function (n) { return n.length ? Math.max.apply(null, n) : null; } },
    min:       { label: 'Min',          apply: function (n) { return n.length ? Math.min.apply(null, n) : null; } },
    product:   { label: 'Product',      apply: function (n) { return n.length ? n.reduce(function (x, y) { return x * y; }, 1) : null; } },
    countNums: { label: 'Count Numbers', apply: function (n) { return n.length; } },
    stdDev:    { label: 'StdDev',       apply: function (n) { var v = variance(n, true); return v === null ? null : Math.sqrt(v); } },
    stdDevp:   { label: 'StdDevp',      apply: function (n) { var v = variance(n, false); return v === null ? null : Math.sqrt(v); } },
    varr:      { label: 'Var',          apply: function (n) { return variance(n, true); } },
    varp:      { label: 'Varp',         apply: function (n) { return variance(n, false); } }
  };

  /* Excel's "Show Values As" list, minus the ones that need a base item to be
   * picked. Running totals and ranks take the row fields as their base, which
   * is what the dialog defaults to and what every exam question means by them. */
  var SHOW = {
    raw:          'No calculation',
    pctTotal:     '% of grand total',
    pctRow:       '% of row total',
    pctCol:       '% of column total',
    pctParentRow: '% of parent row total',
    pctParentCol: '% of parent column total',
    runTotal:     'Running total in',
    pctRunTotal:  '% running total in',
    rankDesc:     'Rank largest to smallest',
    rankAsc:      'Rank smallest to largest',
    index:        'Index'
  };
  var PERCENT_SHOWS = { pctTotal: 1, pctRow: 1, pctCol: 1, pctParentRow: 1, pctParentCol: 1, pctRunTotal: 1 };

  /* Number formats offered for a value field, as Excel words them. */
  var FORMATS = {
    general:  { label: 'General',            fmt: null },
    int:      { label: 'Number, 0 decimals', fmt: '#,##0' },
    dec2:     { label: 'Number, 2 decimals', fmt: '#,##0.00' },
    pct0:     { label: 'Percentage, 0 dp',   fmt: '0%' },
    pct1:     { label: 'Percentage, 1 dp',   fmt: '0.0%' },
    money:    { label: 'Currency',           fmt: '#,##0.00' }
  };

  /* =========================================================================
   * Reading the source range
   * ====================================================================== */
  function readSource(sheet, ref) {
    var parts = String(ref || '').split(':');
    var A = XLF.a1ToRC(parts[0]), B = XLF.a1ToRC(parts[1] || parts[0]);
    if (!A || !B) return { fields: [], rows: [], kinds: {} };
    var r1 = Math.min(A.row, B.row), r2 = Math.max(A.row, B.row);
    var c1 = Math.min(A.col, B.col), c2 = Math.max(A.col, B.col);
    var fields = [], c, r;
    for (c = c1; c <= c2; c++) fields.push(String(sheet.display(r1, c) || XLF.colToLetters(c)));

    var rows = [];
    for (r = r1 + 1; r <= r2; r++) {
      var rec = { __row: r }, empty = true;
      for (c = c1; c <= c2; c++) {
        var cell = sheet.cell(r, c);
        rec[fields[c - c1]] = {
          v: sheet.value(r, c),
          text: sheet.display(r, c),
          fmt: cell ? cell.fmt : null
        };
        if (sheet.display(r, c) !== '') empty = false;
      }
      if (!empty) rows.push(rec);
    }

    // What kind of column is each field? The pivot needs this to pick a default
    // aggregation and to decide whether Group Field can offer dates.
    var kinds = {};
    fields.forEach(function (f) {
      var nums = 0, dates = 0, filled = 0;
      rows.forEach(function (rec) {
        var cell = rec[f];
        if (!cell || cell.text === '') return;
        filled++;
        if (typeof cell.v === 'number') {
          nums++;
          if (cell.fmt && /[дгdy]/.test(cell.fmt)) dates++;
        }
      });
      kinds[f] = !filled ? 'empty' : dates === nums && dates > 0 ? 'date'
        : nums === filled ? 'number' : 'text';
    });
    return { fields: fields, rows: rows, kinds: kinds, r1: r1, c1: c1, r2: r2, c2: c2 };
  }

  // Excel's PivotTable dialog guesses the range from the block the cursor is
  // sitting in. With no cursor to go on, take the block that starts at the
  // first filled cell — which on these sheets is the data table.
  function detectRange(sheet, rows, cols) {
    rows = rows || 40; cols = cols || 26;
    var r0 = -1, c0 = -1, r, c;
    for (r = 0; r < rows && r0 < 0; r++) {
      for (c = 0; c < cols; c++) {
        if (String(sheet.display(r, c)) !== '') { r0 = r; c0 = c; break; }
      }
    }
    if (r0 < 0) return null;
    var c1 = c0;
    while (c1 + 1 < cols && String(sheet.display(r0, c1 + 1)) !== '') c1++;
    var r1 = r0;
    for (r = r0 + 1; r < rows; r++) {
      var any = false;
      for (c = c0; c <= c1; c++) { if (String(sheet.display(r, c)) !== '') { any = true; break; } }
      if (!any) break;
      r1 = r;
    }
    if (r1 <= r0) return null;              // a header row with nothing under it
    return XLF.rcToA1(r0, c0) + ':' + XLF.rcToA1(r1, c1);
  }

  /* =========================================================================
   * Group Field
   * ====================================================================== */
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var DATE_GROUPS = ['days', 'months', 'quarters', 'years'];   // innermost → outermost
  var DATE_GROUP_LABEL = { days: 'Days', months: 'Months', quarters: 'Quarters', years: 'Years' };

  function isDateGroup(g) { return typeof g === 'string' && DATE_GROUP_LABEL[g]; }

  // The caption Excel gives a grouped field: a date group becomes a field of its
  // own called Years / Quarters / Months / Days; a numeric group keeps its name.
  function captionOf(field, group) {
    if (isDateGroup(group)) return DATE_GROUP_LABEL[group];
    return field;
  }

  function binLabel(lo, by) {
    var hi = (by === Math.round(by)) ? lo + by - 1 : lo + by;
    var f = function (x) { return String(Math.round(x * 1e6) / 1e6); };
    return f(lo) + '-' + f(hi);
  }

  // Turns one record into { key, label, sort } for one field entry.
  function bucketFor(rec, spec) {
    var cell = rec[spec.field];
    if (!cell || cell.text === '') return { key: BLANK, label: BLANK, sort: null };
    var v = cell.v, g = spec.group;
    if (!g) {
      return { key: cell.text, label: cell.text, sort: (v === null || v === undefined) ? cell.text : v };
    }
    if (isDateGroup(g)) {
      if (typeof v !== 'number') return { key: BLANK, label: BLANK, sort: null };
      var d = XLF.serialToDate(v);
      var y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
      if (g === 'years') return { key: String(y), label: String(y), sort: y };
      if (g === 'quarters') { var q = Math.floor((m - 1) / 3) + 1; return { key: 'Q' + q, label: 'Q' + q, sort: q }; }
      if (g === 'months') return { key: MONTHS[m - 1], label: MONTHS[m - 1], sort: m };
      var lab = day + '-' + MONTHS[m - 1];
      return { key: lab, label: lab, sort: m * 100 + day };
    }
    // numeric bins: { by, start, end }
    if (typeof v !== 'number') return { key: BLANK, label: BLANK, sort: null };
    var by = g.by || 1;
    var start = (typeof g.start === 'number') ? g.start : 0;
    var idx = Math.floor((v - start) / by);
    if (typeof g.end === 'number' && v >= g.end) {
      return { key: '>' + g.end, label: '>' + g.end, sort: Infinity };
    }
    if (v < start) return { key: '<' + start, label: '<' + start, sort: -Infinity };
    var lo = start + idx * by;
    return { key: binLabel(lo, by), label: binLabel(lo, by), sort: lo };
  }

  /* =========================================================================
   * Normalising the configuration
   * ====================================================================== */
  function resolveField(entry) {
    if (typeof entry === 'string') entry = { field: entry };
    entry = entry || {};
    var spec = {
      field: entry.field,
      group: entry.group || null,
      sort: entry.sort || null,
      filter: entry.filter || null,
      subtotals: entry.subtotals !== false
    };
    spec.caption = entry.caption || captionOf(spec.field, spec.group);
    spec.id = spec.field + (spec.group ? '#' + groupId(spec.group) : '');
    return spec;
  }
  function groupId(g) { return isDateGroup(g) ? g : 'bins:' + [g.by, g.start, g.end].join(','); }

  function resolveValue(entry) {
    entry = entry || {};
    if (entry.calc) {
      return { calc: entry.calc, name: entry.name || entry.calc, fmt: entry.fmt || null, show: 'raw' };
    }
    var agg = AGGS[entry.agg] ? entry.agg : 'sum';
    return {
      field: entry.field, agg: agg,
      show: SHOW[entry.show] ? entry.show : 'raw',
      name: entry.name || null,
      fmt: entry.fmt || null
    };
  }

  // The caption Excel writes above a value column.
  function specLabel(spec) {
    if (spec.calc) return spec.name || spec.calc;
    var base = (AGGS[spec.agg] || AGGS.sum).label + ' of ' + spec.field;
    if (spec.name) base = spec.name;
    return spec.show && spec.show !== 'raw' ? base + ' shown as ' + SHOW[spec.show] : base;
  }

  /* =========================================================================
   * Calculated fields
   * A formula written over field names, evaluated on each group's TOTALS —
   * which is exactly, and sometimes inconveniently, what Excel does.
   * ====================================================================== */
  function evalCalc(formula, totals, fields) {
    var src = String(formula);
    var names = fields.slice().sort(function (a, b) { return b.length - a.length; });
    names.forEach(function (f) {
      var val = totals[f];
      var num = (typeof val === 'number' && isFinite(val)) ? val : 0;
      var safe = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      src = src.replace(new RegExp('(^|[^A-Za-z0-9_])' + safe + '($|[^A-Za-z0-9_])', 'gi'),
        function (m, a, b) { return a + '(' + num + ')' + b; });
    });
    try {
      var v = XLF.single(XLF.evaluate(XLF.parse(src), { getCell: function () { return null; }, names: {} }));
      return XLF.isError(v) ? null : v;
    } catch (e) { return null; }
  }

  /* =========================================================================
   * Building one axis (rows or columns)
   * ====================================================================== */
  // Produces the ordered list of lines an axis contributes, each line carrying
  // the path of keys that identifies its bucket.
  function buildAxis(specs, data, opts) {
    var lines = [];
    if (!specs.length) {
      lines.push({ path: [], labels: [], depth: 0, kind: 'grand', caption: 'Grand Total' });
      return { lines: lines, hasGrandLine: true };
    }

    function walk(records, depth, parentPath, parentLabels, out) {
      var spec = specs[depth];
      var groups = [], index = {};
      records.forEach(function (rec) {
        var b = rec.__buckets[opts.axis][depth];
        if (!index[b.key]) {
          index[b.key] = { key: b.key, label: b.label, sort: b.sort, recs: [] };
          groups.push(index[b.key]);
        }
        index[b.key].recs.push(rec);
      });

      // sort the siblings
      var sortSpec = spec.sort || { by: 'label', asc: true };
      if (sortSpec.by === 'value' && opts.valueOf) {
        groups.sort(function (a, b) {
          var av = opts.valueOf(parentPath.concat(a.key), sortSpec.value || 0);
          var bv = opts.valueOf(parentPath.concat(b.key), sortSpec.value || 0);
          if (av === null && bv === null) return XLF.cmp(a.sort, b.sort);
          if (av === null) return 1;
          if (bv === null) return -1;
          return sortSpec.asc === false ? bv - av : av - bv;
        });
      } else {
        groups.sort(function (a, b) {
          var r = XLF.cmp(a.sort === null ? a.label : a.sort, b.sort === null ? b.label : b.sort);
          return sortSpec.asc === false ? -r : r;
        });
      }

      groups.forEach(function (g) {
        var path = parentPath.concat(g.key);
        var labels = parentLabels.concat(g.label);
        var last = depth === specs.length - 1;
        var wantSub = !last && spec.subtotals && opts.subtotals !== false;

        if (last) {
          out.push({ path: path, labels: labels, depth: depth, kind: 'item', caption: g.label });
        } else if (opts.layout === 'tabular') {
          walk(g.recs, depth + 1, path, labels, out);
          if (wantSub) {
            out.push({ path: path, labels: labels, depth: depth, kind: 'subtotal',
              caption: g.label + ' Total' });
          }
        } else {
          // compact: the parent line carries its own subtotal, children below it
          out.push({ path: path, labels: labels, depth: depth,
            kind: wantSub ? 'subtotal' : 'header', caption: g.label });
          walk(g.recs, depth + 1, path, labels, out);
        }
      });
    }

    walk(data, 0, [], [], lines);
    return { lines: lines, hasGrandLine: false };
  }

  /* =========================================================================
   * build
   * ====================================================================== */
  function build(sheet, config) {
    config = config || {};
    var src = readSource(sheet, config.source);
    var rowSpecs = (config.rows || []).map(resolveField);
    var colSpecs = (config.cols || []).map(resolveField);
    var values = (config.values || []).map(resolveValue);
    var filters = (config.filters || []).map(function (f) {
      return { field: f.field, values: f.values ? f.values.slice() : null };
    });
    var layout = config.layout === 'tabular' ? 'tabular' : 'compact';
    var subtotals = config.subtotals !== false;
    var grandRow = config.grandRow !== false;
    var grandCol = config.grandCol !== false;

    /* ---- 1. report filters -------------------------------------------- */
    var data = src.rows.filter(function (rec) {
      return filters.every(function (f) {
        if (!f.values) return true;                     // "(All)"
        var cell = rec[f.field];
        var label = !cell || cell.text === '' ? BLANK : cell.text;
        return f.values.indexOf(label) >= 0;
      });
    });

    /* ---- 2. key every record on both axes ------------------------------ */
    function key(rec) {
      rec.__buckets = {
        rows: rowSpecs.map(function (s) { return bucketFor(rec, s); }),
        cols: colSpecs.map(function (s) { return bucketFor(rec, s); })
      };
    }
    data.forEach(key);

    /* ---- 3. field-level tick-list filters ------------------------------ */
    function passesLabelFilters(rec) {
      var ok = true;
      [['rows', rowSpecs], ['cols', colSpecs]].forEach(function (pair) {
        pair[1].forEach(function (spec, i) {
          if (!ok || !spec.filter || !spec.filter.values) return;
          if (spec.filter.values.indexOf(rec.__buckets[pair[0]][i].key) < 0) ok = false;
        });
      });
      return ok;
    }
    data = data.filter(passesLabelFilters);

    /* ---- 4. buckets ---------------------------------------------------- */
    // Every record lands in one bucket for each (row prefix, column prefix)
    // pair, so a subtotal is as cheap to read as a leaf.
    var buckets;
    function fillBuckets(records) {
      buckets = {};
      records.forEach(function (rec) {
        var rp = rec.__buckets.rows.map(function (b) { return b.key; });
        var cp = rec.__buckets.cols.map(function (b) { return b.key; });
        for (var i = 0; i <= rp.length; i++) {
          for (var j = 0; j <= cp.length; j++) {
            var k = rp.slice(0, i).join(PATH) + AXIS + cp.slice(0, j).join(PATH);
            (buckets[k] = buckets[k] || []).push(rec);
          }
        }
      });
    }
    fillBuckets(data);

    function bucket(rowPath, colPath) {
      return buckets[rowPath.join(PATH) + AXIS + colPath.join(PATH)] || null;
    }

    /* ---- 5. aggregation ------------------------------------------------ */
    function aggregate(recs, spec) {
      if (!recs || !recs.length) return null;
      if (spec.calc) {
        var totals = {};
        src.fields.forEach(function (f) {
          totals[f] = recs.reduce(function (acc, rec) {
            var c = rec[f];
            return (c && typeof c.v === 'number') ? acc + c.v : acc;
          }, 0);
        });
        return evalCalc(spec.calc, totals, src.fields);
      }
      var nums = [], texts = [];
      recs.forEach(function (rec) {
        var c = rec[spec.field];
        if (!c) return;
        if (c.text !== '') texts.push(c.text);           // Count is COUNTA
        if (typeof c.v === 'number') nums.push(c.v);
      });
      return (AGGS[spec.agg] || AGGS.sum).apply(nums, texts);
    }
    function rawAt(rowPath, colPath, spec) { return aggregate(bucket(rowPath, colPath), spec); }

    /* ---- 6. Top N / Bottom N ------------------------------------------- */
    // Excel works these out from the data the other filters left behind, then
    // drops everything else — so the grand total reflects only what survived.
    function applyTopFilters() {
      var changed = false;
      [['rows', rowSpecs], ['cols', colSpecs]].forEach(function (pair) {
        var axis = pair[0], specs = pair[1];
        specs.forEach(function (spec, depth) {
          if (!spec.filter || !spec.filter.top) return;
          var top = spec.filter.top;
          var valSpec = values[top.value || 0];
          if (!valSpec) return;
          var byParent = {};
          data.forEach(function (rec) {
            var p = rec.__buckets[axis].slice(0, depth).map(function (b) { return b.key; }).join(PATH);
            (byParent[p] = byParent[p] || {})[rec.__buckets[axis][depth].key] = 1;
          });
          var keep = {};
          Object.keys(byParent).forEach(function (p) {
            var parentPath = p === '' ? [] : p.split(PATH);
            var scored = Object.keys(byParent[p]).map(function (k) {
              var rp = axis === 'rows' ? parentPath.concat(k) : [];
              var cp = axis === 'cols' ? parentPath.concat(k) : [];
              return { k: k, v: rawAt(rp, cp, valSpec) };
            });
            scored.sort(function (a, b) {
              var av = a.v === null ? -Infinity : a.v, bv = b.v === null ? -Infinity : b.v;
              return top.largest === false ? av - bv : bv - av;
            });
            scored.slice(0, Math.max(1, top.n || 10)).forEach(function (s) { keep[p + PATH + s.k] = 1; });
          });
          var before = data.length;
          data = data.filter(function (rec) {
            var p = rec.__buckets[axis].slice(0, depth).map(function (b) { return b.key; }).join(PATH);
            return keep[p + PATH + rec.__buckets[axis][depth].key];
          });
          if (data.length !== before) changed = true;
        });
      });
      if (changed) fillBuckets(data);
    }
    applyTopFilters();

    /* ---- 7. the two axes ----------------------------------------------- */
    function axisValueOf(axis) {
      return function (path, valueIndex) {
        var spec = values[valueIndex] || values[0];
        if (!spec) return null;
        return axis === 'rows' ? rawAt(path, [], spec) : rawAt([], path, spec);
      };
    }
    var rowAxis = buildAxis(rowSpecs, data, {
      axis: 'rows', layout: layout, subtotals: subtotals, valueOf: axisValueOf('rows')
    });
    var colAxis = buildAxis(colSpecs, data, {
      axis: 'cols', layout: 'tabular', subtotals: subtotals, valueOf: axisValueOf('cols')
    });

    var rowLines = rowAxis.lines.slice();
    if (rowSpecs.length && grandRow) {
      rowLines.push({ path: [], labels: [], depth: 0, kind: 'grand', caption: 'Grand Total' });
    }

    // There is nothing to total across when no field sits in Columns, so Excel
    // shows no Grand Total column there — and neither do we.
    var colLines = colAxis.lines.slice();
    var showGrandCol = colSpecs.length > 0 && grandCol;
    if (showGrandCol) {
      colLines.push({ path: [], labels: [], depth: 0, kind: 'grand', caption: 'Grand Total' });
    }

    /* ---- 8. "Show values as" ------------------------------------------- */
    var itemLineIdx = [];
    rowLines.forEach(function (l, i) { if (l.kind === 'item' || l.kind === 'header') itemLineIdx.push(i); });

    function parentPath(path) { return path.slice(0, Math.max(0, path.length - 1)); }

    function shown(rLine, cLine, spec, rIdx, cIdx) {
      var raw = rawAt(rLine.path, cLine.path, spec);
      var show = spec.show || 'raw';
      if (show === 'raw' || raw === null) return raw;
      var base = null;
      if (show === 'pctTotal') base = rawAt([], [], spec);
      else if (show === 'pctRow') base = rawAt(rLine.path, [], spec);
      else if (show === 'pctCol') base = rawAt([], cLine.path, spec);
      else if (show === 'pctParentRow') base = rawAt(parentPath(rLine.path), cLine.path, spec);
      else if (show === 'pctParentCol') base = rawAt(rLine.path, parentPath(cLine.path), spec);
      else if (show === 'index') {
        var rt = rawAt(rLine.path, [], spec), ct = rawAt([], cLine.path, spec), gt = rawAt([], [], spec);
        if (!rt || !ct || !gt) return null;
        return (raw * gt) / (rt * ct);
      } else if (show === 'runTotal' || show === 'pctRunTotal') {
        var acc = 0, total = 0, hit = null;
        itemLineIdx.forEach(function (i) {
          var v = rawAt(rowLines[i].path, cLine.path, spec);
          if (v !== null) { acc += v; total += v; }
          if (i === rIdx) hit = acc;
        });
        if (hit === null) hit = acc;                       // subtotal and grand lines
        if (show === 'runTotal') return hit;
        return total ? hit / total : null;
      } else if (show === 'rankDesc' || show === 'rankAsc') {
        var mine = raw, rank = 1;
        itemLineIdx.forEach(function (i) {
          if (i === rIdx) return;
          var v = rawAt(rowLines[i].path, cLine.path, spec);
          if (v === null) return;
          if (show === 'rankDesc' ? v > mine : v < mine) rank++;
        });
        return rank;
      }
      if (!base) return null;
      return raw / base;
    }

    /* ---- 9. the body --------------------------------------------------- */
    var body = rowLines.map(function (rLine, rIdx) {
      var line = [];
      colLines.forEach(function (cLine, cIdx) {
        values.forEach(function (spec) { line.push(shown(rLine, cLine, spec, rIdx, cIdx)); });
      });
      return line;
    });

    return {
      fields: src.fields, kinds: src.kinds,
      sourceRows: src.rows.length, rowCount: data.length,
      rowFields: rowSpecs, colFields: colSpecs, values: values, filters: filters,
      layout: layout, subtotals: subtotals, showGrandCol: showGrandCol, showGrandRow: grandRow,
      rowLines: rowLines, colLines: colLines, body: body,
      // what a caller needs to know about which source rows survived
      includedRows: data.map(function (r) { return r.__row; }).sort(function (a, b) { return a - b; })
    };
  }

  /* =========================================================================
   * Formatting a value for display
   * ====================================================================== */
  function defaultFormat(spec) {
    if (spec.fmt) return spec.fmt;
    if (PERCENT_SHOWS[spec.show]) return '0.0%';
    if (spec.show === 'rankDesc' || spec.show === 'rankAsc') return '#,##0';
    if (spec.show === 'index') return '0.00';
    return null;
  }

  function format(v, spec) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'number') return String(v);
    if (!isFinite(v)) return '#DIV/0!';
    var fmt = defaultFormat(spec || {});
    if (fmt) return XLF.formatNumber(v, fmt);
    // "General": thousands separators, and no more decimals than are needed
    var rounded = Math.round(v * 100) / 100;
    if (rounded === Math.round(rounded)) return Math.round(rounded).toLocaleString('en-US');
    return rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  /* =========================================================================
   * Comparing the learner's pivot with the reference one
   *
   * What matters is the report, not the wording: two pivots are the same when
   * they group by the same fields in the same order, cover the same source
   * rows, list the same labels in the same order, and show the same numbers.
   * Count of Deal and Count of Revenue are then the same answer — as they are
   * in Excel — while a transposed or differently sorted pivot is not.
   * ====================================================================== */
  function fieldSig(spec) { return spec.id; }
  function fieldNames(specs) {
    return specs.map(function (s) { return s.caption; }).join(', ');
  }
  // Compact form and Tabular form are the same report drawn two ways, so the
  // signature deliberately ignores where the subtotal lines were placed.
  function lineSig(lines) {
    var items = lines.filter(function (l) { return l.kind === 'item'; })
      .map(function (l) { return l.labels.join(SEP); });
    var subs = lines.filter(function (l) { return l.kind === 'subtotal'; })
      .map(function (l) { return l.labels.join(SEP); }).sort();
    var grand = lines.some(function (l) { return l.kind === 'grand'; }) ? 'G' : '-';
    return items.join('|') + '#' + subs.join('|') + '#' + grand;
  }
  function lineText(lines) {
    return lines.filter(function (l) { return l.kind === 'item' || l.kind === 'subtotal'; })
      .map(function (l) { return l.caption; }).join(', ') || '(nothing)';
  }
  // The numbers a value field shows, read off the lines that carry data rather
  // than the ones a layout happens to add.
  function columnOfValues(p, index) {
    var stride = p.values.length, out = [];
    p.body.forEach(function (line, i) {
      var kind = p.rowLines[i].kind;
      if (kind !== 'item' && kind !== 'grand') return;
      for (var c = index; c < line.length; c += stride) {
        var v = line[c];
        out.push(v === null || v === undefined ? null : Math.round(v * 1e6) / 1e6);
      }
    });
    return out.join(',');
  }

  function compare(expected, actual) {
    var issues = [];

    var eRows = expected.rowFields.map(fieldSig), aRows = actual.rowFields.map(fieldSig);
    if (eRows.join('|') !== aRows.join('|')) {
      issues.push('Rows area: expected ' + (fieldNames(expected.rowFields) || '(empty)') +
        ', found ' + (fieldNames(actual.rowFields) || '(empty)'));
    }
    var eCols = expected.colFields.map(fieldSig), aCols = actual.colFields.map(fieldSig);
    if (eCols.join('|') !== aCols.join('|')) {
      issues.push('Columns area: expected ' + (fieldNames(expected.colFields) || '(empty)') +
        ', found ' + (fieldNames(actual.colFields) || '(empty)'));
    }
    if (issues.length) return { ok: false, issues: issues };

    // the same source rows must reach the report, however they were filtered
    if (expected.includedRows.join(',') !== actual.includedRows.join(',')) {
      issues.push('The report covers ' + actual.rowCount + ' of the ' + actual.sourceRows +
        ' source rows; it should cover ' + expected.rowCount +
        ' — check the filter');
      return { ok: false, issues: issues };
    }

    // the same labels, in the same order: this is where sorting is marked
    if (lineSig(expected.rowLines) !== lineSig(actual.rowLines)) {
      issues.push('The rows read ' + lineText(actual.rowLines) +
        '; they should read ' + lineText(expected.rowLines));
    }
    if (lineSig(expected.colLines) !== lineSig(actual.colLines)) {
      issues.push('The columns read ' + lineText(actual.colLines) +
        '; they should read ' + lineText(expected.colLines));
    }
    if (issues.length) return { ok: false, issues: issues };

    if (expected.values.length !== actual.values.length) {
      issues.push('Values area: expected ' + expected.values.length + ' field(s), found ' + actual.values.length);
      return { ok: false, issues: issues };
    }

    // Value columns are matched on the numbers they produce, in any order, so a
    // correct pivot is never failed over the caption above a column.
    var taken = {};
    expected.values.forEach(function (spec, i) {
      var want = columnOfValues(expected, i), found = -1;
      for (var j = 0; j < actual.values.length; j++) {
        if (taken[j]) continue;
        if (columnOfValues(actual, j) === want) { found = j; break; }
      }
      if (found < 0) issues.push('Values area: nothing in the report shows ' + specLabel(spec));
      else taken[found] = 1;
    });

    return { ok: !issues.length, issues: issues };
  }

  return {
    build: build, compare: compare, readSource: readSource, format: format,
    detectRange: detectRange,
    AGGS: AGGS, SHOW: SHOW, FORMATS: FORMATS,
    DATE_GROUPS: DATE_GROUPS, DATE_GROUP_LABEL: DATE_GROUP_LABEL,
    specLabel: specLabel, resolveField: resolveField, resolveValue: resolveValue,
    groupKey: bucketFor,
    isDateGroup: isDateGroup, BLANK: BLANK
  };
});

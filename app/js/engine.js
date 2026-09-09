/* =============================================================================
 * engine.js — модель книги: ячейки, пересчёт, форматирование
 * ========================================================================== */
(function (root, factory) {
  var XLF = (typeof module === 'object' && module.exports) ? require('./formula.js') : root.XLF;
  var mod = factory(XLF);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.XLEngine = mod;
})(typeof self !== 'undefined' ? self : this, function (XLF) {
  'use strict';

  var MAX_ROWS = 200, MAX_COLS = 26;

  function key(r, c) { return r + ':' + c; }

  function Sheet(opts) {
    opts = opts || {};
    this.rows = opts.rows || 30;
    this.cols = opts.cols || 10;
    this.cells = {};            // "r:c" -> cell
    this.colWidths = {};
    this.names = {};            // именованные диапазоны/константы
    this._cacheVal = {};
    this._stack = {};
    this._dirty = true;
  }

  Sheet.prototype.cell = function (r, c) { return this.cells[key(r, c)] || null; };

  Sheet.prototype.raw = function (r, c) {
    var cell = this.cell(r, c);
    return cell ? cell.raw : '';
  };

  Sheet.prototype.isFormula = function (r, c) {
    var cell = this.cell(r, c);
    return !!(cell && cell.kind === 'formula');
  };

  Sheet.prototype.isLocked = function (r, c) {
    var cell = this.cell(r, c);
    return !!(cell && cell.locked);
  };

  /* --------------------------------------------------------- разбор ввода */
  function parseInput(raw) {
    if (raw === null || raw === undefined) return { kind: 'empty', raw: '', value: null };
    var s = String(raw);
    if (s === '') return { kind: 'empty', raw: '', value: null };
    if (s.charAt(0) === '=') return { kind: 'formula', raw: s, src: s.slice(1) };

    var t = s.trim();
    // булево
    var up = t.toUpperCase();
    if (up === 'ИСТИНА' || up === 'TRUE') return { kind: 'bool', raw: s, value: true };
    if (up === 'ЛОЖЬ' || up === 'FALSE') return { kind: 'bool', raw: s, value: false };
    // процент
    var pm = /^-?[\d\s]*[.,]?\d+\s*%$/.exec(t);
    if (pm) {
      var pv = parseFloat(t.replace(/\s/g, '').replace('%', '').replace(',', '.'));
      return { kind: 'number', raw: s, value: pv / 100, fmt: '0.0%' };
    }
    // дата дд.мм.гггг
    var dm = /^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/.exec(t);
    if (dm) {
      return {
        kind: 'number', raw: s, fmt: 'дд.мм.гггг',
        value: XLF.ymdToSerial(+dm[3], +dm[2], +dm[1])
      };
    }
    // число (с пробелами-разделителями тысяч и запятой)
    var cleaned = t.replace(/\s| /g, '').replace(',', '.');
    if (/^-?\d*\.?\d+([eE][+-]?\d+)?$/.test(cleaned)) {
      return { kind: 'number', raw: s, value: parseFloat(cleaned) };
    }
    return { kind: 'text', raw: s, value: s };
  }

  Sheet.prototype.set = function (r, c, raw, meta) {
    if (r < 0 || c < 0 || r >= MAX_ROWS || c >= MAX_COLS) return;
    var parsed = parseInput(raw);
    var prev = this.cell(r, c);
    var cell = {
      raw: parsed.raw, kind: parsed.kind, value: parsed.value,
      src: parsed.src || null,
      fmt: (meta && meta.fmt) || parsed.fmt || (prev && prev.userFmt) || null,
      userFmt: (meta && meta.fmt) ? meta.fmt : (prev ? prev.userFmt : null),
      style: (meta && meta.style) || (prev ? prev.style : null),
      locked: meta && meta.locked !== undefined ? meta.locked : (prev ? prev.locked : false)
    };
    if (parsed.kind === 'empty' && !cell.style && !cell.locked) delete this.cells[key(r, c)];
    else this.cells[key(r, c)] = cell;
    this.invalidate();
    return cell;
  };

  Sheet.prototype.setStyle = function (r, c, style) {
    var cell = this.cells[key(r, c)];
    if (!cell) cell = this.cells[key(r, c)] = { raw: '', kind: 'empty', value: null };
    cell.style = Object.assign({}, cell.style || {}, style);
  };

  Sheet.prototype.clear = function (r, c) {
    var cell = this.cell(r, c);
    if (!cell) return;
    if (cell.locked) return;
    delete this.cells[key(r, c)];
    this.invalidate();
  };

  Sheet.prototype.invalidate = function () { this._cacheVal = {}; this._dirty = true; };

  /* -------------------------------------------------------------- пересчёт */
  Sheet.prototype.value = function (r, c) {
    var k = key(r, c);
    if (Object.prototype.hasOwnProperty.call(this._cacheVal, k)) return this._cacheVal[k];
    var cell = this.cells[k];
    if (!cell) return null;
    if (cell.kind !== 'formula') {
      this._cacheVal[k] = cell.value === undefined ? null : cell.value;
      return this._cacheVal[k];
    }
    if (this._stack[k]) return new XLF.XLError('#ЦИКЛ!');
    this._stack[k] = true;
    var out;
    try {
      var ast = XLF.compile(cell.src);
      var self = this;
      out = XLF.single(XLF.evaluate(ast, {
        getCell: function (rr, cc) { return self.value(rr, cc); },
        names: this.names,
        cur: { row: r, col: c }
      }));
      if (out === undefined) out = null;
    } catch (e) {
      out = new XLF.XLError(e instanceof SyntaxError ? '#СИНТАКСИС!' : '#VALUE!');
      out.message = e.message;
    }
    delete this._stack[k];
    this._cacheVal[k] = out;
    return out;
  };

  /* ---------------------------------------------------------- отображение */
  function fmtNumber(v, fmt) {
    if (fmt) return XLF.formatNumber(v, fmt);
    if (Math.abs(v) >= 1e11 || (v !== 0 && Math.abs(v) < 1e-9)) return v.toExponential(4).replace('e', 'E');
    var r = Math.round(v * 1e9) / 1e9;
    var s = String(r);
    if (s.indexOf('.') >= 0 && s.split('.')[1].length > 6) s = r.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    return s.replace('.', ',');
  }

  Sheet.prototype.display = function (r, c) {
    var cell = this.cell(r, c);
    if (!cell) return '';
    var v = this.value(r, c);
    if (v === null || v === undefined) return '';
    if (XLF.isError(v)) return v.type;
    if (typeof v === 'boolean') return v ? 'ИСТИНА' : 'ЛОЖЬ';
    if (typeof v === 'number') {
      var f = cell.fmt;
      if (f && /[дгdy]/.test(f)) return XLF.formatDate(v, f);
      return fmtNumber(v, f);
    }
    return String(v);
  };

  Sheet.prototype.alignOf = function (r, c) {
    var v = this.value(r, c);
    if (v === null || v === undefined || v === '') return 'left';
    if (typeof v === 'number') return 'right';
    if (typeof v === 'boolean' || XLF.isError(v)) return 'center';
    return 'left';
  };

  /* ------------------------------------------------------------- утилиты */
  Sheet.prototype.load = function (spec) {
    // spec: { cells: {A1: значение|{v,fmt,style,locked}}, cols: {A:120}, rows: n, cols_n: n }
    var self = this;
    if (spec.rows) this.rows = spec.rows;
    if (spec.colCount) this.cols = spec.colCount;
    if (spec.colWidths) this.colWidths = Object.assign({}, spec.colWidths);
    Object.keys(spec.cells || {}).forEach(function (a1) {
      var rc = XLF.a1ToRC(a1);
      if (!rc) return;
      var d = spec.cells[a1];
      if (d !== null && typeof d === 'object' && !Array.isArray(d)) {
        self.set(rc.row, rc.col, d.v, { fmt: d.fmt, style: d.style, locked: d.locked !== false });
      } else {
        self.set(rc.row, rc.col, d, { locked: true });
      }
    });
    // форматы и стили, заданные диапазонами
    function eachIn(ref, fn) {
      var parts = String(ref).split(':');
      var A = XLF.a1ToRC(parts[0]), B = XLF.a1ToRC(parts[1] || parts[0]);
      if (!A || !B) return;
      for (var r = Math.min(A.row, B.row); r <= Math.max(A.row, B.row); r++)
        for (var c = Math.min(A.col, B.col); c <= Math.max(A.col, B.col); c++) fn(r, c);
    }
    Object.keys(spec.formats || {}).forEach(function (ref) {
      eachIn(ref, function (r, c) {
        var cell = self.cells[key(r, c)];
        if (!cell) cell = self.cells[key(r, c)] = { raw: '', kind: 'empty', value: null };
        cell.fmt = spec.formats[ref];
        cell.userFmt = spec.formats[ref];
      });
    });
    Object.keys(spec.styles || {}).forEach(function (ref) {
      eachIn(ref, function (r, c) { self.setStyle(r, c, spec.styles[ref]); });
    });
    if (spec.names) this.names = Object.assign({}, spec.names);
    return this;
  };

  Sheet.prototype.toJSON = function () {
    var out = {};
    for (var k in this.cells) {
      var p = k.split(':');
      out[XLF.rcToA1(+p[0], +p[1])] = this.cells[k].raw;
    }
    return out;
  };

  Sheet.prototype.usedRange = function () {
    var maxR = 0, maxC = 0;
    for (var k in this.cells) {
      var p = k.split(':');
      maxR = Math.max(maxR, +p[0]); maxC = Math.max(maxC, +p[1]);
    }
    return { rows: maxR + 1, cols: maxC + 1 };
  };

  // Значение по адресу A1 (для проверок)
  Sheet.prototype.get = function (a1) {
    var rc = XLF.a1ToRC(a1);
    if (!rc) return null;
    return this.value(rc.row, rc.col);
  };
  Sheet.prototype.rawAt = function (a1) {
    var rc = XLF.a1ToRC(a1);
    if (!rc) return '';
    return this.raw(rc.row, rc.col);
  };
  Sheet.prototype.setAt = function (a1, raw, meta) {
    var rc = XLF.a1ToRC(a1);
    if (!rc) return;
    return this.set(rc.row, rc.col, raw, meta);
  };

  return { Sheet: Sheet, parseInput: parseInput, MAX_ROWS: MAX_ROWS, MAX_COLS: MAX_COLS };
});

/* =============================================================================
 * formula.js — движок формул Excel (токенайзер, парсер, интерпретатор)
 * Без зависимостей. Работает и в браузере (window.XLF), и в Node (module.exports).
 *
 * Поддерживает:
 *   - ссылки A1, $A$1, диапазоны A1:B10
 *   - операторы + - * / ^ % & = <> < > <= >=  (приоритеты как в Excel)
 *   - разделители аргументов , и ;  (русская и английская локаль)
 *   - русские имена функций (СУММ, ЕСЛИ, ВПР, ...)
 *   - ~110 функций: математика, логика, условные агрегаты, поиск, текст,
 *     даты, финансы, информационные
 * ========================================================================== */
(function (root, factory) {
  var mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.XLF = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ ошибки */
  var ERRORS = ['#NULL!', '#DIV/0!', '#VALUE!', '#REF!', '#NAME?', '#NUM!', '#N/A'];

  function XLError(type) { this.type = type; }
  XLError.prototype.toString = function () { return this.type; };
  XLError.prototype.isError = true;

  var ERR = {
    div0: function () { return new XLError('#DIV/0!'); },
    value: function () { return new XLError('#VALUE!'); },
    ref: function () { return new XLError('#REF!'); },
    name: function () { return new XLError('#NAME?'); },
    num: function () { return new XLError('#NUM!'); },
    na: function () { return new XLError('#N/A'); },
    nul: function () { return new XLError('#NULL!'); },
    cycle: function () { var e = new XLError('#ЦИКЛ!'); return e; }
  };
  function isErr(v) { return v instanceof XLError; }

  /* ------------------------------------------------------- ссылки на ячейки */
  function colToLetters(col) { // 0 -> A
    var s = '', n = col;
    do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
    return s;
  }
  function lettersToCol(letters) { // A -> 0
    var n = 0;
    for (var i = 0; i < letters.length; i++) n = n * 26 + (letters.toUpperCase().charCodeAt(i) - 64);
    return n - 1;
  }
  function a1ToRC(a1) {
    var m = /^\$?([A-Za-z]{1,3})\$?([0-9]{1,7})$/.exec(a1);
    if (!m) return null;
    return { row: parseInt(m[2], 10) - 1, col: lettersToCol(m[1]) };
  }
  function rcToA1(row, col, absRow, absCol) {
    return (absCol ? '$' : '') + colToLetters(col) + (absRow ? '$' : '') + (row + 1);
  }

  /* ------------------------------------------------------------- токенайзер */
  var T = {
    NUM: 'num', STR: 'str', BOOL: 'bool', REF: 'ref', NAME: 'name', OP: 'op',
    SEP: 'sep', LP: 'lp', RP: 'rp', ERR: 'err', EOF: 'eof'
  };

  // Локаль: в русском Excel разделитель аргументов ';', а десятичный — ','.
  // Правило: если в формуле есть ';', она русская — тогда "1,5" это число.
  // Иначе английская — но запятая вне вызова функции всё равно десятичная.
  function tokenize(src) {
    var toks = [], i = 0, n = src.length, depth = 0;
    var ruMode = src.indexOf(';') >= 0;
    function commaIsDecimal(pos) {
      if (!/[0-9]/.test(src[pos - 1] || '') || !/[0-9]/.test(src[pos + 1] || '')) return false;
      return ruMode || depth === 0;
    }
    while (i < n) {
      var c = src[i];
      if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
      // строка
      if (c === '"') {
        var j = i + 1, buf = '';
        while (j < n) {
          if (src[j] === '"') {
            if (src[j + 1] === '"') { buf += '"'; j += 2; continue; }
            break;
          }
          buf += src[j]; j++;
        }
        if (j >= n) throw new SyntaxError('Незакрытая кавычка');
        toks.push({ t: T.STR, v: buf }); i = j + 1; continue;
      }
      // ошибка-литерал
      if (c === '#') {
        var found = null;
        for (var e = 0; e < ERRORS.length; e++) {
          if (src.substr(i, ERRORS[e].length).toUpperCase() === ERRORS[e]) { found = ERRORS[e]; break; }
        }
        if (found) { toks.push({ t: T.ERR, v: found }); i += found.length; continue; }
        throw new SyntaxError('Неизвестный символ #');
      }
      // число
      if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
        var m = /^[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?/.exec(src.slice(i));
        var lit = m[0], adv = m[0].length;
        // десятичная запятая: 1,5
        if (lit.indexOf('.') < 0 && src[i + adv] === ',' && commaIsDecimal(i + adv)) {
          var frac = /^[0-9]+([eE][+-]?[0-9]+)?/.exec(src.slice(i + adv + 1));
          if (frac) { lit = lit + '.' + frac[0]; adv += 1 + frac[0].length; }
        }
        toks.push({ t: T.NUM, v: parseFloat(lit) }); i += adv; continue;
      }
      // ссылка / имя / булево
      if (/[A-Za-zА-Яа-яЁё_$]/.test(c)) {
        var rest = src.slice(i);
        var rng = /^(\$?[A-Za-z]{1,3}\$?[0-9]{1,7})\s*:\s*(\$?[A-Za-z]{1,3}\$?[0-9]{1,7})(?![A-Za-zА-Яа-яЁё0-9_.])/.exec(rest);
        if (rng) {
          toks.push({ t: T.REF, v: { kind: 'range', a: rng[1], b: rng[2] } });
          i += rng[0].length; continue;
        }
        var cell = /^(\$?[A-Za-z]{1,3}\$?[0-9]{1,7})(?![A-Za-zА-Яа-яЁё0-9_.])/.exec(rest);
        if (cell) {
          toks.push({ t: T.REF, v: { kind: 'cell', a: cell[1] } });
          i += cell[0].length; continue;
        }
        var nm = /^[A-Za-zА-Яа-яЁё_][A-Za-zА-Яа-яЁё0-9_.]*/.exec(rest);
        if (nm) {
          var up = nm[0].toUpperCase();
          if (up === 'TRUE' || up === 'ИСТИНА') toks.push({ t: T.BOOL, v: true });
          else if (up === 'FALSE' || up === 'ЛОЖЬ') toks.push({ t: T.BOOL, v: false });
          else toks.push({ t: T.NAME, v: nm[0] });
          i += nm[0].length; continue;
        }
        throw new SyntaxError('Не разобрать: ' + rest.slice(0, 10));
      }
      // операторы
      var two = src.substr(i, 2);
      if (two === '<=' || two === '>=' || two === '<>') { toks.push({ t: T.OP, v: two }); i += 2; continue; }
      if ('+-*/^&=<>'.indexOf(c) >= 0) { toks.push({ t: T.OP, v: c }); i++; continue; }
      if (c === '%') { toks.push({ t: T.OP, v: '%' }); i++; continue; }
      if (c === '(') { depth++; toks.push({ t: T.LP }); i++; continue; }
      if (c === ')') { depth--; toks.push({ t: T.RP }); i++; continue; }
      if (c === ',' || c === ';') { toks.push({ t: T.SEP }); i++; continue; }
      if (c === ':') { toks.push({ t: T.OP, v: ':' }); i++; continue; }
      throw new SyntaxError('Неизвестный символ: ' + c);
    }
    toks.push({ t: T.EOF });
    return toks;
  }

  /* ----------------------------------------------------------------- парсер */
  // Приоритеты (снизу вверх): сравнение < & < +- < */ < ^ < unary- < %
  function parse(src) {
    var toks = tokenize(src), p = 0;
    function peek() { return toks[p]; }
    function next() { return toks[p++]; }
    function expect(t, msg) {
      if (toks[p].t !== t) throw new SyntaxError(msg || 'Ошибка синтаксиса');
      return toks[p++];
    }

    function parseExpr() { return parseComparison(); }

    function parseComparison() {
      var left = parseConcat();
      while (peek().t === T.OP && ['=', '<>', '<', '>', '<=', '>='].indexOf(peek().v) >= 0) {
        var op = next().v;
        left = { type: 'bin', op: op, l: left, r: parseConcat() };
      }
      return left;
    }
    function parseConcat() {
      var left = parseAdditive();
      while (peek().t === T.OP && peek().v === '&') {
        next();
        left = { type: 'bin', op: '&', l: left, r: parseAdditive() };
      }
      return left;
    }
    function parseAdditive() {
      var left = parseMultiplicative();
      while (peek().t === T.OP && (peek().v === '+' || peek().v === '-')) {
        var op = next().v;
        left = { type: 'bin', op: op, l: left, r: parseMultiplicative() };
      }
      return left;
    }
    function parseMultiplicative() {
      var left = parsePower();
      while (peek().t === T.OP && (peek().v === '*' || peek().v === '/')) {
        var op = next().v;
        left = { type: 'bin', op: op, l: left, r: parsePower() };
      }
      return left;
    }
    function parsePower() {
      var left = parseUnary();
      if (peek().t === T.OP && peek().v === '^') {
        next();
        return { type: 'bin', op: '^', l: left, r: parsePower() };
      }
      return left;
    }
    function parseUnary() {
      if (peek().t === T.OP && (peek().v === '-' || peek().v === '+')) {
        var op = next().v;
        return { type: 'unary', op: op, e: parseUnary() };
      }
      return parsePostfix();
    }
    function parsePostfix() {
      var e = parsePrimary();
      while (peek().t === T.OP && peek().v === '%') { next(); e = { type: 'percent', e: e }; }
      return e;
    }
    function parsePrimary() {
      var tk = peek();
      if (tk.t === T.NUM) { next(); return { type: 'num', v: tk.v }; }
      if (tk.t === T.STR) { next(); return { type: 'str', v: tk.v }; }
      if (tk.t === T.BOOL) { next(); return { type: 'bool', v: tk.v }; }
      if (tk.t === T.ERR) { next(); return { type: 'errlit', v: tk.v }; }
      if (tk.t === T.REF) {
        next();
        if (tk.v.kind === 'cell') return { type: 'ref', a: tk.v.a };
        return { type: 'range', a: tk.v.a, b: tk.v.b };
      }
      if (tk.t === T.NAME) {
        next();
        if (peek().t === T.LP) {
          next();
          var args = [];
          if (peek().t !== T.RP) {
            for (;;) {
              if (peek().t === T.SEP) { args.push({ type: 'missing' }); next(); continue; }
              if (peek().t === T.RP) { args.push({ type: 'missing' }); break; }
              args.push(parseExpr());
              if (peek().t === T.SEP) { next(); continue; }
              break;
            }
          }
          expect(T.RP, 'Ожидалась закрывающая скобка в функции ' + tk.v);
          return { type: 'call', name: tk.v, args: args };
        }
        return { type: 'name', v: tk.v };
      }
      if (tk.t === T.LP) {
        next();
        var e = parseExpr();
        expect(T.RP, 'Ожидалась закрывающая скобка');
        return { type: 'paren', e: e };
      }
      throw new SyntaxError('Неожиданный элемент формулы');
    }

    var ast = parseExpr();
    if (peek().t !== T.EOF) throw new SyntaxError('Лишние символы в конце формулы');
    return ast;
  }

  /* -------------------------------------------------------- приведение типов */
  function isBlank(v) { return v === null || v === undefined || v === ''; }

  function toNum(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string') {
      var s = v.trim().replace(/ /g, '').replace(/\s/g, '').replace(',', '.');
      if (s === '') return 0;
      if (/^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?%$/.test(s)) return parseFloat(s) / 100;
      if (!/^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$/.test(s)) return ERR.value();
      return parseFloat(s);
    }
    if (Array.isArray(v)) return toNum(flat(v)[0]);
    return ERR.value();
  }
  function toStr(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'ИСТИНА' : 'ЛОЖЬ';
    if (typeof v === 'number') return numToStr(v);
    if (Array.isArray(v)) return toStr(flat(v)[0]);
    return String(v);
  }
  function numToStr(n) {
    if (!isFinite(n)) return '#NUM!';
    var r = Math.round(n * 1e10) / 1e10;
    return String(r);
  }
  function toBool(v) {
    if (isErr(v)) return v;
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v !== 0;
    if (v === null || v === undefined || v === '') return false;
    if (typeof v === 'string') {
      var u = v.trim().toUpperCase();
      if (u === 'TRUE' || u === 'ИСТИНА') return true;
      if (u === 'FALSE' || u === 'ЛОЖЬ') return false;
      return ERR.value();
    }
    return ERR.value();
  }

  function flat(v) {
    if (!Array.isArray(v)) return [v];
    var out = [];
    for (var i = 0; i < v.length; i++) {
      if (Array.isArray(v[i])) { for (var j = 0; j < v[i].length; j++) out.push(v[i][j]); }
      else out.push(v[i]);
    }
    return out;
  }
  function cmpValues(a, b) {
    // порядок Excel: число < текст < ЛОЖЬ < ИСТИНА
    function rank(v) {
      if (typeof v === 'number') return 1;
      if (typeof v === 'string') return 2;
      if (typeof v === 'boolean') return 3;
      return 0;
    }
    if (isBlank(a)) a = typeof b === 'string' ? '' : 0;
    if (isBlank(b)) b = typeof a === 'string' ? '' : 0;
    var ra = rank(a), rb = rank(b);
    if (ra !== rb) return ra < rb ? -1 : 1;
    if (typeof a === 'string') {
      var x = a.toUpperCase(), y = b.toUpperCase();
      return x < y ? -1 : x > y ? 1 : 0;
    }
    if (typeof a === 'boolean') { var na = a ? 1 : 0, nb = b ? 1 : 0; return na - nb; }
    return a < b ? -1 : a > b ? 1 : 0;
  }

  /* ------------------------------------------------ шаблоны (* и ?) в критериях */
  function wildcardToRegex(pat) {
    var out = '', i;
    for (i = 0; i < pat.length; i++) {
      var c = pat[i];
      if (c === '~') {
        var nx = pat[i + 1];
        if (nx === '*' || nx === '?' || nx === '~') { out += nx.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); i++; continue; }
        out += '~'; continue;
      }
      if (c === '*') { out += '.*'; continue; }
      if (c === '?') { out += '.'; continue; }
      out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    return new RegExp('^' + out + '$', 'i');
  }

  function makeCriteria(crit) {
    if (Array.isArray(crit)) crit = flat(crit)[0];
    var op = '=', val = crit;
    if (typeof crit === 'string') {
      var m = /^(<>|>=|<=|>|<|=)\s*(.*)$/.exec(crit.trim());
      if (m) { op = m[1]; val = m[2]; }
      if (typeof val === 'string' && val !== '' && /^-?[0-9]*\.?[0-9]+([eE][+-]?[0-9]+)?$/.test(val.trim())) {
        val = parseFloat(val);
      }
    }
    var rx = null;
    if ((op === '=' || op === '<>') && typeof val === 'string' && /[*?]/.test(val)) rx = wildcardToRegex(val);
    return function (cell) {
      if (isErr(cell)) return false;
      if (rx) {
        var hit = typeof cell === 'string' && rx.test(cell);
        return op === '=' ? hit : !hit;
      }
      if (op === '=' || op === '<>') {
        var eq;
        if (isBlank(val) || val === '') eq = isBlank(cell) || cell === '';
        else if (isBlank(cell)) eq = false;
        else if (typeof val === 'number') eq = (typeof cell === 'number' ? cell === val : toNum(cell) === val && typeof cell !== 'string' ? true : (typeof cell === 'string' && !isErr(toNum(cell)) && toNum(cell) === val));
        else if (typeof val === 'boolean') eq = (typeof cell === 'boolean' && cell === val);
        else eq = String(cell).toUpperCase() === String(val).toUpperCase();
        return op === '=' ? !!eq : !eq;
      }
      if (isBlank(cell)) return false;
      var c = cmpValues(cell, val);
      switch (op) {
        case '>': return c > 0;
        case '<': return c < 0;
        case '>=': return c >= 0;
        case '<=': return c <= 0;
      }
      return false;
    };
  }

  /* ------------------------------------------------------------ интерпретатор */
  // ctx: { getCell(row,col) -> value, names: {}, trace: Set }
  function evaluate(ast, ctx) {
    switch (ast.type) {
      case 'num': return ast.v;
      case 'str': return ast.v;
      case 'bool': return ast.v;
      case 'errlit': return new XLError(ast.v);
      case 'paren': return evaluate(ast.e, ctx);
      case 'missing': return null;
      case 'ref': {
        var rc = a1ToRC(ast.a);
        if (!rc) return ERR.ref();
        return ctx.getCell(rc.row, rc.col);
      }
      case 'range': {
        var A = a1ToRC(ast.a), B = a1ToRC(ast.b);
        if (!A || !B) return ERR.ref();
        return readRange(ctx, A, B);
      }
      case 'name': {
        var up = ast.v.toUpperCase();
        if (ctx.names && Object.prototype.hasOwnProperty.call(ctx.names, up)) return ctx.names[up];
        return ERR.name();
      }
      case 'unary': {
        var v = evaluate(ast.e, ctx);
        if (isErr(v)) return v;
        if (Array.isArray(v)) return broadcast(v, ast.op === '-' ? -1 : 1, function (a, b) { return scalarOp('*', a, b); });
        var n = toNum(single(v));
        if (isErr(n)) return n;
        return ast.op === '-' ? -n : n;
      }
      case 'percent': {
        var pe = evaluate(ast.e, ctx);
        if (isErr(pe)) return pe;
        if (Array.isArray(pe)) return broadcast(pe, 100, function (a, b) { return scalarOp('/', a, b); });
        var pv = toNum(single(pe));
        if (isErr(pv)) return pv;
        return pv / 100;
      }
      case 'bin': return binop(ast, ctx);
      case 'call': return callFn(ast, ctx);
    }
    return ERR.value();
  }

  function single(v) {
    if (Array.isArray(v)) {
      var f = flat(v);
      return f.length ? f[0] : null;
    }
    return v;
  }

  function readRange(ctx, A, B) {
    var r1 = Math.min(A.row, B.row), r2 = Math.max(A.row, B.row);
    var c1 = Math.min(A.col, B.col), c2 = Math.max(A.col, B.col);
    var out = [];
    for (var r = r1; r <= r2; r++) {
      var row = [];
      for (var c = c1; c <= c2; c++) row.push(ctx.getCell(r, c));
      out.push(row);
    }
    out.__range = { r1: r1, c1: c1, r2: r2, c2: c2 };
    return out;
  }

  // Поэлементные операции над массивами: (A1:A9="Москва")*B1:B9
  function broadcast(l, r, f) {
    var lg = Array.isArray(l) ? grid2(l) : null;
    var rg = Array.isArray(r) ? grid2(r) : null;
    if (!lg && !rg) return f(l, r);
    var rows = Math.max(lg ? lg.length : 1, rg ? rg.length : 1);
    var cols = Math.max(lg ? lg[0].length : 1, rg ? rg[0].length : 1);
    function pick(g, rr, cc, scalar) {
      if (!g) return scalar;
      var row = g.length === 1 ? g[0] : g[rr];
      if (!row) return ERR.na();
      var v = row.length === 1 ? row[0] : row[cc];
      return v === undefined ? ERR.na() : v;
    }
    var out = [];
    for (var i = 0; i < rows; i++) {
      var line = [];
      for (var j = 0; j < cols; j++) line.push(f(pick(lg, i, j, l), pick(rg, i, j, r)));
      out.push(line);
    }
    return out;
  }
  function grid2(v) {
    if (v.length && Array.isArray(v[0])) return v;
    return v.map(function (x) { return [x]; });
  }

  function binop(ast, ctx) {
    var lRaw = evaluate(ast.l, ctx);
    var rRaw = evaluate(ast.r, ctx);
    if (isErr(lRaw)) return lRaw;
    if (isErr(rRaw)) return rRaw;
    if (Array.isArray(lRaw) || Array.isArray(rRaw)) {
      var op2 = ast.op;
      return broadcast(lRaw, rRaw, function (a, b) { return scalarOp(op2, a, b); });
    }
    var l = single(lRaw);
    var r = single(rRaw);
    var op = ast.op;
    return scalarOp(op, l, r);
  }

  function scalarOp(op, l, r) {
    if (isErr(l)) return l;
    if (isErr(r)) return r;
    if (op === '&') {
      var ls = toStr(l), rs = toStr(r);
      if (isErr(ls)) return ls; if (isErr(rs)) return rs;
      return ls + rs;
    }
    if (['=', '<>', '<', '>', '<=', '>='].indexOf(op) >= 0) {
      var c = cmpValues(l, r);
      switch (op) {
        case '=': return c === 0;
        case '<>': return c !== 0;
        case '<': return c < 0;
        case '>': return c > 0;
        case '<=': return c <= 0;
        case '>=': return c >= 0;
      }
    }
    var a = toNum(l), b = toNum(r);
    if (isErr(a)) return a; if (isErr(b)) return b;
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '*': return a * b;
      case '/': return b === 0 ? ERR.div0() : a / b;
      case '^': {
        var p = Math.pow(a, b);
        if (isNaN(p)) return ERR.num();
        return p;
      }
    }
    return ERR.value();
  }

  function callFn(ast, ctx) {
    var name = normFn(ast.name);
    var fn = FUNCS[name];
    if (!fn) return ERR.name();
    if (fn.lazy) return fn.call(null, ast.args, ctx);
    var args = [], i;
    for (i = 0; i < ast.args.length; i++) {
      var v = evaluate(ast.args[i], ctx);
      if (isErr(v) && !fn.passErrors) return v;
      args.push(v);
    }
    try {
      return fn.apply({ ctx: ctx, nodes: ast.args }, args);
    } catch (e) {
      if (e instanceof XLError) return e;
      return ERR.value();
    }
  }

  /* ------------------------------------------------- русские имена функций */
  var RU = {
    'СУММ': 'SUM', 'СУММПРОИЗВ': 'SUMPRODUCT', 'ПРОИЗВЕД': 'PRODUCT', 'СРЗНАЧ': 'AVERAGE',
    'МЕДИАНА': 'MEDIAN', 'МИН': 'MIN', 'МАКС': 'MAX', 'СЧЁТ': 'COUNT', 'СЧЕТ': 'COUNT',
    'СЧЁТЗ': 'COUNTA', 'СЧЕТЗ': 'COUNTA', 'СЧИТАТЬПУСТОТЫ': 'COUNTBLANK',
    'ОКРУГЛ': 'ROUND', 'ОКРУГЛВВЕРХ': 'ROUNDUP', 'ОКРУГЛВНИЗ': 'ROUNDDOWN', 'ОКРУГЛТ': 'MROUND',
    'ЦЕЛОЕ': 'INT', 'ОТБР': 'TRUNC', 'ABS': 'ABS', 'СТЕПЕНЬ': 'POWER', 'КОРЕНЬ': 'SQRT',
    'EXP': 'EXP', 'LN': 'LN', 'LOG': 'LOG', 'LOG10': 'LOG10', 'ЗНАК': 'SIGN', 'ОСТАТ': 'MOD',
    'ОКРВВЕРХ': 'CEILING', 'ОКРВНИЗ': 'FLOOR', 'СУММКВ': 'SUMSQ',
    'СТАНДОТКЛОН.В': 'STDEV.S', 'СТАНДОТКЛОН.Г': 'STDEV.P', 'ДИСП.В': 'VAR.S', 'ДИСП.Г': 'VAR.P',
    'РАНГ': 'RANK', 'РАНГ.РВ': 'RANK.EQ', 'НАИБОЛЬШИЙ': 'LARGE', 'НАИМЕНЬШИЙ': 'SMALL',
    'ПЕРСЕНТИЛЬ.ВКЛ': 'PERCENTILE.INC', 'ПЕРСЕНТИЛЬ': 'PERCENTILE', 'КВАРТИЛЬ.ВКЛ': 'QUARTILE.INC',
    'КОРРЕЛ': 'CORREL',
    'ЕСЛИ': 'IF', 'ЕСЛИМН': 'IFS', 'И': 'AND', 'ИЛИ': 'OR', 'НЕ': 'NOT', 'ИСКЛИЛИ': 'XOR',
    'ЕСЛИОШИБКА': 'IFERROR', 'ЕСНД': 'IFNA', 'ПЕРЕКЛЮЧ': 'SWITCH',
    'СУММЕСЛИ': 'SUMIF', 'СУММЕСЛИМН': 'SUMIFS', 'СЧЁТЕСЛИ': 'COUNTIF', 'СЧЕТЕСЛИ': 'COUNTIF',
    'СЧЁТЕСЛИМН': 'COUNTIFS', 'СЧЕТЕСЛИМН': 'COUNTIFS', 'СРЗНАЧЕСЛИ': 'AVERAGEIF',
    'СРЗНАЧЕСЛИМН': 'AVERAGEIFS', 'МАКСЕСЛИ': 'MAXIFS', 'МИНЕСЛИ': 'MINIFS',
    'ВПР': 'VLOOKUP', 'ГПР': 'HLOOKUP', 'ПРОСМОТР': 'LOOKUP', 'ИНДЕКС': 'INDEX',
    'ПОИСКПОЗ': 'MATCH', 'ПРОСМОТРX': 'XLOOKUP', 'ПОИСКПОЗX': 'XMATCH', 'ВЫБОР': 'CHOOSE',
    'СМЕЩ': 'OFFSET', 'СТРОКА': 'ROW', 'СТОЛБЕЦ': 'COLUMN', 'ЧСТРОК': 'ROWS', 'ЧИСЛСТОЛБ': 'COLUMNS',
    'ДВССЫЛ': 'INDIRECT', 'ТРАНСП': 'TRANSPOSE', 'УНИК': 'UNIQUE',
    'ДЛСТР': 'LEN', 'ЛЕВСИМВ': 'LEFT', 'ПРАВСИМВ': 'RIGHT', 'ПСТР': 'MID', 'НАЙТИ': 'FIND',
    'ПОИСК': 'SEARCH', 'ПОДСТАВИТЬ': 'SUBSTITUTE', 'ЗАМЕНИТЬ': 'REPLACE', 'СЖПРОБЕЛЫ': 'TRIM',
    'ПРОПИСН': 'UPPER', 'СТРОЧН': 'LOWER', 'ПРОПНАЧ': 'PROPER', 'СЦЕП': 'CONCAT',
    'СЦЕПИТЬ': 'CONCATENATE', 'ОБЪЕДИНИТЬ': 'TEXTJOIN', 'ТЕКСТ': 'TEXT', 'ЗНАЧЕН': 'VALUE',
    'ПОВТОР': 'REPT', 'СОВПАД': 'EXACT',
    'ДАТА': 'DATE', 'ГОД': 'YEAR', 'МЕСЯЦ': 'MONTH', 'ДЕНЬ': 'DAY', 'СЕГОДНЯ': 'TODAY',
    'КОНМЕСЯЦА': 'EOMONTH', 'ДАТАМЕС': 'EDATE', 'РАЗНДАТ': 'DATEDIF', 'ДОЛЯГОДА': 'YEARFRAC',
    'ДЕНЬНЕД': 'WEEKDAY', 'ДНИ': 'DAYS', 'ЧИСТРАБДНИ': 'NETWORKDAYS',
    'ЧПС': 'NPV', 'ВСД': 'IRR', 'ЧИСТНЗ': 'XNPV', 'ЧИСТВНДОХ': 'XIRR', 'ПЛТ': 'PMT',
    'ПС': 'PV', 'БС': 'FV', 'КПЕР': 'NPER', 'СТАВКА': 'RATE',
    'ЕЧИСЛО': 'ISNUMBER', 'ЕТЕКСТ': 'ISTEXT', 'ЕПУСТО': 'ISBLANK', 'ЕОШИБКА': 'ISERROR',
    'ЕНД': 'ISNA', 'НД': 'NA', 'Ч': 'N'
  };
  function normFn(name) {
    var up = name.toUpperCase();
    if (RU[up]) return RU[up];
    return up;
  }

  /* ---------------------------------------------------------- вспомогательные */
  function collectNums(vals, nodes) {
    // числа для агрегатов: из диапазонов берём только числа,
    // из скалярных аргументов — конвертируем текст/булево
    var out = [];
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (Array.isArray(v)) {
        var f = flat(v);
        for (var j = 0; j < f.length; j++) {
          if (isErr(f[j])) throw f[j];
          if (typeof f[j] === 'number') out.push(f[j]);
        }
      } else {
        if (isErr(v)) throw v;
        if (v === null || v === undefined || v === '') continue;
        var n = toNum(v);
        if (isErr(n)) throw n;
        out.push(n);
      }
    }
    return out;
  }
  function num(v) { var n = toNum(single(v)); if (isErr(n)) throw n; return n; }
  function str(v) { var s = toStr(single(v)); if (isErr(s)) throw s; return s; }
  function bool(v) { var b = toBool(single(v)); if (isErr(b)) throw b; return b; }
  function opt(v, d) { return (v === undefined || v === null || (typeof v === 'object' && v && v.type === 'missing')) ? d : v; }
  function optNum(v, d) { return (v === undefined || v === null) ? d : num(v); }

  function grid(v) { // всегда 2D
    if (Array.isArray(v)) {
      if (v.length && Array.isArray(v[0])) return v;
      return v.map(function (x) { return [x]; });
    }
    return [[v]];
  }
  function dims(g) { return { rows: g.length, cols: g.length ? g[0].length : 0 }; }

  /* ---------------------------------------------------------------- даты */
  var EPOCH = Date.UTC(1899, 11, 30);
  function serialToDate(s) { return new Date(EPOCH + Math.round(s) * 86400000); }
  function dateToSerial(d) { return Math.round((d.getTime() - EPOCH) / 86400000); }
  function ymdToSerial(y, m, d) {
    var yy = y, mm = m - 1;
    yy += Math.floor(mm / 12); mm = ((mm % 12) + 12) % 12;
    if (y < 1900 && y >= 0) yy = y + 1900 - (y < 1900 ? 0 : 0);
    return dateToSerial(new Date(Date.UTC(yy, mm, d)));
  }

  /* ------------------------------------------------------------- функции */
  var FUNCS = {};
  function def(names, fn, flags) {
    if (flags) for (var k in flags) fn[k] = flags[k];
    names.split(' ').forEach(function (n) { FUNCS[n] = fn; });
  }

  /* --- математика --- */
  def('SUM', function () { return collectNums([].slice.call(arguments)).reduce(function (a, b) { return a + b; }, 0); });
  def('PRODUCT', function () { var a = collectNums([].slice.call(arguments)); return a.length ? a.reduce(function (x, y) { return x * y; }, 1) : 0; });
  def('AVERAGE', function () { var a = collectNums([].slice.call(arguments)); if (!a.length) return ERR.div0(); return a.reduce(function (x, y) { return x + y; }, 0) / a.length; });
  def('MEDIAN', function () {
    var a = collectNums([].slice.call(arguments)).sort(function (x, y) { return x - y; });
    if (!a.length) return ERR.num();
    var m = Math.floor(a.length / 2);
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  });
  def('MIN', function () { var a = collectNums([].slice.call(arguments)); return a.length ? Math.min.apply(null, a) : 0; });
  def('MAX', function () { var a = collectNums([].slice.call(arguments)); return a.length ? Math.max.apply(null, a) : 0; });
  def('COUNT', function () { return collectNums([].slice.call(arguments)).length; });
  def('COUNTA', function () {
    var c = 0;
    [].slice.call(arguments).forEach(function (v) {
      flat(v).forEach(function (x) { if (!(x === null || x === undefined || x === '')) c++; });
    });
    return c;
  }, { passErrors: true });
  def('COUNTBLANK', function (r) {
    var c = 0; flat(r).forEach(function (x) { if (x === null || x === undefined || x === '') c++; }); return c;
  }, { passErrors: true });
  def('ROUND', function (v, d) { var n = num(v), p = Math.pow(10, optNum(d, 0)); return Math.round((Math.abs(n) * p).toPrecision(15)) / p * (n < 0 ? -1 : 1); });
  def('ROUNDUP', function (v, d) { var n = num(v), p = Math.pow(10, optNum(d, 0)); return Math.ceil(Math.abs(n) * p - 1e-9) / p * (n < 0 ? -1 : 1); });
  def('ROUNDDOWN', function (v, d) { var n = num(v), p = Math.pow(10, optNum(d, 0)); return Math.floor(Math.abs(n) * p + 1e-9) / p * (n < 0 ? -1 : 1); });
  def('MROUND', function (v, m) { var n = num(v), k = num(m); if (k === 0) return 0; return Math.round(n / k) * k; });
  def('CEILING', function (v, m) { var n = num(v), k = optNum(m, 1); if (k === 0) return 0; return Math.ceil(n / k) * k; });
  def('FLOOR', function (v, m) { var n = num(v), k = optNum(m, 1); if (k === 0) return ERR.div0(); return Math.floor(n / k) * k; });
  def('INT', function (v) { return Math.floor(num(v)); });
  def('TRUNC', function (v, d) { var p = Math.pow(10, optNum(d, 0)), n = num(v); return (n < 0 ? Math.ceil(n * p) : Math.floor(n * p)) / p; });
  def('ABS', function (v) { return Math.abs(num(v)); });
  def('POWER', function (a, b) { var r = Math.pow(num(a), num(b)); return isNaN(r) ? ERR.num() : r; });
  def('SQRT', function (v) { var n = num(v); return n < 0 ? ERR.num() : Math.sqrt(n); });
  def('EXP', function (v) { return Math.exp(num(v)); });
  def('LN', function (v) { var n = num(v); return n <= 0 ? ERR.num() : Math.log(n); });
  def('LOG', function (v, b) { var n = num(v), base = optNum(b, 10); return n <= 0 ? ERR.num() : Math.log(n) / Math.log(base); });
  def('LOG10', function (v) { var n = num(v); return n <= 0 ? ERR.num() : Math.log(n) / Math.LN10; });
  def('SIGN', function (v) { var n = num(v); return n > 0 ? 1 : n < 0 ? -1 : 0; });
  def('MOD', function (a, b) { var x = num(a), y = num(b); if (y === 0) return ERR.div0(); return x - y * Math.floor(x / y); });
  def('SUMSQ', function () { return collectNums([].slice.call(arguments)).reduce(function (a, b) { return a + b * b; }, 0); });
  def('SUMPRODUCT', function () {
    var gs = [].slice.call(arguments).map(grid);
    if (!gs.length) return ERR.value();
    var d0 = dims(gs[0]);
    for (var i = 1; i < gs.length; i++) {
      var d = dims(gs[i]);
      if (d.rows !== d0.rows || d.cols !== d0.cols) return ERR.value();
    }
    var total = 0;
    for (var r = 0; r < d0.rows; r++) {
      for (var c = 0; c < d0.cols; c++) {
        var p = 1;
        for (var k = 0; k < gs.length; k++) {
          var v = gs[k][r][c];
          if (isErr(v)) return v;
          var nv = (typeof v === 'number') ? v : (typeof v === 'boolean' ? (v ? 1 : 0) : 0);
          p *= nv;
        }
        total += p;
      }
    }
    return total;
  });

  /* --- статистика --- */
  function variance(a, sample) {
    if (a.length < (sample ? 2 : 1)) return ERR.div0();
    var m = a.reduce(function (x, y) { return x + y; }, 0) / a.length;
    var s = a.reduce(function (x, y) { return x + (y - m) * (y - m); }, 0);
    return s / (a.length - (sample ? 1 : 0));
  }
  def('VAR.S VARS', function () { return variance(collectNums([].slice.call(arguments)), true); });
  def('VAR.P VARP', function () { return variance(collectNums([].slice.call(arguments)), false); });
  def('STDEV.S STDEV STDEVS', function () { var v = variance(collectNums([].slice.call(arguments)), true); return isErr(v) ? v : Math.sqrt(v); });
  def('STDEV.P STDEVP', function () { var v = variance(collectNums([].slice.call(arguments)), false); return isErr(v) ? v : Math.sqrt(v); });
  def('LARGE', function (arr, k) {
    var a = collectNums([arr]).sort(function (x, y) { return y - x; }), i = num(k);
    if (i < 1 || i > a.length) return ERR.num();
    return a[i - 1];
  });
  def('SMALL', function (arr, k) {
    var a = collectNums([arr]).sort(function (x, y) { return x - y; }), i = num(k);
    if (i < 1 || i > a.length) return ERR.num();
    return a[i - 1];
  });
  def('RANK RANK.EQ', function (v, arr, order) {
    var x = num(v), a = collectNums([arr]), asc = optNum(order, 0) !== 0;
    a.sort(function (p, q) { return asc ? p - q : q - p; });
    var idx = a.indexOf(x);
    return idx < 0 ? ERR.na() : idx + 1;
  });
  def('PERCENTILE PERCENTILE.INC', function (arr, k) {
    var a = collectNums([arr]).sort(function (x, y) { return x - y; }), p = num(k);
    if (!a.length || p < 0 || p > 1) return ERR.num();
    var pos = (a.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  });
  def('QUARTILE QUARTILE.INC', function (arr, q) { return FUNCS['PERCENTILE'](arr, num(q) / 4); });
  def('CORREL', function (x, y) {
    var a = collectNums([x]), b = collectNums([y]);
    if (a.length !== b.length || !a.length) return ERR.na();
    var ma = a.reduce(function (p, q) { return p + q; }, 0) / a.length;
    var mb = b.reduce(function (p, q) { return p + q; }, 0) / b.length;
    var sab = 0, sa = 0, sb = 0;
    for (var i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += Math.pow(a[i] - ma, 2); sb += Math.pow(b[i] - mb, 2); }
    if (sa === 0 || sb === 0) return ERR.div0();
    return sab / Math.sqrt(sa * sb);
  });

  /* --- логика (ленивые) --- */
  def('IF', function (nodes, ctx) {
    if (nodes.length < 2) return ERR.value();
    var c = single(evaluate(nodes[0], ctx));
    if (isErr(c)) return c;
    var b = toBool(c);
    if (isErr(b)) return b;
    if (b) return single(evaluate(nodes[1], ctx));
    if (nodes.length > 2 && nodes[2].type !== 'missing') return single(evaluate(nodes[2], ctx));
    return false;
  }, { lazy: true });
  def('IFS', function (nodes, ctx) {
    for (var i = 0; i + 1 < nodes.length; i += 2) {
      var c = single(evaluate(nodes[i], ctx));
      if (isErr(c)) return c;
      var b = toBool(c);
      if (isErr(b)) return b;
      if (b) return single(evaluate(nodes[i + 1], ctx));
    }
    return ERR.na();
  }, { lazy: true });
  def('IFERROR', function (nodes, ctx) {
    if (nodes.length < 2) return ERR.value();
    var v = single(evaluate(nodes[0], ctx));
    return isErr(v) ? single(evaluate(nodes[1], ctx)) : v;
  }, { lazy: true });
  def('IFNA', function (nodes, ctx) {
    var v = single(evaluate(nodes[0], ctx));
    return (isErr(v) && v.type === '#N/A') ? single(evaluate(nodes[1], ctx)) : v;
  }, { lazy: true });
  def('SWITCH', function (nodes, ctx) {
    var target = single(evaluate(nodes[0], ctx));
    if (isErr(target)) return target;
    var i;
    for (i = 1; i + 1 < nodes.length; i += 2) {
      var c = single(evaluate(nodes[i], ctx));
      if (cmpValues(target, c) === 0) return single(evaluate(nodes[i + 1], ctx));
    }
    if (i < nodes.length) return single(evaluate(nodes[i], ctx));
    return ERR.na();
  }, { lazy: true });
  def('AND', function () {
    var vals = flat([].slice.call(arguments)), any = false;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (isErr(v)) return v;
      if (v === null || v === undefined || v === '') continue;
      if (typeof v === 'string' && isErr(toBool(v))) continue;
      var b = toBool(v); if (isErr(b)) return b;
      any = true; if (!b) return false;
    }
    return any ? true : ERR.value();
  }, { passErrors: true });
  def('OR', function () {
    var vals = flat([].slice.call(arguments)), any = false, res = false;
    for (var i = 0; i < vals.length; i++) {
      var v = vals[i];
      if (isErr(v)) return v;
      if (v === null || v === undefined || v === '') continue;
      if (typeof v === 'string' && isErr(toBool(v))) continue;
      var b = toBool(v); if (isErr(b)) return b;
      any = true; if (b) res = true;
    }
    return any ? res : ERR.value();
  }, { passErrors: true });
  def('XOR', function () {
    var vals = flat([].slice.call(arguments)), c = 0;
    for (var i = 0; i < vals.length; i++) { var b = toBool(vals[i]); if (isErr(b)) return b; if (b) c++; }
    return c % 2 === 1;
  });
  def('NOT', function (v) { var b = bool(v); return !b; });
  def('TRUE', function () { return true; });
  def('FALSE', function () { return false; });

  /* --- условные агрегаты --- */
  function critFilter(pairs, shape) {
    // pairs: [[gridValues, criteriaFn], ...] -> массив булевых по позициям shape
    var mask = [];
    for (var r = 0; r < shape.rows; r++) {
      mask.push([]);
      for (var c = 0; c < shape.cols; c++) {
        var ok = true;
        for (var k = 0; k < pairs.length; k++) {
          var g = pairs[k][0];
          if (!g[r] || g[r][c] === undefined) { ok = false; break; }
          if (!pairs[k][1](g[r][c])) { ok = false; break; }
        }
        mask[r].push(ok);
      }
    }
    return mask;
  }
  function ifsCore(sumGrid, args, startIdx) {
    var pairs = [];
    for (var i = startIdx; i + 1 < args.length; i += 2) {
      pairs.push([grid(args[i]), makeCriteria(args[i + 1])]);
    }
    if (!pairs.length) return null;
    var shape = dims(pairs[0][0]);
    for (var j = 1; j < pairs.length; j++) {
      var d = dims(pairs[j][0]);
      if (d.rows !== shape.rows || d.cols !== shape.cols) return ERR.value();
    }
    if (sumGrid) {
      var ds = dims(sumGrid);
      if (ds.rows !== shape.rows || ds.cols !== shape.cols) return ERR.value();
    }
    return { mask: critFilter(pairs, shape), shape: shape };
  }
  function pickValues(sumGrid, res) {
    var out = [];
    for (var r = 0; r < res.shape.rows; r++)
      for (var c = 0; c < res.shape.cols; c++)
        if (res.mask[r][c]) out.push(sumGrid[r][c]);
    return out;
  }
  function numsOnly(vals) {
    var o = []; vals.forEach(function (v) { if (typeof v === 'number') o.push(v); }); return o;
  }

  def('SUMIF', function (range, crit, sumRange) {
    var g = grid(range), sg = (sumRange === undefined || sumRange === null) ? g : grid(sumRange);
    var f = makeCriteria(crit), total = 0, d = dims(g);
    var off = (sg !== g);
    for (var r = 0; r < d.rows; r++) for (var c = 0; c < d.cols; c++) {
      if (!f(g[r][c])) continue;
      var v = off ? (sg[r] ? sg[r][c] : undefined) : g[r][c];
      if (typeof v === 'number') total += v;
    }
    return total;
  });
  def('SUMIFS', function () {
    var a = [].slice.call(arguments), sg = grid(a[0]);
    var res = ifsCore(sg, a, 1);
    if (res === null) return ERR.value(); if (isErr(res)) return res;
    return numsOnly(pickValues(sg, res)).reduce(function (x, y) { return x + y; }, 0);
  });
  def('COUNTIF', function (range, crit) {
    var g = grid(range), f = makeCriteria(crit), c2 = 0, d = dims(g);
    for (var r = 0; r < d.rows; r++) for (var c = 0; c < d.cols; c++) if (f(g[r][c])) c2++;
    return c2;
  });
  def('COUNTIFS', function () {
    var a = [].slice.call(arguments);
    var res = ifsCore(null, a, 0);
    if (res === null) return ERR.value(); if (isErr(res)) return res;
    var n = 0;
    for (var r = 0; r < res.shape.rows; r++) for (var c = 0; c < res.shape.cols; c++) if (res.mask[r][c]) n++;
    return n;
  });
  def('AVERAGEIF', function (range, crit, avgRange) {
    var g = grid(range), ag = (avgRange === undefined || avgRange === null) ? g : grid(avgRange);
    var f = makeCriteria(crit), vals = [], d = dims(g), off = (ag !== g);
    for (var r = 0; r < d.rows; r++) for (var c = 0; c < d.cols; c++) {
      if (!f(g[r][c])) continue;
      var v = off ? (ag[r] ? ag[r][c] : undefined) : g[r][c];
      if (typeof v === 'number') vals.push(v);
    }
    if (!vals.length) return ERR.div0();
    return vals.reduce(function (x, y) { return x + y; }, 0) / vals.length;
  });
  def('AVERAGEIFS', function () {
    var a = [].slice.call(arguments), ag = grid(a[0]);
    var res = ifsCore(ag, a, 1);
    if (res === null) return ERR.value(); if (isErr(res)) return res;
    var vals = numsOnly(pickValues(ag, res));
    if (!vals.length) return ERR.div0();
    return vals.reduce(function (x, y) { return x + y; }, 0) / vals.length;
  });
  def('MAXIFS', function () {
    var a = [].slice.call(arguments), mg = grid(a[0]);
    var res = ifsCore(mg, a, 1);
    if (res === null) return ERR.value(); if (isErr(res)) return res;
    var vals = numsOnly(pickValues(mg, res));
    return vals.length ? Math.max.apply(null, vals) : 0;
  });
  def('MINIFS', function () {
    var a = [].slice.call(arguments), mg = grid(a[0]);
    var res = ifsCore(mg, a, 1);
    if (res === null) return ERR.value(); if (isErr(res)) return res;
    var vals = numsOnly(pickValues(mg, res));
    return vals.length ? Math.min.apply(null, vals) : 0;
  });

  /* --- поиск и ссылки --- */
  function nodeToRef(node) {
    if (!node) return null;
    if (node.type === 'paren') return nodeToRef(node.e);
    if (node.type === 'ref') {
      var rc = a1ToRC(node.a); if (!rc) return null;
      return { r1: rc.row, c1: rc.col, r2: rc.row, c2: rc.col };
    }
    if (node.type === 'range') {
      var A = a1ToRC(node.a), B = a1ToRC(node.b); if (!A || !B) return null;
      return { r1: Math.min(A.row, B.row), c1: Math.min(A.col, B.col), r2: Math.max(A.row, B.row), c2: Math.max(A.col, B.col) };
    }
    return null;
  }

  def('INDEX', function (arr, rowNum, colNum) {
    var g = grid(arr), d = dims(g);
    var r = optNum(rowNum, 0), c = (colNum === undefined || colNum === null) ? 0 : num(colNum);
    if (d.rows === 1 && (colNum === undefined || colNum === null) && r > 0) { c = r; r = 1; }
    if (d.cols === 1 && (colNum === undefined || colNum === null)) c = 1;
    if (r === 0 && c === 0) return g;
    if (r < 0 || c < 0) return ERR.value();
    if (r > d.rows || c > d.cols) return ERR.ref();
    if (r === 0) { var col = []; for (var i = 0; i < d.rows; i++) col.push([g[i][c - 1]]); return col; }
    if (c === 0) return [g[r - 1].slice()];
    return g[r - 1][c - 1];
  });

  function matchIn(list, value, type) {
    var i;
    if (type === 0) {
      var f = (typeof value === 'string' && /[*?]/.test(value)) ? wildcardToRegex(value) : null;
      for (i = 0; i < list.length; i++) {
        if (f) { if (typeof list[i] === 'string' && f.test(list[i])) return i + 1; }
        else if (!isErr(list[i]) && cmpValues(list[i], value) === 0) return i + 1;
      }
      return -1;
    }
    if (type === 1) { // возрастание, наибольшее <= value
      var best = -1;
      for (i = 0; i < list.length; i++) {
        if (isErr(list[i]) || isBlank(list[i])) continue;
        if (typeof list[i] !== typeof value && !(typeof list[i] === 'number' && typeof value === 'number')) continue;
        if (cmpValues(list[i], value) <= 0) best = i + 1; else break;
      }
      return best;
    }
    // type -1: убывание, наименьшее >= value
    var b2 = -1;
    for (i = 0; i < list.length; i++) {
      if (isErr(list[i]) || isBlank(list[i])) continue;
      if (cmpValues(list[i], value) >= 0) b2 = i + 1; else break;
    }
    return b2;
  }

  def('MATCH', function (value, arr, type) {
    var v = single(value), g = grid(arr), d = dims(g), list = [];
    if (d.rows === 1) list = g[0].slice();
    else if (d.cols === 1) list = g.map(function (r) { return r[0]; });
    else return ERR.na();
    var t = (type === undefined || type === null) ? 1 : num(type);
    var r = matchIn(list, v, t);
    return r < 0 ? ERR.na() : r;
  });
  def('XMATCH', function (value, arr, mode, search) {
    var v = single(value), g = grid(arr), d = dims(g), list = [];
    if (d.rows === 1) list = g[0].slice(); else list = g.map(function (r) { return r[0]; });
    var m = (mode === undefined || mode === null) ? 0 : num(mode);
    var rev = optNum(search, 1) === -1;
    var idxs = list.map(function (_, i) { return i; });
    if (rev) idxs.reverse();
    var i, best = -1;
    if (m === 0) {
      var f = (typeof v === 'string' && /[*?]/.test(v)) ? wildcardToRegex(v) : null;
      for (i = 0; i < idxs.length; i++) {
        var x = list[idxs[i]];
        if (f ? (typeof x === 'string' && f.test(x)) : (!isErr(x) && cmpValues(x, v) === 0)) return idxs[i] + 1;
      }
      return ERR.na();
    }
    if (m === -1) { // ближайшее меньшее
      var bv = null;
      for (i = 0; i < list.length; i++) {
        if (isBlank(list[i]) || isErr(list[i])) continue;
        if (cmpValues(list[i], v) <= 0 && (bv === null || cmpValues(list[i], bv) > 0)) { bv = list[i]; best = i + 1; }
      }
      return best < 0 ? ERR.na() : best;
    }
    if (m === 1) {
      var bv2 = null;
      for (i = 0; i < list.length; i++) {
        if (isBlank(list[i]) || isErr(list[i])) continue;
        if (cmpValues(list[i], v) >= 0 && (bv2 === null || cmpValues(list[i], bv2) < 0)) { bv2 = list[i]; best = i + 1; }
      }
      return best < 0 ? ERR.na() : best;
    }
    return ERR.value();
  });

  def('VLOOKUP', function (value, table, colIdx, rangeLookup) {
    var v = single(value), g = grid(table), d = dims(g), ci = num(colIdx);
    if (ci < 1 || ci > d.cols) return ERR.ref();
    var approx = (rangeLookup === undefined || rangeLookup === null) ? true : toBool(single(rangeLookup));
    if (isErr(approx)) return approx;
    var col = g.map(function (r) { return r[0]; });
    var idx = matchIn(col, v, approx ? 1 : 0);
    if (idx < 0) return ERR.na();
    return g[idx - 1][ci - 1];
  });
  def('HLOOKUP', function (value, table, rowIdx, rangeLookup) {
    var v = single(value), g = grid(table), d = dims(g), ri = num(rowIdx);
    if (ri < 1 || ri > d.rows) return ERR.ref();
    var approx = (rangeLookup === undefined || rangeLookup === null) ? true : toBool(single(rangeLookup));
    if (isErr(approx)) return approx;
    var idx = matchIn(g[0].slice(), v, approx ? 1 : 0);
    if (idx < 0) return ERR.na();
    return g[ri - 1][idx - 1];
  });
  def('LOOKUP', function (value, lookupVec, resultVec) {
    var v = single(value), g = grid(lookupVec), d = dims(g);
    var list = d.rows === 1 ? g[0].slice() : g.map(function (r) { return r[0]; });
    var idx = matchIn(list, v, 1);
    if (idx < 0) return ERR.na();
    if (resultVec === undefined || resultVec === null) return list[idx - 1];
    var rg = grid(resultVec), rd = dims(rg);
    var rlist = rd.rows === 1 ? rg[0].slice() : rg.map(function (r) { return r[0]; });
    return idx <= rlist.length ? rlist[idx - 1] : ERR.na();
  });
  def('XLOOKUP', function (value, lookupArr, returnArr, ifNotFound, mode, search) {
    var v = single(value), lg = grid(lookupArr), ld = dims(lg);
    var list = ld.rows === 1 ? lg[0].slice() : lg.map(function (r) { return r[0]; });
    var pos = FUNCS['XMATCH'](v, lookupArr, mode, search);
    if (isErr(pos)) {
      if (ifNotFound !== undefined && ifNotFound !== null) return single(ifNotFound);
      return pos;
    }
    var rg = grid(returnArr), rd = dims(rg);
    if (rd.rows === 1 && ld.rows === 1) return rg[0][pos - 1];
    if (rd.cols === 1) return rg[pos - 1][0];
    return rg[pos - 1] ? [rg[pos - 1].slice()] : ERR.ref();
  });
  def('CHOOSE', function () {
    var a = [].slice.call(arguments), i = num(a[0]);
    if (i < 1 || i > a.length - 1) return ERR.value();
    return a[i];
  });
  def('OFFSET', function (nodes, ctx) {
    var base = nodeToRef(nodes[0]);
    if (!base) return ERR.ref();
    function argN(k, d) {
      if (nodes.length <= k || nodes[k].type === 'missing') return d;
      var v = toNum(single(evaluate(nodes[k], ctx)));
      return isErr(v) ? null : v;
    }
    var dr = argN(1, 0), dc = argN(2, 0);
    if (dr === null || dc === null) return ERR.value();
    var h = argN(3, base.r2 - base.r1 + 1), w = argN(4, base.c2 - base.c1 + 1);
    var r1 = base.r1 + dr, c1 = base.c1 + dc;
    var r2 = r1 + h - 1, c2 = c1 + w - 1;
    if (r1 < 0 || c1 < 0 || h < 1 || w < 1) return ERR.ref();
    if (r1 === r2 && c1 === c2) return ctx.getCell(r1, c1);
    return readRange(ctx, { row: r1, col: c1 }, { row: r2, col: c2 });
  }, { lazy: true });
  def('INDIRECT', function (nodes, ctx) {
    var s = toStr(single(evaluate(nodes[0], ctx)));
    if (isErr(s)) return s;
    var parts = s.split(':');
    if (parts.length === 2) {
      var A = a1ToRC(parts[0]), B = a1ToRC(parts[1]);
      if (!A || !B) return ERR.ref();
      return readRange(ctx, A, B);
    }
    var rc = a1ToRC(s.trim());
    if (!rc) return ERR.ref();
    return ctx.getCell(rc.row, rc.col);
  }, { lazy: true });
  def('ROW', function (nodes, ctx) {
    if (!nodes.length || nodes[0].type === 'missing') return ctx.cur ? ctx.cur.row + 1 : ERR.ref();
    var r = nodeToRef(nodes[0]); return r ? r.r1 + 1 : ERR.ref();
  }, { lazy: true });
  def('COLUMN', function (nodes, ctx) {
    if (!nodes.length || nodes[0].type === 'missing') return ctx.cur ? ctx.cur.col + 1 : ERR.ref();
    var r = nodeToRef(nodes[0]); return r ? r.c1 + 1 : ERR.ref();
  }, { lazy: true });
  def('ROWS', function (arr) { return dims(grid(arr)).rows; });
  def('COLUMNS', function (arr) { return dims(grid(arr)).cols; });
  def('TRANSPOSE', function (arr) {
    var g = grid(arr), d = dims(g), out = [];
    for (var c = 0; c < d.cols; c++) { var row = []; for (var r = 0; r < d.rows; r++) row.push(g[r][c]); out.push(row); }
    return out;
  });
  def('UNIQUE', function (arr) {
    var f = flat(arr), seen = [], out = [];
    f.forEach(function (v) {
      if (isBlank(v)) return;
      var key = (typeof v === 'string') ? v.toUpperCase() : v;
      if (seen.indexOf(key) < 0) { seen.push(key); out.push([v]); }
    });
    return out;
  });

  /* --- текст --- */
  def('LEN', function (v) { return str(v).length; });
  def('LEFT', function (v, n) { return str(v).slice(0, optNum(n, 1)); });
  def('RIGHT', function (v, n) { var k = optNum(n, 1); return k === 0 ? '' : str(v).slice(-k); });
  def('MID', function (v, s, n) {
    var st = num(s), ln = num(n);
    if (st < 1 || ln < 0) return ERR.value();
    return str(v).substr(st - 1, ln);
  });
  def('FIND', function (needle, hay, start) {
    var i = str(hay).indexOf(str(needle), optNum(start, 1) - 1);
    return i < 0 ? ERR.value() : i + 1;
  });
  def('SEARCH', function (needle, hay, start) {
    var h = str(hay), nd = str(needle), st = optNum(start, 1) - 1;
    if (/[*?]/.test(nd)) {
      var rx = new RegExp(wildcardToRegex(nd).source.replace(/^\^/, '').replace(/\$$/, ''), 'i');
      var m = rx.exec(h.slice(st));
      return m ? m.index + st + 1 : ERR.value();
    }
    var i = h.toUpperCase().indexOf(nd.toUpperCase(), st);
    return i < 0 ? ERR.value() : i + 1;
  });
  def('SUBSTITUTE', function (text, oldT, newT, which) {
    var t = str(text), o = str(oldT), nw = str(newT);
    if (o === '') return t;
    if (which === undefined || which === null) return t.split(o).join(nw);
    var k = num(which), idx = -1, count = 0, pos = 0;
    while ((idx = t.indexOf(o, pos)) >= 0) {
      count++;
      if (count === k) return t.slice(0, idx) + nw + t.slice(idx + o.length);
      pos = idx + o.length;
    }
    return t;
  });
  def('REPLACE', function (text, start, len, newT) {
    var t = str(text), s = num(start), l = num(len);
    return t.slice(0, s - 1) + str(newT) + t.slice(s - 1 + l);
  });
  def('TRIM', function (v) { return str(v).replace(/\s+/g, ' ').trim(); });
  def('UPPER', function (v) { return str(v).toUpperCase(); });
  def('LOWER', function (v) { return str(v).toLowerCase(); });
  def('PROPER', function (v) {
    return str(v).toLowerCase().replace(/(^|[^A-Za-zА-Яа-яЁё0-9])([a-zа-яё])/g, function (m, p, c) { return p + c.toUpperCase(); });
  });
  def('CONCAT CONCATENATE', function () {
    var out = '';
    [].slice.call(arguments).forEach(function (v) {
      flat(v).forEach(function (x) { if (!isBlank(x)) out += toStr(x); });
    });
    return out;
  });
  def('TEXTJOIN', function (delim, ignoreEmpty, ) {
    var d = str(delim), ig = bool(ignoreEmpty), parts = [];
    [].slice.call(arguments).slice(2).forEach(function (v) {
      flat(v).forEach(function (x) {
        if (ig && isBlank(x)) return;
        parts.push(toStr(x));
      });
    });
    return parts.join(d);
  });
  def('REPT', function (v, n) { var k = num(n); return k < 0 ? ERR.value() : new Array(Math.floor(k) + 1).join(str(v)); });
  def('EXACT', function (a, b) { return str(a) === str(b); });
  def('VALUE', function (v) {
    var s = str(v).trim().replace(/\s/g, '').replace(/ /g, '');
    if (/%$/.test(s)) { var p = parseFloat(s.replace(',', '.')); return isNaN(p) ? ERR.value() : p / 100; }
    s = s.replace(/\s/g, '');
    if (/^-?[0-9]+([.,][0-9]+)?$/.test(s)) return parseFloat(s.replace(',', '.'));
    var d = a1ToRC(s);
    return ERR.value();
  });
  def('TEXT', function (v, fmt) {
    var f = str(fmt), x = single(v);
    if (/[дДdmMгГyY]/.test(f) && typeof x === 'number') return formatDate(x, f);
    return formatNumber(toNum(x), f);
  });
  function formatNumber(n, f) {
    if (isErr(n)) return n;
    var pct = /%/.test(f);
    if (pct) n = n * 100;
    var body = f.replace(/%/g, '').replace(/"/g, '');
    var decMatch = /[.,](0+)\s*$/.exec(body);
    var dec = decMatch ? decMatch[1].length : 0;
    var thou = /#[\s,\u00a0\u202f]##0/.test(body);
    var neg = n < 0;
    var s = Math.abs(n).toFixed(dec);
    var parts = s.split('.');
    if (thou) parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    s = parts.join(',');
    return (neg ? '-' : '') + s + (pct ? '%' : '');
  }
  function formatDate(serial, f) {
    var d = serialToDate(serial), p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return f.replace(/["]/g, '')
      .replace(/дд|dd|DD/g, p2(d.getUTCDate()))
      .replace(/мм|mm|MM/g, p2(d.getUTCMonth() + 1))
      .replace(/гггг|yyyy|YYYY/g, String(d.getUTCFullYear()))
      .replace(/гг|yy|YY/g, String(d.getUTCFullYear()).slice(2));
  }

  /* --- даты --- */
  def('DATE', function (y, m, d) { return ymdToSerial(num(y), num(m), num(d)); });
  def('YEAR', function (v) { return serialToDate(num(v)).getUTCFullYear(); });
  def('MONTH', function (v) { return serialToDate(num(v)).getUTCMonth() + 1; });
  def('DAY', function (v) { return serialToDate(num(v)).getUTCDate(); });
  def('TODAY', function () { var n = new Date(); return dateToSerial(new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()))); });
  def('EDATE', function (start, months) {
    var d = serialToDate(num(start)), m = num(months);
    var y = d.getUTCFullYear(), mo = d.getUTCMonth() + m, day = d.getUTCDate();
    var last = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    return dateToSerial(new Date(Date.UTC(y, mo, Math.min(day, last))));
  });
  def('EOMONTH', function (start, months) {
    var d = serialToDate(num(start)), m = num(months);
    return dateToSerial(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + m + 1, 0)));
  });
  def('DAYS', function (end, start) { return num(end) - num(start); });
  def('WEEKDAY', function (v, type) {
    var w = serialToDate(num(v)).getUTCDay(); // 0=вс
    var t = optNum(type, 1);
    if (t === 1) return w + 1;
    if (t === 2) return w === 0 ? 7 : w;
    if (t === 3) return w === 0 ? 6 : w - 1;
    return w + 1;
  });
  def('DATEDIF', function (start, end, unit) {
    var s = serialToDate(num(start)), e = serialToDate(num(end)), u = str(unit).toUpperCase();
    var y1 = s.getUTCFullYear(), m1 = s.getUTCMonth(), d1 = s.getUTCDate();
    var y2 = e.getUTCFullYear(), m2 = e.getUTCMonth(), d2 = e.getUTCDate();
    var months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
    switch (u) {
      case 'D': return num(end) - num(start);
      case 'M': return months;
      case 'Y': return Math.floor(months / 12);
      case 'YM': return months % 12;
      case 'MD': return d2 >= d1 ? d2 - d1 : d2 + new Date(Date.UTC(y2, m2, 0)).getUTCDate() - d1;
      case 'YD': {
        var anniv = new Date(Date.UTC(y2 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0), m1, d1));
        return Math.round((e - anniv) / 86400000);
      }
    }
    return ERR.num();
  });
  def('YEARFRAC', function (start, end, basis) {
    var s = num(start), e = num(end), b = optNum(basis, 0);
    var ds = serialToDate(s), de = serialToDate(e);
    if (b === 1) {
      var y1 = ds.getUTCFullYear(), y2 = de.getUTCFullYear();
      var days = e - s, years = y2 - y1 + 1;
      var totalDays = (Date.UTC(y2 + 1, 0, 1) - Date.UTC(y1, 0, 1)) / 86400000;
      return days / (totalDays / years);
    }
    if (b === 2) return (e - s) / 360;
    if (b === 3) return (e - s) / 365;
    // basis 0: US 30/360
    var d1 = ds.getUTCDate(), d2 = de.getUTCDate();
    var m1 = ds.getUTCMonth() + 1, m2 = de.getUTCMonth() + 1;
    var yy1 = ds.getUTCFullYear(), yy2 = de.getUTCFullYear();
    if (d1 === 31) d1 = 30;
    if (d2 === 31 && d1 === 30) d2 = 30;
    return ((yy2 - yy1) * 360 + (m2 - m1) * 30 + (d2 - d1)) / 360;
  });
  def('NETWORKDAYS', function (start, end, holidays) {
    var s = num(start), e = num(end), sign = 1;
    if (s > e) { var t = s; s = e; e = t; sign = -1; }
    var hol = [];
    if (holidays !== undefined && holidays !== null) flat(holidays).forEach(function (h) { if (typeof h === 'number') hol.push(Math.round(h)); });
    var n = 0;
    for (var d = Math.round(s); d <= Math.round(e); d++) {
      var w = serialToDate(d).getUTCDay();
      if (w === 0 || w === 6) continue;
      if (hol.indexOf(d) >= 0) continue;
      n++;
    }
    return n * sign;
  });

  /* --- финансы --- */
  def('NPV', function () {
    var a = [].slice.call(arguments), r = num(a[0]);
    var vals = collectNums(a.slice(1)), s = 0;
    for (var i = 0; i < vals.length; i++) s += vals[i] / Math.pow(1 + r, i + 1);
    return s;
  });
  def('IRR', function (values, guess) {
    var v = collectNums([values]);
    if (v.length < 2) return ERR.num();
    function npv(r) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i] / Math.pow(1 + r, i); return s; }
    var lo = -0.9999, hi = 10, flo = npv(lo), fhi = npv(hi);
    if (flo * fhi > 0) {
      var r0 = optNum(guess, 0.1);
      for (var k = 0; k < 100; k++) {
        var f = npv(r0), df = (npv(r0 + 1e-6) - f) / 1e-6;
        if (Math.abs(df) < 1e-12) break;
        var r1 = r0 - f / df;
        if (!isFinite(r1)) break;
        if (Math.abs(r1 - r0) < 1e-10) return r1;
        r0 = r1;
      }
      return ERR.num();
    }
    for (var it = 0; it < 200; it++) {
      var mid = (lo + hi) / 2, fm = npv(mid);
      if (Math.abs(fm) < 1e-12) return mid;
      if (flo * fm < 0) { hi = mid; fhi = fm; } else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  });
  def('XNPV', function (rate, values, dates) {
    var r = num(rate), v = collectNums([values]), d = collectNums([dates]);
    if (v.length !== d.length || !v.length) return ERR.num();
    var s = 0;
    for (var i = 0; i < v.length; i++) s += v[i] / Math.pow(1 + r, (d[i] - d[0]) / 365);
    return s;
  });
  def('XIRR', function (values, dates, guess) {
    var v = collectNums([values]), d = collectNums([dates]);
    if (v.length !== d.length || v.length < 2) return ERR.num();
    function f(r) { var s = 0; for (var i = 0; i < v.length; i++) s += v[i] / Math.pow(1 + r, (d[i] - d[0]) / 365); return s; }
    var lo = -0.9999, hi = 100, flo = f(lo);
    if (flo * f(hi) > 0) return ERR.num();
    for (var it = 0; it < 300; it++) {
      var mid = (lo + hi) / 2, fm = f(mid);
      if (Math.abs(fm) < 1e-10) return mid;
      if (flo * fm < 0) hi = mid; else { lo = mid; flo = fm; }
    }
    return (lo + hi) / 2;
  });
  function pmtCalc(rate, nper, pv, fv, type) {
    if (rate === 0) return -(pv + fv) / nper;
    var p = Math.pow(1 + rate, nper);
    return -(pv * p + fv) * rate / ((p - 1) * (1 + rate * type));
  }
  def('PMT', function (rate, nper, pv, fv, type) {
    return pmtCalc(num(rate), num(nper), num(pv), optNum(fv, 0), optNum(type, 0));
  });
  def('FV', function (rate, nper, pmt, pv, type) {
    var r = num(rate), n = num(nper), p = num(pmt), v = optNum(pv, 0), t = optNum(type, 0);
    if (r === 0) return -(v + p * n);
    var q = Math.pow(1 + r, n);
    return -(v * q + p * (1 + r * t) * (q - 1) / r);
  });
  def('PV', function (rate, nper, pmt, fv, type) {
    var r = num(rate), n = num(nper), p = num(pmt), f = optNum(fv, 0), t = optNum(type, 0);
    if (r === 0) return -(f + p * n);
    var q = Math.pow(1 + r, n);
    return -(f + p * (1 + r * t) * (q - 1) / r) / q;
  });
  def('NPER', function (rate, pmt, pv, fv, type) {
    var r = num(rate), p = num(pmt), v = num(pv), f = optNum(fv, 0), t = optNum(type, 0);
    if (r === 0) return -(v + f) / p;
    var a = p * (1 + r * t) - f * r, b = v * r + p * (1 + r * t);
    if (a / b <= 0) return ERR.num();
    return Math.log(a / b) / Math.log(1 + r);
  });
  def('RATE', function (nper, pmt, pv, fv, type, guess) {
    var n = num(nper), p = num(pmt), v = num(pv), f = optNum(fv, 0), t = optNum(type, 0);
    var r = optNum(guess, 0.1);
    function g(x) {
      if (x === 0) return v + p * n + f;
      var q = Math.pow(1 + x, n);
      return v * q + p * (1 + x * t) * (q - 1) / x + f;
    }
    for (var i = 0; i < 200; i++) {
      var y = g(r), dy = (g(r + 1e-7) - y) / 1e-7;
      if (Math.abs(dy) < 1e-14) break;
      var r2 = r - y / dy;
      if (!isFinite(r2)) break;
      if (Math.abs(r2 - r) < 1e-12) return r2;
      r = r2;
    }
    return Math.abs(g(r)) < 1e-6 ? r : ERR.num();
  });

  /* --- информационные --- */
  def('ISNUMBER', function (v) { return typeof single(v) === 'number'; }, { passErrors: true });
  def('ISTEXT', function (v) { return typeof single(v) === 'string' && single(v) !== ''; }, { passErrors: true });
  def('ISBLANK', function (v) { return isBlank(single(v)); }, { passErrors: true });
  def('ISERROR', function (v) { return isErr(single(v)); }, { passErrors: true });
  def('ISNA', function (v) { var x = single(v); return isErr(x) && x.type === '#N/A'; }, { passErrors: true });
  def('NA', function () { return ERR.na(); });
  def('N', function (v) { var x = single(v); if (typeof x === 'number') return x; if (typeof x === 'boolean') return x ? 1 : 0; return 0; });

  /* ------------------------------------------- перенос формулы при копировании */
  // Сдвигает относительные ссылки на dRow/dCol, уважая знаки $.
  function translate(src, dRow, dCol) {
    var out = '', i = 0, n = src.length;
    while (i < n) {
      var c = src[i];
      if (c === '"') { // строковый литерал — не трогаем
        var j = i + 1;
        while (j < n) {
          if (src[j] === '"') { if (src[j + 1] === '"') { j += 2; continue; } break; }
          j++;
        }
        out += src.slice(i, j + 1); i = j + 1; continue;
      }
      var m = /^(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})(?![A-Za-zА-Яа-яЁё0-9_(])/.exec(src.slice(i));
      if (m && !/[A-Za-zА-Яа-яЁё0-9_$.]/.test(src[i - 1] || '')) {
        var absC = m[1] === '$', absR = m[3] === '$';
        var col = lettersToCol(m[2]), row = parseInt(m[4], 10) - 1;
        if (!absC) col += dCol;
        if (!absR) row += dRow;
        if (col < 0 || row < 0) out += '#REF!';
        else out += (absC ? '$' : '') + colToLetters(col) + (absR ? '$' : '') + (row + 1);
        i += m[0].length; continue;
      }
      out += c; i++;
    }
    return out;
  }

  /* ------------------------------------------------------------- публичный API */
  var cache = {};
  function compile(src) {
    if (cache[src]) return cache[src];
    var ast = parse(src);
    cache[src] = ast;
    return ast;
  }

  return {
    parse: parse, compile: compile, evaluate: evaluate, tokenize: tokenize, translate: translate,
    XLError: XLError, isError: isErr, ERR: ERR, ERRORS: ERRORS,
    toNum: toNum, toStr: toStr, toBool: toBool, single: single, flat: flat,
    colToLetters: colToLetters, lettersToCol: lettersToCol, a1ToRC: a1ToRC, rcToA1: rcToA1,
    serialToDate: serialToDate, dateToSerial: dateToSerial, ymdToSerial: ymdToSerial,
    formatNumber: formatNumber, formatDate: formatDate,
    FUNCS: FUNCS, RU: RU, normFn: normFn, makeCriteria: makeCriteria, cmp: cmpValues
  };
});

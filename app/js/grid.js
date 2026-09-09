/* =============================================================================
 * grid.js — интерактивная таблица: навигация, ввод, протягивание, доллары
 * Поведение клавиш повторяет Excel для macOS.
 * ========================================================================== */
(function (root) {
  'use strict';
  var XLF = root.XLF;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function Grid(host, sheet, opts) {
    this.host = host;
    this.sheet = sheet;
    this.opts = opts || {};
    this.rows = this.opts.rows || sheet.rows || 20;
    this.cols = this.opts.cols || sheet.cols || 10;
    this.sel = { r: 0, c: 0 };
    this.anchor = { r: 0, c: 0 };
    this.editing = null;      // {r, c, input}
    this.clipboard = null;
    this.onChange = this.opts.onChange || function () {};
    this.onSelect = this.opts.onSelect || function () {};
    this.build();
  }

  /* ------------------------------------------------------------- отрисовка */
  Grid.prototype.build = function () {
    var self = this;
    this.host.innerHTML = '';
    this.host.setAttribute('tabindex', '0');
    var table = el('table', 'sheet');
    var thead = el('thead'), hr = el('tr');
    hr.appendChild(el('th', '', ''));
    for (var c = 0; c < this.cols; c++) {
      var th = el('th', '', XLF.colToLetters(c));
      var w = this.sheet.colWidths[XLF.colToLetters(c)];
      th.style.width = (w || 92) + 'px';
      th.dataset.col = c;
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    var tbody = el('tbody');
    for (var r = 0; r < this.rows; r++) {
      var tr = el('tr');
      var rh = el('th', '', String(r + 1));
      rh.dataset.row = r;
      tr.appendChild(rh);
      for (var c2 = 0; c2 < this.cols; c2++) {
        var td = el('td');
        td.dataset.r = r; td.dataset.c = c2;
        td.appendChild(el('span', 'cv'));
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    this.host.appendChild(table);
    this.table = table;

    table.addEventListener('mousedown', function (e) { self.onMouseDown(e); });
    table.addEventListener('mouseover', function (e) { self.onMouseOver(e); });
    table.addEventListener('dblclick', function (e) {
      var td = e.target.closest('td');
      if (td) self.startEdit(+td.dataset.r, +td.dataset.c, null);
    });
    document.addEventListener('mouseup', function () { self.dragging = false; });
    this.host.addEventListener('keydown', function (e) { self.onKeyDown(e); });
    this.paint();
  };

  Grid.prototype.cellEl = function (r, c) {
    if (r < 0 || c < 0 || r >= this.rows || c >= this.cols) return null;
    return this.table.tBodies[0].rows[r].cells[c + 1];
  };

  Grid.prototype.range = function () {
    return {
      r1: Math.min(this.sel.r, this.anchor.r), r2: Math.max(this.sel.r, this.anchor.r),
      c1: Math.min(this.sel.c, this.anchor.c), c2: Math.max(this.sel.c, this.anchor.c)
    };
  };

  Grid.prototype.paint = function () {
    var rng = this.range();
    for (var r = 0; r < this.rows; r++) {
      for (var c = 0; c < this.cols; c++) {
        var td = this.cellEl(r, c);
        var cell = this.sheet.cell(r, c);
        var cls = [];
        var val = this.sheet.value(r, c);
        var align = this.sheet.alignOf(r, c);
        if (align === 'right') cls.push('num');
        if (align === 'center') cls.push('center');
        if (XLF.isError(val)) cls.push('err');
        if (cell && cell.style && cell.style.header) cls.push('hdr');
        if (cell && cell.style && cell.style.label) cls.push('label');
        if (cell && cell.locked && cell.kind !== 'empty') cls.push('locked');
        if (this.isTarget(r, c)) {
          cls.push('target');
          if (this.sheet.raw(r, c) !== '') cls.push('filled');
        }
        if (r >= rng.r1 && r <= rng.r2 && c >= rng.c1 && c <= rng.c2 && !(r === this.sel.r && c === this.sel.c)) cls.push('inrange');
        if (r === this.sel.r && c === this.sel.c) cls.push('sel');
        td.className = cls.join(' ');
        if (!this.editing || this.editing.r !== r || this.editing.c !== c) {
          td.firstChild.textContent = this.sheet.display(r, c);
        }
      }
    }
    // подсветка заголовков
    var ths = this.table.tHead.rows[0].cells;
    for (var i = 1; i < ths.length; i++) ths[i].className = (i - 1 >= rng.c1 && i - 1 <= rng.c2) ? 'hl' : '';
    var rws = this.table.tBodies[0].rows;
    for (var j = 0; j < rws.length; j++) rws[j].cells[0].className = (j >= rng.r1 && j <= rng.r2) ? 'hl' : '';
    this.onSelect(this.selectionInfo());
  };

  Grid.prototype.isTarget = function (r, c) {
    if (!this.opts.targets) return false;
    return this.opts.targets.indexOf(XLF.rcToA1(r, c)) >= 0;
  };
  Grid.prototype.canEdit = function (r, c) {
    if (this.opts.readOnly) return false;
    if (this.opts.targets) return this.isTarget(r, c);
    return !this.sheet.isLocked(r, c);
  };

  Grid.prototype.selectionInfo = function () {
    var rng = this.range(), nums = [], count = 0, self = this;
    for (var r = rng.r1; r <= rng.r2; r++) for (var c = rng.c1; c <= rng.c2; c++) {
      var v = self.sheet.value(r, c);
      if (v !== null && v !== undefined && v !== '') count++;
      if (typeof v === 'number') nums.push(v);
    }
    var sum = nums.reduce(function (a, b) { return a + b; }, 0);
    return {
      addr: XLF.rcToA1(this.sel.r, this.sel.c),
      rangeAddr: (rng.r1 === rng.r2 && rng.c1 === rng.c2) ? XLF.rcToA1(rng.r1, rng.c1)
        : XLF.rcToA1(rng.r1, rng.c1) + ':' + XLF.rcToA1(rng.r2, rng.c2),
      raw: this.sheet.raw(this.sel.r, this.sel.c),
      editable: this.canEdit(this.sel.r, this.sel.c),
      count: count, numCount: nums.length, sum: sum,
      avg: nums.length ? sum / nums.length : null,
      min: nums.length ? Math.min.apply(null, nums) : null,
      max: nums.length ? Math.max.apply(null, nums) : null
    };
  };

  /* ------------------------------------------------------------ выделение */
  Grid.prototype.select = function (r, c, extend) {
    r = Math.max(0, Math.min(this.rows - 1, r));
    c = Math.max(0, Math.min(this.cols - 1, c));
    this.sel = { r: r, c: c };
    if (!extend) this.anchor = { r: r, c: c };
    this.paint();
    this.scrollIntoView();
  };

  Grid.prototype.scrollIntoView = function () {
    var td = this.cellEl(this.sel.r, this.sel.c);
    if (!td) return;
    var wrap = this.host;
    var tdTop = td.offsetTop, tdLeft = td.offsetLeft;
    var hh = 26, rw = 44;
    if (tdTop - hh < wrap.scrollTop) wrap.scrollTop = Math.max(0, tdTop - hh - 2);
    else if (tdTop + td.offsetHeight > wrap.scrollTop + wrap.clientHeight) wrap.scrollTop = tdTop + td.offsetHeight - wrap.clientHeight + 2;
    if (tdLeft - rw < wrap.scrollLeft) wrap.scrollLeft = Math.max(0, tdLeft - rw - 2);
    else if (tdLeft + td.offsetWidth > wrap.scrollLeft + wrap.clientWidth) wrap.scrollLeft = tdLeft + td.offsetWidth - wrap.clientWidth + 2;
  };

  // Прыжок к краю данных — как ⌘+стрелка в Excel
  Grid.prototype.jump = function (dr, dc, extend) {
    var r = this.sel.r, c = this.sel.c;
    var has = function (rr, cc) {
      var v = this.sheet.raw(rr, cc);
      return v !== '' && v !== null && v !== undefined;
    }.bind(this);
    var maxR = this.rows - 1, maxC = this.cols - 1;
    var nr = r, nc = c;
    if (has(r + dr, c + dc)) {
      while (nr + dr >= 0 && nr + dr <= maxR && nc + dc >= 0 && nc + dc <= maxC && has(nr + dr, nc + dc)) {
        nr += dr; nc += dc;
      }
    } else {
      var moved = false;
      while (nr + dr >= 0 && nr + dr <= maxR && nc + dc >= 0 && nc + dc <= maxC) {
        nr += dr; nc += dc; moved = true;
        if (has(nr, nc)) break;
      }
      if (!moved) { nr = r; nc = c; }
    }
    this.select(nr, nc, extend);
  };

  /* ----------------------------------------------------------- мышь */
  Grid.prototype.onMouseDown = function (e) {
    var td = e.target.closest('td');
    if (!td) return;
    var r = +td.dataset.r, c = +td.dataset.c;
    // при вводе формулы клик по ячейке подставляет ссылку — как в Excel
    if (this.editing && this.acceptsRef()) {
      e.preventDefault();
      this.insertRef(r, c);
      return;
    }
    if (this.editing) this.commitEdit();
    this.host.focus();
    this.select(r, c, e.shiftKey);
    this.dragging = true;
    e.preventDefault();
  };
  Grid.prototype.onMouseOver = function (e) {
    if (!this.dragging) return;
    var td = e.target.closest('td');
    if (!td) return;
    this.sel = { r: +td.dataset.r, c: +td.dataset.c };
    this.paint();
  };

  /* ------------------------------------------------------------ ввод */
  Grid.prototype.startEdit = function (r, c, initial) {
    if (!this.canEdit(r, c)) {
      this.flash('Эта ячейка — исходные данные, её менять нельзя');
      return;
    }
    if (this.editing) this.commitEdit();
    this.select(r, c);
    var td = this.cellEl(r, c);
    var input = el('input', 'cell-input');
    input.value = initial !== null && initial !== undefined ? initial : this.sheet.raw(r, c);
    td.innerHTML = '';
    td.appendChild(input);
    this.editing = { r: r, c: c, input: input };
    var self = this;
    input.addEventListener('keydown', function (e) { self.onEditKey(e); });
    input.addEventListener('input', function () { self.onChange({ type: 'editing', text: input.value }); });
    input.focus();
    if (initial === null || initial === undefined) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
    this.onChange({ type: 'editing', text: input.value });
  };

  Grid.prototype.commitEdit = function () {
    if (!this.editing) return;
    var e = this.editing, text = e.input.value;
    if (text !== this.sheet.raw(e.r, e.c)) this.snapshot();
    this.editing = null;
    this.sheet.set(e.r, e.c, text, { locked: false });
    var td = this.cellEl(e.r, e.c);
    td.innerHTML = '';
    td.appendChild(el('span', 'cv'));
    this.paint();
    this.onChange({ type: 'commit', r: e.r, c: e.c, text: text });
  };

  Grid.prototype.cancelEdit = function () {
    if (!this.editing) return;
    var e = this.editing;
    this.editing = null;
    var td = this.cellEl(e.r, e.c);
    td.innerHTML = '';
    td.appendChild(el('span', 'cv'));
    this.paint();
    this.onChange({ type: 'cancel' });
  };

  // можно ли сейчас подставить ссылку кликом
  Grid.prototype.acceptsRef = function () {
    if (!this.editing) return false;
    var v = this.editing.input.value;
    if (v.charAt(0) !== '=') return false;
    var pos = this.editing.input.selectionStart;
    var before = v.slice(0, pos).replace(/\s+$/, '');
    return /[=+\-*/^(,;:<>&]$/.test(before) || before === '=';
  };
  Grid.prototype.insertRef = function (r, c) {
    var input = this.editing.input;
    var pos = input.selectionStart;
    var ref = XLF.rcToA1(r, c);
    input.value = input.value.slice(0, pos) + ref + input.value.slice(input.selectionEnd);
    input.setSelectionRange(pos + ref.length, pos + ref.length);
    input.focus();
    this.onChange({ type: 'editing', text: input.value });
  };

  /* ---------------------------------------- переключение $ (⌘T в Excel Mac) */
  function cycleAnchors(text, caret) {
    var re = /(\$?)([A-Za-z]{1,3})(\$?)([0-9]{1,7})/g, m;
    var best = null;
    while ((m = re.exec(text))) {
      var s = m.index, e = m.index + m[0].length;
      if (caret >= s && caret <= e) { best = { s: s, e: e, m: m }; break; }
      if (e < caret) best = { s: s, e: e, m: m };
    }
    if (!best) return null;
    var col = best.m[2], row = best.m[4];
    var state = (best.m[1] ? 1 : 0) + (best.m[3] ? 2 : 0); // 0:A1 3:$A$1 2:A$1 1:$A1
    var next;
    if (state === 0) next = '$' + col + '$' + row;
    else if (state === 3) next = col + '$' + row;
    else if (state === 2) next = '$' + col + row;
    else next = col + row;
    return { text: text.slice(0, best.s) + next + text.slice(best.e), caret: best.s + next.length };
  }
  Grid.prototype.toggleAnchor = function () {
    if (!this.editing) return;
    var input = this.editing.input;
    var res = cycleAnchors(input.value, input.selectionStart);
    if (!res) return;
    input.value = res.text;
    input.setSelectionRange(res.caret, res.caret);
    this.onChange({ type: 'editing', text: input.value });
  };

  /* ------------------------------------------------ клавиши в режиме ввода */
  Grid.prototype.onEditKey = function (e) {
    var k = e.key;
    if (k === 'Enter') {
      e.preventDefault();
      this.commitEdit();
      this.host.focus();
      this.select(this.sel.r + (e.shiftKey ? -1 : 1), this.sel.c);
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      this.commitEdit();
      this.host.focus();
      this.select(this.sel.r, this.sel.c + (e.shiftKey ? -1 : 1));
      return;
    }
    if (k === 'Escape') { e.preventDefault(); this.cancelEdit(); this.host.focus(); return; }
    if ((k === 't' || k === 'T' || k === 'F4') && (e.metaKey || e.ctrlKey || k === 'F4')) {
      e.preventDefault(); this.toggleAnchor(); return;
    }
    // стрелки внутри формулы не двигают курсор по листу — как в Excel при вводе
    e.stopPropagation();
  };

  /* ------------------------------------------------------ клавиши на листе */
  Grid.prototype.onKeyDown = function (e) {
    if (this.editing) return;
    var k = e.key, mod = e.metaKey || e.ctrlKey, shift = e.shiftKey;

    if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); this.fill('down'); return; }
    if (mod && (k === 'r' || k === 'R')) { e.preventDefault(); this.fill('right'); return; }
    if (mod && (k === 'c' || k === 'C')) { e.preventDefault(); this.copy(); return; }
    if (mod && (k === 'v' || k === 'V')) { e.preventDefault(); this.paste(); return; }
    if (mod && (k === 'x' || k === 'X')) { e.preventDefault(); this.copy(); this.clearSelection(); return; }
    if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); this.undo(); return; }

    switch (k) {
      case 'ArrowUp': e.preventDefault(); mod ? this.jump(-1, 0, shift) : this.select(this.sel.r - 1, this.sel.c, shift); return;
      case 'ArrowDown': e.preventDefault(); mod ? this.jump(1, 0, shift) : this.select(this.sel.r + 1, this.sel.c, shift); return;
      case 'ArrowLeft': e.preventDefault(); mod ? this.jump(0, -1, shift) : this.select(this.sel.r, this.sel.c - 1, shift); return;
      case 'ArrowRight': e.preventDefault(); mod ? this.jump(0, 1, shift) : this.select(this.sel.r, this.sel.c + 1, shift); return;
      case 'Home': e.preventDefault(); this.select(mod ? 0 : this.sel.r, 0, shift); return;
      case 'Enter': e.preventDefault(); this.startEdit(this.sel.r, this.sel.c, null); return;
      case 'F2': e.preventDefault(); this.startEdit(this.sel.r, this.sel.c, null); return;
      case 'Tab': e.preventDefault(); this.select(this.sel.r, this.sel.c + (shift ? -1 : 1)); return;
      case 'Delete': case 'Backspace': e.preventDefault(); this.clearSelection(); return;
      case 'Escape': this.anchor = { r: this.sel.r, c: this.sel.c }; this.paint(); return;
    }
    // печатный символ — начинаем ввод
    if (!mod && !e.altKey && k.length === 1) {
      e.preventDefault();
      this.startEdit(this.sel.r, this.sel.c, k);
    }
  };

  /* --------------------------------------------------------- операции */
  Grid.prototype.snapshot = function () {
    this.undoStack = this.undoStack || [];
    this.undoStack.push(JSON.stringify(this.sheet.toJSON()));
    if (this.undoStack.length > 40) this.undoStack.shift();
  };
  Grid.prototype.undo = function () {
    if (!this.undoStack || !this.undoStack.length) return;
    var prev = JSON.parse(this.undoStack.pop());
    var self = this;
    // сбрасываем только редактируемые ячейки
    (this.opts.targets || []).forEach(function (a1) {
      var rc = XLF.a1ToRC(a1);
      self.sheet.set(rc.row, rc.col, prev[a1] || '', { locked: false });
    });
    this.paint();
    this.onChange({ type: 'undo' });
  };

  Grid.prototype.clearSelection = function () {
    var rng = this.range(), changed = false;
    this.snapshot();
    for (var r = rng.r1; r <= rng.r2; r++) for (var c = rng.c1; c <= rng.c2; c++) {
      if (!this.canEdit(r, c)) continue;
      this.sheet.set(r, c, '', { locked: false });
      changed = true;
    }
    if (!changed) this.flash('Здесь нечего очищать: это исходные данные');
    this.paint();
    this.onChange({ type: 'clear' });
  };

  Grid.prototype.fill = function (dir) {
    var rng = this.range();
    if (dir === 'down' && rng.r1 === rng.r2) { this.flash('Выделите диапазон: верхняя ячейка — источник'); return; }
    if (dir === 'right' && rng.c1 === rng.c2) { this.flash('Выделите диапазон: левая ячейка — источник'); return; }
    this.snapshot();
    var filled = 0;
    for (var r = rng.r1; r <= rng.r2; r++) {
      for (var c = rng.c1; c <= rng.c2; c++) {
        var sr = dir === 'down' ? rng.r1 : r;
        var sc = dir === 'down' ? c : rng.c1;
        if (r === sr && c === sc) continue;
        if (!this.canEdit(r, c)) continue;
        var src = this.sheet.raw(sr, sc);
        var out = src;
        if (typeof src === 'string' && src.charAt(0) === '=') {
          out = '=' + XLF.translate(src.slice(1), r - sr, c - sc);
        }
        this.sheet.set(r, c, out, { locked: false });
        filled++;
      }
    }
    this.paint();
    this.onChange({ type: 'fill', count: filled });
    if (filled) this.flash('Заполнено ячеек: ' + filled);
  };

  Grid.prototype.copy = function () {
    var rng = this.range(), data = [];
    for (var r = rng.r1; r <= rng.r2; r++) {
      var row = [];
      for (var c = rng.c1; c <= rng.c2; c++) row.push(this.sheet.raw(r, c));
      data.push(row);
    }
    this.clipboard = { data: data, r: rng.r1, c: rng.c1 };
    this.flash('Скопировано: ' + (rng.r2 - rng.r1 + 1) + '×' + (rng.c2 - rng.c1 + 1));
  };

  Grid.prototype.paste = function () {
    if (!this.clipboard) { this.flash('Буфер пуст — сначала ⌘C'); return; }
    this.snapshot();
    var cb = this.clipboard, base = this.sel, pasted = 0;
    for (var i = 0; i < cb.data.length; i++) {
      for (var j = 0; j < cb.data[i].length; j++) {
        var r = base.r + i, c = base.c + j;
        if (!this.canEdit(r, c)) continue;
        var src = cb.data[i][j], out = src;
        if (typeof src === 'string' && src.charAt(0) === '=') {
          out = '=' + XLF.translate(src.slice(1), r - (cb.r + i), c - (cb.c + j));
        }
        this.sheet.set(r, c, out, { locked: false });
        pasted++;
      }
    }
    this.paint();
    this.onChange({ type: 'paste', count: pasted });
  };

  Grid.prototype.setCell = function (a1, text) {
    var rc = XLF.a1ToRC(a1);
    if (!rc) return;
    this.sheet.set(rc.row, rc.col, text, { locked: false });
    this.paint();
    this.onChange({ type: 'commit', r: rc.row, c: rc.col, text: text });
  };

  Grid.prototype.flash = function (msg) {
    if (this.opts.onFlash) this.opts.onFlash(msg);
  };

  Grid.prototype.focus = function () { this.host.focus(); };

  root.XLGrid = Grid;
  root.XLGrid.cycleAnchors = cycleAnchors;
})(typeof self !== 'undefined' ? self : this);

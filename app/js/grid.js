/* =============================================================================
 * grid.js — the interactive sheet: navigation, editing, filling, dollars
 * The keyboard behaves the way Excel for macOS behaves.
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

  /* --------------------------------------------------------------- drawing */
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
    this.headRow = hr;
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

  // The filter buttons live in the header row of the attached table.
  Grid.prototype.paintFilterButtons = function () {
    var self = this, t = this.sheet.table;
    var body = this.table.tBodies[0];
    if (!t || !this.filtersOn) {
      var old = this.table.querySelectorAll('.filter-btn');
      Array.prototype.forEach.call(old, function (b) { b.remove(); });
      return;
    }
    for (var c = t.c1; c <= t.c2; c++) {
      var cell = body.rows[t.r1] && body.rows[t.r1].cells[c + 1];
      if (!cell) continue;
      if (cell.querySelector('.filter-btn')) continue;
      var btn = el('button', 'filter-btn', '▾');
      btn.dataset.col = c;
      btn.title = 'Sort and filter this column';
      cell.appendChild(btn);
    }
    Array.prototype.forEach.call(this.table.querySelectorAll('.filter-btn'), function (b) {
      b.classList.toggle('active', !!self.sheet.filters[b.dataset.col]);
      if (b.__wired) return;
      b.__wired = true;
      b.addEventListener('mousedown', function (e) { e.stopPropagation(); });
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        self.openFilterMenu(+b.dataset.col, b);
      });
    });
  };

  Grid.prototype.setFiltersOn = function (on) {
    this.filtersOn = !!on;
    if (!on) { this.sheet.clearFilters(); }
    this.paint();
  };

  Grid.prototype.openFilterMenu = function (col, anchor) {
    var self = this;
    this.closeFilterMenu();
    var values = this.sheet.columnValues(col);
    var active = this.sheet.filters[col];
    var chosen = active ? active.values.slice() : values.slice();
    var menu = el('div', 'filter-menu');
    menu.innerHTML =
      '<button class="fm-item" data-act="asc">Sort A → Z  (smallest first)</button>' +
      '<button class="fm-item" data-act="desc">Sort Z → A  (largest first)</button>' +
      '<div class="fm-sep"></div>' +
      '<div class="fm-list"></div>' +
      '<div class="fm-actions">' +
        '<button class="btn btn-primary fm-ok">Apply</button>' +
        '<button class="btn fm-clear">Clear filter</button>' +
      '</div>';
    var list = menu.querySelector('.fm-list');
    var allBox = el('label', 'fm-opt');
    allBox.innerHTML = '<input type="checkbox" checked> <b>(Select all)</b>';
    list.appendChild(allBox);
    values.forEach(function (v) {
      var lab = el('label', 'fm-opt');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = chosen.indexOf(v) >= 0;
      cb.value = v;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + (v === '' ? '(blank)' : v)));
      list.appendChild(lab);
    });
    allBox.querySelector('input').addEventListener('change', function (e) {
      Array.prototype.forEach.call(list.querySelectorAll('input'), function (cb) { cb.checked = e.target.checked; });
    });
    menu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    menu.addEventListener('click', function (e) {
      var act = e.target.closest('[data-act]');
      if (act) {
        self.sheet.sortBy(col, act.dataset.act === 'asc');
        self.closeFilterMenu();
        self.paint();
        self.flash('Sorted by column ' + XLF.colToLetters(col));
        return;
      }
      if (e.target.closest('.fm-ok')) {
        var picked = [];
        Array.prototype.forEach.call(list.querySelectorAll('input'), function (cb, i) {
          if (i > 0 && cb.checked) picked.push(cb.value);
        });
        if (picked.length === values.length) self.sheet.setFilter(col, null);
        else self.sheet.setFilter(col, picked);
        self.closeFilterMenu();
        self.paint();
        self.flash(picked.length === values.length ? 'Filter cleared' : 'Filter applied: ' + picked.length + ' of ' + values.length + ' values');
        return;
      }
      if (e.target.closest('.fm-clear')) {
        self.sheet.setFilter(col, null);
        self.closeFilterMenu();
        self.paint();
        self.flash('Filter cleared');
      }
    });
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, window.innerWidth - 260) + 'px';
    menu.style.top = (r.bottom + 4) + 'px';
    this.filterMenu = menu;
    this._closeOnClick = function () { self.closeFilterMenu(); };
    setTimeout(function () { document.addEventListener('mousedown', self._closeOnClick); }, 0);
  };

  Grid.prototype.closeFilterMenu = function () {
    if (this.filterMenu) { this.filterMenu.remove(); this.filterMenu = null; }
    if (this._closeOnClick) { document.removeEventListener('mousedown', this._closeOnClick); this._closeOnClick = null; }
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
    // rows hidden by the filter disappear from view but stay in the sheet
    var bodyRows = this.table.tBodies[0].rows;
    for (var hr2 = 0; hr2 < bodyRows.length; hr2++) {
      bodyRows[hr2].classList.toggle('row-hidden', this.sheet.isHidden(hr2));
    }
    this.paintFilterButtons();

    // header highlighting
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

  /* ------------------------------------------------------------- selection */
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

  // Jump to the edge of the data — ⌘+arrow in Excel
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

  /* ------------------------------------------------------------------ mouse */
  Grid.prototype.onMouseDown = function (e) {
    var td = e.target.closest('td');
    if (!td) return;
    var r = +td.dataset.r, c = +td.dataset.c;
    // while typing a formula, clicking a cell inserts its address, as in Excel
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

  /* ---------------------------------------------------------------- editing */
  Grid.prototype.startEdit = function (r, c, initial) {
    if (!this.canEdit(r, c)) {
      this.flash('That cell holds source data and cannot be changed');
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

  // can a clicked address be inserted right now?
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

  /* ------------------------------------- cycling the $ signs (⌘T on Excel Mac) */
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

  /* ------------------------------------------------- keys while editing a cell */
  Grid.prototype.onEditKey = function (e) {
    var k = e.key;
    // Every key handled here must stop bubbling: otherwise the sheet-level
    // handler sees the same Enter, finds editing already closed, and instantly
    // reopens the editor one cell down.
    if (k === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      this.commitEdit();
      this.host.focus();
      this.select(this.sel.r + (e.shiftKey ? -1 : 1), this.sel.c);
      return;
    }
    if (k === 'Tab') {
      e.preventDefault();
      e.stopPropagation();
      this.commitEdit();
      this.host.focus();
      this.select(this.sel.r, this.sel.c + (e.shiftKey ? -1 : 1));
      return;
    }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); this.cancelEdit(); this.host.focus(); return; }
    if ((k === 't' || k === 'T' || k === 'F4') && (e.metaKey || e.ctrlKey || k === 'F4')) {
      e.preventDefault(); e.stopPropagation(); this.toggleAnchor(); return;
    }
    // arrows move inside the formula, not around the sheet, as in Excel
    e.stopPropagation();
  };

  /* ------------------------------------------------------ keys on the sheet */
  Grid.prototype.onKeyDown = function (e) {
    if (this.editing) return;
    var k = e.key, mod = e.metaKey || e.ctrlKey, shift = e.shiftKey;

    if (mod && (k === 'd' || k === 'D')) { e.preventDefault(); this.fill('down'); return; }
    if (mod && (k === 'r' || k === 'R')) { e.preventDefault(); this.fill('right'); return; }
    if (mod && (k === 'c' || k === 'C')) { e.preventDefault(); this.copy(); return; }
    if (mod && (k === 'v' || k === 'V')) { e.preventDefault(); this.paste(); return; }
    if (mod && (k === 'x' || k === 'X')) { e.preventDefault(); this.copy(); this.clearSelection(); return; }
    if (mod && (k === 'z' || k === 'Z')) { e.preventDefault(); this.undo(); return; }
    if (mod && shift && (k === 'f' || k === 'F')) {
      e.preventDefault();
      if (!this.sheet.table) { this.flash('This task has no data table to filter'); return; }
      this.setFiltersOn(!this.filtersOn);
      this.flash(this.filtersOn ? 'Filter on — click the arrows in the header row' : 'Filter off');
      return;
    }

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
    // a printable character starts editing
    if (!mod && !e.altKey && k.length === 1) {
      e.preventDefault();
      this.startEdit(this.sel.r, this.sel.c, k);
    }
  };

  /* ------------------------------------------------------------- operations */
  Grid.prototype.snapshot = function () {
    this.undoStack = this.undoStack || [];
    this.undoStack.push(JSON.stringify(this.sheet.toJSON()));
    if (this.undoStack.length > 40) this.undoStack.shift();
  };
  Grid.prototype.undo = function () {
    if (!this.undoStack || !this.undoStack.length) return;
    var prev = JSON.parse(this.undoStack.pop());
    var self = this;
    // only the editable cells are rolled back
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
    if (!changed) this.flash('Nothing to clear here — this is source data');
    this.paint();
    this.onChange({ type: 'clear' });
  };

  Grid.prototype.fill = function (dir) {
    var rng = this.range();
    if (dir === 'down' && rng.r1 === rng.r2) { this.flash('Select a range first — the top cell is the source'); return; }
    if (dir === 'right' && rng.c1 === rng.c2) { this.flash('Select a range first — the left cell is the source'); return; }
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
    if (filled) this.flash(filled + ' cell' + (filled === 1 ? '' : 's') + ' filled');
  };

  // On a phone there is no ⌘D and no way to drag out a range, so one tap has to
  // do what double-clicking the fill handle does in Excel: run the formula down
  // (or across) as far as the neighbouring cells expect an answer.
  Grid.prototype.smartFill = function (dir) {
    var rng = this.range();
    var single = rng.r1 === rng.r2 && rng.c1 === rng.c2;
    if (single) {
      var r = rng.r1, c = rng.c1;
      if (this.sheet.raw(r, c) === '') {
        this.flash('Put a formula in this cell first, then fill');
        return;
      }
      if (dir === 'down') {
        var r2 = r;
        while (r2 + 1 < this.rows && this.canEdit(r2 + 1, c)) r2++;
        if (r2 === r) { this.flash('Nothing below this cell to fill into'); return; }
        this.anchor = { r: r, c: c };
        this.sel = { r: r2, c: c };
      } else {
        var c2 = c;
        while (c2 + 1 < this.cols && this.canEdit(r, c2 + 1)) c2++;
        if (c2 === c) { this.flash('Nothing to the right of this cell to fill into'); return; }
        this.anchor = { r: r, c: c };
        this.sel = { r: r, c: c2 };
      }
      this.paint();
    }
    this.fill(dir);
  };

  // The ⌘T cycle, usable from any text field — on a phone the formula bar is
  // where people type, not the cell itself.
  Grid.prototype.toggleAnchorIn = function (input) {
    if (!input || typeof input.selectionStart !== 'number') return false;
    var res = cycleAnchors(input.value, input.selectionStart);
    if (!res) return false;
    input.value = res.text;
    input.setSelectionRange(res.caret, res.caret);
    this.onChange({ type: 'editing', text: input.value });
    return true;
  };

  Grid.prototype.copy = function () {
    var rng = this.range(), data = [];
    for (var r = rng.r1; r <= rng.r2; r++) {
      var row = [];
      for (var c = rng.c1; c <= rng.c2; c++) row.push(this.sheet.raw(r, c));
      data.push(row);
    }
    this.clipboard = { data: data, r: rng.r1, c: rng.c1 };
    this.flash('Copied ' + (rng.r2 - rng.r1 + 1) + '×' + (rng.c2 - rng.c1 + 1));
  };

  Grid.prototype.paste = function () {
    if (!this.clipboard) { this.flash('Nothing copied yet — press ⌘C first'); return; }
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

/* =============================================================================
 * pivotui.js — the pivot table builder
 *
 * Laid out the way Excel lays it out: the report on the left, the PivotTable
 * Fields pane on the right with a tick list and the four areas underneath, and
 * a strip of the commands that live on the PivotTable Analyze and Design tabs.
 *
 * Fields are moved by dragging — from the list into an area, from one area to
 * another, up and down inside an area, and out of the pane to remove them —
 * and every drag has a menu equivalent, because Excel has one too and because
 * a menu can be driven from the keyboard.
 *
 * The report carries Excel's own furniture: Row Labels and Column Labels with
 * their sort-and-filter arrows, indented groups with subtotals, a Grand Total
 * row, and a Grand Total column only when there is something across the top to
 * total. A pivot works off a snapshot of the source, so there is a Refresh
 * button and it does something.
 * ========================================================================== */
(function (root) {
  'use strict';
  var PV = root.XLPivot;

  /* --------------------------------------------------------------- DOM --- */
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  // Closes open menus only. It must never touch a dialog: a menu item is what
  // opens most dialogs, and the menu's own "close on the next click outside"
  // listener would otherwise tear the dialog down as it was being used.
  function closeMenus() {
    Array.prototype.forEach.call(document.querySelectorAll('.pv-menu'), function (m) { m.remove(); });
  }
  function closeDialogs() {
    Array.prototype.forEach.call(document.querySelectorAll('.pv-modal-back'), function (m) { m.remove(); });
  }

  /* An Excel-style context menu: items, separators and submenus of ticks. */
  function popup(anchor, items) {
    closeMenus();
    var menu = el('div', 'pv-menu');
    items.forEach(function (it) {
      if (it === '-') { menu.appendChild(el('div', 'pv-sep')); return; }
      if (it.header) { menu.appendChild(el('div', 'pv-mhead', it.header)); return; }
      var row = el('button', 'pv-mitem' + (it.disabled ? ' disabled' : '') + (it.checked ? ' checked' : ''));
      row.appendChild(el('span', 'pv-mtick', it.checked ? '✓' : ''));
      row.appendChild(el('span', 'pv-mlabel', it.label));
      if (it.disabled) row.disabled = true;
      else row.addEventListener('click', function (e) {
        e.stopPropagation();
        closeMenus();
        it.run();
      });
      menu.appendChild(row);
    });
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(r.left, window.innerWidth - menu.offsetWidth - 10)) + 'px';
    menu.style.top = Math.min(r.bottom + 3, window.innerHeight - menu.offsetHeight - 10) + 'px';
    menu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    setTimeout(function () {
      document.addEventListener('mousedown', function off() {
        closeMenus();
        document.removeEventListener('mousedown', off);
      });
    }, 0);
    return menu;
  }

  /* A modal, for the dialogs Excel opens: Value Field Settings and Grouping. */
  function modal(title, build, onOk) {
    closeMenus();
    var back = el('div', 'pv-modal-back');
    var box = el('div', 'pv-modal');
    box.appendChild(el('div', 'pv-modal-h', title));
    var body = el('div', 'pv-modal-body');
    box.appendChild(body);
    var acts = el('div', 'pv-modal-actions');
    var ok = el('button', 'btn btn-primary pv-ok', 'OK');
    var cancel = el('button', 'btn pv-cancel', 'Cancel');
    acts.appendChild(ok); acts.appendChild(cancel);
    box.appendChild(acts);
    back.appendChild(box);
    document.body.appendChild(back);
    var api = build(body);
    // The dialog closes before its handler runs, because the handler re-renders
    // the report and a render closes whatever dialogs are open. A handler that
    // returns false is rejecting the input, so the dialog goes back up.
    ok.addEventListener('click', function () {
      back.remove();
      if (onOk(api) === false) document.body.appendChild(back);
    });
    cancel.addEventListener('click', function () { back.remove(); });
    back.addEventListener('mousedown', function (e) { if (e.target === back) back.remove(); });
    return back;
  }

  /* ------------------------------------------------------------ snapshot --- */
  // A pivot reads a copy of the source, which is why Excel makes you refresh it.
  function snapshot(sheet, ref) {
    var parts = String(ref || '').split(':');
    var XLF = root.XLF;
    var A = XLF.a1ToRC(parts[0]), B = XLF.a1ToRC(parts[1] || parts[0]);
    var store = {};
    if (A && B) {
      for (var r = Math.min(A.row, B.row); r <= Math.max(A.row, B.row); r++) {
        for (var c = Math.min(A.col, B.col); c <= Math.max(A.col, B.col); c++) {
          var cell = sheet.cell(r, c);
          store[r + ':' + c] = {
            v: sheet.value(r, c), t: sheet.display(r, c),
            fmt: cell ? cell.fmt : null
          };
        }
      }
    }
    return {
      store: store,
      stamp: JSON.stringify(store),
      cell: function (r, c) { var s = store[r + ':' + c]; return s ? { fmt: s.fmt } : null; },
      value: function (r, c) { var s = store[r + ':' + c]; return s ? s.v : null; },
      display: function (r, c) { var s = store[r + ':' + c]; return s ? s.t : ''; }
    };
  }

  /* ========================================================================
   * PivotBuilder
   * ===================================================================== */
  function PivotBuilder(host, sheet, source, onChange, opts) {
    opts = opts || {};
    this.host = host;
    this.sheet = sheet;
    this.source = source || '';
    this.defaultSource = this.source;
    this.onChange = onChange || function () {};
    // A scratch pivot is the tool sitting beside a question that is answered in
    // the sheet: nothing in it is marked, it is there to work an answer out.
    this.scratch = !!opts.scratch;
    this.config = this.blank();
    this.readFields();
    this.paneOpen = true;
    this.drag = null;
    this.render();
  }

  PivotBuilder.prototype.readFields = function () {
    this.snap = snapshot(this.sheet, this.source);
    var src = PV.readSource(this.snap, this.source);
    this.fields = src.fields;
    this.kinds = src.kinds;
    this.rowsInSource = src.rows.length;
  };

  // Excel's Change Data Source. Fields that the new range does not have are
  // dropped from the areas; everything else stays where it was put.
  PivotBuilder.prototype.setSource = function (ref) {
    var self = this;
    this.source = String(ref || '').toUpperCase().replace(/\$/g, '');
    this.readFields();
    function known(name) { return self.fields.indexOf(name) >= 0; }
    ['rows', 'cols'].forEach(function (a) {
      self.config[a] = self.config[a].filter(function (e) { return known(typeof e === 'string' ? e : e.field); });
    });
    this.config.filters = this.config.filters.filter(function (f) { return known(f.field); });
    this.config.values = this.config.values.filter(function (v) { return v.calc || known(v.field); });
    this.render();
  };

  PivotBuilder.prototype.blank = function () {
    return { rows: [], cols: [], values: [], filters: [], layout: 'compact', subtotals: true, grandRow: true, grandCol: true };
  };
  PivotBuilder.prototype.getConfig = function () {
    var cfg = JSON.parse(JSON.stringify(this.config));
    if (this.source && this.source !== this.defaultSource) cfg.source = this.source;
    return cfg;
  };
  PivotBuilder.prototype.setConfig = function (cfg) {
    var b = this.blank();
    if (cfg.source && cfg.source !== this.source) {
      this.source = cfg.source;
      this.readFields();
    }
    this.config = {
      rows: JSON.parse(JSON.stringify(cfg.rows || [])),
      cols: JSON.parse(JSON.stringify(cfg.cols || [])),
      values: JSON.parse(JSON.stringify(cfg.values || [])),
      filters: JSON.parse(JSON.stringify(cfg.filters || [])),
      layout: cfg.layout || b.layout,
      subtotals: cfg.subtotals !== false,
      grandRow: cfg.grandRow !== false,
      grandCol: cfg.grandCol !== false
    };
    this.render();
  };
  PivotBuilder.prototype.reset = function () {
    this.config = this.blank();
    if (this.source !== this.defaultSource) { this.source = this.defaultSource; this.readFields(); }
    this.render();
  };
  PivotBuilder.prototype.refresh = function () {
    this.snap = snapshot(this.sheet, this.source);
    this.render();
  };
  PivotBuilder.prototype.isStale = function () {
    return snapshot(this.sheet, this.source).stamp !== this.snap.stamp;
  };

  /* ---------------------------------------------------- reading the config */
  PivotBuilder.prototype.entryField = function (area, i) {
    var it = this.config[area][i];
    if (area === 'values' || area === 'filters') return it.field;
    return typeof it === 'string' ? it : it.field;
  };
  PivotBuilder.prototype.entryCaption = function (area, i) {
    var it = this.config[area][i];
    if (area === 'values') return PV.specLabel(PV.resolveValue(it));
    if (area === 'filters') return it.field;
    return PV.resolveField(it).caption;
  };
  PivotBuilder.prototype.areaOf = function (field) {
    var self = this, found = null;
    ['filters', 'cols', 'rows', 'values'].forEach(function (a) {
      self.config[a].forEach(function (it, i) {
        if (found) return;
        if (self.entryField(a, i) === field) found = { area: a, index: i };
      });
    });
    return found;
  };
  PivotBuilder.prototype.inReport = function (field) { return !!this.areaOf(field); };

  // The tick lists must offer exactly the labels the report will show, so they
  // are built with the engine's own bucketing rather than a second copy of it.
  PivotBuilder.prototype.distinct = function (field, group) {
    var src = PV.readSource(this.snap, this.source), out = [], seen = {};
    var spec = PV.resolveField({ field: field, group: group });
    src.rows.forEach(function (rec) {
      var b = PV.groupKey(rec, spec);
      if (!seen[b.key]) { seen[b.key] = b; out.push(b); }
    });
    out.sort(function (a, b) {
      return root.XLF.cmp(a.sort === null ? a.label : a.sort, b.sort === null ? b.label : b.sort);
    });
    return out.map(function (b) { return b.key; });
  };

  /* ------------------------------------------------------ moving fields --- */
  PivotBuilder.prototype.defaultAgg = function (field) {
    return this.kinds[field] === 'number' ? 'sum' : 'count';
  };
  // Excel's rule: a field belongs to one area — except that a field may be
  // summarised in Values while it is still grouping the rows.
  PivotBuilder.prototype.add = function (area, field, at) {
    var c = this.config;
    if (area !== 'values') {
      ['rows', 'cols'].forEach(function (a) {
        c[a] = c[a].filter(function (it) { return (typeof it === 'string' ? it : it.field) !== field; });
      });
      c.filters = c.filters.filter(function (f) { return f.field !== field; });
    }
    var entry;
    if (area === 'values') entry = { field: field, agg: this.defaultAgg(field), show: 'raw' };
    else if (area === 'filters') entry = { field: field, values: this.distinct(field) };
    else entry = { field: field };
    if (typeof at === 'number' && at >= 0 && at <= c[area].length) c[area].splice(at, 0, entry);
    else c[area].push(entry);
    this.render();
  };
  PivotBuilder.prototype.remove = function (area, index) {
    this.config[area].splice(index, 1);
    this.render();
  };
  PivotBuilder.prototype.removeField = function (field) {
    var where = this.areaOf(field);
    while (where) { this.config[where.area].splice(where.index, 1); where = this.areaOf(field); }
    this.render();
  };
  PivotBuilder.prototype.move = function (from, index, to, at) {
    var item = this.config[from][index];
    var field = this.entryField(from, index);
    this.config[from].splice(index, 1);
    if (from === to) {
      var pos = (typeof at === 'number') ? (at > index ? at - 1 : at) : this.config[to].length;
      this.config[to].splice(pos, 0, item);
      this.render();
      return;
    }
    this.add(to, field, at);
  };
  PivotBuilder.prototype.shift = function (area, index, by) {
    var j = index + by;
    if (j < 0 || j >= this.config[area].length) return;
    var a = this.config[area];
    var t = a[index]; a[index] = a[j]; a[j] = t;
    this.render();
  };

  /* ============================== rendering ============================== */
  PivotBuilder.prototype.render = function () {
    var self = this;
    closeMenus();
    closeDialogs();
    this.host.innerHTML = '';
    var shell = el('div', 'pv-shell');
    shell.appendChild(this.renderRibbon());
    var body = el('div', 'pv-body' + (this.paneOpen ? '' : ' no-pane'));
    var report = el('div', 'pv-report');
    report.appendChild(this.renderReport());
    body.appendChild(report);
    if (this.paneOpen) body.appendChild(this.renderPane());
    shell.appendChild(body);
    this.host.appendChild(shell);

    // dropping a field anywhere outside the four areas takes it out of the report
    shell.addEventListener('dragover', function (e) {
      if (self.drag) e.preventDefault();
    });
    shell.addEventListener('drop', function (e) {
      if (self.drag && self.drag.from && !e.defaultPrevented) {
        e.preventDefault();
        self.remove(self.drag.from, self.drag.index);
        self.drag = null;
      }
    });
    this.onChange(this.getConfig());
  };

  /* ------------------------------------------------------------- ribbon --- */
  PivotBuilder.prototype.renderRibbon = function () {
    var self = this, c = this.config;
    var bar = el('div', 'pv-ribbon');
    function btn(label, title, run, cls) {
      var b = el('button', 'pv-rbtn' + (cls ? ' ' + cls : ''), label);
      b.title = title;
      b.addEventListener('click', run);
      bar.appendChild(b);
      return b;
    }
    var stale = this.isStale();
    var r = btn('↻ Refresh', 'Re-read the source data. A pivot works off a snapshot.',
      function () { self.refresh(); }, stale ? 'stale' : '');
    if (stale) r.textContent = '↻ Refresh (source data has changed)';

    btn('Report Layout ▾', 'Compact or Tabular form', function (e) {
      popup(e.currentTarget, [
        { label: 'Show in Compact Form', checked: c.layout === 'compact', run: function () { c.layout = 'compact'; self.render(); } },
        { label: 'Show in Tabular Form', checked: c.layout === 'tabular', run: function () { c.layout = 'tabular'; self.render(); } }
      ]);
    });
    btn('Subtotals ▾', 'Show or hide the subtotal of every group', function (e) {
      popup(e.currentTarget, [
        { label: 'Show all Subtotals', checked: c.subtotals !== false, run: function () { c.subtotals = true; self.render(); } },
        { label: 'Do Not Show Subtotals', checked: c.subtotals === false, run: function () { c.subtotals = false; self.render(); } }
      ]);
    });
    btn('Grand Totals ▾', 'Grand total row and column', function (e) {
      popup(e.currentTarget, [
        { label: 'On for Rows and Columns', checked: c.grandRow !== false && c.grandCol !== false,
          run: function () { c.grandRow = true; c.grandCol = true; self.render(); } },
        { label: 'On for Rows only', checked: c.grandRow !== false && c.grandCol === false,
          run: function () { c.grandRow = true; c.grandCol = false; self.render(); } },
        { label: 'On for Columns only', checked: c.grandRow === false && c.grandCol !== false,
          run: function () { c.grandRow = false; c.grandCol = true; self.render(); } },
        { label: 'Off for Rows and Columns', checked: c.grandRow === false && c.grandCol === false,
          run: function () { c.grandRow = false; c.grandCol = false; self.render(); } }
      ]);
    });
    btn('Data Source ▾', 'The range the pivot reads', function (e) {
      popup(e.currentTarget, [
        { header: self.source || 'no range set' },
        { label: 'Change Data Source…', run: function () { self.sourceDialog(); } }
      ]);
    });
    var spacer = el('div', 'pv-rspace');
    bar.appendChild(spacer);
    btn(this.paneOpen ? 'Field List ✓' : 'Field List', 'Show or hide the PivotTable Fields pane',
      function () { self.paneOpen = !self.paneOpen; self.render(); }, 'pv-toggle-pane');
    return bar;
  };

  /* --------------------------------------------------------------- pane --- */
  PivotBuilder.prototype.renderPane = function () {
    var self = this;
    var pane = el('aside', 'pv-pane');
    var head = el('div', 'pv-pane-h');
    head.appendChild(el('span', '', 'PivotTable Fields'));
    var x = el('button', 'pv-pane-x', '×');
    x.title = 'Close the field list';
    x.addEventListener('click', function () { self.paneOpen = false; self.render(); });
    head.appendChild(x);
    pane.appendChild(head);

    pane.appendChild(el('div', 'pv-pane-sub', 'Choose fields to add to report:'));
    var list = el('div', 'pv-fields');
    this.fields.forEach(function (f) {
      var row = el('div', 'pf-row' + (self.inReport(f) ? ' used' : ''));
      row.draggable = true;
      row.dataset.field = f;
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'pf-check';
      cb.checked = self.inReport(f);
      cb.title = 'Add "' + f + '" to the report';
      cb.addEventListener('change', function () {
        // Excel's rule: a ticked text or date field groups the rows, a number
        // is summed
        if (cb.checked) self.add(self.kinds[f] === 'number' ? 'values' : 'rows', f);
        else self.removeField(f);
      });
      row.appendChild(cb);
      var name = el('span', 'pf-name', f);
      name.appendChild(el('span', 'pf-kind', self.kinds[f] === 'number' ? '123' : self.kinds[f] === 'date' ? '📅' : 'abc'));
      row.appendChild(name);
      var menuBtn = el('button', 'pf-menu', '▾');
      menuBtn.title = 'What to do with "' + f + '"';
      function fieldMenu(e) {
        e.preventDefault();
        popup(menuBtn, [
          { header: f },
          { label: 'Add to Report Filter', run: function () { self.add('filters', f); } },
          { label: 'Add to Row Labels', run: function () { self.add('rows', f); } },
          { label: 'Add to Column Labels', run: function () { self.add('cols', f); } },
          { label: 'Add to Values', run: function () { self.add('values', f); } },
          '-',
          { label: 'Remove Field', disabled: !self.inReport(f), run: function () { self.removeField(f); } }
        ]);
      }
      menuBtn.addEventListener('click', fieldMenu);
      row.addEventListener('contextmenu', fieldMenu);
      row.appendChild(menuBtn);
      row.addEventListener('dragstart', function (e) {
        self.drag = { field: f };
        e.dataTransfer.effectAllowed = 'copyMove';
        try { e.dataTransfer.setData('text/plain', f); } catch (err) { /* older browsers */ }
      });
      row.addEventListener('dragend', function () { self.drag = null; });
      list.appendChild(row);
    });
    pane.appendChild(list);

    pane.appendChild(el('div', 'pv-pane-sub', 'Drag fields between areas below:'));
    var areas = el('div', 'pv-areas');
    areas.appendChild(this.renderArea('filters', '▼ FILTERS', 'scopes the whole report'));
    areas.appendChild(this.renderArea('cols', '⇥ COLUMNS', 'groups across the top'));
    areas.appendChild(this.renderArea('rows', '≡ ROWS', 'groups down the side'));
    areas.appendChild(this.renderArea('values', 'Σ VALUES', 'the number being summarised'));
    pane.appendChild(areas);
    return pane;
  };

  PivotBuilder.prototype.renderArea = function (area, label, hint) {
    var self = this;
    var box = el('div', 'pv-area');
    box.dataset.area = area;
    box.appendChild(el('div', 'pa-h', label));
    var chips = el('div', 'pa-chips');
    var items = this.config[area];
    if (!items.length) chips.appendChild(el('div', 'pa-empty', hint));

    items.forEach(function (item, i) {
      var chip = el('div', 'chip');
      chip.draggable = true;
      chip.dataset.area = area;
      chip.dataset.index = String(i);
      chip.appendChild(el('span', 'chip-name', self.entryCaption(area, i)));
      if (area === 'filters') {
        var n = (item.values || []).length;
        var all = self.distinct(item.field).length;
        chip.appendChild(el('span', 'chip-badge', n === all ? '(All)' : n === 1 ? item.values[0] : '(' + n + ' items)'));
      }
      var caret = el('button', 'chip-menu', '▾');
      caret.title = 'Field settings';
      caret.addEventListener('click', function (e) { e.stopPropagation(); self.chipMenu(area, i, caret); });
      chip.appendChild(caret);
      chip.addEventListener('contextmenu', function (e) { e.preventDefault(); self.chipMenu(area, i, chip); });
      chip.addEventListener('dblclick', function () {
        if (area === 'values') self.valueSettings(i);
        else if (area === 'filters') self.filterPicker(area, i, chip);
        else self.fieldSettings(area, i);
      });
      chip.addEventListener('dragstart', function (e) {
        self.drag = { from: area, index: i, field: self.entryField(area, i) };
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', self.entryField(area, i)); } catch (err) { /* ignore */ }
        setTimeout(function () { chip.classList.add('dragging'); }, 0);
      });
      chip.addEventListener('dragend', function () { self.drag = null; chip.classList.remove('dragging'); });
      chip.addEventListener('dragover', function (e) {
        if (!self.drag) return;
        e.preventDefault();
        e.stopPropagation();
        chip.classList.add('drop-before');
      });
      chip.addEventListener('dragleave', function () { chip.classList.remove('drop-before'); });
      chip.addEventListener('drop', function (e) {
        if (!self.drag) return;
        e.preventDefault();
        e.stopPropagation();
        chip.classList.remove('drop-before');
        var d = self.drag; self.drag = null;
        if (d.from) self.move(d.from, d.index, area, i);
        else self.add(area, d.field, i);
      });
      chips.appendChild(chip);
    });

    box.appendChild(chips);
    if (area === 'values') {
      var addCalc = el('button', 'btn btn-ghost pa-calc', 'ƒx Calculated Field…');
      addCalc.title = 'A metric the source table does not contain';
      addCalc.addEventListener('click', function () { self.calcDialog(); });
      box.appendChild(addCalc);
    }
    box.addEventListener('dragover', function (e) {
      if (!self.drag) return;
      e.preventDefault();
      e.stopPropagation();
      box.classList.add('drop-here');
    });
    box.addEventListener('dragleave', function () { box.classList.remove('drop-here'); });
    box.addEventListener('drop', function (e) {
      if (!self.drag) return;
      e.preventDefault();
      e.stopPropagation();
      box.classList.remove('drop-here');
      var d = self.drag; self.drag = null;
      if (d.from) self.move(d.from, d.index, area);
      else self.add(area, d.field);
    });
    return box;
  };

  /* --------------------------------------------------------- chip menus --- */
  PivotBuilder.prototype.chipMenu = function (area, index, anchor) {
    var self = this;
    var field = this.entryField(area, index);
    var items = [{ header: this.entryCaption(area, index) }];
    var list = this.config[area];

    items.push({ label: 'Move Up', disabled: index === 0, run: function () { self.shift(area, index, -1); } });
    items.push({ label: 'Move Down', disabled: index === list.length - 1, run: function () { self.shift(area, index, 1); } });
    items.push('-');
    [['filters', 'Report Filter'], ['rows', 'Row Labels'], ['cols', 'Column Labels'], ['values', 'Values']]
      .forEach(function (a) {
        if (a[0] === area) return;
        items.push({ label: 'Move to ' + a[1], run: function () { self.move(area, index, a[0]); } });
      });
    items.push('-');

    if (area === 'rows' || area === 'cols') {
      var spec = PV.resolveField(list[index]);
      var kind = this.kinds[field];
      items.push({
        label: 'Sort A to Z', checked: !spec.sort || (spec.sort.by === 'label' && spec.sort.asc !== false),
        run: function () { self.setSort(area, index, { by: 'label', asc: true }); }
      });
      items.push({
        label: 'Sort Z to A', checked: !!spec.sort && spec.sort.by === 'label' && spec.sort.asc === false,
        run: function () { self.setSort(area, index, { by: 'label', asc: false }); }
      });
      items.push({
        label: 'More Sort Options…', disabled: !this.config.values.length,
        run: function () { self.sortDialog(area, index); }
      });
      items.push('-');
      items.push({ label: 'Filter…', run: function () { self.filterPicker(area, index, anchor); } });
      items.push({
        label: 'Top 10…', disabled: !this.config.values.length,
        run: function () { self.topDialog(area, index); }
      });
      items.push('-');
      if (spec.group) {
        items.push({ label: 'Ungroup', run: function () { self.ungroup(area, index); } });
      } else if (kind === 'date' || kind === 'number') {
        items.push({ label: 'Group…', run: function () { self.groupDialog(area, index); } });
      } else {
        items.push({ label: 'Group…', disabled: true, run: function () {} });
      }
      items.push({ label: 'Field Settings…', run: function () { self.fieldSettings(area, index); } });
    }
    if (area === 'values') {
      items.push({ label: 'Value Field Settings…', run: function () { self.valueSettings(index); } });
    }
    if (area === 'filters') {
      items.push({ label: 'Filter…', run: function () { self.filterPicker(area, index, anchor); } });
    }
    items.push('-');
    items.push({ label: 'Remove Field', run: function () { self.remove(area, index); } });
    popup(anchor, items);
  };

  PivotBuilder.prototype.entryObject = function (area, index) {
    var it = this.config[area][index];
    if (typeof it === 'string') { it = { field: it }; this.config[area][index] = it; }
    return it;
  };
  PivotBuilder.prototype.setSort = function (area, index, sort) {
    this.entryObject(area, index).sort = sort;
    this.render();
  };
  PivotBuilder.prototype.ungroup = function (area, index) {
    var it = this.entryObject(area, index);
    delete it.group;
    this.render();
  };

  /* ------------------------------------------------------- the dialogs --- */
  PivotBuilder.prototype.valueSettings = function (index) {
    var self = this;
    var spec = PV.resolveValue(this.config.values[index]);
    var isCalc = !!spec.calc;
    modal('Value Field Settings', function (body) {
      body.appendChild(el('div', 'pv-flabel', isCalc
        ? 'Calculated field: ' + spec.calc
        : 'Source Name: ' + spec.field));
      var nameIn = document.createElement('input');
      nameIn.className = 'pv-input pv-name';
      nameIn.value = spec.name || PV.specLabel(Object.assign({}, spec, { show: 'raw' }));
      body.appendChild(el('div', 'pv-flabel', 'Custom Name:'));
      body.appendChild(nameIn);

      var aggSel = document.createElement('select');
      aggSel.className = 'pv-input pv-agg';
      Object.keys(PV.AGGS).forEach(function (k) {
        var o = el('option', '', PV.AGGS[k].label);
        o.value = k;
        if (spec.agg === k) o.selected = true;
        aggSel.appendChild(o);
      });
      if (!isCalc) {
        body.appendChild(el('div', 'pv-flabel', 'Summarize value field by:'));
        body.appendChild(aggSel);
      }

      var showSel = document.createElement('select');
      showSel.className = 'pv-input pv-show';
      Object.keys(PV.SHOW).forEach(function (k) {
        var o = el('option', '', PV.SHOW[k]);
        o.value = k;
        if ((spec.show || 'raw') === k) o.selected = true;
        showSel.appendChild(o);
      });
      if (!isCalc) {
        body.appendChild(el('div', 'pv-flabel', 'Show values as:'));
        body.appendChild(showSel);
      }

      var fmtSel = document.createElement('select');
      fmtSel.className = 'pv-input pv-fmt';
      Object.keys(PV.FORMATS).forEach(function (k) {
        var o = el('option', '', PV.FORMATS[k].label);
        o.value = k;
        if ((spec.fmt || null) === PV.FORMATS[k].fmt) o.selected = true;
        fmtSel.appendChild(o);
      });
      body.appendChild(el('div', 'pv-flabel', 'Number Format:'));
      body.appendChild(fmtSel);
      return { nameIn: nameIn, aggSel: aggSel, showSel: showSel, fmtSel: fmtSel };
    }, function (api) {
      var it = self.config.values[index];
      if (!isCalc) {
        it.agg = api.aggSel.value;
        it.show = api.showSel.value;
      }
      it.fmt = PV.FORMATS[api.fmtSel.value].fmt;
      var typed = api.nameIn.value.trim();
      var auto = PV.specLabel(PV.resolveValue(Object.assign({}, it, { name: null, show: 'raw' })));
      it.name = (typed && typed !== auto) ? typed : null;
      self.render();
    });
  };

  PivotBuilder.prototype.fieldSettings = function (area, index) {
    var self = this;
    var spec = PV.resolveField(this.config[area][index]);
    modal('Field Settings — ' + spec.caption, function (body) {
      body.appendChild(el('div', 'pv-flabel', 'Subtotals:'));
      var wrap = el('div', 'pv-radios');
      var on = radio(wrap, 'sub', 'Automatic', spec.subtotals !== false);
      var off = radio(wrap, 'sub', 'None', spec.subtotals === false);
      body.appendChild(wrap);
      body.appendChild(el('div', 'pv-hint',
        'A subtotal is the line Excel adds for each group when another field sits inside this one.'));
      return { on: on, off: off };
    }, function (api) {
      self.entryObject(area, index).subtotals = !api.off.checked;
      self.render();
    });
  };

  function radio(host, name, label, checked) {
    var lab = el('label', 'pv-radio');
    var input = document.createElement('input');
    input.type = 'radio';
    input.name = name;
    input.checked = !!checked;
    lab.appendChild(input);
    lab.appendChild(document.createTextNode(' ' + label));
    host.appendChild(lab);
    return input;
  }

  PivotBuilder.prototype.sortDialog = function (area, index) {
    var self = this;
    var spec = PV.resolveField(this.config[area][index]);
    var values = this.config.values;
    modal('Sort by Value — ' + spec.caption, function (body) {
      body.appendChild(el('div', 'pv-flabel', 'Sort options:'));
      var wrap = el('div', 'pv-radios');
      var asc = radio(wrap, 'sortdir', 'Smallest to Largest',
        !!spec.sort && spec.sort.by === 'value' && spec.sort.asc !== false);
      var desc = radio(wrap, 'sortdir', 'Largest to Smallest',
        !!spec.sort && spec.sort.by === 'value' && spec.sort.asc === false);
      if (!asc.checked && !desc.checked) desc.checked = true;
      body.appendChild(wrap);
      body.appendChild(el('div', 'pv-flabel', 'Sort by which value field:'));
      var sel = document.createElement('select');
      sel.className = 'pv-input pv-sortval';
      values.forEach(function (v, i) {
        var o = el('option', '', PV.specLabel(PV.resolveValue(v)));
        o.value = String(i);
        if (spec.sort && spec.sort.value === i) o.selected = true;
        sel.appendChild(o);
      });
      body.appendChild(sel);
      return { asc: asc, sel: sel };
    }, function (api) {
      self.setSort(area, index, { by: 'value', value: +api.sel.value, asc: api.asc.checked });
    });
  };

  PivotBuilder.prototype.topDialog = function (area, index) {
    var self = this;
    var spec = PV.resolveField(this.config[area][index]);
    var cur = (spec.filter && spec.filter.top) || null;
    modal('Top 10 Filter — ' + spec.caption, function (body) {
      var line = el('div', 'pv-row');
      var dir = document.createElement('select');
      dir.className = 'pv-input pv-topdir';
      ['Top', 'Bottom'].forEach(function (t) {
        var o = el('option', '', t); o.value = t;
        if (cur && ((t === 'Top') === (cur.largest !== false))) o.selected = true;
        dir.appendChild(o);
      });
      var n = document.createElement('input');
      n.type = 'number'; n.min = '1'; n.className = 'pv-input pv-topn';
      n.value = cur ? String(cur.n) : '3';
      var sel = document.createElement('select');
      sel.className = 'pv-input pv-topval';
      self.config.values.forEach(function (v, i) {
        var o = el('option', '', PV.specLabel(PV.resolveValue(v)));
        o.value = String(i);
        if (cur && cur.value === i) o.selected = true;
        sel.appendChild(o);
      });
      line.appendChild(dir); line.appendChild(n);
      line.appendChild(el('span', 'pv-inline', 'Items by'));
      line.appendChild(sel);
      body.appendChild(line);
      body.appendChild(el('div', 'pv-hint',
        'Everything outside the top (or bottom) N is dropped from the report, so the grand total moves too.'));
      var clear = el('button', 'btn pv-clear', 'Clear the filter');
      clear.addEventListener('click', function () {
        var it = self.entryObject(area, index);
        if (it.filter) delete it.filter.top;
        if (it.filter && !it.filter.values) delete it.filter;
        closeDialogs();
        self.render();
      });
      body.appendChild(clear);
      return { dir: dir, n: n, sel: sel };
    }, function (api) {
      var it = self.entryObject(area, index);
      it.filter = it.filter || {};
      it.filter.top = { n: Math.max(1, parseInt(api.n.value, 10) || 1), value: +api.sel.value, largest: api.dir.value === 'Top' };
      self.render();
    });
  };

  PivotBuilder.prototype.groupDialog = function (area, index) {
    var self = this;
    var entry = this.config[area][index];
    var field = this.entryField(area, index);
    var kind = this.kinds[field];
    if (kind === 'date') {
      modal('Grouping — ' + field, function (body) {
        body.appendChild(el('div', 'pv-flabel', 'By:'));
        var list = el('div', 'pv-grouplist');
        var boxes = {};
        PV.DATE_GROUPS.forEach(function (g) {
          var lab = el('label', 'pv-gopt');
          var cb = document.createElement('input');
          cb.type = 'checkbox';
          cb.value = g;
          if (g === 'months') cb.checked = true;
          lab.appendChild(cb);
          lab.appendChild(document.createTextNode(' ' + PV.DATE_GROUP_LABEL[g]));
          list.appendChild(lab);
          boxes[g] = cb;
        });
        body.appendChild(list);
        body.appendChild(el('div', 'pv-hint',
          'Ticking more than one nests them, outermost first — Years, then Quarters, then Months.'));
        return { boxes: boxes };
      }, function (api) {
        var picked = ['years', 'quarters', 'months', 'days'].filter(function (g) { return api.boxes[g].checked; });
        if (!picked.length) return false;
        var entries = picked.map(function (g) { return { field: field, group: g }; });
        Array.prototype.splice.apply(self.config[area], [index, 1].concat(entries));
        self.render();
      });
      return;
    }
    // numbers
    var src = PV.readSource(this.snap, this.source);
    var nums = src.rows.map(function (r) { return r[field] && typeof r[field].v === 'number' ? r[field].v : null; })
      .filter(function (v) { return v !== null; });
    var lo = nums.length ? Math.min.apply(null, nums) : 0;
    var hi = nums.length ? Math.max.apply(null, nums) : 0;
    var step = Math.max(1, Math.round((hi - lo) / 5));
    modal('Grouping — ' + field, function (body) {
      function numField(label, value) {
        body.appendChild(el('div', 'pv-flabel', label));
        var i = document.createElement('input');
        i.type = 'number';
        i.className = 'pv-input';
        i.value = String(value);
        body.appendChild(i);
        return i;
      }
      var start = numField('Starting at:', Math.floor(lo / step) * step);
      var end = numField('Ending at:', Math.ceil((hi + 1) / step) * step);
      var by = numField('By:', step);
      start.classList.add('pv-gstart'); end.classList.add('pv-gend'); by.classList.add('pv-gby');
      return { start: start, end: end, by: by };
    }, function (api) {
      var by = parseFloat(api.by.value);
      if (!by || by <= 0) return false;
      self.config[area][index] = {
        field: field,
        group: { by: by, start: parseFloat(api.start.value) || 0, end: parseFloat(api.end.value) },
        sort: entry && entry.sort ? entry.sort : null
      };
      self.render();
    });
  };

  /* ------------------------------------------------- the tick-list filter */
  PivotBuilder.prototype.filterPicker = function (area, index, anchor) {
    var self = this;
    closeMenus();
    var isReport = area === 'filters';
    var entry = this.entryObject(area, index);
    var spec = PV.resolveField(entry);
    var all = this.distinct(spec.field, spec.group);
    var chosen = isReport ? (entry.values || all.slice())
      : ((entry.filter && entry.filter.values) || all.slice());

    var menu = el('div', 'pv-menu pv-picker');
    menu.appendChild(el('div', 'pv-mhead', (isReport ? 'Report filter: ' : 'Filter: ') + spec.caption));
    var list = el('div', 'fm-list');
    var allBox = el('label', 'fm-opt fm-all');
    var allCb = document.createElement('input');
    allCb.type = 'checkbox';
    allCb.checked = chosen.length === all.length;
    allBox.appendChild(allCb);
    allBox.appendChild(document.createTextNode(' (Select All)'));
    list.appendChild(allBox);
    all.forEach(function (v) {
      var lab = el('label', 'fm-opt');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = chosen.indexOf(v) >= 0;
      cb.value = v;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + v));
      list.appendChild(lab);
    });
    allCb.addEventListener('change', function () {
      Array.prototype.forEach.call(list.querySelectorAll('input:not(:first-child)'), function () {});
      Array.prototype.slice.call(list.querySelectorAll('.fm-opt:not(.fm-all) input')).forEach(function (cb) {
        cb.checked = allCb.checked;
      });
    });
    menu.appendChild(list);
    var actions = el('div', 'fm-actions');
    var ok = el('button', 'btn btn-primary', 'OK');
    ok.addEventListener('click', function () {
      var picked = Array.prototype.slice.call(list.querySelectorAll('.fm-opt:not(.fm-all) input'))
        .filter(function (cb) { return cb.checked; }).map(function (cb) { return cb.value; });
      if (isReport) entry.values = picked;
      else {
        entry.filter = entry.filter || {};
        if (picked.length === all.length) delete entry.filter.values;
        else entry.filter.values = picked;
        if (!entry.filter.values && !entry.filter.top) delete entry.filter;
      }
      closeMenus();
      self.render();
    });
    var cancel = el('button', 'btn', 'Cancel');
    cancel.addEventListener('click', function () { closeMenus(); });
    actions.appendChild(ok); actions.appendChild(cancel);
    menu.appendChild(actions);

    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.left = Math.max(6, Math.min(r.left, window.innerWidth - 260)) + 'px';
    menu.style.top = Math.min(r.bottom + 4, window.innerHeight - menu.offsetHeight - 10) + 'px';
    menu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    setTimeout(function () {
      document.addEventListener('mousedown', function off() { closeMenus(); document.removeEventListener('mousedown', off); });
    }, 0);
  };

  /* ======================================================== the report === */
  PivotBuilder.prototype.renderReport = function () {
    var self = this, c = this.config;
    var box = el('div', 'pv-result');

    if (this.scratch) {
      box.appendChild(el('div', 'pv-scratch',
        'Scratch pivot. Nothing here is marked — it is here to work an answer out with. ' +
        'Read the number off the report and type it into the sheet.'));
    }
    if (!this.source || !this.fields.length) {
      box.appendChild(el('div', 'pivot-placeholder',
        'No data range is set for this pivot. Use Data Source ▸ Change Data Source ' +
        'and give it a range whose first row holds the field names.'));
      return box;
    }
    if (this.config.filters.length) box.appendChild(this.renderFilterStrip());

    if (!c.rows.length && !c.cols.length && !c.values.length) {
      box.appendChild(el('div', 'pivot-placeholder',
        'To build a report, choose fields from the PivotTable Field List — ' +
        'drag a category into ROWS and a number into VALUES.'));
      return box;
    }

    var p = PV.build(this.snap, Object.assign({ source: this.source }, c));
    var nv = p.values.length;
    var table = el('table', 'pivot-table');
    var thead = el('thead');
    var headRows = [];

    /* ---- column headers ---- */
    if (p.colFields.length) {
      var top = el('tr');
      var corner = el('th', 'pt-corner', nv === 1 ? PV.specLabel(p.values[0]) : '');
      top.appendChild(corner);
      var colLabelHead = el('th', 'pt-collabel');
      colLabelHead.colSpan = p.colLines.length * Math.max(1, nv);
      colLabelHead.appendChild(el('span', '', 'Column Labels'));
      colLabelHead.appendChild(this.axisArrow('cols'));
      top.appendChild(colLabelHead);
      thead.appendChild(top);

      var levels = p.colFields.length;
      for (var d = 0; d < levels; d++) {
        var tr = el('tr');
        tr.appendChild(el('th', 'pt-corner', ''));
        var i = 0;
        while (i < p.colLines.length) {
          var L = p.colLines[i];
          if (L.kind === 'item') {
            var span = 1;
            while (i + span < p.colLines.length) {
              var N = p.colLines[i + span];
              if (N.kind !== 'item') break;
              if (N.labels.slice(0, d + 1).join('') !== L.labels.slice(0, d + 1).join('')) break;
              span++;
            }
            var th = el('th', '', L.labels[d]);
            th.colSpan = span * Math.max(1, nv);
            tr.appendChild(th);
            i += span;
          } else {
            var at = L.kind === 'grand' ? 0 : L.labels.length - 1;
            if (at === d) {
              var tt = el('th', 'pt-total', L.caption);
              tt.colSpan = Math.max(1, nv);
              tt.rowSpan = levels - d;
              tr.appendChild(tt);
            }
            i++;
          }
        }
        thead.appendChild(tr);
        headRows.push(tr);
      }
      if (nv > 1) {
        var vr = el('tr');
        vr.appendChild(el('th', 'pt-corner', ''));
        p.colLines.forEach(function (L) {
          p.values.forEach(function (spec) {
            vr.appendChild(el('th', 'pt-vhead', PV.specLabel(spec)));
          });
        });
        thead.appendChild(vr);
        headRows.push(vr);
      }
    } else {
      var only = el('tr');
      only.appendChild(el('th', 'pt-corner', ''));
      p.values.forEach(function (spec) { only.appendChild(el('th', 'pt-vhead', PV.specLabel(spec))); });
      thead.appendChild(only);
      headRows.push(only);
    }

    /* the Row Labels corner goes on the bottom header row, as Excel puts it */
    var bottom = headRows[headRows.length - 1];
    if (bottom) {
      bottom.removeChild(bottom.firstChild);
      var cells = this.rowHeaderCells(p);
      for (var k = cells.length - 1; k >= 0; k--) bottom.insertBefore(cells[k], bottom.firstChild);
    }
    table.appendChild(thead);

    /* ---- body ---- */
    var tbody = el('tbody');
    p.rowLines.forEach(function (line, ri) {
      var tr = el('tr', 'pt-' + line.kind);
      self.rowLabelCells(p, line).forEach(function (cell) { tr.appendChild(cell); });
      p.body[ri].forEach(function (v, j) {
        var spec = p.values[j % Math.max(1, nv)];
        var colLine = p.colLines[Math.floor(j / Math.max(1, nv))];
        var td = el('td', '', PV.format(v, spec));
        if (colLine && colLine.kind !== 'item') td.className = 'pt-total';
        if (line.kind === 'grand' || line.kind === 'subtotal') td.classList.add('pt-total');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    var scroll = el('div', 'pivot-scroll');
    scroll.appendChild(table);
    box.appendChild(scroll);

    var note = p.rowCount + ' of ' + p.sourceRows + ' source rows are included';
    if (p.rowCount !== p.sourceRows) note += ' — the rest are filtered out';
    box.appendChild(el('div', 'pivot-note', note));
    return box;
  };

  // The ▾ that Excel puts on Row Labels and Column Labels.
  PivotBuilder.prototype.axisArrow = function (area) {
    var self = this;
    var b = el('button', 'pt-arrow', '▾');
    b.title = 'Sort and filter the ' + (area === 'rows' ? 'row' : 'column') + ' fields';
    b.addEventListener('click', function (e) {
      e.stopPropagation();
      var list = self.config[area];
      if (!list.length) return;
      if (list.length === 1) { self.axisMenu(area, 0, b); return; }
      popup(b, [{ header: 'Select field:' }].concat(list.map(function (it, i) {
        return { label: self.entryCaption(area, i), run: function () { self.axisMenu(area, i, b); } };
      })));
    });
    return b;
  };
  PivotBuilder.prototype.axisMenu = function (area, index, anchor) {
    var self = this;
    var spec = PV.resolveField(this.config[area][index]);
    popup(anchor, [
      { header: spec.caption },
      { label: 'Sort A to Z', checked: !spec.sort || (spec.sort.by === 'label' && spec.sort.asc !== false),
        run: function () { self.setSort(area, index, { by: 'label', asc: true }); } },
      { label: 'Sort Z to A', checked: !!spec.sort && spec.sort.by === 'label' && spec.sort.asc === false,
        run: function () { self.setSort(area, index, { by: 'label', asc: false }); } },
      { label: 'More Sort Options…', disabled: !this.config.values.length,
        run: function () { self.sortDialog(area, index); } },
      '-',
      { label: 'Top 10…', disabled: !this.config.values.length, run: function () { self.topDialog(area, index); } },
      { label: 'Filter…', run: function () { self.filterPicker(area, index, anchor); } },
      '-',
      { label: 'Group…', disabled: !(this.kinds[spec.field] === 'date' || this.kinds[spec.field] === 'number') || !!spec.group,
        run: function () { self.groupDialog(area, index); } },
      { label: 'Ungroup', disabled: !spec.group, run: function () { self.ungroup(area, index); } }
    ]);
  };

  PivotBuilder.prototype.rowHeaderCells = function (p) {
    var self = this, out = [];
    if (p.layout === 'tabular' && p.rowFields.length) {
      p.rowFields.forEach(function (f, i) {
        var th = el('th', 'pt-corner');
        th.appendChild(el('span', '', f.caption));
        th.appendChild(self.axisArrow('rows'));
        out.push(th);
      });
      return out;
    }
    var th = el('th', 'pt-corner');
    th.appendChild(el('span', '', p.rowFields.length ? 'Row Labels' : ''));
    if (p.rowFields.length) th.appendChild(this.axisArrow('rows'));
    out.push(th);
    return out;
  };

  PivotBuilder.prototype.rowLabelCells = function (p, line) {
    var out = [];
    if (p.layout === 'tabular' && p.rowFields.length) {
      for (var i = 0; i < p.rowFields.length; i++) {
        var text = '';
        if (line.kind === 'grand') text = i === 0 ? 'Grand Total' : '';
        else if (line.kind === 'subtotal') text = i === line.depth ? line.caption : (i < line.depth ? line.labels[i] : '');
        else text = line.labels[i] !== undefined ? line.labels[i] : '';
        out.push(el('th', 'pt-rowlabel', text));
      }
      return out;
    }
    var th = el('th', 'pt-rowlabel', line.kind === 'grand' ? 'Grand Total' : line.caption);
    if (line.depth) th.style.paddingLeft = (10 + line.depth * 16) + 'px';
    out.push(th);
    return out;
  };

  PivotBuilder.prototype.renderFilterStrip = function () {
    var self = this;
    var strip = el('div', 'pv-filterstrip');
    this.config.filters.forEach(function (f, i) {
      var row = el('div', 'pv-frow');
      row.appendChild(el('span', 'pv-fname', f.field));
      var all = self.distinct(f.field).length;
      var n = (f.values || []).length;
      var btn = el('button', 'pv-fbtn', n === all ? '(All)' : n === 1 ? f.values[0] : '(Multiple Items)');
      btn.appendChild(el('span', 'pt-arrow', '▾'));
      btn.addEventListener('click', function () { self.filterPicker('filters', i, btn); });
      row.appendChild(btn);
      strip.appendChild(row);
    });
    return strip;
  };

  /* Excel's Change PivotTable Data Source. */
  PivotBuilder.prototype.sourceDialog = function () {
    var self = this;
    modal('Change PivotTable Data Source', function (body) {
      body.appendChild(el('div', 'pv-flabel', 'Table/Range:'));
      var input = document.createElement('input');
      input.className = 'pv-input pv-source';
      input.value = self.source;
      input.placeholder = 'e.g. A1:G21';
      body.appendChild(input);
      body.appendChild(el('div', 'pv-hint',
        'The first row of the range is read as the field names, exactly as Excel reads it. ' +
        'A pivot needs a header row and at least one row of data under it.'));
      setTimeout(function () { input.focus(); input.select(); }, 0);
      return { input: input };
    }, function (api) {
      var ref = String(api.input.value || '').trim();
      if (!/^\$?[A-Za-z]{1,3}\$?\d{1,4}:\$?[A-Za-z]{1,3}\$?\d{1,4}$/.test(ref)) return false;
      self.setSource(ref);
    });
  };

  /* Adding a calculated field — Excel's Insert Calculated Field dialog. */
  PivotBuilder.prototype.calcDialog = function () {
    var self = this;
    modal('Insert Calculated Field', function (body) {
      body.appendChild(el('div', 'pv-flabel', 'Name:'));
      var name = document.createElement('input');
      name.className = 'pv-input cf-name';
      name.placeholder = 'e.g. Gross profit';
      body.appendChild(name);
      body.appendChild(el('div', 'pv-flabel', 'Formula, written over the field names:'));
      var f = document.createElement('input');
      f.className = 'pv-input cf-formula';
      f.placeholder = 'e.g. Revenue * Margin';
      body.appendChild(f);
      body.appendChild(el('div', 'pv-flabel', 'Fields:'));
      var list = el('div', 'cf-fields');
      self.fields.forEach(function (name2) {
        var b = el('button', 'cf-field', name2);
        b.addEventListener('click', function () {
          f.value = (f.value + ' ' + name2).trim();
          f.focus();
        });
        list.appendChild(b);
      });
      body.appendChild(list);
      body.appendChild(el('div', 'pv-hint',
        'A calculated field is worked out from the TOTALS of each group, not row by row — ' +
        'which matters the moment the formula contains a × or a ÷.'));
      setTimeout(function () { f.focus(); }, 0);
      return { name: name, formula: f };
    }, function (api) {
      var formula = api.formula.value.trim();
      if (!formula) return false;
      self.config.values.push({ calc: formula, name: api.name.value.trim() || formula });
      self.render();
    });
  };

  root.XLPivotUI = { PivotBuilder: PivotBuilder };
})(typeof self !== 'undefined' ? self : this);

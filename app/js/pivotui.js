/* =============================================================================
 * pivotui.js — the pivot table builder
 * Four areas (Filters, Columns, Rows, Values) plus the rendered result, the
 * same way Excel lays it out.
 * ========================================================================== */
(function (root) {
  'use strict';
  var PV = root.XLPivot;

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }
  function fmt(v) {
    if (v === null || v === undefined) return '';
    if (typeof v !== 'number') return String(v);
    if (Math.abs(v) < 1 && v !== 0) return (Math.round(v * 10000) / 100).toFixed(1) + '%';
    return Math.round(v * 100) / 100 === Math.round(v)
      ? Math.round(v).toLocaleString('en-US')
      : (Math.round(v * 100) / 100).toLocaleString('en-US');
  }

  function PivotBuilder(host, sheet, source, onChange) {
    this.host = host;
    this.sheet = sheet;
    this.source = source;
    this.onChange = onChange || function () {};
    this.config = { rows: [], cols: [], values: [], filters: [] };
    this.fields = PV.readSource(sheet, source).fields;
    this.render();
  }

  PivotBuilder.prototype.getConfig = function () {
    return JSON.parse(JSON.stringify(this.config));
  };
  PivotBuilder.prototype.setConfig = function (cfg) {
    this.config = {
      rows: (cfg.rows || []).slice(),
      cols: (cfg.cols || []).slice(),
      values: JSON.parse(JSON.stringify(cfg.values || [])),
      filters: JSON.parse(JSON.stringify(cfg.filters || []))
    };
    this.render();
  };
  PivotBuilder.prototype.reset = function () {
    this.config = { rows: [], cols: [], values: [], filters: [] };
    this.render();
  };

  PivotBuilder.prototype.used = function (field) {
    var c = this.config;
    return c.rows.indexOf(field) >= 0 || c.cols.indexOf(field) >= 0 ||
      c.filters.some(function (f) { return f.field === field; });
  };

  PivotBuilder.prototype.add = function (area, field) {
    var c = this.config;
    // a field lives in one area at a time, exactly as in Excel
    c.rows = c.rows.filter(function (f) { return f !== field; });
    c.cols = c.cols.filter(function (f) { return f !== field; });
    c.filters = c.filters.filter(function (f) { return f.field !== field; });
    if (area === 'rows') c.rows.push(field);
    else if (area === 'cols') c.cols.push(field);
    else if (area === 'filters') c.filters.push({ field: field, values: this.distinct(field) });
    else if (area === 'values') c.values.push({ field: field, agg: 'sum', show: 'raw' });
    this.render();
  };

  PivotBuilder.prototype.distinct = function (field) {
    var src = PV.readSource(this.sheet, this.source), out = [], seen = {};
    src.rows.forEach(function (rec) {
      var t = rec[field] ? (rec[field].text === '' ? '(blank)' : rec[field].text) : '';
      if (!seen[t]) { seen[t] = 1; out.push(t); }
    });
    return out.sort();
  };

  PivotBuilder.prototype.remove = function (area, index) {
    if (area === 'values') this.config.values.splice(index, 1);
    else if (area === 'filters') this.config.filters.splice(index, 1);
    else this.config[area].splice(index, 1);
    this.render();
  };

  /* ----------------------------------------------------------------- view */
  PivotBuilder.prototype.render = function () {
    var self = this;
    this.host.innerHTML = '';
    var wrap = el('div', 'pivot-wrap');

    /* field list */
    var side = el('div', 'pivot-fields');
    side.appendChild(el('div', 'pivot-h', 'Fields in the data'));
    this.fields.forEach(function (f) {
      var row = el('div', 'pf-row' + (self.used(f) ? ' used' : ''));
      row.appendChild(el('span', 'pf-name', f));
      var btns = el('span', 'pf-btns');
      [['rows', 'Rows'], ['cols', 'Cols'], ['values', 'Σ'], ['filters', 'Filter']].forEach(function (a) {
        var b = el('button', 'pf-btn', a[1]);
        b.title = 'Send "' + f + '" to ' + a[1];
        b.addEventListener('click', function () { self.add(a[0], f); });
        btns.appendChild(b);
      });
      row.appendChild(btns);
      side.appendChild(row);
    });
    wrap.appendChild(side);

    /* four areas */
    var areas = el('div', 'pivot-areas');
    function areaBox(key, label, hint) {
      var box = el('div', 'pivot-area');
      box.appendChild(el('div', 'pa-h', label));
      var chips = el('div', 'pa-chips');
      var items = key === 'values' ? self.config.values
        : key === 'filters' ? self.config.filters
        : self.config[key];
      if (!items.length) chips.appendChild(el('div', 'pa-empty', hint));
      items.forEach(function (item, i) {
        var chip = el('div', 'chip');
        if (key === 'values') {
          chip.appendChild(el('span', 'chip-name', item.calc ? (item.name || item.calc) : PV.specLabel(item)));
          if (!item.calc) {
            var sel = el('select', 'chip-sel');
            Object.keys(PV.AGGS).forEach(function (a) {
              var o = el('option', '', PV.AGGS[a].label);
              o.value = a;
              if ((item.agg || 'sum') === a) o.selected = true;
              sel.appendChild(o);
            });
            sel.addEventListener('change', function () { item.agg = sel.value; self.render(); });
            chip.appendChild(sel);
            var show = el('select', 'chip-sel');
            Object.keys(PV.SHOW).forEach(function (k) {
              var o = el('option', '', PV.SHOW[k]);
              o.value = k;
              if ((item.show || 'raw') === k) o.selected = true;
              show.appendChild(o);
            });
            show.addEventListener('change', function () { item.show = show.value; self.render(); });
            chip.appendChild(show);
          }
        } else if (key === 'filters') {
          chip.appendChild(el('span', 'chip-name', item.field));
          var pick = el('button', 'chip-pick', item.values.length + ' selected');
          pick.addEventListener('click', function () { self.openFilterPicker(item, pick); });
          chip.appendChild(pick);
        } else {
          chip.appendChild(el('span', 'chip-name', item));
        }
        var x = el('button', 'chip-x', '×');
        x.title = 'Remove';
        x.addEventListener('click', function () { self.remove(key, i); });
        chip.appendChild(x);
        chips.appendChild(chip);
      });
      box.appendChild(chips);
      if (key === 'values') {
        var addCalc = el('button', 'btn btn-ghost pa-calc', '+ Add calculated field');
        addCalc.addEventListener('click', function () { self.openCalcForm(box); });
        box.appendChild(addCalc);
      }
      return box;
    }
    areas.appendChild(areaBox('filters', 'FILTERS', 'scopes the whole report'));
    areas.appendChild(areaBox('cols', 'COLUMNS', 'groups across the top'));
    areas.appendChild(areaBox('rows', 'ROWS', 'groups down the side'));
    areas.appendChild(areaBox('values', 'VALUES', 'the number being aggregated'));
    wrap.appendChild(areas);

    this.host.appendChild(wrap);
    this.host.appendChild(this.renderResult());
    this.onChange(this.getConfig());
  };

  PivotBuilder.prototype.openCalcForm = function (box) {
    var self = this;
    if (box.querySelector('.calc-form')) return;
    var form = el('div', 'calc-form');
    form.innerHTML =
      '<div class="cf-h">Calculated field</div>' +
      '<input class="cf-name" placeholder="Name, e.g. Gross profit">' +
      '<input class="cf-formula" placeholder="Formula over field names, e.g. Revenue * Margin">' +
      '<div class="cf-hint">Available fields: ' + this.fields.join(', ') + '</div>' +
      '<div class="cf-actions"><button class="btn btn-primary cf-ok">Add</button>' +
      '<button class="btn cf-cancel">Cancel</button></div>';
    form.querySelector('.cf-ok').addEventListener('click', function () {
      var name = form.querySelector('.cf-name').value.trim();
      var f = form.querySelector('.cf-formula').value.trim();
      if (!f) return;
      self.config.values.push({ calc: f, name: name || f });
      self.render();
    });
    form.querySelector('.cf-cancel').addEventListener('click', function () { form.remove(); });
    box.appendChild(form);
    form.querySelector('.cf-formula').focus();
  };

  PivotBuilder.prototype.openFilterPicker = function (item, anchor) {
    var self = this;
    var existing = document.querySelector('.pivot-picker');
    if (existing) existing.remove();
    var all = this.distinct(item.field);
    var menu = el('div', 'pivot-picker filter-menu');
    var list = el('div', 'fm-list');
    all.forEach(function (v) {
      var lab = el('label', 'fm-opt');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.values.indexOf(v) >= 0;
      cb.value = v;
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + v));
      list.appendChild(lab);
    });
    menu.appendChild(list);
    var actions = el('div', 'fm-actions');
    var ok = el('button', 'btn btn-primary', 'Apply');
    ok.addEventListener('click', function () {
      item.values = Array.prototype.filter.call(list.querySelectorAll('input'), function (cb) { return cb.checked; })
        .map(function (cb) { return cb.value; });
      menu.remove();
      self.render();
    });
    actions.appendChild(ok);
    menu.appendChild(actions);
    document.body.appendChild(menu);
    var r = anchor.getBoundingClientRect();
    menu.style.left = Math.min(r.left, window.innerWidth - 240) + 'px';
    menu.style.top = (r.bottom + 4) + 'px';
    menu.addEventListener('mousedown', function (e) { e.stopPropagation(); });
    setTimeout(function () {
      document.addEventListener('mousedown', function close() {
        menu.remove();
        document.removeEventListener('mousedown', close);
      });
    }, 0);
  };

  PivotBuilder.prototype.renderResult = function () {
    var box = el('div', 'pivot-result');
    var c = this.config;
    if (!c.rows.length && !c.cols.length && !c.values.length) {
      box.appendChild(el('div', 'pivot-placeholder',
        'The pivot is empty. Send a category field to ROWS and a number to VALUES.'));
      return box;
    }
    var p = PV.build(this.sheet, Object.assign({ source: this.source }, c));
    var t = el('table', 'pivot-table');

    var thead = el('thead');
    if (p.colFields.length) {
      var r1 = el('tr');
      r1.appendChild(el('th', 'pt-corner', p.rowFields.join(' / ')));
      p.colKeys.forEach(function (ck) {
        var th = el('th', '', ck);
        th.colSpan = p.values.length;
        r1.appendChild(th);
      });
      var gt = el('th', 'pt-total', 'Grand Total');
      gt.colSpan = p.values.length;
      r1.appendChild(gt);
      thead.appendChild(r1);
    }
    if (p.values.length > 1 || !p.colFields.length) {
      var r2 = el('tr');
      r2.appendChild(el('th', 'pt-corner', p.colFields.length ? '' : (p.rowFields.join(' / ') || '')));
      var repeat = p.colFields.length ? p.colKeys.length + 1 : 1;
      for (var i = 0; i < repeat; i++) {
        p.values.forEach(function (spec) {
          r2.appendChild(el('th', '', spec.calc ? (spec.name || spec.calc) : PV.specLabel(spec)));
        });
      }
      if (!p.colFields.length) { /* the single Grand Total column is the value column itself */ }
      thead.appendChild(r2);
    }
    t.appendChild(thead);

    var tbody = el('tbody');
    p.rowKeys.forEach(function (rk, i) {
      var tr = el('tr');
      tr.appendChild(el('th', 'pt-rowlabel', rk || 'Total'));
      p.body[i].forEach(function (v, j) {
        var isTotal = j >= p.body[i].length - p.values.length && p.colFields.length;
        tr.appendChild(el('td', isTotal ? 'pt-total' : '', fmt(v)));
      });
      tbody.appendChild(tr);
    });
    var trg = el('tr', 'pt-grand');
    trg.appendChild(el('th', 'pt-rowlabel', 'Grand Total'));
    p.grand.forEach(function (v) { trg.appendChild(el('td', '', fmt(v))); });
    tbody.appendChild(trg);
    t.appendChild(tbody);

    var scroll = el('div', 'pivot-scroll');
    scroll.appendChild(t);
    box.appendChild(scroll);
    box.appendChild(el('div', 'pivot-note',
      p.rowCount + ' of ' + p.sourceRows + ' source rows are included' +
      (p.filters.length ? ' after the report filter' : '')));
    return box;
  };

  root.XLPivotUI = { PivotBuilder: PivotBuilder };
})(typeof self !== 'undefined' ? self : this);

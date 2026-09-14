/* =============================================================================
 * touch.js — making the trainer usable with a thumb
 *
 * On a phone there is no ⌘D, no ⌘T and no ⌘⇧F, and those shortcuts are how the
 * tasks are meant to be solved. This file puts the same actions on buttons, and
 * floats a row of the characters that are painful to type on an iOS keyboard
 * ( = $ : , ( ) " ) just above the keyboard itself.
 * ========================================================================== */
(function (root) {
  'use strict';

  var TOUCH = ('ontouchstart' in root) || (navigator.maxTouchPoints > 0) ||
    (root.matchMedia && root.matchMedia('(pointer: coarse)').matches);

  function narrow() { return root.innerWidth <= 760; }
  function enabled() { return TOUCH || narrow(); }

  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  /* ------------------------------------------------- the character assist row */
  var assist = null, assistGrid = null;

  var KEYS = [
    { t: '=', ins: '=' },
    { t: '$', act: 'anchor', title: 'Cycle A1 → $A$1 → A$1 → $A1' },
    { t: ':', ins: ':' },
    { t: ',', ins: ',' },
    { t: '(', ins: '(' },
    { t: ')', ins: ')' },
    { t: '"', ins: '"' },
    { t: '&', ins: '&' },
    { t: '>', ins: '>' },
    { t: '<', ins: '<' },
    { t: '%', ins: '%' },
    { t: 'SUM(', ins: 'SUM(' },
    { t: 'IF(', ins: 'IF(' },
    { t: 'SUMIFS(', ins: 'SUMIFS(' },
    { t: 'VLOOKUP(', ins: 'VLOOKUP(' },
    { t: 'INDEX(', ins: 'INDEX(' },
    { t: 'MATCH(', ins: 'MATCH(' },
    { t: 'SUBTOTAL(9,', ins: 'SUBTOTAL(9,' }
  ];

  function activeField() {
    var a = document.activeElement;
    if (a && a.tagName === 'INPUT' && typeof a.selectionStart === 'number' && a.type !== 'checkbox') return a;
    return null;
  }

  function insert(text) {
    var f = activeField();
    if (!f) return;
    var s = f.selectionStart, e = f.selectionEnd;
    f.value = f.value.slice(0, s) + text + f.value.slice(e);
    var pos = s + text.length;
    f.setSelectionRange(pos, pos);
    f.dispatchEvent(new Event('input', { bubbles: true }));
    f.focus();
  }

  function buildAssist() {
    if (assist) return assist;
    assist = el('div', 'assist-row');
    assist.hidden = true;
    var scroll = el('div', 'assist-scroll');
    KEYS.forEach(function (k) {
      var b = el('button', 'assist-key' + (k.t.length > 2 ? ' wide' : ''), k.t);
      if (k.title) b.title = k.title;
      // mousedown must not move focus away from the field being typed into
      b.addEventListener('mousedown', function (e) { e.preventDefault(); });
      b.addEventListener('touchstart', function (e) { e.preventDefault(); }, { passive: false });
      b.addEventListener('click', function (e) {
        e.preventDefault();
        if (k.act === 'anchor') {
          var f = activeField();
          if (!(assistGrid && f && assistGrid.toggleAnchorIn(f))) insert('$');
        } else {
          insert(k.ins);
        }
      });
      scroll.appendChild(b);
    });
    assist.appendChild(scroll);
    var done = el('button', 'assist-done', 'Done');
    done.addEventListener('click', function () {
      var f = activeField();
      if (f) f.blur();
      hideAssist();
    });
    assist.appendChild(done);
    document.body.appendChild(assist);

    // Keep the row sitting directly on top of the on-screen keyboard.
    function place() {
      if (!root.visualViewport) return;
      var vv = root.visualViewport;
      var gap = Math.max(0, root.innerHeight - (vv.height + vv.offsetTop));
      assist.style.bottom = gap + 'px';
    }
    if (root.visualViewport) {
      root.visualViewport.addEventListener('resize', place);
      root.visualViewport.addEventListener('scroll', place);
    }
    assist.__place = place;
    return assist;
  }

  function showAssist(grid) {
    if (!enabled()) return;
    assistGrid = grid || assistGrid;
    var a = buildAssist();
    a.hidden = false;
    if (a.__place) a.__place();
  }
  function hideAssist() {
    if (assist) assist.hidden = true;
  }

  // Watch focus so the row appears exactly when something is being typed into.
  function watchFields(grid) {
    assistGrid = grid;
    document.addEventListener('focusin', function (e) {
      if (e.target && e.target.tagName === 'INPUT' &&
          (e.target.classList.contains('fb-input') || e.target.classList.contains('cell-input'))) {
        showAssist(grid);
      }
    });
    document.addEventListener('focusout', function (e) {
      setTimeout(function () {
        if (!activeField()) hideAssist();
      }, 120);
    });
  }

  /* --------------------------------------------------------- the tool strip */
  // The buttons that replace the keyboard shortcuts the tasks rely on.
  function buildToolbar(grid, task, onFilterToggle) {
    var bar = el('div', 'touch-tools');
    function add(label, title, fn, cls) {
      var b = el('button', 'tt-btn' + (cls ? ' ' + cls : ''), label);
      b.title = title;
      b.addEventListener('click', function (e) { e.preventDefault(); fn(); });
      bar.appendChild(b);
      return b;
    }

    add('Edit', 'Type into the selected cell', function () {
      var fb = document.getElementById('fb-input');
      if (!fb || fb.disabled) {
        grid.flash('That cell holds source data and cannot be changed');
        return;
      }
      fb.focus();
      fb.setSelectionRange(fb.value.length, fb.value.length);
      showAssist(grid);
    }, 'primary');

    add('Fill ↓', 'Copy this formula down the column, shifting references', function () {
      grid.smartFill('down');
    });
    add('Fill →', 'Copy this formula across the row, shifting references', function () {
      grid.smartFill('right');
    });
    add('$', 'Cycle the dollar signs in the reference you are typing', function () {
      var f = activeField() || document.getElementById('fb-input');
      if (f && document.activeElement !== f) f.focus();
      if (!grid.toggleAnchorIn(f)) grid.flash('Put the cursor on a reference such as B2 first');
    });
    add('↶', 'Undo the last change', function () { grid.undo(); });

    if (task && task.table) {
      var fb = add('Filter', 'Turn the autofilter on, then use the ▾ arrows', function () {
        grid.setFiltersOn(!grid.filtersOn);
        fb.classList.toggle('on', grid.filtersOn);
        fb.textContent = grid.filtersOn ? 'Filter on' : 'Filter';
        if (onFilterToggle) onFilterToggle(grid.filtersOn);
      });
    }
    return bar;
  }

  root.XLTouch = {
    enabled: enabled,
    isTouch: function () { return TOUCH; },
    buildToolbar: buildToolbar,
    watchFields: watchFields,
    showAssist: showAssist,
    hideAssist: hideAssist
  };

  // A body class so the stylesheet can adapt without guessing.
  function markBody() {
    document.body.classList.toggle('is-touch', TOUCH);
    document.body.classList.toggle('is-narrow', narrow());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', markBody);
  else markBody();
  root.addEventListener('resize', markBody);
})(typeof self !== 'undefined' ? self : this);

/* =============================================================================
 * app.js — screens, navigation and progress
 * ========================================================================== */
(function (root) {
  'use strict';
  var XLF = root.XLF, ENG = root.XLEngine, G = root.XLGrader,
      CUR = root.XLCurriculum, DRILLS = root.XLDrills, Store = root.XLStore,
      PV = root.XLPivot, XP = root.XLExplain;

  var view = document.getElementById('view');
  var state = {
    grid: null, pivot: null, task: null, level: null, exam: null, timerId: null,
    // work in progress is kept for the whole session, so clicking away from a
    // half-finished task and coming back does not throw the work away
    sheets: {}, pivots: {}
  };

  /* -------------------------------------------------------------- helpers */
  function h(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmt(n) {
    if (n === null || n === undefined) return '—';
    if (typeof n !== 'number') return String(n);
    var r = Math.round(n * 100) / 100;
    return r.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  function mmss(sec) {
    sec = Math.max(0, Math.round(sec));
    return Math.floor(sec / 60) + ':' + ('0' + (sec % 60)).slice(-2);
  }
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
  }
  function plural(n, one, many) { return n === 1 ? one : many; }

  function levelById(id) {
    for (var i = 0; i < CUR.levels.length; i++) if (String(CUR.levels[i].id) === String(id)) return CUR.levels[i];
    return null;
  }
  function taskById(level, id) {
    for (var i = 0; i < level.tasks.length; i++) if (level.tasks[i].id === id) return level.tasks[i];
    var found = null;
    (level.papers || []).forEach(function (p) {
      p.tasks.forEach(function (t) { if (t.id === id) found = t; });
    });
    return found;
  }
  // which of the fifty papers a question belongs to, and the questions around it
  function paperOf(level, task) {
    var papers = level.papers || [];
    for (var i = 0; i < papers.length; i++) {
      if (papers[i].tasks.indexOf(task) >= 0) return papers[i];
    }
    return { id: level.id, title: level.title, tasks: level.tasks,
             timeLimitSec: level.timeLimitSec, passScore: level.passScore };
  }
  function paperById(level, id) {
    var papers = level.papers || [];
    for (var i = 0; i < papers.length; i++) if (papers[i].id === id) return papers[i];
    return null;
  }
  // the paper to offer next: the first one never sat, else the first not passed
  function suggestedPaper(level) {
    var papers = level.papers || [];
    var unsat = null, unpassed = null;
    papers.forEach(function (p) {
      var best = Store.bestExam(p.id);
      if (!best && !unsat) unsat = p;
      else if (best && best.score < level.passScore && !unpassed) unpassed = p;
    });
    return unsat || unpassed || papers[0];
  }
  function levelStats(level) {
    var max = 0, got = 0, done = 0;
    level.tasks.forEach(function (t) {
      max += t.points;
      got += Store.earnedFor(t);
      if (Store.task(t.id).best >= 1) done++;
    });
    return { max: max, got: got, done: done, total: level.tasks.length, share: max ? got / max : 0 };
  }
  // Every level — the mock tests included — is open from the very first launch.
  // The order below is the recommended one, not a gate: nothing has to be
  // unlocked and nothing can be locked again.
  function updateHeader() {
    var d = Store.data.streak.days;
    document.getElementById('xp-value').textContent = Store.data.xp;
    document.getElementById('streak-value').textContent = d + ' ' + plural(d, 'day', 'days') + ' in a row';
  }

  /* ============================================================== HOME === */
  function renderHome() {
    var totalMax = 0, totalGot = 0;
    CUR.levels.forEach(function (l) { var s = levelStats(l); totalMax += s.max; totalGot += s.got; });
    var pct = totalMax ? Math.round(totalGot / totalMax * 100) : 0;

    var next = null;
    for (var i = 0; i < CUR.levels.length && !next; i++) {
      var lv = CUR.levels[i];
      for (var j = 0; j < lv.tasks.length; j++) {
        if (Store.task(lv.tasks[j].id).best < 1) { next = { level: lv, task: lv.tasks[j] }; break; }
      }
    }

    var page = h('<div class="page"></div>');
    page.appendChild(h(
      '<div class="hero">' +
        '<div class="hero-main">' +
          '<h1>Excel training for the Yakov &amp; Partners test</h1>' +
          '<p>Twelve levels from the address of a cell to a pivot table and a consulting case. ' +
          'Every task is solved in a real spreadsheet and marked on the value it produces, exactly like the real test.</p>' +
          '<div class="progressbar"><i style="width:' + pct + '%"></i></div>' +
          '<p style="margin-top:8px;font-size:12.5px">' + pct + '% of the programme · ' + totalGot + ' of ' + totalMax + ' points</p>' +
        '</div>' +
        '<div class="hero-actions">' +
          (next ? '<button class="btn btn-lg" data-go="' + next.level.id + '/' + next.task.id + '">Continue</button>' : '') +
          '<button class="btn btn-ghost btn-lg" data-nav="dojo">Shortcut dojo</button>' +
        '</div>' +
      '</div>'
    ));

    page.appendChild(h(
      '<div class="card notice">' +
        '<b>Nothing here can be lost.</b> A wrong answer costs no points and can be retried as often as you like — ' +
        'only your best attempt is ever recorded. Every level and every mock test is open from the start, ' +
        'so a task you cannot crack today will never block you: move on and come back to it.' +
      '</div>'));

    var review = reviewQueue();
    if (review.length) {
      var rc = h('<div class="card" style="padding:16px 18px;margin-bottom:20px"></div>');
      rc.appendChild(h('<div style="font-weight:600;margin-bottom:4px">' + review.length + ' ' +
        plural(review.length, 'task', 'tasks') + ' worth revisiting</div>'));
      rc.appendChild(h('<div style="color:var(--muted);font-size:12.5px;margin-bottom:12px">Tasks you solved with a hint, ' +
        'solved partially, or looked the answer up. Try them again unaided — your score can only go up.</div>'));
      var list = h('<div class="review-list"></div>');
      review.slice(0, 4).forEach(function (r) {
        list.appendChild(h('<div class="card task-row" data-go="' + r.level.id + '/' + r.task.id + '">' +
          '<div class="task-status partial">↻</div>' +
          '<div class="task-row-main"><div class="task-row-title">' + esc(r.task.title) + '</div>' +
          '<div class="task-row-brief">Level ' + r.level.id + ' · ' + esc(r.reason) + '</div></div>' +
          '<div class="task-row-points">' + Store.earnedFor(r.task) + '/' + r.task.points + '</div></div>'));
      });
      rc.appendChild(list);
      page.appendChild(rc);
    }

    var grid = h('<div class="levels"></div>');
    CUR.levels.forEach(function (lv) {
      var st = levelStats(lv);
      // the mock test level counts in papers passed, not in task points
      var passed = !lv.exam ? 0 : lv.papers.filter(function (p) {
        var b = Store.bestExam(p.id);
        return b && b.score >= lv.passScore;
      }).length;
      var share = lv.exam ? passed / lv.papers.length : st.share;
      var cls = 'card level-card' + (share >= 0.999 ? ' done' : '') + (lv.exam ? ' exam' : '');
      var badge = lv.exam
        ? (passed ? '<span class="badge ok">' + passed + ' of ' + lv.papers.length + ' passed</span>'
                  : '<span class="badge gold">' + lv.papers.length + ' papers</span>')
        : st.done === st.total ? '<span class="badge ok">complete</span>'
        : st.done ? '<span class="badge warn">' + st.done + ' of ' + st.total + '</span>'
        : '<span class="badge">not started</span>';
      var satPapers = !lv.exam ? 0 : lv.papers.filter(function (p) { return !!Store.bestExam(p.id); }).length;
      var meta = lv.exam
        ? (satPapers ? satPapers + ' of ' + lv.papers.length + ' sat' : 'none sat yet')
        : st.got + ' / ' + st.max + ' points';
      grid.appendChild(h(
        '<div class="' + cls + '" data-level="' + lv.id + '">' +
          '<div class="level-top">' +
            '<div class="level-num">' + (lv.exam ? '★' : lv.id) + '</div>' +
            '<div><div class="level-title">' + esc(lv.title) + '</div>' +
            '<div class="level-sub">' + esc(lv.subtitle) + '</div></div>' +
          '</div>' +
          '<div class="progressbar"><i style="width:' + Math.round(share * 100) + '%"></i></div>' +
          '<div class="level-meta"><span>' + meta + '</span>' + badge + '</div>' +
        '</div>'));
    });
    page.appendChild(grid);

    if (!Store.persistent) {
      page.appendChild(h('<div class="card" style="padding:12px 16px;margin-top:18px;font-size:12.5px;color:var(--muted)">' +
        'Nothing can be saved here, so progress will be lost when you close this window. ' +
        'Launch the app through ExcelTrainer.app or run.sh and it is written to a file on your Mac.</div>'));
    }
    show(page);
  }

  function reviewQueue() {
    var out = [];
    CUR.levels.forEach(function (lv) {
      if (lv.exam) return;
      lv.tasks.forEach(function (t) {
        var s = Store.task(t.id);
        if (!s.attempts) return;
        if (s.seenSolution) out.push({ level: lv, task: t, reason: 'you looked at the answer' });
        else if (s.hinted && s.best >= 1) out.push({ level: lv, task: t, reason: 'solved with a hint' });
        else if (s.best < 1) out.push({ level: lv, task: t, reason: 'not fully solved yet' });
      });
    });
    return out;
  }

  /* ============================================================= LEVEL === */
  function renderLevel(id, paperId) {
    var lv = levelById(id);
    if (!lv) return renderHome();
    var st = levelStats(lv);
    var paper = lv.exam ? (paperById(lv, paperId) || suggestedPaper(lv)) : null;
    var tasks = paper ? paper.tasks : lv.tasks;

    var page = h('<div class="page"></div>');
    page.appendChild(h(
      '<div class="page-head">' +
        '<div class="crumbs"><button data-nav="home">Programme</button> › Level ' + lv.id + '</div>' +
        '<h1>' + esc(lv.title) + '</h1>' +
        '<p>' + esc(lv.goal) + '</p>' +
      '</div>'));

    var layout = h('<div class="level-layout"></div>');
    var left = h('<div></div>');

    if (lv.exam) {
      var sat = lv.papers.filter(function (p) { return !!Store.bestExam(p.id); }).length;
      var passed = lv.papers.filter(function (p) {
        var b = Store.bestExam(p.id);
        return b && b.score >= lv.passScore;
      }).length;

      left.appendChild(h(
        '<div class="card" style="padding:18px 20px;margin-bottom:16px">' +
          '<div style="font-weight:600;margin-bottom:6px">' + esc(paper.title) + ': ' + tasks.length +
          ' questions, ' + Math.round((paper.timeLimitSec || lv.timeLimitSec) / 60) + ' minutes, no hints</div>' +
          '<div style="color:var(--muted);font-size:13px;margin-bottom:14px">' +
          esc(paper.subtitle || '') + (paper.subtitle ? '<br>' : '') +
          'Pass mark ' + Math.round(lv.passScore * 100) + '%. You can move between questions freely and your ' +
          'answers are kept; marking happens at the end, like the real thing. Sit any paper as many times as ' +
          'you want — a poor run never reduces the points you already have.</div>' +
          '<button class="btn btn-primary" id="start-exam">Start ' + esc(paper.title.toLowerCase()) + '</button>' +
        '</div>'));

      var picker = h('<div class="card" style="padding:16px 18px;margin-bottom:16px"></div>');
      picker.appendChild(h('<div style="font-weight:600;margin-bottom:4px">Fifty papers</div>'));
      picker.appendChild(h('<div style="color:var(--muted);font-size:12.5px;margin-bottom:12px">' +
        'Every paper is twenty questions on its own set of data, and every one of them is open now. ' +
        'Pick one to see its questions, then start it. ' +
        (sat ? 'Sat ' + sat + ' of ' + lv.papers.length + ', passed ' + passed + '.'
             : 'None sat yet — paper 1 comes with a full walk-through of every answer.') +
        '</div>'));
      var chips = h('<div class="paper-grid"></div>');
      lv.papers.forEach(function (p) {
        var best = Store.bestExam(p.id);
        var cls = 'paper-chip' + (p.id === paper.id ? ' current' : '') +
          (best ? (best.score >= lv.passScore ? ' passed' : ' tried') : '');
        chips.appendChild(h('<button class="' + cls + '" data-paper="' + p.id + '" ' +
          'title="' + esc(p.title + (p.subtitle ? ' — ' + p.subtitle : '')) + '">' +
          '<b>' + p.n + '</b>' +
          '<span>' + (best ? Math.round(best.score * 100) + '%' : '—') + '</span></button>'));
      });
      picker.appendChild(chips);
      left.appendChild(picker);
    }

    var list = h('<div class="task-list"></div>');
    tasks.forEach(function (t) {
      var s = Store.task(t.id), earned = Store.earnedFor(t);
      var cls = s.best >= 1 ? 'done' : (s.attempts ? 'partial' : '');
      var mark = s.best >= 1 ? '✓' : (s.attempts ? '·' : '');
      var kind = t.mode === 'pivot' ? '<span class="tag">pivot</span>'
        : (t.expect && (t.expect.sortedBy || t.expect.filtered)) ? '<span class="tag">sort / filter</span>' : '';
      list.appendChild(h(
        '<div class="card task-row" data-go="' + lv.id + '/' + t.id + '">' +
          '<div class="task-status ' + cls + '">' + mark + '</div>' +
          '<div class="task-row-main">' +
            '<div class="task-row-title">' + esc(t.title) + ' ' + kind + '</div>' +
            '<div class="task-row-brief">' + esc(t.brief) + '</div>' +
          '</div>' +
          '<div class="task-row-points">' + earned + ' / ' + t.points + '</div>' +
        '</div>'));
    });
    left.appendChild(list);
    layout.appendChild(left);

    var theory = h('<div class="card theory"><h3>What you need to know</h3></div>');
    (lv.theory || []).forEach(function (t) {
      theory.appendChild(h('<div class="theory-item"><b>' + esc(t.h) + '</b><span>' + esc(t.p) + '</span></div>'));
    });
    theory.appendChild(h('<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)">' +
      'Level progress: ' + st.got + ' of ' + st.max + ' points. ' +
      'Every level is open from the start — take them in any order you like.</div>'));
    layout.appendChild(theory);
    page.appendChild(layout);
    show(page);

    var se = document.getElementById('start-exam');
    if (se) se.addEventListener('click', function () { startExam(lv, paper); });
    Array.prototype.forEach.call(page.querySelectorAll('[data-paper]'), function (b) {
      b.addEventListener('click', function () { go('level/' + lv.id + '/' + b.dataset.paper); });
    });
  }

  /* ============================================================== TASK === */
  function renderTask(levelId, taskId) {
    var lv = levelById(levelId);
    if (!lv) return renderHome();
    var task = taskById(lv, taskId);
    if (!task) return renderLevel(levelId);
    // on the mock test level a question belongs to one of the fifty papers;
    // everywhere else the level itself plays that part
    var paper = lv.exam ? paperOf(lv, task) : { id: lv.id, tasks: lv.tasks, title: lv.title };
    var siblings = paper.tasks;
    var examMode = !!(state.exam && state.exam.paper.id === paper.id);

    state.level = lv; state.task = task;
    var targets = G.targetCells(task);
    var isPivot = task.mode === 'pivot';
    var sheet;
    if (examMode) {
      sheet = state.exam.sheets[task.id] || (state.exam.sheets[task.id] = G.buildSheet(task));
    } else {
      sheet = state.sheets[task.id] || (state.sheets[task.id] = G.buildSheet(task));
    }

    var idx = siblings.indexOf(task);
    var wrap = h('<div class="workspace"></div>');
    var panel = h('<aside class="task-panel"></aside>');
    var crumb = lv.exam
      ? '<button data-go="level/' + lv.id + '/' + paper.id + '">' + esc(paper.title) + '</button>'
      : '<button data-level="' + lv.id + '">Level ' + lv.id + '</button>';
    panel.appendChild(h('<div class="crumbs"><button data-nav="home">Programme</button> › ' +
      crumb + ' › Question ' + (idx + 1) + ' of ' + siblings.length + '</div>'));
    panel.appendChild(h('<h2>' + esc(task.title) + '</h2>'));
    panel.appendChild(h('<div class="brief">' + esc(task.brief) + '</div>'));

    if (examMode) panel.appendChild(h('<div class="timer" id="exam-timer">—</div>'));

    var hintSlot = h('<div></div>');
    var already = Store.task(task.id);
    if (!examMode && already.hinted) {
      hintSlot.appendChild(h('<div class="hintbox"><b>Hint</b>' + esc(task.hint) + '</div>'));
    }
    if (!examMode && already.best >= 1) {
      panel.appendChild(h('<div class="solved-note">Already solved — ' + Store.earnedFor(task) + ' of ' +
        task.points + ' points. Redo it unaided to raise the score; it can never go down.</div>'));
    }
    panel.appendChild(hintSlot);

    var actions = h('<div class="panel-actions"></div>');
    if (!examMode) {
      actions.appendChild(h('<button class="btn btn-primary" id="btn-check">Check my answer</button>'));
      actions.appendChild(h('<button class="btn" id="btn-hint">Hint</button>'));
      actions.appendChild(h('<button class="btn" id="btn-explain">Explain</button>'));
      actions.appendChild(h('<button class="btn btn-ghost" id="btn-reset">Clear my work</button>'));
      actions.appendChild(h('<button class="btn btn-ghost" id="btn-solution">Show the answer</button>'));
    } else {
      if (idx > 0) actions.appendChild(h('<button class="btn" id="btn-prev">← Back</button>'));
      if (idx < siblings.length - 1) actions.appendChild(h('<button class="btn btn-primary" id="btn-next">Next →</button>'));
      actions.appendChild(h('<button class="btn btn-ghost" id="btn-finish">Finish the test</button>'));
    }
    panel.appendChild(actions);

    var resultSlot = h('<div></div>');
    panel.appendChild(resultSlot);

    if (examMode) {
      var nav = h('<div class="exam-nav"></div>');
      siblings.forEach(function (t, i) {
        var sh = state.exam.sheets[t.id];
        var touched = (sh && G.targetCells(t).some(function (a1) { return sh.rawAt(a1) !== ''; })) ||
          (state.exam.pivots[t.id] && state.exam.pivots[t.id].values && state.exam.pivots[t.id].values.length);
        nav.appendChild(h('<button class="btn exam-chip' + (t.id === task.id ? ' current' : '') +
          (touched ? ' filled' : '') + '" data-go="' + lv.id + '/' + t.id + '">' + (i + 1) + '</button>'));
      });
      panel.appendChild(nav);
    } else {
      panel.appendChild(h('<div class="shortcut-legend">' +
        '<span class="kbd">⌘D</span> fill down · <span class="kbd">⌘R</span> fill right<br>' +
        '<span class="kbd">⌘T</span> toggle $ · <span class="kbd">F2</span> edit cell<br>' +
        '<span class="kbd">⌘↓</span> jump to edge · <span class="kbd">⌘⇧↓</span> select to edge' +
        (task.table && !isPivot ? '<br><span class="kbd">⌘⇧F</span> turn the filter on' : '') +
        '</div>'));
    }
    wrap.appendChild(panel);

    /* ---- work area: sheet, and a pivot tab when the task needs one ---- */
    var area = h('<section class="sheet-area"></section>');
    var tabs = null;
    if (isPivot) {
      tabs = h('<div class="work-tabs">' +
        '<button data-tab="pivot" class="active">Pivot table</button>' +
        '<button data-tab="sheet">Source data</button></div>');
      area.appendChild(tabs);
    }
    var sheetPane = h(
      '<div class="pane" id="pane-sheet">' +
        '<div class="formula-bar">' +
          '<div class="fb-addr" id="fb-addr">A1</div>' +
          '<div class="fb-fx">fx</div>' +
          '<input class="fb-input" id="fb-input" spellcheck="false" autocomplete="off">' +
        '</div>' +
        '<div class="grid-wrap" id="grid-host"></div>' +
        '<div class="statusbar" id="statusbar"></div>' +
      '</div>');
    var pivotPane = h('<div class="pane" id="pane-pivot"></div>');
    if (isPivot) { area.appendChild(pivotPane); sheetPane.hidden = true; }
    area.appendChild(sheetPane);
    if (task.table && !isPivot) {
      sheetPane.insertBefore(h('<div class="table-tools">' +
        '<button class="btn" id="btn-filter">Turn filter on <span class="kbd">⌘⇧F</span></button>' +
        '<span class="tools-note">Then click the ▾ arrows in the header row to sort or filter.</span>' +
        '</div>'), sheetPane.firstChild);
    }
    wrap.appendChild(area);
    show(wrap);

    var host = document.getElementById('grid-host');
    var fbAddr = document.getElementById('fb-addr');
    var fbInput = document.getElementById('fb-input');
    var statusbar = document.getElementById('statusbar');

    var grid = null;
    grid = new root.XLGrid(host, sheet, {
      rows: (task.sheet && task.sheet.rows) || 20,
      cols: (task.sheet && task.sheet.cols) || 10,
      targets: targets,
      readOnly: isPivot,
      onFlash: toast,
      onSelect: function (info) {
        fbAddr.textContent = info.rangeAddr;
        if (!(grid && grid.editing)) fbInput.value = info.raw;
        fbInput.disabled = !info.editable;
        renderStatus(statusbar, info, targets, sheet);
      },
      onChange: function (ev) {
        if (ev.type === 'editing') fbInput.value = ev.text;
        if (grid && ['commit', 'fill', 'paste', 'clear', 'undo'].indexOf(ev.type) >= 0) grid.paint();
      }
    });
    state.grid = grid;

    /* pivot builder */
    state.pivot = null;
    if (isPivot) {
      var store = examMode ? state.exam.pivots : state.pivots;
      var builder = new root.XLPivotUI.PivotBuilder(pivotPane, sheet, task.expect.pivot.source || task.table,
        function (cfg) { store[task.id] = cfg; });
      state.pivot = builder;
      if (store[task.id] && (store[task.id].rows.length || store[task.id].values.length)) {
        builder.setConfig(store[task.id]);
      }
      Array.prototype.forEach.call(tabs.children, function (b) {
        b.addEventListener('click', function () {
          Array.prototype.forEach.call(tabs.children, function (x) { x.classList.remove('active'); });
          b.classList.add('active');
          sheetPane.hidden = b.dataset.tab !== 'sheet';
          pivotPane.hidden = b.dataset.tab !== 'pivot';
          if (b.dataset.tab === 'sheet') grid.paint();
        });
      });
    } else {
      grid.focus();
    }

    var filterBtn = document.getElementById('btn-filter');
    if (filterBtn) {
      filterBtn.addEventListener('click', function () {
        grid.setFiltersOn(!grid.filtersOn);
        filterBtn.innerHTML = grid.filtersOn
          ? 'Turn filter off <span class="kbd">⌘⇧F</span>'
          : 'Turn filter on <span class="kbd">⌘⇧F</span>';
        grid.focus();
      });
    }

    fbInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!grid.canEdit(grid.sel.r, grid.sel.c)) { toast('That cell holds source data and cannot be changed'); return; }
        grid.setCell(XLF.rcToA1(grid.sel.r, grid.sel.c), fbInput.value);
        grid.select(grid.sel.r + 1, grid.sel.c);
        grid.focus();
      }
      if (e.key === 'Escape') { fbInput.value = sheet.raw(grid.sel.r, grid.sel.c); grid.focus(); }
    });

    function extras() { return state.pivot ? { pivot: state.pivot.getConfig() } : undefined; }

    if (!examMode) {
      document.getElementById('btn-check').addEventListener('click', function () {
        var res = G.grade(task, sheet, extras());
        var rec = Store.recordAttempt(task, res, {});
        updateHeader();
        showResult(resultSlot, res, task, rec, lv, sheet);
      });
      document.getElementById('btn-hint').addEventListener('click', function () {
        if (hintSlot.firstChild) return;
        Store.recordAttempt(task, { score: Store.task(task.id).best, passed: false }, { hinted: true });
        hintSlot.appendChild(h('<div class="hintbox"><b>Hint — costs 30% of this task’s points</b>' + esc(task.hint) + '</div>'));
        updateHeader();
      });
      document.getElementById('btn-explain').addEventListener('click', function () {
        resultSlot.innerHTML = '';
        resultSlot.appendChild(buildExplanation(task, sheet, { alwaysOpen: true }));
      });
      document.getElementById('btn-reset').addEventListener('click', function () {
        targets.forEach(function (a1) { sheet.setAt(a1, '', { locked: false }); });
        sheet.clearFilters();
        if (state.pivot) state.pivot.reset();
        grid.paint(); resultSlot.innerHTML = '';
        toast('This task only — your points and every other task are untouched');
      });
      document.getElementById('btn-solution').addEventListener('click', function () {
        if (!confirm('Show the worked answer? This task will keep at most 40% of its points — everything else you have earned stays exactly as it is.')) return;
        var pivotCfg = G.applyFullSolution(sheet, task);
        if (pivotCfg && state.pivot) state.pivot.setConfig(pivotCfg);
        Store.recordAttempt(task, { score: 1, passed: true }, { seenSolution: true });
        grid.paint(); updateHeader();
        resultSlot.innerHTML = '';
        var box = h('<div class="solution-box"><b>The reference answer</b></div>');
        Object.keys(task.solution || {}).forEach(function (ref) {
          box.appendChild(h('<div>' + esc(ref) + ' → ' + esc(task.solution[ref]) + '</div>'));
        });
        if (task.expect && task.expect.sortedBy) {
          box.appendChild(h('<div>Sorted by column ' + task.expect.sortedBy.col +
            (task.expect.sortedBy.asc ? ', smallest first' : ', largest first') + '</div>'));
        }
        if (task.expect && task.expect.filtered) {
          box.appendChild(h('<div>Filter on column ' + task.expect.filtered.col + ': ' +
            esc(task.expect.filtered.values.join(', ')) + '</div>'));
        }
        if (pivotCfg) {
          box.appendChild(h('<div>Rows: ' + esc(pivotCfg.rows.join(', ') || '—') + '</div>'));
          box.appendChild(h('<div>Columns: ' + esc(pivotCfg.cols.join(', ') || '—') + '</div>'));
          box.appendChild(h('<div>Values: ' + esc(pivotCfg.values.map(PV.specLabel).join(', ')) + '</div>'));
          if (pivotCfg.filters.length) {
            box.appendChild(h('<div>Filters: ' + esc(pivotCfg.filters.map(function (f) {
              return f.field + ' = ' + f.values.join('/');
            }).join('; ')) + '</div>'));
          }
        }
        resultSlot.appendChild(box);
        resultSlot.appendChild(buildExplanation(task, sheet, { alwaysOpen: true }));
      });
    } else {
      var prev = document.getElementById('btn-prev');
      if (prev) prev.addEventListener('click', function () { go(lv.id + '/' + siblings[idx - 1].id); });
      var nx = document.getElementById('btn-next');
      if (nx) nx.addEventListener('click', function () { go(lv.id + '/' + siblings[idx + 1].id); });
      document.getElementById('btn-finish').addEventListener('click', function () {
        if (confirm('Finish the mock test and see how you did?')) finishExam();
      });
      tickExam();
    }
  }

  function renderStatus(bar, info, targets, sheet) {
    var left = 0;
    targets.forEach(function (a1) { if (sheet.rawAt(a1) === '') left++; });
    bar.innerHTML =
      '<span>Sum: <b>' + fmt(info.sum) + '</b></span>' +
      '<span>Average: <b>' + fmt(info.avg) + '</b></span>' +
      '<span>Numbers: <b>' + info.numCount + '</b></span>' +
      '<span>Cells: <b>' + info.count + '</b></span>' +
      '<span class="spacer"></span>' +
      (targets.length ? '<span>Still to fill: <b>' + left + '</b> of ' + targets.length + '</span>' : '');
  }

  /* --------------------------------------------------------- explanation */
  function buildExplanation(task, sheet, opts) {
    opts = opts || {};
    var box = h('<div class="explain"></div>');
    var ex = task.explain || {};
    box.appendChild(h('<div class="ex-h">How this works</div>'));
    if (ex.idea) box.appendChild(h('<div class="ex-idea">' + esc(ex.idea) + '</div>'));
    if ((ex.walk || []).length) {
      var ol = h('<ol class="ex-walk"></ol>');
      ex.walk.forEach(function (line) { ol.appendChild(h('<li>' + esc(line) + '</li>')); });
      box.appendChild(ol);
    }

    // the learner's own formulas, taken apart piece by piece
    var cells = G.targetCells(task).filter(function (a1) {
      var raw = sheet.rawAt(a1);
      return raw && raw.charAt(0) === '=';
    });
    var seen = {}, shown = 0;
    cells.forEach(function (a1) {
      if (shown >= 3) return;
      var raw = sheet.rawAt(a1);
      var key = raw.replace(/[0-9]+/g, '#');
      if (seen[key]) return;
      seen[key] = 1;
      shown++;
      var rc = XLF.a1ToRC(a1);
      var res = XP.explain(raw, sheet, { row: rc.row, col: rc.col });
      if (!res.ok) return;
      var det = h('<details class="ex-formula"' + (opts.alwaysOpen && shown === 1 ? ' open' : '') + '></details>');
      det.appendChild(h('<summary>Your formula in ' + a1 + ': <code>' + esc(raw) + '</code> → <b>' + esc(res.result) + '</b></summary>'));
      var body = h('<div class="ex-steps"></div>');
      res.steps.forEach(function (st) {
        var row = h('<div class="ex-step" style="margin-left:' + (st.depth * 16) + 'px"></div>');
        if (st.kind === 'call' || st.kind === 'op') {
          row.appendChild(h('<div class="es-expr"><code>' + esc(st.expr) + '</code> <span class="es-val">= ' + esc(st.value) + '</span></div>'));
          row.appendChild(h('<div class="es-title">' + esc(st.title) + '</div>'));
          if (st.note) row.appendChild(h('<div class="es-note">' + esc(st.note) + '</div>'));
        } else {
          row.appendChild(h('<div class="es-arg">' + (st.label ? '<i>' + esc(st.label) + ':</i> ' : '') +
            '<code>' + esc(st.expr) + '</code> <span class="es-val">= ' + esc(st.value) + '</span></div>'));
        }
        body.appendChild(row);
      });
      det.appendChild(body);
      box.appendChild(det);
    });

    if ((ex.mistakes || []).length) {
      box.appendChild(h('<div class="ex-h2">What people get wrong</div>'));
      var ul = h('<ul class="ex-mistakes"></ul>');
      ex.mistakes.forEach(function (m) { ul.appendChild(h('<li>' + esc(m) + '</li>')); });
      box.appendChild(ul);
    }
    if (ex.onTheJob) {
      box.appendChild(h('<div class="ex-job"><b>On a real project.</b> ' + esc(ex.onTheJob) + '</div>'));
    }
    return box;
  }

  function showResult(slot, res, task, rec, lv, sheet) {
    slot.innerHTML = '';
    if (res.passed) {
      var around = lv.exam ? paperOf(lv, task).tasks : lv.tasks;
      var next = around[around.indexOf(task) + 1];
      slot.appendChild(h('<div class="result ok"><b>Correct.</b> ' + rec.earned + ' of ' + task.points + ' points' +
        (rec.delta ? ' · <b>+' + rec.delta + ' XP</b>' : '') + '</div>'));
      slot.appendChild(buildExplanation(task, sheet, { alwaysOpen: true }));
      var nav = h('<div class="panel-actions" style="margin-top:12px"></div>');
      if (next) nav.appendChild(h('<button class="btn btn-primary" data-go="' + lv.id + '/' + next.id + '">Next question →</button>'));
      else if (lv.exam) nav.appendChild(h('<button class="btn btn-primary" data-go="level/' + lv.id + '/' +
        paperOf(lv, task).id + '">Back to the paper →</button>'));
      else nav.appendChild(h('<button class="btn btn-primary" data-level="' + lv.id + '">Level complete →</button>'));
      slot.appendChild(nav);
      return;
    }
    var bad = res.cells.filter(function (c) { return !c.ok; });
    var html = '<div class="result bad"><b>Not there yet.</b> ' + res.okCount + ' of ' + res.total + ' checks pass. ' +
      'Nothing is lost — fix it and press Check again.<ul>';
    bad.slice(0, 6).forEach(function (c) {
      html += '<li><code>' + esc(c.cell) + '</code> — ' + esc(c.reason) + '</li>';
    });
    if (bad.length > 6) html += '<li>…and ' + (bad.length - 6) + ' more</li>';
    html += '</ul></div>';
    slot.appendChild(h(html));
  }

  /* ============================================================== EXAM === */
  function startExam(lv, paper) {
    paper = paper || suggestedPaper(lv);
    state.exam = { level: lv, paper: paper, started: Date.now(), sheets: {}, pivots: {}, finished: false };
    paper.tasks.forEach(function (t) {
      state.exam.sheets[t.id] = G.buildSheet(t);
      state.exam.pivots[t.id] = { rows: [], cols: [], values: [], filters: [] };
    });
    go(lv.id + '/' + paper.tasks[0].id);
  }

  function tickExam() {
    clearInterval(state.timerId);
    if (!document.getElementById('exam-timer') || !state.exam) return;
    var limit = state.exam.paper.timeLimitSec || state.exam.level.timeLimitSec;
    function upd() {
      var left = limit - (Date.now() - state.exam.started) / 1000;
      var e = document.getElementById('exam-timer');
      if (!e) { clearInterval(state.timerId); return; }
      e.textContent = mmss(left) + ' left';
      e.className = 'timer' + (left < 300 ? ' urgent' : '');
      if (left <= 0) { clearInterval(state.timerId); finishExam(true); }
    }
    upd();
    state.timerId = setInterval(upd, 1000);
  }

  function finishExam(byTime) {
    clearInterval(state.timerId);
    var ex = state.exam;
    if (!ex) return renderHome();
    var lv = ex.level, paper = ex.paper, rows = [], points = 0, maxPoints = 0;
    paper.tasks.forEach(function (t) {
      var extra = t.mode === 'pivot' ? { pivot: ex.pivots[t.id] } : undefined;
      var res = G.grade(t, ex.sheets[t.id], extra);
      var earned = Math.round(t.points * res.score);
      points += earned; maxPoints += t.points;
      Store.recordAttempt(t, res, {});
      rows.push({ task: t, res: res, earned: earned });
    });
    var seconds = Math.round((Date.now() - ex.started) / 1000);
    var share = maxPoints ? points / maxPoints : 0;
    Store.recordExam({
      date: new Date().toISOString(), paper: paper.id, title: paper.title,
      score: share, points: points, maxPoints: maxPoints, seconds: seconds
    });
    updateHeader();
    state.exam = null;

    var page = h('<div class="page"></div>');
    var passed = share >= lv.passScore;
    var previous = Store.examsFor(paper.id);
    page.appendChild(h(
      '<div class="page-head"><div class="crumbs"><button data-nav="home">Programme</button> › ' +
      '<button data-go="level/' + lv.id + '/' + paper.id + '">' + esc(paper.title) + '</button> › Result</div>' +
      '<h1>' + (passed ? 'Passed' : 'Not passed this time') + '</h1>' +
      '<p>' + esc(paper.title) + ': ' + Math.round(share * 100) + '% (' + points + ' of ' + maxPoints +
      ' points) in ' + mmss(seconds) + (byTime ? '. Time ran out.' : '') + ' The pass mark is ' +
      Math.round(lv.passScore * 100) + '%. ' +
      (previous.length > 1 ? 'That is sitting number ' + previous.length + ' of this paper. ' : '') +
      'Open any question below to see the worked answer — your other progress is untouched, and ' +
      'forty-nine other papers are waiting.</p></div>'));

    var list = h('<div class="task-list"></div>');
    rows.forEach(function (r) {
      var cls = r.res.passed ? 'done' : (r.res.okCount ? 'partial' : '');
      var wrong = r.res.cells.filter(function (c) { return !c.ok; });
      list.appendChild(h(
        '<div class="card task-row" data-go="' + lv.id + '/' + r.task.id + '">' +
          '<div class="task-status ' + cls + '">' + (r.res.passed ? '✓' : '✗') + '</div>' +
          '<div class="task-row-main"><div class="task-row-title">' + esc(r.task.title) + '</div>' +
          '<div class="task-row-brief">' + (r.res.passed ? 'correct' :
            r.res.okCount + ' of ' + r.res.total + ' checks passed' +
            (wrong.length ? ' · ' + esc(wrong[0].cell + ': ' + wrong[0].reason) : '')) + '</div></div>' +
          '<div class="task-row-points">' + r.earned + ' / ' + r.task.points + '</div>' +
        '</div>'));
    });
    page.appendChild(list);
    var nextPaper = suggestedPaper(lv);
    page.appendChild(h('<div class="panel-actions" style="margin-top:18px">' +
      '<button class="btn btn-primary" data-go="level/' + lv.id + '/' + paper.id + '">Sit this paper again</button>' +
      (nextPaper && nextPaper.id !== paper.id
        ? '<button class="btn" data-go="level/' + lv.id + '/' + nextPaper.id + '">Try ' +
          esc(nextPaper.title.toLowerCase()) + ' →</button>' : '') +
      '<button class="btn btn-ghost" data-nav="home">Back to the programme</button></div>'));
    show(page);
  }

  /* ============================================================== DOJO === */
  function renderDojo(mode) {
    var page = h('<div class="page"><div class="dojo"></div></div>');
    var box = page.firstChild;
    box.appendChild(h(
      '<div class="page-head" style="text-align:center">' +
        '<h1>Shortcut dojo</h1>' +
        '<p style="margin:0 auto">On a 60-minute test the mouse costs you a third of your time. Answer with the number keys 1–4.</p>' +
      '</div>'));
    var tabs = h('<div class="ref-tabs" style="justify-content:center">' +
      '<button data-mode="mixed">Everything</button>' +
      '<button data-mode="shortcuts">Shortcuts</button>' +
      '<button data-mode="functions">Functions</button>' +
      '<button data-mode="errors">Errors</button>' +
      '</div>');
    box.appendChild(tabs);
    var card = h('<div class="card dojo-card"></div>');
    box.appendChild(card);
    show(page);

    Array.prototype.forEach.call(tabs.children, function (b) {
      if (b.dataset.mode === (mode || 'mixed')) b.className = 'active';
      b.addEventListener('click', function () { renderDojo(b.dataset.mode); });
    });

    var qs = DRILLS.buildDrill({ count: 12, mode: mode || 'mixed', platform: Store.data.platform });
    var i = 0, correct = 0, streak = 0;

    function draw() {
      if (i >= qs.length) {
        card.innerHTML = '';
        card.appendChild(h('<div class="dojo-prompt">Round finished</div>'));
        card.appendChild(h('<div style="font-size:34px;margin:14px 0;color:var(--navy)"><b>' + correct + '</b> of ' + qs.length + '</div>'));
        card.appendChild(h('<div class="dojo-why" style="text-align:center">All-time: ' +
          Store.data.drills.correct + ' correct out of ' + Store.data.drills.total +
          ' · best streak ' + Store.data.drills.bestStreak + '</div>'));
        card.appendChild(h('<div class="panel-actions" style="justify-content:center;margin-top:18px">' +
          '<button class="btn btn-primary" id="again">Another round</button>' +
          '<button class="btn" data-nav="home">Back to the programme</button></div>'));
        document.getElementById('again').addEventListener('click', function () { renderDojo(mode); });
        return;
      }
      var q = qs[i];
      card.innerHTML = '';
      card.appendChild(h('<div class="dojo-meta"><span>Question ' + (i + 1) + ' of ' + qs.length + '</span>' +
        '<span>Streak: ' + streak + '</span></div>'));
      card.appendChild(h('<div class="dojo-prompt">' + esc(q.prompt) + '</div>'));
      if (q.keys) card.appendChild(h('<div class="dojo-keys">' + esc(q.keys) + '</div>'));
      var opts = h('<div class="dojo-options"></div>');
      q.options.forEach(function (o, k) {
        var b = h('<button class="opt"><span class="num">' + (k + 1) + '</span><span>' + esc(o) + '</span></button>');
        b.addEventListener('click', function () { answer(k); });
        opts.appendChild(b);
      });
      card.appendChild(opts);

      function answer(k) {
        var buttons = opts.querySelectorAll('.opt');
        Array.prototype.forEach.call(buttons, function (b, j) {
          b.disabled = true;
          if (j === q.answer) b.classList.add('correct');
          else if (j === k) b.classList.add('wrong');
        });
        var ok = k === q.answer;
        if (ok) { correct++; streak++; } else streak = 0;
        Store.recordDrill(ok, streak);
        updateHeader();
        if (q.why) card.appendChild(h('<div class="dojo-why">' + esc(q.why) + '</div>'));
        card.appendChild(h('<div class="panel-actions" style="justify-content:center;margin-top:16px">' +
          '<button class="btn btn-primary" id="nextq">Next <span class="kbd">Enter</span></button></div>'));
        document.getElementById('nextq').addEventListener('click', function () { i++; draw(); });
        card.dataset.answered = '1';
      }
      card.dataset.answered = '';
      card.__answer = answer;
      card.__next = function () { i++; draw(); };
    }

    document.onkeydown = function (e) {
      if (!document.querySelector('.dojo-card')) { document.onkeydown = null; return; }
      if (e.key >= '1' && e.key <= '4' && !card.dataset.answered && card.__answer) {
        var k = +e.key - 1;
        if (k < card.querySelectorAll('.opt').length) card.__answer(k);
      } else if (e.key === 'Enter' && card.dataset.answered) card.__next();
    };
    draw();
  }

  /* ========================================================= REFERENCE === */
  var FUNC_REF = [
    ['SUM(range)', 'Maths', 'Adds the numbers. Text and blanks are ignored.'],
    ['AVERAGE(range)', 'Maths', 'Mean of the numbers in the range.'],
    ['ROUND(x, digits)', 'Maths', 'Rounds. A negative digit count rounds to tens, hundreds, thousands.'],
    ['ROUNDUP(x, digits)', 'Maths', 'Always away from zero — for units, trucks, shifts, people.'],
    ['SUMPRODUCT(a, b)', 'Maths', 'Sum of pairwise products. With conditions inside it replaces SUMIFS.'],
    ['IF(test, yes, no)', 'Logic', 'The basic branch. Text always in quotes.'],
    ['AND(...) / OR(...)', 'Logic', 'Every condition / at least one. Used inside IF.'],
    ['IFERROR(formula, fallback)', 'Logic', 'Replaces any error. Use deliberately, not as a reflex.'],
    ['SUMIF(test range, criterion, sum range)', 'Conditional', 'One condition. Sum range comes last.'],
    ['SUMIFS(sum range, test1, crit1, …)', 'Conditional', 'Several conditions. Sum range comes FIRST.'],
    ['COUNTIFS(test1, crit1, …)', 'Conditional', 'How many rows satisfy every condition.'],
    ['AVERAGEIFS(avg range, test1, crit1, …)', 'Conditional', 'Average under conditions.'],
    ['SUBTOTAL(9, range)', 'Tables', 'Sums the VISIBLE rows only. 1=average, 2=count, 3=counta, 4=max, 5=min, 9=sum.'],
    ['VLOOKUP(key, table, col, 0)', 'Lookup', 'Exact match down the first column. The final 0 is not optional.'],
    ['VLOOKUP(key, table, col, 1)', 'Lookup', 'Approximate match on an ascending ladder: grades, discounts, tax bands.'],
    ['INDEX(range, row, col)', 'Lookup', 'The value at a position.'],
    ['MATCH(key, range, 0)', 'Lookup', 'The position of a value. Pair it with INDEX to look leftwards.'],
    ['XLOOKUP(key, look in, return, if missing)', 'Lookup', 'Modern replacement for VLOOKUP: any direction, built-in fallback.'],
    ['LEFT / RIGHT / MID', 'Text', 'Cut a string from the left, the right, or the middle.'],
    ['FIND(what, where, [start])', 'Text', 'Position of a fragment. The third argument finds the second occurrence.'],
    ['SUBSTITUTE(text, old, new)', 'Text', 'Replace a fragment. The workhorse of cleaning up exports.'],
    ['VALUE(text)', 'Text', 'Text that looks like a number becomes a number.'],
    ['YEAR / MONTH / DAY', 'Dates', 'Take a date apart.'],
    ['EOMONTH(date, months)', 'Dates', 'Last day of the month, n months away. For payment schedules.'],
    ['DATEDIF(start, end, "y")', 'Dates', 'Whole years, months ("m"), or months beyond whole years ("ym").'],
    ['NPV(rate, flows)', 'Finance', 'Discounts from period 1. Add the year-0 flow separately.'],
    ['IRR(flows)', 'Finance', 'The rate at which NPV is zero.'],
    ['PMT(rate, periods, amount)', 'Finance', 'Level loan payment. Annual rate ÷ 12, years × 12.'],
    ['LARGE(range, k)', 'Analysis', 'The k-th largest value. For concentration analysis.'],
    ['PERCENTILE.INC(range, p)', 'Analysis', 'Percentile of a distribution.'],
    ['RANK(value, range)', 'Analysis', 'Where a value places in the list.']
  ];

  function renderReference(tab) {
    tab = tab || 'shortcuts';
    var page = h('<div class="page"></div>');
    page.appendChild(h('<div class="page-head"><h1>Reference</h1>' +
      '<p>Everything the test asks about: Excel shortcuts for macOS, the functions with their typical use, and what each error means.</p></div>'));
    var tabs = h('<div class="ref-tabs">' +
      '<button data-tab="shortcuts">Shortcuts</button>' +
      '<button data-tab="functions">Functions</button>' +
      '<button data-tab="errors">Excel errors</button>' +
      '<button data-tab="platform">Mac / Windows</button></div>');
    page.appendChild(tabs);
    var search = h('<input class="ref-search" placeholder="Search the reference…">');
    page.appendChild(search);
    var holder = h('<div class="card" style="overflow:auto;max-height:65vh"></div>');
    page.appendChild(holder);
    show(page);

    Array.prototype.forEach.call(tabs.children, function (b) {
      if (b.dataset.tab === tab) b.className = 'active';
      b.addEventListener('click', function () { renderReference(b.dataset.tab); });
    });

    function draw(filter) {
      filter = (filter || '').toLowerCase();
      var t = h('<table class="ref"></table>');
      if (tab === 'shortcuts' || tab === 'platform') {
        t.appendChild(h('<thead><tr><th style="width:150px">macOS</th>' +
          (tab === 'platform' ? '<th style="width:170px">Windows</th>' : '') +
          '<th>What it does</th><th style="width:34%">Why it matters</th></tr></thead>'));
        var tb = h('<tbody></tbody>');
        DRILLS.SHORTCUTS.forEach(function (s) {
          var hay = (s.mac + ' ' + s.win + ' ' + s.action + ' ' + s.cat + ' ' + s.why).toLowerCase();
          if (filter && hay.indexOf(filter) < 0) return;
          tb.appendChild(h('<tr><td class="k">' + esc(s.mac) + '</td>' +
            (tab === 'platform' ? '<td class="k">' + esc(s.win) + '</td>' : '') +
            '<td>' + esc(s.action) + '</td><td class="why">' + esc(s.why) + '</td></tr>'));
        });
        t.appendChild(tb);
      } else if (tab === 'functions') {
        t.appendChild(h('<thead><tr><th style="width:330px">Function</th><th style="width:120px">Group</th><th>When to use it</th></tr></thead>'));
        var tb2 = h('<tbody></tbody>');
        FUNC_REF.forEach(function (f) {
          var hay = (f[0] + ' ' + f[1] + ' ' + f[2]).toLowerCase();
          if (filter && hay.indexOf(filter) < 0) return;
          tb2.appendChild(h('<tr><td class="k">' + esc(f[0]) + '</td><td class="why">' + esc(f[1]) + '</td><td>' + esc(f[2]) + '</td></tr>'));
        });
        t.appendChild(tb2);
      } else {
        t.appendChild(h('<thead><tr><th style="width:150px">Error</th><th>What it means</th><th style="width:38%">What to do</th></tr></thead>'));
        var tb3 = h('<tbody></tbody>');
        DRILLS.ERROR_QUIZ.forEach(function (e) {
          var hay = (e.q + ' ' + e.options[e.answer] + ' ' + e.why).toLowerCase();
          if (filter && hay.indexOf(filter) < 0) return;
          tb3.appendChild(h('<tr><td class="k">' + esc(e.q) + '</td><td>' + esc(e.options[e.answer]) + '</td><td class="why">' + esc(e.why) + '</td></tr>'));
        });
        t.appendChild(tb3);
      }
      holder.innerHTML = '';
      holder.appendChild(t);
    }
    search.addEventListener('input', function () { draw(search.value); });
    draw('');
  }

  /* ========================================================== PROGRESS === */
  function renderStats() {
    var d = Store.data;
    var totalMax = 0, totalGot = 0, solved = 0, all = 0;
    CUR.levels.forEach(function (l) {
      var s = levelStats(l);
      totalMax += s.max; totalGot += s.got; solved += s.done; all += s.total;
    });
    var page = h('<div class="page"></div>');
    page.appendChild(h('<div class="page-head"><h1>Progress</h1><p>Where you are and what is worth going back to.</p></div>'));
    var grid = h('<div class="stat-grid"></div>');
    [
      [d.xp, 'experience points'],
      [solved + ' / ' + all, 'tasks solved'],
      [Math.round(totalGot / (totalMax || 1) * 100) + '%', 'of the programme'],
      [d.streak.days, 'days in a row'],
      [d.drills.total ? Math.round(d.drills.correct / d.drills.total * 100) + '%' : '—', 'dojo accuracy'],
      [d.drills.bestStreak, 'best dojo streak']
    ].forEach(function (s) {
      grid.appendChild(h('<div class="card stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'));
    });
    page.appendChild(grid);

    var examLevel = CUR.levels.filter(function (l) { return l.exam; })[0];
    if (examLevel) {
      var papers = examLevel.papers || [];
      var satIds = {};
      d.exams.forEach(function (e) { if (e.paper) satIds[e.paper] = true; });
      var satCount = Object.keys(satIds).length;
      var passedCount = papers.filter(function (p) {
        var b = Store.bestExam(p.id);
        return b && b.score >= examLevel.passScore;
      }).length;
      page.appendChild(h('<h3 style="margin:22px 0 10px;font-size:16px">Mock tests — ' +
        satCount + ' of ' + papers.length + ' papers sat, ' + passedCount + ' passed</h3>'));
    }
    if (d.exams.length) {
      var t = h('<table class="ref"></table>');
      t.appendChild(h('<thead><tr><th>Date</th><th>Paper</th><th>Score</th><th>Points</th><th>Time</th></tr></thead>'));
      var tb = h('<tbody></tbody>');
      d.exams.slice().reverse().forEach(function (e) {
        tb.appendChild(h('<tr><td>' + new Date(e.date).toLocaleString('en-GB') + '</td>' +
          '<td>' + esc(e.title || 'Mock test') + '</td>' +
          '<td class="k">' + Math.round(e.score * 100) + '%</td>' +
          '<td>' + e.points + ' / ' + e.maxPoints + '</td><td>' + mmss(e.seconds) + '</td></tr>'));
      });
      t.appendChild(tb);
      var card = h('<div class="card" style="overflow:hidden"></div>');
      card.appendChild(t);
      page.appendChild(card);
    } else if (examLevel) {
      page.appendChild(h('<div class="card empty">No mock test sat yet. All ' + examLevel.papers.length +
        ' papers are open — start with paper 1, which explains every answer in full.</div>'));
    }

    var review = reviewQueue();
    page.appendChild(h('<h3 style="margin:22px 0 10px;font-size:16px">Worth revisiting — ' + review.length + '</h3>'));
    if (!review.length) page.appendChild(h('<div class="card empty">Nothing outstanding. Good moment for a mock test.</div>'));
    else {
      var list = h('<div class="review-list"></div>');
      review.forEach(function (r) {
        list.appendChild(h('<div class="card task-row" data-go="' + r.level.id + '/' + r.task.id + '">' +
          '<div class="task-status partial">↻</div>' +
          '<div class="task-row-main"><div class="task-row-title">' + esc(r.task.title) + '</div>' +
          '<div class="task-row-brief">Level ' + r.level.id + ' · ' + esc(r.reason) + '</div></div>' +
          '<div class="task-row-points">' + Store.earnedFor(r.task) + '/' + r.task.points + '</div></div>'));
      });
      page.appendChild(list);
    }

    page.appendChild(h('<h3 style="margin:26px 0 10px;font-size:16px">Your data</h3>'));
    page.appendChild(h('<div class="panel-actions">' +
      '<button class="btn" id="btn-export">Save progress to a file</button>' +
      '<button class="btn" id="btn-import">Load from a file</button>' +
      '<button class="btn btn-ghost" id="btn-wipe">Erase everything</button></div>'));
    page.appendChild(h('<div style="margin-top:10px;font-size:12.5px;color:var(--muted)">' +
      (Store.persistent ? 'Progress is saved to ' + esc(Store.storedIn) + ' and never leaves your machine. ' +
        'Erasing is the only thing that removes it — no task, no failed attempt and no mock test ever does.'
        : 'Warning: nothing can be saved here, so progress disappears when you close this window. ' +
          'Launch the app through ExcelTrainer.app or run.sh to have it written to a file.') +
      '</div>'));
    show(page);

    document.getElementById('btn-export').addEventListener('click', function () {
      var blob = new Blob([Store.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'excel-trainer-progress.json';
      a.click();
    });
    document.getElementById('btn-import').addEventListener('click', function () {
      var inp = document.createElement('input');
      inp.type = 'file'; inp.accept = '.json';
      inp.onchange = function () {
        var f = inp.files[0];
        if (!f) return;
        var rd = new FileReader();
        rd.onload = function () {
          try { Store.importJSON(rd.result); updateHeader(); toast('Progress loaded'); renderStats(); }
          catch (err) { toast('That file could not be read'); }
        };
        rd.readAsText(f);
      };
      inp.click();
    });
    document.getElementById('btn-wipe').addEventListener('click', function () {
      if (!confirm('Erase all progress? This cannot be undone.')) return;
      Store.reset(); updateHeader(); renderStats(); toast('Progress erased');
    });
  }

  /* ============================================================ ROUTER === */
  function show(node) {
    clearInterval(state.timerId);
    clearTimeout(toastTimer);
    document.getElementById('toast').hidden = true;
    document.onkeydown = null;
    if (state.grid) state.grid.closeFilterMenu();
    state.grid = null; state.pivot = null;
    view.innerHTML = '';
    view.appendChild(node);
    window.scrollTo(0, 0);
  }
  function go(hash) { window.location.hash = '#/' + hash; }

  function route() {
    var hash = (window.location.hash || '').replace(/^#\/?/, '');
    var parts = hash.split('/').filter(Boolean);
    Array.prototype.forEach.call(document.querySelectorAll('.mainnav button'), function (b) { b.classList.remove('active'); });
    if (!parts.length || parts[0] === 'home') {
      document.querySelector('.mainnav [data-nav="home"]').classList.add('active');
      return renderHome();
    }
    if (parts[0] === 'dojo') {
      document.querySelector('.mainnav [data-nav="dojo"]').classList.add('active');
      return renderDojo();
    }
    if (parts[0] === 'reference') {
      document.querySelector('.mainnav [data-nav="reference"]').classList.add('active');
      return renderReference();
    }
    if (parts[0] === 'stats') {
      document.querySelector('.mainnav [data-nav="stats"]').classList.add('active');
      return renderStats();
    }
    if (parts[0] === 'level' && parts[1]) return renderLevel(parts[1], parts[2]);
    if (parts.length === 2) return renderTask(parts[0], parts[1]);
    if (parts.length === 1) return renderLevel(parts[0]);
    renderHome();
  }

  document.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-nav]');
    if (nav) { go(nav.dataset.nav); return; }
    var lvl = e.target.closest('[data-level]');
    if (lvl) { go('level/' + lvl.dataset.level); return; }
    var to = e.target.closest('[data-go]');
    if (to) { go(to.dataset.go); return; }
  });
  window.addEventListener('hashchange', route);

  // The store may have to ask the native window or the local server for the
  // progress file, so the first screen is drawn once the answer is in.
  Store.init(function () {
    updateHeader();
    route();
  });
})(typeof self !== 'undefined' ? self : this);

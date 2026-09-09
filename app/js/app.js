/* =============================================================================
 * app.js — навигация, экраны, логика прогресса
 * ========================================================================== */
(function (root) {
  'use strict';
  var XLF = root.XLF, ENG = root.XLEngine, G = root.XLGrader,
      CUR = root.XLCurriculum, DRILLS = root.XLDrills, Store = root.XLStore;

  var view = document.getElementById('view');
  var state = { grid: null, task: null, level: null, exam: null, timerId: null };

  /* -------------------------------------------------------------- утилиты */
  // <template> нужен, чтобы корректно разбирались фрагменты таблиц (<thead>, <tr>)
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
    return r.toLocaleString('ru-RU', { maximumFractionDigits: 2 });
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

  function levelById(id) {
    for (var i = 0; i < CUR.levels.length; i++) if (String(CUR.levels[i].id) === String(id)) return CUR.levels[i];
    return null;
  }
  function taskById(level, id) {
    for (var i = 0; i < level.tasks.length; i++) if (level.tasks[i].id === id) return level.tasks[i];
    return null;
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
  function levelUnlocked(level) {
    var idx = CUR.levels.indexOf(level);
    if (idx <= 0) return true;
    if (level.exam) {
      return CUR.levels.slice(0, idx).every(function (l) { return levelStats(l).share >= 0.6; });
    }
    return levelStats(CUR.levels[idx - 1]).share >= 0.6;
  }

  function updateHeader() {
    var d = Store.data.streak.days;
    document.getElementById('xp-value').textContent = Store.data.xp;
    document.getElementById('streak-value').textContent =
      d + ' ' + plural(d, 'день', 'дня', 'дней') + ' подряд';
  }

  /* ============================================================ ГЛАВНАЯ === */
  function renderHome() {
    var totalMax = 0, totalGot = 0;
    CUR.levels.forEach(function (l) { var s = levelStats(l); totalMax += s.max; totalGot += s.got; });
    var pct = totalMax ? Math.round(totalGot / totalMax * 100) : 0;

    var next = null;
    for (var i = 0; i < CUR.levels.length && !next; i++) {
      var lv = CUR.levels[i];
      if (!levelUnlocked(lv)) break;
      for (var j = 0; j < lv.tasks.length; j++) {
        if (Store.task(lv.tasks[j].id).best < 1) { next = { level: lv, task: lv.tasks[j] }; break; }
      }
    }

    var page = h('<div class="page"></div>');
    page.appendChild(h(
      '<div class="hero">' +
        '<div class="hero-main">' +
          '<h1>Программа подготовки к Excel-тесту</h1>' +
          '<p>Десять уровней от адреса ячейки до консалтингового кейса. Каждая задача решается ' +
          'в настоящей таблице и проверяется по значению — как на реальном отборе.</p>' +
          '<div class="progressbar"><i style="width:' + pct + '%"></i></div>' +
          '<p style="margin-top:8px;font-size:12.5px">Пройдено ' + pct + '% программы · ' + totalGot + ' из ' + totalMax + ' баллов</p>' +
        '</div>' +
        '<div class="hero-actions">' +
          (next ? '<button class="btn btn-lg" data-go="' + next.level.id + '/' + next.task.id + '">Продолжить</button>' : '') +
          '<button class="btn btn-ghost btn-lg" data-nav="dojo">Додзё клавиш</button>' +
        '</div>' +
      '</div>'
    ));

    var review = reviewQueue();
    if (review.length) {
      var rc = h('<div class="card" style="padding:16px 18px;margin-bottom:20px"></div>');
      rc.appendChild(h('<div style="font-weight:600;margin-bottom:4px">На повторение — ' + review.length + ' ' + plural(review.length, 'задача', 'задачи', 'задач') + '</div>'));
      rc.appendChild(h('<div style="color:var(--muted);font-size:12.5px;margin-bottom:12px">Здесь задачи, которые вы решили с подсказкой, с ошибками или подсмотрели ответ. Пройдите их снова без помощи.</div>'));
      var list = h('<div class="review-list"></div>');
      review.slice(0, 4).forEach(function (r) {
        var row = h('<div class="card task-row" data-go="' + r.level.id + '/' + r.task.id + '">' +
          '<div class="task-status partial">↻</div>' +
          '<div class="task-row-main"><div class="task-row-title">' + esc(r.task.title) + '</div>' +
          '<div class="task-row-brief">Уровень ' + r.level.id + ' · ' + esc(r.reason) + '</div></div>' +
          '<div class="task-row-points">' + Store.earnedFor(r.task) + '/' + r.task.points + '</div></div>');
        list.appendChild(row);
      });
      rc.appendChild(list);
      page.appendChild(rc);
    }

    var grid = h('<div class="levels"></div>');
    CUR.levels.forEach(function (lv) {
      var st = levelStats(lv), unlocked = levelUnlocked(lv);
      var cls = 'card level-card' + (unlocked ? '' : ' locked') + (st.share >= 0.999 ? ' done' : '') + (lv.exam ? ' exam' : '');
      var badge = !unlocked ? '<span class="badge">закрыт</span>'
        : st.done === st.total ? '<span class="badge ok">пройден</span>'
        : st.done ? '<span class="badge warn">' + st.done + ' из ' + st.total + '</span>'
        : (lv.exam ? '<span class="badge gold">экзамен</span>' : '<span class="badge">не начат</span>');
      var card = h(
        '<div class="' + cls + '" ' + (unlocked ? 'data-level="' + lv.id + '"' : '') + '>' +
          '<div class="level-top">' +
            '<div class="level-num">' + (lv.exam ? '★' : lv.id) + '</div>' +
            '<div><div class="level-title">' + esc(lv.title) + '</div>' +
            '<div class="level-sub">' + esc(lv.subtitle) + '</div></div>' +
          '</div>' +
          '<div class="progressbar"><i style="width:' + Math.round(st.share * 100) + '%"></i></div>' +
          '<div class="level-meta"><span>' + st.got + ' / ' + st.max + ' баллов</span>' + badge + '</div>' +
        '</div>');
      grid.appendChild(card);
    });
    page.appendChild(grid);

    if (!Store.persistent) {
      page.appendChild(h('<div class="card" style="padding:12px 16px;margin-top:18px;font-size:12.5px;color:var(--muted)">' +
        'Браузер не разрешает сохранение прогресса на этой странице. Запустите приложение через ExcelTrainer.app или скрипт run.sh — тогда результаты сохранятся.</div>'));
    }
    show(page);
  }

  function plural(n, one, few, many) {
    var m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
    return many;
  }

  function reviewQueue() {
    var out = [];
    CUR.levels.forEach(function (lv) {
      if (lv.exam) return;
      lv.tasks.forEach(function (t) {
        var s = Store.task(t.id);
        if (!s.attempts) return;
        if (s.seenSolution) out.push({ level: lv, task: t, reason: 'смотрели решение' });
        else if (s.hinted && s.best >= 1) out.push({ level: lv, task: t, reason: 'решено с подсказкой' });
        else if (s.best < 1) out.push({ level: lv, task: t, reason: 'решено не полностью' });
      });
    });
    return out;
  }

  /* ============================================================= УРОВЕНЬ == */
  function renderLevel(id) {
    var lv = levelById(id);
    if (!lv) return renderHome();
    if (!levelUnlocked(lv)) { toast('Уровень пока закрыт: наберите 60% баллов на предыдущем'); return renderHome(); }
    var st = levelStats(lv);

    var page = h('<div class="page"></div>');
    page.appendChild(h(
      '<div class="page-head">' +
        '<div class="crumbs"><button data-nav="home">Программа</button> › Уровень ' + lv.id + '</div>' +
        '<h1>' + esc(lv.title) + '</h1>' +
        '<p>' + esc(lv.goal) + '</p>' +
      '</div>'));

    var layout = h('<div class="level-layout"></div>');
    var left = h('<div></div>');

    if (lv.exam) {
      left.appendChild(h(
        '<div class="card" style="padding:18px 20px;margin-bottom:16px">' +
          '<div style="font-weight:600;margin-bottom:6px">Экзамен: ' + lv.tasks.length + ' задач, ' +
          Math.round(lv.timeLimitSec / 60) + ' минут, без подсказок</div>' +
          '<div style="color:var(--muted);font-size:13px;margin-bottom:14px">Проходной результат — ' +
          Math.round(lv.passScore * 100) + '%. Между задачами можно переключаться, ответы сохраняются. ' +
          'Проверка — в конце, как на реальном тесте.</div>' +
          '<button class="btn btn-primary" id="start-exam">Начать экзамен</button>' +
        '</div>'));
    }

    var list = h('<div class="task-list"></div>');
    lv.tasks.forEach(function (t) {
      var s = Store.task(t.id), earned = Store.earnedFor(t);
      var cls = s.best >= 1 ? 'done' : (s.attempts ? 'partial' : '');
      var mark = s.best >= 1 ? '✓' : (s.attempts ? '·' : '');
      list.appendChild(h(
        '<div class="card task-row" data-go="' + lv.id + '/' + t.id + '">' +
          '<div class="task-status ' + cls + '">' + mark + '</div>' +
          '<div class="task-row-main">' +
            '<div class="task-row-title">' + esc(t.title) + '</div>' +
            '<div class="task-row-brief">' + esc(t.brief) + '</div>' +
          '</div>' +
          '<div class="task-row-points">' + earned + ' / ' + t.points + '</div>' +
        '</div>'));
    });
    left.appendChild(list);
    layout.appendChild(left);

    var theory = h('<div class="card theory"><h3>Что нужно знать</h3></div>');
    (lv.theory || []).forEach(function (t) {
      theory.appendChild(h('<div class="theory-item"><b>' + esc(t.h) + '</b><span>' + esc(t.p) + '</span></div>'));
    });
    theory.appendChild(h('<div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--line);font-size:12.5px;color:var(--muted)">' +
      'Прогресс уровня: ' + st.got + ' из ' + st.max + ' баллов</div>'));
    layout.appendChild(theory);
    page.appendChild(layout);
    show(page);

    var se = document.getElementById('start-exam');
    if (se) se.addEventListener('click', function () { startExam(lv); });
  }

  /* ============================================================== ЗАДАЧА == */
  function renderTask(levelId, taskId) {
    var lv = levelById(levelId);
    if (!lv) return renderHome();
    var task = taskById(lv, taskId);
    if (!task) return renderLevel(levelId);
    var examMode = !!(state.exam && state.exam.level.id === lv.id);
    // вне экзаменационной сессии задачи экзамена открываются в обычном режиме —
    // чтобы после пробника можно было разобрать ошибки

    state.level = lv; state.task = task;
    var targets = G.targetCells(task);
    var sheet;
    if (examMode && state.exam.sheets[task.id]) sheet = state.exam.sheets[task.id];
    else {
      sheet = G.buildSheet(task);
      if (examMode) state.exam.sheets[task.id] = sheet;
    }

    var idx = lv.tasks.indexOf(task);
    var wrap = h('<div class="workspace"></div>');
    var panel = h('<aside class="task-panel"></aside>');
    panel.appendChild(h('<div class="crumbs"><button data-nav="home">Программа</button> › ' +
      '<button data-level="' + lv.id + '">Уровень ' + lv.id + '</button> › Задача ' + (idx + 1) + ' из ' + lv.tasks.length + '</div>'));
    panel.appendChild(h('<h2>' + esc(task.title) + '</h2>'));
    panel.appendChild(h('<div class="brief">' + esc(task.brief) + '</div>'));

    if (examMode) {
      panel.appendChild(h('<div class="timer" id="exam-timer">—</div>'));
    }

    var hintSlot = h('<div></div>');
    var already = Store.task(task.id);
    if (!examMode && already.hinted) {
      hintSlot.appendChild(h('<div class="hintbox"><b>Подсказка</b>' + esc(task.hint) + '</div>'));
    }
    if (!examMode && already.best >= 1) {
      panel.appendChild(h('<div style="font-size:12.5px;color:var(--ok)">Задача уже решена — ' +
        Store.earnedFor(task) + ' из ' + task.points + ' баллов. Можно перерешать без подсказок.</div>'));
    }
    panel.appendChild(hintSlot);

    var actions = h('<div class="panel-actions"></div>');
    if (!examMode) {
      actions.appendChild(h('<button class="btn btn-primary" id="btn-check">Проверить</button>'));
      actions.appendChild(h('<button class="btn" id="btn-hint">Подсказка</button>'));
      actions.appendChild(h('<button class="btn btn-ghost" id="btn-reset">Сбросить</button>'));
      actions.appendChild(h('<button class="btn btn-ghost" id="btn-solution">Решение</button>'));
    } else {
      if (idx > 0) actions.appendChild(h('<button class="btn" id="btn-prev">← Назад</button>'));
      if (idx < lv.tasks.length - 1) actions.appendChild(h('<button class="btn btn-primary" id="btn-next">Дальше →</button>'));
      actions.appendChild(h('<button class="btn btn-ghost" id="btn-finish">Завершить экзамен</button>'));
    }
    panel.appendChild(actions);

    var resultSlot = h('<div></div>');
    panel.appendChild(resultSlot);

    if (examMode) {
      var nav = h('<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:auto;padding-top:14px;border-top:1px solid var(--line)"></div>');
      lv.tasks.forEach(function (t, i) {
        var filled = state.exam.sheets[t.id] && G.targetCells(t).some(function (a1) { return state.exam.sheets[t.id].rawAt(a1) !== ''; });
        var b = h('<button class="btn" style="padding:5px 11px;font-size:12px' +
          (t.id === task.id ? ';border-color:var(--accent);color:var(--accent)' : '') +
          (filled ? ';background:var(--ok-soft)' : '') + '" data-go="' + lv.id + '/' + t.id + '">' + (i + 1) + '</button>');
        nav.appendChild(b);
      });
      panel.appendChild(nav);
    } else {
      panel.appendChild(h('<div style="margin-top:auto;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted);line-height:1.9">' +
        '<span class="kbd">⌘D</span> заполнить вниз · <span class="kbd">⌘R</span> вправо<br>' +
        '<span class="kbd">⌘T</span> доллары в ссылке · <span class="kbd">F2</span> править<br>' +
        '<span class="kbd">⌘↓</span> к краю данных · <span class="kbd">⌘⇧↓</span> выделить</div>'));
    }
    wrap.appendChild(panel);

    var area = h(
      '<section class="sheet-area">' +
        '<div class="formula-bar">' +
          '<div class="fb-addr" id="fb-addr">A1</div>' +
          '<div class="fb-fx">fx</div>' +
          '<input class="fb-input" id="fb-input" spellcheck="false" autocomplete="off">' +
        '</div>' +
        '<div class="grid-wrap" id="grid-host"></div>' +
        '<div class="statusbar" id="statusbar"></div>' +
      '</section>');
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
      onFlash: toast,
      onSelect: function (info) {
        fbAddr.textContent = info.rangeAddr;
        if (!(grid && grid.editing)) fbInput.value = info.raw;
        fbInput.disabled = !info.editable;
        renderStatus(statusbar, info, targets, sheet);
      },
      onChange: function (ev) {
        if (ev.type === 'editing') fbInput.value = ev.text;
        if (grid && (ev.type === 'commit' || ev.type === 'fill' || ev.type === 'paste' || ev.type === 'clear' || ev.type === 'undo')) {
          grid.paint();
        }
      }
    });
    state.grid = grid;
    grid.focus();

    fbInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!grid.canEdit(grid.sel.r, grid.sel.c)) { toast('Эта ячейка — исходные данные'); return; }
        grid.setCell(XLF.rcToA1(grid.sel.r, grid.sel.c), fbInput.value);
        grid.select(grid.sel.r + 1, grid.sel.c);
        grid.focus();
      }
      if (e.key === 'Escape') { fbInput.value = sheet.raw(grid.sel.r, grid.sel.c); grid.focus(); }
    });

    /* --- обработчики учебного режима --- */
    if (!examMode) {
      document.getElementById('btn-check').addEventListener('click', function () {
        var res = G.grade(task, sheet);
        var rec = Store.recordAttempt(task, res, {});
        updateHeader();
        showResult(resultSlot, res, task, rec, lv);
      });
      document.getElementById('btn-hint').addEventListener('click', function () {
        if (hintSlot.firstChild) return;
        Store.recordAttempt(task, { score: Store.task(task.id).best, passed: false }, { hinted: true });
        hintSlot.appendChild(h('<div class="hintbox"><b>Подсказка (−30% баллов)</b>' + esc(task.hint) + '</div>'));
        updateHeader();
      });
      document.getElementById('btn-reset').addEventListener('click', function () {
        targets.forEach(function (a1) { sheet.setAt(a1, '', { locked: false }); });
        grid.paint(); resultSlot.innerHTML = '';
        toast('Лист очищен');
      });
      document.getElementById('btn-solution').addEventListener('click', function () {
        if (!confirm('Показать эталонное решение? За задачу останется не больше 40% баллов.')) return;
        G.applySolution(sheet, task);
        Store.recordAttempt(task, { score: 1, passed: true }, { seenSolution: true });
        grid.paint(); updateHeader();
        var box = h('<div class="solution-box"><b>Эталонное решение</b></div>');
        Object.keys(task.solution).forEach(function (ref) {
          box.appendChild(h('<div>' + esc(ref) + ' → ' + esc(task.solution[ref]) + '</div>'));
        });
        resultSlot.innerHTML = '';
        resultSlot.appendChild(box);
      });
    } else {
      var prev = document.getElementById('btn-prev');
      if (prev) prev.addEventListener('click', function () { go(lv.id + '/' + lv.tasks[idx - 1].id); });
      var nx = document.getElementById('btn-next');
      if (nx) nx.addEventListener('click', function () { go(lv.id + '/' + lv.tasks[idx + 1].id); });
      document.getElementById('btn-finish').addEventListener('click', function () {
        if (confirm('Завершить экзамен и посмотреть результат?')) finishExam();
      });
      tickExam();
    }
  }

  function renderStatus(bar, info, targets, sheet) {
    var left = 0;
    targets.forEach(function (a1) { if (sheet.rawAt(a1) === '') left++; });
    bar.innerHTML =
      '<span>Сумма: <b>' + fmt(info.sum) + '</b></span>' +
      '<span>Среднее: <b>' + fmt(info.avg) + '</b></span>' +
      '<span>Числа: <b>' + info.numCount + '</b></span>' +
      '<span>Ячеек: <b>' + info.count + '</b></span>' +
      '<span class="spacer"></span>' +
      '<span>Осталось заполнить: <b>' + left + '</b> из ' + targets.length + '</span>';
  }

  function showResult(slot, res, task, rec, lv) {
    slot.innerHTML = '';
    if (res.passed) {
      var next = lv.tasks[lv.tasks.indexOf(task) + 1];
      var box = h('<div class="result ok"><b>Верно.</b> Задача засчитана: ' + rec.earned + ' из ' + task.points + ' баллов.' +
        (rec.delta ? ' <b>+' + rec.delta + ' XP</b>' : '') + '</div>');
      slot.appendChild(box);
      var nav = h('<div class="panel-actions" style="margin-top:10px"></div>');
      if (next) nav.appendChild(h('<button class="btn btn-primary" data-go="' + lv.id + '/' + next.id + '">Следующая задача →</button>'));
      else nav.appendChild(h('<button class="btn btn-primary" data-level="' + lv.id + '">Уровень пройден →</button>'));
      slot.appendChild(nav);
      return;
    }
    var bad = res.cells.filter(function (c) { return !c.ok; });
    var html = '<div class="result bad"><b>Пока не сходится.</b> Верно ' + res.okCount + ' из ' + res.total + ' ячеек.<ul>';
    bad.slice(0, 6).forEach(function (c) {
      html += '<li><code>' + c.cell + '</code> — ' + esc(c.reason) + '</li>';
    });
    if (bad.length > 6) html += '<li>…и ещё ' + (bad.length - 6) + '</li>';
    html += '</ul></div>';
    slot.appendChild(h(html));
  }

  /* =============================================================== ЭКЗАМЕН = */
  function startExam(lv) {
    state.exam = { level: lv, started: Date.now(), sheets: {}, finished: false };
    lv.tasks.forEach(function (t) { state.exam.sheets[t.id] = G.buildSheet(t); });
    go(lv.id + '/' + lv.tasks[0].id);
  }

  function tickExam() {
    clearInterval(state.timerId);
    var elTimer = document.getElementById('exam-timer');
    if (!elTimer || !state.exam) return;
    var lv = state.exam.level;
    function upd() {
      var left = lv.timeLimitSec - (Date.now() - state.exam.started) / 1000;
      var e = document.getElementById('exam-timer');
      if (!e) { clearInterval(state.timerId); return; }
      e.textContent = 'Осталось ' + mmss(left);
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
    var lv = ex.level, rows = [], points = 0, maxPoints = 0;
    lv.tasks.forEach(function (t) {
      var res = G.grade(t, ex.sheets[t.id]);
      var earned = Math.round(t.points * res.score);
      points += earned; maxPoints += t.points;
      Store.recordAttempt(t, res, {});
      rows.push({ task: t, res: res, earned: earned });
    });
    var seconds = Math.round((Date.now() - ex.started) / 1000);
    var share = maxPoints ? points / maxPoints : 0;
    Store.recordExam({ date: new Date().toISOString(), score: share, points: points, maxPoints: maxPoints, seconds: seconds });
    updateHeader();
    state.exam = null;

    var page = h('<div class="page"></div>');
    var passed = share >= lv.passScore;
    page.appendChild(h(
      '<div class="page-head"><div class="crumbs"><button data-nav="home">Программа</button> › Результат экзамена</div>' +
      '<h1>' + (passed ? 'Экзамен сдан' : 'Экзамен не сдан') + '</h1>' +
      '<p>' + Math.round(share * 100) + '% (' + points + ' из ' + maxPoints + ' баллов) за ' + mmss(seconds) +
      (byTime ? '. Время вышло.' : '') + ' Проходной порог — ' + Math.round(lv.passScore * 100) + '%.</p></div>'));

    var list = h('<div class="task-list"></div>');
    rows.forEach(function (r) {
      var cls = r.res.passed ? 'done' : (r.res.okCount ? 'partial' : '');
      var wrong = r.res.cells.filter(function (c) { return !c.ok; });
      list.appendChild(h(
        '<div class="card task-row" data-go="' + lv.id + '/' + r.task.id + '">' +
          '<div class="task-status ' + cls + '">' + (r.res.passed ? '✓' : '✗') + '</div>' +
          '<div class="task-row-main"><div class="task-row-title">' + esc(r.task.title) + '</div>' +
          '<div class="task-row-brief">' + (r.res.passed ? 'верно' :
            'верно ' + r.res.okCount + ' из ' + r.res.total + ' ячеек' +
            (wrong.length ? ' · ' + esc(wrong[0].cell + ': ' + wrong[0].reason) : '')) + '</div></div>' +
          '<div class="task-row-points">' + r.earned + ' / ' + r.task.points + '</div>' +
        '</div>'));
    });
    page.appendChild(list);
    page.appendChild(h('<div class="panel-actions" style="margin-top:18px">' +
      '<button class="btn btn-primary" data-level="' + lv.id + '">Пройти ещё раз</button>' +
      '<button class="btn" data-nav="home">К программе</button></div>'));
    show(page);
  }

  /* ================================================================ ДОДЗЁ = */
  function renderDojo(mode) {
    var page = h('<div class="page"><div class="dojo"></div></div>');
    var box = page.firstChild;
    box.appendChild(h(
      '<div class="page-head" style="text-align:center">' +
        '<h1>Додзё горячих клавиш</h1>' +
        '<p style="margin:0 auto">На тесте мышь — это потерянные минуты. Отвечайте цифрами 1–4 с клавиатуры.</p>' +
      '</div>'));
    var tabs = h('<div class="ref-tabs" style="justify-content:center">' +
      '<button data-mode="mixed">Всё вперемешку</button>' +
      '<button data-mode="shortcuts">Клавиши</button>' +
      '<button data-mode="functions">Функции</button>' +
      '<button data-mode="errors">Ошибки</button>' +
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
        card.appendChild(h('<div class="dojo-prompt">Серия закончена</div>'));
        card.appendChild(h('<div style="font-size:34px;margin:14px 0;color:var(--navy)"><b>' + correct + '</b> из ' + qs.length + '</div>'));
        card.appendChild(h('<div class="dojo-why" style="text-align:center">Всего верных ответов за всё время: ' +
          Store.data.drills.correct + ' из ' + Store.data.drills.total + ' · лучшая серия подряд: ' + Store.data.drills.bestStreak + '</div>'));
        var again = h('<div class="panel-actions" style="justify-content:center;margin-top:18px">' +
          '<button class="btn btn-primary" id="again">Ещё серия</button>' +
          '<button class="btn" data-nav="home">К программе</button></div>');
        card.appendChild(again);
        document.getElementById('again').addEventListener('click', function () { renderDojo(mode); });
        return;
      }
      var q = qs[i];
      card.innerHTML = '';
      card.appendChild(h('<div class="dojo-meta"><span>Вопрос ' + (i + 1) + ' из ' + qs.length + '</span>' +
        '<span>Серия подряд: ' + streak + '</span></div>'));
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
        var nb = h('<div class="panel-actions" style="justify-content:center;margin-top:16px">' +
          '<button class="btn btn-primary" id="nextq">Дальше <span class="kbd">Enter</span></button></div>');
        card.appendChild(nb);
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

  /* =========================================================== СПРАВОЧНИК = */
  var FUNC_REF = [
    ['СУММ(диапазон)', 'Математика', 'Сумма чисел. Текст и пустые ячейки игнорируются.'],
    ['СРЗНАЧ(диапазон)', 'Математика', 'Среднее арифметическое по числам диапазона.'],
    ['ОКРУГЛ(x; знаков)', 'Математика', 'Округление. Отрицательное число знаков округляет до десятков, сотен, тысяч.'],
    ['ОКРУГЛВВЕРХ(x; знаков)', 'Математика', 'Всегда вверх — для штук, машин, смен, людей.'],
    ['СУММПРОИЗВ(a; b)', 'Математика', 'Сумма попарных произведений. С логическими условиями заменяет СУММЕСЛИМН.'],
    ['ЕСЛИ(условие; да; нет)', 'Логика', 'Ветвление. Текст всегда в кавычках.'],
    ['И(...) / ИЛИ(...)', 'Логика', 'Все условия сразу / хотя бы одно. Используются внутри ЕСЛИ.'],
    ['ЕСЛИОШИБКА(формула; значение)', 'Логика', 'Подменяет любую ошибку. Применять только осознанно.'],
    ['СУММЕСЛИ(где; что; что сложить)', 'Условные', 'Одно условие. Диапазон суммирования — третий аргумент.'],
    ['СУММЕСЛИМН(что сложить; где1; что1; …)', 'Условные', 'Несколько условий. Диапазон суммирования — ПЕРВЫЙ аргумент.'],
    ['СЧЁТЕСЛИМН(где1; что1; …)', 'Условные', 'Количество строк, удовлетворяющих всем условиям.'],
    ['СРЗНАЧЕСЛИМН(что усреднить; где1; что1; …)', 'Условные', 'Среднее по условиям.'],
    ['ВПР(что; таблица; столбец; 0)', 'Поиск', 'Точный поиск по первому столбцу таблицы. Последний аргумент 0 обязателен.'],
    ['ВПР(что; таблица; столбец; 1)', 'Поиск', 'Приблизительный поиск по возрастающей шкале: грейды, скидки, ставки.'],
    ['ИНДЕКС(что вернуть; строка; столбец)', 'Поиск', 'Значение по номеру строки и столбца.'],
    ['ПОИСКПОЗ(что; где; 0)', 'Поиск', 'Номер позиции значения в строке или столбце.'],
    ['ПРОСМОТРX(что; где; что вернуть; если нет)', 'Поиск', 'Современная замена ВПР: ищет в любую сторону и сам обрабатывает промах.'],
    ['ЛЕВСИМВ / ПРАВСИМВ / ПСТР', 'Текст', 'Вырезать часть строки слева, справа, из середины.'],
    ['НАЙТИ(что; где; [с какой позиции])', 'Текст', 'Позиция подстроки. С третьим аргументом ищет второе вхождение.'],
    ['ПОДСТАВИТЬ(текст; что; на что)', 'Текст', 'Замена фрагмента. Основной инструмент чистки выгрузок.'],
    ['ЗНАЧЕН(текст)', 'Текст', 'Текст → число. Работает после чистки пробелов и валюты.'],
    ['СЖПРОБЕЛЫ(текст)', 'Текст', 'Убирает лишние пробелы по краям и внутри.'],
    ['ГОД / МЕСЯЦ / ДЕНЬ', 'Даты', 'Разбор даты на части.'],
    ['КОНМЕСЯЦА(дата; сдвиг)', 'Даты', 'Последний день месяца через N месяцев. Для графиков платежей.'],
    ['ДАТАМЕС(дата; сдвиг)', 'Даты', 'Тот же день через N месяцев.'],
    ['РАЗНДАТ(нач; кон; "y"/"m"/"ym")', 'Даты', 'Полных лет / месяцев между датами.'],
    ['ЧПС(ставка; потоки)', 'Финансы', 'Дисконтирует с первого периода. Поток года 0 прибавляют отдельно.'],
    ['ВСД(потоки)', 'Финансы', 'IRR — ставка, при которой NPV = 0.'],
    ['ПЛТ(ставка; периоды; сумма)', 'Финансы', 'Аннуитетный платёж. Годовую ставку делят на 12.'],
    ['НАИБОЛЬШИЙ(диапазон; k)', 'Анализ', 'k-е по величине значение. Для анализа концентрации.'],
    ['ПЕРСЕНТИЛЬ.ВКЛ(диапазон; p)', 'Анализ', 'Перцентиль распределения.'],
    ['РАНГ(x; диапазон)', 'Анализ', 'Место значения в списке.']
  ];

  function renderReference(tab) {
    tab = tab || 'shortcuts';
    var page = h('<div class="page"></div>');
    page.appendChild(h('<div class="page-head"><h1>Справочник</h1>' +
      '<p>Всё, что спрашивают на тесте: сочетания клавиш для Excel на macOS и функции с типовым применением.</p></div>'));
    var tabs = h('<div class="ref-tabs">' +
      '<button data-tab="shortcuts">Горячие клавиши</button>' +
      '<button data-tab="functions">Функции</button>' +
      '<button data-tab="errors">Ошибки Excel</button>' +
      '<button data-tab="platform">Mac / Windows</button></div>');
    page.appendChild(tabs);
    var search = h('<input class="ref-search" placeholder="Поиск по справочнику…">');
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
        t.appendChild(h('<thead><tr><th style="width:140px">macOS</th>' +
          (tab === 'platform' ? '<th style="width:160px">Windows</th>' : '') +
          '<th>Действие</th><th style="width:34%">Зачем это нужно</th></tr></thead>'));
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
        t.appendChild(h('<thead><tr><th style="width:300px">Функция</th><th style="width:110px">Раздел</th><th>Когда применять</th></tr></thead>'));
        var tb2 = h('<tbody></tbody>');
        FUNC_REF.forEach(function (f) {
          var hay = (f[0] + ' ' + f[1] + ' ' + f[2]).toLowerCase();
          if (filter && hay.indexOf(filter) < 0) return;
          tb2.appendChild(h('<tr><td class="k">' + esc(f[0]) + '</td><td class="why">' + esc(f[1]) + '</td><td>' + esc(f[2]) + '</td></tr>'));
        });
        t.appendChild(tb2);
      } else {
        t.appendChild(h('<thead><tr><th style="width:150px">Ошибка</th><th>Что означает</th><th style="width:38%">Что делать</th></tr></thead>'));
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

  /* ============================================================== ПРОГРЕСС */
  function renderStats() {
    var d = Store.data;
    var totalMax = 0, totalGot = 0, solved = 0, all = 0;
    CUR.levels.forEach(function (l) {
      var s = levelStats(l);
      totalMax += s.max; totalGot += s.got; solved += s.done; all += s.total;
    });
    var page = h('<div class="page"></div>');
    page.appendChild(h('<div class="page-head"><h1>Прогресс</h1><p>Где вы сейчас и что стоит повторить перед тестом.</p></div>'));
    var grid = h('<div class="stat-grid"></div>');
    [
      [d.xp, 'очков опыта'],
      [solved + ' / ' + all, 'задач решено'],
      [Math.round(totalGot / (totalMax || 1) * 100) + '%', 'программы пройдено'],
      [d.streak.days, 'дней подряд'],
      [d.drills.total ? Math.round(d.drills.correct / d.drills.total * 100) + '%' : '—', 'точность в додзё'],
      [d.drills.bestStreak, 'лучшая серия подряд']
    ].forEach(function (s) {
      grid.appendChild(h('<div class="card stat"><b>' + s[0] + '</b><span>' + s[1] + '</span></div>'));
    });
    page.appendChild(grid);

    if (d.exams.length) {
      page.appendChild(h('<h3 style="margin:22px 0 10px;font-size:16px">Экзамены</h3>'));
      var t = h('<table class="ref"></table>');
      t.appendChild(h('<thead><tr><th>Дата</th><th>Результат</th><th>Баллы</th><th>Время</th></tr></thead>'));
      var tb = h('<tbody></tbody>');
      d.exams.slice().reverse().forEach(function (e) {
        tb.appendChild(h('<tr><td>' + new Date(e.date).toLocaleString('ru-RU') + '</td>' +
          '<td class="k">' + Math.round(e.score * 100) + '%</td>' +
          '<td>' + e.points + ' / ' + e.maxPoints + '</td><td>' + mmss(e.seconds) + '</td></tr>'));
      });
      t.appendChild(tb);
      var card = h('<div class="card" style="overflow:hidden"></div>');
      card.appendChild(t);
      page.appendChild(card);
    }

    var review = reviewQueue();
    page.appendChild(h('<h3 style="margin:22px 0 10px;font-size:16px">На повторение — ' + review.length + '</h3>'));
    if (!review.length) page.appendChild(h('<div class="card empty">Долгов нет. Хороший момент для экзамена.</div>'));
    else {
      var list = h('<div class="review-list"></div>');
      review.forEach(function (r) {
        list.appendChild(h('<div class="card task-row" data-go="' + r.level.id + '/' + r.task.id + '">' +
          '<div class="task-status partial">↻</div>' +
          '<div class="task-row-main"><div class="task-row-title">' + esc(r.task.title) + '</div>' +
          '<div class="task-row-brief">Уровень ' + r.level.id + ' · ' + esc(r.reason) + '</div></div>' +
          '<div class="task-row-points">' + Store.earnedFor(r.task) + '/' + r.task.points + '</div></div>'));
      });
      page.appendChild(list);
    }

    page.appendChild(h('<h3 style="margin:26px 0 10px;font-size:16px">Данные</h3>'));
    var tools = h('<div class="panel-actions">' +
      '<button class="btn" id="btn-export">Сохранить прогресс в файл</button>' +
      '<button class="btn" id="btn-import">Загрузить из файла</button>' +
      '<button class="btn btn-ghost" id="btn-wipe">Сбросить всё</button></div>');
    page.appendChild(tools);
    page.appendChild(h('<div style="margin-top:10px;font-size:12.5px;color:var(--muted)">' +
      (Store.persistent ? 'Прогресс хранится в этом браузере.' : 'Внимание: сохранение недоступно, прогресс исчезнет при закрытии.') +
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
          try { Store.importJSON(rd.result); updateHeader(); toast('Прогресс загружен'); renderStats(); }
          catch (err) { toast('Не удалось прочитать файл'); }
        };
        rd.readAsText(f);
      };
      inp.click();
    });
    document.getElementById('btn-wipe').addEventListener('click', function () {
      if (!confirm('Удалить весь прогресс? Действие необратимо.')) return;
      Store.reset(); updateHeader(); renderStats(); toast('Прогресс сброшен');
    });
  }

  /* =============================================================== РОУТЕР = */
  function show(node) {
    clearInterval(state.timerId);
    clearTimeout(toastTimer);
    document.getElementById('toast').hidden = true;
    document.onkeydown = null;
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
    if (parts[0] === 'level' && parts[1]) return renderLevel(parts[1]);
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

  Store.init();
  updateHeader();
  route();
})(typeof self !== 'undefined' ? self : this);

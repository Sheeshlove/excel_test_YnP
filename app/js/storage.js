/* =============================================================================
 * storage.js — прогресс ученика (localStorage с запасным вариантом в памяти)
 * ========================================================================== */
(function (root) {
  'use strict';
  var KEY = 'ynp-excel-trainer-v1';
  var memory = null;

  function today() {
    var d = new Date();
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  function daysBetween(a, b) {
    return Math.round((new Date(b) - new Date(a)) / 86400000);
  }

  function blank() {
    return {
      version: 1, xp: 0,
      tasks: {},        // id -> {best, attempts, hinted, seenSolution, solvedAt}
      drills: { total: 0, correct: 0, bestStreak: 0 },
      exams: [],        // {date, score, points, maxPoints, seconds}
      streak: { days: 0, lastDay: null },
      platform: 'mac',
      createdAt: new Date().toISOString()
    };
  }

  function available() {
    try {
      var t = '__t';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  }
  var HAS_LS = (typeof window !== 'undefined') && available();

  function load() {
    if (!HAS_LS) return memory || (memory = blank());
    try {
      var raw = window.localStorage.getItem(KEY);
      if (!raw) return blank();
      var data = JSON.parse(raw);
      if (!data || data.version !== 1) return blank();
      return Object.assign(blank(), data);
    } catch (e) { return blank(); }
  }

  function save(data) {
    if (!HAS_LS) { memory = data; return; }
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) { memory = data; }
  }

  var Store = {
    persistent: HAS_LS,
    data: null,
    init: function () { this.data = load(); this.touchDay(); return this.data; },
    flush: function () { save(this.data); },

    touchDay: function () {
      var s = this.data.streak, t = today();
      if (s.lastDay === t) return;
      if (!s.lastDay) s.days = 1;
      else {
        var gap = daysBetween(s.lastDay, t);
        s.days = gap === 1 ? s.days + 1 : (gap > 1 ? 1 : s.days);
      }
      s.lastDay = t;
      this.flush();
    },

    task: function (id) {
      return this.data.tasks[id] || { best: 0, attempts: 0, hinted: false, seenSolution: false, solvedAt: null };
    },

    recordAttempt: function (task, result, opts) {
      opts = opts || {};
      var t = this.task(task.id);
      t.attempts++;
      var earnedBefore = Math.round(task.points * t.best * (t.hinted ? 0.7 : 1));
      if (opts.hinted) t.hinted = true;
      if (opts.seenSolution) t.seenSolution = true;
      if (result.score > t.best) t.best = result.score;
      if (result.passed && !t.solvedAt) t.solvedAt = new Date().toISOString();
      this.data.tasks[task.id] = t;
      var earnedAfter = t.seenSolution ? Math.round(task.points * t.best * 0.4)
        : Math.round(task.points * t.best * (t.hinted ? 0.7 : 1));
      var delta = Math.max(0, earnedAfter - earnedBefore);
      this.data.xp += delta;
      this.flush();
      return { delta: delta, earned: earnedAfter, state: t };
    },

    earnedFor: function (task) {
      var t = this.task(task.id);
      if (!t.attempts) return 0;
      var k = t.seenSolution ? 0.4 : (t.hinted ? 0.7 : 1);
      return Math.round(task.points * t.best * k);
    },

    recordDrill: function (correct, streak) {
      var d = this.data.drills;
      d.total++;
      if (correct) { d.correct++; this.data.xp += 2; }
      if (streak > d.bestStreak) d.bestStreak = streak;
      this.flush();
    },

    recordExam: function (rec) {
      this.data.exams.push(rec);
      this.flush();
    },

    setPlatform: function (p) { this.data.platform = p; this.flush(); },

    reset: function () { this.data = blank(); this.flush(); },

    exportJSON: function () { return JSON.stringify(this.data, null, 2); },
    importJSON: function (text) {
      var d = JSON.parse(text);
      if (!d || d.version !== 1) throw new Error('Неподходящий формат файла');
      this.data = Object.assign(blank(), d);
      this.flush();
    }
  };

  root.XLStore = Store;
})(typeof self !== 'undefined' ? self : this);

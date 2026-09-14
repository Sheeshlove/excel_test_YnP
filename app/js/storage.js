/* =============================================================================
 * storage.js — the learner's progress
 * Nothing here ever lowers a score: only the best attempt at a task is kept.
 *
 * Progress is written to the most durable place available, in this order:
 *
 *   1. the native window's own file   — ExcelTrainer.app built with swiftc puts
 *                                       progress.json in Application Support
 *   2. the local server's file        — the same file, over /api/progress
 *   3. this browser's localStorage    — a plain web page on a stable origin
 *   4. memory                         — last resort, lost when the tab closes
 *
 * 1 and 2 are what make the macOS app remember anything: browser storage is
 * tied to the exact origin, and the origin used to change on every launch
 * because the local server picked a random port. A file on disk does not care
 * about ports, about Safari's rules for file:// pages, or about which browser
 * the launcher managed to find.
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
      exams: [],        // {date, paper, title, score, points, maxPoints, seconds}
      streak: { days: 0, lastDay: null },
      platform: 'mac',
      createdAt: new Date().toISOString()
    };
  }
  // anything that is not a progress file of the version we understand is ignored
  function usable(data) {
    return (data && data.version === 1) ? Object.assign(blank(), data) : null;
  }

  /* ------------------------------------------------------------ browser --- */
  function lsAvailable() {
    try {
      var t = '__t';
      window.localStorage.setItem(t, '1');
      window.localStorage.removeItem(t);
      return true;
    } catch (e) { return false; }
  }
  var HAS_LS = (typeof window !== 'undefined') && lsAvailable();

  function lsLoad() {
    if (!HAS_LS) return null;
    try { return usable(JSON.parse(window.localStorage.getItem(KEY) || 'null')); }
    catch (e) { return null; }
  }
  function lsSave(data) {
    if (!HAS_LS) return false;
    try { window.localStorage.setItem(KEY, JSON.stringify(data)); return true; }
    catch (e) { return false; }
  }

  /* ------------------------------------------- the native window's file --- */
  // NativeShell.swift injects window.__XLTrainerNative before the page runs and
  // listens on the trainerStore message channel.
  function nativeBackend() {
    var wk = typeof window !== 'undefined' && window.webkit &&
             window.webkit.messageHandlers && window.webkit.messageHandlers.trainerStore;
    var info = (typeof window !== 'undefined' && window.__XLTrainerNative) || null;
    if (!wk || !info) return null;
    return {
      name: 'the app’s own progress file',
      where: info.path || 'Application Support',
      load: function (done) {
        var data = null;
        try { data = info.saved ? usable(JSON.parse(info.saved)) : null; } catch (e) { data = null; }
        done(data);
      },
      save: function (data) {
        try { wk.postMessage({ op: 'save', json: JSON.stringify(data) }); return true; }
        catch (e) { return false; }
      }
    };
  }

  /* ------------------------------------------- the local server's file --- */
  var API = 'api/progress';                 // relative: works whatever the port

  function serverBackend(done) {
    if (typeof window === 'undefined' || !/^https?:$/.test(window.location.protocol)) return done(null);
    var xhr = new XMLHttpRequest();
    try { xhr.open('GET', API, true); } catch (e) { return done(null); }
    xhr.timeout = 1500;          // it is a server on this machine: it answers at once
    xhr.onload = function () {
      var body = null;
      try { body = JSON.parse(xhr.responseText); } catch (e) { body = null; }
      if (xhr.status !== 200 || !body || body.ok !== true) return done(null);   // a plain web server
      done({
        name: 'a file on this machine',
        where: body.path || 'Application Support',
        saved: usable(body.data),
        save: function (data) {
          var put = new XMLHttpRequest();
          put.open('PUT', API, true);
          put.setRequestHeader('Content-Type', 'application/json');
          put.send(JSON.stringify(data));
          return true;
        },
        // the window is closing: a beacon still gets delivered, an XHR may not
        saveNow: function (data) {
          try {
            if (navigator.sendBeacon) {
              return navigator.sendBeacon(API, new Blob([JSON.stringify(data)], { type: 'application/json' }));
            }
          } catch (e) { /* fall through to the synchronous write below */ }
          try {
            var put = new XMLHttpRequest();
            put.open('PUT', API, false);
            put.setRequestHeader('Content-Type', 'application/json');
            put.send(JSON.stringify(data));
            return true;
          } catch (e) { return false; }
        }
      });
    };
    xhr.onerror = xhr.ontimeout = function () { done(null); };
    try { xhr.send(); } catch (e) { done(null); }
  }

  /* ------------------------------------------------------------- store --- */
  var backend = null;          // the durable place, when there is one
  var writeTimer = null;

  function writeThrough(data, immediate) {
    if (HAS_LS) lsSave(data);                       // a mirror, and the fallback
    else memory = data;
    if (!backend) return;
    if (immediate) {
      clearTimeout(writeTimer); writeTimer = null;
      (backend.saveNow || backend.save)(data);
      return;
    }
    // a burst of saves (a filled grid, a finished exam) becomes one write
    clearTimeout(writeTimer);
    writeTimer = setTimeout(function () { writeTimer = null; backend.save(data); }, 250);
  }

  var Store = {
    persistent: HAS_LS,
    storedIn: HAS_LS ? 'this browser' : 'memory only',
    data: null,

    /* init(done) — the durable backends have to be asked asynchronously, so the
     * app hands in a callback and draws itself once the answer is in. Browser
     * storage is read straight away, so nothing is ever blocked on the network. */
    init: function (done) {
      var self = this;
      self.data = lsLoad() || memory || blank();
      var local = lsLoad();

      function adopt(be, saved) {
        backend = be;
        if (be) {
          self.persistent = true;
          self.storedIn = be.name + (be.where ? ' (' + be.where + ')' : '');
        }
        if (saved) self.data = saved;                       // the file wins
        else if (be && local) writeThrough(self.data, true); // first run: migrate
        self.touchDay();
        if (done) done(self.data);
      }

      var nat = nativeBackend();
      if (nat) return nat.load(function (saved) { adopt(nat, saved); });
      serverBackend(function (srv) {
        adopt(srv, srv && srv.saved);
      });
      return self.data;
    },

    flush: function () { writeThrough(this.data, false); },
    flushNow: function () { writeThrough(this.data, true); },

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

    // every sitting of one mock paper, newest first
    examsFor: function (paperId) {
      return this.data.exams.filter(function (e) { return e.paper === paperId; });
    },
    bestExam: function (paperId) {
      return this.examsFor(paperId).reduce(function (best, e) {
        return (!best || e.score > best.score) ? e : best;
      }, null);
    },

    setPlatform: function (p) { this.data.platform = p; this.flush(); },

    reset: function () { this.data = blank(); this.flushNow(); },

    exportJSON: function () { return JSON.stringify(this.data, null, 2); },
    importJSON: function (text) {
      var d = usable(JSON.parse(text));
      if (!d) throw new Error('That file is not a progress export');
      this.data = d;
      this.flushNow();
    }
  };

  // Closing the window must not cost the last few answers.
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pagehide', function () { if (Store.data) Store.flushNow(); });
    window.addEventListener('beforeunload', function () { if (Store.data) Store.flushNow(); });
  }

  root.XLStore = Store;
})(typeof self !== 'undefined' ? self : this);

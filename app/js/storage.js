/* =============================================================================
 * storage.js — the learner's progress (localStorage, memory as a fallback)
 * Nothing here ever lowers a score: only the best attempt at a task is kept.
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

  /* ------------------------------------------------------- merging two copies */
  // Called when the phone and the Mac, or two browsers, both hold progress.
  // Taking the newer copy wholesale would throw away whatever was done on the
  // other one, so every field is merged in the direction that cannot lose work.
  function merge(a, b) {
    if (!a) return b;
    if (!b) return a;
    var out = Object.assign(blank(), a);

    out.tasks = {};
    var ids = {};
    Object.keys(a.tasks || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(b.tasks || {}).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (id) {
      var x = (a.tasks || {})[id], y = (b.tasks || {})[id];
      if (!x) { out.tasks[id] = y; return; }
      if (!y) { out.tasks[id] = x; return; }
      var best = (y.best > x.best) ? y : x;          // the better attempt wins
      out.tasks[id] = {
        best: Math.max(x.best || 0, y.best || 0),
        attempts: Math.max(x.attempts || 0, y.attempts || 0),
        // a hint or a revealed answer stays on the record of whichever copy
        // earned the better score, so the points cannot be laundered away
        hinted: best.hinted,
        seenSolution: best.seenSolution,
        solvedAt: x.solvedAt || y.solvedAt
      };
    });

    out.drills = {
      total: Math.max((a.drills || {}).total || 0, (b.drills || {}).total || 0),
      correct: Math.max((a.drills || {}).correct || 0, (b.drills || {}).correct || 0),
      bestStreak: Math.max((a.drills || {}).bestStreak || 0, (b.drills || {}).bestStreak || 0)
    };

    var exams = {}, list = (a.exams || []).concat(b.exams || []);
    list.forEach(function (e) { if (e && e.date) exams[e.date] = e; });
    out.exams = Object.keys(exams).sort().map(function (k) { return exams[k]; });

    out.xp = Math.max(a.xp || 0, b.xp || 0);

    var sa = (a.streak || {}), sb = (b.streak || {});
    out.streak = ((sb.lastDay || '') > (sa.lastDay || '')) ? sb : sa;
    if (out.streak) out.streak.days = Math.max(sa.days || 0, sb.days || 0);

    out.savedAt = new Date().toISOString();
    return out;
  }

  /* ------------------------------------------ the copy that lives on disk ----
   * When the app is launched through ExcelTrainer.app or run.sh there is a
   * small local server behind it, and that server keeps progress in a real
   * file. That file is the durable copy: it survives a cleared browser profile,
   * a different browser, and the app being rebuilt. On GitHub Pages or on a
   * phone there is no server, the calls fail quietly, and browser storage is
   * all there is.
   * ------------------------------------------------------------------------ */
  // `ready` guards a race that cost real progress: the app flushes during
  // start-up, and without the guard that flush could push the browser's copy
  // over the file before the file had even been read and merged in.
  var disk = { available: false, ready: false, file: null, lastSaved: null, pending: null, error: null };

  function apiUrl(path) {
    // relative on purpose: the port can change between launches
    return new URL(path, window.location.href).toString();
  }

  function pushToDisk(data, immediate) {
    if (!disk.available || typeof fetch !== 'function') return Promise.resolve(false);
    return fetch(apiUrl('api/progress'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
      keepalive: !!immediate
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      disk.lastSaved = new Date();
      disk.error = null;
      return true;
    }).catch(function (e) {
      disk.error = e.message;
      return false;
    });
  }

  var Store = {
    persistent: HAS_LS,
    data: null,
    disk: disk,
    init: function () { this.data = load(); this.touchDay(); return this.data; },

    flush: function () {
      this.data.savedAt = new Date().toISOString();
      save(this.data);
      this.scheduleDiskSave();
    },

    // Disk writes are debounced: a burst of answers produces one write.
    scheduleDiskSave: function () {
      var self = this;
      if (!disk.available || !disk.ready) return;
      clearTimeout(disk.pending);
      disk.pending = setTimeout(function () { pushToDisk(self.data); }, 400);
    },

    saveNow: function () {
      clearTimeout(disk.pending);
      if (!disk.ready) return Promise.resolve(false);
      return pushToDisk(this.data, true);
    },

    // Reads the file, merges it with what the browser holds, and writes the
    // result back to both. onAdopt fires when the merge changed anything, so
    // the screen can be redrawn.
    connectDisk: function (onAdopt) {
      var self = this;
      if (typeof fetch !== 'function') return;
      // The local server only ever lives on this machine. Probing for it
      // anywhere else would just log a 404 in everybody's console.
      var host = window.location.hostname;
      if (host !== 'localhost' && host !== '127.0.0.1' && host !== '[::1]') return;
      fetch(apiUrl('api/progress'), { headers: { 'Accept': 'application/json' } })
        .then(function (r) {
          if (!r.ok) throw new Error('no local server');
          return r.json();
        })
        .then(function (res) {
          disk.available = true;
          disk.file = res.file || null;
          if (!res.found || !res.data) {
            disk.ready = true;                       // nothing on disk yet
            return pushToDisk(self.data);
          }
          var before = JSON.stringify(self.data);
          var merged = merge(self.data, res.data);
          self.data = merged;
          save(merged);
          disk.ready = true;                         // only now may writes go out
          return pushToDisk(merged).then(function () {
            if (before !== JSON.stringify(merged) && onAdopt) onAdopt();
          });
        })
        .catch(function () {
          disk.available = false;       // no server: browser storage only
        });
    },

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

    mergeIn: function (incoming) {
      this.data = merge(this.data, incoming);
      this.flush();
      return this.data;
    },

    exportJSON: function () { return JSON.stringify(this.data, null, 2); },
    importJSON: function (text, mergeInstead) {
      var d = JSON.parse(text);
      if (!d || d.version !== 1) throw new Error('That file is not a progress export');
      this.data = mergeInstead ? merge(this.data, d) : Object.assign(blank(), d);
      this.flush();
    }
  };

  root.XLStore = Store;
})(typeof self !== 'undefined' ? self : this);

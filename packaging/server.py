#!/usr/bin/env python3
"""Local server for Excel Trainer.

Two jobs:

1. Serve the app over http://127.0.0.1 so the browser treats it as a proper
   site. Opened as a plain file, Safari refuses to let the page store anything.

2. Keep the learner's progress in a real file on disk, under
   ~/Library/Application Support/ExcelTrainer/progress.json on a Mac.

Why the file matters: browser storage is tied to the exact origin, and an origin
includes the port number. Handing out a random port every launch quietly gave
the app a brand new, empty storage each time. The port below is therefore fixed,
and the file on disk is the copy that actually survives — a cleared browser
profile, a different browser, or the app being rebuilt.
"""
import errno
import http.server
import json
import os
import shutil
import socketserver
import sys
import tempfile

PREFERRED_PORT = 47321          # stable, so the browser keeps its storage
PORT_ATTEMPTS = 20
API_PREFIX = '/api/'
MAX_BODY = 4 * 1024 * 1024      # a progress file is a few KB; this is generous


def data_dir():
    """Where progress is kept, following each platform's convention."""
    override = os.environ.get('EXCEL_TRAINER_DATA')
    if override:
        return os.path.abspath(os.path.expanduser(override))
    home = os.path.expanduser('~')
    if sys.platform == 'darwin':
        return os.path.join(home, 'Library', 'Application Support', 'ExcelTrainer')
    if os.name == 'nt':
        return os.path.join(os.environ.get('APPDATA', home), 'ExcelTrainer')
    return os.path.join(os.environ.get('XDG_DATA_HOME', os.path.join(home, '.local', 'share')),
                        'excel-trainer')


PROGRESS_DIR = data_dir()
PROGRESS_FILE = os.path.join(PROGRESS_DIR, 'progress.json')
BACKUP_FILE = os.path.join(PROGRESS_DIR, 'progress.backup.json')


def _load(path):
    try:
        with open(path, 'r', encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def read_progress():
    """The current progress, falling back to the backup if the main file is gone."""
    return _load(PROGRESS_FILE) or _load(BACKUP_FILE)


def write_progress(payload):
    """Write the file so that it is never missing and never half-written.

    Order matters. Moving the old file out of the way first — which is the
    obvious way to keep a backup — leaves a window in which there is no
    progress file at all, and killing the app in that window loses everything.
    So: write the new content to a temporary file beside the real one, fsync
    it, copy the old file aside as the backup, and only then rename the
    temporary file over the target. The rename is atomic, so a reader either
    sees the whole old file or the whole new one.
    """
    os.makedirs(PROGRESS_DIR, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=PROGRESS_DIR, prefix='.progress-', suffix='.json')
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as fh:
            json.dump(payload, fh, ensure_ascii=False, indent=2)
            fh.flush()
            os.fsync(fh.fileno())
        if os.path.exists(PROGRESS_FILE):
            try:
                shutil.copyfile(PROGRESS_FILE, BACKUP_FILE)
            except OSError:
                pass                       # a missing backup must not block the save
        os.replace(tmp, PROGRESS_FILE)
    except BaseException:
        if os.path.exists(tmp):
            try:
                os.unlink(tmp)
            except OSError:
                pass
        raise


def merge_progress(old, new):
    """Combine what is on disk with what a client just sent.

    A plain overwrite loses work whenever two copies of the app are open at
    once: the one that closes last writes its own, older picture over the file.
    Merging in the direction that cannot lose a solved task removes the whole
    class of problem, and doing it here — inside the same request that writes
    the file — means there is no window for the two to race.
    """
    if not isinstance(old, dict):
        return new
    out = dict(new)

    tasks = dict(old.get('tasks') or {})
    for task_id, incoming in (new.get('tasks') or {}).items():
        current = tasks.get(task_id)
        if not isinstance(current, dict) or not isinstance(incoming, dict):
            tasks[task_id] = incoming
            continue
        better = incoming if (incoming.get('best') or 0) > (current.get('best') or 0) else current
        tasks[task_id] = {
            'best': max(current.get('best') or 0, incoming.get('best') or 0),
            'attempts': max(current.get('attempts') or 0, incoming.get('attempts') or 0),
            'hinted': better.get('hinted', False),
            'seenSolution': better.get('seenSolution', False),
            'solvedAt': current.get('solvedAt') or incoming.get('solvedAt')
        }
    out['tasks'] = tasks

    old_drills = old.get('drills') or {}
    new_drills = new.get('drills') or {}
    out['drills'] = {
        key: max(old_drills.get(key) or 0, new_drills.get(key) or 0)
        for key in ('total', 'correct', 'bestStreak')
    }

    exams = {}
    for exam in (old.get('exams') or []) + (new.get('exams') or []):
        if isinstance(exam, dict) and exam.get('date'):
            exams[exam['date']] = exam
    out['exams'] = [exams[k] for k in sorted(exams)]

    out['xp'] = max(old.get('xp') or 0, new.get('xp') or 0)

    old_streak = old.get('streak') or {}
    new_streak = new.get('streak') or {}
    streak = new_streak if (new_streak.get('lastDay') or '') >= (old_streak.get('lastDay') or '') else old_streak
    streak = dict(streak)
    streak['days'] = max(old_streak.get('days') or 0, new_streak.get('days') or 0)
    out['streak'] = streak

    return out


class Handler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    # ---------------------------------------------------------------- API --
    def _json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.startswith(API_PREFIX):
            if self.path == '/api/progress':
                saved = read_progress()
                if saved is None:
                    return self._json(200, {'found': False, 'file': PROGRESS_FILE})
                return self._json(200, {'found': True, 'file': PROGRESS_FILE, 'data': saved})
            if self.path == '/api/info':
                return self._json(200, {
                    'file': PROGRESS_FILE,
                    'backup': BACKUP_FILE,
                    'exists': os.path.exists(PROGRESS_FILE),
                    'bytes': os.path.getsize(PROGRESS_FILE) if os.path.exists(PROGRESS_FILE) else 0
                })
            return self._json(404, {'error': 'unknown endpoint'})
        return super().do_GET()

    def do_PUT(self):
        if self.path != '/api/progress':
            return self._json(404, {'error': 'unknown endpoint'})
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            return self._json(400, {'error': 'bad length'})
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {'error': 'bad length'})
        raw = self.rfile.read(length)
        try:
            payload = json.loads(raw.decode('utf-8'))
        except (ValueError, UnicodeDecodeError):
            return self._json(400, {'error': 'body is not JSON'})
        if not isinstance(payload, dict):
            return self._json(400, {'error': 'expected an object'})
        merged = merge_progress(read_progress(), payload)
        try:
            write_progress(merged)
        except OSError as exc:
            return self._json(500, {'error': str(exc)})
        return self._json(200, {'saved': True, 'file': PROGRESS_FILE, 'data': merged})


class Server(socketserver.TCPServer):
    allow_reuse_address = True


def bind(root_port):
    """Prefer a fixed port so browser storage survives a restart."""
    candidates = [root_port + i for i in range(PORT_ATTEMPTS)] + [0]
    for port in candidates:
        try:
            return Server(('127.0.0.1', port), Handler)
        except OSError as exc:
            if exc.errno not in (errno.EADDRINUSE, errno.EACCES):
                raise
    raise SystemExit('no free port')


def sweep_temp_files():
    """Remove leftovers from a write that was interrupted by a crash or a kill.

    The real file is never damaged — the rename that installs it is atomic —
    but the temporary file it was being written to can survive.
    """
    try:
        for name in os.listdir(PROGRESS_DIR):
            if name.startswith('.progress-') and name.endswith('.json'):
                try:
                    os.unlink(os.path.join(PROGRESS_DIR, name))
                except OSError:
                    pass
    except OSError:
        pass


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    os.chdir(root)
    wanted = int(sys.argv[2]) if len(sys.argv) > 2 else PREFERRED_PORT
    sweep_temp_files()
    httpd = bind(wanted)
    print(httpd.server_address[1], flush=True)
    print(PROGRESS_FILE, flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()

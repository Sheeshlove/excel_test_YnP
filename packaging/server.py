#!/usr/bin/env python3
"""Local HTTP server for the trainer.

It does two jobs:

1. Serves the application directory over http://127.0.0.1, so the browser
   treats the page as a proper site rather than a file.

2. Keeps the learner's progress in a real file on disk, under
   ~/Library/Application Support/ExcelTrainer/progress.json, and exposes it at
   /api/progress (GET to read, PUT/POST to write).

Point 2 is what makes progress survive on macOS. Browser storage is tied to the
exact origin, which used to include a port number the server picked at random on
every launch, so every launch looked like a brand new site with no progress in
it. The port is now stable *and* the progress no longer depends on it: the file
on disk is the source of truth, and the app falls back to browser storage only
when this server is not there.

Usage:  server.py <app directory> [--port N] [--profile DIR]
The chosen port is printed on the first line of stdout.
"""
import http.server
import json
import os
import socketserver
import sys
import tempfile

# A stable port keeps the origin — and therefore any browser storage — the same
# from one launch to the next. The alternatives are there for the rare case of
# the first one already being taken by something else on the machine.
PREFERRED_PORTS = [17324, 17325, 17326, 17327, 17328]
MAX_BODY = 4 * 1024 * 1024          # a progress file is a few KB; this is slack
PROGRESS_NAME = 'progress.json'


def default_profile_dir():
    home = os.path.expanduser('~')
    if sys.platform == 'darwin':
        return os.path.join(home, 'Library', 'Application Support', 'ExcelTrainer')
    return os.path.join(home, '.exceltrainer')


class Handler(http.server.SimpleHTTPRequestHandler):
    profile_dir = None

    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    # --- the progress file --------------------------------------------------
    @property
    def progress_path(self):
        return os.path.join(self.profile_dir, PROGRESS_NAME)

    def _local_only(self):
        """Refuse anything that did not come from this machine by name or IP.

        The socket is bound to the loopback address already; this second check
        stops a page on some other site from reaching the API through a
        hostname that happens to resolve to 127.0.0.1.
        """
        host = (self.headers.get('Host') or '').split(':')[0].strip('[]')
        if host and host not in ('127.0.0.1', 'localhost', '::1'):
            self.send_error(403, 'This server only answers to 127.0.0.1')
            return False
        return True

    def _json(self, code, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _read_progress(self):
        try:
            with open(self.progress_path, 'r', encoding='utf-8') as fh:
                return json.load(fh)
        except (OSError, ValueError):
            return None

    def _write_progress(self, data):
        """Writes to a temporary file first, then renames it over the old one,
        so a crash half way through can never leave a truncated progress file."""
        os.makedirs(self.profile_dir, exist_ok=True)
        fd, tmp = tempfile.mkstemp(dir=self.profile_dir, prefix='.progress-', suffix='.tmp')
        try:
            with os.fdopen(fd, 'w', encoding='utf-8') as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
                fh.flush()
                os.fsync(fh.fileno())
            os.replace(tmp, self.progress_path)
        except BaseException:
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    # --- routing ------------------------------------------------------------
    def do_GET(self):
        if not self._local_only():
            return
        if self.path.split('?')[0] == '/api/progress':
            saved = self._read_progress()
            return self._json(200, {'ok': True, 'data': saved, 'path': self.progress_path})
        return super().do_GET()

    def do_HEAD(self):
        if not self._local_only():
            return
        if self.path.split('?')[0] == '/api/progress':
            return self._json(200, {'ok': True})
        return super().do_HEAD()

    def do_PUT(self):
        if not self._local_only():
            return
        if self.path.split('?')[0] != '/api/progress':
            return self.send_error(404, 'Not found')
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > MAX_BODY:
            return self._json(400, {'ok': False, 'error': 'bad body length'})
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode('utf-8'))
        except (UnicodeDecodeError, ValueError):
            return self._json(400, {'ok': False, 'error': 'body is not JSON'})
        try:
            self._write_progress(data)
        except OSError as exc:
            return self._json(500, {'ok': False, 'error': str(exc)})
        return self._json(200, {'ok': True, 'path': self.progress_path})

    # sendBeacon, used when the window is closing, can only issue a POST
    do_POST = do_PUT


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def bind(port_hint):
    """Binds the first port that is free: the requested one, then the stable
    preferred ones, then whatever the operating system hands out."""
    candidates = ([port_hint] if port_hint else []) + PREFERRED_PORTS + [0]
    last = None
    for port in candidates:
        try:
            return Server(('127.0.0.1', port), Handler)
        except OSError as exc:
            last = exc
    raise last


def main():
    args = sys.argv[1:]
    root, port, profile = None, 0, None
    i = 0
    while i < len(args):
        a = args[i]
        if a == '--port' and i + 1 < len(args):
            port = int(args[i + 1]); i += 2
        elif a == '--profile' and i + 1 < len(args):
            profile = args[i + 1]; i += 2
        elif root is None:
            root = a; i += 1
        else:
            port = int(a); i += 1          # legacy: server.py <root> <port>

    Handler.profile_dir = profile or os.environ.get('EXCEL_TRAINER_PROFILE') or default_profile_dir()
    try:
        os.makedirs(Handler.profile_dir, exist_ok=True)
    except OSError:
        pass

    os.chdir(root or os.getcwd())
    httpd = bind(port)
    print(httpd.server_address[1], flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()

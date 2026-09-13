#!/usr/bin/env python3
"""Local HTTP server for the trainer.

Binds to 127.0.0.1 on a free port, prints the port number on the first line and
serves the application directory. It exists so the browser treats the page as a
proper site and allows it to save progress.
"""
import http.server
import os
import socketserver
import sys


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


class Server(socketserver.TCPServer):
    allow_reuse_address = True


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
    os.chdir(root)
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    httpd = Server(('127.0.0.1', port), Handler)
    print(httpd.server_address[1], flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()

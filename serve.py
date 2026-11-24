"""Tiny local web server (standard library only).

Browsers refuse to `fetch()` presets.json when index.html is opened straight from
disk, so run this from the project root:

    python serve.py            ->  http://localhost:8000/web/
    python serve.py 9000       ->  custom port
"""
import http.server
import socketserver
import sys
import threading
import webbrowser
from pathlib import Path

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
ROOT = Path(__file__).resolve().parent


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, fmt, *args):      # keep the terminal quiet
        pass


if __name__ == "__main__":
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        url = f"http://localhost:{PORT}/web/"
        print(f"Turing Machine Simulator running at {url}   (Ctrl+C to stop)")
        threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")

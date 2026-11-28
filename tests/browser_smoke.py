"""Run browser_smoke.js against the actual page in headless Chromium or Edge."""
import http.server
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
from threading import Thread

ROOT = Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def do_GET(self):
        if self.path != "/web/smoke":
            return super().do_GET()
        page = (ROOT / "web/index.html").read_text(encoding="utf-8")
        page = page.replace("</body>", '<script src="/tests/browser_smoke.js"></script></body>')
        data = page.encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, fmt, *args):
        pass


def main(browser):
    with TemporaryDirectory() as profile, http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler) as server:
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/web/smoke"
            result = subprocess.run([browser, "--headless=new", "--disable-gpu", "--disable-extensions",
                                     "--no-first-run", f"--user-data-dir={profile}",
                                     "--virtual-time-budget=15000", "--dump-dom", url],
                                    stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
            dom = result.stdout.decode("utf-8", errors="replace")
            for line in dom.splitlines():
                if '<pre id="browser-test-result"' in line:
                    print(line)
            if result.returncode or '<pre id="browser-test-result">PASS' not in dom:
                print(result.stderr.decode("utf-8", errors="replace")[-2000:], file=sys.stderr)
                return 1
            return 0
        finally:
            server.shutdown()


if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))

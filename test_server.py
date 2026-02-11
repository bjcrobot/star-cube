import http.server
import socketserver
from functools import partial
from pathlib import Path

PORT = 8000


class ThreadingHTTPServer(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


class NoCacheRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


if __name__ == "__main__":
    web_dir = Path(__file__).resolve().parent
    handler = partial(NoCacheRequestHandler, directory=str(web_dir))
    with ThreadingHTTPServer(("", PORT), handler) as httpd:
        print(f"Serving {web_dir} at http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass

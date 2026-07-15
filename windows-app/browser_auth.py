"""
Auth via navigateur : ouvre readingtk.net/auth/desktop,
reçoit la session via un callback HTTP localhost.
"""
import json
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer

from supabase_client import supabase

_PORT = 17832
_DESKTOP_AUTH_URL = f"https://readingtk.net/desktop-auth?port={_PORT}"


def login_via_browser(on_success=None, on_error=None):
    """
    Lance un serveur HTTP local sur le port {_PORT}, ouvre readingtk.net/auth/desktop
    dans le navigateur, attend que la session soit postée (max 5 minutes).
    """
    result = {"session": None, "error": None}
    done = threading.Event()

    class _Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            if self.path == "/session":
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length)
                self.send_response(200)
                self.send_header("Access-Control-Allow-Origin", "https://readingtk.net")
                self.end_headers()
                try:
                    result["session"] = json.loads(body)
                except Exception as e:
                    result["error"] = str(e)
                done.set()
            else:
                self.send_response(404)
                self.end_headers()

        def do_OPTIONS(self):
            self.send_response(200)
            self.send_header("Access-Control-Allow-Origin", "https://readingtk.net")
            self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            self.end_headers()

        def log_message(self, *args):
            pass

    def _run():
        try:
            server = HTTPServer(("localhost", _PORT), _Handler)
            server.timeout = 1
            for _ in range(300):  # max 5 minutes
                server.handle_request()
                if done.is_set():
                    break
            server.server_close()
        except Exception as e:
            result["error"] = str(e)
            done.set()

        if result["session"]:
            try:
                supabase._store_session(result["session"])
                if on_success:
                    on_success()
            except Exception as e:
                if on_error:
                    on_error(str(e))
        elif on_error and result["error"]:
            on_error(result["error"])
        elif on_error and not done.is_set():
            on_error("Délai d'attente dépassé (5 min)")

    t = threading.Thread(target=_run, daemon=True)
    t.start()

    webbrowser.open(_DESKTOP_AUTH_URL)

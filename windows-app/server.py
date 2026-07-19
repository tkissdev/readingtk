"""Serveur HTTP local — permet au dashboard de déclencher des vérifications via l'app Windows."""
import json
import logging
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer

PORT = 7842
ALLOWED_ORIGINS = [
    "https://readingtk.net",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:4173",
]

log = logging.getLogger("rtk.server")

_check_callback = None  # injecté par main.py
_check_site_callback = None  # injecté par main.py


class _Handler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # silencer les logs HTTP par défaut

    def _send_cors(self):
        origin = self.headers.get("Origin", "")
        if origin in ALLOWED_ORIGINS:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors()
        self.end_headers()

    def do_GET(self):
        if self.path == "/ping":
            from supabase_client import supabase
            body = json.dumps({"ok": True, "connected": supabase.is_logged_in}).encode()
            self.send_response(200)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == "/check":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                body = {}

            from supabase_client import supabase
            if not supabase.is_logged_in:
                resp = json.dumps({"error": "Non connecté"}).encode()
                self.send_response(401)
                self._send_cors()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return

            title_id = body.get("title_id")
            auto_discover = bool(body.get("auto_discover", False))

            if _check_callback:
                try:
                    result = _check_callback(title_id, auto_discover)
                    resp = json.dumps({"status": "done", **(result or {})}).encode()
                    status_code = 200
                except Exception as e:
                    log.error("Erreur pendant /check : %s", e)
                    resp = json.dumps({"status": "error", "error": str(e)}).encode()
                    status_code = 500
            else:
                resp = json.dumps({"status": "error", "error": "Non initialisé"}).encode()
                status_code = 500

            self.send_response(status_code)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
        elif self.path == "/check-site":
            try:
                length = int(self.headers.get("Content-Length", 0))
                body = json.loads(self.rfile.read(length) or b"{}")
            except Exception:
                body = {}

            from supabase_client import supabase
            if not supabase.is_logged_in:
                resp = json.dumps({"error": "Non connecté"}).encode()
                self.send_response(401)
                self._send_cors()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp)))
                self.end_headers()
                self.wfile.write(resp)
                return

            site_id = body.get("site_id")
            url = body.get("url")
            needs_tab = bool(body.get("needs_tab", False))

            if _check_site_callback:
                try:
                    result = _check_site_callback(site_id, url, needs_tab)
                    resp = json.dumps({"status": "done", **(result or {})}).encode()
                    status_code = 200
                except Exception as e:
                    log.error("Erreur pendant /check-site : %s", e)
                    resp = json.dumps({"status": "error", "error": str(e)}).encode()
                    status_code = 500
            else:
                resp = json.dumps({"status": "error", "error": "Non initialisé"}).encode()
                status_code = 500

            self.send_response(status_code)
            self._send_cors()
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
        else:
            self.send_response(404)
            self.end_headers()


def start(check_callback=None, check_site_callback=None):
    """Démarre le serveur HTTP local dans un thread daemon."""
    global _check_callback, _check_site_callback
    _check_callback = check_callback
    _check_site_callback = check_site_callback
    try:
        httpd = HTTPServer(("127.0.0.1", PORT), _Handler)
        t = threading.Thread(target=httpd.serve_forever, daemon=True)
        t.start()
        log.info("Serveur local démarré sur http://127.0.0.1:%d", PORT)
    except OSError as e:
        log.warning("Impossible de démarrer le serveur local (port %d) : %s", PORT, e)

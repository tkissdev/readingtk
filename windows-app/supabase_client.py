"""Supabase REST API wrapper — port du sbGet/sbPatch/sbPost du background.js"""
import json
import logging
import os
import time
import requests

log = logging.getLogger("rtk.supabase")

SUPABASE_URL = "https://jjjfphkvwtruckxygwal.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqamZwaGt2d3RydWNreHlnd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjY2MDksImV4cCI6MjA5NjUwMjYwOX0"
    ".VEGbnT2qOQ2nr82Lpki8ppQS5jQymPMj6rMZ7gFc9zA"
)

# Session persistée dans un fichier local plutôt que le gestionnaire d'identifiants Windows —
# CredWriteW échoue de façon incompréhensible une fois l'app empaquetée (PyInstaller), même
# pour des valeurs courtes ; un fichier simple évite complètement ce problème.
_SESSION_DIR = os.path.join(os.getenv("LOCALAPPDATA", os.path.expanduser("~")), "ReadingTK")
_SESSION_FILE = os.path.join(_SESSION_DIR, "session.json")

DASHBOARD_URL = "https://readingtk.net/dashboard"


class SupabaseClient:
    def __init__(self):
        self._access_token: str | None = None
        self._refresh_token: str | None = None
        self._user_id: str | None = None
        self._expires_at: float = 0  # ms
        self._load()

    # ── Persistence ────────────────────────────────────────────────────────────

    def _load(self):
        try:
            if not os.path.exists(_SESSION_FILE):
                return
            with open(_SESSION_FILE, "r", encoding="utf-8") as f:
                s = json.load(f)
            self._access_token = s.get("access_token")
            self._refresh_token = s.get("refresh_token")
            self._user_id = s.get("user_id")
            self._expires_at = s.get("expires_at", 0)
        except Exception as e:
            log.warning("Impossible de charger la session sauvegardée : %s", e)

    def _save(self):
        try:
            os.makedirs(_SESSION_DIR, exist_ok=True)
            with open(_SESSION_FILE, "w", encoding="utf-8") as f:
                json.dump({
                    "access_token": self._access_token,
                    "refresh_token": self._refresh_token,
                    "user_id": self._user_id,
                    "expires_at": self._expires_at,
                }, f)
        except Exception as e:
            log.warning("Impossible de sauvegarder la session : %s", e)

    # ── Auth ────────────────────────────────────────────────────────────────────

    def _store_session(self, data: dict):
        self._access_token = data.get("access_token")
        self._refresh_token = data.get("refresh_token")
        user = data.get("user") or {}
        self._user_id = user.get("id") or data.get("user_id")
        self._expires_at = (data.get("expires_at") or 0) * 1000
        self._save()

    def login(self, email: str, password: str):
        res = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=password",
            headers={
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": f"Bearer {SUPABASE_ANON_KEY}",
                "Content-Type": "application/json",
                "X-Client-Info": "supabase-js/2.47.10",
                "Origin": "https://readingtk.net",
                "Referer": "https://readingtk.net/",
            },
            json={"email": email, "password": password},
            timeout=15,
        )
        data = res.json()
        if not res.ok:
            raise ValueError(data.get("error_description") or data.get("msg") or "Identifiants incorrects")
        self._store_session(data)

    def _clear_session(self):
        self._access_token = None
        self._refresh_token = None
        self._user_id = None
        self._expires_at = 0
        try:
            if os.path.exists(_SESSION_FILE):
                os.remove(_SESSION_FILE)
        except Exception:
            pass

    def logout(self):
        self._clear_session()

    def _refresh(self) -> str:
        if not self._refresh_token:
            self._clear_session()
            raise ValueError("Pas de refresh token — reconnectez-vous")
        res = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"refresh_token": self._refresh_token},
            timeout=15,
        )
        if not res.ok:
            # Le serveur a explicitement rejeté le refresh token (expiré/révoqué) : la session
            # est morte, il faut effacer l'état local pour que is_logged_in reflète la réalité
            # et que l'utilisateur puisse se reconnecter (sinon le menu reste bloqué sur "Connecté").
            log.warning("Refresh token invalide ou expiré — session effacée")
            self._clear_session()
            raise ValueError("Token refresh échoué — reconnectez-vous")
        data = res.json()
        self._access_token = data["access_token"]
        self._refresh_token = data["refresh_token"]
        self._expires_at = (data.get("expires_at") or 0) * 1000
        self._save()
        return self._access_token

    def get_token(self) -> str:
        if not self._access_token:
            raise ValueError("Non connecté")
        if self._expires_at and time.time() * 1000 > self._expires_at - 5 * 60 * 1000:
            return self._refresh()
        return self._access_token

    @property
    def is_logged_in(self) -> bool:
        return bool(self._access_token)

    @property
    def user_id(self) -> str | None:
        return self._user_id

    # ── REST helpers ────────────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": f"Bearer {self.get_token()}",
        }

    def get(self, path: str) -> list:
        res = requests.get(
            f"{SUPABASE_URL}/rest/v1{path}",
            headers=self._headers(),
            timeout=30,
        )
        res.raise_for_status()
        return res.json()

    def post(self, path: str, body: dict) -> list:
        headers = {**self._headers(), "Content-Type": "application/json", "Prefer": "return=representation"}
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1{path}",
            headers=headers,
            json=body,
            timeout=30,
        )
        res.raise_for_status()
        return res.json()

    def patch(self, path: str, body: dict):
        headers = {**self._headers(), "Content-Type": "application/json"}
        requests.patch(
            f"{SUPABASE_URL}/rest/v1{path}",
            headers=headers,
            json=body,
            timeout=30,
        )

    def invoke_edge(self, function_name: str, body: dict) -> dict:
        headers = {**self._headers(), "Content-Type": "application/json"}
        res = requests.post(
            f"{SUPABASE_URL}/functions/v1/{function_name}",
            headers=headers,
            json=body,
            timeout=30,
        )
        return res.json() if res.ok else {}

    # ── Settings ────────────────────────────────────────────────────────────────

    def sync_settings(self) -> dict:
        """Lit les réglages utilisateur depuis la BDD."""
        try:
            rows = self.get(
                f"/user_settings?user_id=eq.{self.user_id}"
                "&select=check_interval,browser_notifications,auto_discover"
            )
            return rows[0] if rows else {}
        except Exception:
            return {}

    def save_settings(self, settings: dict):
        """Sauvegarde les réglages (upsert)."""
        headers = {
            **self._headers(),
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates",
        }
        body = {"user_id": self.user_id, **settings}
        res = requests.post(
            f"{SUPABASE_URL}/rest/v1/user_settings",
            headers=headers,
            json=body,
            timeout=15,
        )
        res.raise_for_status()


# Singleton utilisé par tous les modules
supabase = SupabaseClient()

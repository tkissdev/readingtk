"""Supabase REST API wrapper — port du sbGet/sbPatch/sbPost du background.js"""
import json
import time
import keyring
import requests

SUPABASE_URL = "https://jjjfphkvwtruckxygwal.supabase.co"
SUPABASE_ANON_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
    ".eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqamZwaGt2d3RydWNreHlnd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjY2MDksImV4cCI6MjA5NjUwMjYwOX0"
    ".VEGbnT2qOQ2nr82Lpki8ppQS5jQymPMj6rMZ7gFc9zA"
)
_KEYRING_SERVICE = "ReadingTK"
_KEYRING_USER = "session"

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
            raw = keyring.get_password(_KEYRING_SERVICE, _KEYRING_USER)
            if raw:
                s = json.loads(raw)
                self._access_token = s.get("access_token")
                self._refresh_token = s.get("refresh_token")
                self._user_id = s.get("user_id")
                self._expires_at = s.get("expires_at", 0)
        except Exception:
            pass

    def _save(self):
        try:
            keyring.set_password(_KEYRING_SERVICE, _KEYRING_USER, json.dumps({
                "access_token": self._access_token,
                "refresh_token": self._refresh_token,
                "user_id": self._user_id,
                "expires_at": self._expires_at,
            }))
        except Exception:
            pass

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
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"email": email, "password": password},
            timeout=15,
        )
        data = res.json()
        if not res.ok:
            raise ValueError(data.get("error_description") or data.get("msg") or "Identifiants incorrects")
        self._store_session(data)

    def logout(self):
        self._access_token = None
        self._refresh_token = None
        self._user_id = None
        self._expires_at = 0
        try:
            keyring.delete_password(_KEYRING_SERVICE, _KEYRING_USER)
        except Exception:
            pass

    def _refresh(self) -> str:
        if not self._refresh_token:
            raise ValueError("Pas de refresh token — reconnectez-vous")
        res = requests.post(
            f"{SUPABASE_URL}/auth/v1/token?grant_type=refresh_token",
            headers={"apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json"},
            json={"refresh_token": self._refresh_token},
            timeout=15,
        )
        if not res.ok:
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


# Singleton utilisé par tous les modules
supabase = SupabaseClient()

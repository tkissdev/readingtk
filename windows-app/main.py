"""
ReadingTK Windows — Application systray
Vérification périodique des nouveaux chapitres manga/manhwa/manhua.
"""
import logging
import os
import sys
import threading
import time
import tkinter as tk
import webbrowser

import pystray
from PIL import Image, ImageDraw

from supabase_client import supabase, DASHBOARD_URL
from notifier import notify

log = logging.getLogger("rtk")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "readingtk.log"), encoding="utf-8"),
    ],
)

# ── État global ────────────────────────────────────────────────────────────────

_check_interval_minutes: int = 30
_check_timer: threading.Timer | None = None
_check_lock = threading.Lock()
_is_checking = False
_tray_icon: pystray.Icon | None = None
_root: tk.Tk | None = None  # tkinter tourne sur le thread principal


# ── Icône systray ──────────────────────────────────────────────────────────────

def _make_icon(color: str = "#6366f1") -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, 60, 60], fill=color)
    return img


# ── Check logique ──────────────────────────────────────────────────────────────

def _on_new_chapter(title_name: str, chap_label: str, chap_url: str):
    log.info("Nouveau chapitre : %s — %s", title_name, chap_label)
    try:
        s = supabase.sync_settings()
        if s.get("browser_notifications", True):
            notify(title_name, chap_label, chap_url)
    except Exception:
        notify(title_name, chap_label, chap_url)


def _do_check():
    global _is_checking
    with _check_lock:
        if _is_checking:
            return
        _is_checking = True

    if _tray_icon:
        _tray_icon.icon = _make_icon("#f59e0b")
        _tray_icon.title = "ReadingTK — Vérification en cours…"

    try:
        from checker import run_check
        result = run_check(on_new_chapter=_on_new_chapter)
        log.info("Check OK : %d détecté(s), %d erreur(s)", result["detected"], result["errors"])
        if _tray_icon:
            _tray_icon.icon = _make_icon()
            _tray_icon.title = (
                f"ReadingTK — Dernier check : {time.strftime('%H:%M')}"
                + (f" | {result['detected']} nouveau(x)" if result["detected"] else "")
            )
    except Exception as e:
        log.error("Erreur check : %s", e)
        if _tray_icon:
            _tray_icon.icon = _make_icon("#ef4444")
            _tray_icon.title = "ReadingTK — Erreur lors du dernier check"
    finally:
        with _check_lock:
            _is_checking = False
        _schedule_next()


def _schedule_next():
    global _check_timer
    if _check_timer:
        _check_timer.cancel()
        _check_timer = None
    if _check_interval_minutes <= 0:
        log.info("Vérification automatique désactivée")
        return
    _check_timer = threading.Timer(_check_interval_minutes * 60, _run_check_thread)
    _check_timer.daemon = True
    _check_timer.start()


def _run_check_thread():
    threading.Thread(target=_do_check, daemon=True).start()


def _load_settings():
    global _check_interval_minutes
    if not supabase.is_logged_in:
        return
    try:
        s = supabase.sync_settings()
        if s.get("check_interval"):
            _check_interval_minutes = int(s["check_interval"])
    except Exception as e:
        log.warning("Impossible de charger les réglages: %s", e)


# ── Dialogs (appelés depuis le thread principal tkinter via root.after) ────────

def _do_show_login():
    """Exécuté sur le thread principal (tkinter)."""
    from auth_dialog import show_login_dialog
    ok = show_login_dialog(_root)
    if ok:
        log.info("Connexion réussie : %s", supabase.user_id)
        _load_settings()
        _schedule_next()
        _run_check_thread()
        if _tray_icon:
            _tray_icon.update_menu()


# ── Callbacks menu systray ─────────────────────────────────────────────────────
# Les callbacks pystray tournent dans le thread Win32 du systray.
# Pour tout ce qui touche tkinter, on délègue au thread principal via root.after.

def _menu_check_now(icon, item):
    if not supabase.is_logged_in:
        _root.after(0, _do_show_login)
        return
    _run_check_thread()


def _menu_open_dashboard(icon, item):
    webbrowser.open(DASHBOARD_URL)


def _menu_login(icon, item):
    _root.after(0, _do_show_login)


def _menu_logout(icon, item):
    supabase.logout()
    log.info("Déconnecté")
    if _check_timer:
        _check_timer.cancel()
    if _tray_icon:
        _tray_icon.update_menu()


def _do_show_settings():
    """Exécuté sur le thread principal (tkinter)."""
    from settings_dialog import show_settings_dialog

    def on_save(settings):
        global _check_interval_minutes
        new_interval = settings.get("check_interval", _check_interval_minutes)
        if new_interval != _check_interval_minutes:
            _check_interval_minutes = new_interval
            log.info("Intervalle mis à jour : %d min", _check_interval_minutes)
            _schedule_next()

    show_settings_dialog(_root, on_save=on_save)


def _menu_settings(icon, item):
    _root.after(0, _do_show_settings)


def _menu_startup(icon, item):
    import winreg
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    app_name = "ReadingTK"
    exe = sys.executable if getattr(sys, "frozen", False) else f'"{sys.executable}" "{os.path.abspath(__file__)}"'
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
        try:
            winreg.QueryValueEx(key, app_name)
            winreg.DeleteValue(key, app_name)
        except FileNotFoundError:
            winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe)
        winreg.CloseKey(key)
        if _tray_icon:
            _tray_icon.update_menu()
    except Exception as e:
        log.error("Erreur registre: %s", e)


def _is_startup_enabled() -> bool:
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, r"Software\Microsoft\Windows\CurrentVersion\Run")
        try:
            winreg.QueryValueEx(key, "ReadingTK")
            return True
        except FileNotFoundError:
            return False
        finally:
            winreg.CloseKey(key)
    except Exception:
        return False


def _menu_exit(icon, item):
    if _check_timer:
        _check_timer.cancel()
    icon.stop()
    # Arrêter la boucle tkinter depuis le thread principal
    _root.after(0, _root.quit)


def _build_menu() -> pystray.Menu:
    return pystray.Menu(
        pystray.MenuItem("Vérifier maintenant", _menu_check_now, default=True),
        pystray.MenuItem("Ouvrir le dashboard", _menu_open_dashboard),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "Connecté" if supabase.is_logged_in else "Se connecter…",
            _menu_logout if supabase.is_logged_in else _menu_login,
        ),
        pystray.MenuItem("Paramètres", _menu_settings),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "Démarrer avec Windows",
            _menu_startup,
            checked=lambda item: _is_startup_enabled(),
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quitter", _menu_exit),
    )


# ── Entrée principale ──────────────────────────────────────────────────────────

def main():
    global _tray_icon, _root

    log.info("ReadingTK Windows démarré")

    # tkinter sur le thread principal (obligatoire sur Windows / Python 3.14)
    _root = tk.Tk()
    _root.withdraw()

    # Connexion au démarrage si nécessaire
    if not supabase.is_logged_in:
        from auth_dialog import show_login_dialog
        show_login_dialog(_root)

    _load_settings()

    # Lancer pystray dans un thread séparé
    _tray_icon = pystray.Icon(
        name="ReadingTK",
        icon=_make_icon(),
        title="ReadingTK",
        menu=_build_menu(),
    )

    def run_tray():
        _tray_icon.run()

    tray_thread = threading.Thread(target=run_tray, daemon=True)
    tray_thread.start()

    # Premier check après 5 secondes (sauf si désactivé)
    if supabase.is_logged_in and _check_interval_minutes > 0:
        threading.Timer(5, _run_check_thread).start()
        _schedule_next()

    # Boucle principale tkinter (bloque jusqu'au quit)
    _root.mainloop()


if __name__ == "__main__":
    main()

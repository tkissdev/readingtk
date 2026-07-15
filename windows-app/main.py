"""
ReadingTK Windows — Application systray
Vérification périodique des nouveaux chapitres manga/manhwa/manhua.
"""
import logging
import os
import sys
import threading
import time
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

_check_interval_minutes: int = 30  # valeur par défaut
_check_timer: threading.Timer | None = None
_check_lock = threading.Lock()
_is_checking = False
_tray_icon: pystray.Icon | None = None


# ── Icône systray ──────────────────────────────────────────────────────────────

def _make_icon(color: str = "#6366f1") -> Image.Image:
    img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    draw.ellipse([4, 4, 60, 60], fill=color)
    # Lettre "R" au centre
    draw.text((18, 14), "R", fill="white")
    return img


def _make_icon_checking() -> Image.Image:
    return _make_icon("#f59e0b")  # orange pendant le check


def _make_icon_error() -> Image.Image:
    return _make_icon("#ef4444")  # rouge en cas d'erreur


# ── Check logique ──────────────────────────────────────────────────────────────

def _on_new_chapter(title_name: str, chap_label: str, chap_url: str):
    log.info("Nouveau chapitre : %s — %s", title_name, chap_label)
    notify(title_name, chap_label, chap_url)


def _do_check():
    global _is_checking
    with _check_lock:
        if _is_checking:
            return
        _is_checking = True

    if _tray_icon:
        _tray_icon.icon = _make_icon_checking()
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
            _tray_icon.icon = _make_icon_error()
            _tray_icon.title = "ReadingTK — Erreur lors du dernier check"
    finally:
        with _check_lock:
            _is_checking = False
        _schedule_next()


def _schedule_next():
    global _check_timer
    if _check_timer:
        _check_timer.cancel()
    interval_s = _check_interval_minutes * 60
    _check_timer = threading.Timer(interval_s, _run_check_thread)
    _check_timer.daemon = True
    _check_timer.start()
    log.info("Prochain check dans %d minutes", _check_interval_minutes)


def _run_check_thread():
    t = threading.Thread(target=_do_check, daemon=True)
    t.start()


def _load_settings():
    global _check_interval_minutes
    if not supabase.is_logged_in:
        return
    try:
        settings = supabase.sync_settings()
        if settings.get("check_interval"):
            _check_interval_minutes = int(settings["check_interval"])
            log.info("Intervalle de check : %d min", _check_interval_minutes)
    except Exception as e:
        log.warning("Impossible de charger les réglages: %s", e)


# ── Menu systray ───────────────────────────────────────────────────────────────

def _menu_check_now(icon, item):
    if not supabase.is_logged_in:
        _show_login()
        return
    _run_check_thread()


def _menu_open_dashboard(icon, item):
    webbrowser.open(DASHBOARD_URL)


def _show_login():
    import tkinter as tk
    from auth_dialog import show_login_dialog
    root = tk.Tk()
    root.withdraw()
    ok = show_login_dialog(root)
    root.destroy()
    if ok:
        log.info("Connexion réussie : %s", supabase.user_id)
        _load_settings()
        _schedule_next()
        _run_check_thread()
        if _tray_icon:
            _tray_icon.update_menu()


def _menu_login(icon, item):
    _show_login()


def _menu_logout(icon, item):
    supabase.logout()
    log.info("Déconnecté")
    if _tray_icon:
        _tray_icon.update_menu()
    if _check_timer:
        _check_timer.cancel()


def _menu_startup(icon, item):
    """Ajoute/retire l'app du démarrage automatique Windows."""
    import winreg
    key_path = r"Software\Microsoft\Windows\CurrentVersion\Run"
    app_name = "ReadingTK"
    exe_path = sys.executable if getattr(sys, "frozen", False) else f'"{sys.executable}" "{os.path.abspath(__file__)}"'
    try:
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER, key_path, 0, winreg.KEY_ALL_ACCESS)
        try:
            winreg.QueryValueEx(key, app_name)
            # Existe → supprimer
            winreg.DeleteValue(key, app_name)
            log.info("Démarrage automatique désactivé")
        except FileNotFoundError:
            # N'existe pas → ajouter
            winreg.SetValueEx(key, app_name, 0, winreg.REG_SZ, exe_path)
            log.info("Démarrage automatique activé")
        winreg.CloseKey(key)
        if _tray_icon:
            _tray_icon.update_menu()
    except Exception as e:
        log.error("Erreur registre Windows: %s", e)


def _is_startup_enabled() -> bool:
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_CURRENT_USER,
                             r"Software\Microsoft\Windows\CurrentVersion\Run")
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


def _build_menu() -> pystray.Menu:
    return pystray.Menu(
        pystray.MenuItem(
            "Vérifier maintenant",
            _menu_check_now,
            default=True,
        ),
        pystray.MenuItem(
            "Ouvrir le dashboard",
            _menu_open_dashboard,
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            "Connecté" if supabase.is_logged_in else "Se connecter…",
            _menu_logout if supabase.is_logged_in else _menu_login,
        ),
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
    global _tray_icon

    log.info("ReadingTK Windows démarré")

    # Connexion au démarrage si pas encore connecté
    if not supabase.is_logged_in:
        import tkinter as tk
        from auth_dialog import show_login_dialog
        root = tk.Tk()
        root.withdraw()
        ok = show_login_dialog(root)
        root.destroy()
        if not ok:
            log.warning("Connexion annulée — l'app tourne sans compte")
    else:
        log.info("Session existante : %s", supabase.user_id)

    _load_settings()

    _tray_icon = pystray.Icon(
        name="ReadingTK",
        icon=_make_icon(),
        title="ReadingTK",
        menu=_build_menu(),
    )

    # Lancer un premier check après 5 secondes puis tous les N minutes
    if supabase.is_logged_in:
        startup_timer = threading.Timer(5, _run_check_thread)
        startup_timer.daemon = True
        startup_timer.start()
        _schedule_next()

    _tray_icon.run()


if __name__ == "__main__":
    main()

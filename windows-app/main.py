"""
ReadingTK Windows — Application systray
Vérification périodique des nouveaux chapitres manga/manhwa/manhua.
"""
import logging
import os
import subprocess
import sys
import threading
import time

# Build --noconsole (pas de fenêtre de terminal) : sys.stdin/stdout/stderr valent None.
# Sans ça, Node.js (utilisé en interne par patchright pour piloter Chromium) échoue à
# lancer le navigateur avec une erreur "spawn UNKNOWN" faute de canaux valides à hériter.
if sys.stdin is None:
    sys.stdin = open(os.devnull, "r")
if sys.stdout is None:
    sys.stdout = open(os.devnull, "w")
if sys.stderr is None:
    sys.stderr = open(os.devnull, "w")
import tkinter as tk
import webbrowser

import pystray
from PIL import Image, ImageDraw

from supabase_client import supabase, DASHBOARD_URL
from notifier import notify, notify_simple
import server as local_server

log = logging.getLogger("rtk")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(os.path.join(os.path.dirname(__file__), "readingtk.log"), encoding="utf-8"),
    ],
)

# Dossier persistant pour le navigateur Chromium (patchright) — sans ça, l'exécutable
# packagé (--onefile) l'installerait dans un dossier temporaire supprimé à chaque fermeture,
# forçant un nouveau téléchargement de ~150-300 Mo à chaque lancement.
_BROWSERS_DIR = os.path.join(os.getenv("LOCALAPPDATA", os.path.expanduser("~")), "ReadingTK", "browsers")
os.makedirs(_BROWSERS_DIR, exist_ok=True)
os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", _BROWSERS_DIR)


def _ensure_browser_installed():
    """Télécharge Chromium pour patchright si absent (une seule fois, en arrière-plan)."""
    try:
        if any(name.startswith("chromium") for name in os.listdir(_BROWSERS_DIR)):
            return  # déjà installé
        log.info("Téléchargement du navigateur pour un meilleur support des sites JS...")
        from patchright._impl._driver import compute_driver_executable, get_driver_env
        driver_executable, driver_cli = compute_driver_executable()
        subprocess.run(
            [driver_executable, driver_cli, "install", "chromium"],
            env=get_driver_env(), check=True,
            creationflags=subprocess.CREATE_NO_WINDOW,
        )
        log.info("Navigateur installé avec succès.")
        notify_simple("ReadingTK", "Navigateur téléchargé — davantage de sites sont maintenant supportés.")
    except Exception as e:
        log.warning("Installation automatique du navigateur échouée : %s", e)

# ── État global ────────────────────────────────────────────────────────────────

_check_interval_minutes: int = 30
_check_timer: threading.Timer | None = None
_check_lock = threading.Lock()
_is_checking = False
_stop_event = threading.Event()
_tray_icon: pystray.Icon | None = None
_root: tk.Tk | None = None  # tkinter tourne sur le thread principal
_last_check_report: dict | None = None  # {"time": str, "detected": int, "errors": int, "error_details": list}


# ── Icône systray ──────────────────────────────────────────────────────────────

def _make_icon(color: str = "#6366f1") -> Image.Image:
    """Charge le favicon RTK et colorise le fond avec la couleur d'état."""
    r, g, b = int(color[1:3], 16), int(color[3:5], 16), int(color[5:7], 16)

    icon_path = os.path.join(os.path.dirname(__file__), "icon.png")
    try:
        base = Image.open(icon_path).convert("RGBA").resize((64, 64), Image.LANCZOS)

        # Luminance : pixels clairs = fond, pixels sombres = texte RTK
        gray = base.convert("L")
        mask = gray.point(lambda lum: 255 if lum > 150 else 0)

        # Fond → couleur d'état, texte → blanc
        bg = Image.new("RGBA", base.size, (r, g, b, 255))
        fg = Image.new("RGBA", base.size, (255, 255, 255, 255))
        colorized = Image.composite(bg, fg, mask)

        # Remettre l'alpha original (forme arrondie de l'icône)
        colorized.putalpha(base.split()[3])
        return colorized
    except Exception:
        # Fallback : cercle coloré
        img = Image.new("RGBA", (64, 64), (0, 0, 0, 0))
        ImageDraw.Draw(img).ellipse([4, 4, 60, 60], fill=color)
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
    global _is_checking, _last_check_report
    with _check_lock:
        if _is_checking:
            return
        _is_checking = True
        _stop_event.clear()

    if _tray_icon:
        _tray_icon.icon = _make_icon("#f59e0b")
        _tray_icon.title = "ReadingTK — Vérification en cours…"
        _tray_icon.update_menu()

    def _on_progress(current: int, total: int, title_name: str):
        if _tray_icon:
            short = title_name[:30] + "…" if len(title_name) > 30 else title_name
            _tray_icon.title = f"ReadingTK — {current}/{total} · {short}"

    try:
        from checker import run_check
        result = run_check(on_new_chapter=_on_new_chapter, on_progress=_on_progress,
                           stop_event=_stop_event)
        stopped = _stop_event.is_set()
        log.info("Check %s : %d détecté(s), %d erreur(s)",
                 "arrêté" if stopped else "OK", result["detected"], result["errors"])
        _last_check_report = {
            "time": time.strftime("%H:%M"),
            "detected": result["detected"],
            "errors": result["errors"],
            "error_details": result.get("error_details", []),
        }
        if _tray_icon:
            _tray_icon.icon = _make_icon()
            if stopped:
                _tray_icon.title = "ReadingTK — Vérification arrêtée"
            else:
                parts = [f"Dernier check : {time.strftime('%H:%M')}"]
                if result["detected"]:
                    parts.append(f"{result['detected']} nouveau(x)")
                if result["errors"]:
                    parts.append(f"{result['errors']} erreur(s)")
                if _check_interval_minutes > 0:
                    next_at = time.strftime("%H:%M", time.localtime(time.time() + _check_interval_minutes * 60))
                    parts.append(f"prochain scan à {next_at}")
                _tray_icon.title = "ReadingTK — " + " · ".join(parts)
    except Exception as e:
        log.error("Erreur check : %s", e)
        if _tray_icon:
            _tray_icon.icon = _make_icon("#ef4444")
            if not supabase.is_logged_in:
                _tray_icon.title = "ReadingTK — Session expirée, reconnectez-vous"
            elif _check_interval_minutes > 0:
                next_at = time.strftime("%H:%M", time.localtime(time.time() + _check_interval_minutes * 60))
                _tray_icon.title = f"ReadingTK — Erreur lors du dernier check · prochain scan à {next_at}"
            else:
                _tray_icon.title = "ReadingTK — Erreur lors du dernier check"
    finally:
        with _check_lock:
            _is_checking = False
        if _tray_icon:
            _tray_icon.update_menu()
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
            _tray_icon.icon = _make_icon()
            _tray_icon.title = "ReadingTK"
            _tray_icon.update_menu()


# ── Callbacks menu systray ─────────────────────────────────────────────────────
# Les callbacks pystray tournent dans le thread Win32 du systray.
# Pour tout ce qui touche tkinter, on délègue au thread principal via root.after.

def _do_show_report():
    """Affiche le rapport du dernier check (erreurs détaillées)."""
    report = _last_check_report
    if not report:
        return

    win = tk.Toplevel(_root)
    win.title("ReadingTK — Rapport du dernier check")
    win.resizable(False, False)
    win.attributes("-topmost", True)

    w, h = 480, 340
    win.update_idletasks()
    x = (win.winfo_screenwidth() - w) // 2
    y = (win.winfo_screenheight() - h) // 2
    win.geometry(f"{w}x{h}+{x}+{y}")

    frame = tk.Frame(win, padx=24, pady=18)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="Rapport du dernier check", font=("Segoe UI", 13, "bold"), fg="#6366f1").pack(anchor="w")
    tk.Frame(frame, height=1, bg="#e5e7eb").pack(fill="x", pady=(6, 12))

    summary = f"Check à {report['time']}  ·  {report['detected']} nouveau(x)  ·  {report['errors']} erreur(s)"
    tk.Label(frame, text=summary, font=("Segoe UI", 10), fg="#555").pack(anchor="w", pady=(0, 10))

    details = report.get("error_details", [])
    if not details:
        tk.Label(frame, text="Aucune erreur détaillée disponible.", font=("Segoe UI", 10), fg="#888").pack(anchor="w")
    else:
        tk.Label(frame, text="Erreurs :", font=("Segoe UI", 10, "bold")).pack(anchor="w", pady=(0, 4))
        box_frame = tk.Frame(frame, relief="sunken", bd=1, bg="white")
        box_frame.pack(fill="both", expand=True)

        scrollbar = tk.Scrollbar(box_frame)
        scrollbar.pack(side="right", fill="y")

        listbox = tk.Listbox(
            box_frame,
            font=("Segoe UI", 9),
            yscrollcommand=scrollbar.set,
            selectbackground="#e0e7ff",
            activestyle="none",
            bd=0,
            highlightthickness=0,
        )
        listbox.pack(fill="both", expand=True, padx=4, pady=4)
        scrollbar.config(command=listbox.yview)

        for d in details:
            title_str = d.get("title", "?")[:35]
            reason = d.get("reason", "?")
            url = d.get("url", "")
            domain = url.split("/")[2] if url.count("/") >= 2 else url
            listbox.insert("end", f"  {title_str}  —  {domain}")
            listbox.insert("end", f"      ↳ {reason}")
            listbox.insert("end", "")

    tk.Button(
        frame, text="Fermer",
        command=win.destroy,
        font=("Segoe UI", 10),
        relief="flat", cursor="hand2",
        bg="#e5e7eb", padx=16, pady=5,
    ).pack(pady=(10, 0))

    _root.wait_window(win)


def _menu_show_report(icon, item):
    _root.after(0, _do_show_report)


def _menu_check_now(icon, item):
    if _is_checking:
        _stop_event.set()
        log.info("Arrêt de la vérification demandé")
        return
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
        _tray_icon.icon = _make_icon("#ef4444")
        _tray_icon.title = "ReadingTK — Déconnecté"
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
        pystray.MenuItem(
            lambda item: "Stopper la vérification" if _is_checking else "Vérifier maintenant",
            _menu_check_now,
            default=True,
        ),
        pystray.MenuItem("Ouvrir le dashboard", _menu_open_dashboard),
        pystray.MenuItem(
            lambda item: f"Rapport du dernier check ({_last_check_report['errors']} erreur(s))"
                         if _last_check_report and _last_check_report.get("errors") else "Rapport du dernier check",
            _menu_show_report,
            visible=lambda item: _last_check_report is not None,
        ),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem(
            lambda item: "Connecté" if supabase.is_logged_in else "Se reconnecter",
            lambda icon, item: _menu_logout(icon, item) if supabase.is_logged_in else _menu_login(icon, item),
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

    # Téléchargement du navigateur (Chromium) en arrière-plan si absent — ne bloque pas le démarrage
    threading.Thread(target=_ensure_browser_installed, daemon=True).start()

    # tkinter sur le thread principal (obligatoire sur Windows / Python 3.14)
    _root = tk.Tk()
    _root.withdraw()

    # Connexion au démarrage si nécessaire
    if not supabase.is_logged_in:
        from auth_dialog import show_login_dialog
        show_login_dialog(_root)

    _load_settings()

    # Serveur HTTP local (dashboard → app Windows)
    def _local_check(title_id: str | None, auto_discover: bool) -> dict:
        from checker import run_check
        return run_check(
            on_new_chapter=_on_new_chapter,
            title_id=title_id,
            auto_discover_override=auto_discover if title_id else None,
        )

    def _local_check_site(site_id: str | None, url: str | None, needs_tab: bool) -> dict:
        from scraper import fetch_for_site
        if not site_id or not url:
            return {"ok": False, "reason": "Paramètres manquants"}
        result = fetch_for_site(url, needs_tab=needs_tab)
        if result.get("is404"):
            supabase.patch(f"/sites?id=eq.{site_id}", {"is_down": True})
            return {"ok": False, "reason": "404"}
        supabase.patch(f"/sites?id=eq.{site_id}", {"is_down": False, "enabled": True})
        return {"ok": True}

    local_server.start(check_callback=_local_check, check_site_callback=_local_check_site)

    # Lancer pystray dans un thread séparé
    _initial_icon = _make_icon() if supabase.is_logged_in else _make_icon("#ef4444")
    _initial_title = "ReadingTK" if supabase.is_logged_in else "ReadingTK — Déconnecté"
    _tray_icon = pystray.Icon(
        name="ReadingTK",
        icon=_initial_icon,
        title=_initial_title,
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

"""Fenêtre de paramètres de l'application Windows."""
import tkinter as tk
from tkinter import ttk


_INTERVALS = [
    (15,  "15 minutes"),
    (30,  "30 minutes"),
    (60,  "1 heure"),
    (120, "2 heures"),
    (240, "4 heures"),
    (360, "6 heures"),
    (720, "12 heures"),
    (1440,"24 heures"),
]


def show_settings_dialog(parent=None, on_save=None):
    """
    Affiche la fenêtre de paramètres.
    on_save(settings_dict) est appelé si l'utilisateur sauvegarde.
    """
    from supabase_client import supabase

    current = supabase.sync_settings()

    win = tk.Toplevel(parent) if parent else tk.Tk()
    win.title("ReadingTK — Paramètres")
    win.resizable(False, False)
    win.attributes("-topmost", True)

    w, h = 400, 300
    win.update_idletasks()
    x = (win.winfo_screenwidth() - w) // 2
    y = (win.winfo_screenheight() - h) // 2
    win.geometry(f"{w}x{h}+{x}+{y}")

    frame = tk.Frame(win, padx=28, pady=22)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="Paramètres", font=("Segoe UI", 14, "bold"), fg="#6366f1").pack(anchor="w")
    tk.Frame(frame, height=1, bg="#e5e7eb").pack(fill="x", pady=(6, 18))

    # ── Intervalle ──────────────────────────────────────────────────
    interval_frame = tk.Frame(frame)
    interval_frame.pack(fill="x", pady=(0, 12))

    tk.Label(interval_frame, text="Vérification automatique toutes les", font=("Segoe UI", 10)).pack(side="left")

    current_interval = current.get("check_interval", 60)
    interval_values = [label for _, label in _INTERVALS]
    interval_minutes = [m for m, _ in _INTERVALS]

    # Trouver l'index correspondant (sinon 1h par défaut)
    try:
        idx = interval_minutes.index(int(current_interval))
    except ValueError:
        idx = 2  # 1 heure

    interval_var = tk.StringVar(value=interval_values[idx])
    interval_cb = ttk.Combobox(
        interval_frame,
        textvariable=interval_var,
        values=interval_values,
        state="readonly",
        width=13,
        font=("Segoe UI", 10),
    )
    interval_cb.pack(side="left", padx=(8, 0))

    # ── Notifications Windows ────────────────────────────────────────
    notif_var = tk.BooleanVar(value=bool(current.get("browser_notifications", True)))
    notif_frame = tk.Frame(frame)
    notif_frame.pack(fill="x", pady=(0, 12))
    tk.Checkbutton(
        notif_frame,
        text="Activer les notifications Windows",
        variable=notif_var,
        font=("Segoe UI", 10),
        activebackground=win.cget("bg"),
        cursor="hand2",
    ).pack(anchor="w")

    # ── Auto-découverte ──────────────────────────────────────────────
    discover_var = tk.BooleanVar(value=bool(current.get("auto_discover", False)))
    discover_frame = tk.Frame(frame)
    discover_frame.pack(fill="x", pady=(0, 0))
    tk.Checkbutton(
        discover_frame,
        text="Activer l'auto-découverte de sources",
        variable=discover_var,
        font=("Segoe UI", 10),
        activebackground=win.cget("bg"),
        cursor="hand2",
    ).pack(anchor="w")
    tk.Label(
        discover_frame,
        text="Recherche automatiquement de nouveaux sites pour chaque titre",
        font=("Segoe UI", 8),
        fg="#888",
    ).pack(anchor="w", padx=(24, 0))

    # ── Statut ───────────────────────────────────────────────────────
    status_var = tk.StringVar(value="")
    tk.Label(frame, textvariable=status_var, font=("Segoe UI", 9), fg="green").pack(pady=(12, 0))

    # ── Boutons ──────────────────────────────────────────────────────
    btn_frame = tk.Frame(frame)
    btn_frame.pack(pady=(6, 0))

    def save():
        label = interval_var.get()
        minutes = next((m for m, l in _INTERVALS if l == label), 60)
        settings = {
            "check_interval": minutes,
            "browser_notifications": notif_var.get(),
            "auto_discover": discover_var.get(),
        }
        try:
            supabase.save_settings(settings)
            status_var.set("Sauvegardé !")
            win.after(800, win.destroy)
            if on_save:
                on_save(settings)
        except Exception as e:
            status_var.configure(fg="red")
            status_var.set(f"Erreur : {e}")

    tk.Button(
        btn_frame, text="Sauvegarder",
        command=save,
        font=("Segoe UI", 11),
        bg="#6366f1", fg="white",
        activebackground="#4f46e5", activeforeground="white",
        relief="flat", cursor="hand2",
        padx=20, pady=6,
    ).pack(side="left", padx=4)

    tk.Button(
        btn_frame, text="Annuler",
        command=win.destroy,
        font=("Segoe UI", 11),
        relief="flat", cursor="hand2",
        padx=16, pady=6,
    ).pack(side="left", padx=4)

    if parent:
        parent.wait_window(win)
    else:
        win.mainloop()

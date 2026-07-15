"""Fenêtre de connexion — ouvre readingtk.net/desktop-auth dans le vrai navigateur."""
import queue
import tkinter as tk


def show_login_dialog(parent=None) -> bool:
    """
    Affiche une fenêtre d'attente pendant que l'utilisateur se connecte
    dans le navigateur. Retourne True si la connexion a réussi.
    """
    from browser_auth import login_via_browser

    result = {"ok": False}
    msg_queue: queue.Queue = queue.Queue()

    win = tk.Toplevel(parent) if parent else tk.Tk()
    win.title("ReadingTK — Connexion")
    win.resizable(False, False)
    win.attributes("-topmost", True)

    w, h = 380, 220
    win.update_idletasks()
    x = (win.winfo_screenwidth() - w) // 2
    y = (win.winfo_screenheight() - h) // 2
    win.geometry(f"{w}x{h}+{x}+{y}")

    frame = tk.Frame(win, padx=28, pady=22)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="ReadingTK", font=("Segoe UI", 15, "bold"), fg="#6366f1").pack()
    tk.Label(frame, text="Connexion via votre navigateur", font=("Segoe UI", 9), fg="#666").pack(pady=(2, 18))

    status_var = tk.StringVar(value="")
    status_label = tk.Label(frame, textvariable=status_var, font=("Segoe UI", 9), fg="#666", wraplength=320)
    status_label.pack(pady=(0, 12))

    btn_frame = tk.Frame(frame)
    btn_frame.pack()

    def _poll():
        """Vérifie la queue toutes les 200ms depuis le thread principal."""
        try:
            msg = msg_queue.get_nowait()
            if msg["type"] == "success":
                result["ok"] = True
                win.destroy()
            else:
                status_var.set(f"Erreur : {msg['error']}")
                status_label.config(fg="red")
                open_btn.config(state="normal", text="Réessayer")
        except queue.Empty:
            if win.winfo_exists():
                win.after(200, _poll)

    def on_success():
        msg_queue.put({"type": "success"})

    def on_error(msg):
        msg_queue.put({"type": "error", "error": msg})

    def open_browser():
        open_btn.config(state="disabled", text="En attente…")
        status_var.set("Un formulaire s'est ouvert dans votre navigateur.\nConnectez-vous, puis revenez ici.")
        status_label.config(fg="#555")
        login_via_browser(on_success=on_success, on_error=on_error)
        win.after(200, _poll)

    open_btn = tk.Button(
        btn_frame, text="Se connecter",
        command=open_browser,
        font=("Segoe UI", 11),
        bg="#6366f1", fg="white",
        activebackground="#4f46e5", activeforeground="white",
        relief="flat", cursor="hand2",
        padx=20, pady=6,
    )
    open_btn.pack(side="left", padx=4)

    cancel_btn = tk.Button(
        btn_frame, text="Annuler",
        command=win.destroy,
        font=("Segoe UI", 11),
        relief="flat", cursor="hand2",
        padx=16, pady=6,
    )
    cancel_btn.pack(side="left", padx=4)

    # Démarrer automatiquement
    win.after(200, open_browser)

    if parent:
        parent.wait_window(win)
    else:
        win.mainloop()

    return result["ok"]

"""Fenêtre de connexion Supabase (tkinter)."""
import tkinter as tk
from tkinter import messagebox
from supabase_client import supabase


def show_login_dialog(parent=None) -> bool:
    """
    Affiche la fenêtre de connexion.
    Retourne True si l'utilisateur s'est connecté avec succès.
    """
    result = {"ok": False}

    win = tk.Toplevel(parent) if parent else tk.Tk()
    win.title("ReadingTK — Connexion")
    win.resizable(False, False)
    win.attributes("-topmost", True)

    # Centrer la fenêtre
    win.update_idletasks()
    w, h = 340, 240
    x = (win.winfo_screenwidth() - w) // 2
    y = (win.winfo_screenheight() - h) // 2
    win.geometry(f"{w}x{h}+{x}+{y}")

    frame = tk.Frame(win, padx=24, pady=20)
    frame.pack(fill="both", expand=True)

    tk.Label(frame, text="ReadingTK", font=("Segoe UI", 14, "bold")).pack(pady=(0, 4))
    tk.Label(frame, text="Connectez-vous à votre compte", font=("Segoe UI", 9), fg="#666").pack(pady=(0, 16))

    tk.Label(frame, text="Email", font=("Segoe UI", 9), anchor="w").pack(fill="x")
    email_var = tk.StringVar()
    email_entry = tk.Entry(frame, textvariable=email_var, font=("Segoe UI", 10))
    email_entry.pack(fill="x", pady=(2, 8))

    tk.Label(frame, text="Mot de passe", font=("Segoe UI", 9), anchor="w").pack(fill="x")
    pwd_var = tk.StringVar()
    pwd_entry = tk.Entry(frame, textvariable=pwd_var, show="•", font=("Segoe UI", 10))
    pwd_entry.pack(fill="x", pady=(2, 16))

    err_label = tk.Label(frame, text="", font=("Segoe UI", 8), fg="red")
    err_label.pack()

    def do_login(event=None):
        email = email_var.get().strip()
        pwd = pwd_var.get()
        if not email or not pwd:
            err_label.config(text="Email et mot de passe requis.")
            return
        btn.config(state="disabled", text="Connexion…")
        win.update()
        try:
            supabase.login(email, pwd)
            result["ok"] = True
            win.destroy()
        except Exception as e:
            err_label.config(text=str(e))
            btn.config(state="normal", text="Se connecter")

    btn = tk.Button(frame, text="Se connecter", command=do_login,
                    font=("Segoe UI", 10), bg="#6366f1", fg="white",
                    activebackground="#4f46e5", activeforeground="white",
                    relief="flat", cursor="hand2")
    btn.pack(fill="x")

    email_entry.focus()
    pwd_entry.bind("<Return>", do_login)
    email_entry.bind("<Return>", lambda e: pwd_entry.focus())

    if parent:
        parent.wait_window(win)
    else:
        win.mainloop()

    return result["ok"]

import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({ port: z.coerce.number().optional().default(17832) });

export const Route = createFileRoute("/desktop-auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Connexion app Windows · ReadingTK" }] }),
  component: DesktopAuthPage,
});

const TURNSTILE_SITE_KEY = "0x4AAAAAADkziG-qWDY0deWY";

function DesktopAuthPage() {
  const { port } = Route.useSearch();
  const callbackUrl = `http://localhost:${port}/session`;

  const [phase, setPhase] = useState<"checking" | "connected" | "login" | "sending" | "done" | "error">("checking");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const turnstileRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);

  // Vérifier si déjà connecté
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setPhase("connected");
      } else {
        setPhase("login");
      }
    });
  }, []);

  // Widget Turnstile
  useEffect(() => {
    if (phase !== "login") return;
    const loadWidget = () => {
      const w = (window as any).turnstile;
      if (!w || !turnstileRef.current) { setTimeout(loadWidget, 200); return; }
      if (widgetIdRef.current) { try { w.remove(widgetIdRef.current); } catch {} }
      widgetIdRef.current = w.render(turnstileRef.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => setCaptchaToken(null),
        "error-callback": () => setCaptchaToken(null),
        theme: "dark",
      });
    };

    if (!(window as any).turnstile) {
      if (!document.getElementById("cf-turnstile-script")) {
        const s = document.createElement("script");
        s.id = "cf-turnstile-script";
        s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
        s.async = true;
        document.head.appendChild(s);
      }
    }
    loadWidget();

    return () => {
      if (widgetIdRef.current && (window as any).turnstile) {
        try { (window as any).turnstile.remove(widgetIdRef.current); } catch {}
        widgetIdRef.current = null;
      }
    };
  }, [phase]);

  async function sendSession(session: object) {
    setPhase("sending");
    try {
      await fetch(callbackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(session),
      });
      setPhase("done");
    } catch {
      setErrorMsg("Impossible de contacter l'application Windows. Assurez-vous qu'elle est lancée.");
      setPhase("error");
    }
  }

  async function connectExisting() {
    const { data } = await supabase.auth.getSession();
    if (data.session) await sendSession(data.session);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!captchaToken) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email, password,
        options: { captchaToken },
      });
      if (error) throw error;
      if (data.session) await sendSession(data.session);
    } catch (err) {
      setErrorMsg((err as Error).message || "Identifiants incorrects");
      const w = (window as any).turnstile;
      if (w && widgetIdRef.current) { w.reset(widgetIdRef.current); setCaptchaToken(null); }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card/80 p-8 backdrop-blur text-center" style={{ boxShadow: "var(--shadow-card)" }}>
        <div className="mb-6 flex justify-center">
          <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 140, height: "auto", mixBlendMode: "lighten" }} />
        </div>

        {phase === "checking" && (
          <p className="text-muted-foreground">Vérification…</p>
        )}

        {phase === "connected" && (
          <>
            <h1 className="text-xl font-semibold mb-2">Connecter l'application Windows</h1>
            <p className="text-sm text-muted-foreground mb-6">Vous êtes déjà connecté. Cliquez pour autoriser l'application Windows à accéder à votre compte.</p>
            <button
              onClick={connectExisting}
              className="w-full rounded-md py-2.5 text-sm font-semibold text-primary-foreground"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              Connecter
            </button>
          </>
        )}

        {phase === "login" && (
          <>
            <h1 className="text-xl font-semibold mb-1">Connexion — Application Windows</h1>
            <p className="text-sm text-muted-foreground mb-6">Connectez-vous pour lier votre compte à l'application.</p>
            <form onSubmit={handleLogin} className="space-y-4 text-left">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Mot de passe</label>
                <input
                  type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
                />
              </div>
              <div ref={turnstileRef} className="flex justify-center" />
              {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
              <button
                type="submit"
                disabled={loading || !captchaToken}
                className="w-full rounded-md py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
                style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
              >
                {loading ? "Connexion…" : "Se connecter"}
              </button>
            </form>
          </>
        )}

        {phase === "sending" && (
          <p className="text-muted-foreground">Envoi de la session à l'application…</p>
        )}

        {phase === "done" && (
          <>
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-xl font-semibold mb-2">Connecté !</h1>
            <p className="text-sm text-muted-foreground">Vous pouvez fermer cet onglet et revenir à l'application Windows.</p>
          </>
        )}

        {phase === "error" && (
          <>
            <div className="text-4xl mb-4">✗</div>
            <p className="text-sm text-destructive mb-4">{errorMsg}</p>
            <button onClick={() => setPhase("connected")} className="text-sm text-accent hover:underline">Réessayer</button>
          </>
        )}
      </div>
    </div>
  );
}

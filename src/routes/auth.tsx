import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BookOpen } from "lucide-react";
import { toast } from "sonner";

const searchSchema = z.object({ mode: z.enum(["login", "signup"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Connexion · ReadingTK" }] }),
  component: AuthPage,
});

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const DiscordIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.04.03.052a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 13.998 13.998 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
  </svg>
)

const TwitchIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z"/>
  </svg>
)

type OAuthProvider = "google" | "discord" | "twitch";

const OAUTH_PROVIDERS: { id: OAuthProvider; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "google",  label: "Google",  icon: <GoogleIcon />,  color: "hover:border-[#4285F4]/50 hover:bg-[#4285F4]/10" },
  { id: "discord", label: "Discord", icon: <DiscordIcon />, color: "hover:border-[#5865F2]/50 hover:bg-[#5865F2]/10" },
  { id: "twitch",  label: "Twitch",  icon: <TwitchIcon />,  color: "hover:border-[#9146FF]/50 hover:bg-[#9146FF]/10" },
];

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);

  async function handleOAuth(provider: OAuthProvider) {
    setOauthLoading(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
        scopes: provider === "discord" ? "identify email" : undefined,
      },
    });
    if (error) {
      toast.error(error.message || "Erreur de connexion");
      setOauthLoading(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignup) {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/dashboard` },
        });
        if (error) throw error;
        toast.success("Compte créé !");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Connecté");
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      const e = err as Error;
      toast.error(e.message || "Erreur d'authentification");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4" style={{ backgroundImage: "var(--gradient-hero)" }}>
      <div className="w-full max-w-md">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md text-white" style={{ background: "var(--gradient-primary)" }}>
            <BookOpen className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">ReadingTK</span>
        </Link>
        <div className="rounded-2xl border border-border/60 bg-card/80 p-8 backdrop-blur" style={{ boxShadow: "var(--shadow-card)" }}>
          <h1 className="text-2xl font-semibold">{isSignup ? "Créer un compte" : "Connexion"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isSignup ? "Commencez à suivre vos lectures." : "Heureux de vous revoir."}
          </p>

          {/* Boutons OAuth */}
          <div className="mt-6 flex flex-col gap-3">
            {OAUTH_PROVIDERS.map(({ id, label, icon, color }) => (
              <button
                key={id}
                onClick={() => handleOAuth(id)}
                disabled={oauthLoading !== null || loading}
                className={`flex w-full items-center justify-center gap-3 rounded-md border border-border bg-card/50 px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${color}`}
              >
                {oauthLoading === id ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                ) : icon}
                Continuer avec {label}
              </button>
            ))}
          </div>

          {/* Séparateur */}
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
              />
            </div>
            <button
              type="submit" disabled={loading || oauthLoading !== null}
              className="w-full rounded-md py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {loading ? "..." : isSignup ? "Créer le compte" : "Se connecter"}
            </button>
          </form>
          <div className="mt-6 text-center text-sm text-muted-foreground">
            {isSignup ? "Déjà un compte ?" : "Pas encore de compte ?"}{" "}
            <button onClick={() => setIsSignup(!isSignup)} className="font-medium text-accent hover:underline">
              {isSignup ? "Se connecter" : "Créer un compte"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

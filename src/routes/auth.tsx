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

function AuthPage() {
  const { mode } = Route.useSearch();
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(mode === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
              type="submit" disabled={loading}
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

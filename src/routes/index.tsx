import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Bell, Database, Globe, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ReadingTK — Votre bibliothèque de lecture, enfin intelligente" },
      { name: "description", content: "Suivez vos mangas, manhuas et novels. Centralisez vos sources et soyez notifié à chaque nouveau chapitre." },
      { property: "og:title", content: "ReadingTK" },
      { property: "og:description", content: "Votre bibliothèque de lecture, enfin intelligente." },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md font-bold text-white" style={{ background: "var(--gradient-primary)" }}>
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-lg font-bold tracking-tight">ReadingTK</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">tracker</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2">
          <Link to="/auth" className="rounded-md px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Connexion</Link>
          <Link to="/auth" search={{ mode: "signup" }} className="rounded-md px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90" style={{ background: "var(--gradient-primary)" }}>
            Créer un compte
          </Link>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }} />
        <div className="relative mx-auto max-w-5xl px-6 py-24 text-center">
          <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
            <Sparkles className="h-3 w-3 text-accent" /> Détection auto · Multi-sources · Self-hosted ready
          </div>
          <h1 className="text-5xl font-bold leading-tight md:text-7xl">
            Votre bibliothèque,
            <br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.70 0.20 268), oklch(0.85 0.15 250))" }}>
              enfin intelligente
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-base text-muted-foreground md:text-lg">
            Suivez la progression de vos mangas, manhuas et novels. Centralisez vos liens de lecture
            et soyez notifié dès qu'un nouveau chapitre sort.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-md px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90" style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}>
              Commencer maintenant
            </Link>
            <Link to="/auth" className="rounded-md border border-border bg-card/50 px-6 py-3 text-sm font-semibold hover:bg-card">
              Se connecter
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pb-24">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: BookOpen, title: "Suivi par titre", desc: "Dernier chapitre lu, statut, notes — tout au même endroit." },
            { icon: Globe, title: "Multi-sources", desc: "Une priorité par site, ajoutez vos liens de lecture préférés." },
            { icon: Zap, title: "Check à la demande", desc: "Détection heuristique des nouveaux chapitres en un clic." },
            { icon: Bell, title: "Notifications", desc: "Un badge dès qu'un nouveau chapitre apparaît." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border/60 bg-card/60 p-5 backdrop-blur" style={{ boxShadow: "var(--shadow-card)" }}>
              <Icon className="h-5 w-5 text-accent" />
              <h3 className="mt-3 text-sm font-semibold">{title}</h3>
              <p className="mt-1 text-xs text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        ReadingTK v0.1 · Self-hosted ready · <Database className="inline h-3 w-3" /> Supabase backend
      </footer>
    </div>
  );
}

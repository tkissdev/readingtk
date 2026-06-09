import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BookOpen, Database, Globe, Sparkles, Zap } from "lucide-react";

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

const FEATURES = [
  { icon: BookOpen, title: "Suivi par titre",     desc: "Dernier chapitre lu, statut, notes — tout au même endroit." },
  { icon: Globe,    title: "Multi-sources",        desc: "Une priorité par site, ajoutez vos liens de lecture préférés." },
  { icon: Zap,      title: "Check à la demande",  desc: "Détection heuristique des nouveaux chapitres en un clic." },
  { icon: Bell,     title: "Notifications",        desc: "Un badge dès qu'un nouveau chapitre apparaît." },
];

function Landing() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-10 py-4">
        <Link to="/">
          <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 140, height: "auto", mixBlendMode: "lighten", clipPath: "inset(3px 3px 3px 3px)" }} />
        </Link>
        <nav className="flex items-center gap-3">
          <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            Connexion
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-md px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            Créer un compte
          </Link>
        </nav>
      </header>

      {/* Main */}
      <main className="flex flex-1 flex-col items-center gap-20 px-10 py-20">

        {/* Hero */}
        <section className="relative max-w-2xl text-center">
          <div
            className="pointer-events-none absolute left-1/2 top-[-80px] h-[300px] w-[500px] -translate-x-1/2"
            style={{ background: "radial-gradient(ellipse at center, oklch(0.55 0.18 268 / 0.25) 0%, transparent 70%)" }}
          />
          <h1 className="mb-5 text-5xl font-extrabold leading-tight">
            Votre bibliothèque,<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.70 0.20 268), oklch(0.85 0.15 250))" }}>
              enfin intelligente
            </span>
          </h1>
          <p className="mb-9 text-lg leading-relaxed text-muted-foreground">
            Suivez la progression de vos mangas, manhuas et novels.<br />
            Centralisez vos liens de lecture et soyez notifié dès qu'un nouveau chapitre sort.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              Commencer maintenant
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border bg-card/60 px-7 py-3 text-sm font-medium transition hover:bg-card"
            >
              Se connecter
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid w-full max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-accent/60"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Icon className="h-6 w-6 text-accent" />
              <h3 className="text-sm font-semibold">{title}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 border-t border-border py-4 text-xs text-muted-foreground">
        <span>ReadingTK v0.1</span>
        <span>·</span>
        <span>Self-hosted ready</span>
        <span>·</span>
        <Database className="inline h-3 w-3" />
        <span>Supabase backend</span>
      </footer>
    </div>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BookOpen, CalendarDays, Database, Globe, Sparkles, Zap } from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/i18n";

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
  { icon: BookOpen,     key: "track" },
  { icon: Globe,        key: "sources" },
  { icon: Zap,          key: "check" },
  { icon: CalendarDays, key: "calendar" },
  { icon: Bell,         key: "notif" },
] as const;

function Landing() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">

      {/* Header */}
      <header className="flex items-center justify-between border-b border-border px-10 py-4">
        <Link to="/">
          <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 140, height: "auto", mixBlendMode: "lighten", clipPath: "inset(3px 3px 3px 3px)" }} />
        </Link>
        <nav className="flex items-center gap-3">
          <LanguageSwitcher className="mr-1" />
          <Link to="/auth" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            {t("landing.signin")}
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-md px-4 py-1.5 text-sm font-medium text-white transition hover:opacity-90"
            style={{ background: "var(--gradient-primary)" }}
          >
            {t("landing.createAccount")}
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
            {t("landing.hero1")}<br />
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.70 0.20 268), oklch(0.85 0.15 250))" }}>
              {t("landing.hero2")}
            </span>
          </h1>
          <p className="mb-9 text-lg leading-relaxed text-muted-foreground">
            {t("landing.heroSub1")}<br />
            {t("landing.heroSub2")}
          </p>
          <div className="flex justify-center gap-3">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-md px-7 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
            >
              {t("landing.start")}
            </Link>
            <Link
              to="/auth"
              className="rounded-md border border-border bg-card/60 px-7 py-3 text-sm font-medium transition hover:bg-card"
            >
              {t("landing.signin")}
            </Link>
          </div>
        </section>

        {/* Feature cards */}
        <section className="grid w-full max-w-5xl grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
          {FEATURES.map(({ icon: Icon, key }) => (
            <div
              key={key}
              className="flex flex-col gap-2.5 rounded-xl border border-border bg-card/60 p-6 backdrop-blur transition hover:border-accent/60"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <Icon className="h-6 w-6 text-accent" />
              <h3 className="text-sm font-semibold">{t(`landing.f.${key}.t`)}</h3>
              <p className="text-xs leading-relaxed text-muted-foreground">{t(`landing.f.${key}.d`)}</p>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="flex items-center justify-center gap-2 border-t border-border py-4 text-xs text-muted-foreground">
        <span>ReadingTK v0.1</span>
        <span>·</span>
        <span>{t("landing.footerSelfHosted")}</span>
        <span>·</span>
        <Database className="inline h-3 w-3" />
        <span>{t("landing.footerBackend")}</span>
      </footer>
    </div>
  );
}

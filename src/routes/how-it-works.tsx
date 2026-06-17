import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, BookOpen, CalendarDays, Chrome, Globe, Search, Zap } from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/i18n";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "Comment ça marche · ReadingTK — Tracker manga & manhwa" },
      { name: "description", content: "Découvrez comment ReadingTK détecte automatiquement les nouveaux chapitres de manga, manhwa et manhua. Ajoutez vos titres, connectez vos sites de lecture et recevez des notifications instantanées." },
      { name: "keywords", content: "comment tracker manga, suivi chapitre manga automatique, notification nouveau chapitre, extension manga chrome firefox, tracker manhwa gratuit, suivi lecture manga" },
      { property: "og:type", content: "article" },
      { property: "og:url", content: "https://readingtk.net/how-it-works" },
      { property: "og:title", content: "Comment ça marche · ReadingTK" },
      { property: "og:description", content: "Comment ReadingTK détecte automatiquement les nouveaux chapitres de vos mangas et manhwas préférés." },
      { property: "og:image", content: "https://readingtk.net/og-image.png" },
    ],
  }),
  component: HowItWorksPage,
});

function HowItWorksPage() {
  const { lang } = useI18n();
  return lang === "en" ? <HowItWorksEN /> : <HowItWorksFR />;
}

// ── Shared header/footer ──────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="flex items-center justify-between border-b border-border px-10 py-4">
        <Link to="/">
          <img src="/Logo RTK.png" alt="ReadingTK" style={{ width: 140, height: "auto", mixBlendMode: "lighten", clipPath: "inset(3px 3px 3px 3px)" }} />
        </Link>
        <nav className="flex items-center gap-3">
          <LanguageSwitcher className="mr-1" />
          <Link to="/extensions" className="rounded-md px-3 py-1.5 text-sm text-muted-foreground transition hover:text-foreground">
            {t("landing.extensions")}
          </Link>
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
      <main className="flex-1">{children}</main>
      <footer className="flex items-center justify-center gap-2 border-t border-border py-4 text-xs text-muted-foreground">
        <span>ReadingTK v1.12</span>
        <span>·</span>
        <Link to="/privacy" className="hover:text-foreground hover:underline">{t("landing.footerPrivacy")}</Link>
      </footer>
    </div>
  );
}

// ── French version ────────────────────────────────────────────────────────────

const STEPS_FR = [
  {
    icon: BookOpen,
    title: "1. Ajoutez vos titres",
    body: "Créez votre bibliothèque en ajoutant les mangas, manhwas, manhuas ou novels que vous lisez. Vous pouvez coller directement l'URL d'une page de lecture — ReadingTK détecte automatiquement le nom du titre et le numéro du dernier chapitre lu.",
  },
  {
    icon: Globe,
    title: "2. Connectez vos sites de lecture",
    body: "ReadingTK apprend à reconnaître les sites que vous utilisez (MangaScan, Scantrad, AsuraScans, Webtoon, etc.). Lors de l'ajout d'une URL, il crée automatiquement le site source et déduit le modèle d'URL pour les futures vérifications.",
  },
  {
    icon: Search,
    title: "3. La détection automatique",
    body: "L'extension navigateur vérifie périodiquement chaque titre sur ses sources connues. Elle visite la page du manga, extrait le numéro du dernier chapitre disponible et le compare à votre dernier chapitre lu.",
  },
  {
    icon: Bell,
    title: "4. Notifications instantanées",
    body: "Dès qu'un nouveau chapitre est détecté, vous recevez une notification native du navigateur. En un clic, vous accédez directement au nouveau chapitre sur le site de lecture.",
  },
  {
    icon: CalendarDays,
    title: "5. Calendrier de parution",
    body: "Le dashboard affiche un calendrier qui regroupe les sorties de la semaine. Visualisez en un coup d'œil quels titres ont eu un nouveau chapitre aujourd'hui, hier ou dans les prochains jours.",
  },
  {
    icon: Zap,
    title: "6. Vérification manuelle",
    body: "Besoin de savoir tout de suite si un chapitre est sorti ? Cliquez sur le bouton de vérification dans le volet d'un titre pour lancer un scraping immédiat, sans attendre le prochain cycle automatique.",
  },
];

const FAQ_FR = [
  {
    q: "Quels types de lectures puis-je suivre ?",
    a: "Manga (japonais), manhwa (coréen), manhua (chinois), et novels (light novels, web novels). Chaque type peut avoir son propre statut : en cours, terminé, en pause, abandonné.",
  },
  {
    q: "Est-ce que ReadingTK fonctionne avec tous les sites de lecture ?",
    a: "ReadingTK est compatible avec la grande majorité des sites de lecture manga en ligne. Lors de l'ajout d'une URL, il analyse la structure de la page pour en déduire automatiquement le template. Les sites nécessitant JavaScript sont supportés via l'extension navigateur.",
  },
  {
    q: "Faut-il laisser le navigateur ouvert pour recevoir les notifications ?",
    a: "Oui, l'extension navigateur doit être active pour que les vérifications aient lieu. Elle fonctionne en arrière-plan tant que le navigateur est ouvert, même si aucun onglet ReadingTK n'est visible.",
  },
  {
    q: "ReadingTK est-il gratuit ?",
    a: "Oui, ReadingTK est entièrement gratuit. Créez un compte sur readingtk.net, installez l'extension Chrome ou Firefox, et commencez à suivre vos lectures sans aucune limitation.",
  },
  {
    q: "Mes données sont-elles privées ?",
    a: "Chaque compte est isolé — vous ne voyez que vos propres titres et données. ReadingTK ne collecte aucune donnée de navigation et ne partage aucune information avec des tiers.",
  },
];

function HowItWorksFR() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Retour à l'accueil
        </Link>

        {/* Hero */}
        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-extrabold leading-tight">
            Comment fonctionne{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.70 0.20 268), oklch(0.85 0.15 250))" }}>
              ReadingTK
            </span>
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            ReadingTK surveille automatiquement vos lectures manga, manhwa et manhua.
            Plus besoin de vérifier manuellement chaque site — l'extension le fait pour vous
            et vous prévient dès qu'un nouveau chapitre est disponible.
          </p>
        </div>

        {/* Steps */}
        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold">Les étapes en détail</h2>
          <div className="space-y-6">
            {STEPS_FR.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-5 rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
                <div className="mt-0.5 shrink-0 rounded-lg border border-accent/20 bg-accent/10 p-2.5">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Extension section */}
        <section className="mb-20 rounded-2xl border border-accent/20 bg-accent/5 p-8">
          <div className="flex items-start gap-4">
            <Chrome className="mt-1 h-8 w-8 shrink-0 text-accent" />
            <div>
              <h2 className="mb-3 text-xl font-bold">L'extension navigateur — le cœur de ReadingTK</h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                L'extension Chrome et Firefox est ce qui permet la détection automatique des chapitres.
                Elle s'exécute en arrière-plan toutes les heures, visite les pages de vos mangas
                et compare le dernier chapitre disponible avec celui que vous avez lu.
              </p>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                Elle se connecte automatiquement à votre compte ReadingTK — il suffit d'être
                connecté sur readingtk.net et l'extension synchronise tout en temps réel.
              </p>
              <Link
                to="/extensions"
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--gradient-primary)" }}
              >
                Télécharger l'extension →
              </Link>
            </div>
          </div>
        </section>

        {/* Auto-discovery */}
        <section className="mb-20">
          <h2 className="mb-4 text-2xl font-bold">Auto-découverte de sites</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            Quand vous activez l'<strong className="text-foreground">auto-découverte</strong>, ReadingTK ne se contente pas
            de vérifier les sources déjà connues — il teste automatiquement votre titre sur tous les
            sites de lecture que vous avez configurés, pour trouver de nouvelles sources disponibles.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Cette fonctionnalité est particulièrement utile pour les titres récents qui n'ont pas encore
            de sources renseignées, ou pour découvrir si un titre est disponible sur un site que vous
            n'aviez pas encore vérifié.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="mb-8 text-2xl font-bold">Questions fréquentes</h2>
          <div className="space-y-5">
            {FAQ_FR.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border bg-card/40 p-5">
                <h3 className="mb-2 text-sm font-semibold">{q}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="rounded-2xl border border-border bg-card/60 p-10 text-center">
          <h2 className="mb-3 text-2xl font-bold">Prêt à ne plus rater un seul chapitre ?</h2>
          <p className="mb-7 text-muted-foreground">Gratuit, sans publicité, sans limite de titres.</p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-block rounded-md px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            Créer un compte gratuit
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

// ── English version ───────────────────────────────────────────────────────────

const STEPS_EN = [
  {
    icon: BookOpen,
    title: "1. Add your titles",
    body: "Build your library by adding the manga, manhwa, manhua, or novels you're reading. You can paste a reading page URL directly — ReadingTK automatically detects the title name and your last read chapter number.",
  },
  {
    icon: Globe,
    title: "2. Connect your reading sites",
    body: "ReadingTK learns to recognize the sites you use (MangaScan, AsuraScans, Webtoon, etc.). When you add a URL, it automatically creates the source site and infers the URL template for future checks.",
  },
  {
    icon: Search,
    title: "3. Automatic detection",
    body: "The browser extension periodically checks each title against its known sources. It visits the manga page, extracts the latest available chapter number, and compares it to your last read chapter.",
  },
  {
    icon: Bell,
    title: "4. Instant notifications",
    body: "As soon as a new chapter is detected, you receive a native browser notification. One click takes you directly to the new chapter on the reading site.",
  },
  {
    icon: CalendarDays,
    title: "5. Release calendar",
    body: "The dashboard shows a calendar grouping this week's releases. See at a glance which titles got a new chapter today, yesterday, or in the coming days.",
  },
  {
    icon: Zap,
    title: "6. Manual check",
    body: "Need to know right now if a chapter dropped? Click the check button in a title's panel to trigger an immediate scrape, without waiting for the next automatic cycle.",
  },
];

const FAQ_EN = [
  {
    q: "What types of content can I track?",
    a: "Manga (Japanese), manhwa (Korean), manhua (Chinese), and novels (light novels, web novels). Each title can have its own status: ongoing, completed, on hold, or dropped.",
  },
  {
    q: "Does ReadingTK work with all reading sites?",
    a: "ReadingTK is compatible with the vast majority of online manga reading sites. When you add a URL, it analyzes the page structure to automatically infer the URL template. Sites requiring JavaScript are supported via the browser extension.",
  },
  {
    q: "Does the browser need to stay open to receive notifications?",
    a: "Yes, the browser extension must be active for checks to happen. It runs in the background as long as the browser is open, even if no ReadingTK tab is visible.",
  },
  {
    q: "Is ReadingTK free?",
    a: "Yes, ReadingTK is completely free. Create an account on readingtk.net, install the Chrome or Firefox extension, and start tracking your reads with no limitations.",
  },
  {
    q: "Is my data private?",
    a: "Each account is isolated — you only see your own titles and data. ReadingTK collects no browsing data and shares no information with third parties.",
  },
];

function HowItWorksEN() {
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Back to home
        </Link>

        <div className="mb-16 text-center">
          <h1 className="mb-4 text-4xl font-extrabold leading-tight">
            How{" "}
            <span className="bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(135deg, oklch(0.70 0.20 268), oklch(0.85 0.15 250))" }}>
              ReadingTK
            </span>
            {" "}works
          </h1>
          <p className="mx-auto max-w-2xl text-lg leading-relaxed text-muted-foreground">
            ReadingTK automatically monitors your manga, manhwa, and manhua reading.
            No more manually checking every site — the extension does it for you
            and alerts you as soon as a new chapter is available.
          </p>
        </div>

        <section className="mb-20">
          <h2 className="mb-8 text-2xl font-bold">Step by step</h2>
          <div className="space-y-6">
            {STEPS_EN.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-5 rounded-xl border border-border bg-card/60 p-6 backdrop-blur">
                <div className="mt-0.5 shrink-0 rounded-lg border border-accent/20 bg-accent/10 p-2.5">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <h3 className="mb-2 font-semibold">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-20 rounded-2xl border border-accent/20 bg-accent/5 p-8">
          <div className="flex items-start gap-4">
            <Chrome className="mt-1 h-8 w-8 shrink-0 text-accent" />
            <div>
              <h2 className="mb-3 text-xl font-bold">The browser extension — ReadingTK's core</h2>
              <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                The Chrome and Firefox extension is what enables automatic chapter detection.
                It runs in the background every hour, visits your manga pages,
                and compares the latest available chapter with the one you've read.
              </p>
              <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
                It connects automatically to your ReadingTK account — just be logged in
                on readingtk.net and the extension syncs everything in real time.
              </p>
              <Link
                to="/extensions"
                className="inline-flex items-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--gradient-primary)" }}
              >
                Download the extension →
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-20">
          <h2 className="mb-4 text-2xl font-bold">Site auto-discovery</h2>
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
            When you enable <strong className="text-foreground">auto-discovery</strong>, ReadingTK doesn't just check
            already-known sources — it automatically tests your title across all configured reading
            sites to find new available sources.
          </p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This feature is especially useful for new titles that don't have sources yet,
            or to discover if a title is available on a site you haven't checked before.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="mb-8 text-2xl font-bold">Frequently asked questions</h2>
          <div className="space-y-5">
            {FAQ_EN.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border bg-card/40 p-5">
                <h3 className="mb-2 text-sm font-semibold">{q}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-card/60 p-10 text-center">
          <h2 className="mb-3 text-2xl font-bold">Ready to never miss a chapter?</h2>
          <p className="mb-7 text-muted-foreground">Free, no ads, no title limit.</p>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="inline-block rounded-md px-8 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{ background: "var(--gradient-primary)", boxShadow: "var(--shadow-glow)" }}
          >
            Create a free account
          </Link>
        </div>
      </div>
    </PageShell>
  );
}

import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Bell, BookOpen, CalendarDays, Chrome, Globe, Search, Zap, Github } from "lucide-react";
import { useI18n } from "@/i18n";
import { Footer } from "@/components/Footer";

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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ── Shared footer ──────────────────────────────────────────────────────────────

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <main className="flex-1">{children}</main>
      <Footer />
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

const FEATURES_FR = [
  {
    title: "Votre bibliothèque",
    images: ["/screenshots/01-dashboard-drawer.png"],
    body: [
      "La page Bibliothèque liste tous vos titres suivis. Recherchez par nom, filtrez par type (manga, manhua, manhwa, novel) ou par statut (en cours, en pause, abandonné, terminé), et triez chaque colonne en cliquant sur son en-tête.",
      "Le badge NEW apparaît dès qu'un chapitre détecté est plus récent que votre dernière lecture. Le bouton Actualiser recharge la liste, et Fusionner permet de regrouper deux titres en doublon en un seul (utile si un import ou une recherche a créé deux entrées pour la même série).",
      "Cliquez sur une ligne pour ouvrir le volet détaillé du titre, à droite.",
    ],
  },
  {
    title: "Le volet d'un titre — en-tête",
    images: ["/screenshots/02-drawer-header.png"],
    body: [
      "Survolez la couverture pour la changer (icône appareil photo). Le crayon à côté du nom permet de le renommer.",
      "Le bouton de rafraîchissement lance une vérification immédiate de ce titre — via l'application Windows si elle tourne, sinon via l'extension navigateur (si aucune des deux n'est installée, un message vous invite à en installer une).",
      "Le bouton Auto-découverte, une fois activé, demande à l'extension de tester automatiquement le titre sur tous vos sites configurés pour trouver de nouvelles sources.",
    ],
  },
  {
    title: "Progression et classification",
    images: ["/screenshots/03-drawer-progress.png"],
    body: [
      "Ajustez votre dernier chapitre lu avec les boutons −1 / +1, ou tapez directement un numéro puis cliquez sur Enregistrer.",
      "Les pastilles Type et Statut permettent de classer le titre manuellement. Cliquer sur un type le verrouille (mention « manuel ») pour que la détection automatique ne l'écrase plus ; cliquer à nouveau sur le même type déverrouille la détection automatique.",
    ],
  },
  {
    title: "Chapitre détecté et sources",
    images: ["/screenshots/04-drawer-sources.png"],
    body: [
      "« Dernier chapitre détecté » affiche le chapitre le plus récent trouvé parmi toutes vos sources. Le crayon permet de le corriger manuellement, et l'icône Google lance une recherche pour ce chapitre précis. En dessous, les liens directs trouvés vers ce chapitre sont cliquables (et supprimables via la corbeille).",
      "La section Sources liste chaque site où ce titre est disponible : sa priorité (le site le plus prioritaire fait référence en cas de chapitres différents), son lien direct, le dernier chapitre détecté sur ce site précis avec son propre raccourci de recherche Google. Le bouton + ajoute une nouvelle source — collez une URL, ReadingTK reconnaît ou crée automatiquement le site correspondant. Le crayon modifie le lien ou le chapitre enregistré, la corbeille supprime la source (confirmation demandée).",
      "Tout en bas, « Supprimer ce titre » retire définitivement le titre de votre bibliothèque (confirmation demandée).",
    ],
  },
  {
    title: "Calendrier de parution",
    images: ["/screenshots/05-calendar-grid.png", "/screenshots/06-calendar-dialog.png"],
    body: [
      "Chaque titre suivi peut avoir un jour et une heure de parution habituels. La grille affiche la semaine en cours ; naviguez avec les flèches ou revenez à Aujourd'hui. La ligne rouge indique l'heure actuelle.",
      "Le numéro de chapitre affiché sur les prochaines parutions est une projection calculée à partir du dernier chapitre détecté, pas une valeur confirmée — utile pour anticiper, mais pas fiable à 100%.",
      "Cliquez sur une case vide pour ajouter une entrée, ou sur l'icône engrenage d'un événement existant pour le modifier ou le supprimer.",
    ],
  },
  {
    title: "Sites à scraper",
    images: ["/screenshots/07-sites.png"],
    body: [
      "Cette page liste tous les sites que ReadingTK sait scraper. Le formulaire du haut permet d'en ajouter un manuellement (nom, URL de base, et éventuellement un modèle d'URL utilisant {slug} pour que le scraper retrouve automatiquement un titre sur ce site).",
      "Dans le tableau : la priorité détermine quel site fait référence en cas de chapitres différents entre sources, l'interrupteur Activé permet de désactiver un site sans le supprimer, et un badge « Down » apparaît si le site est actuellement injoignable. La corbeille supprime le site immédiatement, sans confirmation — vérifiez qu'aucune source active n'y est encore reliée avant de le faire.",
    ],
  },
  {
    title: "Notifications",
    images: ["/screenshots/08-notifications.png"],
    body: [
      "Chaque nouveau chapitre détecté génère une notification ici : titre, numéro de chapitre et heure de détection, avec un bouton Ouvrir pour accéder directement au chapitre.",
      "Le crochet à droite d'une notification la marque comme lue individuellement (il disparaît une fois lue). « Tout marquer comme lu » fait la même chose en un clic pour toute la liste. « Tout supprimer » demande une confirmation avant d'effacer tout l'historique.",
    ],
  },
  {
    title: "Paramètres",
    images: ["/screenshots/09-settings-1.png", "/screenshots/09-settings-2.png"],
    body: [
      "Votre email et vos connexions (Google, Discord, Twitch) sont affichés en haut. Si vous vous êtes inscrit via l'un de ces services, vous pouvez y définir un mot de passe pour aussi pouvoir vous connecter avec votre email.",
      "Choisissez la langue de l'interface, activez ou non les notifications dans l'application (les notifications par email arrivent bientôt), et le format d'affichage des chapitres (numérique ou texte).",
      "Les valeurs par défaut (type et statut) s'appliquent automatiquement à tout nouveau titre créé via Ajouter un titre ou un import. « Ignorer les doublons » évite de recréer un titre déjà existant lors d'un import de favoris.",
      "Chaque réglage de cette page s'enregistre automatiquement dès que vous le modifiez.",
    ],
  },
  {
    title: "Ajouter un titre",
    images: ["/screenshots/10-titles-add.png"],
    body: [
      "Onglet « Ajout via URLs » : collez une ou plusieurs URL de pages de lecture (une par ligne) — ReadingTK devine le nom du titre, le site et le numéro de chapitre à partir de chaque lien. Activez « Toutes les URLs sont pour le même titre » si vous collez plusieurs liens (sur différents sites) vers une seule série.",
      "Onglet « Ajout manuel » : tapez simplement un nom de titre par ligne, sans URL — utile pour ajouter une série à suivre avant même d'avoir trouvé où la lire.",
    ],
  },
  {
    title: "Importer des bookmarks",
    images: ["/screenshots/11-import.png"],
    body: [
      "Exportez vos favoris depuis votre navigateur au format HTML, puis importez le fichier ici. ReadingTK analyse chaque lien, regroupe automatiquement les favoris qui semblent correspondre à la même série, et affiche un tableau de prévisualisation où vous pouvez décocher ou renommer chaque entrée avant de valider l'import.",
    ],
  },
  {
    title: "Exporter des bookmarks",
    images: ["/screenshots/12-export-1.png", "/screenshots/12-export-2.png"],
    body: [
      "Filtrez par type, par statut, et choisissez quels liens exporter par titre : les pages sources, uniquement le dernier chapitre détecté, ou les deux. Cochez/décochez chaque titre individuellement ou utilisez Tout sélectionner.",
      "Le bouton Exporter télécharge un fichier HTML standard, réimportable dans n'importe quel navigateur — pratique pour sauvegarder votre bibliothèque ou la retrouver sur un autre appareil.",
    ],
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
  const router = useRouter();
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <button onClick={() => router.history.back()} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Retour
        </button>

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
          <a
            href="https://github.com/tkissdev/readingtk"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" /> Projet open source — voir le code sur GitHub
          </a>
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
                to="/download"
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

        {/* Fonctionnalités en détail */}
        <section className="mb-20">
          <h2 className="mb-2 text-2xl font-bold">Fonctionnalités en détail</h2>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            Un aperçu de chaque page et de chaque bouton de l'application, en image.
          </p>
          <div className="mb-8 flex flex-wrap gap-2">
            {FEATURES_FR.map((f) => (
              <a
                key={f.title}
                href={`#${slugify(f.title)}`}
                className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-accent/60 hover:text-foreground"
              >
                {f.title}
              </a>
            ))}
          </div>
          <div className="space-y-6">
            {FEATURES_FR.map((f) => (
              <div key={f.title} id={slugify(f.title)} className="scroll-mt-20 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
                <h3 className="mb-4 text-lg font-semibold">{f.title}</h3>
                <div className={`mb-4 grid gap-3 ${f.images.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {f.images.map((src) => (
                    <img key={src} src={src} alt={f.title} className="w-full rounded-lg border border-border" loading="lazy" />
                  ))}
                </div>
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {f.body.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            ))}
          </div>
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

const FEATURES_EN = [
  {
    title: "Your library",
    images: ["/screenshots/01-dashboard-drawer.png"],
    body: [
      "The Library page lists every title you track. Search by name, filter by type (manga, manhua, manhwa, novel) or status (ongoing, paused, dropped, completed), and sort any column by clicking its header.",
      "The NEW badge appears as soon as a detected chapter is more recent than what you've read. The Refresh button reloads the list, and Merge lets you combine two duplicate titles into one (handy if an import or a search created two entries for the same series).",
      "Click a row to open the detailed panel for that title, on the right.",
    ],
  },
  {
    title: "A title's panel — header",
    images: ["/screenshots/02-drawer-header.png"],
    body: [
      "Hover the cover to change it (camera icon). The pencil next to the name lets you rename it.",
      "The refresh button triggers an immediate check for this title — via the Windows app if it's running, otherwise via the browser extension (if neither is installed, a message prompts you to install one).",
      "The Auto-discover button, once enabled, asks the extension to automatically test the title across all your configured sites to find new sources.",
    ],
  },
  {
    title: "Progress and classification",
    images: ["/screenshots/03-drawer-progress.png"],
    body: [
      "Adjust your last read chapter with the −1 / +1 buttons, or type a number directly and click Save.",
      "The Type and Status pills let you classify the title manually. Clicking a type locks it (shown as \"manual\") so automatic detection no longer overwrites it; clicking the same type again unlocks automatic detection.",
    ],
  },
  {
    title: "Detected chapter and sources",
    images: ["/screenshots/04-drawer-sources.png"],
    body: [
      "\"Last detected chapter\" shows the most recent chapter found across all your sources. The pencil lets you correct it manually, and the Google icon searches for that specific chapter. Below, any direct links found to that chapter are clickable (and removable via the trash icon).",
      "The Sources section lists every site where this title is available: its priority (the highest-priority site is used as the reference when sources disagree), its direct link, the last chapter detected on that specific site with its own Google search shortcut. The + button adds a new source — paste a URL and ReadingTK recognizes or automatically creates the matching site. The pencil edits the saved link or chapter, the trash icon removes the source (confirmation required).",
      "At the very bottom, \"Delete this title\" permanently removes the title from your library (confirmation required).",
    ],
  },
  {
    title: "Release calendar",
    images: ["/screenshots/05-calendar-grid.png", "/screenshots/06-calendar-dialog.png"],
    body: [
      "Each tracked title can have a usual release day and time. The grid shows the current week; navigate with the arrows or jump back to Today. The red line marks the current time.",
      "The chapter number shown on upcoming releases is a projection computed from the last detected chapter, not a confirmed value — useful for planning ahead, but not 100% reliable.",
      "Click an empty cell to add an entry, or the gear icon on an existing event to edit or delete it.",
    ],
  },
  {
    title: "Scraping sites",
    images: ["/screenshots/07-sites.png"],
    body: [
      "This page lists every site ReadingTK knows how to scrape. The form at the top lets you add one manually (name, base URL, and optionally a URL template using {slug} so the scraper can automatically locate a title on that site).",
      "In the table: priority determines which site is used as the reference when sources report different chapters, the Enabled toggle lets you disable a site without deleting it, and a \"Down\" badge appears if the site is currently unreachable. The trash icon deletes the site immediately, with no confirmation — check that no active source still points to it before doing so.",
    ],
  },
  {
    title: "Notifications",
    images: ["/screenshots/08-notifications.png"],
    body: [
      "Every newly detected chapter generates a notification here: title, chapter number, and detection time, with an Open button to jump straight to the chapter.",
      "The checkmark on the right marks a single notification as read (it disappears once read). \"Mark all as read\" does the same for the whole list in one click. \"Delete all\" asks for confirmation before wiping the whole history.",
    ],
  },
  {
    title: "Settings",
    images: ["/screenshots/09-settings-1.png", "/screenshots/09-settings-2.png"],
    body: [
      "Your email and connected providers (Google, Discord, Twitch) are shown at the top. If you signed up via one of those services, you can set a password here to also sign in with your email.",
      "Choose the interface language, toggle in-app notifications (email notifications are coming soon), and pick the chapter display format (numeric or text).",
      "The default values (type and status) automatically apply to any new title created via Add a title or an import. \"Ignore duplicates\" prevents recreating a title that already exists when importing bookmarks.",
      "Every setting on this page saves automatically as soon as you change it.",
    ],
  },
  {
    title: "Add a title",
    images: ["/screenshots/10-titles-add.png"],
    body: [
      "\"Add via URLs\" tab: paste one or more reading-page URLs (one per line) — ReadingTK guesses the title name, the site, and the chapter number from each link. Enable \"All URLs are for the same title\" if you're pasting several links (across different sites) for a single series.",
      "\"Manual add\" tab: just type one title name per line, no URL needed — useful for adding a series to track before you've even found where to read it.",
    ],
  },
  {
    title: "Import bookmarks",
    images: ["/screenshots/11-import.png"],
    body: [
      "Export your bookmarks from your browser as HTML, then import the file here. ReadingTK parses every link, automatically groups bookmarks that seem to match the same series, and shows a preview table where you can uncheck or rename each entry before confirming the import.",
    ],
  },
  {
    title: "Export bookmarks",
    images: ["/screenshots/12-export-1.png", "/screenshots/12-export-2.png"],
    body: [
      "Filter by type, by status, and choose which links to export per title: source pages only, the last detected chapter only, or both. Check/uncheck each title individually or use Select all.",
      "The Export button downloads a standard HTML file, re-importable into any browser — handy for backing up your library or bringing it to another device.",
    ],
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
  const router = useRouter();
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl px-6 py-16">
        <button onClick={() => router.history.back()} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </button>

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
          <a
            href="https://github.com/tkissdev/readingtk"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground transition hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" /> Open source project — view the code on GitHub
          </a>
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
                to="/download"
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

        {/* Features in detail */}
        <section className="mb-20">
          <h2 className="mb-2 text-2xl font-bold">Features in detail</h2>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            A look at every page and button in the app, in pictures.
          </p>
          <div className="mb-8 flex flex-wrap gap-2">
            {FEATURES_EN.map((f) => (
              <a
                key={f.title}
                href={`#${slugify(f.title)}`}
                className="rounded-full border border-border bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:border-accent/60 hover:text-foreground"
              >
                {f.title}
              </a>
            ))}
          </div>
          <div className="space-y-6">
            {FEATURES_EN.map((f) => (
              <div key={f.title} id={slugify(f.title)} className="scroll-mt-20 rounded-2xl border border-border bg-card/60 p-6 backdrop-blur">
                <h3 className="mb-4 text-lg font-semibold">{f.title}</h3>
                <div className={`mb-4 grid gap-3 ${f.images.length > 1 ? "sm:grid-cols-2" : ""}`}>
                  {f.images.map((src) => (
                    <img key={src} src={src} alt={f.title} className="w-full rounded-lg border border-border" loading="lazy" />
                  ))}
                </div>
                <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
                  {f.body.map((p, i) => <p key={i}>{p}</p>)}
                </div>
              </div>
            ))}
          </div>
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

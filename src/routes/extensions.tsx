import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/extensions")({
  head: () => ({
    meta: [
      { title: "Extensions navigateur · ReadingTK" },
      { name: "description", content: "Installez l'extension ReadingTK sur Chrome ou Firefox pour détecter automatiquement les nouveaux chapitres manga et manhwa." },
    ],
  }),
  component: ExtensionsPage,
});

const ChromeIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#fff" />
    <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" fill="#1a73e8" />
    <path d="M12 8h9.2a10 10 0 0 0-18.4 0H12z" fill="#ea4335" />
    <path d="M3.46 14A10 10 0 0 0 12 22l4.6-7.96A4 4 0 0 1 12 16a4 4 0 0 1-3.46-2H3.46z" fill="#34a853" />
    <path d="M20.54 14A10 10 0 0 0 21.2 8H12a4 4 0 0 1 4.6 4.04L20.54 14z" fill="#fbbc05" />
  </svg>
);

const FirefoxIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#FF9500" />
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.5 14.5c-1 .7-2.2 1-3.5 1-3.87 0-7-3.13-7-7 0-1.5.47-2.89 1.27-4.03.2.6.5 1.5 1.23 2.03.9.65 2 .5 2 .5s-.5 1 .5 2c.67.67 1.5.7 2 .5.4 1.2 1.5 2 2.5 2s2-.8 2-2c0-.5-.2-1-.5-1.5.5.2 1 .6 1.3 1.2.8 1.5.4 3.5-1.8 5.3z" fill="#FF6611" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const ExternalIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function PopupMockup() {
  return (
    <div style={{ width: 260, background: "#0f0f13", border: "1px solid #2a2a38", borderRadius: 12, padding: 18, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", fontSize: 13, color: "#e8e8f0", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <span style={{ fontSize: 17, fontWeight: 700, background: "linear-gradient(135deg, #6366f1, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ReadingTK</span>
        <span style={{ fontSize: 11, color: "#555", cursor: "pointer" }}>Déconnexion</span>
      </div>
      <div style={{ background: "#1a1a24", border: "1px solid #2a2a38", borderRadius: 8, padding: "10px 13px", marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
          <span style={{ color: "#888", fontSize: 11 }}>Dernière vérification</span>
          <span style={{ fontSize: 12, fontWeight: 500 }}>il y a 8 min</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888", fontSize: 11 }}>Nouveaux chapitres</span>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#818cf8" }}>3 détectés</span>
        </div>
      </div>
      <button style={{ width: "100%", padding: "8px 14px", borderRadius: 7, border: "none", background: "linear-gradient(135deg, #6366f1, #818cf8)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>
        ↻ Vérifier maintenant
      </button>
      <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#aaa", fontSize: 12 }}>Intervalle automatique</span>
          <select style={{ background: "#1a1a24", border: "1px solid #2a2a38", color: "#e8e8f0", fontSize: 12, padding: "3px 7px", borderRadius: 5 }} defaultValue="60">
            <option value="60">1 heure</option>
          </select>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ color: "#aaa", fontSize: 12 }}>Notifications</span>
          <div style={{ width: 36, height: 20, background: "#6366f1", borderRadius: 20, position: "relative" }}>
            <div style={{ position: "absolute", width: 14, height: 14, background: "#fff", borderRadius: "50%", top: 3, left: 19 }} />
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", color: "#6366f1", fontSize: 12 }}>Ouvrir ReadingTK ↗</div>
    </div>
  );
}

function StepBadge({ n }: { n: number }) {
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: "var(--gradient-primary)" }}>
      {n}
    </div>
  );
}

function ExtensionsPage() {
  const { lang } = useI18n();
  const isFr = lang !== "en";

  const CHROME_STORE_URL = null; // À remplacer quand publié : "https://chrome.google.com/webstore/detail/..."
  const FIREFOX_STORE_URL = null; // À remplacer quand publié : "https://addons.mozilla.org/firefox/addon/..."

  const steps = isFr ? [
    { title: "Télécharge l'extension", desc: "Clique sur le bouton ci-dessus pour télécharger le fichier ZIP." },
    { title: "Ouvre la page des extensions", desc: "Dans Chrome : tape chrome://extensions dans la barre d'adresse. Dans Firefox : tape about:addons." },
    { title: "Active le mode développeur", desc: "Chrome uniquement — active le bouton « Mode développeur » en haut à droite." },
    { title: "Charge l'extension", desc: "Chrome : « Charger l'extension non empaquetée » puis sélectionne le dossier extrait. Firefox : « Installer depuis un fichier » puis sélectionne le ZIP." },
    { title: "Connecte-toi", desc: "Clique sur l'icône de l'extension et connecte-toi avec ton compte ReadingTK." },
  ] : [
    { title: "Download the extension", desc: "Click the button above to download the ZIP file." },
    { title: "Open the extensions page", desc: "In Chrome: type chrome://extensions in the address bar. In Firefox: type about:addons." },
    { title: "Enable developer mode", desc: "Chrome only — toggle the 'Developer mode' button in the top right." },
    { title: "Load the extension", desc: "Chrome: click 'Load unpacked' and select the extracted folder. Firefox: click 'Install Add-on From File' and select the ZIP." },
    { title: "Sign in", desc: "Click the extension icon and sign in with your ReadingTK account." },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl flex-1 px-6 py-16">
        <Link to="/" className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← {isFr ? "Retour à l'accueil" : "Back to home"}
        </Link>

        <h1 className="mb-3 text-3xl font-bold">{isFr ? "Extension navigateur" : "Browser Extension"}</h1>
        <p className="mb-12 text-sm leading-relaxed text-muted-foreground">
          {isFr
            ? "Détectez automatiquement les nouveaux chapitres sans quitter votre navigateur. L'extension s'exécute en arrière-plan et vous notifie dès qu'un chapitre est disponible."
            : "Automatically detect new chapters without leaving your browser. The extension runs in the background and notifies you as soon as a chapter is available."}
        </p>

        {/* Cartes Chrome + Firefox */}
        <div className="mb-16 grid gap-5 md:grid-cols-2">
          {/* Chrome */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-3">
              <ChromeIcon />
              <div>
                <div className="font-semibold">Chrome</div>
                <div className="text-xs text-muted-foreground">Manifest V3</div>
              </div>
            </div>
            {CHROME_STORE_URL ? (
              <a href={CHROME_STORE_URL} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--gradient-primary)" }}>
                <ExternalIcon /> {isFr ? "Installer depuis le Chrome Web Store" : "Install from Chrome Web Store"}
              </a>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-2.5 text-center text-sm text-muted-foreground">
                {isFr ? "⏳ Soumis — en cours de validation" : "⏳ Submitted — pending review"}
              </div>
            )}
            <a href="/downloads/readingtk-chrome.zip" download
              className="flex items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-accent/60 hover:text-foreground">
              <DownloadIcon /> {isFr ? "Télécharger le ZIP (installation manuelle)" : "Download ZIP (manual install)"}
            </a>
          </div>

          {/* Firefox */}
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card/60 p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex items-center gap-3">
              <FirefoxIcon />
              <div>
                <div className="font-semibold">Firefox</div>
                <div className="text-xs text-muted-foreground">Manifest V2</div>
              </div>
            </div>
            {FIREFOX_STORE_URL ? (
              <a href={FIREFOX_STORE_URL} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--gradient-primary)" }}>
                <ExternalIcon /> {isFr ? "Installer depuis Firefox Add-ons" : "Install from Firefox Add-ons"}
              </a>
            ) : (
              <div className="rounded-md border border-border bg-muted/30 px-4 py-2.5 text-center text-sm text-muted-foreground">
                {isFr ? "⏳ Soumis — en cours de validation" : "⏳ Submitted — pending review"}
              </div>
            )}
            <a href="/downloads/readingtk-firefox.zip" download
              className="flex items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-accent/60 hover:text-foreground">
              <DownloadIcon /> {isFr ? "Télécharger le ZIP (installation manuelle)" : "Download ZIP (manual install)"}
            </a>
          </div>
        </div>

        {/* Aperçu + Fonctionnalités */}
        <div className="mb-16 flex flex-col items-start gap-12 md:flex-row md:items-center">
          <div className="shrink-0">
            <PopupMockup />
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">{isFr ? "Ce que fait l'extension" : "What the extension does"}</h2>
            {(isFr ? [
              "Détecte les nouveaux chapitres sur toutes vos sources configurées",
              "Envoie une notification push dès qu'un chapitre sort",
              "Se synchronise automatiquement avec votre bibliothèque ReadingTK",
              "Vérification automatique réglable (15 min à 4 heures)",
              "Fonctionne entièrement en arrière-plan",
            ] : [
              "Detects new chapters on all your configured sources",
              "Sends a push notification as soon as a chapter is released",
              "Automatically syncs with your ReadingTK library",
              "Configurable auto-check interval (15 min to 4 hours)",
              "Runs entirely in the background",
            ]).map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <CheckIcon />
                </div>
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Instructions d'installation manuelle */}
        <div className="rounded-2xl border border-border bg-card/40 p-8">
          <h2 className="mb-6 text-xl font-semibold">
            {isFr ? "Installation manuelle (en attendant les stores)" : "Manual installation (while awaiting store approval)"}
          </h2>
          <div className="flex flex-col gap-5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-start gap-4">
                <StepBadge n={i + 1} />
                <div>
                  <div className="text-sm font-semibold text-foreground">{step.title}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
      <Footer />
    </div>
  );
}

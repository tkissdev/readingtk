import { createFileRoute, Link } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/download")({
  head: () => ({
    meta: [
      { title: "Téléchargements · ReadingTK" },
      { name: "description", content: "Téléchargez l'extension ReadingTK (Chrome, Firefox) et l'application Windows pour détecter automatiquement les nouveaux chapitres manga et manhwa." },
    ],
  }),
  component: DownloadPage,
});

const RELEASE_BASE = "https://github.com/tkissdev/readingtk/releases/download/windows-app-v1.0.0";
const WINDOWS_VERSION = "1.0.0";

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

const WindowsIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
    <path d="M3 5.5 10.4 4.5V11.4H3V5.5Z" fill="#00A4EF" />
    <path d="M11.3 4.4 21 3V11.3H11.3V4.4Z" fill="#00A4EF" />
    <path d="M3 12.4H10.4V19.4L3 18.4V12.4Z" fill="#00A4EF" />
    <path d="M11.3 12.4H21V20.9L11.3 19.5V12.4Z" fill="#00A4EF" />
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

function DownloadPage() {
  const { lang } = useI18n();
  const isFr = lang !== "en";

  const CHROME_STORE_URL: string | null = null; // À remplacer quand publié : "https://chrome.google.com/webstore/detail/..."
  const FIREFOX_STORE_URL = "https://addons.mozilla.org/fr/firefox/addon/readingtk/";

  const extSteps = isFr ? [
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

        <h1 className="mb-3 text-3xl font-bold">{isFr ? "Téléchargements" : "Downloads"}</h1>
        <p className="mb-12 text-sm leading-relaxed text-muted-foreground">
          {isFr
            ? "Installez l'extension navigateur et/ou l'application Windows pour détecter automatiquement les nouveaux chapitres, sans jamais avoir à vérifier vos sites de lecture manuellement."
            : "Install the browser extension and/or the Windows app to automatically detect new chapters, without ever having to check your reading sites manually."}
        </p>

        {/* ── Extension navigateur ── */}
        <section className="mb-20">
          <h2 className="mb-2 text-xl font-bold">{isFr ? "Extension navigateur" : "Browser Extension"}</h2>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {isFr
              ? "S'exécute en arrière-plan dans votre navigateur et vous notifie dès qu'un chapitre est disponible."
              : "Runs in the background in your browser and notifies you as soon as a chapter is available."}
          </p>

          <div className="mb-10 grid gap-5 md:grid-cols-2">
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
              <a href={FIREFOX_STORE_URL} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-md px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
                style={{ background: "var(--gradient-primary)" }}>
                <ExternalIcon /> {isFr ? "Installer depuis Firefox Add-ons" : "Install from Firefox Add-ons"}
              </a>
              <a href="/downloads/readingtk-firefox.zip" download
                className="flex items-center justify-center gap-2 rounded-md border border-border bg-card/50 px-4 py-2 text-sm font-medium text-muted-foreground transition hover:border-accent/60 hover:text-foreground">
                <DownloadIcon /> {isFr ? "Télécharger le ZIP (installation manuelle)" : "Download ZIP (manual install)"}
              </a>
            </div>
          </div>

          {/* Aperçu + Fonctionnalités */}
          <div className="mb-10 flex flex-col items-start gap-12 md:flex-row md:items-center">
            <div className="shrink-0">
              <PopupMockup />
            </div>
            <div className="flex flex-col gap-4">
              <h3 className="text-lg font-semibold">{isFr ? "Ce que fait l'extension" : "What the extension does"}</h3>
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
            <h3 className="mb-6 text-lg font-semibold">
              {isFr ? "Installation manuelle (Chrome, en attendant la validation du store)" : "Manual installation (Chrome, while awaiting store approval)"}
            </h3>
            <div className="flex flex-col gap-5">
              {extSteps.map((step, i) => (
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
        </section>

        {/* ── Application Windows ── */}
        <section>
          <h2 className="mb-2 text-xl font-bold">{isFr ? "Application Windows" : "Windows App"}</h2>
          <p className="mb-6 text-sm leading-relaxed text-muted-foreground">
            {isFr
              ? "Une icône dans la barre système qui vérifie vos lectures en continu, même quand votre navigateur est fermé."
              : "A system tray icon that keeps checking your reads, even when your browser is closed."}
          </p>

          <div className="mb-10 flex items-center gap-3 rounded-2xl border border-border bg-card/60 p-6" style={{ boxShadow: "var(--shadow-card)" }}>
            <WindowsIcon />
            <div>
              <div className="font-semibold">Windows 10 / 11</div>
              <div className="text-xs text-muted-foreground">{isFr ? `Version ${WINDOWS_VERSION}` : `Version ${WINDOWS_VERSION}`}</div>
            </div>
          </div>

          <div className="mb-10 grid gap-5 md:grid-cols-3">
            <a href={`${RELEASE_BASE}/ReadingTK.exe`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 p-6 text-center transition hover:border-accent/60"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"><DownloadIcon /></div>
              <div className="font-semibold">ReadingTK.exe</div>
              <div className="text-xs text-muted-foreground">
                {isFr ? "Exécutable portable — aucune installation" : "Portable executable — no installation"}
              </div>
            </a>

            <a href={`${RELEASE_BASE}/ReadingTK-${WINDOWS_VERSION}-win64.msi`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 p-6 text-center transition hover:border-accent/60"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"><DownloadIcon /></div>
              <div className="font-semibold">Installateur .msi</div>
              <div className="text-xs text-muted-foreground">
                {isFr ? "Installation classique + menu Démarrer" : "Classic install + Start Menu shortcut"}
              </div>
            </a>

            <a href={`${RELEASE_BASE}/ReadingTK-${WINDOWS_VERSION}-portable.zip`}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card/60 p-6 text-center transition hover:border-accent/60"
              style={{ boxShadow: "var(--shadow-card)" }}>
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent"><DownloadIcon /></div>
              <div className="font-semibold">Version .zip</div>
              <div className="text-xs text-muted-foreground">
                {isFr ? "Archive contenant l'exécutable portable" : "Archive containing the portable executable"}
              </div>
            </a>
          </div>

          <div className="mb-10 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <p className="mb-1 font-medium text-foreground">
              {isFr ? "⚠️ Windows peut afficher un avertissement SmartScreen" : "⚠️ Windows may show a SmartScreen warning"}
            </p>
            <p className="text-muted-foreground">
              {isFr
                ? "L'application n'a pas encore de certificat de signature numérique. Si Windows affiche « Windows a protégé votre ordinateur », cliquez sur « Informations complémentaires » puis sur « Exécuter quand même » pour installer l'application."
                : "The app doesn't have a digital signing certificate yet. If Windows shows \"Windows protected your PC\", click \"More info\" then \"Run anyway\" to install the app."}
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold">{isFr ? "Ce que fait l'application" : "What the app does"}</h3>
            {(isFr ? [
              "Icône dans la barre système (systray) avec vérification à la demande",
              "Vérification automatique en arrière-plan, à intervalle réglable",
              "Notifications natives Windows dès qu'un chapitre est détecté",
              "Rapport détaillé des erreurs du dernier check",
              "Démarrage automatique avec Windows (optionnel)",
            ] : [
              "System tray icon with on-demand check",
              "Automatic background check, at an adjustable interval",
              "Native Windows notifications as soon as a chapter is detected",
              "Detailed error report from the last check",
              "Optional automatic startup with Windows",
            ]).map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent">
                  <CheckIcon />
                </div>
                <span className="text-sm text-muted-foreground">{item}</span>
              </div>
            ))}
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}

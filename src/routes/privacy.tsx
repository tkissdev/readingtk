import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Politique de confidentialité · ReadingTK" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  const { lang } = useI18n();
  return lang === "en" ? <PrivacyEN /> : <PrivacyFR />;
}

function PrivacyFR() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <button
          onClick={() => router.history.back()}
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Retour
        </button>

        <h1 className="mb-2 text-3xl font-bold">Politique de confidentialité</h1>
        <p className="mb-10 text-sm text-muted-foreground">Dernière mise à jour : 15 juin 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">1. Qui sommes-nous ?</h2>
            <p>
              ReadingTK est un service de suivi de lectures (mangas, manhuas, novels) accessible à
              l'adresse{" "}
              <a href="https://readingtk.net" className="text-accent hover:underline">
                readingtk.net
              </a>
              . Le service est opéré par <strong className="text-foreground">TKISSDev</strong>{" "}
              (contact : contact@tkissdev.com). ReadingTK est un projet open source (licence MIT) —
              le code source est disponible sur{" "}
              <a
                href="https://github.com/tkissdev/readingtk"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                GitHub
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">2. Données collectées</h2>
            <p className="mb-3">
              Nous collectons uniquement les données nécessaires au fonctionnement du service :
            </p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Adresse e-mail</strong> — utilisée pour
                l'authentification et les notifications.
              </li>
              <li>
                <strong className="text-foreground">Données OAuth</strong> — si vous vous connectez
                via Google, Discord ou Twitch : identifiant, adresse e-mail et avatar fournis par
                ces services.
              </li>
              <li>
                <strong className="text-foreground">Données de lecture</strong> — titres ajoutés,
                sources, chapitres lus, notifications configurées.
              </li>
              <li>
                <strong className="text-foreground">Extension navigateur</strong> — la liste de vos
                sources manga/manhwa pour la détection automatique des chapitres. Aucune autre page
                visitée n'est collectée.
              </li>
            </ul>
            <p className="mt-3">
              Nous ne collectons pas : localisation, données bancaires, comportement de navigation,
              publicité.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              3. Finalité du traitement
            </h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>Authentification et accès sécurisé à votre compte</li>
              <li>Stockage et affichage de votre bibliothèque de lecture</li>
              <li>Détection et notification de nouveaux chapitres</li>
              <li>Protection contre les abus (CAPTCHA Cloudflare Turnstile)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">4. Base légale (RGPD)</h2>
            <p>
              Le traitement repose sur votre{" "}
              <strong className="text-foreground">consentement</strong> (art. 6.1.a RGPD), exprimé
              lors de la création de votre compte, et sur l'
              <strong className="text-foreground">exécution du contrat</strong> de service (art.
              6.1.b RGPD).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              5. Stockage et hébergement
            </h2>
            <p>
              Les données sont stockées dans <strong className="text-foreground">Supabase</strong>{" "}
              (base de données PostgreSQL hébergée sur AWS eu-west-1 — Irlande). L'application web
              est hébergée sur <strong className="text-foreground">Vercel</strong> (serveurs en
              Europe et USA). Ces prestataires sont soumis à des garanties de protection des données
              (DPA, clauses contractuelles types).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              6. Durée de conservation
            </h2>
            <p>
              Vos données sont conservées tant que votre compte est actif. À la suppression de votre
              compte, l'ensemble de vos données est effacé dans un délai de 30 jours.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">7. Partage des données</h2>
            <p>
              Nous ne vendons ni ne partageons vos données avec des tiers à des fins commerciales.
              Seuls les prestataires techniques indispensables (Supabase, Vercel, Cloudflare
              Turnstile) traitent vos données, dans le strict cadre de la fourniture du service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">8. Vos droits (RGPD)</h2>
            <p className="mb-3">Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Accès</strong> — obtenir une copie de vos
                données
              </li>
              <li>
                <strong className="text-foreground">Rectification</strong> — corriger des données
                inexactes
              </li>
              <li>
                <strong className="text-foreground">Suppression</strong> — effacer votre compte et
                toutes vos données
              </li>
              <li>
                <strong className="text-foreground">Portabilité</strong> — exporter vos données dans
                un format lisible (JSON disponible dans les paramètres)
              </li>
              <li>
                <strong className="text-foreground">Opposition</strong> — vous opposer à un
                traitement
              </li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous à :{" "}
              <a href="mailto:contact@tkissdev.com" className="text-accent hover:underline">
                contact@tkissdev.com
              </a>
              . Délai de réponse : 30 jours maximum.
            </p>
            <p className="mt-3">
              Vous pouvez également adresser une réclamation à la{" "}
              <strong className="text-foreground">CNIL</strong> :{" "}
              <a
                href="https://www.cnil.fr/fr/plaintes"
                className="text-accent hover:underline"
                target="_blank"
                rel="noreferrer"
              >
                cnil.fr/fr/plaintes
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">9. Cookies et traceurs</h2>
            <p>
              ReadingTK n'utilise pas de cookies de suivi ni de publicité. Des données sont stockées
              localement dans votre navigateur (
              <code className="rounded bg-muted px-1">localStorage</code>) uniquement pour mémoriser
              vos préférences d'interface (langue, tri, état de la barre latérale).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              10. Extension navigateur
            </h2>
            <p>
              L'extension Chrome/Firefox ReadingTK accède uniquement aux pages des sources manga que
              vous avez configurées dans votre bibliothèque. Elle ne collecte, ne stocke et ne
              transmet aucune autre donnée de navigation. Les métadonnées de chapitres détectées
              (titre, numéro, URL) sont envoyées exclusivement à votre compte ReadingTK.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">11. Modifications</h2>
            <p>
              Cette politique peut être mise à jour. En cas de changement significatif, vous en
              serez informé par e-mail ou via une notification sur le site.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">12. Contact</h2>
            <p>
              Pour toute question relative à cette politique :{" "}
              <a href="mailto:contact@tkissdev.com" className="text-accent hover:underline">
                contact@tkissdev.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}

function PrivacyEN() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-16">
        <button
          onClick={() => router.history.back()}
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back
        </button>

        <h1 className="mb-2 text-3xl font-bold">Privacy Policy</h1>
        <p className="mb-10 text-sm text-muted-foreground">Last updated: June 15, 2025</p>

        <div className="space-y-8 text-sm leading-relaxed text-muted-foreground">
          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">1. Who we are</h2>
            <p>
              ReadingTK is a reading tracker for manga, manhwa, and novels, available at{" "}
              <a href="https://readingtk.net" className="text-accent hover:underline">
                readingtk.net
              </a>
              . The service is operated by <strong className="text-foreground">TKISSDev</strong>{" "}
              (contact: contact@tkissdev.com). ReadingTK is an open source project (MIT license) —
              the source code is available on{" "}
              <a
                href="https://github.com/tkissdev/readingtk"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                GitHub
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">2. Data we collect</h2>
            <p className="mb-3">We only collect data required to operate the service:</p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Email address</strong> — used for authentication
                and notifications.
              </li>
              <li>
                <strong className="text-foreground">OAuth data</strong> — if you sign in via Google,
                Discord, or Twitch: the identifier, email address, and avatar provided by those
                services.
              </li>
              <li>
                <strong className="text-foreground">Reading data</strong> — titles added, sources,
                chapters read, notifications configured.
              </li>
              <li>
                <strong className="text-foreground">Browser extension</strong> — the list of your
                manga/manhwa sources for automatic chapter detection. No other visited page is
                collected.
              </li>
            </ul>
            <p className="mt-3">
              We do not collect: location, payment data, browsing behavior, or advertising data.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              3. Purpose of processing
            </h2>
            <ul className="ml-4 list-disc space-y-2">
              <li>Authentication and secure access to your account</li>
              <li>Storage and display of your reading library</li>
              <li>Detection and notification of new chapters</li>
              <li>Abuse protection (Cloudflare Turnstile CAPTCHA)</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">4. Legal basis (GDPR)</h2>
            <p>
              Processing is based on your <strong className="text-foreground">consent</strong> (Art.
              6.1.a GDPR), given when creating your account, and on the{" "}
              <strong className="text-foreground">performance of the service contract</strong> (Art.
              6.1.b GDPR).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">5. Storage and hosting</h2>
            <p>
              Data is stored in <strong className="text-foreground">Supabase</strong> (PostgreSQL
              database hosted on AWS eu-west-1 — Ireland). The web application is hosted on{" "}
              <strong className="text-foreground">Vercel</strong> (servers in Europe and USA). These
              providers are bound by data protection agreements (DPA, standard contractual clauses).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">6. Retention period</h2>
            <p>
              Your data is retained for as long as your account is active. Upon account deletion,
              all your data is erased within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">7. Data sharing</h2>
            <p>
              We do not sell or share your data with third parties for commercial purposes. Only
              essential technical providers (Supabase, Vercel, Cloudflare Turnstile) process your
              data, strictly within the scope of providing the service.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">8. Your rights (GDPR)</h2>
            <p className="mb-3">Under GDPR, you have the following rights:</p>
            <ul className="ml-4 list-disc space-y-2">
              <li>
                <strong className="text-foreground">Access</strong> — obtain a copy of your data
              </li>
              <li>
                <strong className="text-foreground">Rectification</strong> — correct inaccurate data
              </li>
              <li>
                <strong className="text-foreground">Erasure</strong> — delete your account and all
                your data
              </li>
              <li>
                <strong className="text-foreground">Portability</strong> — export your data in a
                readable format (JSON export available in settings)
              </li>
              <li>
                <strong className="text-foreground">Objection</strong> — object to processing
              </li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at:{" "}
              <a href="mailto:contact@tkissdev.com" className="text-accent hover:underline">
                contact@tkissdev.com
              </a>
              . Response time: maximum 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">
              9. Cookies and trackers
            </h2>
            <p>
              ReadingTK does not use tracking or advertising cookies. Data is stored locally in your
              browser (<code className="rounded bg-muted px-1">localStorage</code>) only to remember
              your interface preferences (language, sort order, sidebar state).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">10. Browser extension</h2>
            <p>
              The ReadingTK Chrome/Firefox extension only accesses the manga source pages you have
              configured in your library. It does not collect, store, or transmit any other browsing
              data. Detected chapter metadata (title, number, URL) is sent exclusively to your
              ReadingTK account.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">11. Changes</h2>
            <p>
              This policy may be updated. In case of significant changes, you will be notified by
              email or via an in-app notification.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-foreground">12. Contact</h2>
            <p>
              For any questions about this policy:{" "}
              <a href="mailto:contact@tkissdev.com" className="text-accent hover:underline">
                contact@tkissdev.com
              </a>
            </p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}

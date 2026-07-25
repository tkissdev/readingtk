import { useState } from "react";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Bug } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import { Footer } from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/report-bug")({
  head: () => ({
    meta: [{ title: "Déclarer un bug · ReadingTK" }],
  }),
  component: ReportBugPage,
});

const AREAS = ["Site web", "Extension Chrome", "Extension Firefox", "Application Windows"] as const;
const AREAS_EN = ["Website", "Chrome extension", "Firefox extension", "Windows app"] as const;

function ReportBugPage() {
  const { lang } = useI18n();
  return lang === "en" ? <ReportBugForm lang="en" /> : <ReportBugForm lang="fr" />;
}

function ReportBugForm({ lang }: { lang: "fr" | "en" }) {
  const router = useRouter();
  const isFr = lang === "fr";
  const areaOptions = isFr ? AREAS : AREAS_EN;

  const [areas, setAreas] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const [expected, setExpected] = useState("");
  const [environment, setEnvironment] = useState("");
  const [windowsVersion, setWindowsVersion] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ url: string; number: number } | null>(null);

  function toggleArea(area: string) {
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (areas.length === 0 || !title.trim() || !description.trim()) {
      toast.error(
        isFr
          ? "Merci de remplir au moins la zone concernée, le titre et la description."
          : "Please fill in at least the area, title, and description.",
      );
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("report-bug", {
        body: {
          areas,
          title,
          description,
          steps,
          expected,
          environment,
          windowsVersion,
          contactEmail,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success(isFr ? "Signalement envoyé, merci !" : "Report sent, thank you!");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : isFr ? "Échec de l'envoi." : "Failed to send.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <button
          onClick={() => router.history.back()}
          className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          ← {isFr ? "Retour" : "Back"}
        </button>

        <div className="mb-6 flex items-center gap-3">
          <Bug className="h-7 w-7 text-accent" />
          <h1 className="text-3xl font-bold">{isFr ? "Déclarer un bug" : "Report a bug"}</h1>
        </div>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          {isFr
            ? "Ce formulaire crée directement une issue sur le dépôt GitHub de ReadingTK, pour que tous les signalements soient centralisés au même endroit."
            : "This form creates an issue directly on ReadingTK's GitHub repository, so all reports are centralized in one place."}
        </p>

        {result ? (
          <div className="rounded-xl border border-border bg-card/60 p-6 text-center">
            <p className="mb-3 text-sm">
              {isFr ? "Ton signalement a été créé :" : "Your report has been created:"}
            </p>
            <a
              href={result.url}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              {isFr
                ? `Voir l'issue #${result.number} sur GitHub →`
                : `View issue #${result.number} on GitHub →`}
            </a>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <label className="mb-2 block text-sm font-medium">
                {isFr ? "Où ça se passe" : "Where it happens"}
              </label>
              <div className="flex flex-wrap gap-2">
                {areaOptions.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => toggleArea(area)}
                    className={`rounded-full px-3 py-1.5 text-xs transition ${areas.includes(area) ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">{isFr ? "Titre" : "Title"}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={isFr ? "Résumé court du problème" : "Short summary of the issue"}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {isFr ? "Description du bug" : "Bug description"}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {isFr ? "Étapes pour reproduire" : "Steps to reproduce"}
              </label>
              <textarea
                value={steps}
                onChange={(e) => setSteps(e.target.value)}
                rows={3}
                placeholder={
                  isFr ? "1. Aller sur...\n2. Cliquer sur..." : "1. Go to...\n2. Click on..."
                }
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {isFr ? "Comportement attendu" : "Expected behavior"}
              </label>
              <textarea
                value={expected}
                onChange={(e) => setExpected(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {isFr ? "Navigateur/OS" : "Browser/OS"}
                </label>
                <input
                  value={environment}
                  onChange={(e) => setEnvironment(e.target.value)}
                  placeholder="Chrome 128 / Windows 11"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium">
                  {isFr ? "Version app Windows" : "Windows app version"}
                </label>
                <input
                  value={windowsVersion}
                  onChange={(e) => setWindowsVersion(e.target.value)}
                  placeholder="1.0.7"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                {isFr ? "Email de contact (facultatif)" : "Contact email (optional)"}
              </label>
              <input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="vous@exemple.com"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="mt-2 rounded-md px-6 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}
            >
              {submitting
                ? isFr
                  ? "Envoi…"
                  : "Sending…"
                : isFr
                  ? "Envoyer le signalement"
                  : "Send report"}
            </button>
          </form>
        )}
      </div>
      <Footer />
    </div>
  );
}

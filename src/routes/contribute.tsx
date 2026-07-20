import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useI18n } from "@/i18n";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/contribute")({
  head: () => ({
    meta: [
      { title: "Faire un don · ReadingTK" },
    ],
  }),
  component: ContributePage,
});

function ContributePage() {
  const { lang } = useI18n();
  return lang === "en" ? <ContributeEN /> : <ContributeFR />;
}

function ContributeFR() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <button onClick={() => router.history.back()} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Retour
        </button>

        <div className="mb-6 flex items-center gap-3">
          <Heart className="h-7 w-7 text-accent" />
          <h1 className="text-3xl font-bold">Faire un don</h1>
        </div>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          ReadingTK est un projet gratuit, développé et maintenu sur mon temps libre.
          Si le service vous est utile et que vous souhaitez soutenir son développement, vous pourrez bientôt le faire ici.
        </p>

        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Les moyens de faire un don seront bientôt disponibles sur cette page.
        </div>
      </div>
      <Footer />
    </div>
  );
}

function ContributeEN() {
  const router = useRouter();
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <button onClick={() => router.history.back()} className="mb-10 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          ← Back
        </button>

        <div className="mb-6 flex items-center gap-3">
          <Heart className="h-7 w-7 text-accent" />
          <h1 className="text-3xl font-bold">Donate</h1>
        </div>

        <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
          ReadingTK is a free project, built and maintained in my spare time.
          If the service is useful to you and you'd like to support its development, you'll soon be able to do so here.
        </p>

        <div className="rounded-xl border border-dashed border-border bg-card/60 p-8 text-center text-sm text-muted-foreground">
          Donation options will be available on this page soon.
        </div>
      </div>
      <Footer />
    </div>
  );
}

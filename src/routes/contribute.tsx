import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Heart, Coffee, CreditCard, HeartHandshake, Github } from "lucide-react";
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

// ── Plateformes de don ─────────────────────────────────────────────────────────
// href: null tant que la plateforme n'est pas encore configurée (carte grisée, non cliquable).

type DonationOption = {
  key: string;
  label: string;
  color: string;
  icon: React.ReactNode;
  href: string | null;
};

const DONATION_OPTIONS: DonationOption[] = [
  {
    key: "paypal",
    label: "PayPal",
    color: "#0070BA",
    icon: <PayPalIcon />,
    href: "https://www.paypal.com/donate/?hosted_button_id=WLS3B4QDPHU8N",
  },
  { key: "kofi", label: "Ko-fi", color: "#FF5E5B", icon: <Coffee className="h-5 w-5" />, href: "https://ko-fi.com/tkissdev" },
  { key: "bmc", label: "Buy Me a Coffee", color: "#FFDD00", icon: <Coffee className="h-5 w-5" />, href: "https://buymeacoffee.com/tkissdev" },
  { key: "stripe", label: "Stripe", color: "#635BFF", icon: <CreditCard className="h-5 w-5" />, href: "https://donate.stripe.com/bJeeVe4wt4IM7IkbAK24000" },
  { key: "liberapay", label: "Liberapay", color: "#F6C915", icon: <HeartHandshake className="h-5 w-5" />, href: "https://liberapay.com/TKissDev/donate" },
  { key: "patreon", label: "Patreon", color: "#FF424D", icon: <Heart className="h-5 w-5" />, href: "https://www.patreon.com/TKissDev" },
  { key: "ghsponsors", label: "GitHub Sponsors", color: "#EA4AAA", icon: <Github className="h-5 w-5" />, href: null },
];

function PayPalIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7.5 20.5H4.8a.6.6 0 0 1-.6-.7l2.6-16.4a.9.9 0 0 1 .9-.75h6.4c3 0 5.1 1.6 4.6 4.6-.5 3.4-2.9 5-6.1 5H9.9l-1 6.5a.9.9 0 0 1-.9.75Z" fill="#fff" />
    </svg>
  );
}

function DonationGrid({ comingSoonLabel }: { comingSoonLabel: string }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {DONATION_OPTIONS.map((opt) => {
        const content = (
          <>
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
              style={{ background: opt.href ? opt.color : "var(--muted, #444)" }}
            >
              {opt.icon}
            </div>
            <div>
              <div className="font-semibold">{opt.label}</div>
              {!opt.href && (
                <div className="text-xs text-muted-foreground">{comingSoonLabel}</div>
              )}
            </div>
          </>
        );
        return opt.href ? (
          <a
            key={opt.key}
            href={opt.href}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-xl border border-border bg-card/60 p-4 transition hover:border-accent/60"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            {content}
          </a>
        ) : (
          <div
            key={opt.key}
            className="flex cursor-not-allowed items-center gap-3 rounded-xl border border-border bg-card/30 p-4 opacity-50"
          >
            {content}
          </div>
        );
      })}
    </div>
  );
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
          Si le service vous est utile et que vous souhaitez soutenir son développement, voici les moyens disponibles.
        </p>

        <DonationGrid comingSoonLabel="Bientôt disponible" />
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
          If the service is useful to you and you'd like to support its development, here are the available options.
        </p>

        <DonationGrid comingSoonLabel="Coming soon" />
      </div>
      <Footer />
    </div>
  );
}

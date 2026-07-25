import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useI18n, LanguageSwitcher } from "@/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Paramètres · ReadingTK" }] }),
  component: SettingsPage,
});

type Settings = {
  check_frequency_hours: number | null;
  in_app_notifications_enabled: boolean;
  email_notifications_enabled: boolean;
  chapter_format: string;
  default_type: string;
  default_status: string;
  bookmarks_ignore_duplicates: boolean;
  bookmarks_group_by_domain: boolean;
  last_global_check_at: string | null;
};

function SettingsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const { data } = useQuery({
    queryKey: ["user-settings-full"],
    queryFn: async () =>
      (await supabase.from("user_settings").select("*").maybeSingle()).data as Settings | null,
  });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("user_settings")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("user_id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("set.saved"));
      qc.invalidateQueries({ queryKey: ["user-settings-full"] });
      qc.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  if (!form) return <div className="p-6 text-sm text-muted-foreground">{t("set.loading")}</div>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm({ ...form, [key]: value });
    save.mutate({ [key]: value } as Partial<Settings>);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">{t("set.title")}</h1>

      <AccountSection />

      <Section title={t("set.language")}>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("set.languageDesc")}</span>
          <LanguageSwitcher size={22} />
        </div>
      </Section>

      <Section title={t("set.notifications")}>
        <Toggle
          label={t("set.inApp")}
          value={form.in_app_notifications_enabled}
          onChange={(v) => update("in_app_notifications_enabled", v)}
        />
        <div className="mt-3 flex items-center justify-between opacity-50">
          <span className="text-sm">
            {t("set.emailNotif")}{" "}
            <span className="ml-2 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase">
              {t("set.comingSoon")}
            </span>
          </span>
        </div>
      </Section>

      <Section title={t("set.chapterFormat")}>
        <div className="flex gap-2">
          {[
            { v: "numeric", l: t("set.formatNumeric") },
            { v: "text", l: t("set.formatText") },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => update("chapter_format", o.v)}
              className={`rounded-md px-3 py-2 text-xs ${form.chapter_format === o.v ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground"}`}
            >
              {o.l}
            </button>
          ))}
        </div>
      </Section>

      <Section title={t("set.defaults")}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">{t("filter.type")}</label>
            <select
              value={form.default_type}
              onChange={(e) => update("default_type", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm"
            >
              {["manga", "manhua", "manhwa", "novel", "autre"].map((ty) => (
                <option key={ty} value={ty}>
                  {ty}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">{t("filter.status")}</label>
            <select
              value={form.default_status}
              onChange={(e) => update("default_status", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm"
            >
              {["ongoing", "paused", "dropped", "completed"].map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Section>

      <Section title={t("set.bookmarksImport")}>
        <Toggle
          label={t("set.ignoreDuplicates")}
          value={form.bookmarks_ignore_duplicates}
          onChange={(v) => update("bookmarks_ignore_duplicates", v)}
        />
      </Section>
    </div>
  );
}

// Permet de définir un mot de passe, y compris pour un compte créé via Google/Discord/Twitch.
// Une fois défini, la connexion par email + mot de passe devient possible.
function AccountSection() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [providers, setProviders] = useState<string[]>([]);
  const [hasPassword, setHasPassword] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const u = data.user;
      if (!u) return;
      setEmail(u.email ?? "");
      const ids = u.identities ?? [];
      setProviders(ids.map((i) => i.provider));
      setHasPassword(ids.some((i) => i.provider === "email"));
    });
  }, []);

  async function submit() {
    if (pw.length < 6) {
      toast.error(t("set.pwTooShort"));
      return;
    }
    if (pw !== pw2) {
      toast.error(t("set.pwMismatch"));
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) {
      toast.error(error.message || t("set.pwFail"));
      return;
    }
    toast.success(t("set.pwSaved"));
    setPw("");
    setPw2("");
    setHasPassword(true);
  }

  const PROVIDER_LABELS: Record<string, string> = {
    google: "Google",
    discord: "Discord",
    twitch: "Twitch",
    email: "Email",
  };
  const socialProviders = providers.filter((p) => p !== "email");

  return (
    <Section title={t("set.account")}>
      <div className="space-y-1 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">{t("set.emailLabel")}</span>
          <span className="font-medium">{email || "—"}</span>
        </div>
        {socialProviders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground">{t("set.connections")}</span>
            {socialProviders.map((p) => (
              <span key={p} className="rounded-full bg-secondary/60 px-2 py-0.5 text-[11px]">
                {PROVIDER_LABELS[p] ?? p}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-border/40 pt-4">
        <p className="text-sm font-medium">
          {hasPassword ? t("set.changePassword") : t("set.setPassword")}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {hasPassword ? t("set.changePasswordDesc") : t("set.setPasswordDesc")}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <input
            type="password"
            placeholder={t("set.newPassword")}
            minLength={6}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
          <input
            type="password"
            placeholder={t("set.confirmPassword")}
            minLength={6}
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            className="w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm outline-none focus:border-ring focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={submit}
          disabled={saving || !pw || !pw2}
          className="mt-3 rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}
        >
          {saving ? "..." : hasPassword ? t("common.save") : t("set.setPasswordBtn")}
        </button>
      </div>
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-6 rounded-xl border border-border/60 bg-card/40 p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button
        onClick={() => onChange(!value)}
        title={value ? t("common.disable", { label }) : t("common.enable", { label })}
        className={`h-5 w-10 rounded-full ${value ? "bg-accent" : "bg-secondary"}`}
      >
        <span
          className={`block h-4 w-4 rounded-full bg-background transition ${value ? "translate-x-5" : "translate-x-1"}`}
        />
      </button>
    </div>
  );
}

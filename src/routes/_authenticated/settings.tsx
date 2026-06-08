import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";

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
  const { data } = useQuery({
    queryKey: ["user-settings-full"],
    queryFn: async () => (await supabase.from("user_settings").select("*").maybeSingle()).data as Settings | null,
  });
  const [form, setForm] = useState<Settings | null>(null);
  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async (patch: Partial<Settings>) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("user_settings").update({ ...patch, updated_at: new Date().toISOString() }).eq("user_id", u.user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Paramètres enregistrés");
      qc.invalidateQueries({ queryKey: ["user-settings-full"] });
      qc.invalidateQueries({ queryKey: ["user-settings"] });
    },
  });

  if (!form) return <div className="p-6 text-sm text-muted-foreground">Chargement...</div>;

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setForm({ ...form, [key]: value });
    save.mutate({ [key]: value } as Partial<Settings>);
  };

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Paramètres</h1>
      {form.last_global_check_at && (
        <p className="mt-1 text-xs text-muted-foreground">Dernière vérification : {new Date(form.last_global_check_at).toLocaleString()}</p>
      )}

      <Section title="Fréquence de check">
        <label className="text-xs text-muted-foreground">Toutes les X heures (vide = manuel uniquement)</label>
        <input
          type="number" min={0} value={form.check_frequency_hours ?? ""}
          onChange={(e) => update("check_frequency_hours", e.target.value ? parseInt(e.target.value) : null)}
          className="mt-1 w-32 rounded-md border border-input bg-input/50 px-3 py-2 text-sm"
        />
      </Section>

      <Section title="Notifications">
        <Toggle label="Notifications in-app" value={form.in_app_notifications_enabled} onChange={(v) => update("in_app_notifications_enabled", v)} />
        <div className="mt-3 flex items-center justify-between opacity-50">
          <span className="text-sm">Notifications Email <span className="ml-2 rounded-full bg-secondary/60 px-2 py-0.5 text-[10px] uppercase">Coming soon</span></span>
          <span className="text-xs text-muted-foreground">À venir</span>
        </div>
      </Section>

      <Section title="Format de chapitre">
        <div className="flex gap-2">
          {[
            { v: "numeric", l: "Numérique (12, 12.5)" },
            { v: "text", l: "Texte (Chapitre 12)" },
          ].map((o) => (
            <button key={o.v} onClick={() => update("chapter_format", o.v)}
              className={`rounded-md px-3 py-2 text-xs ${form.chapter_format === o.v ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground"}`}>{o.l}</button>
          ))}
        </div>
      </Section>

      <Section title="Valeurs par défaut">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-muted-foreground">Type</label>
            <select value={form.default_type} onChange={(e) => update("default_type", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm">
              {["manga", "manhua", "novel", "autre"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Statut</label>
            <select value={form.default_status} onChange={(e) => update("default_status", e.target.value)}
              className="mt-1 w-full rounded-md border border-input bg-input/50 px-3 py-2 text-sm">
              {["ongoing", "paused", "dropped", "completed"].map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
      </Section>

      <Section title="Import bookmarks">
        <Toggle label="Ignorer les doublons" value={form.bookmarks_ignore_duplicates} onChange={(v) => update("bookmarks_ignore_duplicates", v)} />
        <div className="mt-3"></div>
        <Toggle label="Regrouper par domaine" value={form.bookmarks_group_by_domain} onChange={(v) => update("bookmarks_group_by_domain", v)} />
      </Section>
    </div>
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

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <button onClick={() => onChange(!value)} className={`h-5 w-10 rounded-full ${value ? "bg-accent" : "bg-secondary"}`}>
        <span className={`block h-4 w-4 rounded-full bg-background transition ${value ? "translate-x-5" : "translate-x-1"}`} />
      </button>
    </div>
  );
}

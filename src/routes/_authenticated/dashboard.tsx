import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { checkNow } from "@/lib/scrape.functions";
import { Search, Plus, Upload, Globe, Bell, RefreshCw, Settings, X, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Bibliothèque · ReadingTK" }] }),
  component: Dashboard,
});

type Title = {
  id: string; name: string; type: string | null; status: string | null;
  reading_progress: { last_chapter_read: string | null } | null;
  title_sources: { last_seen_chapter: string | null }[];
};

const TYPES = ["all", "manga", "manhua", "novel", "autre"];
const STATUSES = ["all", "ongoing", "paused", "dropped", "completed"];

function Dashboard() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const check = useServerFn(checkNow);

  const { data: titles, isLoading } = useQuery({
    queryKey: ["titles"],
    queryFn: async (): Promise<Title[]> => {
      const { data, error } = await supabase
        .from("titles")
        .select("id, name, type, status, reading_progress(last_chapter_read), title_sources(last_seen_chapter)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Title[]) ?? [];
    },
  });

  const checkMutation = useMutation({
    mutationFn: () => check({ data: {} }),
    onSuccess: (r) => {
      toast.success(`Check terminé : ${r.detected} nouveau(x) · ${r.titlesChecked} titres`);
      qc.invalidateQueries({ queryKey: ["titles"] });
      qc.invalidateQueries({ queryKey: ["notifications-unread"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const incrementMutation = useMutation({
    mutationFn: async ({ titleId, current }: { titleId: string; current: string | null }) => {
      const next = String((parseFloat(current ?? "0") || 0) + 1);
      const { error } = await supabase.from("reading_progress").upsert(
        { title_id: titleId, last_chapter_read: next, last_read_at: new Date().toISOString() },
        { onConflict: "title_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["titles"] }),
  });

  const filtered = (titles ?? []).filter((t) => {
    if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (type !== "all" && t.type !== type) return false;
    if (status !== "all" && t.status !== status) return false;
    return true;
  });

  const lastSeenOf = (t: Title) =>
    (t.title_sources || []).map((s) => s.last_seen_chapter).filter(Boolean)[0] ?? null;

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-card/60 px-3 py-2 min-w-64">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <button
          onClick={() => checkMutation.mutate()} disabled={checkMutation.isPending}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}
        >
          <RefreshCw className={`h-4 w-4 ${checkMutation.isPending ? "animate-spin" : ""}`} /> Check now
        </button>
        <Link to="/titles/add" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent/10">
          <Plus className="h-4 w-4" /> Ajouter
        </Link>
        <Link to="/import" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent/10">
          <Upload className="h-4 w-4" /> Importer
        </Link>
        <Link to="/sites" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent/10">
          <Globe className="h-4 w-4" /> Sites
        </Link>
        <Link to="/notifications" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent/10">
          <Bell className="h-4 w-4" />
        </Link>
        <Link to="/settings" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm hover:bg-accent/10">
          <Settings className="h-4 w-4" />
        </Link>
      </div>

      <div className="mb-4 flex flex-wrap gap-4 text-xs">
        <FilterGroup label="Type" value={type} options={TYPES} onChange={setType} />
        <FilterGroup label="Statut" value={status} options={STATUSES} onChange={setStatus} />
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">Chargement...</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-3 text-lg font-semibold">Votre bibliothèque est vide</h2>
          <p className="mt-1 text-sm text-muted-foreground">Ajoutez vos premiers titres pour commencer.</p>
          <Link to="/titles/add" className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <Plus className="h-4 w-4" /> Ajouter un titre
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40" style={{ boxShadow: "var(--shadow-card)" }}>
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left">Titre</th>
                <th className="px-3 py-3 text-left">Type</th>
                <th className="px-3 py-3 text-left">Statut</th>
                <th className="px-3 py-3 text-left">Lu</th>
                <th className="px-3 py-3 text-left">Détecté</th>
                <th className="px-3 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const lastRead = t.reading_progress?.last_chapter_read ?? null;
                const lastSeen = lastSeenOf(t);
                const isNew = lastSeen && (!lastRead || parseFloat(lastSeen) > parseFloat(lastRead || "0"));
                return (
                  <tr key={t.id} className="border-t border-border/40 hover:bg-secondary/30">
                    <td className="px-4 py-3 font-medium">
                      <button onClick={() => setOpenId(t.id)} className="text-left hover:text-accent">{t.name}</button>
                    </td>
                    <td className="px-3 py-3 text-xs text-muted-foreground">{t.type ?? "—"}</td>
                    <td className="px-3 py-3 text-xs">
                      <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-muted-foreground">{t.status ?? "—"}</span>
                    </td>
                    <td className="px-3 py-3 text-xs">{lastRead ?? "—"}</td>
                    <td className="px-3 py-3 text-xs">
                      {lastSeen ?? "—"}
                      {isNew && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">NEW</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <button
                        onClick={() => incrementMutation.mutate({ titleId: t.id, current: lastRead })}
                        className="rounded-md border border-border px-2 py-1 text-xs hover:bg-accent/10"
                      >+1</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openId && <TitleDrawer titleId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button
            key={o} onClick={() => onChange(o)}
            className={`rounded-full px-2.5 py-1 text-xs transition ${value === o ? "bg-accent text-accent-foreground" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}
          >{o}</button>
        ))}
      </div>
    </div>
  );
}

function TitleDrawer({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["title-detail", titleId],
    queryFn: async () => {
      const [title, progress, sources, chapters] = await Promise.all([
        supabase.from("titles").select("*").eq("id", titleId).maybeSingle(),
        supabase.from("reading_progress").select("*").eq("title_id", titleId).maybeSingle(),
        supabase.from("title_sources").select("*, sites(name, base_url)").eq("title_id", titleId),
        supabase.from("chapters").select("*, sites(name)").eq("title_id", titleId).order("detected_at", { ascending: false }).limit(20),
      ]);
      return {
        title: title.data, progress: progress.data,
        sources: sources.data ?? [], chapters: chapters.data ?? [],
      };
    },
  });
  const [lastRead, setLastRead] = useState("");

  const saveProgress = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from("reading_progress").upsert(
        { title_id: titleId, last_chapter_read: value, last_read_at: new Date().toISOString() },
        { onConflict: "title_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Progression enregistrée");
      qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
      qc.invalidateQueries({ queryKey: ["titles"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("titles").update({ status }).eq("id", titleId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["titles"] }),
  });

  const deleteTitle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("titles").delete().eq("id", titleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Titre supprimé");
      qc.invalidateQueries({ queryKey: ["titles"] });
      onClose();
    },
  });

  if (!data?.title) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border/60 bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{data.title.type ?? "titre"}</div>
            <h2 className="mt-1 text-2xl font-bold">{data.title.name}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-muted-foreground">Dernier chapitre lu</label>
          <div className="mt-1 flex gap-2">
            <input
              defaultValue={data.progress?.last_chapter_read ?? ""}
              onChange={(e) => setLastRead(e.target.value)}
              className="flex-1 rounded-md border border-input bg-input/50 px-3 py-2 text-sm"
            />
            <button
              onClick={() => saveProgress.mutate(lastRead || data.progress?.last_chapter_read || "")}
              className="rounded-md px-4 text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)" }}
            >Enregistrer</button>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-muted-foreground">Statut</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["ongoing", "paused", "dropped", "completed"].map((s) => (
              <button key={s} onClick={() => updateStatus.mutate(s)}
                className={`rounded-full px-3 py-1 text-xs ${data.title?.status === s ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>{s}</button>
            ))}
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold">Sources ({data.sources.length})</h3>
          <ul className="mt-2 space-y-2">
            {data.sources.map((s) => (
              <li key={s.id} className="rounded-md border border-border/60 bg-secondary/30 p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{(s as { sites?: { name?: string } }).sites?.name ?? "Source"}</span>
                  {s.is_primary && <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent">primaire</span>}
                </div>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-accent hover:underline">{s.url}</a>
                {s.last_seen_chapter && <div className="mt-1 text-muted-foreground">Dernier détecté : {s.last_seen_chapter}</div>}
              </li>
            ))}
            {data.sources.length === 0 && <li className="text-xs text-muted-foreground">Aucune source. Ajoutez-en depuis « Ajouter ».</li>}
          </ul>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold">Chapitres détectés</h3>
          <ul className="mt-2 space-y-1.5">
            {data.chapters.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded-md bg-secondary/30 px-3 py-2 text-xs">
                <a href={c.chapter_url} target="_blank" rel="noopener noreferrer" className="hover:text-accent">{c.chapter_label}</a>
                <span className="text-muted-foreground">{new Date(c.detected_at).toLocaleDateString()}</span>
              </li>
            ))}
            {data.chapters.length === 0 && <li className="text-xs text-muted-foreground">Aucun chapitre détecté pour l'instant.</li>}
          </ul>
        </div>

        <div className="mt-10 border-t border-border/40 pt-4">
          <button onClick={() => { if (confirm("Supprimer ce titre ?")) deleteTitle.mutate(); }} className="text-xs text-destructive hover:underline">
            Supprimer ce titre
          </button>
        </div>
      </div>
    </div>
  );
}

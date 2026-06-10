import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, X, Sparkles, ExternalLink } from "lucide-react";
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


  const filtered = (titles ?? []).filter((t) => {
    if (query && !t.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (type !== "all" && t.type !== type) return false;
    if (status !== "all" && t.status !== status) return false;
    return true;
  });

  // Valeur consensuelle : la plus fréquente parmi les sources, la plus petite en cas d'égalité (évite les faux positifs)
  const lastSeenOf = (t: Title) => {
    const nums = (t.title_sources || [])
      .map((s) => parseFloat(s.last_seen_chapter ?? ""))
      .filter((n) => !isNaN(n));
    if (!nums.length) return null;
    const counts: Record<number, number> = {};
    for (const n of nums) counts[n] = (counts[n] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    const topNums = Object.entries(counts)
      .filter(([, c]) => c === maxCount)
      .map(([n]) => parseFloat(n));
    return String(Math.min(...topNums));
  };

  return (
    <div className="p-6 pr-[600px]" onClick={() => { if (openId) setOpenId(null); }}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-card/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
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
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-full" />
              <col className="w-20" />
              <col className="w-24" />
              <col className="w-12" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">Titre</th>
                <th className="px-2 py-2 text-left">Type</th>
                <th className="px-2 py-2 text-left">Statut</th>
                <th className="px-2 py-2 text-left">Lu</th>
                <th className="px-2 py-2 text-left">Détecté</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const lastRead = t.reading_progress?.last_chapter_read ?? null;
                const lastSeen = lastSeenOf(t);
                const isNew = lastSeen && (!lastRead || parseFloat(lastSeen) > parseFloat(lastRead || "0"));
                return (
                  <tr
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); setOpenId(t.id); }}
                    className={`cursor-pointer border-t border-border/40 transition-colors hover:bg-secondary/30 ${openId === t.id ? "bg-secondary/40" : ""}`}
                  >
                    <td className="px-3 py-2 font-medium truncate">{t.name}</td>
                    <td className="px-2 py-2 text-xs text-muted-foreground truncate">{t.type ?? "—"}</td>
                    <td className="px-2 py-2 text-xs">
                      <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-muted-foreground">{t.status ?? "—"}</span>
                    </td>
                    <td className="px-2 py-2 text-xs">{lastRead ?? "—"}</td>
                    <td className="px-2 py-2 text-xs whitespace-nowrap">
                      {lastSeen ?? "—"}
                      {isNew && <span className="ml-1 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">NEW</span>}
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
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <div className="pointer-events-auto h-full w-full max-w-xl overflow-y-auto border-l border-border/60 bg-card p-6" onClick={(e) => e.stopPropagation()}>
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
          {(() => {
            // Construire la liste des last_seen_chapter par source
            const sourceValues = data.sources
              .filter((s) => s.last_seen_chapter)
              .map((s) => ({ source: s, num: parseFloat(s.last_seen_chapter!) }))
              .filter((x) => !isNaN(x.num));

            if (sourceValues.length === 0) {
              return (
                <div>
                  <h3 className="text-sm font-semibold">Dernier chapitre détecté</h3>
                  <p className="mt-2 text-xs text-muted-foreground">Aucun chapitre détecté pour l'instant.</p>
                </div>
              );
            }

            // Trouver la valeur la plus fréquente, à égalité prendre la plus petite (évite les faux positifs)
            const counts: Record<number, number> = {};
            for (const { num } of sourceValues) counts[num] = (counts[num] || 0) + 1;
            const maxCount = Math.max(...Object.values(counts));
            const topNums = Object.entries(counts)
              .filter(([, c]) => c === maxCount)
              .map(([n]) => parseFloat(n));
            const selectedNum = Math.min(...topNums);
            const selectedLabel = String(selectedNum);

            // Pour chaque source : chercher un lien spécifique dans chapters, sinon utiliser l'URL de base
            // Fallback 2 : l'URL stockée contient le bon numéro de chapitre même si le label est faux
            const chapterUrlRe = new RegExp(
              `(?:chapter|chap|ch|episode|ep)[-_/]?${selectedNum}(?:[^0-9]|$)`,
              "i"
            );
            const links = data.sources.map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const chap = (data.chapters as any[]).find(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (c: any) => c.site_id === (s as any).site_id &&
                  (c.chapter_label === selectedLabel || chapterUrlRe.test(c.chapter_url ?? ""))
              );
              return {
                siteName: (s as { sites?: { name?: string } }).sites?.name ?? "Source",
                url: (chap?.chapter_url as string | undefined) ?? s.url,
              };
            });

            return (
              <div>
                <h3 className="text-sm font-semibold">
                  Dernier chapitre détecté : <span className="text-accent">{selectedLabel}</span>
                </h3>
                <div className="mt-2 space-y-1.5">
                  {links.map((link, i) => (
                    <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs text-accent hover:underline break-all">
                      <ExternalLink className="shrink-0" style={{ width: 11, height: 11 }} />
                      <span>{link.siteName} — {link.url}</span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}
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

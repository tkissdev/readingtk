import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, X, Sparkles, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, GitMerge } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Bibliothèque · ReadingTK" }] }),
  component: Dashboard,
});

type Title = {
  id: string; name: string; type: string | null; status: string | null;
  aliases: string[] | null;
  reading_progress: { last_chapter_read: string | null } | null;
  title_sources: { last_seen_chapter: string | null }[];
};

const TYPES = ["all", "manga", "manhua", "novel", "autre"];
const STATUSES = ["all", "ongoing", "paused", "dropped", "completed"];

type SortBy = "name" | "type" | "status" | "lu" | "detected";

function SortIcon({ col, sortBy, sortDir }: { col: SortBy; sortBy: SortBy | null; sortDir: "asc" | "desc" }) {
  if (sortBy !== col) return <ChevronsUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline ml-1 h-3 w-3" />
    : <ChevronDown className="inline ml-1 h-3 w-3" />;
}

function Dashboard() {
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  // ── Merge mode ───────────────────────────────────────────────────────────────
  const [mergeMode, setMergeMode] = useState(false);
  const [mergeSelection, setMergeSelection] = useState<Set<string>>(new Set());
  const [showMergeModal, setShowMergeModal] = useState(false);

  function toggleMergeMode() {
    setMergeMode(m => {
      if (!m) setOpenId(null); // ferme le volet en entrant en mode fusion
      return !m;
    });
    setMergeSelection(new Set());
  }

  function toggleSelect(id: string) {
    setMergeSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function mergeTitles(primaryId: string) {
    const secondaryIds = [...mergeSelection].filter(id => id !== primaryId);
    if (!secondaryIds.length) return;
    try {
      const primaryTitle = (titles ?? []).find(t => t.id === primaryId)!;
      const secondaryTitles = (titles ?? []).filter(t => secondaryIds.includes(t.id));

      // Collecter tous les noms alternatifs
      const aliasesToAdd = secondaryTitles.flatMap(t => [t.name, ...(t.aliases ?? [])]);
      const newAliases = [...new Set([...(primaryTitle.aliases ?? []), ...aliasesToAdd])].filter(a => a !== primaryTitle.name);
      await supabase.from("titles").update({ aliases: newAliases }).eq("id", primaryId);

      for (const secId of secondaryIds) {
        // Déplacer les sources (éviter doublons par site)
        const { data: priSources } = await supabase.from("title_sources").select("site_id").eq("title_id", primaryId);
        const existingSiteIds = new Set((priSources ?? []).map(s => s.site_id));
        const { data: secSources } = await supabase.from("title_sources").select("id, site_id").eq("title_id", secId);
        for (const src of (secSources ?? [])) {
          if (!existingSiteIds.has(src.site_id)) {
            await supabase.from("title_sources").update({ title_id: primaryId }).eq("id", src.id);
            existingSiteIds.add(src.site_id);
          }
        }

        // Conserver le chapitre le plus élevé
        const { data: secProg } = await supabase.from("reading_progress").select("last_chapter_read").eq("title_id", secId).maybeSingle();
        if (secProg?.last_chapter_read) {
          const { data: priProg } = await supabase.from("reading_progress").select("last_chapter_read").eq("title_id", primaryId).maybeSingle();
          const secNum = parseFloat(secProg.last_chapter_read);
          const priNum = parseFloat(priProg?.last_chapter_read ?? "");
          if (!isNaN(secNum) && (isNaN(priNum) || secNum > priNum)) {
            await supabase.from("reading_progress").upsert(
              { title_id: primaryId, last_chapter_read: secProg.last_chapter_read, last_read_at: new Date().toISOString() },
              { onConflict: "title_id" }
            );
          }
        }

        // Déplacer les chapitres détectés
        await supabase.from("chapters").update({ title_id: primaryId }).eq("title_id", secId);

        // Nettoyer le titre secondaire
        await supabase.from("title_sources").delete().eq("title_id", secId);
        await supabase.from("reading_progress").delete().eq("title_id", secId);
        await supabase.from("notifications").delete().eq("title_id", secId);
        await supabase.from("titles").delete().eq("id", secId);
      }

      toast.success("Titres fusionnés");
      qc.invalidateQueries({ queryKey: ["titles"] });
      setMergeMode(false);
      setMergeSelection(new Set());
      setShowMergeModal(false);
    } catch (e) { toast.error((e as Error).message); }
  }

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: titles, isLoading } = useQuery({
    queryKey: ["titles"],
    queryFn: async (): Promise<Title[]> => {
      const { data, error } = await supabase
        .from("titles")
        .select("id, name, type, status, aliases, reading_progress(last_chapter_read), title_sources(last_seen_chapter)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Title[]) ?? [];
    },
  });

  // Valeur consensuelle : la plus fréquente parmi les sources, la plus petite en cas d'égalité
  const lastSeenOf = (t: Title) => {
    const nums = (t.title_sources || []).map((s) => parseFloat(s.last_seen_chapter ?? "")).filter((n) => !isNaN(n));
    if (!nums.length) return null;
    const counts: Record<number, number> = {};
    for (const n of nums) counts[n] = (counts[n] || 0) + 1;
    const maxCount = Math.max(...Object.values(counts));
    const topNums = Object.entries(counts).filter(([, c]) => c === maxCount).map(([n]) => parseFloat(n));
    return String(Math.min(...topNums));
  };

  const filtered = (titles ?? []).filter((t) => {
    if (query) {
      const q = query.toLowerCase();
      const nameMatch = t.name.toLowerCase().includes(q);
      const aliasMatch = (t.aliases ?? []).some(a => a.toLowerCase().includes(q));
      if (!nameMatch && !aliasMatch) return false;
    }
    if (type !== "all" && t.type !== type) return false;
    if (status !== "all" && t.status !== status) return false;
    return true;
  });

  const sorted = sortBy
    ? [...filtered].sort((a, b) => {
        let cmp = 0;
        if (sortBy === "name") cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        else if (sortBy === "type") cmp = (a.type ?? "").localeCompare(b.type ?? "", undefined, { sensitivity: "base" });
        else if (sortBy === "status") cmp = (a.status ?? "").localeCompare(b.status ?? "", undefined, { sensitivity: "base" });
        else if (sortBy === "lu") {
          const aV = parseFloat(a.reading_progress?.last_chapter_read ?? "");
          const bV = parseFloat(b.reading_progress?.last_chapter_read ?? "");
          cmp = (isNaN(aV) ? -1 : aV) - (isNaN(bV) ? -1 : bV);
        } else if (sortBy === "detected") {
          const aV = parseFloat(lastSeenOf(a) ?? "");
          const bV = parseFloat(lastSeenOf(b) ?? "");
          cmp = (isNaN(aV) ? -1 : aV) - (isNaN(bV) ? -1 : bV);
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  function handleSort(col: SortBy) {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("asc"); }
  }

  return (
    <div className="p-6 pr-[600px]" onClick={() => { if (openId && !mergeMode) setOpenId(null); }}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-card/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un titre ou variante..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap gap-4">
          <FilterGroup label="Type" value={type} options={TYPES} onChange={setType} />
          <FilterGroup label="Statut" value={status} options={STATUSES} onChange={setStatus} />
        </div>
        {!mergeMode ? (
          <button onClick={toggleMergeMode}
            className="flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition">
            <GitMerge className="h-3 w-3" /> Fusionner
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{mergeSelection.size} sélectionné(s)</span>
            {mergeSelection.size >= 2 && (
              <button onClick={() => setShowMergeModal(true)}
                className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground transition">
                Fusionner ({mergeSelection.size})
              </button>
            )}
            <button onClick={toggleMergeMode}
              className="rounded-full bg-secondary/40 px-3 py-1.5 text-muted-foreground hover:bg-secondary transition">
              Annuler
            </button>
          </div>
        )}
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
                {(["name", "type", "status", "lu", "detected"] as SortBy[]).map((col, i) => (
                  <th key={col} className={`${i === 0 ? "px-3" : "px-2"} py-2 text-left`}>
                    <button onClick={(e) => { e.stopPropagation(); handleSort(col); }}
                      className="flex items-center hover:text-foreground transition-colors">
                      {col === "name" ? "Titre" : col === "type" ? "Type" : col === "status" ? "Statut" : col === "lu" ? "Lu" : "Détecté"}
                      <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => {
                const lastRead = t.reading_progress?.last_chapter_read ?? null;
                const lastSeen = lastSeenOf(t);
                const isNew = lastSeen && (!lastRead || parseFloat(lastSeen) > parseFloat(lastRead || "0"));
                const isSelected = mergeSelection.has(t.id);
                return (
                  <tr key={t.id}
                    onClick={(e) => { e.stopPropagation(); if (mergeMode) toggleSelect(t.id); else setOpenId(t.id); }}
                    className={`cursor-pointer border-t border-border/40 transition-colors hover:bg-secondary/30 ${(!mergeMode && openId === t.id) || (mergeMode && isSelected) ? "bg-secondary/40" : ""}`}>
                    <td className="px-3 py-2 font-medium truncate">
                      {mergeMode && (
                        <input type="checkbox" checked={isSelected} onChange={() => {}} className="mr-2 pointer-events-none" />
                      )}
                      {t.name}
                      {(t.aliases ?? []).length > 0 && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground/60">
                          +{(t.aliases ?? []).length} variante{(t.aliases ?? []).length > 1 ? "s" : ""}
                        </span>
                      )}
                    </td>
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

      {!mergeMode && openId && <TitleDrawer titleId={openId} onClose={() => setOpenId(null)} />}

      {showMergeModal && (
        <MergeModal
          selectedTitles={(titles ?? []).filter(t => mergeSelection.has(t.id))}
          onConfirm={mergeTitles}
          onClose={() => setShowMergeModal(false)}
        />
      )}
    </div>
  );
}

// ── Merge Modal ────────────────────────────────────────────────────────────────

function MergeModal({ selectedTitles, onConfirm, onClose }: {
  selectedTitles: Title[];
  onConfirm: (primaryId: string) => Promise<void>;
  onClose: () => void;
}) {
  const [primaryId, setPrimaryId] = useState(selectedTitles[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const others = selectedTitles.filter(t => t.id !== primaryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">Fusionner les titres</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Choisissez le nom principal. Les autres seront conservés comme variantes de recherche.
        </p>
        <div className="mt-4 space-y-2">
          {selectedTitles.map(t => (
            <label key={t.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition ${primaryId === t.id ? "border-accent bg-accent/10" : "border-border/60 hover:bg-secondary/30"}`}>
              <input type="radio" name="primary" checked={primaryId === t.id} onChange={() => setPrimaryId(t.id)} className="accent-accent" />
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                {(t.aliases ?? []).length > 0 && (
                  <div className="text-xs text-muted-foreground">variantes : {(t.aliases ?? []).join(", ")}</div>
                )}
              </div>
            </label>
          ))}
        </div>
        {others.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            Seront conservés comme variantes : <span className="text-foreground/70">{others.map(t => `"${t.name}"`).join(", ")}</span>
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/40 transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(primaryId); setLoading(false); }}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            style={{ background: "var(--gradient-primary)" }}>
            {loading ? "..." : "Fusionner"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Filter Group ───────────────────────────────────────────────────────────────

function FilterGroup({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className={`rounded-full px-2.5 py-1 text-xs transition ${value === o ? "bg-accent text-accent-foreground" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Title Drawer ───────────────────────────────────────────────────────────────

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
      return { title: title.data, progress: progress.data, sources: sources.data ?? [], chapters: chapters.data ?? [] };
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

  const aliases: string[] = (data.title as { aliases?: string[] | null }).aliases ?? [];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <div className="pointer-events-auto h-full w-full max-w-xl overflow-y-auto border-l border-border/60 bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{data.title.type ?? "titre"}</div>
            <h2 className="mt-1 text-2xl font-bold">{data.title.name}</h2>
            {aliases.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {aliases.map((a, i) => (
                  <span key={i} className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs text-muted-foreground">{a}</span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-muted-foreground">Dernier chapitre lu</label>
          <div className="mt-1 flex gap-2">
            <input defaultValue={data.progress?.last_chapter_read ?? ""}
              onChange={(e) => setLastRead(e.target.value)}
              className="flex-1 rounded-md border border-input bg-input/50 px-3 py-2 text-sm" />
            <button onClick={() => saveProgress.mutate(lastRead || data.progress?.last_chapter_read || "")}
              className="rounded-md px-4 text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              Enregistrer
            </button>
          </div>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-muted-foreground">Statut</label>
          <div className="mt-2 flex flex-wrap gap-2">
            {["ongoing", "paused", "dropped", "completed"].map((s) => (
              <button key={s} onClick={() => updateStatus.mutate(s)}
                className={`rounded-full px-3 py-1 text-xs ${data.title?.status === s ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>
                {s}
              </button>
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
            {data.sources.length === 0 && <li className="text-xs text-muted-foreground">Aucune source.</li>}
          </ul>
        </div>

        <div className="mt-8">
          {(() => {
            const sourceValues = data.sources
              .filter((s) => s.last_seen_chapter)
              .map((s) => ({ source: s, num: parseFloat(s.last_seen_chapter!) }))
              .filter((x) => !isNaN(x.num));

            if (sourceValues.length === 0) return (
              <div>
                <h3 className="text-sm font-semibold">Dernier chapitre détecté</h3>
                <p className="mt-2 text-xs text-muted-foreground">Aucun chapitre détecté pour l'instant.</p>
              </div>
            );

            const counts: Record<number, number> = {};
            for (const { num } of sourceValues) counts[num] = (counts[num] || 0) + 1;
            const maxCount = Math.max(...Object.values(counts));
            const topNums = Object.entries(counts).filter(([, c]) => c === maxCount).map(([n]) => parseFloat(n));
            const selectedNum = Math.min(...topNums);
            const selectedLabel = String(selectedNum);

            const chapterUrlRe = new RegExp(`(?:chapter|chap|ch|episode|ep)[-_/]?${selectedNum}(?:[^0-9]|$)`, "i");
            const links = data.sources.map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const chap = (data.chapters as any[]).find((c: any) =>
                c.site_id === (s as any).site_id &&
                (c.chapter_label === selectedLabel || chapterUrlRe.test(c.chapter_url ?? ""))
              );
              const chapUrl = chap?.chapter_url as string | undefined;
              if (!chapUrl) return null;
              return { siteName: (s as { sites?: { name?: string } }).sites?.name ?? "Source", url: chapUrl };
            }).filter((l): l is { siteName: string; url: string } => l !== null);

            return (
              <div>
                <h3 className="text-sm font-semibold">Dernier chapitre détecté : <span className="text-accent">{selectedLabel}</span></h3>
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

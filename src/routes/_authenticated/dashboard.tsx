import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Plus, X, Sparkles, ExternalLink, ChevronUp, ChevronDown, ChevronsUpDown, GitMerge, RefreshCw, Trash2, Pencil, Check, Camera } from "lucide-react";
import { toast } from "sonner";
import { useI18n, statusLabel, typeLabel } from "@/i18n";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Bibliothèque · ReadingTK" }] }),
  component: Dashboard,
});

type Title = {
  id: string; name: string; type: string | null; status: string | null;
  aliases: string[] | null; cover_url: string | null;
  reading_progress: { last_chapter_read: string | null } | null;
  title_sources: { last_seen_chapter: string | null }[];
};

const TYPES = ["all", "manga", "manhua", "manhwa", "novel", "autre"];
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
  const { t: tr, lang } = useI18n();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [status, setStatus] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortBy | null>(() => (localStorage.getItem("dash-sort-col") as SortBy | null) ?? null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(() => (localStorage.getItem("dash-sort-dir") as "asc" | "desc") ?? "asc");

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

      toast.success(tr("dash.merged"));
      qc.invalidateQueries({ queryKey: ["titles"] });
      setMergeMode(false);
      setMergeSelection(new Set());
      setShowMergeModal(false);
    } catch (e) { toast.error((e as Error).message); }
  }

  // ── Realtime : mise à jour automatique après scraping ────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("rtk-dashboard-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "title_sources" }, () => {
        qc.invalidateQueries({ queryKey: ["titles"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "titles" }, () => {
        qc.invalidateQueries({ queryKey: ["titles"] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "user_settings" }, () => {
        qc.invalidateQueries({ queryKey: ["last-check"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  // ── Data ─────────────────────────────────────────────────────────────────────
  const { data: lastCheck } = useQuery({
    queryKey: ["last-check"],
    queryFn: async () => {
      const { data } = await supabase.from("user_settings").select("last_global_check_at").maybeSingle();
      return data?.last_global_check_at ?? null;
    },
  });

  const { data: titles, isLoading } = useQuery({
    queryKey: ["titles"],
    queryFn: async (): Promise<Title[]> => {
      const { data, error } = await supabase
        .from("titles")
        .select("id, name, type, status, aliases, cover_url, reading_progress(last_chapter_read), title_sources(last_seen_chapter)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as unknown as Title[]) ?? [];
    },
  });

  // Migration silencieuse : cache les couvertures encore sur des sites externes
  useEffect(() => {
    if (!titles) return;
    const external = titles.filter(
      (t) => t.cover_url && !t.cover_url.includes("supabase.co/storage")
    );
    if (!external.length) return;
    (async () => {
      for (const t of external) {
        try {
          await supabase.functions.invoke("cache-cover", {
            body: { imageUrl: t.cover_url, titleId: t.id },
          });
        } catch { /* silencieux */ }
      }
      if (external.length > 0) qc.invalidateQueries({ queryKey: ["titles"] });
    })();
  }, [titles?.map((t) => `${t.id}:${t.cover_url?.includes("supabase.co/storage") ? "" : (t.cover_url ?? "")}`).join("|")]);

  // Valeur max : le chapitre le plus élevé détecté parmi toutes les sources
  const lastSeenOf = (t: Title) => {
    const nums = (t.title_sources || []).map((s) => parseFloat(s.last_seen_chapter ?? "")).filter((n) => !isNaN(n));
    if (!nums.length) return null;
    return String(Math.max(...nums));
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
          const isNewA = (() => { const s = lastSeenOf(a); const r = a.reading_progress?.last_chapter_read; return s != null && (!r || parseFloat(s) > parseFloat(r || "0")); })();
          const isNewB = (() => { const s = lastSeenOf(b); const r = b.reading_progress?.last_chapter_read; return s != null && (!r || parseFloat(s) > parseFloat(r || "0")); })();
          if (isNewA !== isNewB) cmp = isNewA ? -1 : 1;
          else cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        }
        return sortDir === "asc" ? cmp : -cmp;
      })
    : filtered;

  function handleSort(col: SortBy) {
    if (sortBy === col) {
      const next = sortDir === "asc" ? "desc" : "asc";
      setSortDir(next);
      localStorage.setItem("dash-sort-dir", next);
    } else {
      setSortBy(col);
      setSortDir("asc");
      localStorage.setItem("dash-sort-col", col);
      localStorage.setItem("dash-sort-dir", "asc");
    }
  }

  return (
    <div className="p-6 pr-[600px]" onClick={() => { if (openId && !mergeMode) setOpenId(null); }}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-input bg-card/60 px-3 py-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={tr("dash.search")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          <FilterGroup label={tr("filter.type")} value={type} options={TYPES} onChange={setType} labelFn={(v) => typeLabel(tr, v)} />
          <FilterGroup label={tr("filter.status")} value={status} options={STATUSES} onChange={setStatus} labelFn={(v) => statusLabel(tr, v)} />
          <span className="text-muted-foreground/60">
            {tr("dash.titleCount", { n: filtered.length, total: (titles ?? []).length })}
          </span>
        </div>
        {!mergeMode ? (
          <div className="flex items-center gap-2">
            {lastCheck && (
              <span className="text-muted-foreground/60">
                {tr("dash.lastScraping", { date: new Date(lastCheck).toLocaleString(lang === "fr" ? "fr-FR" : "en-US", { dateStyle: "short", timeStyle: "short" }) })}
              </span>
            )}
            <button onClick={() => qc.invalidateQueries({ queryKey: ["titles"] })}
              className="flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition">
              <RefreshCw className="h-3 w-3" /> {tr("dash.refresh")}
            </button>
            <button onClick={toggleMergeMode}
              className="flex items-center gap-1.5 rounded-full bg-secondary/40 px-3 py-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground transition">
              <GitMerge className="h-3 w-3" /> {tr("dash.merge")}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">{tr("dash.selected", { n: mergeSelection.size })}</span>
            {mergeSelection.size >= 2 && (
              <button onClick={() => setShowMergeModal(true)}
                className="rounded-full bg-accent px-3 py-1.5 font-medium text-accent-foreground transition">
                {tr("dash.mergeN", { n: mergeSelection.size })}
              </button>
            )}
            <button onClick={toggleMergeMode}
              className="rounded-full bg-secondary/40 px-3 py-1.5 text-muted-foreground hover:bg-secondary transition">
              {tr("common.cancel")}
            </button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border border-border/60 bg-card/40 p-10 text-center text-sm text-muted-foreground">{tr("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-card/40 p-16 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-accent" />
          <h2 className="mt-3 text-lg font-semibold">{tr("dash.emptyTitle")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{tr("dash.emptyDesc")}</p>
          <Link to="/titles/add" className="mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
            <Plus className="h-4 w-4" /> {tr("nav.addTitle")}
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card/40" style={{ boxShadow: "var(--shadow-card)" }}>
          <table className="w-full table-fixed text-sm">
            <colgroup>
              <col className="w-24" />
              <col className="w-full" />
              <col className="w-24" />
              <col className="w-12" />
              <col className="w-24" />
            </colgroup>
            <thead className="bg-secondary/40 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                {(["type", "name", "status", "lu", "detected"] as SortBy[]).map((col, i) => (
                  <th key={col} className={`${i === 0 ? "px-3" : "px-2"} py-2 text-left`}>
                    <button onClick={(e) => { e.stopPropagation(); handleSort(col); }}
                      className="flex items-center hover:text-foreground transition-colors">
                      {col === "name" ? tr("dash.colTitle") : col === "type" ? tr("filter.type") : col === "status" ? tr("filter.status") : col === "lu" ? tr("dash.colRead") : tr("dash.colDetected")}
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
                    <td className="px-3 py-2">
                      <TypeBadge type={t.type} />
                    </td>
                    <td className="px-2 py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        {t.cover_url ? (
                          <img src={t.cover_url} alt="" loading="lazy"
                            className="h-9 w-6 shrink-0 rounded object-cover object-top" />
                        ) : (
                          <div className="h-9 w-6 shrink-0 rounded bg-secondary/60" />
                        )}
                        <span className="truncate font-medium">
                          {mergeMode && (
                            <input type="checkbox" checked={isSelected} onChange={() => {}} className="mr-2 pointer-events-none" />
                          )}
                          {t.name}
                          {(t.aliases ?? []).length > 0 && (
                            <span className="ml-1.5 text-xs font-normal text-muted-foreground/60">
                              {tr((t.aliases ?? []).length > 1 ? "dash.variantsMany" : "dash.variantsOne", { n: (t.aliases ?? []).length })}
                            </span>
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="px-2 py-2 text-xs">
                      <span className="rounded-full bg-secondary/60 px-2 py-0.5 text-muted-foreground">{t.status ? statusLabel(tr, t.status) : "—"}</span>
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
  const { t: tr } = useI18n();
  const [primaryId, setPrimaryId] = useState(selectedTitles[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const others = selectedTitles.filter(t => t.id !== primaryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{tr("merge.title")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          {tr("merge.desc")}
        </p>
        <div className="mt-4 space-y-2">
          {selectedTitles.map(t => (
            <label key={t.id}
              className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 transition ${primaryId === t.id ? "border-accent bg-accent/10" : "border-border/60 hover:bg-secondary/30"}`}>
              <input type="radio" name="primary" checked={primaryId === t.id} onChange={() => setPrimaryId(t.id)} className="accent-accent" />
              <div>
                <div className="text-sm font-medium">{t.name}</div>
                {(t.aliases ?? []).length > 0 && (
                  <div className="text-xs text-muted-foreground">{tr("merge.variants", { list: (t.aliases ?? []).join(", ") })}</div>
                )}
              </div>
            </label>
          ))}
        </div>
        {others.length > 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            {tr("merge.willKeep", { list: "" })}<span className="text-foreground/70">{others.map(t => `"${t.name}"`).join(", ")}</span>
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-md px-4 py-2 text-sm text-muted-foreground hover:bg-secondary/40 transition">
            {tr("common.cancel")}
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(primaryId); setLoading(false); }}
            disabled={loading}
            className="rounded-md px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            style={{ background: "var(--gradient-primary)" }}>
            {loading ? "..." : tr("dash.merge")}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Type Badge ────────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  manga:   "bg-accent/15 text-accent border border-accent/30",
  manhua:  "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
  manhwa:  "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  novel:   "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  autre:   "bg-secondary/60 text-muted-foreground border border-border/60",
};

function TypeBadge({ type }: { type: string | null }) {
  const { t: tr } = useI18n();
  const cls = TYPE_STYLES[type ?? ""] ?? TYPE_STYLES.autre;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide ${cls}`}>
      {type ? typeLabel(tr, type) : "—"}
    </span>
  );
}

// ── Filter Group ───────────────────────────────────────────────────────────────

function FilterGroup({ label, value, options, onChange, labelFn }: { label: string; value: string; options: string[]; onChange: (v: string) => void; labelFn?: (v: string) => string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{label}:</span>
      <div className="flex flex-wrap gap-1">
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)}
            className={`rounded-full px-2.5 py-1 text-xs transition ${value === o ? "bg-accent text-accent-foreground" : "bg-secondary/40 text-muted-foreground hover:bg-secondary"}`}>
            {labelFn ? labelFn(o) : o}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Title Drawer ───────────────────────────────────────────────────────────────

// Envoie un message au background de l'extension via le content script relay
function sendToExtension(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ error: "Extension non disponible" });
    }, 120000);
    function handler(event: MessageEvent) {
      if (event.data?.source !== "readingtk-extension") return;
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(event.data.response ?? null);
    }
    window.addEventListener("message", handler);
    window.postMessage({ source: "readingtk-web", requestId, payload }, "*");
  });
}

function TitleDrawer({ titleId, onClose }: { titleId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { t: tr } = useI18n();
  const [scraping, setScraping] = useState(false);
  const [editSrcId, setEditSrcId] = useState<string | null>(null);
  const [editUrl, setEditUrl] = useState("");
  const [editLastSeen, setEditLastSeen] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [autoDiscover, setAutoDiscover] = useState(false);
  const [editingCover, setEditingCover] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [addingSource, setAddingSource] = useState(false);
  const [newSourceUrl, setNewSourceUrl] = useState("");

  const { data: allSites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await supabase.from("sites").select("id,base_url,name")).data ?? [],
  });

  async function submitNewSource() {
    const url = newSourceUrl.trim();
    if (!url) return;
    const { data: userRes } = await supabase.auth.getUser();
    const userId = userRes.user!.id;
    let siteId: string | null = null;
    try {
      const u = new URL(url);
      const host = u.hostname;
      const matched = (allSites ?? []).find((s: { base_url: string }) => {
        try { return new URL(s.base_url).hostname === host; } catch { return false; }
      }) as { id: string } | undefined;
      if (matched) {
        siteId = matched.id;
      } else {
        const raw = host.replace(/^www\./, "").split(".")[0];
        const siteName = raw.charAt(0).toUpperCase() + raw.slice(1);
        const { data: newSite } = await supabase
          .from("sites")
          .insert({ user_id: userId, name: siteName, base_url: `${u.protocol}//${host}`, priority: 0, enabled: true })
          .select("id").single();
        siteId = newSite?.id ?? null;
      }
    } catch { /* siteId reste null */ }
    await supabase.from("title_sources").insert({ title_id: titleId, site_id: siteId, url, is_primary: false });
    qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
    qc.invalidateQueries({ queryKey: ["titles"] });
    setAddingSource(false);
    setNewSourceUrl("");
  }

  useEffect(() => {
    let cancelled = false;
    const requestId = Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => window.removeEventListener("message", handler), 3000);
    function handler(event: MessageEvent) {
      if (event.data?.source !== "readingtk-extension") return;
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      if (!cancelled && event.data.response) setAutoDiscover(event.data.response.auto_discover === true);
    }
    window.addEventListener("message", handler);
    window.postMessage({ source: "readingtk-web", requestId, payload: { type: "GET_STATUS" } }, "*");
    return () => { cancelled = true; clearTimeout(timeout); window.removeEventListener("message", handler); };
  }, []);

  function startEdit(s: { id: string; url: string | null; last_seen_chapter: string | null }) {
    setEditSrcId(s.id);
    setEditUrl(s.url ?? "");
    setEditLastSeen(s.last_seen_chapter ?? "");
  }

  async function saveEdit() {
    if (!editSrcId) return;
    await supabase.from("title_sources").update({
      url: editUrl.trim() || null,
      last_seen_chapter: editLastSeen.trim() || null,
      last_error: null,
    }).eq("id", editSrcId);
    setEditSrcId(null);
    qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
    qc.invalidateQueries({ queryKey: ["titles"] });
  }
  // Realtime : rafraîchir le volet dès que l'extension met à jour ce titre
  useEffect(() => {
    const channel = supabase
      .channel(`rtk-drawer-${titleId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "title_sources" }, () => {
        qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "titles" }, () => {
        qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [titleId, qc]);

  const { data } = useQuery({
    queryKey: ["title-detail", titleId],
    queryFn: async () => {
      const [title, progress, sources, chapters] = await Promise.all([
        supabase.from("titles").select("*").eq("id", titleId).maybeSingle(),
        supabase.from("reading_progress").select("*").eq("title_id", titleId).maybeSingle(),
        supabase.from("title_sources").select("*, sites(name, base_url, priority)").eq("title_id", titleId),
        supabase.from("chapters").select("*, sites(name)").eq("title_id", titleId).order("detected_at", { ascending: false }).limit(20),
      ]);
      return { title: title.data, progress: progress.data, sources: sources.data ?? [], chapters: chapters.data ?? [] };
    },
  });
  const [lastRead, setLastRead] = useState("");
  // Initialiser avec la valeur sauvegardée dès que les données arrivent
  const savedChapter = data?.progress?.last_chapter_read ?? "";
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (savedChapter) setLastRead(savedChapter); }, [savedChapter]);

  const saveProgress = useMutation({
    mutationFn: async (value: string) => {
      const { error } = await supabase.from("reading_progress").upsert(
        { title_id: titleId, last_chapter_read: value, last_read_at: new Date().toISOString() },
        { onConflict: "title_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("drawer.progressSaved"));
      qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
      qc.invalidateQueries({ queryKey: ["titles"] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("titles").update({ status }).eq("id", titleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["titles"] });
      qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
    },
  });

  const updateType = useMutation({
    mutationFn: async (type: string) => {
      const { error } = await supabase.from("titles").update({ type, type_locked: true }).eq("id", titleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["titles"] });
      qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
    },
  });

  const renameTitleMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("titles").update({ name }).eq("id", titleId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["titles"] });
      qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
      setEditingName(false);
    },
    onError: () => toast.error(tr("drawer.renameFail")),
  });

  function startEditName(currentName: string) {
    setNameValue(currentName);
    setEditingName(true);
  }
  function commitName() {
    const trimmed = nameValue.trim();
    if (trimmed && trimmed !== data?.title?.name) {
      renameTitleMutation.mutate(trimmed);
    } else {
      setEditingName(false);
    }
  }

  async function saveCover(rawUrl: string) {
    const url = rawUrl.trim() || null;
    if (!url) {
      await supabase.from("titles").update({ cover_url: null }).eq("id", titleId);
    } else if (url.includes("supabase.co/storage")) {
      await supabase.from("titles").update({ cover_url: url }).eq("id", titleId);
    } else {
      const { error } = await supabase.functions.invoke("cache-cover", {
        body: { imageUrl: url, titleId },
      });
      if (error) {
        await supabase.from("titles").update({ cover_url: url }).eq("id", titleId);
      }
    }
    qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
    qc.invalidateQueries({ queryKey: ["titles"] });
    setEditingCover(false);
  }

  const deleteTitle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("titles").delete().eq("id", titleId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(tr("drawer.titleDeleted"));
      qc.invalidateQueries({ queryKey: ["titles"] });
      onClose();
    },
  });

  if (!data?.title) return null;

  const aliases: string[] = (data.title as { aliases?: string[] | null }).aliases ?? [];

  return (
    <div className="pointer-events-none fixed inset-0 z-40 flex justify-end">
      <div className="pointer-events-auto h-full w-full max-w-xl overflow-y-auto border-l border-border/60 bg-card p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4 min-w-0">
            <div className="shrink-0 flex flex-col gap-1.5">
              <div
                className="relative group cursor-pointer"
                onClick={() => { setCoverUrlInput((data.title as { cover_url?: string | null }).cover_url ?? ""); setEditingCover(v => !v); }}
                title={tr("drawer.editCover")}
              >
                {(data.title as { cover_url?: string | null }).cover_url ? (
                  <img
                    src={(data.title as { cover_url?: string | null }).cover_url!}
                    alt=""
                    className="h-28 w-20 rounded-lg object-cover object-top shadow-md"
                  />
                ) : (
                  <div className="h-28 w-20 rounded-lg bg-secondary/60 flex items-center justify-center">
                    <Camera className="h-6 w-6 text-muted-foreground/40" />
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>
              {editingCover && (
                <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                  <input
                    autoFocus
                    type="url"
                    value={coverUrlInput}
                    onChange={(e) => setCoverUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveCover(coverUrlInput);
                      if (e.key === "Escape") setEditingCover(false);
                    }}
                    placeholder="https://..."
                    className="w-20 rounded border border-input bg-input/50 px-1.5 py-1 text-[10px] outline-none focus:border-accent"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => saveCover(coverUrlInput)}
                      className="flex-1 rounded bg-accent/20 px-1 py-0.5 text-[10px] text-accent hover:bg-accent/30 transition">
                      <Check className="mx-auto h-3 w-3" />
                    </button>
                    <button
                      onClick={() => setEditingCover(false)}
                      className="flex-1 rounded bg-secondary/60 px-1 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary transition">
                      <X className="mx-auto h-3 w-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">{data.title.type ? typeLabel(tr, data.title.type) : tr("drawer.titleFallback")}</div>
              <div className="mt-1 flex items-center gap-2">
                {editingName ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      autoFocus
                      value={nameValue}
                      onChange={(e) => setNameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitName();
                        if (e.key === "Escape") setEditingName(false);
                      }}
                      onBlur={commitName}
                      className="rounded-md border border-accent bg-background px-2 py-1 text-xl font-bold outline-none"
                    />
                    <button onClick={commitName} className="rounded p-1 text-accent hover:bg-accent/10">
                      <Check className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-2xl font-bold leading-tight">{data.title.name}</h2>
                    <button
                      onClick={() => startEditName(data.title!.name)}
                      title={tr("drawer.renameTitle")}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-accent transition"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <button
                    title={tr("drawer.scrapeNow")}
                    disabled={scraping}
                    onClick={async (e) => {
                      e.stopPropagation();
                      setScraping(true);
                      try {
                        const res = await sendToExtension({ type: "CHECK_TITLE_NOW", titleId, autoDiscover });
                        if (res?.error) {
                          toast.error(res.error === "Extension non disponible"
                            ? tr("drawer.extUnavailable")
                            : String(res.error));
                        } else {
                          toast.success(tr("drawer.scrapeDone"));
                          qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
                          qc.invalidateQueries({ queryKey: ["titles"] });
                        }
                      } finally {
                        setScraping(false);
                      }
                    }}
                    className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-accent/10 hover:text-accent transition disabled:opacity-40">
                    <RefreshCw className={`h-4 w-4 ${scraping ? "animate-spin" : ""}`} />
                  </button>
                  <button
                    type="button"
                    title={tr("drawer.autoDiscover")}
                    onClick={async () => {
                      const next = !autoDiscover;
                      setAutoDiscover(next);
                      await sendToExtension({ type: "SET_AUTO_DISCOVER", enabled: next });
                    }}
                    className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium transition border ${autoDiscover ? "border-accent bg-accent/20 text-accent" : "border-border text-muted-foreground hover:border-accent/60 hover:text-foreground"}`}>
                    {tr("drawer.autoDiscover")}
                  </button>
                </div>
              </div>
              {aliases.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {aliases.map((a, i) => (
                    <span key={i} className="rounded-full bg-secondary/60 px-2 py-0.5 text-xs text-muted-foreground">{a}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-md p-1 hover:bg-accent/10"><X className="h-5 w-5" /></button>
        </div>

        <div className="mt-6">
          <label className="text-xs font-medium text-muted-foreground">{tr("drawer.lastRead")}</label>
          <div className="mt-1 flex gap-2">
            <button
              onClick={() => {
                const cur = parseFloat(lastRead) || 0;
                const next = String(Math.max(0, parseFloat((cur - 1).toFixed(2))));
                setLastRead(next);
                saveProgress.mutate(next);
              }}
              className="rounded-md border border-input bg-secondary/60 px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition">
              −1
            </button>
            <input
              value={lastRead}
              onChange={(e) => setLastRead(e.target.value)}
              className="w-0 flex-1 rounded-md border border-input bg-input/50 px-3 py-2 text-center text-sm" />
            <button
              onClick={() => {
                const cur = parseFloat(lastRead) || 0;
                const next = String(parseFloat((cur + 1).toFixed(2)));
                setLastRead(next);
                saveProgress.mutate(next);
              }}
              className="rounded-md border border-input bg-secondary/60 px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground transition">
              +1
            </button>
            <button onClick={() => saveProgress.mutate(lastRead)}
              className="rounded-md px-4 text-sm font-medium text-primary-foreground" style={{ background: "var(--gradient-primary)" }}>
              {tr("common.save")}
            </button>
          </div>
        </div>

        <div className="mt-6 flex gap-6">
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">{tr("filter.type")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["manga", "manhua", "manhwa", "novel", "autre"].map((ty) => (
                <button key={ty} onClick={() => updateType.mutate(ty)}
                  className={`rounded-full px-3 py-1 text-xs ${data.title?.type === ty ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>
                  {typeLabel(tr, ty)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium text-muted-foreground">{tr("filter.status")}</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {["ongoing", "paused", "dropped", "completed"].map((s) => (
                <button key={s} onClick={() => updateStatus.mutate(s)}
                  className={`rounded-full px-3 py-1 text-xs ${data.title?.status === s ? "bg-accent text-accent-foreground" : "bg-secondary/60 text-muted-foreground hover:bg-secondary"}`}>
                  {statusLabel(tr, s)}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8">
          {(() => {
            const sourceValues = data.sources
              .filter((s) => s.last_seen_chapter)
              .map((s) => ({ source: s, num: parseFloat(s.last_seen_chapter!) }))
              .filter((x) => !isNaN(x.num));

            if (sourceValues.length === 0) return (
              <div>
                <h3 className="text-sm font-semibold">{tr("drawer.detectedTitle")}</h3>
                <p className="mt-2 text-xs text-muted-foreground">{tr("drawer.detectedNone")}</p>
              </div>
            );

            const selectedNum = Math.max(...sourceValues.map(x => x.num));
            const selectedLabel = String(selectedNum);

            const chapterUrlRe = new RegExp(`(?:chapter|chap|ch|episode|ep)[-_/]?${selectedNum}(?:[^0-9]|$)`, "i");
            const links = data.sources.map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const chap = (data.chapters as any[]).find((c: any) =>
                c.site_id === (s as any).site_id &&
                (c.chapter_label === selectedLabel || chapterUrlRe.test(c.chapter_url ?? ""))
              );
              if (!chap?.chapter_url) return null;
              return {
                chapId: chap.id as string,
                siteName: (s as { sites?: { name?: string } }).sites?.name ?? "Source",
                url: chap.chapter_url as string,
              };
            }).filter((l): l is { chapId: string; siteName: string; url: string } => l !== null);

            return (
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{tr("drawer.detectedPrefix")}<span className="text-accent">{selectedLabel}</span></h3>
                  <a
                    href={`https://www.google.com/search?q=${encodeURIComponent(data.title!.name + " " + selectedLabel)}`}
                    target="_blank"
                    rel="noreferrer"
                    title={tr("drawer.googleSearchChap")}
                    className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition"
                  >
                    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                      <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                    </svg>
                  </a>
                </div>
                <div className="mt-2 space-y-1">
                  {links.map((link) => (
                    <div key={link.chapId} className="flex items-center gap-1">
                      <a href={link.url} target="_blank" rel="noopener noreferrer"
                        className="flex min-w-0 flex-1 items-center gap-1.5 text-xs text-accent hover:underline break-all">
                        <ExternalLink className="shrink-0" style={{ width: 11, height: 11 }} />
                        <span>{link.siteName} — {link.url}</span>
                      </a>
                      <button
                        title={tr("drawer.deleteChapter")}
                        onClick={async (e) => {
                          e.preventDefault();
                          await supabase.from("chapters").delete().eq("id", link.chapId);
                          qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
                          qc.invalidateQueries({ queryKey: ["titles"] });
                        }}
                        className="shrink-0 rounded p-1 text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        <div className="mt-8">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold">{tr("drawer.sources", { n: data.sources.length })}</h3>

            <button
              onClick={() => { setAddingSource(v => !v); setNewSourceUrl(""); }}
              title={tr("drawer.addSource")}
              className="rounded p-1 text-muted-foreground hover:bg-accent/10 hover:text-accent transition"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>

            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(data.title.name + " scan")}`}
              target="_blank"
              rel="noreferrer"
              title={tr("drawer.googleSearch")}
              className="rounded p-1 text-muted-foreground hover:bg-secondary/60 hover:text-foreground transition"
            >
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
              </svg>
            </a>
          </div>

          {addingSource && (
            <div className="mt-2 flex gap-2">
              <input
                autoFocus
                type="url"
                value={newSourceUrl}
                onChange={(e) => setNewSourceUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewSource();
                  if (e.key === "Escape") setAddingSource(false);
                }}
                placeholder="https://..."
                className="min-w-0 flex-1 rounded-md border border-input bg-input/50 px-3 py-1.5 font-mono text-xs outline-none focus:border-accent"
              />
              <button onClick={submitNewSource} className="rounded-md bg-accent/20 px-2 py-1.5 text-accent hover:bg-accent/30 transition">
                <Check className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => setAddingSource(false)} className="rounded-md bg-secondary/60 px-2 py-1.5 text-muted-foreground hover:bg-secondary transition">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <ul className="mt-2 space-y-2">
            {[...data.sources].sort((a, b) => {
              const pa = (a as any).sites?.priority ?? 0;
              const pb = (b as any).sites?.priority ?? 0;
              return pb - pa;
            }).map((s) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const lastError = (s as any).last_error as string | null;
              const sitePriority = (s as any).sites?.priority as number ?? 0;
              const isDown = lastError === "404";
              const isRedirect = lastError === "redirect";
              const hasError = isDown || isRedirect;
              const siteName = (s as { sites?: { name?: string } }).sites?.name ?? "Source";

              // ── Mode édition ───────────────────────────────────────────────
              if (editSrcId === s.id) {
                return (
                  <li key={s.id} className="rounded-md border border-accent/40 bg-accent/5 p-3 text-xs space-y-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-accent">{siteName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sitePriority > 0 ? "bg-accent/20 text-accent" : "bg-secondary/60 text-muted-foreground"}`}>
                        {tr("drawer.priority", { n: sitePriority })}
                      </span>
                    </div>
                    <div>
                      <label className="text-muted-foreground">{tr("drawer.link")}</label>
                      <input
                        value={editUrl}
                        onChange={e => setEditUrl(e.target.value)}
                        className="mt-1 w-full rounded border border-input bg-input/50 px-2 py-1 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-muted-foreground">{tr("drawer.lastDetected")}</label>
                      <input
                        value={editLastSeen}
                        onChange={e => setEditLastSeen(e.target.value)}
                        placeholder={tr("drawer.lastDetectedPh")}
                        className="mt-1 w-full rounded border border-input bg-input/50 px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditSrcId(null)}
                        className="rounded px-3 py-1 text-muted-foreground hover:bg-secondary/60 transition">
                        {tr("common.cancel")}
                      </button>
                      <button
                        onClick={saveEdit}
                        className="flex items-center gap-1.5 rounded px-3 py-1 font-medium text-primary-foreground transition"
                        style={{ background: "var(--gradient-primary)" }}>
                        <Check className="h-3 w-3" /> {tr("common.save")}
                      </button>
                    </div>
                  </li>
                );
              }

              // ── Affichage normal ───────────────────────────────────────────
              return (
                <li key={s.id} className={`rounded-md border p-3 text-xs ${isDown ? "border-destructive/40 bg-destructive/5" : isRedirect ? "border-orange-500/30 bg-orange-500/5" : "border-border/60 bg-secondary/30"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium">{siteName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sitePriority > 0 ? "bg-accent/20 text-accent" : "bg-secondary/60 text-muted-foreground"}`}>
                        {tr("drawer.priority", { n: sitePriority })}
                      </span>
                      {isDown && <span className="rounded-full bg-destructive/20 px-2 py-0.5 text-[10px] font-semibold text-destructive">⬤ {tr("drawer.down")}</span>}
                      {isRedirect && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[10px] font-semibold text-orange-400">↪ {tr("drawer.redirected")}</span>}
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        title={tr("drawer.editSource")}
                        onClick={() => startEdit(s)}
                        className="rounded p-1 text-muted-foreground/50 hover:text-foreground hover:bg-secondary/60 transition">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        title={tr("drawer.deleteSource")}
                        onClick={async () => {
                          if (!confirm(tr("drawer.confirmDeleteSource"))) return;
                          await supabase.from("title_sources").delete().eq("id", s.id);
                          qc.invalidateQueries({ queryKey: ["title-detail", titleId] });
                          qc.invalidateQueries({ queryKey: ["titles"] });
                        }}
                        className="rounded p-1 text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="mt-1 block truncate text-accent hover:underline">{s.url}</a>
                  {s.last_seen_chapter && !hasError && (
                    <div className="mt-1 flex items-center gap-1.5 text-muted-foreground">
                      <span>{tr("drawer.lastDetectedColon", { n: s.last_seen_chapter })}</span>
                      <a
                        href={`https://www.google.com/search?q=${encodeURIComponent(data.title!.name + " " + s.last_seen_chapter)}`}
                        target="_blank"
                        rel="noreferrer"
                        title={tr("drawer.googleSearchChap")}
                        className="rounded p-0.5 hover:bg-secondary/60 hover:text-foreground transition"
                      >
                        <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                          <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
                        </svg>
                      </a>
                    </div>
                  )}
                </li>
              );
            })}
            {data.sources.length === 0 && <li className="text-xs text-muted-foreground">{tr("drawer.noSources")}</li>}
          </ul>
        </div>

        <div className="mt-10 border-t border-border/40 pt-4">
          <button onClick={() => { if (confirm(tr("drawer.confirmDeleteTitle"))) deleteTitle.mutate(); }} className="text-xs text-destructive hover:underline">
            {tr("drawer.deleteTitleBtn")}
          </button>
        </div>
      </div>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({ meta: [{ title: "Exporter bookmarks · ReadingTK" }] }),
  component: ExportPage,
});

// ── Types ──────────────────────────────────────────────────────────────────────

type LinkFilter = "sources" | "chapters" | "all";

type TitleRow = {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  title_sources: { id: string; url: string; sites: { name: string } | null }[];
};

// ── Constantes ─────────────────────────────────────────────────────────────────

const TYPES    = ["all", "manga", "manhua", "manhwa", "novel", "autre"];
const STATUSES = ["all", "ongoing", "paused", "dropped", "completed"];

const LINK_LABELS: Record<LinkFilter, string> = {
  sources:  "Sources",
  chapters: "Dernier chapitre détecté",
  all:      "Tous les liens",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function FilterGroup({
  values, current, onChange,
}: { values: string[]; current: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            current === v
              ? "bg-accent text-accent-foreground"
              : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
          }`}
        >
          {v === "all" ? "Tous" : v.charAt(0).toUpperCase() + v.slice(1)}
        </button>
      ))}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

function ExportPage() {
  const [filterType,   setFilterType]   = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterLinks,  setFilterLinks]  = useState<LinkFilter>("sources");
  const [selected,     setSelected]     = useState<Set<string>>(new Set());

  // ── Données ────────────────────────────────────────────────────────────────

  const { data: titles = [], isLoading } = useQuery<TitleRow[]>({
    queryKey: ["titles-export"],
    queryFn: async () => {
      const { data } = await supabase
        .from("titles")
        .select("id, name, type, status, title_sources(id, url, sites(name))")
        .order("name");
      return (data ?? []) as TitleRow[];
    },
  });

  // Dernier chapitre par titre (map title_id → { url, label })
  const { data: latestChapters = {} } = useQuery<Record<string, { url: string; label: string }>>({
    queryKey: ["chapters-latest-export"],
    queryFn: async () => {
      const { data } = await supabase
        .from("chapters")
        .select("title_id, chapter_url, chapter_label, created_at")
        .order("created_at", { ascending: false });
      const map: Record<string, { url: string; label: string }> = {};
      for (const ch of data ?? []) {
        if (!map[ch.title_id] && ch.chapter_url) {
          map[ch.title_id] = { url: ch.chapter_url, label: ch.chapter_label ?? "" };
        }
      }
      return map;
    },
  });

  // ── Filtrage ───────────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return titles.filter((t) => {
      if (filterType   !== "all" && t.type   !== filterType)   return false;
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      return true;
    });
  }, [titles, filterType, filterStatus]);

  // Réinitialiser la sélection quand les filtres changent
  useEffect(() => {
    setSelected(new Set(filtered.map((t) => t.id)));
  }, [filterType, filterStatus, filtered.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const allSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((t) => next.delete(t.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        filtered.forEach((t) => next.add(t.id));
        return next;
      });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // ── Liens à exporter pour un titre ────────────────────────────────────────

  function getLinks(title: TitleRow): { url: string; label: string }[] {
    const links: { url: string; label: string }[] = [];

    if (filterLinks === "sources" || filterLinks === "all") {
      for (const src of title.title_sources ?? []) {
        if (src.url) {
          const siteName = src.sites?.name ?? new URL(src.url).hostname;
          links.push({ url: src.url, label: `${title.name} (${siteName})` });
        }
      }
    }

    if (filterLinks === "chapters" || filterLinks === "all") {
      const ch = latestChapters[title.id];
      if (ch?.url) {
        links.push({ url: ch.url, label: `${title.name} — ${ch.label}` });
      }
    }

    return links;
  }

  // ── Export ─────────────────────────────────────────────────────────────────

  function exportBookmarks() {
    const selectedTitles = filtered.filter((t) => selected.has(t.id));
    if (!selectedTitles.length) return;

    const lines: string[] = [
      "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
      '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
      "<TITLE>ReadingTK Bookmarks</TITLE>",
      "<H1>ReadingTK</H1>",
      "<DL><p>",
    ];

    for (const title of selectedTitles) {
      const links = getLinks(title);
      if (!links.length) continue;
      lines.push(`    <DT><H3>${escHtml(title.name)}</H3>`);
      lines.push("    <DL><p>");
      for (const { url, label } of links) {
        lines.push(`        <DT><A HREF="${escHtml(url)}">${escHtml(label)}</A>`);
      }
      lines.push("    </DL><p>");
    }

    lines.push("</DL><p>");

    const blob = new Blob([lines.join("\n")], { type: "text/html; charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "readingtk-bookmarks.html";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const selectedCount = filtered.filter((t) => selected.has(t.id)).length;
  const linkCount = filtered
    .filter((t) => selected.has(t.id))
    .reduce((acc, t) => acc + getLinks(t).length, 0);

  // ── Rendu ──────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Exporter bookmarks</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sélectionnez les titres et le type de liens à exporter au format HTML (importable dans tous les navigateurs).
      </p>

      {/* ── Filtres ── */}
      <div className="mt-6 space-y-3 rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground uppercase">Type</span>
          <FilterGroup values={TYPES} current={filterType} onChange={setFilterType} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground uppercase">Statut</span>
          <FilterGroup values={STATUSES} current={filterStatus} onChange={setFilterStatus} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="w-14 shrink-0 text-xs font-semibold text-muted-foreground uppercase">Liens</span>
          <div className="flex flex-wrap gap-1">
            {(["sources", "chapters", "all"] as LinkFilter[]).map((v) => (
              <button
                key={v}
                onClick={() => setFilterLinks(v)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filterLinks === v
                    ? "bg-accent text-accent-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {LINK_LABELS[v]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Liste ── */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-card/40">
        {/* Header liste */}
        <div className="flex items-center justify-between border-b border-border/40 px-4 py-2">
          <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground select-none">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-accent"
            />
            {allSelected ? "Tout désélectionner" : "Tout sélectionner"}
          </label>
          <span className="text-xs text-muted-foreground">
            {filtered.length} titre{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Rows */}
        <div className="max-h-[420px] overflow-y-auto">
          {isLoading && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Chargement…</p>
          )}
          {!isLoading && filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Aucun titre correspondant aux filtres.</p>
          )}
          {filtered.map((title) => {
            const links = getLinks(title);
            const isSelected = selected.has(title.id);
            return (
              <label
                key={title.id}
                className={`flex cursor-pointer items-start gap-3 border-t border-border/40 px-4 py-2.5 transition-colors hover:bg-secondary/20 ${
                  isSelected ? "" : "opacity-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(title.id)}
                  className="mt-0.5 accent-accent"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-sm font-medium">{title.name}</span>
                    {title.type && (
                      <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] bg-secondary/60 text-muted-foreground">
                        {title.type}
                      </span>
                    )}
                  </div>
                  {links.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {links.map((l, i) => (
                        <li key={i} className="truncate text-[11px] text-muted-foreground">
                          <span className="mr-1 opacity-40">↗</span>
                          <a
                            href={l.url}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-foreground hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {l.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-muted-foreground/50 italic">Aucun lien disponible pour ce filtre</p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* ── Bouton export ── */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedCount} titre{selectedCount !== 1 ? "s" : ""} sélectionné{selectedCount !== 1 ? "s" : ""} · {linkCount} lien{linkCount !== 1 ? "s" : ""}
        </p>
        <button
          onClick={exportBookmarks}
          disabled={linkCount === 0}
          className="inline-flex items-center gap-2 rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          style={{ background: "var(--gradient-primary)" }}
        >
          <Download className="h-4 w-4" />
          Exporter
        </button>
      </div>
    </div>
  );
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

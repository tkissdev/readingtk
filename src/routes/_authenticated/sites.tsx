import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Plus, AlertTriangle, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";

type SortCol = "name" | "base_url" | "priority" | "enabled" | "is_down";

function SortIcon({ col, sortBy, sortDir }: { col: SortCol; sortBy: SortCol | null; sortDir: "asc" | "desc" }) {
  if (sortBy !== col) return <ChevronsUpDown className="inline ml-1 h-3 w-3 opacity-40" />;
  return sortDir === "asc"
    ? <ChevronUp className="inline ml-1 h-3 w-3" />
    : <ChevronDown className="inline ml-1 h-3 w-3" />;
}

export const Route = createFileRoute("/_authenticated/sites")({
  head: () => ({ meta: [{ title: "Sites · ReadingTK" }] }),
  component: SitesPage,
});

function SitesPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [urlTemplate, setUrlTemplate] = useState("");
  const [priority, setPriority] = useState(0);
  const [sortBy, setSortBy] = useState<SortCol | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function handleSort(col: SortCol) {
    if (sortBy === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortBy(col);
      // Priorité : premier clic = décroissant (le plus haut en premier)
      setSortDir(col === "priority" ? "desc" : "asc");
    }
  }

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await supabase.from("sites").select("*").order("priority", { ascending: false })).data ?? [],
  });

  const sorted = (sites ?? []).slice().sort((a, b) => {
    if (!sortBy) return 0;
    let cmp = 0;
    if (sortBy === "name") cmp = (a.name ?? "").localeCompare(b.name ?? "", undefined, { sensitivity: "base" });
    else if (sortBy === "base_url") cmp = (a.base_url ?? "").localeCompare(b.base_url ?? "", undefined, { sensitivity: "base" });
    else if (sortBy === "priority") cmp = (a.priority ?? 0) - (b.priority ?? 0);
    else if (sortBy === "enabled") cmp = (a.enabled ? 1 : 0) - (b.enabled ? 1 : 0);
    else if (sortBy === "is_down") cmp = ((a as any).is_down ? 1 : 0) - ((b as any).is_down ? 1 : 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("sites").insert({
        user_id: u.user!.id,
        name,
        base_url: baseUrl,
        url_template: urlTemplate || null,
        priority,
        enabled: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t("sites.created"));
      setName(""); setBaseUrl(""); setUrlTemplate(""); setPriority(0);
      qc.invalidateQueries({ queryKey: ["sites"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; priority?: number; enabled?: boolean; url_template?: string | null }) => {
      const { error } = await supabase.from("sites").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sites").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sites"] }),
  });

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">{t("sites.title")}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{t("sites.subtitle")}</p>

      {/* Form */}
      <div className="mt-6 grid gap-2 rounded-xl border border-border/60 bg-card/40 p-4">
        <div className="grid gap-2 md:grid-cols-4">
          <input placeholder={t("sites.name")} value={name} onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm" />
          <input placeholder="https://site.com" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)}
            className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm md:col-span-2" />
          <input type="number" placeholder={t("sites.priority")} value={priority} onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
            className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <input
            placeholder={t("sites.templatePh")}
            value={urlTemplate}
            onChange={(e) => setUrlTemplate(e.target.value)}
            className="rounded-md border border-input bg-input/50 px-3 py-2 text-sm"
          />
          <p className="text-xs text-muted-foreground pl-1">
            {t("sites.templateHelp", { code: "{slug}" })}
          </p>
        </div>
        <button onClick={() => create.mutate()} disabled={!name || !baseUrl}
          className="inline-flex items-center justify-center gap-2 rounded-md py-2 text-sm font-medium text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}>
          <Plus className="h-4 w-4" /> {t("sites.addBtn")}
        </button>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-xl border border-border/60 bg-card/40">
        <table className="w-full text-sm">
          <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
            <tr>
              {(["name", "base_url", null, "priority", "enabled"] as const).map((col, i) => {
                const labels: Record<string, string> = { name: t("sites.name"), base_url: t("sites.baseUrl"), priority: t("sites.priority"), enabled: t("sites.enabled") };
                if (col === null) return <th key={i} className="px-3 py-3 text-left">{t("sites.templateUrl")}</th>;
                return (
                  <th key={col} className={`${i === 0 ? "px-4" : "px-3"} py-3 text-left`}>
                    <button onClick={() => handleSort(col)}
                      title={t("common.sortColumn")}
                      className="flex items-center hover:text-foreground transition-colors whitespace-nowrap">
                      {labels[col]}
                      <SortIcon col={col} sortBy={sortBy} sortDir={sortDir} />
                    </button>
                  </th>
                );
              })}
              <th className="px-3 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => {
              const isDown = (s as any).is_down === true;
              return (
              <tr key={s.id} className={`border-t border-border/40 ${isDown ? "bg-red-500/5" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  <span className="flex items-center gap-2">
                    {s.name}
                    {isDown && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-semibold bg-red-500/15 text-red-400">
                        <AlertTriangle className="h-3 w-3" /> {t("sites.down")}
                      </span>
                    )}
                  </span>
                </td>
                <td className="px-3 py-3 truncate text-xs text-muted-foreground max-w-[140px]">{s.base_url}</td>
                <td className="px-3 py-3 max-w-[200px]">
                  <input
                    type="text"
                    defaultValue={(s as { url_template?: string | null }).url_template ?? ""}
                    placeholder="https://site.com/series/{slug}/"
                    onBlur={(e) => {
                      const val = e.target.value.trim();
                      update.mutate({ id: s.id, url_template: val || null });
                    }}
                    className="w-full rounded-md border border-input bg-input/50 px-2 py-1 text-xs placeholder:text-muted-foreground/50"
                  />
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    key={s.priority}
                    defaultValue={s.priority}
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      if (!isNaN(val)) update.mutate({ id: s.id, priority: val });
                    }}
                    className="w-16 rounded-md border border-input bg-input/50 px-2 py-1 text-xs"
                  />
                </td>
                <td className="px-3 py-3">
                  <button onClick={() => update.mutate({ id: s.id, enabled: !s.enabled })}
                    title={s.enabled ? t("sites.disableSite") : t("sites.enableSite")}
                    className={`h-5 w-10 rounded-full transition ${s.enabled ? "bg-accent" : "bg-secondary"}`}>
                    <span className={`block h-4 w-4 rounded-full bg-background transition ${s.enabled ? "translate-x-5" : "translate-x-1"}`} />
                  </button>
                </td>
                <td className="px-3 py-3 text-right">
                  <button onClick={() => del.mutate(s.id)} title={t("sites.deleteSite")} className={`rounded-md p-1.5 hover:bg-destructive/10 ${isDown ? "text-red-400" : "text-destructive"}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">{t("sites.none")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

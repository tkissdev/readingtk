import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload } from "lucide-react";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Import bookmarks · ReadingTK" }] }),
  component: ImportPage,
});

type ParsedItem = { url: string; title: string; selected: boolean; domain: string };

function ImportPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ParsedItem[]>([]);
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["user-settings-import"],
    queryFn: async () => (await supabase.from("user_settings").select("*").maybeSingle()).data,
  });
  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await supabase.from("sites").select("*")).data ?? [],
  });

  function parseHtml(html: string) {
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
    const out: ParsedItem[] = [];
    const seen = new Set<string>();
    let m: RegExpExecArray | null;
    const whitelist: string[] | null = settings?.bookmarks_domain_whitelist ?? null;
    const ignoreDup = settings?.bookmarks_ignore_duplicates ?? true;
    while ((m = re.exec(html)) !== null) {
      const url = m[1];
      if (!/^https?:/i.test(url)) continue;
      if (ignoreDup && seen.has(url)) continue;
      seen.add(url);
      let domain = "";
      try { domain = new URL(url).hostname; } catch { continue; }
      if (whitelist?.length && !whitelist.some((w) => domain.includes(w))) continue;
      const title = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || url;
      out.push({ url, title, selected: true, domain });
    }
    setItems(out);
    toast.success(`${out.length} liens trouvés`);
  }

  async function handleFile(file: File) {
    const text = await file.text();
    parseHtml(text);
  }

  async function doImport() {
    setLoading(true);
    try {
      const selected = items.filter((i) => i.selected);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      for (const it of selected) {
        const { data: title } = await supabase.from("titles").insert({
          user_id: userId, name: it.title.slice(0, 200),
          type: settings?.default_type ?? "manga",
          status: settings?.default_status ?? "ongoing",
        }).select("id").single();
        if (!title) continue;
        const site = (sites ?? []).find((s) => {
          try { return new URL(s.base_url).hostname === it.domain; } catch { return false; }
        });
        await supabase.from("title_sources").insert({
          title_id: title.id, site_id: site?.id ?? null, url: it.url, is_primary: true,
        });
      }
      await supabase.from("imports").insert({ user_id: userId, source: "html_bookmarks", raw_json: { count: selected.length } });
      toast.success(`${selected.length} titre(s) importé(s)`);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold">Importer des bookmarks</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Exportez vos favoris au format HTML depuis votre navigateur (Chrome/Firefox : Gérer les favoris → Exporter).
      </p>

      <label className="mt-6 flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-card/40 p-10 text-sm hover:bg-card/60">
        <Upload className="h-5 w-5 text-accent" />
        <span>Cliquer pour choisir un fichier HTML</span>
        <input type="file" accept=".html,text/html" className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
      </label>

      {items.length > 0 && (
        <>
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">{items.filter((i) => i.selected).length} / {items.length} sélectionnés</div>
            <button onClick={doImport} disabled={loading}
              className="rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}>
              {loading ? "..." : "Importer la sélection"}
            </button>
          </div>
          <div className="mt-3 max-h-[60vh] overflow-y-auto rounded-xl border border-border/60 bg-card/40">
            <table className="w-full text-sm">
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-border/40 hover:bg-secondary/30">
                    <td className="px-3 py-2 w-8">
                      <input type="checkbox" checked={it.selected}
                        onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, selected: e.target.checked } : x))} />
                    </td>
                    <td className="px-3 py-2">
                      <input className="w-full rounded border border-input bg-input/30 px-2 py-1 text-xs"
                        value={it.title}
                        onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, title: e.target.value } : x))} />
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{it.domain}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

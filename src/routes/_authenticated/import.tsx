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

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Déduit un template d'URL depuis une URL de titre ou de chapitre.
 * Ex: "https://vortexscans.org/series/the-shepherd-wizard/chapter-23" + "The Shepherd Wizard"
 *   → "https://vortexscans.org/series/{slug}/"
 */
function inferUrlTemplate(rawUrl: string, titleName: string): string | null {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split("/").filter(Boolean);

    // Supprimer les segments "chapitre" à la fin
    const chapterCombinedRe = /^(?:chapter|chap|ch|episode|ep)[-_]?\d/i;
    const chapterWordRe = /^(?:chapter|chapitre|chap|ch|episode|ep)$/i;
    let end = parts.length;
    for (let i = 0; i < parts.length; i++) {
      if (
        chapterCombinedRe.test(parts[i]) ||
        (chapterWordRe.test(parts[i]) && i + 1 < parts.length && /^\d/.test(parts[i + 1]))
      ) {
        end = i;
        break;
      }
    }
    const titleParts = parts.slice(0, end);
    if (!titleParts.length) return null;

    const slug = computeSlug(titleName);

    // Chercher le segment qui correspond au slug du titre
    for (let i = 0; i < titleParts.length; i++) {
      const part = titleParts[i].toLowerCase();
      if (slug && (part === slug || part.startsWith(slug + "-") || part.startsWith(slug + "_"))) {
        const prefix = titleParts.slice(0, i).join("/");
        return `${u.origin}/${prefix ? prefix + "/" : ""}{slug}/`;
      }
    }

    // Fallback : remplacer le dernier segment
    if (titleParts.length >= 1) {
      const prefix = titleParts.slice(0, -1).join("/");
      return `${u.origin}/${prefix ? prefix + "/" : ""}{slug}/`;
    }

    return null;
  } catch { return null; }
}

// ── Composant ─────────────────────────────────────────────────────────────────

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

      // Cache des sites créés pendant cet import (pour ne pas recréer le même site plusieurs fois)
      const siteCache = new Map<string, string>(); // hostname → site_id

      for (const it of selected) {
        // ── 1. Créer le titre ───────────────────────────────────────────────
        const { data: title } = await supabase.from("titles").insert({
          user_id: userId,
          name: it.title.slice(0, 200),
          type: settings?.default_type ?? "manga",
          status: settings?.default_status ?? "ongoing",
        }).select("id").single();
        if (!title) continue;

        // ── 2. Trouver ou créer le site, et inférer le template ─────────────
        let siteId: string | null = null;
        try {
          const u = new URL(it.url);
          const host = u.hostname;

          if (siteCache.has(host)) {
            siteId = siteCache.get(host)!;
          } else {
            const matchedSite = (sites ?? []).find((s) => {
              try { return new URL(s.base_url).hostname === host; } catch { return false; }
            });

            if (matchedSite) {
              siteId = matchedSite.id;
              // Mettre à jour le template si pas encore défini
              if (!(matchedSite as { url_template?: string | null }).url_template) {
                const template = inferUrlTemplate(it.url, it.title);
                if (template) {
                  await supabase.from("sites").update({ url_template: template }).eq("id", siteId);
                }
              }
            } else {
              // Créer le site avec le template inféré
              const raw = host.replace(/^www\./, "").split(".")[0];
              const siteName = raw.charAt(0).toUpperCase() + raw.slice(1);
              const base_url = `${u.protocol}//${host}`;
              const template = inferUrlTemplate(it.url, it.title);
              const { data: newSite } = await supabase
                .from("sites")
                .insert({ user_id: userId, name: siteName, base_url, url_template: template, priority: 0, enabled: true })
                .select("id").single();
              siteId = newSite?.id ?? null;
            }

            if (siteId) siteCache.set(host, siteId);
          }
        } catch { /* ignore site errors */ }

        // ── 3. Ajouter la source ────────────────────────────────────────────
        await supabase.from("title_sources").insert({
          title_id: title.id,
          site_id: siteId,
          url: it.url,
          is_primary: true,
        });
      }

      await supabase.from("imports").insert({
        user_id: userId,
        source: "html_bookmarks",
        raw_json: { count: selected.length },
      });
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

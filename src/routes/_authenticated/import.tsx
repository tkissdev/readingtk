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

type ParsedItem = {
  url: string;             // URL originale (page chapitre)
  sourceUrl: string;       // URL page manga (segment chapitre retiré)
  title: string;           // titre propre (éditable)
  chapterNum: string | null;
  selected: boolean;
  domain: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function computeSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Clé de regroupement normalisée : strip article initial, traite "-s-" comme possessif */
function toGroupKey(title: string): string {
  return computeSlug(title)
    .replace(/^(the|a|an)-/, "")
    .replace(/-s-/g, "s-")
    .replace(/-s$/, "s");
}

function inferUrlTemplate(rawUrl: string, titleName: string): string | null {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split("/").filter(Boolean);
    const chapterCombinedRe = /^(?:chapter|chap|ch|episode|ep)[-_]?\d/i;
    const chapterWordRe = /^(?:chapter|chapitre|chap|ch|episode|ep)$/i;
    let end = parts.length;
    for (let i = 0; i < parts.length; i++) {
      if (chapterCombinedRe.test(parts[i]) ||
        (chapterWordRe.test(parts[i]) && i + 1 < parts.length && /^\d/.test(parts[i + 1]))) {
        end = i; break;
      }
    }
    const titleParts = parts.slice(0, end);
    if (!titleParts.length) return null;
    const slug = computeSlug(titleName);
    for (let i = 0; i < titleParts.length; i++) {
      const part = titleParts[i].toLowerCase();
      if (slug && (part === slug || part.startsWith(slug + "-") || part.startsWith(slug + "_"))) {
        const prefix = titleParts.slice(0, i).join("/");
        return `${u.origin}/${prefix ? prefix + "/" : ""}{slug}/`;
      }
    }
    if (titleParts.length >= 1) {
      const prefix = titleParts.slice(0, -1).join("/");
      return `${u.origin}/${prefix ? prefix + "/" : ""}{slug}/`;
    }
    return null;
  } catch { return null; }
}

/**
 * Extrait titre propre, numéro de chapitre et URL manga depuis une URL de chapitre.
 * Gère : slugs avec chapitre intégré ("nano-machine-chapter-315"), suffixes hash/ID ("title056541").
 */
function extractFromUrl(rawUrl: string): { cleanTitle: string | null; chapterNum: string | null; sourceUrl: string } {
  try {
    const u = new URL(rawUrl);
    const segments = u.pathname.split("/").filter(Boolean);
    const chapterRe = /^(?:chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/i;
    const chapterWordRe = /^(?:chapter|chapitre|chap|ch|episode|ep)$/i;
    let titleSeg: string | null = null;
    let chapterNum: string | null = null;
    let chapterIdx = -1;

    for (let i = 0; i < segments.length; i++) {
      const m = segments[i].match(chapterRe);
      if (m) {
        chapterNum = m[1]; chapterIdx = i;
        titleSeg = i > 0 ? segments[i - 1] : null;
        break;
      }
      if (chapterWordRe.test(segments[i]) && i + 1 < segments.length && /^\d+(\.\d+)?$/.test(segments[i + 1])) {
        chapterNum = segments[i + 1]; chapterIdx = i;
        titleSeg = i > 0 ? segments[i - 1] : null;
        break;
      }
    }

    let sourceUrl = rawUrl;
    if (chapterIdx >= 0) {
      sourceUrl = `${u.origin}/${segments.slice(0, chapterIdx).join("/")}/`;
    }

    if (!titleSeg) titleSeg = segments[segments.length - 1] ?? null;
    if (!titleSeg) return { cleanTitle: null, chapterNum, sourceUrl };

    // Extraire le chapitre depuis le slug lui-même si pas déjà trouvé ("nano-machine-chapter-315")
    if (!chapterNum) {
      const slugChapRe = /[-_](?:chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/i;
      const mc = titleSeg.match(slugChapRe);
      if (mc) chapterNum = mc[1];
    }

    // Supprimer le segment chapitre du slug
    let cleanSlug = titleSeg
      .replace(/[-_](?:chapter|chap|ch|episode|ep)[-_]?\d[\d.]*/i, "")
      .replace(/[-_]+$/g, "");

    // Supprimer les suffixes hash/ID (avec ou sans séparateur : "title056541", "title-abc123")
    cleanSlug = cleanSlug.replace(/[-_]?[0-9a-f]{5,}$/i, "") || cleanSlug;

    const cleanTitle = decodeURIComponent(cleanSlug)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase())
      .trim();

    return { cleanTitle: cleanTitle || null, chapterNum, sourceUrl };
  } catch {
    return { cleanTitle: null, chapterNum: null, sourceUrl: rawUrl };
  }
}

/**
 * Extrait titre propre et numéro de chapitre depuis le texte d'ancre.
 * Ex: "Nano Machine Chapter 315 - Read Online | Asura Scans" → { cleanTitle: "Nano Machine", chapterNum: "315" }
 */
function parseTitleFromText(rawText: string): { cleanTitle: string; chapterNum: string | null } {
  let t = rawText
    .replace(/^Read\s+/i, "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .trim();

  const chapRe = /\s*[-–—]?\s*(?:chapter|chapitre|chap|ch\.?|episode|ep\.?)[\s\-_\/]?(\d+(?:\.\d+)?)/i;
  const m = chapRe.exec(t);
  if (m) {
    const cleanTitle = t.slice(0, m.index).trim().replace(/\s*[-–—]\s*$/, "").trim();
    return { cleanTitle: cleanTitle || t, chapterNum: m[1] };
  }
  return { cleanTitle: t, chapterNum: null };
}

function unescapeHtml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)));
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

      const rawText = unescapeHtml(m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || url);

      const { cleanTitle: urlTitle, chapterNum: urlChapter, sourceUrl } = extractFromUrl(url);
      const { cleanTitle: textTitle, chapterNum: textChapter } = parseTitleFromText(rawText);

      const title = urlTitle || textTitle;
      const chapterNum = urlChapter ?? textChapter;

      out.push({ url, sourceUrl, title, chapterNum, selected: true, domain });
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

      // Regrouper par clé normalisée (gère "The Infinite Mage" = "Infinite Mage", apostrophes, etc.)
      const groups = new Map<string, ParsedItem[]>();
      for (const it of selected) {
        const key = toGroupKey(it.title);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(it);
      }

      const siteCache = new Map<string, string>();

      for (const [, groupItems] of groups) {
        // Nom affiché = le plus court (évite "The Infinite Mage" si "Infinite Mage" existe)
        const titleName = groupItems.reduce((a, b) => a.title.length <= b.title.length ? a : b).title;

        const { data: existing } = await supabase
          .from("titles").select("id")
          .eq("user_id", userId).ilike("name", titleName).maybeSingle();

        let titleId: string;
        if (existing) {
          titleId = existing.id;
        } else {
          const { data: newTitle } = await supabase.from("titles").insert({
            user_id: userId, name: titleName,
            type: settings?.default_type ?? "manga",
            status: settings?.default_status ?? "ongoing",
          }).select("id").single();
          if (!newTitle) continue;
          titleId = newTitle.id;
        }

        // Sauvegarder le chapitre le plus élevé (sans écraser une progression existante supérieure)
        const chapNums = groupItems.map(it => parseFloat(it.chapterNum ?? "")).filter(n => !isNaN(n));
        if (chapNums.length > 0) {
          const maxChapter = Math.max(...chapNums);
          const { data: existingProg } = await supabase
            .from("reading_progress").select("last_chapter_read").eq("title_id", titleId).maybeSingle();
          const existingNum = parseFloat(existingProg?.last_chapter_read ?? "");
          if (!existingProg || isNaN(existingNum) || maxChapter > existingNum) {
            await supabase.from("reading_progress").upsert(
              { title_id: titleId, last_chapter_read: String(maxChapter), last_read_at: new Date().toISOString() },
              { onConflict: "title_id" }
            );
          }
        }

        // Ajouter les sources — une par URL de manga unique
        const seenSourceUrls = new Set<string>();
        for (const it of groupItems) {
          if (seenSourceUrls.has(it.sourceUrl)) continue;
          seenSourceUrls.add(it.sourceUrl);

          let siteId: string | null = null;
          try {
            const u = new URL(it.sourceUrl);
            const host = u.hostname;

            if (siteCache.has(host)) {
              siteId = siteCache.get(host)!;
            } else {
              const matchedSite = (sites ?? []).find((s) => {
                try { return new URL(s.base_url).hostname === host; } catch { return false; }
              });
              if (matchedSite) {
                siteId = matchedSite.id;
                if (!(matchedSite as { url_template?: string | null }).url_template) {
                  const template = inferUrlTemplate(it.sourceUrl, titleName);
                  if (template) await supabase.from("sites").update({ url_template: template }).eq("id", siteId);
                }
              } else {
                const raw = host.replace(/^www\./, "").split(".")[0];
                const siteName = raw.charAt(0).toUpperCase() + raw.slice(1);
                const { data: newSite } = await supabase.from("sites")
                  .insert({ user_id: userId, name: siteName, base_url: `${u.protocol}//${host}`, url_template: inferUrlTemplate(it.sourceUrl, titleName), priority: 0, enabled: true })
                  .select("id").single();
                siteId = newSite?.id ?? null;
              }
              if (siteId) siteCache.set(host, siteId);
            }
          } catch { /* ignore */ }

          await supabase.from("title_sources").insert({
            title_id: titleId, site_id: siteId, url: it.sourceUrl, is_primary: true,
          });
        }
      }

      await supabase.from("imports").insert({
        user_id: userId, source: "html_bookmarks", raw_json: { count: selected.length },
      });
      toast.success(`${groups.size} titre(s) importé(s) depuis ${selected.length} favoris`);
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
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {it.chapterNum ? `ch. ${it.chapterNum}` : ""}
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

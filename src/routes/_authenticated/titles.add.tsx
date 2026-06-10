import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/titles/add")({
  head: () => ({ meta: [{ title: "Ajouter des titres · ReadingTK" }] }),
  component: AddTitles,
});

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
 * Déduit un template d'URL depuis une URL de titre.
 * Ex: "https://vortexscans.org/series/the-shepherd-wizard/" + "The Shepherd Wizard"
 *   → "https://vortexscans.org/series/{slug}/"
 *
 * Cherche le segment de l'URL qui correspond au slug du titre (exact ou avec suffixe),
 * puis le remplace par {slug}.
 */
function inferUrlTemplate(rawUrl: string, titleName: string): string | null {
  try {
    const u = new URL(rawUrl);
    const parts = u.pathname.split("/").filter(Boolean);

    // Supprimer les segments "chapitre" à la fin (si URL de chapitre)
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

    // Chercher le segment qui correspond au slug du titre (exact ou avec suffixe hash)
    for (let i = 0; i < titleParts.length; i++) {
      const part = titleParts[i].toLowerCase();
      if (slug && (part === slug || part.startsWith(slug + "-") || part.startsWith(slug + "_"))) {
        const prefix = titleParts.slice(0, i).join("/");
        return `${u.origin}/${prefix ? prefix + "/" : ""}{slug}/`;
      }
    }

    // Fallback : remplacer le dernier segment (le plus proche du titre)
    if (titleParts.length >= 1) {
      const prefix = titleParts.slice(0, -1).join("/");
      return `${u.origin}/${prefix ? prefix + "/" : ""}{slug}/`;
    }

    return null;
  } catch { return null; }
}

// ── Composant ─────────────────────────────────────────────────────────────────

function AddTitles() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"manual" | "urls">("urls");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["user-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("user_settings").select("default_type, default_status").maybeSingle();
      return data;
    },
  });

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => (await supabase.from("sites").select("*")).data ?? [],
  });

  async function submitManual() {
    setLoading(true);
    try {
      const names = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;
      const rows = names.map((name) => ({
        user_id: userId, name,
        type: settings?.default_type ?? "manga",
        status: settings?.default_status ?? "ongoing",
      }));
      const { error } = await supabase.from("titles").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} titre(s) créé(s)`);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  async function submitUrls() {
    setLoading(true);
    try {
      const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user!.id;

      for (const url of lines) {
        // ── 1. Parse title + chapter from URL ──────────────────────────────
        let name = url;
        let chapterNum: string | null = null;
        let sourceUrl = url;
        try {
          const u = new URL(url);
          const segments = u.pathname.split("/").filter(Boolean);
          const chapterRe = /^(?:chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/i;
          const chapterWordRe = /^(?:chapter|chapitre|chap|ch|episode|ep)$/i;
          let titleSeg: string | null = null;
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

          if (chapterIdx >= 0) {
            const titlePath = "/" + segments.slice(0, chapterIdx).join("/") + "/";
            sourceUrl = `${u.protocol}//${u.host}${titlePath}`;
          }

          if (!titleSeg) titleSeg = segments[segments.length - 1] ?? u.hostname;

          name = decodeURIComponent(titleSeg)
            .replace(/-[a-f0-9]{6,}$/i, "")
            .replace(/[-_]+/g, " ")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();
        } catch { /* keep url as name */ }

        // ── 2. Find existing title or create new one ────────────────────────
        const { data: existingTitle } = await supabase
          .from("titles").select("id").eq("user_id", userId).ilike("name", name).maybeSingle();

        let titleId: string;
        if (existingTitle) {
          titleId = existingTitle.id;
        } else {
          const { data: newTitle, error: titleErr } = await supabase
            .from("titles")
            .insert({ user_id: userId, name, type: settings?.default_type ?? "manga", status: settings?.default_status ?? "ongoing" })
            .select("id").single();
          if (titleErr) throw titleErr;
          titleId = newTitle.id;
        }

        // ── 3. Save chapter read if extracted ──────────────────────────────
        if (chapterNum) {
          await supabase.from("reading_progress").upsert(
            { title_id: titleId, last_chapter_read: chapterNum, last_read_at: new Date().toISOString() },
            { onConflict: "title_id" }
          );
        }

        // ── 4. Match site by domain, or create it ──────────────────────────
        let siteId: string | null = null;
        try {
          const u = new URL(sourceUrl);
          const host = u.hostname;
          const matchedSite = (sites ?? []).find((s) => {
            try { return new URL(s.base_url).hostname === host; } catch { return false; }
          });

          if (matchedSite) {
            siteId = matchedSite.id;
            // Mettre à jour le template si pas encore défini
            if (!(matchedSite as { url_template?: string | null }).url_template) {
              const template = inferUrlTemplate(sourceUrl, name);
              if (template) {
                await supabase.from("sites").update({ url_template: template }).eq("id", siteId);
              }
            }
          } else {
            // Créer le site avec template inféré
            const raw = host.replace(/^www\./, "").split(".")[0];
            const siteName = raw.charAt(0).toUpperCase() + raw.slice(1);
            const base_url = `${u.protocol}//${host}`;
            const template = inferUrlTemplate(sourceUrl, name);
            const { data: newSite, error: siteErr } = await supabase
              .from("sites")
              .insert({ user_id: userId, name: siteName, base_url, url_template: template, priority: 0, enabled: true })
              .select("id").single();
            if (siteErr) throw siteErr;
            siteId = newSite?.id ?? null;
          }
        } catch (e) { throw e; }

        // ── 5. Insert source (main manga page, not chapter page) ───────────
        await supabase.from("title_sources").insert({ title_id: titleId, site_id: siteId, url: sourceUrl, is_primary: true });
      }

      toast.success(`${lines.length} URL(s) importée(s) ✓`);
      navigate({ to: "/dashboard" });
    } catch (e) { toast.error((e as Error).message); } finally { setLoading(false); }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold">Ajouter des titres</h1>
      <div className="mt-6 flex gap-2 border-b border-border/60">
        {(["urls", "manual"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${tab === t ? "border-b-2 border-accent text-foreground" : "text-muted-foreground"}`}>
            {t === "manual" ? "Ajout manuel" : "Ajout via URLs"}
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-4">
        <p className="text-xs text-muted-foreground">
          {tab === "manual"
            ? "Un titre par ligne."
            : "Une URL par ligne. Le domaine sera associé automatiquement à un site existant, et le template d'URL sera déduit."}
        </p>
        <textarea
          value={text} onChange={(e) => setText(e.target.value)} rows={12}
          placeholder={tab === "manual" ? "One Piece\nSolo Leveling\n..." : "https://example.com/manga/one-piece\n..."}
          className="w-full rounded-md border border-input bg-input/50 p-3 font-mono text-sm outline-none focus:border-ring"
        />
        <button
          onClick={tab === "manual" ? submitManual : submitUrls}
          disabled={loading || !text.trim()}
          className="rounded-md px-5 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          style={{ background: "var(--gradient-primary)" }}
        >{loading ? "..." : "Créer"}</button>
      </div>
    </div>
  );
}

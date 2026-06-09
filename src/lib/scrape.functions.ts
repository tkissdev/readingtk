import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Heuristic: extract last chapter from HTML
function parseLastChapter(html: string, baseUrl: string, format: "numeric" | "text"): { label: string; url: string } | null {
  const candidates: { num: number; label: string; url: string }[] = [];
  const chapterNumRe = /(chapter|chapitre|chap|ch\.?|episode|ep\.?)[-_\s]?(\d+(?:\.\d+)?)/i;

  // ── Strategy 1: anchor tags with chapter keyword in text or href ──────────
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const km = chapterNumRe.exec(text) || chapterNumRe.exec(href);
    if (km) {
      const num = parseFloat(km[2]);
      if (!isNaN(num)) {
        let url = href;
        try { url = new URL(href, baseUrl).toString(); } catch { /* ignore */ }
        candidates.push({ num, label: text || `Chapter ${num}`, url });
      }
    }
  }

  // ── Strategy 2: scan ALL href attributes for slug/chapter-NN pattern ──────
  // Works even on JS-rendered pages that embed URLs in static HTML/JSON
  if (!candidates.length) {
    try {
      const base = new URL(baseUrl);
      // Build a pattern from the source URL path: e.g. /manga/the-shepherd-wizard/
      const pathParts = base.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (pathParts.length >= 1) {
        const slug = pathParts[pathParts.length - 1];
        // Match any URL containing the slug followed by /chapter-NN/ or /chap-NN/
        const slugChapterRe = new RegExp(
          slug.replace(/[-]/g, "[-_]") +
          /\/(chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/.source,
          "gi"
        );
        const hrefRe = /href=["']([^"']+)["']/gi;
        let hm: RegExpExecArray | null;
        while ((hm = hrefRe.exec(html)) !== null) {
          const href = hm[1];
          const sm = slugChapterRe.exec(href);
          slugChapterRe.lastIndex = 0; // reset for next iteration
          if (sm) {
            const num = parseFloat(sm[2]);
            if (!isNaN(num)) {
              let url = href;
              try { url = new URL(href, baseUrl).toString(); } catch { /* ignore */ }
              candidates.push({ num, label: `Chapter ${num}`, url });
            }
          }
        }
      }
    } catch { /* ignore */ }
  }

  // ── Strategy 3: scan raw text / JSON blobs for chapter numbers ───────────
  // Handles sites that embed chapter lists as JSON in <script> tags
  if (!candidates.length) {
    const rawNumRe = /["'\/](chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)["'\/]/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rawNumRe.exec(html)) !== null) {
      const num = parseFloat(rm[2]);
      if (!isNaN(num)) {
        candidates.push({ num, label: `Chapter ${num}`, url: baseUrl });
      }
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.num - a.num);
  const top = candidates[0];
  return { label: format === "numeric" ? String(top.num) : top.label.slice(0, 120), url: top.url };
}

export const checkNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { titleId?: string }) => z.object({ titleId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: settings } = await supabase
      .from("user_settings").select("chapter_format, in_app_notifications_enabled").eq("user_id", userId).maybeSingle();
    const format = (settings?.chapter_format === "text" ? "text" : "numeric") as "numeric" | "text";
    const notifyEnabled = settings?.in_app_notifications_enabled ?? true;

    let titlesQuery = supabase.from("titles").select("id, name").eq("user_id", userId);
    if (data.titleId) titlesQuery = titlesQuery.eq("id", data.titleId);
    const { data: titles, error: titlesErr } = await titlesQuery;
    if (titlesErr) throw new Error(titlesErr.message);

    const { data: sites } = await supabase.from("sites").select("*").eq("user_id", userId).eq("enabled", true).order("priority", { ascending: false });
    const siteMap = new Map((sites ?? []).map((s) => [s.id, s]));

    let detected = 0;
    let errors = 0;

    for (const title of titles ?? []) {
      const { data: sources } = await supabase
        .from("title_sources").select("*").eq("title_id", title.id);
      if (!sources?.length) continue;

      const ordered = [...sources].sort((a, b) => {
        const pa = siteMap.get(a.site_id ?? "")?.priority ?? -999;
        const pb = siteMap.get(b.site_id ?? "")?.priority ?? -999;
        return pb - pa;
      }).filter((s) => !s.site_id || siteMap.has(s.site_id));

      const { data: progress } = await supabase
        .from("reading_progress").select("last_chapter_read").eq("title_id", title.id).maybeSingle();

      for (const src of ordered) {
        try {
          const res = await fetch(src.url, {
            headers: { "User-Agent": "Mozilla/5.0 ReadingTK/0.1" },
            signal: AbortSignal.timeout(10000),
          });
          if (!res.ok) { errors++; continue; }
          const html = await res.text();
          const found = parseLastChapter(html, src.url, format);
          if (!found) continue;

          // Update title_source last_seen
          await supabase.from("title_sources").update({ last_seen_chapter: found.label }).eq("id", src.id);

          // Check if chapter already recorded
          const { data: exists } = await supabase
            .from("chapters").select("id").eq("title_id", title.id).eq("chapter_label", found.label).maybeSingle();

          if (!exists) {
            const { data: chap } = await supabase.from("chapters").insert({
              title_id: title.id, site_id: src.site_id, chapter_label: found.label, chapter_url: found.url,
            }).select("id").single();

            // Compare with reading progress
            const lastRead = progress?.last_chapter_read ? parseFloat(progress.last_chapter_read) : -1;
            const foundNum = parseFloat(found.label);
            const isNew = isNaN(foundNum) || isNaN(lastRead) ? !progress?.last_chapter_read : foundNum > lastRead;
            if (isNew && notifyEnabled && chap) {
              await supabase.from("notifications").insert({
                user_id: userId, title_id: title.id, chapter_id: chap.id, channel: "in_app", sent_at: new Date().toISOString(),
              });
              detected++;
            }
          }
          break; // success: stop trying other sources for this title
        } catch {
          errors++;
        }
      }
    }

    await supabase.from("user_settings").update({ last_global_check_at: new Date().toISOString() }).eq("user_id", userId);

    return { detected, errors, titlesChecked: titles?.length ?? 0 };
  });

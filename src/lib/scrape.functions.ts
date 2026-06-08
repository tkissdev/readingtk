import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// Heuristic: extract last chapter from HTML
function parseLastChapter(html: string, baseUrl: string, format: "numeric" | "text"): { label: string; url: string } | null {
  // Find anchor tags containing chapter-like keywords
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const candidates: { num: number; label: string; url: string }[] = [];
  const keywordRe = /(chapter|chapitre|ch\.?|episode|ep\.?)\s*[-_]?\s*(\d+(?:\.\d+)?)/i;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const km = keywordRe.exec(text) || keywordRe.exec(href);
    if (km) {
      const num = parseFloat(km[2]);
      if (!isNaN(num)) {
        let url = href;
        try { url = new URL(href, baseUrl).toString(); } catch { /* ignore */ }
        candidates.push({ num, label: text || `Chapter ${num}`, url });
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

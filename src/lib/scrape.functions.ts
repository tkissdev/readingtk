import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ── Title matching helper ──────────────────────────────────────────────────
function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ").trim();
}

function findBestMatch<T>(items: T[], query: string, getTitle: (item: T) => string): T | null {
  if (!items.length) return null;
  const q = normalize(query);
  // 1. Exact match
  for (const item of items) {
    if (normalize(getTitle(item)) === q) return item;
  }
  // 2. One contains the other
  for (const item of items) {
    const t = normalize(getTitle(item));
    if (t.includes(q) || q.includes(t)) return item;
  }
  // 3. First result as fallback
  return items[0];
}

// ── Comick.io API ──────────────────────────────────────────────────────────
async function fetchComick(titleName: string): Promise<{ chapter: string; url: string } | null> {
  const BASES = ["https://api.comick.fun", "https://api.comick.dev", "https://api.comick.io"];
  for (const base of BASES) {
    try {
      const searchRes = await fetch(
        `${base}/v1.0/search?q=${encodeURIComponent(titleName)}&limit=5&tachiyomi=true`,
        { headers: { "User-Agent": "Tachiyomi/1.0" }, signal: AbortSignal.timeout(10000) }
      );
      if (!searchRes.ok) continue;
      const results = await searchRes.json() as any[];
      if (!Array.isArray(results) || !results.length) continue;

      const match = findBestMatch(results, titleName, (r) => r.title ?? r.slug ?? "");
      if (!match) continue;

      const hid = match.hid;
      if (!hid) continue;

      // Always fetch chapter list to get the direct chapter link
      const chapRes = await fetch(
        `${base}/comic/${hid}/chapters?page=1&order=desc&limit=3&tachiyomi=true`,
        { headers: { "User-Agent": "Tachiyomi/1.0" }, signal: AbortSignal.timeout(10000) }
      );
      if (!chapRes.ok) {
        // Fallback: use last_chapter from search result if chapter fetch fails
        if (match.last_chapter != null) {
          return {
            chapter: String(match.last_chapter),
            url: `https://comick.io/comic/${match.slug}`,
          };
        }
        continue;
      }
      const chapData = await chapRes.json();
      const chapters: any[] = chapData.chapters ?? (Array.isArray(chapData) ? chapData : []);
      if (!chapters.length) {
        // Fallback: use last_chapter from search result
        if (match.last_chapter != null) {
          return {
            chapter: String(match.last_chapter),
            url: `https://comick.io/comic/${match.slug}`,
          };
        }
        continue;
      }

      // Pick highest chapter number
      const sorted = chapters
        .map((c: any) => ({ num: parseFloat(c.chap ?? c.chapter ?? ""), raw: c }))
        .filter((c) => !isNaN(c.num))
        .sort((a, b) => b.num - a.num);
      if (!sorted.length) continue;

      const top = sorted[0];
      const chapHid = top.raw.hid ?? "";
      const chapNum = String(top.num);
      return {
        chapter: chapNum,
        url: chapHid
          ? `https://comick.io/comic/${match.slug}/${chapHid}-chapter-${chapNum}-en`
          : `https://comick.io/comic/${match.slug}`,
      };
    } catch {
      continue;
    }
  }
  return null;
}

// ── MangaDex API ───────────────────────────────────────────────────────────
async function fetchMangaDex(titleName: string): Promise<{ chapter: string; url: string } | null> {
  try {
    const searchRes = await fetch(
      `https://api.mangadex.org/manga?title=${encodeURIComponent(titleName)}&limit=10&order[relevance]=desc`,
      { headers: { "User-Agent": "ReadingTK/0.1" }, signal: AbortSignal.timeout(10000) }
    );
    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    const items: any[] = searchData.data ?? [];
    if (!items.length) return null;

    const match = findBestMatch(items, titleName, (item) => {
      const titles = item.attributes?.title ?? {};
      return (titles["en"] ?? Object.values(titles)[0] ?? "") as string;
    });
    if (!match) return null;

    const mangaId = match.id;
    const latestChapId = match.attributes?.latestUploadedChapter;

    // Fast path: use latestUploadedChapter UUID
    if (latestChapId) {
      const chapRes = await fetch(
        `https://api.mangadex.org/chapter/${latestChapId}`,
        { headers: { "User-Agent": "ReadingTK/0.1" }, signal: AbortSignal.timeout(8000) }
      );
      if (chapRes.ok) {
        const chapData = await chapRes.json();
        const chapNum = chapData.data?.attributes?.chapter;
        if (chapNum) {
          return { chapter: String(chapNum), url: `https://mangadex.org/chapter/${latestChapId}` };
        }
      }
    }

    // Fallback: query chapter endpoint sorted by chapter desc
    const chapRes = await fetch(
      `https://api.mangadex.org/chapter?manga=${mangaId}&order[chapter]=desc&limit=1`,
      { headers: { "User-Agent": "ReadingTK/0.1" }, signal: AbortSignal.timeout(8000) }
    );
    if (!chapRes.ok) return null;
    const chapData = await chapRes.json();
    const chapter = chapData.data?.[0];
    if (!chapter) return null;

    const chapNum = chapter.attributes?.chapter;
    if (!chapNum) return null;
    return { chapter: String(chapNum), url: `https://mangadex.org/chapter/${chapter.id}` };
  } catch {
    return null;
  }
}

// ── HTML scraping fallback ─────────────────────────────────────────────────
function parseLastChapter(html: string, baseUrl: string, format: "numeric" | "text"): { label: string; url: string } | null {
  const candidates: { num: number; label: string; url: string }[] = [];
  const chapterNumRe = /(chapter|chapitre|chap|ch\.?|episode|ep\.?)[-_\s]?(\d+(?:\.\d+)?)/i;

  // Strategy 1: anchor tags
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

  // Strategy 2: slug-based URL scan
  if (!candidates.length) {
    try {
      const base = new URL(baseUrl);
      const pathParts = base.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (pathParts.length >= 1) {
        const slug = pathParts[pathParts.length - 1];
        const slugChapterRe = new RegExp(
          slug.replace(/[-]/g, "[-_]") + /\/(chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/.source,
          "gi"
        );
        const hrefRe = /href=["']([^"']+)["']/gi;
        let hm: RegExpExecArray | null;
        while ((hm = hrefRe.exec(html)) !== null) {
          const href = hm[1];
          const sm = slugChapterRe.exec(href);
          slugChapterRe.lastIndex = 0;
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

  // Strategy 3: raw JSON/script blobs
  if (!candidates.length) {
    const rawNumRe = /["'\/](chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)["'\/]/gi;
    let rm: RegExpExecArray | null;
    while ((rm = rawNumRe.exec(html)) !== null) {
      const num = parseFloat(rm[2]);
      if (!isNaN(num)) candidates.push({ num, label: `Chapter ${num}`, url: baseUrl });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.num - a.num);
  const top = candidates[0];
  return { label: format === "numeric" ? String(top.num) : top.label.slice(0, 120), url: top.url };
}

// ── Main server function ───────────────────────────────────────────────────
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
    const logs: { title: string; source: string | null; chapter: string | null; reason: string }[] = [];

    for (const title of titles ?? []) {
      try {
        const { data: progress } = await supabase
          .from("reading_progress").select("last_chapter_read").eq("title_id", title.id).maybeSingle();

        // ── 1. Try Comick.io ─────────────────────────────────────────────
        let found: { label: string; url: string } | null = null;
        let apiSource: "comick" | "mangadex" | "scrape" | null = null;

        const comick = await fetchComick(title.name);
        if (comick) {
          found = { label: format === "numeric" ? comick.chapter : `Chapter ${comick.chapter}`, url: comick.url };
          apiSource = "comick";
        }

        // ── 2. Try MangaDex ──────────────────────────────────────────────
        if (!found) {
          const mdex = await fetchMangaDex(title.name);
          if (mdex) {
            found = { label: format === "numeric" ? mdex.chapter : `Chapter ${mdex.chapter}`, url: mdex.url };
            apiSource = "mangadex";
          }
        }

        // ── 3. Fall back to URL scraping ─────────────────────────────────
        let scrapeStatus = "";
        if (!found) {
          const { data: sources } = await supabase
            .from("title_sources").select("*").eq("title_id", title.id);

          const ordered = [...(sources ?? [])].sort((a, b) => {
            const pa = siteMap.get(a.site_id ?? "")?.priority ?? -999;
            const pb = siteMap.get(b.site_id ?? "")?.priority ?? -999;
            return pb - pa;
          }).filter((s) => !s.site_id || siteMap.has(s.site_id));

          for (const src of ordered) {
            try {
              const res = await fetch(src.url, {
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                  "Accept-Language": "en-US,en;q=0.9",
                  "Cache-Control": "no-cache",
                },
                signal: AbortSignal.timeout(15000),
              });
              if (!res.ok) { errors++; scrapeStatus = `HTTP ${res.status}`; continue; }
              const html = await res.text();
              const scraped = parseLastChapter(html, src.url, format);
              if (scraped) {
                found = scraped;
                apiSource = "scrape";
                scrapeStatus = "ok";
                // Update last_seen on source
                await supabase.from("title_sources").update({ last_seen_chapter: scraped.label }).eq("id", src.id);
                break;
              } else {
                scrapeStatus = "no chapter pattern found";
              }
            } catch (e: any) { errors++; scrapeStatus = e?.message ?? "fetch error"; }
          }
        }

        if (!found) {
          logs.push({ title: title.name, source: null, chapter: null, reason: `comick=null, mangadex=null, scrape=${scrapeStatus || "no sources"}` });
          continue;
        }

        // ── Update title_sources last_seen if from API ───────────────────
        if (apiSource !== "scrape") {
          await supabase.from("title_sources")
            .update({ last_seen_chapter: found.label })
            .eq("title_id", title.id)
            .eq("is_primary", true);
        }

        // ── Check if chapter already recorded ────────────────────────────
        const { data: exists } = await supabase
          .from("chapters").select("id").eq("title_id", title.id).eq("chapter_label", found.label).maybeSingle();

        if (!exists) {
          const { data: chap } = await supabase.from("chapters").insert({
            title_id: title.id,
            site_id: null,
            chapter_label: found.label,
            chapter_url: found.url,
          }).select("id").single();

          // Compare with reading progress
          const lastRead = progress?.last_chapter_read ? parseFloat(progress.last_chapter_read) : -1;
          const foundNum = parseFloat(found.label);
          const isNew = isNaN(foundNum) || isNaN(lastRead) ? !progress?.last_chapter_read : foundNum > lastRead;

          if (isNew && notifyEnabled && chap) {
            await supabase.from("notifications").insert({
              user_id: userId, title_id: title.id, chapter_id: chap.id,
              channel: "in_app", sent_at: new Date().toISOString(),
            });
            detected++;
          }
          logs.push({ title: title.name, source: apiSource, chapter: found.label, reason: isNew ? "new chapter" : "already recorded" });
        } else {
          logs.push({ title: title.name, source: apiSource, chapter: found.label, reason: "chapter already in db" });
        }
      } catch (e: any) { errors++; logs.push({ title: title.name, source: null, chapter: null, reason: `exception: ${e?.message}` }); }
    }

    await supabase.from("user_settings")
      .update({ last_global_check_at: new Date().toISOString() })
      .eq("user_id", userId);

    return { detected, errors, titlesChecked: titles?.length ?? 0, logs };
  });

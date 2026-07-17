const SUPABASE_URL = "https://jjjfphkvwtruckxygwal.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqamZwaGt2d3RydWNreHlnd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjY2MDksImV4cCI6MjA5NjUwMjYwOX0.VEGbnT2qOQ2nr82Lpki8ppQS5jQymPMj6rMZ7gFc9zA";
const STORAGE_KEY = "sb-jjjfphkvwtruckxygwal-auth-token";
const SITE_URL = "https://readingtk.net";

// ── Helpers storage (Firefox MV2 : chrome.storage ne retourne pas de Promise) ──

function storageGet(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => {
      resolve(result || {});
    });
  });
}

function storageSet(data) {
  return new Promise((resolve) => {
    chrome.storage.local.set(data, () => {
      if (chrome.runtime.lastError) console.error("[RTK] storageSet error:", chrome.runtime.lastError);
      resolve();
    });
  });
}

function storageClear() {
  return new Promise((resolve) => {
    chrome.storage.local.clear(() => { resolve(); });
  });
}

// ── Auth — lecture de session depuis readingtk.net ─────────────────────────────

async function extractSessionFromTab(tabId) {
  return new Promise((resolve) => {
    const code = `
      (function() {
        try {
          const raw = localStorage.getItem("${STORAGE_KEY}");
          if (!raw) return null;
          return JSON.parse(raw);
        } catch(e) { return null; }
      })()
    `;
    chrome.tabs.executeScript(tabId, { code }, (results) => {
      if (chrome.runtime.lastError) {
        console.error("[RTK] executeScript error:", chrome.runtime.lastError.message);
        resolve(null);
        return;
      }
      resolve(results?.[0] ?? null);
    });
  });
}

// Chercher un onglet readingtk.net — utilise callbacks pour éviter les problèmes Firefox
function findReadingTKTab() {
  return new Promise((resolve) => {
    // Chercher dans tous les onglets (plus fiable en Firefox MV2)
    chrome.tabs.query({}, (allTabs) => {
      if (chrome.runtime.lastError || !allTabs) { resolve(null); return; }
      const found = allTabs.find(t => t.url && t.url.includes("readingtk.net"));
      resolve(found ?? null);
    });
  });
}

async function loginViaWebApp() {
  // 1. Chercher un onglet readingtk.net déjà ouvert
  const existing = await findReadingTKTab();

  if (existing) {
    const session = await extractSessionFromTab(existing.id);
    if (session?.access_token) {
      await storeSession(session);
      return { ok: true };
    }
    // Onglet trouvé mais pas de session — le mettre en avant sans ouvrir de nouvel onglet
    chrome.tabs.update(existing.id, { active: true });
    return { error: "Connectez-vous sur readingtk.net, puis réessayez." };
  }

  // 2. Aucun onglet readingtk.net — en ouvrir un et attendre le chargement
  return new Promise((resolve) => {
    chrome.tabs.create({ url: `${SITE_URL}/dashboard` }, (tab) => {
      const listener = (tabId, changeInfo) => {
        if (tabId !== tab.id || changeInfo.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(listener);

        extractSessionFromTab(tabId).then(async (session) => {
          if (session?.access_token) {
            await storeSession(session);
            resolve({ ok: true });
          } else {
            resolve({ error: "Pas de session trouvée. Connectez-vous sur readingtk.net d'abord." });
          }
        });
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
  });
}

async function storeSession(session) {
  await storageSet({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    user_id: session.user?.id,
    token_expires_at: (session.expires_at ?? 0) * 1000,
  });
}

async function refreshToken() {
  const data = await storageGet("refresh_token");
  const refresh_token = data.refresh_token;
  if (!refresh_token) throw new Error("Pas de refresh token");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) throw new Error("Token refresh échoué");
  const tokenData = await res.json();
  await storageSet({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    token_expires_at: (tokenData.expires_at ?? 0) * 1000,
  });
  return tokenData.access_token;
}

async function getToken() {
  const data = await storageGet(["access_token", "token_expires_at"]);
  const access_token = data.access_token;
  const token_expires_at = data.token_expires_at;
  if (!access_token) return null;
  if (token_expires_at && Date.now() > token_expires_at - 5 * 60 * 1000) {
    try { return await refreshToken(); } catch { return null; }
  }
  return access_token;
}

// ── Supabase REST ──────────────────────────────────────────────────────────────

async function sbGet(path) {
  const token = await getToken();
  if (!token) throw new Error("Non connecté");
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { "apikey": SUPABASE_ANON_KEY, "Authorization": `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${res.status}`);
  return res.json();
}

async function sbPost(path, body) {
  const token = await getToken();
  if (!token) throw new Error("Non connecté");
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${res.status}`);
  return res.json();
}

async function sbPatch(path, body) {
  const token = await getToken();
  if (!token) throw new Error("Non connecté");
  await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "PATCH",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ── HTML Parsing ───────────────────────────────────────────────────────────────

// Extrait le type du titre (manga/manhwa/manhua/novel) depuis le HTML de la page
function parseType(html) {
  const typeBlockRe = /\btype\b[\s\S]{0,60}?\b(manhwa|manhua|manwha|manga|novel|webtoon)\b/i;
  const m = typeBlockRe.exec(html);
  if (m) {
    let val = m[1].toLowerCase();
    if (val === "manwha" || val === "webtoon") val = "manhwa";
    return val;
  }
  const jsonLdRe = /<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi;
  let jm;
  while ((jm = jsonLdRe.exec(html)) !== null) {
    try {
      const obj = JSON.parse(jm[1]);
      const genres = [].concat(obj.genre || obj.Genre || []);
      for (const g of genres) {
        const gl = (g || "").toLowerCase();
        if (gl.includes("manhwa")) return "manhwa";
        if (gl.includes("manhua")) return "manhua";
        if (gl.includes("novel"))  return "novel";
        if (gl.includes("manga"))  return "manga";
      }
    } catch {}
  }
  return null;
}

// Extrait l'URL de la couverture depuis la balise og:image
function parseCoverUrl(html) {
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  return m ? m[1] : null;
}

// Convertit un texte de date (absolu ou relatif, EN/FR) en ISO, ou null.
// Gère : "2 days ago", "il y a 3 heures", "June 10, 2024", "2024-06-10", "10/06/2024".
function parseHumanDate(text) {
  if (!text) return null;
  const t = String(text).trim();
  if (!t) return null;
  const low = t.toLowerCase();
  const now = new Date();

  if (/\b(just now|à l'instant|a l'instant|maintenant)\b/.test(low)) return now.toISOString();
  if (/\b(yesterday|hier)\b/.test(low)) { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString(); }
  if (/\b(today|aujourd'hui|aujourdhui)\b/.test(low)) return now.toISOString();

  // Relatif : "2 days ago", "il y a 3 heures"
  const isRel = /ago|il y a|plus tôt|plus tot/.test(low);
  const rel = low.match(/(\d+)\s*(secondes?|seconds?|minutes?|mins?|heures?|hours?|hrs?|jours?|days?|semaines?|weeks?|mois|months?|années?|annees?|ans?|years?)/);
  if (isRel && rel) {
    const n = parseInt(rel[1], 10);
    const u = rel[2];
    const d = new Date(now);
    if (/^(seconde|second)/.test(u)) d.setSeconds(d.getSeconds() - n);
    else if (/^(minute|min)/.test(u)) d.setMinutes(d.getMinutes() - n);
    else if (/^(heure|hour|hr)/.test(u)) d.setHours(d.getHours() - n);
    else if (/^(jour|day)/.test(u)) d.setDate(d.getDate() - n);
    else if (/^(semaine|week)/.test(u)) d.setDate(d.getDate() - n * 7);
    else if (/^(mois|month)/.test(u)) d.setMonth(d.getMonth() - n);
    else d.setFullYear(d.getFullYear() - n);
    return d.toISOString();
  }

  const inRange = (ms) => { const y = new Date(ms).getFullYear(); return y >= 2000 && y <= now.getFullYear() + 1; };

  // Date avec nom de mois anglais : "June 10, 2024" ou "Jun 10 2024" ou "10 June 2024"
  const monthName = low.match(/\d{1,2}\s+[a-z]+\.?\s*,?\s*\d{4}|[a-z]+\.?\s+\d{1,2}\s*,?\s*\d{4}/i);
  if (monthName) {
    const p = Date.parse(monthName[0]);
    if (!isNaN(p) && inRange(p)) return new Date(p).toISOString();
  }

  // ISO ou format directement reconnu
  const direct = Date.parse(t);
  if (!isNaN(direct) && inRange(direct)) return new Date(direct).toISOString();

  // DD/MM/YYYY ou DD-MM-YYYY (interprétation jour-mois, pas mois-jour)
  const dm = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
  if (dm) {
    let dd = parseInt(dm[1], 10), mm = parseInt(dm[2], 10), yy = parseInt(dm[3], 10);
    if (yy < 100) yy += 2000;
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      const d = new Date(yy, mm - 1, dd);
      if (!isNaN(d.getTime()) && inRange(d.getTime())) return d.toISOString();
    }
  }
  return null;
}

// Extrait une date de parution dans une fenêtre HTML située juste après un lien de chapitre.
function extractDateFromHtmlWindow(html, fromIndex) {
  if (fromIndex == null) return null;
  const win = html.slice(fromIndex, fromIndex + 600);
  const dtAttr = win.match(/datetime=["']([^"']+)["']/i);
  if (dtAttr) { const p = parseHumanDate(dtAttr[1]); if (p) return p; }
  const stripped = win.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return parseHumanDate(stripped);
}

function parseLastChapter(html, baseUrl) {
  const chapterNumRe = /(chapter|chapitre|chap|ch\.?|episode|ep\.?)[-_\/\s]?(\d+(?:\.\d+)?)/i;
  // Numéro max plausible : évite de confondre des IDs de BDD avec des numéros de chapitre
  const MAX_CHAPTER = 9999;

  // Extraire le slug de l'URL source pour filtrer les liens propres au titre
  let titleSlug = null;
  try {
    const base = new URL(baseUrl);
    const parts = base.pathname.replace(/\/$/, "").split("/").filter(Boolean);
    if (parts.length >= 1) titleSlug = parts[parts.length - 1]; // ex: "killer-pietro-89829cb7"
  } catch {}

  const allCandidates = [];
  const specificCandidates = [];

  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const km = chapterNumRe.exec(href) || chapterNumRe.exec(text);
    if (km) {
      const num = parseFloat(km[2]);
      if (!isNaN(num) && num <= MAX_CHAPTER) {
        let url = href;
        try { url = new URL(href, baseUrl).toString(); } catch {}
        const candidate = { num, url, idx: anchorRe.lastIndex };
        allCandidates.push(candidate);
        // Spécifique = le lien contient le slug du titre (ex: killer-pietro-89829cb7)
        if (titleSlug && href.includes(titleSlug)) specificCandidates.push(candidate);
      }
    }
  }

  // Préférer les liens spécifiques au titre : évite de ramasser les chapitres
  // d'autres titres affichés dans la sidebar ou les "derniers chapitres".
  // Si on a un slug mais aucun lien spécifique, ne pas utiliser allCandidates
  // (pourraient être des chapitres d'autres titres) : retourner null forcera le
  // fallback via onglet qui utilise des sélecteurs CSS plus précis.
  let candidates = specificCandidates.length > 0 ? specificCandidates : (titleSlug ? [] : allCandidates);

  if (!candidates.length) {
    try {
      const base = new URL(baseUrl);
      const parts = base.pathname.replace(/\/$/, "").split("/").filter(Boolean);
      if (parts.length >= 1) {
        const slug = parts[parts.length - 1];
        const slugRe = new RegExp(
          slug.replace(/[-]/g, "[-_]") + /\/(chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)/.source,
          "gi"
        );
        const hrefRe = /href=["']([^"']+)["']/gi;
        let hm;
        while ((hm = hrefRe.exec(html)) !== null) {
          const href = hm[1];
          const sm = slugRe.exec(href);
          slugRe.lastIndex = 0;
          if (sm) {
            const num = parseFloat(sm[2]);
            if (!isNaN(num) && num <= MAX_CHAPTER) {
              let url = href;
              try { url = new URL(href, baseUrl).toString(); } catch {}
              candidates.push({ num, url });
            }
          }
        }
      }
    } catch {}
  }

  // Raw regex trop large (trouve tout /chapter-N/ dans le HTML, y compris les sidebars).
  // Ne l'utiliser qu'en dernier recours quand on n'a pas de slug pour filtrer.
  if (!candidates.length && !titleSlug) {
    const rawRe = /["'\/](chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)["'\/]/gi;
    let rm;
    while ((rm = rawRe.exec(html)) !== null) {
      const num = parseFloat(rm[2]);
      if (!isNaN(num) && num <= MAX_CHAPTER) candidates.push({ num, url: baseUrl });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.num - a.num);
  const best = candidates[0];
  const publishedAt = extractDateFromHtmlWindow(html, best.idx);
  return { num: best.num, url: best.url, publishedAt };
}

// Détecte si une URL a été redirigée vers un autre site ou la page d'accueil du site.
function isRedirectedAway(originalUrl, finalUrl) {
  if (!finalUrl || finalUrl === originalUrl) return false;
  try {
    const orig = new URL(originalUrl);
    const final = new URL(finalUrl);
    const norm = (h) => h.replace(/^www\./, "");
    if (norm(orig.hostname) !== norm(final.hostname)) return true;
    const origDepth = orig.pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
    const finalDepth = final.pathname.replace(/\/$/, "").split("/").filter(Boolean).length;
    if (origDepth >= 2 && finalDepth <= 1) return true;
  } catch {}
  return false;
}

// Vérifie qu'une URL de chapitre mène bien vers une page valide (pas 404, pas redirigée
// vers un autre domaine). Retourne l'URL validée ou sourceUrl en fallback.
async function validateChapterUrl(chapterUrl, sourceUrl) {
  if (!chapterUrl || chapterUrl === sourceUrl) return chapterUrl;
  try {
    const res = await fetch(chapterUrl, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404 || res.status === 410) return sourceUrl;
    if (isRedirectedAway(chapterUrl, res.url)) return sourceUrl;
    return chapterUrl;
  } catch {
    return chapterUrl;
  }
}

// ── Fetch silencieux (aucun onglet ouvert, invisible pour l'utilisateur) ──────────

async function fetchSilent(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
    },
  });

  // 404 / 410 via code HTTP — le plus fiable
  if (res.status === 404 || res.status === 410) {
    return { found: null, is404: true, html: null, debug: { status: res.status } };
  }

  // Redirection vers un autre domaine ou la page d'accueil = le titre n'existe pas ici
  if (isRedirectedAway(url, res.url)) {
    return { found: null, isRedirect: true, html: null, debug: { redirect: res.url } };
  }

  const html = await res.text();

  // 404 soft : page renvoie 200 mais affiche une erreur dans le titre ou le contenu
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const pageTitle = titleMatch ? titleMatch[1].toLowerCase() : "";
  const bodySnippet = html.slice(0, 2000).toLowerCase();
  const is404 = /\b404\b/.test(pageTitle) || /not.?found/i.test(pageTitle) || /introuvable/i.test(pageTitle)
    || (/\b404\b/.test(bodySnippet) && /\b(not.?found|error|erreur)\b/i.test(bodySnippet));
  if (is404) return { found: null, is404: true, html: null, debug: { pageTitle } };

  const found = parseLastChapter(html, url);
  const coverUrl = parseCoverUrl(html);
  const type = parseType(html);
  return { found, is404: false, coverUrl, type, html: found ? null : html, debug: { pageTitle } };
}

// ── Fetch via onglet réel (fallback pour les sites JS-only) ────────────────────

function injectedExtract() {
  return new Promise((resolve) => {
    const chapterNumRe = /(chapter|chapitre|chap|ch|episode|ep)[-_\/\s]?(\d+(?:\.\d+)?)/i;
    const SELECTORS = [
      ".wp-manga-chapter a", ".listing-chapters_wrap a", ".chapter-list a",
      ".chapters a", ".chapter-li a", ".row-content-chapter li a",
      "ul.main.version-chap li a", ".eph-num a", "li.wp-manga-chapter a",
    ];

    const MAX_CHAPTER = 9999;
    const titleSlug = (() => {
      try {
        const parts = location.pathname.replace(/\/$/, "").split("/").filter(Boolean);
        return parts.length >= 1 ? parts[parts.length - 1] : null;
      } catch { return null; }
    })();

    // Parseur de date inline (le contexte injecté n'a pas accès aux fonctions externes)
    function parseHumanDate(text) {
      if (!text) return null;
      const t = String(text).trim();
      if (!t) return null;
      const low = t.toLowerCase();
      const now = new Date();
      if (/\b(just now|à l'instant|a l'instant|maintenant)\b/.test(low)) return now.toISOString();
      if (/\b(yesterday|hier)\b/.test(low)) { const d = new Date(now); d.setDate(d.getDate() - 1); return d.toISOString(); }
      if (/\b(today|aujourd'hui|aujourdhui)\b/.test(low)) return now.toISOString();
      const isRel = /ago|il y a|plus tôt|plus tot/.test(low);
      const rel = low.match(/(\d+)\s*(secondes?|seconds?|minutes?|mins?|heures?|hours?|hrs?|jours?|days?|semaines?|weeks?|mois|months?|années?|annees?|ans?|years?)/);
      if (isRel && rel) {
        const n = parseInt(rel[1], 10), u = rel[2], d = new Date(now);
        if (/^(seconde|second)/.test(u)) d.setSeconds(d.getSeconds() - n);
        else if (/^(minute|min)/.test(u)) d.setMinutes(d.getMinutes() - n);
        else if (/^(heure|hour|hr)/.test(u)) d.setHours(d.getHours() - n);
        else if (/^(jour|day)/.test(u)) d.setDate(d.getDate() - n);
        else if (/^(semaine|week)/.test(u)) d.setDate(d.getDate() - n * 7);
        else if (/^(mois|month)/.test(u)) d.setMonth(d.getMonth() - n);
        else d.setFullYear(d.getFullYear() - n);
        return d.toISOString();
      }
      const inRange = (ms) => { const y = new Date(ms).getFullYear(); return y >= 2000 && y <= now.getFullYear() + 1; };
      const monthName = low.match(/\d{1,2}\s+[a-z]+\.?\s*,?\s*\d{4}|[a-z]+\.?\s+\d{1,2}\s*,?\s*\d{4}/i);
      if (monthName) { const p = Date.parse(monthName[0]); if (!isNaN(p) && inRange(p)) return new Date(p).toISOString(); }
      const direct = Date.parse(t);
      if (!isNaN(direct) && inRange(direct)) return new Date(direct).toISOString();
      const dm = t.match(/\b(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})\b/);
      if (dm) {
        let dd = parseInt(dm[1], 10), mm = parseInt(dm[2], 10), yy = parseInt(dm[3], 10);
        if (yy < 100) yy += 2000;
        if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) { const d = new Date(yy, mm - 1, dd); if (!isNaN(d.getTime()) && inRange(d.getTime())) return d.toISOString(); }
      }
      return null;
    }

    // Cherche une date de parution proche d'un lien de chapitre dans le DOM
    function findDateForEl(el) {
      if (!el) return null;
      const scope = el.closest("li, tr, .wp-manga-chapter, .chapter-item, .eph-num, .chapter, .a-h") || el.parentElement || el;
      const timeEl = scope.querySelector("time[datetime], time");
      if (timeEl) { const p = parseHumanDate(timeEl.getAttribute("datetime") || timeEl.textContent); if (p) return p; }
      const sels = [".chapter-release-date", ".chapterdate", ".chapter-date", ".releasedate", ".date", "[class*='date']", "[class*='time']", "span", "i", "em"];
      for (const sel of sels) {
        for (const de of scope.querySelectorAll(sel)) {
          const p = parseHumanDate((de.textContent || "").trim());
          if (p) return p;
        }
      }
      return null;
    }

    function tryExtract() {
      const allC = [], specC = [];
      for (const sel of SELECTORS) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          for (const el of els) {
            const text = (el.textContent || "").trim();
            const href = el.href || el.getAttribute("href") || "";
            const m = chapterNumRe.exec(href) || chapterNumRe.exec(text);
            if (m) {
              const num = parseFloat(m[2]);
              if (!isNaN(num) && num <= MAX_CHAPTER) {
                const c = { num, url: el.href || href, el };
                allC.push(c);
                if (titleSlug && href.includes(titleSlug)) specC.push(c);
              }
            }
          }
          if (allC.length) break;
        }
      }
      if (!allC.length) {
        document.querySelectorAll("a[href]").forEach((el) => {
          const text = (el.textContent || "").trim();
          const href = el.href || "";
          const m = chapterNumRe.exec(href) || chapterNumRe.exec(text);
          if (m) {
            const num = parseFloat(m[2]);
            if (!isNaN(num) && num <= MAX_CHAPTER) {
              const c = { num, url: href, el };
              allC.push(c);
              if (titleSlug && href.includes(titleSlug)) specC.push(c);
            }
          }
        });
      }
      return specC.length > 0 ? specC : allC;
    }

    function extractCover() {
      return document.querySelector('meta[property="og:image"]')?.content
        || document.querySelector('meta[name="og:image"]')?.content
        || null;
    }

    function extractType() {
      const text = document.body?.innerText || "";
      const m = /\btype\s*[:\-]?\s*(manhwa|manhua|manwha|manga|novel|webtoon)\b/i.exec(text);
      if (!m) return null;
      let val = m[1].toLowerCase();
      if (val === "manwha" || val === "webtoon") val = "manhwa";
      return val;
    }

    let elapsed = 0;
    const interval = setInterval(() => {
      const candidates = tryExtract();
      elapsed += 500;
      if (candidates.length > 0 || elapsed >= 8000) {
        clearInterval(interval);
        const pageTitle = document.title;
        const titleLower = pageTitle.toLowerCase();
        const bodySnippet = (document.body?.innerText || "").slice(0, 500).toLowerCase();
        const is404 = /\b404\b/.test(titleLower) || /not.?found/i.test(titleLower) || /introuvable/i.test(titleLower)
          || (/\b404\b/.test(bodySnippet) && /\b(not.?found|error|erreur)\b/i.test(bodySnippet));
        const coverUrl = extractCover();
        const type = extractType();
        if (!candidates.length) {
          resolve({ found: null, is404, coverUrl, type, html: document.documentElement.outerHTML, debug: { title: pageTitle, elapsed } });
          return;
        }
        candidates.sort((a, b) => b.num - a.num);
        const top = candidates[0];
        const publishedAt = findDateForEl(top.el);
        resolve({ found: { num: top.num, url: top.url, publishedAt }, is404: false, coverUrl, type, html: null, debug: { title: pageTitle, elapsed } });
      }
    }, 500);
  });
}

function fetchViaTab(url) {
  return new Promise((resolve, reject) => {
    let tabId = null;
    let settled = false;

    function cleanup() {
      if (tabId !== null) { chrome.tabs.remove(tabId, () => {}); tabId = null; }
      chrome.tabs.onUpdated.removeListener(onUpdated);
    }

    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error("Timeout fetchViaTab"));
    }, 35000);

    function onUpdated(id, changeInfo, updatedTab) {
      if (id !== tabId || changeInfo.status !== "complete") return;
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdated);

      const done = (result) => { chrome.tabs.remove(tabId, () => {}); tabId = null; resolve(result); };
      const fail = (e) => { chrome.tabs.remove(tabId, () => {}); tabId = null; reject(e); };

      if (isRedirectedAway(url, updatedTab?.url)) {
        return done({ found: null, isRedirect: true, coverUrl: null, html: null, debug: { redirect: updatedTab?.url } });
      }
      // MV2 Firefox — injecter la fonction comme string
      const code = `(${injectedExtract.toString()})()`;
      chrome.tabs.executeScript(id, { code }, (results) => {
        if (chrome.runtime.lastError) return fail(new Error(chrome.runtime.lastError.message));
        Promise.resolve(results?.[0])
          .then(r => done(r ?? { found: null, html: null }))
          .catch(fail);
      });
    }

    chrome.tabs.onUpdated.addListener(onUpdated);

    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        return reject(new Error(chrome.runtime.lastError.message));
      }
      tabId = tab.id;
    });
  });
}

// Récupère le contenu d'un site : silent en priorité, fallback onglet si JS-only.
// siteId et currentNeedsTab permettent de mémoriser les sites JS-only en base.
async function fetchForSite(url, siteId, currentNeedsTab) {
  if (currentNeedsTab) {
    return { result: await fetchViaTab(url), markedNeedsTab: false };
  }

  const silent = await fetchSilent(url);

  // Si on a trouvé quelque chose, ou si la page est invalide (404/redirect) → pas besoin d'aller plus loin
  if (silent.found || silent.is404 || silent.isRedirect) return { result: silent, markedNeedsTab: false };

  // Rien trouvé, pas de 404 → peut-être un site JS-only : tenter via onglet une fois
  try {
    const tabResult = await fetchViaTab(url);
    if (tabResult?.found) {
      // Le site charge ses chapitres en JS → mémoriser pour les prochaines fois
      if (siteId) await sbPatch(`/sites?id=eq.${siteId}`, { needs_tab: true });
      return { result: tabResult, markedNeedsTab: true };
    }
  } catch (e) {
    console.warn("[RTK] fetchViaTab fallback échoué pour", url, e?.message);
  }

  return { result: silent, markedNeedsTab: false };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// Convertit un nom de titre en slug URL (ex: "The Shepherd Wizard" → "the-shepherd-wizard")
function titleToSlug(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")  // supprimer les accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Enregistre un chapitre en base. Retourne { isNew, chapterId } sans envoyer de notification.
// sourceUrl est utilisé comme fallback si chapUrl s'avère invalide (404 / redirection).
async function saveChapter({ titleId, siteId, chapLabel, chapUrl, lastRead, sourceUrl, publishedAt }) {
  const existing = await sbGet(
    `/chapters?title_id=eq.${titleId}&chapter_label=eq.${encodeURIComponent(chapLabel)}&site_id=eq.${siteId}&select=id,published_at`
  );
  if (existing.length) {
    // Renseigner la date de parution si on vient de la découvrir
    if (publishedAt && !existing[0].published_at) {
      await sbPatch(`/chapters?id=eq.${existing[0].id}`, { published_at: publishedAt });
    }
    return { isNew: false, chapterId: existing[0].id };
  }

  // Nouveau chapitre : valider l'URL avant de la persister
  const validatedUrl = sourceUrl ? await validateChapterUrl(chapUrl, sourceUrl) : chapUrl;

  const newChap = await sbPost("/chapters", {
    title_id: titleId,
    site_id: siteId || null,
    chapter_label: chapLabel,
    chapter_url: validatedUrl,
    published_at: publishedAt || null,
  });

  const num = parseFloat(chapLabel);
  const isNew = isNaN(num) || isNaN(lastRead) ? lastRead < 0 : num > lastRead;

  return { isNew, chapterId: newChap[0]?.id ?? null };
}

// Met à jour l'horaire de parution hebdomadaire d'un titre à partir d'une date détectée.
// N'écrase jamais un horaire défini manuellement par l'utilisateur (manual = true).
async function upsertSchedule({ userId, titleId, publishedAt }) {
  if (!userId || !titleId || !publishedAt) return;
  const d = new Date(publishedAt);
  if (isNaN(d.getTime())) return;
  const dow = (d.getDay() + 6) % 7; // 0 = Lundi ... 6 = Dimanche
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
  try {
    const existing = await sbGet(`/release_schedules?title_id=eq.${titleId}&select=id,manual`);
    const auto = existing.find((s) => s.manual === false);
    if (auto) {
      await sbPatch(`/release_schedules?id=eq.${auto.id}`, {
        day_of_week: dow, release_time: time, updated_at: new Date().toISOString(),
      });
    } else if (!existing.length) {
      await sbPost("/release_schedules", {
        user_id: userId, title_id: titleId, day_of_week: dow, release_time: time, manual: false,
      });
    }
  } catch (e) { console.warn("[RTK] upsertSchedule échoué", e?.message); }
}

// Choisit le meilleur chapitre parmi une liste : valeur la plus fréquente, minimum en cas d'égalité.
// newChapters = [{ num, chapLabel, chapUrl, chapterId, siteId }, ...]
function pickBestChapter(newChapters) {
  if (!newChapters.length) return null;
  const counts = {};
  for (const { num } of newChapters) {
    if (!isNaN(num)) counts[num] = (counts[num] || 0) + 1;
  }
  if (!Object.keys(counts).length) return newChapters[0];
  const maxCount = Math.max(...Object.values(counts));
  const topNums = Object.entries(counts)
    .filter(([, c]) => c === maxCount)
    .map(([n]) => parseFloat(n));
  const bestNum = Math.min(...topNums);
  return newChapters.find(c => c.num === bestNum) || newChapters[0];
}

// ── Abort helper ───────────────────────────────────────────────────────────────

async function isAborted() {
  const data = await storageGet("check_abort");
  return data.check_abort === true;
}

// ── Upload couverture vers Supabase Storage ────────────────────────────────────

async function uploadCoverToStorage(imageUrl, titleId, userId) {
  if (!imageUrl || imageUrl.includes(`${SUPABASE_URL}/storage`)) return imageUrl;
  try {
    const token = await getToken();
    const imgRes = await fetch(imageUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ReadingTK/1.0)" },
    });
    if (!imgRes.ok) return null;
    const contentType = imgRes.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
    const blob = await imgRes.blob();
    const path = `${userId}/${titleId}.${ext}`;
    const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/covers/${path}`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${token}`, "Content-Type": contentType, "x-upsert": "true" },
      body: blob,
    });
    if (!uploadRes.ok) { console.error("[RTK] Cover upload failed:", await uploadRes.text()); return null; }
    return `${SUPABASE_URL}/storage/v1/object/public/covers/${path}`;
  } catch (e) { console.error("[RTK] Cover upload error:", e?.message); return null; }
}

// ── Validation contenu chapitre (anti early-access / paywall) ─────────────────

async function validateChapterContent(url) {
  const MIN_IMAGES = 3;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return true;
    const html = await res.text();

    // Vérifier d'abord les mots-clés paywall/login (priorité absolue)
    const bodyLower = html.toLowerCase();
    const paywallKeywords = [
      "early access", "subscribe to read", "unlock chapter", "premium chapter",
      "members only", "vip chapter", "patreon", "ko-fi", "supporter only",
      "accès anticipé", "chapitre réservé", "abonnés", "débloquer",
      "log in to continue", "sign in to read", "login to read",
      "sign in to continue", "register to read", "sign in to access",
      "you're trying to read",
      // vortexscans et sites avec pièces / timer
      "please login to unlock", "waiting to be unlocked", "free after",
    ];
    if (paywallKeywords.some(kw => bodyLower.includes(kw))) return false;

    const imgRe = /(?:src|data-src|data-lazy|data-lazy-src|data-original|data-cfsrc)=["']([^"']{10,})["']/gi;
    const images = new Set();
    let m;
    while ((m = imgRe.exec(html)) !== null) {
      const val = m[1].split(/[\s,]/)[0];
      if (/\.(jpg|jpeg|png|webp|gif)/i.test(val)) images.add(val);
    }
    if (images.size >= MIN_IMAGES) return true;

    return true;
  } catch {
    return true;
  }
}

// ── Check principal ────────────────────────────────────────────────────────────

async function runCheck() {
  const token = await getToken();
  if (!token) return { error: "Non connecté" };

  const storage = await storageGet(["user_id", "browser_notifications", "auto_discover"]);
  const user_id = storage.user_id;
  if (!user_id) return { error: "Pas de user_id" };

  const notifyBrowser = storage.browser_notifications !== false;
  const autoDiscover = storage.auto_discover === true;

  await storageSet({ check_running: true, check_abort: false });

  let detected = 0;
  let errors = 0;

  try {
    const settings = await sbGet(`/user_settings?user_id=eq.${user_id}&select=chapter_format,in_app_notifications_enabled`);
    const format = settings[0]?.chapter_format === "text" ? "text" : "numeric";
    const notifyInApp = settings[0]?.in_app_notifications_enabled !== false;

    const titles = await sbGet(
      `/titles?user_id=eq.${user_id}&status=neq.dropped&select=id,name,type,type_locked,cover_url,title_sources(id,url,site_id,last_seen_chapter,last_error,sites(needs_tab,priority))`
    );

    // Sites globaux avec un template URL (pour l'auto-découverte, si activée)
    const globalSites = autoDiscover ? await sbGet(
      `/sites?user_id=eq.${user_id}&url_template=not.is.null&enabled=eq.true&select=id,name,url_template,needs_tab`
    ) : [];

    for (const title of titles) {
      if (await isAborted()) break;

      const sources = (title.title_sources || [])
        .filter(s => s.url)
        .sort((a, b) => (b.sites?.priority ?? 0) - (a.sites?.priority ?? 0));

      try {
        const progress = await sbGet(`/reading_progress?title_id=eq.${title.id}&select=last_chapter_read`);
        const lastRead = parseFloat(progress[0]?.last_chapter_read ?? "") || -1;

        // Accumule tous les nouveaux chapitres trouvés pour ce titre (toutes sources confondues)
        const newChaptersList = [];
        let bestCoverPriority = -1;
        let bestTypePriority = -1;

        // ── 1. Scraper les sources existantes ──────────────────────────────────
        for (const src of sources) {
          if (await isAborted()) break;
          try {
            const siteNeedsTab = src.sites?.needs_tab === true;
            const { result } = await fetchForSite(src.url, src.site_id, siteNeedsTab);
            if (!result) continue;

            // Redirection : l'URL ne mène pas à une page pour ce titre
            if (result.isRedirect) {
              await sbPatch(`/title_sources?id=eq.${src.id}`, { last_error: "redirect", last_seen_chapter: null });
              errors++;
              continue;
            }

            // Page 404 / 410 : marquer la source et désactiver le site
            if (result.is404) {
              await sbPatch(`/title_sources?id=eq.${src.id}`, { last_error: "404" });
              if (src.site_id) {
                await sbPatch(`/sites?id=eq.${src.site_id}`, { is_down: true, enabled: false });
              }
              errors++;
              continue;
            }

            const found = result.found ?? parseLastChapter(result.html ?? "", src.url);
            if (!found) continue;

            const srcPriority = src.sites?.priority ?? 0;
            const chapLabel = format === "numeric" ? String(found.num) : `Chapter ${found.num}`;

            // Vérifier que le chapitre est accessible avant d'écrire en BDD
            const wouldBeNew = isNaN(found.num) || isNaN(lastRead) ? lastRead < 0 : found.num > lastRead;
            if (wouldBeNew && !(await validateChapterContent(found.url))) {
              console.log(`[RTK] Early access ignoré: ${found.url}`);
              continue;
            }

            // Succès : mettre à jour le chapitre et effacer toute erreur précédente
            await sbPatch(`/title_sources?id=eq.${src.id}`, { last_seen_chapter: chapLabel, last_error: null });

            // Couverture : seulement si le titre n'en a pas encore
            const coverUrl = result.coverUrl ?? parseCoverUrl(result.html ?? "");
            if (coverUrl && !title.cover_url) {
              const storedUrl = await uploadCoverToStorage(coverUrl, title.id, user_id);
              const finalCoverUrl = storedUrl || coverUrl;
              await sbPatch(`/titles?id=eq.${title.id}`, { cover_url: finalCoverUrl });
              title.cover_url = finalCoverUrl;
            }

            // Type : même logique de priorité
            const titleType = result.type ?? parseType(result.html ?? "");
            if (titleType && !title.type_locked && (!title.type || srcPriority > bestTypePriority)) {
              await sbPatch(`/titles?id=eq.${title.id}`, { type: titleType });
              title.type = titleType;
              bestTypePriority = srcPriority;
            }

            const { isNew, chapterId } = await saveChapter({
              titleId: title.id, siteId: src.site_id, chapLabel, chapUrl: found.url, lastRead, sourceUrl: src.url, publishedAt: found.publishedAt,
            });
            if (isNew) newChaptersList.push({ num: found.num, chapLabel, chapUrl: found.url, chapterId, siteId: src.site_id, publishedAt: found.publishedAt });
          } catch (e) { console.error("[RTK] Source error:", e.message); errors++; }
        }

        // ── 2. Auto-découverte : sites globaux non encore liés à ce titre ──────
        for (const site of (globalSites || [])) {
          if (await isAborted()) break;
          const alreadyLinked = sources.some(s => s.site_id === site.id);
          if (alreadyLinked) continue;

          const slug = titleToSlug(title.name);
          const templateUrl = site.url_template.replace("{slug}", slug);

          try {
            const { result } = await fetchForSite(templateUrl, site.id, site.needs_tab === true);
            if (!result) continue;
            const found = result.found ?? parseLastChapter(result.html ?? "", templateUrl);
            if (!found) continue;

            console.log(`[RTK] Auto-découverte: "${title.name}" sur ${site.name} (${templateUrl})`);

            const newSrcArr = await sbPost("/title_sources", {
              title_id: title.id,
              site_id: site.id,
              url: templateUrl,
              is_primary: false,
            });
            const newSrc = newSrcArr[0];

            const chapLabel = format === "numeric" ? String(found.num) : `Chapter ${found.num}`;

            // Vérifier que le chapitre est accessible avant d'enregistrer la source
            const wouldBeNew2 = isNaN(found.num) || isNaN(lastRead) ? lastRead < 0 : found.num > lastRead;
            if (wouldBeNew2 && !(await validateChapterContent(found.url))) {
              console.log(`[RTK] Early access ignoré (auto-découverte): ${found.url}`);
              continue;
            }

            if (newSrc?.id) {
              await sbPatch(`/title_sources?id=eq.${newSrc.id}`, { last_seen_chapter: chapLabel });
              sources.push({ id: newSrc.id, url: templateUrl, site_id: site.id, last_seen_chapter: chapLabel });
            }

            const { isNew, chapterId } = await saveChapter({
              titleId: title.id, siteId: site.id, chapLabel, chapUrl: found.url, lastRead, sourceUrl: templateUrl, publishedAt: found.publishedAt,
            });
            if (isNew) newChaptersList.push({ num: found.num, chapLabel, chapUrl: found.url, chapterId, siteId: site.id, publishedAt: found.publishedAt });
          } catch (e) { console.error("[RTK] Auto-discover error:", e.message); errors++; }
        }

        // ── 3. Une seule notification par titre avec le meilleur chapitre ───────
        if (newChaptersList.length > 0) {
          const best = pickBestChapter(newChaptersList);
          detected++;

          // Mettre à jour l'horaire de parution du calendrier (si une date a été détectée)
          const pub = best.publishedAt || newChaptersList.find((c) => c.publishedAt)?.publishedAt;
          if (pub) await upsertSchedule({ userId: user_id, titleId: title.id, publishedAt: pub });

          if (notifyInApp && best.chapterId) {
            await sbPost("/notifications", {
              user_id: user_id,
              title_id: title.id,
              chapter_id: best.chapterId,
              channel: "in_app",
              sent_at: new Date().toISOString(),
            });
          }

          if (notifyBrowser) {
            chrome.notifications.create(`rtk-${title.id}-${best.chapLabel}`, {
              type: "basic",
              iconUrl: "icons/icon-128.png",
              title: "Nouveau chapitre · ReadingTK",
              message: `${title.name} — ${best.chapLabel}`,
            });
          }
        }

      } catch (e) { console.error("[RTK] Title error:", e.message); errors++; }
    }

    await sbPatch(`/user_settings?user_id=eq.${user_id}`, {
      last_global_check_at: new Date().toISOString(),
    });

    await storageSet({ last_check: Date.now(), last_detected: detected, last_errors: errors });
    return { detected, errors };
  } catch (e) {
    console.error("[RTK] runCheck error:", e.message);
    return { error: e.message };
  } finally {
    await storageSet({ check_running: false, check_abort: false });
  }
}

// ── Check d'un seul titre (déclenché depuis la page web via le content script) ─

async function checkSingleTitle(titleId, autoDiscover = false) {
  const token = await getToken();
  if (!token) return { error: "Non connecté" };

  const storage = await storageGet("user_id");
  const user_id = storage.user_id;
  if (!user_id) return { error: "Pas de user_id" };

  const settings = await sbGet(`/user_settings?user_id=eq.${user_id}&select=chapter_format`);
  const format = settings[0]?.chapter_format === "text" ? "text" : "numeric";

  const titles = await sbGet(
    `/titles?id=eq.${titleId}&select=id,name,type,type_locked,cover_url,title_sources(id,url,site_id,last_seen_chapter,last_error,sites(needs_tab,priority))`
  );
  const title = titles[0];
  if (!title) return { error: "Titre introuvable" };

  const sources = (title.title_sources || [])
    .filter(s => s.url)
    .sort((a, b) => (b.sites?.priority ?? 0) - (a.sites?.priority ?? 0));
  const progress = await sbGet(`/reading_progress?title_id=eq.${titleId}&select=last_chapter_read`);
  const lastRead = parseFloat(progress[0]?.last_chapter_read ?? "") || -1;

  let found = 0;
  let errors = 0;
  let bestCoverPriority = -1;
  let bestTypePriority = -1;

  for (const src of sources) {
    try {
      const siteNeedsTab = src.sites?.needs_tab === true;
      const { result } = await fetchForSite(src.url, src.site_id, siteNeedsTab);

      if (result?.isRedirect) {
        await sbPatch(`/title_sources?id=eq.${src.id}`, { last_error: "redirect", last_seen_chapter: null });
        errors++;
        continue;
      }
      if (result?.is404) {
        await sbPatch(`/title_sources?id=eq.${src.id}`, { last_error: "404" });
        if (src.site_id) await sbPatch(`/sites?id=eq.${src.site_id}`, { is_down: true, enabled: false });
        errors++;
        continue;
      }

      const chapter = result?.found ?? parseLastChapter(result?.html ?? "", src.url);
      if (!chapter) continue;

      const srcPriority = src.sites?.priority ?? 0;
      const chapLabel = format === "numeric" ? String(chapter.num) : `Chapter ${chapter.num}`;

      // Vérifier que le chapitre est accessible avant d'écrire en BDD
      const wouldBeNew = isNaN(chapter.num) || isNaN(lastRead) ? lastRead < 0 : chapter.num > lastRead;
      if (wouldBeNew && !(await validateChapterContent(chapter.url))) {
        console.log(`[RTK] Early access ignoré (checkSingle): ${chapter.url}`);
        continue;
      }

      await sbPatch(`/title_sources?id=eq.${src.id}`, { last_seen_chapter: chapLabel, last_error: null });

      const coverUrl = result?.coverUrl ?? parseCoverUrl(result?.html ?? "");
      if (coverUrl && !title.cover_url) {
        const storedUrl = await uploadCoverToStorage(coverUrl, title.id, user_id);
        const finalCoverUrl = storedUrl || coverUrl;
        await sbPatch(`/titles?id=eq.${title.id}`, { cover_url: finalCoverUrl });
        title.cover_url = finalCoverUrl;
      }

      const titleType = result?.type ?? parseType(result?.html ?? "");
      if (titleType && !title.type_locked && (!title.type || srcPriority > bestTypePriority)) {
        await sbPatch(`/titles?id=eq.${title.id}`, { type: titleType });
        title.type = titleType;
        bestTypePriority = srcPriority;
      }

      await saveChapter({ titleId, siteId: src.site_id, chapLabel, chapUrl: chapter.url, lastRead, sourceUrl: src.url, publishedAt: chapter.publishedAt });
      if (chapter.publishedAt) await upsertSchedule({ userId: user_id, titleId, publishedAt: chapter.publishedAt });
      found++;
    } catch (e) { console.error("[RTK] checkSingleTitle source error:", e?.message); errors++; }
  }

  // ── Auto-découverte : si aucune source configurée ou toggle activé ──────────
  if (sources.length === 0 || autoDiscover) {
    const globalSites = await sbGet(
      `/sites?user_id=eq.${user_id}&url_template=not.is.null&enabled=eq.true&select=id,name,url_template,needs_tab`
    );
    for (const site of (globalSites || [])) {
      const alreadyLinked = sources.some(s => s.site_id === site.id);
      if (alreadyLinked) continue;

      const slug = titleToSlug(title.name);
      const templateUrl = site.url_template.replace("{slug}", slug);

      try {
        const { result } = await fetchForSite(templateUrl, site.id, site.needs_tab === true);
        const chap = result?.found ?? parseLastChapter(result?.html ?? "", templateUrl);
        if (!chap) continue;

        console.log(`[RTK] Auto-découverte: "${title.name}" sur ${site.name} (${templateUrl})`);

        const newSrcArr = await sbPost("/title_sources", {
          title_id: title.id,
          site_id: site.id,
          url: templateUrl,
          is_primary: false,
        });
        const newSrc = newSrcArr[0];

        const chapLabel = format === "numeric" ? String(chap.num) : `Chapter ${chap.num}`;

        // Vérifier que le chapitre est accessible avant d'enregistrer la source
        const wouldBeNew = isNaN(chap.num) || isNaN(lastRead) ? lastRead < 0 : chap.num > lastRead;
        if (wouldBeNew && !(await validateChapterContent(chap.url))) {
          console.log(`[RTK] Early access ignoré (auto-découverte checkSingle): ${chap.url}`);
          continue;
        }

        if (newSrc?.id) {
          await sbPatch(`/title_sources?id=eq.${newSrc.id}`, { last_seen_chapter: chapLabel });
          sources.push({ id: newSrc.id, url: templateUrl, site_id: site.id, last_seen_chapter: chapLabel });
        }

        await saveChapter({ titleId, siteId: site.id, chapLabel, chapUrl: chap.url, lastRead, sourceUrl: templateUrl, publishedAt: chap.publishedAt });
        if (chap.publishedAt) await upsertSchedule({ userId: user_id, titleId, publishedAt: chap.publishedAt });
        found++;
      } catch (e) { console.error("[RTK] Auto-discover error:", e?.message); errors++; }
    }
  }

  return { found, errors };
}

// ── Sync des réglages extension ↔ BDD ─────────────────────────────────────────

async function syncSettingsFromDB(user_id) {
  try {
    const rows = await sbGet(
      `/user_settings?user_id=eq.${user_id}&select=check_interval,browser_notifications,auto_discover`
    );
    const s = rows[0];
    if (!s) return;
    const toSet = {};
    if (s.check_interval !== null) toSet.check_interval = s.check_interval;
    if (s.browser_notifications !== null) toSet.browser_notifications = s.browser_notifications;
    if (s.auto_discover !== null) toSet.auto_discover = s.auto_discover;
    if (Object.keys(toSet).length) {
      await chrome.storage.local.set(toSet);
      if (toSet.check_interval !== undefined) await setupAlarm();
    }
  } catch (e) { console.warn("[RTK] syncSettingsFromDB échoué", e?.message); }
}

async function saveSettingToDB(key, value) {
  try {
    const { user_id } = await chrome.storage.local.get("user_id");
    if (!user_id) return;
    await sbPatch(`/user_settings?user_id=eq.${user_id}`, { [key]: value });
  } catch (e) { console.warn("[RTK] saveSettingToDB échoué", e?.message); }
}

// ── Alarm ──────────────────────────────────────────────────────────────────────

async function setupAlarm() {
  const data = await storageGet("check_interval");
  const minutes = data.check_interval ?? 60;
  chrome.alarms.clear("readingtk-check", () => {
    if (minutes > 0) {
      chrome.alarms.create("readingtk-check", { periodInMinutes: minutes });
    }
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "readingtk-check") runCheck();
});

// ── Messages depuis le popup ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  // Message envoyé par le content script sur readingtk.net
  if (msg.type === "SESSION_FROM_PAGE") {
    if (msg.session?.access_token) {
      storeSession(msg.session).then(() => sendResponse({ ok: true })).catch(() => sendResponse({ ok: false }));
    } else {
      sendResponse({ ok: false });
    }
    return true;
  }
  if (msg.type === "SIGN_IN") {
    (async () => {
      try {
        const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
          method: "POST",
          headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ email: msg.email, password: msg.password }),
        });
        const data = await res.json();
        if (!res.ok) return sendResponse({ error: data.error_description || data.msg || "Identifiants incorrects" });
        await storeSession(data);
        const { user_id } = await storageGet("user_id");
        if (user_id) await syncSettingsFromDB(user_id);
        sendResponse({ ok: true });
      } catch (e) { sendResponse({ error: e.message }); }
    })();
    return true;
  }
  if (msg.type === "LOGIN") {
    loginViaWebApp().then(async (res) => {
      if (res?.ok) {
        const { user_id } = await storageGet("user_id");
        if (user_id) await syncSettingsFromDB(user_id);
      }
      sendResponse(res);
    }).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === "LOGOUT") {
    storageClear().then(() => {
      chrome.alarms.clear("readingtk-check", () => {});
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === "CHECK_NOW") {
    runCheck().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === "STOP_CHECK") {
    storageSet({ check_abort: true }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "SET_INTERVAL") {
    storageSet({ check_interval: msg.minutes }).then(() => {
      setupAlarm();
      saveSettingToDB("check_interval", msg.minutes);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === "SET_NOTIFICATIONS") {
    storageSet({ browser_notifications: msg.enabled }).then(() => {
      saveSettingToDB("browser_notifications", msg.enabled);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === "LOGIN_SILENT") {
    (async () => {
      try {
        const tab = await findReadingTKTab();
        if (!tab) { sendResponse({ error: "no_tab" }); return; }
        const session = await extractSessionFromTab(tab.id);
        if (session?.access_token) {
          await storeSession(session);
          sendResponse({ ok: true });
        } else {
          sendResponse({ error: "no_session" });
        }
      } catch (e) {
        sendResponse({ error: e.message });
      }
    })();
    return true;
  }
  if (msg.type === "SET_AUTO_DISCOVER") {
    storageSet({ auto_discover: msg.enabled }).then(() => {
      saveSettingToDB("auto_discover", msg.enabled);
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === "CHECK_TITLE_NOW") {
    checkSingleTitle(msg.titleId, msg.autoDiscover === true).then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === "GET_STATUS") {
    storageGet([
      "access_token", "user_id", "last_check", "last_detected",
      "last_errors", "check_interval", "browser_notifications", "check_running", "auto_discover",
    ]).then(sendResponse);
    return true;
  }
});

// Injecter le content script dans les onglets readingtk.net déjà ouverts
function injectContentScript() {
  chrome.tabs.query({}, (allTabs) => {
    if (chrome.runtime.lastError || !allTabs) return;
    const rtkTabs = allTabs.filter(t => t.url && t.url.includes("readingtk.net") && t.status === "complete");
    for (const tab of rtkTabs) {
      chrome.tabs.executeScript(tab.id, { file: "content.js" }, () => {
        if (chrome.runtime.lastError) {}
      });
    }
  });
}

async function onStartup() {
  await setupAlarm();
  injectContentScript();
  const { user_id } = await storageGet("user_id");
  if (user_id) await syncSettingsFromDB(user_id);
}

chrome.runtime.onInstalled.addListener(onStartup);
chrome.runtime.onStartup.addListener(onStartup);

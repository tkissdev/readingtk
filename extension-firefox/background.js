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

function parseLastChapter(html, baseUrl) {
  const candidates = [];
  const chapterNumRe = /(chapter|chapitre|chap|ch\.?|episode|ep\.?)[-_\/\s]?(\d+(?:\.\d+)?)/i;

  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const km = chapterNumRe.exec(href) || chapterNumRe.exec(text);
    if (km) {
      const num = parseFloat(km[2]);
      if (!isNaN(num)) {
        let url = href;
        try { url = new URL(href, baseUrl).toString(); } catch {}
        candidates.push({ num, url });
      }
    }
  }

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
            if (!isNaN(num)) {
              let url = href;
              try { url = new URL(href, baseUrl).toString(); } catch {}
              candidates.push({ num, url });
            }
          }
        }
      }
    } catch {}
  }

  if (!candidates.length) {
    const rawRe = /["'\/](chapter|chap|ch|episode|ep)[-_]?(\d+(?:\.\d+)?)["'\/]/gi;
    let rm;
    while ((rm = rawRe.exec(html)) !== null) {
      const num = parseFloat(rm[2]);
      if (!isNaN(num)) candidates.push({ num, url: baseUrl });
    }
  }

  if (!candidates.length) return null;
  candidates.sort((a, b) => b.num - a.num);
  return candidates[0];
}

// ── Fetch via onglet réel (bypass Cloudflare) ──────────────────────────────────

function injectedExtract() {
  return new Promise((resolve) => {
    const chapterNumRe = /(chapter|chapitre|chap|ch|episode|ep)[-_\/\s]?(\d+(?:\.\d+)?)/i;

    const SELECTORS = [
      ".wp-manga-chapter a",
      ".listing-chapters_wrap a",
      ".chapter-list a",
      ".chapters a",
      ".chapter-li a",
      ".row-content-chapter li a",
      "ul.main.version-chap li a",
      ".eph-num a",
      "li.wp-manga-chapter a",
    ];

    function tryExtract() {
      const candidates = [];

      for (const sel of SELECTORS) {
        const els = document.querySelectorAll(sel);
        if (els.length > 0) {
          for (const el of els) {
            const text = (el.textContent || "").trim();
            const href = el.href || el.getAttribute("href") || "";
            const m = chapterNumRe.exec(href) || chapterNumRe.exec(text);
            if (m) {
              const num = parseFloat(m[2]);
              if (!isNaN(num)) candidates.push({ num, url: el.href || href });
            }
          }
          if (candidates.length) break;
        }
      }

      if (!candidates.length) {
        document.querySelectorAll("a[href]").forEach((el) => {
          const text = (el.textContent || "").trim();
          const href = el.href || "";
          const m = chapterNumRe.exec(href) || chapterNumRe.exec(text);
          if (m) {
            const num = parseFloat(m[2]);
            if (!isNaN(num)) candidates.push({ num, url: href });
          }
        });
      }

      return candidates;
    }

    let elapsed = 0;
    const interval = setInterval(() => {
      const candidates = tryExtract();
      elapsed += 500;
      if (candidates.length > 0 || elapsed >= 8000) {
        clearInterval(interval);
        const pageTitle = document.title;
        const isCF = document.querySelector("#challenge-running, #challenge-form") !== null
          || pageTitle === "Just a moment...";
        const allLinks = document.querySelectorAll("a[href]").length;
        if (!candidates.length) {
          resolve({
            found: null,
            html: document.documentElement.outerHTML,
            debug: { title: pageTitle, isCF, allLinks, elapsed }
          });
          return;
        }
        candidates.sort((a, b) => b.num - a.num);
        resolve({ found: candidates[0], html: null, debug: { title: pageTitle, isCF, allLinks, elapsed } });
      }
    }, 500);
  });
}

function fetchViaTab(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Timeout")), 35000);

    chrome.tabs.create({ url, active: false }, (tab) => {
      if (chrome.runtime.lastError) {
        clearTimeout(timeout);
        return reject(new Error(chrome.runtime.lastError.message));
      }

      function onUpdated(tabId, changeInfo) {
        if (tabId !== tab.id || changeInfo.status !== "complete") return;
        chrome.tabs.onUpdated.removeListener(onUpdated);
        clearTimeout(timeout);

        // Utiliser callback pour remove (Firefox MV2 : chrome.tabs.remove ne retourne pas de Promise)
        const removeTab = () => {
          chrome.tabs.remove(tab.id, () => { if (chrome.runtime.lastError) {} });
        };

        const done = (result) => {
          console.log("[RTK] Résultat extraction pour", url, result);
          removeTab();
          resolve(result);
        };
        const fail = (e) => {
          removeTab();
          reject(e);
        };

        if (chrome.scripting) {
          // MV3 Chrome
          chrome.scripting.executeScript(
            { target: { tabId: tab.id }, func: injectedExtract },
            (results) => {
              if (chrome.runtime.lastError) return fail(new Error(chrome.runtime.lastError.message));
              done(results?.[0]?.result ?? { found: null, html: "" });
            }
          );
        } else {
          // MV2 Firefox — injecter la fonction comme string
          const code = `(${injectedExtract.toString()})()`;
          chrome.tabs.executeScript(tab.id, { code }, (results) => {
            if (chrome.runtime.lastError) return fail(new Error(chrome.runtime.lastError.message));
            // Firefox résout automatiquement la Promise retournée par injectedExtract
            Promise.resolve(results?.[0])
              .then(r => done(r ?? { found: null, html: null }))
              .catch(fail);
          });
        }
      }

      chrome.tabs.onUpdated.addListener(onUpdated);
    });
  });
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
async function saveChapter({ titleId, siteId, chapLabel, chapUrl, lastRead }) {
  const existing = await sbGet(
    `/chapters?title_id=eq.${titleId}&chapter_label=eq.${encodeURIComponent(chapLabel)}&site_id=eq.${siteId}&select=id`
  );
  if (existing.length) return { isNew: false, chapterId: existing[0].id };

  const newChap = await sbPost("/chapters", {
    title_id: titleId,
    site_id: siteId || null,
    chapter_label: chapLabel,
    chapter_url: chapUrl,
  });

  const num = parseFloat(chapLabel);
  const isNew = isNaN(num) || isNaN(lastRead) ? lastRead < 0 : num > lastRead;

  return { isNew, chapterId: newChap[0]?.id ?? null };
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

// ── Check principal ────────────────────────────────────────────────────────────

async function runCheck() {
  const token = await getToken();
  if (!token) return { error: "Non connecté" };

  const storage = await storageGet(["user_id", "browser_notifications"]);
  const user_id = storage.user_id;
  if (!user_id) return { error: "Pas de user_id" };

  const notifyBrowser = storage.browser_notifications !== false;

  let detected = 0;
  let errors = 0;

  try {
    const settings = await sbGet(`/user_settings?user_id=eq.${user_id}&select=chapter_format,in_app_notifications_enabled`);
    const format = settings[0]?.chapter_format === "text" ? "text" : "numeric";
    const notifyInApp = settings[0]?.in_app_notifications_enabled !== false;

    const titles = await sbGet(
      `/titles?user_id=eq.${user_id}&status=neq.dropped&select=id,name,title_sources(id,url,site_id,last_seen_chapter)`
    );

    // Sites globaux avec un template URL (pour l'auto-découverte)
    const globalSites = await sbGet(
      `/sites?user_id=eq.${user_id}&url_template=not.is.null&enabled=eq.true&select=id,name,url_template`
    );

    for (const title of titles) {
      const sources = (title.title_sources || []).filter(s => s.url);

      try {
        const progress = await sbGet(`/reading_progress?title_id=eq.${title.id}&select=last_chapter_read`);
        const lastRead = parseFloat(progress[0]?.last_chapter_read ?? "") || -1;

        // Accumule tous les nouveaux chapitres trouvés pour ce titre (toutes sources confondues)
        const newChaptersList = [];

        // ── 1. Scraper les sources existantes ──────────────────────────────────
        for (const src of sources) {
          try {
            const result = await fetchViaTab(src.url);
            if (!result) continue;
            const found = result.found ?? parseLastChapter(result.html ?? "", src.url);
            if (!found) continue;

            const chapLabel = format === "numeric" ? String(found.num) : `Chapter ${found.num}`;
            await sbPatch(`/title_sources?id=eq.${src.id}`, { last_seen_chapter: chapLabel });

            const { isNew, chapterId } = await saveChapter({
              titleId: title.id, siteId: src.site_id, chapLabel, chapUrl: found.url, lastRead,
            });
            if (isNew) newChaptersList.push({ num: found.num, chapLabel, chapUrl: found.url, chapterId, siteId: src.site_id });
          } catch (e) { console.error("[RTK] Source error:", e.message); errors++; }
        }

        // ── 2. Auto-découverte : sites globaux non encore liés à ce titre ──────
        for (const site of (globalSites || [])) {
          const alreadyLinked = sources.some(s => s.site_id === site.id);
          if (alreadyLinked) continue;

          const slug = titleToSlug(title.name);
          const templateUrl = site.url_template.replace("{slug}", slug);

          try {
            const result = await fetchViaTab(templateUrl);
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

            if (newSrc?.id) {
              await sbPatch(`/title_sources?id=eq.${newSrc.id}`, { last_seen_chapter: chapLabel });
              sources.push({ id: newSrc.id, url: templateUrl, site_id: site.id, last_seen_chapter: chapLabel });
            }

            const { isNew, chapterId } = await saveChapter({
              titleId: title.id, siteId: site.id, chapLabel, chapUrl: found.url, lastRead,
            });
            if (isNew) newChaptersList.push({ num: found.num, chapLabel, chapUrl: found.url, chapterId, siteId: site.id });
          } catch (e) { console.error("[RTK] Auto-discover error:", e.message); errors++; }
        }

        // ── 3. Une seule notification par titre avec le meilleur chapitre ───────
        if (newChaptersList.length > 0) {
          const best = pickBestChapter(newChaptersList);
          detected++;

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
  }
}

// ── Alarm ──────────────────────────────────────────────────────────────────────

async function setupAlarm() {
  const data = await storageGet("check_interval");
  const minutes = data.check_interval || 60;
  chrome.alarms.clear("readingtk-check", () => {
    chrome.alarms.create("readingtk-check", { periodInMinutes: minutes });
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
  if (msg.type === "LOGIN") {
    loginViaWebApp().then(sendResponse).catch(e => sendResponse({ error: e.message }));
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
  if (msg.type === "SET_INTERVAL") {
    storageSet({ check_interval: msg.minutes }).then(() => { setupAlarm(); sendResponse({ ok: true }); });
    return true;
  }
  if (msg.type === "SET_NOTIFICATIONS") {
    storageSet({ browser_notifications: msg.enabled }).then(() => sendResponse({ ok: true }));
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
  if (msg.type === "GET_STATUS") {
    storageGet([
      "access_token", "user_id", "last_check", "last_detected",
      "last_errors", "check_interval", "browser_notifications",
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

chrome.runtime.onInstalled.addListener(() => { setupAlarm(); injectContentScript(); });
chrome.runtime.onStartup.addListener(() => { setupAlarm(); injectContentScript(); });

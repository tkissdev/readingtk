const SUPABASE_URL = "https://jjjfphkvwtruckxygwal.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpqamZwaGt2d3RydWNreHlnd2FsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5MjY2MDksImV4cCI6MjA5NjUwMjYwOX0.VEGbnT2qOQ2nr82Lpki8ppQS5jQymPMj6rMZ7gFc9zA";

// ── Auth ───────────────────────────────────────────────────────────────────────

async function login(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || err.msg || "Connexion échouée");
  }
  const data = await res.json();
  await chrome.storage.local.set({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user.id,
    token_expires_at: Date.now() + data.expires_in * 1000,
  });
  return data;
}

async function refreshToken() {
  const { refresh_token } = await chrome.storage.local.get("refresh_token");
  if (!refresh_token) throw new Error("Pas de refresh token");
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: { "apikey": SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token }),
  });
  if (!res.ok) throw new Error("Token refresh échoué");
  const data = await res.json();
  await chrome.storage.local.set({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    token_expires_at: Date.now() + data.expires_in * 1000,
  });
  return data.access_token;
}

async function getToken() {
  const { access_token, token_expires_at } = await chrome.storage.local.get(["access_token", "token_expires_at"]);
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
  const chapterNumRe = /(chapter|chapitre|chap|ch\.?|episode|ep\.?)[-_\s]?(\d+(?:\.\d+)?)/i;

  // Stratégie 1 : balises <a>
  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = anchorRe.exec(html)) !== null) {
    const href = m[1];
    const text = m[2].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const km = chapterNumRe.exec(text) || chapterNumRe.exec(href);
    if (km) {
      const num = parseFloat(km[2]);
      if (!isNaN(num)) {
        let url = href;
        try { url = new URL(href, baseUrl).toString(); } catch {}
        candidates.push({ num, url });
      }
    }
  }

  // Stratégie 2 : URLs basées sur le slug
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

  // Stratégie 3 : blobs JSON/script bruts
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

// ── Check principal ────────────────────────────────────────────────────────────

async function runCheck() {
  const token = await getToken();
  if (!token) return { error: "Non connecté" };

  const { user_id } = await chrome.storage.local.get("user_id");
  if (!user_id) return { error: "Pas de user_id" };

  const { browser_notifications } = await chrome.storage.local.get("browser_notifications");
  const notifyBrowser = browser_notifications !== false;

  let detected = 0;
  let errors = 0;

  try {
    const settings = await sbGet(`/user_settings?user_id=eq.${user_id}&select=chapter_format,in_app_notifications_enabled`);
    const format = settings[0]?.chapter_format === "text" ? "text" : "numeric";
    const notifyInApp = settings[0]?.in_app_notifications_enabled !== false;

    const titles = await sbGet(
      `/titles?user_id=eq.${user_id}&status=neq.dropped&select=id,name,title_sources(id,url,site_id,last_seen_chapter)`
    );

    for (const title of titles) {
      const sources = (title.title_sources || []).filter(s => s.url);
      if (!sources.length) continue;

      try {
        const progress = await sbGet(`/reading_progress?title_id=eq.${title.id}&select=last_chapter_read`);
        const lastRead = parseFloat(progress[0]?.last_chapter_read ?? "") || -1;

        for (const src of sources) {
          try {
            const res = await fetch(src.url, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "fr-FR,fr;q=0.9,en-US;q=0.8",
                "Cache-Control": "no-cache",
              },
              credentials: "omit",
            });
            if (!res.ok) { errors++; continue; }

            const html = await res.text();
            const found = parseLastChapter(html, src.url);
            if (!found) continue;

            const chapLabel = format === "numeric" ? String(found.num) : `Chapter ${found.num}`;

            await sbPatch(`/title_sources?id=eq.${src.id}`, { last_seen_chapter: chapLabel });

            const existing = await sbGet(
              `/chapters?title_id=eq.${title.id}&chapter_label=eq.${encodeURIComponent(chapLabel)}&select=id`
            );

            if (!existing.length) {
              const newChap = await sbPost("/chapters", {
                title_id: title.id,
                site_id: src.site_id || null,
                chapter_label: chapLabel,
                chapter_url: found.url,
              });

              const isNew = isNaN(found.num) || isNaN(lastRead) ? lastRead < 0 : found.num > lastRead;

              if (isNew) {
                detected++;

                if (notifyInApp && newChap[0]?.id) {
                  await sbPost("/notifications", {
                    user_id,
                    title_id: title.id,
                    chapter_id: newChap[0].id,
                    channel: "in_app",
                    sent_at: new Date().toISOString(),
                  });
                }

                if (notifyBrowser) {
                  chrome.notifications.create(`rtk-${title.id}-${chapLabel}`, {
                    type: "basic",
                    iconUrl: "icons/icon-128.png",
                    title: "Nouveau chapitre · ReadingTK",
                    message: `${title.name} — ${chapLabel}`,
                  });
                }
              }
            }

            break; // source OK, on passe au titre suivant
          } catch { errors++; }
        }
      } catch { errors++; }
    }

    await sbPatch(`/user_settings?user_id=eq.${user_id}`, {
      last_global_check_at: new Date().toISOString(),
    });

    await chrome.storage.local.set({
      last_check: Date.now(),
      last_detected: detected,
      last_errors: errors,
    });

    return { detected, errors };
  } catch (e) {
    return { error: e.message };
  }
}

// ── Alarm ──────────────────────────────────────────────────────────────────────

async function setupAlarm() {
  const { check_interval } = await chrome.storage.local.get("check_interval");
  const minutes = check_interval || 60;
  await chrome.alarms.clear("readingtk-check");
  chrome.alarms.create("readingtk-check", { periodInMinutes: minutes });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "readingtk-check") runCheck();
});

// ── Messages depuis le popup ───────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "LOGIN") {
    login(msg.email, msg.password)
      .then(() => { setupAlarm(); sendResponse({ ok: true }); })
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === "LOGOUT") {
    chrome.storage.local.clear().then(() => { chrome.alarms.clear("readingtk-check"); sendResponse({ ok: true }); });
    return true;
  }
  if (msg.type === "CHECK_NOW") {
    runCheck().then(sendResponse).catch(e => sendResponse({ error: e.message }));
    return true;
  }
  if (msg.type === "SET_INTERVAL") {
    chrome.storage.local.set({ check_interval: msg.minutes }).then(() => { setupAlarm(); sendResponse({ ok: true }); });
    return true;
  }
  if (msg.type === "SET_NOTIFICATIONS") {
    chrome.storage.local.set({ browser_notifications: msg.enabled }).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (msg.type === "GET_STATUS") {
    chrome.storage.local.get([
      "access_token", "user_id", "last_check", "last_detected",
      "last_errors", "check_interval", "browser_notifications",
    ]).then(sendResponse);
    return true;
  }
});

chrome.runtime.onInstalled.addListener(setupAlarm);
chrome.runtime.onStartup.addListener(setupAlarm);

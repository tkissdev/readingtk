// Garde anti-double injection (Firefox peut injecter le script deux fois sur certaines navigations)
if (!window.__rtk_content_loaded) {
  window.__rtk_content_loaded = true;

  // ── Sync session Supabase → background ────────────────────────────────────────

  const KEY = "sb-jjjfphkvwtruckxygwal-auth-token";

  function syncSession() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        console.log("[RTK] Aucune session trouvée dans localStorage (clé:", KEY, ")");
        return;
      }
      const session = JSON.parse(raw);
      if (!session?.access_token) {
        console.log("[RTK] Session trouvée mais pas d'access_token");
        return;
      }
      console.log("[RTK] Session trouvée, envoi au background...");

      chrome.storage.local.set({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        user_id: session.user?.id,
        token_expires_at: (session.expires_at ?? 0) * 1000,
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("[RTK] Erreur storage.local.set:", chrome.runtime.lastError);
        } else {
          console.log("[RTK] Session écrite dans le storage.");
        }
      });

      chrome.runtime.sendMessage({ type: "SESSION_FROM_PAGE", session: session }, () => {
        if (chrome.runtime.lastError) {
          // Normal si le background n'est pas encore prêt
        } else {
          console.log("[RTK] Session transmise au background.");
        }
      });
    } catch (e) {
      console.error("[RTK] Erreur content script:", e);
    }
  }

  console.log("[RTK] Content script démarré sur", location.href);
  syncSession();

  // ── Relais de messages entre la page ReadingTK et le background ───────────────

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (!event.data || event.data.source !== "readingtk-web") return;

    const { requestId, payload } = event.data;
    chrome.runtime.sendMessage(payload, (response) => {
      window.postMessage({
        source: "readingtk-extension",
        requestId,
        response: chrome.runtime.lastError
          ? { error: chrome.runtime.lastError.message }
          : (response ?? null),
      }, "*");
    });
  });

  // Signaler la présence de l'extension à la page web
  window.postMessage({ source: "readingtk-extension", type: "READY" }, "*");
}

// Communication avec l'extension navigateur ReadingTK, via le content script relay.
export function sendToExtension(payload: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return new Promise((resolve) => {
    const requestId = Math.random().toString(36).slice(2);
    const timeout = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve({ error: "Extension non disponible" });
    }, 120000);
    function handler(event: MessageEvent) {
      if (event.data?.source !== "readingtk-extension") return;
      if (event.data?.requestId !== requestId) return;
      clearTimeout(timeout);
      window.removeEventListener("message", handler);
      resolve(event.data.response ?? null);
    }
    window.addEventListener("message", handler);
    window.postMessage({ source: "readingtk-web", requestId, payload }, "*");
  });
}

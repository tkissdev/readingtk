// Relais de messages entre la page ReadingTK et le background de l'extension
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

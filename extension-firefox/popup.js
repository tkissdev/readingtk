function $(id) { return document.getElementById(id); }

function showScreen(name) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  $(`screen-${name}`).classList.remove("hidden");
}

function formatTime(ts) {
  if (!ts) return "—";
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return new Date(ts).toLocaleDateString("fr-FR");
}

// Délais selon le type de message — CHECK_NOW ouvre des onglets réels, peut prendre longtemps
const MSG_TIMEOUT = { CHECK_NOW: 120000, LOGIN: 30000, LOGIN_SILENT: 10000 };

function send(type, payload = {}) {
  return new Promise((resolve) => {
    const timeout = MSG_TIMEOUT[type] ?? 5000;
    const t = setTimeout(() => resolve(undefined), timeout);
    chrome.runtime.sendMessage({ type, ...payload }, (response) => {
      clearTimeout(t);
      if (chrome.runtime.lastError) { resolve(undefined); return; }
      resolve(response);
    });
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  try {
    let status = await send("GET_STATUS");

    // Pas de token stocké — essayer de le récupérer depuis un onglet readingtk.net ouvert
    if (!status?.access_token) {
      const res = await send("LOGIN_SILENT");
      if (res?.ok) {
        status = await send("GET_STATUS");
      }
    }

    if (status?.access_token) {
      showScreen("main");
      updateStatus(status);
      // Si une vérification est déjà en cours (lancée avant l'ouverture du popup)
      if (status.check_running) {
        setCheckRunning(true);
        startPolling();
      }
    } else {
      showScreen("login");
    }
  } catch (e) {
    showScreen("login");
  }
}

function updateStatus(status) {
  $("last-check").textContent = formatTime(status.last_check);
  if (status.last_detected !== undefined) {
    const d = status.last_detected;
    $("last-detected").textContent = d > 0 ? `${d} nouveau(x)` : "Aucun";
    $("last-detected").style.color = d > 0 ? "#818cf8" : "";
  }
  $("interval-select").value = String(status.check_interval ?? 60);
  $("notif-toggle").checked = status.browser_notifications !== false;
}

// ── Gestion état "vérification en cours" ───────────────────────────────────────

let pollInterval = null;

function setCheckRunning(running) {
  $("check-btn").disabled = running;
  $("check-icon").classList.toggle("spinning", running);
  $("stop-btn").style.display = running ? "" : "none";
}

function startPolling() {
  if (pollInterval) return;
  pollInterval = setInterval(async () => {
    const status = await send("GET_STATUS");
    if (!status?.check_running) {
      stopPolling();
      setCheckRunning(false);
      if (status) updateStatus(status);
    }
  }, 1000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

// ── Login ──────────────────────────────────────────────────────────────────────

$("login-btn").addEventListener("click", async () => {
  const errEl = $("login-error");
  errEl.classList.add("hidden");
  $("login-btn").disabled = true;
  $("login-btn").textContent = "Connexion en cours...";

  const res = await send("LOGIN");

  if (res?.ok) {
    showScreen("main");
    const status = await send("GET_STATUS");
    updateStatus(status);
  } else {
    errEl.textContent = res?.error || "Erreur — assurez-vous d'être connecté sur readingtk.net";
    errEl.classList.remove("hidden");
    $("login-btn").disabled = false;
    $("login-btn").textContent = "Se connecter via ReadingTK";
  }
});

// ── Logout ─────────────────────────────────────────────────────────────────────

$("logout-btn").addEventListener("click", async () => {
  await send("LOGOUT");
  showScreen("login");
});

// ── Check Now ──────────────────────────────────────────────────────────────────

$("check-btn").addEventListener("click", async () => {
  setCheckRunning(true);
  startPolling();

  const res = await send("CHECK_NOW");

  stopPolling();
  setCheckRunning(false);

  if (res?.error) {
    const errEl = document.createElement("div");
    errEl.style.cssText = "color:#f87171;font-size:11px;padding:4px 0;text-align:center";
    errEl.textContent = res.error === "Non connecté" ? "Session expirée — reconnectez-vous." : res.error;
    $("check-btn").insertAdjacentElement("afterend", errEl);
    setTimeout(() => errEl.remove(), 5000);
    return;
  }

  const status = await send("GET_STATUS");
  if (status) updateStatus(status);
});

// ── Stop Check ─────────────────────────────────────────────────────────────────

$("stop-btn").addEventListener("click", async () => {
  await send("STOP_CHECK");
  stopPolling();
  setCheckRunning(false);
  const status = await send("GET_STATUS");
  if (status) updateStatus(status);
});

// ── Interval ───────────────────────────────────────────────────────────────────

$("interval-select").addEventListener("change", async (e) => {
  await send("SET_INTERVAL", { minutes: parseInt(e.target.value) });
});

// ── Notifications ──────────────────────────────────────────────────────────────

$("notif-toggle").addEventListener("change", async (e) => {
  await send("SET_NOTIFICATIONS", { enabled: e.target.checked });
});

// ── Start ──────────────────────────────────────────────────────────────────────

init();

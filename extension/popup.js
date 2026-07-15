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

function send(type, payload = {}) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type, ...payload }, resolve);
  });
}

// ── Init ───────────────────────────────────────────────────────────────────────

async function init() {
  const status = await send("GET_STATUS");
  if (!status.access_token) {
    showScreen("login");
    return;
  }
  showScreen("main");
  updateStatus(status);
  // Si une vérification est déjà en cours (lancée avant l'ouverture du popup)
  if (status.check_running) {
    setCheckRunning(true);
    startPolling();
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
  $("auto-discover-toggle").checked = status.auto_discover === true;
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

// ── Login (formulaire email/mot de passe) ──────────────────────────────────────

$("sign-in-btn").addEventListener("click", async () => {
  const email = $("login-email").value.trim();
  const password = $("login-password").value;
  const errEl = $("login-error");
  errEl.classList.add("hidden");

  if (!email || !password) {
    errEl.textContent = "Veuillez renseigner email et mot de passe.";
    errEl.classList.remove("hidden");
    return;
  }

  $("sign-in-btn").disabled = true;
  $("sign-in-btn").textContent = "Connexion...";

  const res = await send("SIGN_IN", { email, password });

  if (res?.ok) {
    showScreen("main");
    const status = await send("GET_STATUS");
    updateStatus(status);
  } else {
    errEl.textContent = res?.error || "Identifiants incorrects.";
    errEl.classList.remove("hidden");
    $("sign-in-btn").disabled = false;
    $("sign-in-btn").textContent = "Se connecter";
  }
});

// ── Login fallback (via readingtk.net) ────────────────────────────────────────

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
    $("login-btn").textContent = "Connexion via readingtk.net";
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

  if (res?.error) console.error("[ReadingTK]", res.error);

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

// ── Auto-découverte ────────────────────────────────────────────────────────────

$("auto-discover-toggle").addEventListener("change", async (e) => {
  await send("SET_AUTO_DISCOVER", { enabled: e.target.checked });
});

// ── Start ──────────────────────────────────────────────────────────────────────

init();

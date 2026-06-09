// ── Helpers ────────────────────────────────────────────────────────────────────

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
}

function updateStatus(status) {
  $("last-check").textContent = formatTime(status.last_check);

  if (status.last_detected !== undefined) {
    const d = status.last_detected;
    $("last-detected").textContent = d > 0 ? `${d} nouveau(x)` : "Aucun";
    $("last-detected").style.color = d > 0 ? "#818cf8" : "";
  }

  const interval = status.check_interval || 60;
  $("interval-select").value = String(interval);

  $("notif-toggle").checked = status.browser_notifications !== false;
}

// ── Login ──────────────────────────────────────────────────────────────────────

$("login-btn").addEventListener("click", async () => {
  const email = $("email").value.trim();
  const password = $("password").value;
  const errEl = $("login-error");

  if (!email || !password) {
    errEl.textContent = "Veuillez remplir tous les champs.";
    errEl.classList.remove("hidden");
    return;
  }

  $("login-btn").disabled = true;
  $("login-btn").textContent = "Connexion...";
  errEl.classList.add("hidden");

  const res = await send("LOGIN", { email, password });

  if (res?.ok) {
    showScreen("main");
    const status = await send("GET_STATUS");
    updateStatus(status);
  } else {
    errEl.textContent = res?.error || "Erreur de connexion";
    errEl.classList.remove("hidden");
    $("login-btn").disabled = false;
    $("login-btn").textContent = "Se connecter";
  }
});

// Allow Enter key on login form
[$("email"), $("password")].forEach(el => {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("login-btn").click();
  });
});

// ── Logout ─────────────────────────────────────────────────────────────────────

$("logout-btn").addEventListener("click", async () => {
  await send("LOGOUT");
  showScreen("login");
  $("email").value = "";
  $("password").value = "";
});

// ── Check Now ──────────────────────────────────────────────────────────────────

$("check-btn").addEventListener("click", async () => {
  $("check-btn").disabled = true;
  $("check-icon").classList.add("spinning");

  const res = await send("CHECK_NOW");

  $("check-btn").disabled = false;
  $("check-icon").classList.remove("spinning");

  const status = await send("GET_STATUS");
  updateStatus(status);

  if (res?.error) {
    console.error("[ReadingTK]", res.error);
  }
});

// ── Interval ───────────────────────────────────────────────────────────────────

$("interval-select").addEventListener("change", async (e) => {
  await send("SET_INTERVAL", { minutes: parseInt(e.target.value) });
});

// ── Notifications ──────────────────────────────────────────────────────────────

$("notif-toggle").addEventListener("change", async (e) => {
  const enabled = e.target.checked;

  if (enabled) {
    // Demander la permission si nécessaire
    const permission = await chrome.permissions?.request?.({ permissions: ["notifications"] }).catch(() => null);
    if (permission === false) {
      e.target.checked = false;
      return;
    }
  }

  await send("SET_NOTIFICATIONS", { enabled });
});

// ── Start ──────────────────────────────────────────────────────────────────────

init();

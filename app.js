const state = {
  screen: "matches",
  gender: "men",
  favourites: new Set(JSON.parse(localStorage.getItem("padel-live-favourites") || "[]")),
  lastSync: null,
  remoteConnected: false
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cfg = window.PADEL_CONFIG || { apiBaseUrl: "", refreshMs: 60000 };

function allPlayers() {
  const m = new Map();
  [...PADEL_DATA.rankings.men, ...PADEL_DATA.rankings.women].forEach(p => m.set(p.name, p));
  return [...m.values()];
}

function save() {
  localStorage.setItem("padel-live-favourites", JSON.stringify([...state.favourites]));
  renderRankings();
  renderFollowing();
}

function toggle(name) {
  state.favourites.has(name) ? state.favourites.delete(name) : state.favourites.add(name);
  save();
}

function renderFeatured() {
  const m = PADEL_DATA.featuredMatch;
  if (!m) {
    $("#featuredMatch").innerHTML = `<div class="match-top"><span class="status-upcoming">SCHEDULE</span><span class="round">No featured match</span></div><div class="team">Check back for the next match.</div>`;
    return;
  }
  const watchUrl = m.watchUrl || "https://www.redbull.com/ca-en/event-series/premier-padel";
  $("#featuredMatch").innerHTML = `<div class="match-top"><span class="${m.status === "live" ? "status-live" : "status-upcoming"}">${m.status === "live" ? "LIVE" : "NEXT"}</span><span class="round">${m.round || "Match"}</span></div><div class="score-grid"><div><div class="team">${(m.teamA || []).join(" / ")}</div><div class="team">${(m.teamB || []).join(" / ")}</div></div><div><div class="score-row">${(m.scoreA || ["–","–","–"]).map((s,i)=>`<span class="score-box ${i===2&&m.status==="live"?"current":""}">${s}</span>`).join("")}</div><div class="score-row" style="margin-top:7px">${(m.scoreB || ["–","–","–"]).map((s,i)=>`<span class="score-box ${i===2&&m.status==="live"?"current":""}">${s}</span>`).join("")}</div></div></div><div class="match-footer"><span>${m.time || "TBD"}</span><div class="match-actions"><button class="watch-btn secondary-action" id="featuredAlertBtn">Remind me</button><a class="stream-btn" href="${watchUrl}" target="_blank" rel="noopener noreferrer">Watch on Red Bull TV ↗</a></div></div>`;
  $("#featuredAlertBtn").onclick = () => requestAlerts(true);
}

function renderWatchLivePanel() {
  const panel = $("#watchLivePanel");
  if (!panel) return;
  const m = PADEL_DATA.featuredMatch;
  if (!m || String(m.status || "").toLowerCase() !== "live") {
    panel.innerHTML = "";
    return;
  }
  const watchUrl = m.watchUrl || "https://www.redbull.com/ca-en/event-series/premier-padel";
  panel.innerHTML = `<div class="live-stream-panel"><a class="live-stream-card" href="${watchUrl}" target="_blank" rel="noopener noreferrer"><span class="live-copy"><strong>WATCH LIVE ON RED BULL TV</strong><small>${(m.teamA || []).join(" / ")} vs ${(m.teamB || []).join(" / ")}</small></span><span class="live-stream-badge">OPEN ↗</span></a></div>`;
}

function renderToday() {
  const matches = PADEL_DATA.todayMatches || [];
  $("#matchCount").textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
  $("#todayMatches").innerHTML = matches.length ? matches.map(m => {
    const st = String(m.status || "upcoming").toLowerCase();
    const score = m.scoreText ? `<div class="result-score">${m.scoreText}</div>` : "";
    return `<article class="match-card"><div class="match-card-row"><div class="teams"><div class="sub">${m.division || "Premier Padel"}</div><strong>${m.teamA || "TBD"}</strong><strong>${m.teamB || "TBD"}</strong>${score}</div><div><div class="time">${m.time || "TBD"}</div><div class="match-status-mini ${st==="live"?"live":""}">${st}</div></div></div></article>`;
  }).join("") : `<article class="match-card"><div class="sub">No matches currently listed.</div></article>`;
}

function renderResults() {
  const results = PADEL_DATA.recentResults || [];
  $("#resultsCount").textContent = `${results.length} result${results.length === 1 ? "" : "s"}`;
  $("#recentResults").innerHTML = results.length ? results.map(m => `
    <article class="result-card">
      <div class="result-head"><span class="sub">${m.division || "Premier Padel"}</span><span class="meta">${m.date || ""}</span></div>
      <div class="match-card-row">
        <div class="teams"><strong>${m.teamA || "TBD"}</strong><strong>${m.teamB || "TBD"}</strong></div>
        <div class="result-score">${m.scoreText || "Final"}</div>
      </div>
    </article>`).join("") : `<article class="match-card"><div class="sub">No recent results available.</div></article>`;
}

function renderTournaments() {
  const tournaments = PADEL_DATA.tournaments || [];
  $("#tournamentList").innerHTML = tournaments.map(t => `<article class="tournament-card"><div><div class="country">${t.country || ""}</div><h3>${t.name}</h3></div><div><div class="dates">${t.dates || ""}</div><div class="meta">${t.status || ""}</div></div></article>`).join("");
}

function renderRankings() {
  const players = (PADEL_DATA.rankings && PADEL_DATA.rankings[state.gender]) || [];
  $("#rankingsDate").textContent = PADEL_DATA.rankingsDate || "Current";
  $("#rankingList").innerHTML = players.map(p => `<div class="ranking-row"><div class="rank-number">${p.rank}</div><div><div class="player-name">${p.name}</div><div class="player-country">${p.country || ""}</div></div><div class="points">${Number(p.points || 0).toLocaleString()}<br><span>pts</span></div><button class="star-button ${state.favourites.has(p.name)?"following":""}" data-player="${encodeURIComponent(p.name)}">${state.favourites.has(p.name)?"★":"☆"}</button></div>`).join("");
  $$("#rankingList .star-button").forEach(b => b.onclick = () => toggle(decodeURIComponent(b.dataset.player)));
}

function renderFollowing() {
  const players = allPlayers().filter(p => state.favourites.has(p.name));
  $("#followingCount").textContent = `${players.length} player${players.length === 1 ? "" : "s"}`;
  $("#followingEmpty").style.display = players.length ? "none" : "block";
  $("#followingList").style.display = players.length ? "flex" : "none";
  $("#followingList").innerHTML = players.map(p => `<div class="following-row"><div class="rank-number">#${p.rank}</div><div><div class="player-name">${p.name}</div><div class="player-country">${p.country || ""}</div></div><div class="points">${Number(p.points || 0).toLocaleString()} pts</div><button class="star-button following" data-player="${encodeURIComponent(p.name)}">★</button></div>`).join("");
  $$("#followingList .star-button").forEach(b => b.onclick = () => toggle(decodeURIComponent(b.dataset.player)));
}

function renderHeader() {
  $("#currentTournamentLabel").textContent = PADEL_DATA.currentTournament?.name || PADEL_DATA.featuredMatch?.tournament || "Premier Padel";
  $("#currentTournamentMeta").textContent = PADEL_DATA.currentTournament?.meta || "Latest matches";
}

function showScreen(name) {
  state.screen = name;
  $$(".screen").forEach(s => s.classList.toggle("active", s.dataset.screen === name));
  $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.target === name));
  window.scrollTo({ top: 0, behavior: "instant" });
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setNotificationStatus(message) {
  const el = $("#notificationTestStatus");
  if (el) el.textContent = message;
}

async function waitForActiveWorker(registration, timeoutMs = 6000) {
  if (registration.active) return registration;

  const worker = registration.installing || registration.waiting;
  if (!worker) throw new Error("no-service-worker");

  await Promise.race([
    new Promise((resolve, reject) => {
      const check = () => {
        if (registration.active || worker.state === "activated") resolve();
        else if (worker.state === "redundant") reject(new Error("service-worker-redundant"));
      };
      worker.addEventListener("statechange", check);
      check();
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error("service-worker-timeout")), timeoutMs))
  ]);

  if (!registration.active && worker.state !== "activated") throw new Error("service-worker-not-active");
  return registration;
}

async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("service-worker-unsupported");

  // Register a versioned script URL so an old iOS PWA registration cannot keep
  // serving the stale notification code indefinitely.
  let reg = await navigator.serviceWorker.register("./sw.js?v=2.7", {
    scope: "./",
    updateViaCache: "none"
  });

  try { await reg.update(); } catch (_) {}

  try {
    return await waitForActiveWorker(reg, 6000);
  } catch (firstError) {
    // Repair an incomplete/stale registration once, automatically.
    try { await reg.unregister(); } catch (_) {}
    reg = await navigator.serviceWorker.register("./sw.js?v=2.7", {
      scope: "./",
      updateViaCache: "none"
    });
    return await waitForActiveWorker(reg, 7000);
  }
}

let notificationTestRunning = false;

async function requestAlerts(test = false) {
  const button = test ? $("#testNotificationBtn") : $("#notificationBtn");
  if (notificationTestRunning) return;

  if (!window.isSecureContext) {
    setNotificationStatus("HTTPS is required");
    alert("Notifications require the HTTPS GitHub Pages version of Padel Live.");
    return;
  }

  if (!("Notification" in window)) {
    setNotificationStatus("Not supported in this browser");
    alert("Notifications are not available in this browser.");
    return;
  }

  const isAppleMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isAppleMobile && !isStandaloneApp()) {
    setNotificationStatus("Open from the Home Screen app");
    alert("On iPhone, open Padel Live from the Home Screen icon — not from a Safari tab — then try again.");
    return;
  }

  notificationTestRunning = true;
  button?.classList.add("busy");

  try {
    // IMPORTANT: request permission immediately from the user's tap. iOS requires
    // the permission prompt to originate from a direct user interaction.
    let permission = Notification.permission;
    if (permission === "default") {
      setNotificationStatus("Waiting for permission…");
      permission = await Notification.requestPermission();
    }

    if (permission === "denied") {
      setNotificationStatus("Permission blocked in iPhone Settings");
      alert("Notifications are blocked for Padel Live. Open iPhone Settings → Notifications → Padel Live and turn Allow Notifications on.");
      return;
    }

    if (permission !== "granted") {
      setNotificationStatus("Permission not granted");
      return;
    }

    setNotificationStatus("Starting notification service…");
    const reg = await ensureServiceWorker();

    if ($("#notificationBtn")) $("#notificationBtn").textContent = "Enabled";

    if (test) {
      const icon = new URL("./icons/icon-192.png", window.location.href).href;
      await reg.showNotification("Padel Live", {
        body: "Notifications are working on this iPhone.",
        icon,
        badge: icon,
        tag: `padel-live-test-${Date.now()}`,
        data: { url: "./" }
      });
      setNotificationStatus("Test sent ✓");
    } else {
      setNotificationStatus("Notifications enabled ✓");
    }
  } catch (e) {
    console.error("Padel Live notification test failed:", e);
    const code = String(e?.message || e?.name || "unknown error");
    setNotificationStatus(`Failed · ${code.slice(0, 28)}`);
    alert("Padel Live could not start its notification service. Close the app, reopen it from the Home Screen, and try once more. If it still fails, remove the Home Screen icon and add Padel Live again from Safari.");
  } finally {
    notificationTestRunning = false;
    button?.classList.remove("busy");
  }
}

function formatSyncTime(date) {
  if (!date) return "Using cached schedule";
  return `Updated ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

function updateSyncLabel(message) {
  $("#syncStatus").textContent = message || formatSyncTime(state.lastSync);
}

function applyRemoteData(remote) {
  if (!remote || typeof remote !== "object") return;
  const payload = remote.data || remote;
  if (payload.rankings) PADEL_DATA.rankings = payload.rankings;
  if (payload.rankingsDate) PADEL_DATA.rankingsDate = payload.rankingsDate;
  if (payload.tournaments) PADEL_DATA.tournaments = payload.tournaments;
  if (payload.todayMatches) PADEL_DATA.todayMatches = payload.todayMatches;
  if (payload.recentResults) PADEL_DATA.recentResults = payload.recentResults;
  if (payload.featuredMatch) PADEL_DATA.featuredMatch = payload.featuredMatch;
  if (payload.currentTournament) PADEL_DATA.currentTournament = payload.currentTournament;
}

async function refreshRemote({ manual = false } = {}) {
  const base = (cfg.apiBaseUrl || "").replace(/\/$/, "");
  if (!base) {
    state.remoteConnected = false;
    updateSyncLabel("Backend not configured");
    if (manual) renderAll();
    return;
  }
  updateSyncLabel("Refreshing…");
  try {
    const res = await fetch(`${base}/api/data`, { cache: "no-store" });
    const text = await res.text();
    let json = {};
    try { json = JSON.parse(text); } catch (_) {}
    if (!res.ok) {
      const detail = json?.message || json?.error || `HTTP ${res.status}`;
      throw new Error(`${res.status}: ${detail}`);
    }
    applyRemoteData(json);
    state.lastSync = new Date();
    state.remoteConnected = true;
    renderAll();
    const warnings = json?.warnings?.length ? ` · ${json.warnings.length} source warning${json.warnings.length===1?"":"s"}` : "";
    updateSyncLabel(`${formatSyncTime(state.lastSync)}${warnings}`);
  } catch (err) {
    console.warn("Padel Live refresh failed", err);
    state.remoteConnected = false;
    const msg = String(err?.message || err).replace(/^Error:\s*/,"");
    updateSyncLabel(`Backend error · ${msg.slice(0, 42)}`);
    if (manual) renderAll();
  }
}

function renderAll() {
  renderHeader();
  renderFeatured();
  renderWatchLivePanel();
  renderToday();
  renderResults();
  renderTournaments();
  renderRankings();
  renderFollowing();
}

$$(".nav-item").forEach(b => b.onclick = () => showScreen(b.dataset.target));
$$(".segment").forEach(b => b.onclick = () => { state.gender = b.dataset.gender; $$(".segment").forEach(x => x.classList.toggle("active", x === b)); renderRankings(); });
$("#browsePlayersBtn").onclick = () => showScreen("rankings");
$("#notificationBtn").onclick = () => requestAlerts(true);
$("#testNotificationBtn").onclick = () => requestAlerts(true);
$("#clearFavouritesBtn").onclick = () => { if (confirm("Remove all followed players?")) { state.favourites.clear(); save(); } };
$("#refreshBtn").onclick = async () => { $("#refreshBtn").animate([{transform:"rotate(0deg)"},{transform:"rotate(360deg)"}],{duration:450}); await refreshRemote({ manual: true }); };
const dialog = $("#installDialog");
$("#installHelpBtn").onclick = () => dialog.showModal();
$(".dialog-close").onclick = () => dialog.close();
dialog.onclick = e => { if (e.target === dialog) dialog.close(); };

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js?v=2.7", { scope:"./", updateViaCache:"none" });
      try { await reg.update(); } catch (_) {}
      if ("Notification" in window) {
        setNotificationStatus(
          Notification.permission === "granted" ? "Permission granted · tap to test" :
          Notification.permission === "denied" ? "Permission blocked" :
          "Ready to enable"
        );
      }
    } catch (e) {
      console.error("Service worker registration failed:", e);
      setNotificationStatus("Tap to repair notification service");
    }
  });
}
renderAll();
refreshRemote();
setInterval(() => { if (!document.hidden) refreshRemote(); }, Math.max(30000, cfg.refreshMs || 60000));
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshRemote(); });

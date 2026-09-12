const state = {
  screen: "matches",
  gender: "men",
  favourites: new Set(JSON.parse(localStorage.getItem("padel-live-favourites") || "[]")),
  lastSync: null,
  remoteConnected: false
};

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const cfg = window.PADEL_CONFIG || { apiBaseUrl: "", refreshMs: 60000, oneSignalAppId: "" };

const ALERT_DEFAULTS = { dayBefore: true, start: true, complete: true };
let alertPrefs = { ...ALERT_DEFAULTS, ...JSON.parse(localStorage.getItem("padel-live-alert-prefs") || "{}") };
let oneSignalReady = false;
let oneSignalInitialized = false;
let oneSignalInitPromise = null;
let preferencesSyncTimer = null;

function allPlayers() {
  const m = new Map();
  [...PADEL_DATA.rankings.men, ...PADEL_DATA.rankings.women].forEach(p => m.set(p.name, p));
  return [...m.values()];
}

function getDeviceId() {
  let id = localStorage.getItem("padel-live-device-id");
  if (!id) {
    id = `padel_${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random().toString(36).slice(2)}`}`;
    localStorage.setItem("padel-live-device-id", id);
  }
  return id;
}

function formatLocalMatchTime(match) {
  if (!match) return "TBD";
  const raw = match.startAt || match.scheduledAt || null;
  if (!raw) return match.time || "TBD";
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return match.time || "TBD";
  return d.toLocaleString([], {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit"
  });
}

function normalizedName(name) {
  return String(name || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchHasFollowedPlayer(match) {
  if (!match) return [];
  const followed = [...state.favourites];
  const haystack = `${match.teamA || ""} / ${match.teamB || ""}`;
  const h = normalizedName(haystack);
  return followed.filter(name => h.includes(normalizedName(name)));
}

function saveAlertPrefs() {
  localStorage.setItem("padel-live-alert-prefs", JSON.stringify(alertPrefs));
  queuePreferenceSync();
}

function save() {
  localStorage.setItem("padel-live-favourites", JSON.stringify([...state.favourites]));
  renderRankings();
  renderFollowing();
  queuePreferenceSync();
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
  $("#featuredMatch").innerHTML = `<div class="match-top"><span class="${m.status === "live" ? "status-live" : "status-upcoming"}">${m.status === "live" ? "LIVE" : "NEXT"}</span><span class="round">${m.round || "Match"}</span></div><div class="score-grid"><div><div class="team">${(m.teamA || []).join(" / ")}</div><div class="team">${(m.teamB || []).join(" / ")}</div></div><div><div class="score-row">${(m.scoreA || ["–","–","–"]).map((s,i)=>`<span class="score-box ${i===2&&m.status==="live"?"current":""}">${s}</span>`).join("")}</div><div class="score-row" style="margin-top:7px">${(m.scoreB || ["–","–","–"]).map((s,i)=>`<span class="score-box ${i===2&&m.status==="live"?"current":""}">${s}</span>`).join("")}</div></div></div><div class="match-footer"><span>${formatLocalMatchTime(m)}</span><div class="match-actions"><button class="watch-btn secondary-action" id="featuredAlertBtn">Remind me</button><a class="stream-btn" href="${watchUrl}" target="_blank" rel="noopener noreferrer">Watch on Red Bull TV ↗</a></div></div>`;
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
    return `<article class="match-card"><div class="match-card-row"><div class="teams"><div class="sub">${m.division || "Premier Padel"}</div><strong>${m.teamA || "TBD"}</strong><strong>${m.teamB || "TBD"}</strong>${score}</div><div><div class="time">${formatLocalMatchTime(m)}</div><div class="match-status-mini ${st==="live"?"live":""}">${st}</div></div></div></article>`;
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

  const pool = [
    ...(PADEL_DATA.upcomingMatches || []),
    ...((PADEL_DATA.todayMatches || []).filter(m => ["live","scheduled","upcoming","pending","not_started"].includes(String(m.status || "").toLowerCase())))
  ];
  const seen = new Set();
  const relevant = pool.filter(m => {
    if (!m || seen.has(String(m.id))) return false;
    seen.add(String(m.id));
    return matchHasFollowedPlayer(m).length > 0;
  }).sort((a,b)=>(new Date(a.startAt || 8640000000000000))-(new Date(b.startAt || 8640000000000000))).slice(0,8);

  $("#followedMatchCount").textContent = `${relevant.length} match${relevant.length === 1 ? "" : "es"}`;
  $("#followedMatches").innerHTML = relevant.length ? relevant.map(m => {
    const followed = matchHasFollowedPlayer(m).join(" · ");
    const live = String(m.status || "").toLowerCase() === "live";
    return `<article class="followed-match-card"><div class="follow-reason">${live ? "LIVE NOW" : `FOLLOWING · ${followed}`}</div><div class="teams"><strong>${m.teamA || "TBD"}</strong><strong>${m.teamB || "TBD"}</strong></div><div class="local-time">${live ? "Live" : formatLocalMatchTime(m)}</div></article>`;
  }).join("") : `<article class="match-card"><div class="sub">No upcoming matches are currently listed for your followed players.</div></article>`;

  $("#alert24h").checked = alertPrefs.dayBefore;
  $("#alertStart").checked = alertPrefs.start;
  $("#alertComplete").checked = alertPrefs.complete;
  updateBackgroundAlertUI();
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
  let reg = await navigator.serviceWorker.register("./sw.js?v=2.8", {
    scope: "./",
    updateViaCache: "none"
  });

  try { await reg.update(); } catch (_) {}

  try {
    return await waitForActiveWorker(reg, 6000);
  } catch (firstError) {
    // Repair an incomplete/stale registration once, automatically.
    try { await reg.unregister(); } catch (_) {}
    reg = await navigator.serviceWorker.register("./sw.js?v=2.8", {
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


function setBackgroundStatus(message) {
  const el = $("#backgroundAlertStatus");
  if (el) el.textContent = message;
}

function updateBackgroundAlertUI() {
  const btn = $("#notificationBtn");
  if (!btn) return;
  const configured = Boolean(cfg.oneSignalAppId);
  if (!configured) {
    btn.textContent = "Setup needed";
    btn.classList.remove("connected");
    setBackgroundStatus("OneSignal App ID not configured yet");
    return;
  }
  if (oneSignalReady) {
    btn.textContent = "Enabled";
    btn.classList.add("connected");
    setBackgroundStatus("Background alerts enabled for this device");
  } else {
    btn.textContent = "Enable";
    btn.classList.remove("connected");
    setBackgroundStatus("Tap Enable to connect background alerts");
  }
}

async function initOneSignal() {
  if (!cfg.oneSignalAppId || !window.OneSignalDeferred) {
    updateBackgroundAlertUI();
    return false;
  }
  if (oneSignalInitialized) return true;
  if (oneSignalInitPromise) return oneSignalInitPromise;

  oneSignalInitPromise = new Promise(resolve => {
    OneSignalDeferred.push(async function(OneSignal) {
      try {
        const scopePath = new URL("./push/onesignal/", location.href).pathname;
        await OneSignal.init({
          appId: cfg.oneSignalAppId,
          serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js",
          serviceWorkerParam: { scope: scopePath },
          autoResubscribe: true,
          notifyButton: { enable: false }
        });
        oneSignalInitialized = true;
        await OneSignal.login(getDeviceId());
        oneSignalReady = Boolean(OneSignal.User.PushSubscription.optedIn);
        OneSignal.User.PushSubscription.addEventListener("change", ev => {
          oneSignalReady = Boolean(ev.current?.optedIn);
          updateBackgroundAlertUI();
          queuePreferenceSync();
        });
        updateBackgroundAlertUI();
        if (oneSignalReady) queuePreferenceSync();
        resolve(true);
      } catch (e) {
        console.error("OneSignal init failed", e);
        oneSignalInitPromise = null;
        setBackgroundStatus(`Push setup error · ${String(e?.message || e).slice(0,36)}`);
        resolve(false);
      }
    });
  });
  return oneSignalInitPromise;
}

async function enableBackgroundAlerts() {
  if (!cfg.oneSignalAppId) {
    alert("Background push is not configured yet. Add your OneSignal App ID to config.js first.");
    return;
  }
  if (!isStandaloneApp() && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    alert("Open Padel Live from its Home Screen icon to enable background alerts on iPhone.");
    return;
  }
  setBackgroundStatus("Connecting push service…");
  await initOneSignal();
  OneSignalDeferred.push(async function(OneSignal) {
    try {
      await OneSignal.login(getDeviceId());
      if (!OneSignal.Notifications.permission) await OneSignal.Notifications.requestPermission();
      await OneSignal.User.PushSubscription.optIn();
      oneSignalReady = Boolean(OneSignal.User.PushSubscription.optedIn);
      updateBackgroundAlertUI();
      await syncPreferences();
      if (oneSignalReady) {
        await new Promise(resolve => setTimeout(resolve, 900));
        await sendBackendPushTest();
      }
    } catch (e) {
      console.error(e);
      setBackgroundStatus(`Could not enable · ${String(e?.message || e).slice(0,32)}`);
    }
  });
}

function queuePreferenceSync() {
  clearTimeout(preferencesSyncTimer);
  preferencesSyncTimer = setTimeout(() => syncPreferences(), 500);
}

async function syncPreferences() {
  const base = (cfg.apiBaseUrl || "").replace(/\/$/, "");
  if (!base) return false;
  try {
    const response = await fetch(`${base}/api/preferences`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        deviceId: getDeviceId(),
        favourites: [...state.favourites],
        alerts: alertPrefs,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        appUrl: new URL("./", location.href).href
      })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return true;
  } catch (e) {
    console.warn("Preference sync failed", e);
    return false;
  }
}

async function sendBackendPushTest() {
  const base = (cfg.apiBaseUrl || "").replace(/\/$/, "");
  if (!base || !oneSignalReady) return;
  try {
    const r = await fetch(`${base}/api/push-test`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), appUrl: new URL("./", location.href).href })
    });
    if (r.ok) setBackgroundStatus("Background alerts enabled · test push sent");
  } catch (e) {
    console.warn("Backend push test failed", e);
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
  if (payload.upcomingMatches) PADEL_DATA.upcomingMatches = payload.upcomingMatches;
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
$("#notificationBtn").onclick = () => enableBackgroundAlerts();
$("#testNotificationBtn").onclick = () => requestAlerts(true);
$("#alert24h").onchange = e => { alertPrefs.dayBefore = e.target.checked; saveAlertPrefs(); };
$("#alertStart").onchange = e => { alertPrefs.start = e.target.checked; saveAlertPrefs(); };
$("#alertComplete").onchange = e => { alertPrefs.complete = e.target.checked; saveAlertPrefs(); };
$("#clearFavouritesBtn").onclick = () => { if (confirm("Remove all followed players?")) { state.favourites.clear(); save(); } };
$("#refreshBtn").onclick = async () => { $("#refreshBtn").animate([{transform:"rotate(0deg)"},{transform:"rotate(360deg)"}],{duration:450}); await refreshRemote({ manual: true }); };
const dialog = $("#installDialog");
$("#installHelpBtn").onclick = () => dialog.showModal();
$(".dialog-close").onclick = () => dialog.close();
dialog.onclick = e => { if (e.target === dialog) dialog.close(); };

if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("./sw.js?v=2.8", { scope:"./", updateViaCache:"none" });
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
initOneSignal();
setInterval(() => { if (!document.hidden) refreshRemote(); }, Math.max(30000, cfg.refreshMs || 60000));
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshRemote(); });

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
  $("#featuredMatch").innerHTML = `<div class="match-top"><span class="${m.status === "live" ? "status-live" : "status-upcoming"}">${m.status === "live" ? "LIVE" : "NEXT"}</span><span class="round">${m.round || "Match"}</span></div><div class="score-grid"><div><div class="team">${(m.teamA || []).join(" / ")}</div><div class="team">${(m.teamB || []).join(" / ")}</div></div><div><div class="score-row">${(m.scoreA || ["–","–","–"]).map((s,i)=>`<span class="score-box ${i===2&&m.status==="live"?"current":""}">${s}</span>`).join("")}</div><div class="score-row" style="margin-top:7px">${(m.scoreB || ["–","–","–"]).map((s,i)=>`<span class="score-box ${i===2&&m.status==="live"?"current":""}">${s}</span>`).join("")}</div></div></div><div class="match-footer"><span>${m.time || "TBD"}</span><button class="watch-btn" id="featuredAlertBtn">Remind me</button></div>`;
  $("#featuredAlertBtn").onclick = () => requestAlerts(true);
}

function renderToday() {
  const matches = PADEL_DATA.todayMatches || [];
  $("#matchCount").textContent = `${matches.length} match${matches.length === 1 ? "" : "es"}`;
  $("#todayMatches").innerHTML = matches.length ? matches.map(m => `<article class="match-card"><div class="match-card-row"><div class="teams"><div class="sub">${m.division || "Premier Padel"}</div><strong>${m.teamA || "TBD"}</strong><strong>${m.teamB || "TBD"}</strong></div><span class="time">${m.time || "TBD"}</span></div></article>`).join("") : `<article class="match-card"><div class="sub">No matches currently listed.</div></article>`;
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

async function requestAlerts(test = false) {
  if (!("Notification" in window)) {
    alert("Notifications are not available in this browser.");
    return;
  }
  try {
    const p = await Notification.requestPermission();
    if (p === "granted") {
      if ($("#notificationBtn")) $("#notificationBtn").textContent = "Enabled";
      if (test) {
        const reg = await navigator.serviceWorker.ready;
        await reg.showNotification("Padel Live", { body: "Match alerts are enabled for this device.", icon: "./icons/icon-192.png", badge: "./icons/icon-192.png" });
      }
    } else alert("Notification permission was not granted.");
  } catch (e) {
    alert("On iPhone, add Padel Live to your Home Screen first, then enable notifications from the installed app.");
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
  if (payload.featuredMatch) PADEL_DATA.featuredMatch = payload.featuredMatch;
  if (payload.currentTournament) PADEL_DATA.currentTournament = payload.currentTournament;
}

async function refreshRemote({ manual = false } = {}) {
  const base = (cfg.apiBaseUrl || "").replace(/\/$/, "");
  if (!base) {
    state.remoteConnected = false;
    updateSyncLabel("Schedule snapshot");
    if (manual) renderAll();
    return;
  }
  updateSyncLabel("Refreshing…");
  try {
    const res = await fetch(`${base}/api/data`, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    applyRemoteData(json);
    state.lastSync = new Date();
    state.remoteConnected = true;
    renderAll();
    updateSyncLabel(formatSyncTime(state.lastSync));
  } catch (err) {
    console.warn("Padel Live refresh failed", err);
    state.remoteConnected = false;
    updateSyncLabel("Cached data · refresh unavailable");
    if (manual) renderAll();
  }
}

function renderAll() {
  renderHeader();
  renderFeatured();
  renderToday();
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

if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
renderAll();
refreshRemote();
setInterval(() => { if (!document.hidden) refreshRemote(); }, Math.max(30000, cfg.refreshMs || 60000));
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshRemote(); });

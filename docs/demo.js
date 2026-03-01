import "./nida-card.js";

const qs = new URLSearchParams(location.search);

const mount = document.getElementById("mount");
const themeToggle = document.getElementById("themeToggle");
const repoLink = document.getElementById("repoLink");

const inputCity = document.getElementById("city");
const inputCountry = document.getElementById("country");
const selectTheme = document.getElementById("theme");

// Repo link (best effort)
try {
  repoLink.href = `https://github.com/${location.pathname.split("/")[1]}/${location.pathname.split("/")[2] || ""}`.replace(
    /\/$/,
    "",
  );
} catch {
  // ignore
}

function applyTheme(theme) {
  if (theme === "dark" || theme === "light") {
    document.documentElement.dataset.theme = theme;
    return;
  }
  document.documentElement.dataset.theme =
    window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function makeFakeHass() {
  return {
    language: "en",
    locale: { language: "en", number_format: "language" },
    config: {
      time_zone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      location_name: "Demo",
    },
    themes: { darkMode: document.documentElement.dataset.theme === "dark" },
    states: {},
    callService: () => {},
  };
}

function buildConfig() {
  return {
    theme: selectTheme.value,
    city: inputCity.value,
    country: inputCountry.value,
    demo: true,
  };
}

/* ===============================
   LIVE PRAYER TIMES (AlAdhan)
================================= */

async function fetchPrayerTimesLive({ city, country }) {
  const url =
    "https://api.aladhan.com/v1/timingsByCity?method=2" +
    `&city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Prayer API HTTP ${res.status}`);

  const json = await res.json();
  const t = json?.data?.timings || {};

  // Keep "HH:MM"
  const clip = (v) => (typeof v === "string" ? v.slice(0, 5) : "");

  return {
    fajr: clip(t.Fajr),
    dhuhr: clip(t.Dhuhr),
    asr: clip(t.Asr),
    maghrib: clip(t.Maghrib),
    isha: clip(t.Isha),
  };
}

// Map to EXACT entities your card expects (from your grep output)
function makeStatesForNida(times) {
  const mk = (state, friendly) => ({
    state: state || "unavailable",
    attributes: { friendly_name: friendly },
  });

  return {
    "sensor.02_fajr_readable": mk(times.fajr, "Fajr"),
    "sensor.04_dhuhr_readable": mk(times.dhuhr, "Dhuhr"),
    "sensor.05_asr_readable": mk(times.asr, "Asr"),
    "sensor.07_maghrib_readable": mk(times.maghrib, "Maghrib"),
    "sensor.08_isha_readable": mk(times.isha, "Isha"),
  };
}

/* ===============================
   MOUNT / UPDATE
================================= */

let cardEl = null;
let hassObj = null;
let refreshTimer = null;

function syncUiFromQuery() {
  inputCity.value = qs.get("city") ?? inputCity.value;
  inputCountry.value = qs.get("country") ?? inputCountry.value;
  selectTheme.value = qs.get("theme") ?? selectTheme.value;
  applyTheme(selectTheme.value);
}

function clearRefreshTimer() {
  if (refreshTimer) {
    clearInterval(refreshTimer);
    refreshTimer = null;
  }
}

async function updateLiveData(cfg) {
  if (!hassObj || !cardEl) return;

  try {
    const times = await fetchPrayerTimesLive({ city: cfg.city, country: cfg.country });
    hassObj.states = { ...hassObj.states, ...makeStatesForNida(times) };
    // trigger re-render
    cardEl.hass = { ...hassObj };
  } catch (e) {
    console.error(e);
    // Put unavailable states so the card can show something predictable
    hassObj.states = {
      ...hassObj.states,
      ...makeStatesForNida({ fajr: "", dhuhr: "", asr: "", maghrib: "", isha: "" }),
    };
    cardEl.hass = { ...hassObj };
  }
}

async function mountCard() {
  mount.innerHTML = "";

  const cfg = buildConfig();

  // Create card
  cardEl = document.createElement("nida-card");
  mount.appendChild(cardEl);

  if (typeof cardEl.setConfig === "function") cardEl.setConfig(cfg);
  if (!cardEl._config) cardEl._config = cfg;

  hassObj = makeFakeHass();
  cardEl.hass = hassObj;

  // First load
  await updateLiveData(cfg);

  // Refresh every 10 minutes (and keep countdown updated by the card itself)
  clearRefreshTimer();
  refreshTimer = setInterval(() => updateLiveData(buildConfig()), 10 * 60 * 1000);

  return cardEl;
}

async function remount() {
  applyTheme(selectTheme.value);
  await mountCard();
}

/* ===============================
   EVENTS
================================= */

themeToggle?.addEventListener("click", async () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  selectTheme.value = next;
  await remount();
});

[inputCity, inputCountry, selectTheme].forEach((el) => el?.addEventListener("change", remount));

/* ===============================
   INIT
================================= */

syncUiFromQuery();
(async () => {
  await mountCard();
})();
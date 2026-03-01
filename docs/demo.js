import "./nida-card.js";

const qs = new URLSearchParams(location.search);

const mount = document.getElementById("mount");
const themeToggle = document.getElementById("themeToggle");
const repoLink = document.getElementById("repoLink");

const inputCity = document.getElementById("city");
const inputCountry = document.getElementById("country");
const selectTheme = document.getElementById("theme");

repoLink.href = `https://github.com/${location.pathname.split("/")[1]}/${location.pathname.split("/")[2] || ""}`.replace(/\/$/, "");

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

async function fetchPrayerTimes({ city, country }) {
  const url =
    "https://api.aladhan.com/v1/timingsByCity?method=2" +
    `&city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Prayer API HTTP ${res.status}`);
  const json = await res.json();
  const t = json?.data?.timings || {};

  // "HH:MM" strings
  return {
    fajr: (t.Fajr || "").slice(0, 5),
    dhuhr: (t.Dhuhr || "").slice(0, 5),
    asr: (t.Asr || "").slice(0, 5),
    maghrib: (t.Maghrib || "").slice(0, 5),
    isha: (t.Isha || "").slice(0, 5),
  };
}

function makeStatesForNida(times) {
  const mk = (state, name) => ({ state, attributes: { friendly_name: name } });

  return {
    "sensor.02_fajr_readable": mk(times.fajr, "Fajr"),
    "sensor.04_dhuhr_readable": mk(times.dhuhr, "Dhuhr"),
    "sensor.05_asr_readable": mk(times.asr, "Asr"),
    "sensor.07_maghrib_readable": mk(times.maghrib, "Maghrib"),
    "sensor.08_isha_readable": mk(times.isha, "Isha"),
  };
}

/* ===============================
   LIVE PRAYER TIMES (AlAdhan)
================================= */

async function fetchPrayerTimes({ city, country }) {
  const url =
    "https://api.aladhan.com/v1/timingsByCity?method=2" +
    `&city=${encodeURIComponent(city)}` +
    `&country=${encodeURIComponent(country)}`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Prayer API HTTP ${res.status}`);
  const json = await res.json();

  const t = json?.data?.timings || {};
  return {
    fajr: t.Fajr,
    sunrise: t.Sunrise,
    dhuhr: t.Dhuhr,
    asr: t.Asr,
    maghrib: t.Maghrib,
    isha: t.Isha,
  };
}

function computeNextPrayer(times) {
  const order = ["fajr", "sunrise", "dhuhr", "asr", "maghrib", "isha"];
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  function toDate(hhmm) {
    const v = (hhmm || "").slice(0, 5); // keep "HH:MM"
    const [h, m] = v.split(":").map((x) => parseInt(x, 10));
    const d = new Date(`${today}T00:00:00`);
    d.setHours(h || 0, m || 0, 0, 0);
    return d;
  }

  for (const key of order) {
    const d = toDate(times[key]);
    if (d > now) return { name: key, at: times[key] };
  }
  return { name: "fajr", at: times.fajr };
}

function makeStatesFromTimes(times) {
  // times: { fajr, dhuhr, asr, maghrib, isha } -> "HH:MM"
  function stateObj(state, friendly) {
    return {
      state,
      attributes: {
        friendly_name: friendly,
      },
    };
  }

  return {
    "sensor.02_fajr_readable": stateObj(times.fajr, "Fajr"),
    "sensor.04_dhuhr_readable": stateObj(times.dhuhr, "Dhuhr"),
    "sensor.05_asr_readable": stateObj(times.asr, "Asr"),
    "sensor.07_maghrib_readable": stateObj(times.maghrib, "Maghrib"),
    "sensor.08_isha_readable": stateObj(times.isha, "Isha"),
  };
}

/* ===============================
   MOUNT
================================= */

async function mountCard() {
  mount.innerHTML = "";

  const el = document.createElement("nida-card");
  mount.appendChild(el);

  const cfg = buildConfig();
  if (typeof el.setConfig === "function") el.setConfig(cfg);

  const hass = makeFakeHass();
  el.hass = hass;

  try {
    const times = await fetchPrayerTimes({ city: cfg.city, country: cfg.country });
    hass.states = { ...hass.states, ...makeStatesForNida(times) };
    el.hass = { ...hass }; // trigger update
  } catch (e) {
    console.error(e);
  }

  if (!el._config) el._config = cfg;
  return el;
}

function syncUiFromQuery() {
  inputCity.value = qs.get("city") ?? inputCity.value;
  inputCountry.value = qs.get("country") ?? inputCountry.value;
  selectTheme.value = qs.get("theme") ?? selectTheme.value;
  applyTheme(selectTheme.value);
}

syncUiFromQuery();

let cardEl;
(async () => {
  cardEl = await mountCard();
})();

async function remount() {
  applyTheme(selectTheme.value);
  cardEl = await mountCard();
}

themeToggle.addEventListener("click", async () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  selectTheme.value = next;
  await remount();
});

[inputCity, inputCountry, selectTheme].forEach((el) => el.addEventListener("change", remount));
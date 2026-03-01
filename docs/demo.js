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
  const next = computeNextPrayer(times);

  const labelMap = {
    fajr: "Fajr",
    sunrise: "Sunrise",
    dhuhr: "Dhuhr",
    asr: "Asr",
    maghrib: "Maghrib",
    isha: "Isha",
  };

  return {
    // all times
    "sensor.nida_prayer_times": {
      state: "ok",
      attributes: {
        fajr: times.fajr,
        sunrise: times.sunrise,
        dhuhr: times.dhuhr,
        asr: times.asr,
        maghrib: times.maghrib,
        isha: times.isha,
      },
    },

    // next prayer label + time
    "sensor.nida_next_prayer": {
      state: labelMap[next.name] || next.name,
      attributes: { friendly_name: "Next prayer" },
    },
    "sensor.nida_next_prayer_time": {
      state: next.at,
      attributes: { friendly_name: "Next prayer time" },
    },
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

  // fetch live times and inject as HA-like sensors
  try {
    const times = await fetchPrayerTimes({ city: cfg.city, country: cfg.country });
    hass.states = { ...hass.states, ...makeStatesFromTimes(times) };
    el.hass = { ...hass }; // trigger update
  } catch (e) {
    console.error(e);
    hass.states = {
      ...hass.states,
      "sensor.nida_prayer_times": {
        state: "error",
        attributes: { message: String(e) },
      },
    };
    el.hass = { ...hass };
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
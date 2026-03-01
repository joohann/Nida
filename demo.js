import "../nida-card.js";

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
    // Sommige kaarten gebruiken this.hass.callService; hier stubben we hem
    callService: () => {},
  };
}

function buildConfig() {
  return {
    // dit zijn demo-velden; pas ze gerust aan naar jouw kaart-config
    theme: selectTheme.value,
    city: inputCity.value,
    country: inputCountry.value,
  };
}

function mountCard() {
  mount.innerHTML = "";

  const el = document.createElement("prayer-times-card"); // pas aan als jouw custom element anders heet
  mount.appendChild(el);

  const cfg = buildConfig();

  // 1) probeer HA custom card lifecycle
  if (typeof el.setConfig === "function") el.setConfig(cfg);

  // 2) geef hass mee als de kaart dat verwacht
  el.hass = makeFakeHass();

  // 3) sommige kaarten gebruiken direct _config, dus we zetten hem ook nog
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
let cardEl = mountCard();

function remount() {
  applyTheme(selectTheme.value);
  cardEl = mountCard();
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.dataset.theme;
  const next = current === "dark" ? "light" : "dark";
  selectTheme.value = next;
  remount();
});

[inputCity, inputCountry, selectTheme].forEach((el) => el.addEventListener("change", remount));

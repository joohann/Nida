/**
 * Nida panel — settings UI + companion column.
 *
 * Implements the approved design from references/design.md (mockup at
 * references/assets/panel-mockup.html): deep-emerald + gold palette, Cairo
 * headings + Inter body, two-column layout (settings 1.3fr / companion 1fr),
 * subtle 8-pointed-star lattice watermark and arabesque border motif.
 *
 * Data sources:
 *   - Settings: websocket commands nida/get_settings + nida/update_settings.
 *   - Hijri date + current/next prayer + countdown: live from sensor.nida_*
 *     entity states (see custom_components/nida/sensor.py).
 *   - Quote card + upcoming holiday card: placeholder TODO state — sources
 *     not yet decided (see references/design.md "Open items").
 *
 * i18n: own dictionary keyed by ISO 639-1 code. options.language stores
 *   "auto" (default) or an explicit code. When "auto" we follow
 *   hass.language. EN and NL are filled in; AR/TR/DE/FR/MS/ID/UR/FA are
 *   stubbed and fall back to EN until properly translated.
 *
 * Sounds: catalog.json does not exist yet, so each row shows the currently
 *   stored options.sound_<category> value with a "no catalog loaded"
 *   subtitle; play/chevron buttons are present but inactive until the
 *   catalog wiring is built.
 *
 * Changelog:
 *   2.0.3 (2026-06-28): Sound preview buttons enabled — play/stop toggle
 *                       via inline <audio> element pointing at
 *                       /local/nida/sounds/<path>, no media_player needed
 *                       for browser-side preview. Country in manual mode
 *                       is now an ISO 3166 dropdown (was a free text
 *                       field) with localized country names via
 *                       Intl.DisplayNames. Order swapped: country now
 *                       shown above city. Footer version bumped.
 *   2.0.1 (2026-06-28): Bugfix — click delegator was being re-registered on
 *                       every _render(), causing stacked listeners and the
 *                       "first toggle works, then nothing" symptom Johann
 *                       reported. Listener now attached once in
 *                       connectedCallback and removed in disconnectedCallback.
 *                       Click body extracted to _handleClick.
 *   2.0.0 (2026-06-28): Full settings + companion UI per references/design.md
 *                       (replaces 2.0.0 placeholder). Adds i18n scaffolding,
 *                       live sensor reads, calculation-method picker (24
 *                       Aladhan methods), language picker (10 + auto),
 *                       degraded sound-row state pending catalog wiring,
 *                       TODO placeholders for quote + holiday cards.
 *   2.0.0 (2026-06-27): Initial placeholder — only verified panel registration
 *                       and websocket roundtrip; no real settings UI.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];

const SOUND_CATEGORIES = [
  { key: "fajr_adhan", label_key: "sound_fajr_adhan", subtitle_key: "sound_fajr_adhan_sub" },
  { key: "adhan", label_key: "sound_adhan", subtitle_key: "sound_adhan_sub" },
  { key: "pre_adhan_jingle", label_key: "sound_pre_adhan_jingle", subtitle_key: "sound_pre_adhan_jingle_sub" },
];

// 24 Aladhan calculation methods — source: architecture.md §9.1.
// ID 6 is intentionally absent (never assigned by Aladhan).
const CALCULATION_METHODS = [
  { id: 0, name: "Shia Ithna-Ashari, Leva Institute, Qum" },
  { id: 1, name: "University of Islamic Sciences, Karachi" },
  { id: 2, name: "Islamic Society of North America" },
  { id: 3, name: "Muslim World League" },
  { id: 4, name: "Umm Al-Qura University, Makkah" },
  { id: 5, name: "Egyptian General Authority of Survey" },
  { id: 7, name: "Institute of Geophysics, University of Tehran" },
  { id: 8, name: "Gulf Region" },
  { id: 9, name: "Kuwait" },
  { id: 10, name: "Qatar" },
  { id: 11, name: "Majlis Ugama Islam Singapura" },
  { id: 12, name: "Union Organization Islamic de France" },
  { id: 13, name: "Diyanet İşleri Başkanlığı, Turkey" },
  { id: 14, name: "Spiritual Administration of Muslims of Russia" },
  { id: 15, name: "Moonsighting Committee Worldwide" },
  { id: 16, name: "Dubai" },
  { id: 17, name: "Jabatan Kemajuan Islam Malaysia" },
  { id: 18, name: "Tunisia" },
  { id: 19, name: "Algeria" },
  { id: 20, name: "Kementerian Agama Republik Indonesia" },
  { id: 21, name: "Morocco" },
  { id: 22, name: "Comunidade Islamica de Lisboa" },
  { id: 23, name: "Ministry of Awqaf, Jordan" },
  { id: 99, name: "Custom" },
];

const DEFAULT_METHOD_ID = 3;

// Languages: "auto" + 10 explicit. Labels in their own language (native form).
const LANGUAGES = [
  { code: "auto", label: "Automatic" },
  { code: "en", label: "English" },
  { code: "nl", label: "Nederlands" },
  { code: "ar", label: "العربية" },
  { code: "tr", label: "Türkçe" },
  { code: "de", label: "Deutsch" },
  { code: "fr", label: "Français" },
  { code: "ms", label: "Bahasa Melayu" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ur", label: "اردو" },
  { code: "fa", label: "فارسی" },
];

// Only EN + NL are filled in. Other languages fall through to EN until they
// are properly translated (SKILL.md rule 6). Keys are stable across languages.
const TRANSLATIONS = {
  en: {
    section_location: "Location and method",
    section_prayers: "Prayers",
    section_sounds: "Sounds",
    location_use_device: "Use device location",
    location_set_manually: "Set manually",
    city: "City",
    country: "Country",
    calculation_method: "Calculation method",
    prayer_fajr: "Fajr",
    prayer_dhuhr: "Dhuhr",
    prayer_asr: "Asr",
    prayer_maghrib: "Maghrib",
    prayer_isha: "Isha",
    sound_fajr_adhan: "Fajr adhan",
    sound_fajr_adhan_sub: "Used for Fajr",
    sound_adhan: "Adhan",
    sound_adhan_sub: "Used for Dhuhr, Asr, Maghrib, Isha",
    sound_pre_adhan_jingle: "Pre-adhan jingle",
    sound_pre_adhan_jingle_sub: "Played before each adhan",
    sound_default: "default",
    current_prayer: "Current prayer",
    starts_at: "Starts at",
    hours: "Hours",
    minutes: "Minutes",
    quote_todo_eyebrow: "Quote",
    quote_todo_text: "Quote source not yet wired up.",
    upcoming_holiday: "Upcoming holiday",
    holiday_todo: "Holiday source not yet wired up.",
    language_label: "Panel language",
    method_pick_title: "Calculation method",
    language_pick_title: "Panel language",
    country_pick_title: "Country",
    close: "Close",
    loading: "Loading…",
    error_prefix: "Error",
  },
  nl: {
    section_location: "Locatie en methode",
    section_prayers: "Gebeden",
    section_sounds: "Geluiden",
    location_use_device: "Apparaatlocatie gebruiken",
    location_set_manually: "Handmatig instellen",
    city: "Stad",
    country: "Land",
    calculation_method: "Berekeningsmethode",
    prayer_fajr: "Fajr",
    prayer_dhuhr: "Dhuhr",
    prayer_asr: "Asr",
    prayer_maghrib: "Maghrib",
    prayer_isha: "Isha",
    sound_fajr_adhan: "Fajr-adhan",
    sound_fajr_adhan_sub: "Gebruikt voor Fajr",
    sound_adhan: "Adhan",
    sound_adhan_sub: "Gebruikt voor Dhuhr, Asr, Maghrib, Isha",
    sound_pre_adhan_jingle: "Pre-adhan-jingle",
    sound_pre_adhan_jingle_sub: "Speelt voor elke adhan",
    sound_default: "standaard",
    current_prayer: "Huidig gebed",
    starts_at: "Begint om",
    hours: "Uren",
    minutes: "Minuten",
    quote_todo_eyebrow: "Citaat",
    quote_todo_text: "Citaat-bron is nog niet aangesloten.",
    upcoming_holiday: "Aankomende feestdag",
    holiday_todo: "Feestdag-bron is nog niet aangesloten.",
    language_label: "Paneeltaal",
    method_pick_title: "Berekeningsmethode",
    language_pick_title: "Paneeltaal",
    country_pick_title: "Land",
    close: "Sluiten",
    loading: "Laden…",
    error_prefix: "Fout",
  },
  // Stubs — fall back to en until translated. SKILL.md rule 6 covers the
  // full target set; keep these keys present even when empty so missing-key
  // detection is easy during translation.
  ar: {}, tr: {}, de: {}, fr: {}, ms: {}, id: {}, ur: {}, fa: {},
};

// Mirror of DEFAULT_SOUNDS in const.py. Kept in sync manually — when those
// change in Python the JS list must follow, since the panel reads file
// paths directly from /local/nida/sounds/ for preview playback (the
// scheduler's actual playback uses the Python value, not this one).
const DEFAULT_SOUND_PATHS = {
  fajr_adhan: "adhan/adhan_fajr_ahmed_saeed_al-omrany.mp3",
  adhan: "adhan/adhan_day_ahmed_saeed_al-omrany.mp3",
  pre_adhan_jingle: "pre_adhan_jingle/announcement.mp3",
};

// SVG icons used throughout. Inline so we have one shadow-DOM-safe source of
// truth; copying out of the mockup verbatim per design.md guidance.
const ICONS = {
  brand: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V10l7-7 7 7v11M9 21v-6h6v6"/></svg>`,
  globe: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 010 18 14 14 0 010-18z"/></svg>`,
  location: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><polygon points="12 7 13.5 10.5 17 12 13.5 13.5 12 17 10.5 13.5 7 12 10.5 10.5"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>`,
  play: `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  stop: `<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>`,
  chevronRight: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>`,
  chevronDown: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  quote: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 016.5 17H20V4H6.5A2.5 2.5 0 004 6.5v13z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2.5 6.5L21 10l-5 4.5L17.5 21 12 17.5 6.5 21 8 14.5 3 10l6.5-1.5z"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5L20 7"/></svg>`,
};

// Google Fonts injected once globally (shadow DOM can use fonts loaded into
// the document). Stable href reused if already present.
const FONTS_HREF = "https://fonts.googleapis.com/css2?family=Cairo:wght@500;600;700&family=Inter:wght@400;500;600&display=swap";

// Stable bundled list of ISO 3166-1 alpha-2 country codes, derived at
// runtime via Intl.supportedValuesOf("region"). Localized display names
// come from Intl.DisplayNames so the panel can show country names in
// every supported language without us shipping a translation table.
function listCountries(lang) {
  try {
    const codes = Intl
      .supportedValuesOf("region")
      .filter((c) => /^[A-Z]{2}$/.test(c));
    const dn = new Intl.DisplayNames([lang], { type: "region" });
    return codes
      .map((c) => ({ code: c, name: dn.of(c) || c }))
      .sort((a, b) => a.name.localeCompare(b.name, lang));
  } catch {
    return [];
  }
}

function localizedCountryName(code, lang) {
  if (!code) return "";
  try {
    return new Intl.DisplayNames([lang], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom element
// ─────────────────────────────────────────────────────────────────────────────

class NidaPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._entryId = null;
    this._settings = null;
    this._error = null;
    this._loaded = false;
    this._activeOverlay = null;          // "method" | "language" | "country" | null
    this._countdownInterval = null;
    this._currentAudio = null;            // {category, audioEl} while previewing
    // Stable bound reference so add/removeEventListener match the same fn.
    this._clickHandler = this._handleClick.bind(this);
  }

  // ───── Lifecycle ──────────────────────────────────────────────────────────

  set hass(hass) {
    const firstTime = !this._hass;
    this._hass = hass;
    if (firstTime) {
      this._render();
      this._init().then(() => this._render());
    } else if (this._loaded) {
      // Subsequent state-change updates: only refresh dynamic nodes; leaving
      // settings UI alone keeps focus/typing intact.
      this._updateLiveNodes();
    }
  }

  set panel(_panel) {
    // panel.config currently unused — accepted for HA's panel_custom contract.
  }

  connectedCallback() {
    this._injectFontsOnce();
    // Register the click delegator ONCE on the shadow root. Re-registering in
    // _render() (as the 2.0.0 placeholder did) caused listeners to stack up:
    // after N renders every click fired N times, which on toggle/save flows
    // produced "first action works, every subsequent action looks dead".
    this.shadowRoot.addEventListener("click", this._clickHandler);
    this._render();
    this._startCountdown();
  }

  disconnectedCallback() {
    this.shadowRoot.removeEventListener("click", this._clickHandler);
    this._stopSoundPreview();
    this._stopCountdown();
  }

  _injectFontsOnce() {
    if (document.head.querySelector(`link[href="${FONTS_HREF}"]`)) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = FONTS_HREF;
    document.head.appendChild(link);
  }

  // ───── Data loading ───────────────────────────────────────────────────────

  async _init() {
    try {
      const entries = await this._hass.callWS({
        type: "config_entries/get",
        domain: "nida",
      });
      this._entryId = entries && entries.length ? entries[0].entry_id : null;
      if (!this._entryId) {
        this._error = "Nida config entry not found";
      } else {
        await this._loadSettings();
      }
    } catch (e) {
      this._error = `${this.t("error_prefix")}: ${e.message || e}`;
    }
    this._loaded = true;
  }

  async _loadSettings() {
    try {
      this._settings = await this._hass.callWS({
        type: "nida/get_settings",
        entry_id: this._entryId,
      });
    } catch (e) {
      this._error = `${this.t("error_prefix")}: ${e.message || e}`;
    }
  }

  async _saveSettings(patch) {
    if (!this._entryId) return;
    const next = { ...(this._settings || {}), ...patch };
    this._settings = next;
    try {
      await this._hass.callWS({
        type: "nida/update_settings",
        entry_id: this._entryId,
        options: next,
      });
    } catch (e) {
      this._error = `${this.t("error_prefix")}: ${e.message || e}`;
      this._render();
      return;
    }
    this._render();
  }

  // ───── i18n ───────────────────────────────────────────────────────────────

  t(key) {
    const lang = this._effectiveLanguage();
    const dict = TRANSLATIONS[lang] || {};
    if (dict[key] != null) return dict[key];
    return TRANSLATIONS.en[key] ?? key;
  }

  _effectiveLanguage() {
    const stored = this._settings?.language ?? "auto";
    if (stored !== "auto") return stored;
    const hassLang = (this._hass?.language || "en").slice(0, 2).toLowerCase();
    return TRANSLATIONS[hassLang] ? hassLang : "en";
  }

  // ───── Sensor reads ───────────────────────────────────────────────────────

  _sensorState(name) {
    const s = this._hass?.states?.[`sensor.nida_${name}`];
    return s && s.state !== "unknown" && s.state !== "unavailable" ? s.state : null;
  }

  _hijriDateText() {
    const day = this._sensorState("hijri_day");
    const month = this._sensorState("hijri_month");
    const year = this._sensorState("hijri_year");
    if (!day || !month || !year) return "—";
    return `${day} ${month} ${year}`;
  }

  _gregorianDateText() {
    const lang = this._effectiveLanguage();
    try {
      return new Date().toLocaleDateString(lang === "auto" ? undefined : lang, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return new Date().toDateString();
    }
  }

  _nextPrayer() {
    return this._sensorState("next_prayer");
  }

  _currentPrayer() {
    const next = this._nextPrayer();
    if (!next) return null;
    const idx = PRAYERS.indexOf(next);
    if (idx === -1) return null;
    return PRAYERS[(idx - 1 + PRAYERS.length) % PRAYERS.length];
  }

  _nextPrayerDate() {
    const next = this._nextPrayer();
    if (!next) return null;
    const ts = this._sensorState(next);
    if (!ts) return null;
    const d = new Date(ts);
    return isNaN(d.getTime()) ? null : d;
  }

  _nextPrayerStartText() {
    const d = this._nextPrayerDate();
    if (!d) return "";
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${this.t("starts_at")} ${hh}:${mm}`;
  }

  _countdown() {
    const d = this._nextPrayerDate();
    if (!d) return { h: "—", m: "—" };
    let diff = d.getTime() - Date.now();
    if (diff < 0) diff += 24 * 3600 * 1000; // wraps to tomorrow's fajr case
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { h: String(h).padStart(2, "0"), m: String(m).padStart(2, "0") };
  }

  _capitalize(s) {
    return s ? s[0].toUpperCase() + s.slice(1) : "";
  }

  // ───── Countdown timer ────────────────────────────────────────────────────

  _startCountdown() {
    this._stopCountdown();
    this._countdownInterval = setInterval(() => this._updateLiveNodes(), 30000);
  }

  _stopCountdown() {
    if (this._countdownInterval) {
      clearInterval(this._countdownInterval);
      this._countdownInterval = null;
    }
  }

  _updateLiveNodes() {
    const root = this.shadowRoot;
    if (!root) return;

    const next = this._nextPrayer();
    const current = this._currentPrayer();

    const setText = (sel, txt) => {
      const el = root.querySelector(sel);
      if (el) el.textContent = txt;
    };

    setText('[data-live="hijri-date"]', this._hijriDateText());
    setText('[data-live="hijri-greg"]', this._gregorianDateText());

    if (current) {
      setText('[data-live="current-label"]', `${this.t("current_prayer")} · ${this.t("prayer_" + current)}`);
    }
    if (next) {
      setText('[data-live="next-name"]', this.t("prayer_" + next));
      setText('[data-live="next-time"]', this._nextPrayerStartText());
    }

    const cd = this._countdown();
    setText('[data-live="cd-h"]', cd.h);
    setText('[data-live="cd-m"]', cd.m);
  }

  // ───── Event handlers ─────────────────────────────────────────────────────

  _onTogglePrayer(prayer) {
    const key = `enabled_${prayer}`;
    const curr = this._isPrayerEnabled(prayer);
    this._saveSettings({ [key]: !curr });
  }

  _isPrayerEnabled(prayer) {
    const val = this._settings?.[`enabled_${prayer}`];
    return val === undefined ? true : !!val; // default ON
  }

  _onLocationMode(mode) {
    this._saveSettings({ location_mode: mode });
  }

  _locationMode() {
    return this._settings?.location_mode || "device";
  }

  _onCityBlur(value) {
    this._saveSettings({ city: value });
  }

  _onCountryBlur(value) {
    this._saveSettings({ country: value });
  }

  _onPickCountry(code) {
    this._saveSettings({ country: code });
    this._closeOverlay();
  }

  // ───── Sound preview ──────────────────────────────────────────────────────

  _soundUrlFor(category) {
    const stored = this._settings?.[`sound_${category}`];
    const rel = stored || DEFAULT_SOUND_PATHS[category];
    return rel ? `/local/nida/sounds/${rel}` : null;
  }

  _playSoundPreview(category) {
    // If a different category is already playing, stop it first.
    this._stopSoundPreview();

    const url = this._soundUrlFor(category);
    if (!url) {
      console.warn("Nida: no sound URL for category", category);
      return;
    }

    const audio = new Audio(url);
    this._currentAudio = { category, audio };

    audio.addEventListener("ended", () => {
      if (this._currentAudio && this._currentAudio.audio === audio) {
        this._currentAudio = null;
        this._render();
      }
    });
    audio.addEventListener("error", () => {
      this._currentAudio = null;
      this._render();
    });

    audio.play().catch((err) => {
      // Autoplay/CORS/404 failures land here. Just reset state so the
      // play button comes back; the browser console shows the actual error.
      console.warn("Nida: cannot play preview:", err);
      this._currentAudio = null;
      this._render();
    });

    this._render();
  }

  _stopSoundPreview() {
    if (this._currentAudio?.audio) {
      try {
        this._currentAudio.audio.pause();
        this._currentAudio.audio.currentTime = 0;
      } catch {
        // ignore — browser may already have torn down the element
      }
    }
    this._currentAudio = null;
  }

  _methodId() {
    const v = this._settings?.method;
    return v === undefined || v === null ? DEFAULT_METHOD_ID : Number(v);
  }

  _methodName(id) {
    const m = CALCULATION_METHODS.find((x) => x.id === Number(id));
    return m ? m.name : String(id);
  }

  _onPickMethod(id) {
    this._saveSettings({ method: id });
    this._closeOverlay();
  }

  _onPickLanguage(code) {
    this._saveSettings({ language: code });
    this._closeOverlay();
  }

  _openOverlay(which) {
    this._activeOverlay = which;
    this._render();
  }

  _closeOverlay() {
    this._activeOverlay = null;
    this._render();
  }

  _languageLabel() {
    const stored = this._settings?.language || "auto";
    const lang = LANGUAGES.find((l) => l.code === stored);
    return lang ? lang.label : "English";
  }

  // ───── Render ─────────────────────────────────────────────────────────────

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = this._html();
    this._attachInputListeners();
    this._updateLiveNodes();
  }

  _html() {
    if (!this._loaded) return this._htmlLoading();
    if (this._error && !this._settings) return this._htmlError();

    return `
      <style>${this._css()}</style>
      <div class="app">
        <div class="pattern-overlay"></div>
        ${this._htmlHeader()}
        <div class="layout">
          <div class="col-settings">
            <div class="content">
              ${this._htmlSectionLocation()}
              ${this._htmlSectionPrayers()}
              ${this._htmlSectionSounds()}
            </div>
          </div>
          <div class="col-companion">
            ${this._htmlHijriCard()}
            ${this._htmlNowCard()}
            ${this._htmlQuoteCard()}
            ${this._htmlHolidayCard()}
          </div>
        </div>
        <div class="footer-note">Nida 2.0.3</div>
        ${this._activeOverlay ? this._htmlOverlay() : ""}
      </div>
    `;
  }

  _htmlLoading() {
    return `
      <style>${this._cssBase()}</style>
      <div class="app">
        <div class="loading-state">${this.t("loading")}</div>
      </div>
    `;
  }

  _htmlError() {
    return `
      <style>${this._cssBase()}</style>
      <div class="app">
        <div class="loading-state error">${this._error}</div>
      </div>
    `;
  }

  _htmlHeader() {
    return `
      <div class="header">
        <div class="header-row">
          <div class="brand">
            <div class="brand-mark">${ICONS.brand}</div>
            <div class="brand-title">Nida<sup>2</sup></div>
          </div>
          <button class="lang-pill" data-action="open-language">
            ${ICONS.globe}
            <span>${this._languageLabel()}</span>
          </button>
        </div>
        <div class="border-motif"></div>
      </div>
    `;
  }

  _htmlSectionLocation() {
    const mode = this._locationMode();
    const city = this._settings?.city ?? "";
    const country = this._settings?.country ?? "";
    const lang = this._effectiveLanguage();
    const countryDisplay = country
      ? localizedCountryName(country, lang)
      : this.t("country_pick_title");
    const methodName = this._methodName(this._methodId());

    return `
      <div class="section">
        <div class="section-head">
          <div class="section-icon">${ICONS.location}</div>
          <div class="section-title">${this.t("section_location")}</div>
        </div>
        <div class="card">
          <div class="seg-control">
            <div class="seg-btn ${mode === "device" ? "active" : ""}" data-action="loc-device">
              ${this.t("location_use_device")}
            </div>
            <div class="seg-btn ${mode === "manual" ? "active" : ""}" data-action="loc-manual">
              ${this.t("location_set_manually")}
            </div>
          </div>
          ${mode === "manual" ? `
            <div class="select-field" data-action="open-country">
              <span>${this.t("country")}</span>
              <span class="select-value">${this._escape(countryDisplay)} ${ICONS.chevronRight}</span>
            </div>
            <div class="text-field">
              <label>${this.t("city")}</label>
              <input type="text" data-input="city" value="${this._escape(city)}" autocomplete="off">
            </div>
          ` : ""}
          <div class="select-field" data-action="open-method">
            <span>${this.t("calculation_method")}</span>
            <span class="select-value">${methodName} ${ICONS.chevronRight}</span>
          </div>
        </div>
      </div>
    `;
  }

  _htmlSectionPrayers() {
    return `
      <div class="section">
        <div class="section-head">
          <div class="section-icon">${ICONS.clock}</div>
          <div class="section-title">${this.t("section_prayers")}</div>
        </div>
        <div class="card">
          ${PRAYERS.map((p) => `
            <div class="row">
              <span class="row-label">${this.t("prayer_" + p)}</span>
              <div class="toggle ${this._isPrayerEnabled(p) ? "on" : ""}" data-action="toggle-prayer" data-prayer="${p}">
                <div class="toggle-knob"></div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>
    `;
  }

  _htmlSectionSounds() {
    return `
      <div class="section">
        <div class="section-head">
          <div class="section-icon">${ICONS.speaker}</div>
          <div class="section-title">${this.t("section_sounds")}</div>
        </div>
        <div class="card">
          ${SOUND_CATEGORIES.map((cat) => {
            const stored = this._settings?.[`sound_${cat.key}`];
            const subtitle = stored
              ? stored
              : `${this.t(cat.subtitle_key)} · ${this.t("sound_default")}`;
            const isPlaying = this._currentAudio?.category === cat.key;
            const btnIcon = isPlaying ? ICONS.stop : ICONS.play;
            const btnAction = isPlaying ? "stop-sound" : "play-sound";
            return `
              <div class="sound-row">
                <div class="sound-info">
                  <div class="sound-name">${this.t(cat.label_key)}</div>
                  <div class="row-sub">${this._escape(subtitle)}</div>
                </div>
                <div class="play-btn ${isPlaying ? 'playing' : ''}" data-action="${btnAction}" data-category="${cat.key}">${btnIcon}</div>
                <div class="chevron-btn disabled">${ICONS.chevronRight}</div>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;
  }

  _htmlHijriCard() {
    return `
      <div class="hijri-card">
        <div class="hijri-icon">${ICONS.calendar}</div>
        <div>
          <div class="hijri-date" data-live="hijri-date">${this._hijriDateText()}</div>
          <div class="hijri-greg" data-live="hijri-greg">${this._gregorianDateText()}</div>
        </div>
      </div>
    `;
  }

  _htmlNowCard() {
    const next = this._nextPrayer();
    const current = this._currentPrayer();
    const cd = this._countdown();
    const currentLabel = current
      ? `${this.t("current_prayer")} · ${this.t("prayer_" + current)}`
      : this.t("current_prayer");
    const nextName = next ? this.t("prayer_" + next) : "—";

    return `
      <div class="now-card">
        <div class="now-label" data-live="current-label">${currentLabel}</div>
        <div class="now-prayer" data-live="next-name">${nextName}</div>
        <div class="now-time" data-live="next-time">${this._nextPrayerStartText()}</div>
        <div class="now-countdown">
          <div class="countdown-unit">
            <div class="countdown-num" data-live="cd-h">${cd.h}</div>
            <div class="countdown-label">${this.t("hours")}</div>
          </div>
          <div class="countdown-unit">
            <div class="countdown-num" data-live="cd-m">${cd.m}</div>
            <div class="countdown-label">${this.t("minutes")}</div>
          </div>
        </div>
      </div>
    `;
  }

  _htmlQuoteCard() {
    // TODO placeholder — quote source not yet decided (design.md open items).
    return `
      <div class="quote-card todo">
        <div class="quote-kind">
          ${ICONS.quote}
          <span>${this.t("quote_todo_eyebrow")}</span>
        </div>
        <div class="quote-text">${this.t("quote_todo_text")}</div>
      </div>
    `;
  }

  _htmlHolidayCard() {
    // TODO placeholder — Aladhan holidays endpoint not verified, explainer
    // text source not chosen (design.md open items).
    return `
      <div class="holiday-card todo">
        <div class="holiday-eyebrow">
          ${ICONS.star}
          <span>${this.t("upcoming_holiday")}</span>
        </div>
        <div class="holiday-explainer">${this.t("holiday_todo")}</div>
      </div>
    `;
  }

  _htmlOverlay() {
    if (this._activeOverlay === "method") {
      return this._htmlOverlayList(
        this.t("method_pick_title"),
        CALCULATION_METHODS.map((m) => ({
          key: m.id,
          label: m.name,
          active: m.id === this._methodId(),
        })),
        "pick-method"
      );
    }
    if (this._activeOverlay === "language") {
      return this._htmlOverlayList(
        this.t("language_pick_title"),
        LANGUAGES.map((l) => ({
          key: l.code,
          label: l.label,
          active: l.code === (this._settings?.language || "auto"),
        })),
        "pick-language"
      );
    }
    if (this._activeOverlay === "country") {
      const lang = this._effectiveLanguage();
      const current = this._settings?.country || "";
      return this._htmlOverlayList(
        this.t("country_pick_title"),
        listCountries(lang).map((c) => ({
          key: c.code,
          label: c.name,
          active: c.code === current,
        })),
        "pick-country"
      );
    }
    return "";
  }

  _htmlOverlayList(title, items, action) {
    return `
      <div class="overlay" data-action="close-overlay">
        <div class="overlay-panel" data-stop>
          <div class="overlay-header">
            <span>${title}</span>
            <button class="overlay-close" data-action="close-overlay" aria-label="${this.t("close")}">✕</button>
          </div>
          <div class="overlay-list">
            ${items.map((it) => `
              <div class="overlay-item ${it.active ? "active" : ""}" data-action="${action}" data-key="${it.key}">
                <span>${this._escape(it.label)}</span>
                ${it.active ? `<span class="overlay-check">${ICONS.check}</span>` : ""}
              </div>
            `).join("")}
          </div>
        </div>
      </div>
    `;
  }

  _escape(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  // ───── Event wiring ───────────────────────────────────────────────────────

  _handleClick(e) {
    const target = e.composedPath().find((el) => el.dataset && el.dataset.action);
    if (!target) return;
    const action = target.dataset.action;

    if (action === "toggle-prayer") {
      this._onTogglePrayer(target.dataset.prayer);
    } else if (action === "loc-device") {
      this._onLocationMode("device");
    } else if (action === "loc-manual") {
      this._onLocationMode("manual");
    } else if (action === "open-method") {
      this._openOverlay("method");
    } else if (action === "open-language") {
      this._openOverlay("language");
    } else if (action === "open-country") {
      this._openOverlay("country");
    } else if (action === "pick-method") {
      this._onPickMethod(Number(target.dataset.key));
    } else if (action === "pick-language") {
      this._onPickLanguage(target.dataset.key);
    } else if (action === "pick-country") {
      this._onPickCountry(target.dataset.key);
    } else if (action === "play-sound") {
      this._playSoundPreview(target.dataset.category);
    } else if (action === "stop-sound") {
      this._stopSoundPreview();
      this._render();
    } else if (action === "close-overlay") {
      // Close only on a real backdrop click or an explicit close-button
      // click. Clicks on inert panel whitespace still bubble up to the
      // backdrop element (which carries the close-overlay action), so we
      // distinguish by checking whether the actual click path hits the
      // close button or stays inside the panel.
      const path = e.composedPath();
      const insidePanel = path.find((el) => el.dataset && el.dataset.stop);
      const isCloseBtn = path.find(
        (el) => el.classList && el.classList.contains("overlay-close")
      );
      if (isCloseBtn || !insidePanel) {
        this._closeOverlay();
      }
    }
  }

  _attachInputListeners() {
    const root = this.shadowRoot;
    if (!root) return;
    // Text inputs save on blur, not on each keystroke, so a re-render doesn't
    // strip focus while the user is typing. These DOM nodes are fresh after
    // every innerHTML reset, so re-attaching is the right thing here (unlike
    // the delegated click handler, which lives on shadow root).
    // Country is no longer a text input — it's a dropdown — so only the
    // city field gets a blur listener.
    root.querySelectorAll("input[data-input]").forEach((input) => {
      input.addEventListener("blur", (e) => {
        const which = e.target.dataset.input;
        if (which === "city") this._onCityBlur(e.target.value);
      });
    });
  }

  // ───── CSS ────────────────────────────────────────────────────────────────

  _cssBase() {
    return `
      :host {
        display: block;
        min-height: 100%;
        background: var(--nida-bg, #0d1f1a);
        color: var(--nida-text, #f0ead6);
        font-family: 'Inter', sans-serif;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      .app {
        max-width: 1180px;
        margin: 0 auto;
        min-height: 100vh;
        background: var(--nida-bg, #0d1f1a);
        position: relative;
        overflow: hidden;
      }
      .loading-state {
        padding: 60px 24px;
        text-align: center;
        font-size: 14px;
        color: var(--nida-text-dim, #a8b5ac);
      }
      .loading-state.error { color: #ff7676; }
    `;
  }

  _css() {
    return `
      :host {
        --nida-bg: #0d1f1a;
        --nida-surface: #132920;
        --nida-surface-raised: #1a3a2c;
        --nida-gold: #c9a227;
        --nida-gold-soft: #8a7438;
        --nida-gold-bright: #e0bc4a;
        --nida-text: #f0ead6;
        --nida-text-dim: #a8b5ac;
        --nida-border: #244338;
        --nida-radius: 12px;
        display: block;
        min-height: 100%;
        background: var(--nida-bg);
        color: var(--nida-text);
        font-family: 'Inter', sans-serif;
      }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      button { font-family: inherit; cursor: pointer; }

      .app {
        max-width: 1180px;
        margin: 0 auto;
        min-height: 100vh;
        background: var(--nida-bg);
        position: relative;
        overflow: hidden;
      }

      /* 8-pointed-star lattice watermark — verbatim from design mockup */
      .pattern-overlay {
        position: absolute;
        inset: 0;
        opacity: 0.06;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="%23c9a227" stroke-width="1"><path d="M28 2 L34 14 L48 8 L42 22 L54 28 L42 34 L48 48 L34 42 L28 54 L22 42 L8 48 L14 34 L2 28 L14 22 L8 8 L22 14 Z"/></g></svg>');
        background-size: 56px 56px;
        pointer-events: none;
        z-index: 0;
      }

      .header {
        position: relative;
        z-index: 1;
        padding: 28px 20px 20px;
        border-bottom: 1px solid var(--nida-border);
      }
      .header-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .brand { display: flex; align-items: center; gap: 10px; }
      .brand-mark {
        width: 36px;
        height: 36px;
        border-radius: 9px;
        background: linear-gradient(135deg, var(--nida-surface-raised), var(--nida-surface));
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .brand-mark svg { width: 20px; height: 20px; stroke: var(--nida-gold-bright); }
      .brand-title {
        font-family: 'Cairo', sans-serif;
        font-weight: 700;
        font-size: 21px;
        letter-spacing: 0.3px;
        color: var(--nida-text);
      }
      .brand-title sup {
        font-size: 12px;
        position: relative;
        top: -0.8em;
        left: -2px;
      }
      .lang-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: 20px;
        padding: 7px 12px;
        font-size: 13px;
        color: var(--nida-text-dim);
        cursor: pointer;
      }
      .lang-pill svg { width: 14px; height: 14px; stroke: var(--nida-gold); }
      .lang-pill:hover { border-color: var(--nida-gold-soft); color: var(--nida-text); }

      .border-motif {
        height: 8px;
        margin-top: 18px;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="8" viewBox="0 0 24 8"><path d="M0 1 Q6 1 6 7 Q6 1 12 1 Q18 1 18 7 Q18 1 24 1" fill="none" stroke="%23c9a227" stroke-width="1"/></svg>');
        background-size: 24px 8px;
        background-repeat: repeat-x;
        opacity: 0.5;
      }

      .layout {
        position: relative;
        z-index: 1;
        display: grid;
        grid-template-columns: 1.3fr 1fr;
        gap: 0;
        align-items: stretch;
      }
      .col-settings {
        padding: 28px 32px 48px;
        border-right: 1px solid var(--nida-border);
      }
      /* The 69px top padding is deliberate — see design.md: it aligns the
         first companion card with the first settings card by offsetting the
         section-header label that has no companion equivalent. */
      .col-companion {
        padding: 69px 28px 48px;
        display: flex;
        flex-direction: column;
        gap: 20px;
        min-height: 100%;
      }
      .content {
        display: flex;
        flex-direction: column;
        gap: 22px;
      }

      .section-head {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 10px;
      }
      .section-icon {
        width: 30px;
        height: 30px;
        border-radius: 50%;
        background: var(--nida-surface-raised);
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .section-icon svg { width: 16px; height: 16px; stroke: var(--nida-gold-bright); }
      .section-title {
        font-family: 'Cairo', sans-serif;
        font-weight: 600;
        font-size: 15px;
        color: var(--nida-text);
      }

      .card {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        overflow: hidden;
      }

      .row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid var(--nida-border);
      }
      .row:last-child { border-bottom: none; }
      .row-label {
        font-size: 14px;
        color: var(--nida-text);
        font-weight: 500;
      }
      .row-sub {
        font-size: 12px;
        color: var(--nida-text-dim);
        margin-top: 2px;
      }

      .seg-control {
        display: flex;
        background: var(--nida-bg);
        border-radius: 9px;
        padding: 3px;
        gap: 3px;
        margin: 14px 16px;
      }
      .seg-btn {
        flex: 1;
        text-align: center;
        padding: 8px 0;
        font-size: 12.5px;
        font-weight: 500;
        color: var(--nida-text-dim);
        border-radius: 7px;
        cursor: pointer;
        user-select: none;
      }
      .seg-btn.active {
        background: var(--nida-surface-raised);
        color: var(--nida-gold-bright);
      }
      .text-field {
        margin: 0 16px 14px;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .text-field label {
        font-size: 12px;
        color: var(--nida-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .text-field input {
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 9px;
        padding: 10px 12px;
        font-size: 14px;
        color: var(--nida-text);
        font-family: inherit;
        outline: none;
      }
      .text-field input:focus { border-color: var(--nida-gold-soft); }

      .select-field {
        margin: 0 16px 16px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        border-radius: 9px;
        padding: 11px 14px;
        font-size: 14px;
        color: var(--nida-text);
        cursor: pointer;
      }
      .select-field:hover { border-color: var(--nida-gold-soft); }
      .select-value {
        color: var(--nida-gold-bright);
        font-weight: 500;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .select-value svg { width: 14px; height: 14px; stroke: var(--nida-gold); }

      .toggle {
        width: 42px;
        height: 24px;
        border-radius: 12px;
        background: var(--nida-bg);
        border: 1px solid var(--nida-border);
        position: relative;
        flex-shrink: 0;
        cursor: pointer;
      }
      .toggle.on { background: var(--nida-gold-soft); border-color: var(--nida-gold); }
      .toggle-knob {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--nida-text-dim);
        position: absolute;
        top: 2px;
        left: 2px;
        transition: left 0.15s, background 0.15s;
      }
      .toggle.on .toggle-knob { left: 21px; background: var(--nida-gold-bright); }

      .sound-row {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 14px 16px;
        border-bottom: 1px solid var(--nida-border);
      }
      .sound-row:last-child { border-bottom: none; }
      .sound-info { flex: 1; min-width: 0; }
      .sound-name {
        font-size: 14px;
        color: var(--nida-text);
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .play-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: var(--nida-surface-raised);
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
      }
      .play-btn svg { width: 14px; height: 14px; fill: var(--nida-gold-bright); stroke: none; }
      .play-btn.playing {
        background: var(--nida-gold);
        border-color: var(--nida-gold-bright);
      }
      .play-btn.playing svg { fill: var(--nida-bg); }
      .play-btn.disabled,
      .chevron-btn.disabled { opacity: 0.4; cursor: not-allowed; }
      .chevron-btn {
        width: 34px;
        height: 34px;
        border-radius: 50%;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
        cursor: pointer;
      }
      .chevron-btn svg { width: 16px; height: 16px; stroke: var(--nida-text-dim); }

      /* Companion cards */
      .hijri-card {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        padding: 16px 18px;
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .hijri-icon {
        width: 38px;
        height: 38px;
        border-radius: 9px;
        background: var(--nida-surface-raised);
        border: 1px solid var(--nida-gold-soft);
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
      }
      .hijri-icon svg { width: 18px; height: 18px; stroke: var(--nida-gold-bright); }
      .hijri-date {
        font-family: 'Cairo', sans-serif;
        font-weight: 600;
        font-size: 15px;
        color: var(--nida-text);
      }
      .hijri-greg {
        font-size: 12px;
        color: var(--nida-text-dim);
        margin-top: 1px;
      }

      .now-card {
        background: linear-gradient(160deg, var(--nida-surface-raised), var(--nida-surface));
        border: 1px solid var(--nida-gold-soft);
        border-radius: var(--nida-radius);
        padding: 22px 20px;
        text-align: center;
        position: relative;
        overflow: hidden;
      }
      .now-card::before {
        content: "";
        position: absolute;
        inset: 0;
        opacity: 0.08;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56"><g fill="none" stroke="%23e0bc4a" stroke-width="1"><path d="M28 2 L34 14 L48 8 L42 22 L54 28 L42 34 L48 48 L34 42 L28 54 L22 42 L8 48 L14 34 L2 28 L14 22 L8 8 L22 14 Z"/></g></svg>');
        background-size: 56px 56px;
        pointer-events: none;
      }
      .now-label {
        position: relative;
        font-size: 12px;
        color: var(--nida-gold);
        text-transform: uppercase;
        letter-spacing: 1px;
        font-weight: 600;
      }
      .now-prayer {
        position: relative;
        font-family: 'Cairo', sans-serif;
        font-weight: 700;
        font-size: 30px;
        color: var(--nida-text);
        margin: 6px 0 2px;
      }
      .now-time {
        position: relative;
        font-size: 14px;
        color: var(--nida-text-dim);
      }
      .now-countdown {
        position: relative;
        margin-top: 16px;
        padding-top: 14px;
        border-top: 1px solid var(--nida-border);
        display: flex;
        justify-content: center;
        gap: 18px;
      }
      .countdown-unit { text-align: center; }
      .countdown-num {
        font-family: 'Cairo', sans-serif;
        font-weight: 700;
        font-size: 22px;
        color: var(--nida-gold-bright);
      }
      .countdown-label {
        font-size: 10.5px;
        color: var(--nida-text-dim);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .quote-card, .holiday-card {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        padding: 18px 20px;
      }
      .quote-card.todo, .holiday-card.todo {
        border-style: dashed;
        opacity: 0.85;
      }
      .quote-kind, .holiday-eyebrow {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 11px;
        color: var(--nida-gold);
        text-transform: uppercase;
        letter-spacing: 0.8px;
        font-weight: 600;
        margin-bottom: 8px;
      }
      .quote-kind svg, .holiday-eyebrow svg {
        width: 13px;
        height: 13px;
        stroke: var(--nida-gold);
      }
      .quote-text, .holiday-explainer {
        font-size: 13px;
        line-height: 1.6;
        color: var(--nida-text-dim);
        font-style: italic;
      }
      .holiday-explainer { font-style: normal; }

      .footer-note {
        position: relative;
        z-index: 1;
        text-align: center;
        font-size: 12px;
        color: var(--nida-text-dim);
        padding: 0 32px 32px;
      }

      /* Overlay (method picker, language picker) */
      .overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 100;
        padding: 20px;
      }
      .overlay-panel {
        background: var(--nida-surface);
        border: 1px solid var(--nida-border);
        border-radius: var(--nida-radius);
        width: 100%;
        max-width: 460px;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        overflow: hidden;
      }
      .overlay-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 16px 18px;
        border-bottom: 1px solid var(--nida-border);
        font-family: 'Cairo', sans-serif;
        font-weight: 600;
        font-size: 15px;
        color: var(--nida-text);
      }
      .overlay-close {
        background: transparent;
        border: none;
        color: var(--nida-text-dim);
        font-size: 16px;
        line-height: 1;
        padding: 4px 8px;
      }
      .overlay-close:hover { color: var(--nida-text); }
      .overlay-list {
        overflow-y: auto;
        flex: 1;
      }
      .overlay-item {
        padding: 12px 18px;
        font-size: 14px;
        color: var(--nida-text);
        border-bottom: 1px solid var(--nida-border);
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
      }
      .overlay-item:last-child { border-bottom: none; }
      .overlay-item:hover { background: var(--nida-surface-raised); }
      .overlay-item.active { color: var(--nida-gold-bright); }
      .overlay-check svg {
        width: 16px;
        height: 16px;
        stroke: var(--nida-gold-bright);
      }

      /* Mobile / narrow — single column.
         Open per design.md: where the companion column lands in narrow
         viewports was not yet decided. Default for now: stack companion
         below settings, full width. Revisit when mobile design is locked. */
      @media (max-width: 900px) {
        .layout {
          grid-template-columns: 1fr;
        }
        .col-settings {
          border-right: none;
          border-bottom: 1px solid var(--nida-border);
          padding: 24px 20px 32px;
        }
        .col-companion {
          padding: 28px 20px 32px;
        }
      }
    `;
  }
}

customElements.define("nida-panel", NidaPanel);

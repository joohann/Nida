/**
 * Nida dashboard card — Lovelace custom card (type: custom:nida-card).
 *
 * Two variants, picked via the `card_type` config option ("now" | "today"),
 * matching the Nida Android app's "Next Prayer" and "Today" widgets:
 *   - now:   next prayer name + live HH:MM:SS countdown, last-prayer
 *            sub-line, and a tap-to-toggle silent-mode mute button.
 *   - today: all five prayers for today, next one highlighted, past ones
 *            checked off, footer showing when times were last refreshed.
 *
 * Deliberately a SEPARATE, self-contained file from nida-panel.js rather
 * than sharing code with it: a Lovelace card is a different custom
 * element loaded independently of the sidebar panel (and works even when
 * the panel itself is disabled — see panel.py's async_register_card),
 * so it carries its own trimmed copy of the theme palette, the handful
 * of icons it needs, and English/Dutch strings rather than pulling in
 * nida-panel.js's full i18n dictionary and CSS system.
 *
 * Data source: reads sensor.nida_<prayer> / sensor.nida_hijri_* states
 * directly off `hass.states` — no websocket calls needed for that part,
 * so both cards work immediately with just `hass` and no config entry
 * lookup. The mute button is the one interactive piece and DOES need the
 * Nida config entry (to read/write guest_mode_* via the same
 * nida/get_settings + nida/update_settings commands the panel uses) —
 * resolved once via config_entries/get on first hass set, cached after.
 * If that resolution fails for any reason the card still renders fine;
 * only the mute button becomes inert.
 *
 * Theme: follows the HA dashboard's own dark/light state
 * (hass.themes.darkMode), not the Nida panel's own theme setting — the
 * card should look at home next to the rest of the user's dashboard.
 *
 * Changelog:
 *   2.2.2  (2026-07-12): No functional changes in this file. The
 *                        Mac-shortcut duck feature (a sub-toggle under
 *                        "Duck media players" that notifies a user-built
 *                        macOS Shortcuts automation to mute/unmute a Mac's
 *                        own local audio, since no media_player entity can
 *                        do that directly) is panel-settings-only — see
 *                        nida-panel.js's own changelog. NIDA_CARD_VERSION
 *                        bumped to stay in lockstep with manifest.json.
 *   2.2.1  (2026-07-12): No functional changes in this file. Catching up
 *                        a version-lockstep gap: nida-panel.js and
 *                        manifest.json had already moved to 2.2.0 (the
 *                        Ramadan Edition layout) while this file stayed
 *                        at 2.1.42. Also covers services.py's duck-media
 *                        mute/volume-zero fallback fix — see that file's
 *                        own changelog. NIDA_CARD_VERSION bumped to
 *                        2.2.1 to realign with the other two.
 *   2.1.42 (2026-07-11): No functional changes in this file. nida-panel.js
 *                        restyled its calendar month-grid's "today" cell
 *                        to match the Today card's "next prayer" pill
 *                        (light green fill + border instead of solid
 *                        dark-green + white text) — this Lovelace card
 *                        has no calendar month-grid of its own.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.41 (2026-07-11): Today card's footer ("🔄 Last updated HH:MM")
 *                        centered (was left-aligned) and made more
 *                        subtle — smaller (10px, was 11px) and at 65%
 *                        opacity — per Johann's screenshot of the Today
 *                        card asking for it centered and less
 *                        attention-grabbing. Same change applied to
 *                        nida-panel.js's own Today card footer.
 *   2.1.40 (2026-07-11): The 2.1.39 "visitors mode" control was a green
 *                        pill (background + uppercase) — Johann sent a
 *                        screenshot asking for plain text matching LAST
 *                        PRAYER's style instead ("vistors mode wil ik
 *                        gelijk aan tekst als 'last pray' en niet een
 *                        pil"). .mute-btn-text dropped its background/
 *                        border-radius/padding/uppercase and now uses
 *                        the same size/weight/letter-spacing/color as
 *                        .now-sub, only shifting to the accent color
 *                        while active (no shape change). Also fixed
 *                        nida-panel.js's own now-card, which had the
 *                        same unaligned layout and hadn't been touched
 *                        yet (Johann: "ja de kaart heb je gedaan maar
 *                        niet paneel") — see that file's own changelog.
 *   2.1.39 (2026-07-11): Now-card ("Next prayer") row layout redone on
 *                        Johann's request — an annotated screenshot with
 *                        three colored guide lines showed REMAINING not
 *                        sharing a baseline with NEXT PRAYER, the
 *                        countdown not sharing one with the prayer name,
 *                        and the mute icon not sharing one with LAST
 *                        PRAYER. Replaced the old two-column (now-left /
 *                        now-right) layout with three explicit flex rows
 *                        (now-line-eyebrows / now-line-main /
 *                        now-line-foot), each a justify-content:
 *                        space-between pair — guarantees the pairs sit on
 *                        a shared line regardless of content height.
 *                        Also swapped the mute button's speaker/mute SVG
 *                        icon for a small text pill reading the new
 *                        "visitors_mode" string ("Visitors mode" /
 *                        "Bezoekersmodus"), sitting in the footer row
 *                        next to "LAST PRAYER · ...". Toggle behavior,
 *                        the silent-mode duration menu, and active-state
 *                        styling (now a filled pill instead of a glyph
 *                        swap) are unchanged. NIDA_CARD_VERSION bumped;
 *                        no changes needed in nida-panel.js for this one.
 *   2.1.38 (2026-07-11): No functional changes in this file. nida-panel.js
 *                        precisely right-aligned the countdown-to-Ramadan
 *                        header pill with the Today/Now cards' right edge
 *                        (header row now mirrors .layout's grid columns).
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.37 (2026-07-11): No functional changes in this file. nida-panel.js
 *                        moved the countdown-to-Ramadan header pill next
 *                        to the "Nida" title (left side) instead of the
 *                        theme/language pill group (right side).
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.36 (2026-07-11): No functional changes in this file. nida-panel.js
 *                        got a bugfix for a loading-state hang caused by
 *                        the 2.1.35 countdown-to-Ramadan pill (missing
 *                        in-flight guard on _loadCalendarMonth).
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.35 (2026-07-11): No functional changes in this file. nida-panel.js
 *                        gained a countdown-to-Ramadan header pill and a
 *                        Fajr wake-up alarm (scene + light transition +
 *                        independent wake sound). NIDA_CARD_VERSION
 *                        bumped to stay in lockstep with manifest.json.
 *   2.1.34 (2026-07-11): No functional changes in this file. nida-panel.js
 *                        gained four new Ramadan features (Suhoor/Iftar
 *                        reminders, Iftar auto-dua, Laylatul Qadr, and a
 *                        "Day X of Y" Ramadan counter on the Today card).
 *                        NIDA_CARD_VERSION bumped to stay in lockstep with
 *                        manifest.json.
 *   2.1.33 (2026-07-10): No functional changes in this file. nida-panel.js
 *                        now has full RTL layout mirroring (not just text
 *                        direction) and a tablet fix for settings rows
 *                        stretching edge-to-edge. NIDA_CARD_VERSION bumped
 *                        to stay in lockstep with manifest.json.
 *   2.1.32 (2026-07-10): No functional changes in this file. nida-panel.js
 *                        now has all ten supported languages fully
 *                        translated (German, French, Malay, Indonesian,
 *                        Urdu, Farsi added) plus RTL dir support for
 *                        Urdu/Farsi alongside Arabic. NIDA_CARD_VERSION
 *                        bumped to stay in lockstep with manifest.json.
 *   2.1.31 (2026-07-10): No functional changes in this file. nida-panel.js
 *                        now has full Arabic + Turkish translations and
 *                        RTL dir support. NIDA_CARD_VERSION bumped to stay
 *                        in lockstep with manifest.json.
 *   2.1.30 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.29 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.28 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.27 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.26 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.25 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.24 (2026-07-09): No functional changes in this file.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep
 *                        with manifest.json.
 *   2.1.22 (2026-07-09): No functional changes in this file. Now served
 *                        with a ?v=<manifest version> cache-busting query
 *                        param (see panel.py) so it stops being served
 *                        stale on long-running tablet/kiosk browsers.
 *                        NIDA_CARD_VERSION bumped to stay in lockstep.
 *   2.1.21 (2026-07-09): Mute button on the "now" card is now a duration
 *                        picker (1/2/3/4/6/8/12/24h + "until off" +
 *                        "turn off" when active) instead of a plain
 *                        on/off toggle — same duration set as the
 *                        panel's own silent-mode popup, opened as a
 *                        small menu anchored under the button instead of
 *                        a full overlay so it stays compact in a
 *                        dashboard card. Closes on an outside click.
 *   2.1.20 (2026-07-08): New file. Johann asked for Nida dashboard cards
 *                        matching the Android app's Next Prayer / Today
 *                        widgets (screenshots supplied). Registered as a
 *                        global Lovelace resource by panel.py's new
 *                        async_register_card() so no manual resource-add
 *                        is needed. Basic ha-form config editor
 *                        (NidaCardEditor) so card_type is pickable from
 *                        the dashboard UI, not just YAML.
 */

const NIDA_CARD_VERSION = "2.3.13";

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
const PRAYER_ICON_KEY = { fajr: "sunrise", dhuhr: "sun", asr: "sunHigh", maghrib: "sunset", isha: "moon" };

// Trimmed copy of the icons nida-panel.js's ICONS set carries for these
// two cards only — same stroke style (1.6-1.8, round caps) so it reads
// as the same visual family as the panel and the Android app.
const ICONS = {
  checkCircle: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12l2.6 2.6L16 9"/></svg>`,
  sunrise: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M8 18a4 4 0 018 0"/><path d="M12 5.5v2"/><path d="M6 12l1.4 1.4"/><path d="M18 12l-1.4 1.4"/><path d="M10.5 8L12 6.5 13.5 8"/></svg>`,
  sun: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2"/><path d="M6 6l1.4 1.4M16.6 16.6L18 18M18 6l-1.4 1.4M7.4 16.6L6 18"/></svg>`,
  sunHigh: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10.5" cy="11" r="3.2"/><path d="M10.5 4.5v1.6M4.7 11H6.3M6.4 6.9l1.1 1.1"/><path d="M13 17.5h5.2a2.4 2.4 0 000-4.8 3.2 3.2 0 00-6-1"/></svg>`,
  sunset: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18h18"/><path d="M8 18a4 4 0 018 0"/><path d="M12 8V6"/><path d="M6 12l1.4 1.4"/><path d="M18 12l-1.4 1.4"/><path d="M10.5 6L12 7.5 13.5 6"/></svg>`,
  moon: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.5 14.2A8.2 8.2 0 1110 3.6a6.4 6.4 0 1010.5 10.6z"/><path d="M17 5.5l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5z"/></svg>`,
  refresh: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  mute: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M23 9l-6 6M17 9l6 6"/></svg>`,
  speaker: `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 8a5 5 0 010 8"/></svg>`,
};

// Colour tokens, trimmed from nida-panel.js's :host / :host(.theme-light)
// blocks — only the values these two cards actually use.
const THEMES = {
  dark: {
    bg: "#111D39",
    surfaceRaised: "#18254A",
    text: "#F8F8FA",
    textDim: "#B9BED4",
    border: "#232A45",
    accent: "#F6C24A",
    accentGlow: "rgba(246, 194, 74, 0.22)",
    iconStroke: "#7C5CFF",
    cardShadow: "none",
    radius: "20px",
    pillRadius: "12px",
    displayFont: "'Cairo', sans-serif",
  },
  light: {
    bg: "#FFFFFF",
    surfaceRaised: "#DDE8CF",
    text: "#243024",
    textDim: "#6D7568",
    border: "#E7EBD9",
    accent: "#4E6E3B",
    accentGlow: "rgba(78, 110, 59, 0.16)",
    iconStroke: "#5B7F46",
    cardShadow: "0 4px 18px rgba(0, 0, 0, 0.06)",
    radius: "24px",
    pillRadius: "12px",
    displayFont: "'Manrope', 'Inter', sans-serif",
  },
};

const STRINGS = {
  en: {
    today: "Today",
    next_prayer: "Next prayer",
    remaining: "Remaining",
    last_prayer: "Last prayer",
    last_updated: "Last updated",
    silent_mode: "Silent mode",
    visitors_mode: "Visitors mode",
    silent_mode_until_off: "Until off",
    silent_mode_turn_off: "Turn off",
    silent_mode_active_until: "Muted until",
    silent_mode_active_manual: "Muted until you turn it off",
    hours_unit: "h",
    unavailable: "Nida sensors not available yet",
    prayer_fajr: "Fajr",
    prayer_dhuhr: "Dhuhr",
    prayer_asr: "Asr",
    prayer_maghrib: "Maghrib",
    prayer_isha: "Isha",
    editor_card_type: "Card",
    editor_card_type_now: "Next prayer",
    editor_card_type_today: "Today",
  },
  nl: {
    today: "Vandaag",
    next_prayer: "Volgend gebed",
    remaining: "Resterend",
    last_prayer: "Laatste gebed",
    last_updated: "Laatst bijgewerkt",
    silent_mode: "Stille modus",
    visitors_mode: "Bezoekersmodus",
    silent_mode_until_off: "Tot uit",
    silent_mode_turn_off: "Uitzetten",
    silent_mode_active_until: "Gedempt tot",
    silent_mode_active_manual: "Gedempt tot je het uitzet",
    hours_unit: "uur",
    unavailable: "Nida-sensoren nog niet beschikbaar",
    prayer_fajr: "Fajr",
    prayer_dhuhr: "Dhuhr",
    prayer_asr: "Asr",
    prayer_maghrib: "Maghrib",
    prayer_isha: "Isha",
    editor_card_type: "Kaart",
    editor_card_type_now: "Volgend gebed",
    editor_card_type_today: "Vandaag",
  },
};

// 2.1.9-style "auto" — silent-mode-forever sentinel, matches
// nida-panel.js's GUEST_HOURS_INF (guest_mode_hours=25 means "until
// manually turned off", i.e. no guest_mode_until date at all).
const GUEST_HOURS_INF = 25;

// Same discrete duration set as nida-panel.js's silent-mode popup
// (_htmlOverlaySilentMode's durationOptions) — kept identical so the
// two surfaces offer the same choices.
const SILENT_MODE_HOURS = [1, 2, 3, 4, 6, 8, 12, 24];

class NidaCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = { card_type: "now" };
    this._entryId = null;
    this._settings = null;
    this._entryLookupStarted = false;
    this._silentMenuOpen = false;
    this._onDocClick = (e) => {
      if (!this._silentMenuOpen) return;
      const wrap = this.shadowRoot.querySelector(".mute-wrap");
      if (wrap && !e.composedPath().includes(wrap)) {
        this._silentMenuOpen = false;
        this._render();
      }
    };
  }

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("nida-card: invalid configuration");
    }
    this._config = { card_type: "now", ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._entryLookupStarted) {
      this._entryLookupStarted = true;
      this._resolveEntry();
    }
    this._render();
  }

  get hass() {
    return this._hass;
  }

  connectedCallback() {
    this._startTick();
    document.addEventListener("click", this._onDocClick, true);
  }

  disconnectedCallback() {
    this._stopTick();
    document.removeEventListener("click", this._onDocClick, true);
  }

  getCardSize() {
    return this._config?.card_type === "today" ? 5 : 2;
  }

  static getConfigElement() {
    return document.createElement("nida-card-editor");
  }

  static getStubConfig() {
    return { card_type: "now" };
  }

  // ───── data ───────────────────────────────────────────────────────────

  async _resolveEntry() {
    // Only needed for the mute button (guest_mode_* lives in the config
    // entry's options, not on any sensor). Failures here are swallowed —
    // both card variants still render fully from sensor states either
    // way; only the mute button silently becomes a no-op.
    if (!this._hass) return;
    try {
      const entries = await this._hass.callWS({ type: "config_entries/get", domain: "nida" });
      this._entryId = entries && entries.length ? entries[0].entry_id : null;
      if (this._entryId) {
        this._settings = await this._hass.callWS({
          type: "nida/get_settings",
          entry_id: this._entryId,
        });
        this._render();
      }
    } catch (e) {
      // Best-effort — see comment above.
    }
  }

  _lang() {
    const raw = this._hass?.language || this._hass?.locale?.language || "en";
    const l = String(raw).slice(0, 2).toLowerCase();
    return STRINGS[l] ? l : "en";
  }

  _t(key) {
    return STRINGS[this._lang()][key] ?? STRINGS.en[key] ?? key;
  }

  _darkMode() {
    // 2.1.9-style: follow HA's own resolved dark/light state, not the OS
    // media query and not the Nida panel's own theme setting — see the
    // file header for why the card intentionally diverges from the
    // panel here (Johann's choice when asked).
    return !!this._hass?.themes?.darkMode;
  }

  _theme() {
    return this._darkMode() ? THEMES.dark : THEMES.light;
  }

  _sensorState(id) {
    return this._hass?.states?.[`sensor.nida_${id}`];
  }

  _prayerSchedule() {
    // Mirrors nida-panel.js's _prayerSchedule(): sorted by actual clock
    // time (not the fixed Fajr..Isha order) so the midnight-boundary
    // "Isha before Fajr" high-latitude-summer case resolves next/current
    // correctly. Display order for the Today card is handled separately
    // (see _htmlToday) — this is only used to compute next/current.
    const list = [];
    for (const p of PRAYERS) {
      const s = this._sensorState(p);
      const raw = s?.state;
      if (!raw || raw === "unknown" || raw === "unavailable") continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) continue;
      list.push({ prayer: p, date: d });
    }
    list.sort((a, b) => a.date - b.date);
    return list;
  }

  _nextInfo() {
    const sched = this._prayerSchedule();
    if (sched.length === 0) return null;
    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    let idx = sched.findIndex((e) => e.date.getTime() > now);
    let nextDate;
    if (idx === -1) {
      idx = 0;
      nextDate = new Date(sched[0].date.getTime() + DAY);
    } else {
      nextDate = sched[idx].date;
    }
    const cur = (idx - 1 + sched.length) % sched.length;
    return { next: sched[idx].prayer, current: sched[cur].prayer, nextDate, schedule: sched };
  }

  _fmtHHMM(d) {
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  _hijriText() {
    const day = this._sensorState("hijri_day")?.state;
    const month = this._sensorState("hijri_month")?.state;
    const year = this._sensorState("hijri_year")?.state;
    if (!day || !month || !year || day === "unknown" || day === "unavailable") return "";
    return `${day} ${month} ${year}`;
  }

  _lastUpdatedText() {
    let newest = null;
    for (const p of PRAYERS) {
      const s = this._sensorState(p);
      const lu = s?.last_updated ? new Date(s.last_updated) : null;
      if (lu && !isNaN(lu) && (!newest || lu > newest)) newest = lu;
    }
    return newest ? this._fmtHHMM(newest) : "—";
  }

  _guestModeActive() {
    if (!this._settings?.guest_mode_enabled) return false;
    const raw = this._settings.guest_mode_until;
    if (!raw) return true; // no expiry set = on until manually turned off
    const d = new Date(raw);
    return isNaN(d.getTime()) ? true : d.getTime() > Date.now();
  }

  _toggleSilentMenu() {
    if (!this._entryId) return;
    this._silentMenuOpen = !this._silentMenuOpen;
    this._render();
  }

  _guestModeUntilDate() {
    const raw = this._settings?.guest_mode_until;
    if (!raw) return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }

  async _setSilentMode(choice) {
    // choice: "0" = turn off, "inf" = on until manually turned off,
    // otherwise a whole-hours duration string — same three shapes the
    // panel's own silent-mode popup writes, kept identical so both
    // surfaces agree on the resulting guest_mode_* settings.
    if (!this._entryId || !this._hass) return;
    this._silentMenuOpen = false;
    let patch;
    if (choice === "0") {
      patch = { guest_mode_enabled: false, guest_mode_until: null };
    } else if (choice === "inf") {
      patch = { guest_mode_enabled: true, guest_mode_hours: GUEST_HOURS_INF, guest_mode_until: null };
    } else {
      const hours = Math.max(1, Math.min(GUEST_HOURS_INF, parseInt(choice, 10) || 1));
      const until = new Date(Date.now() + hours * 3600 * 1000).toISOString();
      patch = { guest_mode_enabled: true, guest_mode_hours: hours, guest_mode_until: until };
    }
    this._settings = { ...(this._settings || {}), ...patch };
    this._render();
    try {
      await this._hass.callWS({
        type: "nida/update_settings",
        entry_id: this._entryId,
        options: this._settings,
      });
    } catch (e) {
      // Best-effort; a stale toggle state is a minor annoyance, not
      // worth surfacing an error UI for in a compact card.
    }
  }

  // ───── render ─────────────────────────────────────────────────────────

  _startTick() {
    if (this._tickInterval) return;
    // 1s so the "now" card's HH:MM:SS countdown advances live, matching
    // the panel's own now-card cadence.
    this._tickInterval = setInterval(() => this._render(), 1000);
  }

  _stopTick() {
    if (this._tickInterval) {
      clearInterval(this._tickInterval);
      this._tickInterval = null;
    }
  }

  _render() {
    if (!this.shadowRoot) return;
    const theme = this._theme();
    const type = this._config?.card_type === "today" ? "today" : "now";
    const info = this._nextInfo();
    this.shadowRoot.innerHTML = `
      <style>${this._css(theme)}</style>
      <div class="nida-card-root">
        ${info
          ? (type === "today" ? this._htmlToday(info) : this._htmlNow(info))
          : `<div class="empty">${this._t("unavailable")}</div>`}
      </div>
    `;
    const muteBtn = this.shadowRoot.querySelector('[data-action="toggle-silent-menu"]');
    if (muteBtn) {
      muteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleSilentMenu();
      });
    }
    this.shadowRoot.querySelectorAll('[data-action="set-silent"]').forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._setSilentMode(btn.dataset.choice);
      });
    });
  }

  _htmlNow(info) {
    const { next, current, nextDate } = info;
    let diff = nextDate.getTime() - Date.now();
    if (diff < 0) diff = 0;
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    const active = this._guestModeActive();
    // 2.1.39 — three explicit rows (eyebrows / name+countdown / footer)
    // instead of two flex columns, so each left/right pair sits on its
    // own guaranteed-shared baseline: NEXT PRAYER with REMAINING, the
    // prayer name with the countdown, and LAST PRAYER with the
    // visitors-mode button. Requested via an annotated screenshot with
    // guide lines across all three pairs.
    return `
      <div class="now-row">
        <div class="now-line now-line-eyebrows">
          <span class="eyebrow">${this._t("next_prayer")}</span>
          <span class="eyebrow now-eyebrow-right">${this._t("remaining")}</span>
        </div>
        <div class="now-line now-line-main">
          <span class="now-name">${this._t("prayer_" + next)}</span>
          <span class="now-countdown">${h}:${m}:${s}</span>
        </div>
        <div class="now-line now-line-foot">
          <span class="now-sub">${current
            ? `${this._t("last_prayer")} · ${this._t("prayer_" + current).toUpperCase()}`
            : ""}</span>
          <div class="mute-wrap">
            <button class="mute-btn-text ${active ? "active" : ""}"
                    data-action="toggle-silent-menu"
                    title="${this._t("visitors_mode")}"
                    aria-label="${this._t("visitors_mode")}"
                    ${this._entryId ? "" : "disabled"}>
              ${this._t("visitors_mode")}
            </button>
            ${this._silentMenuOpen ? this._htmlSilentMenu(active) : ""}
          </div>
        </div>
      </div>
    `;
  }

  _htmlSilentMenu(active) {
    const until = this._guestModeUntilDate();
    const statusText = active
      ? (until
          ? `${this._t("silent_mode_active_until")} ${this._fmtHHMM(until)}`
          : this._t("silent_mode_active_manual"))
      : "";
    return `
      <div class="silent-menu" data-stop>
        ${statusText ? `<div class="silent-menu-status">${statusText}</div>` : ""}
        <div class="silent-menu-options">
          ${SILENT_MODE_HOURS.map((h) => `
            <button class="silent-opt" data-action="set-silent" data-choice="${h}">
              ${h}${this._t("hours_unit")}
            </button>
          `).join("")}
          <button class="silent-opt" data-action="set-silent" data-choice="inf">
            ${this._t("silent_mode_until_off")}
          </button>
        </div>
        ${active ? `
          <button class="silent-opt silent-opt-off" data-action="set-silent" data-choice="0">
            ${this._t("silent_mode_turn_off")}
          </button>
        ` : ""}
      </div>
    `;
  }

  _htmlToday(info) {
    const { next, schedule } = info;
    const now = Date.now();
    const byPrayer = new Map(schedule.map((e) => [e.prayer, e.date]));
    const rows = PRAYERS.map((prayer) => {
      const date = byPrayer.get(prayer);
      if (!date) return "";
      const isNext = prayer === next;
      const isPast = !isNext && date.getTime() < now;
      const glyphKey = PRAYER_ICON_KEY[prayer];
      const icon = isPast ? ICONS.checkCircle : ICONS[glyphKey];
      const time = this._fmtHHMM(date);
      if (isNext) {
        let diff = date.getTime() - now;
        if (diff < 0) diff = 0;
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        // 2.3.2 — inside the last minute h and m are both 0, so this
        // used to sit frozen on "0 h 0 m" right when the countdown
        // matters most. Below one minute it counts seconds down to 0;
        // above it the h/m form stays so the row isn't repainting every
        // second all day. Same rule as the panel's _todayRemainingText.
        const remaining = (h === 0 && m === 0)
          ? `${Math.floor(diff / 1000)} s`
          : `${h} h ${m} m`;
        return `
          <div class="today-row next">
            <span class="today-icon">${icon}</span>
            <span class="today-name">${this._t("prayer_" + prayer)}</span>
            <span class="today-remaining">${remaining}</span>
            <span class="today-time">${time}</span>
          </div>`;
      }
      return `
        <div class="today-row ${isPast ? "past" : ""}">
          <span class="today-icon">${icon}</span>
          <span class="today-name">${this._t("prayer_" + prayer)}</span>
          <span class="today-time">${time}</span>
        </div>`;
    }).join("");

    return `
      <div class="today-head">
        <span class="today-title">${this._t("today")}</span>
        <span class="today-hijri">${this._hijriText()}</span>
      </div>
      <div class="today-list">${rows}</div>
      <div class="today-foot">
        <span class="refresh-ico">${ICONS.refresh}</span>
        ${this._t("last_updated")} ${this._lastUpdatedText()}
      </div>
    `;
  }

  _css(t) {
    return `
      :host { display: block; }
      * { box-sizing: border-box; }
      .nida-card-root {
        font-family: 'Inter', sans-serif;
        background: ${t.bg};
        color: ${t.text};
        border-radius: ${t.radius};
        box-shadow: ${t.cardShadow};
        border: 1px solid ${t.border};
        padding: 20px 22px 16px;
      }
      .empty {
        font-size: 13px;
        color: ${t.textDim};
        padding: 12px 2px;
        text-align: center;
      }
      .eyebrow {
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: ${t.textDim};
      }

      /* ── now card ── */
      .now-row {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      .now-line {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        gap: 12px;
      }
      .now-line-foot { align-items: center; }
      .now-eyebrow-right { text-align: right; }
      .now-name {
        font-family: ${t.displayFont};
        font-weight: 700;
        font-size: 30px;
        line-height: 1.15;
        color: ${t.text};
      }
      .now-sub {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: ${t.textDim};
      }
      .now-countdown {
        font-family: ${t.displayFont};
        font-weight: 700;
        font-size: 26px;
        color: ${t.accent};
        font-variant-numeric: tabular-nums;
      }
      .mute-wrap { position: relative; }
      .mute-btn-text {
        display: inline-flex;
        align-items: center;
        background: none;
        border: none;
        padding: 0;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.06em;
        color: ${t.textDim};
        white-space: nowrap;
        cursor: pointer;
      }
      .mute-btn-text[disabled] { opacity: 0.4; cursor: default; }
      .mute-btn-text.active { color: ${t.accent}; }
      .mute-btn-text:hover:not([disabled]) { color: ${t.accent}; }
      .silent-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        z-index: 10;
        min-width: 168px;
        background: ${t.bg};
        border: 1px solid ${t.border};
        border-radius: 14px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        padding: 10px;
      }
      .silent-menu-status {
        font-size: 11px;
        color: ${t.textDim};
        margin-bottom: 8px;
        padding: 0 2px;
      }
      .silent-menu-options {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 6px;
      }
      .silent-opt {
        border: 1px solid ${t.border};
        background: ${t.surfaceRaised};
        color: ${t.text};
        border-radius: 8px;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 4px;
        cursor: pointer;
      }
      .silent-opt:hover { border-color: ${t.accent}; }
      .silent-opt-off {
        width: 100%;
        margin-top: 8px;
        color: ${t.accent};
        font-weight: 700;
      }

      /* ── today card ── */
      .today-head {
        display: flex;
        justify-content: space-between;
        align-items: baseline;
        margin-bottom: 10px;
      }
      .today-title {
        font-family: ${t.displayFont};
        font-weight: 700;
        font-size: 18px;
        color: ${t.text};
      }
      .today-hijri { font-size: 12px; color: ${t.textDim}; }
      .today-list { display: flex; flex-direction: column; }
      .today-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 9px 4px;
        border-bottom: 1px solid ${t.border};
        font-size: 14px;
        color: ${t.text};
      }
      .today-row:last-child { border-bottom: none; }
      .today-row.past { color: ${t.textDim}; }
      .today-row.past .today-icon { color: ${t.accent}; }
      .today-icon {
        display: inline-flex;
        width: 22px;
        height: 22px;
        flex-shrink: 0;
        color: ${t.iconStroke};
      }
      .today-icon svg { width: 100%; height: 100%; stroke: currentColor; }
      .today-name { font-weight: 600; flex: 1; }
      .today-time { font-weight: 700; }
      .today-row.next {
        background: ${t.surfaceRaised};
        border: 1px solid ${t.accent};
        border-radius: ${t.pillRadius};
        box-shadow: 0 0 16px ${t.accentGlow};
        padding: 10px 12px;
        margin: 2px 0;
        color: ${t.accent};
      }
      .today-row.next .today-icon { color: ${t.accent}; }
      .today-row.next .today-name { font-weight: 700; }
      .today-remaining { font-size: 12px; color: ${t.textDim}; margin-right: 6px; }
      .today-foot {
        margin-top: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        font-size: 10px;
        color: ${t.textDim};
        opacity: 0.4;
      }
      .refresh-ico { display: inline-flex; width: 12px; height: 12px; }
      .refresh-ico svg { width: 100%; height: 100%; stroke: currentColor; }
    `;
  }
}

class NidaCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || { card_type: "now" };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  _lang() {
    const raw = this._hass?.language || this._hass?.locale?.language || "en";
    const l = String(raw).slice(0, 2).toLowerCase();
    return STRINGS[l] ? l : "en";
  }

  _render() {
    if (!this._hass) return;
    this.innerHTML = "";
    // ha-form is a core HA frontend component, always available once the
    // dashboard editor is open — using it here (rather than a hand-built
    // <select>) gets consistent styling with every other card editor for
    // free. Falls back to nothing (YAML-only editing still works) if for
    // some reason it isn't defined.
    if (!customElements.get("ha-form")) return;
    const t = STRINGS[this._lang()];
    const form = document.createElement("ha-form");
    form.hass = this._hass;
    form.data = this._config;
    form.schema = [
      {
        name: "card_type",
        selector: {
          select: {
            options: [
              { value: "now", label: t.editor_card_type_now },
              { value: "today", label: t.editor_card_type_today },
            ],
          },
        },
      },
    ];
    form.computeLabel = (schema) =>
      schema.name === "card_type" ? t.editor_card_type : schema.name;
    form.addEventListener("value-changed", (ev) => {
      this._config = ev.detail.value;
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: this._config },
          bubbles: true,
          composed: true,
        })
      );
    });
    this.appendChild(form);
  }
}

customElements.define("nida-card", NidaCard);
customElements.define("nida-card-editor", NidaCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "nida-card",
  name: "Nida",
  description: "Next prayer countdown or today's full prayer schedule.",
  preview: true,
});

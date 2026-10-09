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
 *   2.7.8  (2026-10-07): Moon rocks around the point where it rests on the cloud, so
 *                        the moon/cloud seam hardly moves (a 15%-larger cloud was
 *                        tried first and dropped: its box edges showed).
 *   2.7.7  (2026-10-07): Moon base layer is now filled with real sky colour (cloud and
 *                        its pale rim are ignored when filling), so the gap that
 *                        opens beside the moon while it rocks is dark sky, not a
 *                        grey wedge.
 *   2.7.6  (2026-10-07): Moon base layer shrunk to the moon itself (+1px); it used to
 *                        cover a 5px band that did not match the cloud/sky next to
 *                        it, showing as a blocky patch beside the moon.
 *   2.7.5  (2026-10-07): Scene images now load with a SCENE_ASSET_REV query so browsers
 *                        stop serving stale copies of re-made images (the ?v= from
 *                        the script URL only changes with the integration version).
 *   2.7.4  (2026-10-07): Moon rebuilt: smooth round crescent (no jagged edge or dark
 *                        outline), continuing behind the cloud, and its right eye
 *                        and cheek move with it. Three layers (base/moon/cloud).
 *   2.7.2  (2026-10-07): Moon rocks +-4deg over a plain sky base (superseded by 2.7.4).
 *   2.7.1  (2026-10-07): Kids night: the moon rocks gently (first version).
 *   2.7.0  (2026-10-07): Kids night cards: the baked-in stars twinkle and the
 *                        lantern glass flickers (overlay layers over the
 *                        untouched artwork; off with prefers-reduced-motion).
 *   2.6.3  (2026-10-07): "Kids Next Prayer + Today" (card_type scene) removed from
 *                        the card-type dropdown; it still works from YAML.
 *   2.6.2  (2026-10-07): Illustrated cards use the same corner radius as the
 *                        standard now/today cards. Card-type dropdown: the old
 *                        "kids" entry removed (still works from YAML) and the
 *                        remaining entries renamed ("Next Prayer (day/night)",
 *                        "Kids Today (day/night)", ...).
 *   2.6.1  (2026-10-07): Card editor: the card-type dropdown could not be opened
 *                        because every hass update rebuilt the form; it is now
 *                        built once and only fed new data. Illustrated cards
 *                        update their live values in place instead of replacing
 *                        the whole DOM each second (removes the flicker).
 *   2.6.0  (2026-10-07): card_type "scene_now" and "scene_today": the illustrated
 *                        card split into a rounded next-prayer banner and a
 *                        rounded today card (night/day), each a slice of the
 *                        same artwork. Banner text block moved down 6px.
 *   2.5.1  (2026-10-07): Scene highlight now matches the baked row's exact
 *                        box and corner radius. Prayer timestamps from before
 *                        local midnight are shifted forward a day, so ticks
 *                        reset at 00:00 instead of at the 00:01 refresh.
 *   2.5.0  (2026-10-07): New card_type "scene": one combined card on a fixed
 *                        illustrated background (night/day webp in this folder,
 *                        picked like the kids card by sunset/fajr) with the
 *                        countdown, Hijri date, prayer times, "5 h 1 m" tag and
 *                        done-ticks laid over it by percentage; the next-prayer row
 *                        gets a gold outline + glow with gold time. Also next-prayer
 *                        (auto-sized to fit; countdown now left-aligned under
 *                        "Remaining"), label, name and last-prayer line in the banner.
 *   2.4.6  (2026-10-07): Today card: icons/names/times of all rows now share
 *                        the same left/right inset as the highlighted pill
 *                        (rows had 4px, the pill 12px, so its icon sat 8px off).
 *   2.4.5  (2026-10-07): Fixed the Today card's countdown sticking on "0 s"
 *                        after Isha — it measured against today's (past) Fajr
 *                        instead of the next-day Fajr the card already resolves.
 *   2.4.4  (2026-10-07): Dark "now" card gets the panel's night-scene hero
 *                        (stars, crescent, horizon glow, mosque skyline, purple
 *                        ring, floating shadow) and a white countdown; the dark
 *                        "today" card gets the panel's floating shadow. Light
 *                        theme matched too: the panel's white-green hero gradient,
 *                        soft shadow and gold glow on the next-prayer row. Version constant/manifest not bumped yet.
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

const NIDA_CARD_VERSION = "2.4.9";

const PRAYERS = ["fajr", "dhuhr", "asr", "maghrib", "isha"];
/* ── Kids-card artwork (2.4.0) ───────────────────────────────────────────
   Inline SVG so the card ships self-contained: no files to mirror into
   www/, nothing that can 404, and it scales to any card width. The scene
   sits behind the banner text via preserveAspectRatio="slice", with the
   busy half (mosque, palms) deliberately on the right so the left stays
   clear for the prayer name however long it gets. */
const KIDS_SCENE = `
<svg class="kids-scene" viewBox="0 0 1536 270" preserveAspectRatio="xMidYMid slice"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="nk-sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#BFEEF8"/><stop offset="1" stop-color="#EAF9FC"/>
    </linearGradient>
  </defs>
  <rect width="1536" height="270" fill="url(#nk-sky)"/>

  <!-- soft green hills along the base -->
  <path d="M0 232 Q 210 196 420 232 T 840 232 T 1260 232 T 1536 220 V270 H0Z" fill="#CDEBB4"/>
  <path d="M0 248 Q 260 220 520 248 T 1040 248 T 1536 242 V270 H0Z" fill="#AEDD96"/>

  <!-- smiling sun, left -->
  <g transform="translate(118 108)">
    <g stroke="#FFC94D" stroke-width="11" stroke-linecap="round">
      <path d="M0 -84V-62M0 62V84M-84 0H-62M62 0H84"/>
      <path d="M-59-59l16 16M43 43l16 16M59-59L43-43M-43 43l-16 16"/>
    </g>
    <circle r="56" fill="#FFD966"/><circle r="47" fill="#FFE49A"/>
    <circle cx="-17" cy="-6" r="5.5" fill="#4A3A12"/>
    <circle cx="17" cy="-6" r="5.5" fill="#4A3A12"/>
    <circle cx="-29" cy="10" r="7" fill="#FFB3A7" opacity=".75"/>
    <circle cx="29" cy="10" r="7" fill="#FFB3A7" opacity=".75"/>
    <path d="M-15 12q15 15 30 0" stroke="#4A3A12" stroke-width="4.5"
          fill="none" stroke-linecap="round"/>
  </g>

  <!-- clouds -->
  <g fill="#FFFFFF" opacity=".92">
    <ellipse cx="300" cy="64" rx="40" ry="22"/><ellipse cx="336" cy="58" rx="28" ry="18"/>
    <ellipse cx="980" cy="78" rx="44" ry="23"/><ellipse cx="1022" cy="72" rx="30" ry="18"/>
    <ellipse cx="1330" cy="186" rx="38" ry="19"/><ellipse cx="1362" cy="181" rx="26" ry="15"/>
  </g>

  <!-- crescent + stars, top right -->
  <g transform="translate(1392 74)">
    <path d="M0-40a40 40 0 1 0 22 73A32 32 0 1 1 0-40Z" fill="#FFE9A8"/>
  </g>
  <g fill="#FFE9A8">
    <path d="M1246 50l5 12 12 5-12 5-5 12-5-12-12-5 12-5z"/>
    <path d="M1318 132l4 9 9 4-9 4-4 9-4-9-9-4 9-4z"/>
    <path d="M1180 110l3 8 8 3-8 3-3 8-3-8-8-3 8-3z"/>
  </g>

  <!-- mosque -->
  <g transform="translate(1040 92)">
    <rect x="86" y="18" width="19" height="92" rx="9" fill="#F6EFD9"/>
    <path d="M95.5 2l9 16h-18z" fill="#F6EFD9"/>
    <circle cx="95.5" cy="-6" r="6" fill="#FFC94D"/>
    <rect x="-8" y="62" width="196" height="76" rx="12" fill="#F6EFD9"/>
    <path d="M18 66a72 60 0 0 1 144 0z" fill="#2F7D52"/>
    <path d="M30 66a60 50 0 0 1 120 0z" fill="#3E9A66"/>
    <path d="M90 14c0 10-10 12-10 20h20c0-8-10-10-10-20z" fill="#F6EFD9"/>
    <path d="M78 110q12-26 24 0v28H78z" fill="#C9A227" opacity=".55"/>
    <path d="M30 112q9-20 18 0v26H30zM132 112q9-20 18 0v26h-18z"
          fill="#C9A227" opacity=".35"/>
  </g>

  <!-- palms -->
  <g transform="translate(962 126)">
    <path d="M6 0q-5 44 2 84" stroke="#A9743E" stroke-width="9"
          fill="none" stroke-linecap="round"/>
    <g fill="#3E9A66">
      <path d="M6 2q-38-20-50 4 28-6 46 8z"/><path d="M6 2q38-20 50 4-28-6-46 8z"/>
      <path d="M6 2q-16-36-44-34 24 10 34 36z"/><path d="M6 2q16-36 44-34-24 10-34 36z"/>
    </g>
  </g>
  <g transform="translate(1308 142)">
    <path d="M4 0q4 38-1 70" stroke="#A9743E" stroke-width="8"
          fill="none" stroke-linecap="round"/>
    <g fill="#48A972">
      <path d="M4 2q-32-16-42 4 23-5 39 7z"/><path d="M4 2q32-16 42 4-23-5-39 7z"/>
      <path d="M4 2q-13-30-37-28 20 8 29 30z"/><path d="M4 2q13-30 37-28-20 8-29 30z"/>
    </g>
  </g>

  <!-- shrubs -->
  <g fill="#5FB87F">
    <ellipse cx="906" cy="214" rx="34" ry="20"/><ellipse cx="946" cy="220" rx="26" ry="15"/>
    <ellipse cx="1246" cy="216" rx="30" ry="18"/><ellipse cx="1206" cy="221" rx="22" ry="13"/>
  </g>
</svg>`;

/* Night half of the scene (2.4.3). A separate SVG rather than recolouring
   the day one: the sun becomes a smiling crescent, the palms and mosque
   gain lamplight, and lanterns appear — changes of content, not of
   palette, so a second drawing is honest and far easier to read than a
   forest of conditional fills. */
const KIDS_SCENE_NIGHT = `
<svg class="kids-scene" viewBox="0 0 1536 270" preserveAspectRatio="xMinYMid slice"
     xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="nk-night" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0E2347"/><stop offset="1" stop-color="#27508C"/>
    </linearGradient>
    <radialGradient id="nk-glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#FFD98A" stop-opacity=".55"/>
      <stop offset="1" stop-color="#FFD98A" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1536" height="270" fill="url(#nk-night)"/>

  <!-- stars -->
  <g fill="#FFE9A8">
    <path d="M470 44l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/>
    <path d="M640 24l5 11 11 5-11 5-5 11-5-11-11-5 11-5z"/>
    <path d="M820 58l3.5 8 8 3.5-8 3.5-3.5 8-3.5-8-8-3.5 8-3.5z"/>
    <path d="M1150 36l4 10 10 4-10 4-4 10-4-10-10-4 10-4z"/>
    <path d="M1280 92l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
    <path d="M330 96l3 7 7 3-7 3-3 7-3-7-7-3 7-3z"/>
  </g>
  <g fill="#DCE8FF" opacity=".85">
    <circle cx="560" cy="88" r="2.5"/><circle cx="900" cy="30" r="2"/>
    <circle cx="1060" cy="70" r="2.5"/><circle cx="400" cy="140" r="2"/>
  </g>

  <!-- night clouds -->
  <g fill="#2F5894" opacity=".75">
    <ellipse cx="300" cy="74" rx="46" ry="23"/><ellipse cx="342" cy="68" rx="30" ry="18"/>
    <ellipse cx="980" cy="104" rx="46" ry="23"/><ellipse cx="1024" cy="98" rx="30" ry="18"/>
  </g>

  <!-- smiling crescent, left -->
  <g transform="translate(128 112)">
    <circle r="86" fill="url(#nk-glow)"/>
    <path d="M26-66A66 66 0 1 0 46 56 52 52 0 1 1 26-66Z" fill="#FFE9A8"/>
    <circle cx="-14" cy="-4" r="5" fill="#4A3A12"/>
    <circle cx="12" cy="2" r="5" fill="#4A3A12"/>
    <circle cx="-26" cy="12" r="6.5" fill="#FFB3A7" opacity=".7"/>
    <circle cx="4" cy="20" r="6.5" fill="#FFB3A7" opacity=".7"/>
    <path d="M-14 14q13 13 26 2" stroke="#4A3A12" stroke-width="4"
          fill="none" stroke-linecap="round"/>
  </g>

  <!-- hills -->
  <path d="M0 232 Q 210 198 420 232 T 840 232 T 1260 232 T 1536 222 V270 H0Z" fill="#1C3A66"/>
  <path d="M0 248 Q 260 222 520 248 T 1040 248 T 1536 244 V270 H0Z" fill="#162E53"/>

  <!-- mosque with lit windows -->
  <g transform="translate(1040 92)">
    <rect x="86" y="18" width="19" height="92" rx="9" fill="#D9E4F7"/>
    <path d="M95.5 2l9 16h-18z" fill="#D9E4F7"/>
    <circle cx="95.5" cy="-6" r="6" fill="#FFD98A"/>
    <rect x="-8" y="62" width="196" height="76" rx="12" fill="#D9E4F7"/>
    <path d="M18 66a72 60 0 0 1 144 0z" fill="#17654A"/>
    <path d="M30 66a60 50 0 0 1 120 0z" fill="#1E7F5C"/>
    <path d="M90 14c0 10-10 12-10 20h20c0-8-10-10-10-20z" fill="#D9E4F7"/>
    <path d="M78 110q12-26 24 0v28H78z" fill="#FFD98A"/>
    <path d="M30 112q9-20 18 0v26H30zM132 112q9-20 18 0v26h-18z" fill="#FFD98A" opacity=".85"/>
  </g>

  <!-- palms -->
  <g transform="translate(962 126)">
    <path d="M6 0q-5 44 2 84" stroke="#7A5530" stroke-width="9"
          fill="none" stroke-linecap="round"/>
    <g fill="#1E7F5C">
      <path d="M6 2q-38-20-50 4 28-6 46 8z"/><path d="M6 2q38-20 50 4-28-6-46 8z"/>
      <path d="M6 2q-16-36-44-34 24 10 34 36z"/><path d="M6 2q16-36 44-34-24 10-34 36z"/>
    </g>
  </g>
  <g transform="translate(1308 142)">
    <path d="M4 0q4 38-1 70" stroke="#7A5530" stroke-width="8"
          fill="none" stroke-linecap="round"/>
    <g fill="#238C66">
      <path d="M4 2q-32-16-42 4 23-5 39 7z"/><path d="M4 2q32-16 42 4-23-5-39 7z"/>
      <path d="M4 2q-13-30-37-28 20 8 29 30z"/><path d="M4 2q13-30 37-28-20 8-29 30z"/>
    </g>
  </g>

  <!-- lantern -->
  <g transform="translate(700 170)">
    <circle cx="0" cy="34" r="40" fill="url(#nk-glow)"/>
    <path d="M0 2v-8" stroke="#C9A227" stroke-width="3" stroke-linecap="round"/>
    <path d="M-12 6h24l-4 42h-16z" fill="#FFD98A"/>
    <path d="M-14 4h28M-16 50h32" stroke="#A9743E" stroke-width="5" stroke-linecap="round"/>
  </g>

  <!-- shrubs -->
  <g fill="#1E4A3A">
    <ellipse cx="906" cy="216" rx="34" ry="20"/><ellipse cx="946" cy="222" rx="26" ry="15"/>
    <ellipse cx="1246" cy="218" rx="30" ry="18"/><ellipse cx="1206" cy="223" rx="22" ry="13"/>
  </g>
</svg>`;

/* Per-prayer row glyphs + the two small UI marks the brief calls for. */
const KIDS_ICONS = {
  fajr: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="23" r="8" fill="#FFD966"/>
    <g stroke="#FFC94D" stroke-width="3" stroke-linecap="round"><path d="M24 8v5M9 23h5M34 23h5M13 12l3.5 3.5M31.5 15.5L35 12"/></g>
    <ellipse cx="27" cy="34" rx="15" ry="8" fill="#9FD8EE"/>
    <ellipse cx="18" cy="36" rx="10" ry="6" fill="#BCE6F5"/></svg>`,
  dhuhr: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <g stroke="#FFC94D" stroke-width="3.4" stroke-linecap="round">
      <path d="M24 5v6M24 37v6M5 24h6M37 24h6M10.5 10.5l4.2 4.2M33.3 33.3l4.2 4.2M37.5 10.5l-4.2 4.2M14.7 33.3l-4.2 4.2"/></g>
    <circle cx="24" cy="24" r="11" fill="#FFD966"/><circle cx="24" cy="24" r="8" fill="#FFE49A"/></svg>`,
  asr: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="19" cy="20" r="8" fill="#FFD966"/>
    <g stroke="#FFC94D" stroke-width="3" stroke-linecap="round"><path d="M19 6v4M5 20h4M8 9l3 3"/></g>
    <ellipse cx="29" cy="32" rx="15" ry="9" fill="#9FD8EE"/>
    <ellipse cx="18" cy="34" rx="11" ry="6" fill="#BCE6F5"/></svg>`,
  maghrib: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M10 30a14 14 0 0 1 28 0z" fill="#FF9A52"/>
    <g stroke="#FFB52E" stroke-width="3" stroke-linecap="round"><path d="M24 8v5M7 26h4M37 26h4M12 14l3 3M33 17l3-3"/></g>
    <path d="M6 34h36" stroke="#5FB3D6" stroke-width="3.6" stroke-linecap="round"/>
    <path d="M12 40h24" stroke="#9FD8EE" stroke-width="3.2" stroke-linecap="round"/></svg>`,
  isha: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M30 6a18 18 0 1 0 10 33A15 15 0 0 1 30 6Z" fill="#3E9A66"/>
    <g fill="#FFE9A8"><path d="M13 9l2.2 5.3L20.5 17l-5.3 2.2L13 24.5l-2.2-5.3L5.5 17l5.3-2.7z"/>
    <path d="M38 24l1.5 3.6 3.6 1.5-3.6 1.5L38 34l-1.5-3.4-3.6-1.5 3.6-1.5z"/></g></svg>`,
  hourglass: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <g stroke="#5F8F50" stroke-width="3.2" stroke-linecap="round" fill="none">
      <path d="M13 7h22M13 41h22"/><path d="M16 7v7c0 6 8 8 8 10s-8 4-8 10v7M32 7v7c0 6-8 8-8 10s8 4 8 10v7"/></g>
    <path d="M19 36c1.6-4 8.4-4 10 0z" fill="#FFB52E"/>
    <path d="M20 12h8c0 4-4 5-4 7s-4-3-4-7z" fill="#FFB52E"/></svg>`,
  check: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <circle cx="24" cy="24" r="20" fill="#3E9A66"/>
    <path d="M15 24.5l6.5 6.5L33 19" fill="none" stroke="#FFFFFF"
          stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  moon: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <path d="M31 7a18 18 0 1 0 9 33A15 15 0 0 1 31 7Z" fill="#FFD966"/></svg>`,
  calendar: `<svg viewBox="0 0 48 48" aria-hidden="true">
    <rect x="6" y="11" width="36" height="31" rx="7" fill="#FFFFFF" stroke="#163D2D" stroke-width="3"/>
    <path d="M6 20h36" stroke="#163D2D" stroke-width="3"/>
    <path d="M16 6v8M32 6v8" stroke="#163D2D" stroke-width="3.4" stroke-linecap="round"/>
    <path d="M24 24l2.6 5.6 5.4 0.7-4 3.9 1 5.8-5-2.9-5 2.9 1-5.8-4-3.9 5.4-.7z" fill="#FFB52E"/></svg>`,
};

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

// Night-scene hero background for the dark "now" card — the same SVG the
// panel uses for --img-herodark (stars, crescent, horizon glow, mosque skyline).
const HERO_NIGHT_BG = 'url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3MjAgMjIwIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWlkWU1heCBzbGljZSI+CjxkZWZzPgo8bGluZWFyR3JhZGllbnQgaWQ9InNreSIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMxNDFkM2YiLz48c3RvcCBvZmZzZXQ9IjAuNTUiIHN0b3AtY29sb3I9IiMxYjIxNDgiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMyYTIzNTAiLz4KPC9saW5lYXJHcmFkaWVudD4KPHJhZGlhbEdyYWRpZW50IGlkPSJnbG93IiBjeD0iMC41IiBjeT0iMSIgcj0iMC43Ij4KPHN0b3Agb2Zmc2V0PSIwIiBzdG9wLWNvbG9yPSIjZjZjMjRhIiBzdG9wLW9wYWNpdHk9IjAuMzUiLz4KPHN0b3Agb2Zmc2V0PSIwLjQiIHN0b3AtY29sb3I9IiNiOThhNmEiIHN0b3Atb3BhY2l0eT0iMC4xNiIvPgo8c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiNiOThhNmEiIHN0b3Atb3BhY2l0eT0iMCIvPgo8L3JhZGlhbEdyYWRpZW50Pgo8bGluZWFyR3JhZGllbnQgaWQ9InNpbCIgeDE9IjAiIHkxPSIwIiB4Mj0iMCIgeTI9IjEiPgo8c3RvcCBvZmZzZXQ9IjAiIHN0b3AtY29sb3I9IiMwZTE0MzAiLz48c3RvcCBvZmZzZXQ9IjEiIHN0b3AtY29sb3I9IiMwYTEwMjkiLz4KPC9saW5lYXJHcmFkaWVudD4KPC9kZWZzPgo8cmVjdCB3aWR0aD0iNzIwIiBoZWlnaHQ9IjIyMCIgZmlsbD0idXJsKCNza3kpIi8+CjxyZWN0IHg9IjEyMCIgeT0iMTIwIiB3aWR0aD0iNjAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0idXJsKCNnbG93KSIvPgo8IS0tIHN0YXJzIC0tPgo8ZyBmaWxsPSIjZWVmMGZmIj48Y2lyY2xlIGN4PSIzODAiIGN5PSIzMCIgcj0iMS4xIiBvcGFjaXR5PSIwLjgiLz48Y2lyY2xlIGN4PSI0NzAiIGN5PSI2MCIgcj0iMC45IiBvcGFjaXR5PSIwLjYiLz48Y2lyY2xlIGN4PSI1NjAiIGN5PSIyNiIgcj0iMS4yIiBvcGFjaXR5PSIwLjciLz48Y2lyY2xlIGN4PSIzMDAiIGN5PSI1MiIgcj0iMC44IiBvcGFjaXR5PSIwLjUiLz48Y2lyY2xlIGN4PSI2NDAiIGN5PSI3MCIgcj0iMSIgb3BhY2l0eT0iMC42Ii8+PGNpcmNsZSBjeD0iMjIwIiBjeT0iMzQiIHI9IjAuOSIgb3BhY2l0eT0iMC42Ii8+PC9nPgo8IS0tIGNyZXNjZW50IG1vb24gdG9wLWxlZnQgLS0+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDcwLDUyKSI+PHBhdGggZD0iTTE0IDBBMTUgMTUgMCAxIDAgMTQgMzAgMTIgMTIgMCAwIDEgMTQgMFoiIGZpbGw9IiNlOWRkYjAiIG9wYWNpdHk9IjAuOTIiLz48L2c+CjwhLS0gZmFyIGhpbGxzIC0tPgo8cGF0aCBkPSJNMCAxNjggQzEyMCAxNTAgMjIwIDE3MiAzNDAgMTYwIEM0NjAgMTQ4IDU2MCAxNzQgNzIwIDE1OCBMNzIwIDIyMCBMMCAyMjBaIiBmaWxsPSIjMWEyMDQ0IiBvcGFjaXR5PSIwLjciLz4KPCEtLSBza3lsaW5lIHNpbGhvdWV0dGUgKG1vc3F1ZSBsZWZ0ICsgY2l0eSkgLS0+CjxnIGZpbGw9InVybCgjc2lsKSI+CjxwYXRoIGQ9Ik0wIDIyMCBWMTgyIEM0MCAxNzggNzAgMTgwIDk2IDE3NiBMOTYgMTUwIEM5NiAxMzggMTA0IDEzMiAxMTIgMTMyIEMxMjAgMTMyIDEyOCAxMzggMTI4IDE1MCBMMTI4IDE3NiBDMTUwIDE3OCAxNjggMTgwIDE4MCAxODIgTDE4MCAxMzAgQzE4MCAxMDggMTk2IDk2IDIxNCA5NiBDMjMyIDk2IDI0OCAxMDggMjQ4IDEzMCBMMjQ4IDE4MiBDMzAwIDE4MCAzNDAgMTg0IDM4MCAxODIgTDM4MCAyMDUgTDcyMCAyMDUgTDcyMCAyMjBaIi8+CjwhLS0gbWluYXJldCAtLT4KPHJlY3QgeD0iMTUwIiB5PSI5NiIgd2lkdGg9IjciIGhlaWdodD0iOTAiLz4KPHBhdGggZD0iTTE0OSA5NmMwLTYgNC41LTkgNC41LTlzNC41IDMgNC41IDl6Ii8+CjxyZWN0IHg9IjE1Mi41IiB5PSI4MCIgd2lkdGg9IjIiIGhlaWdodD0iOCIvPgo8IS0tIGRvbWUgZmluaWFsIC0tPgo8cmVjdCB4PSIyMzAiIHk9IjgwIiB3aWR0aD0iMyIgaGVpZ2h0PSIxOCIvPjxwYXRoIGQ9Ik0yMzEuNSA4MGEzLjUgMy41IDAgMTAwLTYgNCA0IDAgMDEwIDZ6Ii8+CjwhLS0gcmlnaHQgc21hbGwgZG9tZXMgLyBjaXR5IC0tPgo8cGF0aCBkPSJNNTYwIDIwNSBWMTc2IEM1NjAgMTY0IDU2OCAxNTggNTc2IDE1OCBDNTg0IDE1OCA1OTIgMTY0IDU5MiAxNzYgTDU5MiAyMDVaIi8+CjxyZWN0IHg9IjYyMCIgeT0iMTY4IiB3aWR0aD0iNSIgaGVpZ2h0PSIzNyIvPgo8cGF0aCBkPSJNNDcwIDIwNSB2LTI0IGExMCAxMCAwIDAxMjAgMCB2MjRaIi8+CjwvZz4KPC9zdmc+") center / cover no-repeat, linear-gradient(160deg, #141d3f, #1b2148)';

// "Scene" card (card_type: scene) — a fixed illustrated background image with
// live values positioned on top. The images ship in this same folder; their
// URL is derived from this script's own URL so the ?v= cache-buster carries
// over and no extra static path has to be registered.
const SCENE_ASSET_REV = "11";
const NIDA_SCENE_SRC = (() => {
  try {
    const u = new URL(document.currentScript.src);
    // SCENE_ASSET_REV changes whenever an image is re-made: the ?v= from the script URL stays
    // the same until the integration version changes, so browsers would keep the old images.
    return (file) => `${u.origin}${u.pathname.replace(/[^/]*$/, "")}${file}${u.search || "?"}${u.search ? "&" : ""}r=${SCENE_ASSET_REV}`;
  } catch (e) {
    return (file) => `/nida_panel_files/${file}`;
  }
})();

// Coordinates are in pixels of the source image; the card converts them to
// percentages so everything scales with the card. rowY = vertical centre of
// each prayer row, timeX / relX = right edge of the time / "5 h 1 m" text,
// checkX = centre of the completed-prayer mark. bakedLabels: whether the
// image already contains the "Today" / "Remaining" words.
const SCENE = {
  night: {
    file: "nida-scene-night.webp", w: 1199, h: 1312,
    ink: "#FFFFFF", dim: "rgba(255,255,255,0.72)", bakedLabels: false,
    remLabel: { x: 668, y: 152, align: "left" },
    cd: { x: 668, y: 222 },
    // Moved up ~45px; x/w leave a gap to the moon and the Remaining panel.
    nextBox: { x: 276, y: 99, nameY: 164, lastY: 223, w: 256 },
    todayLabel: { x: 168, y: 420 },
    date: { x: 1010, y: 420 },
    rowY: [526, 629, 732, 838, 941],
    cut: 340,
    // Centres/sizes (px in the artwork) of the baked-in gold stars that
    // twinkle at night, and the lantern whose glass flickers.
    stars: [[909, 35, 19], [786, 44, 32], [993, 69, 25], [244, 119, 29], [67, 125, 19],
            [236, 184, 17], [58, 219, 16], [256, 276, 17], [1060, 397, 12], [1133, 461, 12],
            [149, 962, 19], [787, 1036, 21], [935, 1052, 22], [614, 1086, 13]],
    lantern: { x: 107, y: 1092, r: 170 },
    // The moon is three layers sharing one box: a base that fills in the sky where the
    // artwork's own moon is, the rocking moon (a smooth crescent that continues round
    // behind the cloud), and the cloud cut-out on top so the moon rocks *behind* it.
    moon: { x: 60, y: 70, w: 215, h: 230, base: "nida-scene-night-moonbase.webp",
            sprite: "nida-scene-night-moon.webp", cloud: "nida-scene-night-cloud.webp" },
    rowX: [81, 1115], rowH: 97, accent: "#F6C24A",
    timeX: 1070, relX: 922, checkX: 134,
  },
  day: {
    file: "nida-scene-day.webp", w: 1225, h: 1284,
    ink: "#12376B", dim: "rgba(18,55,107,0.7)", bakedLabels: true,
    cd: { x: 705, y: 222 },
    nextBox: { x: 330, y: 138, nameY: 203, lastY: 262, w: 240 },
    date: { x: 1062, y: 420 },
    rowY: [522, 628, 733, 835, 937],
    cut: 335,
    rowX: [80, 1141], rowH: 98, accent: "#E9A913",
    timeX: 1095, relX: 950, checkX: 140,
  },
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
    cardShadow: "0 10px 30px rgba(0, 0, 0, 0.35)",
    heroBg: HERO_NIGHT_BG,
    heroShadow: "0 14px 44px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(124, 92, 255, 0.18)",
    countdown: "#F8F8FA",
    heroBorder: "rgba(124, 92, 255, 0.35)",
    pastIcon: "#7C5CFF",
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
    accentGlow: "rgba(246, 194, 74, 0.22)",
    iconStroke: "#5B7F46",
    cardShadow: "0 4px 18px rgba(0, 0, 0, 0.06)",
    heroBg: "linear-gradient(160deg, #ffffff, #f5f8ef)",
    heroShadow: "0 6px 22px rgba(0, 0, 0, 0.06)",
    countdown: "#4E6E3B",
    heroBorder: "#E7EBD9",
    pastIcon: "#5B7F46",
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
    editor_card_type_now: "Next Prayer (day/night)",
    editor_card_type_today: "Today (day/night)",
    editor_card_type_kids: "Kids",
    editor_card_type_scene: "Kids Next Prayer + Today (day/night)",
    editor_card_type_scene_now: "Kids Next Prayer (day/night)",
    editor_card_type_scene_today: "Kids Today (day/night)",
    kids_cheer: "You're doing great!",
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
    editor_card_type_now: "Volgend gebed (dag/nacht)",
    editor_card_type_today: "Vandaag (dag/nacht)",
    editor_card_type_kids: "Kinderen",
    editor_card_type_scene: "Kids Volgend gebed + Vandaag (dag/nacht)",
    editor_card_type_scene_now: "Kids Volgend gebed (dag/nacht)",
    editor_card_type_scene_today: "Kids Vandaag (dag/nacht)",
    kids_cheer: "Je doet het goed!",
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
    const t = this._config?.card_type;
    // kids stacks a banner on top of five tall rows.
    return t === "scene" ? 9 : t === "scene_today" ? 6 : t === "scene_now" ? 3 : t === "kids" ? 7 : t === "today" ? 5 : 2;
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
      // The sensors only roll over to the new day at the 00:01 refresh.
      // Until then they still hold yesterday's timestamps; shift those to
      // today so the ticks reset and the countdown targets the right Fajr
      // right at midnight instead of up to a minute late.
      const midnight = new Date();
      midnight.setHours(0, 0, 0, 0);
      if (d < midnight) {
        d.setTime(d.getTime() + Math.ceil((midnight - d) / 86400000) * 86400000);
      }
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
    const raw = this._config?.card_type;
    const type = ["today", "kids", "scene", "scene_now", "scene_today"].includes(raw) ? raw : "now";
    if (type === "kids" || type.startsWith("scene")) ensureKidsFont();
    const info = this._nextInfo();
    const inner = info
      ? (type === "today" ? this._htmlToday(info)
        : type === "kids" ? this._htmlKids(info)
        : type === "scene" ? this._htmlScene(info)
        : type === "scene_now" ? this._htmlScene(info, "now")
        : type === "scene_today" ? this._htmlScene(info, "today")
        : this._htmlNow(info))
      : `<div class="empty">${this._t("unavailable")}</div>`;
    // The illustrated cards tick every second. Replacing the whole DOM each
    // time restarts the background image, which shows up as flicker, so
    // when only the live values changed just swap the children of .scene.
    const liveScene = type.startsWith("scene") && info
      ? this.shadowRoot.querySelector(".scene") : null;
    if (liveScene) {
      const tpl = document.createElement("template");
      tpl.innerHTML = inner;
      const next = tpl.content.querySelector(".scene");
      const dyn = liveScene.querySelector(".sc-dyn");
      if (next && dyn && next.getAttribute("style") === liveScene.getAttribute("style")
          && next.className === liveScene.className) {
        // Only the live values; the .sc-fx layer keeps its running animations.
        dyn.innerHTML = next.querySelector(".sc-dyn").innerHTML;
        return;
      }
    }
    this.shadowRoot.innerHTML = `
      <style>${this._css(theme)}</style>
      <div class="nida-card-root type-${type}${type.startsWith("scene") ? " type-scene" : ""}">
        ${inner}
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
    const { next, schedule, nextDate } = info;
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
        // nextDate, not today's sensor time: after Isha the next prayer is
        // tomorrow's Fajr, and today's Fajr timestamp is already in the past.
        let diff = nextDate.getTime() - now;
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

  // ───── Kids variant (2.4.0) ───────────────────────────────────────────────
  // A third card_type beside "now" and "today", built from Johann's design
  // brief: one banner with the next prayer and a live countdown, then the
  // day's five prayers as big friendly rows.
  //
  // The brief specifies exact pixel positions on a 1536x864 canvas. A
  // dashboard card cannot honour those literally — it has to survive a
  // narrow sidebar column and a wide desktop pane alike — so the ratios are
  // kept and every size is expressed with clamp()/container units instead.
  // That preserves the intended look while staying a real responsive card.
  //
  // Everything decorative is inline SVG: no image files to mirror into www/,
  // nothing to 404, and the whole scene recolours with the palette.
  // ───── Kids variant (2.4.0, layout settled in 2.4.2) ──────────────────────
  // Built to Johann's approved mockup: a banner with the next prayer and a
  // countdown pill, then the day's five prayers — past ones ticked off, the
  // next one highlighted with how long is left.
  //
  // The brief gave pixel positions on a 1536x864 canvas. A dashboard card
  // has to survive a narrow sidebar column and a wide desktop pane alike,
  // so the proportions are kept but every size is a container unit. See the
  // CSS for why that distinction mattered.
  //
  // All artwork is inline SVG: nothing to mirror into www/, nothing that can
  // 404, and it scales with the card.
  // Night runs from Maghrib to Fajr, read off the prayer schedule the card
  // already has. Deliberately NOT the dashboard's dark mode: "avondversie"
  // means the card shows a night sky when it IS night, which is the whole
  // charm of it for a child. A dashboard that is dark all day would
  // otherwise put a crescent moon on the card at noon.
  _kidsIsNight(schedule) {
    const by = new Map(schedule.map((e) => [e.prayer, e.date]));
    const fajr = by.get("fajr");
    const maghrib = by.get("maghrib");
    if (!fajr || !maghrib) return false;
    const now = Date.now();
    return now >= maghrib.getTime() || now < fajr.getTime();
  }

  _htmlScene(info, part = "all") {
    const { next, current, nextDate, schedule } = info;
    const byPrayer = new Map(schedule.map((e) => [e.prayer, e.date]));
    const now = Date.now();
    const g = SCENE[this._kidsIsNight(schedule) ? "night" : "day"];
    const px = (x) => `${(x / g.w) * 100}%`;
    // part: "all" = whole artwork, "now" = banner only, "today" = list only.
    // A part shows a horizontal slice of the same image; y values stay in
    // full-image pixels and are converted relative to that slice.
    const cropTop = part === "today" ? g.cut : 0;
    const cropH = part === "now" ? g.cut : part === "today" ? g.h - g.cut : g.h;
    const py = (y) => `${((y - cropTop) / cropH) * 100}%`;
    const at = (x, y) => `left:${px(x)};top:${py(y)};`;
    // Largest font (cqw) up to `max` at which `text` still fits the text box;
    // `k` is the average glyph width in em.
    const fit = (text, max, k) =>
      Math.min(max, (g.nextBox.w / g.w * 100) / (Math.max(1, text.length) * k)).toFixed(2);
    const atR = (x, y) => `right:${(100 - (x / g.w) * 100)}%;top:${py(y)};`;

    let diff = Math.max(0, nextDate.getTime() - now);
    const pad = (n) => String(n).padStart(2, "0");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const countdown = `${pad(h)}:${pad(m)}:${pad(Math.floor((diff % 60000) / 1000))}`;
    const relative = h > 0 ? `${h} h ${m} m` : `${m} m`;

    const rows = PRAYERS.map((p, i) => {
      const date = byPrayer.get(p);
      if (!date) return "";
      const y = g.rowY[i];
      const isNext = p === next;
      const isPast = !isNext && date.getTime() < now;
      return `
        ${isNext ? `<span class="sc-hl" style="left:${px(g.rowX[0])};top:${py(y - g.rowH / 2)};width:${((g.rowX[1] - g.rowX[0]) / g.w) * 100}%;height:${(g.rowH / cropH) * 100}%"></span>` : ""}
        ${isPast ? `<span class="sc-check" style="${at(g.checkX, y)}">${KIDS_ICONS.check}</span>` : ""}
        ${isNext ? `<span class="sc-rel" style="${atR(g.relX, y)}color:${g.accent};">${relative}</span>` : ""}
        <span class="sc-time" style="${atR(g.timeX, y)}${isNext ? `color:${g.accent};` : ""}">${this._fmtHHMM(date)}</span>`;
    }).join("");

    // The day artwork has a green tick baked into the Fajr row. While Fajr is
    // still ahead, paint over it with the empty Dhuhr row's matching spot.
    const fajrDate = byPrayer.get("fajr");
    const fajrDone = fajrDate && fajrDate.getTime() < now && next !== "fajr";
    // Paint over a baked-in detail with a plain patch of the same artwork:
    // centre (x,y), size w*h, copied from the area centred on (sx,sy).
    const cover = (x, y, w, h, sx, sy) => `<span class="sc-patch" style="left:${px(x)};top:${py(y)};
           width:${(w / g.w) * 100}%;height:${(h / cropH) * 100}%;
           background-image:url('${NIDA_SCENE_SRC(g.file)}');
           background-size:${(g.w / w) * 100}% ${(g.h / h) * 100}%;
           background-position:${((sx - w / 2) / (g.w - w)) * 100}% ${((sy - h / 2) / (g.h - h)) * 100}%"></span>`;
    const patch = (g === SCENE.day && !fajrDone)
      ? cover(g.checkX, g.rowY[0], 84, 70, g.checkX, g.rowY[1])
      : "";


    const nowLabel = g.bakedLabels ? "" :
      `<span class="sc-label" style="${at(g.remLabel.x, g.remLabel.y)}">${this._t("remaining")}</span>`;
    const todayLabel = g.bakedLabels ? "" :
      `<span class="sc-today" style="${at(g.todayLabel.x, g.todayLabel.y)}">${this._t("today")}</span>`;

    const nowPart = `
        ${nowLabel}
        <span class="sc-next-l" style="${at(g.nextBox.x, g.nextBox.y)}">${this._t("next_prayer")}</span>
        <span class="sc-next" style="${at(g.nextBox.x, g.nextBox.nameY)}font-size:${fit(this._t("prayer_" + next), 7.2, 0.58)}cqw">${this._t("prayer_" + next)}</span>
        ${current ? `<span class="sc-last" style="${at(g.nextBox.x, g.nextBox.lastY)}font-size:${fit(`${this._t("last_prayer")} · ${this._t("prayer_" + current)}`, 2.7, 0.56)}cqw">${this._t("last_prayer")} · ${this._t("prayer_" + current)}</span>` : ""}
        <span class="sc-cd" style="${at(g.cd.x, g.cd.y)}">${countdown}</span>`;
    const todayPart = `
        ${patch}
        ${todayLabel}
        <span class="sc-date" style="${atR(g.date.x, g.date.y)}">${this._hijriText()}</span>
        ${rows}`;
    // Night-only life: twinkling stars and a flickering lantern, drawn as
    // overlays so the artwork itself stays untouched.
    const inCrop = (y) => y >= cropTop && y < cropTop + cropH;
    const fx = (g === SCENE.night) ? `
        ${g.stars.filter(([, y]) => inCrop(y)).map(([x, y, sz], i) => `<span class="sc-star" style="left:${px(x)};top:${py(y)};width:${(sz / g.w) * 100}%;--d:${(2.4 + (i * 0.37) % 2.1).toFixed(2)}s;--dl:${(-((i * 0.83) % 3)).toFixed(2)}s"></span>`).join("")}
        ${inCrop(g.moon.y + g.moon.h / 2) ? ["base", "sprite", "cloud"].map((k) => `<span class="sc-moon-${k}" style="left:${px(g.moon.x + g.moon.w / 2)};top:${py(g.moon.y + g.moon.h / 2)};width:${(g.moon.w / g.w) * 100}%;aspect-ratio:${g.moon.w}/${g.moon.h};background-image:url('${NIDA_SCENE_SRC(g.moon[k])}')"></span>`).join("") : ""}
        ${inCrop(g.lantern.y) ? `<span class="sc-lantern" style="left:${px(g.lantern.x)};top:${py(g.lantern.y)};width:${(g.lantern.r * 2 / g.w) * 100}%"></span>
        <span class="sc-lantern core" style="left:${px(g.lantern.x)};top:${py(g.lantern.y)};width:${(g.lantern.r * 0.9 / g.w) * 100}%"></span>` : ""}` : "";
    const sliced = part !== "all";
    const bgSize = `100% ${(g.h / cropH) * 100}%`;
    const bgPos = sliced ? `0 ${(cropTop / (g.h - cropH)) * 100}%` : "0 0";

    return `
      <div class="scene ${sliced ? "sliced" : ""}" style="aspect-ratio:${g.w}/${cropH};
           background-image:url('${NIDA_SCENE_SRC(g.file)}');background-size:${bgSize};background-position:${bgPos};
           color:${g.ink};--dim:${g.dim};--accent:${g.accent};--accent-glow:${g.accent}88;--accent-fill:${g.accent}1F;">
        <div class="sc-fx">${fx}</div>
        <div class="sc-dyn">
          ${part !== "today" ? nowPart : ""}
          ${part !== "now" ? todayPart : ""}
        </div>
      </div>`;
  }

  _htmlKids(info) {
    const { next, current, nextDate, schedule } = info;
    const byPrayer = new Map(schedule.map((e) => [e.prayer, e.date]));
    const now = Date.now();
    const night = this._kidsIsNight(schedule);

    let diff = nextDate.getTime() - now;
    if (diff < 0) diff = 0;
    const pad = (n) => String(n).padStart(2, "0");
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const remaining = `${pad(h)}:${pad(m)}:${pad(Math.floor((diff % 60000) / 1000))}`;
    // Coarse "5 h 1 m" beside the active row — deliberately not a second-by
    // -second repeat of the big countdown directly above it.
    const relative = h > 0 ? `${h} h ${m} m` : `${m} m`;

    const rows = PRAYERS.map((p) => {
      const date = byPrayer.get(p);
      if (!date) return "";
      const isNext = p === next;
      const isPast = !isNext && date.getTime() < now;
      return `
        <div class="kids-row ${isNext ? "active" : ""}">
          <span class="kids-row-mark">${isPast ? KIDS_ICONS.check : ""}</span>
          <span class="kids-row-ico">${KIDS_ICONS[p]}</span>
          <span class="kids-row-name">${this._t("prayer_" + p)}</span>
          ${isNext ? `
            <span class="kids-row-rel">
              <span class="kids-row-rel-ico">${KIDS_ICONS.hourglass}</span>
              ${relative}
            </span>` : ""}
          <span class="kids-row-time">${this._fmtHHMM(date)}</span>
        </div>`;
    }).join("");

    return `
      <div class="kids ${night ? "night" : ""}">
        <div class="kids-banner">
          ${night ? KIDS_SCENE_NIGHT : KIDS_SCENE}
          <div class="kids-banner-main">
            <div class="kids-eyebrow">${this._t("next_prayer")}</div>
            <div class="kids-next">${this._t("prayer_" + next)}</div>
            <div class="kids-last">
              ${this._t("last_prayer")} &middot; ${this._t("prayer_" + current)}
            </div>
          </div>
          <div class="kids-pill">
            <span class="kids-pill-ico">${KIDS_ICONS.hourglass}</span>
            <span class="kids-pill-text">
              <span class="kids-eyebrow">${this._t("remaining")}</span>
              <span class="kids-pill-val">${remaining}</span>
            </span>
          </div>
        </div>

        <div class="kids-list">
          <div class="kids-list-head">
            <span class="kids-list-ico">${KIDS_ICONS.calendar}</span>
            <span class="kids-list-title">${this._t("today")}</span>
            <span class="kids-hijri">
              ${this._hijriText()}
              <span class="kids-hijri-ico">${KIDS_ICONS.moon}</span>
            </span>
          </div>
          ${rows}
          <div class="kids-cheer">${this._t("kids_cheer")} &#11088;</div>
          <div class="kids-foot">
            <span class="kids-foot-ico">${ICONS.refresh}</span>
            ${this._t("last_updated")} ${this._lastUpdatedText()}
          </div>
        </div>
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
      /* Hero treatment for the "now" card (night scene in dark, soft
         white-green gradient in light). Mirrors the panel's .now-card. */
      ${t.heroBg ? `.nida-card-root.type-now {
        background: ${t.heroBg};
        box-shadow: ${t.heroShadow};
        border-color: ${t.heroBorder};
        padding: 26px 28px;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: center;
        /* Tall enough that the skyline is not cropped to a sliver. */
        min-height: 170px;
      }` : ""}
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
        color: ${t.countdown};
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
        padding: 9px 12px;
        border-bottom: 1px solid ${t.border};
        font-size: 14px;
        color: ${t.text};
      }
      .today-row:last-child { border-bottom: none; }
      .today-row.past { color: ${t.textDim}; }
      .today-row.past .today-icon { color: ${t.pastIcon}; }
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
        /* 11px + 1px border = the 12px of the other rows, so icons, names
           and times line up in one column with the pill. */
        padding: 9px 11px;
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

      /* ── Scene card ── fixed artwork, live values placed by percentage. */
      .nida-card-root.type-scene {
        padding: 0; border: none; background: none; box-shadow: none;
        border-radius: 0; overflow: visible;
      }
      .scene {
        container-type: inline-size;
        position: relative;
        width: 100%;
        background-size: 100% 100%;
        background-repeat: no-repeat;
        font-family: 'Nunito', 'Quicksand', 'Inter', system-ui, sans-serif;
        font-weight: 800;
      }
      .scene { border-radius: ${t.radius}; overflow: hidden; }
      .sc-dyn { position: absolute; inset: 0; }
      .sc-dyn > span { position: absolute; transform: translateY(-50%); white-space: nowrap; line-height: 1; }
      .sc-hl { transform: none !important; border: 0.35cqw solid var(--accent); box-sizing: border-box; border-radius: 2.3cqw; background: var(--accent-fill); box-shadow: 0 0 2.4cqw var(--accent-glow), inset 0 0 1.4cqw var(--accent-glow); pointer-events: none; }
      .sc-time { font-size: 3.5cqw; font-variant-numeric: tabular-nums; }
      .sc-rel { font-size: 2.7cqw; color: var(--dim); font-weight: 700; }
      .sc-next-l { font-size: 3cqw; text-shadow: 0 1px 3px rgba(0,0,0,.25); color: var(--dim); font-weight: 700; }
      .sc-next { font-size: 6cqw; line-height: 1; }
      .sc-last { font-size: 2cqw; color: var(--dim); font-weight: 700; }
      .sc-cd { font-size: 4.3cqw; font-variant-numeric: tabular-nums; }
      .sc-date { font-size: 2.7cqw; color: var(--dim); font-weight: 700; }
      .sc-label { font-size: 3.2cqw; color: var(--dim); transform: translateY(-50%); }
      .sc-today { font-size: 4.4cqw; }
      .sc-check { width: 5.2cqw; height: 5.2cqw; transform: translate(-50%, -50%) !important; }
      .sc-check svg { width: 100%; height: 100%; display: block; }
      .sc-fx { position: absolute; inset: 0; pointer-events: none; }
      .sc-moon-base, .sc-moon-sprite, .sc-moon-cloud { position: absolute; background-size: 100% 100%; transform: translate(-50%, -50%); }
      /* Pivot where the moon rests on the cloud, so that seam hardly moves while the top rocks. */
      .sc-moon-sprite { transform-origin: 32% 80%; animation: sc-rock 6s ease-in-out infinite; }
      @keyframes sc-rock {
        0%, 100% { transform: translate(-50%, -50%) rotate(-4deg); }
        50% { transform: translate(-50%, -53%) rotate(4deg); }
      }
      .sc-star, .sc-lantern { position: absolute; aspect-ratio: 1; transform: translate(-50%, -50%); mix-blend-mode: screen; }
      .sc-star { animation: sc-twinkle var(--d, 3s) ease-in-out var(--dl, 0s) infinite; }
      .sc-star::before { content: ""; position: absolute; inset: -70%;
        background: radial-gradient(circle, rgba(255, 228, 140, 0.8), rgba(255, 200, 80, 0) 65%); }
      .sc-star::after { content: ""; position: absolute; inset: 0; background: #FFF6CC;
        clip-path: polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%); }
      @keyframes sc-twinkle {
        0%, 100% { opacity: 0.1; transform: translate(-50%, -50%) scale(0.8); }
        50% { opacity: 1; transform: translate(-50%, -50%) scale(1.2); }
      }
      .sc-lantern { background: radial-gradient(circle, rgba(255, 185, 80, 0.62) 0%, rgba(255, 140, 40, 0.28) 38%, rgba(255, 120, 20, 0) 68%);
        animation: sc-flicker 2.7s linear infinite; }
      .sc-lantern.core { background: radial-gradient(circle, rgba(255, 235, 160, 0.85) 0%, rgba(255, 190, 80, 0.3) 55%, rgba(255, 170, 60, 0) 72%);
        animation-duration: 1.9s; animation-delay: -0.6s; }
      @keyframes sc-flicker {
        0% { opacity: 0.65; } 7% { opacity: 0.95; } 13% { opacity: 0.55; } 21% { opacity: 1; }
        30% { opacity: 0.7; } 44% { opacity: 0.92; } 53% { opacity: 0.6; } 66% { opacity: 1; }
        79% { opacity: 0.72; } 100% { opacity: 0.65; }
      }
      @media (prefers-reduced-motion: reduce) { .sc-moon-sprite { animation: none; } .sc-star, .sc-lantern { animation: none; opacity: 0.5; } }
      .sc-patch { transform: translate(-50%, -50%) !important; background-repeat: no-repeat; }

      /* ── Kids card (2.4.0; sizing fixed 2.4.1, layout 2.4.2) ────────
         Sizes are in cqw — percent of the CARD's own width via
         container-type below — never vw. That distinction is the bug
         2.4.0 shipped: vw measures the VIEWPORT, so a narrow card column
         on a wide screen hit the clamp maximum and rendered a 68px
         "Fajr" into a ~300px column, which then broke one letter per
         line. The @media query meant to catch that was measuring the
         viewport too, so it never fired.

         font-size is declared twice per rule on purpose: a plain value
         first, the clamp() after. A browser without container-query
         units drops the clamp as invalid and keeps the plain value
         rather than falling back to an inherited size. */
      .kids {
        container-type: inline-size;
        font-family: 'Nunito', 'Quicksand', 'Inter', system-ui, sans-serif;
        background: #EAF9FC;
        border-radius: ${t.radius};
        overflow: hidden;
      }
      .kids-banner {
        position: relative;
        display: flex;
        align-items: center;
        gap: clamp(8px, 1.4cqw, 20px);
        /* The scene's viewBox is 1536x270. Giving the banner that exact
           aspect ratio (270/1536 = 17.58%) means preserveAspectRatio
           "slice" has nothing to slice off, so the sun, mosque and hills
           all stay in frame. Letting the banner find its own height made
           it ~10:1, which cropped the drawing to its middle third and
           squashed the text. */
        height: 17.58cqw;
        min-height: 92px;
        padding-block: clamp(10px, 1.4cqw, 22px);
        /* Left: clear of the sun, which the scene draws out to ~13% of
           the width. Right: keep the pill off the mosque, which starts at
           ~67%. Both are read off the SVG rather than guessed. */
        padding-inline: 14cqw 33cqw;
      }
      .kids-scene { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
      .kids-banner-main, .kids-pill { position: relative; z-index: 1; }
      /* Clears the sun, which the scene anchors to the left edge. */
      .kids-banner-main { flex: 1 1 auto; min-width: 0; }
      .kids-eyebrow {
        display: block;
        font-weight: 600;
        font-size: 11px;
        font-size: clamp(9px, 1.5cqw, 21px);
        color: #5F8F50;
        white-space: nowrap;
      }
      .kids-next {
        font-weight: 800;
        font-size: 28px;
        font-size: clamp(20px, 4.4cqw, 62px);
        line-height: 1.04;
        color: #163D2D;
        /* A prayer name is one short word: it shrinks, it never wraps.
           2.4.0 used overflow-wrap:anywhere, which is what split "Fajr"
           down the page once the font outgrew its column. */
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kids-last {
        font-weight: 600;
        font-size: 12px;
        font-size: clamp(10px, 1.6cqw, 23px);
        color: #718078;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kids-pill {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: clamp(6px, .9cqw, 14px);
        background: rgba(228, 242, 213, .96);
        /* Pale green on a pale blue sky needs an edge to read as a pill;
           without it the countdown looked like floating text. */
        border: 2px solid rgba(95, 143, 80, .38);
        border-radius: 999px;
        padding: clamp(6px, .9cqw, 14px) clamp(10px, 1.6cqw, 24px);
      }
      .kids-pill-ico { width: 1.5em; height: 1.5em; flex: 0 0 auto; font-size: clamp(14px, 2.6cqw, 40px); }
      .kids-pill-ico svg, .kids-row-rel-ico svg, .kids-hijri-ico svg,
      .kids-list-ico svg, .kids-row-ico svg, .kids-row-mark svg,
      .kids-foot-ico svg { width: 100%; height: 100%; display: block; }
      .kids-pill-val {
        display: block;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        font-size: 20px;
        font-size: clamp(16px, 2.9cqw, 44px);
        line-height: 1.1;
        color: #163D2D;
        white-space: nowrap;
      }
      .kids-list {
        background: #FFFDF7;
        border-radius: clamp(14px, 2cqw, 28px);
        margin: clamp(6px, .8cqw, 12px);
        padding: clamp(10px, 1.3cqw, 20px) clamp(10px, 1.4cqw, 22px) clamp(8px, 1cqw, 14px);
      }
      .kids-list-head {
        display: flex;
        align-items: center;
        gap: .3em;
        margin-bottom: clamp(6px, .9cqw, 14px);
      }
      .kids-list-ico { width: 1em; height: 1em; flex: 0 0 auto; font-size: clamp(15px, 2.6cqw, 38px); }
      .kids-list-title {
        flex: 1 1 auto;
        font-weight: 800;
        font-size: 18px;
        font-size: clamp(15px, 2.6cqw, 38px);
        color: #163D2D;
      }
      .kids-hijri {
        flex: 0 1 auto;
        display: flex;
        align-items: center;
        gap: .35em;
        font-weight: 600;
        font-size: 11px;
        font-size: clamp(10px, 1.35cqw, 20px);
        color: #718078;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kids-hijri-ico { width: 1.2em; height: 1.2em; flex: 0 0 auto; }
      .kids-row {
        display: flex;
        align-items: center;
        gap: clamp(6px, 1cqw, 16px);
        padding: clamp(6px, .85cqw, 14px) clamp(8px, 1.4cqw, 24px);
        border-radius: clamp(12px, 1.4cqw, 20px);
        /* Transparent on every row so the active border never shifts
           a row's height. */
        border: 2px solid transparent;
        background: #FAF8F0;
      }
      .kids-row + .kids-row { margin-top: clamp(3px, .45cqw, 7px); }
      .kids-row.active { background: #E4F2D5; border-color: #5F8F50; }
      /* Reserved whether or not a tick is in it, so every prayer name
         starts on the same vertical line. */
      .kids-row-mark { width: 1.3em; height: 1.3em; flex: 0 0 auto; font-size: clamp(13px, 1.9cqw, 28px); }
      .kids-row-ico { width: 1.6em; height: 1.6em; flex: 0 0 auto; font-size: clamp(13px, 1.9cqw, 28px); }
      .kids-row-name {
        flex: 1 1 auto;
        min-width: 0;
        font-weight: 600;
        font-size: 15px;
        font-size: clamp(13px, 1.9cqw, 28px);
        color: #163D2D;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .kids-row.active .kids-row-name { font-weight: 800; }
      .kids-row-rel {
        flex: 0 0 auto;
        display: flex;
        align-items: center;
        gap: .3em;
        font-weight: 600;
        font-size: 12px;
        font-size: clamp(10px, 1.45cqw, 21px);
        color: #718078;
        white-space: nowrap;
      }
      .kids-row-rel-ico { width: 1.3em; height: 1.3em; flex: 0 0 auto; }
      .kids-row-time {
        flex: 0 0 auto;
        font-weight: 800;
        font-variant-numeric: tabular-nums;
        font-size: 15px;
        font-size: clamp(13px, 1.9cqw, 28px);
        color: #163D2D;
      }
      .kids-foot {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: .4em;
        margin-top: clamp(6px, .9cqw, 12px);
        font-weight: 600;
        font-size: 10px;
        font-size: clamp(9px, 1.1cqw, 15px);
        color: #718078;
        opacity: .75;
      }
      .kids-foot-ico { width: 1em; height: 1em; flex: 0 0 auto; }
      .kids-foot-ico svg { stroke: currentColor; }
      /* Encouragement pill — shown in both versions; it is a kids card and
         the message is the point. Night-only would read as a bug ("why did
         it go away at noon?"). */
      .kids-cheer {
        display: block;
        width: fit-content;
        margin: clamp(8px, 1.1cqw, 16px) auto 0;
        padding: clamp(5px, .7cqw, 11px) clamp(12px, 1.8cqw, 26px);
        border-radius: 999px;
        background: #E4F2D5;
        font-weight: 800;
        font-size: 13px;
        font-size: clamp(11px, 1.5cqw, 22px);
        color: #163D2D;
        text-align: center;
      }

      /* ── Night version ──────────────────────────────────────────────
         Only colours change here; the structure, sizes and container
         queries above are shared. _kidsIsNight drives the class off the
         prayer schedule (Maghrib → Fajr), not off the dashboard theme. */
      .kids.night { background: #0E2347; }
      .kids.night .kids-eyebrow { color: #A8C6F0; }
      .kids.night .kids-next { color: #F2F7FF; }
      .kids.night .kids-last { color: #A8BEDD; }
      .kids.night .kids-pill { background: rgba(31, 62, 110, .94); border-color: rgba(168, 198, 240, .3); }
      .kids.night .kids-pill-val { color: #F2F7FF; }
      .kids.night .kids-list { background: #13294D; }
      .kids.night .kids-list-title { color: #F2F7FF; }
      .kids.night .kids-hijri { color: #A8BEDD; }
      .kids.night .kids-row { background: #1F3F72; }
      .kids.night .kids-row-name,
      .kids.night .kids-row-time { color: #F2F7FF; }
      .kids.night .kids-row-rel { color: #A8BEDD; }
      .kids.night .kids-row.active { background: #23493B; border-color: #6FA95C; }
      .kids.night .kids-cheer { background: rgba(31, 62, 110, .92); color: #EAF2FF; }
      .kids.night .kids-foot { color: #A8BEDD; }
      /* The calendar glyph is drawn with a dark outline for the cream
         panel; on navy it needs the inverse. */
      .kids.night .kids-list-ico svg rect { fill: #15305C; stroke: #A8C6F0; }
      .kids.night .kids-list-ico svg path[stroke] { stroke: #A8C6F0; }
      /* Narrow card: the countdown pill drops under the name instead of
         fighting it for the same row, and the per-row extras that would
         crowd a short line are dropped. @container, not @media — this is
         about the card's width, not the window's. */
      @container (max-width: 560px) {
        .kids-banner {
          flex-direction: column; align-items: stretch;
          gap: clamp(6px, 2cqw, 12px);
          height: auto; padding-inline: 20cqw clamp(12px, 3cqw, 20px);
        }
        .kids-pill { align-self: flex-start; }
        .kids-next { font-size: clamp(20px, 8.5cqw, 42px); }
        .kids-pill-val { font-size: clamp(16px, 5.6cqw, 30px); }
        .kids-pill-ico { font-size: clamp(14px, 5cqw, 28px); }
        .kids-eyebrow { font-size: clamp(9px, 2.5cqw, 13px); }
        .kids-last { font-size: clamp(10px, 2.9cqw, 15px); }
        .kids-list-title, .kids-list-ico { font-size: clamp(15px, 5cqw, 24px); }
        .kids-hijri { display: none; }
        .kids-row-rel { display: none; }
        .kids-row-name, .kids-row-time, .kids-row-ico, .kids-row-mark {
          font-size: clamp(13px, 4cqw, 19px);
        }
        .kids-cheer { font-size: clamp(11px, 3.4cqw, 16px); }
      }
    `;
  }
}

class NidaCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config || { card_type: "now" };
    // Only push the new data into the existing form; rebuilding it would
    // close an open dropdown.
    if (this._form) this._form.data = this._config;
    else this._render();
  }

  set hass(hass) {
    this._hass = hass;
    // hass changes on every state update in HA. Rebuilding the form each
    // time made the card-type dropdown flicker shut before it could be used.
    if (this._form) this._form.hass = hass;
    else this._render();
  }

  _lang() {
    const raw = this._hass?.language || this._hass?.locale?.language || "en";
    const l = String(raw).slice(0, 2).toLowerCase();
    return STRINGS[l] ? l : "en";
  }

  _render() {
    if (!this._hass) return;
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
              { value: "scene_now", label: t.editor_card_type_scene_now },
              { value: "scene_today", label: t.editor_card_type_scene_today },
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
    this._form = form;
    this.innerHTML = "";
    this.appendChild(form);
  }
}

// 2.4.0 — the kids card is specified in Nunito. Injected once into
// document.head (a shadow-root @import cannot reach the document's font
// cache reliably), and only when that variant is actually rendered, so the
// now/today cards cost no extra request. The CSS falls back to Quicksand
// and then the system stack, so a blocked or offline Google Fonts leaves
// the card readable rather than broken.
const KIDS_FONT_HREF =
  "https://fonts.googleapis.com/css2?family=Nunito:wght@600;700;800&display=swap";
function ensureKidsFont() {
  if (document.head.querySelector(`link[href="${KIDS_FONT_HREF}"]`)) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = KIDS_FONT_HREF;
  document.head.appendChild(link);
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

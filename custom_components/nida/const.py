"""Nida constanten — domain, sound-categorieën, gebedsnamen, sensor entity_ids.

Changelog:
  2.2.2 (2026-07-12): Mac-shortcut duck. Johann's MacBook, exposed via HA's
                       Apple TV/AirPlay-receiver integration, turned out to
                       only control audio being AirPlayed TO it, not local
                       playback — volume_set even failed outright ("audio
                       is blocked") whenever nothing was actively AirPlaying
                       to it. New OPT_DUCK_MAC_SHORTCUT_ENABLED +
                       OPT_DUCK_MAC_SHORTCUT_NOTIFY (a notify.* target,
                       typically the macOS Companion app) plus two fixed
                       message constants (DUCK_MAC_SHORTCUT_DUCK_MESSAGE /
                       _RESTORE_MESSAGE) a macOS 27+ Shortcuts automation
                       can watch for, to actually mute/restore the Mac's
                       own local audio via a user-built Shortcut. See
                       services.py's changelog for the send-side logic.
  2.1.35 (2026-07-11): Fajr wake-up alarm (Johann: "hebben we een fajr
                       wekker voor ramadan?") + countdown-to-Ramadan pill
                       (frontend-only, no new const.py options). Ramadan-
                       only (confirmed via AskUserQuestion), gated the same
                       way as the other 2.1.34 Ramadan features. Wakes the
                       user OPT_FAJR_ALARM_MINUTES before Fajr — Fajr, not
                       Imsak, since Johann described this as a wake-up
                       alarm for cooking prep time, distinct from the
                       suhoor-ending reminder. New options:
                       OPT_FAJR_ALARM_ENABLED/MINUTES/SCENE (an existing
                       HA scene.* entity the user picks, e.g. a "wake-up
                       light")/TRANSITION_MINUTES (forwarded as
                       scene.turn_on's `transition` field in seconds — HA
                       docs confirm scenes support this for lights) and
                       OPT_FAJR_ALARM_SOUND_MODE (together|delayed — sound
                       fires at wake time, or only once the light
                       transition finishes, for a gentler wake-up).
                       OPT_FAJR_ALARM_SOUND/MEDIA_PLAYER/VOLUME are an
                       independent sound setup (Johann's choice via
                       AskUserQuestion: "een apart wek-geluid met eigen
                       speaker/volume", not the Fajr adhan sound reused).
                       The sound picker deliberately reuses the Sound
                       Library's existing pre_adhan_jingle category
                       (a short attention sound is exactly what a jingle
                       already is) rather than inventing a new external
                       manifest category that doesn't exist upstream —
                       the chosen rel_path is stored independently
                       (fajr_alarm_sound) from sound_pre_adhan_jingle so
                       it doesn't have to match the user's regular
                       pre-adhan jingle. See scheduler.py's changelog for
                       the trigger-side implementation.
  2.1.34 (2026-07-11): Ramadan features (Johann: "wat kunnen we inbouwen
                       voor ramadan?"). Four additions, all gated on "is
                       today within Ramadan" (Hijri month 9 —
                       HIJRI_MONTH_RAMADAN), checked directly against the
                       coordinator's own already-fetched Hijri data, no
                       extra API call needed:
                       (1) OPT_IMSAK_OFFSET_MIN — was already a de-facto
                       option key written by the panel (imsak_offset_min)
                       but never had a proper OPT_* constant on the
                       backend; added one so scheduler.py can read it too
                       (see next point).
                       (2) Suhoor reminder — OPT_SUHOOR_REMINDER_* — fires
                       N minutes before the (offset-adjusted) Imsak time,
                       reusing the existing general OPT_NOTIFY_TARGETS
                       list rather than adding yet another target picker.
                       (3) Iftar reminder — OPT_IFTAR_REMINDER_* — same
                       idea, N minutes before Maghrib. Plus an optional
                       auto-played dua AT Maghrib (OPT_IFTAR_DUA_ENABLED +
                       OPT_IFTAR_DUA_ID), reusing the existing
                       nida.play_dua service (2.0.51) so it behaves
                       identically to pressing "Use" on that dua by hand.
                       (4) Laylatul Qadr / last-10-nights —
                       OPT_CALENDAR_LAYLATUL_QADR_ENABLED +
                       LAYLATUL_QADR_NIGHTS/LAYLATUL_QADR_DATES — a fifth
                       Islamic Calendar reminder type (odd nights 21/23/
                       25/27/29 of Ramadan) alongside Holidays/Ashura-
                       Arafah/White Days/Weekly Sunnah, sharing their fire
                       time + target list. Also required a real
                       sensor.nida_imsak entity (sensor.py) — the panel's
                       Today-card Imsak row already referenced this
                       entity_id (2.0.9x-era comment) but the sensor was
                       never actually built, so the row was silently
                       hiding on every install; fixed as part of this
                       work since the suhoor reminder needs the same
                       Imsak timing anyway.
  2.1.26 (2026-07-09): Duck media players. New OPT_DUCK_MEDIA_ENABLED +
                       OPT_DUCK_MEDIA_PLAYERS — Johann wants selected
                       media players (music/video, unrelated to the adhan
                       speakers themselves) paused before the pre-adhan
                       jingle or the adhan plays, with their volume saved
                       and restored before resuming, so a saved-then-
                       resumed player doesn't come back at the wrong
                       level. See services.py for the pause/resume logic.
  2.1.0 (2026-07-08): Islamic Calendar reminders — new option keys
                       (OPT_CALENDAR_*) and fixed-date tables
                       (ISLAMIC_HOLIDAYS, ASHURA_ARAFAH_DATES, WHITE_DAYS,
                       WEEKLY_SUNNAH_WEEKDAYS) for four reminder types:
                       Holidays (with lead-time), Ashura/Arafah fasting,
                       White Days, Weekly Sunnah fasting. See the section
                       comment above these constants for why Aladhan's own
                       `holidays` field isn't used (wrong list — Sufi
                       scholar anniversaries, not the widely-observed
                       occasions this ports from the Android app).
  2.0.95 (2026-07-08): New OPT_NOTIFY_TTS_WORKAROUND_TARGETS
                       ("notify_tts_workaround_targets") — per-target
                       opt-in for the Android TTS/alarm-stream workaround
                       needed on Samsung devices where critical
                       notifications stay silent regardless of channel/
                       importance (OS-level block, see scheduler.py).
  2.0.90 (2026-07-07): OPT_NOTIFY_CRITICAL_ENABLED (single master flag,
                       2.0.89) replaced by OPT_NOTIFY_CRITICAL_ENABLED_
                       PREFIX ("notify_critical_enabled_"), per prayer —
                       mirrors OPT_NOTIFY_ENABLED_PREFIX. Corrects 2.0.89
                       before it shipped on the backend: critical is a
                       per-prayer choice, not all-or-nothing.
  2.0.89 (2026-07-07): New OPT_NOTIFY_CRITICAL_ENABLED ("notify_critical_
                       enabled"), backend half of the panel's "Critical
                       notifications" toggle. Used by scheduler.py's
                       adhan-time notify handler only (not Jumu'ah).
                       SUPERSEDED by 2.0.90.
  2.0.61 (2026-07-03): Dua triggers. Each dua dict may carry a
                       trigger_entity; __init__.py auto-plays the dua
                       when that entity turns on/open, rate-limited by
                       DUA_TRIGGER_COOLDOWN_SECONDS (60) per dua.
  2.0.56 (2026-07-03): Per-language TTS default messages. New
                       DEFAULT_TTS_MESSAGES dict (mirror of the panel's
                       TTS_DEFAULT_MESSAGES, must stay identical);
                       DEFAULT_TTS_PRE_ADHAN_MESSAGE_FALLBACK now
                       derives from its "en" entry. services.py uses it
                       to auto-follow the resolved TTS language when
                       the stored message is empty or a known default.
  2.0.52 (2026-07-02): Random adhan. New option random_adhan_enabled
                       (default False): play_adhan picks a random
                       locally downloaded sound from the prayer's
                       category instead of the fixed choice. Falls back
                       to the configured sound when nothing qualifies.
  2.0.51 (2026-07-02): Duas. New options duas (list of per-dua configs,
                       each with its own media player and volume) and
                       dua_catalog_url (second manifest, default
                       majikan.nl/nida/dua/manifest.json). New category
                       constant SOUND_CATEGORY_DUA — deliberately NOT
                       added to SOUND_CATEGORIES so the sound_/volume_
                       option loops stay untouched. Playback via
                       nida.play_dua and per-dua button entities.
  2.0.46 (2026-07-02): Bezoekersmodus krijgt een duur. Nieuwe opties
                       guest_mode_hours (1-24, default 4) en
                       guest_mode_until (ISO-timestamp, gezet door het
                       paneel bij inschakelen). services.py beschouwt
                       de modus als actief zolang enabled=True en de
                       until-tijd niet verstreken is; ontbreekt until
                       dan geldt "aan tot handmatig uit". Lazy expiry —
                       geen achtergrond-timer nodig, de vergelijking
                       gebeurt op het afspeelmoment.
  2.0.45 (2026-07-02): Bezoekersmodus (guest mode). Nieuwe optie
                       guest_mode_enabled (default False): zolang aan
                       slaan play_adhan, play_pre_adhan_jingle en
                       speak_pre_adhan hun audio over. Testknoppen
                       blijven werken (expliciete gebruikersactie).
                       Paneel-subgroep heet nu "Geluidsmodi".
  2.0.41 (2026-07-01): Open-contact volume toegevoegd als tweede
                       volume-aanpassing naast night mode. Nieuwe
                       opties open_contact_enabled (default False),
                       open_contact_sensors (lijst binary_sensor
                       entity_ids, device_class door/window/opening),
                       open_contact_volume_factor (percentage van
                       normaal, default 130 = luider). services.py
                       neemt bij meerdere actieve condities de LAAGSTE
                       factor (stilste wint), zodat een luide open-
                       contact-boost 's nachts niet wint van night
                       mode.
  2.0.32 (2026-06-29): TTS pre-adhan announcement opties toegevoegd
                       (enabled/services list/message/delay). Fires
                       AFTER pre_adhan_jingle op dezelfde speakers.
                       Taal volgt paneel-instelling. Empty services
                       list = silent no-op zelfs als enabled.
  2.0.29 (2026-06-29): DEFAULT_CATALOG_URL gezet op
                       https://majikan.nl/nida/adhan/manifest.json
                       zodat nieuwe installs meteen items zien zonder
                       config-stap.
  2.0.28 (2026-06-29): OPT_CATALOG_URL + DEFAULT_CATALOG_URL toegevoegd
                       voor de Sound Library catalog-fetcher. Schema in
                       de comment hierboven. User stelt z'n eigen
                       server-URL in via options flow.
  2.0.23 (2026-06-28): OPT_VOLUME_PRE_ADHAN_TEST + DEFAULT_VOLUME_PRE_ADHAN_TEST
                       toegevoegd voor de play/stop pre-adhan test in
                       het paneel — krijgt z'n eigen volume zoals de
                       Speakers-test. Service play_pre_adhan_test in
                       services.py gebruikt deze key.
  2.0.22 (2026-06-28): Drie features in één — pre-adhan audio playback,
                       speakers test play/stop + eigen volume, en
                       night-mode volume reductie. Nieuwe options:
                       pre_adhan_audio_enabled (default True),
                       volume_test (default 30), night_mode_enabled
                       (default False), night_start "22:00",
                       night_end "07:00", night_volume_factor 50.
                       De night_volume_factor is een percentage van
                       de normale volume binnen het tijd-window —
                       services.py past het toe op alle play_*
                       service calls.
  2.0.18 (2026-06-28): OPT_JUMUAH_TARGETS toegevoegd — Jumu'ah heeft nu
                       een eigen target-lijst los van de algemene
                       notify_targets (use case: niet alle gezinsleden
                       hoeven die specifieke reminder, e.g. vrouwen).
                       Plus TEST_SOUND_PATH voor de Speakers-test
                       knop — een speciale jingle ipv de Dhuhr-adhan.
                       Gebruiker moet sounds/test/test_jingle.mp3 zelf
                       aanleveren.
  2.0.17 (2026-06-28): OPT_THEME + theme-constanten toegevoegd voor de
                       light/dark/auto picker in de header. Default
                       blijft dark — bestaande installaties merken
                       niets tot ze in het paneel actief switchen.
  2.0.15 (2026-06-28): Notification + Jumu'ah constanten toegevoegd voor
                       Release B. Notifications: master toggle, targets
                       (list of notify.* services), title, message
                       (with [prayer] placeholder), per-prayer enabled
                       toggles. Jumu'ah (Friday): reminder enabled,
                       minutes-before-Dhuhr (30-120, default 60),
                       message (with [minutes] placeholder). Backend
                       defaults zijn fallbacks — panel vult bij eerste
                       init de tekst-defaults in op basis van de
                       actieve paneel-taal.
  2.0.13 (2026-06-28): DEFAULT_VOLUMES bijgesteld op Johanns voorkeur
                       (fajr_adhan 10, adhan 20, pre_adhan_jingle 20)
                       en optionele tweede pre-adhan reminder
                       toegevoegd: OPT_PRE_ADHAN_TWO_ENABLED +
                       OPT_PRE_ADHAN_MINUTES_2 + DEFAULT_PRE_ADHAN_MINUTES_2.
                       Scheduler plant beide reminders als
                       pre_adhan_two_enabled True is.
  2.0.12 (2026-06-28): OPT_VOLUME_PREFIX + DEFAULT_VOLUMES toegevoegd voor
                       de panel volume-sliders per sound-categorie.
                       Volumes worden als int 0-100 opgeslagen in options
                       (volume_fajr_adhan, volume_adhan,
                       volume_pre_adhan_jingle); services.py rekent ze om
                       naar de 0.0-1.0 float die media_player.volume_set
                       wil.
  2.0.7 (2026-06-28): OPT_PRE_ADHAN_MINUTES + DEFAULT_PRE_ADHAN_MINUTES
                      toegevoegd voor de pre-adhan reminder feature.
                      Scheduler plant nu een tweede trigger N min vóór
                      elke adhan die een persistent_notification stuurt.
  2.0.1 (2026-06-28): DEFAULT_SOUNDS toegevoegd — de drie standaard mp3-paden
                      die meegeleverd worden in sounds/. Worden door
                      services.py gebruikt als fallback wanneer
                      options.sound_<categorie> niet gezet is. Plus
                      OPT_ADHAN_MEDIA_PLAYERS option-key voor de scheduler.
  2.0.0 (2026-06-27): Sensor-set herzien — PRAYERS afgeschaald van 9 naar de
                      5 gebeden met adhan (imsak/sunrise/sunset/midnight eruit,
                      komen pas terug bij Ramadan-herbouw). Entity_id-naamgeving
                      gewijzigd van volgnummer-prefix (sensor.02_fajr) naar
                      domain-prefix (sensor.nida_fajr) — geen migratie, schone
                      herbouw. Sound-categorieën (fajr_adhan/adhan/pre_adhan_jingle)
                      vervangen de oude per-gebed _SOUND_FIELDS.
"""
from __future__ import annotations

DOMAIN = "nida"

# ─────────────────────────────────────────────────────────────────────────────
# Config flow / options keys (basisinstellingen, niet sound-gerelateerd)
# ─────────────────────────────────────────────────────────────────────────────
CONF_CITY = "city"
CONF_COUNTRY = "country"
CONF_METHOD = "method"

# ─────────────────────────────────────────────────────────────────────────────
# Gebeden — alleen de 5 met een adhan-afspeelmoment. imsak/sunrise/sunset/
# midnight zijn bewust geschrapt in 2.0.0 fase 1 (zie changelog hierboven);
# komen terug zodra Ramadan/vasten-features herbouwd worden.
# ─────────────────────────────────────────────────────────────────────────────
PRAYERS = ("fajr", "dhuhr", "asr", "maghrib", "isha")

ADHAN_PRAYERS = PRAYERS

# ─────────────────────────────────────────────────────────────────────────────
# Sound-categorieën
# ─────────────────────────────────────────────────────────────────────────────
SOUND_CATEGORY_FAJR_ADHAN = "fajr_adhan"
SOUND_CATEGORY_ADHAN = "adhan"
SOUND_CATEGORY_PRE_ADHAN_JINGLE = "pre_adhan_jingle"

SOUND_CATEGORIES = (
    SOUND_CATEGORY_FAJR_ADHAN,
    SOUND_CATEGORY_ADHAN,
    SOUND_CATEGORY_PRE_ADHAN_JINGLE,
)

PRAYER_SOUND_CATEGORY = {
    "fajr": SOUND_CATEGORY_FAJR_ADHAN,
    "dhuhr": SOUND_CATEGORY_ADHAN,
    "asr": SOUND_CATEGORY_ADHAN,
    "maghrib": SOUND_CATEGORY_ADHAN,
    "isha": SOUND_CATEGORY_ADHAN,
}

OPT_ENABLED_PREFIX = "enabled_"
OPT_SOUND_PREFIX = "sound_"

# Volume per sound-categorie. Opgeslagen als int 0-100 (UI-friendly).
# services.py converteert naar float 0.0-1.0 voor media_player.volume_set.
# Defaults zijn bewust laag — adhan/fajr-adhan kan in een rustige woonkamer
# luid overkomen; gebruiker kan in het paneel altijd hoger. Fajr lager
# dan de dag-adhan omdat het 's ochtends vroeg afgaat.
OPT_VOLUME_PREFIX = "volume_"
DEFAULT_VOLUMES = {
    SOUND_CATEGORY_FAJR_ADHAN: 10,
    SOUND_CATEGORY_ADHAN: 20,
    SOUND_CATEGORY_PRE_ADHAN_JINGLE: 20,
}

OPT_ADHAN_MEDIA_PLAYERS = "adhan_media_players"

OPT_PRE_ADHAN_MINUTES = "pre_adhan_minutes"
DEFAULT_PRE_ADHAN_MINUTES = 25

# Per-prayer pre-adhan enable toggle (2.0.38). Lets the user suppress
# pre-adhan reminders for individual prayers (e.g. Fajr at 04:30) while
# keeping them for the rest. Key shape: pre_adhan_enabled_<prayer>.
# Missing = True (backward compat for users upgrading from <2.0.38).
OPT_PRE_ADHAN_ENABLED_PREFIX = "pre_adhan_enabled_"

# Optional second pre-adhan reminder. When `pre_adhan_two_enabled` is True,
# the scheduler plants a second persistent_notification at
# `pre_adhan_minutes_2` minutes before each adhan. Notification-ids are
# distinct so the two reminders don't overwrite each other.
OPT_PRE_ADHAN_TWO_ENABLED = "pre_adhan_two_enabled"
OPT_PRE_ADHAN_MINUTES_2 = "pre_adhan_minutes_2"
DEFAULT_PRE_ADHAN_MINUTES_2 = 10

# Whether to play the pre-adhan jingle audio on the configured adhan
# speakers at each pre-reminder moment. The notification is always sent
# (regardless of this); this toggle controls only the audio. Default
# ON because users who configured pre-reminders typically also want
# the audible cue — they can disable for quiet hours via night mode.
OPT_PRE_ADHAN_AUDIO_ENABLED = "pre_adhan_audio_enabled"
DEFAULT_PRE_ADHAN_AUDIO_ENABLED = True

# Speakers-test volume (0-100). Separate from volume_adhan so users
# can run quieter tests without disturbing the household. Honoured by
# nida.play_test_sound.
OPT_VOLUME_TEST = "volume_test"
DEFAULT_VOLUME_TEST = 30

# Pre-adhan test playback volume (0-100). Separate from
# volume_pre_adhan_jingle (the scheduled-playback volume) so the user
# can test loudly without changing the volume that actually fires N
# minutes before each adhan. Honoured by nida.play_pre_adhan_test.
OPT_VOLUME_PRE_ADHAN_TEST = "volume_pre_adhan_test"
DEFAULT_VOLUME_PRE_ADHAN_TEST = 30

# Sound catalog. URL of a JSON document listing available sounds.
# Default points at majikan.nl/nida/adhan/manifest.json (Johann's own
# server) — schema documented inline in catalog.py's _adapt_item.
# Empty allowed: user can repoint to a self-hosted mirror via panel.
OPT_CATALOG_URL = "catalog_url"
DEFAULT_CATALOG_URL = "https://majikan.nl/nida/adhan/manifest.json"

# TTS pre-adhan announcement (2.0.32). Fires AFTER the pre-adhan
# jingle, on the same adhan speakers, via one or more user-selected
# TTS entities (Google Translate, Nabu Casa Cloud, Piper, etc.).
# Language follows the panel language at fire time so the message is
# pronounced correctly. Empty services list = nothing fires even if
# the master toggle is on.
OPT_TTS_PRE_ADHAN_ENABLED = "tts_pre_adhan_enabled"
OPT_TTS_PRE_ADHAN_SERVICES = "tts_pre_adhan_services"
OPT_TTS_PRE_ADHAN_MESSAGE = "tts_pre_adhan_message"
OPT_TTS_PRE_ADHAN_DELAY = "tts_pre_adhan_delay_seconds"
OPT_TTS_PRE_ADHAN_LANGUAGE = "tts_pre_adhan_language"
DEFAULT_TTS_PRE_ADHAN_ENABLED = False
DEFAULT_TTS_PRE_ADHAN_SERVICES: list[str] = []
# 2.0.56 — per-language default pre-adhan TTS messages. MUST stay
# byte-identical to NidaPanel.TTS_DEFAULT_MESSAGES in nida-panel.js:
# both sides detect "user has not customised the message" by exact
# match against this set, so a stored default written by the panel has
# to be recognised here (and vice versa). services.py resolves the
# effective message at speak time: stored value if customised, else the
# sentence matching the resolved TTS language.
DEFAULT_TTS_MESSAGES = {
    "en": "It's almost time for [prayer] prayer",
    "nl": "Het is bijna tijd voor [prayer]",
    "ar": "حان وقت صلاة [prayer] تقريباً",
    "tr": "[prayer] namazı için neredeyse vakit geldi",
    "de": "Es ist fast Zeit für das [prayer]-Gebet",
    "fr": "C'est presque l'heure de la prière [prayer]",
    "ms": "Hampir tiba waktu solat [prayer]",
    "id": "Sudah hampir waktu salat [prayer]",
    "ur": "[prayer] کی نماز کا وقت تقریباً ہو گیا ہے",
    "fa": "تقریباً وقت نماز [prayer] است",
}
DEFAULT_TTS_PRE_ADHAN_MESSAGE_FALLBACK = DEFAULT_TTS_MESSAGES["en"]
DEFAULT_TTS_PRE_ADHAN_DELAY = 5
# "auto" = follow panel language, which itself falls back to HA system.
DEFAULT_TTS_PRE_ADHAN_LANGUAGE = "auto"

# ─────────────────────────────────────────────────────────────────────────────
# Night mode — reduces all play_* service volumes by a factor during a
# user-defined time window. Useful for keeping the Fajr adhan audible
# but not jarring at 4 AM. The factor is a PERCENTAGE of the normal
# volume (50 means "half as loud as configured"), so existing settings
# stay meaningful — user doesn't have to dial down each category.
#
# Times are "HH:MM" strings in HA's local timezone. The window may
# cross midnight (e.g. 22:00 → 07:00); services.py handles both cases.
# ─────────────────────────────────────────────────────────────────────────────
OPT_NIGHT_MODE_ENABLED = "night_mode_enabled"
OPT_NIGHT_START = "night_start"
OPT_NIGHT_END = "night_end"
OPT_NIGHT_VOLUME_FACTOR = "night_volume_factor"
DEFAULT_NIGHT_MODE_ENABLED = False
DEFAULT_NIGHT_START = "22:00"
DEFAULT_NIGHT_END = "07:00"
DEFAULT_NIGHT_VOLUME_FACTOR = 50

# ─────────────────────────────────────────────────────────────────────────────
# Open-contact volume (2.0.41) — a second volume-adjust condition alongside
# night mode. When enabled AND any of the configured binary_sensors reads
# "on" (open), the play volume is multiplied by open_contact_volume_factor/100
# at fire time (services.py reads the live sensor state at the adhan moment).
# The factor is a PERCENTAGE of the normal volume, same convention as night
# mode; values above 100 boost (result still capped at 1.0), below 100 reduce.
# Sensors are binary_sensor entity_ids, typically device_class door/window/
# opening/garage_door. When both night mode and open-contact apply at the same
# time, services.py takes the LOWEST factor (quietest wins) so a loud open-
# contact boost never overrides night quiet.
# ─────────────────────────────────────────────────────────────────────────────
OPT_OPEN_CONTACT_ENABLED = "open_contact_enabled"
OPT_OPEN_CONTACT_SENSORS = "open_contact_sensors"   # list of binary_sensor entity_ids
OPT_OPEN_CONTACT_VOLUME_FACTOR = "open_contact_volume_factor"
DEFAULT_OPEN_CONTACT_ENABLED = False
DEFAULT_OPEN_CONTACT_VOLUME_FACTOR = 130

# 2.1.26 — duck (pause) other media players while the pre-adhan jingle or
# the adhan itself is playing. Deliberately no separate "applies to
# pre-adhan too?" toggle — Johann asked for both together, so it's a
# single enabled flag covering both playback events.
OPT_DUCK_MEDIA_ENABLED = "duck_media_enabled"
OPT_DUCK_MEDIA_PLAYERS = "duck_media_players"   # list of media_player entity_ids
DEFAULT_DUCK_MEDIA_ENABLED = False

# 2.2.2 — Mac-shortcut duck. A media_player entity exposed via HA's Apple
# TV/AirPlay-receiver integration only controls audio being AirPlayed TO
# the Mac, not audio it's playing locally through its own speakers —
# Johann confirmed volume_set on his MacBook fails with "audio is
# blocked" whenever nothing is actively AirPlaying to it, and even when
# it works it's the wrong audio path entirely. There's no HA entity that
# can mute/pause a Mac's own local playback directly. Instead: fire a
# fixed, recognisable notification via a user-chosen notify.* target
# (typically their macOS Companion app's own notify service) that a
# macOS 27+ (Sequoia) Shortcuts automation can watch for — "when a
# notification from Home Assistant contains <message>" — and run a
# Shortcut the user builds themselves (e.g. a "Set Volume" action) to
# actually mute/restore their local audio. Deliberately NOT tied to
# OPT_DUCK_MEDIA_PLAYERS' "is anything playing" check: Nida has no
# visibility into the Mac's own playback state, so this fires
# unconditionally on every duck/restore cycle when enabled — it's up to
# the user's own Shortcut to decide what "mute" means for them. The two
# message strings are fixed (not user-configurable) so the panel can
# show them as copy-paste instructions for the Shortcuts automation's
# match condition.
OPT_DUCK_MAC_SHORTCUT_ENABLED = "duck_mac_shortcut_enabled"
DEFAULT_DUCK_MAC_SHORTCUT_ENABLED = False
OPT_DUCK_MAC_SHORTCUT_NOTIFY = "duck_mac_shortcut_notify"   # "notify.<x>" full service path
DEFAULT_DUCK_MAC_SHORTCUT_NOTIFY = ""
DUCK_MAC_SHORTCUT_DUCK_MESSAGE = "nida-duck"
DUCK_MAC_SHORTCUT_RESTORE_MESSAGE = "nida-restore"

# 2.2.3 — restore what was playing ON THE ADHAN SPEAKERS themselves.
# Distinct from duck-media above: that pauses OTHER players (a TV in
# another room) and never touches the adhan speakers, so music playing on
# the adhan speaker itself was simply overwritten by the adhan and never
# came back. Johann: "ik heb als ik muziek luister dan de mediaplayer
# daarna niet hersteld ... het zou fijn zijn als muziek erna hersteld".
# Sonos gets sonos.snapshot/restore (with_group, so a grouped zone comes
# back grouped and at the same queue position); everything else falls
# back to saving volume_level + state and re-issuing media_play, which
# resumes a paused stream but cannot restore an exact queue position.
OPT_RESTORE_PLAYBACK_ENABLED = "restore_playback_enabled"
DEFAULT_RESTORE_PLAYBACK_ENABLED = False

# 2.2.4 — pre-adhan dip. Johann, after 2.2.3 shipped: "volume wordt
# verhoogd terwijl de muziek nog speelt. Misschien is het rustiger als
# die iets verlaagd [wordt voor] de jingle en tts en daarna weer hersteld
# op de waarde voordat de pre-adhan ging." Setting the configured
# pre-adhan level BEFORE play_media means the music itself audibly jumps
# to that level for a moment first — jarring when the point of a
# pre-adhan is a gentle heads-up. So when the adhan speaker is already
# playing something (i.e. 2.2.3's snapshot captured it), the jingle/TTS
# instead plays at a percentage of whatever the music was already at,
# which is a reduction rather than a jump; the snapshot restore afterwards
# puts the original level back.
#
# Deliberately relative to the music's own level rather than a fixed
# volume: the user already chose a comfortable listening level, so a
# fraction of it is quiet-but-audible on any speaker, whereas a fixed
# level would be a jump-up again for anyone listening quietly.
# Deliberately NOT applied to the adhan itself — that one is meant to
# be heard at its configured volume, and Johann only asked about "de
# jingle en tts". Also deliberately not passed through
# _apply_volume_modifiers: night mode / open-contact already shaped the
# level the music is playing at right now, so scaling again would
# double-count them.
#
# Only has any effect when OPT_RESTORE_PLAYBACK_ENABLED is on (no
# snapshot otherwise) AND something was actually playing — an idle
# speaker still gets the normal configured pre-adhan volume.
# 2.3.2 — smooth the hand-over into the adhan. Johann: "de muziek wordt
# gepauzeerd en dat abrupt, er achteraan begint de adhan — zou die
# overgang beter kunnen." Until now the sequence was a hard cut: pause
# the music mid-note, snap the volume to the adhan level, start the
# adhan. Now, when something is genuinely playing, its volume is ramped
# down over fade_seconds, the player is paused while silent, and after a
# short beat the adhan starts. The pause happens at volume zero on
# purpose: without it, setting the adhan volume while the music is still
# running would blast the music at adhan level for the length of the gap.
#
# Costs a couple of seconds before the adhan actually sounds, so it is
# deliberately skipped entirely when nothing is playing — the common
# case, which stays exactly as immediate as before.
# 2.3.4 — Sonos announcements. Johann: "Sonos heeft toch ook een
# announcement manier?" — yes, and it's strictly better than everything
# we hand-roll around it. media_player.play_media accepts announce: True,
# which on Sonos goes through its native audioClip API: the speaker ducks
# whatever is playing, plays the clip at extra.volume, and restores the
# previous stream AND its volume itself. No snapshot, no fade, no
# _wait_until_idle polling, and — the part our own restore can never
# match — it resumes at the exact queue position rather than restarting
# the track.
#
# Deliberately opt-in, and default OFF, because of one real limitation:
# Sonos audioClip is built for short notification sounds. Long files can
# be cut off, so a 3-minute adhan is exactly the wrong shape for it,
# while the pre-adhan jingle and the speaker volume-test nasheed are
# exactly the right one. Rather than guess per sound, the toggle is
# yours; leave it off and everything keeps using the snapshot/fade path.
# Non-Sonos players in the same target list are unaffected either way —
# they always take the manual path, since announce is a no-op or an error
# on players that don't implement it.
# 2.3.12 — make Nida's notifications recognisable at a glance. Johann:
# "nu kan je geen onderscheid maken tussen een HA melding of nida melding
# ... en dan gaat het om Android en iOS." The two platforms allow very
# different things here, so this is deliberately not one setting:
#
#   ANDROID — the Companion app honours data.notification_icon, an
#   mdi:* name that REPLACES the Home Assistant logo in the status bar
#   and notification shade. This is a real, complete fix: the icon you
#   see is Nida's, not HA's. data.color tints it.
#
#   iOS — the app icon on a notification CANNOT be changed; it is the
#   Home Assistant app's, and only a Notification Service Extension
#   inside that app could alter it. Nothing we send changes that. What we
#   can do: data.push.thread-id groups all Nida notifications into their
#   own stack in Notification Centre (so they sit apart from other HA
#   ones rather than interleaved), and an attachment shows Nida's icon as
#   a thumbnail on the notification itself. The attachment is opt-in
#   because it makes the phone fetch an image for every single
#   notification.
NOTIFY_ICON_DEFAULT = "mdi:mosque"
OPT_NOTIFY_ICON = "notify_icon"            # mdi:* name, Android only
OPT_NOTIFY_ICON_COLOR = "notify_icon_color"
DEFAULT_NOTIFY_ICON_COLOR = "#1F7A4D"      # Nida green
OPT_NOTIFY_IOS_IMAGE_ENABLED = "notify_ios_image_enabled"
DEFAULT_NOTIFY_IOS_IMAGE_ENABLED = False
# 2.3.13 — the thing Johann actually wants: "ze [moeten] niet stapelen
# onder homeassistant, je ziet gewoon geen onderscheid." Both platforms
# bundle notifications per APP, so everything Nida sends lands on the
# same Home Assistant pile as every other automation. Each platform has
# exactly one key that splits that pile, and neither is the icon:
#
#   iOS     — push.thread-id. Notifications sharing a thread-id stack
#             together and separately from ones that don't.
#   Android — data.group. Same idea: a distinct group key makes Android
#             build its own bundle instead of folding them into the app's
#             default one.
#
# Fixed values rather than settings: their only job is to be stable and
# distinct, and a user-editable grouping key is a footgun (change it and
# old notifications stop grouping with new ones).
NOTIFY_THREAD_ID = "nida"
NOTIFY_GROUP = "nida"
# Android channel. Separate from the group: the channel is what appears
# as the source label under the app name, and it gives the user per-Nida
# notification settings (sound, importance, DND exception) in Android's
# own settings instead of one lump "Home Assistant" entry. Deliberately
# NOT applied to critical notifications — those must keep
# channel: "alarm_stream", a reserved value that routes audio over the
# alarm stream (see _critical_notify_data); overwriting it with a display
# name would silently undo the whole silent-mode bypass.
NOTIFY_CHANNEL = "Nida"
# Mirrored out of the integration's brand/ folder by helpers.py so the
# Companion app can actually fetch it over the HA connection.
# 2.3.15 — points at the 192px copy, not the 1024px brand icon: iOS
# renders this as a thumbnail, so the big one was ~200 kB fetched per
# notification for no visible gain.
NOTIFY_ICON_IMAGE_PATH = "/local/nida/brand/icon_notify.png"

# 2.3.15 — the big round image on an Android notification. Johann, on a
# screenshot of a live adhan notification: "kunnen we dat belletje nu
# veranderen in ons eigen logo?" That bell is the SMALL icon
# (notification_icon), which Android blows up to fill the circle whenever
# no large icon was supplied — and a small icon can only ever be a
# monochrome mdi path, never an image, so the logo cannot go there.
# data.icon_url can: it sets the large icon from an image URL, which is
# exactly the circle the bell was sitting in, and it keeps full colour.
#
# Points at a 192px copy rather than the 1024px brand icon: the large
# icon renders at roughly 64dp, so the big one would be ~200 kB fetched
# over mobile data per notification for no visible gain. Both live in
# brand/ and helpers.py mirrors the whole folder.
NOTIFY_LARGE_ICON_PATH = "/local/nida/brand/icon_notify.png"
OPT_NOTIFY_LARGE_ICON_ENABLED = "notify_large_icon_enabled"
DEFAULT_NOTIFY_LARGE_ICON_ENABLED = True

OPT_SONOS_ANNOUNCE_ENABLED = "sonos_announce_enabled"
DEFAULT_SONOS_ANNOUNCE_ENABLED = False

OPT_FADE_ENABLED = "fade_enabled"
DEFAULT_FADE_ENABLED = True
OPT_FADE_SECONDS = "fade_seconds"
DEFAULT_FADE_SECONDS = 2
FADE_SECONDS_MIN = 0
FADE_SECONDS_MAX = 10

OPT_PRE_ADHAN_DIP_ENABLED = "pre_adhan_dip_enabled"
DEFAULT_PRE_ADHAN_DIP_ENABLED = True
OPT_PRE_ADHAN_DIP_FACTOR = "pre_adhan_dip_factor"   # percent of the music's own level
DEFAULT_PRE_ADHAN_DIP_FACTOR = 70

# ─────────────────────────────────────────────────────────────────────────────
# Guest mode (2.0.45) — temporarily mute all scheduled adhan audio while
# visitors are around. When enabled, play_adhan, play_pre_adhan_jingle and
# speak_pre_adhan return early without playing. The explicit TEST services
# (play_test_sound, play_pre_adhan_test) are deliberately NOT gated: pressing
# a test button is a conscious user action, and being able to verify the
# setup while guest mode is on is useful. Manual toggle only — no auto-off
# timer (yet).
# ─────────────────────────────────────────────────────────────────────────────
OPT_GUEST_MODE_ENABLED = "guest_mode_enabled"
DEFAULT_GUEST_MODE_ENABLED = False
# Duration handling (2.0.46): the panel writes guest_mode_until =
# now + guest_mode_hours when the toggle goes on. services.py treats the
# mode as active while enabled AND until is in the future; a missing
# until means "on until manually switched off" (backward compat with a
# 2.0.45 toggle-on). Expiry is lazy — checked at fire time, no timer.
OPT_GUEST_MODE_HOURS = "guest_mode_hours"
OPT_GUEST_MODE_UNTIL = "guest_mode_until"
DEFAULT_GUEST_MODE_HOURS = 4

# ─────────────────────────────────────────────────────────────────────────────
# Duas (2.0.51). options[OPT_DUAS] is a list of dicts:
#   { "id": str, "name": str, "sound": rel_path or None,
#     "media_player": entity_id or "", "volume": int 0-100,
#     "trigger_entity": entity_id or "" }
# Each dua targets its OWN media player, independent of the global
# adhan_media_players — a sleep dua belongs on the bedroom speaker, not
# on every adhan target. Playback is manual-only (nida.play_dua service
# or the per-dua button entity from button.py) and deliberately ignores
# the sound modes: whoever presses the button wants to hear it.
# Sound files come from a second manifest on the same server as the
# adhan manifest (type "dua" → category "dua", folder dua/), fetched and
# downloaded on demand exactly like the other categories.
# 2.0.61 — trigger_entity: optional entity (binary_sensor, switch,
# input_boolean) that auto-plays the dua on its transition TO "on"
# (door/window opens, switch turns on). __init__.py subscribes state
# listeners for all configured trigger entities and calls play_dua,
# rate-limited per dua by the cooldown below so a bouncing contact
# sensor cannot machine-gun the playback.
# ─────────────────────────────────────────────────────────────────────────────
OPT_DUAS = "duas"
OPT_DUA_CATALOG_URL = "dua_catalog_url"
DEFAULT_DUA_CATALOG_URL = "https://majikan.nl/nida/dua/manifest.json"
SOUND_CATEGORY_DUA = "dua"
DEFAULT_DUA_VOLUME = 40
DUA_TRIGGER_COOLDOWN_SECONDS = 60

# ─────────────────────────────────────────────────────────────────────────────
# Random adhan (2.0.52). When enabled, play_adhan ignores the fixed
# sound_<category> choice and picks a random LOCALLY DOWNLOADED sound
# from the prayer's category (fajr prayers pick among fajr_adhan items,
# the rest among adhan items). Only downloaded files qualify — playing
# an undownloaded catalog entry would 404 at adhan time. Falls back to
# the configured sound when no candidates are available.
# ─────────────────────────────────────────────────────────────────────────────
OPT_RANDOM_ADHAN_ENABLED = "random_adhan_enabled"
DEFAULT_RANDOM_ADHAN_ENABLED = False

# ─────────────────────────────────────────────────────────────────────────────
# Notifications (Release B) — push notification at adhan time per prayer.
# Distinct from the pre-adhan reminders above: those fire BEFORE the adhan
# with their own minutes setting; these fire AT the adhan, alongside the
# audio playback, and route to user-chosen `notify.*` HA services.
# ─────────────────────────────────────────────────────────────────────────────
OPT_NOTIFY_ENABLED = "notify_enabled"
OPT_NOTIFY_TARGETS = "notify_targets"            # list of "notify.<x>" service paths
OPT_NOTIFY_TITLE = "notify_title"                 # string, supports no placeholders
OPT_NOTIFY_MESSAGE = "notify_message"             # string, supports [prayer]
OPT_NOTIFY_ENABLED_PREFIX = "notify_enabled_"     # per-prayer toggle, e.g. notify_enabled_fajr
# 2.0.90 — critical notifications, PER PRAYER (2.0.89 shipped this as one
# master switch; corrected before backend release since "critical" is a
# per-prayer choice, e.g. Fajr yes, the rest no). Mirrors
# OPT_NOTIFY_ENABLED_PREFIX: notify_critical_enabled_fajr, _dhuhr, etc.
# Only meaningful (and only shown in the panel) when the matching
# notify_enabled_<prayer> is also on; the adhan-time notify call gets
# extra `data` when set (see _critical_notify_data in scheduler.py).
# Jumu'ah is untouched — it has no critical option.
OPT_NOTIFY_CRITICAL_ENABLED_PREFIX = "notify_critical_enabled_"
# 2.0.95 — per-target opt-in for the Android TTS/alarm-stream workaround.
# Some OEMs (confirmed: Samsung, see scheduler.py's
# _tts_critical_notify_data docstring) deliberately block apps from
# overriding a regular notification's audio attributes, so a critical
# notification's `channel`/`importance` is silently ignored and it stays
# muted in silent mode / DND. The one thing that reliably rings through
# on those devices is a spoken TTS notification played over the alarm
# stream — a materially different experience (spoken message instead of
# a notification tone), so it's opt-in per notify.* target from the
# panel's target picker, not an automatic behaviour change. List of
# "notify.<x>" service paths, same shape as OPT_NOTIFY_TARGETS.
OPT_NOTIFY_TTS_WORKAROUND_TARGETS = "notify_tts_workaround_targets"

# Fallbacks used by the backend when the panel hasn't seeded language-
# specific defaults yet. EN-only on the backend; the panel localises
# at first-init time and writes the per-language strings into options.
# 2.4.0 — plain "Nida", no mosque emoji. Johann dropped it once the iOS
# Companion app icon was doing the visual identifying: the emoji was a
# stand-in for branding we now have properly, and it ate the start of
# every notification title.
#
# LEGACY_NOTIFY_TITLES holds the values earlier versions wrote into
# options.notify_title verbatim. __init__.py treats a stored title that
# exactly equals one of them as "never customised" and migrates it, the
# same trick services.py's _resolve_tts_message uses. A title the user
# actually typed is left alone.
DEFAULT_NOTIFY_TITLE_FALLBACK = "Nida"
LEGACY_NOTIFY_TITLES = ("🕌 Nida",)
DEFAULT_NOTIFY_MESSAGE_FALLBACK = "It's time for [prayer] prayer"

# ─────────────────────────────────────────────────────────────────────────────
# Jumu'ah (Friday prayer) — congregational Dhuhr on Friday. The prayer
# itself follows Dhuhr's time and isn't separately toggleable (it's
# religiously obligatory). The reminder below is the only configurable
# part: a notification N minutes before Dhuhr on Friday.
# ─────────────────────────────────────────────────────────────────────────────
OPT_JUMUAH_REMINDER_ENABLED = "jumuah_reminder_enabled"
OPT_JUMUAH_REMINDER_MINUTES = "jumuah_reminder_minutes"
OPT_JUMUAH_MESSAGE = "jumuah_message"            # supports [minutes]
# Targets just for the Jumu'ah reminder. Separate from the general
# notify_targets so the user can route the Friday-only reminder to a
# subset of devices (e.g. exclude family members for whom Jumu'ah
# isn't religiously required). Empty list → scheduler falls back to
# persistent_notification.
OPT_JUMUAH_TARGETS = "jumuah_targets"
DEFAULT_JUMUAH_MINUTES = 60
DEFAULT_JUMUAH_MESSAGE_FALLBACK = "Jumu'ah prayer is in [minutes] minutes"
JUMUAH_MIN_MINUTES = 30
JUMUAH_MAX_MINUTES = 120

# Speakers volume-test sound. Played by nida.play_test_sound on the
# configured adhan speakers. Ships at
# custom_components/nida/sounds/test/test_nasheed.mp3 — helpers.copy_sounds
# mirrors it to <config>/www/nida/sounds/test/test_nasheed.mp3 like the
# other sounds. If the file is missing the test will fail silently
# (media_player.play_media gets a 404).
#
# 2.3.3 — renamed from test_jingle.mp3. The bundled sound is a nasheed,
# not a jingle, and the panel row now says so; the filename lagged behind.
# Note for upgrades: helpers.copy_sounds only ADDS files, it never removes
# them, so an existing install keeps a stale www/nida/sounds/test/
# test_jingle.mp3 lying around after this. Harmless (nothing references
# it any more) but worth deleting by hand if you like a tidy www/.
TEST_SOUND_PATH = "test/test_nasheed.mp3"

# ─────────────────────────────────────────────────────────────────────────────
# Theme — panel-side preference, drives a CSS class on both the shadow root
# host and the body-portal overlay element. "auto" follows the user's OS
# preference via prefers-color-scheme. The integration backend doesn't act
# on this — it's purely a frontend rendering preference.
# ─────────────────────────────────────────────────────────────────────────────
OPT_THEME = "theme"
THEME_DARK = "dark"
THEME_LIGHT = "light"
THEME_AUTO = "auto"
DEFAULT_THEME = THEME_DARK

# ─────────────────────────────────────────────────────────────────────────────
# Standaard mp3-bestanden die meegeleverd worden in sounds/<categorie>/.
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_SOUNDS = {
    SOUND_CATEGORY_FAJR_ADHAN: "adhan/adhan_fajr_ahmed_saeed_al-omrany.mp3",
    SOUND_CATEGORY_ADHAN: "adhan/adhan_day_ahmed_saeed_al-omrany.mp3",
    SOUND_CATEGORY_PRE_ADHAN_JINGLE: "pre_adhan_jingle/announcement.mp3",
}

# ─────────────────────────────────────────────────────────────────────────────
# Sensor entity_id-naamgeving
# ─────────────────────────────────────────────────────────────────────────────
SENSOR_ENTITY_PREFIX = "nida_"

HIJRI_FIELDS = ("date", "day", "month", "year", "holiday")

# ─────────────────────────────────────────────────────────────────────────────
# Islamic Calendar reminders (2.1.0) — four independent reminder types tied
# to fixed Hijri dates, distinct from the adhan/prayer-time notifications
# above. All four share one fire time and one target list; each has its own
# on/off toggle. Holidays is the only type with a lead-time concept (remind
# N days before, optionally a closer second reminder) — the other three fire
# on the day itself, matching the reference Android app this was ported from.
#
# Data source: Aladhan's /gToHCalendar/{month}/{year} endpoint (same API
# Nida already depends on for prayer timings — see coordinator.py) gives the
# Hijri day+month for every Gregorian date in a month, so a lookahead needs
# no extra dependency. Its own `holidays` field is deliberately NOT used:
# that's Aladhan's curated list of mostly-Sufi scholar-anniversary dates,
# not the handful of widely-observed occasions below. Instead the tables
# below are Nida's own fixed (month, day) list, matched against the looked-
# up Hijri date for each day in the lookahead window (see the calendar
# lookahead helper).
# ─────────────────────────────────────────────────────────────────────────────
OPT_CALENDAR_NOTIFY_TARGETS = "calendar_notify_targets"  # separate from OPT_NOTIFY_TARGETS
OPT_CALENDAR_FIRE_TIME = "calendar_fire_time"  # "HH:MM", all four types fire together
DEFAULT_CALENDAR_FIRE_TIME = "05:30"

OPT_CALENDAR_HOLIDAYS_ENABLED = "calendar_holidays_enabled"
OPT_CALENDAR_HOLIDAYS_LEAD_DAYS = "calendar_holidays_lead_days"
OPT_CALENDAR_HOLIDAYS_SECOND_ENABLED = "calendar_holidays_second_enabled"
OPT_CALENDAR_HOLIDAYS_SECOND_LEAD_DAYS = "calendar_holidays_second_lead_days"
DEFAULT_CALENDAR_HOLIDAYS_LEAD_DAYS = 7
DEFAULT_CALENDAR_HOLIDAYS_SECOND_LEAD_DAYS = 1
CALENDAR_LEAD_DAYS_MIN = 0
CALENDAR_LEAD_DAYS_MAX = 30

OPT_CALENDAR_ASHURA_ARAFAH_ENABLED = "calendar_ashura_arafah_enabled"
OPT_CALENDAR_WHITE_DAYS_ENABLED = "calendar_white_days_enabled"
OPT_CALENDAR_WEEKLY_SUNNAH_ENABLED = "calendar_weekly_sunnah_enabled"

# Weekly Sunnah fasting needs no Hijri lookup at all — pure Gregorian weekday
# check. date.weekday() convention: Monday=0 .. Sunday=6.
WEEKLY_SUNNAH_WEEKDAYS = (0, 3)  # Monday, Thursday

# Fixed Hijri (month, day) table for the "Holidays" reminder type. month is
# the 1-12 Hijri month number as returned by Aladhan (hijri.month.number).
# Eid al-Adha is tagged for day 10 only (the reminder date) — not the
# following days of Eid. name is EN-only for now, same convention as
# DEFAULT_NOTIFY_MESSAGE_FALLBACK/DEFAULT_JUMUAH_MESSAGE_FALLBACK above
# (backend fallback text; full i18n of notification bodies is a follow-up,
# not something this table blocks on).
ISLAMIC_HOLIDAYS = (
    {"month": 1, "day": 1, "key": "islamic_new_year", "name": "Islamic New Year"},
    {"month": 3, "day": 12, "key": "mawlid", "name": "Mawlid an-Nabi"},
    {"month": 10, "day": 1, "key": "eid_al_fitr", "name": "Eid al-Fitr"},
    {"month": 12, "day": 10, "key": "eid_al_adha", "name": "Eid al-Adha"},
)

# Ashura & Arafah fasting — a separate reminder type from Holidays above,
# even though Ashura (10 Muharram) falls in the same Hijri month as Islamic
# New Year (1 Muharram). 9/10/11 Muharram: the recommended day-before and
# day-after alongside Ashura itself (scholarly difference of opinion on
# which is preferred — Nida reminds for all three, same as the reference
# app, and leaves the choice to the user). 9 Dhul Hijjah: Day of Arafah.
ASHURA_ARAFAH_DATES = (
    {"month": 1, "day": 9, "key": "ashura_pre", "name": "Ashura fasting (9 Muharram)"},
    {"month": 1, "day": 10, "key": "ashura", "name": "Ashura fasting (10 Muharram)"},
    {"month": 1, "day": 11, "key": "ashura_post", "name": "Ashura fasting (11 Muharram)"},
    {"month": 12, "day": 9, "key": "arafah", "name": "Day of Arafah fasting"},
)

# White Days (Ayyam al-Beed) — 13th/14th/15th of EVERY Hijri month, not a
# single-occurrence date like the tables above. Recurs 12x/year.
WHITE_DAYS = (13, 14, 15)

# ─────────────────────────────────────────────────────────────────────────────
# Ramadan features (2.1.34) — see the changelog entry at the top of this file
# for the full rationale. Hijri month 9 = Ramadan (Aladhan's month.number).
# ─────────────────────────────────────────────────────────────────────────────
HIJRI_MONTH_RAMADAN = 9

# Imsak offset (was already a de-facto panel-written option key; this gives
# it a proper backend constant so scheduler.py's suhoor reminder can apply
# the same user-chosen "show it N minutes earlier" adjustment the Today
# card already displays, instead of the raw Aladhan Imsak time).
OPT_IMSAK_OFFSET_MIN = "imsak_offset_min"
DEFAULT_IMSAK_OFFSET_MIN = 0
IMSAK_OFFSET_MIN_MAX = 60

# Suhoor reminder — fires N minutes before the (offset-adjusted) Imsak time,
# Ramadan only. Reuses the general OPT_NOTIFY_TARGETS list (same targets as
# the adhan-time notifications) rather than a dedicated picker; falls back
# to persistent_notification when that list is empty, same convention as
# Jumu'ah/Islamic Calendar.
OPT_SUHOOR_REMINDER_ENABLED = "suhoor_reminder_enabled"
OPT_SUHOOR_REMINDER_MINUTES = "suhoor_reminder_minutes"
OPT_SUHOOR_REMINDER_MESSAGE = "suhoor_reminder_message"  # supports [minutes]
DEFAULT_SUHOOR_REMINDER_ENABLED = False
DEFAULT_SUHOOR_REMINDER_MINUTES = 30
DEFAULT_SUHOOR_REMINDER_MESSAGE_FALLBACK = "Suhoor ends in [minutes] minutes"
SUHOOR_REMINDER_MINUTES_MIN = 5
SUHOOR_REMINDER_MINUTES_MAX = 120

# Iftar reminder — same idea, N minutes before Maghrib, Ramadan only.
OPT_IFTAR_REMINDER_ENABLED = "iftar_reminder_enabled"
OPT_IFTAR_REMINDER_MINUTES = "iftar_reminder_minutes"
OPT_IFTAR_REMINDER_MESSAGE = "iftar_reminder_message"  # supports [minutes]
DEFAULT_IFTAR_REMINDER_ENABLED = False
DEFAULT_IFTAR_REMINDER_MINUTES = 10
DEFAULT_IFTAR_REMINDER_MESSAGE_FALLBACK = "Iftar is in [minutes] minutes"
IFTAR_REMINDER_MINUTES_MIN = 2
IFTAR_REMINDER_MINUTES_MAX = 60

# Optional auto-played dua AT Maghrib during Ramadan — reuses the existing
# nida.play_dua service (2.0.51) with a user-chosen dua id, so it behaves
# identically to pressing "Use" on that dua by hand (own media player, own
# volume, all already configured on the dua itself).
OPT_IFTAR_DUA_ENABLED = "iftar_dua_enabled"
OPT_IFTAR_DUA_ID = "iftar_dua_id"
DEFAULT_IFTAR_DUA_ENABLED = False

# Laylatul Qadr / last-10-nights — a fifth Islamic Calendar reminder type
# (odd nights of the last ten days of Ramadan), sharing OPT_CALENDAR_
# FIRE_TIME + OPT_CALENDAR_NOTIFY_TARGETS with the existing four types.
OPT_CALENDAR_LAYLATUL_QADR_ENABLED = "calendar_laylatul_qadr_enabled"
DEFAULT_CALENDAR_LAYLATUL_QADR_ENABLED = False
LAYLATUL_QADR_NIGHTS = (21, 23, 25, 27, 29)
LAYLATUL_QADR_DATES = tuple(
    {
        "month": HIJRI_MONTH_RAMADAN,
        "day": night,
        "key": f"laylatul_qadr_{night}",
        "name": f"Laylatul Qadr (night of {night} Ramadan)",
    }
    for night in LAYLATUL_QADR_NIGHTS
)

# ─────────────────────────────────────────────────────────────────────────────
# Fajr wake-up alarm (2.1.35), Ramadan only. Wakes the user
# OPT_FAJR_ALARM_MINUTES before Fajr (cooking/suhoor prep time) by
# activating a chosen HA scene with a smooth brightness ramp
# (scene.turn_on's own `transition` field, seconds — supported for scenes
# containing lights) and, independently, playing a wake sound either at
# the same moment or delayed until the light transition finishes. See
# scheduler.py for the trigger math and services.py-style playback calls
# (re-implemented locally there rather than importing services.py's
# private _play_media_safe/_set_volume_safe, per this codebase's existing
# convention of not importing underscore-prefixed names across modules).
# ─────────────────────────────────────────────────────────────────────────────
OPT_FAJR_ALARM_ENABLED = "fajr_alarm_enabled"
DEFAULT_FAJR_ALARM_ENABLED = False

OPT_FAJR_ALARM_MINUTES = "fajr_alarm_minutes"  # minutes BEFORE Fajr to wake
DEFAULT_FAJR_ALARM_MINUTES = 30
FAJR_ALARM_MINUTES_MIN = 5
FAJR_ALARM_MINUTES_MAX = 120

OPT_FAJR_ALARM_SCENE = "fajr_alarm_scene"  # entity_id of a scene.* entity, "" = none
DEFAULT_FAJR_ALARM_SCENE = ""

OPT_FAJR_ALARM_TRANSITION_MINUTES = "fajr_alarm_transition_minutes"
DEFAULT_FAJR_ALARM_TRANSITION_MINUTES = 15
FAJR_ALARM_TRANSITION_MINUTES_MIN = 1
FAJR_ALARM_TRANSITION_MINUTES_MAX = 60

FAJR_ALARM_SOUND_MODE_TOGETHER = "together"
FAJR_ALARM_SOUND_MODE_DELAYED = "delayed"
OPT_FAJR_ALARM_SOUND_MODE = "fajr_alarm_sound_mode"
DEFAULT_FAJR_ALARM_SOUND_MODE = FAJR_ALARM_SOUND_MODE_TOGETHER

# Independent wake sound — deliberately NOT the Fajr adhan sound (Johann's
# choice). rel_path comes from the Sound Library's existing
# pre_adhan_jingle category (see catalog.py); media_player + volume are
# this alarm's own, separate from adhan_media_players.
OPT_FAJR_ALARM_SOUND = "fajr_alarm_sound"
OPT_FAJR_ALARM_MEDIA_PLAYER = "fajr_alarm_media_player"
OPT_FAJR_ALARM_VOLUME = "fajr_alarm_volume"
DEFAULT_FAJR_ALARM_VOLUME = 40

# ─────────────────────────────────────────────────────────────────────────────
# Settings access (2.3.16) — Johann: "kunnen we instellingen verbergen voor
# andere gebruikers? We hebben admins maar kunnen we ook gewone maar ook
# andere admins de instellingen verbergen."
#
# Empty list  → every Home Assistant ADMIN may change Nida's settings.
# Non-empty   → ONLY the listed user ids may, admin or not. That is what
#               shuts out other admins.
#
# Read the honest limit before relying on this: it is not a security
# boundary against an admin. Any HA admin can open Nida's options flow from
# the Integrations page, edit .storage directly, or simply remove this
# allowlist again. What it genuinely buys you is that the panel's settings
# are out of sight and the websocket refuses their writes — enough to keep
# a household's other admins from changing prayer times or adhan volumes by
# accident, not enough to stop one who sets out to.
#
# Against NON-admins it is a real boundary, because they have none of those
# routes. And it closes a genuine hole: before this every logged-in user,
# admin or not, could call nida/update_settings and change everything.
OPT_SETTINGS_USERS = "settings_users"   # list of HA user ids
DEFAULT_SETTINGS_USERS: list[str] = []

# 2.3.18 — hide the Nida sidebar entry from non-admins entirely (Johann
# asked for this on top of the settings allowlist). Unlike that allowlist,
# this one is enforced by Home Assistant itself: require_admin on a
# registered panel is a core check, not something we police.
#
# Default False, i.e. unchanged behaviour. A prayer-times panel is
# genuinely useful to every member of a household, so turning it off for
# them is a household decision rather than a sensible default to impose
# on every install.
#
# Note what this canNOT do: HA has no per-user panel visibility, so an
# admin who is NOT on the settings allowlist still sees the sidebar entry.
# They just find the settings hidden once inside.
OPT_SIDEBAR_ADMIN_ONLY = "sidebar_admin_only"
DEFAULT_SIDEBAR_ADMIN_ONLY = False

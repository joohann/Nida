"""Nida Integration — Islamic prayer times + adhan + reminders for Home Assistant.

REBUILD STATUS (2.0.2). This file was rebuilt step by step towards the
full target picture in references/architecture.md.

NOT back yet at the time (came later):
  - binary_sensor.py / switch.py                → entities (per-prayer on/off)
  - media/*                                       → tarhim/suhoor/reminder playback
  - notify/*                                       → push notifications
  - fasting.py / fasting_binary_sensors.py        → Ramadan/fasting logic
  - volume.py                                       → night volume
  - pre-adhan jingle scheduling                     → a trigger N min before each prayer

Present from 2.0.2:
  - coordinator.py  → unchanged, fetches prayer timings + hijri
  - sensor.py        → 16 sensors: 5 prayers (timestamp+readable), 5 hijri, next_prayer
  - panel.py          → Masjid sidebar entry (toggleable via options flow)
  - websocket.py       → get_settings/update_settings commands for the panel
  - config_flow.py     → auto-create entry + options flow
  - helpers.py        → copies bundled sounds to <config>/www/nida/sounds/
  - services.py        → nida.play_adhan service
  - scheduler.py        → plans adhan triggers per prayer time

Changelog:
  2.5.0 (2026-10-10): Sets up NidaLiveActivity (live_activity.py) next to the
                       scheduler and re-plans it on every options update.
  2.1.20 (2026-07-08): async_setup_entry now also calls
                       panel.async_register_card (new) unconditionally —
                       registers the new frontend/nida-card.js as a
                       global Lovelace resource so the two dashboard
                       cards (NidaCard, "Next prayer" + "Today") work on
                       any dashboard without a manual resource add.
                       Unlike async_register_panel, not gated on
                       show_in_sidebar: the cards don't depend on the
                       sidebar panel.
  2.0.68 (2026-07-04): Settings backup/restore. A JSON snapshot of
                       entry.options is saved to <config>/
                       nida_settings_backup.json on every options
                       update and at first setup. When a freshly
                       created config entry has empty options (remove +
                       re-add), the backup is auto-restored so all
                       settings survive the reinstall. Helpers:
                       _save_settings_backup, _load_settings_backup.
  2.0.67 (2026-07-04): Device "Configure" button. async_setup_entry
                       calls device_registry.async_get_or_create with
                       configuration_url="/nida" so the HA device page
                       shows a link to the Nida sidebar panel.
  2.0.61 (2026-07-03): Dua triggers. Every dua may name a trigger
                       entity (binary_sensor/switch/input_boolean);
                       _async_setup_dua_triggers subscribes state
                       listeners and plays the dua on the transition to
                       "on", max once per 60s per dua (cooldown in
                       const.py). Listeners rebuild on every options
                       update and unsubscribe on unload.
  2.0.60 (2026-07-03): Dua change no longer reloads the whole entry.
                       The 2.0.54 behaviour (full async_reload on a
                       changed dua id set) also killed the open panel
                       and websocket — every add/remove looked like a
                       panel crash and playback only worked after a
                       refresh. Now only the button platform is
                       unloaded and re-forwarded.
  2.0.54 (2026-07-02): Dua id baseline set at setup, so the first dua
                       added after a restart immediately reloads the
                       button platform (previously suppressed until a
                       second change).
  2.0.51 (2026-07-02): Dua buttons. "button" added to PLATFORMS
                       (button.py, one entity per configured dua) and
                       _async_update_listener now also reloads the
                       entry when the SET of dua ids changes, so
                       button entities track the config. Edits within
                       an existing dua need no reload.
  2.0.46 (2026-07-02): Companion release — bezoekersmodus met duur
  2.0.46 (2026-07-02): Companion release — guest mode with a duration
                       (1-24 hours) and a red status banner in the panel.
                       Only the version log line changes here.
  2.0.45 (2026-07-02): Guest mode + sidebar rename. Guest mode
                       (const/services/panel) mutes the scheduled adhan
                       and pre-adhan; panel.py sidebar title Masjid → Nida.
                       Only the version log line changes here.
  2.0.44 (2026-07-02): Companion release alongside services.py — the TTS
                       language is now tried per engine (bare code,
                       regional locale, engine default) with blocking
                       calls so rejections are caught. Only the version
                       log line changes here.
  2.0.43 (2026-07-01): Companion release alongside nida-panel.js — TTS
                       overlay single-select engine picker, visible
                       [prayer] hint, portal styling for the test button,
                       and now-card label "Last prayer". Only the
                       version log line changes here.
  2.0.38 (2026-06-29): Pre-adhan subgroup redesign + per-prayer
                       toggles. Changes in const.py + scheduler.py
                       + nida-panel.js. __init__.py log line bumped.
  2.0.37 (2026-06-29): Companion release alongside nida-panel.js — TTS
                       language list from the panel LANGUAGES, defaults
                       for all 10 panel languages. __init__.py only the
                       log line version bumped.
  2.0.36 (2026-06-29): TTS language choice + auto-update message. Changes
                       in const.py + services.py + nida-panel.js.
                       __init__.py log line version bumped.
  2.0.35 (2026-06-29): Companion release alongside services.py — language
                       code normalised to 2-letter ISO for TTS.
                       __init__.py only the log line version bumped.
  2.0.34 (2026-06-29): Companion release alongside scheduler.py — the
                       pre-adhan persistent_notification is now a real
                       fallback: it only fires when both the jingle and
                       TTS are disabled. __init__.py only the log line
                       version bumped.
  2.0.33 (2026-06-29): Companion release alongside services.py — TTS call
                       payload fix (language top-level instead of inside
                       options). __init__.py only the log line version
                       bumped.
  2.0.32 (2026-06-29): TTS pre-adhan announcement. Changes in
                       const.py + websocket.py (list_tts_services) +
                       services.py (speak_pre_adhan service) +
                       scheduler.py (chain TTS after the jingle) +
                       nida-panel.js (TTS row + overlay). __init__.py
                       only the log line version bumped.
  2.0.31 (2026-06-29): Companion release alongside nida-panel.js — the
                       Sound Library gets a category scope. Fix for the
                       wrong-adhan bug. __init__.py only the log line
                       version bumped.
  2.0.30 (2026-06-29): Companion release alongside nida-panel.js — Sound
                       Library CSS moved to the portal scope.
                       __init__.py only the log line version bumped.
  2.0.29 (2026-06-29): Catalog adapter adjusted to the real
                       majikan.nl manifest schema. Default URL set.
                       Changes in catalog.py + const.py.
                       __init__.py log line version bumped.
  2.0.28 (2026-06-29): Sound Library — catalog-driven adhan picker.
                       New file catalog.py + 3 WS commands in
                       websocket.py (get_catalog/download_sound/
                       delete_sound). Const file: OPT_CATALOG_URL.
                       No further __init__.py changes besides the
                       log line version.
  2.0.27 (2026-06-29): Companion release alongside nida-panel.js — the
                       companion cards (Hijri/Now/Quote/Holiday) can be
                       dragged to set their order. Order is kept in
                       localStorage. No backend changes.
                       __init__.py itself only the log line version bumped.
  2.0.26 (2026-06-29): Companion release alongside nida-panel.js — Now card
                       redesigned into a compact horizontal layout that
                       matches the nida-card "next-block". No backend
                       changes. __init__.py itself only the log line
                       version bumped.
  2.0.25 (2026-06-29): Companion release alongside nida-panel.js — the
                       Holiday card is connected to a curated list of
                       10 universal Sunni holidays (not Aladhan
                       /specialDays — too broad), and the companion and
                       settings columns are swapped (companion now left,
                       settings right). No backend changes. __init__.py
                       itself only the log line version bumped.
  2.0.24 (2026-06-29): Companion release alongside nida-panel.js — Release D
                       polish (save toast + manual-mode warning) plus a
                       UI alignment fix in the Speakers and Pre-adhan
                       test rows. No backend changes. __init__.py
                       itself only the log line version bumped.
  2.0.23 (2026-06-28): Four panel/backend changes in one release.
                       (1) binary_sensor.py defensive rewrite — dropped
                       the CoordinatorEntity subclass + try/except to
                       eliminate setup breakage. (2) New service
                       nida.play_pre_adhan_test with its own volume
                       (volume_pre_adhan_test) — used by the play/stop
                       button in the panel. (3) Sounds section in
                       nida-panel.js split into three subgroups
                       (Adhan, Pre-adhan, Night mode); the separate
                       Night-mode section removed from render. (4) All
                       panel sections are now collapsible (<details>)
                       with per-section localStorage memory. Changes in
                       const.py + services.py + binary_sensor.py +
                       nida-panel.js. __init__.py: PLATFORMS now contains
                       binary_sensor + log line version bumped.
  2.0.22 (2026-06-28): Pre-adhan audio playback + Speakers test
                       play/stop + night mode. Changes in
                       const.py + services.py + scheduler.py +
                       nida-panel.js. __init__.py itself only the
                       log line version bumped.
  2.0.21 (2026-06-28): Binary_sensor platform added —
                       binary_sensor.nida_<prayer>_active per prayer,
                       ON during that prayer's window. Isha spans
                       midnight; the pre-Fajr branch approximates
                       yesterday's Isha as today's Isha - 24h.
                       PLATFORMS extended.
  2.0.20 (2026-06-28): Companion release alongside nida-panel.js (theme_auto
                       label to "Automatic"/"Automatisch"). __init__.py
                       only the log line version bumped.
  2.0.19 (2026-06-28): Companion release alongside nida-panel.js (.select-
                       field.flat CSS variant for single-row cards).
                       __init__.py only the log line version bumped.
  2.0.18 (2026-06-28): Companion release for the Jumu'ah own targets
                       and the Speakers test jingle. Changes in
                       const.py + services.py + scheduler.py +
                       websocket.py + nida-panel.js. __init__.py itself
                       only the log line version bumped.
  2.0.17 (2026-06-28): Switch platform added for per-prayer adhan
                       ON/OFF (switch.nida_<prayer>_enabled). The scheduler
                       is now stored in hass.data so the update-listener
                       path can reschedule it directly on every options
                       change — previously you had to wait 12 hours for
                       the coordinator to reschedule by itself. Added to
                       PLATFORMS.
  2.0.16 (2026-06-28): Companion release alongside nida-panel.js + websocket.py
                       (test buttons + ws commands for on-demand
                       notify testing). __init__.py only the log line
                       version bumped.
  2.0.15 (2026-06-28): Release B — notifications + Jumu'ah. Changes
                       in const.py + websocket.py + scheduler.py +
                       nida-panel.js. __init__.py itself only the log line
                       version bumped.
  2.0.14 (2026-06-28): Companion release alongside nida-panel.js (² CSS
                       tweak). __init__.py only the log line version
                       bumped.
  2.0.13 (2026-06-28): Companion release for the feedback on 2.0.12 —
                       lower default volumes (10/20/20), pre-adhan
                       minutes as a 2-30 slider with an optional second
                       reminder, reverse geocode for the device-mode
                       location row, and a fix for the city-pick blur race.
                       Changes in nida-panel.js + websocket.py +
                       scheduler.py + const.py. __init__.py itself only
                       the log line version bumped.
  2.0.12 (2026-06-28): Companion release for Release A — panel volume
                       sliders, pre-adhan minutes input, Nida²
                       superscript spacing fix, and a Nominatim city=
                       structured-search fix for the city autocomplete
                       (was 0 hits with q= for prefixes <4 chars).
                       Changes in nida-panel.js + websocket.py +
                       services.py + const.py. __init__.py itself only
                       the log line version bumped.
  2.0.11 (2026-06-28): Companion release alongside nida-panel.js (see its
                       changelog for the <dialog>-based portal and the
                       city-input partial-update fix). __init__.py
                       itself only the log line version bumped.
  2.0.10 (2026-06-28): Companion release alongside websocket.py + coordinator.py
                       + nida-panel.js (see their changelogs for the overlay
                       portal fix and the Nominatim-backed city autocomplete).
                       __init__.py itself only the log line version bumped.
  2.0.9 (2026-06-28): Companion release alongside websocket.py + nida-panel.js
                      (see their changelogs for the Speakers picker and
                      the resolved-location row). __init__.py itself only
                      the log line version bumped.
  2.0.8 (2026-06-28): Welcome notification text expanded to point at
                      the Masjid sidebar entry, now that the config
                      flow no longer shows a welcome step (entry is
                      auto-created without a form).
  2.0.7 (2026-06-28): Companion release alongside const.py + scheduler.py +
                      nida-panel.js (see their changelogs for the pre-adhan
                      notification and country search). __init__.py
                      itself only the log line version bumped.
  2.0.6 (2026-06-28): Companion release alongside sensor.py + nida-panel.js
                      + config_flow.py changes (see their changelogs).
                      __init__.py itself only the log line version bumped.
  2.0.5 (2026-06-28): Companion release alongside sensor.py and config_flow.py
                      changes (see their changelogs). __init__.py itself
                      unchanged in structure — only the log line version
                      bumped, and strings.json/welcome flow now relies
                      on description_placeholders instead of embedded text.
  2.0.4 (2026-06-28): One-shot welcome notification added after the
                      first async_setup_entry — markdown link to
                      /nida so the user can land directly in the Masjid
                      panel after install. Gated on
                      entry.data["welcome_shown"] so the banner does
                      not return on every restart/reload.
  2.0.3 (2026-06-28): _async_update_listener is now selective — it only
                      reloads the integration when show_in_sidebar
                      changes. Previously the integration reloaded on
                      EVERY options change (toggle, city, method...),
                      which briefly removed the panel from the sidebar
                      and sent the browser back to the dashboard.
  2.0.2 (2026-06-28): Sidebar entry is now conditional on
                      options.show_in_sidebar (default True). Welcome
                      step in the config flow restored. Sidebar label
                      renamed to "Masjid" (URL path stays /nida). On
                      unload the panel is also removed cleanly.
  2.0.1 (2026-06-28): Automatic adhan playback added — helpers,
                      services and scheduler hooked up. async_copy_sounds()
                      runs on every setup; the nida.play_adhan service is
                      registered; NidaScheduler plans triggers and
                      cleans up after itself via entry.async_on_unload.
  2.0.0 (2026-06-27): Sensor platform (sensor.py) added to PLATFORMS and
                      async_unload_entry — first rebuild step after the bare
                      coordinator+panel+websocket skeleton.
"""
from __future__ import annotations

import json
import logging
import os
import time

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_state_change_event

from .config_flow import OPT_SHOW_IN_SIDEBAR
from .const import (
    DEFAULT_JINGLE_CATALOG_URL,
    LEGACY_CATALOG_URLS,
    OPT_CATALOG_URL,
    OPT_DUA_CATALOG_URL,
    OPT_JINGLE_CATALOG_URL,
    DEFAULT_NOTIFY_TITLE_FALLBACK,
    DOMAIN,
    DUA_TRIGGER_COOLDOWN_SECONDS,
    LEGACY_NOTIFY_TITLES,
    OPT_DUAS,
    OPT_NOTIFY_TITLE,
)
from .coordinator import PrayerTimesCoordinator
from .helpers import async_copy_brand, async_copy_sounds
from .live_activity import NidaLiveActivity
from .panel import async_register_card, async_register_panel, async_remove_panel
from .scheduler import NidaScheduler
from .services import async_register_services, async_unregister_services
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)

# 2.0.51 — "button" added: per-dua button entities (button.py).
PLATFORMS = ["sensor", "switch", "binary_sensor", "button"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Initialize Nida from a config entry."""
    # 2.0.68 — restore settings from backup on a fresh install (empty
    # options = just created via config flow). The user removed and
    # re-added the integration; this gives them their old settings back
    # without any manual reconfiguration.
    if not entry.options:
        restored = await hass.async_add_executor_job(_load_settings_backup, hass)
        if restored:
            hass.config_entries.async_update_entry(entry, options=restored)

    await async_copy_sounds(hass)
    # 2.3.12 — brand icon under www/ so the iOS Companion app can fetch
    # it as a notification attachment.
    await async_copy_brand(hass)

    # 2.4.0 — drop the mosque emoji from a notify title that was never
    # customised. The panel writes the language default into
    # options.notify_title at first init, so the old "🕌 Nida" is sitting
    # in most installs as a stored value, where changing the constant
    # alone would never reach it. An exact match against a known former
    # default is what identifies "untouched"; anything else the user
    # typed themselves and is left exactly as it is.
    # 2.4.6 — the sound library moved to nida.majikan.nl and split per
    # type. The old URLs are stored in every existing install, where a new
    # DEFAULT never reaches them, so rewrite the ones that still match a
    # former default exactly. A URL the user typed themselves is left
    # alone — it may point at their own mirror. Same rule as the notify
    # title below.
    url_patch = {}
    for opt in (OPT_CATALOG_URL, OPT_DUA_CATALOG_URL):
        cur = entry.options.get(opt)
        new_url = LEGACY_CATALOG_URLS.get(cur) if cur else None
        if new_url and new_url != cur:
            url_patch[opt] = new_url
    # Jingles had no URL of their own before this version; they rode along
    # in the adhan manifest. Seed it so an upgraded install picks up the
    # new folder without the user having to find the setting.
    if OPT_JINGLE_CATALOG_URL not in entry.options:
        url_patch[OPT_JINGLE_CATALOG_URL] = DEFAULT_JINGLE_CATALOG_URL
    if url_patch:
        hass.config_entries.async_update_entry(
            entry, options={**entry.options, **url_patch}
        )
        _LOGGER.info("Nida: catalog URLs migrated: %s", url_patch)

    stored_title = entry.options.get(OPT_NOTIFY_TITLE)
    if stored_title in LEGACY_NOTIFY_TITLES:
        hass.config_entries.async_update_entry(
            entry,
            options={**entry.options, OPT_NOTIFY_TITLE: DEFAULT_NOTIFY_TITLE_FALLBACK},
        )
        _LOGGER.info(
            "Nida: notify title migrated from %r to %r",
            stored_title, DEFAULT_NOTIFY_TITLE_FALLBACK,
        )

    coordinator = PrayerTimesCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator
    # Expose the integration version so the panel can show it under the donate
    # button (same pattern as Chihiros Plus).
    from homeassistant.loader import async_get_integration

    integration = await async_get_integration(hass, DOMAIN)
    hass.data[DOMAIN]["version"] = integration.version or ""
    hass.data[DOMAIN][f"_sidebar_state_{entry.entry_id}"] = entry.options.get(
        OPT_SHOW_IN_SIDEBAR, True
    )

    # 2.0.67 — set configuration_url on the Nida device so the HA device
    # page shows a "Configure" button linking straight to the panel.
    # sensor.py creates the device; we just update it here.
    from homeassistant.helpers import device_registry as dr

    dev_reg = dr.async_get(hass)
    dev_reg.async_get_or_create(
        config_entry_id=entry.entry_id,
        identifiers={(DOMAIN, entry.entry_id)},
        name="Nida Prayer Times",
        manufacturer="joohann",
        configuration_url="homeassistant://nida",
    )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    async_register_websocket_commands(hass)
    async_register_services(hass)

    async_remove_panel(hass)
    if entry.options.get(OPT_SHOW_IN_SIDEBAR, True):
        await async_register_panel(hass)

    # 2.1.20 — dashboard cards (nida-card.js) are independent of the
    # sidebar panel, so this is unconditional (unlike async_register_panel
    # above, gated on show_in_sidebar).
    await async_register_card(hass)

    scheduler = NidaScheduler(hass, entry, coordinator)
    scheduler.async_setup()
    # Stash the scheduler so the update-listener (and any other module
    # that needs to nudge it) can reach it without re-creating one.
    hass.data[DOMAIN][f"_scheduler_{entry.entry_id}"] = scheduler
    # 2.5.0 — next-prayer Live Activity, planned from the same coordinator.
    live_activity = NidaLiveActivity(hass, entry, coordinator)
    live_activity.async_setup()
    hass.data[DOMAIN][f"_live_activity_{entry.entry_id}"] = live_activity
    entry.async_on_unload(live_activity.async_shutdown)
    # 2.0.54 — baseline the dua id set now, so _async_update_listener can
    # detect the very first duas change after startup (prev was None
    # before, which suppressed the reload and left the new button entity
    # missing until a second change or a restart).
    hass.data[DOMAIN][f"_dua_ids_{entry.entry_id}"] = tuple(
        sorted(
            str(d.get("id"))
            for d in (entry.options.get(OPT_DUAS) or [])
            if isinstance(d, dict) and d.get("id")
        )
    )
    entry.async_on_unload(scheduler.async_shutdown)
    # 2.0.68 — initial backup so there's always a snapshot to restore
    # from, even if the user never changes anything after setup.
    if entry.options:
        await hass.async_add_executor_job(_save_settings_backup, hass, entry.options)
    # 2.0.61 — subscribe state listeners for dua trigger entities.
    # Re-run on every options update (see _async_update_listener) and
    # torn down on unload.
    _async_setup_dua_triggers(hass, entry)
    entry.async_on_unload(lambda: _async_teardown_dua_triggers(hass, entry))

    if not entry.data.get("welcome_shown"):
        persistent_notification.async_create(
            hass,
            (
                "**Assalamu Alaikum** — Nida is ready.\n\n"
                "Look for **Masjid** in the sidebar (left), or open the "
                "[Masjid dashboard](/nida) directly to configure prayer "
                "times, sounds, language, and media players for "
                "automatic adhan playback."
            ),
            title="Nida",
            notification_id="nida_setup_complete",
        )
        hass.config_entries.async_update_entry(
            entry, data={**entry.data, "welcome_shown": True}
        )

    _LOGGER.info("Nida loaded successfully for entry %s", entry.entry_id)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        async_remove_panel(hass)
        hass.data[DOMAIN].pop(entry.entry_id, None)
        hass.data[DOMAIN].pop(f"_scheduler_{entry.entry_id}", None)
        hass.data[DOMAIN].pop(f"_live_activity_{entry.entry_id}", None)
        hass.data[DOMAIN].pop(f"_sidebar_state_{entry.entry_id}", None)
        if not hass.config_entries.async_entries(DOMAIN):
            async_unregister_services(hass)
    return unload_ok


# 2.0.68 — settings backup/restore across reinstalls. A JSON snapshot of
# entry.options is written to <config>/nida_settings_backup.json on every
# options update and at first setup. When a fresh config entry has empty
# options (just installed), the snapshot is auto-restored so all settings
# survive a remove-and-reinstall cycle, same UX as built-in HA integrations.
_BACKUP_FILENAME = "nida_settings_backup.json"


def _backup_path(hass: HomeAssistant) -> str:
    return hass.config.path(_BACKUP_FILENAME)


def _save_settings_backup(hass: HomeAssistant, options: dict) -> None:
    """Write the current options to the backup file (sync, small dict)."""
    try:
        path = _backup_path(hass)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(dict(options), f, ensure_ascii=False, indent=2)
        _LOGGER.debug("Nida settings backed up to %s", path)
    except OSError as err:
        _LOGGER.warning("Nida settings backup failed: %s", err)


def _load_settings_backup(hass: HomeAssistant) -> dict | None:
    """Read the backup file if it exists. Returns None on any failure."""
    path = _backup_path(hass)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and data:
            _LOGGER.info("Nida settings restored from backup (%d keys)", len(data))
            return data
    except (OSError, json.JSONDecodeError, ValueError) as err:
        _LOGGER.warning("Nida settings backup read failed: %s", err)
    return None


def _async_teardown_dua_triggers(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Unsubscribe the dua trigger listener, if any."""
    nida_data = hass.data.setdefault(DOMAIN, {})
    unsub = nida_data.pop(f"_dua_trigger_unsub_{entry.entry_id}", None)
    if unsub:
        unsub()


def _async_setup_dua_triggers(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """(Re)subscribe state listeners for dua trigger entities (2.0.61).

    Each dua may name a trigger_entity (binary_sensor/switch/
    input_boolean). On that entity's transition TO "on" (door or window
    opens, switch flips on) the dua plays via nida.play_dua, rate-
    limited to one start per DUA_TRIGGER_COOLDOWN_SECONDS per dua so a
    bouncing contact sensor cannot restart it in a loop. Rebuilt from
    scratch on every options update — cheap, and it keeps the mapping
    trivially in sync without diffing.
    """
    _async_teardown_dua_triggers(hass, entry)
    nida_data = hass.data.setdefault(DOMAIN, {})

    # 2.5.0 — each dua also has a trigger_state ("on" default, or "off"):
    # the state the entity must change TO for the dua to fire.
    mapping: dict[str, list[tuple[str, str]]] = {}
    for d in entry.options.get(OPT_DUAS) or []:
        if isinstance(d, dict) and d.get("id") and d.get("trigger_entity"):
            target = "off" if d.get("trigger_state") == "off" else "on"
            mapping.setdefault(str(d["trigger_entity"]), []).append(
                (str(d["id"]), target)
            )
    if not mapping:
        return

    last_fired = nida_data.setdefault(f"_dua_trigger_last_{entry.entry_id}", {})

    @callback
    def _on_trigger_state(event) -> None:
        new = event.data.get("new_state")
        old = event.data.get("old_state")
        # Only the transition INTO the target state: ignore updates that
        # stay in it (attribute changes) and any other state.
        if new is None:
            return
        entity_id = event.data.get("entity_id")
        now = time.monotonic()
        for dua_id, target in mapping.get(entity_id, []):
            if new.state != target:
                continue
            if old is not None and old.state == target:
                continue
            prev = last_fired.get(dua_id, 0.0)
            if now - prev < DUA_TRIGGER_COOLDOWN_SECONDS:
                _LOGGER.debug(
                    "Dua trigger %s → %s suppressed (cooldown)", entity_id, dua_id
                )
                continue
            last_fired[dua_id] = now
            _LOGGER.info("Dua trigger %s fired → playing %s", entity_id, dua_id)
            hass.async_create_task(
                hass.services.async_call(DOMAIN, "play_dua", {"dua_id": dua_id})
            )

    nida_data[f"_dua_trigger_unsub_{entry.entry_id}"] = (
        async_track_state_change_event(hass, list(mapping), _on_trigger_state)
    )
    _LOGGER.debug(
        "Dua triggers subscribed: %s", {k: v for k, v in mapping.items()}
    )


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """React to entry.options changes.

    Sidebar toggle requires a full integration reload (the panel
    registration is conditional on it and there's no cheaper way to
    mount/unmount the sidebar entry). Every other options change —
    prayer toggles, sound choices, notification config, theme — only
    needs the scheduler to re-plan: no platform reload, no panel
    remount, no browser bounce-back to the dashboard.
    """
    nida_data = hass.data.setdefault(DOMAIN, {})
    # 2.0.68 — persist a backup of the full options dict so a
    # remove-and-reinstall restores everything automatically.
    await hass.async_add_executor_job(_save_settings_backup, hass, entry.options)
    key = f"_sidebar_state_{entry.entry_id}"
    prev = nida_data.get(key)
    curr = entry.options.get(OPT_SHOW_IN_SIDEBAR, True)
    nida_data[key] = curr
    if prev != curr:
        await hass.config_entries.async_reload(entry.entry_id)
        return
    # 2.0.51 — the button platform derives its entities from the duas
    # list, so adding/removing a dua needs a platform reload. Same
    # tracked-state pattern as the sidebar toggle above. Edits WITHIN a
    # dua (sound/player/volume) don't change the id set and need no
    # reload: nida.play_dua reads options live at press time.
    dua_key = f"_dua_ids_{entry.entry_id}"
    prev_ids = nida_data.get(dua_key)
    curr_ids = tuple(
        sorted(
            str(d.get("id"))
            for d in (entry.options.get(OPT_DUAS) or [])
            if isinstance(d, dict) and d.get("id")
        )
    )
    nida_data[dua_key] = curr_ids
    # 2.0.61 — trigger listeners follow the options: rebuild them on
    # every update. Covers new/removed triggers AND trigger changes
    # within an unchanged dua id set.
    _async_setup_dua_triggers(hass, entry)
    if prev_ids != curr_ids:
        # 2.0.60 — reload ONLY the button platform. The previous full
        # entry reload also tore down the custom panel + websocket the
        # user was looking at: every dua add/remove "crashed" the open
        # panel until a browser refresh, and service calls misfired
        # while the integration was mid-restart. Unload/re-forward of
        # just the button platform recreates the dua button entities
        # without touching panel, scheduler or sensors.
        await hass.config_entries.async_unload_platforms(entry, ["button"])
        await hass.config_entries.async_forward_entry_setups(entry, ["button"])
        return
    # Non-sidebar change — nudge the scheduler so the new options
    # (per-prayer toggles, notify config, jumuah window, ...) take
    # effect immediately instead of at the next 12-hour refresh.
    scheduler = nida_data.get(f"_scheduler_{entry.entry_id}")
    if scheduler is not None:
        scheduler._async_reschedule()
    live_activity = nida_data.get(f"_live_activity_{entry.entry_id}")
    if live_activity is not None:
        live_activity.async_reschedule()

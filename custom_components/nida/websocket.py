"""Nida websocket API — panel <-> config_entry communicatie.

Het Nida-panel (frontend/nida-panel.js) praat via deze commands met de
Python-backend, omdat een custom panel geen directe toegang heeft tot
hass.config_entries. Alle instellingen die voorheen in de config/options
flow zaten (locatie, methode, per-gebed aan/uit, sound-keuze) lopen vanaf
2.0.0 via dit kanaal.

Sound-download-on-demand (categorie 5 in references/architecture.md) is
nog niet geïmplementeerd in dit skelet — ws_update_settings slaat alleen
de gekozen waarde op. De daadwerkelijke download volgt zodra de
sound-catalogus (sounds/catalog/catalog.json) er is.

Changelog:
  2.5.0 (2026-10-10): New nida/test_live_activity command — a 90-second preview
                       of the next-prayer Live Activity for the panel's test button.
  2.1.35 (2026-07-11): nida/list_scenes added — same shape as
                       nida/list_media_players, for the new Fajr wake-up
                       alarm's scene picker (Johann wants an existing HA
                       scene, e.g. a "wake-up light", activated at a
                       configurable time before Fajr with a max
                       transition duration; see scheduler.py's changelog
                       for the trigger side).
  2.1.24 (2026-07-09): _dispatch_notify passes `hass` through to
                       scheduler._notify_service_data_for_target, which
                       gained a `hass` param so it can detect Android TV
                       targets and add data.position="top-right" for
                       them (see scheduler.py's own changelog) — so a
                       test notification via ws_test_notify/ws_test_jumuah
                       previews the same top-right placement the real
                       adhan-time/Jumu'ah/calendar notifications now use.
  2.1.19 (2026-07-08): ws_list_notify_services now also returns
                       `is_android_tv` + `available` per target (new
                       _nfandroidtv_info helper), for the "Notifications
                       for Android TV / Fire TV" integration (domain
                       nfandroidtv). Unlike mobile_app's legacy non-entity
                       notify service, nfandroidtv registers a real notify
                       entity, so detection is a direct entity-registry
                       lookup rather than a name/slug guess. `available`
                       reflects the entity's live state so the panel can
                       warn when the TV is currently unreachable (Local
                       Push integration — Home Assistant only really
                       knows "unavailable" after a failed push, but that's
                       still better than no signal at all).
  2.1.3 (2026-07-08): nida/get_quote command REMOVED — the Quote feature
                       (rotating Quran verse/hadith companion card) is
                       retired per Johann's request. quotes.py is deleted
                       alongside this; nothing else referenced it.
  2.1.2 (2026-07-08): nida/get_calendar_month command — powers the new
                       calendar month-grid companion card (replaces the
                       old client-side approximate holiday card).
                       Delegates to islamic_calendar.
                       async_get_hijri_month_calendar; no ConfigEntry
                       needed (calendar conversion is location-
                       independent, same as the existing gToHCalendar
                       lookup).
  2.0.100 (2026-07-08): ws_list_notify_services now returns `manufacturer`
                       per target (new _mobile_app_manufacturer helper),
                       read from the mobile_app config entry's
                       registration data and matched by recomputing the
                       service-name slug with HA's own `slugify`. Powers
                       the panel's Samsung label + auto-suggested TTS/
                       alarm-stream workaround (nida-panel.js 2.0.100) so
                       other HACS users don't have to independently
                       discover this the way this session did.
  2.0.97 (2026-07-08): Fixed root cause of the TTS-workaround flag never
                       taking effect: ws_test_notify / ws_test_jumuah
                       both blindly read hass.config_entries.
                       async_entries(DOMAIN)[0] — the FIRST Nida config
                       entry — regardless of which entry_id the panel
                       session was actually editing. With more than one
                       Nida entry present (e.g. leftover from an earlier
                       setup/rebuild), the test buttons silently tested
                       against a different, stale entry's options than
                       the one just saved from the panel — confirmed via
                       temporary debug logging (removed again here) that
                       showed the panel's saved notify_tts_workaround_
                       targets never reached the test call. Both
                       commands now accept an optional `entry_id`
                       (the panel always sends its own this._entryId,
                       see nida-panel.js) and resolve via _get_entry,
                       matching how ws_get_settings/ws_update_settings
                       already worked; falls back to the old
                       first-entry behaviour only if entry_id is
                       omitted.
  2.0.95 (2026-07-08): ws_test_notify + _dispatch_notify now read
                       options.notify_tts_workaround_targets and fork
                       each target's payload via scheduler's new
                       _notify_service_data_for_target instead of a
                       single shared `extra_data` dict, so a test
                       genuinely previews the Samsung TTS/alarm-stream
                       workaround (scheduler.py 2.0.95) exactly as it
                       will fire for real.
  2.0.91 (2026-07-07): nida/test_notify accepts an optional `prayer`
                       param (panel's new per-prayer test button). With
                       it: [prayer] resolves to that prayer's real name
                       instead of "Test", and its notify_critical_
                       enabled_<prayer> flag decides whether
                       _critical_notify_data (imported from .scheduler,
                       not reimplemented here — same payload, same
                       caveats) rides along. Without it, behaviour is
                       unchanged (generic message, never critical).
                       _dispatch_notify gained an optional `extra_data`
                       param to carry that through to the service call;
                       ws_test_jumuah is untouched, it never passes one.
  2.0.64 (2026-07-04): nida/get_quote command. Returns the rotating
                       Quran-verse/hadith of the current 4h slot for a
                       given language, delegating to quotes.py (cached
                       there, so this stays cheap).
  2.0.18 (2026-06-28): nida/test_jumuah leest nu options.jumuah_targets
                       i.p.v. notify_targets, conform de scheduler-
                       wijziging in dezelfde release. Geen no_targets-
                       error meer als notify_targets leeg is maar
                       jumuah_targets wel gevuld.
  2.0.16 (2026-06-28): nida/test_notify + nida/test_jumuah toegevoegd
                       voor de test-knoppen in het paneel. Beide lezen
                       de huidige options (targets, title, message) en
                       sturen direct naar de geconfigureerde notify.*
                       services — net als de scheduler dat doet bij
                       een echt gebed, maar dan on-demand. Returns
                       {sent: [...], total: N} zodat het paneel kan
                       laten zien hoeveel targets daadwerkelijk een
                       call hebben ontvangen vs. silent gefaalde.
  2.0.15 (2026-06-28): nida/list_notify_services toegevoegd voor de
                       Notifications-sectie van Release B. Geeft alle
                       beschikbare notify.* HA-services terug (filtert
                       de generieke "notify" eruit als die er staat,
                       want die is meestal een group/fallback en niet
                       zelf direct bedoeld). Backend voor de targets-
                       picker overlay in het paneel.
  2.0.13 (2026-06-28): nida/get_ha_info now also returns a
                       `location_display` string when reverse geocoding
                       succeeds — Nominatim's /reverse endpoint with
                       zoom=10 (city level). Panel shows this in the
                       device-mode resolved-location row instead of
                       the raw lat/lon. Falls back to coordinates if
                       the call times out or fails. Single new helper
                       `_nominatim_reverse` keeps the HTTP + UA glue
                       in one place; the search command and the reverse
                       command both call it with their own query string.
  2.0.12 (2026-06-28): nida/search_cities switched from `q=` to `city=`
                       structured-search parameter. Reason: Nominatim's
                       `q=` only matches whole tokens, so a 2-letter
                       prefix like "Bo" returned 0 hits even though
                       "Bogor" exists — autocomplete was effectively
                       broken for short inputs. The `city=` parameter
                       does prefix/partial matching, which is what
                       autocomplete needs. Diagnosed via a direct
                       fetch test in Safari devtools against the
                       Nominatim API. Place-type filter is loosened
                       a touch since `city=` already restricts results
                       to place entries — but kept for safety so the
                       odd `administrative` region with no settlement
                       semantics stays out.
  2.0.10 (2026-06-28): nida/search_cities toegevoegd — queries OpenStreetMap
                       Nominatim met ISO-2 country code + free-text query
                       en geeft een lijst van plaatsen terug (name, lat,
                       lon, display_name). Filtert resultaten op
                       class=place + place-types (city/town/village/...)
                       zodat de dropdown geen straten of winkels toont.
                       Nominatim usage policy: 1 req/sec en User-Agent
                       header verplicht — frontend debouncet op 300ms,
                       backend zet de UA-string.
  2.0.9 (2026-06-28): Twee nieuwe commands toegevoegd voor het panel:
                      nida/list_media_players geeft alle media_player.*
                      entities terug met friendly_name (voor de Speakers-
                      picker), en nida/get_ha_info geeft HA's
                      location_name + lat/lon terug (voor het tonen van
                      de resolved locatie in device-mode in het paneel).
  2.0.0 (2026-06-27): Nieuw bestand — get_settings/update_settings commands
                      voor het panel. async_setup is sync (@callback), conform
                      het standaard HA-patroon voor websocket-command-registratie.
                      Download-on-demand nog niet geïmplementeerd.
"""
from __future__ import annotations

import asyncio
import logging
from urllib.parse import quote_plus

import aiohttp
import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.util import slugify

from . import islamic_calendar
from .const import DOMAIN, OPT_SETTINGS_USERS, PRAYERS
from .catalog import (
    async_delete_sound,
    async_download_sound,
    async_fetch_catalog,
    local_sound_exists,
)

_LOGGER = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
NOMINATIM_USER_AGENT = (
    "Nida HACS integration (+https://github.com/joohann/Nida)"
)
NOMINATIM_TIMEOUT_SECONDS = 8

# Nominatim type values that count as a populated place — anything else
# (streets, shops, peaks, ...) is filtered out so the dropdown stays clean.
# With the `city=` structured-search parameter (2.0.12+), Nominatim returns
# either class=place (settlements) or class=boundary (administrative units
# like municipalities) — we accept both, but still gate on type so a stray
# boundary=postal_code or similar doesn't slip through.
_PLACE_CLASSES = {"place", "boundary"}
_PLACE_TYPES = {
    "city", "town", "village", "hamlet", "municipality",
    "administrative", "suburb", "neighbourhood",
}


def _get_entry(hass: HomeAssistant, entry_id: str):
    """Haal de Nida config entry op, of None als die niet bestaat."""
    return hass.config_entries.async_get_entry(entry_id)


def _may_edit_settings(hass: HomeAssistant, connection) -> bool:
    """May the user behind this connection CHANGE Nida's settings? (2.3.16)

    Allowlist empty  → any Home Assistant admin.
    Allowlist filled → only the listed user ids, which is how other admins
                       get shut out.

    This is the real enforcement; the panel hiding its settings column is
    only cosmetic and trivially bypassed by talking to the websocket
    directly. See const.py's OPT_SETTINGS_USERS for what this does and does
    not protect against.

    A missing connection.user (shouldn't happen on an authenticated
    websocket) is treated as not allowed rather than allowed.
    """
    user = getattr(connection, "user", None)
    if user is None:
        return False
    # 2.3.17 — the owner is never excluded, whatever the allowlist says.
    # Without this the allowlist is a loaded gun: save a list you are not
    # on and the panel locks you out of your own install, recoverable only
    # via the Integrations page or by editing .storage. The owner is also
    # the one account HA itself treats as undeletable and always admin, so
    # anchoring to it costs nothing — and anyone who could abuse the
    # exception is already the owner.
    if getattr(user, "is_owner", False):
        return True
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}
    allowed = [u for u in (options.get(OPT_SETTINGS_USERS) or []) if isinstance(u, str)]
    if allowed:
        return user.id in allowed
    return bool(user.is_admin)


def _deny_settings(connection, msg) -> None:
    connection.send_error(
        msg["id"], "unauthorized", "Not allowed to change Nida settings"
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/get_settings",
        vol.Required("entry_id"): cv.string,
    }
)
@websocket_api.async_response
async def ws_get_settings(hass: HomeAssistant, connection, msg) -> None:
    """Geef de huidige config_entry.options terug aan het panel."""
    entry = _get_entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Config entry niet gevonden")
        return
    connection.send_result(msg["id"], dict(entry.options))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/update_settings",
        vol.Required("entry_id"): cv.string,
        vol.Required("options"): dict,
    }
)
@websocket_api.async_response
async def ws_update_settings(hass: HomeAssistant, connection, msg) -> None:
    """Sla nieuwe instellingen op vanuit het panel."""
    # 2.3.16 — server-side gate; the panel hiding its settings is
    # cosmetic, this is what actually refuses the write.
    if not _may_edit_settings(hass, connection):
        _LOGGER.warning("Nida settings change refused for user %s", getattr(connection.user, "name", "?"))
        _deny_settings(connection, msg)
        return
    entry = _get_entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Config entry niet gevonden")
        return

    hass.config_entries.async_update_entry(entry, options=msg["options"])
    _LOGGER.debug("Nida settings bijgewerkt via panel: %s", msg["options"])
    connection.send_result(msg["id"], {"success": True})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/list_media_players",
    }
)
@websocket_api.async_response
async def ws_list_media_players(hass: HomeAssistant, connection, msg) -> None:
    """Return all media_player entities for the panel's Speakers picker."""
    items = []
    for state in hass.states.async_all("media_player"):
        items.append(
            {
                "entity_id": state.entity_id,
                "name": state.attributes.get("friendly_name") or state.entity_id,
                "state": state.state,
            }
        )
    items.sort(key=lambda x: x["name"].lower())
    connection.send_result(msg["id"], items)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/list_scenes",
    }
)
@websocket_api.async_response
async def ws_list_scenes(hass: HomeAssistant, connection, msg) -> None:
    """Return all scene.* entities for the Fajr wake-up alarm's scene
    picker (2.1.35) — same exact shape/pattern as ws_list_media_players
    above, just a different domain."""
    items = []
    for state in hass.states.async_all("scene"):
        items.append(
            {
                "entity_id": state.entity_id,
                "name": state.attributes.get("friendly_name") or state.entity_id,
            }
        )
    items.sort(key=lambda x: x["name"].lower())
    connection.send_result(msg["id"], items)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/get_ha_info",
    }
)
@websocket_api.async_response
async def ws_get_ha_info(hass: HomeAssistant, connection, msg) -> None:
    """Return HA's configured location info for read-only display in the panel.

    `location_name` is whatever the user set as "Home" name in HA's general
    settings (e.g. "Production"). For a nicer human-readable label the
    panel prefers `location_display` — a comma-joined "Breukelen, Stichtse
    Vecht, Utrecht, Nederland" coming from Nominatim's reverse endpoint at
    city-level zoom. If the reverse call fails, `location_display` is null
    and the panel falls back to the raw coordinates.
    """
    lat = hass.config.latitude
    lon = hass.config.longitude

    location_display = None
    if isinstance(lat, (int, float)) and isinstance(lon, (int, float)):
        location_display = await _nominatim_reverse(hass, lat, lon)

    connection.send_result(
        msg["id"],
        {
            "location_name": hass.config.location_name,
            "latitude": lat,
            "longitude": lon,
            "location_display": location_display,
            "version": hass.data.get(DOMAIN, {}).get("version", ""),
        },
    )


async def _nominatim_reverse(
    hass: HomeAssistant, lat: float, lon: float
) -> str | None:
    """Reverse-geocode lat/lon to a human-readable place string.

    Uses Nominatim's /reverse endpoint with zoom=10 (city level), which
    returns enough context (city, region, country) without dragging in
    the user's exact street. Returns None on any failure — caller is
    expected to handle that gracefully (panel falls back to raw coords).
    """
    url = (
        f"{NOMINATIM_REVERSE_URL}"
        f"?format=json&zoom=10&addressdetails=0"
        f"&lat={lat}&lon={lon}"
    )
    headers = {"User-Agent": NOMINATIM_USER_AGENT}
    session = async_get_clientsession(hass)
    try:
        async with asyncio.timeout(NOMINATIM_TIMEOUT_SECONDS):
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    _LOGGER.debug(
                        "Nominatim reverse returned HTTP %s for %s,%s",
                        resp.status, lat, lon,
                    )
                    return None
                data = await resp.json()
    except (asyncio.TimeoutError, aiohttp.ClientError) as err:
        _LOGGER.debug("Nominatim reverse failed: %s", err)
        return None

    return data.get("display_name") or None


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/search_cities",
        vol.Required("country_code"): cv.string,
        vol.Required("query"): cv.string,
    }
)
@websocket_api.async_response
async def ws_search_cities(hass: HomeAssistant, connection, msg) -> None:
    """Search OpenStreetMap Nominatim for places matching query in country.

    `country_code` is the ISO 3166-1 alpha-2 code (NL, DE, ...) — that's
    what the panel's country picker already stores. `query` is the
    free-text the user typed in the city field. Results are filtered to
    populated places so the dropdown isn't polluted with shops or roads.

    Returns up to 10 hits with the local short name, full display name,
    and lat/lon — picking a hit writes lat/lon back to options so the
    coordinator can use coordinates instead of the country/city strings
    when talking to Aladhan.
    """
    country_code = (msg.get("country_code") or "").strip().lower()
    query = (msg.get("query") or "").strip()
    if not country_code or len(query) < 2:
        connection.send_result(msg["id"], [])
        return

    url = (
        f"{NOMINATIM_URL}"
        f"?format=json&addressdetails=0&limit=10"
        f"&countrycodes={quote_plus(country_code)}"
        f"&city={quote_plus(query)}"
    )
    headers = {"User-Agent": NOMINATIM_USER_AGENT}

    session = async_get_clientsession(hass)
    try:
        async with asyncio.timeout(NOMINATIM_TIMEOUT_SECONDS):
            async with session.get(url, headers=headers) as resp:
                if resp.status != 200:
                    _LOGGER.warning(
                        "Nominatim returned HTTP %s for query %r in %s",
                        resp.status, query, country_code,
                    )
                    connection.send_result(msg["id"], [])
                    return
                data = await resp.json()
    except (asyncio.TimeoutError, aiohttp.ClientError) as err:
        _LOGGER.warning("Nominatim request failed: %s", err)
        connection.send_result(msg["id"], [])
        return

    results = []
    for item in data:
        if item.get("class") not in _PLACE_CLASSES:
            continue
        if item.get("type") not in _PLACE_TYPES:
            continue
        try:
            lat = float(item["lat"])
            lon = float(item["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        display = item.get("display_name") or ""
        # Short local name = first segment of the comma-joined display name.
        name = display.split(",", 1)[0].strip() if display else ""
        if not name:
            continue
        results.append(
            {
                "name": name,
                "display_name": display,
                "lat": lat,
                "lon": lon,
            }
        )
    connection.send_result(msg["id"], results[:10])


def _mobile_app_manufacturer(hass: HomeAssistant, service_name: str) -> str | None:
    """Best-effort manufacturer for a notify.mobile_app_* service (e.g.
    "Samsung"), or None if it isn't a mobile_app target or nothing matches.

    2.0.100 — added for the Samsung TTS/alarm-stream workaround (see
    scheduler.py's _tts_critical_notify_data): rather than making users
    discover on their own that a Samsung phone needs this (as happened
    debugging this feature), the panel can now show which target this
    is and pre-suggest the workaround for it.

    The Companion app sends `manufacturer` (and `model`, `device_name`)
    as part of its registration payload, and mobile_app stores that
    verbatim in the config entry's `.data` — deliberately reading THAT
    rather than the device registry, since mobile_app's internal device-
    registry identifier scheme isn't documented public API and isn't
    worth depending on here. The notify service itself is named
    `mobile_app_<slugify(device_name)>` by mobile_app's notify platform;
    recomputing that with Home Assistant's own `slugify` (not a hand-
    rolled one) means this matches exactly what mobile_app produced,
    rather than guessing at a naming convention. Returns None (no label
    shown, no auto-suggestion) rather than guess when nothing matches —
    e.g. for non-mobile_app notify targets (persistent_notification,
    send_message, group notifiers) this is expected and fine.
    """
    if not service_name.startswith("mobile_app_"):
        return None
    suffix = service_name[len("mobile_app_"):]
    for entry in hass.config_entries.async_entries("mobile_app"):
        device_name = entry.data.get("device_name") or entry.title
        if device_name and slugify(device_name) == suffix:
            return entry.data.get("manufacturer")
    return None


def _nfandroidtv_info(hass: HomeAssistant, service_name: str) -> tuple[bool, bool]:
    """(is_android_tv, available) for a notify.<service_name> target.

    2.1.19 — added for Johann's Android TV notifications request. Unlike
    mobile_app (a legacy, non-entity notify service — see
    _mobile_app_manufacturer's docstring for why THAT needs a slugify
    cross-match against config entry data), the "Notifications for
    Android TV / Fire TV" integration (domain nfandroidtv) registers a
    real notify PLATFORM ENTITY, so entity_id and the legacy service name
    are the same string and we can look it up directly in the entity
    registry — far more reliable than name-guessing.

    `available` mirrors the entity's live state. nfandroidtv is IoT class
    "Local Push" (a direct push to the TV app, no persistent connection
    Home Assistant can independently monitor), so an "unavailable" state
    is the best signal Nida has that the TV is currently unreachable —
    Johann specifically asked that we surface this rather than silently
    trying to notify a device that's off. Returns (False, True) for any
    non-nfandroidtv service (i.e. "not a TV, nothing to warn about").
    """
    entity_id = f"notify.{service_name}"
    entry = er.async_get(hass).async_get(entity_id)
    if entry is None or entry.platform != "nfandroidtv":
        return False, True
    state = hass.states.get(entity_id)
    available = state is not None and state.state != "unavailable"
    return True, available


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/list_notify_services",
    }
)
@websocket_api.async_response
async def ws_list_notify_services(hass: HomeAssistant, connection, msg) -> None:
    """Return all notify.* service names for the panel's Notifications picker.

    Filters out the generic "notify" service (which is typically a
    group/router and not directly meaningful to pick). Each item is
    returned as {service, full} so the panel can show "mobile_app_johann"
    while saving "notify.mobile_app_johann" — the latter is what
    scheduler.py needs when it later calls hass.services.async_call.

    2.0.100 — each item also carries `manufacturer` (via
    _mobile_app_manufacturer above), None for anything that isn't a
    recognised mobile_app device. The panel uses this to label likely
    Samsung targets and pre-suggest the TTS/alarm-stream workaround when
    a target is first selected.

    2.1.19 — each item also carries `is_android_tv` and `available` (via
    _nfandroidtv_info above). The picker uses these to label an Android
    TV target distinctly and to warn when it's currently offline. Note
    this list only ever contains services that actually exist right now
    (hass.services.async_services()), so an Android TV target can only
    ever appear here if the nfandroidtv integration is actually installed
    and configured — Johann's other request ("alleen mogelijk als je de
    plugin geïnstalleerd hebt") is satisfied for free by that, no extra
    gating needed.
    """
    items = []
    all_services = hass.services.async_services()
    notify_services = all_services.get("notify", {})
    for service_name in sorted(notify_services.keys()):
        if service_name == "notify":
            # Generic notify.notify is typically a default-fallback group;
            # exposing it as a separate pick adds noise.
            continue
        is_android_tv, available = _nfandroidtv_info(hass, service_name)
        items.append(
            {
                "service": service_name,
                "full": f"notify.{service_name}",
                "manufacturer": _mobile_app_manufacturer(hass, service_name),
                "is_android_tv": is_android_tv,
                "available": available,
            }
        )
    connection.send_result(msg["id"], items)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/test_notify",
        vol.Optional("prayer"): vol.In(PRAYERS),
        vol.Optional("entry_id"): cv.string,
    }
)
@websocket_api.async_response
async def ws_test_notify(hass: HomeAssistant, connection, msg) -> None:
    """Send a test notification to all configured targets right now.

    Uses the current notify_title / notify_message options exactly as
    the scheduler would. [prayer] placeholder is replaced with "Test"
    so the recipient sees what a real adhan-time notification would
    look like, but with a clear test marker.

    2.0.91 — optional `prayer` param (from the panel's new per-prayer
    test button, one per row in Per-prayer notifications). When given,
    [prayer] is replaced with that prayer's actual name instead of the
    generic "Test" placeholder, AND we look up that specific prayer's
    notify_critical_enabled_<prayer> flag. No `prayer` (the old blanket
    "Send test notification" button at the bottom) keeps the previous
    behaviour: generic message, never critical, regardless of any
    prayer's setting. If critical, if on, and per target, whether it's
    the TTS/alarm-stream workaround or the normal critical payload that
    goes out is decided by _notify_service_data_for_target
    (scheduler.py) via _dispatch_notify below — same function the real
    adhan-time firing uses, so this test can't drift from reality.

    2.0.97 — FIXED: this always read `async_entries(DOMAIN)[0]`, the
    FIRST Nida config entry, regardless of which entry the panel
    session (`this._entryId`) was actually editing. With more than one
    Nida entry present (leftover from a previous setup/rebuild), the
    test button could silently test against a DIFFERENT entry's stale
    options than the one just edited in the panel — exactly what
    happened debugging the Samsung TTS workaround: a target flag saved
    against the panel's entry never showed up here because this read a
    different entry entirely. Now accepts an optional `entry_id` (the
    panel always sends its own `this._entryId`) and resolves via
    `_get_entry`, falling back to the old first-entry behaviour only if
    entry_id is omitted (kept for any other caller of this command).
    """
    # 2.3.16 — server-side gate; the panel hiding its settings is
    # cosmetic, this is what actually refuses the write.
    if not _may_edit_settings(hass, connection):
        _LOGGER.warning("Nida test notification refused for user %s", getattr(connection.user, "name", "?"))
        _deny_settings(connection, msg)
        return
    from .const import (
        DEFAULT_NOTIFY_MESSAGE_FALLBACK,
        DEFAULT_NOTIFY_TITLE_FALLBACK,
        OPT_NOTIFY_CRITICAL_ENABLED_PREFIX,
        OPT_NOTIFY_MESSAGE,
        OPT_NOTIFY_TARGETS,
        OPT_NOTIFY_TITLE,
        OPT_NOTIFY_TTS_WORKAROUND_TARGETS,
    )

    entry_id = msg.get("entry_id")
    if entry_id:
        entry = _get_entry(hass, entry_id)
        if entry is None:
            connection.send_error(msg["id"], "not_found", "No Nida entry")
            return
    else:
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            connection.send_error(msg["id"], "not_found", "No Nida entry")
            return
        entry = entries[0]
    options = entry.options

    targets = list(options.get(OPT_NOTIFY_TARGETS) or [])
    if not targets:
        connection.send_error(
            msg["id"], "no_targets", "No notification targets configured"
        )
        return

    title = options.get(OPT_NOTIFY_TITLE) or DEFAULT_NOTIFY_TITLE_FALLBACK
    message_tpl = (
        options.get(OPT_NOTIFY_MESSAGE) or DEFAULT_NOTIFY_MESSAGE_FALLBACK
    )

    prayer = msg.get("prayer")
    critical = False
    if prayer:
        message = message_tpl.replace("[prayer]", prayer.capitalize())
        critical = bool(
            options.get(f"{OPT_NOTIFY_CRITICAL_ENABLED_PREFIX}{prayer}", False)
        )
    else:
        message = message_tpl.replace("[prayer]", "Test")

    # 2.0.95 — targets flagged for the Samsung TTS/alarm-stream
    # workaround; _dispatch_notify forks per target via the same
    # _notify_service_data_for_target the scheduler uses for real, so a
    # test genuinely previews what fires at real adhan time.
    tts_workaround_targets = set(
        options.get(OPT_NOTIFY_TTS_WORKAROUND_TARGETS) or []
    )
    sent = await _dispatch_notify(
        hass, targets, title, message, critical, tts_workaround_targets,
        options=options,
    )
    connection.send_result(msg["id"], {"sent": sent, "total": len(targets)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/test_live_activity",
        vol.Optional("entry_id"): cv.string,
    }
)
@websocket_api.async_response
async def ws_test_live_activity(hass: HomeAssistant, connection, msg) -> None:
    """Show a 90-second preview of the next-prayer Live Activity (2.5.0)."""
    if not _may_edit_settings(hass, connection):
        _deny_settings(connection, msg)
        return
    entry = _get_entry(hass, msg["entry_id"]) if msg.get("entry_id") else None
    if entry is None:
        entries = hass.config_entries.async_entries(DOMAIN)
        entry = entries[0] if entries else None
    manager = (
        hass.data.get(DOMAIN, {}).get(f"_live_activity_{entry.entry_id}")
        if entry
        else None
    )
    if manager is None:
        connection.send_error(msg["id"], "not_found", "No Nida entry")
        return
    sent = await manager.async_test()
    if not sent:
        connection.send_error(
            msg["id"], "no_targets", "No mobile app notification targets configured"
        )
        return
    connection.send_result(msg["id"], {"sent": sent, "total": len(sent)})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/test_jumuah",
        vol.Optional("entry_id"): cv.string,
    }
)
@websocket_api.async_response
async def ws_test_jumuah(hass: HomeAssistant, connection, msg) -> None:
    """Send a test Jumu'ah reminder to all configured targets right now.

    Uses the current jumuah_message + jumuah_reminder_minutes options.
    Same target list as the regular notifications (no separate Jumu'ah
    targets field — by design).

    2.0.97 — same entry_id fix as ws_test_notify: resolves the SAME
    config entry the panel is editing instead of blindly grabbing
    `async_entries(DOMAIN)[0]`, which silently reads a different, stale
    entry's options whenever more than one Nida entry exists.
    """
    # 2.3.16 — server-side gate; the panel hiding its settings is
    # cosmetic, this is what actually refuses the write.
    if not _may_edit_settings(hass, connection):
        _LOGGER.warning("Nida test notification refused for user %s", getattr(connection.user, "name", "?"))
        _deny_settings(connection, msg)
        return
    from .const import (
        DEFAULT_JUMUAH_MESSAGE_FALLBACK,
        DEFAULT_JUMUAH_MINUTES,
        DEFAULT_NOTIFY_TITLE_FALLBACK,
        OPT_JUMUAH_MESSAGE,
        OPT_JUMUAH_REMINDER_MINUTES,
        OPT_JUMUAH_TARGETS,
        OPT_NOTIFY_TITLE,
    )
    entry_id = msg.get("entry_id")
    if entry_id:
        entry = _get_entry(hass, entry_id)
        if entry is None:
            connection.send_error(msg["id"], "not_found", "No Nida entry")
            return
    else:
        entries = hass.config_entries.async_entries(DOMAIN)
        if not entries:
            connection.send_error(msg["id"], "not_found", "No Nida entry")
            return
        entry = entries[0]
    options = entry.options

    # Use the Jumu'ah-specific target list, not the general one — these
    # are intentionally separate (2.0.18+) so a Friday-only reminder
    # doesn't go to devices that shouldn't get it.
    targets = list(options.get(OPT_JUMUAH_TARGETS) or [])
    if not targets:
        connection.send_error(
            msg["id"], "no_targets", "No notification targets configured"
        )
        return

    title = options.get(OPT_NOTIFY_TITLE) or DEFAULT_NOTIFY_TITLE_FALLBACK
    minutes = int(
        options.get(OPT_JUMUAH_REMINDER_MINUTES, DEFAULT_JUMUAH_MINUTES) or 60
    )
    message_tpl = (
        options.get(OPT_JUMUAH_MESSAGE) or DEFAULT_JUMUAH_MESSAGE_FALLBACK
    )
    message = message_tpl.replace("[minutes]", str(minutes))

    sent = await _dispatch_notify(hass, targets, title, message, options=options)
    connection.send_result(msg["id"], {"sent": sent, "total": len(targets)})


async def _dispatch_notify(
    hass: HomeAssistant,
    targets: list[str],
    title: str,
    message: str,
    critical: bool = False,
    tts_workaround_targets: set[str] | None = None,
    options: dict | None = None,
) -> list[str]:
    """Send a notification to every target; return the list that succeeded.

    Shared by ws_test_notify and ws_test_jumuah — same dispatch shape
    the scheduler uses, just inlined here because importing scheduler's
    handler-builder from a websocket handler would tangle the layers.

    2.0.91 — optional critical payload for ws_test_notify's per-prayer
    path; ws_test_jumuah never passes `critical` (Jumu'ah has no
    critical option) so its calls are unaffected.

    2.0.95 — replaced the old `extra_data` param with `critical` +
    `tts_workaround_targets`, building each target's service_data via
    scheduler._notify_service_data_for_target (imported locally to
    avoid a module-load cycle) instead of a single shared dict, so the
    Samsung TTS/alarm-stream workaround forks per target here exactly
    like it does for the real scheduler-fired notification.
    """
    from .scheduler import _notify_service_data_for_target

    sent: list[str] = []
    for target in targets:
        try:
            domain, service = target.split(".", 1)
        except ValueError:
            _LOGGER.warning("Invalid notify target %r; skipping", target)
            continue
        # 2.3.12 — options threaded through so a TEST notification carries
        # the same Nida icon/branding the real ones do; a test that looked
        # different from the real thing would defeat its purpose.
        service_data = _notify_service_data_for_target(
            hass, target, title, message, critical, tts_workaround_targets,
            options=options,
        )
        try:
            await hass.services.async_call(
                domain, service,
                service_data,
                blocking=True,
            )
            sent.append(target)
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Test notify failed on %s: %s", target, err)
    return sent


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/get_catalog",
        vol.Optional("force_refresh", default=False): bool,
    }
)
@websocket_api.async_response
async def ws_get_catalog(hass: HomeAssistant, connection, msg) -> None:
    """Return the Sound Library catalog enriched with local-presence flags.

    Each sound gets a `downloaded` field so the panel can render
    download vs delete buttons without a second round-trip.
    """
    result = await async_fetch_catalog(hass, force_refresh=bool(msg.get("force_refresh")))
    for s in result.get("sounds", []):
        s["downloaded"] = local_sound_exists(hass, s["rel_path"])
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/download_sound",
        vol.Required("url"): str,
        vol.Required("rel_path"): str,
    }
)
@websocket_api.async_response
async def ws_download_sound(hass: HomeAssistant, connection, msg) -> None:
    # 2.3.16 — server-side gate; the panel hiding its settings is
    # cosmetic, this is what actually refuses the write.
    if not _may_edit_settings(hass, connection):
        _LOGGER.warning("Nida sound download refused for user %s", getattr(connection.user, "name", "?"))
        _deny_settings(connection, msg)
        return
    result = await async_download_sound(hass, msg["url"], msg["rel_path"])
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/delete_sound",
        vol.Required("rel_path"): str,
    }
)
@websocket_api.async_response
async def ws_delete_sound(hass: HomeAssistant, connection, msg) -> None:
    # 2.3.16 — server-side gate; the panel hiding its settings is
    # cosmetic, this is what actually refuses the write.
    if not _may_edit_settings(hass, connection):
        _LOGGER.warning("Nida sound delete refused for user %s", getattr(connection.user, "name", "?"))
        _deny_settings(connection, msg)
        return
    result = await async_delete_sound(hass, msg["rel_path"])
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/list_tts_services",
    }
)
@websocket_api.async_response
async def ws_list_tts_services(hass: HomeAssistant, connection, msg) -> None:
    """Return all TTS engines currently available in HA.

    Modern HA exposes TTS engines as entities under the `tts` domain
    (e.g. tts.google_translate_en_com, tts.home_assistant_cloud).
    Each is callable via the universal tts.speak service. We return
    entity_id + friendly name so the panel can render a multi-select.
    """
    results = []
    for entity_id in hass.states.async_entity_ids("tts"):
        state = hass.states.get(entity_id)
        name = (state.attributes.get("friendly_name") if state else None) or entity_id
        results.append({"entity_id": entity_id, "name": name})
    # Stable order so the picker doesn't shuffle between opens.
    results.sort(key=lambda r: r["name"].lower())
    connection.send_result(msg["id"], {"services": results})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/get_calendar_month",
        vol.Required("hijri_month"): vol.All(int, vol.Range(min=1, max=12)),
        vol.Required("hijri_year"): int,
    }
)
@websocket_api.async_response
async def ws_get_calendar_month(hass: HomeAssistant, connection, msg) -> None:
    """Hijri month calendar for the panel's calendar card (2.1.2): one
    entry per day with its Gregorian equivalent + matched Islamic
    Calendar event keys (see islamic_calendar.events_for_hijri_day).

    Unlike the daily reminder lookahead (async_lookup_hijri_range), this
    queries Aladhan's Hijri-indexed hToGCalendar endpoint directly — the
    panel already knows which Hijri month/year to show (from the
    hijri_month/hijri_day/hijri_year sensors plus the user's prev/next
    month navigation), so no Gregorian-range translation or ConfigEntry
    lookup is needed here.
    """
    days = await islamic_calendar.async_get_hijri_month_calendar(
        hass, msg["hijri_month"], msg["hijri_year"]
    )
    connection.send_result(msg["id"], {"days": days})


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Registreer alle Nida websocket-commands."""
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_get_calendar_month)
    websocket_api.async_register_command(hass, ws_update_settings)
    websocket_api.async_register_command(hass, ws_list_media_players)
    websocket_api.async_register_command(hass, ws_list_scenes)
    websocket_api.async_register_command(hass, ws_get_ha_info)
    websocket_api.async_register_command(hass, ws_search_cities)
    websocket_api.async_register_command(hass, ws_list_notify_services)
    websocket_api.async_register_command(hass, ws_test_notify)
    websocket_api.async_register_command(hass, ws_test_jumuah)
    websocket_api.async_register_command(hass, ws_test_live_activity)
    websocket_api.async_register_command(hass, ws_get_catalog)
    websocket_api.async_register_command(hass, ws_download_sound)
    websocket_api.async_register_command(hass, ws_delete_sound)
    websocket_api.async_register_command(hass, ws_list_tts_services)

"""Nida services — user-facing service calls.

Currently exposes a single service:

  nida.play_adhan
    Plays the configured adhan sound for a given prayer on one or more
    media_player entities. Used by:
      - scheduler.py (automatic call at each prayer time)
      - panel preview button (future)
      - user automations / dashboards

The service does NOT contain prayer-time logic — it just plays whatever
file matches the prayer's sound category. The "when" is owned by
scheduler.py; the "what" is owned by entry.options.

Changelog:
  2.0.1 (2026-06-28): New file — initial play_adhan service. Resolves
                      sound file via options.sound_<category> with
                      DEFAULT_SOUNDS fallback; resolves target players
                      via call.entity_id with options.adhan_media_players
                      fallback.
"""
from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.helpers import config_validation as cv

from .const import (
    DEFAULT_SOUNDS,
    DOMAIN,
    OPT_ADHAN_MEDIA_PLAYERS,
    OPT_SOUND_PREFIX,
    PRAYER_SOUND_CATEGORY,
    PRAYERS,
)

_LOGGER = logging.getLogger(__name__)

SERVICE_PLAY_ADHAN = "play_adhan"

PLAY_ADHAN_SCHEMA = vol.Schema(
    {
        vol.Required("prayer"): vol.In(PRAYERS),
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
    }
)


def _sound_path_for(options: dict, prayer: str) -> str:
    """Resolve which file to play for this prayer.

    Maps prayer → sound category (fajr → fajr_adhan; all others → adhan),
    then reads options.sound_<category> or falls back to DEFAULT_SOUNDS.
    Returned value is the path relative to sounds/, e.g. "adhan/foo.mp3".
    """
    category = PRAYER_SOUND_CATEGORY[prayer]
    key = f"{OPT_SOUND_PREFIX}{category}"
    return options.get(key) or DEFAULT_SOUNDS[category]


def _resolve_media_players(
    hass: HomeAssistant, call_data: dict, options: dict
) -> list[str]:
    """Pick target players: explicit entity_id wins, else options fallback."""
    raw = call_data.get("entity_id")
    if raw:
        return [raw] if isinstance(raw, str) else list(raw)
    return list(options.get(OPT_ADHAN_MEDIA_PLAYERS) or [])


async def _async_handle_play_adhan(hass: HomeAssistant, call: ServiceCall) -> None:
    """Dispatch the call to media_player.play_media with the resolved URL + targets."""
    prayer = call.data["prayer"]

    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    sound_rel = _sound_path_for(options, prayer)
    media_url = f"/local/nida/sounds/{sound_rel}"

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.play_adhan: no media players resolved (neither entity_id "
            "in the call nor %s in options); nothing played",
            OPT_ADHAN_MEDIA_PLAYERS,
        )
        return

    _LOGGER.info("Playing adhan for %s on %s: %s", prayer, players, media_url)
    await hass.services.async_call(
        "media_player",
        "play_media",
        {
            "entity_id": players,
            "media_content_id": media_url,
            "media_content_type": "music",
        },
        blocking=False,
    )


def async_register_services(hass: HomeAssistant) -> None:
    """Register all Nida services. Called from async_setup_entry.

    Re-registering an existing service is a no-op, so calling this on
    every entry setup is safe.
    """
    if hass.services.has_service(DOMAIN, SERVICE_PLAY_ADHAN):
        return

    async def _wrapper(call: ServiceCall) -> None:
        await _async_handle_play_adhan(hass, call)

    hass.services.async_register(
        DOMAIN,
        SERVICE_PLAY_ADHAN,
        _wrapper,
        schema=PLAY_ADHAN_SCHEMA,
    )


def async_unregister_services(hass: HomeAssistant) -> None:
    """Remove Nida services. Only called when no Nida entries remain."""
    if hass.services.has_service(DOMAIN, SERVICE_PLAY_ADHAN):
        hass.services.async_remove(DOMAIN, SERVICE_PLAY_ADHAN)

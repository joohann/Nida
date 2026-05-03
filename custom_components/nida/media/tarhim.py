"""Nida tarhim flow — speelt tarhim vóór Fajr tijdens Ramadan."""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from ..const import (
    CONF_TARHIM_ENABLED, CONF_TARHIM_SPEAKER,
    CONF_TARHIM_VOLUME, CONF_TARHIM_SOUND,
)
from ..volume import get_volume
from ..notify import send_notification, get_default_message
from .audio import async_get_sound_duration
from .player import get_media_url, get_logo_url, play_media_with_volume

_LOGGER = logging.getLogger(__name__)

DEFAULT_SPEAKERS: list[str] = ["media_player.adhan_speakers"]
TARHIM_BUFFER_SECONDS = 10           # tarhim eindigt 10s vóór Fajr
TARHIM_WINDOW_SECONDS = 30           # tolerantie rond starttijd
SKIP_BOOLEAN_ENTITY = "input_boolean.nida_skip_suhoor"


def _is_ramadan(coordinator) -> bool:
    """Of het op dit moment Ramadan is volgens de coordinator data.

    Gebruikt month.number (int 9) i.p.v. substring-match op month.en.
    """
    try:
        month_num = int(
            coordinator.data["data"]["date"]["hijri"]["month"]["number"]
        )
        return month_num == 9
    except Exception:  # noqa: BLE001
        return False


def _is_skip_active(hass: HomeAssistant) -> bool:
    """Of de skip-helper aanstaat (gedeeld met suhoor)."""
    state = hass.states.get(SKIP_BOOLEAN_ENTITY)
    return state is not None and state.state == "on"


async def check_tarhim(
    hass: HomeAssistant,
    entry: ConfigEntry,
    coordinator,
    now_ts: float,
) -> None:
    """Controleer en speel tarhim vóór Fajr tijdens Ramadan.

    Starttijd = Fajr - duur_van_mp3 - 10 seconden buffer.
    Wordt elke minuut aangeroepen door de scheduler.
    """
    options = entry.options if entry.options else entry.data

    if not options.get(CONF_TARHIM_ENABLED, True):
        return

    if _is_skip_active(hass):
        _LOGGER.info("Tarhim overgeslagen — %s is aan", SKIP_BOOLEAN_ENTITY)
        return

    if not _is_ramadan(coordinator):
        return

    try:
        timings = coordinator.data["data"]["timings"]
        today = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(
            f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
        ).timestamp()

        sound = options.get(CONF_TARHIM_SOUND, "")
        if not sound:
            _LOGGER.warning("Geen tarhim sound geconfigureerd — overgeslagen")
            return

        duration = await async_get_sound_duration(hass, sound)
        if duration <= 0:
            _LOGGER.warning(
                "Kon duur van %s niet bepalen — tarhim overgeslagen", sound
            )
            return

        tarhim_ts = fajr_ts - duration - TARHIM_BUFFER_SECONDS

        _LOGGER.debug(
            "Tarhim timing: Fajr=%s, duur=%.1fs, buffer=%ds → start om %s",
            timings["Fajr"], duration, TARHIM_BUFFER_SECONDS,
            datetime.fromtimestamp(tarhim_ts).strftime("%H:%M:%S"),
        )

        if abs(now_ts - tarhim_ts) >= TARHIM_WINDOW_SECONDS:
            return

        speaker = options.get(CONF_TARHIM_SPEAKER, DEFAULT_SPEAKERS)
        if isinstance(speaker, str):
            speaker = [speaker]
        volume = get_volume(options, CONF_TARHIM_VOLUME, 10, hass=hass)
        media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")

        _LOGGER.info(
            "Tarhim afspelen: %s (%.1fs) — eindigt ~%ds voor Fajr om %s",
            sound, duration, TARHIM_BUFFER_SECONDS, timings["Fajr"],
        )
        await play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=get_logo_url(hass),
            restore_delay=duration + TARHIM_BUFFER_SECONDS + 5,
        )

        notify_lang = options.get("notify_lang", "nl")
        fallback_msg = get_default_message("tarhim", lang=notify_lang)
        await send_notification(
            hass, entry,
            message=fallback_msg,
            notify_type="tarhim",
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.error("Tarhim error: %s", e)

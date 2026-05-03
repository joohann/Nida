"""Nida suhoor flow — alarm vóór Fajr tijdens Ramadan, met skip-helper."""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from ..const import CONF_DAY_SPEAKER
from ..volume import get_volume
from ..notify import send_notification, get_default_message
from .player import get_media_url, get_logo_url, play_media_with_volume

_LOGGER = logging.getLogger(__name__)

DEFAULT_SPEAKERS: list[str] = ["media_player.adhan_speakers"]
SUHOOR_WINDOW_SECONDS = 30
SUHOOR_RESTORE_DELAY = 30.0
SKIP_BOOLEAN_ENTITY = "input_boolean.nida_skip_suhoor"


def _is_ramadan(coordinator) -> bool:
    """Of het op dit moment Ramadan is volgens de coordinator data.

    Gebruikt month.number (int 9) i.p.v. substring-match op month.en
    omdat Aladhan ooit kan veranderen van 'Ramadan' naar 'Ramaḍān' o.i.d.
    """
    try:
        month_num = int(
            coordinator.data["data"]["date"]["hijri"]["month"]["number"]
        )
        return month_num == 9
    except Exception:  # noqa: BLE001
        return False


def _is_skip_active(hass: HomeAssistant) -> bool:
    """Of de skip-helper aanstaat voor vannacht."""
    state = hass.states.get(SKIP_BOOLEAN_ENTITY)
    return state is not None and state.state == "on"


async def check_reset_skip_suhoor(
    hass: HomeAssistant,
    coordinator,
    now_ts: float,
) -> None:
    """Reset de skip-helper na Fajr zodat hij volgende nacht weer actief is."""
    try:
        timings = coordinator.data["data"]["timings"]
        today = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(
            f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
        ).timestamp()
        if abs(now_ts - fajr_ts) >= SUHOOR_WINDOW_SECONDS:
            return
        if not _is_skip_active(hass):
            return
        await hass.services.async_call(
            "input_boolean", "turn_off",
            {"entity_id": SKIP_BOOLEAN_ENTITY},
            blocking=True,
        )
        _LOGGER.info("%s gereset na Fajr", SKIP_BOOLEAN_ENTITY)
    except Exception as e:  # noqa: BLE001
        _LOGGER.debug("Reset skip suhoor mislukt: %s", e)


async def check_suhoor(
    hass: HomeAssistant,
    entry: ConfigEntry,
    coordinator,
    now_ts: float,
) -> None:
    """Speel suhoor alarm X minuten vóór Fajr tijdens Ramadan.

    Note: het config_flow schrijft 'suhoor_alarm_*' keys (suhoor_alarm_enabled,
    suhoor_alarm_minutes, suhoor_alarm_sound, suhoor_alarm_volume). Deze
    functie leest die keys met een fallback naar de oude 'suhoor_*' keys
    voor backward-compatibiliteit met installaties die nog niet door de
    options-flow zijn gegaan na de v1.1.x rename.
    """
    options = entry.options if entry.options else entry.data

    enabled = options.get("suhoor_alarm_enabled", options.get("suhoor_enabled", True))
    if not enabled:
        return

    if _is_skip_active(hass):
        _LOGGER.info("Suhoor overgeslagen — %s is aan", SKIP_BOOLEAN_ENTITY)
        return

    if not _is_ramadan(coordinator):
        return

    try:
        timings = coordinator.data["data"]["timings"]
        today = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(
            f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
        ).timestamp()

        minutes = int(
            options.get("suhoor_alarm_minutes", options.get("suhoor_minutes", 30))
        )
        suhoor_ts = fajr_ts - (minutes * 60)

        _LOGGER.debug(
            "Suhoor timing: %d min voor Fajr (%s) → alarm om %s",
            minutes, timings["Fajr"],
            datetime.fromtimestamp(suhoor_ts).strftime("%H:%M:%S"),
        )

        if abs(now_ts - suhoor_ts) >= SUHOOR_WINDOW_SECONDS:
            return

        sound = options.get("suhoor_alarm_sound", options.get("suhoor_sound", ""))
        speaker = options.get(
            "suhoor_speaker",
            options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS),
        )
        if isinstance(speaker, str):
            speaker = [speaker]
        # get_volume kan maar één key tegelijk lezen; probeer eerst de nieuwe key,
        # val terug op de legacy key alleen als de nieuwe ontbreekt.
        if "suhoor_alarm_volume" in options:
            volume = get_volume(options, "suhoor_alarm_volume", 10, hass=hass)
        else:
            volume = get_volume(options, "suhoor_volume", 10, hass=hass)

        _LOGGER.info("Suhoor alarm: %d min voor Fajr", minutes)

        if sound:
            media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")
            await play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=get_logo_url(hass),
                restore_delay=SUHOOR_RESTORE_DELAY,
            )

        # Activeer scene als ingesteld
        scene = options.get("suhoor_scene", "")
        if scene:
            try:
                await hass.services.async_call(
                    "scene", "turn_on",
                    {"entity_id": scene},
                    blocking=False,
                )
                _LOGGER.info("Suhoor scene geactiveerd: %s", scene)
            except Exception as se:  # noqa: BLE001
                _LOGGER.warning("Suhoor scene activatie mislukt: %s", se)

        notify_lang = options.get("notify_lang", "nl")
        fallback_msg = options.get(
            "notify_msg_suhoor",
            get_default_message("suhoor", lang=notify_lang),
        )
        await send_notification(
            hass, entry,
            message=fallback_msg,
            notify_type="suhoor",
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.error("Suhoor error: %s", e)

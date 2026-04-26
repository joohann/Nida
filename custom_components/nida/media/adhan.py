"""Nida adhan flow — speelt adhan voor een bepaald gebed."""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from ..const import (
    CONF_FAJR_SPEAKER, CONF_FAJR_VOLUME, CONF_FAJR_SOUND,
    CONF_DAY_SPEAKER, CONF_DAY_VOLUME, CONF_DAY_SOUND,
    CONF_PLAY_METHOD,
)
from ..volume import get_volume
from ..notify import send_notification, get_default_message
from .audio import async_get_sound_duration
from .player import get_media_url, get_logo_url, play_media_with_volume

_LOGGER = logging.getLogger(__name__)

DEFAULT_SPEAKERS: list[str] = ["media_player.adhan_speakers"]
ADHAN_RESTORE_BUFFER = 5.0       # seconden buffer na adhan voor volume restore
FALLBACK_RESTORE_DELAY = 300.0   # 5 min fallback als duur niet leesbaar is


def _resolve_play_settings(options, prayer_type: str, hass) -> tuple[list[str], float, str]:
    """Bepaal speakers, volume en sound voor een gebed.

    Returns:
        (speakers, volume, sound_filename)
    """
    if prayer_type == "fajr":
        speaker = options.get(CONF_FAJR_SPEAKER, DEFAULT_SPEAKERS)
        volume = get_volume(options, CONF_FAJR_VOLUME, 20, hass=hass)
        sound = options.get(CONF_FAJR_SOUND, "")
    elif prayer_type == "jumat":
        speaker = options.get(
            "jumat_speaker",
            options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS),
        )
        volume = get_volume(
            options, "jumat_volume",
            options.get(CONF_DAY_VOLUME, 50),
            hass=hass,
        )
        sound = options.get("jumat_sound", options.get(CONF_DAY_SOUND, ""))
    else:
        speaker = options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS)
        volume = get_volume(options, CONF_DAY_VOLUME, 50, hass=hass)
        sound = options.get(CONF_DAY_SOUND, "")

    if isinstance(speaker, str):
        speaker = [speaker]

    return speaker, volume, sound


async def play_adhan(
    hass: HomeAssistant,
    entry: ConfigEntry,
    prayer_type: str,
) -> None:
    """Speel adhan voor het opgegeven gebed.

    Args:
        prayer_type: 'fajr' | 'jumat' | 'dhuhr' | 'asr' | 'maghrib' | 'isha'
    """
    options = entry.options if entry.options else entry.data
    speakers, volume, sound = _resolve_play_settings(options, prayer_type, hass)

    if not sound:
        _LOGGER.warning(
            "Geen sound geconfigureerd voor %s — adhan overgeslagen", prayer_type
        )
        return

    # Bepaal werkelijke MP3-duur voor correcte restore_delay
    duration = await async_get_sound_duration(hass, sound)
    if duration > 0:
        restore_delay = duration + ADHAN_RESTORE_BUFFER
        _LOGGER.info(
            "Adhan duur: %.1fs → volume restore na %.1fs", duration, restore_delay
        )
    else:
        restore_delay = float(options.get("adhan_restore_delay", FALLBACK_RESTORE_DELAY))
        _LOGGER.warning(
            "Kon duur niet lezen van '%s' — gebruik fallback restore_delay: %.0fs",
            sound, restore_delay,
        )

    play_method = options.get(CONF_PLAY_METHOD, "media_player")
    media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")
    cover_url = get_logo_url(hass)

    _LOGGER.info(
        "Adhan %s: %s op %s (volume %.0f%%, restore na %.0fs)",
        prayer_type, sound, speakers, volume * 100, restore_delay,
    )

    if play_method == "chime_tts":
        await hass.services.async_call(
            "chime_tts", "say",
            {
                "entity_id": speakers,
                "chime_path": media_url,
                "volume_level": volume,
                "announce": True,
            },
        )
    else:
        await play_media_with_volume(
            hass, speakers, media_url, volume,
            cover_url=cover_url,
            restore_delay=restore_delay,
        )

    # Push notification
    lang = options.get("notify_lang", "nl")
    prayer_display = prayer_type.capitalize()
    fallback_message = get_default_message(
        "prayer", lang=lang, prayer=prayer_display
    )
    await send_notification(
        hass, entry,
        message=fallback_message,
        notify_type="prayer",
    )

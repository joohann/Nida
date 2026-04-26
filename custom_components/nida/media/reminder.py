"""Nida pre-adhan reminders — chime + optionele TTS, X minuten voor het gebed.

BUG FIX in deze module:
  Het oude `await asyncio.sleep(3)` na het afspelen van de chime werd vervangen
  door een dynamische wachttijd op basis van de werkelijke MP3-duur, zodat de
  TTS niet meer afgesneden wordt door langere jingles.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from ..const import (
    CONF_DAY_SPEAKER, CONF_DAY_VOLUME,
    CONF_TARHIM_ENABLED, CONF_TARHIM_SOUND,
    REMINDER_DEFAULT_TEXTS,
)
from ..volume import get_volume
from ..notify import send_notification, get_default_message
from .audio import async_get_sound_duration
from .player import get_media_url, get_logo_url, play_media_with_volume

_LOGGER = logging.getLogger(__name__)

DEFAULT_SPEAKERS: list[str] = ["media_player.adhan_speakers"]
REMINDER_WINDOW_SECONDS = 30        # tolerantie rond reminder-tijdstip
TTS_BUFFER_SECONDS = 1.0            # extra wachttijd na chime voor speaker-stabiliteit
DEFAULT_REMINDER_RESTORE_DELAY = 10.0

# TTS taalmap — uitgebreidbaar zonder bestaande gedrag te breken
LANG_MAP = {
    "nl": "nl-NL",
    "en": "en-US",
    "ar": "ar-SA",
    "tr": "tr-TR",
    "de": "de-DE",
    "fr": "fr-FR",
    "id": "id-ID",
    "ms": "ms-MY",
    "ur": "ur-PK",
    "fa": "fa-IR",
}
DEFAULT_TTS_ENTITY = "tts.home_assistant_cloud"


async def _should_skip_for_tarhim(
    hass: HomeAssistant,
    options,
    coordinator,
    prayer_name: str,
    prayer_ts: float,
    reminder_ts: float,
) -> bool:
    """Bepaal of een Fajr-reminder moet worden overgeslagen omdat tarhim
    binnenkort gaat afspelen.

    Tijdens Ramadan vervangt de tarhim de pre-adhan reminder voor Fajr.
    """
    if prayer_name.lower() not in ("fajr", "jumat"):
        return False
    if not options.get(CONF_TARHIM_ENABLED, True):
        return False
    try:
        hijri_month = coordinator.data["data"]["date"]["hijri"]["month"]["en"]
        if "Rama" not in hijri_month:
            return False

        tarhim_sound = options.get(CONF_TARHIM_SOUND, "")
        if not tarhim_sound:
            return False

        duration = await async_get_sound_duration(hass, tarhim_sound)
        tarhim_start_ts = prayer_ts - duration - 5
        if reminder_ts >= tarhim_start_ts - 30:
            _LOGGER.info("Reminder voor Fajr overgeslagen — tarhim window actief")
            return True
    except Exception as e:  # noqa: BLE001
        _LOGGER.debug("Tarhim window check mislukt: %s", e)
    return False


async def _play_reminder_chime(
    hass: HomeAssistant,
    speaker: list[str],
    sound: str,
    volume: float,
) -> float:
    """Speel reminder-chime af en geef terug hoe lang erop te wachten.

    Returns:
        Aantal seconden om te wachten voor de chime klaar is. Met deze waarde
        kan de caller de TTS NA de chime starten i.p.v. eroverheen.
    """
    duration = await async_get_sound_duration(hass, sound)
    media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")
    try:
        await play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=get_logo_url(hass),
            restore_delay=max(duration + 5.0, DEFAULT_REMINDER_RESTORE_DELAY),
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Could not play reminder chime: %s", e)
        return 0.0

    # ✅ BUG FIX: Wacht werkelijke duur i.p.v. hardcoded 3 seconden
    if duration > 0:
        wait = duration + TTS_BUFFER_SECONDS
        _LOGGER.debug(
            "Reminder chime '%s' duurt %.1fs — wacht %.1fs voor TTS",
            sound, duration, wait,
        )
        return wait
    # Onbekende duur → behoud oud gedrag (3s) als veilige fallback
    _LOGGER.warning(
        "Kon duur van '%s' niet lezen — fallback naar 3s wachttijd voor TTS", sound
    )
    return 3.0


async def _play_reminder_tts(
    hass: HomeAssistant,
    speaker: list[str],
    text: str,
    lang: str,
) -> None:
    """Speel TTS-reminder af via tts.speak service."""
    tts_lang = LANG_MAP.get(lang, lang)
    tts_options: dict = {}
    if tts_lang == "ar-SA":
        tts_options["voice"] = "HamedNeural"

    try:
        await hass.services.async_call(
            "tts", "speak",
            {
                "entity_id": DEFAULT_TTS_ENTITY,
                "media_player_entity_id": speaker,
                "message": text,
                "language": tts_lang,
                "options": tts_options,
            },
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Could not play TTS reminder: %s", e)


async def check_reminders(
    hass: HomeAssistant,
    entry: ConfigEntry,
    coordinator,
    now_ts: float,
    prayers: dict,
) -> None:
    """Controleer of er een reminder afgespeeld moet worden, en doe dat.

    Wordt elke minuut aangeroepen door de scheduler.
    """
    options = entry.options if entry.options else entry.data

    for r_num in (1, 2):
        if not options.get(f"reminder_{r_num}_enabled", False):
            continue

        # Alleen 'minutes' is nodig om het reminder-tijdstip te bepalen —
        # andere velden (sound, tts, speaker, volume) worden pas opgehaald
        # binnen de window-check, om onnodige werk + log-spam te voorkomen.
        minutes = options.get(
            f"reminder_{r_num}_minutes", 10 if r_num == 1 else 5
        )

        for prayer_name, time_str in prayers.items():
            today = datetime.now().strftime("%Y-%m-%d")
            try:
                prayer_ts = datetime.strptime(
                    f"{today} {time_str}", "%Y-%m-%d %H:%M"
                ).timestamp()
            except Exception:  # noqa: BLE001
                continue

            reminder_ts = prayer_ts - (minutes * 60)
            if abs(now_ts - reminder_ts) >= REMINDER_WINDOW_SECONDS:
                continue

            if await _should_skip_for_tarhim(
                hass, options, coordinator, prayer_name, prayer_ts, reminder_ts
            ):
                continue

            _LOGGER.info("Reminder %d for %s in %d min", r_num, prayer_name, minutes)

            # We zitten in het reminder-window — nú pas alle config lezen
            sound = options.get(f"reminder_{r_num}_sound", "")
            tts_text = options.get(f"reminder_{r_num}_tts", "")
            lang = options.get(f"reminder_{r_num}_lang", "nl")
            speaker = options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS)
            if isinstance(speaker, str):
                speaker = [speaker]
            volume = get_volume(options, CONF_DAY_VOLUME, 50, hass=hass)

            # 1. Chime
            chime_wait = 0.0
            if sound:
                chime_wait = await _play_reminder_chime(hass, speaker, sound, volume)

            # 2. TTS — wacht eerst tot chime klaar is
            if tts_text or chime_wait == 0.0 and tts_text:
                if chime_wait > 0:
                    await asyncio.sleep(chime_wait)
                text = tts_text or REMINDER_DEFAULT_TEXTS.get(
                    lang, REMINDER_DEFAULT_TEXTS["en"]
                )
                text = (
                    text
                    .replace("[minutes]", str(int(minutes)))
                    .replace("[prayer]", prayer_name)
                )
                await _play_reminder_tts(hass, speaker, text, lang)

            # 3. Push notification
            notify_lang = options.get("notify_lang", "nl")
            fallback_msg = get_default_message(
                "pre_adhan",
                lang=notify_lang,
                prayer=prayer_name,
                minutes=int(minutes),
            )
            await send_notification(
                hass, entry,
                message=fallback_msg,
                notify_type="pre_adhan",
            )

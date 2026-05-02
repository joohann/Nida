"""Nida pre-adhan reminders — chime + optionele TTS, X minuten voor het gebed.

VOLUME FIX in deze module (v1.1.5):
  Chime en TTS draaien nu binnen één snapshot/set/restore-cyclus, zodat
  ze gegarandeerd op hetzelfde volume klinken. De oude implementatie
  gebruikte twee losse cycli waarbij de restore-task van de chime
  midden in de TTS vuurde — hoorbaar als een volume-sprong.

EERDERE FIX:
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
from .player import get_media_url, get_logo_url

_LOGGER = logging.getLogger(__name__)

DEFAULT_SPEAKERS: list[str] = ["media_player.adhan_speakers"]
REMINDER_WINDOW_SECONDS = 30        # tolerantie rond reminder-tijdstip
TTS_BUFFER_SECONDS = 1.0            # extra wachttijd na chime voor speaker-stabiliteit
RESTORE_TAIL_SECONDS = 1.5          # extra marge na laatste audio voor restore

# Heuristiek voor TTS-duur. Cloud TTS-services geven geen length terug, dus
# schatten we op basis van karakter-lengte. ~10 karakters per seconde sluit
# aan op de werkelijke spraaksnelheid van Nabu Casa Cloud TTS in NL/EN/AR.
# Voor langere teksten wordt de schatting nauwkeuriger; voor korte teksten
# zorgt de minimum-grens van 3s ervoor dat we niet te vroeg restoren.
TTS_CHARS_PER_SECOND = 10.0
TTS_MIN_SECONDS = 3.0
TTS_BUFFER_AFTER = 2.0

CHIME_DURATION_FALLBACK = 3.0       # fallback als MP3-duur niet leesbaar is

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


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _estimate_tts_duration(text: str) -> float:
    """Schat hoe lang TTS-afspelen ongeveer duurt op basis van tekstlengte."""
    if not text:
        return 0.0
    seconds = len(text) / TTS_CHARS_PER_SECOND
    return max(TTS_MIN_SECONDS, seconds) + TTS_BUFFER_AFTER


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


# ─────────────────────────────────────────────────────────────────────────────
# Volume-aware combined chime + TTS playback
# ─────────────────────────────────────────────────────────────────────────────


async def _snapshot_volumes(
    hass: HomeAssistant,
    speakers: list[str],
) -> dict[str, float | None]:
    """Lees huidige volume_level van alle speakers (None = onbekend)."""
    volumes: dict[str, float | None] = {}
    for speaker in speakers:
        state = hass.states.get(speaker)
        if state:
            vol = state.attributes.get("volume_level")
            volumes[speaker] = float(vol) if vol is not None else None
        else:
            volumes[speaker] = None
    return volumes


async def _set_volume(
    hass: HomeAssistant,
    speakers: list[str],
    volume: float,
) -> None:
    """Zet doel-volume voor alle speakers."""
    try:
        await hass.services.async_call(
            "media_player",
            "volume_set",
            {"entity_id": speakers, "volume_level": volume},
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Volume set mislukt: %s", e)


async def _restore_volumes(
    hass: HomeAssistant,
    original_volumes: dict[str, float | None],
) -> None:
    """Zet originele volumes terug, één per speaker."""
    for speaker, orig_vol in original_volumes.items():
        if orig_vol is None:
            continue
        try:
            await hass.services.async_call(
                "media_player",
                "volume_set",
                {"entity_id": speaker, "volume_level": orig_vol},
            )
        except Exception as e:  # noqa: BLE001
            _LOGGER.debug("Volume restore mislukt voor %s: %s", speaker, e)


async def _play_chime(
    hass: HomeAssistant,
    speakers: list[str],
    sound: str,
) -> float:
    """Speel chime en geef terug hoeveel seconden te wachten tot hij klaar is.

    Zet géén volume — dat heeft de caller al gedaan en blijft staan voor
    de TTS die er direct na komt.
    """
    duration = await async_get_sound_duration(hass, sound)
    media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")

    extra: dict = {}
    cover_url = get_logo_url(hass)
    if cover_url:
        extra["thumbnail"] = cover_url
        extra["media_image_url"] = cover_url

    try:
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": speakers,
                "media_content_id": media_url,
                "media_content_type": "music",
                **({"extra": extra} if extra else {}),
            },
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Could not play reminder chime: %s", e)
        return 0.0

    if duration > 0:
        wait = duration + TTS_BUFFER_SECONDS
        _LOGGER.debug(
            "Reminder chime '%s' duurt %.1fs — wacht %.1fs voor TTS",
            sound, duration, wait,
        )
        return wait

    _LOGGER.warning(
        "Kon duur van '%s' niet lezen — fallback naar %.0fs wachttijd voor TTS",
        sound, CHIME_DURATION_FALLBACK,
    )
    return CHIME_DURATION_FALLBACK


async def _play_tts(
    hass: HomeAssistant,
    speakers: list[str],
    text: str,
    lang: str,
) -> None:
    """Speel TTS af via tts.speak service.

    Zet géén volume — die staat al op het reminder-volume vanuit de caller
    en blijft staan tot _restore_volumes() na alle audio uitgevoerd is.
    """
    tts_lang = LANG_MAP.get(lang, lang)
    tts_options: dict = {}
    if tts_lang == "ar-SA":
        tts_options["voice"] = "HamedNeural"

    try:
        await hass.services.async_call(
            "tts", "speak",
            {
                "entity_id": DEFAULT_TTS_ENTITY,
                "media_player_entity_id": speakers,
                "message": text,
                "language": tts_lang,
                "options": tts_options,
            },
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Could not play TTS reminder: %s", e)


async def _play_chime_and_tts(
    hass: HomeAssistant,
    speakers: list[str],
    sound: str,
    tts_text: str,
    tts_lang: str,
    volume: float,
) -> None:
    """Speel chime en TTS opeenvolgend af, beide op hetzelfde volume.

    Eén snapshot/set/restore-cyclus om beide audio-bronnen heen, zodat
    de TTS niet meer naar een ander volume springt halverwege.
    """
    original_volumes = await _snapshot_volumes(hass, speakers)
    await _set_volume(hass, speakers, volume)
    # Korte pauze zodat de speaker-firmware tijd heeft om het nieuwe
    # volume toe te passen voordat de eerste audio binnenkomt.
    await asyncio.sleep(0.5)

    chime_wait = 0.0
    if sound:
        chime_wait = await _play_chime(hass, speakers, sound)
        if chime_wait > 0:
            await asyncio.sleep(chime_wait)

    tts_wait = 0.0
    if tts_text:
        await _play_tts(hass, speakers, tts_text, tts_lang)
        tts_wait = _estimate_tts_duration(tts_text)
        _LOGGER.debug(
            "TTS '%s...' (%d chars) — geschatte duur %.1fs",
            tts_text[:30], len(tts_text), tts_wait,
        )

    # Restore async — niet wachten op return — zodat de scheduler
    # niet geblokkeerd wordt voor de duur van de TTS.
    async def _delayed_restore() -> None:
        await asyncio.sleep(tts_wait + RESTORE_TAIL_SECONDS)
        await _restore_volumes(hass, original_volumes)

    hass.async_create_task(_delayed_restore())


# ─────────────────────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────────────────────


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
            tts_text_template = options.get(f"reminder_{r_num}_tts", "")
            lang = options.get(f"reminder_{r_num}_lang", "nl")
            speaker = options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS)
            if isinstance(speaker, str):
                speaker = [speaker]
            volume = get_volume(options, CONF_DAY_VOLUME, 50, hass=hass)

            # TTS-tekst expanderen (alleen als TTS gewenst is)
            tts_text = ""
            if tts_text_template:
                tts_text = (
                    tts_text_template
                    .replace("[minutes]", str(int(minutes)))
                    .replace("[prayer]", prayer_name)
                )
            elif not sound:
                # Geen sound én geen TTS-template → val terug op default
                # reminder-tekst, anders zou er helemaal geen audio zijn.
                default = REMINDER_DEFAULT_TEXTS.get(
                    lang, REMINDER_DEFAULT_TEXTS["en"]
                )
                tts_text = (
                    default
                    .replace("[minutes]", str(int(minutes)))
                    .replace("[prayer]", prayer_name)
                )
            # else: alleen sound, geen TTS — chime-only (oude gedrag)

            # Eén gecombineerde call voor chime + TTS op consistent volume
            if sound or tts_text:
                await _play_chime_and_tts(
                    hass, speaker, sound, tts_text, lang, volume,
                )

            # Push notification (volume-onafhankelijk)
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

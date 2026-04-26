"""Nida services — handlers voor preview/test acties via UI of automations.

Alle services zijn idempotent en doen niets meer dan een handler-aanroep
voor de overeenkomstige media-flow.
"""
from __future__ import annotations

import asyncio
import logging

import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, ServiceCall

from .const import (
    DOMAIN,
    CONF_DAY_SPEAKER, CONF_DAY_VOLUME,
    CONF_PLAY_METHOD,
    CONF_TARHIM_SPEAKER, CONF_TARHIM_VOLUME, CONF_TARHIM_SOUND,
)
from .volume import get_volume
from .notify import send_notification, get_default_message
from .media.adhan import play_adhan
from .media.player import (
    get_media_url, get_logo_url, play_media_with_volume,
)

_LOGGER = logging.getLogger(__name__)

# Service constants
SERVICE_PREVIEW_ADHAN = "preview_adhan"
SERVICE_TEST_PRAYER = "test_prayer"
SERVICE_TEST_TARHIM = "test_tarhim"
SERVICE_TEST_REMINDER = "test_reminder"
SERVICE_TEST_NOTIFICATION = "test_notification"
SERVICE_TEST_SUHOOR = "test_suhoor"

# Defaults
DEFAULT_SPEAKERS: list[str] = ["media_player.adhan_speakers"]
DEFAULT_PREVIEW_RESTORE = 30.0
DEFAULT_TARHIM_RESTORE = 60.0
DEFAULT_REMINDER_RESTORE = 10.0
DEFAULT_SUHOOR_RESTORE = 30.0

# TTS voor reminder-test
LANG_MAP = {
    "nl": "nl-NL", "en": "en-US", "ar": "ar-SA", "tr": "tr-TR",
    "de": "de-DE", "fr": "fr-FR", "id": "id-ID",
}
DEFAULT_TTS_ENTITY = "tts.home_assistant_cloud"


def _normalize_volume(raw, fallback: float = 0.5) -> float:
    """Convert int/float (0-100 of 0-1) naar 0.0-1.0 float."""
    try:
        val = float(raw)
    except (TypeError, ValueError):
        return fallback
    if val > 1:
        val = val / 100
    return max(0.0, min(1.0, val))


def _ensure_list(value) -> list:
    """Zorg dat speaker altijd een list is."""
    if value is None:
        return list(DEFAULT_SPEAKERS)
    if isinstance(value, str):
        return [value]
    return list(value)


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------
async def _handle_preview(hass: HomeAssistant, entry: ConfigEntry, call: ServiceCall) -> None:
    """Preview een adhan-geluid."""
    sound = call.data.get("sound")
    if not sound:
        _LOGGER.warning("preview_adhan: 'sound' is verplicht")
        return

    options = entry.options if entry.options else entry.data
    speakers = _ensure_list(
        call.data.get("speaker", options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS))
    )
    volume = _normalize_volume(
        call.data.get("volume", options.get(CONF_DAY_VOLUME, 30))
    )
    play_method = options.get(CONF_PLAY_METHOD, "media_player")
    media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")

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
            cover_url=get_logo_url(hass),
            restore_delay=DEFAULT_PREVIEW_RESTORE,
        )


async def _handle_test_prayer(hass: HomeAssistant, entry: ConfigEntry, call: ServiceCall) -> None:
    """Test adhan-flow voor een specifiek gebed."""
    prayer = call.data.get("prayer", "dhuhr")
    await play_adhan(hass, entry, prayer)


async def _handle_test_tarhim(hass: HomeAssistant, entry: ConfigEntry, call: ServiceCall) -> None:
    """Test tarhim recitatie."""
    options = entry.options if entry.options else entry.data
    speakers = _ensure_list(
        call.data.get("speaker", options.get(CONF_TARHIM_SPEAKER, DEFAULT_SPEAKERS))
    )
    volume = _normalize_volume(
        call.data.get("volume", options.get(CONF_TARHIM_VOLUME, 15))
    )
    sound = call.data.get("sound", options.get(CONF_TARHIM_SOUND, ""))
    if not sound:
        _LOGGER.warning("test_tarhim: geen tarhim sound geconfigureerd")
        return

    media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")
    await play_media_with_volume(
        hass, speakers, media_url, volume,
        cover_url=get_logo_url(hass),
        restore_delay=DEFAULT_TARHIM_RESTORE,
    )


async def _handle_test_reminder(hass: HomeAssistant, entry: ConfigEntry, call: ServiceCall) -> None:
    """Test reminder (geluid + TTS) voor een gebed."""
    options = entry.options if entry.options else entry.data
    r_raw = call.data.get("reminder", "reminder_1")

    # Backwards-compat: accepteer "reminder_1" / "reminder_2" én legacy ints
    if isinstance(r_raw, str) and r_raw.startswith("reminder_"):
        r_num = int(r_raw.split("_")[1])
    else:
        try:
            r_num = int(r_raw)
        except (ValueError, TypeError):
            r_num = 1

    minutes = options.get(f"reminder_{r_num}_minutes", 10)
    prayer = call.data.get("prayer", "Dhuhr")
    sound = options.get(f"reminder_{r_num}_sound", "")
    lang = options.get(f"reminder_{r_num}_lang", "nl")
    text_template = options.get(
        f"reminder_{r_num}_tts",
        "Over [minutes] minuten is het tijd voor [prayer]",
    )
    text = (
        text_template
        .replace("[minutes]", str(int(minutes)))
        .replace("[prayer]", prayer)
    )

    speakers = _ensure_list(options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS))
    volume = get_volume(options, CONF_DAY_VOLUME, 50, hass=hass)

    # 1. Chime
    chime_wait = 0.0
    if sound:
        from .media.audio import async_get_sound_duration
        duration = await async_get_sound_duration(hass, sound)
        media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")
        await play_media_with_volume(
            hass, speakers, media_url, volume,
            cover_url=get_logo_url(hass),
            restore_delay=max(duration + 5.0, DEFAULT_REMINDER_RESTORE),
        )
        chime_wait = duration + 1.0 if duration > 0 else 3.0

    # 2. TTS — wacht op chime
    if text:
        if chime_wait > 0:
            await asyncio.sleep(chime_wait)
        tts_lang = LANG_MAP.get(lang, lang)
        await hass.services.async_call(
            "tts", "speak",
            {
                "entity_id": DEFAULT_TTS_ENTITY,
                "media_player_entity_id": speakers,
                "message": text,
                "language": tts_lang,
                "options": {"voice": "HamedNeural"} if tts_lang == "ar-SA" else {},
            },
        )


async def _handle_test_notification(hass: HomeAssistant, entry: ConfigEntry, call: ServiceCall) -> None:
    """Test push notificatie."""
    options = entry.options if entry.options else entry.data
    title = call.data.get("title", options.get("notify_title", "🕌 Nida"))
    message = call.data.get(
        "message", options.get("notify_message", "Test notificatie van Nida"),
    )
    await send_notification(hass, entry, message, title)


async def _handle_test_suhoor(hass: HomeAssistant, entry: ConfigEntry, call: ServiceCall) -> None:
    """Test suhoor alarm."""
    options = entry.options if entry.options else entry.data
    speakers = _ensure_list(
        call.data.get(
            "speaker",
            options.get("suhoor_speaker", options.get(CONF_DAY_SPEAKER, DEFAULT_SPEAKERS)),
        )
    )
    volume = _normalize_volume(
        call.data.get("volume", options.get("suhoor_volume", 50))
    )
    sound = call.data.get("sound", options.get("suhoor_sound", ""))
    if not sound:
        _LOGGER.warning("test_suhoor: geen suhoor sound geconfigureerd")
        return

    media_url = await get_media_url(hass, f"/local/nida/sounds/{sound}")
    await play_media_with_volume(
        hass, speakers, media_url, volume,
        cover_url=get_logo_url(hass),
        restore_delay=DEFAULT_SUHOOR_RESTORE,
    )

    notify_lang = options.get("notify_lang", "nl")
    fallback_msg = options.get(
        "notify_msg_suhoor",
        get_default_message("suhoor", lang=notify_lang),
    )
    await send_notification(
        hass, entry, message=fallback_msg, notify_type="suhoor",
    )


# ---------------------------------------------------------------------------
# Schemas — gebruik strings voor select-values (HA-compatibel)
# ---------------------------------------------------------------------------
PRAYER_VALUES = ["fajr", "dhuhr", "asr", "maghrib", "isha", "jumat"]
REMINDER_VALUES = ["reminder_1", "reminder_2"]

SCHEMA_PREVIEW = vol.Schema(
    {
        vol.Required("sound"): str,
        vol.Optional("speaker"): vol.Any(str, [str]),
        vol.Optional("volume"): vol.Any(None, vol.Coerce(float)),
    }
)

SCHEMA_TEST_PRAYER = vol.Schema(
    {
        vol.Optional("prayer", default="dhuhr"): vol.In(PRAYER_VALUES),
    }
)

SCHEMA_TEST_TARHIM = vol.Schema(
    {
        vol.Optional("sound"): str,
        vol.Optional("speaker"): vol.Any(str, [str]),
        vol.Optional("volume"): vol.Any(None, vol.Coerce(float)),
    }
)

SCHEMA_TEST_SUHOOR = vol.Schema(
    {
        vol.Optional("sound"): str,
        vol.Optional("speaker"): vol.Any(str, [str]),
        vol.Optional("volume"): vol.Any(None, vol.Coerce(float)),
    }
)

# ✅ FIX: reminder is nu string ("reminder_1"/"reminder_2") i.p.v. int
SCHEMA_TEST_REMINDER = vol.Schema(
    {
        vol.Optional("reminder", default="reminder_1"): vol.In(REMINDER_VALUES),
        vol.Optional("prayer", default="Dhuhr"): str,
    }
)

SCHEMA_TEST_NOTIFICATION = vol.Schema(
    {
        vol.Optional("title"): str,
        vol.Optional("message"): str,
    }
)


# ---------------------------------------------------------------------------
# Public registration API
# ---------------------------------------------------------------------------
async def async_setup_services(
    hass: HomeAssistant,
    entry: ConfigEntry,
) -> None:
    """Registreer alle Nida services."""
    # Bind entry in een wrapper, zodat de handlers altijd de juiste entry zien
    async def _preview(call):
        await _handle_preview(hass, entry, call)

    async def _test_prayer(call):
        await _handle_test_prayer(hass, entry, call)

    async def _test_tarhim(call):
        await _handle_test_tarhim(hass, entry, call)

    async def _test_reminder(call):
        await _handle_test_reminder(hass, entry, call)

    async def _test_notification(call):
        await _handle_test_notification(hass, entry, call)

    async def _test_suhoor(call):
        await _handle_test_suhoor(hass, entry, call)

    hass.services.async_register(DOMAIN, SERVICE_PREVIEW_ADHAN, _preview, schema=SCHEMA_PREVIEW)
    hass.services.async_register(DOMAIN, SERVICE_TEST_PRAYER, _test_prayer, schema=SCHEMA_TEST_PRAYER)
    hass.services.async_register(DOMAIN, SERVICE_TEST_TARHIM, _test_tarhim, schema=SCHEMA_TEST_TARHIM)
    hass.services.async_register(DOMAIN, SERVICE_TEST_REMINDER, _test_reminder, schema=SCHEMA_TEST_REMINDER)
    hass.services.async_register(DOMAIN, SERVICE_TEST_NOTIFICATION, _test_notification, schema=SCHEMA_TEST_NOTIFICATION)
    hass.services.async_register(DOMAIN, SERVICE_TEST_SUHOOR, _test_suhoor, schema=SCHEMA_TEST_SUHOOR)

"""Constants for Nida integration."""

DOMAIN = "nida"

CONF_CITY = "city"
CONF_COUNTRY = "country"
CONF_METHOD = "method"

# Adhan settings
CONF_PLAY_METHOD = "play_method"
CONF_FAJR_SPEAKER = "fajr_speaker"
CONF_FAJR_VOLUME = "fajr_volume"
CONF_FAJR_SOUND = "fajr_sound"
CONF_DAY_SPEAKER = "day_speaker"
CONF_DAY_VOLUME = "day_volume"
CONF_DAY_SOUND = "day_sound"

PLAY_METHODS = {
    "media_player": "media_player.play_media",
    "chime_tts": "chime_tts.say",
}

FAJR_SOUNDS = {
    "01-01-adhan-fajr.mp3": "Adhan Fajr 1",
    "02-01-adhan-fajr.mp3": "Adhan Fajr 2",
    "03-01-adhan-fajr.mp3": "Adhan Fajr 3",
}

DAY_SOUNDS = {
    "01-02-adhan-day.mp3": "Adhan Day 1",
    "02-02-adhan-day.mp3": "Adhan Day 2",
    "03-02-adhan-day.mp3": "Adhan Day 3",
}

CALCULATION_METHODS = {
    0: "Shia Ithna-Ashari",
    1: "University of Islamic Sciences, Karachi",
    2: "Islamic Society of North America (ISNA)",
    3: "Muslim World League",
    4: "Umm Al-Qura University, Makkah",
    5: "Egyptian General Authority of Survey",
    7: "Institute of Geophysics, University of Tehran",
    8: "Gulf Region",
    9: "Kuwait",
    10: "Qatar",
    11: "Majlis Ugama Islam Singapura",
    12: "Union Organization Islamic de France",
    13: "Diyanet İşleri Başkanlığı, Turkey",
    14: "Spiritual Administration of Muslims of Russia",
    15: "Moonsighting Committee Worldwide",
}

# Tarhim settings
CONF_TARHIM_ENABLED = "tarhim_enabled"
CONF_TARHIM_SPEAKER = "tarhim_speaker"
CONF_TARHIM_VOLUME = "tarhim_volume"
CONF_TARHIM_SOUND = "tarhim_sound"
CONF_TARHIM_OFFSET = "tarhim_offset"

TARHIM_SOUNDS = {
    "tarhim.mp3": "Tarhim 1",
}

# Pad naar de sounds map (www/sounds/ in de repo = /config/www/sounds/ op HA)
_SOUNDS_DIR = "/config/www/nida/sounds"


def _format_sound_label(filename: str) -> str:
    """Convert filename to readable label.
    01-adhan.mp3      -> Adhan 01
    01-adhan-fajr.mp3 -> Adhan Fajr 01
    01-jingle.mp3     -> Jingle 01
    01-tarhim.mp3     -> Tarhim 01
    """
    import re
    name = filename.replace('.mp3', '')
    parts = re.split(r'[-_]', name)
    numbers = [p for p in parts if p.isdigit()]
    words = [p.capitalize() for p in parts if not p.isdigit()]
    num = numbers[-1] if numbers else ""
    if words and num:
        return f"{' '.join(words)} {num}"
    return name.replace('-', ' ').replace('_', ' ').title()



# Pre-adhan reminders
CONF_REMINDER_1_ENABLED = "reminder_1_enabled"
CONF_REMINDER_1_MINUTES = "reminder_1_minutes"
CONF_REMINDER_1_SOUND = "reminder_1_sound"
CONF_REMINDER_1_TTS = "reminder_1_tts"
CONF_REMINDER_1_LANG = "reminder_1_lang"

CONF_REMINDER_2_ENABLED = "reminder_2_enabled"
CONF_REMINDER_2_MINUTES = "reminder_2_minutes"
CONF_REMINDER_2_SOUND = "reminder_2_sound"
CONF_REMINDER_2_TTS = "reminder_2_tts"
CONF_REMINDER_2_LANG = "reminder_2_lang"

REMINDER_LANGUAGES = {
    "nl": "Nederlands",
    "en": "English",
    "ar": "العربية",
    "tr": "Türkçe",
    "de": "Deutsch",
    "fr": "Français",
    "ms": "Bahasa Melayu",
    "id": "Bahasa Indonesia",
    "ur": "اردو",
    "fa": "فارسی",
}

REMINDER_DEFAULT_TEXTS = {
    "nl": "Over [minutes] minuten is het tijd voor [prayer]",
    "en": "In [minutes] minutes it is time for [prayer]",
    "ar": "بعد [minutes] دقيقة حان وقت صلاة [prayer]",
    "tr": "[prayer] namazına [minutes] dakika kaldı",
    "de": "In [minutes] Minuten ist es Zeit für [prayer]",
    "fr": "Dans [minutes] minutes, c'est l'heure de [prayer]",
    "ms": "[prayer] akan tiba dalam [minutes] minit",
    "id": "[prayer] akan tiba dalam [minutes] menit",
    "ur": "[minutes] منٹ میں [prayer] کا وقت ہوگا",
    "fa": "تا [minutes] دقیقه دیگر وقت نماز [prayer] است",
}

# Cache sounds bij import (eenmalig, buiten async context)
import os as _os
_SOUNDS_CACHE: dict | None = None

def _load_sounds_cache() -> dict:
    """Laad alle sounds eenmalig in cache."""
    global _SOUNDS_CACHE
    if _SOUNDS_CACHE is not None:
        return _SOUNDS_CACHE
    result = {"fajr": {}, "day": {}, "tarhim": {}, "jingle": {}, "suhoor": {}}
    try:
        files = sorted(_os.listdir(_SOUNDS_DIR))
        for f in files:
            if not f.endswith(".mp3"):
                continue
            label = _format_sound_label(f)
            fl = f.lower()
            if "fajr" in fl:
                result["fajr"][f] = label
            elif "tarhim" in fl:
                result["tarhim"][f] = label
            elif "jingle" in fl:
                result["jingle"][f] = label
            elif "suhoor" in fl:
                result["suhoor"][f] = label
            elif "adhan" in fl:
                result["day"][f] = label
    except Exception:
        pass
    _SOUNDS_CACHE = result
    return result

async def async_load_sounds_cache(hass) -> dict:
    """Laad sounds cache via executor (async-safe)."""
    import asyncio
    loop = asyncio.get_event_loop()
    return await hass.async_add_executor_job(_load_sounds_cache)


def get_fajr_sounds() -> dict:
    c = _load_sounds_cache()
    return c["fajr"] if c["fajr"] else {"01-adhan-fajr.mp3": "Adhan Fajr 01"}

def get_day_sounds() -> dict:
    c = _load_sounds_cache()
    return c["day"] if c["day"] else {"01-adhan.mp3": "Adhan 01"}

def get_tarhim_sounds() -> dict:
    c = _load_sounds_cache()
    return c["tarhim"] if c["tarhim"] else {"01-tarhim.mp3": "Tarhim 01"}

def get_jingle_sounds() -> dict:
    c = _load_sounds_cache()
    return c["jingle"]

def get_suhoor_sounds() -> dict:
    c = _load_sounds_cache()
    return c["suhoor"] if c["suhoor"] else {"01-suhoor.mp3": "Suhoor 01"}

# Load cache at import time (outside async loop)
try:
    _load_sounds_cache()
except Exception:
    pass

"""Constants for Nida Prayer Times integration."""

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

# Salawat settings
CONF_SALAWAT_ENABLED = "salawat_enabled"
CONF_SALAWAT_SPEAKER = "salawat_speaker"
CONF_SALAWAT_VOLUME  = "salawat_volume"
CONF_SALAWAT_SOUND   = "salawat_sound"
CONF_SALAWAT_OFFSET  = "salawat_offset"

# Sounds directory op HA systeem
_SOUNDS_DIR = "/config/www/nida/sounds"


def _format_sound_label(filename: str) -> str:
    """
    Converteer bestandsnaam naar leesbaar label.

    Nieuw formaat: "Adhan [day] - Ahmed Saeed Al-Omrany.mp3" → "Ahmed Saeed Al-Omrany"
    Oud formaat:   "01-adhan-fajr.mp3"                       → "Adhan Fajr 01"
    """
    import re
    name = filename.replace(".mp3", "")
    m = re.match(r'^.+?\[.+?\]\s*-\s*(.+)$', name)
    if m:
        return m.group(1).strip()
    parts = re.split(r'[-_]', name)
    numbers = [p for p in parts if p.isdigit()]
    words   = [p.capitalize() for p in parts if not p.isdigit()]
    num = numbers[-1] if numbers else ""
    if words and num:
        return f"{' '.join(words)} {num}"
    return name.replace('-', ' ').replace('_', ' ').title()


# ── Synchrone versie (alleen gebruiken in executor / buiten event loop) ────────

def _scan_sounds(keyword_include: list, keyword_exclude: list = None) -> dict:
    """
    Scan sounds map voor mp3s op basis van [categorie] in bestandsnaam.
    SYNC — uitsluitend aanroepen via hass.async_add_executor_job() of in _do_* blokken.
    """
    import os
    result = {}
    keyword_exclude = keyword_exclude or []
    try:
        for f in sorted(os.listdir(_SOUNDS_DIR)):
            if not f.endswith(".mp3"):
                continue
            fl = f.lower()
            included = any(f"[{kw.lower()}]" in fl or kw.lower() in fl
                           for kw in keyword_include)
            if not included:
                continue
            excluded = any(f"[{kw.lower()}]" in fl or kw.lower() in fl
                           for kw in keyword_exclude)
            if excluded:
                continue
            result[f] = _format_sound_label(f)
    except Exception:
        pass
    return result


def get_fajr_sounds() -> dict:
    result = _scan_sounds(["fajr"])
    return result if result else {"Adhan [fajr] - Default.mp3": "Default"}


def get_day_sounds() -> dict:
    result = _scan_sounds(
        keyword_include=["day"],
        keyword_exclude=["fajr", "salawat", "jingle", "suhoor", "ramadan", "nida"],
    )
    return result if result else {"Adhan [day] - Default.mp3": "Default"}


def get_salawat_sounds() -> dict:
    result = _scan_sounds(["salawat"])
    return result if result else {"Ramadan [salawat] - Default.mp3": "Default"}


def get_suhoor_sounds() -> dict:
    # Geen fallback naar fictief bestand — lege dict als er geen suhoor sounds zijn
    return _scan_sounds(["suhoor"])


def get_jingle_sounds() -> dict:
    result = _scan_sounds(["jingle"],
                          keyword_exclude=["adhan", "fajr", "salawat", "suhoor"])
    return result


# ── Async versies (gebruik deze vanuit config flow / event loop) ───────────────

async def async_get_fajr_sounds(hass) -> dict:
    """Async-safe versie van get_fajr_sounds — gebruik in config flow steps."""
    result = await hass.async_add_executor_job(get_fajr_sounds)
    return result


async def async_get_day_sounds(hass) -> dict:
    """Async-safe versie van get_day_sounds — gebruik in config flow steps."""
    result = await hass.async_add_executor_job(get_day_sounds)
    return result


async def async_get_salawat_sounds(hass) -> dict:
    """Async-safe versie van get_salawat_sounds — gebruik in config flow steps."""
    result = await hass.async_add_executor_job(get_salawat_sounds)
    return result


async def async_get_suhoor_sounds(hass) -> dict:
    """Async-safe versie van get_suhoor_sounds — gebruik in config flow steps."""
    result = await hass.async_add_executor_job(get_suhoor_sounds)
    return result


async def async_get_jingle_sounds(hass) -> dict:
    """Async-safe versie van get_jingle_sounds — gebruik in config flow steps."""
    result = await hass.async_add_executor_job(get_jingle_sounds)
    return result


# ── Pre-adhan reminders ────────────────────────────────────────────────────────

CONF_REMINDER_1_ENABLED = "reminder_1_enabled"
CONF_REMINDER_1_MINUTES = "reminder_1_minutes"
CONF_REMINDER_1_SOUND   = "reminder_1_sound"
CONF_REMINDER_1_TTS     = "reminder_1_tts"
CONF_REMINDER_1_LANG    = "reminder_1_lang"

CONF_REMINDER_2_ENABLED = "reminder_2_enabled"
CONF_REMINDER_2_MINUTES = "reminder_2_minutes"
CONF_REMINDER_2_SOUND   = "reminder_2_sound"
CONF_REMINDER_2_TTS     = "reminder_2_tts"
CONF_REMINDER_2_LANG    = "reminder_2_lang"

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

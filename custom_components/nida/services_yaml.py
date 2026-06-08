"""Nida services.yaml generator — bouwt dynamisch op basis van beschikbare sounds.

Wordt bij iedere setup aangeroepen om de selector-options up-to-date te houden
met wat er feitelijk in /config/www/nida/sounds/ staat.

✅ UI FIX: alle 'value' velden in select-options zijn nu strings (HA-vereiste),
en alle services hebben hun volledige fields-structuur — voorheen had test_reminder
int values (1, 2) wat de hele services.yaml unparseable maakte. Daardoor toonde de
UI lege formulieren voor alle Nida services.
"""
from __future__ import annotations

import logging
import os
import re

import yaml

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


def _label_for(filename: str) -> str:
    """Maak een leesbaar label van een Nida MP3-filename.

    New format: 'adhan_fajr_ahmed_saeed_al-omrany.mp3' → 'Ahmed Saeed Al-Omrany'
    Legacy format: 'Adhan [day] - Ahmed Saeed Al-Omrany.mp3' → 'Ahmed Saeed Al-Omrany'
    Voor onbekende formaten: filename zonder extensie en underscores/streepjes.
    """
    name = filename.replace(".mp3", "")
    # New underscore format: adhan_fajr_<author> or nadir_jingle_<author>
    m = re.match(r"^(?:adhan_(?:fajr|day)|ramadan_tarhim|ramadan_suhoor|nadir_jingle|nida_jingle)_(.+)$", name, re.IGNORECASE)
    if m:
        author = m.group(1).replace("_", " ").replace("-", " ")
        return author.title()
    # Legacy bracket format: 'Adhan [day] - Author'
    m = re.match(r"^.+?\[.+?\]\s*-\s*(.+)$", name)
    if m:
        return m.group(1).strip()
    return name.replace("_", " ").replace("-", " ").title()


def _categorize_sound(filename: str) -> str | None:
    """Bepaal in welke categorie een sound thuishoort.

    Supports new underscore format (adhan_fajr_*, adhan_day_*, ramadan_tarhim_*,
    nadir_jingle_*, nida_jingle_*, ramadan_suhoor_*) and legacy bracket format.

    Returns: 'fajr' | 'day' | 'tarhim' | 'suhoor' | 'jingle' | None
    """
    fl = filename.lower()
    # New underscore format (checked first)
    if fl.startswith("adhan_fajr_"):
        return "fajr"
    if fl.startswith("adhan_day_"):
        return "day"
    if fl.startswith("ramadan_tarhim_"):
        return "tarhim"
    if fl.startswith("ramadan_suhoor_"):
        return "suhoor"
    if fl.startswith("nadir_jingle_") or fl.startswith("nida_jingle_"):
        return "jingle"
    # Legacy bracket format
    if "[fajr]" in fl:
        return "fajr"
    if "[tarhim]" in fl or "tarhim" in fl:
        return "tarhim"
    if "[suhoor]" in fl or "suhoor" in fl:
        return "suhoor"
    if "[jingle]" in fl or "jingle" in fl:
        return "jingle"
    if "[day]" in fl or "adhan" in fl:
        return "day"
    return None


def _build_options(sounds_path: str) -> dict[str, list[dict]]:
    """Lees alle sounds en groepeer naar categorie."""
    buckets: dict[str, list[dict]] = {
        "fajr": [], "day": [], "tarhim": [], "suhoor": [], "jingle": [],
    }
    if not os.path.isdir(sounds_path):
        return buckets

    for filename in sorted(os.listdir(sounds_path)):
        if not filename.endswith(".mp3"):
            continue
        category = _categorize_sound(filename)
        if category is None:
            continue
        # ✅ value MOET een string zijn — anders breekt de YAML parser in HA
        buckets[category].append(
            {"label": _label_for(filename), "value": str(filename)}
        )
    return buckets


def _build_services_yaml(sounds_path: str) -> dict:
    """Bouw de complete services.yaml structuur.

    Strikte regels (HA selector-validatie):
      - Alle 'value' velden zijn strings
      - Alle 'default' velden zijn strings (matchen één van de option values)
      - Alle services hebben een 'fields' dict, ook al is hij leeg
    """
    sounds = _build_options(sounds_path)

    # Gedeelde veld-templates
    volume_field = {
        "name": "Volume",
        "description": "Volume (0-100%). Leeg laten voor geconfigureerd volume.",
        "required": False,
        "default": 30,
        "selector": {
            "number": {
                "min": 0, "max": 100, "step": 5,
                "unit_of_measurement": "%", "mode": "slider",
            },
        },
    }
    speaker_field = {
        "name": "Speaker",
        "description": "Welke speaker wil je gebruiken?",
        "required": False,
        "selector": {"entity": {"domain": "media_player"}},
    }

    # Combineer alle adhan + jingle sounds voor preview
    preview_sounds = (
        sounds["fajr"] + sounds["day"] + sounds["tarhim"] + sounds["jingle"]
    )

    return {
        "preview_adhan": {
            "name": "Preview Adhan",
            "description": "Speel een adhan of jingle als preview op een speaker.",
            "fields": {
                "sound": {
                    "name": "Sound",
                    "description": "Welk geluid wil je afspelen?",
                    "required": True,
                    "selector": {"select": {"options": preview_sounds}},
                },
                "speaker": {**speaker_field, "required": True},
                "volume": volume_field,
            },
        },
        "test_prayer": {
            "name": "Test Prayer",
            "description": "Test de adhan voor een specifiek gebed.",
            "fields": {
                "prayer": {
                    "name": "Prayer",
                    "description": "Welk gebed wil je testen?",
                    "required": True,
                    "default": "dhuhr",
                    "selector": {
                        "select": {
                            "options": [
                                {"label": "Fajr",            "value": "fajr"},
                                {"label": "Dhuhr",           "value": "dhuhr"},
                                {"label": "Asr",             "value": "asr"},
                                {"label": "Maghrib",         "value": "maghrib"},
                                {"label": "Isha",            "value": "isha"},
                                {"label": "Jumat (vrijdag)", "value": "jumat"},
                            ],
                        },
                    },
                },
            },
        },
        "test_tarhim": {
            "name": "Test Tarhim",
            "description": "Test de Tarhim recitatie voor Fajr.",
            "fields": {
                "sound": {
                    "name": "Sound",
                    "description": "Welk tarhim wil je afspelen?",
                    "required": False,
                    "selector": {"select": {"options": sounds["tarhim"]}},
                },
                "speaker": speaker_field,
                "volume": volume_field,
            },
        },
        "test_suhoor": {
            "name": "Test Suhoor",
            "description": "Test het suhoor alarm.",
            "fields": {
                "sound": {
                    "name": "Sound",
                    "description": "Welk suhoor geluid wil je afspelen?",
                    "required": False,
                    "selector": {"select": {"options": sounds["suhoor"]}},
                },
                "speaker": speaker_field,
                "volume": volume_field,
            },
        },
        "test_reminder": {
            "name": "Test Reminder",
            "description": "Test een pre-adhan reminder (geluid + TTS).",
            "fields": {
                # ✅ FIX: values zijn nu strings i.p.v. ints
                "reminder": {
                    "name": "Reminder",
                    "description": "Welke reminder wil je testen?",
                    "required": False,
                    "default": "reminder_1",
                    "selector": {
                        "select": {
                            "options": [
                                {"label": "Reminder 1", "value": "reminder_1"},
                                {"label": "Reminder 2", "value": "reminder_2"},
                            ],
                        },
                    },
                },
                "prayer": {
                    "name": "Gebed",
                    "description": "Naam van het gebed (voor in de TTS tekst).",
                    "required": False,
                    "default": "Dhuhr",
                    "selector": {"text": {}},
                },
            },
        },
        "test_notification": {
            "name": "Test Notificatie",
            "description": "Stuur een test notificatie naar geconfigureerde apparaten.",
            "fields": {
                "title": {
                    "name": "Titel",
                    "description": "Titel van de notificatie (optioneel).",
                    "required": False,
                    "selector": {"text": {}},
                },
                "message": {
                    "name": "Bericht",
                    "description": "Tekst van de notificatie (optioneel).",
                    "required": False,
                    "selector": {"text": {}},
                },
            },
        },
    }


async def async_update_services_yaml(hass: HomeAssistant) -> None:
    """Schrijf services.yaml met up-to-date sound-opties."""

    def _do_write() -> None:
        sounds_path = hass.config.path("www/nida/sounds")
        services = _build_services_yaml(sounds_path)
        # services.yaml staat naast deze module in de integration directory
        services_path = os.path.join(os.path.dirname(__file__), "services.yaml")
        with open(services_path, "w") as f:
            yaml.dump(services, f, allow_unicode=True, default_flow_style=False)

    await hass.async_add_executor_job(_do_write)
    _LOGGER.info("services.yaml bijgewerkt met beschikbare geluiden")

"""Nida Integration — Islamic prayer times + adhan + reminders for Home Assistant.

This file is the integration entry point. It contains lifecycle handlers only:
all functionality lives in dedicated modules:

  - config.py / config_flow.py     → user configuration
  - const.py                       → constants
  - coordinator.py                 → fetches prayer timings (Aladhan API)
  - scheduler.py                   → triggers media flows on prayer times
  - volume.py                      → night + open windows volume override
  - helpers.py                     → sound copy + helper-entity bootstrapping
  - media/audio.py                 → MP3 duration parser
  - media/player.py                → snapshot/restore + play_media wrapper
  - media/adhan.py                 → adhan flow per prayer
  - media/reminder.py              → pre-adhan reminders (chime + TTS)
  - media/tarhim.py                → Ramadan tarhim before Fajr
  - media/suhoor.py                → suhoor alarm + skip helper
  - notify/push.py + messages.py   → push notifications + translations
  - services.py                    → user-facing services (test/preview)
  - services_yaml.py               → dynamic services.yaml generator
  - sensor.py                      → sensor entities (separate platform)
  - binary_sensor.py               → binary sensor platform entry
  - switch.py                      → switch platform entry (intend-to-fast)
  - fasting.py                     → pure fasting-day logic (no HA imports)
  - fasting_binary_sensors.py      → fasting binary sensor classes
"""
from __future__ import annotations

import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

import homeassistant.helpers.config_validation as cv
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er

from .const import DOMAIN
from .helpers import async_copy_sounds, async_ensure_helpers
from .coordinator import PrayerTimesCoordinator
from .scheduler import async_setup_adhan_scheduler
from .services import async_setup_services
from .services_yaml import async_update_services_yaml

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
_LOGGER = logging.getLogger(__name__)
# binary_sensor → fasting recommended/forbidden/currently
# switch        → user intent toggle ("I intend to fast today")
PLATFORMS = ["sensor", "binary_sensor", "switch"]


# ─────────────────────────────────────────────────────────────────────────────
# Entity migration
# ─────────────────────────────────────────────────────────────────────────────
# Mapping van unique_id-suffix → gewenste schone entity_id (object_id).
# Wordt gebruikt door _async_migrate_entity_ids() om entities zoals
# ``sensor.nida_readable_02_fajr_readable`` te hernoemen naar
# ``sensor.02_fajr_readable``.
_ENTITY_ID_MAP: dict[str, str] = {
    # Prayer time TIMESTAMP sensors (PrayerTimeSensor)
    "imsak":    "sensor.01_imsak",
    "fajr":     "sensor.02_fajr",
    "sunrise":  "sensor.03_sunrise",
    "dhuhr":    "sensor.04_dhuhr",
    "asr":      "sensor.05_asr",
    "sunset":   "sensor.06_sunset",
    "maghrib":  "sensor.07_maghrib",
    "isha":     "sensor.08_isha",
    "midnight": "sensor.09_midnight",
    # Prayer time READABLE sensors (PrayerTimeReadableSensor)
    "imsak_readable":    "sensor.01_imsak_readable",
    "fajr_readable":     "sensor.02_fajr_readable",
    "sunrise_readable":  "sensor.03_sunrise_readable",
    "dhuhr_readable":    "sensor.04_dhuhr_readable",
    "asr_readable":      "sensor.05_asr_readable",
    "sunset_readable":   "sensor.06_sunset_readable",
    "maghrib_readable":  "sensor.07_maghrib_readable",
    "isha_readable":     "sensor.08_isha_readable",
    "midnight_readable": "sensor.09_midnight_readable",
    # Hijri sensors (HijriSensor)
    "hijri_date":    "sensor.hijri_date",
    "hijri_day":     "sensor.hijri_day",
    "hijri_month":   "sensor.hijri_month",
    "hijri_year":    "sensor.hijri_year",
    "hijri_holiday": "sensor.hijri_holiday",
    # Special sensors
    "next_prayer":  "sensor.next_prayer",
    "is_ramadan":   "sensor.is_ramadan",
    "is_holiday":   "sensor.islamic_holiday_today",
}


async def _async_cleanup_legacy_orphans(hass: HomeAssistant) -> int:
    """Verwijder oude REST/template orphans die het migratiepad blokkeren.

    Voorbeeld: een oude ``sensor.fajr`` (state ``unavailable``) van een
    voormalige REST-config in configuration.yaml. Alleen entries die NIET
    bij de Nida-integratie horen worden verwijderd.
    """
    registry = er.async_get(hass)
    removed = 0

    # Alle entity_ids die we voor Nida willen bezitten
    desired_ids = set(_ENTITY_ID_MAP.values())

    # Daarnaast bekende REST-stijl orphans zonder order-prefix die we ook
    # graag opruimen, bijv. sensor.fajr / sensor.fajr_readable.
    legacy_bare_names = [
        "imsak", "fajr", "sunrise", "dhuhr", "asr",
        "sunset", "maghrib", "isha", "midnight",
    ]
    for base in legacy_bare_names:
        desired_ids.add(f"sensor.{base}")
        desired_ids.add(f"sensor.{base}_readable")

    for entity_id in list(desired_ids):
        entry = registry.async_get(entity_id)
        if entry is None:
            continue
        # Alleen verwijderen als het GEEN Nida-entity is (om onze eigen
        # entities niet weg te gooien).
        if entry.platform == DOMAIN:
            continue
        registry.async_remove(entity_id)
        _LOGGER.info(
            "Nida cleanup: verwijderde wees-entity %s (was platform=%s)",
            entity_id, entry.platform,
        )
        removed += 1

    return removed


async def _async_migrate_entity_ids(hass: HomeAssistant, entry: ConfigEntry) -> int:
    """Hernoem bestaande Nida entities naar schone entity_ids zonder
    devicenaam-prefix.

    Bijvoorbeeld ``sensor.nida_readable_02_fajr_readable`` → ``sensor.02_fajr_readable``.

    Idempotent: entities die al de juiste id hebben worden overgeslagen.
    """
    registry = er.async_get(hass)
    migrated = 0

    for unique_id_suffix, desired_entity_id in _ENTITY_ID_MAP.items():
        full_unique_id = f"{entry.entry_id}_{unique_id_suffix}"
        current_entity_id = registry.async_get_entity_id(
            "sensor", DOMAIN, full_unique_id
        )

        if current_entity_id is None:
            # Nog niet geregistreerd — wordt vanzelf goed bij eerste setup
            # dankzij _attr_suggested_object_id in sensor.py.
            continue

        if current_entity_id == desired_entity_id:
            continue

        # Check of de gewenste entity_id al bezet is door iets anders.
        # Mocht dat zo zijn (en het is niet ons): skip met waarschuwing.
        existing = registry.async_get(desired_entity_id)
        if existing is not None and existing.unique_id != full_unique_id:
            _LOGGER.warning(
                "Nida migratie: kan %s niet hernoemen naar %s — id is bezet "
                "door %s (platform=%s). Verwijder deze handmatig en herlaad.",
                current_entity_id, desired_entity_id,
                existing.entity_id, existing.platform,
            )
            continue

        registry.async_update_entity(
            current_entity_id, new_entity_id=desired_entity_id
        )
        _LOGGER.info(
            "Nida migratie: %s → %s", current_entity_id, desired_entity_id,
        )
        migrated += 1

    return migrated


async def _async_cleanup_legacy_devices(hass: HomeAssistant, entry: ConfigEntry) -> int:
    """Verwijder de oude opgesplitste devices (Nida / Nida Readable / Hijri
    Calendar) zodat er één device 'Nida' overblijft.

    De oude devices waren geïdentificeerd met suffixes ``_prayer``, ``_readable``,
    ``_hijri``. Het nieuwe device gebruikt direct ``entry.entry_id``.

    Verwijderen kan veilig: HA hangt de entities automatisch onder het nieuwe
    device wanneer de sensor-platform deze setup-call afmaakt en de entities
    re-registreert via ``device_info``.
    """
    device_reg = dr.async_get(hass)
    legacy_suffixes = ("_prayer", "_readable", "_hijri")
    removed = 0

    for suffix in legacy_suffixes:
        legacy_id = f"{entry.entry_id}{suffix}"
        device = device_reg.async_get_device(identifiers={(DOMAIN, legacy_id)})
        if device is None:
            continue
        device_reg.async_remove_device(device.id)
        _LOGGER.info(
            "Nida device-cleanup: verwijderde legacy device %s (id=%s)",
            device.name, legacy_id,
        )
        removed += 1

    return removed


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Initialize Nida from a config entry."""
    # Eerst opruimen + migreren, vóór de entiteiten via async_forward_entry_setups
    # geregistreerd worden. Zo voorkomen we dat HA dezelfde entities opnieuw
    # met devicenaam-prefix aanmaakt.
    removed = await _async_cleanup_legacy_orphans(hass)
    migrated = await _async_migrate_entity_ids(hass, entry)
    devices_removed = await _async_cleanup_legacy_devices(hass, entry)
    if removed or migrated or devices_removed:
        _LOGGER.info(
            "Nida startup-cleanup: %d orphan(s) verwijderd, %d entity_id(s) gemigreerd, %d legacy device(s) verwijderd",
            removed, migrated, devices_removed,
        )

    coordinator = PrayerTimesCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    # One-time setup (idempotent — safe to call on every reload)
    await async_copy_sounds(hass, os.path.dirname(__file__))
    await async_ensure_helpers(hass)

    # Wire up scheduler + services
    await async_setup_adhan_scheduler(hass, entry, coordinator)
    await async_update_services_yaml(hass)
    await async_setup_services(hass, entry)

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload integration when options change."""
    await hass.config_entries.async_reload(entry.entry_id)

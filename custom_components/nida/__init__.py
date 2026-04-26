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
"""
from __future__ import annotations

import logging
import os

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

import homeassistant.helpers.config_validation as cv

from .const import DOMAIN
from .helpers import async_copy_sounds, async_ensure_helpers
from .coordinator import PrayerTimesCoordinator
from .scheduler import async_setup_adhan_scheduler
from .services import async_setup_services
from .services_yaml import async_update_services_yaml

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Initialize Nida from a config entry."""
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

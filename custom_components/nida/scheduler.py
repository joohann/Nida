"""Nida scheduler — triggert media flows op de juiste tijdstippen.

Wordt elke minuut (op second=0) aangeroepen door async_track_time_change.
Vanuit hier worden alle media-flows gestart.
"""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change

from .media.adhan import play_adhan
from .media.reminder import check_reminders
from .media.tarhim import check_tarhim
from .media.suhoor import check_suhoor, check_reset_skip_suhoor

_LOGGER = logging.getLogger(__name__)

# De gebeden waarop de scheduler triggert
PRAYER_KEYS = ("Fajr", "Dhuhr", "Asr", "Maghrib", "Isha")
FRIDAY_WEEKDAY = 4


def _build_prayers(timings: dict, is_friday: bool) -> dict[str, str]:
    """Bouw {prayer_name: time_str}, met Dhuhr → Jumat op vrijdag."""
    prayers = {key: timings[key] for key in PRAYER_KEYS if key in timings}
    if is_friday and "Dhuhr" in prayers:
        prayers["Jumat"] = prayers.pop("Dhuhr")
    return prayers


async def async_setup_adhan_scheduler(
    hass: HomeAssistant,
    entry: ConfigEntry,
    coordinator,
) -> None:
    """Plan adhan + alle gerelateerde flows op gebedstijden.

    De scheduler vuurt elke minuut. Per call worden alle relevante flows
    parallel als async_create_task gestart, zodat één traag flow nooit
    de andere blokkeert.
    """

    @callback
    def check_prayer_time(now):
        if not coordinator.data:
            return

        try:
            timings = coordinator.data["data"]["timings"]
        except (KeyError, TypeError):
            _LOGGER.debug("Coordinator data niet beschikbaar voor scheduler tick")
            return

        is_friday = now.weekday() == FRIDAY_WEEKDAY
        prayers = _build_prayers(timings, is_friday)

        current_time = now.strftime("%H:%M")
        now_ts = now.timestamp()

        # Adhan triggers
        for prayer, time_str in prayers.items():
            if current_time == time_str:
                prayer_key = "jumat" if prayer == "Jumat" else prayer.lower()
                _LOGGER.info("Playing adhan for %s", prayer)
                hass.async_create_task(play_adhan(hass, entry, prayer_key))

        # Pre-prayer flows
        hass.async_create_task(check_tarhim(hass, entry, coordinator, now_ts))
        hass.async_create_task(check_suhoor(hass, entry, coordinator, now_ts))
        hass.async_create_task(
            check_reminders(hass, entry, coordinator, now_ts, prayers)
        )

        # Maintenance
        hass.async_create_task(check_reset_skip_suhoor(hass, coordinator, now_ts))

    entry.async_on_unload(
        async_track_time_change(hass, check_prayer_time, second=0)
    )

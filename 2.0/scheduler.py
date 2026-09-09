"""Nida scheduler — fires the adhan service at each enabled prayer time.

Listens for coordinator updates (startup, 12-hour cycle, midnight refresh).
On each update it cancels any pending point-in-time triggers and re-plans
them from the fresh prayer timings + the user's per-prayer enabled toggles.

This module is intentionally minimal: it only decides WHEN to play, then
delegates to nida.play_adhan (see services.py) for the actual playback.
No volume control, no pre-adhan jingle, no TTS — those will return in
later steps (see __init__.py docstring for the herbouw status).

Changelog:
  2.0.1 (2026-06-28): New file — initial scheduler for automatic adhan
                      playback. Reads enabled_<prayer> toggles, skips
                      disabled prayers, skips prayers already passed today.
"""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util

from .const import DOMAIN, OPT_ENABLED_PREFIX, PRAYERS
from .coordinator import PrayerTimesCoordinator
from .services import SERVICE_PLAY_ADHAN

_LOGGER = logging.getLogger(__name__)


class NidaScheduler:
    """Re-plans adhan triggers whenever the coordinator data refreshes."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        coordinator: PrayerTimesCoordinator,
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.coordinator = coordinator
        self._unsub_triggers: list = []
        self._unsub_coordinator = None

    @callback
    def async_setup(self) -> None:
        """Hook into coordinator updates and plan the initial set of triggers."""
        self._unsub_coordinator = self.coordinator.async_add_listener(
            self._async_reschedule
        )
        self._async_reschedule()

    @callback
    def async_shutdown(self) -> None:
        """Cancel all triggers + the coordinator listener. Called on unload."""
        self._cancel_all_triggers()
        if self._unsub_coordinator is not None:
            self._unsub_coordinator()
            self._unsub_coordinator = None

    def _cancel_all_triggers(self) -> None:
        for unsub in self._unsub_triggers:
            unsub()
        self._unsub_triggers = []

    @callback
    def _async_reschedule(self) -> None:
        """Cancel existing triggers and plan fresh ones from the new timings."""
        self._cancel_all_triggers()

        data = self.coordinator.data or {}
        timings = data.get("data", {}).get("timings", {})
        if not timings:
            _LOGGER.debug("Scheduler: no timings yet, nothing to plan")
            return

        now = dt_util.now()
        options = self.entry.options

        planned = 0
        for prayer in PRAYERS:
            if not _is_enabled(options, prayer):
                _LOGGER.debug("Scheduler: %s is disabled, skipping", prayer)
                continue

            time_str = timings.get(prayer.capitalize())
            target = _parse_today_time(time_str, now)
            if target is None or target <= now:
                # Already passed today; tomorrow's run picks this up via
                # the midnight refresh in the coordinator.
                continue

            unsub = async_track_point_in_time(
                self.hass,
                self._async_make_handler(prayer),
                target,
            )
            self._unsub_triggers.append(unsub)
            planned += 1
            _LOGGER.info("Scheduled adhan for %s at %s", prayer, target)

        _LOGGER.debug("Scheduler: planned %d adhan trigger(s)", planned)

    def _async_make_handler(self, prayer: str):
        """Build a one-shot async callback that fires nida.play_adhan for one prayer."""

        async def _fire(_now) -> None:
            _LOGGER.info("Firing scheduled adhan for %s", prayer)
            try:
                await self.hass.services.async_call(
                    DOMAIN,
                    SERVICE_PLAY_ADHAN,
                    {"prayer": prayer},
                    blocking=False,
                )
            except Exception as err:  # noqa: BLE001 — log and survive
                _LOGGER.error("Failed to play adhan for %s: %s", prayer, err)

        return _fire


def _is_enabled(options: dict, prayer: str) -> bool:
    """Per-prayer toggle. Defaults to ON when the option is not present."""
    val = options.get(f"{OPT_ENABLED_PREFIX}{prayer}")
    return True if val is None else bool(val)


def _parse_today_time(time_str: str | None, ref: datetime) -> datetime | None:
    """Combine an Aladhan 'HH:MM' string with today's date in HA's timezone."""
    if not time_str:
        return None
    try:
        hh, mm = (int(x) for x in time_str.split(" ")[0].split(":"))
    except (ValueError, AttributeError):
        _LOGGER.debug("Unexpected time format from Aladhan: %s", time_str)
        return None
    return ref.replace(hour=hh, minute=mm, second=0, microsecond=0)

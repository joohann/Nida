"""Nida visitors mode — shared state logic for the select and switch entities.

Visitors mode (internally still the guest_mode_* option keys, 2.0.45+)
mutes scheduled adhan audio for a while. Until 2.5.4 it could only be
set from the panel's mute popup. This module gives Home Assistant a
single place that reads and writes that state, so the new
select.nida_visitors_mode (a list of durations, usable in a Bubble Card
"select" card) and switch.nida_visitors_mode (plain on/off) always agree
with each other and with the panel.

It also ends the mode on time. Expiry used to be lazy: services.py only
compared guest_mode_until with "now" when an adhan fired, so the panel
kept showing visitors mode as on after it had run out. A point-in-time
listener now switches it off at the until-moment, which lets the
entities fall back to "off" by themselves.

Changelog:
  2.5.4 (2026-11-21): New file — VisitorsMode state helper plus the
                      expiry timer used by select.py, switch.py and
                      __init__.py.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import CALLBACK_TYPE, HomeAssistant, callback
from homeassistant.helpers.event import async_track_point_in_utc_time
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_GUEST_MODE_HOURS,
    DOMAIN,
    OPT_GUEST_MODE_ENABLED,
    OPT_GUEST_MODE_HOURS,
    OPT_GUEST_MODE_UNTIL,
)

# Same durations as the panel's mute popup (nida-panel.js durationOptions).
VISITORS_DURATIONS: tuple[int, ...] = (1, 2, 3, 4, 6, 8, 12, 24)
# The panel's old slider sentinel for "no end time" (GUEST_HOURS_INF).
VISITORS_HOURS_UNTIL_OFF = 25

OPTION_OFF = "off"
OPTION_UNTIL_OFF = "until_off"
VISITORS_OPTIONS: list[str] = (
    [OPTION_OFF] + [f"{h}h" for h in VISITORS_DURATIONS] + [OPTION_UNTIL_OFF]
)


class VisitorsMode:
    """Read and change visitors mode for one config entry."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self._hass = hass
        self._entry = entry

    # ── reading ──
    @property
    def until(self) -> datetime | None:
        """End time in UTC, or None when there is no end time."""
        raw = self._entry.options.get(OPT_GUEST_MODE_UNTIL)
        if not raw:
            return None
        parsed = dt_util.parse_datetime(str(raw))
        return dt_util.as_utc(parsed) if parsed is not None else None

    @property
    def is_active(self) -> bool:
        """Mirrors services._guest_mode_active: enabled and not expired."""
        if not bool(self._entry.options.get(OPT_GUEST_MODE_ENABLED)):
            return False
        until = self.until
        return until is None or dt_util.utcnow() < until

    @property
    def hours(self) -> int:
        """Last chosen duration in hours (25 = no end time)."""
        try:
            value = int(self._entry.options.get(OPT_GUEST_MODE_HOURS))
        except (TypeError, ValueError):
            return DEFAULT_GUEST_MODE_HOURS
        if 1 <= value <= VISITORS_HOURS_UNTIL_OFF:
            return value
        return DEFAULT_GUEST_MODE_HOURS

    @property
    def current_option(self) -> str:
        """The select option that matches the current state."""
        if not self.is_active:
            return OPTION_OFF
        if self.until is None or self.hours >= VISITORS_HOURS_UNTIL_OFF:
            return OPTION_UNTIL_OFF
        # A duration set elsewhere (e.g. an old slider value) maps to the
        # nearest listed one, so the state is always a valid option.
        nearest = min(VISITORS_DURATIONS, key=lambda h: abs(h - self.hours))
        return f"{nearest}h"

    # ── writing ──
    def async_select(self, option: str) -> None:
        """Apply a select option."""
        if option == OPTION_OFF:
            self.async_turn_off()
        elif option == OPTION_UNTIL_OFF:
            self._write(True, VISITORS_HOURS_UNTIL_OFF, None)
        elif option in VISITORS_OPTIONS:
            self._start(int(option[:-1]))
        else:
            raise ValueError(f"Unknown visitors mode option: {option}")

    def async_turn_on(self) -> None:
        """Switch on with the last chosen duration."""
        hours = self.hours
        if hours >= VISITORS_HOURS_UNTIL_OFF:
            self._write(True, hours, None)
        else:
            self._start(hours)

    def async_turn_off(self) -> None:
        self._write(False, None, None, keep_hours=True)

    def _start(self, hours: int) -> None:
        until = dt_util.utcnow() + timedelta(hours=hours)
        self._write(True, hours, until)

    def _write(
        self,
        enabled: bool,
        hours: int | None,
        until: datetime | None,
        keep_hours: bool = False,
    ) -> None:
        options = {
            **self._entry.options,
            OPT_GUEST_MODE_ENABLED: enabled,
            OPT_GUEST_MODE_UNTIL: until.isoformat() if until else None,
        }
        if not keep_hours and hours is not None:
            options[OPT_GUEST_MODE_HOURS] = hours
        # Triggers the entry's update listener: the scheduler re-plans and
        # the expiry timer below is re-armed.
        self._hass.config_entries.async_update_entry(self._entry, options=options)


def _timer_key(entry: ConfigEntry) -> str:
    return f"_visitors_expiry_{entry.entry_id}"


@callback
def async_schedule_visitors_expiry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """(Re)arm the timer that switches visitors mode off at its end time.

    Called at setup and on every options change. Any previous timer is
    cancelled first, so a new duration replaces the old one.
    """
    data = hass.data.setdefault(DOMAIN, {})
    old: CALLBACK_TYPE | None = data.pop(_timer_key(entry), None)
    if old is not None:
        old()

    mode = VisitorsMode(hass, entry)
    if not bool(entry.options.get(OPT_GUEST_MODE_ENABLED)):
        return
    until = mode.until
    if until is None:
        return  # no end time: stays on until switched off
    if until <= dt_util.utcnow():
        mode.async_turn_off()  # already expired (e.g. during a restart)
        return

    @callback
    def _expire(_now: datetime) -> None:
        data.pop(_timer_key(entry), None)
        # Only switch off if nothing changed the end time in the meantime.
        if VisitorsMode(hass, entry).until == until:
            VisitorsMode(hass, entry).async_turn_off()

    data[_timer_key(entry)] = async_track_point_in_utc_time(hass, _expire, until)


@callback
def async_cancel_visitors_expiry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Cancel the expiry timer on unload."""
    unsub = (hass.data.get(DOMAIN) or {}).pop(_timer_key(entry), None)
    if unsub is not None:
        unsub()

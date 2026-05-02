"""
Fasting binary sensor entities for the Nida HACS integration.

Exposes three sensors:

  - binary_sensor.nida_fasting_recommended  -> sunnah/fard day?
  - binary_sensor.nida_fasting_forbidden    -> Eid / Tashreeq?
  - binary_sensor.nida_currently_fasting    -> intent ON + within fajr→maghrib

Reads the raw Aladhan API response from the coordinator, so the data
shape it depends on is:

    coordinator.data["data"]["timings"]["Fajr" | "Maghrib"]   # "HH:MM (TZ)"
    coordinator.data["data"]["date"]["hijri"]["day"]          # "14"   (str)
    coordinator.data["data"]["date"]["hijri"]["month"]["number"]  # 9  (int)
    coordinator.data["data"]["date"]["hijri"]["year"]         # "1447" (str)

If the coordinator is ever changed to flatten this structure, only
_BaseFastingSensor._hijri() and NidaCurrentlyFastingSensor._fasting_window()
need to be adjusted.

@version 1.1.0
"""

from __future__ import annotations

import logging
from datetime import date, datetime, time, timedelta

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import callback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, ATTR_USER_INTENDS_FAST
from .fasting import FastingStatus, get_fasting_status

_LOGGER = logging.getLogger(__name__)


def build_fasting_binary_sensors(coordinator, entry: ConfigEntry) -> list:
    """Factory used by binary_sensor.py's async_setup_entry."""
    return [
        NidaFastingRecommendedSensor(coordinator, entry),
        NidaFastingForbiddenSensor(coordinator, entry),
        NidaCurrentlyFastingSensor(coordinator, entry),
    ]


# ────────────────────────────────────────────────────────────────
# Base
# ────────────────────────────────────────────────────────────────

class _BaseFastingSensor(CoordinatorEntity, BinarySensorEntity):
    """Shared plumbing for all three fasting binary sensors."""

    _attr_has_entity_name = True

    def __init__(self, coordinator, entry: ConfigEntry, suffix: str) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{suffix}"

    def _status(self) -> FastingStatus:
        h = self._hijri()
        return get_fasting_status(
            gregorian=date.today(),
            hijri_day=h["day"],
            hijri_month=h["month"],
            hijri_year=h["year"],
        )

    def _hijri(self) -> dict:
        """Pull Hijri date from coordinator data, with safe defaults.

        Coordinator stores the raw Aladhan API response, so the path is
        ``data.date.hijri``. Aladhan returns day/year as strings and
        month as a nested object containing ``number``, ``en``, ``ar``.
        """
        root = self.coordinator.data or {}
        hijri = (
            (root.get("data") or {})
            .get("date", {})
            .get("hijri", {})
        )
        month = hijri.get("month") or {}
        return {
            "day": _safe_int(hijri.get("day")),
            "month": _safe_int(month.get("number") if isinstance(month, dict) else month),
            "year": _safe_int(hijri.get("year")),
        }


# ────────────────────────────────────────────────────────────────
# 1. Recommended
# ────────────────────────────────────────────────────────────────

class NidaFastingRecommendedSensor(_BaseFastingSensor):
    """ON whenever today is a recommended fast (sunnah, fard, etc.)."""

    _attr_name = "Fasting recommended"
    _attr_icon = "mdi:weather-sunset"

    def __init__(self, coordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry, "fasting_recommended")

    @property
    def is_on(self) -> bool:
        return self._status().recommended

    @property
    def extra_state_attributes(self) -> dict:
        return self._status().as_attributes()


# ────────────────────────────────────────────────────────────────
# 2. Forbidden
# ────────────────────────────────────────────────────────────────

class NidaFastingForbiddenSensor(_BaseFastingSensor):
    """ON whenever fasting is forbidden today (Eid days, Tashreeq)."""

    _attr_name = "Fasting forbidden"
    _attr_icon = "mdi:silverware-fork-knife"

    def __init__(self, coordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry, "fasting_forbidden")

    @property
    def is_on(self) -> bool:
        return self._status().forbidden

    @property
    def extra_state_attributes(self) -> dict:
        s = self._status()
        return {
            "forbidden_reason": s.forbidden_reason.value,
            "description": s.description,
        }


# ────────────────────────────────────────────────────────────────
# 3. Currently fasting (intent + time window)
# ────────────────────────────────────────────────────────────────

class NidaCurrentlyFastingSensor(_BaseFastingSensor):
    """ON when user intent is ON AND now is within [fajr, maghrib).

    Refreshes every minute so the state flips precisely at fajr/maghrib
    even if the coordinator is on a longer interval.
    """

    _attr_name = "Currently fasting"
    _attr_icon = "mdi:food-off-outline"

    def __init__(self, coordinator, entry: ConfigEntry) -> None:
        super().__init__(coordinator, entry, "currently_fasting")

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self.async_on_remove(
            async_track_time_interval(
                self.hass, self._handle_tick, timedelta(minutes=1)
            )
        )

    @callback
    def _handle_tick(self, _now) -> None:
        self.async_write_ha_state()

    @property
    def is_on(self) -> bool:
        if not self._user_intends():
            return False
        if self._status().forbidden:
            return False
        fajr, maghrib = self._fasting_window()
        if fajr is None or maghrib is None:
            return False
        return fajr <= dt_util.now() < maghrib

    @property
    def extra_state_attributes(self) -> dict:
        attrs = self._status().as_attributes()
        attrs["intends_to_fast"] = self._user_intends()

        fajr, maghrib = self._fasting_window()
        if not (fajr and maghrib):
            return attrs

        now = dt_util.now()
        attrs["started_at"] = fajr.isoformat()
        attrs["iftar_at"] = maghrib.isoformat()

        if now < fajr:
            attrs["state"] = "before_fajr"
            attrs["seconds_until_fajr"] = int((fajr - now).total_seconds())
        elif now < maghrib:
            attrs["state"] = "fasting"
            attrs["seconds_until_iftar"] = int((maghrib - now).total_seconds())
        else:
            attrs["state"] = "after_iftar"

        return attrs

    # ── helpers ──

    def _user_intends(self) -> bool:
        """Read the intent flag mirrored on the coordinator by the switch."""
        return bool(getattr(self.coordinator, ATTR_USER_INTENDS_FAST, False))

    def _fasting_window(self) -> tuple[datetime | None, datetime | None]:
        root = self.coordinator.data or {}
        timings = (root.get("data") or {}).get("timings") or {}
        return (
            _parse_today(timings.get("Fajr")),
            _parse_today(timings.get("Maghrib")),
        )


def _parse_today(hhmm: str | None) -> datetime | None:
    """Parse 'HH:MM' or 'HH:MM (CET)' into today's local datetime.

    Aladhan returns timings with a parenthesised timezone suffix.
    """
    if not hhmm:
        return None
    try:
        clean = hhmm.split(" ", 1)[0]
        h, m = clean.split(":")
        naive = datetime.combine(date.today(), time(int(h), int(m)))
        return naive.replace(tzinfo=dt_util.now().tzinfo)
    except (ValueError, AttributeError):
        return None


def _safe_int(value) -> int:
    """Coerce string/int to int. Returns 0 on failure.

    Aladhan returns Hijri day/year as strings ('14', '1447') so we can't
    rely on ``int(value or 0)`` directly — None and '' must both yield 0.
    """
    if value is None or value == "":
        return 0
    try:
        return int(value)
    except (ValueError, TypeError):
        return 0

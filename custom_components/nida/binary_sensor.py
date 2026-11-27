"""Nida binary_sensor platform — per-prayer "currently in window" status.

Publishes five binary_sensor.nida_<prayer>_active entities, one per
adhan-prayer. Each entity's is_on reflects whether the current local
time falls inside that prayer's window, defined as:

    [prayer_time_today, next_prayer_time)

For Isha the "next prayer" is the next day's Fajr, so its window
straddles midnight. The coordinator only holds today's timings, so
we approximate next-day Fajr as today's Fajr + 24 hours (typically
correct within a minute or so — fine for a binary sensor).

A 1-minute time-interval listener triggers async_write_ha_state on
each sensor so transitions land within a minute of the actual
prayer time.

Changelog:
  2.5.7 (2026-11-27): Windows come from prayer_times.coordinator_datetimes(),
                      so an Isha after midnight (high-latitude summer) starts
                      on the coming night and Maghrib runs until it, instead
                      of Isha being stitched onto the morning that passed.
                      The five sensors belong to the Nida device now. Entity
                      ids stay as they are; Home Assistant 2026.11 shows an
                      entity on a device as device name plus name, so they
                      read "Nida Fajr active", like the other Nida entities.
  2.0.23 (2026-06-28): Defensive rewrite — 2.0.21 broke integration
                       setup when binary_sensor was added to PLATFORMS.
                       Most likely cause was the CoordinatorEntity
                       subclass interacting badly with the rest of the
                       setup path (switch.py works fine WITHOUT it, so
                       we mirror that pattern). Changes:
                       (1) Dropped CoordinatorEntity base — entities
                       now read `hass.data[DOMAIN][entry_id].data`
                       on-demand inside is_on, identical to how
                       services.py reads options.
                       (2) async_setup_entry wraps entity construction
                       in a try/except so any future regression here
                       degrades gracefully (warning logged, other
                       platforms keep loading) instead of bombing the
                       whole entry.
                       (3) _async_tick now no-ops cleanly if the entity
                       isn't yet added to hass (the 60s job may fire
                       once during early teardown).
  2.0.21 (2026-06-28): New file — first binary_sensor platform.
                       Five "active" sensors for Fajr/Dhuhr/Asr/
                       Maghrib/Isha, ON during their prayer window.
                       Isha window crosses midnight; the post-
                       midnight branch handles "we're in yesterday's
                       Isha right now" by approximating yesterday's
                       Isha as today's Isha minus 24h.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from homeassistant.components.binary_sensor import BinarySensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.util import dt as dt_util

from .const import DOMAIN, PRAYERS, SENSOR_ENTITY_PREFIX
from .prayer_times import coordinator_datetimes
from .sensor import _device_info

_LOGGER = logging.getLogger(__name__)

# Each prayer's window ends when the next prayer starts. Isha is the
# odd one out: its window ends at the NEXT DAY'S Fajr, so the
# resolution logic below has a special branch.
_NEXT_PRAYER = {
    "fajr": "dhuhr",
    "dhuhr": "asr",
    "asr": "maghrib",
    "maghrib": "isha",
    "isha": "fajr",  # next day
}

# How often we wake up to re-evaluate window membership. 60s is the
# coarsest tick the user is likely to notice; tighter buys little.
_TICK = timedelta(seconds=60)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Register one "<prayer> active" binary_sensor per adhan prayer.

    Wrapped in try/except so any unexpected construction failure
    degrades to a logged warning instead of aborting the whole
    config-entry setup (which would also block switch + sensor).
    """
    try:
        entities = [
            NidaPrayerActiveSensor(hass, entry, prayer) for prayer in PRAYERS
        ]
        async_add_entities(entities)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning(
            "Nida binary_sensor setup failed (%s); per-prayer 'active' "
            "sensors will not be available. Other Nida entities are "
            "unaffected.",
            err,
        )


class NidaPrayerActiveSensor(BinarySensorEntity):
    """ON while we're inside this prayer's window.

    Deliberately NOT a CoordinatorEntity — see 2.0.23 changelog. We
    read coordinator state on-demand from hass.data, which is the
    same pattern services.py uses and avoids the CoordinatorEntity
    mixin entirely.
    """

    _attr_has_entity_name = False
    _attr_icon = "mdi:mosque"
    _attr_should_poll = False

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        prayer: str,
    ) -> None:
        self.hass = hass
        self._entry = entry
        self._prayer = prayer
        # Hardcoded English — Islamic proper names aren't translated
        # (see SKILL.md).
        self._attr_name = f"{prayer.capitalize()} active"
        self._attr_unique_id = f"{entry.entry_id}_active_{prayer}"
        self._attr_device_info = _device_info(entry)
        self.entity_id = (
            f"binary_sensor.{SENSOR_ENTITY_PREFIX}{prayer}_active"
        )

    async def async_added_to_hass(self) -> None:
        # 1-minute heartbeat so transitions land within ~60s of the
        # real prayer-time edge.
        self.async_on_remove(
            async_track_time_interval(self.hass, self._async_tick, _TICK)
        )

    async def _async_tick(self, _now) -> None:
        # Guard against ticks that fire during teardown after the
        # entity is removed from hass but before the listener job
        # is cancelled.
        if self.hass is None or not self.entity_id:
            return
        try:
            self.async_write_ha_state()
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug(
                "binary_sensor tick write_ha_state failed for %s (%s)",
                self._prayer, err,
            )

    def _coordinator(self):
        """The Nida coordinator from hass.data, or None."""
        try:
            return self.hass.data[DOMAIN][self._entry.entry_id]
        except (AttributeError, KeyError):
            return None

    @property
    def is_on(self) -> bool | None:
        """True if local time is inside this prayer's window."""
        coordinator = self._coordinator()
        data = getattr(coordinator, "data", None) or {}
        timings = data.get("data", {}).get("timings", {})
        if not timings:
            return None

        now = dt_util.now()
        start, end = self._resolve_window(coordinator_datetimes(coordinator), now)
        if start is None or end is None:
            return None
        return start <= now < end

    def _resolve_window(
        self, stamps: dict[str, datetime], now: datetime
    ) -> tuple[datetime | None, datetime | None]:
        """Compute [start, end) for this prayer at the current moment.

        `stamps` are the real timestamps of the timings day (2.5.7), so an
        Isha after midnight already sits on the coming night.
        """
        start = stamps.get(self._prayer.capitalize())
        if start is None:
            return None, None

        if self._prayer == "isha":
            # Isha runs until the next Fajr.
            fajr = stamps.get("Fajr")
            if fajr is None:
                return None, None
            if now < fajr:
                # Before this day's Fajr: still the previous night's Isha,
                # approximated with this day's Isha one day earlier.
                return start - timedelta(days=1), fajr
            return start, fajr + timedelta(days=1)

        end = stamps.get(_NEXT_PRAYER[self._prayer].capitalize())
        if end is None:
            return None, None
        return start, end

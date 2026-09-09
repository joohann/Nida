"""Nida sensors — prayer times (timestamp + readable), hijri calendar, next prayer.

In 2.0.5 the entity-name source was switched from _attr_translation_key
(which depends on strings.json being picked up by HA) to direct
_attr_name values. Johann reported that on his HA setup the entity names
stayed empty even with strings.json present and a full restart, falling
back to the device name "Nida" or the device_class label "Timestamp".
Direct _attr_name values eliminate that dependency.

Trade-off: entity names are no longer translatable via HA's i18n
mechanism — they're always English. That's acceptable here because the
prayer names (Fajr, Dhuhr, etc.) are Arabic-derived and internationally
recognizable, so there's no localization loss for the most visible
entities. The hijri/next_prayer entities use plain English nouns;
adding i18n back is a future step once we've confirmed strings.json is
actually being processed by HA.

Entity IDs: with _attr_has_entity_name=True (inherited from base) plus
_attr_name set, HA auto-generates entity_id as sensor.<device>_<name>
slugified, i.e. sensor.nida_fajr. We don't need _attr_suggested_object_id
anymore; that explicit form was a hedge against the translation_key
edge case which we've now bypassed entirely.

Changelog:
  2.0.6 (2026-06-28): Removed PrayerTimeReadableSensor — 5 entities gone.
                      HA's UI renders TIMESTAMP-class sensors as "In 6
                      hours" / "9 hours ago" in lists and as real
                      datetimes in templates, which covers both use
                      cases without a separate string sensor. Entity
                      count drops from 16 to 11. Existing _readable
                      entities disappear after a delete + re-add of
                      the integration.
  2.0.5 (2026-06-28): Switched entity naming from _attr_translation_key
                      to direct _attr_name. Removed _attr_suggested_object_id
                      since auto-generated entity_ids now produce the
                      expected sensor.nida_<x> form. Resolves Johann's
                      "all entities show 'Nida' or 'Timestamp'" issue.
  2.0.0 (2026-06-27): Nieuw bestand voor deze herbouwstap. Entity_ids met
                      domain-prefix (sensor.nida_fajr) i.p.v. de oude
                      volgnummer-prefix (sensor.02_fajr). Hijri-data komt
                      rechtstreeks uit coordinator.data, geen aparte call.
"""
from __future__ import annotations

import logging
from datetime import datetime

from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, HIJRI_FIELDS, PRAYERS
from .coordinator import PrayerTimesCoordinator

_LOGGER = logging.getLogger(__name__)


def _device_info(entry: ConfigEntry) -> DeviceInfo:
    """One shared device for all Nida entities, anchored to the config entry."""
    return DeviceInfo(
        identifiers={(DOMAIN, entry.entry_id)},
        name="Nida",
        manufacturer="joohann",
        model="Nida Prayer Times",
    )


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up all Nida sensors from the config entry."""
    coordinator: PrayerTimesCoordinator = hass.data[DOMAIN][entry.entry_id]
    device_info = _device_info(entry)

    entities: list[SensorEntity] = []

    # 5 prayer timestamps. HA renders these as "In 6 hours" / "9 hours ago"
    # in entity lists and as a real datetime in templates, which covers
    # both the human-friendly view and the programmatic view. No need for
    # separate "readable" string sensors — those were a Nida 1.x habit
    # that 2.x has outgrown (removed in 2.0.6).
    for prayer in PRAYERS:
        entities.append(PrayerTimeSensor(coordinator, entry, device_info, prayer))

    for field in HIJRI_FIELDS:
        entities.append(HijriSensor(coordinator, entry, device_info, field))

    entities.append(NextPrayerSensor(coordinator, entry, device_info))

    async_add_entities(entities)


class _NidaSensorBase(CoordinatorEntity[PrayerTimesCoordinator], SensorEntity):
    """Shared base: device_info, has_entity_name, unique_id wiring."""

    _attr_has_entity_name = True

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
        unique_id_suffix: str,
    ) -> None:
        super().__init__(coordinator)
        self._entry = entry
        self._attr_device_info = device_info
        self._attr_unique_id = f"{entry.entry_id}_{unique_id_suffix}"


class PrayerTimeSensor(_NidaSensorBase):
    """Timestamp sensor for one prayer — sensor.nida_<prayer>."""

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
        prayer: str,
    ) -> None:
        super().__init__(coordinator, entry, device_info, prayer)
        self._prayer = prayer
        self._attr_name = prayer.capitalize()  # "Fajr", "Dhuhr", etc.

    @property
    def native_value(self) -> datetime | None:
        """Return the prayer time as a timezone-aware datetime.

        The Aladhan response only gives "HH:MM" (no date), so we combine
        it with today's date in HA's local timezone to produce a valid
        timestamp instead of a bare time string.
        """
        time_str = self._raw_time()
        if time_str is None:
            return None
        return self._combine_with_today(time_str)

    def _raw_time(self) -> str | None:
        if not self.coordinator.data:
            return None
        timings = self.coordinator.data.get("data", {}).get("timings", {})
        return timings.get(self._prayer.capitalize())

    def _combine_with_today(self, time_str: str) -> datetime | None:
        """Stitch 'HH:MM' onto today's date in HA's configured timezone.

        dt_util.now() returns a tz-aware datetime in HA's configured zone
        with no blocking I/O — no manual ZoneInfo construction needed.
        """
        try:
            hour, minute = (int(p) for p in time_str.split(" ")[0].split(":"))
        except (ValueError, AttributeError):
            _LOGGER.debug("Unexpected time format from Aladhan: %s", time_str)
            return None

        now = dt_util.now()
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


class HijriSensor(_NidaSensorBase):
    """One field of the hijri date (date/day/month/year/holiday).

    Reads directly from coordinator.data["data"]["date"]["hijri"] — no
    extra API call, that block is already part of the timings response.
    """

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
        field: str,
    ) -> None:
        super().__init__(coordinator, entry, device_info, f"hijri_{field}")
        self._field = field
        self._attr_name = f"Hijri {field}"

    @property
    def native_value(self) -> str | None:
        if not self.coordinator.data:
            return None
        hijri = self.coordinator.data.get("data", {}).get("date", {}).get("hijri", {})
        if not hijri:
            return None

        if self._field == "date":
            return hijri.get("date")
        if self._field == "day":
            return hijri.get("day")
        if self._field == "month":
            return hijri.get("month", {}).get("en")
        if self._field == "year":
            return hijri.get("year")
        if self._field == "holiday":
            holidays = hijri.get("holidays") or []
            # holidays is a list; if multiple on one day we show the first.
            return holidays[0] if holidays else "None"
        return None


class NextPrayerSensor(_NidaSensorBase):
    """Which of the 5 prayers comes up next, based on the current time."""

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
    ) -> None:
        super().__init__(coordinator, entry, device_info, "next_prayer")
        self._attr_name = "Next prayer"

    @property
    def native_value(self) -> str | None:
        if not self.coordinator.data:
            return None
        timings = self.coordinator.data.get("data", {}).get("timings", {})
        now = dt_util.now()

        for prayer in PRAYERS:
            raw = timings.get(prayer.capitalize())
            if raw is None:
                continue
            try:
                hour, minute = (int(p) for p in raw.split(" ")[0].split(":"))
            except (ValueError, AttributeError):
                continue
            prayer_dt = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
            if prayer_dt > now:
                return prayer

        # All 5 prayers are already past today — next is tomorrow's Fajr.
        return "fajr"

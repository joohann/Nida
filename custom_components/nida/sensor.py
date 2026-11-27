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
  2.5.7 (2026-11-27): Prayer, Imsak and next-prayer values come from
                      prayer_times.coordinator_datetimes(): an Isha after
                      midnight (high-latitude summer) shows the coming night
                      instead of the morning that already passed, and
                      next_prayer counts it as still ahead. next_prayer also
                      writes its state at every prayer time (a point-in-time
                      timer), not only when the coordinator updates, which
                      was about twice a day.
  2.1.34 (2026-07-11): New ImsakSensor — sensor.nida_imsak. The panel's
                       Today-card Imsak row (and now the new suhoor
                       reminder in scheduler.py) already referenced this
                       entity_id, but the sensor was never actually built,
                       so the row silently hid on every install. Mirrors
                       PrayerTimeSensor exactly, just reading Aladhan's
                       "Imsak" timings key instead of one of the 5 adhan
                       prayers — Imsak has no adhan/scheduling of its own,
                       it's purely informational (and, as of 2.1.34, the
                       anchor for the suhoor reminder).
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
  2.0.0 (2026-06-27): New file for this rebuild step. Entity ids with a
                      domain prefix (sensor.nida_fajr) instead of the old
                      sequence-number prefix (sensor.02_fajr). Hijri data comes
                      straight from coordinator.data, no separate call.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from homeassistant.components.sensor import SensorEntity, SensorDeviceClass
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity import DeviceInfo
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.helpers.update_coordinator import CoordinatorEntity
from homeassistant.util import dt as dt_util

from .const import DOMAIN, HIJRI_FIELDS, PRAYERS
from .coordinator import PrayerTimesCoordinator
from .prayer_times import coordinator_datetimes

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

    entities.append(ImsakSensor(coordinator, entry, device_info))

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
        """The prayer time as a timezone-aware datetime.

        Aladhan gives only "HH:MM"; prayer_times stitches it onto the day
        the timings belong to (2.5.7), so an Isha after midnight shows the
        coming night rather than the morning that already passed.
        """
        if not self.coordinator.data:
            return None
        return coordinator_datetimes(self.coordinator).get(self._prayer.capitalize())


class ImsakSensor(_NidaSensorBase):
    """Timestamp sensor for Imsak — sensor.nida_imsak.

    Same shape as PrayerTimeSensor, just reading the "Imsak" key from the
    Aladhan timings dict instead of one of the 5 adhan prayers. Imsak has
    no adhan of its own; this sensor exists purely so the panel's Today
    card (and the 2.1.34 suhoor reminder) can show/compute against a real
    timestamp instead of the raw "HH:MM" string.
    """

    _attr_device_class = SensorDeviceClass.TIMESTAMP

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
    ) -> None:
        super().__init__(coordinator, entry, device_info, "imsak")
        self._attr_name = "Imsak"

    @property
    def native_value(self) -> datetime | None:
        if not self.coordinator.data:
            return None
        return coordinator_datetimes(self.coordinator).get("Imsak")


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
        self._unsub_next = None

    @property
    def native_value(self) -> str | None:
        if not self.coordinator.data:
            return None
        prayer, _stamp = self._next(dt_util.now())
        return prayer

    def _next(self, now: datetime) -> tuple[str, datetime | None]:
        """(prayer, start) of the first prayer after `now`.

        All five passed: tomorrow's Fajr, with no start yet (tomorrow's
        timings arrive with the next coordinator update).
        """
        stamps = coordinator_datetimes(self.coordinator)
        upcoming = sorted(
            (stamp, prayer)
            for prayer in PRAYERS
            if (stamp := stamps.get(prayer.capitalize())) is not None and stamp > now
        )
        if upcoming:
            return upcoming[0][1], upcoming[0][0]
        return "fajr", None

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        self._arm_next()
        self.async_on_remove(self._cancel_next)

    @callback
    def _handle_coordinator_update(self) -> None:
        self._arm_next()
        super()._handle_coordinator_update()

    def _cancel_next(self) -> None:
        if self._unsub_next is not None:
            self._unsub_next()
            self._unsub_next = None

    @callback
    def _arm_next(self) -> None:
        """2.5.7: write the state again the moment the next prayer starts."""
        self._cancel_next()
        if not self.coordinator.data:
            return
        _prayer, stamp = self._next(dt_util.now())
        if stamp is None:
            return
        self._unsub_next = async_track_point_in_time(
            self.hass, self._async_prayer_started, stamp + timedelta(seconds=1)
        )

    @callback
    def _async_prayer_started(self, _now) -> None:
        self._unsub_next = None
        self.async_write_ha_state()
        self._arm_next()

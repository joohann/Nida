"""Nida sensors — prayer times (timestamp + readable), hijri-kalender, next prayer.

Sensor-set herzien bij de 2.0.0-herbouw (zie const.py changelog voor de
volledige afweging). Deze stap bevat:

  - 5 gebeden × 2 (timestamp + readable): fajr, dhuhr, asr, maghrib, isha
  - 5 hijri-sensors: date, day, month, year, holiday
  - 1 next_prayer sensor

Bewust NIET in deze stap (zie SKILL.md / architecture.md voor afbakening):
imsak, sunrise, sunset, midnight, is_ramadan, islamic_holiday_today — komen
terug zodra Ramadan/vasten-features herbouwd worden.

Alle sensors horen bij één Nida-device (device_info gedeeld via _device_info()),
geen losse devices per sensor-groep — dat patroon uit 1.x blijft behouden.

Changelog:
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

from .const import DOMAIN, PRAYERS, HIJRI_FIELDS, SENSOR_ENTITY_PREFIX
from .coordinator import PrayerTimesCoordinator

_LOGGER = logging.getLogger(__name__)


def _device_info(entry: ConfigEntry) -> DeviceInfo:
    """Eén gedeeld device voor alle Nida-entities, gekoppeld aan de config entry.

    Geen losse devices per sensor-groep (dat patroon is bewust verlaten in
    1.x al en blijft zo in 2.0.0).
    """
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
    """Zet alle Nida-sensors op vanuit de config entry."""
    coordinator: PrayerTimesCoordinator = hass.data[DOMAIN][entry.entry_id]
    device_info = _device_info(entry)

    entities: list[SensorEntity] = []

    for prayer in PRAYERS:
        entities.append(PrayerTimeSensor(coordinator, entry, device_info, prayer))
        entities.append(PrayerTimeReadableSensor(coordinator, entry, device_info, prayer))

    for field in HIJRI_FIELDS:
        entities.append(HijriSensor(coordinator, entry, device_info, field))

    entities.append(NextPrayerSensor(coordinator, entry, device_info))

    async_add_entities(entities)


class _NidaSensorBase(CoordinatorEntity[PrayerTimesCoordinator], SensorEntity):
    """Gedeelde basis: device_info + unique_id-opbouw."""

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
    """Timestamp-sensor voor één gebed, bv. sensor.nida_fajr."""

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
        self._attr_translation_key = prayer
        self._attr_suggested_object_id = f"{SENSOR_ENTITY_PREFIX}{prayer}"

    @property
    def native_value(self) -> datetime | None:
        """Geef de prayer-tijd terug als timezone-aware datetime.

        De Aladhan-response geeft alleen "HH:MM" terug (geen datum) — we
        combineren dat hier met de datum uit data.date.gregorian zodat HA
        een geldige timestamp krijgt i.p.v. alleen een tijd-string.
        """
        time_str = self._raw_time()
        if time_str is None:
            return None
        return self._combine_with_today(time_str)

    def _raw_time(self) -> str | None:
        if not self.coordinator.data:
            return None
        timings = self.coordinator.data.get("data", {}).get("timings", {})
        # Aladhan gebruikt hoofdletter-namen (Fajr, Dhuhr, ...).
        return timings.get(self._prayer.capitalize())

    def _combine_with_today(self, time_str: str) -> datetime | None:
        """Plak "HH:MM" aan de datum van vandaag, in de HA-tijdzone.

        dt_util.now() geeft direct een timezone-aware datetime in de
        geconfigureerde HA-tijdzone — geen handmatige ZoneInfo-constructie
        nodig (dat zou blocking I/O kunnen doen, zie HA dev docs over
        timezone handling).
        """
        try:
            hour, minute = (int(p) for p in time_str.split(" ")[0].split(":"))
        except (ValueError, AttributeError):
            _LOGGER.debug("Onverwacht tijdformaat van Aladhan: %s", time_str)
            return None

        now = dt_util.now()
        return now.replace(hour=hour, minute=minute, second=0, microsecond=0)


class PrayerTimeReadableSensor(_NidaSensorBase):
    """Leesbare tekst-sensor voor één gebed, bv. sensor.nida_fajr_readable."""

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
        prayer: str,
    ) -> None:
        super().__init__(coordinator, entry, device_info, f"{prayer}_readable")
        self._prayer = prayer
        self._attr_translation_key = f"{prayer}_readable"
        self._attr_suggested_object_id = f"{SENSOR_ENTITY_PREFIX}{prayer}_readable"

    @property
    def native_value(self) -> str | None:
        if not self.coordinator.data:
            return None
        timings = self.coordinator.data.get("data", {}).get("timings", {})
        raw = timings.get(self._prayer.capitalize())
        if raw is None:
            return None
        # Aladhan kan " (GMT)" o.i.d. aan de tijd plakken; alleen "HH:MM" tonen.
        return raw.split(" ")[0]


class HijriSensor(_NidaSensorBase):
    """Sensor voor één hijri-veld (date/day/month/year/holiday).

    Leest rechtstreeks uit coordinator.data["data"]["date"]["hijri"] —
    geen aparte API-call, die data zit al in de bestaande timings-response.
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
        self._attr_translation_key = f"hijri_{field}"
        self._attr_suggested_object_id = f"{SENSOR_ENTITY_PREFIX}hijri_{field}"

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
            # holidays is een lijst; bij meerdere op één dag tonen we de eerste.
            return holidays[0] if holidays else "Geen"
        return None


class NextPrayerSensor(_NidaSensorBase):
    """Welk gebed van de 5 als volgende komt, op basis van de huidige tijd."""

    def __init__(
        self,
        coordinator: PrayerTimesCoordinator,
        entry: ConfigEntry,
        device_info: DeviceInfo,
    ) -> None:
        super().__init__(coordinator, entry, device_info, "next_prayer")
        self._attr_translation_key = "next_prayer"
        self._attr_suggested_object_id = f"{SENSOR_ENTITY_PREFIX}next_prayer"

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

        # Alle 5 gebeden van vandaag zijn al voorbij — volgende is fajr (morgen).
        return "fajr"

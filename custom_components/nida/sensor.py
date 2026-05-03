"""Sensor platform for Nida."""
from __future__ import annotations

from datetime import datetime, timedelta
import logging

from homeassistant.components.sensor import SensorDeviceClass, SensorEntity, EntityCategory
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .const import DOMAIN, CONF_TARHIM_SOUND
from .media.audio import async_get_sound_duration

_LOGGER = logging.getLogger(__name__)

# Buffer (seconden) tussen einde tarhim en start Fajr — moet matchen
# met TARHIM_BUFFER_SECONDS in media/tarhim.py.
TARHIM_BUFFER_SECONDS = 10

PRAYER_SENSORS = [
    ("Imsak",    "01", "mdi:mosque"),
    ("Fajr",     "02", "mdi:mosque"),
    ("Sunrise",  "03", "mdi:weather-sunset-up"),
    ("Dhuhr",    "04", "mdi:mosque"),
    ("Asr",      "05", "mdi:mosque"),
    ("Sunset",   "06", "mdi:weather-sunset-down"),
    ("Maghrib",  "07", "mdi:mosque"),
    ("Isha",     "08", "mdi:mosque"),
    ("Midnight", "09", "mdi:weather-night"),
]

HIJRI_SENSORS = [
    ("Hijri Date",     "hijri_date",    "mdi:calendar-star"),
    ("Hijri Day",      "hijri_day",     "mdi:calendar"),
    ("Hijri Month",    "hijri_month",   "mdi:calendar-month"),
    ("Hijri Year",     "hijri_year",    "mdi:calendar-blank"),
    ("Islamic Holiday","hijri_holiday", "mdi:star-crescent"),
]


def _nida_device_info(entry):
    """Eén device 'Nida' voor alle entities. Vervangt de oude opsplitsing
    in Nida / Nida Readable / Hijri Calendar (zie _async_cleanup_legacy_devices
    in __init__.py voor de migratie).
    """
    return {
        "identifiers": {(DOMAIN, entry.entry_id)},
        "name": "Nida",
        "manufacturer": "AlAdhan",
        "model": "AlAdhan API",
    }


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = []

    for name, order, icon in PRAYER_SENSORS:
        entities.append(PrayerTimeSensor(coordinator, entry, name, order, icon))
        entities.append(PrayerTimeReadableSensor(coordinator, entry, name, order, icon))

    entities.append(NextPrayerSensor(coordinator, entry))
    entities.append(IslamicHolidayBinarySensor(coordinator, entry))
    entities.append(IsRamadanSensor(coordinator, entry))
    entities.append(NidaSuhoorReadableSensor(coordinator, entry))
    entities.append(NidaTarhimReadableSensor(coordinator, entry))

    for name, key, icon in HIJRI_SENSORS:
        entities.append(HijriSensor(coordinator, entry, name, key, icon))

    async_add_entities(entities)


class PrayerTimeSensor(CoordinatorEntity, SensorEntity):
    # TIMESTAMP-sensor voor power users die `at: sensor.02_fajr` automations
    # willen bouwen. Disabled-by-default: zichtbaar via "+ X disabled entities"
    # in Devices & Services. Bij een nieuwe install verschijnen ze niet
    # automatisch in de UI.
    _attr_entity_registry_enabled_default = False

    def __init__(self, coordinator, entry, prayer_name, order, icon):
        super().__init__(coordinator)
        self._prayer_name = prayer_name
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{prayer_name.lower()}"
        self._attr_name = f"{order}. {prayer_name}"
        # Forceer schone entity_id zonder devicenaam-prefix → sensor.02_fajr
        self._attr_suggested_object_id = f"{order}_{prayer_name.lower()}"
        self._attr_device_class = SensorDeviceClass.TIMESTAMP
        self._attr_icon = icon
        self._attr_entity_category = EntityCategory.DIAGNOSTIC

    @property
    def native_value(self):
        try:
            timings = self.coordinator.data["data"]["timings"]
            time_str = timings[self._prayer_name]
            today = datetime.now().strftime("%Y-%m-%d")
            dt = datetime.strptime(f"{today} {time_str}", "%Y-%m-%d %H:%M")
            return dt.astimezone()
        except Exception:
            return None

    @property
    def device_info(self):
        return _nida_device_info(self._entry)


class PrayerTimeReadableSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, entry, prayer_name, order, icon):
        super().__init__(coordinator)
        self._prayer_name = prayer_name
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{prayer_name.lower()}_readable"
        self._attr_name = f"{order}. {prayer_name} Readable"
        # Forceer schone entity_id → sensor.02_fajr_readable
        self._attr_suggested_object_id = f"{order}_{prayer_name.lower()}_readable"
        self._attr_icon = icon

    @property
    def native_value(self):
        try:
            return self.coordinator.data["data"]["timings"][self._prayer_name]
        except Exception:
            return None

    @property
    def device_info(self):
        return _nida_device_info(self._entry)


class HijriSensor(CoordinatorEntity, SensorEntity):
    def __init__(self, coordinator, entry, name, key, icon):
        super().__init__(coordinator)
        self._key = key
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{key}"
        self._attr_name = name
        # Forceer schone entity_id → sensor.hijri_date, sensor.hijri_day, ...
        self._attr_suggested_object_id = key
        self._attr_icon = icon

    @property
    def native_value(self):
        try:
            hijri = self.coordinator.data["data"]["date"]["hijri"]
            if self._key == "hijri_date":
                return hijri["date"]
            elif self._key == "hijri_day":
                return hijri["day"]
            elif self._key == "hijri_month":
                return hijri["month"]["en"]
            elif self._key == "hijri_year":
                return hijri["year"]
            elif self._key == "hijri_holiday":
                holidays = hijri.get("holidays", [])
                return ", ".join(holidays) if holidays else "—"
        except Exception:
            return None

    @property
    def extra_state_attributes(self):
        try:
            hijri = self.coordinator.data["data"]["date"]["hijri"]
            gregorian = self.coordinator.data["data"]["date"]["gregorian"]
            meta = self.coordinator.data["data"]["meta"]
            return {
                "hijri_date": hijri["date"],
                "hijri_day": hijri["day"],
                "hijri_month_en": hijri["month"]["en"],
                "hijri_month_ar": hijri["month"]["ar"],
                "hijri_month_days": hijri["month"].get("days"),
                "hijri_year": hijri["year"],
                "hijri_weekday_en": hijri["weekday"]["en"],
                "hijri_weekday_ar": hijri["weekday"]["ar"],
                "gregorian_date": gregorian["date"],
                "gregorian_weekday": gregorian["weekday"]["en"],
                "holidays": hijri.get("holidays", []),
                "timezone": meta.get("timezone"),
                "latitude": meta.get("latitude"),
                "longitude": meta.get("longitude"),
                "method": meta.get("method", {}).get("name"),
            }
        except Exception:
            return {}

    @property
    def device_info(self):
        return _nida_device_info(self._entry)


class NextPrayerSensor(CoordinatorEntity, SensorEntity):
    """Sensor that shows the next upcoming prayer."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_next_prayer"
        self._attr_name = "Next Prayer"
        # Forceer schone entity_id → sensor.next_prayer
        self._attr_suggested_object_id = "next_prayer"
        self._attr_icon = "mdi:skip-next-circle"

    @property
    def native_value(self):
        try:
            from datetime import datetime
            timings = self.coordinator.data["data"]["timings"]
            prayers = {
                "Fajr": timings["Fajr"],
                "Dhuhr": timings["Dhuhr"],
                "Asr": timings["Asr"],
                "Maghrib": timings["Maghrib"],
                "Isha": timings["Isha"],
            }
            now_ts = datetime.now().timestamp()
            today = datetime.now().strftime("%Y-%m-%d")

            upcoming = []
            for name, time_str in prayers.items():
                dt = datetime.strptime(f"{today} {time_str}", "%Y-%m-%d %H:%M")
                ts = dt.timestamp()
                if ts > now_ts:
                    upcoming.append((name, ts))

            if upcoming:
                upcoming.sort(key=lambda x: x[1])
                name, ts = upcoming[0]
                diff = (ts - now_ts) / 60
                if diff < 60:
                    return f"{name} in {round(diff)} minutes"
                else:
                    from datetime import datetime
                    return f"{datetime.fromtimestamp(ts).strftime('%H:%M')} ({name})"
            else:
                # Na Isha — toon Fajr morgen
                fajr_ts = datetime.strptime(f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M").timestamp() + 86400
                diff = (fajr_ts - now_ts) / 60
                if diff < 60:
                    return f"Fajr in {round(diff)} minutes"
                else:
                    return f"{datetime.fromtimestamp(fajr_ts).strftime('%H:%M')} (Fajr)"
        except Exception:
            return None

    @property
    def device_info(self):
        return _nida_device_info(self._entry)


class IsRamadanSensor(CoordinatorEntity):
    """Binary sensor that is on during Ramadan (Hijri month 9)."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_is_ramadan"
        self._attr_name = "Is Ramadan"
        # Forceer schone entity_id → sensor.is_ramadan
        self._attr_suggested_object_id = "is_ramadan"
        self._attr_icon = "mdi:star-crescent"

    @property
    def state(self):
        try:
            month = int(self.coordinator.data["data"]["date"]["hijri"]["month"]["number"])
            return "on" if month == 9 else "off"
        except Exception:
            return "off"

    @property
    def extra_state_attributes(self):
        try:
            hijri = self.coordinator.data["data"]["date"]["hijri"]
            month_num = int(hijri["month"]["number"])
            day = int(hijri["day"])
            days_in_month = hijri["month"].get("days", 30)
            return {
                "ramadan_day": day if month_num == 9 else None,
                "days_remaining": (days_in_month - day) if month_num == 9 else None,
            }
        except Exception:
            return {}

    @property
    def device_info(self):
        return _nida_device_info(self._entry)


class IslamicHolidayBinarySensor(CoordinatorEntity):
    """Binary sensor that is on when there is an Islamic holiday."""

    def __init__(self, coordinator, entry):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_is_holiday"
        self._attr_name = "Islamic Holiday Today"
        # Forceer schone entity_id → sensor.islamic_holiday_today
        self._attr_suggested_object_id = "islamic_holiday_today"
        self._attr_icon = "mdi:star-crescent"

    @property
    def state(self):
        try:
            holidays = self.coordinator.data["data"]["date"]["hijri"].get("holidays", [])
            return "on" if holidays else "off"
        except Exception:
            return "off"

    @property
    def extra_state_attributes(self):
        try:
            holidays = self.coordinator.data["data"]["date"]["hijri"].get("holidays", [])
            return {"holiday_name": ", ".join(holidays) if holidays else None}
        except Exception:
            return {}

    @property
    def device_info(self):
        return _nida_device_info(self._entry)



# ─────────────────────────────────────────────────────────────────────────────
# Nida Suhoor / Tarhim readable sensors
# ─────────────────────────────────────────────────────────────────────────────
# Vroeger werden deze waarden via `hass.states.async_set("sensor.nida_suhoor_readable", ...)`
# als ghost-sensors weggeschreven door de scheduler en media/suhoor.py +
# media/tarhim.py. Dat omzeilde het entity registry, dus geen device-koppeling,
# geen unique_id, en korte unavailable-vensters na restart.
# Deze klassen zijn echte SensorEntity instances en updaten elke minuut zodat
# de roll-over (na vandaag → morgen) precies klopt.

class _BaseNidaTimeSensor(CoordinatorEntity, SensorEntity):
    """Gedeelde plumbing voor Suhoor + Tarhim readable sensors."""

    _attr_has_entity_name = False  # we gebruiken een vaste eigen naam

    def __init__(self, coordinator, entry: ConfigEntry, suffix: str, name: str, icon: str):
        super().__init__(coordinator)
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_{suffix}"
        self._attr_name = name
        self._attr_icon = icon
        # Forceer entity_id zonder devicenaam-prefix → sensor.nida_suhoor_readable
        self._attr_suggested_object_id = suffix

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        # Tick elke minuut zodat het readable-veld correct doorrolt
        # naar morgen zodra de tijd van vandaag voorbij is.
        self.async_on_remove(
            async_track_time_interval(
                self.hass, self._handle_tick, timedelta(minutes=1)
            )
        )

    @callback
    def _handle_tick(self, _now) -> None:
        self.async_write_ha_state()

    @property
    def device_info(self):
        return _nida_device_info(self._entry)


class NidaSuhoorReadableSensor(_BaseNidaTimeSensor):
    """Toont het suhoor-alarmtijdstip (HH:MM) — rolt na verstrijken naar morgen."""

    def __init__(self, coordinator, entry: ConfigEntry):
        super().__init__(
            coordinator, entry,
            suffix="nida_suhoor_readable",
            name="Nida Suhoor Alarm Time",
            icon="mdi:food",
        )

    @property
    def native_value(self):
        try:
            options = self._entry.options if self._entry.options else self._entry.data
            if not options.get("suhoor_alarm_enabled", True):
                return None

            timings = self.coordinator.data["data"]["timings"]
            minutes = int(options.get("suhoor_alarm_minutes", 30))

            today = datetime.now().strftime("%Y-%m-%d")
            fajr_today = datetime.strptime(
                f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
            ).timestamp()
            suhoor_ts = fajr_today - (minutes * 60)

            # Roll over naar morgen als suhoor van vandaag al voorbij is
            if suhoor_ts < datetime.now().timestamp():
                tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
                fajr_tomorrow = datetime.strptime(
                    f"{tomorrow} {timings['Fajr']}", "%Y-%m-%d %H:%M"
                ).timestamp()
                suhoor_ts = fajr_tomorrow - (minutes * 60)

            return datetime.fromtimestamp(suhoor_ts).strftime("%H:%M")
        except Exception:
            return None


class NidaTarhimReadableSensor(_BaseNidaTimeSensor):
    """Toont het tarhim-starttijdstip (HH:MM) — alleen tijdens Ramadan en als
    er een geldige tarhim-sound is geconfigureerd. Buiten Ramadan: None.

    Tarhim duur wordt eenmalig bij setup uit het MP3-bestand gelezen en
    gecached op de instance. Een options-update reload't de integratie via
    _async_update_listener in __init__.py, dus deze cache wordt automatisch
    vernieuwd bij sound-wijzigingen.
    """

    def __init__(self, coordinator, entry: ConfigEntry):
        super().__init__(
            coordinator, entry,
            suffix="nida_tarhim_readable",
            name="Nida Tarhim Time",
            icon="mdi:music",
        )
        self._duration: float = 0.0

    async def async_added_to_hass(self) -> None:
        await super().async_added_to_hass()
        # Cache de tarhim MP3-duur bij setup. Async, gebeurt non-blocking.
        options = self._entry.options if self._entry.options else self._entry.data
        sound = options.get(CONF_TARHIM_SOUND, "")
        if sound:
            self._duration = await async_get_sound_duration(self.hass, sound)
            self.async_write_ha_state()

    def _is_ramadan(self) -> bool:
        try:
            month_num = int(
                self.coordinator.data["data"]["date"]["hijri"]["month"]["number"]
            )
            return month_num == 9
        except Exception:
            return False

    @property
    def native_value(self):
        if self._duration <= 0 or not self._is_ramadan():
            return None
        try:
            timings = self.coordinator.data["data"]["timings"]
            today = datetime.now().strftime("%Y-%m-%d")
            fajr_ts = datetime.strptime(
                f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
            ).timestamp()
            tarhim_ts = fajr_ts - self._duration - TARHIM_BUFFER_SECONDS
            return datetime.fromtimestamp(tarhim_ts).strftime("%H:%M")
        except Exception:
            return None

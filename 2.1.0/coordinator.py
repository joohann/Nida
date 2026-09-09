"""Nida prayer-times coordinator — fetcht timings + hijri-datum van Aladhan API.

De Aladhan /timings-response bevat data.date.hijri al standaard mee (date,
day, weekday, month, year, holidays) — er is dus geen aparte API-call nodig
om hijri-gegevens te krijgen. sensor.py leest dit rechtstreeks uit
coordinator.data["data"]["date"]["hijri"].

Changelog:
  2.0.10 (2026-06-28): _build_url gebruikt nu eerst lat/lon uit
                       entry.options als die zijn gezet (door de panel
                       city-autocomplete via Nominatim). Pas als die er
                       niet zijn valt het terug op hass.config (device
                       mode). En pas helemaal achteraan op de oude
                       country+city tekstvelden naar /timingsByCity.
                       Dit verwijdert de manual-mode bug waar
                       ?country=NL naar Aladhan ging (Aladhan wil
                       "Netherlands", geen ISO-code).
  2.0.0 (2026-06-27): Changelog-kop toegevoegd bij de 2.0.0-herbouw. Functioneel
                      ongewijzigd t.o.v. 1.1.7 — hijri-data zat al in de response,
                      coordinator hoefde niet aangepast om dit te ontsluiten.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)

from .const import DOMAIN, CONF_CITY, CONF_COUNTRY, CONF_METHOD

_LOGGER = logging.getLogger(__name__)

UPDATE_INTERVAL = timedelta(hours=12)
API_TIMEOUT_SECONDS = 30
API_BASE = "https://api.aladhan.com/v1"


class PrayerTimesCoordinator(DataUpdateCoordinator):
    """Coordinator dat dagelijkse prayer-timings ophaalt.

    Naast de standaard 12-uurs polling triggert deze coordinator ook een
    extra refresh op 00:01 lokale tijd — _build_url() gebruikt date.today()
    waardoor je anders het hele uur na middernacht nog gisterens timings
    serveert tot de volgende reguliere refresh.
    """

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=UPDATE_INTERVAL,
        )
        self.entry = entry
        self._unsub_midnight = None

    async def async_config_entry_first_refresh(self) -> None:  # type: ignore[override]
        await super().async_config_entry_first_refresh()
        # Plan een extra refresh net na middernacht zodat date.today() in
        # _build_url() de nieuwe dag oppakt zonder te wachten op het
        # 12-uurs interval.
        self._unsub_midnight = async_track_time_change(
            self.hass,
            self._async_midnight_refresh,
            hour=0, minute=1, second=0,
        )
        self.entry.async_on_unload(self._unsub_midnight)

    async def _async_midnight_refresh(self, _now) -> None:
        _LOGGER.debug("Midnight refresh — fetching timings for new date")
        await self.async_request_refresh()

    def _build_url(self) -> str:
        """Bouw API-URL.

        Volgorde van voorkeur:
          1. lat/lon uit entry.options — door de panel city-autocomplete
             gezet (manual mode). Coordinaten zijn ondubbelzinnig, dus
             als die er zijn, gebruik die ongeacht location_mode.
          2. hass.config.latitude/longitude — HA's eigen home-locatie
             (device mode).
          3. Tekstuele city+country naar /timingsByCity — pure fallback
             voor entries die nog geen coords hebben en niet op HA's
             location vertrouwen. Werkt alleen als CONF_COUNTRY een
             land-naam is die Aladhan kent ("Netherlands"), geen ISO-code.
        """
        method = int(
            self.entry.options.get(
                CONF_METHOD, self.entry.data.get(CONF_METHOD, 3)
            )
        )
        today = date.today().strftime("%d-%m-%Y")

        opt_lat = self.entry.options.get("latitude")
        opt_lon = self.entry.options.get("longitude")
        if isinstance(opt_lat, (int, float)) and isinstance(opt_lon, (int, float)):
            return (
                f"{API_BASE}/timings/{today}"
                f"?latitude={opt_lat}&longitude={opt_lon}&method={method}"
            )

        ha_lat = self.hass.config.latitude
        ha_lon = self.hass.config.longitude
        if ha_lat and ha_lon:
            return (
                f"{API_BASE}/timings/{today}"
                f"?latitude={ha_lat}&longitude={ha_lon}&method={method}"
            )

        city = self.entry.options.get(
            CONF_CITY, self.entry.data.get(CONF_CITY, "Amsterdam")
        )
        country = self.entry.options.get(
            CONF_COUNTRY, self.entry.data.get(CONF_COUNTRY, "Netherlands")
        )
        return (
            f"{API_BASE}/timingsByCity"
            f"?city={city}&country={country}&method={method}"
        )

    async def _async_update_data(self):
        """Fetch fresh timings van de API."""
        url = self._build_url()
        session = async_get_clientsession(self.hass)
        try:
            async with asyncio.timeout(API_TIMEOUT_SECONDS):
                async with session.get(url, allow_redirects=True) as response:
                    if response.status != 200:
                        raise UpdateFailed(f"API error: {response.status}")
                    data = await response.json()
                    timings = data.get("data", {}).get("timings", {})
                    _LOGGER.debug("API timings: %s", list(timings.keys()))
                    return data
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"API error: {err}") from err

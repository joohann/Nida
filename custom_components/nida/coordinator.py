"""Nida prayer-times coordinator — fetcht timings van Aladhan API."""
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
        """Bouw API-URL — gebruikt coordinaten als beschikbaar, anders city/country."""
        method = int(
            self.entry.options.get(
                CONF_METHOD, self.entry.data.get(CONF_METHOD, 3)
            )
        )

        lat = self.hass.config.latitude
        lon = self.hass.config.longitude

        if lat and lon:
            today = date.today().strftime("%d-%m-%Y")
            return (
                f"{API_BASE}/timings/{today}"
                f"?latitude={lat}&longitude={lon}&method={method}"
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

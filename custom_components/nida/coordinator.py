"""Nida prayer-times coordinator — fetcht timings van Aladhan API."""
from __future__ import annotations

import asyncio
import logging
from datetime import date, timedelta

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
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
    """Coordinator dat dagelijkse prayer-timings ophaalt."""

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=UPDATE_INTERVAL,
        )
        self.entry = entry

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
        try:
            connector = aiohttp.TCPConnector(ssl=False)
            async with aiohttp.ClientSession(connector=connector) as session:
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

"""Nida prayer-times coordinator — fetches timings + hijri date from the Aladhan API.

The Aladhan /timings response already includes data.date.hijri (date,
day, weekday, month, year, holidays) — so no separate API call is needed
to get the hijri data. sensor.py reads it straight from
coordinator.data["data"]["date"]["hijri"].

Changelog:
  2.0.10 (2026-06-28): _build_url now first uses lat/lon from
                       entry.options when set (by the panel city
                       autocomplete via Nominatim). Only when those are
                       missing does it fall back to hass.config (device
                       mode), and only last to the old country+city
                       text fields via /timingsByCity.
                       This removes the manual-mode bug where
                       ?country=NL was sent to Aladhan (Aladhan wants
                       "Netherlands", not an ISO code).
  2.0.0 (2026-06-27): Changelog header added with the 2.0.0 rebuild. Functionally
                      unchanged from 1.1.7 — the hijri data was already in the
                      response, the coordinator needed no change to expose it.
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
    """Coordinator that fetches the daily prayer timings.

    Besides the standard 12-hour polling this coordinator also triggers an
    extra refresh at 00:01 local time — _build_url() uses date.today(), so
    otherwise yesterday's timings would still be served after midnight
    until the next regular refresh.
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
        # Schedule an extra refresh just after midnight so date.today() in
        # _build_url() picks up the new day without waiting for the
        # 12-hour interval.
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
        """Build the API URL.

        Order of preference:
          1. lat/lon from entry.options — set by the panel city
             autocomplete (manual mode). Coordinates are unambiguous, so
             when present they are used regardless of location_mode.
          2. hass.config.latitude/longitude — HA's own home location
             (device mode).
          3. Textual city+country via /timingsByCity — pure fallback
             for entries that have no coords yet and do not rely on HA's
             location. Only works when CONF_COUNTRY is a country name
             Aladhan knows ("Netherlands"), not an ISO code.
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
        """Fetch fresh timings from the API."""
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

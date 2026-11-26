"""Nida prayer-times coordinator — fetches timings + hijri date from the Aladhan API.

The Aladhan /timings response already includes data.date.hijri (date,
day, weekday, month, year, holidays) — so no separate API call is needed
to get the hijri data. sensor.py reads it straight from
coordinator.data["data"]["date"]["hijri"].

Changelog:
  2.5.4 (2026-11-12): The last good API response is now cached to disk
                      (Store "nida_timings_<entry>"). On startup, when the
                      Aladhan API cannot be reached (e.g. a transient
                      TLS/SNI error from its geo edge, or no internet yet),
                      the coordinator serves the cached timings instead of
                      failing setup, so the sensors stay available instead
                      of disappearing. A short retry is scheduled while
                      serving stale data so fresh timings return as soon as
                      the API recovers. Nothing changes when the API is up.
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
from typing import Any

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import issue_registry as ir
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.event import async_call_later, async_track_time_change
from homeassistant.helpers.storage import Store
from homeassistant.helpers.update_coordinator import (
    DataUpdateCoordinator,
    UpdateFailed,
)

from .const import DOMAIN, CONF_CITY, CONF_COUNTRY, CONF_METHOD

_LOGGER = logging.getLogger(__name__)

UPDATE_INTERVAL = timedelta(hours=12)
API_TIMEOUT_SECONDS = 30
API_BASE = "https://api.aladhan.com/v1"

# When we had to serve cached timings because the API was unreachable, try
# again this soon instead of waiting for the full 12-hour interval, so fresh
# data returns quickly once the API recovers.
STALE_RETRY_SECONDS = 300

_STORE_VERSION = 1

# Repair issue raised in Settings → Repairs when the API cannot be reached.
ISSUE_API_UNREACHABLE = "api_unreachable"


def _detect_dns_blocker(hass: HomeAssistant) -> str:
    """Best-effort guess at a DNS blocker that could be blocking the API.

    Aladhan is reached via a CNAME to bahriya.app, which some blocklists
    (e.g. "1Hosts") block, taking api.aladhan.com down with it. Naming the
    blocker in the repair issue makes the fix obvious. Falls back to a
    generic phrase when nothing is detected — the advice still applies.
    """
    try:
        if hass.config_entries.async_entries("adguard"):
            return "AdGuard Home"
        if hass.config_entries.async_entries("pi_hole"):
            return "Pi-hole"
    except Exception:  # noqa: BLE001 — detection must never raise
        pass
    # Installed as a Home Assistant OS/Supervisor add-on without the
    # matching integration? Look through the add-on list if we can.
    try:
        from homeassistant.components.hassio import get_supervisor_info

        info = get_supervisor_info(hass) or {}
        for addon in info.get("addons") or []:
            slug = str(addon.get("slug", "")).lower()
            name = str(addon.get("name", "")).lower()
            if "adguard" in slug or "adguard" in name:
                return "AdGuard Home"
            if "pi_hole" in slug or "pihole" in slug or "pi-hole" in name:
                return "Pi-hole"
    except Exception:  # noqa: BLE001 — not on Supervisor, or API shape changed
        pass
    return "a DNS blocker such as AdGuard Home or Pi-hole"


class PrayerTimesCoordinator(DataUpdateCoordinator):
    """Coordinator that fetches the daily prayer timings.

    Besides the standard 12-hour polling this coordinator also triggers an
    extra refresh at 00:01 local time — _build_url() uses date.today(), so
    otherwise yesterday's timings would still be served after midnight
    until the next regular refresh.

    The last successful response is cached to disk so a restart during an
    API outage keeps the sensors alive instead of failing setup (2.5.4).
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
        self._unsub_stale_retry = None
        self._store: Store = Store(
            hass, _STORE_VERSION, f"nida_timings_{entry.entry_id}"
        )
        # Last response read from disk at setup. Used only as a fallback when
        # the very first API fetch fails (self.data is still None then).
        self._disk_cache: dict[str, Any] | None = None

    async def async_config_entry_first_refresh(self) -> None:  # type: ignore[override]
        # Load any cached timings BEFORE the first fetch, so that fetch can
        # fall back to them when the API is unreachable at startup.
        try:
            self._disk_cache = await self._store.async_load()
        except Exception as err:  # noqa: BLE001 — a bad cache must never block setup
            _LOGGER.debug("Nida: could not read cached timings (%s)", err)
            self._disk_cache = None

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
        self.entry.async_on_unload(self._cancel_stale_retry)

    async def _async_midnight_refresh(self, _now) -> None:
        _LOGGER.debug("Midnight refresh — fetching timings for new date")
        await self.async_request_refresh()

    def _cancel_stale_retry(self) -> None:
        if self._unsub_stale_retry is not None:
            self._unsub_stale_retry()
            self._unsub_stale_retry = None

    def _schedule_stale_retry(self) -> None:
        """Retry sooner than the normal interval while serving cached data."""
        self._cancel_stale_retry()

        async def _retry(_now) -> None:
            self._unsub_stale_retry = None
            await self.async_request_refresh()

        self._unsub_stale_retry = async_call_later(
            self.hass, STALE_RETRY_SECONDS, _retry
        )

    def _raise_api_issue(self) -> None:
        """Show a repair with DNS-blocker guidance (idempotent)."""
        ir.async_create_issue(
            self.hass,
            DOMAIN,
            ISSUE_API_UNREACHABLE,
            is_fixable=False,
            severity=ir.IssueSeverity.WARNING,
            translation_key=ISSUE_API_UNREACHABLE,
            translation_placeholders={"blocker": _detect_dns_blocker(self.hass)},
        )

    def _clear_api_issue(self) -> None:
        ir.async_delete_issue(self.hass, DOMAIN, ISSUE_API_UNREACHABLE)

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
        """Fetch fresh timings from the API.

        On success the response is cached to disk. On failure the most
        recent timings we have (this session's, else the disk cache) are
        served so the sensors stay available; a short retry is scheduled
        so fresh data returns once the API recovers. Only when there is no
        cache at all does the update fail.
        """
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
            # Fetch succeeded — refresh the on-disk cache, drop any pending
            # stale-retry and clear the repair issue.
            self._disk_cache = data
            self._cancel_stale_retry()
            self._clear_api_issue()
            try:
                await self._store.async_save(data)
            except Exception as err:  # noqa: BLE001 — caching must never fail a good update
                _LOGGER.debug("Nida: could not cache timings (%s)", err)
            return data
        except (aiohttp.ClientError, asyncio.TimeoutError, UpdateFailed) as err:
            # Surface a repair with blocker-specific guidance either way.
            self._raise_api_issue()
            fallback = self.data or self._disk_cache
            if fallback:
                _LOGGER.warning(
                    "Nida: Aladhan API unreachable (%s); serving cached "
                    "prayer times and retrying in %d min",
                    err, STALE_RETRY_SECONDS // 60,
                )
                self._schedule_stale_retry()
                return fallback
            # Nothing cached yet — let HA retry setup/update as before.
            raise UpdateFailed(f"API error: {err}") from err

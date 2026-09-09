"""Nida Islamic Calendar lookahead — Hijri date lookup via Aladhan's
gToHCalendar endpoint, used by scheduler.py's daily calendar-reminder check
(see const.py's OPT_CALENDAR_* section for the feature this supports).

Stateless by design: async_lookup_hijri_range fetches fresh from Aladhan on
every call. That's fine here because the only caller (scheduler.py's daily
calendar-fire-time trigger) calls it once a day — no caching layer needed
for something this infrequent, and it keeps this module simple with no
cache-invalidation edge cases to get wrong.

Verified live against the real API while building this (2026-07-08):
GET /v1/gToHCalendar/{month}/{year}[?latitude=..&longitude=..] returns
{"data": [{"hijri": {...}, "gregorian": {...}}, ...]} for every day in that
Gregorian month. latitude/longitude are accepted but appear to have no
effect on the result (tested identical output with and without them) —
this is pure Hijri/Gregorian calendar conversion, not a location-dependent
calculation like prayer times. They're still passed through when available
for consistency with the rest of Nida and in case that ever changes.

Changelog:
  2.1.2 (2026-07-08): New async_get_hijri_month_calendar() + shared
                      events_for_hijri_day() helper, for the panel's new
                      calendar month-grid view (replaces the old client-
                      side approximate holiday card). Uses Aladhan's
                      hToGCalendar/{month}/{year} endpoint — the REVERSE
                      of gToHCalendar above: takes a HIJRI month/year and
                      returns each day's Gregorian equivalent, which is
                      exactly what a Hijri-month grid needs (verified
                      live during this session, same location-independence
                      as gToHCalendar). events_for_hijri_day() reuses the
                      same const.py tables as the reminder feature
                      (ISLAMIC_HOLIDAYS / ASHURA_ARAFAH_DATES / WHITE_DAYS
                      / WEEKLY_SUNNAH_WEEKDAYS) so the calendar view and
                      the push-reminders never drift apart.
  2.1.0 (2026-07-08): New file — gToHCalendar lookup for the Islamic
                      Calendar reminders feature (see const.py's
                      OPT_CALENDAR_* section for why this exists instead
                      of relying on Aladhan's own `holidays` field, which
                      is a curated list of mostly-Sufi scholar
                      anniversaries, not the widely-observed occasions
                      Nida reminds for).
"""
from __future__ import annotations

import asyncio
import logging
from datetime import date

import aiohttp

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

API_BASE = "https://api.aladhan.com/v1"
API_TIMEOUT_SECONDS = 30


def _resolve_lat_lon(hass: HomeAssistant, entry: ConfigEntry) -> tuple[float, float] | None:
    """Same resolution order as coordinator.py's _build_url (options first,
    then HA's own home location) — kept as a small standalone copy rather
    than importing from coordinator.py, since that module's _build_url also
    builds the full timings URL and city/country fallback, neither of which
    this lookup needs (gToHCalendar is date-based, not city-based, and
    doesn't have a by-city variant to fall back to).
    """
    opt_lat = entry.options.get("latitude")
    opt_lon = entry.options.get("longitude")
    if isinstance(opt_lat, (int, float)) and isinstance(opt_lon, (int, float)):
        return float(opt_lat), float(opt_lon)
    ha_lat = hass.config.latitude
    ha_lon = hass.config.longitude
    if ha_lat and ha_lon:
        return float(ha_lat), float(ha_lon)
    return None


def _months_between(start: date, end: date) -> list[tuple[int, int]]:
    """(month, year) tuples for every Gregorian calendar month [start, end]
    touches, inclusive. At most 3 for Nida's 30-day-max lookahead window
    (the Jan-31-plus-30-days edge case spans Jan/Feb/Mar)."""
    months: list[tuple[int, int]] = []
    y, m = start.year, start.month
    while (y, m) <= (end.year, end.month):
        months.append((m, y))
        m += 1
        if m > 12:
            m = 1
            y += 1
    return months


async def _fetch_month(
    hass: HomeAssistant, month: int, year: int, lat_lon: tuple[float, float] | None
) -> list[dict]:
    session = async_get_clientsession(hass)
    url = f"{API_BASE}/gToHCalendar/{month}/{year}"
    if lat_lon:
        url += f"?latitude={lat_lon[0]}&longitude={lat_lon[1]}"
    try:
        async with asyncio.timeout(API_TIMEOUT_SECONDS):
            async with session.get(url, allow_redirects=True) as response:
                if response.status != 200:
                    _LOGGER.warning(
                        "Nida calendar lookahead: API error %s for %s-%s",
                        response.status, month, year,
                    )
                    return []
                body = await response.json()
                return body.get("data", []) or []
    except aiohttp.ClientError as err:
        _LOGGER.warning(
            "Nida calendar lookahead: API error for %s-%s: %s", month, year, err
        )
        return []


async def async_lookup_hijri_range(
    hass: HomeAssistant, entry: ConfigEntry, start: date, end: date
) -> dict[date, tuple[int, int]]:
    """Return {gregorian_date: (hijri_month, hijri_day)} for every day in
    [start, end], inclusive.

    A missing date in the result means the lookup for that date's month
    failed (API error/timeout) — callers should treat a missing date as
    "unknown, skip that check today" rather than erroring the whole daily
    calendar-reminder pass over one bad month fetch.
    """
    lat_lon = _resolve_lat_lon(hass, entry)
    months = _months_between(start, end)
    results: dict[date, tuple[int, int]] = {}
    for month, year in months:
        entries = await _fetch_month(hass, month, year, lat_lon)
        for item in entries:
            greg = item.get("gregorian", {})
            hijri = item.get("hijri", {})
            g_date_str = greg.get("date")  # "DD-MM-YYYY"
            if not g_date_str:
                continue
            try:
                day_str, month_str, year_str = g_date_str.split("-")
                g_date = date(int(year_str), int(month_str), int(day_str))
            except (ValueError, TypeError):
                continue
            if not (start <= g_date <= end):
                continue
            try:
                h_day = int(hijri.get("day"))
                h_month = int(hijri.get("month", {}).get("number"))
            except (ValueError, TypeError):
                continue
            results[g_date] = (h_month, h_day)
    return results


def events_for_hijri_day(
    hijri_month: int, hijri_day: int, gregorian_weekday: int
) -> list[str]:
    """Event keys that fall on the given Hijri date.

    Reuses the exact same fixed tables the daily reminder check in
    scheduler.py matches against (ISLAMIC_HOLIDAYS, ASHURA_ARAFAH_DATES,
    WHITE_DAYS, WEEKLY_SUNNAH_WEEKDAYS — see const.py's Islamic Calendar
    section) so the calendar view and the push-reminder feature always
    agree on what counts as an event. A single day can carry more than
    one key — e.g. the 13th of a Hijri month that also happens to be a
    Monday matches both "white_days" and "weekly_sunnah".

    gregorian_weekday follows Python's date.weekday() convention
    (Monday=0 .. Sunday=6), same as WEEKLY_SUNNAH_WEEKDAYS.
    """
    from .const import (
        ASHURA_ARAFAH_DATES,
        ISLAMIC_HOLIDAYS,
        WEEKLY_SUNNAH_WEEKDAYS,
        WHITE_DAYS,
    )

    keys: list[str] = []
    for h in ISLAMIC_HOLIDAYS:
        if h["month"] == hijri_month and h["day"] == hijri_day:
            keys.append(h["key"])
    for a in ASHURA_ARAFAH_DATES:
        if a["month"] == hijri_month and a["day"] == hijri_day:
            keys.append(a["key"])
    if hijri_day in WHITE_DAYS:
        keys.append("white_days")
    if gregorian_weekday in WEEKLY_SUNNAH_WEEKDAYS:
        keys.append("weekly_sunnah")
    return keys


async def async_get_hijri_month_calendar(
    hass: HomeAssistant, hijri_month: int, hijri_year: int
) -> list[dict]:
    """One entry per day of the given HIJRI month, each with its Gregorian
    equivalent and matched calendar events — powers the panel's calendar
    month-grid view (nida/get_calendar_month websocket command).

    Unlike async_lookup_hijri_range above (which takes a Gregorian date
    range and needs a ConfigEntry to resolve lat/lon for the *inverse*
    gToHCalendar lookup), this calls Aladhan's hToGCalendar/{month}/{year}
    directly with the Hijri month/year the panel is displaying — no
    ConfigEntry needed, same location-independence already verified for
    gToHCalendar. Returns [] on any API failure; caller renders an empty-
    state grid rather than erroring.
    """
    session = async_get_clientsession(hass)
    url = f"{API_BASE}/hToGCalendar/{hijri_month}/{hijri_year}"
    try:
        async with asyncio.timeout(API_TIMEOUT_SECONDS):
            async with session.get(url, allow_redirects=True) as response:
                if response.status != 200:
                    _LOGGER.warning(
                        "Nida calendar month view: API error %s for Hijri %s-%s",
                        response.status, hijri_month, hijri_year,
                    )
                    return []
                body = await response.json()
                entries = body.get("data", []) or []
    except aiohttp.ClientError as err:
        _LOGGER.warning(
            "Nida calendar month view: API error for Hijri %s-%s: %s",
            hijri_month, hijri_year, err,
        )
        return []

    days: list[dict] = []
    for item in entries:
        hijri = item.get("hijri", {})
        greg = item.get("gregorian", {})
        g_date_str = greg.get("date")  # "DD-MM-YYYY"
        if not g_date_str:
            continue
        try:
            day_str, month_str, year_str = g_date_str.split("-")
            g_date = date(int(year_str), int(month_str), int(day_str))
        except (ValueError, TypeError):
            continue
        try:
            h_day = int(hijri.get("day"))
        except (ValueError, TypeError):
            continue
        events = events_for_hijri_day(hijri_month, h_day, g_date.weekday())
        days.append(
            {
                "hijri_day": h_day,
                "gregorian": g_date.isoformat(),
                "weekday": g_date.weekday(),
                "events": events,
            }
        )
    days.sort(key=lambda d: d["hijri_day"])
    return days

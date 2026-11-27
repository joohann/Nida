"""Prayer timestamps from Aladhan's "HH:MM" timings (2.5.7).

Aladhan returns clock times without a date. At high latitudes in summer
(the Netherlands among them) Isha falls after midnight: Amsterdam on
21 June gets "00:09", and that Isha belongs to the night that starts on
the evening of the same date, not to its early morning. Before 2.5.7
every module stitched "HH:MM" onto today's date on its own, so that Isha
landed on the morning that had already passed: the scheduler skipped it
and its pre-adhan, and next_prayer and the binary sensors were wrong.

Every module that turns timings into timestamps now goes through
prayer_datetimes() with one rule: a time that is not later than the one
before it, in the order of the day, falls on the next calendar day.

The coordinator decides which day the timings belong to (timings_day):
the day it fetched them for, kept until that day's last prayer has
passed, so the switch to the new day never drops an Isha that is still
ahead after midnight.

Changelog:
  2.5.7 (2026-11-27): New module.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from typing import Any

from homeassistant.util import dt as dt_util

# The order of the day as Aladhan names the keys. Imsak comes just before
# Fajr; Sunrise sits between Fajr and Dhuhr. Other keys (Sunset, Midnight,
# Firstthird, Lastthird) are not used by Nida.
DAY_ORDER = ("Imsak", "Fajr", "Sunrise", "Dhuhr", "Asr", "Maghrib", "Isha")


def parse_hhmm(value: Any) -> tuple[int, int] | None:
    """(hour, minute) from "HH:MM" or "HH:MM (CEST)"; None when unusable."""
    try:
        hh, mm = (int(x) for x in str(value).split(" ")[0].split(":"))
    except (ValueError, TypeError):
        return None
    if not (0 <= hh <= 23 and 0 <= mm <= 59):
        return None
    return hh, mm


def prayer_datetimes(timings: dict | None, day: date) -> dict[str, datetime]:
    """Aware timestamps for the timings of `day`, keyed like Aladhan ("Isha").

    Walks DAY_ORDER: whenever a time is not later than the previous one,
    it moves to the next day, and so does everything after it. Times are
    in Home Assistant's own time zone.
    """
    tz = dt_util.now().tzinfo
    out: dict[str, datetime] = {}
    previous: datetime | None = None
    offset = 0
    for name in DAY_ORDER:
        hm = parse_hhmm((timings or {}).get(name))
        if hm is None:
            continue
        stamp = datetime.combine(day + timedelta(days=offset), time(*hm), tzinfo=tz)
        while previous is not None and stamp <= previous:
            offset += 1
            stamp = datetime.combine(day + timedelta(days=offset), time(*hm), tzinfo=tz)
        out[name] = stamp
        previous = stamp
    return out


def coordinator_day(coordinator: Any) -> date:
    """The day the coordinator's current timings belong to.

    Falls back to today when the coordinator has no timings_day (yet).
    """
    day = getattr(coordinator, "timings_day", None)
    return day if isinstance(day, date) else dt_util.now().date()


def coordinator_datetimes(coordinator: Any) -> dict[str, datetime]:
    """prayer_datetimes() for the coordinator's current data and day."""
    data = getattr(coordinator, "data", None) or {}
    timings = data.get("data", {}).get("timings", {}) if isinstance(data, dict) else {}
    return prayer_datetimes(timings, coordinator_day(coordinator))

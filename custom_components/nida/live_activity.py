"""Nida Live Activity — the next prayer on the lock screen and Dynamic Island.

Drives the Home Assistant Companion app's Live Activity (iOS 17.2+, HA Core
2026.7+) and the equivalent Android live update, both triggered by sending a
notify.mobile_app_* message with `live_update: true`. One shared tag means each
prayer replaces the previous card instead of stacking.

Lifecycle per prayer: the card appears LEAD minutes before the adhan, counts
down with the app's own chronometer (so we never push every second), switches
colour for the last 10 minutes, reads "Now" at the adhan, and is cleared a few
minutes later. A coarse interval refreshes the progress bar in between.

The card layout belongs to the Companion app; Nida only chooses the text, the
colours, the icon and the timer. The title is fixed for the life of an
activity (an update cannot change it), so it is the generic "Next prayer". While
a chronometer runs the app shows the timer instead of the message, so the name
and time of the prayer go in `critical_text`, the corner label.

Changelog:
  2.5.0 (2026-10-10): New file — Live Activity for the next prayer, with a day
                       card (Dhuhr/Asr) and a night card (Fajr/Maghrib/Isha),
                       prayer name + time in the corner, and texts in the
                       ten panel languages. Android also gets colour, group, channel
                       and the Nida logo. async_test() sends a preview card for
                       90 seconds, for the panel's test button.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import (
    async_call_later,
    async_track_point_in_time,
    async_track_time_interval,
)
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_LIVE_ACTIVITY_MINUTES,
    DEFAULT_NOTIFY_LARGE_ICON_ENABLED,
    LIVE_ACTIVITY_DAY,
    LIVE_ACTIVITY_DAY_PRAYERS,
    LIVE_ACTIVITY_ICON_DAY,
    LIVE_ACTIVITY_ICON_NIGHT,
    LIVE_ACTIVITY_LINGER_MINUTES,
    LIVE_ACTIVITY_NIGHT,
    LIVE_ACTIVITY_REFRESH_MINUTES,
    LIVE_ACTIVITY_SOON_MINUTES,
    LIVE_ACTIVITY_TAG,
    MAX_LIVE_ACTIVITY_MINUTES,
    MIN_LIVE_ACTIVITY_MINUTES,
    NOTIFY_CHANNEL,
    NOTIFY_GROUP,
    NOTIFY_LARGE_ICON_PATH,
    OPT_NOTIFY_LARGE_ICON_ENABLED,
    OPT_LIVE_ACTIVITY_ENABLED,
    OPT_LIVE_ACTIVITY_MINUTES,
    OPT_NOTIFY_TARGETS,
    PRAYERS,
)
from .coordinator import PrayerTimesCoordinator
from .scheduler import _parse_today_time

_LOGGER = logging.getLogger(__name__)

# Only the Companion apps can show a Live Activity; a TV or any other notify
# service would just get a plain notification.
_MOBILE_APP_PREFIX = "notify.mobile_app_"
_TEST_SECONDS = 90

# Card texts, keyed by the panel's language codes (Malay is "ms").
_TEXTS: dict[str, dict[str, str]] = {
    "en": {"next": "Next prayer", "now": "Now"},
    "nl": {"next": "Volgend gebed", "now": "Nu"},
    "ar": {"next": "الصلاة القادمة", "now": "الآن"},
    "tr": {"next": "Sonraki namaz", "now": "Şimdi"},
    "de": {"next": "Nächstes Gebet", "now": "Jetzt"},
    "fr": {"next": "Prochaine prière", "now": "Maintenant"},
    "ms": {"next": "Solat seterusnya", "now": "Sekarang"},
    "id": {"next": "Salat berikutnya", "now": "Sekarang"},
    "ur": {"next": "اگلی نماز", "now": "ابھی"},
    "fa": {"next": "نماز بعدی", "now": "اکنون"},
}


def _texts(language: str | None) -> dict[str, str]:
    base = (language or "en").replace("_", "-").split("-")[0].lower()
    return _TEXTS.get(base, _TEXTS["en"])


def _clamp_minutes(raw) -> int:
    try:
        n = int(raw)
    except (TypeError, ValueError):
        return DEFAULT_LIVE_ACTIVITY_MINUTES
    return max(MIN_LIVE_ACTIVITY_MINUTES, min(MAX_LIVE_ACTIVITY_MINUTES, n))


class _Slot:
    """One prayer's window: card appears at `start`, adhan at `target`,
    card disappears at `end`."""

    __slots__ = ("prayer", "target", "start", "end")

    def __init__(self, prayer: str, target: datetime, start: datetime, end: datetime):
        self.prayer = prayer
        self.target = target
        self.start = start
        self.end = end


class NidaLiveActivity:
    """Plans and sends the next-prayer Live Activity."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        coordinator: PrayerTimesCoordinator,
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.coordinator = coordinator
        self._unsub: list = []
        self._unsub_coordinator = None
        self._slots: list[_Slot] = []
        # (prayer, phase, refresh bucket) of the last payload sent, or None
        # when no card is up. Survives a re-plan so an options change does
        # not resend an identical card.
        self._last_key: tuple | None = None
        self._unsub_test = None

    @callback
    def async_setup(self) -> None:
        self._unsub_coordinator = self.coordinator.async_add_listener(
            self.async_reschedule
        )
        self.async_reschedule()

    @callback
    def async_shutdown(self) -> None:
        self._cancel()
        if self._unsub_test is not None:
            self._unsub_test()
            self._unsub_test = None
        if self._unsub_coordinator is not None:
            self._unsub_coordinator()
            self._unsub_coordinator = None

    def _cancel(self) -> None:
        for unsub in self._unsub:
            unsub()
        self._unsub = []

    @callback
    def async_reschedule(self) -> None:
        """Re-plan from fresh timings/options, then sync to the current moment."""
        self._cancel()
        self._slots = self._build_slots()
        now = dt_util.now()

        if self._enabled():
            for slot in self._slots:
                soon = slot.target - timedelta(minutes=LIVE_ACTIVITY_SOON_MINUTES)
                for moment in (slot.start, soon, slot.target, slot.end):
                    if moment > now:
                        self._unsub.append(
                            async_track_point_in_time(
                                self.hass, self._async_tick, moment
                            )
                        )
            self._unsub.append(
                async_track_time_interval(
                    self.hass,
                    self._async_tick,
                    timedelta(minutes=LIVE_ACTIVITY_REFRESH_MINUTES),
                )
            )
        self.hass.async_create_task(self._async_sync())

    async def async_test(self) -> list[str]:
        """Show a preview card for the next prayer right now, regardless of
        the toggle or the lead time, and take it down again after 90 seconds.
        Returns the mobile app targets it was sent to."""
        targets = self._targets()
        if not targets:
            return []
        now = dt_util.now()
        lead = timedelta(
            minutes=_clamp_minutes(self.entry.options.get(OPT_LIVE_ACTIVITY_MINUTES))
        )
        upcoming = [s for s in self._slots if s.target > now]
        if upcoming:
            target, prayer = upcoming[0].target, upcoming[0].prayer
        else:
            # After Isha there is no prayer left in today's timings.
            first = self._slots[0] if self._slots else None
            prayer = first.prayer if first else PRAYERS[0]
            target = first.target + timedelta(days=1) if first else now + lead
        remaining = max((target - now).total_seconds(), 1)
        total = max(lead.total_seconds(), remaining)
        slot = _Slot(prayer, target, target - timedelta(seconds=total), target)
        payload = self._build_payload(slot, "ahead", remaining, False)

        if self._unsub_test is not None:
            self._unsub_test()
        self._last_key = ("test", "test", 0)
        await self._async_send(payload)
        self._unsub_test = async_call_later(
            self.hass, _TEST_SECONDS, self._async_end_test
        )
        return targets

    async def _async_end_test(self, _now) -> None:
        self._unsub_test = None
        await self._async_send(
            {"message": "clear_notification", "data": {"tag": LIVE_ACTIVITY_TAG}}
        )
        # Put back the real card if a window is open right now.
        self._last_key = None
        await self._async_sync()

    # ── planning ─────────────────────────────────────────────────────

    def _enabled(self) -> bool:
        return bool(self.entry.options.get(OPT_LIVE_ACTIVITY_ENABLED, False))

    def _targets(self) -> list[str]:
        return [
            t
            for t in (self.entry.options.get(OPT_NOTIFY_TARGETS) or [])
            if isinstance(t, str) and t.startswith(_MOBILE_APP_PREFIX)
        ]

    def _build_slots(self) -> list[_Slot]:
        data = self.coordinator.data or {}
        timings = data.get("data", {}).get("timings", {})
        if not timings:
            return []
        now = dt_util.now()
        lead = timedelta(
            minutes=_clamp_minutes(
                self.entry.options.get(OPT_LIVE_ACTIVITY_MINUTES)
            )
        )
        linger = timedelta(minutes=LIVE_ACTIVITY_LINGER_MINUTES)

        targets = []
        for prayer in PRAYERS:
            target = _parse_today_time(timings.get(prayer.capitalize()), now)
            if target is not None:
                targets.append((prayer, target))
        targets.sort(key=lambda p: p[1])

        slots: list[_Slot] = []
        for prayer, target in targets:
            start = target - lead
            # Never start before the previous card has been cleared, or the
            # clear would take the new card down with it.
            if slots:
                start = max(start, slots[-1].end)
            if start >= target:
                continue
            slots.append(_Slot(prayer, target, start, target + linger))
        return slots

    # ── sending ──────────────────────────────────────────────────────

    async def _async_tick(self, _now) -> None:
        await self._async_sync()

    async def _async_sync(self) -> None:
        """Make the card on the phone match the current moment."""
        if not self._enabled():
            await self._async_clear_if_up()
            return

        now = dt_util.now()
        index = next(
            (i for i, s in enumerate(self._slots) if s.start <= now < s.end), None
        )
        if index is None:
            await self._async_clear_if_up()
            return

        slot = self._slots[index]
        remaining = (slot.target - now).total_seconds()
        if remaining <= 0:
            phase = "now"
        elif remaining <= LIVE_ACTIVITY_SOON_MINUTES * 60:
            phase = "soon"
        else:
            phase = "ahead"
        bucket = (
            int(remaining // (LIVE_ACTIVITY_REFRESH_MINUTES * 60))
            if phase == "ahead"
            else 0
        )
        key = (slot.prayer, phase, bucket)
        if key == self._last_key:
            return

        # Same prayer = a refresh; a new prayer or phase change is worth a
        # normal-priority push so iOS actually delivers it on time.
        silent = self._last_key is not None and phase == "ahead" and (
            self._last_key[0] == slot.prayer and self._last_key[1] == "ahead"
        )
        payload = self._build_payload(slot, phase, max(remaining, 0), silent)
        self._last_key = key
        await self._async_send(payload)

    def _build_payload(
        self,
        slot: _Slot,
        phase: str,
        remaining: float,
        silent: bool,
    ) -> dict:
        # Follow the panel's language choice; "auto" (or unset) means HA's.
        chosen = self.entry.options.get("language")
        text = _texts(
            self.hass.config.language if chosen in (None, "", "auto") else chosen
        )
        name = slot.prayer.capitalize()
        palette = LIVE_ACTIVITY_DAY if slot.prayer in LIVE_ACTIVITY_DAY_PRAYERS else LIVE_ACTIVITY_NIGHT
        icon = (
            LIVE_ACTIVITY_ICON_DAY
            if slot.prayer in LIVE_ACTIVITY_DAY_PRAYERS
            else LIVE_ACTIVITY_ICON_NIGHT
        )

        if phase == "now":
            message = f"{name} · {text['now']}"
        else:
            message = f"{name} · {slot.target.strftime('%H:%M')}"

        data: dict = {
            "tag": LIVE_ACTIVITY_TAG,
            "live_update": True,
            # The app shows the timer instead of `message` while a chronometer
            # runs, so the time rides along with the name in the corner.
            "critical_text": (
                name if phase == "now" else f"{name} {slot.target.strftime('%H:%M')}"
            ),
            "notification_icon": icon,
            "notification_icon_color": palette["notification_icon_color"],
            "progress_bar_color": (
                palette["progress_bar_color_soon"]
                if phase == "soon"
                else palette["progress_bar_color"]
            ),
            "background_color": palette["background_color"],
            "text_color": palette["text_color"],
            "url": "/nida",
        }
        if phase == "now":
            data["progress"] = 0
            data["progress_max"] = max(int((slot.target - slot.start).total_seconds()), 1)
        else:
            data.update(
                {
                    "chronometer": True,
                    "when": int(slot.target.timestamp()),
                    "progress": int(remaining),
                    "progress_max": max(int((slot.target - slot.start).total_seconds()), 1),
                    "progress_bar_direction": "decreasing",
                }
            )
        # Android only (iOS ignores them): the accent colour, and the same
        # grouping/channel/logo as Nida's other notifications, so the live
        # update is labelled and styled as Nida's rather than plain Home
        # Assistant. The grouping keys are fixed values; see
        # _apply_notify_branding in scheduler.py for the reasoning.
        data["color"] = palette["notification_icon_color"]
        data["group"] = NOTIFY_GROUP
        data["channel"] = NOTIFY_CHANNEL
        if bool(
            self.entry.options.get(
                OPT_NOTIFY_LARGE_ICON_ENABLED, DEFAULT_NOTIFY_LARGE_ICON_ENABLED
            )
        ):
            data["icon_url"] = NOTIFY_LARGE_ICON_PATH
        if silent:
            data["silent"] = True
        return {"title": text["next"], "message": message, "data": data}

    async def _async_clear_if_up(self) -> None:
        if self._last_key is None:
            return
        self._last_key = None
        await self._async_send(
            {"message": "clear_notification", "data": {"tag": LIVE_ACTIVITY_TAG}}
        )

    async def _async_send(self, payload: dict) -> None:
        for target in self._targets():
            domain, service = target.split(".", 1)
            try:
                await self.hass.services.async_call(
                    domain, service, payload, blocking=False
                )
                _LOGGER.debug("Live Activity sent to %s: %s", target, payload.get("message"))
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("Live Activity call failed on %s: %s", target, err)

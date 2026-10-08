"""Nida scheduler — fires the adhan service at each enabled prayer time.

Listens for coordinator updates (startup, 12-hour cycle, midnight refresh).
On each update it cancels any pending point-in-time triggers and re-plans
them from the fresh prayer timings + the user's per-prayer enabled toggles.

This module is intentionally minimal: it only decides WHEN to play, then
delegates to nida.play_adhan (see services.py) for the actual playback.
For Release B, the scheduler also handles notification triggers and the
Friday Jumu'ah reminder — those are not delegated to a service, the
scheduler fires `hass.services.async_call('notify', <target>, ...)`
directly because the routing logic is purely scheduler-internal.

Changelog:
  2.1.35 (2026-07-11): Fajr wake-up alarm, Ramadan only (Johann: "hebben
                       we een fajr wekker voor ramadan?", confirmed
                       Ramadan-scoped via AskUserQuestion). New
                       fajr_target_for_ramadan capture in _async_reschedule
                       (same pattern as dhuhr_target_for_jumuah/
                       maghrib_target_for_ramadan — captured before the
                       `if target <= now: continue` so it survives even
                       when Fajr already passed today, but still requires
                       Fajr itself to be enabled, same dependency Jumu'ah
                       already has on Dhuhr). _maybe_schedule_fajr_alarm
                       computes wake_target = fajr_target -
                       fajr_alarm_minutes and plants up to two independent
                       triggers: (1) at wake_target,
                       _async_make_fajr_alarm_handler calls
                       scene.turn_on on the user's chosen scene with
                       transition=<fajr_alarm_transition_minutes*60>
                       seconds (HA's scene component supports a
                       `transition` service field for scenes containing
                       lights), and — if sound_mode is "together" — also
                       plays the wake sound in the same handler; (2) if
                       sound_mode is "delayed" instead, a SEPARATE trigger
                       at wake_target + transition_minutes plays the sound
                       only once the light has finished ramping up, for a
                       gentler wake-up. Scene and sound are independently
                       optional — either can be left unconfigured. Sound
                       playback (_async_play_fajr_alarm_sound) re-implements
                       services.py's volume_set-then-play_media sequence
                       inline (media_url = f"/local/nida/sounds/{rel}")
                       rather than importing services.py's private
                       _set_volume_safe/_play_media_safe, per this
                       codebase's established convention (see the Iftar
                       auto-dua guest-mode check, 2.1.34, for the same
                       precedent) of not importing underscore-prefixed
                       names across modules.
  2.1.34 (2026-07-11): Ramadan features (Johann: "wat kunnen we inbouwen
                       voor ramadan?" — see const.py's changelog for the
                       full option-key rationale). All gated on
                       _is_ramadan_today(), read directly off the
                       coordinator's own Hijri data in _async_reschedule
                       (no extra API call). (1) Suhoor reminder — fires
                       suhoor_reminder_minutes before the imsak_offset_
                       min-adjusted Imsak time (new sensor.nida_imsak,
                       see sensor.py), via _maybe_schedule_suhoor /
                       _async_make_suhoor_handler — same shape as the
                       Jumu'ah handler (persistent_notification fallback,
                       reuses the general notify_targets list). (2) Iftar
                       reminder — same shape, iftar_reminder_minutes
                       before Maghrib. (3) Iftar auto-dua — a SEPARATE
                       trigger planted at the exact Maghrib target time
                       (alongside, not replacing, the real adhan trigger)
                       that calls the existing nida.play_dua service with
                       the user's chosen iftar_dua_id — same service the
                       dua's own "Use" button calls, so it plays on the
                       dua's own configured player/volume. Guest mode is
                       checked here explicitly (play_dua itself doesn't,
                       by design, since manual button presses should
                       always work — but this is an automated trigger,
                       so it should respect guest mode like play_adhan
                       does). (4) Laylatul Qadr — folded into the existing
                       Islamic Calendar daily check as a fifth type
                       (calendar_laylatul_qadr_enabled), reusing
                       calendar_fire_time + calendar_notify_targets like
                       the other four.
  2.1.29 (2026-07-09): Android TV notification duration now matches the
                       real adhan length instead of a fixed 5s (Johann:
                       "kan de notificatie op de tv blijven staan tot het
                       einde van de adhan?"). _async_make_notify_handler
                       resolves the sound that WILL play for this prayer
                       today (services.async_resolve_adhan_sound_rel) and
                       looks up its real length
                       (catalog.async_sound_duration_seconds, new mutagen
                       dependency) — only when an Android TV target is
                       actually configured, to skip the extra work
                       otherwise. Passed through as the new tv_duration
                       param on _notify_service_data_for_target; other
                       callers (Jumu'ah, Islamic Calendar, ws_test_notify)
                       don't pass it and keep the old fixed-5s fallback.
                       Depends on services.py's 2.1.29 change making
                       random-adhan selection deterministic per
                       (date, prayer) — this handler and the real
                       play_adhan call are two independent scheduled
                       triggers with no shared state, so they need to
                       agree on the same file independently.
  2.1.25 (2026-07-09): Android TV notify data also gets color="green"
                       (Johann wants that back — default is grey, which
                       he found hard to notice) and duration=5 set
                       explicitly (Johann confirmed 5s is fine; matches
                       the API default, now just documented rather than
                       implicit).
  2.1.24 (2026-07-09): Android TV notify targets now get
                       data.position="top-right" (Johann: the default
                       bottom-right overlay didn't stand out). Detected
                       via an entity-registry platform lookup
                       (_is_android_tv_target), same approach
                       websocket.py's _nfandroidtv_info uses for the
                       panel's "Android TV"/online badge — duplicated
                       here rather than imported to avoid a module-load
                       cycle (websocket.py already imports FROM this
                       module locally for the same reason). All three
                       notify handlers (adhan-time, Jumu'ah, Islamic
                       Calendar) now build their service_data via
                       _notify_service_data_for_target instead of two of
                       them inlining a bare {title, message} dict, so the
                       Android TV positioning (and any future per-target
                       tweak) applies everywhere consistently instead of
                       needing to be repeated per handler.
  2.1.0 (2026-07-08): Islamic Calendar reminders. One new daily trigger
                       (_maybe_schedule_calendar_check), re-planned every
                       reschedule same as everything else here, at
                       options.calendar_fire_time. Unlike the other
                       triggers in this file it can't resolve its content
                       at schedule time (needs an async Aladhan lookup,
                       and this runs inside a @callback) — the handler
                       (_async_run_calendar_check) does the lookup
                       (islamic_calendar.async_lookup_hijri_range, one
                       round trip covering all four types) and the four
                       toggle checks when it actually fires. Notify
                       dispatch (_async_make_calendar_handler) mirrors
                       the Jumu'ah handler: separate target list
                       (calendar_notify_targets), persistent_notification
                       fallback when empty, per-target try/except. See
                       const.py's OPT_CALENDAR_* section for the full
                       design rationale (why Aladhan's own `holidays`
                       field isn't used, the four reminder types, etc.).
  2.0.95 (2026-07-08): Per-target TTS/alarm-stream workaround for Samsung.
                       2.0.94's channel: "alarm_stream" still didn't ring
                       through on a Samsung Galaxy Z Flip 7 in silent
                       mode — per github.com/home-assistant/android
                       issues #1159 and #1465, this is a confirmed,
                       intentional Samsung/OneUI restriction: the OS
                       blocks apps from overriding a regular
                       notification's audio attributes at all, so no
                       channel/importance/priority combination on a
                       normal notification can fix it. The one thing
                       Samsung users in those threads consistently
                       report as working is a spoken TTS notification
                       played over the alarm stream instead of a normal
                       one — new _tts_critical_notify_data +
                       _notify_service_data_for_target (shared with
                       websocket.py's test path). Opt-in per notify.*
                       target via options.notify_tts_workaround_targets
                       (const.py) — it changes WHAT the recipient hears
                       (spoken message vs. a tone), so it's deliberately
                       not automatic. _async_make_notify_handler now
                       forks per target instead of building one shared
                       service_data for the whole targets list.
  2.0.94 (2026-07-08): Corrected 2.0.93 — the custom channel name ("Nida
                       Critical Alerts") only created a high-importance
                       channel, which still respects the ringer's silent
                       switch; it does not bypass it. Per the Companion app
                       docs (Notifications > Critical notifications >
                       Android Alarm Stream), `channel` is not a free-form
                       label — the reserved value "alarm_stream" is what
                       tells Android to play the notification sound over
                       the alarm audio stream, which is the only stream
                       that rings through silent/DND. _critical_notify_data
                       now sends channel: "alarm_stream" instead. Known
                       platform caveat (confirmed via community reports,
                       not just docs): some Samsung firmware blocks apps
                       from using the alarm stream for non-alarm
                       notifications regardless of this setting — if it
                       still stays silent on a Samsung device after this,
                       that's the phone's OEM restriction, not fixable from
                       the integration.
  2.0.93 (2026-07-08): Fixed critical notifications not breaking through on
                       Android (iOS worked fine). _critical_notify_data was
                       sending importance/priority "high" but no `channel`
                       key, so Android fell back to the app's default
                       channel — which was almost certainly already created
                       at normal importance by an earlier notification.
                       Android channel importance is fixed at creation and
                       can't be changed remotely afterwards, so the
                       "high" request was silently a no-op. Now sends a
                       distinct `channel: "Nida Critical Alerts"` so Android
                       creates a fresh channel at high importance. Users
                       with a pre-existing same-named channel stuck at the
                       wrong importance from before this fix still need to
                       correct it once by hand in Android settings — that
                       part is a platform limitation, not fixable from here.
  2.0.90 (2026-07-07): Critical notifications corrected to per-prayer.
                       2.0.89 read a single options.notify_critical_
                       enabled flag for every prayer; _maybe_schedule_
                       notify now reads options.notify_critical_enabled_
                       <prayer> instead (OPT_NOTIFY_CRITICAL_ENABLED_
                       PREFIX, const.py), so e.g. only Fajr can be
                       critical while the rest stay normal. Everything
                       downstream (_async_make_notify_handler,
                       _critical_notify_data) is unchanged — it already
                       took a plain bool, it's just sourced differently
                       now.
  2.0.89 (2026-07-07): Critical notifications. When options.
                       notify_critical_enabled is on, the adhan-time
                       notify handler (Jumu'ah untouched) attaches extra
                       `data` to the notify.* call — see
                       _critical_notify_data for the exact iOS/Android
                       keys and their caveats (iOS needs an Apple
                       entitlement we can't grant from here; Android's
                       DND behaviour is device-channel-dependent). Same
                       notify_targets as always, no separate target
                       list. _maybe_schedule_notify reads the flag and
                       threads it through _async_make_notify_handler.
                       SUPERSEDED by 2.0.90 (master flag → per-prayer).
  2.0.22 (2026-06-28): Pre-adhan reminder vuurt nu ook audio af via
                       nieuwe nida.play_pre_adhan_jingle service (mits
                       options.pre_adhan_audio_enabled True is —
                       default True). Voorheen was er alleen een
                       persistent_notification; audio was de lang
                       openstaande 🔴 in de status-tabel.
  2.0.18 (2026-06-28): Jumu'ah heeft eigen target-lijst nu —
                       options.jumuah_targets, los van de algemene
                       notify_targets. Bij leeg blijft de
                       persistent_notification fallback bestaan (was
                       al zo). Use case: niet alle gezinsleden hoeven
                       de Friday reminder.
  2.0.15 (2026-06-28): Release B — notification triggers + Jumu'ah
                       reminder. For each scheduled adhan, when the
                       master notify_enabled is on and the per-prayer
                       toggle is on, an additional trigger fires at
                       adhan-time that sends a notification to every
                       target in notify_targets. Title and message
                       are taken from notify_title/notify_message
                       (panel populates language-defaults at first
                       init). Separately, on Fridays a Jumu'ah
                       reminder is planted N minutes before Dhuhr
                       (N from jumuah_reminder_minutes, range 30-120,
                       default 60). Both use the same notify_targets
                       list; Jumu'ah has its own jumuah_message
                       template with [minutes] placeholder. Falls
                       back to persistent_notification if no targets
                       are set (Jumu'ah only — adhan-time notifies
                       just skip silently when no targets).
  2.0.13 (2026-06-28): Optional second pre-adhan reminder added —
                       when options.pre_adhan_two_enabled is True, the
                       scheduler plants a second persistent_notification
                       at options.pre_adhan_minutes_2 minutes before
                       each adhan.
  2.0.7 (2026-06-28): Pre-adhan reminder toegevoegd — voor elk gepland
                      gebed plant de scheduler nu een tweede trigger N
                      minuten ervoor (default 25, configureerbaar via
                      options.pre_adhan_minutes) die een
                      persistent_notification "X is in N minutes" toont.
  2.0.1 (2026-06-28): New file — initial scheduler for automatic adhan
                      playback. Reads enabled_<prayer> toggles, skips
                      disabled prayers, skips prayers already passed today.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta

from homeassistant.components import persistent_notification
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.event import async_track_point_in_time
from homeassistant.util import dt as dt_util

from .islamic_calendar import async_lookup_hijri_range

from .const import (
    ASHURA_ARAFAH_DATES,
    CALENDAR_LEAD_DAYS_MAX,
    DEFAULT_CALENDAR_FIRE_TIME,
    DEFAULT_CALENDAR_HOLIDAYS_LEAD_DAYS,
    DEFAULT_CALENDAR_HOLIDAYS_SECOND_LEAD_DAYS,
    DEFAULT_FAJR_ALARM_ENABLED,
    DEFAULT_FAJR_ALARM_MINUTES,
    DEFAULT_FAJR_ALARM_SOUND_MODE,
    DEFAULT_FAJR_ALARM_TRANSITION_MINUTES,
    DEFAULT_FAJR_ALARM_VOLUME,
    DEFAULT_IFTAR_REMINDER_MINUTES,
    DEFAULT_IFTAR_REMINDER_MESSAGE_FALLBACK,
    DEFAULT_IMSAK_OFFSET_MIN,
    DEFAULT_JUMUAH_MESSAGE_FALLBACK,
    DEFAULT_JUMUAH_MINUTES,
    DEFAULT_NOTIFY_ICON_COLOR,
    DEFAULT_NOTIFY_IOS_IMAGE_ENABLED,
    DEFAULT_NOTIFY_LARGE_ICON_ENABLED,
    DEFAULT_NOTIFY_MESSAGE_FALLBACK,
    DEFAULT_NOTIFY_TITLE_FALLBACK,
    DEFAULT_PRE_ADHAN_AUDIO_ENABLED,
    DEFAULT_PRE_ADHAN_MINUTES,
    DEFAULT_PRE_ADHAN_MINUTES_2,
    DEFAULT_SUHOOR_REMINDER_MINUTES,
    DEFAULT_SUHOOR_REMINDER_MESSAGE_FALLBACK,
    DOMAIN,
    FAJR_ALARM_MINUTES_MAX,
    FAJR_ALARM_MINUTES_MIN,
    FAJR_ALARM_SOUND_MODE_DELAYED,
    FAJR_ALARM_TRANSITION_MINUTES_MAX,
    FAJR_ALARM_TRANSITION_MINUTES_MIN,
    HIJRI_MONTH_RAMADAN,
    IFTAR_REMINDER_MINUTES_MAX,
    IFTAR_REMINDER_MINUTES_MIN,
    ISLAMIC_HOLIDAYS,
    JUMUAH_MAX_MINUTES,
    JUMUAH_MIN_MINUTES,
    LAYLATUL_QADR_DATES,
    OPT_CALENDAR_ASHURA_ARAFAH_ENABLED,
    OPT_CALENDAR_FIRE_TIME,
    OPT_CALENDAR_HOLIDAYS_ENABLED,
    OPT_CALENDAR_HOLIDAYS_LEAD_DAYS,
    OPT_CALENDAR_HOLIDAYS_SECOND_ENABLED,
    OPT_CALENDAR_HOLIDAYS_SECOND_LEAD_DAYS,
    OPT_CALENDAR_LAYLATUL_QADR_ENABLED,
    OPT_CALENDAR_NOTIFY_TARGETS,
    OPT_CALENDAR_WEEKLY_SUNNAH_ENABLED,
    OPT_CALENDAR_WHITE_DAYS_ENABLED,
    OPT_ENABLED_PREFIX,
    OPT_FAJR_ALARM_ENABLED,
    OPT_FAJR_ALARM_MEDIA_PLAYER,
    OPT_FAJR_ALARM_MINUTES,
    OPT_FAJR_ALARM_SCENE,
    OPT_FAJR_ALARM_SOUND,
    OPT_FAJR_ALARM_SOUND_MODE,
    OPT_FAJR_ALARM_TRANSITION_MINUTES,
    OPT_FAJR_ALARM_VOLUME,
    OPT_GUEST_MODE_ENABLED,
    OPT_GUEST_MODE_UNTIL,
    OPT_IFTAR_DUA_ENABLED,
    OPT_IFTAR_DUA_ID,
    OPT_IFTAR_REMINDER_ENABLED,
    OPT_IFTAR_REMINDER_MINUTES,
    OPT_IFTAR_REMINDER_MESSAGE,
    OPT_IMSAK_OFFSET_MIN,
    OPT_JUMUAH_MESSAGE,
    OPT_JUMUAH_REMINDER_ENABLED,
    OPT_JUMUAH_REMINDER_MINUTES,
    OPT_JUMUAH_TARGETS,
    OPT_NOTIFY_ENABLED,
    OPT_NOTIFY_ENABLED_PREFIX,
    OPT_NOTIFY_CRITICAL_ENABLED_PREFIX,
    NOTIFY_CHANNEL,
    NOTIFY_GROUP,
    NOTIFY_ICON_DEFAULT,
    NOTIFY_ICON_IMAGE_PATH,
    NOTIFY_LARGE_ICON_PATH,
    NOTIFY_THREAD_ID,
    OPT_NOTIFY_ICON,
    OPT_NOTIFY_ICON_COLOR,
    OPT_NOTIFY_IOS_IMAGE_ENABLED,
    OPT_NOTIFY_LARGE_ICON_ENABLED,
    OPT_NOTIFY_MESSAGE,
    OPT_NOTIFY_TARGETS,
    OPT_NOTIFY_TITLE,
    OPT_NOTIFY_TTS_WORKAROUND_TARGETS,
    OPT_PRE_ADHAN_AUDIO_ENABLED,
    OPT_PRE_ADHAN_ENABLED_PREFIX,
    OPT_PRE_ADHAN_MINUTES,
    OPT_PRE_ADHAN_MINUTES_2,
    OPT_PRE_ADHAN_TWO_ENABLED,
    OPT_SUHOOR_REMINDER_ENABLED,
    OPT_SUHOOR_REMINDER_MINUTES,
    OPT_SUHOOR_REMINDER_MESSAGE,
    OPT_TTS_PRE_ADHAN_ENABLED,
    OPT_TTS_PRE_ADHAN_DELAY,
    DEFAULT_TTS_PRE_ADHAN_DELAY,
    PRAYERS,
    SUHOOR_REMINDER_MINUTES_MAX,
    SUHOOR_REMINDER_MINUTES_MIN,
    WEEKLY_SUNNAH_WEEKDAYS,
    WHITE_DAYS,
)
from .catalog import async_sound_duration_seconds
from .coordinator import PrayerTimesCoordinator
from .services import (
    SERVICE_PLAY_ADHAN,
    SERVICE_PLAY_DUA,
    SERVICE_PLAY_PRE_ADHAN_JINGLE,
    SERVICE_SPEAK_PRE_ADHAN,
    async_resolve_adhan_sound_rel,
)

_LOGGER = logging.getLogger(__name__)

# Python's datetime.weekday(): Monday=0, ..., Friday=4, ..., Sunday=6.
_FRIDAY = 4


class NidaScheduler:
    """Re-plans adhan triggers whenever the coordinator data refreshes."""

    def __init__(
        self,
        hass: HomeAssistant,
        entry: ConfigEntry,
        coordinator: PrayerTimesCoordinator,
    ) -> None:
        self.hass = hass
        self.entry = entry
        self.coordinator = coordinator
        self._unsub_triggers: list = []
        self._unsub_coordinator = None

    @callback
    def async_setup(self) -> None:
        self._unsub_coordinator = self.coordinator.async_add_listener(
            self._async_reschedule
        )
        self._async_reschedule()

    @callback
    def async_shutdown(self) -> None:
        self._cancel_all_triggers()
        if self._unsub_coordinator is not None:
            self._unsub_coordinator()
            self._unsub_coordinator = None

    def _cancel_all_triggers(self) -> None:
        for unsub in self._unsub_triggers:
            unsub()
        self._unsub_triggers = []

    @callback
    def _async_reschedule(self) -> None:
        """Cancel existing triggers and plan fresh ones from the new timings."""
        self._cancel_all_triggers()

        data = self.coordinator.data or {}
        timings = data.get("data", {}).get("timings", {})
        if not timings:
            _LOGGER.debug("Scheduler: no timings yet, nothing to plan")
            return

        now = dt_util.now()
        options = self.entry.options

        planned = 0
        pre_min_1 = int(options.get(OPT_PRE_ADHAN_MINUTES, DEFAULT_PRE_ADHAN_MINUTES) or 0)
        two_enabled = bool(options.get(OPT_PRE_ADHAN_TWO_ENABLED, False))
        pre_min_2 = int(options.get(OPT_PRE_ADHAN_MINUTES_2, DEFAULT_PRE_ADHAN_MINUTES_2) or 0)
        notify_enabled = bool(options.get(OPT_NOTIFY_ENABLED, False))

        # 2.1.34 — Ramadan features are gated on the coordinator's own
        # already-fetched Hijri data (no extra API call). See
        # _hijri_month_number below.
        is_ramadan = (
            _hijri_month_number(data.get("data", {}).get("date", {}).get("hijri", {}))
            == HIJRI_MONTH_RAMADAN
        )

        dhuhr_target_for_jumuah = None
        maghrib_target_for_ramadan = None
        fajr_target_for_ramadan = None

        for prayer in PRAYERS:
            if not _is_enabled(options, prayer):
                _LOGGER.debug("Scheduler: %s is disabled, skipping", prayer)
                continue

            time_str = timings.get(prayer.capitalize())
            target = _parse_today_time(time_str, now)
            if target is None:
                continue
            if prayer == "dhuhr":
                # Capture even if it's already passed today so the
                # Jumu'ah block below can decide on its own window.
                dhuhr_target_for_jumuah = target
            if prayer == "maghrib":
                # Same idea for the Ramadan Iftar reminder/auto-dua below.
                maghrib_target_for_ramadan = target
            if prayer == "fajr":
                # Same idea for the Ramadan Fajr wake-up alarm below —
                # note this means the alarm requires Fajr itself to be
                # enabled (the `if not _is_enabled` check above already
                # skipped this prayer otherwise), same dependency Jumu'ah
                # already has on Dhuhr.
                fajr_target_for_ramadan = target
            if target <= now:
                continue

            unsub = async_track_point_in_time(
                self.hass,
                self._async_make_handler(prayer),
                target,
            )
            self._unsub_triggers.append(unsub)
            planned += 1
            _LOGGER.info("Scheduled adhan for %s at %s", prayer, target)

            # 2.0.38 — per-prayer pre-adhan suppression. Default True
            # for backward compat (key missing = enabled). Lets the
            # user skip pre-reminders for individual prayers (e.g.
            # Fajr) without disabling the whole feature.
            pre_enabled = options.get(
                f"{OPT_PRE_ADHAN_ENABLED_PREFIX}{prayer}", True
            )

            if pre_enabled and pre_min_1 > 0:
                self._maybe_schedule_pre_reminder(
                    prayer, target, now, pre_min_1, slot=1,
                )

            if pre_enabled and two_enabled and pre_min_2 > 0:
                self._maybe_schedule_pre_reminder(
                    prayer, target, now, pre_min_2, slot=2,
                )

            if notify_enabled and _notify_enabled_for_prayer(options, prayer):
                self._maybe_schedule_notify(prayer, target, now, options)

        if now.weekday() == _FRIDAY and dhuhr_target_for_jumuah is not None:
            self._maybe_schedule_jumuah(dhuhr_target_for_jumuah, now, options)

        if is_ramadan:
            imsak_str = timings.get("Imsak")
            imsak_target = _parse_today_time(imsak_str, now)
            if imsak_target is not None:
                offset = int(options.get(OPT_IMSAK_OFFSET_MIN, DEFAULT_IMSAK_OFFSET_MIN) or 0)
                imsak_target = imsak_target - timedelta(minutes=max(0, offset))
                self._maybe_schedule_suhoor(imsak_target, now, options)
            if maghrib_target_for_ramadan is not None:
                self._maybe_schedule_iftar(maghrib_target_for_ramadan, now, options)
                self._maybe_schedule_iftar_dua(maghrib_target_for_ramadan, now, options)
            if fajr_target_for_ramadan is not None:
                self._maybe_schedule_fajr_alarm(fajr_target_for_ramadan, now, options)

        self._maybe_schedule_calendar_check(now, options)

        _LOGGER.debug("Scheduler: planned %d adhan trigger(s)", planned)

    def _maybe_schedule_suhoor(self, imsak_target, now, options) -> None:
        """Suhoor reminder — fires N minutes before the (offset-adjusted)
        Imsak time, Ramadan only. Same shape as the Jumu'ah reminder:
        reuses the general notify_targets list, persistent_notification
        fallback when empty.
        """
        if not bool(options.get(OPT_SUHOOR_REMINDER_ENABLED, False)):
            return
        minutes = int(
            options.get(OPT_SUHOOR_REMINDER_MINUTES, DEFAULT_SUHOOR_REMINDER_MINUTES) or 0
        )
        minutes = max(SUHOOR_REMINDER_MINUTES_MIN, min(SUHOOR_REMINDER_MINUTES_MAX, minutes))
        suhoor_target = imsak_target - timedelta(minutes=minutes)
        if suhoor_target <= now:
            return
        targets = list(options.get(OPT_NOTIFY_TARGETS) or [])
        title = options.get(OPT_NOTIFY_TITLE) or DEFAULT_NOTIFY_TITLE_FALLBACK
        message_tpl = (
            options.get(OPT_SUHOOR_REMINDER_MESSAGE)
            or DEFAULT_SUHOOR_REMINDER_MESSAGE_FALLBACK
        )
        unsub = async_track_point_in_time(
            self.hass,
            self._async_make_suhoor_handler(minutes, targets, title, message_tpl),
            suhoor_target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info(
            "Scheduled suhoor reminder at %s (%d min before Imsak) to %s",
            suhoor_target, minutes, targets or "persistent_notification (no targets)",
        )

    def _maybe_schedule_iftar(self, maghrib_target, now, options) -> None:
        """Iftar countdown reminder — fires N minutes before Maghrib,
        Ramadan only. Same shape as the suhoor reminder above.
        """
        if not bool(options.get(OPT_IFTAR_REMINDER_ENABLED, False)):
            return
        minutes = int(
            options.get(OPT_IFTAR_REMINDER_MINUTES, DEFAULT_IFTAR_REMINDER_MINUTES) or 0
        )
        minutes = max(IFTAR_REMINDER_MINUTES_MIN, min(IFTAR_REMINDER_MINUTES_MAX, minutes))
        iftar_target = maghrib_target - timedelta(minutes=minutes)
        if iftar_target <= now:
            return
        targets = list(options.get(OPT_NOTIFY_TARGETS) or [])
        title = options.get(OPT_NOTIFY_TITLE) or DEFAULT_NOTIFY_TITLE_FALLBACK
        message_tpl = (
            options.get(OPT_IFTAR_REMINDER_MESSAGE)
            or DEFAULT_IFTAR_REMINDER_MESSAGE_FALLBACK
        )
        unsub = async_track_point_in_time(
            self.hass,
            self._async_make_iftar_handler(minutes, targets, title, message_tpl),
            iftar_target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info(
            "Scheduled Iftar reminder at %s (%d min before Maghrib) to %s",
            iftar_target, minutes, targets or "persistent_notification (no targets)",
        )

    def _maybe_schedule_iftar_dua(self, maghrib_target, now, options) -> None:
        """Optional auto-played dua AT Maghrib during Ramadan. A separate
        trigger from the real adhan one (both fire at the same target
        time) — calls nida.play_dua exactly like the dua's own "Use"
        button would, so it plays on the dua's own configured player.
        """
        if not bool(options.get(OPT_IFTAR_DUA_ENABLED, False)):
            return
        dua_id = options.get(OPT_IFTAR_DUA_ID)
        if not dua_id:
            return
        if maghrib_target <= now:
            return
        unsub = async_track_point_in_time(
            self.hass,
            self._async_make_iftar_dua_handler(dua_id),
            maghrib_target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info("Scheduled Iftar auto-dua %s at %s", dua_id, maghrib_target)

    def _maybe_schedule_fajr_alarm(self, fajr_target, now, options) -> None:
        """Fajr wake-up alarm (2.1.35), Ramadan only. Plants up to two
        independent triggers — see this file's changelog for the full
        design. Scene and sound are each optional; if neither is
        configured, nothing is scheduled even when the toggle is on.
        """
        if not bool(options.get(OPT_FAJR_ALARM_ENABLED, DEFAULT_FAJR_ALARM_ENABLED)):
            return
        minutes = int(
            options.get(OPT_FAJR_ALARM_MINUTES, DEFAULT_FAJR_ALARM_MINUTES) or 0
        )
        minutes = max(FAJR_ALARM_MINUTES_MIN, min(FAJR_ALARM_MINUTES_MAX, minutes))
        wake_target = fajr_target - timedelta(minutes=minutes)
        if wake_target <= now:
            return

        scene = options.get(OPT_FAJR_ALARM_SCENE) or None
        transition_minutes = int(
            options.get(
                OPT_FAJR_ALARM_TRANSITION_MINUTES, DEFAULT_FAJR_ALARM_TRANSITION_MINUTES
            ) or 0
        )
        transition_minutes = max(
            FAJR_ALARM_TRANSITION_MINUTES_MIN,
            min(FAJR_ALARM_TRANSITION_MINUTES_MAX, transition_minutes),
        )
        sound_mode = options.get(OPT_FAJR_ALARM_SOUND_MODE, DEFAULT_FAJR_ALARM_SOUND_MODE)
        sound_rel = options.get(OPT_FAJR_ALARM_SOUND) or None
        player = options.get(OPT_FAJR_ALARM_MEDIA_PLAYER) or None
        try:
            volume = int(options.get(OPT_FAJR_ALARM_VOLUME, DEFAULT_FAJR_ALARM_VOLUME))
        except (TypeError, ValueError):
            volume = DEFAULT_FAJR_ALARM_VOLUME
        volume = max(0, min(100, volume))
        sound_ready = bool(sound_rel and player)
        play_sound_at_wake = sound_ready and sound_mode != FAJR_ALARM_SOUND_MODE_DELAYED

        if scene or play_sound_at_wake:
            unsub = async_track_point_in_time(
                self.hass,
                self._async_make_fajr_alarm_handler(
                    scene=scene,
                    transition_minutes=transition_minutes,
                    sound_rel=sound_rel if play_sound_at_wake else None,
                    player=player if play_sound_at_wake else None,
                    volume=volume,
                ),
                wake_target,
            )
            self._unsub_triggers.append(unsub)
            _LOGGER.info(
                "Scheduled Fajr wake-up alarm at %s (%d min before Fajr), scene=%s sound_now=%s",
                wake_target, minutes, scene, play_sound_at_wake,
            )

        if sound_ready and sound_mode == FAJR_ALARM_SOUND_MODE_DELAYED:
            sound_target = wake_target + timedelta(minutes=transition_minutes)
            if sound_target > now:
                unsub2 = async_track_point_in_time(
                    self.hass,
                    self._async_make_fajr_alarm_sound_handler(sound_rel, player, volume),
                    sound_target,
                )
                self._unsub_triggers.append(unsub2)
                _LOGGER.info(
                    "Scheduled Fajr wake-up alarm delayed sound at %s (%d min after wake)",
                    sound_target, transition_minutes,
                )

    def _maybe_schedule_pre_reminder(
        self, prayer: str, adhan_target, now, minutes: int, slot: int
    ) -> None:
        pre_target = adhan_target - timedelta(minutes=minutes)
        if pre_target <= now:
            return
        unsub = async_track_point_in_time(
            self.hass,
            self._async_make_pre_handler(prayer, minutes, slot),
            pre_target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info(
            "Scheduled pre-adhan reminder slot %d for %s at %s (%d min before)",
            slot, prayer, pre_target, minutes,
        )

    def _maybe_schedule_notify(
        self, prayer: str, adhan_target, now, options
    ) -> None:
        targets = list(options.get(OPT_NOTIFY_TARGETS) or [])
        if not targets:
            _LOGGER.debug(
                "Notify enabled but no targets configured; skipping %s notify",
                prayer,
            )
            return
        title = options.get(OPT_NOTIFY_TITLE) or DEFAULT_NOTIFY_TITLE_FALLBACK
        message_tpl = (
            options.get(OPT_NOTIFY_MESSAGE) or DEFAULT_NOTIFY_MESSAGE_FALLBACK
        )
        # 2.0.90 — per-prayer, corrects 2.0.89's single master flag.
        critical = bool(
            options.get(f"{OPT_NOTIFY_CRITICAL_ENABLED_PREFIX}{prayer}", False)
        )
        # 2.0.95 — targets flagged for the Samsung TTS/alarm-stream
        # workaround; only meaningful when critical is also on.
        tts_workaround_targets = set(
            options.get(OPT_NOTIFY_TTS_WORKAROUND_TARGETS) or []
        )
        unsub = async_track_point_in_time(
            self.hass,
            self._async_make_notify_handler(
                prayer, targets, title, message_tpl, critical,
                tts_workaround_targets,
            ),
            adhan_target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info(
            "Scheduled notify for %s at %s to %s (critical=%s)",
            prayer, adhan_target, targets, critical,
        )

    def _maybe_schedule_jumuah(self, dhuhr_target, now, options) -> None:
        """Plant the Friday Jumu'ah reminder N minutes before Dhuhr."""
        if not bool(options.get(OPT_JUMUAH_REMINDER_ENABLED, True)):
            return
        minutes = int(
            options.get(OPT_JUMUAH_REMINDER_MINUTES, DEFAULT_JUMUAH_MINUTES) or 0
        )
        minutes = max(JUMUAH_MIN_MINUTES, min(JUMUAH_MAX_MINUTES, minutes))
        jumuah_target = dhuhr_target - timedelta(minutes=minutes)
        if jumuah_target <= now:
            return
        # Separate targets list for Jumu'ah — not everyone in the
        # household needs this Friday-only reminder. Empty list falls
        # back to persistent_notification (see jumuah handler below).
        targets = list(options.get(OPT_JUMUAH_TARGETS) or [])
        title = options.get(OPT_NOTIFY_TITLE) or DEFAULT_NOTIFY_TITLE_FALLBACK
        message_tpl = (
            options.get(OPT_JUMUAH_MESSAGE) or DEFAULT_JUMUAH_MESSAGE_FALLBACK
        )
        unsub = async_track_point_in_time(
            self.hass,
            self._async_make_jumuah_handler(minutes, targets, title, message_tpl),
            jumuah_target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info(
            "Scheduled Jumu'ah reminder at %s (%d min before Dhuhr) to %s",
            jumuah_target, minutes, targets or "persistent_notification (no targets)",
        )

    def _maybe_schedule_calendar_check(self, now, options) -> None:
        """Plant one daily trigger at calendar_fire_time for the Islamic
        Calendar reminders (Holidays/Ashura-Arafah/White Days/Weekly
        Sunnah — see const.py's OPT_CALENDAR_* section). Re-planned on
        every reschedule same as everything else in this method, so a
        changed fire time or a newly-toggled reminder type takes effect
        immediately via _async_update_listener's "nudge the scheduler"
        (see __init__.py) instead of waiting for the next 12-hour cycle.

        Unlike the adhan/pre-adhan/notify triggers above, this one can't
        resolve its actual content (which dates match) at schedule time —
        that needs an async Aladhan lookup, and this method runs inside a
        @callback. So it only computes WHEN to fire; the handler itself
        (_async_calendar_check_handler) does the lookup and the four
        toggle checks when it actually fires.
        """
        any_enabled = any(
            [
                options.get(OPT_CALENDAR_HOLIDAYS_ENABLED, False),
                options.get(OPT_CALENDAR_ASHURA_ARAFAH_ENABLED, False),
                options.get(OPT_CALENDAR_WHITE_DAYS_ENABLED, False),
                options.get(OPT_CALENDAR_WEEKLY_SUNNAH_ENABLED, False),
                # 2.1.34 — fifth type, Ramadan's Laylatul Qadr / last-10-nights.
                options.get(OPT_CALENDAR_LAYLATUL_QADR_ENABLED, False),
            ]
        )
        if not any_enabled:
            return
        fire_time_str = options.get(OPT_CALENDAR_FIRE_TIME, DEFAULT_CALENDAR_FIRE_TIME)
        target = _parse_today_time(fire_time_str, now)
        if target is None or target <= now:
            return
        unsub = async_track_point_in_time(
            self.hass, self._async_calendar_check_handler, target,
        )
        self._unsub_triggers.append(unsub)
        _LOGGER.info("Scheduled Islamic Calendar check at %s", target)

    async def _async_calendar_check_handler(self, _now) -> None:
        try:
            await self._async_run_calendar_check()
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Islamic Calendar check failed: %s", err)

    async def _async_run_calendar_check(self) -> None:
        """The actual daily check — runs at calendar_fire_time. Looks up
        a CALENDAR_LEAD_DAYS_MAX-day Hijri window once (single Aladhan
        round trip, shared by all four reminder types) and matches it
        against each enabled type's fixed dates from const.py.
        """
        options = self.entry.options
        today = dt_util.now().date()
        lookahead_end = today + timedelta(days=CALENDAR_LEAD_DAYS_MAX)
        hijri_map = await async_lookup_hijri_range(
            self.hass, self.entry, today, lookahead_end
        )
        today_hijri = hijri_map.get(today)
        messages: list[str] = []

        if options.get(OPT_CALENDAR_HOLIDAYS_ENABLED, False):
            lead1 = int(
                options.get(OPT_CALENDAR_HOLIDAYS_LEAD_DAYS, DEFAULT_CALENDAR_HOLIDAYS_LEAD_DAYS)
                or 0
            )
            leads = {lead1}
            if bool(options.get(OPT_CALENDAR_HOLIDAYS_SECOND_ENABLED, False)):
                lead2 = int(
                    options.get(
                        OPT_CALENDAR_HOLIDAYS_SECOND_LEAD_DAYS,
                        DEFAULT_CALENDAR_HOLIDAYS_SECOND_LEAD_DAYS,
                    )
                    or 0
                )
                leads.add(lead2)
            for holiday in ISLAMIC_HOLIDAYS:
                for lead in leads:
                    check_date = today + timedelta(days=lead)
                    hijri = hijri_map.get(check_date)
                    if hijri is not None and hijri == (holiday["month"], holiday["day"]):
                        when = "today" if lead == 0 else f"in {lead} day{'s' if lead != 1 else ''}"
                        messages.append(f"{holiday['name']} is {when}")

        if options.get(OPT_CALENDAR_ASHURA_ARAFAH_ENABLED, False) and today_hijri is not None:
            for d in ASHURA_ARAFAH_DATES:
                if today_hijri == (d["month"], d["day"]):
                    messages.append(f"Today: {d['name']}")

        if (
            options.get(OPT_CALENDAR_WHITE_DAYS_ENABLED, False)
            and today_hijri is not None
            and today_hijri[1] in WHITE_DAYS
        ):
            messages.append("Today: White Days fasting (Ayyam al-Beed)")

        if (
            options.get(OPT_CALENDAR_WEEKLY_SUNNAH_ENABLED, False)
            and dt_util.now().weekday() in WEEKLY_SUNNAH_WEEKDAYS
        ):
            messages.append("Today: Weekly Sunnah fasting")

        if options.get(OPT_CALENDAR_LAYLATUL_QADR_ENABLED, False) and today_hijri is not None:
            for lq in LAYLATUL_QADR_DATES:
                if today_hijri == (lq["month"], lq["day"]):
                    messages.append(f"Tonight: {lq['name']}")

        if not messages:
            _LOGGER.debug("Islamic Calendar check: nothing matches today")
            return

        targets = list(options.get(OPT_CALENDAR_NOTIFY_TARGETS) or [])
        title = "🕌 Nida — Islamic Calendar"
        message = "\n".join(messages)
        # _async_make_calendar_handler returns a _fire(_now) closure meant
        # for async_track_point_in_time — its argument is unused (message
        # is already fully resolved above), so it's fine to invoke it
        # directly here with no real "now" to pass.
        send = self._async_make_calendar_handler(targets, title, message)
        await send(None)

    def _async_make_handler(self, prayer: str):
        async def _fire(_now) -> None:
            _LOGGER.info("Firing scheduled adhan for %s", prayer)
            try:
                await self.hass.services.async_call(
                    DOMAIN,
                    SERVICE_PLAY_ADHAN,
                    {"prayer": prayer},
                    blocking=False,
                )
            except Exception as err:  # noqa: BLE001
                _LOGGER.error("Failed to play adhan for %s: %s", prayer, err)
        return _fire

    def _async_make_pre_handler(self, prayer: str, minutes: int, slot: int):
        nid_suffix = "" if slot == 1 else str(slot)

        async def _fire(_now) -> None:
            _LOGGER.info(
                "Firing pre-adhan notification slot %d for %s", slot, prayer
            )
            # Read the audio + TTS toggles up front so we know whether
            # the persistent_notification is needed at all.
            audio_enabled = bool(
                self.entry.options.get(
                    OPT_PRE_ADHAN_AUDIO_ENABLED, DEFAULT_PRE_ADHAN_AUDIO_ENABLED
                )
            )
            tts_enabled = bool(
                self.entry.options.get(OPT_TTS_PRE_ADHAN_ENABLED, False)
            )

            # 2.0.34 — persistent_notification is now a TRUE fallback:
            # only fire it if neither the jingle nor the TTS will speak.
            # Previously it fired unconditionally and cluttered the HA
            # notification center for users who'd already configured
            # audible reminders. Users who want both the audible cue
            # AND an HA-internal notification can build an automation
            # off the nida.play_pre_adhan_jingle service call.
            if not audio_enabled and not tts_enabled:
                persistent_notification.async_create(
                    self.hass,
                    f"**{prayer.capitalize()}** is in {minutes} minutes.",
                    title="Nida",
                    notification_id=f"nida_pre{nid_suffix}_{prayer}",
                )

            if audio_enabled:
                try:
                    await self.hass.services.async_call(
                        DOMAIN,
                        SERVICE_PLAY_PRE_ADHAN_JINGLE,
                        {},
                        blocking=False,
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "play_pre_adhan_jingle failed for %s slot %d: %s",
                        prayer, slot, err,
                    )

            # TTS announcement after the jingle (2.0.32). Gated on
            # tts_pre_adhan_enabled; fires regardless of audio_enabled
            # because someone might disable the jingle but still want
            # the spoken cue. Delay defaults to 5s — enough for the
            # typical jingle (<3s) to finish before the speaker
            # switches to TTS playback.
            if tts_enabled:
                try:
                    delay = int(self.entry.options.get(
                        OPT_TTS_PRE_ADHAN_DELAY, DEFAULT_TTS_PRE_ADHAN_DELAY
                    ))
                except (TypeError, ValueError):
                    delay = DEFAULT_TTS_PRE_ADHAN_DELAY
                delay = max(0, min(60, delay))
                if delay:
                    await asyncio.sleep(delay)
                try:
                    await self.hass.services.async_call(
                        DOMAIN,
                        SERVICE_SPEAK_PRE_ADHAN,
                        {"prayer": prayer},
                        blocking=False,
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "speak_pre_adhan failed for %s slot %d: %s",
                        prayer, slot, err,
                    )
        return _fire

    def _async_make_notify_handler(
        self,
        prayer: str,
        targets: list[str],
        title: str,
        message_tpl: str,
        critical: bool = False,
        tts_workaround_targets: set[str] | None = None,
    ):
        async def _fire(_now) -> None:
            message = message_tpl.replace("[prayer]", prayer.capitalize())
            # 2.1.29 — only bother resolving the adhan sound + its real
            # duration if an Android TV target is actually present; the
            # file read (even cached) and catalog lookup are wasted work
            # for anyone without one. Resolved ONCE per fire, outside the
            # per-target loop, since it's the same value for every target.
            tv_duration: int | None = None
            if any(_is_android_tv_target(self.hass, t) for t in targets):
                try:
                    options = dict(self.entry.options)
                    sound_rel = await async_resolve_adhan_sound_rel(
                        self.hass, options, prayer
                    )
                    tv_duration = await async_sound_duration_seconds(
                        self.hass, sound_rel
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "Could not resolve adhan duration for TV notify (%s): %s",
                        prayer, err,
                    )
            for target in targets:
                try:
                    domain, service = target.split(".", 1)
                except ValueError:
                    _LOGGER.warning("Invalid notify target %r; skipping", target)
                    continue
                # 2.0.95 — payload now forks per target (TTS/alarm-stream
                # workaround vs. the normal critical/plain payload), so
                # it's built inside the loop instead of once for all
                # targets.
                service_data = _notify_service_data_for_target(
                    self.hass, target, title, message, critical, tts_workaround_targets,
                    tv_duration=tv_duration, options=self.entry.options,
                )
                try:
                    await self.hass.services.async_call(
                        domain,
                        service,
                        service_data,
                        blocking=False,
                    )
                    _LOGGER.info(
                        "Sent notify to %s for %s (critical=%s, tts_workaround=%s)",
                        target, prayer, critical,
                        bool(tts_workaround_targets and target in tts_workaround_targets),
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "notify call failed for %s on %s: %s",
                        prayer, target, err,
                    )
        return _fire

    def _async_make_jumuah_handler(
        self, minutes: int, targets: list[str], title: str, message_tpl: str
    ):
        async def _fire(_now) -> None:
            message = message_tpl.replace("[minutes]", str(minutes))
            if not targets:
                _LOGGER.info("Jumu'ah reminder (no targets) → persistent_notification")
                persistent_notification.async_create(
                    self.hass,
                    message,
                    title=title,
                    notification_id="nida_jumuah",
                )
                return
            for target in targets:
                try:
                    domain, service = target.split(".", 1)
                except ValueError:
                    _LOGGER.warning("Invalid notify target %r; skipping", target)
                    continue
                service_data = _notify_service_data_for_target(
                    self.hass, target, title, message, critical=False,
                    options=self.entry.options,
                )
                try:
                    await self.hass.services.async_call(
                        domain,
                        service,
                        service_data,
                        blocking=False,
                    )
                    _LOGGER.info("Sent Jumu'ah reminder to %s", target)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "Jumu'ah notify call failed on %s: %s", target, err
                    )
        return _fire

    def _async_make_suhoor_handler(
        self, minutes: int, targets: list[str], title: str, message_tpl: str
    ):
        # Identical shape to _async_make_jumuah_handler above — same
        # persistent_notification fallback + per-target try/except.
        async def _fire(_now) -> None:
            message = message_tpl.replace("[minutes]", str(minutes))
            if not targets:
                _LOGGER.info("Suhoor reminder (no targets) → persistent_notification")
                persistent_notification.async_create(
                    self.hass,
                    message,
                    title=title,
                    notification_id="nida_suhoor",
                )
                return
            for target in targets:
                try:
                    domain, service = target.split(".", 1)
                except ValueError:
                    _LOGGER.warning("Invalid notify target %r; skipping", target)
                    continue
                service_data = _notify_service_data_for_target(
                    self.hass, target, title, message, critical=False,
                    options=self.entry.options,
                )
                try:
                    await self.hass.services.async_call(
                        domain, service, service_data, blocking=False,
                    )
                    _LOGGER.info("Sent suhoor reminder to %s", target)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "Suhoor notify call failed on %s: %s", target, err
                    )
        return _fire

    def _async_make_iftar_handler(
        self, minutes: int, targets: list[str], title: str, message_tpl: str
    ):
        async def _fire(_now) -> None:
            message = message_tpl.replace("[minutes]", str(minutes))
            if not targets:
                _LOGGER.info("Iftar reminder (no targets) → persistent_notification")
                persistent_notification.async_create(
                    self.hass,
                    message,
                    title=title,
                    notification_id="nida_iftar",
                )
                return
            for target in targets:
                try:
                    domain, service = target.split(".", 1)
                except ValueError:
                    _LOGGER.warning("Invalid notify target %r; skipping", target)
                    continue
                service_data = _notify_service_data_for_target(
                    self.hass, target, title, message, critical=False,
                    options=self.entry.options,
                )
                try:
                    await self.hass.services.async_call(
                        domain, service, service_data, blocking=False,
                    )
                    _LOGGER.info("Sent Iftar reminder to %s", target)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "Iftar notify call failed on %s: %s", target, err
                    )
        return _fire

    def _async_make_iftar_dua_handler(self, dua_id: str):
        async def _fire(_now) -> None:
            options = self.entry.options
            # 2.1.34 — this is an AUTOMATED trigger (unlike the dua's own
            # manual "Use" button, which deliberately bypasses guest mode),
            # so it should respect it like play_adhan does.
            if bool(options.get(OPT_GUEST_MODE_ENABLED)):
                until_raw = options.get(OPT_GUEST_MODE_UNTIL)
                still_active = True
                if until_raw:
                    until = dt_util.parse_datetime(str(until_raw))
                    if until is not None:
                        still_active = dt_util.utcnow() < dt_util.as_utc(until)
                if still_active:
                    _LOGGER.info(
                        "Guest mode active — skipping Iftar auto-dua %s", dua_id
                    )
                    return
            try:
                await self.hass.services.async_call(
                    DOMAIN,
                    SERVICE_PLAY_DUA,
                    {"dua_id": dua_id},
                    blocking=False,
                )
                _LOGGER.info("Fired Iftar auto-dua %s", dua_id)
            except Exception as err:  # noqa: BLE001
                _LOGGER.warning("Iftar auto-dua %s failed: %s", dua_id, err)
        return _fire

    def _guest_mode_active_now(self) -> bool:
        """Same lazy-expiry guest-mode check as the Iftar auto-dua handler
        above, factored out here since the Fajr wake-up alarm needs it in
        TWO places (the wake trigger and, separately, the delayed-sound
        trigger — sound_mode="delayed" plants them as independent
        async_track_point_in_time calls, so a single inline check at
        schedule time wouldn't cover the delayed one if guest mode gets
        toggled on in between)."""
        options = self.entry.options
        if not bool(options.get(OPT_GUEST_MODE_ENABLED)):
            return False
        until_raw = options.get(OPT_GUEST_MODE_UNTIL)
        if not until_raw:
            return True
        until = dt_util.parse_datetime(str(until_raw))
        if until is None:
            return True
        return dt_util.utcnow() < dt_util.as_utc(until)

    def _async_make_fajr_alarm_handler(
        self, scene, transition_minutes: int, sound_rel, player, volume: int
    ):
        # 2.1.35 — an AUTOMATED trigger like the Iftar auto-dua, so it
        # respects guest mode (waking a guest up for suhoor they may not
        # be observing would be exactly the kind of disruption guest mode
        # exists to prevent) even though this is light+sound, not just
        # sound.
        async def _fire(_now) -> None:
            if self._guest_mode_active_now():
                _LOGGER.info("Guest mode active — skipping Fajr wake-up alarm")
                return
            if scene:
                try:
                    await self.hass.services.async_call(
                        "scene",
                        "turn_on",
                        {"entity_id": scene, "transition": transition_minutes * 60},
                        blocking=False,
                    )
                    _LOGGER.info(
                        "Fired Fajr wake-up alarm scene %s (transition %ds)",
                        scene, transition_minutes * 60,
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "Fajr wake-up alarm scene %s failed: %s", scene, err
                    )
            if sound_rel and player:
                await self._async_play_fajr_alarm_sound(sound_rel, player, volume)
        return _fire

    def _async_make_fajr_alarm_sound_handler(self, sound_rel, player, volume: int):
        # Delayed-sound branch (sound_mode="delayed") — a separate trigger
        # from the scene one above, planted at wake_target +
        # transition_minutes, so it needs its own guest-mode check.
        async def _fire(_now) -> None:
            if self._guest_mode_active_now():
                _LOGGER.info(
                    "Guest mode active — skipping Fajr wake-up alarm delayed sound"
                )
                return
            await self._async_play_fajr_alarm_sound(sound_rel, player, volume)
        return _fire

    async def _async_play_fajr_alarm_sound(self, sound_rel: str, player: str, volume: int) -> None:
        # Same volume_set-then-play_media sequence as services.py's
        # _set_volume_safe/_play_media_safe (re-implemented inline rather
        # than importing those private functions — see this file's
        # changelog). volume_set is awaited (blocking=True) first so the
        # sound never briefly plays at whatever level the player happened
        # to be at, same rationale as the duck-media restore sequence.
        players = [player]
        try:
            await self.hass.services.async_call(
                "media_player",
                "volume_set",
                {"entity_id": players, "volume_level": volume / 100.0},
                blocking=True,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "Fajr wake-up alarm volume_set failed on %s: %s", player, err
            )
        media_url = f"/local/nida/sounds/{sound_rel}"
        try:
            await self.hass.services.async_call(
                "media_player",
                "play_media",
                {
                    "entity_id": players,
                    "media_content_id": media_url,
                    "media_content_type": "music",
                },
                blocking=False,
            )
            _LOGGER.info(
                "Playing Fajr wake-up alarm sound on %s: %s", player, media_url
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "Fajr wake-up alarm play_media failed on %s: %s", player, err
            )

    def _async_make_calendar_handler(self, targets: list[str], title: str, message: str):
        # Same shape as _async_make_jumuah_handler (persistent_notification
        # fallback when no targets configured, per-target try/except so one
        # bad target doesn't block the rest) — message is already fully
        # resolved by the caller (_async_run_calendar_check), no template
        # placeholders here since a calendar check can report more than one
        # matching occasion on the same day.
        async def _fire(_now) -> None:
            if not targets:
                _LOGGER.info("Islamic Calendar reminder (no targets) → persistent_notification")
                persistent_notification.async_create(
                    self.hass,
                    message,
                    title=title,
                    notification_id=f"nida_calendar_{dt_util.now().date().isoformat()}",
                )
                return
            for target in targets:
                try:
                    domain, service = target.split(".", 1)
                except ValueError:
                    _LOGGER.warning("Invalid notify target %r; skipping", target)
                    continue
                service_data = _notify_service_data_for_target(
                    self.hass, target, title, message, critical=False,
                    options=self.entry.options,
                )
                try:
                    await self.hass.services.async_call(
                        domain,
                        service,
                        service_data,
                        blocking=False,
                    )
                    _LOGGER.info("Sent Islamic Calendar reminder to %s", target)
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "Islamic Calendar notify call failed on %s: %s", target, err
                    )
        return _fire


def _critical_notify_data() -> dict:
    """Extra `data` for a mobile_app notify call to request a
    critical/urgent alert.

    2.0.89. We deliberately send BOTH the iOS and the Android keys on
    every call rather than trying to detect the target's platform from
    its service name (device names are user-chosen and not a reliable
    signal, e.g. "notify.mobile_app_iphone_johann" happens to say
    "iphone" but nothing guarantees that). The HA companion apps ignore
    keys meant for the other platform, so this is safe to send
    unconditionally to any notify.mobile_app_* target.

    iOS: interruption-level "critical" + push.sound.critical=1 is the
    documented way to ask for a critical alert — but it only actually
    bypasses silent mode / Focus if the app has Apple's critical-alert
    entitlement. The stock Home Assistant Companion app does NOT ship
    with that entitlement for arbitrary users; it has to be requested
    from Apple and only works for HA Cloud subscribers who've had it
    granted, or a self-built app with the entitlement added. Without
    it, iOS quietly delivers a normal high-priority notification
    instead of erroring — there is no way for us to detect that from
    here. Recommend Johann/users verify with the panel's test button on
    an actual muted phone before relying on this.

    Android: importance/priority "high" plus ttl 0 (deliver
    immediately, don't batch) requests the notification be shown
    heads-up and promptly. Whether it actually breaks through Do Not
    Disturb depends on the notification channel's importance as set on
    the device (Android, not the app, owns DND exceptions per channel)
    — same caveat as iOS, this is a request, not a guarantee.

    2.0.93 — Android also needs an explicit `channel` key. Importance
    is a channel-level property, fixed the first time the channel is
    created; a bare "importance": "high" on a notification routed to an
    already-existing channel (e.g. the app's default one, likely
    created earlier at normal importance) is silently ignored.
    SUPERSEDED by 2.0.94 below — a custom channel name only fixes
    heads-up/importance, not silent-mode bypass.

    2.0.94 — `channel: "alarm_stream"` is the actual fix for ringing
    through the silent switch / DND, per the Companion app docs
    (Notifications > Critical notifications > Android Alarm Stream).
    It is a reserved value, not a display name: Android routes the
    notification's sound over the alarm audio stream instead of the
    notification stream, and the alarm stream is the one stream that
    isn't muted by ringer-silent. A custom channel name (2.0.93's
    "Nida Critical Alerts") never did this — it only requested high
    importance/heads-up delivery on an otherwise normal channel, which
    still obeys the silent switch. Known caveat: some Samsung firmware
    blocks third-party apps from using the alarm stream for regular
    notifications outright; if sound still doesn't play on a Samsung
    device after this, that's an OEM-level block, not something we can
    route around from the integration. If even stronger delivery is
    needed later, the Companion app also supports a TTS variant
    (`media_stream: alarm_stream_max` + `tts_text`) that speaks the
    message at max alarm volume — worth trying if plain sound still
    isn't audible on a given device.
    """
    return {
        "push": {
            "sound": {"name": "default", "critical": 1, "volume": 1.0},
        },
        "interruption-level": "critical",
        "channel": "alarm_stream",
        "importance": "high",
        "priority": "high",
        "ttl": 0,
    }


def _tts_critical_notify_data(message: str) -> dict:
    """Full service_data for a spoken (TTS) critical alert, for targets
    the user has explicitly flagged as needing the Samsung silent-mode
    workaround (options.notify_tts_workaround_targets, const.py).

    2.0.95. `channel: "alarm_stream"` (2.0.94) is the documented Android
    fix for ringing through silent/DND, but several Samsung devices
    (confirmed here on a Galaxy Z Flip 7; also reported on S20/S21/S23/
    S24 and SM-G991U/SM-S918B in github.com/home-assistant/android
    issues #1159 and #1465) simply ignore it. Per a Home Assistant
    maintainer in that thread, this is a deliberate Samsung/OneUI
    restriction that blocks apps from overriding a regular
    notification's audio attributes at all — not something any
    channel/importance/priority combination on a NORMAL notification can
    route around from our side.

    The one approach Samsung users in those threads consistently report
    as actually working: don't send a normal notification at all — send
    a TTS (text-to-speech) notification, which the Companion app plays
    through the alarm audio stream via its own code path, separate from
    normal notification sound handling. Hence `message: "TTS"` (a
    literal, reserved value the Companion app checks for, not the
    visible text) and the real text goes in `data.tts_text`.
    `media_stream: alarm_stream_max` additionally forces the alarm
    stream to full volume for the duration of playback, then restores
    it — matters because a device with a low/zero alarm volume will
    still be silent even with this fix (several reports in the same
    threads); reproduces even for a genuine alarm-clock app on the same
    hardware, so it isn't something we can control from here either.

    This is why it's a distinct function returning the FULL
    service_data, not just a nested `data` dict like
    _critical_notify_data: TTS mode has a different top-level shape
    (no `title`; `message` itself carries the "TTS" marker instead of
    real text).
    """
    return {
        "message": "TTS",
        "data": {
            "tts_text": message,
            "media_stream": "alarm_stream_max",
            "ttl": 0,
            "priority": "high",
        },
    }


def _is_android_tv_target(hass: HomeAssistant, target: str) -> bool:
    """True if `target` (a full "notify.<service>" string) is a
    Notifications for Android TV / Fire TV entity (domain nfandroidtv).

    nfandroidtv registers a real notify PLATFORM ENTITY (unlike
    mobile_app's legacy non-entity notify service), so its entity_id is
    identical to the service name — a direct entity-registry lookup is
    enough, no slugify/name-matching needed. Same check websocket.py's
    _nfandroidtv_info does for the panel's "Android TV" badge; duplicated
    here rather than imported to avoid a module-load cycle (websocket.py
    already imports FROM this module locally for the same reason — see
    _dispatch_notify).
    """
    entry = er.async_get(hass).async_get(target)
    return entry is not None and entry.platform == "nfandroidtv"


def _notify_service_data_for_target(
    hass: HomeAssistant,
    target: str,
    title: str,
    message: str,
    critical: bool,
    tts_workaround_targets: set[str] | None = None,
    tv_duration: int | None = None,
    options: dict | None = None,
) -> dict:
    """Build the exact hass.services.async_call payload for ONE notify
    target, forking for the per-target TTS/alarm-stream workaround
    (2.0.95) and for Android TV overlay positioning (2.1.24). Shared by
    the scheduler's real adhan-time/Jumu'ah/Islamic-Calendar firing and
    websocket.py's ws_test_notify / _dispatch_notify, so a test genuinely
    previews what fires for real — see _critical_notify_data /
    _tts_critical_notify_data above for the full platform caveats.

    tv_duration (2.1.29): the real adhan sound's length in seconds, when
    the caller was able to resolve it (see _async_make_notify_handler) —
    Johann wanted the TV overlay to stay up for the whole adhan instead
    of a fixed few seconds. Callers that don't know/care (Jumu'ah,
    Islamic Calendar, ws_test_notify) simply omit it and get the old
    fixed fallback.
    """
    if critical and tts_workaround_targets and target in tts_workaround_targets:
        return _tts_critical_notify_data(message)
    service_data = {"title": title, "message": message}
    if critical:
        service_data["data"] = _critical_notify_data()
    if _is_android_tv_target(hass, target):
        # 2.1.24/2.1.25 — Johann: the default bottom-right position + grey
        # tile were too easy to miss. top-right stands out more without
        # covering the subtitles/playback-chrome most apps keep along the
        # bottom edge; green (vs. the grey default) adds a second visual
        # cue. nfandroidtv's other tunables (fontsize, transparency,
        # interrupt) are available the same way if this still isn't
        # noticeable enough.
        tv_data = service_data.setdefault("data", {})
        tv_data["position"] = "top-right"
        tv_data["color"] = "green"
        tv_data["duration"] = tv_duration if tv_duration else 5
        # An Android TV overlay has no icon or notification stack, so the
        # branding keys below would just be noise there.
        return service_data
    _apply_notify_branding(service_data, options, critical)
    return service_data


def _apply_notify_branding(
    service_data: dict, options: dict | None, critical: bool = False
) -> None:
    """Split Nida's notifications out of the Home Assistant pile, and
    label them as Nida's (2.3.12/2.3.13).

    Johann, on the first attempt: "waar het mij om gaat is dat ze niet
    stapelen onder Home Assistant, je ziet gewoon geen onderscheid." That
    is the real problem, and it is a GROUPING problem, not an icon one —
    both platforms bundle by app, so every Nida notification lands on the
    same stack as every other automation's. Two keys fix it, one per
    platform: push.thread-id on iOS, data.group on Android. Those two do
    the actual work here; the icon below is the finishing touch.

    Both platforms' keys are sent on every call. That mirrors what
    _critical_notify_data already does and is safe for the same reason:
    each Companion app ignores the other's keys, and the notify service
    name is not a reliable way to tell an iPhone from an Android phone.

    On the icon specifically: Android's notification_icon genuinely
    replaces the HA logo with an mdi glyph. iOS cannot be given a
    different app icon by anything we send — that belongs to the Home
    Assistant app itself — so there it gets an optional image attachment
    instead, off by default since it costs a fetch per notification.
    """
    options = options or {}
    data = service_data.setdefault("data", {})

    # ── the part that actually separates the stacks ──
    data["group"] = NOTIFY_GROUP                      # Android bundle
    push = data.setdefault("push", {})                # (may already exist
    push["thread-id"] = NOTIFY_THREAD_ID              #  from critical data)

    # Android channel: the source label under the app name, plus its own
    # entry in Android's notification settings. Skipped when critical,
    # which needs channel: "alarm_stream" to keep ringing through silent
    # mode — see NOTIFY_CHANNEL in const.py.
    if not critical:
        data["channel"] = NOTIFY_CHANNEL

    # ── the finishing touch ──
    icon = str(options.get(OPT_NOTIFY_ICON) or NOTIFY_ICON_DEFAULT).strip()
    if icon.startswith("mdi:"):
        data["notification_icon"] = icon
    color = str(options.get(OPT_NOTIFY_ICON_COLOR) or DEFAULT_NOTIFY_ICON_COLOR).strip()
    if color:
        data["color"] = color

    # ── the brand image, per platform ──
    # 2.3.15. Johann asked whether the bell on a live notification could
    # become the Nida logo. What that bell IS depends on the platform,
    # and so does whether it can be replaced at all:
    #
    #   ANDROID — the bell is the SMALL icon, which Android blows up to
    #   fill the circle whenever no large icon was sent. A small icon can
    #   only be a monochrome mdi path, so the logo cannot go there — but
    #   icon_url sets the LARGE icon from an image, which is that same
    #   circle, in full colour. There this genuinely replaces the bell.
    #
    #   iOS — the bell is the app icon, and nothing in a push payload can
    #   change it; only a Notification Service Extension inside the Home
    #   Assistant app itself could. The attachment below is the one lever
    #   we have: it puts the Nida logo on the notification as a thumbnail,
    #   BESIDE the app icon rather than instead of it. On by default,
    #   since iOS has nothing else to offer here.
    #
    # Both use a relative path: the Companion app resolves it against the
    # connection it is already authenticated on, so this works on the
    # internal and external URL without hardcoding either.
    if bool(options.get(
        OPT_NOTIFY_LARGE_ICON_ENABLED, DEFAULT_NOTIFY_LARGE_ICON_ENABLED
    )):
        data["icon_url"] = NOTIFY_LARGE_ICON_PATH
    if bool(options.get(
        OPT_NOTIFY_IOS_IMAGE_ENABLED, DEFAULT_NOTIFY_IOS_IMAGE_ENABLED
    )):
        data["attachment"] = {"url": NOTIFY_ICON_IMAGE_PATH, "content-type": "png"}


def _is_enabled(options: dict, prayer: str) -> bool:
    val = options.get(f"{OPT_ENABLED_PREFIX}{prayer}")
    return True if val is None else bool(val)


def _notify_enabled_for_prayer(options: dict, prayer: str) -> bool:
    val = options.get(f"{OPT_NOTIFY_ENABLED_PREFIX}{prayer}")
    return True if val is None else bool(val)


def _parse_today_time(time_str: str | None, ref: datetime) -> datetime | None:
    if not time_str:
        return None
    try:
        hh, mm = (int(x) for x in time_str.split(" ")[0].split(":"))
    except (ValueError, AttributeError):
        _LOGGER.debug("Unexpected time format from Aladhan: %s", time_str)
        return None
    return ref.replace(hour=hh, minute=mm, second=0, microsecond=0)


def _hijri_month_number(hijri: dict) -> int | None:
    """Extract the numeric Hijri month (1-12) from the "hijri" block
    already present in coordinator.data["data"]["date"] — same object
    sensor.py's HijriSensor reads, just pulling month.number instead of
    month.en. Used to gate the 2.1.34 Ramadan features on "is today
    within Ramadan" (HIJRI_MONTH_RAMADAN) without any extra API call.
    """
    try:
        return int(hijri.get("month", {}).get("number"))
    except (AttributeError, TypeError, ValueError):
        return None

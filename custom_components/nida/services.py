"""Nida services — user-facing service calls.

Changelog:
  2.3.5 (2026-07-30): Fixed music never coming back on Johann's setup —
                       the cause was upstream of everything 2.2.3/2.3.4
                       built. options.adhan_media_players held ONE entity,
                       media_player.adhan_speakers, and that is a Home
                       Assistant group helper fanning out to three Sonos
                       zones. Every check downstream was reading the
                       proxy: the group exposes no queue_size, so the
                       Sonos test failed and BOTH sonos.snapshot/restore
                       and the whole 2.3.4 announce path were skipped even
                       with announcements switched on; and the snapshot
                       captured one aggregate volume+state, so restore was
                       a media_play against the group, which merely
                       resumes whatever it currently points at — after a
                       test, the test file.
                       Three changes: (1) _expand_players resolves group
                       helpers to their members inside
                       _resolve_media_players, so every caller sees real
                       speakers; (2) _looks_like_sonos became _is_sonos
                       and asks the entity registry first, keeping the old
                       attribute sniff only as a fallback; (3)
                       _duck_media_players takes an `exclude` list and
                       drops anything that is also an adhan target —
                       Johann had office and living_room_4 in both, so
                       they were paused as "other audio", played on
                       anyway, then media_play'd back onto the sound
                       itself.
  2.3.4 (2026-07-28): Sonos announcements + one shared playback path.
                       Johann: "met Nasheed zou het fijn zijn als je
                       muziek afspeelt dat hij daarna hervat met de juiste
                       volume. Sonos heeft toch ook een announcement
                       manier?" Both, yes.
                       (1) New _play_sound_on_speakers holds the whole
                       duck / snapshot / fade / play / restore sequence
                       that four handlers had been carrying separately.
                       They had drifted: play_test_sound never grew ANY
                       of it, so a speaker test just killed whatever
                       music was on. It now behaves like the rest.
                       (2) Optional Sonos announcements
                       (options.sonos_announce_enabled, default off).
                       play_media's announce: True routes through Sonos'
                       own audioClip API, so the speaker ducks, plays at
                       extra.volume and restores the previous stream at
                       its original volume AND queue position — which our
                       own restore can't do. Targets are split per player
                       (_split_announce_targets), so a mixed Sonos +
                       Chromecast list gets the best each can manage
                       rather than the lowest common denominator. Off by
                       default because audioClip is built for short
                       sounds and can truncate a full adhan; see const.py.
                       (3) _announce_wait_seconds: on an announce-only
                       run, _wait_until_idle can't work (the entity never
                       enters a pollable "playing" state), so ducked
                       players are held for the file's real length via
                       mutagen instead of resuming over the sound.
  2.3.2 (2026-07-28): Fade instead of a hard cut. Johann: "de muziek
                       wordt gepauzeerd en dat abrupt, er achteraan
                       begint de adhan — zou die overgang beter kunnen."
                       New _fade_players / _fade_out_before_playback:
                       when something is genuinely playing on the target
                       speakers, its volume ramps to zero over
                       options.fade_seconds (default 2s), the player is
                       paused WHILE SILENT, and after a short beat the
                       adhan starts. The pause has to happen at zero and
                       before the caller sets the adhan volume —
                       otherwise the music itself would play at adhan
                       level for the length of the gap, which is the
                       thing 2.2.4 already fixed for the dip case.
                       _duck_media_players ramps its pause/volume_zero
                       targets down the same way (muted ones are skipped:
                       muting is instant by nature and its snapshot
                       carries no level to ramp from). Fading is skipped
                       entirely when nothing is playing, so the usual
                       case keeps firing as immediately as before rather
                       than paying a couple of seconds on every adhan.
                       Wired into all five playback paths (adhan,
                       pre-adhan jingle, pre-adhan test, pre-adhan TTS,
                       and the 2.3.0 preview).
  2.3.0 (2026-07-28): New nida.play_preview — one service that plays any
                       of Nida's configured sounds on the REAL speakers at
                       its REAL volume (Johann: "elke vorm dat je geluid
                       afspeelt moet kunnen testen wat het volume is").
                       Fills a genuine gap: the adhan was the one sound
                       with no speaker route at all, since the panel's
                       adhan ▶ was an in-browser preview and
                       play_test_sound plays a generic jingle instead of
                       the adhan. Covers adhan / fajr_adhan (via
                       async_resolve_adhan_sound_rel, so random-adhan
                       previews the file that would really fire today),
                       pre_adhan_jingle, test_nasheed and fajr_alarm; see
                       the handler docstring for what "real volume" does
                       and does not include. speak_pre_adhan gained an
                       optional `preview` flag for the same purpose — the
                       panel passes a REAL prayer name to get the real
                       volume, so it needs its own guest-mode exemption
                       rather than riding on prayer=="test".
  2.2.4 (2026-07-28): Pre-adhan dip. Johann, on 2.2.3: "volume wordt
                       verhoogd terwijl de muziek nog speelt. Misschien is
                       het rustiger als die iets verlaagd [wordt voor] de
                       jingle en tts en daarna weer hersteld op de waarde
                       voordat de pre-adhan ging." Setting the configured
                       pre-adhan volume before play_media meant the MUSIC
                       audibly jumped to that level first, which is the
                       opposite of a gentle heads-up. New
                       _apply_pre_adhan_volume: a speaker that's already
                       playing gets a percentage of its OWN current level
                       (options.pre_adhan_dip_factor, default 70%) rather
                       than the configured pre-adhan level, so the
                       transition is a reduction instead of a jump;
                       anything idle still gets the configured volume
                       exactly as before. Applied per entity, since each
                       speaker's music level differs. Restoring the
                       pre-dip level needs no new code — that's 2.2.3's
                       snapshot restore. Wired into the three PRE-adhan
                       paths only (jingle, test, TTS); the adhan itself
                       deliberately keeps jumping to its configured volume.
                       _snapshot_adhan_players now also records a
                       `volumes` map (Sonos included, which the restore
                       path itself doesn't need) for the dip maths.
  2.2.3 (2026-07-28): Restore playback on the ADHAN speakers themselves.
                       Johann: "ik heb als ik muziek luister dan de
                       mediaplayer daarna niet hersteld ... het zou fijn
                       zijn als muziek erna hersteld". Duck-media (2.1.26)
                       only ever touched OTHER players — the adhan
                       speakers were deliberately excluded, so music
                       playing on the speaker the adhan itself uses was
                       overwritten and never came back. New
                       _snapshot_adhan_players / _restore_adhan_players,
                       gated on options.restore_playback_enabled
                       (const.py, default off — it re-starts playback on
                       a speaker, which is not something to do to every
                       existing install unasked). Sonos gets
                       sonos.snapshot/restore with with_group=True, the
                       only route that genuinely restores a queue
                       position and a grouped zone; everything else falls
                       back to volume_level + media_play, which resumes a
                       paused stream but cannot restore a position. Only
                       players in state "playing" at snapshot time are
                       captured, so a speaker the user had deliberately
                       stopped is never started by the restore. Wired
                       into all four playback handlers alongside the
                       existing duck calls (adhan, pre-adhan jingle,
                       pre-adhan test, pre-adhan TTS), restoring AFTER
                       the duck restore in the same finally.
  2.2.2 (2026-07-12): Mac-shortcut duck. The AirPlay-receiver media_player
                       route (2.1.42) turned out to control the wrong audio
                       path entirely — it only affects audio being
                       AirPlayed TO the Mac, not local playback, and
                       Johann's volume_set attempt failed outright with
                       "audio is blocked" since nothing was actively
                       AirPlaying to it. New _notify_mac_shortcut() fires a
                       fixed, recognisable notification via a user-chosen
                       notify.* target (const.py's new
                       OPT_DUCK_MAC_SHORTCUT_ENABLED/_NOTIFY +
                       DUCK_MAC_SHORTCUT_DUCK_MESSAGE/_RESTORE_MESSAGE) so
                       a macOS 27+ Shortcuts automation can react and
                       actually mute/restore the Mac's local audio via a
                       Shortcut the user builds themselves. Wired into
                       both _duck_media_players (right after the master
                       enabled check, unconditional on whether any
                       media_player target is even configured) and
                       _restore_duck_media_players (now takes an `options`
                       param, fires its notify before the `if not
                       snapshot` guard). All 4 call sites
                       (_async_handle_play_adhan,
                       _async_handle_play_pre_adhan_jingle, the pre-adhan
                       test handler, and the pre-adhan TTS handler) lost
                       their `if duck_snapshot:` guard around
                       _wait_until_idle + _restore_duck_media_players —
                       both must now run unconditionally so the Mac
                       restore-notify still fires even when zero
                       media_player entities were ducked that cycle.
  2.1.42 (2026-07-12): Duck-media gained a mute/volume-zero fallback for
                       players that can't be paused. Johann added his
                       MacBook (via HA's Apple TV/AirPlay-receiver
                       integration, after enabling AirPlay Receiver in
                       macOS) to the duck list and hit "Entity ... does
                       not support action media_player.media_play_pause"
                       — confirmed via a screenshot of its Controls card
                       (Idle state, a volume slider, no play/pause
                       control). AirPlay-receiver media_player entities
                       only support VOLUME_SET/VOLUME_MUTE, not PAUSE, so
                       the previously-unconditional media_pause call
                       silently failed (caught by the existing try/except)
                       and the player was just never ducked. Both
                       _duck_media_players and _restore_duck_media_players
                       now branch per entity on its supported_features
                       bitmask: PAUSE where available (unchanged for every
                       player this already worked on), else VOLUME_MUTE
                       (snapshotting whether it was already muted, so
                       restore doesn't un-mute a player the user muted on
                       purpose), else VOLUME_SET to 0.0 as a last resort
                       (snapshotting the real volume for restore). An
                       entity with none of the three is skipped, same as
                       before. See _duck_media_players' own docstring for
                       the full per-method breakdown.
  2.1.30 (2026-07-09): Duck-media now also covers the pre-adhan TTS
                       announcement (_async_handle_speak_pre_adhan), not
                       just the jingle — Johann: "de pauze van de media
                       player is met pre-adhan alleen de jingle en niet
                       de tts". Anyone with only TTS enabled (no jingle)
                       previously got no ducking at all; anyone with both
                       had the ducked player resumed again before TTS
                       even spoke. Same pattern as the jingle/adhan
                       handlers: pause+snapshot before, wait for the TTS
                       speaker(s) to actually finish (tts.speak's
                       blocking=True only waits for the service call, not
                       for playback to end), restore in a finally so a
                       tts.speak failure never leaves a player stuck
                       paused.
  2.1.29 (2026-07-09): New async_resolve_adhan_sound_rel — the fixed-or-
                       random sound resolution from _async_handle_play_adhan
                       pulled out into its own function so scheduler.py's
                       notify handler can independently resolve the same
                       file (to look up its real duration for the Android
                       TV notification — see scheduler.py's changelog).
                       _random_adhan_rel's random.choice replaced with
                       random.Random(seed).choice, seeded by today's date
                       + prayer, so both call sites land on the same file
                       without any shared state — the tradeoff is a
                       repeated "random" pick for the same prayer if
                       called again the same day (e.g. via the panel's
                       own test flows), which was never really part of
                       the feature's intent anyway.
  2.1.28 (2026-07-09): Fixed duck-media never triggering on Johann's
                       Android TV (Philips, running Jellyfin): its
                       media_player entity has assumed_state=true and
                       only ever reports "on"/"off" — never "playing" —
                       so _duck_media_players' strict state=="playing"
                       check silently never matched it. Now "on" also
                       counts as playing, but only for entities that
                       self-report assumed_state=true; ordinary
                       integrations (Sonos, Spotify, Chromecast, ...)
                       still require a real "playing" state, so a player
                       that's merely powered on but idle still won't get
                       force-paused-then-resumed for them.
  2.1.27 (2026-07-09): _async_handle_play_pre_adhan_test (the panel's
                       "Test pre-adhan jingle" button) now goes through
                       the same duck/restore as the real scheduled jingle
                       — Johann asked to be able to test the 2.1.26 duck
                       feature without waiting for a real prayer time.
                       The generic speaker test (play_test_sound) is left
                       alone; it's not adhan-related content.
  2.1.26 (2026-07-09): Duck media players. When options.duck_media_enabled
                       is on, _async_handle_play_adhan and
                       _async_handle_play_pre_adhan_jingle now pause every
                       configured options.duck_media_players entity that's
                       currently playing (_duck_media_players — snapshots
                       volume_level first), wait for the adhan/jingle
                       speaker(s) to finish (_wait_until_idle, polling with
                       a 10-minute safety timeout), then restore volume
                       and resume playback in that order
                       (_restore_duck_media_players) — Johann's explicit
                       requirement: pause first, save volume, restore
                       volume, THEN play, never the other way round.
                       Wrapped in try/finally around the adhan/jingle
                       playback call so a duck'd player is never left
                       paused just because play_media failed.
  2.0.70 (2026-07-04): TTS follows the pre-adhan volume. speak_pre_adhan
                       now calls _set_volume_safe on the target players
                       before the tts.speak call: scheduled runs use
                       volume_pre_adhan_jingle, the Test button uses
                       volume_pre_adhan_test. Previously TTS played at
                       whatever level the speaker happened to be at.
  2.0.56 (2026-07-03): Per-language TTS default message. speak_pre_adhan
                       resolves the language BEFORE the message and
                       picks the sentence from DEFAULT_TTS_MESSAGES
                       (const.py) when the stored message is empty or a
                       known default in any language; a customised
                       message always wins (_resolve_tts_message).
  2.0.52 (2026-07-02): Random adhan. When options.random_adhan_enabled
                       is on, play_adhan picks a random locally
                       downloaded sound from the prayer's category
                       (_random_adhan_rel); falls back to the fixed
                       configured sound when nothing qualifies.
  2.0.51 (2026-07-02): nida.play_dua added. Plays a configured dua
                       (options.duas, matched by dua_id) on its own
                       media player at its own volume. Manual-only:
                       bypasses guest mode and volume modifiers by
                       design, like the existing test services.

Exposes three services:

  nida.play_adhan
    Plays the configured adhan sound for a given prayer on the
    adhan_media_players.

  nida.play_pre_adhan_jingle
    Plays the configured pre-adhan jingle file on the same speakers.
    Used by scheduler.py at each pre-reminder moment when
    pre_adhan_audio_enabled is true; also callable from the panel
    test button.

  nida.play_test_sound
    Plays sounds/test/test_nasheed.mp3 with volume_test for the
    Speakers-test functionality in the panel.

All three honour night-mode: when night_mode_enabled is true AND
the current time falls inside [night_start, night_end), the
configured volume is multiplied by night_volume_factor/100 before
being applied. Window wraps around midnight when start > end.

Changelog:
  2.0.46 (2026-07-02): Guest mode duration. The three guards now go
                       through _guest_mode_active(): enabled AND the
                       panel-written guest_mode_until not yet passed
                       (missing until = on until manually off). Lazy
                       expiry at fire time, no background timer.
  2.0.45 (2026-07-02): Guest mode. When options.guest_mode_enabled is
                       on, play_adhan, play_pre_adhan_jingle and
                       speak_pre_adhan return early (info-logged) so no
                       scheduled adhan audio plays while visitors are
                       around. Test services and the panel's TTS test
                       (prayer="test") are deliberately not gated.
  2.0.44 (2026-07-02): TTS language fix. 2.0.35 normalised every code to
                       the bare 2-letter form on the assumption that was
                       universally safe — in reality HA Cloud and OpenAI
                       TTS reject "en" ("Language 'en' not supported")
                       and want a full locale, while Google Translate
                       wants the bare form. speak_pre_adhan now tries an
                       ordered candidate list per engine (configured
                       value, 2-letter, regional default like en-US) and
                       falls back to omitting the language entirely
                       (engine default). Calls are blocking=True so a
                       rejection is actually caught here instead of
                       surfacing later in HA core as an uncatchable
                       "Error executing service" while Nida logged
                       success.
  2.0.41 (2026-07-01): Open-contact volume. _apply_night_factor is
                       generalised into _apply_volume_modifiers, which
                       combines night mode with a new open-contact
                       condition: when open_contact_enabled and any of
                       options.open_contact_sensors reads "on" (open),
                       its factor joins the pool. When several
                       conditions apply the LOWEST factor wins (quietest
                       wins), so a loud open-contact boost never
                       overrides night quiet. All five play_* handlers
                       route through the new function; the open state is
                       read live from hass.states at fire time.
  2.0.35 (2026-06-29): Fix in nida.speak_pre_adhan — taal-code wordt
                       genormaliseerd naar 2-letter ISO. Google
                       Translate TTS + OpenAI TTS weigerden BCP-47
                       regio-codes ("en-GB", "nl-NL") met "Language X
                       not supported". Cloud TTS accepteert ze maar
                       werkt ook met "en". 2-letter is universeel
                       veilig.
  2.0.33 (2026-06-29): Fix in nida.speak_pre_adhan — `language` is een
                       top-level parameter van tts.speak, niet een
                       sleutel in `options`. Cloud TTS (en anderen)
                       wezen het stilletjes af met "Invalid options
                       found: ['language']". options dict nu helemaal
                       weggelaten (geen engine-specifieke knobs).
  2.0.23 (2026-06-28): New service nida.play_pre_adhan_test — plays
                       the configured pre-adhan jingle on the adhan
                       speakers with volume_pre_adhan_test (separate
                       from volume_pre_adhan_jingle, the scheduled
                       playback level). Mirrors the play_test_sound
                       pattern. Honours night-mode. Used by the panel's
                       new play/stop test button under the Pre-adhan
                       subgroup of Sounds.
  2.0.22 (2026-06-28): Three changes in one. (1) New service
                       play_pre_adhan_jingle so the scheduler can
                       fire actual audio playback for the pre-adhan
                       window (previously notification-only — the
                       audio gap is the long-standing 🔴 in the
                       status table). (2) play_test_sound now reads
                       volume_test instead of volume_adhan, giving
                       users a separate quiet level for testing.
                       (3) All three play_* services route through
                       _apply_night_factor, which checks the
                       night-mode window and reduces the volume by
                       the configured factor when active.
  2.0.18 (2026-06-28): nida.play_test_sound service toegevoegd voor de
                       Speakers-test-knop in het paneel.
  2.0.12 (2026-06-28): Per-category volume support.
  2.0.1 (2026-06-28): New file — initial play_adhan service.
"""
from __future__ import annotations

import asyncio
import logging
import random
from datetime import datetime, time

import voluptuous as vol

from homeassistant.components.media_player import MediaPlayerEntityFeature
from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers import entity_registry as er
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_NIGHT_END,
    DEFAULT_NIGHT_START,
    DEFAULT_NIGHT_VOLUME_FACTOR,
    DEFAULT_OPEN_CONTACT_VOLUME_FACTOR,
    DEFAULT_DUCK_MAC_SHORTCUT_ENABLED,
    DEFAULT_DUCK_MEDIA_ENABLED,
    DEFAULT_FADE_ENABLED,
    DEFAULT_FADE_SECONDS,
    DEFAULT_SONOS_ANNOUNCE_ENABLED,
    DEFAULT_FAJR_ALARM_VOLUME,
    DEFAULT_PRE_ADHAN_DIP_ENABLED,
    DEFAULT_PRE_ADHAN_DIP_FACTOR,
    DEFAULT_RESTORE_PLAYBACK_ENABLED,
    DEFAULT_SOUNDS,
    DEFAULT_TTS_MESSAGES,
    DEFAULT_TTS_PRE_ADHAN_MESSAGE_FALLBACK,
    DEFAULT_VOLUME_PRE_ADHAN_TEST,
    DEFAULT_VOLUME_TEST,
    DEFAULT_DUA_VOLUME,
    DEFAULT_VOLUMES,
    DOMAIN,
    DUCK_MAC_SHORTCUT_DUCK_MESSAGE,
    DUCK_MAC_SHORTCUT_RESTORE_MESSAGE,
    FADE_SECONDS_MAX,
    FADE_SECONDS_MIN,
    OPT_ADHAN_MEDIA_PLAYERS,
    OPT_DUAS,
    OPT_DUCK_MAC_SHORTCUT_ENABLED,
    OPT_DUCK_MAC_SHORTCUT_NOTIFY,
    OPT_DUCK_MEDIA_ENABLED,
    OPT_DUCK_MEDIA_PLAYERS,
    OPT_FADE_ENABLED,
    OPT_FADE_SECONDS,
    OPT_FAJR_ALARM_MEDIA_PLAYER,
    OPT_FAJR_ALARM_SOUND,
    OPT_FAJR_ALARM_VOLUME,
    OPT_NIGHT_END,
    OPT_NIGHT_MODE_ENABLED,
    OPT_NIGHT_START,
    OPT_NIGHT_VOLUME_FACTOR,
    OPT_GUEST_MODE_ENABLED,
    OPT_GUEST_MODE_UNTIL,
    OPT_OPEN_CONTACT_ENABLED,
    OPT_OPEN_CONTACT_SENSORS,
    OPT_OPEN_CONTACT_VOLUME_FACTOR,
    OPT_PRE_ADHAN_DIP_ENABLED,
    OPT_PRE_ADHAN_DIP_FACTOR,
    OPT_RANDOM_ADHAN_ENABLED,
    OPT_RESTORE_PLAYBACK_ENABLED,
    OPT_SONOS_ANNOUNCE_ENABLED,
    OPT_SOUND_PREFIX,
    OPT_TTS_PRE_ADHAN_LANGUAGE,
    OPT_TTS_PRE_ADHAN_MESSAGE,
    OPT_TTS_PRE_ADHAN_SERVICES,
    OPT_VOLUME_PRE_ADHAN_TEST,
    OPT_VOLUME_PREFIX,
    OPT_VOLUME_TEST,
    PRAYER_SOUND_CATEGORY,
    PRAYERS,
    SOUND_CATEGORY_ADHAN,
    SOUND_CATEGORY_PRE_ADHAN_JINGLE,
    TEST_SOUND_PATH,
)

_LOGGER = logging.getLogger(__name__)

SERVICE_PLAY_ADHAN = "play_adhan"
SERVICE_PLAY_PRE_ADHAN_JINGLE = "play_pre_adhan_jingle"
SERVICE_PLAY_PRE_ADHAN_TEST = "play_pre_adhan_test"
SERVICE_PLAY_TEST_SOUND = "play_test_sound"
SERVICE_SPEAK_PRE_ADHAN = "speak_pre_adhan"
SERVICE_PLAY_DUA = "play_dua"
SERVICE_PLAY_PREVIEW = "play_preview"

# 2.3.0 — one preview service covering every sound Nida can play, so each
# one is auditionable ON THE REAL SPEAKERS at its REAL configured volume.
# Johann: "elke vorm dat je geluid afspeelt moet kunnen testen wat het
# volume is." Before this the adhan was the ONE sound with no speaker
# route at all — the panel's adhan ▶ was an in-browser `new Audio()`
# (fine for "which muezzin is this", useless for "how loud will the house
# get"), while the Speakers ▶ played a generic test jingle rather than the
# adhan. Dua is absent here on purpose: nida.play_dua already plays each
# dua on its own player at its own volume.
PREVIEW_ADHAN = "adhan"
PREVIEW_FAJR_ADHAN = "fajr_adhan"
PREVIEW_PRE_ADHAN_JINGLE = "pre_adhan_jingle"
PREVIEW_TEST_JINGLE = "test_nasheed"
PREVIEW_FAJR_ALARM = "fajr_alarm"
PREVIEW_ITEMS = [
    PREVIEW_ADHAN,
    PREVIEW_FAJR_ADHAN,
    PREVIEW_PRE_ADHAN_JINGLE,
    PREVIEW_TEST_JINGLE,
    PREVIEW_FAJR_ALARM,
]

PLAY_PREVIEW_SCHEMA = vol.Schema(
    {
        vol.Required("item"): vol.In(PREVIEW_ITEMS),
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
    }
)

PLAY_DUA_SCHEMA = vol.Schema(
    {
        vol.Required("dua_id"): cv.string,
    }
)

PLAY_ADHAN_SCHEMA = vol.Schema(
    {
        vol.Required("prayer"): vol.In(PRAYERS),
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
    }
)

PLAY_PRE_ADHAN_JINGLE_SCHEMA = vol.Schema(
    {
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
    }
)

PLAY_PRE_ADHAN_TEST_SCHEMA = vol.Schema(
    {
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
    }
)

PLAY_TEST_SOUND_SCHEMA = vol.Schema(
    {
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
    }
)

SPEAK_PRE_ADHAN_SCHEMA = vol.Schema(
    {
        # Optional — service can be invoked from the panel test button
        # (any prayer name is fine) or by the scheduler (with the
        # actual upcoming prayer). When absent, [prayer] in the message
        # is left as-is.
        vol.Optional("prayer"): str,
        # Optional override; otherwise uses options.adhan_media_players.
        vol.Optional("entity_id"): vol.Any(cv.entity_id, [cv.entity_id]),
        # Optional language override; otherwise uses options.language
        # or falls back to HA's system language. Mostly for the panel
        # test button to audition different languages.
        vol.Optional("language"): str,
        # 2.3.0 — preview from the panel: bypass guest mode (an explicit
        # button press, same rule as every other test path) while still
        # taking the REAL jingle volume rather than the separate test
        # volume, so what you hear is what will actually fire. That
        # volume follows automatically from NOT passing prayer="test" —
        # this flag only has to deal with the guest-mode gate.
        vol.Optional("preview"): cv.boolean,
    }
)


def _sound_path_for(options: dict, prayer: str) -> str:
    category = PRAYER_SOUND_CATEGORY[prayer]
    key = f"{OPT_SOUND_PREFIX}{category}"
    return options.get(key) or DEFAULT_SOUNDS[category]


def _pre_adhan_jingle_path(options: dict) -> str:
    """Resolve the pre-adhan jingle file path (relative to sounds/)."""
    key = f"{OPT_SOUND_PREFIX}{SOUND_CATEGORY_PRE_ADHAN_JINGLE}"
    return options.get(key) or DEFAULT_SOUNDS[SOUND_CATEGORY_PRE_ADHAN_JINGLE]


def _volume_for_category(options: dict, category: str) -> float | None:
    """Read volume_<category> (0-100 int) as 0.0-1.0 float, or None on parse fail."""
    key = f"{OPT_VOLUME_PREFIX}{category}"
    raw = options.get(key, DEFAULT_VOLUMES.get(category))
    try:
        v = int(raw)
    except (TypeError, ValueError):
        return None
    return max(0, min(100, v)) / 100.0


def _volume_for_prayer(options: dict, prayer: str) -> float | None:
    return _volume_for_category(options, PRAYER_SOUND_CATEGORY[prayer])


# Common regional default per 2-letter code, used as a language candidate
# for engines (HA Cloud, OpenAI TTS) that reject the bare code and want a
# full locale. Mirrors the panel's LANGUAGES list.
_REGION_DEFAULTS = {
    "en": "en-US", "nl": "nl-NL", "ar": "ar-SA", "tr": "tr-TR",
    "de": "de-DE", "fr": "fr-FR", "ms": "ms-MY", "id": "id-ID",
    "ur": "ur-PK", "fa": "fa-IR",
}


def _language_candidates(lang: str | None) -> list[str]:
    """Ordered language codes to try against a TTS engine.

    Different engines want different shapes: Google Translate TTS accepts
    only the bare 2-letter code, HA Cloud / OpenAI TTS only a full locale.
    Order: configured value as-is, the 2-letter base, a common regional
    default for that base. Deduplicated; empty when no language resolved
    (caller then omits the parameter entirely).
    """
    if not lang:
        return []
    out: list[str] = []
    for cand in (lang, lang.split("-", 1)[0], _REGION_DEFAULTS.get(lang.split("-", 1)[0])):
        if cand and cand not in out:
            out.append(cand)
    return out


def _resolve_tts_message(options: dict, lang: str | None) -> str:
    """Effective pre-adhan TTS message template (2.0.56).

    A customised message always wins. "Not customised" means the stored
    value is empty/whitespace OR exactly equal to one of the known
    per-language defaults — the panel writes those verbatim, so an exact
    match reliably identifies an untouched field without a separate
    "customised" flag. In that case the sentence follows the resolved
    TTS language (base code, e.g. "id-ID" → "id"), falling back to
    English for languages without a default sentence.
    """
    raw = str(options.get(OPT_TTS_PRE_ADHAN_MESSAGE) or "").strip()
    if raw and raw not in DEFAULT_TTS_MESSAGES.values():
        return raw
    base = (lang or "en").split("-", 1)[0].lower()
    return DEFAULT_TTS_MESSAGES.get(base, DEFAULT_TTS_MESSAGES["en"])


def _guest_mode_active(options: dict) -> bool:
    """True while guest mode should mute scheduled adhan audio.

    Active when the toggle is on AND the panel-written until-timestamp
    has not passed. A missing/unparseable until means "on until manually
    switched off" (also covers a 2.0.45 toggle-on that predates the
    timer). Expiry is lazy: no background timer, just this comparison at
    fire time — after the until-moment the next adhan simply plays again.
    """
    if not bool(options.get(OPT_GUEST_MODE_ENABLED)):
        return False
    until_raw = options.get(OPT_GUEST_MODE_UNTIL)
    if not until_raw:
        return True
    until = dt_util.parse_datetime(str(until_raw))
    if until is None:
        return True
    return dt_util.utcnow() < dt_util.as_utc(until)


def _expand_players(hass: HomeAssistant, players: list[str]) -> list[str]:
    """Replace media_player GROUP helpers with their real members (2.3.5).

    Johann's adhan target is a single entity, media_player.adhan_speakers,
    which is a Home Assistant group helper fanning out to three Sonos
    zones. Everything downstream was reasoning about that proxy instead of
    the speakers behind it, and a group helper is lossy in exactly the
    ways that matter here:

      * it exposes no queue_size, so the Sonos check said "not Sonos"
        and both sonos.snapshot/restore AND the whole announce path were
        silently skipped — with sonos_announce_enabled switched ON;
      * its snapshot was one aggregate volume_level + state, so the
        restore was a media_play against the group, which just resumes
        whatever the group is pointed at. After a test that is the test
        file itself, never the music.

    That is why the music never came back. Playing on the members instead
    of the group changes nothing audible — a media_player group forwards
    service calls to its members rather than making them one device (the
    Sonos app screenshot confirms it: three zones each independently
    showing test_nasheed.mp3, not a Sonos group).

    Detection goes through the entity registry (platform == "group")
    rather than sniffing attributes, since `entity_id` as an attribute
    is not unique to groups. Recursion is bounded in case someone nests
    group helpers, and `seen` guards against a cycle.
    """
    registry = er.async_get(hass)
    out: list[str] = []
    seen: set[str] = set()

    def walk(entity_id: str, depth: int) -> None:
        if entity_id in seen or depth > 4:
            return
        seen.add(entity_id)
        entry = registry.async_get(entity_id)
        if entry is not None and entry.platform == "group":
            state = hass.states.get(entity_id)
            members = (state.attributes.get("entity_id") if state else None) or []
            if isinstance(members, (list, tuple)) and members:
                for member in members:
                    walk(str(member), depth + 1)
                return
            # A group we can't see through (no state yet, empty members):
            # better to keep targeting it than to drop the sound entirely.
        out.append(entity_id)

    for entity_id in players:
        walk(entity_id, 0)
    return out


def _resolve_media_players(
    hass: HomeAssistant, call_data: dict, options: dict
) -> list[str]:
    """Pick target players: explicit entity_id wins, else options fallback.

    2.3.5 — the result is expanded through _expand_players, so every
    caller works with real speakers rather than a group proxy.
    """
    raw = call_data.get("entity_id")
    if raw:
        players = [raw] if isinstance(raw, str) else list(raw)
    else:
        players = list(options.get(OPT_ADHAN_MEDIA_PLAYERS) or [])
    return _expand_players(hass, players)


def _parse_hhmm(value: str | None, fallback: str) -> time:
    """Parse "HH:MM" to a time object; return fallback on any parse error."""
    raw = value or fallback
    try:
        hh, mm = (int(x) for x in raw.split(":", 1))
        return time(hour=max(0, min(23, hh)), minute=max(0, min(59, mm)))
    except (ValueError, AttributeError):
        hh, mm = (int(x) for x in fallback.split(":", 1))
        return time(hour=hh, minute=mm)


def _in_night_window(options: dict, now: datetime | None = None) -> bool:
    """Is the current local time inside the configured night window?

    Window wraps around midnight when start > end (e.g. 22:00 → 07:00):
      - now=23:30 with start=22, end=07 → IN window
      - now=03:00 with start=22, end=07 → IN window
      - now=10:00 with start=22, end=07 → NOT in window

    When start <= end, window is straightforward intra-day.
    """
    if not bool(options.get(OPT_NIGHT_MODE_ENABLED, False)):
        return False
    if now is None:
        now = dt_util.now()
    start = _parse_hhmm(options.get(OPT_NIGHT_START), DEFAULT_NIGHT_START)
    end = _parse_hhmm(options.get(OPT_NIGHT_END), DEFAULT_NIGHT_END)
    cur = now.time()
    if start <= end:
        return start <= cur < end
    # Wraps midnight: in window if cur >= start OR cur < end.
    return cur >= start or cur < end


def _open_contact_active(hass: HomeAssistant, options: dict) -> bool:
    """True if open-contact mode is on and any configured sensor reads open.

    A binary_sensor with device_class door/window/opening reads "on" when
    open. One open contact is enough to trigger the volume adjustment.
    State is read live at call time (fire time), so it reflects whatever
    is open at the exact adhan/pre-adhan moment.
    """
    if not bool(options.get(OPT_OPEN_CONTACT_ENABLED, False)):
        return False
    for entity_id in (options.get(OPT_OPEN_CONTACT_SENSORS) or []):
        if not isinstance(entity_id, str):
            continue
        state = hass.states.get(entity_id)
        if state is not None and state.state == "on":
            return True
    return False


def _effective_volume_factor(hass: HomeAssistant, options: dict) -> int:
    """Lowest active volume factor (percentage of normal), or 100 if none.

    Night mode and open-contact are independent conditions that each carry
    a factor. When several apply at once the quietest wins — taking the
    minimum keeps a loud open-contact boost from overriding night quiet.
    """
    factors: list[int] = []
    if _in_night_window(options):
        try:
            factors.append(
                int(options.get(OPT_NIGHT_VOLUME_FACTOR, DEFAULT_NIGHT_VOLUME_FACTOR))
            )
        except (TypeError, ValueError):
            factors.append(DEFAULT_NIGHT_VOLUME_FACTOR)
    if _open_contact_active(hass, options):
        try:
            factors.append(
                int(options.get(
                    OPT_OPEN_CONTACT_VOLUME_FACTOR, DEFAULT_OPEN_CONTACT_VOLUME_FACTOR
                ))
            )
        except (TypeError, ValueError):
            factors.append(DEFAULT_OPEN_CONTACT_VOLUME_FACTOR)
    if not factors:
        return 100
    return max(0, min(150, min(factors)))


def _apply_volume_modifiers(
    volume: float | None, hass: HomeAssistant, options: dict
) -> float | None:
    """Scale volume by the effective factor from night mode + open-contact.

    Volume in: 0.0-1.0 (or None). Volume out: same range, scaled and
    clamped to [0.0, 1.0]. None passes through so the caller skips
    volume_set entirely. Replaces the old _apply_night_factor (2.0.41):
    night mode is now one of possibly several active conditions, and the
    lowest factor wins.
    """
    if volume is None:
        return None
    factor = _effective_volume_factor(hass, options)
    return max(0.0, min(1.0, volume * (factor / 100.0)))


async def _set_volume_safe(
    hass: HomeAssistant, players: list[str], volume: float, label: str
) -> None:
    """volume_set wrapped in a try/except so playback never aborts on volume failure."""
    try:
        await hass.services.async_call(
            "media_player",
            "volume_set",
            {"entity_id": players, "volume_level": volume},
            blocking=True,
        )
        _LOGGER.debug("Set volume %.2f on %s for %s", volume, players, label)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning(
            "volume_set failed for %s on %s (%s); proceeding without",
            label, players, err,
        )


async def _play_media_safe(
    hass: HomeAssistant, players: list[str], media_url: str, label: str
) -> None:
    """play_media wrapped — logs and survives 404s on missing sound files."""
    try:
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": players,
                "media_content_id": media_url,
                "media_content_type": "music",
            },
            blocking=False,
        )
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("play_media failed for %s (%s)", label, err)


def _split_announce_targets(
    hass: HomeAssistant, options: dict, players: list[str]
) -> tuple[list[str], list[str]]:
    """Split `players` into (announce-capable, everything else) — 2.3.4.

    Only Sonos qualifies, and only when the user has switched
    announcements on (see const.py's OPT_SONOS_ANNOUNCE_ENABLED for why
    that's opt-in). Everything else keeps taking the manual
    snapshot/fade/restore path, so a mixed household of Sonos + Chromecast
    gets the best available behaviour on each rather than the lowest
    common denominator.
    """
    if not bool(options.get(OPT_SONOS_ANNOUNCE_ENABLED, DEFAULT_SONOS_ANNOUNCE_ENABLED)):
        return [], list(players)
    announce: list[str] = []
    manual: list[str] = []
    for entity_id in players:
        if _is_sonos(hass, entity_id):
            announce.append(entity_id)
        else:
            manual.append(entity_id)
    return announce, manual


async def _play_announcement(
    hass: HomeAssistant, players: list[str], media_url: str, volume: float | None, label: str
) -> None:
    """Play `media_url` as a Sonos announcement (2.3.4).

    The volume rides along in `extra` rather than a preceding volume_set:
    it applies to the CLIP only, leaving the music's own level untouched,
    which is the whole reason this path needs no snapshot or restore.
    Sonos wants it as 0-100, not the 0.0-1.0 media_player uses.
    """
    data: dict = {
        "entity_id": players,
        "media_content_id": media_url,
        "media_content_type": "music",
        "announce": True,
    }
    if volume is not None:
        data["extra"] = {"volume": int(round(max(0.0, min(1.0, volume)) * 100))}
    try:
        await hass.services.async_call("media_player", "play_media", data, blocking=False)
        _LOGGER.info("Announced %s on %s: %s", label, players, media_url)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Sonos announce failed for %s on %s (%s)", label, players, err)


async def _notify_mac_shortcut(hass: HomeAssistant, options: dict, message: str) -> None:
    """Fire a fixed, recognisable notification via the user's configured
    notify.* target so a macOS 27+ (Sequoia) Shortcuts automation can
    react to it and mute/restore the Mac's own local audio output.

    2.2.2 — see const.py's OPT_DUCK_MAC_SHORTCUT_ENABLED comment for the
    full "why": Nida has no HA entity that can control a Mac's own local
    playback, only audio being AirPlayed TO it (a different, and for
    Johann's use case irrelevant, audio path). This is deliberately NOT
    gated on "is anything playing" the way the media_player duck path
    is — Nida can't see the Mac's local playback state at all, so it
    fires unconditionally whenever duck-media runs and this sub-feature
    is enabled. `message` is one of the two fixed constants
    (DUCK_MAC_SHORTCUT_DUCK_MESSAGE / _RESTORE_MESSAGE) the panel shows
    as copy-paste instructions for the user's own Shortcuts automation.
    """
    if not bool(options.get(OPT_DUCK_MAC_SHORTCUT_ENABLED, DEFAULT_DUCK_MAC_SHORTCUT_ENABLED)):
        return
    target = options.get(OPT_DUCK_MAC_SHORTCUT_NOTIFY) or ""
    if not target.startswith("notify."):
        return
    service = target.split(".", 1)[1]
    if not service:
        return
    try:
        await hass.services.async_call(
            "notify", service,
            {"message": message},
            blocking=True,
        )
        _LOGGER.debug("Sent Mac-shortcut notify %r to %s", message, target)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Failed to send Mac-shortcut notify to %s (%s)", target, err)


async def _duck_media_players(
    hass: HomeAssistant, options: dict, exclude: list[str] | None = None
) -> list[dict]:
    """Duck every configured duck-media player that is currently playing,
    snapshotting whatever's needed so _restore_duck_media_players can put
    it back exactly as it was.

    2.1.26 — Johann: selected media players (music/TV, unrelated to the
    adhan speakers) should pause before the pre-adhan jingle or the adhan
    itself, with their volume saved and restored before resuming — in
    that order, so a player never briefly comes back at the wrong level.

    Only players actually (or plausibly, see below) playing at the moment
    we check are paused and returned here; anything already paused/idle/
    off is left alone, and — since only these players are in the returned
    snapshot — won't be resumed later either. That matters: we must never
    start playback on something the user had deliberately stopped.

    2.1.28 — some Android TV integrations (`assumed_state: true` in their
    state attributes — HA's own signal that the integration can't reliably
    tell "on and idle on the home screen" apart from "on and actively
    playing something", so it never reports the real "playing" state at
    all) get a fallback: state "on" counts as playing too, but ONLY when
    assumed_state is set. Confirmed against Johann's actual Philips/
    Android TV entity running Jellyfin: it sits at state "on" the whole
    time Jellyfin plays, so the strict "playing" check never fired and
    the TV never got ducked. Well-behaved integrations (Sonos, Spotify,
    Chromecast, ...) don't set assumed_state and are unaffected — for
    those "on" alone still does NOT count, so a player merely powered on
    but not actually playing still won't be force-paused-then-resumed.

    2.1.42 — Johann added his MacBook (exposed via the Apple TV/AirPlay-
    receiver integration once AirPlay Receiver was turned on in macOS
    Continuity settings) to the duck list and hit "Entity ... does not
    support action media_player.media_play_pause" — an AirPlay-receiver
    media_player only relays what's being AirPlayed to it, so it doesn't
    support PAUSE at all, only VOLUME_SET/VOLUME_MUTE. media_pause was
    unconditional before this version, so an entity like that got silently
    skipped (the try/except here swallowed the "not supported" error) and
    was simply never ducked — matching exactly what Johann reported once
    he tried it. Now each target's `supported_features` bitmask picks a
    method per entity: PAUSE where available (unchanged behaviour for
    every player this already worked on), else VOLUME_MUTE (snapshot
    whether it was already muted, so restore doesn't un-mute a player
    the user muted on purpose), else VOLUME_SET down to 0.0 as a last
    resort (snapshot the real volume for restore, same as the pause
    path already did). An entity with none of the three is skipped
    entirely — there's nothing we can do to it — same net effect as
    before for genuinely uncontrollable players.

    media_pause/volume_mute/volume_set are awaited with blocking=True so
    playback has genuinely stopped/silenced before the adhan sound starts;
    a fire-and-forget call can't guarantee the two don't briefly overlap.
    """
    if not bool(options.get(OPT_DUCK_MEDIA_ENABLED, DEFAULT_DUCK_MEDIA_ENABLED)):
        return []

    await _notify_mac_shortcut(hass, options, DUCK_MAC_SHORTCUT_DUCK_MESSAGE)

    targets = [e for e in (options.get(OPT_DUCK_MEDIA_PLAYERS) or []) if isinstance(e, str)]
    # 2.3.5 — never duck a speaker we are about to play ON. Johann's
    # config has media_player.office and media_player.living_room_4 in
    # BOTH the Adhan Speakers group and the duck list, which is
    # self-defeating: the speaker gets paused as "other audio", the adhan
    # then plays on it anyway, and the duck restore afterwards issues
    # media_play against it — resuming whatever it is now pointed at,
    # which is the adhan/test file rather than the music. Filtering here
    # rather than only warning about it, because there is no setup in
    # which ducking your own adhan speaker is the intended behaviour.
    if exclude:
        skip = set(_expand_players(hass, list(exclude)))
        dropped = [e for e in targets if e in skip]
        if dropped:
            _LOGGER.debug(
                "Duck media: %s are also adhan speakers; not ducking them", dropped
            )
        targets = [e for e in targets if e not in skip]
    if not targets:
        return []

    snapshot: list[dict] = []
    to_pause: list[str] = []
    to_mute: list[str] = []
    to_zero: list[str] = []
    for entity_id in targets:
        state = hass.states.get(entity_id)
        if state is None:
            continue
        is_playing = state.state == "playing"
        if not is_playing and state.state == "on" and state.attributes.get("assumed_state"):
            is_playing = True
        if not is_playing:
            continue

        features = state.attributes.get("supported_features", 0) or 0
        volume_level = state.attributes.get("volume_level")
        if features & MediaPlayerEntityFeature.PAUSE:
            snapshot.append({
                "entity_id": entity_id,
                "method": "pause",
                "volume_level": volume_level,
            })
            to_pause.append(entity_id)
        elif features & MediaPlayerEntityFeature.VOLUME_MUTE:
            snapshot.append({
                "entity_id": entity_id,
                "method": "mute",
                "was_muted": bool(state.attributes.get("is_volume_muted", False)),
            })
            to_mute.append(entity_id)
        elif features & MediaPlayerEntityFeature.VOLUME_SET:
            snapshot.append({
                "entity_id": entity_id,
                "method": "volume_zero",
                "volume_level": volume_level,
            })
            to_zero.append(entity_id)
        else:
            _LOGGER.debug(
                "Duck media: %s supports neither pause, mute, nor volume_set — skipping",
                entity_id,
            )

    if not (to_pause or to_mute or to_zero):
        return []

    # 2.3.2 — ramp down before pausing/zeroing, same reasoning as
    # _fade_out_before_playback: a media_pause mid-note is exactly the
    # abrupt cut Johann asked us to soften. Muted players are left out —
    # muting is instantaneous by nature and its snapshot doesn't carry a
    # level to ramp from. The restore path is unchanged: it already puts
    # each player's real volume back before resuming.
    fade_secs = _fade_seconds(options)
    if fade_secs > 0:
        fade_plan = {
            item["entity_id"]: (float(item["volume_level"]), 0.0)
            for item in snapshot
            if item.get("method") in ("pause", "volume_zero")
            and item.get("volume_level") is not None
        }
        await _fade_players(hass, fade_plan, fade_secs, "duck fade-out")

    if to_pause:
        try:
            await hass.services.async_call(
                "media_player", "media_pause",
                {"entity_id": to_pause},
                blocking=True,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to pause duck media players %s (%s)", to_pause, err)
    if to_mute:
        try:
            await hass.services.async_call(
                "media_player", "volume_mute",
                {"entity_id": to_mute, "is_volume_muted": True},
                blocking=True,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to mute duck media players %s (%s)", to_mute, err)
    if to_zero:
        try:
            await hass.services.async_call(
                "media_player", "volume_set",
                {"entity_id": to_zero, "volume_level": 0.0},
                blocking=True,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to zero-volume duck media players %s (%s)", to_zero, err)

    _LOGGER.debug(
        "Ducked media players — paused: %s, muted: %s, zeroed: %s", to_pause, to_mute, to_zero
    )
    return snapshot


async def _wait_until_idle(
    hass: HomeAssistant, players: list[str], timeout: float = 600.0
) -> None:
    """Block until every entity in `players` has left the "playing" state,
    or `timeout` seconds pass — whichever comes first.

    2.1.26. Used to know when the pre-adhan jingle / adhan itself has
    actually finished so ducked media players can be resumed at the
    right moment, without needing to know the sound file's exact
    duration up front. The timeout is a safety net: if a player's state
    never settles (a flaky integration, a stream that hangs) ducked
    players still eventually get restored rather than staying paused
    indefinitely.
    """
    if not players:
        return
    await asyncio.sleep(2)  # grace period for play_media to actually start
    elapsed = 2.0
    while elapsed < timeout:
        states = [hass.states.get(p) for p in players]
        if all(s is None or s.state != "playing" for s in states):
            return
        await asyncio.sleep(1)
        elapsed += 1.0
    _LOGGER.warning(
        "Duck media: timed out waiting for %s to finish; restoring ducked players anyway",
        players,
    )


async def _restore_duck_media_players(
    hass: HomeAssistant, snapshot: list[dict], options: dict
) -> None:
    """Undo whatever _duck_media_players did to each entity, per its
    snapshotted `method`.

    2.1.26. For paused players: volume first, THEN resume playback — Johann's
    explicit requirement, otherwise a player could audibly resume for a
    moment at whatever level it happened to be paused at, if volume_set
    lands a beat late.

    2.1.42 — extended for the two new duck methods (see _duck_media_players'
    docstring): "mute" only unmutes if the player wasn't already muted
    before we ducked it (so we never override a mute the user set on
    purpose), and "volume_zero" just restores the real volume — the
    player was never actually paused for that method, so there's no
    media_play call to make.

    2.2.2 — new `options` param, used only to fire the Mac-shortcut
    restore notify (_notify_mac_shortcut). This happens unconditionally,
    BEFORE the `if not snapshot: return` below, since the Mac-shortcut
    duck notify in _duck_media_players is never reflected in `snapshot`
    (it's not a media_player entity) — callers now always call this
    function (no more `if duck_snapshot:` guard at the call sites) so the
    restore notify still fires even on a run where zero media_player
    entities got ducked.
    """
    await _notify_mac_shortcut(hass, options, DUCK_MAC_SHORTCUT_RESTORE_MESSAGE)
    if not snapshot:
        return
    for item in snapshot:
        entity_id = item["entity_id"]
        method = item.get("method", "pause")
        try:
            if method == "pause":
                volume = item.get("volume_level")
                if volume is not None:
                    await _set_volume_safe(hass, [entity_id], volume, f"duck-restore {entity_id}")
                await hass.services.async_call(
                    "media_player", "media_play",
                    {"entity_id": entity_id},
                    blocking=False,
                )
            elif method == "mute":
                if not item.get("was_muted", False):
                    await hass.services.async_call(
                        "media_player", "volume_mute",
                        {"entity_id": entity_id, "is_volume_muted": False},
                        blocking=False,
                    )
            elif method == "volume_zero":
                volume = item.get("volume_level")
                if volume is not None:
                    await _set_volume_safe(hass, [entity_id], volume, f"duck-restore {entity_id}")
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to resume ducked player %s (%s)", entity_id, err)
    _LOGGER.debug("Restored duck media players: %s", [i["entity_id"] for i in snapshot])


# 2.3.2 — fade granularity. 10 steps over the configured duration is
# smooth enough not to hear stepping on a 2s ramp, while keeping the
# call count low: each step is one volume_set per player, and Sonos in
# particular gets unhappy if you machine-gun it.
_FADE_STEPS = 10
# Beat of silence between the music stopping and the adhan starting.
# Without it the two run into each other and the "fade" isn't audible as
# a hand-over at all.
_FADE_GAP = 0.6


def _fade_seconds(options: dict) -> float:
    if not bool(options.get(OPT_FADE_ENABLED, DEFAULT_FADE_ENABLED)):
        return 0.0
    try:
        secs = float(options.get(OPT_FADE_SECONDS, DEFAULT_FADE_SECONDS))
    except (TypeError, ValueError):
        secs = DEFAULT_FADE_SECONDS
    return max(FADE_SECONDS_MIN, min(FADE_SECONDS_MAX, secs))


async def _fade_players(
    hass: HomeAssistant, plan: dict[str, tuple[float, float]], seconds: float, label: str
) -> None:
    """Ramp each player in `plan` from its own start level to its own end
    level over `seconds` (2.3.2).

    Per-player rather than one shared level because each speaker can be
    at a different volume, and a fade that first equalises them would be
    a jump in its own right. Steps are issued concurrently per tick so a
    slow player can't stretch the ramp for the others.
    """
    if seconds <= 0 or not plan:
        return
    step_delay = seconds / _FADE_STEPS
    for i in range(1, _FADE_STEPS + 1):
        progress = i / _FADE_STEPS
        await asyncio.gather(*[
            _set_volume_safe(
                hass, [entity_id],
                max(0.0, min(1.0, start + (end - start) * progress)),
                label,
            )
            for entity_id, (start, end) in plan.items()
        ])
        await asyncio.sleep(step_delay)


def _live_volumes(hass: HomeAssistant, players: list[str]) -> dict[str, float]:
    """Current volume_level of every player in `players` that is actually
    playing right now. Used as the fade's starting point.
    """
    out: dict[str, float] = {}
    for entity_id in players:
        state = hass.states.get(entity_id)
        if state is None or state.state != "playing":
            continue
        level = state.attributes.get("volume_level")
        if level is not None:
            out[entity_id] = float(level)
    return out


async def _fade_out_before_playback(
    hass: HomeAssistant, options: dict, players: list[str]
) -> None:
    """Ease music off the adhan speakers before the adhan takes them over
    (2.3.2 — see const.py's OPT_FADE_ENABLED for the "why").

    Order matters: ramp to silence, THEN pause. Pausing first would be
    the same hard cut we're removing, and pausing after the caller sets
    the adhan volume would briefly play the music at adhan level.

    No-op when nothing is playing, which is the usual case — so the adhan
    keeps firing immediately unless there is genuinely something to fade.
    """
    seconds = _fade_seconds(options)
    if seconds <= 0:
        return
    active = _live_volumes(hass, players)
    if not active:
        return

    _LOGGER.debug("Fading out %s over %.1fs before playback", list(active), seconds)
    await _fade_players(
        hass, {p: (v, 0.0) for p, v in active.items()}, seconds, "fade-out"
    )

    # Silent now, so this pause is inaudible. media_pause is tried first
    # (it keeps the position for players whose own resume we rely on);
    # media_stop is the fallback for anything that can't pause, mirroring
    # _duck_media_players' feature-based branching.
    entities = list(active)
    for service in ("media_pause", "media_stop"):
        try:
            await hass.services.async_call(
                "media_player", service, {"entity_id": entities}, blocking=True,
            )
            break
        except Exception as err:  # noqa: BLE001
            _LOGGER.debug("%s failed on %s during fade-out (%s)", service, entities, err)

    await asyncio.sleep(_FADE_GAP)


def _is_sonos(hass: HomeAssistant, entity_id: str) -> bool:
    """Is this media_player a Sonos speaker?

    2.3.5 — the entity registry is now asked FIRST. The old version was
    attribute-sniffing only (queue_size, or TV/Line-in in source_list),
    on the reasoning that a Sonos zone can also surface through Spotify
    Connect or Music Assistant while still answering to sonos.snapshot.
    That reasoning still holds, so the sniff is kept as a fallback — but
    as the only check it was too easily fooled. A group helper wrapping
    three Sonos zones exposes none of those attributes, so Johann's setup
    was classified "not Sonos" and quietly lost both sonos.snapshot and
    the announce path even with announcements switched on.

    _expand_players now resolves group helpers before this is reached, so
    the registry lookup lands on the real zone and gives a definitive
    answer for the common case.
    """
    entry = er.async_get(hass).async_get(entity_id)
    if entry is not None and entry.platform == "sonos":
        return True
    state = hass.states.get(entity_id)
    if state is None:
        return False
    attrs = state.attributes
    if "queue_size" in attrs:
        return True
    sources = attrs.get("source_list") or []
    return "TV" in sources or "Line-in" in sources


async def _snapshot_adhan_players(
    hass: HomeAssistant, options: dict, players: list[str]
) -> dict | None:
    """Save what's playing on the adhan speakers so it can resume after
    (2.2.3). Returns None when the feature is off or nothing was playing.

    Sonos speakers go through sonos.snapshot (with_group=True, so a
    grouped zone comes back grouped and at the same queue position) —
    the only way to genuinely restore a queue. Everything else gets a
    volume+state snapshot, which can resume a paused stream but not a
    position; that's a platform limit, not something we can work around.

    Only players actually playing are captured, so a speaker the user had
    deliberately stopped never gets started by the restore.
    """
    if not bool(options.get(OPT_RESTORE_PLAYBACK_ENABLED, DEFAULT_RESTORE_PLAYBACK_ENABLED)):
        return None

    sonos: list[str] = []
    generic: dict[str, dict] = {}
    # 2.2.4 — every captured player's pre-existing level, Sonos included
    # (its own restore handles volume, but the pre-adhan dip needs to know
    # what the music was at to compute a fraction of it).
    volumes: dict[str, float | None] = {}
    sonos_available = hass.services.has_service("sonos", "snapshot")

    for entity_id in players:
        state = hass.states.get(entity_id)
        if state is None or state.state != "playing":
            continue
        volumes[entity_id] = state.attributes.get("volume_level")
        if sonos_available and _is_sonos(hass, entity_id):
            sonos.append(entity_id)
        else:
            generic[entity_id] = {"volume_level": state.attributes.get("volume_level")}

    if sonos:
        try:
            await hass.services.async_call(
                "sonos", "snapshot",
                {"entity_id": sonos, "with_group": True},
                blocking=True,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning(
                "sonos.snapshot failed for %s (%s); falling back to volume-only restore",
                sonos, err,
            )
            for entity_id in sonos:
                state = hass.states.get(entity_id)
                if state is not None:
                    generic[entity_id] = {
                        "volume_level": state.attributes.get("volume_level")
                    }
            sonos = []

    if not sonos and not generic:
        return None
    _LOGGER.debug("Snapshotted adhan players — sonos: %s, generic: %s", sonos, list(generic))
    return {"sonos": sonos, "generic": generic, "volumes": volumes}


async def _apply_pre_adhan_volume(
    hass: HomeAssistant,
    options: dict,
    players: list[str],
    snapshot: dict | None,
    configured: float | None,
    label: str,
) -> None:
    """Set the speaker volume for a pre-adhan jingle/TTS (2.2.4).

    A speaker that's already playing something gets a DIP — a percentage
    of the level its own music is at — instead of jumping to the
    configured pre-adhan level. Johann: setting the configured level
    before play_media made the music itself audibly jump up first, which
    defeats the point of a gentle heads-up. Anything idle (or with no
    reported volume_level) still gets the configured volume exactly as
    before, so this only ever changes behaviour when there was music to
    be gentle about in the first place.

    Applied per entity rather than as one level for all `players`,
    because each speaker's music level (and therefore its dip) can
    differ. Restoring the pre-dip level is 2.2.3's snapshot restore —
    nothing extra needed here.
    """
    dip_on = bool(options.get(OPT_PRE_ADHAN_DIP_ENABLED, DEFAULT_PRE_ADHAN_DIP_ENABLED))
    volumes = (snapshot or {}).get("volumes") or {}

    if not (dip_on and volumes):
        if configured is not None:
            await _set_volume_safe(hass, players, configured, label)
        return

    try:
        factor = int(options.get(OPT_PRE_ADHAN_DIP_FACTOR, DEFAULT_PRE_ADHAN_DIP_FACTOR))
    except (TypeError, ValueError):
        factor = DEFAULT_PRE_ADHAN_DIP_FACTOR
    factor = max(0, min(100, factor))

    undipped: list[str] = []
    for entity_id in players:
        level = volumes.get(entity_id)
        if level is None:
            # Either not playing, or a player that doesn't report a
            # volume_level — nothing to compute a dip from either way.
            undipped.append(entity_id)
            continue
        dipped = max(0.0, min(1.0, float(level) * factor / 100.0))
        await _set_volume_safe(hass, [entity_id], dipped, f"{label} dip")
        _LOGGER.debug(
            "%s: dipped %s from %.2f to %.2f (%d%%)", label, entity_id, level, dipped, factor
        )

    if undipped and configured is not None:
        await _set_volume_safe(hass, undipped, configured, label)


async def _restore_adhan_players(hass: HomeAssistant, snapshot: dict | None) -> None:
    """Resume whatever _snapshot_adhan_players captured (2.2.3).

    Volume before media_play for the generic path, same ordering rule as
    the duck restore: otherwise a speaker can audibly resume for a moment
    at adhan volume before volume_set lands.
    """
    if not snapshot:
        return

    if snapshot.get("sonos"):
        try:
            await hass.services.async_call(
                "sonos", "restore",
                {"entity_id": snapshot["sonos"], "with_group": True},
                blocking=False,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("sonos.restore failed for %s (%s)", snapshot["sonos"], err)

    for entity_id, info in (snapshot.get("generic") or {}).items():
        try:
            volume = info.get("volume_level")
            if volume is not None:
                await _set_volume_safe(hass, [entity_id], volume, f"restore {entity_id}")
            await hass.services.async_call(
                "media_player", "media_play",
                {"entity_id": entity_id},
                blocking=False,
            )
        except Exception as err:  # noqa: BLE001
            _LOGGER.warning("Failed to restore playback on %s (%s)", entity_id, err)
    _LOGGER.debug("Restored adhan players")


async def _random_adhan_rel(
    hass: HomeAssistant, prayer: str, fallback_rel: str
) -> str:
    """Pick a random locally downloaded sound for the prayer's category.

    Fajr prayers draw from fajr_adhan items, the rest from adhan items.
    Only files that actually exist under www/nida/sounds/ qualify — a
    catalog entry that was never downloaded would 404 at adhan time.
    Import of catalog helpers is local to avoid touching module import
    order. Returns fallback_rel when no candidate qualifies or the
    catalog is unreachable.

    2.1.29 — the pick is now seeded by today's date + prayer instead of
    the process-global random state, so it's DETERMINISTIC within a
    given day: calling this again for the same prayer today (e.g. from
    scheduler.py's notify handler, resolving which file will play so it
    can look up its duration for the Android TV notification) returns
    the exact same file, with no shared state between the two call
    sites needed. Still varies day to day and prayer to prayer, so the
    actual "random adhan" experience is unchanged — you just can't get
    two different reciters for the same prayer on the same day anymore,
    which was never really the point of the feature anyway.
    """
    from .catalog import async_fetch_catalog, local_sound_exists

    category = PRAYER_SOUND_CATEGORY.get(prayer, SOUND_CATEGORY_ADHAN)
    try:
        cat = await async_fetch_catalog(hass)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Random adhan: catalog fetch failed (%s)", err)
        return fallback_rel
    candidates = [
        s["rel_path"]
        for s in cat.get("sounds", [])
        if s.get("category") == category
        and s.get("rel_path")
        and local_sound_exists(hass, s["rel_path"])
    ]
    if not candidates:
        _LOGGER.debug(
            "Random adhan: no downloaded candidates for %s; using configured sound",
            category,
        )
        return fallback_rel
    seed = f"{dt_util.now().date().isoformat()}-{prayer}"
    chosen = random.Random(seed).choice(candidates)
    _LOGGER.debug("Random adhan for %s: %s (of %d)", prayer, chosen, len(candidates))
    return chosen


async def async_resolve_adhan_sound_rel(
    hass: HomeAssistant, options: dict, prayer: str
) -> str:
    """The exact sound_rel _async_handle_play_adhan will play for `prayer`
    today — same fixed-sound-or-random resolution, exposed so
    scheduler.py's notify handler can independently look up its duration
    (for the Android TV notification, 2.1.29) without needing to share
    state with the real playback call. Relies on _random_adhan_rel's
    date+prayer-seeded pick to land on the same file both times.
    """
    sound_rel = _sound_path_for(options, prayer)
    if bool(options.get(OPT_RANDOM_ADHAN_ENABLED)):
        sound_rel = await _random_adhan_rel(hass, prayer, sound_rel)
    return sound_rel


async def _async_handle_play_dua(hass: HomeAssistant, call: ServiceCall) -> None:
    """Play a configured dua on its OWN media player (2.0.51).

    Manual-only playback: deliberately no guest-mode/night/open-contact
    checks — whoever calls this (panel test button, button entity, an
    automation the user wired up) explicitly wants to hear the dua,
    exactly like the existing test services bypass guest mode.
    """
    dua_id = call.data["dua_id"]
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    dua = next(
        (
            d
            for d in (options.get(OPT_DUAS) or [])
            if isinstance(d, dict) and d.get("id") == dua_id
        ),
        None,
    )
    if dua is None:
        _LOGGER.warning("nida.play_dua: unknown dua_id %s", dua_id)
        return

    sound_rel = dua.get("sound")
    if not sound_rel:
        _LOGGER.warning("nida.play_dua: dua %s has no sound configured", dua_id)
        return

    player = dua.get("media_player")
    if not player:
        _LOGGER.warning("nida.play_dua: dua %s has no media player configured", dua_id)
        return
    players = [player]

    try:
        vol_pct = int(dua.get("volume", DEFAULT_DUA_VOLUME))
    except (TypeError, ValueError):
        vol_pct = DEFAULT_DUA_VOLUME
    vol_pct = max(0, min(100, vol_pct))
    await _set_volume_safe(hass, players, vol_pct / 100.0, f"dua {dua_id}")

    media_url = f"/local/nida/sounds/{sound_rel}"
    _LOGGER.info("Playing dua %s on %s: %s", dua_id, players, media_url)
    await _play_media_safe(hass, players, media_url, f"dua {dua_id}")


async def _play_sound_on_speakers(
    hass: HomeAssistant,
    options: dict,
    players: list[str],
    sound_rel: str,
    volume: float | None,
    label: str,
    *,
    dip: bool = False,
) -> None:
    """Take the speakers, play `sound_rel`, hand them back (2.3.4).

    The shared "one sound goes out over the house" sequence, previously
    copy-pasted across four handlers with small drifts between them —
    play_test_sound in particular never grew the duck/snapshot/restore
    the others got, so a speaker test simply killed whatever music was
    on (Johann: "met Nasheed zou het fijn zijn als je muziek afspeelt dat
    hij daarna hervat met de juiste volume").

    Two routes, chosen per player: Sonos announcements where enabled and
    available (the speaker handles duck + restore itself), the manual
    snapshot/fade/restore path everywhere else. A mixed target list gets
    both at once.

    `dip` picks the pre-adhan volume treatment (2.2.4) over a plain
    volume_set, and only affects the manual route — an announcement never
    touches the music's own level to begin with, so there is nothing to
    dip.
    """
    media_url = f"/local/nida/sounds/{sound_rel}"
    announce_players, manual_players = _split_announce_targets(hass, options, players)

    duck_snapshot = await _duck_media_players(hass, options, exclude=players)

    if announce_players:
        await _play_announcement(hass, announce_players, media_url, volume, label)

    play_snapshot = None
    if manual_players:
        play_snapshot = await _snapshot_adhan_players(hass, options, manual_players)
        await _fade_out_before_playback(hass, options, manual_players)
        if dip:
            await _apply_pre_adhan_volume(
                hass, options, manual_players, play_snapshot, volume, label
            )
        elif volume is not None:
            await _set_volume_safe(hass, manual_players, volume, label)

    try:
        if manual_players:
            _LOGGER.info("Playing %s on %s: %s", label, manual_players, media_url)
            await _play_media_safe(hass, manual_players, media_url, label)
    finally:
        if manual_players:
            await _wait_until_idle(hass, manual_players)
        elif duck_snapshot:
            # Announce-only run with other players ducked. _wait_until_idle
            # is useless here: an announcement plays as a Sonos audio clip
            # over the existing stream, so the entity never enters (or
            # leaves) a "playing" state we could poll on. Fall back to the
            # file's real length, which mutagen can read off disk, plus a
            # small margin. Without this the ducked TV would come back
            # immediately, talking over the sound we just started.
            await asyncio.sleep(await _announce_wait_seconds(hass, sound_rel))
        await _restore_duck_media_players(hass, duck_snapshot, options)
        await _restore_adhan_players(hass, play_snapshot)


async def _announce_wait_seconds(hass: HomeAssistant, sound_rel: str) -> float:
    """How long to hold ducked players while an announcement plays.

    Local import of the catalog helper, matching _random_adhan_rel's
    existing convention in this file. Falls back to a conservative 15s if
    the length can't be read, and caps at 10 minutes so a bad read can
    never strand a paused TV.
    """
    from .catalog import async_sound_duration_seconds

    try:
        duration = await async_sound_duration_seconds(hass, sound_rel)
    except Exception as err:  # noqa: BLE001
        _LOGGER.debug("Could not read duration of %s (%s)", sound_rel, err)
        duration = None
    return min(600.0, float(duration or 15) + 2.0)


async def _async_handle_play_preview(hass: HomeAssistant, call: ServiceCall) -> None:
    """Play any of Nida's configured sounds on the real speakers at its
    real volume, so the user can judge how loud it will actually be
    (2.3.0 — see the PREVIEW_* constants for the "why").

    Three deliberate decisions about what "real volume" means here:

      * Night mode / open-contact ARE applied (_apply_volume_modifiers),
        because the honest answer to "how loud is this" is how loud it
        would be if it fired right now — testing at 23:00 should sound
        like 23:00.
      * The 2.2.4 pre-adhan dip is NOT applied. The dip is relative to
        music that may or may not be playing, so folding it in would make
        the same button produce a different level run to run — useless
        when you're dragging a volume slider and listening for the
        result.
      * Guest mode is NOT checked, matching every other test path here:
        pressing a play button is an explicit user action.

    Duck + snapshot/restore run exactly as they would for the real
    thing, so previewing never leaves music dead on the speakers.
    """
    item = call.data["item"]
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    if item == PREVIEW_FAJR_ALARM:
        # The Fajr wake-up alarm has its own player and its own volume,
        # and scheduler.py's _async_play_fajr_alarm_sound deliberately
        # skips the volume modifiers — so the preview skips them too
        # rather than being "truthful" in a way the real alarm isn't.
        sound_rel = options.get(OPT_FAJR_ALARM_SOUND) or ""
        player = options.get(OPT_FAJR_ALARM_MEDIA_PLAYER) or ""
        players = [player] if player else []
        try:
            vol_pct = int(options.get(OPT_FAJR_ALARM_VOLUME, DEFAULT_FAJR_ALARM_VOLUME))
        except (TypeError, ValueError):
            vol_pct = DEFAULT_FAJR_ALARM_VOLUME
        volume = max(0, min(100, vol_pct)) / 100.0
    else:
        players = _resolve_media_players(hass, dict(call.data), options)
        if item in (PREVIEW_ADHAN, PREVIEW_FAJR_ADHAN):
            # Routed through the same resolver the scheduler uses, so a
            # preview with random-adhan on plays the file that would
            # actually fire today rather than the fixed fallback.
            prayer = "fajr" if item == PREVIEW_FAJR_ADHAN else "dhuhr"
            sound_rel = await async_resolve_adhan_sound_rel(hass, options, prayer)
            volume = _volume_for_prayer(options, prayer)
        elif item == PREVIEW_PRE_ADHAN_JINGLE:
            sound_rel = _pre_adhan_jingle_path(options)
            volume = _volume_for_category(options, SOUND_CATEGORY_PRE_ADHAN_JINGLE)
        else:
            sound_rel = TEST_SOUND_PATH
            raw = options.get(OPT_VOLUME_TEST, DEFAULT_VOLUME_TEST)
            try:
                volume = max(0, min(100, int(raw))) / 100.0
            except (TypeError, ValueError):
                volume = DEFAULT_VOLUME_TEST / 100.0
        volume = _apply_volume_modifiers(volume, hass, options)

    if not players:
        _LOGGER.warning(
            "nida.play_preview: no media player resolved for %s; nothing played", item
        )
        return
    if not sound_rel:
        _LOGGER.warning(
            "nida.play_preview: no sound configured for %s; nothing played", item
        )
        return

    await _play_sound_on_speakers(
        hass, options, players, sound_rel, volume, f"preview {item}",
    )


async def _async_handle_play_adhan(hass: HomeAssistant, call: ServiceCall) -> None:
    prayer = call.data["prayer"]

    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    if _guest_mode_active(options):
        _LOGGER.info("Guest mode active — skipping adhan for %s", prayer)
        return

    # 2.0.52 — random adhan: replace the fixed choice with a random
    # locally downloaded sound from the prayer's category. Catalog fetch
    # is cached, so this is cheap at fire time; any failure falls back
    # to the configured sound rather than skipping the adhan.
    # 2.1.29 — resolution moved into async_resolve_adhan_sound_rel so
    # scheduler.py's notify handler can independently arrive at the same
    # choice (for the Android TV notification's duration) without this
    # function needing to share any state with it.
    sound_rel = await async_resolve_adhan_sound_rel(hass, options, prayer)

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.play_adhan: no media players resolved; nothing played"
        )
        return

    # 2.3.4 — the whole duck / snapshot / fade / play / restore sequence
    # now lives in _play_sound_on_speakers, shared with the jingle, the
    # speaker test and the preview.
    volume = _apply_volume_modifiers(_volume_for_prayer(options, prayer), hass, options)
    await _play_sound_on_speakers(
        hass, options, players, sound_rel, volume, f"adhan {prayer}",
    )


async def _async_handle_play_pre_adhan_jingle(
    hass: HomeAssistant, call: ServiceCall
) -> None:
    """Play the configured pre-adhan jingle on the adhan speakers."""
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    if _guest_mode_active(options):
        _LOGGER.info("Guest mode active — skipping pre-adhan jingle")
        return

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.play_pre_adhan_jingle: no media players resolved; nothing played"
        )
        return

    sound_rel = _pre_adhan_jingle_path(options)

    volume = _apply_volume_modifiers(
        _volume_for_category(options, SOUND_CATEGORY_PRE_ADHAN_JINGLE),
        hass,
        options,
    )
    # dip=True — 2.2.4's "lower the music rather than jump up to the
    # jingle level" treatment, which only applies to pre-adhan sounds.
    await _play_sound_on_speakers(
        hass, options, players, sound_rel, volume, "pre-adhan jingle", dip=True,
    )


async def _async_handle_play_test_sound(hass: HomeAssistant, call: ServiceCall) -> None:
    """Play the test jingle with the dedicated test volume."""
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.play_test_sound: no media players resolved; nothing played"
        )
        return

    # Dedicated test volume (volume_test), not volume_adhan. Test still
    # honours night-mode so the user sees real behaviour during tests
    # planned at night-mode hours.
    raw = options.get(OPT_VOLUME_TEST, DEFAULT_VOLUME_TEST)
    try:
        volume = max(0, min(100, int(raw))) / 100.0
    except (TypeError, ValueError):
        volume = DEFAULT_VOLUME_TEST / 100.0
    volume = _apply_volume_modifiers(volume, hass, options)

    # 2.3.4 — this handler used to just set the volume and fire
    # play_media, with no duck, snapshot, fade or restore at all: testing
    # your speakers while music was on simply killed the music. It now
    # goes through the same sequence as everything else.
    await _play_sound_on_speakers(
        hass, options, players, TEST_SOUND_PATH, volume, "speaker test",
    )


async def _async_handle_play_pre_adhan_test(
    hass: HomeAssistant, call: ServiceCall
) -> None:
    """Play the configured pre-adhan jingle with the dedicated test volume.

    Distinct from nida.play_pre_adhan_jingle (which uses the
    scheduled-playback volume volume_pre_adhan_jingle). This one reads
    volume_pre_adhan_test so the user can audition loudly without
    changing what fires at adhan time. Night-mode is still honoured.
    """
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.play_pre_adhan_test: no media players resolved; nothing played"
        )
        return

    sound_rel = _pre_adhan_jingle_path(options)

    # 2.1.27 — the "Test pre-adhan jingle" button is the quickest way to
    # actually hear the duck/restore behaviour (a few seconds, vs. waiting
    # for a real prayer time), so it goes through the same sequence as the
    # real scheduled jingle (_async_handle_play_pre_adhan_jingle).
    raw = options.get(OPT_VOLUME_PRE_ADHAN_TEST, DEFAULT_VOLUME_PRE_ADHAN_TEST)
    try:
        volume = max(0, min(100, int(raw))) / 100.0
    except (TypeError, ValueError):
        volume = DEFAULT_VOLUME_PRE_ADHAN_TEST / 100.0
    volume = _apply_volume_modifiers(volume, hass, options)
    await _play_sound_on_speakers(
        hass, options, players, sound_rel, volume, "pre-adhan test", dip=True,
    )


async def _async_handle_speak_pre_adhan(
    hass: HomeAssistant, call: ServiceCall
) -> None:
    """Speak the configured pre-adhan announcement via one or more TTS engines.

    Fans out to every entity in options.tts_pre_adhan_services. Each
    call goes through HA's universal `tts.speak`, which works with any
    TTS engine (Google Translate, Nabu Casa Cloud, Piper, ...). The
    same message text is sent to all of them — multi-select is for
    multi-zone setups where different speakers are bound to different
    TTS engines, not for hearing the same line twice in a row.
    """
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    if (
        _guest_mode_active(options)
        and call.data.get("prayer") != "test"
        and not call.data.get("preview")
    ):
        # Scheduled announcements are muted; the panel's Test button
        # (prayer="test") stays functional — an explicit user action.
        # 2.3.0 — so does a preview, which passes a REAL prayer name (to
        # get the real volume) and therefore needs its own exemption.
        _LOGGER.info("Guest mode active — skipping pre-adhan TTS")
        return

    tts_entities = list(options.get(OPT_TTS_PRE_ADHAN_SERVICES) or [])
    if not tts_entities:
        _LOGGER.debug("nida.speak_pre_adhan: no TTS entities configured")
        return

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.speak_pre_adhan: no media players resolved; nothing spoken"
        )
        return

    # 2.1.30 — duck/restore around the TTS announcement too, not just the
    # jingle. Johann: "de pauze van de media player is met pre-adhan
    # alleen de jingle en niet de tts" — someone with only TTS enabled
    # (no jingle) got no ducking at all, and someone with both got the
    # ducked player resumed again before the TTS spoke over it. The
    # restore happens in a finally around the whole function body below
    # (see the try at the bottom) so it still runs if tts.speak errors.
    duck_snapshot = await _duck_media_players(hass, options, exclude=players)
    play_snapshot = await _snapshot_adhan_players(hass, options, players)
    # 2.3.2 — ease the music off these speakers before taking them
    # over; no-op when nothing is playing on them.
    await _fade_out_before_playback(hass, options, players)

    try:
        # 2.0.70 — set the speaker volume before speaking. Scheduled calls
        # use the jingle volume (same speakers, same moment); the panel's
        # Test button uses the dedicated test volume so it does not
        # accidentally blast at full power.
        is_test = call.data.get("prayer") == "test"
        if is_test:
            volume = (
                int(options.get(f"{OPT_VOLUME_PREFIX}pre_adhan_test",
                                DEFAULT_VOLUME_PRE_ADHAN_TEST)) / 100.0
            )
        else:
            volume = _volume_for_category(
                options, SOUND_CATEGORY_PRE_ADHAN_JINGLE
            )
        await _apply_pre_adhan_volume(
            hass, options, players, play_snapshot, volume, "pre-adhan TTS"
        )

        # Language priority: explicit call override > TTS-specific option
        # > panel language > HA system language. Each "auto" falls through.
        # 2.0.56 — resolved BEFORE the message, which now depends on it.
        lang = call.data.get("language")
        if not lang:
            tts_lang = options.get(OPT_TTS_PRE_ADHAN_LANGUAGE) or "auto"
            if tts_lang and tts_lang != "auto":
                lang = tts_lang
        if not lang:
            opt_lang = options.get("language") or "auto"
            lang = opt_lang if opt_lang != "auto" else (hass.config.language or "en")

        # Message template (2.0.56): a customised message always wins; an
        # empty field or a field still equal to one of the known defaults
        # (any language) means "not customised", in which case the sentence
        # follows the resolved TTS language. Substitute [prayer] if a prayer
        # was passed in the call.
        template = _resolve_tts_message(options, lang)
        prayer = call.data.get("prayer")
        message = template.replace("[prayer]", prayer.capitalize()) if prayer else template

        # Language handling (2.0.44). There is NO single form every engine
        # accepts: Google Translate TTS wants the bare 2-letter code ("en")
        # and rejects regional forms, while HA Cloud and OpenAI TTS reject
        # the bare code ("Language 'en' not supported") and want a full
        # locale ("en-US"). So instead of normalising to one shape, we build
        # an ordered candidate list (configured value, 2-letter, common
        # regional default) and let each engine try them in order below —
        # falling back to NO language parameter at all (engine default) if
        # every candidate is rejected.
        candidates = _language_candidates(lang)

        for tts_entity in tts_entities:
            if not isinstance(tts_entity, str) or "." not in tts_entity:
                continue
            # `language` is a TOP-LEVEL parameter of tts.speak, not an entry
            # in `options`. Earlier we (incorrectly) put it inside options
            # which Cloud + several other engines reject with "Invalid
            # options found: ['language']". `options` is for engine-
            # specific knobs (voice name, gender, speed) — we don't set
            # any, so omit the dict entirely.
            #
            # blocking=True on purpose (2.0.44): with blocking=False the
            # "Language 'X' not supported" error surfaced later in HA core
            # where our try/except could never catch it — services.py then
            # logged a success while nothing played. Blocking lets us catch
            # the rejection and retry with the next candidate.
            base_data = {
                "entity_id": tts_entity,
                "media_player_entity_id": players,
                "message": message,
            }
            spoke = False
            for cand in candidates:
                try:
                    await hass.services.async_call(
                        "tts", "speak", {**base_data, "language": cand},
                        blocking=True,
                    )
                    _LOGGER.info(
                        "Spoke pre-adhan via %s on %s (lang=%s)",
                        tts_entity, players, cand,
                    )
                    spoke = True
                    break
                except HomeAssistantError as err:
                    if "not supported" in str(err).lower():
                        _LOGGER.debug(
                            "tts.speak %s rejected lang=%s, trying next",
                            tts_entity, cand,
                        )
                        continue
                    _LOGGER.warning("tts.speak failed for %s: %s", tts_entity, err)
                    spoke = True  # non-language error: don't retry blindly
                    break
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning("tts.speak failed for %s: %s", tts_entity, err)
                    spoke = True
                    break
            if not spoke:
                # Every language candidate was rejected — let the engine use
                # its own default language/voice.
                try:
                    await hass.services.async_call(
                        "tts", "speak", base_data, blocking=True,
                    )
                    _LOGGER.info(
                        "Spoke pre-adhan via %s on %s (engine default language)",
                        tts_entity, players,
                    )
                except Exception as err:  # noqa: BLE001
                    _LOGGER.warning(
                        "tts.speak failed for %s even without language: %s",
                        tts_entity, err,
                    )
    finally:
        # 2.1.30 — tts.speak's blocking=True only waits for the service
        # call itself, not for the spoken audio to finish playing on
        # `players` — so we still need to wait for real playback to end
        # before restoring, same as the jingle/adhan handlers.
        await _wait_until_idle(hass, players)
        await _restore_duck_media_players(hass, duck_snapshot, options)
        await _restore_adhan_players(hass, play_snapshot)


def async_register_services(hass: HomeAssistant) -> None:
    """Register all Nida services."""
    if not hass.services.has_service(DOMAIN, SERVICE_PLAY_ADHAN):
        async def _wrapper_adhan(call: ServiceCall) -> None:
            await _async_handle_play_adhan(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_PLAY_ADHAN, _wrapper_adhan, schema=PLAY_ADHAN_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_PLAY_PRE_ADHAN_JINGLE):
        async def _wrapper_pre(call: ServiceCall) -> None:
            await _async_handle_play_pre_adhan_jingle(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_PLAY_PRE_ADHAN_JINGLE, _wrapper_pre,
            schema=PLAY_PRE_ADHAN_JINGLE_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_PLAY_TEST_SOUND):
        async def _wrapper_test(call: ServiceCall) -> None:
            await _async_handle_play_test_sound(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_PLAY_TEST_SOUND, _wrapper_test,
            schema=PLAY_TEST_SOUND_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_PLAY_PRE_ADHAN_TEST):
        async def _wrapper_pre_test(call: ServiceCall) -> None:
            await _async_handle_play_pre_adhan_test(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_PLAY_PRE_ADHAN_TEST, _wrapper_pre_test,
            schema=PLAY_PRE_ADHAN_TEST_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_SPEAK_PRE_ADHAN):
        async def _wrapper_speak(call: ServiceCall) -> None:
            await _async_handle_speak_pre_adhan(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_SPEAK_PRE_ADHAN, _wrapper_speak,
            schema=SPEAK_PRE_ADHAN_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_PLAY_PREVIEW):
        async def _wrapper_preview(call: ServiceCall) -> None:
            await _async_handle_play_preview(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_PLAY_PREVIEW, _wrapper_preview,
            schema=PLAY_PREVIEW_SCHEMA,
        )

    if not hass.services.has_service(DOMAIN, SERVICE_PLAY_DUA):
        async def _wrapper_dua(call: ServiceCall) -> None:
            await _async_handle_play_dua(hass, call)
        hass.services.async_register(
            DOMAIN, SERVICE_PLAY_DUA, _wrapper_dua, schema=PLAY_DUA_SCHEMA,
        )


def async_unregister_services(hass: HomeAssistant) -> None:
    """Remove Nida services. Only called when no Nida entries remain."""
    for svc in (
        SERVICE_PLAY_DUA,
        SERVICE_PLAY_PREVIEW,
        SERVICE_PLAY_ADHAN,
        SERVICE_PLAY_PRE_ADHAN_JINGLE,
        SERVICE_PLAY_PRE_ADHAN_TEST,
        SERVICE_PLAY_TEST_SOUND,
        SERVICE_SPEAK_PRE_ADHAN,
    ):
        if hass.services.has_service(DOMAIN, svc):
            hass.services.async_remove(DOMAIN, svc)

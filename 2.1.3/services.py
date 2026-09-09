"""Nida services — user-facing service calls.

Changelog:
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
    Plays sounds/test/test_jingle.mp3 with volume_test for the
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

import logging
import random
from datetime import datetime, time

import voluptuous as vol

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError
from homeassistant.helpers import config_validation as cv
from homeassistant.util import dt as dt_util

from .const import (
    DEFAULT_NIGHT_END,
    DEFAULT_NIGHT_START,
    DEFAULT_NIGHT_VOLUME_FACTOR,
    DEFAULT_OPEN_CONTACT_VOLUME_FACTOR,
    DEFAULT_SOUNDS,
    DEFAULT_TTS_MESSAGES,
    DEFAULT_TTS_PRE_ADHAN_MESSAGE_FALLBACK,
    DEFAULT_VOLUME_PRE_ADHAN_TEST,
    DEFAULT_VOLUME_TEST,
    DEFAULT_DUA_VOLUME,
    DEFAULT_VOLUMES,
    DOMAIN,
    OPT_ADHAN_MEDIA_PLAYERS,
    OPT_DUAS,
    OPT_NIGHT_END,
    OPT_NIGHT_MODE_ENABLED,
    OPT_NIGHT_START,
    OPT_NIGHT_VOLUME_FACTOR,
    OPT_GUEST_MODE_ENABLED,
    OPT_GUEST_MODE_UNTIL,
    OPT_OPEN_CONTACT_ENABLED,
    OPT_OPEN_CONTACT_SENSORS,
    OPT_OPEN_CONTACT_VOLUME_FACTOR,
    OPT_RANDOM_ADHAN_ENABLED,
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


def _resolve_media_players(
    hass: HomeAssistant, call_data: dict, options: dict
) -> list[str]:
    """Pick target players: explicit entity_id wins, else options fallback."""
    raw = call_data.get("entity_id")
    if raw:
        return [raw] if isinstance(raw, str) else list(raw)
    return list(options.get(OPT_ADHAN_MEDIA_PLAYERS) or [])


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
    chosen = random.choice(candidates)
    _LOGGER.debug("Random adhan for %s: %s (of %d)", prayer, chosen, len(candidates))
    return chosen


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


async def _async_handle_play_adhan(hass: HomeAssistant, call: ServiceCall) -> None:
    prayer = call.data["prayer"]

    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}

    if _guest_mode_active(options):
        _LOGGER.info("Guest mode active — skipping adhan for %s", prayer)
        return

    sound_rel = _sound_path_for(options, prayer)
    # 2.0.52 — random adhan: replace the fixed choice with a random
    # locally downloaded sound from the prayer's category. Catalog fetch
    # is cached, so this is cheap at fire time; any failure falls back
    # to the configured sound rather than skipping the adhan.
    if bool(options.get(OPT_RANDOM_ADHAN_ENABLED)):
        sound_rel = await _random_adhan_rel(hass, prayer, sound_rel)
    media_url = f"/local/nida/sounds/{sound_rel}"

    players = _resolve_media_players(hass, dict(call.data), options)
    if not players:
        _LOGGER.warning(
            "nida.play_adhan: no media players resolved; nothing played"
        )
        return

    volume = _apply_volume_modifiers(_volume_for_prayer(options, prayer), hass, options)
    if volume is not None:
        await _set_volume_safe(hass, players, volume, prayer)

    _LOGGER.info("Playing adhan for %s on %s: %s", prayer, players, media_url)
    await _play_media_safe(hass, players, media_url, f"adhan {prayer}")


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
    media_url = f"/local/nida/sounds/{sound_rel}"

    volume = _apply_volume_modifiers(
        _volume_for_category(options, SOUND_CATEGORY_PRE_ADHAN_JINGLE),
        hass,
        options,
    )
    if volume is not None:
        await _set_volume_safe(hass, players, volume, "pre-adhan jingle")

    _LOGGER.info("Playing pre-adhan jingle on %s: %s", players, media_url)
    await _play_media_safe(hass, players, media_url, "pre-adhan jingle")


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

    media_url = f"/local/nida/sounds/{TEST_SOUND_PATH}"

    # Dedicated test volume (volume_test), not volume_adhan. Test still
    # honours night-mode so the user sees real behaviour during tests
    # planned at night-mode hours.
    raw = options.get(OPT_VOLUME_TEST, DEFAULT_VOLUME_TEST)
    try:
        volume = max(0, min(100, int(raw))) / 100.0
    except (TypeError, ValueError):
        volume = DEFAULT_VOLUME_TEST / 100.0
    volume = _apply_volume_modifiers(volume, hass, options)
    if volume is not None:
        await _set_volume_safe(hass, players, volume, "test")

    _LOGGER.info("Playing test sound on %s: %s", players, media_url)
    await _play_media_safe(hass, players, media_url, "test")


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
    media_url = f"/local/nida/sounds/{sound_rel}"

    raw = options.get(OPT_VOLUME_PRE_ADHAN_TEST, DEFAULT_VOLUME_PRE_ADHAN_TEST)
    try:
        volume = max(0, min(100, int(raw))) / 100.0
    except (TypeError, ValueError):
        volume = DEFAULT_VOLUME_PRE_ADHAN_TEST / 100.0
    volume = _apply_volume_modifiers(volume, hass, options)
    if volume is not None:
        await _set_volume_safe(hass, players, volume, "pre-adhan test")

    _LOGGER.info("Playing pre-adhan test on %s: %s", players, media_url)
    await _play_media_safe(hass, players, media_url, "pre-adhan test")


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

    if _guest_mode_active(options) and call.data.get("prayer") != "test":
        # Scheduled announcements are muted; the panel's Test button
        # (prayer="test") stays functional — an explicit user action.
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
    if volume is not None:
        await _set_volume_safe(hass, players, volume, "pre-adhan TTS")

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
        SERVICE_PLAY_ADHAN,
        SERVICE_PLAY_PRE_ADHAN_JINGLE,
        SERVICE_PLAY_PRE_ADHAN_TEST,
        SERVICE_PLAY_TEST_SOUND,
        SERVICE_SPEAK_PRE_ADHAN,
    ):
        if hass.services.has_service(DOMAIN, svc):
            hass.services.async_remove(DOMAIN, svc)

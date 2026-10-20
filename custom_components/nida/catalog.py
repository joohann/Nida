"""Nida sound catalog — fetch + download + delete.

Changelog:
  2.1.29 (2026-07-09): New async_sound_duration_seconds(hass, rel_path) —
                       reads a sound file's real length via mutagen (new
                       dependency, see manifest.json), offloaded to the
                       executor, cached by absolute path. Used by
                       scheduler.py to set the Android TV notification's
                       duration to the actual adhan length instead of a
                       fixed guess.
  2.0.51 (2026-07-02): Dua support. Second manifest
                       (options.dua_catalog_url, default
                       majikan.nl/nida/dua/manifest.json) fetched and
                       merged into the same catalog result; type
                       "dua" → category "dua", files under dua/. A
                       failing dua manifest is soft (dua_error key),
                       it never blocks the adhan library. Label
                       prefix-stripping now also handles bare
                       keyword-first labels ("Dua Sleep" → "Sleep").

Backbone of the Sound Library. Reads a JSON manifest from a
user-configured URL (options.catalog_url; defaults to
https://majikan.nl/nida/adhan/manifest.json) and offers download/delete
operations against the local <config>/www/nida/sounds/ tree.

External manifest schema (as published by majikan.nl):
  {
    "version": "1.0.0",
    "updatedAt": "2026-04-03T11:26:51Z",
    "source": "https://www.majikan.nl/nida/adhan/",
    "items": [
      {
        "id": "adhan_day_amer_marei_c28d44db",
        "label": "Adhan Day Amer Marei",
        "type": "day|fajr|jingle|tarhim",
        "url": "https://.../<id>.mp3",
        "sizeBytes": 2445330,
        "sha256": "f83b..."
      },
      ...
    ]
  }

The integration normalises each item to:
  { id, category, name, rel_path, url, duration_s, size_bytes }

where:
  - `type` → `category`: day→adhan, fajr→fajr_adhan, jingle→pre_adhan_jingle.
    `tarhim` is currently skipped (no UI category yet; will land with
    Ramadan features).
  - `label` → `name`, with the boilerplate type-prefix stripped
    ("Adhan Day Amer Marei" → "Amer Marei", "Nadir Jingle Glass" →
    "Glass") so the picker reads cleanly.
  - `rel_path` is derived: `<category-folder>/<id>.mp3` where the
    folder follows the integration's pre-existing convention
    (fajr_adhan + adhan both live in `adhan/`; pre_adhan_jingle in
    `pre_adhan_jingle/`).

rel_path is what gets written to options.sound_<category> when the user
selects a sound. It's also the path under <config>/www/nida/sounds/
where the file lives once downloaded. /local/nida/sounds/<rel_path> is
the URL the media_player.play_media service uses at adhan time.
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .const import (
    DEFAULT_JINGLE_CATALOG_URL,
    OPT_JINGLE_CATALOG_URL,
    DEFAULT_CATALOG_URL,
    DEFAULT_DUA_CATALOG_URL,
    DOMAIN,
    OPT_CATALOG_URL,
    OPT_DUA_CATALOG_URL,
    SOUND_CATEGORIES,
)

_LOGGER = logging.getLogger(__name__)

# Where downloaded sounds live, relative to hass.config.path("www").
# Mirrors the layout that helpers.async_copy_sounds expects so
# /local/nida/sounds/<rel_path> resolves correctly without any
# additional plumbing.
_SOUNDS_SUBDIR = "nida/sounds"

# In-memory catalog cache. Keyed by URL — if the user changes the
# catalog_url option, a fresh fetch happens automatically.
_CACHE: dict[str, dict[str, Any]] = {}

# Catalogs we trust to be small (<1MB realistically); cap at 5MB to
# protect against runaway/poisoned responses.
_MAX_CATALOG_BYTES = 5 * 1024 * 1024

# Same idea for individual sounds — typical adhan is 1-5MB; we cap at
# 25MB which is generous for any plausible spoken-audio file.
_MAX_SOUND_BYTES = 25 * 1024 * 1024

# Sanity check on rel_path values from the catalog. We refuse anything
# containing ".." or absolute paths to keep downloads constrained to
# the sounds subdirectory.
_REL_PATH_RE = re.compile(r"^[A-Za-z0-9_\-./]+$")


def _catalog_url(hass: HomeAssistant) -> str | None:
    """Pull the user-configured catalog URL from the first Nida entry."""
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return None
    raw = entries[0].options.get(OPT_CATALOG_URL, DEFAULT_CATALOG_URL)
    if not raw or not raw.strip():
        return None
    return raw.strip()


def _dua_catalog_url(hass: HomeAssistant) -> str | None:
    """Same as _catalog_url but for the dua manifest (2.0.51).

    A separate manifest because the server publishes one manifest per
    sound folder. Configurable via options[dua_catalog_url]; an empty
    string disables dua fetching entirely.
    """
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return None
    raw = entries[0].options.get(OPT_DUA_CATALOG_URL, DEFAULT_DUA_CATALOG_URL)
    if not raw or not raw.strip():
        return None
    return raw.strip()


def _jingle_catalog_url(hass: HomeAssistant) -> str | None:
    """Pre-adhan jingle manifest (2.4.6).

    Jingles used to be entries of type "jingle" inside the adhan
    manifest. The library now publishes them as their own folder, so they
    need their own URL. Same shape as the other two: configurable, and an
    empty string switches them off.
    """
    entries = hass.config_entries.async_entries(DOMAIN)
    if not entries:
        return None
    raw = entries[0].options.get(OPT_JINGLE_CATALOG_URL, DEFAULT_JINGLE_CATALOG_URL)
    if not raw or not raw.strip():
        return None
    return raw.strip()


def _www_root(hass: HomeAssistant) -> str:
    return hass.config.path("www", _SOUNDS_SUBDIR)


def _validate_rel_path(rel_path: str) -> bool:
    if not rel_path or len(rel_path) > 200:
        return False
    if rel_path.startswith("/") or ".." in rel_path:
        return False
    return bool(_REL_PATH_RE.match(rel_path))


def _abs_path(hass: HomeAssistant, rel_path: str) -> str | None:
    if not _validate_rel_path(rel_path):
        return None
    return os.path.join(_www_root(hass), rel_path)


def local_sound_exists(hass: HomeAssistant, rel_path: str) -> bool:
    """True if the file exists on disk under www/nida/sounds/."""
    abs_path = _abs_path(hass, rel_path)
    if not abs_path:
        return False
    return os.path.isfile(abs_path)


# In-memory duration cache, keyed by absolute path — a sound file's
# length never changes once downloaded, so this never needs invalidating
# within a running HA process (a restart clears it, which is fine: the
# first lookup after restart just re-reads the file once).
_DURATION_CACHE: dict[str, int | None] = {}


_MP3_BITRATES = {
    # (version, layer) -> kbit/s by bitrate index; version 1 = MPEG-1, 2 = MPEG-2/2.5
    (1, 1): [0, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448],
    (1, 2): [0, 32, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 384],
    (1, 3): [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320],
    (2, 1): [0, 32, 48, 56, 64, 80, 96, 112, 128, 144, 160, 176, 192, 224, 256],
    (2, 2): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
    (2, 3): [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160],
}
_MP3_RATES = {3: (44100, 48000, 32000), 2: (22050, 24000, 16000), 0: (11025, 12000, 8000)}


def _mp3_length_pure(abs_path: str) -> float | None:
    """MP3 length without any third-party package (2.5.0).

    mutagen is optional and often absent (see _read_duration_blocking), and
    without it the pre-adhan had to assume a jingle was 15 seconds long.
    The sound library is MP3 only, so a small reader is enough: skip the
    ID3v2 tag, read the first frame header, and use the Xing/Info/VBRI
    frame count when there is one (VBR), else size / bitrate (CBR).
    Returns None for anything it does not recognise, never a guess.
    """
    try:
        size = os.path.getsize(abs_path)
        with open(abs_path, "rb") as fh:
            head = fh.read(10)
            start = 0
            if head[:3] == b"ID3" and len(head) == 10:
                start = 10 + ((head[6] & 0x7F) << 21 | (head[7] & 0x7F) << 14
                              | (head[8] & 0x7F) << 7 | (head[9] & 0x7F))
            fh.seek(start)
            buf = fh.read(8192)
        i = 0
        while i + 4 <= len(buf):
            if buf[i] == 0xFF and (buf[i + 1] & 0xE0) == 0xE0:
                b1, b2 = buf[i + 1], buf[i + 2]
                ver_bits, layer_bits = (b1 >> 3) & 3, (b1 >> 1) & 3
                br_idx, sr_idx = (b2 >> 4) & 0xF, (b2 >> 2) & 3
                if ver_bits != 1 and layer_bits != 0 and 0 < br_idx < 15 and sr_idx != 3:
                    break
            i += 1
        else:
            return None
        version = 1 if ver_bits == 3 else 2
        layer = 4 - layer_bits
        bitrate = _MP3_BITRATES[(version, layer)][br_idx] * 1000
        rate = _MP3_RATES[ver_bits][sr_idx]
        samples = 384 if layer == 1 else (1152 if (layer == 2 or version == 1) else 576)
        mono = ((buf[i + 3] >> 6) & 3) == 3
        frames = None
        side = (17 if mono else 32) if version == 1 else (9 if mono else 17)
        tag = buf[i + 4 + side:i + 4 + side + 12]
        if tag[:4] in (b"Xing", b"Info") and tag[7] & 1:
            frames = int.from_bytes(tag[8:12], "big")
        else:
            vbri = buf[i + 4 + 32:i + 4 + 32 + 18]
            if vbri[:4] == b"VBRI":
                frames = int.from_bytes(vbri[14:18], "big")
        if frames:
            return frames * samples / rate
        return (size - start - i) * 8 / bitrate
    except Exception as err:  # noqa: BLE001
        _LOGGER.debug("Pure MP3 length read failed for %s (%s)", abs_path, err)
        return None



def _read_duration_blocking(abs_path: str) -> int | None:
    """Blocking mutagen read — only ever called via the executor, never
    directly on the event loop. Kept as its own function so
    async_sound_duration_seconds' hass.async_add_executor_job call has a
    plain, picklable-by-reference target.

    2.3.11 — mutagen is OPTIONAL and no longer declared in manifest.json.
    It was listed as a hard requirement from 2.1.29, which meant Home
    Assistant refused to load Nida at ALL when it couldn't install the
    package — no setup, no panel, no config flow, just
    "RequirementsNotFound: Requirements for nida not found:
    ['mutagen==1.47.0']". That is a wildly disproportionate failure for
    what mutagen actually buys us: knowing a sound file's exact length,
    used to size an Android TV notification and to time the ducked-player
    wait during a Sonos announcement. Both callers already treat None as
    "unknown" and fall back to a sensible fixed value, so its absence
    costs a little polish rather than the whole integration.

    ImportError is logged at debug, not warning: on an install without
    mutagen that is the normal, expected state and would otherwise repeat
    on every lookup. A genuine read failure on a file that IS there still
    warns.
    """
    try:
        import mutagen
    except ImportError:
        _LOGGER.debug(
            "mutagen not installed — reading %s without it", abs_path
        )
        length = _mp3_length_pure(abs_path)
        return int(round(length)) if length else None
    try:
        info = mutagen.File(abs_path)
        # `info is not None`, NOT `if info`: a mutagen file object is falsy
        # when it has no tags, which is every plain mp3 in the library.
        if info is not None and getattr(info, "info", None) is not None:
            return int(round(info.info.length))
        length = _mp3_length_pure(abs_path)
        return int(round(length)) if length else None
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Could not read duration of %s (%s)", abs_path, err)
        return None


def _read_length_blocking(abs_path: str) -> float | None:
    """Like _read_duration_blocking but keeps the fraction (2.5.0).

    Whole seconds are fine for sizing a TV notification, but not for
    timing the gap between the pre-adhan jingle and the spoken line: a 2.4s
    jingle rounded up to 3s is a visible extra half second of silence.
    """
    try:
        import mutagen
    except ImportError:
        return _mp3_length_pure(abs_path)
    try:
        info = mutagen.File(abs_path)
        if info is not None and getattr(info, "info", None) is not None:
            return float(info.info.length)
        return _mp3_length_pure(abs_path)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Could not read length of %s (%s)", abs_path, err)
        return None


async def async_sound_duration_seconds(
    hass: HomeAssistant, rel_path: str
) -> int | None:
    """Real length (whole seconds) of a sound file under www/nida/sounds/.

    2.1.29 — added so the Android TV notification's `duration` can match
    how long the adhan actually plays instead of a fixed guess (Johann:
    "kan de notificatie op de tv blijven staan tot het einde van de
    adhan?"). Reads the file directly via mutagen rather than relying on
    the adhan media_player's own media_duration attribute, which isn't
    populated by every integration/player and would require waiting on
    live playback state — this works for any file the moment it exists
    on disk, catalog-downloaded or one of the bundled defaults alike.

    The actual file read is blocking (mutagen does synchronous I/O), so
    it's offloaded to the executor — never call mutagen directly on the
    event loop. Cached by absolute path afterward, so repeat lookups
    (e.g. the same configured adhan sound firing day after day) are free.

    Returns None (not a fallback number) when the file is missing or
    unreadable — the caller decides what to do in that case, this
    function only reports what it actually knows.
    """
    abs_path = _abs_path(hass, rel_path)
    if not abs_path or not os.path.isfile(abs_path):
        return None
    if abs_path in _DURATION_CACHE:
        return _DURATION_CACHE[abs_path]
    seconds = await hass.async_add_executor_job(_read_duration_blocking, abs_path)
    _DURATION_CACHE[abs_path] = seconds
    return seconds


_LENGTH_CACHE: dict[str, float | None] = {}


async def async_sound_length_seconds(
    hass: HomeAssistant, rel_path: str
) -> float | None:
    """Exact length (fractional seconds) of a sound under www/nida/sounds/.

    2.5.0 — for the pre-adhan jingle -> TTS gap. Read from the file when
    first needed and cached per path afterwards, so nothing is stored in
    the options and nothing can go stale: replace or re-download a jingle
    and the next lookup sees the new file (the cache is keyed on path AND
    modification time). None when mutagen is not installed or the file is
    unreadable; the caller then falls back to watching the player.
    """
    abs_path = _abs_path(hass, rel_path)
    if not abs_path or not os.path.isfile(abs_path):
        return None
    key = f"{abs_path}:{os.path.getmtime(abs_path)}"
    if key in _LENGTH_CACHE:
        return _LENGTH_CACHE[key]
    length = await hass.async_add_executor_job(_read_length_blocking, abs_path)
    _LENGTH_CACHE[key] = length
    return length


async def _fetch_manifest(
    hass: HomeAssistant, url: str
) -> tuple[list[dict[str, Any]], str | None]:
    """Fetch and adapt a single manifest. Returns (sounds, error)."""
    session = async_get_clientsession(hass)
    try:
        async with session.get(url, timeout=10) as resp:
            if resp.status != 200:
                _LOGGER.warning(
                    "Nida catalog fetch failed: HTTP %s for %s", resp.status, url
                )
                return [], f"http_{resp.status}"
            # Read with a size cap to defend against accidentally huge
            # responses (proxy errors that return giant HTML pages, etc).
            data_bytes = await resp.content.read(_MAX_CATALOG_BYTES + 1)
            if len(data_bytes) > _MAX_CATALOG_BYTES:
                return [], "catalog_too_large"
            try:
                import json
                parsed = json.loads(data_bytes.decode("utf-8"))
            except (ValueError, UnicodeDecodeError) as err:
                _LOGGER.warning("Nida catalog parse failed: %s", err)
                return [], "invalid_json"
    except (asyncio.TimeoutError, Exception) as err:  # noqa: BLE001
        _LOGGER.warning("Nida catalog network error: %s", err)
        return [], "network_error"

    sounds = []
    skipped = 0
    items = parsed.get("items", []) if isinstance(parsed, dict) else []
    for raw in items:
        adapted = _adapt_item(raw)
        if adapted is None:
            skipped += 1
            continue
        sounds.append(adapted)
    if skipped:
        _LOGGER.debug(
            "Nida catalog: %d item(s) skipped (unknown type or missing fields)",
            skipped,
        )
    return sounds, None


async def async_fetch_catalog(
    hass: HomeAssistant, force_refresh: bool = False
) -> dict[str, Any]:
    """Fetch the catalog JSON (adhan manifest + dua manifest, merged).

    Returns a dict with keys: url, sounds (list), error, dua_error.
    `error` reflects the main (adhan) manifest and drives the panel's
    error card, exactly as before 2.0.51. A failing dua manifest is
    soft: logged and reported via `dua_error`, but it never blocks the
    adhan/jingle part of the library. Never raises.
    """
    url = _catalog_url(hass)
    dua_url = _dua_catalog_url(hass)
    jingle_url = _jingle_catalog_url(hass)
    if not url and not dua_url and not jingle_url:
        return {
            "url": None,
            "sounds": [],
            "error": "catalog_url_not_configured",
            "dua_error": None,
        }

    cache_key = f"{url or ''}|{dua_url or ''}|{jingle_url or ''}"
    if not force_refresh and cache_key in _CACHE:
        return _CACHE[cache_key]

    sounds: list[dict[str, Any]] = []
    error: str | None = None
    dua_error: str | None = None
    if url:
        main_sounds, error = await _fetch_manifest(hass, url)
        sounds.extend(main_sounds)
    if dua_url:
        dua_sounds, dua_error = await _fetch_manifest(hass, dua_url)
        sounds.extend(dua_sounds)
    if jingle_url:
        # Soft like the dua manifest: a failing jingle feed must not blank
        # out the adhan library. Logged, then skipped. Deduped by id
        # because an install still pointed at the OLD combined adhan
        # manifest would otherwise list every jingle twice.
        jingle_sounds, jingle_error = await _fetch_manifest(hass, jingle_url)
        if jingle_error:
            _LOGGER.warning("Nida jingle manifest failed (%s)", jingle_error)
        seen = {s_.get("id") for s_ in sounds}
        sounds.extend(s_ for s_ in jingle_sounds if s_.get("id") not in seen)

    result = {"url": url, "sounds": sounds, "error": error, "dua_error": dua_error}
    _CACHE[cache_key] = result
    return result


# Maps the external manifest's `type` to the integration's category key.
# `tarhim` is intentionally absent: the integration doesn't have a
# tarhim category yet (will appear with Ramadan/fasting features).
# Items with unknown types are skipped rather than miscategorised.
_TYPE_TO_CATEGORY = {
    "fajr": "fajr_adhan",
    "day": "adhan",
    "jingle": "pre_adhan_jingle",
    # 2.0.51 — dua manifest items. Manual-playback sounds, configured
    # per dua in options[OPT_DUAS] rather than via sound_<category>.
    "dua": "dua",
}

# Where each category's files live under <config>/www/nida/sounds/.
# `fajr_adhan` and `adhan` share the `adhan/` folder for historical
# reasons (DEFAULT_SOUNDS in const.py uses the same convention).
_CATEGORY_FOLDER = {
    "fajr_adhan": "adhan",
    "adhan": "adhan",
    "pre_adhan_jingle": "pre_adhan_jingle",
    "dua": "dua",
}

# Display-label prefix patterns. The manifest's `label` field includes
# a redundant type prefix ("Adhan Day Amer Marei", "Nadir Jingle Glass",
# "Dua Sleep") that's noisy in a UI already grouped by category. We
# strip up to and including the type keyword, case-insensitive. The
# leading word is optional (2.0.51): dua labels start with the keyword
# itself.
# 2.4.8 — the old pattern allowed ANY leading word before the type keyword,
# which ate real names now that the library no longer puts a type prefix on
# labels: "Arabic Jingle 3" became "3" and "Al Fajr Saba" became "Saba".
# Only known pack/category words may precede the keyword now.
_LABEL_PREFIX_RE = re.compile(
    r"^\s*(?:(?:nadir|nida|adhan|pre)\s+)*(?:day|fajr|jingle|tarhim|dua)\s+",
    flags=re.IGNORECASE,
)


def _adapt_item(raw: Any) -> dict[str, Any] | None:
    """Map an external manifest item to the integration's normalised shape.

    Returns None for items we can't or won't use (unknown type, missing
    required fields, suspicious id). The caller filters these out.
    """
    if not isinstance(raw, dict):
        return None
    sid = raw.get("id")
    type_ = raw.get("type")
    label = raw.get("label") or raw.get("name")
    url = raw.get("url")
    if not (sid and type_ and label and url):
        return None
    category = _TYPE_TO_CATEGORY.get(str(type_).lower())
    if category is None:
        return None

    # Sanity-check the id so we can safely use it as a filename. The
    # manifest's ids are slug-like (alnum + underscore), but we don't
    # blindly trust an external source.
    if not re.match(r"^[A-Za-z0-9_\-]+$", str(sid)) or len(sid) > 150:
        return None

    folder = _CATEGORY_FOLDER.get(category, category)
    rel_path = f"{folder}/{sid}.mp3"
    if not _validate_rel_path(rel_path):
        return None

    # Strip the redundant type-prefix from the display label so the
    # picker shows "Amer Marei" rather than "Adhan Day Amer Marei".
    # If the regex doesn't match we keep the label as-is.
    name = _LABEL_PREFIX_RE.sub("", str(label)).strip() or str(label)

    return {
        "id": str(sid),
        "category": category,
        "name": name,
        "rel_path": rel_path,
        "url": str(url),
        "duration_s": raw.get("duration_s"),
        "size_bytes": raw.get("sizeBytes"),
    }


async def async_download_sound(
    hass: HomeAssistant, url: str, rel_path: str
) -> dict[str, Any]:
    """Download a sound to <config>/www/nida/sounds/<rel_path>.

    Atomic write: stream to a .tmp sibling first, rename on success.
    Creates parent dirs as needed. Returns {ok: bool, error: str|None}.
    """
    abs_path = _abs_path(hass, rel_path)
    if not abs_path:
        return {"ok": False, "error": "invalid_rel_path"}
    if not url or not url.startswith(("http://", "https://")):
        return {"ok": False, "error": "invalid_url"}

    parent = os.path.dirname(abs_path)
    tmp_path = abs_path + ".tmp"

    def _ensure_dir() -> None:
        os.makedirs(parent, exist_ok=True)

    await hass.async_add_executor_job(_ensure_dir)

    session = async_get_clientsession(hass)
    try:
        async with session.get(url, timeout=60) as resp:
            if resp.status != 200:
                return {"ok": False, "error": f"http_{resp.status}"}
            total = 0
            def _open_tmp():
                return open(tmp_path, "wb")
            f = await hass.async_add_executor_job(_open_tmp)
            try:
                # Stream chunks to disk. Cap at _MAX_SOUND_BYTES.
                while True:
                    chunk = await resp.content.read(64 * 1024)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > _MAX_SOUND_BYTES:
                        await hass.async_add_executor_job(f.close)
                        await hass.async_add_executor_job(os.remove, tmp_path)
                        return {"ok": False, "error": "sound_too_large"}
                    await hass.async_add_executor_job(f.write, chunk)
            finally:
                await hass.async_add_executor_job(f.close)
    except Exception as err:  # noqa: BLE001
        _LOGGER.warning("Nida sound download failed (%s): %s", url, err)
        # Clean up any partial .tmp
        try:
            await hass.async_add_executor_job(os.remove, tmp_path)
        except OSError:
            pass
        return {"ok": False, "error": "network_error"}

    # Atomic rename. On Windows this fails if dest exists; we explicitly
    # remove first there. HA is Linux-first so the normal path is fine.
    def _finalise() -> None:
        if os.path.exists(abs_path):
            os.remove(abs_path)
        os.rename(tmp_path, abs_path)

    try:
        await hass.async_add_executor_job(_finalise)
    except OSError as err:
        return {"ok": False, "error": f"rename_failed: {err}"}

    _LOGGER.info("Nida downloaded %s to %s (%d bytes)", url, abs_path, total)
    return {"ok": True, "error": None, "bytes": total}


async def async_delete_sound(
    hass: HomeAssistant, rel_path: str
) -> dict[str, Any]:
    """Remove a previously-downloaded sound. No-op if file absent."""
    abs_path = _abs_path(hass, rel_path)
    if not abs_path:
        return {"ok": False, "error": "invalid_rel_path"}

    def _do_remove() -> bool:
        if not os.path.isfile(abs_path):
            return False
        os.remove(abs_path)
        return True

    try:
        removed = await hass.async_add_executor_job(_do_remove)
    except OSError as err:
        return {"ok": False, "error": f"remove_failed: {err}"}

    return {"ok": True, "error": None, "removed": removed}


def invalidate_catalog_cache() -> None:
    """Drop the in-memory catalog cache. Called after options changes
    that affect catalog_url so the next fetch re-reads from the new URL."""
    _CACHE.clear()

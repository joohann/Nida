"""Nida rotating quote — Quran verse / hadith of the moment.

Changelog:
  2.0.64 (2026-07-04): Initial version. Feeds the panel's quote card.

Sources (both verified live before this module was written):
  - Quran verses: api.alquran.cloud — one call returns the Uthmani
    Arabic plus a translation edition. Same Islamic Network family as
    the AlAdhan prayer-times API the integration already uses.
  - Hadith: hadeethenc.com — free, no API key, translations cover all
    ten Nida panel languages (incl. nl and ms).

Rotation model: time is divided into 4-hour slots (epoch // 4h). Even
slots show a Quran verse, odd slots a hadith. The slot index seeds the
selection, so every browser/device shows the SAME quote within a slot
without any coordination, and the quote changes six times a day.
Results are cached in memory per (slot, language): the external APIs
are hit at most a handful of times per day per language.

Returned shape (also on partial failure — the panel never crashes):
  { "kind": "quran"|"hadith", "text": str, "arabic": str|None,
    "ref": str, "error": str|None }
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession

_LOGGER = logging.getLogger(__name__)

SLOT_SECONDS = 4 * 3600
_TOTAL_AYAHS = 6236

# Panel language → alquran.cloud translation edition. Arabic gets the
# Uthmani text as its "translation" (no second edition needed).
_QURAN_EDITIONS = {
    "en": "en.sahih",
    "nl": "nl.siregar",
    "tr": "tr.diyanet",
    "de": "de.aburida",
    "fr": "fr.hamidullah",
    "id": "id.indonesian",
    "ms": "ms.basmeih",
    "ur": "ur.jalandhry",
    "fa": "fa.ansarian",
}

# HadeethEnc supports all ten panel languages directly (verified via
# /api/v1/languages). Anything unexpected falls back to English.
_HADEETH_LANGS = {"ar", "en", "nl", "tr", "de", "fr", "ms", "id", "ur", "fa"}

# In-memory cache: {(slot, lang): result}. Old slots are pruned on
# access; the dict never grows past a few entries.
_CACHE: dict[tuple[int, str], dict[str, Any]] = {}

# Verses longer than this (translation) get re-rolled a few times so
# the card stays card-sized; if every attempt is long we show the last
# one anyway rather than truncating scripture.
_MAX_TEXT_CHARS = 420
_MAX_ATTEMPTS = 3


def _current_slot() -> int:
    return int(time.time()) // SLOT_SECONDS


def _base_lang(lang: str | None) -> str:
    return (lang or "en").split("-", 1)[0].lower()


async def async_get_quote(hass: HomeAssistant, lang: str | None) -> dict[str, Any]:
    """Quote for the current 4h slot in the given language (cached)."""
    slot = _current_slot()
    base = _base_lang(lang)
    key = (slot, base)
    if key in _CACHE:
        return _CACHE[key]

    # Prune entries from previous slots so the cache stays tiny.
    for old_key in [k for k in _CACHE if k[0] != slot]:
        _CACHE.pop(old_key, None)

    if slot % 2 == 0:
        result = await _fetch_quran(hass, slot, base)
    else:
        result = await _fetch_hadith(hass, slot, base)

    # Only cache successes; a transient network error should retry on
    # the next panel load instead of poisoning the whole 4h slot.
    if not result.get("error"):
        _CACHE[key] = result
    return result


# HadeethEnc rejects bare-library User-Agents (verified: curl 200,
# python-urllib 403), so every quote request identifies as a browser.
_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) NidaHomeAssistant/2.0"
    )
}


async def _get_json(hass: HomeAssistant, url: str) -> Any | None:
    session = async_get_clientsession(hass)
    try:
        async with session.get(url, timeout=10, headers=_HEADERS) as resp:
            if resp.status != 200:
                _LOGGER.warning("Nida quote fetch HTTP %s: %s", resp.status, url)
                return None
            return await resp.json(content_type=None)
    except (asyncio.TimeoutError, Exception) as err:  # noqa: BLE001
        _LOGGER.warning("Nida quote fetch failed (%s): %s", url, err)
        return None


async def _fetch_quran(hass: HomeAssistant, slot: int, lang: str) -> dict[str, Any]:
    edition = _QURAN_EDITIONS.get(lang)
    editions = "quran-uthmani" if lang == "ar" or not edition else (
        f"quran-uthmani,{edition}"
    )
    last: dict[str, Any] | None = None
    for attempt in range(_MAX_ATTEMPTS):
        # Deterministic pseudo-random ayah per slot; the multiplier
        # spreads consecutive slots across the mushaf.
        ayah_no = ((slot + attempt) * 2654435761) % _TOTAL_AYAHS + 1
        data = await _get_json(
            hass, f"https://api.alquran.cloud/v1/ayah/{ayah_no}/editions/{editions}"
        )
        items = (data or {}).get("data")
        if not isinstance(items, list) or not items:
            continue
        arabic = items[0].get("text")
        translated = items[-1].get("text") or arabic
        surah = items[0].get("surah") or {}
        ref = f"{surah.get('englishName', 'Quran')} {surah.get('number', '?')}:{items[0].get('numberInSurah', '?')}"
        last = {
            "kind": "quran",
            "text": translated,
            "arabic": arabic if lang != "ar" else None,
            "ref": ref,
            "error": None,
        }
        if translated and len(translated) <= _MAX_TEXT_CHARS:
            return last
    if last:
        return last
    return {"kind": "quran", "text": "", "arabic": None, "ref": "", "error": "fetch_failed"}


async def _fetch_hadith(hass: HomeAssistant, slot: int, lang: str) -> dict[str, Any]:
    hlang = lang if lang in _HADEETH_LANGS else "en"
    # Three-step: page 1 first to learn the real page count from the
    # meta (per-language catalogs are small — nl category 1 has only 3
    # pages), then a deterministic page within that range, then the
    # chosen hadith's full text.
    base_list = (
        "https://hadeethenc.com/api/v1/hadeeths/list/"
        f"?language={hlang}&category_id=1&per_page=20&page="
    )
    first = await _get_json(hass, base_list + "1")
    items = (first or {}).get("data") or []
    try:
        last_page = max(1, int(((first or {}).get("meta") or {}).get("last_page", 1)))
    except (TypeError, ValueError):
        last_page = 1
    page = (slot * 2654435761) % last_page + 1
    if page > 1:
        data = await _get_json(hass, base_list + str(page))
        items = (data or {}).get("data") or items
    if not items:
        return {"kind": "hadith", "text": "", "arabic": None, "ref": "", "error": "fetch_failed"}

    picked = items[slot % len(items)]
    detail = await _get_json(
        hass,
        "https://hadeethenc.com/api/v1/hadeeths/one/"
        f"?language={hlang}&id={picked.get('id')}",
    )
    text = (detail or {}).get("hadeeth") or picked.get("title") or ""
    attribution = (detail or {}).get("attribution") or "Hadith"
    if len(text) > _MAX_TEXT_CHARS:
        # Long hadith: fall back to its (short) title line rather than
        # cutting the narration mid-sentence.
        text = picked.get("title") or text[:_MAX_TEXT_CHARS]
    return {
        "kind": "hadith",
        "text": text,
        "arabic": None,
        "ref": attribution,
        "error": None,
    }

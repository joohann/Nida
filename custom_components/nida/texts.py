"""Nida's own server-side texts, in the user's language (2.5.7).

The notifications Nida writes itself (the welcome note, the pre-adhan
fallback, the Islamic calendar) and the Live Activity take their words
from the "common" block of translations/<language>.json, Home Assistant's
own translation files. Home Assistant lays English underneath, so a key a
language does not have shows in English instead of not at all.

Language: Nida's own choice in the panel (options.language). "auto" or
nothing means Home Assistant's language; anything outside Nida's ten
languages becomes English. The Live Activity used this rule already.

Placeholders: {name} and {panel} come from const.PRODUCT_NAME and
const.PANEL_TITLE, so no translation carries the product's name. A count
picks its plural form through plurals.plural_category; Persian gets its
numbers in Persian digits, like the panel writes them.

scripts/check_translations.py checks that every language has every key,
including every plural form its language needs.

Changelog:
  2.5.7 (2026-11-27): New module.
"""
from __future__ import annotations

import logging
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.translation import async_get_translations

from .const import (
    DOMAIN,
    OPT_LANGUAGE,
    PANEL_TITLE,
    PRODUCT_NAME,
    SUPPORTED_LANGUAGES,
)
from .plurals import plural_category

_LOGGER = logging.getLogger(__name__)

_PREFIX = f"component.{DOMAIN}.common."
_DIGITS = {"fa": str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹")}


def nida_language(hass: HomeAssistant, entry: ConfigEntry | None) -> str:
    """Nida's language: the panel's choice, else Home Assistant's, else English."""
    options = entry.options if entry is not None else {}
    chosen = options.get(OPT_LANGUAGE)
    raw = hass.config.language if chosen in (None, "", "auto") else chosen
    base = str(raw or "en").replace("_", "-").split("-")[0].lower()
    return base if base in SUPPORTED_LANGUAGES else "en"


class NidaTexts:
    """The "common" texts of one language, with placeholders filled in."""

    def __init__(self, language: str, strings: dict[str, str]) -> None:
        self.language = language
        self._strings = strings

    def has(self, key: str) -> bool:
        return f"{_PREFIX}{key}" in self._strings

    def get(self, key: str, **values: Any) -> str:
        raw = self._strings.get(f"{_PREFIX}{key}")
        if raw is None:
            _LOGGER.warning("Nida text %s is missing from the translations", key)
            return key
        fill: dict[str, Any] = {"name": PRODUCT_NAME, "panel": PANEL_TITLE}
        for field, value in values.items():
            is_count = isinstance(value, int) and not isinstance(value, bool)
            fill[field] = self._number(value) if is_count else value
        try:
            return raw.format(**fill)
        except (KeyError, IndexError, ValueError):
            _LOGGER.warning("Nida text %s does not match its placeholders", key)
            return raw

    def plural(self, key: str, count: int, **values: Any) -> str:
        """The form of `key` that fits `count` (key_one, key_few, ...)."""
        form = f"{key}_{plural_category(self.language, count)}"
        if not self.has(form):
            form = f"{key}_other"
        return self.get(form, **values)

    def prayer(self, prayer: str) -> str:
        """A prayer's name as the panel writes it in this language."""
        key = f"prayer_{prayer}"
        return self.get(key) if self.has(key) else prayer.capitalize()

    def _number(self, value: int) -> str:
        table = _DIGITS.get(self.language)
        return str(value).translate(table) if table else str(value)


async def async_get_texts(hass: HomeAssistant, entry: ConfigEntry | None) -> NidaTexts:
    """Load the texts for Nida's language (cached by Home Assistant)."""
    language = nida_language(hass, entry)
    for attempt in (language, "en"):
        try:
            strings = await async_get_translations(hass, attempt, "common", {DOMAIN})
        except Exception as err:  # noqa: BLE001 - a text must never stop a notification
            _LOGGER.warning("Could not load Nida's texts for %s: %s", attempt, err)
            continue
        return NidaTexts(attempt, strings)
    return NidaTexts("en", {})

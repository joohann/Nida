"""Plural forms for whole numbers in Nida's ten languages (2.5.7).

"In 3 days" needs a different word form per count, and languages split
counts differently: English has one and other, Indonesian and Malay use
one form for every count, Arabic has six. These are the CLDR cardinal
rules for whole numbers below a million, enough for the minutes and days
Nida writes.

Texts with a count have one key per form, ending in _zero, _one, _two,
_few, _many or _other (see texts.NidaTexts.plural). PLURAL_CATEGORIES
lists the forms each language needs; scripts/check_translations.py reads
it to check that every language has them.

Standard library only, so the check script can load this file without
Home Assistant.

Changelog:
  2.5.7 (2026-11-27): New module.
"""
from __future__ import annotations

PLURAL_CATEGORIES: dict[str, tuple[str, ...]] = {
    "en": ("one", "other"),
    "nl": ("one", "other"),
    "de": ("one", "other"),
    "tr": ("one", "other"),
    "ur": ("one", "other"),
    "fr": ("one", "other"),
    "fa": ("one", "other"),
    "id": ("other",),
    "ms": ("other",),
    "ar": ("zero", "one", "two", "few", "many", "other"),
}


def plural_category(language: str, count: int) -> str:
    """The CLDR plural category of a whole number in `language`."""
    n = abs(int(count))
    if language == "ar":
        if n == 0:
            return "zero"
        if n == 1:
            return "one"
        if n == 2:
            return "two"
        if 3 <= n % 100 <= 10:
            return "few"
        if 11 <= n % 100 <= 99:
            return "many"
        return "other"
    if language in ("id", "ms"):
        return "other"
    if language in ("fr", "fa"):
        return "one" if n in (0, 1) else "other"
    return "one" if n == 1 else "other"

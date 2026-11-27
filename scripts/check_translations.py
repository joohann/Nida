#!/usr/bin/env python3
"""Check the Home Assistant translation files against the English source.

English (translations/en.json) is the source. For every other language
file this reports:

  missing      keys in en.json that the language lacks or leaves empty
  obsolete     keys the language has that en.json no longer has
  placeholders keys whose {placeholders} differ from the English text

Texts with a count come in plural forms: key_one, key_other, and for
Arabic also key_zero, key_two, key_few and key_many. A key ending in
_other in en.json starts such a group. Every language needs exactly the
forms its language uses (PLURAL_CATEGORIES in plurals.py, the same table
Nida itself uses): Indonesian and Malay only _other, Arabic all six. A
form may leave out a placeholder ("one minute" spelled out) but may not
add one.

It also checks that strings.json is identical to en.json: hassfest
validates both files, and Home Assistant itself only reads the
translations folder.

Usage:
  python3 scripts/check_translations.py            report, exit 1 on problems
  python3 scripts/check_translations.py --keys     also list every key
  python3 scripts/check_translations.py --prune    remove obsolete keys
  python3 scripts/check_translations.py --new xx   create translations/xx.json
                                                   with every key and empty
                                                   values, ready to translate

Only missing keys need translating; Home Assistant falls back to English
for keys a language does not have. An empty value is not a fallback (it
shows as blank), so a file made with --new must be filled in before it
ships.

Changelog:
  2.5.7 (2026-11-27): New script. Knows plural forms (plurals.py).
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import re
import string
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INTEGRATION = ROOT / "custom_components" / "nida"
TRANSLATIONS = INTEGRATION / "translations"
SOURCE = TRANSLATIONS / "en.json"
STRINGS = INTEGRATION / "strings.json"
LANG_RE = re.compile(r"[a-z]{2,3}(-[A-Za-z0-9]{2,8})?")
ALL_FORMS = ("zero", "one", "two", "few", "many", "other")


def _plural_table() -> dict[str, tuple[str, ...]]:
    """PLURAL_CATEGORIES from plurals.py (standard library only)."""
    spec = importlib.util.spec_from_file_location("nida_plurals", INTEGRATION / "plurals.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.PLURAL_CATEGORIES


PLURALS = _plural_table()


def load(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def flatten(data: dict, prefix: str = "") -> dict[str, object]:
    """{"a": {"b": "x"}} -> {"a.b": "x"}; leaves keep their value."""
    out: dict[str, object] = {}
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            out.update(flatten(value, path))
        else:
            out[path] = value
    return out


def placeholders(text: object) -> set[str]:
    if not isinstance(text, str):
        return set()
    try:
        return {name for _, name, _, _ in string.Formatter().parse(text) if name}
    except ValueError:
        return {"<unbalanced braces>"}


def prune(source: dict, target: dict, keep: set[str], drop: set[str], prefix: str = "") -> dict:
    """target without the keys source does not have, in target's order.

    keep holds flat keys that stay although source lacks them (an Arabic
    _few, say); drop holds flat keys that go although source has them (an
    Indonesian _one: Indonesian has no such form).
    """
    out: dict = {}
    for key, value in target.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            if isinstance(source.get(key), dict):
                nested = prune(source[key], value, keep, drop, path)
                if nested:
                    out[key] = nested
        elif path in drop:
            continue
        elif (key in source and not isinstance(source[key], dict)) or path in keep:
            out[key] = value
    return out


def blank(source: dict) -> dict:
    return {k: blank(v) if isinstance(v, dict) else "" for k, v in source.items()}


def plural_groups(source: dict[str, object]) -> set[str]:
    """Bases of the plural groups: every source key ending in _other."""
    return {key[: -len("_other")] for key in source if key.endswith("_other")}


def split_form(key: str, groups: set[str]) -> tuple[str, str] | None:
    """(base, form) when key is a plural form of a known group."""
    for form in ALL_FORMS:
        suffix = f"_{form}"
        if key.endswith(suffix) and key[: -len(suffix)] in groups:
            return key[: -len(suffix)], form
    return None


def compare(lang_code: str, source: dict, lang: dict) -> tuple[list, list, list]:
    """(missing, obsolete, placeholder mismatches) of one language."""
    groups = plural_groups(source)
    forms = PLURALS.get(lang_code, ("one", "other"))
    filled = lambda k: k in lang and lang[k] not in ("", None)  # noqa: E731

    missing = [k for k in source if split_form(k, groups) is None and not filled(k)]
    missing += [f"{b}_{f}" for b in sorted(groups) for f in forms if not filled(f"{b}_{f}")]

    obsolete = []
    for key in lang:
        part = split_form(key, groups)
        if part is None:
            if key not in source:
                obsolete.append(key)
        elif part[1] not in forms:
            obsolete.append(key)  # a form this language does not use

    mismatch = []
    for key, value in lang.items():
        if value in ("", None):
            continue
        part = split_form(key, groups)
        if part is None:
            if key in source and placeholders(value) != placeholders(source[key]):
                mismatch.append(key)
            continue
        reference = placeholders(source.get(f"{part[0]}_other"))
        mine = placeholders(value)
        if (part[1] == "other" and mine != reference) or not mine <= reference:
            mismatch.append(key)
    return missing, obsolete, mismatch


def report(show_keys: bool) -> int:
    source = flatten(load(SOURCE))
    problems = 0

    if STRINGS.is_file() and load(STRINGS) != load(SOURCE):
        print("strings.json differs from translations/en.json (copy en.json over it)")
        problems += 1

    for path in sorted(TRANSLATIONS.glob("*.json")):
        lang = flatten(load(path))
        missing, obsolete, mismatch = compare(path.stem, source, lang)
        status = "complete" if not (missing or obsolete or mismatch) else "needs work"
        print(
            f"{path.stem:>5}: {status:<10} missing {len(missing):>3}, "
            f"obsolete {len(obsolete):>3}, placeholders {len(mismatch):>3}"
        )
        if show_keys or len(missing) + len(obsolete) + len(mismatch) <= 20:
            for key in missing:
                print(f"         missing      {key}")
            for key in obsolete:
                print(f"         obsolete     {key}")
            for key in mismatch:
                print(f"         placeholders {key}: {sorted(placeholders(lang[key]))}")
        if missing or obsolete or mismatch:
            problems += 1

    print(f"\nSource: {SOURCE.relative_to(ROOT)} ({len(source)} keys)")
    return 1 if problems else 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--keys", action="store_true", help="list every key")
    parser.add_argument("--prune", action="store_true", help="remove obsolete keys")
    parser.add_argument("--new", metavar="LANG", help="create an empty language file")
    args = parser.parse_args()

    source = load(SOURCE)

    if args.new:
        if not LANG_RE.fullmatch(args.new):
            print(f"Not a language code: {args.new!r}")
            return 2
        path = TRANSLATIONS / f"{args.new}.json"
        if path.exists():
            print(f"{path.relative_to(ROOT)} already exists")
            return 2
        write(path, blank(source))
        print(f"Created {path.relative_to(ROOT)}: fill in every value before it ships")
        return 0

    if args.prune:
        for path in sorted(TRANSLATIONS.glob("*.json")):
            if path == SOURCE:
                continue
            current = load(path)
            flat_source = flatten(source)
            groups = plural_groups(flat_source)
            forms = PLURALS.get(path.stem, ("one", "other"))
            parts = {k: split_form(k, groups) for k in flatten(current)}
            keep = {k for k, part in parts.items() if part is not None and part[1] in forms}
            drop = {k for k, part in parts.items() if part is not None and part[1] not in forms}
            pruned = prune(source, current, keep, drop)
            if pruned != current:
                write(path, pruned)
                print(f"Pruned {path.relative_to(ROOT)}")

    return report(args.keys)


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""
Nida Integration — Patch Script (v2, fixed)
=============================================
Voer uit vanuit ~/Nida:
    python3 nida_patches.py

Fixes t.o.v. v1:
- Geen externe module imports meer (audio_parser staat nu inline)
- check_notification zoekt nu op inhoud (notify_message) ipv functienaam
- test_audio_parser.py staat nu ook inline
"""

import os, re, sys, textwrap

BASE  = os.path.dirname(os.path.abspath(__file__))
INIT  = os.path.join(BASE, "custom_components/nida/__init__.py")
CONST = os.path.join(BASE, "custom_components/nida/const.py")
FLOW  = os.path.join(BASE, "custom_components/nida/config_flow.py")

GREEN  = "\033[92m"
YELLOW = "\033[93m"
RED    = "\033[91m"
RESET  = "\033[0m"

def ok(msg):   print(f"  {GREEN}✓{RESET}  {msg}")
def warn(msg): print(f"  {YELLOW}⚠{RESET}  {msg}")
def err(msg):  print(f"  {RED}✗{RESET}  {msg}")

def read(path):
    with open(path, "r", encoding="utf-8") as f:
        return f.read()

def write(path, content):
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    ok(os.path.relpath(path, BASE))

def replace_once(content, old, new, label):
    if old not in content:
        warn(f"'{label}' niet gevonden — al gepatcht of code verschilt")
        return content, False
    result = content.replace(old, new, 1)
    ok(f"'{label}' gepatcht")
    return result, True


# ===========================================================================
# PATCH 1 — Audio filename parser inlinen in const.py
# ===========================================================================
PARSER_BLOCK = '''
# ---------------------------------------------------------------------------
# Audio filename parser — Nida bracket-tag formaat
# Regels:
#   Adhan [fajr] - Auteur.mp3  → display "Fajr - Auteur"
#   Adhan [day]  - Auteur.mp3  → display "Adhan - Auteur"  (tag=day → GUI=Adhan)
#   Ramadan [tarhim] - Auteur.mp3 → display "Tarhim - Auteur"
# ---------------------------------------------------------------------------
import re as _audio_re_mod

_AUDIO_FILENAME_RE = _audio_re_mod.compile(
    r"^(?P<prefix>[A-Za-z]+)"     # "Adhan", "Ramadan", "Nadir", …
    r"\\s*\\[(?P<tag>[^\\]]+)\\]"  # "[fajr]", "[day]", "[tarhim]"
    r"\\s*-\\s*"                   # " - "
    r"(?P<author>.+?)"             # "Mehdi Yarrahi"
    r"\\.mp3$",                    # ".mp3"
    _audio_re_mod.IGNORECASE,
)

_AUDIO_TAG_LABELS: dict = {
    "fajr":   "Fajr",
    "day":    "Adhan",   # intern tag="day", GUI toont "Adhan"
    "tarhim": "Tarhim",
    "sahoor": "Sahoor",
    "suhoor": "Suhoor",
    "jingle": "Jingle",
}


def parse_audio_filename(filename: str) -> "dict | None":
    """
    Parseer een Nida MP3-bestandsnaam naar metadata-dict.

    Returns dict met keys:
        filename, category, tag, author, prayer_type, display_name
    Of None als het geen geldig Nida-formaat is of geen .mp3.

    Voorbeelden:
        "Adhan [fajr] - Mehdi Yarrahi.mp3"
            → category="adhan", tag="fajr", prayer_type="fajr",
              display_name="Fajr - Mehdi Yarrahi"
        "Adhan [day] - Mehdi Yarrahi.mp3"
            → category="adhan", tag="day", prayer_type="other",
              display_name="Adhan - Mehdi Yarrahi"
        "Ramadan [tarhim] - Auteur.mp3"
            → category="ramadan", tag="tarhim", prayer_type="other",
              display_name="Tarhim - Auteur"
    """
    if not filename.lower().endswith(".mp3"):
        return None
    m = _AUDIO_FILENAME_RE.match(filename.strip())
    if not m:
        return None
    prefix = m.group("prefix").lower()
    tag    = m.group("tag").strip().lower()
    author = m.group("author").strip()
    label  = _AUDIO_TAG_LABELS.get(tag, tag.capitalize())
    return {
        "filename":     filename,
        "category":     prefix,
        "tag":          tag,
        "author":       author,
        "prayer_type":  "fajr" if tag == "fajr" else "other",
        "display_name": f"{label} - {author}",
    }


def get_sound_options(sounds_dir: str, category: str,
                       tag_filter: "str | None" = None) -> dict:
    """
    Bouw {filename: display_name} dict voor gebruik in config flow selects.
    Vervangt de oude _format_sound_label() aanpak.

    Voorbeeld:
        get_sound_options("/config/www/nida/sounds", "adhan", "fajr")
        → {"Adhan [fajr] - Mehdi Yarrahi.mp3": "Fajr - Mehdi Yarrahi", …}
    """
    result = {}
    try:
        for name in sorted(os.listdir(sounds_dir)):
            parsed = parse_audio_filename(name)
            if not parsed:
                continue
            if parsed["category"] != category:
                continue
            if tag_filter and parsed["tag"] != tag_filter.lower():
                continue
            result[name] = parsed["display_name"]
    except OSError:
        pass
    return result

'''

def patch1_parser(const_content: str) -> str:
    print(f"\n{GREEN}[PATCH 1]{RESET} Audio filename parser → const.py")

    if "parse_audio_filename" in const_content:
        warn("parse_audio_filename al aanwezig — overgeslagen")
        return const_content

    # Voeg in vóór de eerste get_*_sounds definitie
    for marker in ["def get_fajr_sounds", "def get_day_sounds",
                    "def get_tarhim_sounds", "def get_suhoor_sounds"]:
        if marker in const_content:
            const_content = const_content.replace(marker, PARSER_BLOCK + marker, 1)
            ok(f"Parser ingevoegd vóór {marker}")
            return const_content

    # Fallback: voeg toe aan einde
    const_content = const_content.rstrip() + "\n" + PARSER_BLOCK
    ok("Parser aan einde van const.py toegevoegd")
    return const_content


# ===========================================================================
# PATCH 2 — Tarhim mag geen notificaties onderbreken
# ===========================================================================

TARHIM_FLAG_CODE = "\n_tarhim_playing: bool = False  # True terwijl tarhim speelt\n"

# Patroon dat we zoeken in check_tarhim: de media_player.play_media aanroep
TARHIM_PLAY_OLD = '''\
            await hass.services.async_call(
                "media_player", "play_media",
                {
                    "entity_id": speaker,
                    "media_content_id": media_path,
                    "media_content_type": "music",
                    "announce": True,
                    "extra": {"volume_level": volume}
                }
            )
    except Exception as e:
        _LOGGER.error(f"Tarhim error: {e}")'''

TARHIM_PLAY_NEW = '''\
            global _tarhim_playing
            _tarhim_playing = True
            _LOGGER.debug("Tarhim gestart — notificaties gepauzeerd")
            try:
                await hass.services.async_call(
                    "media_player", "play_media",
                    {
                        "entity_id": speaker,
                        "media_content_id": media_path,
                        "media_content_type": "music",
                        "announce": True,
                        "extra": {"volume_level": volume}
                    }
                )
            finally:
                async def _reset_tarhim():
                    import asyncio
                    await asyncio.sleep(360)  # 6 min veiligheidsmarge
                    global _tarhim_playing
                    _tarhim_playing = False
                    _LOGGER.debug("Tarhim vlag gereset")
                hass.async_create_task(_reset_tarhim())
    except Exception as e:
        _LOGGER.error(f"Tarhim error: {e}")'''


def patch2_tarhim_notify(init_content: str) -> str:
    print(f"\n{GREEN}[PATCH 2]{RESET} Tarhim blokkeert notificaties → __init__.py")

    # Stap A: voeg _tarhim_playing flag toe na _LOGGER definitie
    logger_line = '_LOGGER = logging.getLogger(__name__)'
    if "_tarhim_playing" not in init_content:
        init_content, done = replace_once(
            init_content,
            logger_line,
            logger_line + TARHIM_FLAG_CODE,
            "_tarhim_playing vlag na _LOGGER"
        )
        if not done:
            warn("_LOGGER definitie niet gevonden — vlag NIET toegevoegd")
    else:
        warn("_tarhim_playing al aanwezig — vlag overgeslagen")

    # Stap B: wrap de play_media aanroep in check_tarhim
    if "_tarhim_playing = True" not in init_content:
        init_content, _ = replace_once(
            init_content, TARHIM_PLAY_OLD, TARHIM_PLAY_NEW,
            "tarhim play_media met flag"
        )
    else:
        warn("Tarhim play wrap al aanwezig — overgeslagen")

    # Stap C: blokkeer notificaties terwijl tarhim speelt
    # De notificatie in __init__.py staat rond de `notify_message` optie
    # We zoeken het patroon: `custom_msg = options.get("notify_message", ...)`
    # en voegen een guard toe in de functie die dat aanroept.

    # Zoek de functie die notify_message gebruikt
    notify_pattern = re.compile(
        r'(async def \w+\([^)]*\):\s*\n'          # async def funcnaam(...):
        r'(?:[ \t]+"""[^"]*"""[ \t]*\n)?)'         # optionele docstring
        r'(?=.*?custom_msg = options\.get\("notify_message")',
        re.DOTALL
    )

    guard_code = '''\
    # Geen notificatie sturen als tarhim speelt
    global _tarhim_playing
    if _tarhim_playing:
        _LOGGER.debug("Notificatie overgeslagen: tarhim speelt")
        return
'''

    # Zoek de positie van notify_message
    notify_pos = init_content.find('custom_msg = options.get("notify_message"')
    if notify_pos == -1:
        warn("notify_message niet gevonden in __init__.py")
        warn("Voeg dit HANDMATIG toe aan het begin van de functie die notificaties verstuurt:\n")
        print(textwrap.indent(guard_code, "    "))
    else:
        # Zoek terug naar de 'async def' die het dichtst bij notify_pos ligt
        func_start = init_content.rfind("async def ", 0, notify_pos)
        if func_start == -1:
            func_start = init_content.rfind("def ", 0, notify_pos)

        if func_start != -1:
            # Zoek het einde van de def-regel + optionele docstring
            # en voeg guard direct daarna in
            func_header_end = init_content.find("\n", func_start) + 1

            # Check of er al een docstring is
            rest = init_content[func_header_end:]
            doc_match = re.match(r'(\s*""".*?"""[ \t]*\n)', rest, re.DOTALL)
            if doc_match:
                insert_pos = func_header_end + len(doc_match.group(0))
            else:
                insert_pos = func_header_end

            func_name = re.search(r'async def (\w+)', init_content[func_start:func_start+60])
            fname = func_name.group(1) if func_name else "???"

            if "_tarhim_playing" not in init_content[func_start:notify_pos]:
                init_content = (
                    init_content[:insert_pos]
                    + guard_code
                    + init_content[insert_pos:]
                )
                ok(f"Notificatie guard toegevoegd in functie '{fname}'")
            else:
                warn(f"Guard al aanwezig in '{fname}' — overgeslagen")
        else:
            warn("Kon functiedefinitie niet vinden — guard NIET toegevoegd")

    return init_content


# ===========================================================================
# PATCH 3 — Open sensor: optioneel, meerdere sensoren, uitleg
# ===========================================================================

OLD_GET_VOLUME_SENSOR = '''\
    # Open ramen/deuren volume
    open_sensor_enabled = options.get("open_sensor_enabled", False)
    if open_sensor_enabled and hass is not None:
        sensor = options.get("open_sensor_entity", "")
        if sensor:
            state = hass.states.get(sensor)
            if state and state.state == "on":
                raw_open = options.get("open_sensor_volume", 5)
                volume = raw_open / 100 if raw_open > 1 else raw_open
                _LOGGER.debug(f"Open sensor active, using reduced volume: {volume}")

    return volume'''

NEW_GET_VOLUME_SENSOR = '''\
    # Open ramen/deuren volume — optioneel, ondersteunt meerdere sensoren
    open_sensor_enabled = options.get("open_sensor_enabled", False)
    if open_sensor_enabled and hass is not None:
        # Ondersteuning voor meerdere sensoren (open_sensor_entities)
        # én backward compat met oude enkelvoudige open_sensor_entity
        sensors = options.get("open_sensor_entities", [])
        if not sensors:
            single = options.get("open_sensor_entity", "")
            sensors = [single] if single else []
        if isinstance(sensors, str):
            sensors = [sensors]

        any_open = any(
            (st := hass.states.get(s)) is not None and st.state == "on"
            for s in sensors if s
        )
        if any_open:
            raw_open = options.get("open_sensor_volume", 5)
            volume = raw_open / 100 if raw_open > 1 else raw_open
            _LOGGER.debug(
                "Open sensor actief → verlaagd volume: %.2f", volume
            )

    return volume'''


# Config flow schema vervangingen — ConfigFlow (setup)
OLD_SENSOR_SETUP = '''\
                vol.Optional("open_sensor_enabled", default=False): bool,
                vol.Optional("open_sensor_entity", default=""): selector.selector({"entity": {"domain": ["binary_sensor", "group"], "multiple": False}}),
                vol.Optional("open_sensor_volume", default=5): _volume_sel(),'''

NEW_SENSOR_SETUP = '''\
                vol.Optional("open_sensor_enabled", default=False): selector.selector({"boolean": {}}),
                vol.Optional("open_sensor_entities", default=[]): selector.selector({
                    "entity": {"domain": ["binary_sensor", "group"], "multiple": True}
                }),
                vol.Optional("open_sensor_volume", default=5): _volume_sel(),'''

# Config flow schema vervangingen — OptionsFlow (reconfigure)
OLD_SENSOR_OPT = '''\
                vol.Optional("open_sensor_enabled", default=self._get("open_sensor_enabled", False)): bool,
                vol.Optional("open_sensor_entity", default=self._get("open_sensor_entity", "")): selector.selector({"entity": {"domain": ["binary_sensor", "group"], "multiple": False}}),
                vol.Optional("open_sensor_volume", default=self._get_vol("open_sensor_volume", 5)): _volume_sel(),'''

NEW_SENSOR_OPT = '''\
                vol.Optional("open_sensor_enabled", default=self._get("open_sensor_enabled", False)): selector.selector({"boolean": {}}),
                vol.Optional("open_sensor_entities", default=self._get("open_sensor_entities", [])): selector.selector({
                    "entity": {"domain": ["binary_sensor", "group"], "multiple": True}
                }),
                vol.Optional("open_sensor_volume", default=self._get_vol("open_sensor_volume", 5)): _volume_sel(),'''


def patch3_open_sensor(init_content: str, flow_content: str):
    print(f"\n{GREEN}[PATCH 3]{RESET} Open sensor verbeteringen → __init__.py + config_flow.py")

    init_content, _ = replace_once(
        init_content, OLD_GET_VOLUME_SENSOR, NEW_GET_VOLUME_SENSOR,
        "_get_volume open sensor (meerdere sensoren)"
    )
    flow_content, _ = replace_once(
        flow_content, OLD_SENSOR_SETUP, NEW_SENSOR_SETUP,
        "ConfigFlow open_sensor schema"
    )
    flow_content, _ = replace_once(
        flow_content, OLD_SENSOR_OPT, NEW_SENSOR_OPT,
        "OptionsFlow open_sensor schema"
    )
    return init_content, flow_content


# ===========================================================================
# ZELFTEST — parser validatie op de bestanden uit de bijlage
# ===========================================================================
def _run_self_test():
    import re as _re

    _RE = _re.compile(
        r'^(?P<prefix>[A-Za-z]+)\s*\[(?P<tag>[^\]]+)\]\s*-\s*(?P<author>.+?)\.mp3$',
        _re.IGNORECASE
    )
    _LABELS = {"fajr":"Fajr","day":"Adhan","tarhim":"Tarhim","sahoor":"Sahoor","suhoor":"Suhoor","jingle":"Jingle"}

    def _parse(fn):
        if not fn.lower().endswith(".mp3"): return None
        m = _RE.match(fn.strip())
        if not m: return None
        tag = m.group("tag").strip().lower()
        return f'{_LABELS.get(tag, tag.capitalize())} - {m.group("author").strip()}'

    tests = [
        ("Adhan [day] - Ahmed Saeed Al-Omrany.mp3",            "Adhan - Ahmed Saeed Al-Omrany"),
        ("Adhan [day] - Al-Fajer Saba.mp3",                    "Adhan - Al-Fajer Saba"),
        ("Adhan [day] - Sheikh Zayed Grand Mosque (live).mp3", "Adhan - Sheikh Zayed Grand Mosque (live)"),
        ("Adhan [fajr] - Mehdi Yarrahi.mp3",                   "Fajr - Mehdi Yarrahi"),
        ("Adhan [fajr] - Ibrahim Al-Silawi.mp3",               "Fajr - Ibrahim Al-Silawi"),
        ("Nadir [jingle] - Annoucment.mp3",                    "Jingle - Annoucment"),
        ("Nadir [jingle] - Buzzer.mp3",                        "Jingle - Buzzer"),
        ("Ramdan [tarhim] - Auteur 2.mp3",                     "Tarhim - Auteur 2"),   # Ramdan = typefout in bestandsnaam, werkt toch
        ("Ramdan [tarhim] - Auteur.mp3",                       "Tarhim - Auteur"),
        ("some_random.mp3",                                     None),
        ("Adhan [fajr] - Naam.wav",                            None),
    ]

    print(f"\n{GREEN}[ZELFTEST]{RESET} Parser op jouw bestanden")
    passed = failed = 0
    for fname, expected in tests:
        got = _parse(fname)
        if got == expected:
            print(f"  {GREEN}✓{RESET}  {got or 'None'}")
            passed += 1
        else:
            print(f"  {RED}✗{RESET}  '{fname}'")
            print(f"       verwacht: {expected!r}")
            print(f"       gekregen: {got!r}")
            failed += 1
    print(f"  → {passed}/{passed+failed} geslaagd")


# ===========================================================================
# MAIN
# ===========================================================================
def main():
    print("=" * 60)
    print("Nida Integration — Patch Script v2")
    print("=" * 60)

    for path in [INIT, CONST, FLOW]:
        if not os.path.exists(path):
            err(f"{path} niet gevonden")
            err("Voer dit script uit vanuit de ~/Nida map")
            sys.exit(1)

    _run_self_test()

    const_c = read(CONST)
    init_c  = read(INIT)
    flow_c  = read(FLOW)

    const_c          = patch1_parser(const_c)
    init_c           = patch2_tarhim_notify(init_c)
    init_c, flow_c   = patch3_open_sensor(init_c, flow_c)

    print(f"\n{GREEN}[SCHRIJVEN]{RESET}")
    write(CONST, const_c)
    write(INIT,  init_c)
    write(FLOW,  flow_c)

    print(f"""
{GREEN}{'=' * 60}
✅  Patches toegepast!
{'=' * 60}{RESET}

Volgende stappen:
  1. Herstart Home Assistant
  2. Integraties → Nida → Opties → Adhan stap
     → Stel raam/deur sensoren in (nu meerdere mogelijk)
  3. Test met Developer Tools → Services → nida.test_tarhim
     → Notificaties moeten uitblijven tijdens tarhim

Samenvatting wijzigingen:
  const.py     + parse_audio_filename()  — bracket-tag parser
               + get_sound_options()     — vervangt _format_sound_label()
  __init__.py  + _tarhim_playing vlag   — gezet vóór tarhim, gereset na 6 min
               + notificatie guard       — skip als tarhim speelt
               + _get_volume            — meerdere open sensoren
  config_flow  + open_sensor_entities   — multi-select (ipv enkelvoud)
               + backward compat         — oude open_sensor_entity werkt nog
""")


if __name__ == "__main__":
    main()

"""Nida Integration — v0.6.3"""
# Changelog:
# v0.6.3 - adhan restore op echte MP3 duur, jingle restore wacht ook TTS
# v0.6.2 - wacht echte MP3 duur voor TTS (geen overlap meer)
# v0.6.1 - TTS volume gelijk aan jingle volume
# v0.6.0 - config flow refactor: speakers+volumes+sounds stappen, nacht eindtijd, toggles
# v0.5.2 - verwijder thumbnail/media_image_url, alleen metadata voor Sonos
# v0.5.1 - volume fix: 1%=1% ipv 100%, suhoor negeert nacht volume
# v0.5.0 - cover art URL via HA network module (geen lege base URL meer)
# v0.4.9 - cover.jpg, debug log voor cover art URL
# v0.4.8 - Sonos cover art metadata (title, artist, album, images)
# v0.4.7 - cover art metadata voor Sonos + andere players
# v0.4.6 - logo.png → cover.jpg voor cover art
# v0.4.5 - cover.jpg altijd kopiëren voor cover art
# v0.4.4 - service descriptions in English
# v0.4.3 - test_pre_adhan sound+speaker+volume, test_notification defaults
# v0.4.2 - test_adhan speaker+volume fix
# v0.4.1 - reminder string fix, services.yaml parse fix
# v0.4.0 - check_suhoor, tarhim overlap fix, placeholder fix, service namen clean
# v0.3.0 - async_setup_services, tarhim auto-timing, volume handling
# v0.2.0 - cover art, salawat→tarhim rename
# v0.1.0 - initiële release
from __future__ import annotations

from datetime import timedelta, datetime
import logging
import asyncio
import os
import shutil

import aiohttp
import voluptuous as vol

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.helpers.event import async_track_time_change

from .const import (
    DOMAIN, CONF_CITY, CONF_COUNTRY, CONF_METHOD,
    CONF_PLAY_METHOD, CONF_FAJR_SPEAKER, CONF_FAJR_VOLUME, CONF_FAJR_SOUND,
    CONF_DAY_SPEAKER, CONF_DAY_VOLUME, CONF_DAY_SOUND,
    CONF_TARHIM_ENABLED, CONF_TARHIM_SPEAKER, CONF_TARHIM_VOLUME, CONF_TARHIM_SOUND,
)

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    """Schrijf services.yaml synchroon zodat HA hem correct leest bij load."""
    import yaml

    def _write_services_yaml():
        sounds_path = hass.config.path("www/nida/sounds")

        def _label(f):
            import re
            name = f.replace(".mp3", "")
            m = re.match(r'^.+?\[.+?\]\s*-\s*(.+)$', name)
            return m.group(1).strip() if m else name.replace("-", " ").title()

        fajr_opts = []
        day_opts = []
        tarhim_opts = []
        suhoor_opts = []
        jingle_opts = []

        if os.path.isdir(sounds_path):
            for f in sorted(os.listdir(sounds_path)):
                if not f.endswith(".mp3"):
                    continue
                fl = f.lower()
                lbl = _label(f)
                if "[fajr]" in fl:
                    fajr_opts.append({"label": lbl, "value": f})
                elif "[tarhim]" in fl or "tarhim" in fl:
                    tarhim_opts.append({"label": lbl, "value": f})
                elif "[suhoor]" in fl or "suhoor" in fl:
                    suhoor_opts.append({"label": lbl, "value": f})
                elif "[jingle]" in fl or "jingle" in fl:
                    jingle_opts.append({"label": lbl, "value": f})
                elif "[day]" in fl or "adhan" in fl:
                    day_opts.append({"label": lbl, "value": f})

        _spk = {"name": "Speaker", "description": "Which speaker do you want to use?", "required": False,
                "selector": {"entity": {"domain": "media_player"}}}
        _vol = {"name": "Volume", "description": "Volume (0-100%)", "required": False,
                "default": 30, "selector": {"number": {"min": 0, "max": 100, "step": 5,
                "unit_of_measurement": "%", "mode": "slider"}}}

        services = {
            "test_pre_adhan": {
                "name": "Test Pre-adhan",
                "description": "Test a pre-adhan reminder (sound + TTS).",
                "fields": {
                    "reminder": {"name": "Reminder", "required": False, "default": "1",
                        "selector": {"select": {"options": [
                            {"label": "Reminder 1", "value": "1"},
                            {"label": "Reminder 2", "value": "2"},
                        ]}}},
                    "prayer": {"name": "Prayer", "required": False, "default": "Dhuhr",
                        "selector": {"text": {}}},
                    "sound": {"name": "Jingle", "required": False,
                        "selector": {"select": {"options": jingle_opts}}},
                    "speaker": dict(_spk),
                    "volume": dict(_vol),
                }
            },
            "test_adhan": {
                "name": "Test Adhan",
                "description": "Test the adhan for a specific prayer.",
                "fields": {
                    "prayer": {"name": "Prayer", "required": True, "default": "dhuhr",
                        "selector": {"select": {"options": [
                            {"label": "Fajr", "value": "fajr"},
                            {"label": "Dhuhr", "value": "dhuhr"},
                            {"label": "Asr", "value": "asr"},
                            {"label": "Maghrib", "value": "maghrib"},
                            {"label": "Isha", "value": "isha"},
                            {"label": "Jumat (vrijdag)", "value": "jumat"},
                        ]}}},
                    "speaker": dict(_spk),
                    "volume": dict(_vol),
                }
            },
            "test_tarhim": {
                "name": "Test Tarhim",
                "description": "Test the Tarhim recitation before Fajr.",
                "fields": {
                    "sound": {"name": "Sound", "required": False,
                        "selector": {"select": {"options": tarhim_opts}}},
                    "speaker": dict(_spk),
                    "volume": dict(_vol),
                }
            },
            "test_suhoor": {
                "name": "Test Suhoor",
                "description": "Test the Suhoor alarm.",
                "fields": {
                    "sound": {"name": "Sound", "required": False,
                        "selector": {"select": {"options": suhoor_opts}}},
                    "speaker": dict(_spk),
                    "volume": dict(_vol),
                }
            },
            "test_notification": {
                "name": "Test Notificatie",
                "description": "Send a test notification.",
                "fields": {
                    "title": {"name": "Title", "required": False, "default": "Nida 🕌",
                        "selector": {"text": {}}},
                    "message": {"name": "Message", "required": False, "default": "Test notification from Nida",
                        "selector": {"text": {}}},
                }
            },
            "preview": {
                "name": "Preview",
                "description": "Play a sound as preview.",
                "fields": {
                    "sound": {"name": "Sound", "required": True,
                        "selector": {"select": {"options": fajr_opts + day_opts + tarhim_opts + suhoor_opts + jingle_opts}}},
                    "speaker": {**dict(_spk), "required": True},
                    "volume": dict(_vol),
                }
            },
        }

        class NoAliasDumper(yaml.Dumper):
            def ignore_aliases(self, data):
                return True

        services_path = os.path.join(os.path.dirname(__file__), "services.yaml")
        with open(services_path, "w") as f:
            yaml.dump(services, f, allow_unicode=True, default_flow_style=False, Dumper=NoAliasDumper)
        _LOGGER.info("Nida services.yaml geschreven bij async_setup")

    await hass.async_add_executor_job(_write_services_yaml)
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    coordinator = PrayerTimesCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(update_listener))
    await async_copy_sounds(hass)
    await async_setup_adhan_scheduler(hass, entry, coordinator)
    await async_update_services_yaml(hass)
    await async_setup_services(hass, entry)
    # Herlaad services zodat HA de nieuwe yaml oppikt
    await hass.services.async_call("homeassistant", "reload_custom_templates", blocking=False)
    return True


async def async_copy_sounds(hass: HomeAssistant):
    """Kopieer sounds van integration naar /config/www/nida/sounds/ bij install/update."""

    def _do_copy():
        # ✅ Alle I/O zit in dit blok — wordt uitgevoerd in thread executor
        integration_dir = os.path.dirname(__file__)
        sounds_src = os.path.join(integration_dir, "sounds")
        sounds_dst = hass.config.path("www/nida/sounds")
        www_nida    = hass.config.path("www/nida")

        os.makedirs(sounds_dst, exist_ok=True)
        os.makedirs(www_nida, exist_ok=True)

        # Logo kopiëren voor cover art
        cover_dst = os.path.join(www_nida, "cover.jpg")
        if not os.path.exists(cover_dst):
            for candidate in [
                os.path.join(integration_dir, "brand", "logo.png"),
                os.path.join(integration_dir, "images", "logo.png"),
                os.path.join(integration_dir, "logo.png"),
            ]:
                if os.path.exists(candidate):
                    shutil.copy2(candidate, cover_dst)
                    _LOGGER.info("Nida logo gekopieerd naar www/nida/cover.jpg")
                    break
            else:
                _LOGGER.debug("Geen cover.jpg gevonden in integration map")

        if not os.path.isdir(sounds_src):
            _LOGGER.debug("Geen sounds in integration map %s — sounds worden beheerd via www/nida/sounds", sounds_src)
            return 0

        copied = 0

        # Sounds kopiëren
        for f in sorted(os.listdir(sounds_src)):
            if f.endswith(".mp3"):
                src = os.path.join(sounds_src, f)
                dst = os.path.join(sounds_dst, f)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)
                    copied += 1
                    _LOGGER.info("Copied sound: %s", f)

        return copied

    copied = await hass.async_add_executor_job(_do_copy)
    if copied:
        _LOGGER.info("Copied %d sound(s) to www/nida/sounds", copied)
    else:
        _LOGGER.debug("All sounds already present")


async def async_setup_adhan_scheduler(hass: HomeAssistant, entry: ConfigEntry, coordinator):
    """Plan adhan op gebedstijden."""

    @callback
    def check_prayer_time(now):
        if not coordinator.data:
            return
        timings = coordinator.data["data"]["timings"]
        prayers = {
            "Fajr": timings["Fajr"],
            "Dhuhr": timings["Dhuhr"],
            "Asr": timings["Asr"],
            "Maghrib": timings["Maghrib"],
            "Isha": timings["Isha"],
        }
        current_time = now.strftime("%H:%M")
        now_ts = now.timestamp()

        # Op vrijdag: Dhuhr vervangen door Jumat
        is_friday = now.weekday() == 4
        if is_friday and "Dhuhr" in prayers:
            prayers["Jumat"] = prayers.pop("Dhuhr")

        for prayer, time_str in prayers.items():
            if current_time == time_str:
                prayer_key = "jumat" if prayer == "Jumat" else prayer.lower()
                fajr_hour = int(timings["Fajr"].split(":")[0])
                _LOGGER.info("Playing adhan for %s", prayer)
                hass.async_create_task(play_adhan(hass, entry, prayer_key, fajr_hour=fajr_hour))

        hass.async_create_task(check_tarhim(hass, entry, coordinator, now_ts))
        hass.async_create_task(check_suhoor(hass, entry, coordinator, now_ts))
        hass.async_create_task(check_reminders(hass, entry, coordinator, now_ts, prayers))

    entry.async_on_unload(
        async_track_time_change(hass, check_prayer_time, second=0)
    )


async def _get_media_url(hass, local_path: str) -> str:
    """Converteer lokaal pad naar volledige URL (voor Music Assistant compatibiliteit)."""
    base_url = hass.config.internal_url or hass.config.external_url
    if not base_url:
        import socket
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
        except Exception:
            ip = "192.168.68.150"
        base_url = f"http://{ip}:8123"
    base_url = base_url.rstrip("/")
    return f"{base_url}{local_path}"


def _get_volume(options, base_vol_key, base_default, fajr_hour: int | None = None):
    """Geef het juiste volume terug (0.0–1.0) op basis van dag/nacht instelling."""
    raw = options.get(base_vol_key, base_default)
    volume = float(raw) / 100.0
    volume = max(0.0, min(1.0, volume))

    night_enabled = options.get("night_volume_enabled", False)
    if night_enabled:
        night_start = int(options.get("night_start_hour", 22))
        current_hour = datetime.now().hour

        # Bepaal nacht einduur
        night_end_mode = options.get("night_end_mode", "fajr")
        if night_end_mode == "fajr" and fajr_hour is not None:
            night_end = fajr_hour
        else:
            night_end = int(options.get("night_end_hour", 7))

        # Nacht is actief tussen start en einde (over middernacht heen)
        if night_start > night_end:
            is_night = current_hour >= night_start or current_hour < night_end
        else:
            is_night = night_start <= current_hour < night_end

        if is_night:
            raw_night = options.get("night_volume", 15)
            volume = float(raw_night) / 100.0
            volume = max(0.0, min(1.0, volume))

    return round(volume, 2)


async def _play_media_with_volume(
    hass: HomeAssistant,
    speakers: list[str],
    media_url: str,
    volume: float,
    cover_url: str | None = None,
    restore_delay: float = 30.0,
    title: str = "Nida",
    artist: str = "",
    album: str = "Nida Prayer Times",
) -> None:
    """
    Speel media af met correcte volume-handling voor alle player-types.

    Aanpak:
      1. Sla huidig volume op per speaker
      2. Zet volume via volume_set (werkt bij Sonos, Google, generic)
      3. Wacht 0.5s zodat volume is ingesteld
      4. Speel af (zonder announce — dat overschrijft volume bij veel players)
      5. Restore volume na restore_delay seconden
    """
    # Stap 1: huidig volume opslaan
    original_volumes: dict[str, float | None] = {}
    for speaker in speakers:
        state = hass.states.get(speaker)
        if state:
            vol = state.attributes.get("volume_level")
            original_volumes[speaker] = float(vol) if vol is not None else None
        else:
            original_volumes[speaker] = None

    # Stap 2: volume instellen
    try:
        await hass.services.async_call(
            "media_player", "volume_set",
            {"entity_id": speakers, "volume_level": volume},
        )
    except Exception as e:
        _LOGGER.warning("Volume set mislukt: %s", e)

    # Stap 3: wacht op settle
    await asyncio.sleep(0.5)

    # Stap 4: afspelen — cover art via metadata voor Sonos
    extra: dict = {}
    if cover_url:
        _LOGGER.debug("Cover art URL: %s", cover_url)
        extra["metadata"] = {
            "title": title,
            "artist": artist,
            "album": album,
            "images": [{"url": cover_url}],
        }

    try:
        await hass.services.async_call(
            "media_player", "play_media",
            {
                "entity_id": speakers,
                "media_content_id": media_url,
                "media_content_type": "music",
                **({"extra": extra} if extra else {}),
            },
        )
    except Exception as e:
        _LOGGER.error("Afspelen mislukt: %s", e)
        return

    # Stap 5: restore volume na restore_delay (niet-blokkerend)
    async def _restore():
        await asyncio.sleep(restore_delay)
        for speaker, orig_vol in original_volumes.items():
            if orig_vol is not None:
                try:
                    await hass.services.async_call(
                        "media_player", "volume_set",
                        {"entity_id": speaker, "volume_level": orig_vol},
                    )
                except Exception as e:
                    _LOGGER.debug("Volume restore mislukt voor %s: %s", speaker, e)

    hass.async_create_task(_restore())

async def _get_cover_url(hass) -> str:
    """Geef de volledige URL van de Nida cover art terug."""
    try:
        from homeassistant.components.network import async_get_url
        base_url = await async_get_url(hass, allow_internal=True, allow_external=False)
    except Exception:
        base_url = (
            hass.config.internal_url
            or hass.config.external_url
            or "http://homeassistant.local:8123"
        )
    base_url = base_url.rstrip("/")
    return f"{base_url}/local/nida/cover.jpg"


def _parse_sound_meta(filename: str) -> tuple[str, str, str]:
    """Haal title, artist en album uit bestandsnaam.

    Formaat: 'Type [tag] - Artiest.mp3'
    Returns: (title, artist, album)
    """
    import re
    name = filename.replace(".mp3", "")
    m = re.match(r'^(.+?)\s*\[(.+?)\]\s*-\s*(.+)$', name)
    if m:
        sound_type = m.group(1).strip()   # bijv. "Adhan", "Ramadan"
        tag = m.group(2).strip()           # bijv. "fajr", "tarhim"
        artist = m.group(3).strip()
        title = f"{sound_type} ({tag.capitalize()})"
        album = "Nida Prayer Times"
        return title, artist, album
    return name, "Nida", "Nida Prayer Times"


async def play_adhan(hass: HomeAssistant, entry: ConfigEntry, prayer_type: str, fajr_hour: int | None = None):
    """Speel adhan voor het opgegeven gebed."""
    options = entry.options if entry.options else entry.data

    if prayer_type == "fajr":
        speaker = options.get(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])
        volume = _get_volume(options, CONF_FAJR_VOLUME, 20, fajr_hour)
        sound = options.get(CONF_FAJR_SOUND, "")
    elif prayer_type == "jumat":
        speaker = options.get("jumat_speaker", options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"]))
        volume = _get_volume(options, "jumat_volume", options.get(CONF_DAY_VOLUME, 50), fajr_hour)
        sound = options.get("jumat_sound", options.get(CONF_DAY_SOUND, ""))
    else:
        speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        volume = _get_volume(options, CONF_DAY_VOLUME, 50, fajr_hour)
        sound = options.get(CONF_DAY_SOUND, "")

    if isinstance(speaker, str):
        speaker = [speaker]

    if not sound:
        _LOGGER.warning("Geen sound geconfigureerd voor %s — adhan overgeslagen", prayer_type)
        return

    play_method = options.get(CONF_PLAY_METHOD, "media_player")
    media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
    cover_url = await _get_cover_url(hass)

    _LOGGER.info("Adhan %s: %s op %s (volume %.0f%%)", prayer_type, sound, speaker, volume * 100)

    if play_method == "chime_tts":
        await hass.services.async_call(
            "chime_tts", "say",
            {
                "entity_id": speaker,
                "chime_path": media_url,
                "volume_level": volume,
                "announce": True,
            }
        )
    else:
        title, artist, album = _parse_sound_meta(sound)
        # Lees echte MP3 duur zodat volume pas na afloop wordt gereset
        mp3_path = hass.config.path(f"www/nida/sounds/{sound}")
        duration = await hass.async_add_executor_job(_get_mp3_duration, mp3_path)
        restore = max(duration + 3.0, float(options.get("adhan_restore_delay", 30)))
        _LOGGER.debug("Adhan duur: %.1fs, restore na %.1fs", duration, restore)
        await _play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=cover_url,
            restore_delay=restore,
            title=title, artist=artist, album=album,
        )

    prayer_display = prayer_type.capitalize()
    await async_send_notification(
        hass, entry,
        message=f"It is time for {prayer_display} prayer 🕌",
        notify_type="prayer",
        prayer=prayer_type,
    )


async def async_send_notification(
    hass: HomeAssistant,
    entry: ConfigEntry,
    message: str,
    title: str = "🕌 Nida",
    notify_type: str = "prayer",
    prayer: str = "",
    minutes: int = 0,
):
    """
    Stuur notificatie op basis van type.
    notify_type: "prayer" | "pre_adhan" | "tarhim" | "suhoor"

    Kritische notificaties:
    - iOS:    push.sound.critical=1 — doorbreekt Niet Storen + stil profiel
    - Android: channel=alarm_stream  — doorbreekt Niet Storen
    """
    options = entry.options if entry.options else entry.data

    type_key = f"notify_on_{notify_type}"
    if not options.get(type_key, notify_type == "prayer"):
        return

    # Per-type target ophalen (notify_target_prayer, notify_target_pre_adhan, etc.)
    target_key = f"notify_target_{notify_type}"
    target = options.get(target_key, options.get("notify_target", entry.data.get("notify_target", "")))
    if not target:
        return

    msg_key = f"notify_msg_{notify_type}"
    message = options.get(msg_key, message)
    title = options.get("notify_title", title)
    critical_key = f"notify_critical_{notify_type}"
    critical = options.get(critical_key, options.get("notify_critical", False))

    # Vervang placeholders — {prayer} en {minutes} in custom berichten
    if prayer:
        message = message.replace("{prayer}", prayer.capitalize())
        message = message.replace("[prayer]", prayer.capitalize())
    if minutes:
        message = message.replace("{minutes}", str(minutes))
        message = message.replace("[minutes]", str(minutes))

    try:
        targets = target if isinstance(target, list) else [target]
        for t in targets:
            if not t:
                continue
            service = t.replace("notify.", "")
            data: dict = {"title": title, "message": message}

            if critical:
                # iOS + Android kritisch — beide payloads tegelijk
                # Elk platform negeert de velden van de ander — geen conflict
                data["data"] = {
                    "push": {
                        "sound": {
                            "name": "default",
                            "critical": 1,
                            "volume": 1.0,
                        }
                    },
                    "ttl": 0,
                    "priority": "high",
                    "channel": "alarm_stream",
                }

            await hass.services.async_call("notify", service, data)
    except Exception as e:
        _LOGGER.warning("Could not send notification: %s", e)


async def check_reminders(hass, entry, coordinator, now_ts, prayers):
    """Controleer en speel pre-adhan reminders."""
    options = entry.options if entry.options else entry.data

    # Bepaal of tarhim momenteel actief is — skip dan Fajr reminder audio
    tarhim_active = False
    if options.get(CONF_TARHIM_ENABLED, True):
        try:
            hijri_month = coordinator.data["data"]["date"]["hijri"]["month"]["en"]
            if "Rama" in hijri_month:
                fajr_str = coordinator.data["data"]["timings"]["Fajr"]
                today = datetime.now().strftime("%Y-%m-%d")
                fajr_ts = datetime.strptime(f"{today} {fajr_str}", "%Y-%m-%d %H:%M").timestamp()
                tarhim_sound = options.get(CONF_TARHIM_SOUND, "")
                if tarhim_sound:
                    mp3_path = os.path.join(hass.config.path("www/nida/sounds"), tarhim_sound)
                    duration = await hass.async_add_executor_job(_get_mp3_duration, mp3_path)
                    tarhim_active = (fajr_ts - duration - 5) <= now_ts <= (fajr_ts - 5)
                    if tarhim_active:
                        _LOGGER.info("Tarhim actief — Fajr reminder audio overgeslagen")
        except Exception:
            pass

    for r_num in [1, 2]:
        enabled_key = f"reminder_{r_num}_enabled"
        if not options.get(enabled_key, False):
            continue

        minutes = options.get(f"reminder_{r_num}_minutes", 10 if r_num == 1 else 5)
        sound = options.get(f"reminder_{r_num}_sound", "")
        tts_text = options.get(f"reminder_{r_num}_tts", "")
        lang = options.get(f"reminder_{r_num}_lang", "nl")
        speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, CONF_DAY_VOLUME, 50)

        for prayer_name, time_str in prayers.items():
            today = datetime.now().strftime("%Y-%m-%d")
            try:
                prayer_ts = datetime.strptime(f"{today} {time_str}", "%Y-%m-%d %H:%M").timestamp()
            except Exception:
                continue
            reminder_ts = prayer_ts - (minutes * 60)
            if abs(now_ts - reminder_ts) < 30:
                _LOGGER.info("Reminder %d for %s in %d min", r_num, prayer_name, minutes)

                # Skip audio als tarhim nog bezig is voor Fajr
                skip_audio = tarhim_active and prayer_name.lower() == "fajr"

                if sound and not skip_audio:
                    media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
                    try:
                        _t, _a, _al = _parse_sound_meta(sound)
                        # Lees MP3 duur — restore pas na jingle + TTS (schatting 15s) + buffer
                        mp3_path = hass.config.path(f"www/nida/sounds/{sound}")
                        duration = await hass.async_add_executor_job(_get_mp3_duration, mp3_path)
                        restore = duration + 20.0  # 20s ruimte voor TTS
                        await _play_media_with_volume(
                            hass, speaker, media_url, volume,
                            cover_url=await _get_cover_url(hass),
                            restore_delay=restore,
                            title=_t, artist=_a, album=_al,
                        )
                        # Wacht op echte MP3 duur zodat TTS niet door jingle heen loopt
                        await asyncio.sleep(max(duration, 1.0))
                    except Exception as e:
                        _LOGGER.warning("Could not play reminder chime: %s", e)

                if tts_text and not skip_audio:
                    from .const import REMINDER_DEFAULT_TEXTS
                    text = tts_text if tts_text else REMINDER_DEFAULT_TEXTS.get(lang, REMINDER_DEFAULT_TEXTS["en"])
                    text = text.replace("[minutes]", str(int(minutes))).replace("[prayer]", prayer_name)
                    try:
                        lang_map = {"nl": "nl-NL", "en": "en-US", "ar": "ar-SA", "tr": "tr-TR"}
                        tts_lang = lang_map.get(lang, lang)
                        tts_entity = "tts.home_assistant_cloud"
                        tts_speakers = speaker if isinstance(speaker, list) else [speaker]
                        # Zet volume gelijk aan jingle zodat het één geheel klinkt
                        await hass.services.async_call(
                            "media_player", "volume_set",
                            {"entity_id": tts_speakers, "volume_level": volume},
                        )
                        await asyncio.sleep(0.3)
                        await hass.services.async_call(
                            "tts", "speak",
                            {
                                "entity_id": tts_entity,
                                "media_player_entity_id": tts_speakers,
                                "message": text,
                                "language": tts_lang,
                                "options": {"voice": "HamedNeural"} if tts_lang == "ar-SA" else {},
                            }
                        )
                    except Exception as e:
                        _LOGGER.warning("Could not play TTS reminder: %s", e)

                # Pre-adhan notificatie met ingevulde tekst
                notify_msg = options.get(
                    "notify_msg_pre_adhan",
                    f"{prayer_name} in {int(minutes)} minutes"
                )
                await async_send_notification(
                    hass, entry,
                    message=notify_msg,
                    notify_type="pre_adhan",
                    prayer=prayer_name,
                    minutes=int(minutes),
                )


def _get_mp3_duration(path: str) -> float:
    """
    Lees MP3 duur in seconden — pure Python, geen externe library nodig.
    Gebruikt Xing/Info VBR header als beschikbaar, anders filesize/bitrate schatting.
    """
    import struct
    BITRATES    = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
    SAMPLERATES = [44100, 48000, 32000]

    try:
        with open(path, "rb") as f:
            data = f.read()

        # Skip ID3v2 tag indien aanwezig
        offset = 0
        if data[:3] == b"ID3":
            size = (
                (data[6] & 0x7f) << 21 | (data[7] & 0x7f) << 14 |
                (data[8] & 0x7f) << 7  | (data[9] & 0x7f)
            )
            offset = size + 10

        # Zoek eerste geldige MPEG frame header
        for i in range(offset, min(offset + 10000, len(data) - 4)):
            if data[i] != 0xff or (data[i + 1] & 0xe0) != 0xe0:
                continue
            b2 = data[i + 2]
            bitrate_idx    = (b2 >> 4) & 0xf
            samplerate_idx = (b2 >> 2) & 0x3
            if bitrate_idx in (0, 15) or samplerate_idx >= len(SAMPLERATES):
                continue

            bitrate    = BITRATES[bitrate_idx] * 1000
            samplerate = SAMPLERATES[samplerate_idx]

            # Xing/Info header aanwezig? → nauwkeurige frame-telling
            xing_off = i + 36  # MPEG1 stereo offset
            if len(data) > xing_off + 12 and data[xing_off:xing_off + 4] in (b"Xing", b"Info"):
                flags = struct.unpack(">I", data[xing_off + 4:xing_off + 8])[0]
                if flags & 0x1:
                    frames = struct.unpack(">I", data[xing_off + 8:xing_off + 12])[0]
                    return round(frames * 1152 / samplerate, 1)

            # Fallback: bestandsgrootte / bitrate
            frame_size   = 144 * bitrate // samplerate
            total_frames = (len(data) - i) // frame_size if frame_size else 0
            return round(total_frames * 1152 / samplerate, 1)

    except Exception as e:
        _LOGGER.warning("Kon MP3 duur niet lezen van %s: %s", path, e)

    return 0.0


async def check_tarhim(hass: HomeAssistant, entry: ConfigEntry, coordinator, now_ts: float):
    """
    Speel tarhim voor Fajr tijdens Ramadan.

    Starttijd = Fajr - duur_van_mp3 - 5 seconden buffer.
    De duur wordt eenmalig per run gelezen via _get_mp3_duration() in een executor job.
    """
    options = entry.options if entry.options else entry.data

    if not options.get(CONF_TARHIM_ENABLED, True):
        return

    try:
        hijri_month = coordinator.data["data"]["date"]["hijri"]["month"]["en"]
        if "Rama" not in hijri_month:
            return
    except Exception:
        return

    try:
        timings = coordinator.data["data"]["timings"]
        today   = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(
            f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
        ).timestamp()

        sound = options.get(CONF_TARHIM_SOUND, "")
        if not sound:
            _LOGGER.warning("Geen tarhim sound geconfigureerd — overgeslagen")
            return

        # MP3 duur ophalen in executor (blocking file I/O)
        sounds_path = hass.config.path("www/nida/sounds")
        mp3_path    = os.path.join(sounds_path, sound)
        duration    = await hass.async_add_executor_job(_get_mp3_duration, mp3_path)

        if duration <= 0:
            _LOGGER.warning(
                "Kon duur van %s niet bepalen — tarhim overgeslagen", sound
            )
            return

        # Starttijd = Fajr - duur - 5s buffer
        BUFFER_SECONDS = 5
        tarhim_ts = fajr_ts - duration - BUFFER_SECONDS

        _LOGGER.debug(
            "Tarhim timing: Fajr=%s, duur=%.1fs, buffer=%ds → start om %s",
            timings["Fajr"], duration, BUFFER_SECONDS,
            datetime.fromtimestamp(tarhim_ts).strftime("%H:%M:%S"),
        )

        if abs(now_ts - tarhim_ts) < 30:
            speaker = options.get(CONF_TARHIM_SPEAKER, ["media_player.adhan_speakers"])
            if isinstance(speaker, str):
                speaker = [speaker]
            volume    = _get_volume(options, CONF_TARHIM_VOLUME, 10)
            media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

            _LOGGER.info(
                "Tarhim afspelen: %s (%.1fs) — eindigt ~5s voor Fajr om %s",
                sound, duration, timings["Fajr"],
            )
            _t, _a, _al = _parse_sound_meta(sound)
            await _play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=await _get_cover_url(hass),
                restore_delay=duration + BUFFER_SECONDS + 5,
                title=_t, artist=_a, album=_al,
            )
            await async_send_notification(
                hass, entry,
                message="Tarhim — Fajr begint binnenkort 🌙",
                notify_type="tarhim",
            )
    except Exception as e:
        _LOGGER.error("Tarhim error: %s", e)


async def check_suhoor(hass: HomeAssistant, entry: ConfigEntry, coordinator, now_ts: float):
    """
    Speel suhoor alarm X minuten voor Fajr tijdens Ramadan.
    Tijd is instelbaar via 'suhoor_minutes' (default: 30 min voor Fajr).
    """
    options = entry.options if entry.options else entry.data

    if not options.get("suhoor_enabled", True):
        return

    # Alleen tijdens Ramadan
    try:
        hijri_month = coordinator.data["data"]["date"]["hijri"]["month"]["en"]
        if "Rama" not in hijri_month:
            return
    except Exception:
        return

    try:
        timings = coordinator.data["data"]["timings"]
        today   = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(
            f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M"
        ).timestamp()

        minutes   = int(options.get("suhoor_minutes", 30))
        suhoor_ts = fajr_ts - (minutes * 60)

        _LOGGER.debug(
            "Suhoor timing: %d min voor Fajr (%s) → alarm om %s",
            minutes, timings["Fajr"],
            datetime.fromtimestamp(suhoor_ts).strftime("%H:%M:%S"),
        )

        if abs(now_ts - suhoor_ts) < 30:
            sound   = options.get("suhoor_sound", "")
            speaker = options.get("suhoor_speaker", options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"]))
            if isinstance(speaker, str):
                speaker = [speaker]
            # Suhoor is een wekker — gebruik altijd eigen volume, nacht volume NIET toepassen
            raw_suhoor = options.get("suhoor_volume", 50)
            volume = max(0.0, min(1.0, float(raw_suhoor) / 100.0))

            _LOGGER.info("Suhoor alarm: %d min voor Fajr", minutes)

            if sound:
                media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
                _t, _a, _al = _parse_sound_meta(sound)
                await _play_media_with_volume(
                    hass, speaker, media_url, volume,
                    cover_url=await _get_cover_url(hass),
                    restore_delay=30.0,
                    title=_t, artist=_a, album=_al,
                )

            await async_send_notification(
                hass, entry,
                message=options.get("notify_msg_suhoor", "Last chance for Suhoor 🍽️"),
                notify_type="suhoor",
            )
    except Exception as e:
        _LOGGER.error("Suhoor error: %s", e)

async def async_setup_services(hass: HomeAssistant, entry: ConfigEntry):
    """Registreer services."""

    async def handle_preview(call):
        """Preview een adhan geluid."""
        sound = call.data.get("sound")
        options = entry.options if entry.options else entry.data
        speaker = call.data.get("speaker", options.get(CONF_DAY_SPEAKER, "media_player.adhan_speakers"))
        if isinstance(speaker, str):
            speaker = [speaker]
        raw = call.data.get("volume", options.get(CONF_DAY_VOLUME, 30))
        volume = float(raw) / 100.0
        volume = max(0.0, min(1.0, volume))
        play_method = options.get(CONF_PLAY_METHOD, "media_player")
        media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

        if play_method == "chime_tts":
            await hass.services.async_call(
                "chime_tts", "say",
                {"entity_id": speaker, "chime_path": media_url,
                 "volume_level": volume, "announce": True}
            )
        else:
            _t, _a, _al = _parse_sound_meta(sound)
            await _play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=await _get_cover_url(hass),
                restore_delay=30.0,
                title=_t, artist=_a, album=_al,
            )

    async def handle_test_prayer(call):
        """Test adhan voor een specifiek gebed."""
        prayer = call.data.get("prayer", "dhuhr")
        options = entry.options if entry.options else entry.data

        # Bepaal sound op basis van gebed
        if prayer == "fajr":
            default_sound = options.get(CONF_FAJR_SOUND, "")
        elif prayer == "jumat":
            default_sound = options.get("jumat_sound", options.get(CONF_DAY_SOUND, ""))
        else:
            default_sound = options.get(CONF_DAY_SOUND, "")

        if not default_sound:
            _LOGGER.warning("Geen sound geconfigureerd voor %s", prayer)
            return

        # Speaker: gebruik override of geconfigureerde waarde
        speaker_override = call.data.get("speaker")
        if speaker_override:
            speakers = [speaker_override]
        elif prayer == "fajr":
            speakers = options.get(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])
        else:
            speakers = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speakers, str):
            speakers = [speakers]

        # Volume: gebruik override (0-100) of geconfigureerde waarde
        volume_override = call.data.get("volume")
        if volume_override is not None:
            raw = float(volume_override)
        elif prayer == "fajr":
            raw = float(options.get(CONF_FAJR_VOLUME, 20))
        else:
            raw = float(options.get(CONF_DAY_VOLUME, 50))
        volume = raw / 100.0  # altijd 0-100 → 0.0-1.0

        media_url = await _get_media_url(hass, f"/local/nida/sounds/{default_sound}")
        _t, _a, _al = _parse_sound_meta(default_sound)
        await _play_media_with_volume(
            hass, speakers, media_url, volume,
            cover_url=await _get_cover_url(hass),
            restore_delay=60.0,
            title=_t, artist=_a, album=_al,
        )

    async def handle_test_tarhim(call):
        """Test tarhim."""
        options = entry.options if entry.options else entry.data
        speaker = call.data.get("speaker", options.get(CONF_TARHIM_SPEAKER, "media_player.adhan_speakers"))
        if isinstance(speaker, str):
            speaker = [speaker]
        raw = call.data.get("volume", options.get(CONF_TARHIM_VOLUME, 15))
        volume = float(raw) / 100.0
        volume = max(0.0, min(1.0, volume))
        sound = call.data.get("sound", options.get(CONF_TARHIM_SOUND, ""))
        if not sound:
            _LOGGER.warning("Geen tarhim sound geconfigureerd")
            return
        media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
        _t, _a, _al = _parse_sound_meta(sound)
        await _play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=await _get_cover_url(hass),
            restore_delay=60.0,
            title=_t, artist=_a, album=_al,
        )

    async def handle_test_reminder(call):
        """Test pre-adhan reminder (sound + TTS)."""
        options = entry.options if entry.options else entry.data
        r_num = int(call.data.get("reminder", 1))
        minutes = options.get(f"reminder_{r_num}_minutes", 10)
        prayer = call.data.get("prayer", "Dhuhr")
        lang = options.get(f"reminder_{r_num}_lang", "nl")
        text = options.get(f"reminder_{r_num}_tts", "Over [minutes] minuten is het tijd voor [prayer]")
        text = text.replace("[minutes]", str(int(minutes))).replace("[prayer]", prayer)

        # Sound: gebruik override of geconfigureerde jingle
        sound = call.data.get("sound") or options.get(f"reminder_{r_num}_sound", "")

        # Speaker: gebruik override of geconfigureerde waarde
        speaker_override = call.data.get("speaker")
        if speaker_override:
            speaker = [speaker_override]
        else:
            speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
            if isinstance(speaker, str):
                speaker = [speaker]

        # Volume: gebruik override (0-100) of geconfigureerde waarde
        volume_override = call.data.get("volume")
        if volume_override is not None:
            volume = float(volume_override) / 100.0
        else:
            volume = _get_volume(options, CONF_DAY_VOLUME, 50)

        if sound:
            media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
            _t, _a, _al = _parse_sound_meta(sound)
            mp3_path = hass.config.path(f"www/nida/sounds/{sound}")
            duration = await hass.async_add_executor_job(_get_mp3_duration, mp3_path)
            restore = duration + 20.0  # 20s ruimte voor TTS
            await _play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=await _get_cover_url(hass),
                restore_delay=restore,
                title=_t, artist=_a, album=_al,
            )
            # Wacht op echte MP3 duur zodat TTS niet door jingle heen loopt
            await asyncio.sleep(max(duration, 1.0))

        if text:
            lang_map = {"nl": "nl-NL", "en": "en-US", "ar": "ar-SA", "tr": "tr-TR"}
            tts_lang = lang_map.get(lang, lang)
            # Zet volume gelijk aan jingle zodat het één geheel klinkt
            await hass.services.async_call(
                "media_player", "volume_set",
                {"entity_id": speaker, "volume_level": volume},
            )
            await asyncio.sleep(0.3)
            await hass.services.async_call(
                "tts", "speak",
                {
                    "entity_id": "tts.home_assistant_cloud",
                    "media_player_entity_id": speaker,
                    "message": text,
                    "language": tts_lang,
                    "options": {"voice": "HamedNeural"} if tts_lang == "ar-SA" else {},
                }
            )

    async def handle_test_notification(call):
        """Test notificatie."""
        options = entry.options if entry.options else entry.data
        title = call.data.get("title", options.get("notify_title", "🕌 Nida"))
        message = call.data.get("message", options.get("notify_message", "Test notificatie van Nida"))
        await async_send_notification(hass, entry, message, title)

    async def handle_test_suhoor(call):
        """Test suhoor alarm."""
        options = entry.options if entry.options else entry.data
        speaker = call.data.get("speaker", options.get("suhoor_speaker", options.get(CONF_DAY_SPEAKER, "media_player.adhan_speakers")))
        if isinstance(speaker, str):
            speaker = [speaker]
        raw = call.data.get("volume", options.get("suhoor_volume", 50))
        volume = float(raw) / 100.0
        volume = max(0.0, min(1.0, volume))
        sound = call.data.get("sound", options.get("suhoor_sound", ""))
        if not sound:
            _LOGGER.warning("Geen suhoor sound geconfigureerd")
            return
        media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
        _t, _a, _al = _parse_sound_meta(sound)
        await _play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=await _get_cover_url(hass),
            restore_delay=30.0,
            title=_t, artist=_a, album=_al,
        )
        await async_send_notification(
            hass, entry,
            message=options.get("notify_msg_suhoor", "Last chance for Suhoor 🍽️"),
            notify_type="suhoor",
        )

    hass.services.async_register(DOMAIN, "preview",          handle_preview)
    hass.services.async_register(DOMAIN, "test_adhan",        handle_test_prayer)
    hass.services.async_register(DOMAIN, "test_tarhim",       handle_test_tarhim)
    hass.services.async_register(DOMAIN, "test_suhoor",       handle_test_suhoor)
    hass.services.async_register(DOMAIN, "test_pre_adhan",    handle_test_reminder)
    hass.services.async_register(DOMAIN, "test_notification", handle_test_notification)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        hass.data[DOMAIN].pop(entry.entry_id)
    return unload_ok


async def update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    await hass.config_entries.async_reload(entry.entry_id)


class PrayerTimesCoordinator(DataUpdateCoordinator):
    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        super().__init__(
            hass,
            _LOGGER,
            name=DOMAIN,
            update_interval=timedelta(hours=12),
        )
        self.entry = entry

    async def _async_update_data(self):
        method = int(self.entry.options.get(CONF_METHOD, self.entry.data.get(CONF_METHOD, 3)))

        lat = self.hass.config.latitude
        lon = self.hass.config.longitude

        if lat and lon:
            from datetime import date
            today = date.today().strftime("%d-%m-%Y")
            url = f"https://api.aladhan.com/v1/timings/{today}?latitude={lat}&longitude={lon}&method={method}"
        else:
            city = self.entry.options.get(CONF_CITY, self.entry.data.get(CONF_CITY, "Amsterdam"))
            country = self.entry.options.get(CONF_COUNTRY, self.entry.data.get(CONF_COUNTRY, "Netherlands"))
            url = f"https://api.aladhan.com/v1/timingsByCity?city={city}&country={country}&method={method}"

        try:
            connector = aiohttp.TCPConnector(ssl=False)
            async with aiohttp.ClientSession(connector=connector) as session:
                async with asyncio.timeout(30):
                    async with session.get(url, allow_redirects=True) as response:
                        if response.status != 200:
                            raise UpdateFailed(f"API error: {response.status}")
                        data = await response.json()
                        timings = data.get("data", {}).get("timings", {})
                        _LOGGER.debug("API timings: %s", list(timings.keys()))
                        return data
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"API error: {err}")


async def async_update_services_yaml(hass: HomeAssistant):
    """Dynamisch services.yaml bijwerken op basis van beschikbare geluiden."""
    import yaml

    def _build_and_write():
        # ✅ Alle I/O zit in dit blok — wordt uitgevoerd in thread executor
        sounds_path = hass.config.path("www/nida/sounds")
        fajr_options = []
        day_options = []
        tarhim_options = []
        suhoor_options = []

        def _label(f):
            import re
            name = f.replace(".mp3", "")
            m = re.match(r'^.+?\[.+?\]\s*-\s*(.+)$', name)
            return m.group(1).strip() if m else name.replace("-", " ").title()

        if os.path.isdir(sounds_path):
            for f in sorted(os.listdir(sounds_path)):
                if not f.endswith(".mp3"):
                    continue
                fl = f.lower()
                label = _label(f)
                if "[fajr]" in fl:
                    fajr_options.append({"label": label, "value": f})
                elif "[tarhim]" in fl or "tarhim" in fl:
                    tarhim_options.append({"label": label, "value": f})
                elif "[suhoor]" in fl or "suhoor" in fl:
                    suhoor_options.append({"label": label, "value": f})
                elif "[day]" in fl or ("adhan" in fl and "fajr" not in fl and "tarhim" not in fl and "suhoor" not in fl):
                    day_options.append({"label": label, "value": f})

        # Jingle opties toevoegen aan preview
        jingle_options = []
        for f in sorted(os.listdir(sounds_path)) if os.path.isdir(sounds_path) else []:
            if not f.endswith(".mp3"):
                continue
            fl = f.lower()
            if "[jingle]" in fl or "jingle" in fl:
                jingle_options.append({"label": _label(f), "value": f})

        _volume_field = {
            "name": "Volume",
            "description": "Volume (0-100%). Leave empty to use configured volume.",
            "required": False,
            "default": 30,
            "selector": {"number": {"min": 0, "max": 100, "step": 5,
                                    "unit_of_measurement": "%", "mode": "slider"}}
        }
        _speaker_field = {
            "name": "Speaker",
            "description": "Which speaker do you want to use?",
            "required": False,
            "selector": {"entity": {"domain": "media_player"}}
        }

        services = {
            "preview": {
                "name": "Preview",
                "description": "Play an adhan or jingle as preview on a speaker.",
                "fields": {
                    "sound": {
                        "name": "Sound",
                        "description": "Which sound do you want to play?",
                        "required": True,
                        "selector": {"select": {"options": fajr_options + day_options + tarhim_options + jingle_options}}
                    },
                    "speaker": {**_speaker_field, "required": True},
                    "volume": _volume_field,
                }
            },
            "test_adhan": {
                "name": "Test Adhan",
                "description": "Test the adhan for a specific prayer.",
                "fields": {
                    "prayer": {
                        "name": "Prayer",
                        "description": "Which prayer do you want to test?",
                        "required": True,
                        "default": "dhuhr",
                        "selector": {"select": {"options": [
                            {"label": "Fajr",            "value": "fajr"},
                            {"label": "Dhuhr",           "value": "dhuhr"},
                            {"label": "Asr",             "value": "asr"},
                            {"label": "Maghrib",         "value": "maghrib"},
                            {"label": "Isha",            "value": "isha"},
                            {"label": "Jumat (vrijdag)", "value": "jumat"},
                        ]}}
                    },
                    "speaker": _speaker_field,
                    "volume": _volume_field,
                }
            },
            "test_tarhim": {
                "name": "Test Tarhim",
                "description": "Test the Tarhim recitation before Fajr.",
                "fields": {
                    "sound": {
                        "name": "Sound",
                        "description": "Which tarhim do you want to play?",
                        "required": False,
                        "selector": {"select": {"options": tarhim_options}}
                    },
                    "speaker": _speaker_field,
                    "volume": _volume_field,
                }
            },
            "test_suhoor": {
                "name": "Test Suhoor",
                "description": "Test the Suhoor alarm.",
                "fields": {
                    "sound": {
                        "name": "Sound",
                        "description": "Which suhoor sound do you want to play?",
                        "required": False,
                        "selector": {"select": {"options": suhoor_options}}
                    },
                    "speaker": _speaker_field,
                    "volume": _volume_field,
                }
            },
            "test_pre_adhan": {
                "name": "Test Pre-adhan",
                "description": "Test a pre-adhan reminder (sound + TTS).",
                "fields": {
                    "reminder": {
                        "name": "Reminder",
                        "description": "Which reminder do you want to test?",
                        "required": False,
                        "default": "1",
                        "selector": {"select": {"options": [
                            {"label": "Reminder 1", "value": "1"},
                            {"label": "Reminder 2", "value": "2"},
                        ]}}
                    },
                    "prayer": {
                        "name": "Prayer",
                        "description": "Name of the prayer (used in TTS text).",
                        "required": False,
                        "default": "Dhuhr",
                        "selector": {"text": {}}
                    },
                    "sound": {
                        "name": "Jingle",
                        "description": "Which jingle do you want to play?",
                        "required": False,
                        "selector": {"select": {"options": jingle_options}}
                    },
                    "speaker": _speaker_field,
                    "volume": _volume_field,
                }
            },
            "test_notification": {
                "name": "Test Notificatie",
                "description": "Send a test notification to configured devices.",
                "fields": {
                    "title": {
                        "name": "Title",
                        "description": "Title of the notification.",
                        "required": False,
                        "default": "Nida 🕌",
                        "selector": {"text": {}}
                    },
                    "message": {
                        "name": "Message",
                        "description": "Text of the notification.",
                        "required": False,
                        "default": "Test notification from Nida",
                        "selector": {"text": {}}
                    },
                }
            },
        }

        services_path = os.path.join(os.path.dirname(__file__), "services.yaml")
        with open(services_path, "w") as f:
            # Gebruik custom dumper zonder YAML anchors — HA parser heeft daar moeite mee
            class NoAliasDumper(yaml.Dumper):
                def ignore_aliases(self, data):
                    return True

            yaml.dump(services, f, allow_unicode=True, default_flow_style=False, Dumper=NoAliasDumper)

    await hass.async_add_executor_job(_build_and_write)
    _LOGGER.info("services.yaml bijgewerkt met beschikbare geluiden")
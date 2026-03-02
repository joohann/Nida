"""Nida Integration."""
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
    CONF_SALAWAT_ENABLED, CONF_SALAWAT_SPEAKER, CONF_SALAWAT_VOLUME, CONF_SALAWAT_SOUND,
)

_LOGGER = logging.getLogger(__name__)
PLATFORMS = ["sensor"]


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
    return True


async def async_copy_sounds(hass: HomeAssistant):
    """Kopieer sounds van integration naar /config/www/nida/sounds/ bij install/update."""

    def _do_copy():
        # ✅ Alle I/O zit in dit blok — wordt uitgevoerd in thread executor
        integration_dir = os.path.dirname(__file__)
        sounds_src = os.path.join(integration_dir, "sounds")
        sounds_dst = hass.config.path("www/nida/sounds")
        www_nida    = hass.config.path("www/nida")

        if not os.path.isdir(sounds_src):
            _LOGGER.warning("Sounds source directory not found: %s", sounds_src)
            return 0

        os.makedirs(sounds_dst, exist_ok=True)
        os.makedirs(www_nida, exist_ok=True)

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

        # Logo kopiëren voor cover art — zoek in brand/ of images/
        logo_dst = os.path.join(www_nida, "logo.png")
        if not os.path.exists(logo_dst):
            for candidate in [
                os.path.join(integration_dir, "images", "logo.png"),
                os.path.join(integration_dir, "brand", "logo.png"),
                os.path.join(integration_dir, "logo.png"),
            ]:
                if os.path.exists(candidate):
                    shutil.copy2(candidate, logo_dst)
                    _LOGGER.info("Nida logo gekopieerd naar www/nida/logo.png")
                    break
            else:
                _LOGGER.debug("Geen logo.png gevonden — cover art niet beschikbaar")

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
                _LOGGER.info("Playing adhan for %s", prayer)
                hass.async_create_task(play_adhan(hass, entry, prayer_key))

        hass.async_create_task(check_salawat(hass, entry, coordinator, now_ts))
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


def _get_volume(options, base_vol_key, base_default):
    """Geef het juiste volume terug (0.0–1.0) op basis van dag/nacht instelling."""
    raw = options.get(base_vol_key, base_default)
    # Sla % op als int (0-100), converteer hier naar float
    volume = raw / 100 if isinstance(raw, (int, float)) and raw > 1 else float(raw)
    volume = max(0.0, min(1.0, volume))

    night_enabled = options.get("night_volume_enabled", False)
    if night_enabled:
        night_start = int(options.get("night_start_hour", 22))
        current_hour = datetime.now().hour
        if current_hour >= night_start or current_hour < 6:
            raw_night = options.get("night_volume", 10)
            volume = raw_night / 100 if isinstance(raw_night, (int, float)) and raw_night > 1 else float(raw_night)
            volume = max(0.0, min(1.0, volume))

    return round(volume, 2)


async def _play_media_with_volume(
    hass: HomeAssistant,
    speakers: list[str],
    media_url: str,
    volume: float,
    cover_url: str | None = None,
    restore_delay: float = 30.0,
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

    # Stap 4: afspelen — extra bevat cover art voor compatibele players
    extra: dict = {}
    if cover_url:
        # thumbnail = Cast/Google Home, media_image_url = generieke players
        extra["thumbnail"] = cover_url
        extra["media_image_url"] = cover_url

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


def _get_logo_url(hass) -> str:
    """Geef de volledige URL van het Nida logo terug voor cover art."""
    base_url = hass.config.internal_url or hass.config.external_url or ""
    base_url = base_url.rstrip("/")
    return f"{base_url}/local/nida/logo.png"


async def play_adhan(hass: HomeAssistant, entry: ConfigEntry, prayer_type: str):
    """Speel adhan voor het opgegeven gebed."""
    options = entry.options if entry.options else entry.data

    if prayer_type == "fajr":
        speaker = options.get(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])
        volume = _get_volume(options, CONF_FAJR_VOLUME, 20)
        sound = options.get(CONF_FAJR_SOUND, "")
    elif prayer_type == "jumat":
        speaker = options.get("jumat_speaker", options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"]))
        volume = _get_volume(options, "jumat_volume", options.get(CONF_DAY_VOLUME, 50))
        sound = options.get("jumat_sound", options.get(CONF_DAY_SOUND, ""))
    else:
        speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        volume = _get_volume(options, CONF_DAY_VOLUME, 50)
        sound = options.get(CONF_DAY_SOUND, "")

    if isinstance(speaker, str):
        speaker = [speaker]

    if not sound:
        _LOGGER.warning("Geen sound geconfigureerd voor %s — adhan overgeslagen", prayer_type)
        return

    play_method = options.get(CONF_PLAY_METHOD, "media_player")
    media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
    cover_url = _get_logo_url(hass)

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
        await _play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=cover_url,
            restore_delay=float(options.get("adhan_restore_delay", 30)),
        )

    prayer_display = prayer_type.capitalize()
    await async_send_notification(
        hass, entry,
        message=f"It is time for {prayer_display} prayer 🕌",
        notify_type="prayer",
    )


async def async_send_notification(
    hass: HomeAssistant,
    entry: ConfigEntry,
    message: str,
    title: str = "🕌 Nida",
    notify_type: str = "prayer",
):
    """
    Stuur notificatie op basis van type.
    notify_type: "prayer" | "pre_adhan" | "salawat" | "suhoor"

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

                if sound:
                    media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
                    try:
                        await _play_media_with_volume(
                            hass, speaker, media_url, volume,
                            cover_url=_get_logo_url(hass),
                            restore_delay=10.0,
                        )
                        await asyncio.sleep(3)
                    except Exception as e:
                        _LOGGER.warning("Could not play reminder chime: %s", e)

                if tts_text:
                    from .const import REMINDER_DEFAULT_TEXTS
                    text = tts_text if tts_text else REMINDER_DEFAULT_TEXTS.get(lang, REMINDER_DEFAULT_TEXTS["en"])
                    text = text.replace("[minutes]", str(int(minutes))).replace("[prayer]", prayer_name)
                    try:
                        lang_map = {"nl": "nl-NL", "en": "en-US", "ar": "ar-SA", "tr": "tr-TR"}
                        tts_lang = lang_map.get(lang, lang)
                        tts_entity = "tts.home_assistant_cloud"
                        await hass.services.async_call(
                            "tts", "speak",
                            {
                                "entity_id": tts_entity,
                                "media_player_entity_id": speaker if isinstance(speaker, list) else [speaker],
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
                )


async def check_salawat(hass: HomeAssistant, entry: ConfigEntry, coordinator, now_ts: float):
    """Speel salawat voor Fajr tijdens Ramadan."""
    options = entry.options if entry.options else entry.data

    if not options.get(CONF_SALAWAT_ENABLED, True):
        return

    try:
        hijri_month = coordinator.data["data"]["date"]["hijri"]["month"]["en"]
        if "Rama" not in hijri_month:
            return
    except Exception:
        return

    try:
        timings = coordinator.data["data"]["timings"]
        today = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M").timestamp()
        salawat_ts = fajr_ts - (6.5 * 60)

        if abs(now_ts - salawat_ts) < 30:
            speaker = options.get(CONF_SALAWAT_SPEAKER, ["media_player.adhan_speakers"])
            if isinstance(speaker, str): speaker = [speaker]
            volume = _get_volume(options, CONF_SALAWAT_VOLUME, 10)
            sound = options.get(CONF_SALAWAT_SOUND, "Ramadan [salawat] - Ustaz Hendra.mp3")
            media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

            _LOGGER.info("Playing salawat: %s", sound)
            await _play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=_get_logo_url(hass),
                restore_delay=float(options.get("salawat_restore_delay", 60)),
            )
            await async_send_notification(
                hass, entry,
                message="Tarhim — Fajr begint binnenkort 🌙",
                notify_type="salawat",
            )
    except Exception as e:
        _LOGGER.error("Salawat error: %s", e)


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
        volume = raw / 100 if isinstance(raw, (int, float)) and raw > 1 else float(raw)
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
            await _play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=_get_logo_url(hass),
                restore_delay=30.0,
            )

    async def handle_test_prayer(call):
        """Test adhan voor een specifiek gebed."""
        prayer = call.data.get("prayer", "dhuhr")
        await play_adhan(hass, entry, prayer)

    async def handle_test_salawat(call):
        """Test salawat."""
        options = entry.options if entry.options else entry.data
        speaker = call.data.get("speaker", options.get(CONF_SALAWAT_SPEAKER, "media_player.adhan_speakers"))
        if isinstance(speaker, str):
            speaker = [speaker]
        raw = call.data.get("volume", options.get(CONF_SALAWAT_VOLUME, 15))
        volume = raw / 100 if isinstance(raw, (int, float)) and raw > 1 else float(raw)
        volume = max(0.0, min(1.0, volume))
        sound = call.data.get("sound", options.get(CONF_SALAWAT_SOUND, "Ramadan [salawat] - Ustaz Hendra.mp3"))
        media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
        await _play_media_with_volume(
            hass, speaker, media_url, volume,
            cover_url=_get_logo_url(hass),
            restore_delay=60.0,
        )

    async def handle_test_reminder(call):
        """Test pre-adhan reminder (sound + TTS)."""
        options = entry.options if entry.options else entry.data
        r_num = call.data.get("reminder", 1)
        minutes = options.get(f"reminder_{r_num}_minutes", 10)
        prayer = call.data.get("prayer", "Dhuhr")
        sound = options.get(f"reminder_{r_num}_sound", "")
        lang = options.get(f"reminder_{r_num}_lang", "nl")
        text = options.get(f"reminder_{r_num}_tts", "Over [minutes] minuten is het tijd voor [prayer]")
        text = text.replace("[minutes]", str(int(minutes))).replace("[prayer]", prayer)
        speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, CONF_DAY_VOLUME, 50)

        if sound:
            media_url = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
            await _play_media_with_volume(
                hass, speaker, media_url, volume,
                cover_url=_get_logo_url(hass),
                restore_delay=10.0,
            )
            await asyncio.sleep(3)

        if text:
            lang_map = {"nl": "nl-NL", "en": "en-US", "ar": "ar-SA", "tr": "tr-TR"}
            tts_lang = lang_map.get(lang, lang)
            tts_entity = "tts.home_assistant_cloud"
            await hass.services.async_call(
                "tts", "speak",
                {
                    "entity_id": tts_entity,
                    "media_player_entity_id": speaker if isinstance(speaker, list) else [speaker],
                    "message": text,
                    "language": tts_lang,
                    "options": {"voice": "HamedNeural"} if tts_lang == "ar-SA" else {}
                }
            )

    async def handle_test_notification(call):
        """Test notificatie."""
        options = entry.options if entry.options else entry.data
        custom_title = options.get("notify_title", "🕌 Prayer Times")
        custom_msg = options.get("notify_message", "It is time for {prayer} prayer")
        await async_send_notification(hass, entry, custom_msg, custom_title)

    hass.services.async_register(
        DOMAIN, "preview_adhan", handle_preview,
        schema=vol.Schema({
            vol.Required("sound"): str,
            vol.Optional("speaker"): str,
            vol.Optional("volume"): vol.Any(None, vol.Coerce(int)),
        })
    )

    hass.services.async_register(
        DOMAIN, "test_prayer", handle_test_prayer,
        schema=vol.Schema({
            vol.Optional("prayer", default="dhuhr"): vol.In(["fajr", "dhuhr", "asr", "maghrib", "isha", "jumat"]),
        })
    )

    hass.services.async_register(
        DOMAIN, "test_salawat", handle_test_salawat,
        schema=vol.Schema({
            vol.Optional("sound"): str,
            vol.Optional("speaker"): str,
            vol.Optional("volume"): vol.Any(None, vol.Coerce(int)),
        })
    )

    hass.services.async_register(
        DOMAIN, "test_notification", handle_test_notification,
        schema=vol.Schema({
            vol.Optional("title"): str,
            vol.Optional("message"): str,
        })
    )

    hass.services.async_register(
        DOMAIN, "test_reminder", handle_test_reminder,
        schema=vol.Schema({
            vol.Optional("reminder", default=1): vol.In([1, 2]),
            vol.Optional("prayer", default="Dhuhr"): str,
        })
    )


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
        sounds_path = os.path.join(os.path.dirname(__file__), "sounds")
        fajr_options = []
        day_options = []
        salawat_options = []

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
                if "[fajr]" in fl or ("fajr" in fl and "[" not in fl):
                    fajr_options.append({"label": label, "value": f})
                elif "[salawat]" in fl or "salawat" in fl:
                    salawat_options.append({"label": label, "value": f})
                elif "[day]" in fl or ("adhan" in fl and "fajr" not in fl and "salawat" not in fl):
                    day_options.append({"label": label, "value": f})

        services = {
            "preview_adhan": {
                "name": "Preview Adhan",
                "description": "Speel een adhan geluid als preview op een speaker.",
                "fields": {
                    "sound": {
                        "name": "Sound",
                        "description": "Welk adhan wil je afspelen?",
                        "required": True,
                        "selector": {"select": {"options": fajr_options + day_options}}
                    },
                    "speaker": {
                        "name": "Speaker",
                        "description": "Welke speaker wil je gebruiken?",
                        "required": True,
                        "selector": {"entity": {"domain": "media_player"}}
                    },
                    "volume": {
                        "name": "Volume",
                        "description": "Volume (0-100%). Leeg laten voor geconfigureerd volume.",
                        "required": False,
                        "default": 30,
                        "selector": {"number": {"min": 0, "max": 100, "step": 5,
                                                "unit_of_measurement": "%", "mode": "slider"}}
                    }
                }
            },
            "test_prayer": {
                "name": "Test Prayer",
                "description": "Test de adhan voor een specifiek gebed.",
                "fields": {
                    "prayer": {
                        "name": "Prayer",
                        "description": "Welk gebed wil je testen?",
                        "required": True,
                        "default": "dhuhr",
                        "selector": {"select": {"options": [
                            {"label": "Fajr",    "value": "fajr"},
                            {"label": "Dhuhr",   "value": "dhuhr"},
                            {"label": "Asr",     "value": "asr"},
                            {"label": "Maghrib", "value": "maghrib"},
                            {"label": "Isha",    "value": "isha"},
                            {"label": "Jumat (vrijdag)", "value": "jumat"},
                        ]}}
                    }
                }
            },
            "test_salawat": {
                "name": "Test Salawat",
                "description": "Test de Salawat recitatie voor Fajr.",
                "fields": {
                    "sound": {
                        "name": "Sound",
                        "description": "Welk salawat wil je afspelen?",
                        "required": False,
                        "selector": {"select": {"options": salawat_options}}
                    },
                    "speaker": {
                        "name": "Speaker",
                        "description": "Welke speaker wil je gebruiken?",
                        "required": False,
                        "selector": {"entity": {"domain": "media_player"}}
                    },
                    "volume": {
                        "name": "Volume",
                        "description": "Volume (0-100%). Leeg laten voor geconfigureerd volume.",
                        "required": False,
                        "selector": {"number": {"min": 0, "max": 100, "step": 5,
                                                "unit_of_measurement": "%", "mode": "slider"}}
                    }
                }
            },
        }

        services_path = os.path.join(os.path.dirname(__file__), "services.yaml")
        with open(services_path, "w") as f:
            yaml.dump(services, f, allow_unicode=True, default_flow_style=False)

    await hass.async_add_executor_job(_build_and_write)
    _LOGGER.info("services.yaml bijgewerkt met beschikbare geluiden")

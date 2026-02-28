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
    CONF_TARHIM_ENABLED, CONF_TARHIM_SPEAKER, CONF_TARHIM_VOLUME, CONF_TARHIM_SOUND,
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



    """Copy sounds from integration to /config/www/sounds/ on install/update."""

    # Sounds staan in custom_components/nida/sounds/ (meegeleverd via HACS)
    sounds_src = os.path.join(os.path.dirname(__file__), "sounds")
    sounds_dst = hass.config.path("www/sounds")

    if not os.path.isdir(sounds_src):
        _LOGGER.warning(f"Sounds source directory not found: {sounds_src}")
        return

    os.makedirs(sounds_dst, exist_ok=True)
    copied = 0
    for f in sorted(os.listdir(sounds_src)):
        if f.endswith(".mp3"):
            src = os.path.join(sounds_src, f)
            dst = os.path.join(sounds_dst, f)
            if not os.path.exists(dst):
                shutil.copy2(src, dst)
                copied += 1
                _LOGGER.info(f"Copied sound: {f}")

    if copied:
        _LOGGER.info(f"Copied {copied} sound(s) to {sounds_dst}")
    else:
        _LOGGER.debug(f"All sounds already present in {sounds_dst}")



async def async_copy_sounds(hass):
    """Copy sounds from integration to /config/www/nida/sounds/"""

    def _copy_sounds():
        import os, shutil
        sounds_src = os.path.join(os.path.dirname(__file__), "sounds")
        sounds_dst = hass.config.path("www/nida/sounds")

        if not os.path.isdir(sounds_src):
            return 0

        os.makedirs(sounds_dst, exist_ok=True)
        copied = 0
        for f in sorted(os.listdir(sounds_src)):
            if f.endswith(".mp3"):
                src = os.path.join(sounds_src, f)
                dst = os.path.join(sounds_dst, f)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)
                    copied += 1
        return copied

    copied = await hass.async_add_executor_job(_copy_sounds)

    def _copy_card():
        import os, shutil
        card_src = os.path.join(os.path.dirname(__file__), "nida-card.js")
        card_dst = hass.config.path("www/nida-card.js")
        if os.path.exists(card_src) and not os.path.exists(card_dst):
            shutil.copy2(card_src, card_dst)
            return True
        return False

    await hass.async_add_executor_job(_copy_card)

async def async_setup_adhan_scheduler(hass: HomeAssistant, entry: ConfigEntry, coordinator):
    """Schedule adhan at prayer times."""

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
                _LOGGER.info(f"Playing adhan for {prayer}")
                hass.async_create_task(play_adhan(hass, entry, prayer_key))

        hass.async_create_task(check_tarhim(hass, entry, coordinator, now_ts))
        hass.async_create_task(check_suhoor(hass, entry, coordinator, now_ts))
        hass.async_create_task(check_reminders(hass, entry, coordinator, now_ts, prayers))

    entry.async_on_unload(
        async_track_time_change(hass, check_prayer_time, second=0)
    )


async def _get_media_url(hass, local_path: str) -> str:
    """Convert local path to full URL for Music Assistant compatibility."""
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


def _get_volume(options, base_vol_key, base_default, hass=None):
    """Geef het juiste volume terug op basis van dag/nacht en open ramen/deuren."""
    raw = options.get(base_vol_key, base_default)
    volume = raw / 100 if raw > 1 else raw

    # Nacht volume
    night_enabled = options.get("night_volume_enabled", False)
    if night_enabled:
        night_start = int(options.get("night_start_hour", 22))
        current_hour = datetime.now().hour
        if current_hour >= night_start or current_hour < 6:
            raw_night = options.get("night_volume", 10)
            volume = raw_night / 100 if raw_night > 1 else raw_night

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

    return volume


async def play_adhan(hass: HomeAssistant, entry: ConfigEntry, prayer_type: str):
    """Play adhan for the given prayer."""
    options = entry.options if entry.options else entry.data

    if prayer_type == "fajr":
        speaker = options.get(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, CONF_FAJR_VOLUME, 10, hass)
        sound = options.get(CONF_FAJR_SOUND, "01-adhan-fajr.mp3")
    elif prayer_type == "jumat":
        speaker = options.get("jumat_speaker", options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"]))
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, "jumat_volume", options.get(CONF_DAY_VOLUME, 50), hass)
        sound = options.get("jumat_sound", options.get(CONF_DAY_SOUND, "01-adhan.mp3"))
    else:
        speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, CONF_DAY_VOLUME, 50, hass)
        sound = options.get(CONF_DAY_SOUND, "01-adhan.mp3")

    play_method = options.get(CONF_PLAY_METHOD, "media_player")
    media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

    _LOGGER.info(f"Playing {sound} on {speaker} at volume {volume}")

    if play_method == "media_player":
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
        await async_send_notification(hass, entry, f"Time for {prayer_type.capitalize()} prayer", f"🕌 {prayer_type.capitalize()}")
    else:
        await hass.services.async_call(
            "chime_tts", "say",
            {
                "entity_id": speaker,
                "chime_path": media_path,
                "volume_level": volume,
                "announce": True,
            }
        )


async def async_send_notification(hass: HomeAssistant, entry: ConfigEntry, message: str, title: str = "🕌 Nida"):
    """Send notification if configured."""
    target = entry.options.get("notify_target", entry.data.get("notify_target", ""))
    if not target:
        return
    try:
        targets = target if isinstance(target, list) else [target]
        for t in targets:
            if not t:
                continue
            service = t.replace("notify.", "")
            await hass.services.async_call(
                "notify", service,
                {"title": title, "message": message}
            )
    except Exception as e:
        _LOGGER.warning(f"Could not send notification: {e}")


async def check_reminders(hass, entry, coordinator, now_ts, prayers):
    """Check and play pre-adhan reminders."""
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
        volume = _get_volume(options, CONF_DAY_VOLUME, 50, hass)

        for prayer_name, time_str in prayers.items():
            today = datetime.now().strftime("%Y-%m-%d")
            try:
                prayer_ts = datetime.strptime(f"{today} {time_str}", "%Y-%m-%d %H:%M").timestamp()
            except Exception:
                continue
            reminder_ts = prayer_ts - (minutes * 60)
            if abs(now_ts - reminder_ts) < 30:
                _LOGGER.info(f"Reminder {r_num} for {prayer_name} in {minutes} min")

                if sound:
                    media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
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
                        await asyncio.sleep(3)
                    except Exception as e:
                        _LOGGER.warning(f"Could not play reminder chime: {e}")

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
                        _LOGGER.warning(f"Could not play TTS reminder: {e}")



async def check_suhoor(hass: HomeAssistant, entry: ConfigEntry, coordinator, now_ts: float):
    """Play suhoor alarm before Fajr during Ramadan."""
    options = entry.options if entry.options else entry.data

    if not options.get("suhoor_alarm_enabled", True):
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
        minutes = options.get("suhoor_alarm_minutes", 30)
        suhoor_ts = fajr_ts - (minutes * 60)

        if abs(now_ts - suhoor_ts) < 30:
            speaker = options.get(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])
            if isinstance(speaker, str): speaker = [speaker]
            volume = _get_volume(options, "suhoor_alarm_volume", 10, hass)
            sound = options.get("suhoor_alarm_sound", "01-suhoor.mp3")
            media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

            _LOGGER.info(f"Playing suhoor alarm: {sound}")
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
        _LOGGER.error(f"Suhoor alarm error: {e}")

async def check_tarhim(hass: HomeAssistant, entry: ConfigEntry, coordinator, now_ts: float):
    """Play tarhim before Fajr during Ramadan."""
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
        today = datetime.now().strftime("%Y-%m-%d")
        fajr_ts = datetime.strptime(f"{today} {timings['Fajr']}", "%Y-%m-%d %H:%M").timestamp()
        tarhim_ts = fajr_ts - (6.5 * 60)

        if abs(now_ts - tarhim_ts) < 30:
            speaker = options.get(CONF_TARHIM_SPEAKER, ["media_player.adhan_speakers"])
            if isinstance(speaker, str): speaker = [speaker]
            volume = _get_volume(options, CONF_TARHIM_VOLUME, 10, hass)
            sound = options.get(CONF_TARHIM_SOUND, "01-tarhim.mp3")
            media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

            _LOGGER.info(f"Playing tarhim: {sound}")
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
        _LOGGER.error(f"Tarhim error: {e}")


async def async_setup_services(hass: HomeAssistant, entry: ConfigEntry):
    """Setup services."""

    async def handle_preview(call):
        """Preview a specific adhan sound."""
        sound = call.data.get("sound")
        options = entry.options if entry.options else entry.data
        speaker = call.data.get("speaker", options.get(CONF_DAY_SPEAKER, "media_player.adhan_speakers"))
        volume = call.data.get("volume", 0.5)
        play_method = options.get(CONF_PLAY_METHOD, "media_player")
        media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

        if play_method == "media_player":
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
        else:
            await hass.services.async_call(
                "chime_tts", "say",
                {
                    "entity_id": speaker,
                    "chime_path": media_path,
                    "volume_level": volume,
                    "announce": True,
                }
            )

    async def handle_test_prayer(call):
        """Test adhan for a specific prayer."""
        prayer = call.data.get("prayer", "dhuhr")
        await play_adhan(hass, entry, prayer)

    async def handle_test_tarhim(call):
        """Test tarhim."""
        options = entry.options if entry.options else entry.data
        speaker = call.data.get("speaker", options.get(CONF_TARHIM_SPEAKER, "media_player.adhan_speakers"))
        volume = call.data.get("volume", options.get(CONF_TARHIM_VOLUME, 0.4))
        sound = options.get(CONF_TARHIM_SOUND, "01-tarhim.mp3")
        media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

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

    async def handle_test_reminder(call):
        """Test pre-adhan reminder (sound + TTS)."""
        options = entry.options if entry.options else entry.data
        r_num = call.data.get("reminder", 1)
        minutes = options.get(f"reminder_{r_num}_minutes", 10)
        prayer = call.data.get("prayer", "Dhuhr")
        sound = options.get(f"reminder_{r_num}_sound", "")
        lang = options.get(f"reminder_{r_num}_lang", "nl")
        text = options.get(f"reminder_{r_num}_tts", f"Over [minutes] minuten is het tijd voor [prayer]")
        text = text.replace("[minutes]", str(int(minutes))).replace("[prayer]", prayer)
        speaker = options.get(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, CONF_DAY_VOLUME, 50, hass)

        if sound:
            media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")
            await hass.services.async_call(
                "media_player", "play_media",
                {"entity_id": speaker, "media_content_id": media_path,
                 "media_content_type": "music", "announce": True,
                 "extra": {"volume_level": volume}}
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


    async def handle_test_suhoor(call):
        """Test suhoor alarm."""
        options = entry.options if entry.options else entry.data
        speaker = options.get(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])
        if isinstance(speaker, str): speaker = [speaker]
        volume = _get_volume(options, "suhoor_alarm_volume", 10, hass)
        sound = options.get("suhoor_alarm_sound", "01-suhoor.mp3")
        media_path = await _get_media_url(hass, f"/local/nida/sounds/{sound}")

        _LOGGER.info(f"Testing suhoor alarm: {sound}")
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

    async def handle_test_notification(call):
        """Test notification."""
        options = entry.options if entry.options else entry.data
        custom_title = options.get("notify_title", "🕌 Nida")
        custom_msg = options.get("notify_message", "It is time for [prayer] prayer")
        await async_send_notification(hass, entry, custom_msg, custom_title)

    hass.services.async_register(
        DOMAIN, "preview_adhan", handle_preview,
        schema=vol.Schema({
            vol.Required("sound"): str,
            vol.Optional("speaker"): str,
            vol.Optional("volume", default=0.5): vol.Coerce(float),
        })
    )

    hass.services.async_register(
        DOMAIN, "test_prayer", handle_test_prayer,
        schema=vol.Schema({
            vol.Optional("prayer", default="dhuhr"): vol.In(["fajr", "dhuhr", "asr", "maghrib", "isha", "jumat"]),
        })
    )

    hass.services.async_register(
        DOMAIN, "test_tarhim", handle_test_tarhim,
        schema=vol.Schema({
            vol.Optional("sound"): str,
            vol.Optional("speaker"): str,
            vol.Optional("volume", default=0.4): vol.Coerce(float),
        })
    )

    hass.services.async_register(
        DOMAIN, "test_suhoor", handle_test_suhoor,
        schema=vol.Schema({})
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
                        _LOGGER.debug(f"API timings: {list(timings.keys())}")
                        return data
        except aiohttp.ClientError as err:
            raise UpdateFailed(f"API error: {err}")


async def async_update_services_yaml(hass: HomeAssistant):
    """Dynamically update services.yaml based on available sounds."""
    import yaml

    sounds_path = os.path.join(os.path.dirname(__file__), "sounds")
    fajr_options = []
    day_options = []
    tarhim_options = []

    if os.path.isdir(sounds_path):
        for f in sorted(os.listdir(sounds_path)):
            if not f.endswith(".mp3"):
                continue
            label = f.replace(".mp3", "").replace("-", " ").title()
            if "fajr" in f.lower():
                fajr_options.append({"label": label, "value": f})
            elif "tarhim" in f.lower():
                tarhim_options.append({"label": label, "value": f})
            elif "adhan" in f.lower():
                day_options.append({"label": label, "value": f})

    services = {
        "preview_adhan": {
            "name": "Preview Adhan",
            "description": "Speel een adhan geluid af als preview",
            "fields": {
                "sound": {
                    "name": "Geluid",
                    "description": "Welke adhan wil je afspelen?",
                    "required": True,
                    "selector": {"select": {"options": fajr_options + day_options}}
                },
                "speaker": {
                    "name": "Speaker",
                    "description": "Op welke speaker wil je afspelen?",
                    "required": True,
                    "selector": {"entity": {"domain": "media_player"}}
                },
                "volume": {
                    "name": "Volume",
                    "description": "Volume tussen 0.0 en 1.0",
                    "required": False,
                    "default": 0.5,
                    "selector": {"number": {"min": 0.0, "max": 1.0, "step": 0.05, "mode": "slider"}}
                }
            }
        },
        "test_prayer": {
            "name": "Test Gebed",
            "description": "Test de adhan voor een specifiek gebed",
            "fields": {
                "prayer": {
                    "name": "Gebed",
                    "description": "Welk gebed wil je testen?",
                    "required": True,
                    "default": "dhuhr",
                    "selector": {"select": {"options": [
                        {"label": "Fajr", "value": "fajr"},
                        {"label": "Dhuhr", "value": "dhuhr"},
                        {"label": "Asr", "value": "asr"},
                        {"label": "Maghrib", "value": "maghrib"},
                        {"label": "Isha", "value": "isha"},
                        {"label": "Jumat (vrijdag)", "value": "jumat"},
                    ]}}
                }
            }
        },
        "test_tarhim": {
            "name": "Test Tarhim",
            "description": "Test de tarhim recitatie",
            "fields": {
                "sound": {
                    "name": "Tarhim Geluid",
                    "description": "Welke tarhim wil je afspelen?",
                    "required": False,
                    "selector": {"select": {"options": tarhim_options}}
                },
                "speaker": {
                    "name": "Speaker",
                    "description": "Op welke speaker wil je afspelen?",
                    "required": False,
                    "selector": {"entity": {"domain": "media_player"}}
                },
                "volume": {
                    "name": "Volume",
                    "description": "Volume tussen 0.0 en 1.0",
                    "required": False,
                    "default": 0.4,
                    "selector": {"number": {"min": 0.0, "max": 1.0, "step": 0.05, "mode": "slider"}}
                }
            }
        }
    }

    services_path = os.path.join(os.path.dirname(__file__), "services.yaml")
    with open(services_path, "w") as f:
        yaml.dump(services, f, allow_unicode=True, default_flow_style=False)
    _LOGGER.info("services.yaml updated with available sounds")
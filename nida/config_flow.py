# config_flow.py — Nida v2.1
# Wijzigingen: notificaties per type (adhan/pre-adhan/tarhim/suhoor) + kritische notificaties iOS/Android
"""Config flow for Prayer Times."""
from __future__ import annotations
import asyncio
import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from .const import (
    DOMAIN, CONF_CITY, CONF_COUNTRY, CONF_METHOD, CALCULATION_METHODS,
    CONF_PLAY_METHOD, PLAY_METHODS,
    CONF_FAJR_SPEAKER, CONF_FAJR_VOLUME, CONF_FAJR_SOUND,
    CONF_DAY_SPEAKER, CONF_DAY_VOLUME, CONF_DAY_SOUND,
    CONF_TARHIM_ENABLED, CONF_TARHIM_SPEAKER, CONF_TARHIM_VOLUME, CONF_TARHIM_SOUND,
    get_fajr_sounds, get_day_sounds, get_tarhim_sounds, get_jingle_sounds, get_suhoor_sounds,
    CONF_REMINDER_1_ENABLED, CONF_REMINDER_1_MINUTES, CONF_REMINDER_1_SOUND,
    CONF_REMINDER_1_TTS, CONF_REMINDER_1_LANG,
    CONF_REMINDER_2_ENABLED, CONF_REMINDER_2_MINUTES, CONF_REMINDER_2_SOUND,
    CONF_REMINDER_2_TTS, CONF_REMINDER_2_LANG,
    REMINDER_LANGUAGES, REMINDER_DEFAULT_TEXTS,
)

def _make_select(sounds):
    return selector.selector({"select": {"options": [{"value": k, "label": v} for k, v in sounds.items()], "mode": "dropdown"}})

def _get_notify_services(hass):
    services = [""]
    try:
        all_services = hass.services.async_services()
        if "notify" in all_services:
            services += [f"notify.{s}" for s in sorted(all_services["notify"].keys()) if s != "send_message"]
    except Exception:
        pass
    return services

async def _test_connection(city, country, method):
    url = f"https://api.aladhan.com/v1/timingsByCity?city={city}&country={country}&method={method}"
    try:
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with asyncio.timeout(30):
                async with session.get(url, allow_redirects=True) as response:
                    return response.status == 200
    except Exception:
        return False

def _speaker_sel():
    return selector.selector({"entity": {"domain": "media_player", "multiple": True}})

def _volume_sel():
    return selector.selector({"number": {"min": 0, "max": 100, "step": 5, "unit_of_measurement": "%", "mode": "slider"}})

def _minutes_sel(max_val=60):
    return selector.selector({"number": {"min": 1, "max": max_val, "step": 1, "unit_of_measurement": "min", "mode": "box"}})

def _method_sel():
    return selector.selector({"select": {"options": [{"value": str(k), "label": v} for k, v in CALCULATION_METHODS.items()], "mode": "dropdown"}})

def _sound_sel(sounds):
    return selector.selector({"select": {"options": [{"value": k, "label": v} for k, v in sounds.items()], "mode": "dropdown"}})

def _notify_schema(hass, get=None):
    """
    Bouw het notificatie schema.
    get: callable(key, default) voor OptionsFlow — None voor ConfigFlow (gebruikt defaults).
    """
    def g(key, default):
        return get(key, default) if get else default

    notify_services = _get_notify_services(hass)
    current_targets = g("notify_target", [])

    return vol.Schema({
        # ── Doelapparaten ──────────────────────────────────────────────
        vol.Optional("notify_target", default=current_targets): selector.selector({
            "select": {
                "options": notify_services,
                "mode": "dropdown",
                "multiple": True,
                "custom_value": True,
            }
        }),
        vol.Optional("notify_title", default=g("notify_title", "🕌 Nida")): str,

        # ── Per type aan/uit ────────────────────────────────────────────
        vol.Optional("notify_on_prayer",   default=g("notify_on_prayer",   True)): bool,
        vol.Optional("notify_on_pre_adhan",default=g("notify_on_pre_adhan",False)): bool,
        vol.Optional("notify_on_tarhim",   default=g("notify_on_tarhim",   False)): bool,
        vol.Optional("notify_on_suhoor",   default=g("notify_on_suhoor",   False)): bool,

        # ── Berichten (gebruik {prayer} als placeholder) ─────────────────
        vol.Optional("notify_msg_prayer",    default=g("notify_msg_prayer",    "It is time for {prayer} prayer 🕌")): str,
        vol.Optional("notify_msg_pre_adhan", default=g("notify_msg_pre_adhan", "{prayer} prayer in {minutes} minutes")): str,
        vol.Optional("notify_msg_tarhim",    default=g("notify_msg_tarhim",    "Tarhim — Fajr starts soon 🌙")): str,
        vol.Optional("notify_msg_suhoor",    default=g("notify_msg_suhoor",    "Last chance for Suhoor 🍽️")): str,

        # ── Kritische notificaties (iOS én Android) ─────────────────────
        # iOS negeert Android-velden, Android negeert iOS-velden — geen conflict
        vol.Optional("notify_critical", default=g("notify_critical", False)): bool,
    })


class PrayerTimesConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1
    def __init__(self):
        self._data = {}

    async def async_step_user(self, user_input=None):
        return await self.async_step_intro()

    async def async_step_intro(self, user_input=None):
        if user_input is not None:
            return await self.async_step_location()
        return self.async_show_form(step_id="intro", data_schema=vol.Schema({}))

    async def async_step_location(self, user_input=None):
        errors = {}
        ha_config = self.hass.config
        default_city = getattr(ha_config, "city", None) or "Amsterdam"
        default_country = getattr(ha_config, "country", None) or "Netherlands"
        if user_input is not None:
            valid = await _test_connection(user_input[CONF_CITY], user_input[CONF_COUNTRY], user_input[CONF_METHOD])
            if valid:
                self._data.update(user_input)
                return await self.async_step_reminders()
            errors["base"] = "cannot_connect"
        return self.async_show_form(
            step_id="location",
            data_schema=vol.Schema({
                vol.Required(CONF_CITY, default=default_city): str,
                vol.Required(CONF_COUNTRY, default=default_country): str,
                vol.Required(CONF_METHOD, default="3"): _method_sel(),
            }),
            errors=errors,
        )

    async def async_step_reminders(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_fajr()
        sounds = {"": "— No sound —", **get_jingle_sounds()}
        sound_opts = [{"value": k, "label": v} for k, v in sounds.items()]
        lang_opts = [{"value": k, "label": v} for k, v in REMINDER_LANGUAGES.items()]
        dt = REMINDER_DEFAULT_TEXTS["ar"]
        return self.async_show_form(
            step_id="reminders",
            data_schema=vol.Schema({
                vol.Optional(CONF_REMINDER_1_ENABLED, default=True): bool,
                vol.Optional(CONF_REMINDER_1_MINUTES, default=10): _minutes_sel(),
                vol.Optional(CONF_REMINDER_1_SOUND, default=""): selector.selector({"select": {"options": sound_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_1_LANG, default="ar"): selector.selector({"select": {"options": lang_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_1_TTS, default=dt): str,
                vol.Optional(CONF_REMINDER_2_ENABLED, default=True): bool,
                vol.Optional(CONF_REMINDER_2_MINUTES, default=5): _minutes_sel(),
                vol.Optional(CONF_REMINDER_2_SOUND, default=""): selector.selector({"select": {"options": sound_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_2_LANG, default="ar"): selector.selector({"select": {"options": lang_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_2_TTS, default=dt): str,
            }),
        )

    async def async_step_fajr(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_adhan()
        return self.async_show_form(
            step_id="fajr",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_SOUND, default=next(iter(get_fajr_sounds()), "01-adhan-fajr.mp3")): _make_select(get_fajr_sounds()),
                vol.Required(CONF_FAJR_SPEAKER, default=["media_player.adhan_speakers"]): _speaker_sel(),
                vol.Required(CONF_FAJR_VOLUME, default=10): _volume_sel(),
            }),
        )

    async def async_step_adhan(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_notifications()
        return self.async_show_form(
            step_id="adhan",
            data_schema=vol.Schema({
                vol.Required(CONF_DAY_SOUND, default=next(iter(get_day_sounds()), "01-adhan.mp3")): _make_select(get_day_sounds()),
                vol.Required(CONF_DAY_SPEAKER, default=["media_player.adhan_speakers"]): _speaker_sel(),
                vol.Required(CONF_DAY_VOLUME, default=20): _volume_sel(),
                vol.Optional("night_volume_enabled", default=False): bool,
                vol.Optional("night_volume", default=10): _volume_sel(),
                vol.Optional("night_start_hour", default=22): selector.selector({"number": {"min": 18, "max": 23, "step": 1, "unit_of_measurement": "h", "mode": "slider"}}),
            }),
        )

    async def async_step_notifications(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_ramadan()
        return self.async_show_form(
            step_id="notifications",
            data_schema=_notify_schema(self.hass),
        )

    async def async_step_ramadan(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return self.async_create_entry(title=self._data.get(CONF_CITY, "Prayer Times"), data=self._data)
        return self.async_show_form(
            step_id="ramadan",
            data_schema=vol.Schema({
                vol.Optional("suhoor_alarm_enabled", default=True): bool,
                vol.Optional("suhoor_alarm_minutes", default=30): _minutes_sel(120),
                vol.Optional("suhoor_alarm_sound", default=next(iter(get_suhoor_sounds()), "")): _make_select({"": "— No sound —", **get_suhoor_sounds()}),
                vol.Optional("suhoor_alarm_volume", default=10): _volume_sel(),
                vol.Optional(CONF_TARHIM_ENABLED, default=True): bool,
                vol.Optional(CONF_TARHIM_SOUND, default=next(iter(get_tarhim_sounds()), "01-tarhim.mp3")): _make_select(get_tarhim_sounds()),
                vol.Optional(CONF_TARHIM_SPEAKER, default=["media_player.adhan_speakers"]): _speaker_sel(),
                vol.Optional(CONF_TARHIM_VOLUME, default=10): _volume_sel(),
            }),
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return PrayerTimesOptionsFlow(config_entry)


class PrayerTimesOptionsFlow(config_entries.OptionsFlow):
    def __init__(self, config_entry):
        self._config_entry = config_entry
        self._data = {}

    def _get(self, key, default):
        return self._config_entry.options.get(key, self._config_entry.data.get(key, default))

    def _get_list(self, key, default):
        val = self._get(key, default)
        if isinstance(val, str): return [val]
        return val if val else default

    def _get_vol(self, key, default):
        v = self._get(key, default)
        return int(v * 100) if isinstance(v, float) and v <= 1 else (v if v else default)

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_reminders()
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_CITY, default=self._get(CONF_CITY, "Amsterdam")): str,
                vol.Required(CONF_COUNTRY, default=self._get(CONF_COUNTRY, "Netherlands")): str,
                vol.Required(CONF_METHOD, default=str(self._get(CONF_METHOD, 3))): _method_sel(),
            }),
        )

    async def async_step_reminders(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_fajr()
        sounds = {"": "— No sound —", **get_jingle_sounds()}
        sound_opts = [{"value": k, "label": v} for k, v in sounds.items()]
        lang_opts = [{"value": k, "label": v} for k, v in REMINDER_LANGUAGES.items()]
        dt = REMINDER_DEFAULT_TEXTS["ar"]
        return self.async_show_form(
            step_id="reminders",
            data_schema=vol.Schema({
                vol.Optional(CONF_REMINDER_1_ENABLED, default=self._get(CONF_REMINDER_1_ENABLED, True)): bool,
                vol.Optional(CONF_REMINDER_1_MINUTES, default=self._get(CONF_REMINDER_1_MINUTES, 10)): _minutes_sel(),
                vol.Optional(CONF_REMINDER_1_SOUND, default=self._get(CONF_REMINDER_1_SOUND, "")): selector.selector({"select": {"options": sound_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_1_LANG, default=self._get(CONF_REMINDER_1_LANG, "nl")): selector.selector({"select": {"options": lang_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_1_TTS, default=self._get(CONF_REMINDER_1_TTS, dt)): str,
                vol.Optional(CONF_REMINDER_2_ENABLED, default=self._get(CONF_REMINDER_2_ENABLED, True)): bool,
                vol.Optional(CONF_REMINDER_2_MINUTES, default=self._get(CONF_REMINDER_2_MINUTES, 5)): _minutes_sel(),
                vol.Optional(CONF_REMINDER_2_SOUND, default=self._get(CONF_REMINDER_2_SOUND, "")): selector.selector({"select": {"options": sound_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_2_LANG, default=self._get(CONF_REMINDER_2_LANG, "nl")): selector.selector({"select": {"options": lang_opts, "mode": "dropdown"}}),
                vol.Optional(CONF_REMINDER_2_TTS, default=self._get(CONF_REMINDER_2_TTS, dt)): str,
            }),
        )

    async def async_step_fajr(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_adhan()
        return self.async_show_form(
            step_id="fajr",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_SOUND, default=self._get(CONF_FAJR_SOUND, next(iter(get_fajr_sounds()), "01-adhan-fajr.mp3"))): _make_select(get_fajr_sounds()),
                vol.Required(CONF_FAJR_SPEAKER, default=self._get_list(CONF_FAJR_SPEAKER, ["media_player.adhan_speakers"])): _speaker_sel(),
                vol.Required(CONF_FAJR_VOLUME, default=self._get_vol(CONF_FAJR_VOLUME, 30)): _volume_sel(),
            }),
        )

    async def async_step_adhan(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_notifications()
        return self.async_show_form(
            step_id="adhan",
            data_schema=vol.Schema({
                vol.Required(CONF_DAY_SOUND, default=self._get(CONF_DAY_SOUND, next(iter(get_day_sounds()), "01-adhan.mp3"))): _make_select(get_day_sounds()),
                vol.Required(CONF_DAY_SPEAKER, default=self._get_list(CONF_DAY_SPEAKER, ["media_player.adhan_speakers"])): _speaker_sel(),
                vol.Required(CONF_DAY_VOLUME, default=self._get_vol(CONF_DAY_VOLUME, 50)): _volume_sel(),
                vol.Optional("night_volume_enabled", default=self._get("night_volume_enabled", False)): bool,
                vol.Optional("night_volume", default=self._get_vol("night_volume", 20)): _volume_sel(),
                vol.Optional("night_start_hour", default=self._get("night_start_hour", 22)): selector.selector({"number": {"min": 18, "max": 23, "step": 1, "unit_of_measurement": "h", "mode": "slider"}}),
            }),
        )

    async def async_step_notifications(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_ramadan()
        return self.async_show_form(
            step_id="notifications",
            data_schema=_notify_schema(self.hass, get=self._get),
        )

    async def async_step_ramadan(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return self.async_create_entry(title="", data=self._data)
        return self.async_show_form(
            step_id="ramadan",
            data_schema=vol.Schema({
                vol.Optional("suhoor_alarm_enabled", default=self._get("suhoor_alarm_enabled", True)): bool,
                vol.Optional("suhoor_alarm_minutes", default=self._get("suhoor_alarm_minutes", 30)): _minutes_sel(120),
                vol.Optional("suhoor_alarm_sound", default=self._get("suhoor_alarm_sound", next(iter(get_suhoor_sounds()), ""))): _make_select({"": "— No sound —", **get_suhoor_sounds()}),
                vol.Optional("suhoor_alarm_volume", default=self._get_vol("suhoor_alarm_volume", 10)): _volume_sel(),
                vol.Optional(CONF_TARHIM_ENABLED, default=self._get(CONF_TARHIM_ENABLED, True)): bool,
                vol.Optional(CONF_TARHIM_SOUND, default=self._get(CONF_TARHIM_SOUND, next(iter(get_tarhim_sounds()), "01-tarhim.mp3"))): _make_select(get_tarhim_sounds()),
                vol.Optional(CONF_TARHIM_SPEAKER, default=self._get_list(CONF_TARHIM_SPEAKER, ["media_player.adhan_speakers"])): _speaker_sel(),
                vol.Optional(CONF_TARHIM_VOLUME, default=self._get_vol(CONF_TARHIM_VOLUME, 40)): _volume_sel(),
            }),
        )
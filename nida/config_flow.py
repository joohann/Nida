"""Config flow for Nida Prayer Times."""
from __future__ import annotations
import asyncio
import aiohttp
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.core import callback
from homeassistant.helpers import selector
from .const import (
    DOMAIN, CONF_CITY, CONF_COUNTRY, CONF_METHOD, CALCULATION_METHODS,
    CONF_FAJR_SPEAKER, CONF_FAJR_VOLUME, CONF_FAJR_SOUND,
    CONF_DAY_SPEAKER, CONF_DAY_VOLUME, CONF_DAY_SOUND,
    CONF_TARHIM_ENABLED, CONF_TARHIM_SPEAKER, CONF_TARHIM_VOLUME, CONF_TARHIM_SOUND,
    async_get_fajr_sounds, async_get_day_sounds,
    async_get_tarhim_sounds, async_get_suhoor_sounds, async_get_jingle_sounds,
    CONF_REMINDER_1_ENABLED, CONF_REMINDER_1_MINUTES, CONF_REMINDER_1_SOUND,
    CONF_REMINDER_1_TTS, CONF_REMINDER_1_LANG,
    CONF_REMINDER_2_ENABLED, CONF_REMINDER_2_MINUTES, CONF_REMINDER_2_SOUND,
    CONF_REMINDER_2_TTS, CONF_REMINDER_2_LANG,
    REMINDER_LANGUAGES, REMINDER_DEFAULT_TEXTS,
)

# ── Selector helpers ───────────────────────────────────────────────────────────

def _sel_sound(sounds: dict):
    return selector.selector({"select": {
        "options": [{"value": k, "label": v} for k, v in sounds.items()],
        "mode": "dropdown",
    }})

def _sel_speaker():
    return selector.selector({"entity": {"domain": "media_player", "multiple": True}})

def _sel_volume():
    return selector.selector({"number": {
        "min": 0, "max": 100, "step": 5,
        "unit_of_measurement": "%", "mode": "slider",
    }})

def _sel_toggle():
    return selector.selector({"boolean": {}})

def _sel_minutes(max_val=60):
    return selector.selector({"number": {
        "min": 1, "max": max_val, "step": 1,
        "unit_of_measurement": "min", "mode": "box",
    }})

def _sel_hour(min_val=0, max_val=23):
    return selector.selector({"number": {
        "min": min_val, "max": max_val, "step": 1,
        "unit_of_measurement": "h", "mode": "slider",
    }})

def _sel_method():
    return selector.selector({"select": {
        "options": [{"value": str(k), "label": v} for k, v in CALCULATION_METHODS.items()],
        "mode": "dropdown",
    }})

def _sel_notify(hass):
    services = []
    try:
        all_s = hass.services.async_services()
        if "notify" in all_s:
            services = [f"notify.{s}" for s in sorted(all_s["notify"].keys())
                        if s != "send_message"]
    except Exception:
        pass
    return selector.selector({"select": {
        "options": services,
        "mode": "dropdown",
        "multiple": True,
        "custom_value": True,
    }})

def _sel_night_end_mode():
    return selector.selector({"select": {
        "options": [
            {"value": "time", "label": "Fixed time"},
            {"value": "fajr", "label": "After Fajr"},
        ],
        "mode": "dropdown",
    }})

async def _test_connection(city, country, method):
    url = (f"https://api.aladhan.com/v1/timingsByCity"
           f"?city={city}&country={country}&method={method}")
    try:
        connector = aiohttp.TCPConnector(ssl=False)
        async with aiohttp.ClientSession(connector=connector) as session:
            async with asyncio.timeout(30):
                async with session.get(url, allow_redirects=True) as r:
                    return r.status == 200
    except Exception:
        return False

def _notify_schema(hass, get=None, type_key="prayer", defaults=None):
    defaults = defaults or {}
    def g(key, default):
        return get(key, default) if get else defaults.get(key, default)
    return vol.Schema({
        vol.Optional(f"notify_on_{type_key}",
            default=g(f"notify_on_{type_key}", type_key == "prayer")): _sel_toggle(),
        vol.Optional(f"notify_target_{type_key}",
            default=g(f"notify_target_{type_key}", [])): _sel_notify(hass),
        vol.Optional(f"notify_msg_{type_key}",
            default=g(f"notify_msg_{type_key}", defaults.get(f"notify_msg_{type_key}", ""))): str,
        vol.Optional(f"notify_critical_{type_key}",
            default=g(f"notify_critical_{type_key}", False)): _sel_toggle(),
    })


# ── Config Flow ────────────────────────────────────────────────────────────────

class PrayerTimesConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    def __init__(self):
        self._data = {}
        self._use_reminders = True
        self._use_ramadan   = False
        self._use_notify    = False

    async def async_step_user(self, user_input=None):
        return await self.async_step_intro()

    # ── 1. INTRO ───────────────────────────────────────────────────────────────
    async def async_step_intro(self, user_input=None):
        if user_input is not None:
            self._use_reminders = user_input.get("use_reminders", True)
            self._use_ramadan   = user_input.get("use_ramadan", False)
            self._use_notify    = user_input.get("use_notify", False)
            self._data.update(user_input)
            return await self.async_step_location()
        return self.async_show_form(
            step_id="intro",
            data_schema=vol.Schema({
                vol.Optional("use_reminders", default=True):  _sel_toggle(),
                vol.Optional("use_ramadan",   default=False): _sel_toggle(),
                vol.Optional("use_notify",    default=False): _sel_toggle(),
            }),
        )

    # ── 2. LOCATIE ─────────────────────────────────────────────────────────────
    async def async_step_location(self, user_input=None):
        errors = {}
        ha = self.hass.config
        default_city    = getattr(ha, "city",    None) or "Amsterdam"
        default_country = getattr(ha, "country", None) or "Netherlands"
        if user_input is not None:
            ok = await _test_connection(
                user_input[CONF_CITY], user_input[CONF_COUNTRY], user_input[CONF_METHOD])
            if ok:
                self._data.update(user_input)
                return await self.async_step_speakers()
            errors["base"] = "cannot_connect"
        return self.async_show_form(
            step_id="location",
            data_schema=vol.Schema({
                vol.Required(CONF_CITY,    default=default_city):    str,
                vol.Required(CONF_COUNTRY, default=default_country): str,
                vol.Required(CONF_METHOD,  default="3"):             _sel_method(),
            }),
            errors=errors,
        )

    # ── 3. SPEAKERS ────────────────────────────────────────────────────────────
    async def async_step_speakers(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_volumes()
        return self.async_show_form(
            step_id="speakers",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_SPEAKER, default=[]): _sel_speaker(),
                vol.Required(CONF_DAY_SPEAKER,  default=[]): _sel_speaker(),
                vol.Optional(CONF_TARHIM_SPEAKER, default=[]): _sel_speaker(),
                vol.Optional("suhoor_speaker",    default=[]): _sel_speaker(),
            }),
        )

    # ── 4. VOLUMES ─────────────────────────────────────────────────────────────
    async def async_step_volumes(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_sounds()
        return self.async_show_form(
            step_id="volumes",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_VOLUME,       default=20):    _sel_volume(),
                vol.Required(CONF_DAY_VOLUME,        default=50):    _sel_volume(),
                vol.Optional("suhoor_volume",        default=60):    _sel_volume(),
                vol.Optional("night_volume_enabled", default=False): _sel_toggle(),
                vol.Optional("night_volume",         default=15):    _sel_volume(),
                vol.Optional("night_start_hour",     default=22):    _sel_hour(18, 23),
                vol.Optional("night_end_mode",       default="fajr"): _sel_night_end_mode(),
                vol.Optional("night_end_hour",       default=7):     _sel_hour(4, 12),
            }),
        )

    # ── 5. SOUNDS ──────────────────────────────────────────────────────────────
    async def async_step_sounds(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_reminders() if self._use_reminders
                          else self.async_step_ramadan_audio() if self._use_ramadan
                          else self.async_step_notify_prayer() if self._use_notify
                          else self._finish())

        fajr_sounds, day_sounds, tarhim_sounds, suhoor_sounds_raw = await asyncio.gather(
            async_get_fajr_sounds(self.hass),
            async_get_day_sounds(self.hass),
            async_get_tarhim_sounds(self.hass),
            async_get_suhoor_sounds(self.hass),
        )
        suhoor_sounds = {"": "— No sound —", **suhoor_sounds_raw}

        return self.async_show_form(
            step_id="sounds",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_SOUND, default=next(iter(fajr_sounds), "")): _sel_sound(fajr_sounds),
                vol.Required(CONF_DAY_SOUND,  default=next(iter(day_sounds), "")):  _sel_sound(day_sounds),
                vol.Optional(CONF_TARHIM_SOUND, default=next(iter(tarhim_sounds), "")): _sel_sound(tarhim_sounds),
                vol.Optional("suhoor_sound",    default=next(iter(suhoor_sounds_raw), "")): _sel_sound(suhoor_sounds),
            }),
        )

    # ── 6. PRE-ADHAN REMINDERS (optioneel) ────────────────────────────────────
    async def async_step_reminders(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_ramadan_audio() if self._use_ramadan
                          else self.async_step_notify_prayer() if self._use_notify
                          else self._finish())

        jingle_sounds = await async_get_jingle_sounds(self.hass)
        sounds    = {"": "— No sound —", **jingle_sounds}
        sound_sel = selector.selector({"select": {
            "options": [{"value": k, "label": v} for k, v in sounds.items()],
            "mode": "dropdown",
        }})
        lang_sel  = selector.selector({"select": {
            "options": [{"value": k, "label": v} for k, v in REMINDER_LANGUAGES.items()],
            "mode": "dropdown",
        }})
        dt = REMINDER_DEFAULT_TEXTS["ar"]
        return self.async_show_form(
            step_id="reminders",
            data_schema=vol.Schema({
                vol.Optional(CONF_REMINDER_1_ENABLED, default=True):  _sel_toggle(),
                vol.Optional(CONF_REMINDER_1_MINUTES, default=10):    _sel_minutes(),
                vol.Optional(CONF_REMINDER_1_SOUND,   default=""):    sound_sel,
                vol.Optional(CONF_REMINDER_1_LANG,    default="ar"):  lang_sel,
                vol.Optional(CONF_REMINDER_1_TTS,     default=dt):    str,
                vol.Optional(CONF_REMINDER_2_ENABLED, default=False): _sel_toggle(),
                vol.Optional(CONF_REMINDER_2_MINUTES, default=5):     _sel_minutes(),
                vol.Optional(CONF_REMINDER_2_SOUND,   default=""):    sound_sel,
                vol.Optional(CONF_REMINDER_2_LANG,    default="ar"):  lang_sel,
                vol.Optional(CONF_REMINDER_2_TTS,     default=dt):    str,
            }),
        )

    # ── 7. RAMADAN AUDIO (optioneel) ───────────────────────────────────────────
    async def async_step_ramadan_audio(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_notify_prayer() if self._use_notify
                          else self._finish())
        return self.async_show_form(
            step_id="ramadan_audio",
            data_schema=vol.Schema({
                vol.Optional(CONF_TARHIM_ENABLED, default=True):  _sel_toggle(),
                vol.Optional("suhoor_enabled",    default=True):  _sel_toggle(),
                vol.Optional("suhoor_minutes",    default=30):    _sel_minutes(120),
            }),
        )

    # ── 8. NOTIFICATIE ADHAN (optioneel) ───────────────────────────────────────
    async def async_step_notify_prayer(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_notify_pre_adhan() if self._use_reminders
                          else self.async_step_ramadan_notify() if self._use_ramadan
                          else self._finish())
        return self.async_show_form(
            step_id="notify_prayer",
            data_schema=_notify_schema(self.hass, type_key="prayer",
                defaults={"notify_msg_prayer": "It is time for {prayer} prayer 🕌"}),
        )

    # ── 9. NOTIFICATIE PRE-ADHAN (optioneel) ───────────────────────────────────
    async def async_step_notify_pre_adhan(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_ramadan_notify() if self._use_ramadan
                          else self._finish())
        return self.async_show_form(
            step_id="notify_pre_adhan",
            data_schema=_notify_schema(self.hass, type_key="pre_adhan",
                defaults={"notify_msg_pre_adhan": "{prayer} in {minutes} minutes"}),
        )

    # ── 10. RAMADAN NOTIFICATIES (optioneel) ───────────────────────────────────
    async def async_step_ramadan_notify(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self._finish()
        return self.async_show_form(
            step_id="ramadan_notify",
            data_schema=vol.Schema({
                **_notify_schema(self.hass, type_key="tarhim",
                    defaults={"notify_msg_tarhim": "Tarhim — Fajr starts soon 🌙"}).schema,
                **_notify_schema(self.hass, type_key="suhoor",
                    defaults={"notify_msg_suhoor": "Last chance for Suhoor 🍽️"}).schema,
            }),
        )

    async def _finish(self):
        return self.async_create_entry(
            title=self._data.get(CONF_CITY, "Prayer Times"),
            data=self._data,
        )

    @staticmethod
    @callback
    def async_get_options_flow(config_entry):
        return PrayerTimesOptionsFlow()


# ── Options Flow ───────────────────────────────────────────────────────────────

class PrayerTimesOptionsFlow(config_entries.OptionsFlow):
    def __init__(self):
        self._data = {}

    def _get(self, key, default):
        return self.config_entry.options.get(
            key, self.config_entry.data.get(key, default))

    def _get_list(self, key, default=None):
        val = self._get(key, default or [])
        if isinstance(val, str): return [val]
        return val or []

    def _get_vol(self, key, default):
        v = self._get(key, default)
        return int(v * 100) if isinstance(v, float) and v <= 1 else (v if v else default)

    @property
    def _use_reminders(self): return self._get("use_reminders", True)
    @property
    def _use_ramadan(self):   return self._get("use_ramadan",   False)
    @property
    def _use_notify(self):    return self._get("use_notify",    False)

    async def async_step_init(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_speakers()
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema({
                vol.Required(CONF_CITY,    default=self._get(CONF_CITY,    "Amsterdam")):   str,
                vol.Required(CONF_COUNTRY, default=self._get(CONF_COUNTRY, "Netherlands")): str,
                vol.Required(CONF_METHOD,  default=str(self._get(CONF_METHOD, 3))):         _sel_method(),
                vol.Optional("use_reminders", default=self._get("use_reminders", True)):    _sel_toggle(),
                vol.Optional("use_ramadan",   default=self._get("use_ramadan",  False)):    _sel_toggle(),
                vol.Optional("use_notify",    default=self._get("use_notify",   False)):    _sel_toggle(),
            }),
        )

    async def async_step_speakers(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_volumes()
        return self.async_show_form(
            step_id="speakers",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_SPEAKER,   default=self._get_list(CONF_FAJR_SPEAKER)):   _sel_speaker(),
                vol.Required(CONF_DAY_SPEAKER,    default=self._get_list(CONF_DAY_SPEAKER)):     _sel_speaker(),
                vol.Optional(CONF_TARHIM_SPEAKER, default=self._get_list(CONF_TARHIM_SPEAKER)): _sel_speaker(),
                vol.Optional("suhoor_speaker",    default=self._get_list("suhoor_speaker")):     _sel_speaker(),
            }),
        )

    async def async_step_volumes(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self.async_step_sounds()
        return self.async_show_form(
            step_id="volumes",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_VOLUME,       default=self._get_vol(CONF_FAJR_VOLUME, 20)):    _sel_volume(),
                vol.Required(CONF_DAY_VOLUME,        default=self._get_vol(CONF_DAY_VOLUME, 50)):      _sel_volume(),
                vol.Optional("suhoor_volume",        default=self._get_vol("suhoor_volume", 60)):      _sel_volume(),
                vol.Optional("night_volume_enabled", default=self._get("night_volume_enabled", False)): _sel_toggle(),
                vol.Optional("night_volume",         default=self._get_vol("night_volume", 15)):        _sel_volume(),
                vol.Optional("night_start_hour",     default=self._get("night_start_hour", 22)):        _sel_hour(18, 23),
                vol.Optional("night_end_mode",       default=self._get("night_end_mode", "fajr")):      _sel_night_end_mode(),
                vol.Optional("night_end_hour",       default=self._get("night_end_hour", 7)):           _sel_hour(4, 12),
            }),
        )

    async def async_step_sounds(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_reminders() if self._use_reminders
                          else self.async_step_ramadan_audio() if self._use_ramadan
                          else self.async_step_notify_prayer() if self._use_notify
                          else self._finish())

        fajr_sounds, day_sounds, tarhim_sounds, suhoor_sounds_raw = await asyncio.gather(
            async_get_fajr_sounds(self.hass),
            async_get_day_sounds(self.hass),
            async_get_tarhim_sounds(self.hass),
            async_get_suhoor_sounds(self.hass),
        )
        suhoor_sounds = {"": "— No sound —", **suhoor_sounds_raw}

        return self.async_show_form(
            step_id="sounds",
            data_schema=vol.Schema({
                vol.Required(CONF_FAJR_SOUND,   default=self._get(CONF_FAJR_SOUND, next(iter(fajr_sounds), ""))): _sel_sound(fajr_sounds),
                vol.Required(CONF_DAY_SOUND,    default=self._get(CONF_DAY_SOUND,  next(iter(day_sounds), ""))):  _sel_sound(day_sounds),
                vol.Optional(CONF_TARHIM_SOUND, default=self._get(CONF_TARHIM_SOUND, next(iter(tarhim_sounds), ""))): _sel_sound(tarhim_sounds),
                vol.Optional("suhoor_sound",    default=self._get("suhoor_sound", next(iter(suhoor_sounds_raw), ""))): _sel_sound(suhoor_sounds),
            }),
        )

    async def async_step_reminders(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_ramadan_audio() if self._use_ramadan
                          else self.async_step_notify_prayer() if self._use_notify
                          else self._finish())

        jingle_sounds = await async_get_jingle_sounds(self.hass)
        sounds    = {"": "— No sound —", **jingle_sounds}
        sound_sel = selector.selector({"select": {
            "options": [{"value": k, "label": v} for k, v in sounds.items()],
            "mode": "dropdown",
        }})
        lang_sel = selector.selector({"select": {
            "options": [{"value": k, "label": v} for k, v in REMINDER_LANGUAGES.items()],
            "mode": "dropdown",
        }})
        dt = REMINDER_DEFAULT_TEXTS["ar"]
        return self.async_show_form(
            step_id="reminders",
            data_schema=vol.Schema({
                vol.Optional(CONF_REMINDER_1_ENABLED, default=self._get(CONF_REMINDER_1_ENABLED, True)):  _sel_toggle(),
                vol.Optional(CONF_REMINDER_1_MINUTES, default=self._get(CONF_REMINDER_1_MINUTES, 10)):    _sel_minutes(),
                vol.Optional(CONF_REMINDER_1_SOUND,   default=self._get(CONF_REMINDER_1_SOUND,   "")):   sound_sel,
                vol.Optional(CONF_REMINDER_1_LANG,    default=self._get(CONF_REMINDER_1_LANG,    "nl")): lang_sel,
                vol.Optional(CONF_REMINDER_1_TTS,     default=self._get(CONF_REMINDER_1_TTS,     dt)):   str,
                vol.Optional(CONF_REMINDER_2_ENABLED, default=self._get(CONF_REMINDER_2_ENABLED, False)): _sel_toggle(),
                vol.Optional(CONF_REMINDER_2_MINUTES, default=self._get(CONF_REMINDER_2_MINUTES, 5)):     _sel_minutes(),
                vol.Optional(CONF_REMINDER_2_SOUND,   default=self._get(CONF_REMINDER_2_SOUND,   "")):   sound_sel,
                vol.Optional(CONF_REMINDER_2_LANG,    default=self._get(CONF_REMINDER_2_LANG,    "nl")): lang_sel,
                vol.Optional(CONF_REMINDER_2_TTS,     default=self._get(CONF_REMINDER_2_TTS,     dt)):   str,
            }),
        )

    async def async_step_ramadan_audio(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_notify_prayer() if self._use_notify
                          else self._finish())
        return self.async_show_form(
            step_id="ramadan_audio",
            data_schema=vol.Schema({
                vol.Optional(CONF_TARHIM_ENABLED, default=self._get(CONF_TARHIM_ENABLED, True)): _sel_toggle(),
                vol.Optional("suhoor_enabled",    default=self._get("suhoor_enabled", True)):    _sel_toggle(),
                vol.Optional("suhoor_minutes",    default=self._get("suhoor_minutes", 30)):       _sel_minutes(120),
            }),
        )

    async def async_step_notify_prayer(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_notify_pre_adhan() if self._use_reminders
                          else self.async_step_ramadan_notify() if self._use_ramadan
                          else self._finish())
        return self.async_show_form(
            step_id="notify_prayer",
            data_schema=_notify_schema(self.hass, get=self._get, type_key="prayer",
                defaults={"notify_msg_prayer": "It is time for {prayer} prayer 🕌"}),
        )

    async def async_step_notify_pre_adhan(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await (self.async_step_ramadan_notify() if self._use_ramadan
                          else self._finish())
        return self.async_show_form(
            step_id="notify_pre_adhan",
            data_schema=_notify_schema(self.hass, get=self._get, type_key="pre_adhan",
                defaults={"notify_msg_pre_adhan": "{prayer} in {minutes} minutes"}),
        )

    async def async_step_ramadan_notify(self, user_input=None):
        if user_input is not None:
            self._data.update(user_input)
            return await self._finish()
        return self.async_show_form(
            step_id="ramadan_notify",
            data_schema=vol.Schema({
                **_notify_schema(self.hass, get=self._get, type_key="tarhim",
                    defaults={"notify_msg_tarhim": "Tarhim — Fajr starts soon 🌙"}).schema,
                **_notify_schema(self.hass, get=self._get, type_key="suhoor",
                    defaults={"notify_msg_suhoor": "Last chance for Suhoor 🍽️"}).schema,
            }),
        )

    async def _finish(self):
        return self.async_create_entry(title="", data=self._data)
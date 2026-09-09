"""Nida Integration — Islamic prayer times + adhan + reminders for Home Assistant.

HERBOUW-STATUS (2.0.2). Dit bestand bouwt stap voor stap weer op richting het
volledige eindbeeld in references/architecture.md.

Nog NIET terug (komt later):
  - binary_sensor.py / switch.py                → entities (per-gebed aan/uit)
  - media/*                                       → tarhim/suhoor/reminder afspelen
  - notify/*                                       → push-notificaties
  - fasting.py / fasting_binary_sensors.py        → Ramadan/vasten-logica
  - volume.py                                       → night volume
  - pre-adhan jingle scheduling                     → een trigger N min voor elk gebed

Wel aanwezig vanaf 2.0.2:
  - coordinator.py  → ongewijzigd, haalt prayer timings + hijri op
  - sensor.py        → 16 sensors: 5 gebeden (timestamp+readable), 5 hijri, next_prayer
  - panel.py          → Masjid sidebar-entry (toggleable via options flow)
  - websocket.py       → get_settings/update_settings commands voor het panel
  - config_flow.py     → welcome step + options flow
  - helpers.py        → kopieert bundled sounds naar <config>/www/nida/sounds/
  - services.py        → nida.play_adhan service
  - scheduler.py        → plant adhan-triggers per prayer-time

Changelog:
  2.0.3 (2026-06-28): _async_update_listener is nu selectief — alleen
                      een integratie-reload bij wijziging van
                      show_in_sidebar. Voorheen reloadde de integratie
                      bij ELKE options-change (toggle, city, method...),
                      wat het paneel kort uit de sidebar haalde en de
                      browser terug deed gaan naar het dashboard.
  2.0.2 (2026-06-28): Sidebar entry is now conditional on
                      options.show_in_sidebar (default True). Welcome
                      step in the config flow restored. Sidebar label
                      renamed to "Masjid" (URL path stays /nida). On
                      unload the panel is also removed cleanly.
  2.0.1 (2026-06-28): Automatic adhan playback toegevoegd — helpers,
                      services en scheduler aangehaakt. async_copy_sounds()
                      draait op elke setup; nida.play_adhan service
                      geregistreerd; NidaScheduler plant triggers en
                      ruimt zichzelf op via entry.async_on_unload.
  2.0.0 (2026-06-27): Sensor-platform (sensor.py) toegevoegd aan PLATFORMS en
                      async_unload_entry — eerste herbouwstap na het kale
                      coordinator+panel+websocket-skelet.
"""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .config_flow import OPT_SHOW_IN_SIDEBAR
from .const import DOMAIN
from .coordinator import PrayerTimesCoordinator
from .helpers import async_copy_sounds
from .panel import async_register_panel, async_remove_panel
from .scheduler import NidaScheduler
from .services import async_register_services, async_unregister_services
from .websocket import async_register_websocket_commands

_LOGGER = logging.getLogger(__name__)

PLATFORMS = ["sensor"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Initialize Nida from a config entry."""
    # Mirror bundled sounds into <config>/www/nida/sounds/ so that
    # media_player.play_media can reach them via /local/nida/sounds/<path>.
    # Idempotent — only copies missing files, so user-replaced sounds in
    # www/ are preserved across reloads.
    await async_copy_sounds(hass)

    coordinator = PrayerTimesCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()

    hass.data.setdefault(DOMAIN, {})
    hass.data[DOMAIN][entry.entry_id] = coordinator
    # Snapshot the sidebar state so _async_update_listener can detect
    # actual changes vs. options updates that don't touch the sidebar.
    hass.data[DOMAIN][f"_sidebar_state_{entry.entry_id}"] = entry.options.get(
        OPT_SHOW_IN_SIDEBAR, True
    )

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_update_listener))

    async_register_websocket_commands(hass)
    async_register_services(hass)

    # Sidebar handling: remove any prior panel registration first, then
    # re-add it only if the option is enabled. This ordering means the
    # option-change reload flow reliably reflects the new state, even
    # when toggling from True → False (registration is simply skipped).
    async_remove_panel(hass)
    if entry.options.get(OPT_SHOW_IN_SIDEBAR, True):
        await async_register_panel(hass)

    # Scheduler hooks into coordinator updates and self-cleans on unload.
    scheduler = NidaScheduler(hass, entry, coordinator)
    scheduler.async_setup()
    entry.async_on_unload(scheduler.async_shutdown)

    _LOGGER.info("Nida (2.0.2) succesvol geladen voor entry %s", entry.entry_id)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        # Drop the sidebar entry; no-op if it wasn't registered.
        async_remove_panel(hass)
        hass.data[DOMAIN].pop(entry.entry_id, None)
        # If no Nida entries remain, drop the global service registration
        # so we don't leave a dangling nida.play_adhan in HA's service list.
        if not hass.config_entries.async_entries(DOMAIN):
            async_unregister_services(hass)
    return unload_ok


async def _async_update_listener(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Reload integration ONLY when the sidebar toggle changed.

    Every entry.options update (panel toggles, location edits, method,
    sound choices, language) fires this listener. If we'd unconditionally
    reload, the panel would un-mount + re-mount on every panel click —
    which made the browser bounce back to the dashboard (the "verspringen"
    Johann observed). Only the sidebar toggle actually needs a reload, so
    we detect that specific change and skip otherwise.

    Trade-off: prayer toggles and sound selections take effect at the next
    coordinator refresh (max 12 hours) instead of instantly. Acceptable
    for now; a dispatcher-based live update can replace this later.
    """
    nida_data = hass.data.setdefault(DOMAIN, {})
    key = f"_sidebar_state_{entry.entry_id}"
    prev = nida_data.get(key)
    curr = entry.options.get(OPT_SHOW_IN_SIDEBAR, True)
    nida_data[key] = curr
    if prev == curr:
        return
    await hass.config_entries.async_reload(entry.entry_id)

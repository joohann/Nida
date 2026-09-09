"""Nida switch platform — per-prayer adhan AAN/UIT als HA-entities.

Until 2.0.17 the per-prayer toggle lived only in entry.options
(via the panel). That meant automations and dashboards outside the
panel had no way to flip them. This platform publishes one switch
per prayer (switch.nida_fajr, switch.nida_dhuhr, ...) whose state
mirrors options.enabled_<prayer> and writes back the same way the
panel does.

Toggling a switch updates entry.options, which fires the entry's
update listener in __init__.py — that listener now reschedules the
scheduler so the change takes effect immediately (instead of waiting
for the next coordinator refresh, which could be up to 12 hours).

Changelog:
  2.0.17 (2026-06-28): New file — first switch platform. Per-prayer
                       enabled-toggles as HA entities. icon = mdi:mosque
                       to match the prayer-times sensors. unique_id =
                       "<entry_id>_enabled_<prayer>" so the entities
                       are stable across renames and the user can
                       customise them in the entity registry.
"""
from __future__ import annotations

import logging

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, OPT_ENABLED_PREFIX, PRAYERS, SENSOR_ENTITY_PREFIX

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Register one enabled-switch per prayer."""
    async_add_entities(
        [NidaPrayerEnabledSwitch(hass, entry, prayer) for prayer in PRAYERS]
    )


class NidaPrayerEnabledSwitch(SwitchEntity):
    """Switch backing options.enabled_<prayer> for one prayer."""

    _attr_has_entity_name = False
    _attr_icon = "mdi:mosque"

    def __init__(
        self, hass: HomeAssistant, entry: ConfigEntry, prayer: str
    ) -> None:
        self.hass = hass
        self._entry = entry
        self._prayer = prayer
        self._opt_key = f"{OPT_ENABLED_PREFIX}{prayer}"
        # Hardcoded English — see SKILL.md: Islamic proper names (Fajr,
        # Dhuhr, ...) are not translated per language.
        self._attr_name = f"{prayer.capitalize()} adhan"
        self._attr_unique_id = f"{entry.entry_id}_enabled_{prayer}"
        # Match the sensor entity_id convention: sensor.nida_<prayer>
        # → switch.nida_<prayer>_enabled. The "_enabled" suffix
        # disambiguates from any future per-prayer switches we add
        # (e.g. notify-per-prayer, volume-per-prayer).
        self.entity_id = f"switch.{SENSOR_ENTITY_PREFIX}{prayer}_enabled"

    @property
    def is_on(self) -> bool:
        """True when the prayer is enabled (default ON when option missing)."""
        val = self._entry.options.get(self._opt_key)
        return True if val is None else bool(val)

    async def async_turn_on(self, **kwargs) -> None:
        await self._write(True)

    async def async_turn_off(self, **kwargs) -> None:
        await self._write(False)

    async def _write(self, value: bool) -> None:
        new_options = {**self._entry.options, self._opt_key: value}
        self.hass.config_entries.async_update_entry(
            self._entry, options=new_options
        )
        # async_update_entry triggers the entry's update listener in
        # __init__.py, which (2.0.17+) reschedules the scheduler on any
        # non-sidebar option change. No need to write_ha_state here —
        # the listener path will refresh us via the next state read.
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        """Subscribe to entry-option changes so the panel and the switch stay in sync.

        Without this, toggling from the panel would update options but
        the switch's internal state-source (entry.options) is read on
        every is_on access, so the next state-poll picks it up — but
        HA's state machine doesn't re-poll switches. Explicitly listen
        for options changes and push a fresh state.
        """
        self.async_on_remove(
            self._entry.add_update_listener(self._on_options_change)
        )

    async def _on_options_change(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        # Just refresh — is_on reads straight from options.
        self.async_write_ha_state()

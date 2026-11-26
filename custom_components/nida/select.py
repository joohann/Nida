"""Nida select platform — visitors mode as a list of durations.

select.nida_visitors_mode offers Off, 1 to 24 hours, and "until I turn
it off". Choosing an option starts (or ends) visitors mode exactly like
the panel's mute popup does, so it fits a Bubble Card "select" card or
a select.select_option call from an automation. When the chosen time
runs out the state returns to Off on its own (see visitors.py).

The option labels are translated through the entity translations in
strings.json / translations/*.json (entity.select.visitors_mode.state).

Changelog:
  2.5.4 (2026-11-21): New file — visitors mode select entity.
"""
from __future__ import annotations

from homeassistant.components.select import SelectEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .sensor import _device_info
from .visitors import VISITORS_OPTIONS, VisitorsMode


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    async_add_entities([NidaVisitorsModeSelect(hass, entry)])


class NidaVisitorsModeSelect(SelectEntity):
    """Visitors mode duration list."""

    _attr_has_entity_name = True
    _attr_translation_key = "visitors_mode"
    _attr_icon = "mdi:account-group"
    _attr_options = VISITORS_OPTIONS

    def __init__(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.hass = hass
        self._entry = entry
        self._mode = VisitorsMode(hass, entry)
        self._attr_unique_id = f"{entry.entry_id}_visitors_mode_select"
        self._attr_device_info = _device_info(entry)
        self.entity_id = "select.nida_visitors_mode"

    @property
    def current_option(self) -> str:
        return self._mode.current_option

    @property
    def extra_state_attributes(self) -> dict:
        until = self._mode.until if self._mode.is_active else None
        return {"until": until.isoformat() if until else None}

    async def async_select_option(self, option: str) -> None:
        self._mode.async_select(option)
        self.async_write_ha_state()

    async def async_added_to_hass(self) -> None:
        # Stay in sync with the panel, the switch and the expiry timer,
        # which all change the same entry options.
        self.async_on_remove(self._entry.add_update_listener(self._on_options_change))

    async def _on_options_change(self, hass: HomeAssistant, entry: ConfigEntry) -> None:
        self.async_write_ha_state()

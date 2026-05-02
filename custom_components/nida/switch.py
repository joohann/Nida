"""
Switch platform for the Nida HACS integration.

Exposes a single switch — switch.nida_intend_to_fast — which the user
toggles on a fasting day. The "currently fasting" binary sensor reads
this flag and combines it with the fajr/maghrib window.

State is persisted across HA restarts via RestoreEntity, and mirrored
onto the coordinator under ATTR_USER_INTENDS_FAST so binary sensors
don't need a state lookup.

Add "switch" to the PLATFORMS list in __init__.py to enable this.

@version 1.0.0
"""

from __future__ import annotations

import logging
from typing import Any

from homeassistant.components.switch import SwitchEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback
from homeassistant.helpers.restore_state import RestoreEntity

from .const import DOMAIN, ATTR_USER_INTENDS_FAST

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    coordinator = hass.data[DOMAIN][entry.entry_id]
    async_add_entities([NidaIntendToFastSwitch(coordinator, entry)])


class NidaIntendToFastSwitch(SwitchEntity, RestoreEntity):
    """User-facing toggle: 'I intend to fast today.'

    Auto-reset is intentionally NOT implemented in code. Let the user
    drive it explicitly, or wire an HA automation (e.g. clear at 03:00)
    if you want behaviour like that.
    """

    _attr_has_entity_name = True
    _attr_name = "Intend to fast"
    _attr_icon = "mdi:food-off"

    def __init__(self, coordinator, entry: ConfigEntry) -> None:
        self._coordinator = coordinator
        self._entry = entry
        self._attr_unique_id = f"{entry.entry_id}_intend_to_fast"
        self._is_on = False
        # Mirror initial state onto coordinator so sensors can read it.
        setattr(coordinator, ATTR_USER_INTENDS_FAST, False)

    async def async_added_to_hass(self) -> None:
        """Restore the last known on/off state."""
        await super().async_added_to_hass()
        last = await self.async_get_last_state()
        if last is not None and last.state == "on":
            self._is_on = True
            setattr(self._coordinator, ATTR_USER_INTENDS_FAST, True)
            # Notify binary_sensor.nida_currently_fasting immediately so it
            # reflects the restored intent on the next state read instead of
            # waiting for its 1-minute tick.
            self._coordinator.async_update_listeners()

    @property
    def is_on(self) -> bool:
        return self._is_on

    async def async_turn_on(self, **kwargs: Any) -> None:
        self._set(True)

    async def async_turn_off(self, **kwargs: Any) -> None:
        self._set(False)

    def _set(self, value: bool) -> None:
        self._is_on = value
        setattr(self._coordinator, ATTR_USER_INTENDS_FAST, value)
        self.async_write_ha_state()
        # Push to the binary sensors immediately.
        self._coordinator.async_update_listeners()

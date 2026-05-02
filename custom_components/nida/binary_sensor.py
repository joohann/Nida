"""Binary sensor platform for the Nida integration.

Acts purely as a platform entry point for Home Assistant. The actual
entity classes live in fasting_binary_sensors.py so the logic can be
unit-tested without spinning up the full HA platform machinery.

@version 1.0.0
"""
from __future__ import annotations

import logging

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .fasting_binary_sensors import build_fasting_binary_sensors

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Set up Nida binary sensors from a config entry.

    Currently registers only the three fasting sensors. Future binary
    sensors (e.g. is_currently_praying, is_qibla_aligned) plug in here.
    """
    coordinator = hass.data[DOMAIN][entry.entry_id]
    entities = build_fasting_binary_sensors(coordinator, entry)
    async_add_entities(entities)
    _LOGGER.debug("Nida binary_sensor: registered %d entities", len(entities))

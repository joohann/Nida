"""Nida button platform — one button entity per configured dua.

Changelog:
  2.0.51 (2026-07-02): Initial version. Each entry in options.duas gets
                       a button entity (unique_id
                       <entry_id>_dua_<dua_id>) whose press calls
                       nida.play_dua for that dua. This is the hook for
                       "couple a dua to a button or sensor": expose the
                       button on a dashboard, wire it to an NFC tag, or
                       press it from any automation that triggers on a
                       sensor. __init__.py reloads the entry whenever
                       the SET of dua ids changes so entities appear
                       and disappear with the config; edits to an
                       existing dua (sound/player/volume) need no
                       reload because the service reads options live at
                       press time.
"""
from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, OPT_DUAS
from .services import SERVICE_PLAY_DUA

_LOGGER = logging.getLogger(__name__)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: ConfigEntry,
    async_add_entities: AddEntitiesCallback,
) -> None:
    """Create a button per configured dua."""
    duas = entry.options.get(OPT_DUAS) or []
    entities = [
        NidaDuaButton(entry, dua)
        for dua in duas
        if isinstance(dua, dict) and dua.get("id")
    ]
    if entities:
        async_add_entities(entities)


class NidaDuaButton(ButtonEntity):
    """Press to play one specific dua via nida.play_dua."""

    _attr_should_poll = False
    _attr_icon = "mdi:hands-pray"

    def __init__(self, entry: ConfigEntry, dua: dict) -> None:
        self._entry = entry
        self._dua_id = str(dua["id"])
        name = str(dua.get("name") or self._dua_id)
        self._attr_name = f"Nida Dua {name}"
        self._attr_unique_id = f"{entry.entry_id}_dua_{self._dua_id}"

    async def async_press(self) -> None:
        """Fire the play service; it reads the live dua config itself."""
        await self.hass.services.async_call(
            DOMAIN,
            SERVICE_PLAY_DUA,
            {"dua_id": self._dua_id},
            blocking=False,
        )

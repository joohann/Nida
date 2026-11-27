"""Nida button platform — one button entity per configured dua.

Changelog:
  2.5.7 (2026-11-27): The dua buttons belong to the Nida device, like every
                       other Nida entity. Names and entity ids stay as
                       they are (has_entity_name is still off).
                       async_remove_dua_buttons() drops the registry entry
                       of a deleted dua's button, which used to linger as
                       an "unavailable" entity.
  2.0.51 (2026-07-02): Initial version. Each entry in options.duas gets
                       a button entity (unique_id
                       <entry_id>_dua_<dua_id>) whose press calls
                       nida.play_dua for that dua. This is the hook for
                       "couple a dua to a button or sensor": expose the
                       button on a dashboard, wire it to an NFC tag, or
                       press it from any automation that triggers on a
                       sensor. __init__.py reloads the button platform
                       (the whole entry until 2.0.60) whenever the SET
                       of dua ids changes so entities appear and
                       disappear with the config; edits to an
                       existing dua (sound/player/volume) need no
                       reload because the service reads options live at
                       press time.
"""
from __future__ import annotations

import logging

from homeassistant.components.button import ButtonEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN, OPT_DUAS
from .sensor import _device_info
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


def _dua_unique_id(entry: ConfigEntry, dua_id: str) -> str:
    return f"{entry.entry_id}_dua_{dua_id}"


@callback
def async_remove_dua_buttons(
    hass: HomeAssistant, entry: ConfigEntry, dua_ids: set[str]
) -> None:
    """Remove the registry entries of the buttons of deleted duas.

    Called by the options update listener with exactly the ids that left
    the duas list, so a dua the user deletes takes its button along. Only
    those ids: a list that is empty for another reason (a bad restore)
    never wipes the other buttons and their customisations.
    """
    if not dua_ids:
        return
    registry = er.async_get(hass)
    for dua_id in dua_ids:
        entity_id = registry.async_get_entity_id(
            "button", DOMAIN, _dua_unique_id(entry, dua_id)
        )
        if entity_id is not None:
            _LOGGER.info("Removing %s: its dua was deleted", entity_id)
            registry.async_remove(entity_id)


class NidaDuaButton(ButtonEntity):
    """Press to play one specific dua via nida.play_dua."""

    _attr_should_poll = False
    _attr_icon = "mdi:hands-pray"

    def __init__(self, entry: ConfigEntry, dua: dict) -> None:
        self._entry = entry
        self._dua_id = str(dua["id"])
        name = str(dua.get("name") or self._dua_id)
        self._attr_name = f"Nida Dua {name}"
        self._attr_unique_id = _dua_unique_id(entry, self._dua_id)
        self._attr_device_info = _device_info(entry)

    async def async_press(self) -> None:
        """Fire the play service; it reads the live dua config itself."""
        await self.hass.services.async_call(
            DOMAIN,
            SERVICE_PLAY_DUA,
            {"dua_id": self._dua_id},
            blocking=False,
        )

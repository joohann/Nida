"""Nida websocket API — panel <-> config_entry communicatie.

Het Nida-panel (frontend/nida-panel.js) praat via deze commands met de
Python-backend, omdat een custom panel geen directe toegang heeft tot
hass.config_entries. Alle instellingen die voorheen in de config/options
flow zaten (locatie, methode, per-gebed aan/uit, sound-keuze) lopen vanaf
2.0.0 via dit kanaal.

Sound-download-on-demand (categorie 5 in references/architecture.md) is
nog niet geïmplementeerd in dit skelet — ws_update_settings slaat alleen
de gekozen waarde op. De daadwerkelijke download volgt zodra de
sound-catalogus (sounds/catalog/catalog.json) er is.

Changelog:
  2.0.0 (2026-06-27): Nieuw bestand — get_settings/update_settings commands
                      voor het panel. async_setup is sync (@callback), conform
                      het standaard HA-patroon voor websocket-command-registratie.
                      Download-on-demand nog niet geïmplementeerd.
"""
from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import config_validation as cv

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def _get_entry(hass: HomeAssistant, entry_id: str):
    """Haal de Nida config entry op, of None als die niet bestaat.

    Klein lokaal hulpje i.p.v. een losse helpers.py-functie, omdat dit
    skelet bewust nog geen helpers.py meeneemt (zie SKILL.md afbakening).
    """
    return hass.config_entries.async_get_entry(entry_id)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/get_settings",
        vol.Required("entry_id"): cv.string,
    }
)
@websocket_api.async_response
async def ws_get_settings(hass: HomeAssistant, connection, msg) -> None:
    """Geef de huidige config_entry.options terug aan het panel."""
    entry = _get_entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Config entry niet gevonden")
        return
    connection.send_result(msg["id"], dict(entry.options))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "nida/update_settings",
        vol.Required("entry_id"): cv.string,
        vol.Required("options"): dict,
    }
)
@websocket_api.async_response
async def ws_update_settings(hass: HomeAssistant, connection, msg) -> None:
    """Sla nieuwe instellingen op vanuit het panel.

    Doet op dit moment alleen de options-update. Zodra de sound-catalogus
    bestaat, hoort hier ook de check + trigger voor download-on-demand bij
    (zie references/architecture.md §5 in de nida-ha-integration skill).
    """
    entry = _get_entry(hass, msg["entry_id"])
    if entry is None:
        connection.send_error(msg["id"], "not_found", "Config entry niet gevonden")
        return

    hass.config_entries.async_update_entry(entry, options=msg["options"])
    _LOGGER.debug("Nida settings bijgewerkt via panel: %s", msg["options"])
    connection.send_result(msg["id"], {"success": True})


@callback
def async_register_websocket_commands(hass: HomeAssistant) -> None:
    """Registreer alle Nida websocket-commands.

    Wordt aangeroepen vanuit __init__.py::async_setup_entry — let op: dit is
    een synchrone @callback, geen coroutine, dus zonder await aanroepen.
    Volgende commands volgen hetzelfde patroon: schema met
    "type": "nida/<actie>", een async_response-handler, registratie hier.
    """
    websocket_api.async_register_command(hass, ws_get_settings)
    websocket_api.async_register_command(hass, ws_update_settings)

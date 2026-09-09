"""Nida config flow — welcome step + options flow for Masjid settings.

Two flows live in this file:

  ConfigFlow.async_step_user
    The initial setup screen when adding Nida from Settings → Devices &
    Services → Add Integration. This is intentionally NOT a technical
    form — it's a welcome page with a greeting (bismillah, salam) and a
    feature outline. The text itself lives in strings.json/translations/
    so it follows the user's HA language. Submitting creates the config
    entry with empty data; all real settings live in the Masjid panel.

  NidaOptionsFlowHandler
    Reachable from Settings → Devices & Services → Nida → Configure.
    Shows a Markdown link to /nida (the Masjid dashboard) plus a toggle
    for sidebar visibility — so users who hide the sidebar can still
    reach the dashboard from the integration page.

Changelog:
  2.0.2 (2026-06-28): Welcome step (bismillah + feature list) restored
                      from Nida 1.x style. Added options flow with a
                      show_in_sidebar toggle and a Markdown dashboard
                      link so the panel stays reachable even when the
                      sidebar entry is hidden.
  2.0.0 (2026-06-27): Herbouw — flow teruggebracht tot alleen entry aanmaken.
                      Sound-keuze en per-gebed instellingen verhuisd naar het panel.
"""
from __future__ import annotations

import logging

import voluptuous as vol

from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import callback
from homeassistant.data_entry_flow import FlowResult

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

# Option key for the sidebar toggle. Kept here (and mirrored in __init__.py
# via direct import) rather than in const.py because it is config-flow-
# specific and not referenced by any other module.
OPT_SHOW_IN_SIDEBAR = "show_in_sidebar"


class NidaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Initial setup — single welcome step that creates the config entry."""

    VERSION = 2  # config-entry schema version; independent of manifest version

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> "NidaOptionsFlowHandler":
        """Hook so HA shows the Configure button on the integration page."""
        return NidaOptionsFlowHandler(config_entry)

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        """Welcome page — text rendered from strings.json -> config.step.user.

        Nida is a singleton integration (one entry per HA install), so a
        second add is aborted with a user-friendly message.
        """
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")

        if user_input is not None:
            return self.async_create_entry(title="Nida", data={})

        # Empty schema → HA renders only the title, description, and the
        # submit button. All visible content comes from strings.json.
        return self.async_show_form(step_id="user", data_schema=vol.Schema({}))


class NidaOptionsFlowHandler(config_entries.OptionsFlow):
    """Post-install options — dashboard link + sidebar toggle.

    Saving updates entry.options; __init__.py's update_listener reloads
    the integration so the sidebar entry actually appears or disappears
    based on the new toggle value.
    """

    def __init__(self, config_entry: ConfigEntry) -> None:
        self.config_entry = config_entry

    async def async_step_init(
        self, user_input: dict | None = None
    ) -> FlowResult:
        if user_input is not None:
            merged = {**self.config_entry.options, **user_input}
            return self.async_create_entry(title="", data=merged)

        current = self.config_entry.options.get(OPT_SHOW_IN_SIDEBAR, True)
        schema = vol.Schema(
            {
                vol.Required(OPT_SHOW_IN_SIDEBAR, default=current): bool,
            }
        )
        return self.async_show_form(step_id="init", data_schema=schema)

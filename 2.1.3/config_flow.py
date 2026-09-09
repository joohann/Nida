"""Nida config flow — auto-create entry + options flow.

The welcome content (bismillah + feature list) lives in the panel as a
one-shot overlay (nida-panel.js, WELCOME_CONTENT), not in this flow:
HA's config-flow description rendering proved unreliable in Johann's
setup, even with strings.json on the correct path and full restarts.
Moving the welcome inside the panel itself removes that dependency
entirely.

Two flows live in this file:

  ConfigFlow.async_step_user
    Auto-creates the config entry without showing any form. Welcome
    content lives in the panel overlay and in the post-setup
    persistent_notification from __init__.py.

  NidaOptionsFlowHandler
    Reachable via Settings → Devices & Services → Nida → Configure.
    Markdown link to /nida + sidebar visibility toggle.

Changelog:
  2.0.8 (2026-06-28): Submit-step verwijderd — entry wordt nu direct
                      aangemaakt zonder formulier. Welkomsttekst leefde
                      al in het panel (WELCOME_CONTENT) en in de
                      persistent_notification, dus de tussen-step had
                      geen functie meer dan een lege blokker zijn.
  2.0.6 (2026-06-28): Welcome text removed — moved into the panel as an
                      overlay (see nida-panel.js WELCOME_CONTENT). The
                      config flow now just shows a one-line confirmation
                      and a Submit button. Doesn't depend on HA's
                      description-rendering anymore.
  2.0.5 (2026-06-28): Welcome text injected via description_placeholders
                      to bypass an apparent strings.json render issue —
                      did not actually fix the rendering, hence 2.0.6.
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

OPT_SHOW_IN_SIDEBAR = "show_in_sidebar"


class NidaConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Initial setup — auto-creates the config entry, no form shown."""

    VERSION = 2

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: ConfigEntry,
    ) -> "NidaOptionsFlowHandler":
        return NidaOptionsFlowHandler(config_entry)

    async def async_step_user(
        self, user_input: dict | None = None
    ) -> FlowResult:
        if self._async_current_entries():
            return self.async_abort(reason="single_instance_allowed")
        return self.async_create_entry(title="Nida", data={})


class NidaOptionsFlowHandler(config_entries.OptionsFlow):
    """Post-install options — dashboard link + sidebar toggle."""

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

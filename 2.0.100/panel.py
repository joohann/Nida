"""Nida custom panel — registers the Nida sidebar entry.

The integration's settings UI (location, sounds, languages, prayer
toggles, media players) lives in a custom panel rather than HA's config
flow because HA's flow framework can't render audio-preview widgets.
The panel is a web component (frontend/nida-panel.js) served via
panel_custom.

The sidebar title is "Nida²" — renamed back from "Masjid" in 2.0.45 so
the sidebar entry matches the integration's own name and the panel
header. The URL path stays /nida so existing bookmarks keep working.

The sidebar entry can be hidden via the options flow
(show_in_sidebar=False). In that case the panel is not registered, and
the dashboard stays reachable via the Markdown link in the options flow.

Changelog:
  2.0.45 (2026-07-02): Sidebar title renamed Masjid → Nida² (matches the
                      integration name and the panel header). Docstring,
                      comments and log lines updated to match; URL path
                      unchanged.
  2.0.2 (2026-06-28): Sidebar title renamed Nida → Masjid. Added
                      async_remove_panel() so __init__.py can drop the
                      sidebar entry when show_in_sidebar is toggled off
                      (re-registering on toggle-on works via the normal
                      entry reload).
  2.0.0 (2026-06-27): New file — panel registration with placeholder
                      frontend, embed_iframe=False and a
                      double-registration check.
"""
from __future__ import annotations

import logging
import os

from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import StaticPathConfig
from homeassistant.core import HomeAssistant, callback

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)

PANEL_URL_PATH = "nida"           # URL stays /nida — don't rename
PANEL_TITLE = "Nida²"             # User-facing sidebar label (matches panel header)
PANEL_ICON = "mdi:mosque"
FRONTEND_SCRIPT_URL = "/nida_panel_files/nida-panel.js"


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Nida panel + serve the frontend bundle.

    Called from __init__.py::async_setup_entry when show_in_sidebar is
    True. Skips registration if the panel is already present (e.g. on a
    reload where the previous panel wasn't removed first).
    """
    if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
        _LOGGER.debug("Nida panel already registered, skipping")
        return

    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/nida_panel_files", frontend_dir, cache_headers=False
            )
        ]
    )

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="nida-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=FRONTEND_SCRIPT_URL,
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        embed_iframe=False,  # False for custom elements (web components)
        require_admin=False,
    )
    _LOGGER.debug("Nida panel registered at /%s", PANEL_URL_PATH)


@callback
def async_remove_panel(hass: HomeAssistant) -> None:
    """Remove the Nida panel from the sidebar.

    Called from __init__.py before every potential re-registration so
    that toggling show_in_sidebar always reflects the new state, and
    from async_unload_entry so the entry disappears cleanly when Nida
    is removed from HA. No-op if the panel isn't currently registered.
    """
    if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
        frontend.async_remove_panel(hass, PANEL_URL_PATH)
        _LOGGER.debug("Nida panel removed from sidebar")

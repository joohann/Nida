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

Also registers frontend/nida-card.js — two Lovelace dashboard cards
("Next prayer" and "Today", picked via a card_type config option) that
work on ANY dashboard, independent of the sidebar panel. Static-file
serving is shared with the panel (same frontend/ directory) but split
into its own function (async_register_static_files) so the card doesn't
depend on the sidebar panel being enabled — a user with show_in_sidebar
off should still be able to use the dashboard cards.

Changelog:
  2.1.22 (2026-07-09): Cache-busting query param (?v=<manifest version>)
                      appended to both FRONTEND_SCRIPT_URL and
                      CARD_SCRIPT_URL. Root cause of a recurring "already
                      fixed but the tablet still shows the old behaviour"
                      class of report (most recently: light-theme
                      background illustration still not centered on
                      Johann's tablet after the 2.1.18 fix that should
                      have addressed it) — browsers/WebViews cache an
                      already-imported ES module for the life of the page,
                      and a kiosk tablet that stays open for days/weeks
                      across many Nida version bumps never re-fetches
                      nida-panel.js/nida-card.js because the URL never
                      changed. Versioning the URL forces a fresh fetch on
                      every release. Existing long-open tabs still need
                      one manual hard refresh to pick this mechanism up in
                      the first place; every release after that is
                      automatic.
  2.1.20 (2026-07-08): async_register_static_files() split out of
                      async_register_panel() (guarded separately so it
                      only ever registers once). New async_register_card()
                      — registers the new frontend/nida-card.js as a
                      global Lovelace resource via
                      frontend.add_extra_js_url(), so the two new
                      dashboard cards it defines (NidaCard, "Next prayer"
                      + "Today") work without the user having to manually
                      add a Lovelace resource. Called unconditionally
                      from __init__.py, unlike the panel itself which is
                      gated on show_in_sidebar.
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
from homeassistant.loader import async_get_integration

from .const import (
    DEFAULT_SIDEBAR_ADMIN_ONLY,
    DOMAIN,
    OPT_SIDEBAR_ADMIN_ONLY,
)

_LOGGER = logging.getLogger(__name__)

PANEL_URL_PATH = "nida"           # URL stays /nida — don't rename
PANEL_TITLE = "Nida²"             # User-facing sidebar label (matches panel header)
PANEL_ICON = "mdi:mosque"
FRONTEND_SCRIPT_URL = "/nida_panel_files/nida-panel.js"
CARD_SCRIPT_URL = "/nida_panel_files/nida-card.js"
_STATIC_FILES_KEY = f"{DOMAIN}_static_files_registered"
_CARD_KEY = f"{DOMAIN}_card_registered"


async def _asset_version(hass: HomeAssistant) -> str:
    """manifest.json's version, used as a cache-busting query param.

    2.1.22 — see module docstring. Read from the integration's own
    manifest rather than duplicating the version string as a constant
    here, so there is nothing extra to keep in sync on a release.
    """
    integration = await async_get_integration(hass, DOMAIN)
    return integration.version or "0"


async def async_register_static_files(hass: HomeAssistant) -> None:
    """Serve frontend/ (nida-panel.js AND nida-card.js) at /nida_panel_files.

    2.1.20 — split out of async_register_panel() so the Lovelace dashboard
    cards (nida-card.js) work even when show_in_sidebar is off and the
    panel itself is never registered. hass.http.async_register_static_paths
    raises if the same URL prefix is registered twice, so this is guarded
    with its own hass.data flag — the frontend_panels check
    async_register_panel uses only tells us about the PANEL, not this
    static path, since a card-only setup never touches frontend_panels.
    """
    if hass.data.get(_STATIC_FILES_KEY):
        return
    frontend_dir = os.path.join(os.path.dirname(__file__), "frontend")
    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                "/nida_panel_files", frontend_dir, cache_headers=False
            )
        ]
    )
    hass.data[_STATIC_FILES_KEY] = True


async def async_register_panel(hass: HomeAssistant) -> None:
    """Register the Nida panel + serve the frontend bundle.

    Called from __init__.py::async_setup_entry when show_in_sidebar is
    True. Skips registration if the panel is already present (e.g. on a
    reload where the previous panel wasn't removed first).
    """
    if PANEL_URL_PATH in hass.data.get("frontend_panels", {}):
        _LOGGER.debug("Nida panel already registered, skipping")
        return

    await async_register_static_files(hass)
    version = await _asset_version(hass)

    # 2.3.18 — optional admin-only sidebar entry. Read at registration
    # time; __init__.py already removes and re-registers the panel on
    # every options update, so flipping the toggle takes effect on save
    # rather than needing a restart.
    entries = hass.config_entries.async_entries(DOMAIN)
    options = dict(entries[0].options) if entries else {}
    admin_only = bool(
        options.get(OPT_SIDEBAR_ADMIN_ONLY, DEFAULT_SIDEBAR_ADMIN_ONLY)
    )

    await panel_custom.async_register_panel(
        hass,
        webcomponent_name="nida-panel",
        frontend_url_path=PANEL_URL_PATH,
        module_url=f"{FRONTEND_SCRIPT_URL}?v={version}",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        embed_iframe=False,  # False for custom elements (web components)
        require_admin=admin_only,
    )
    _LOGGER.debug(
        "Nida panel registered at /%s (v%s, admin_only=%s)",
        PANEL_URL_PATH, version, admin_only,
    )


async def async_register_card(hass: HomeAssistant) -> None:
    """Register nida-card.js as a global Lovelace resource.

    2.1.20 — new. add_extra_js_url makes the two Nida dashboard cards
    (NidaCard, card_type "now"/"today") available on every dashboard
    without the user manually adding a Lovelace resource — the standard
    pattern card-only HACS integrations use. Called unconditionally from
    __init__.py (unlike async_register_panel, which is gated on
    show_in_sidebar) since the dashboard cards are independent of the
    sidebar panel. Guarded so a reload / second config entry doesn't
    register the URL twice.
    """
    if hass.data.get(_CARD_KEY):
        return
    await async_register_static_files(hass)
    version = await _asset_version(hass)
    frontend.add_extra_js_url(hass, f"{CARD_SCRIPT_URL}?v={version}")
    hass.data[_CARD_KEY] = True
    _LOGGER.debug("Nida dashboard card registered (%s, v%s)", CARD_SCRIPT_URL, version)


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

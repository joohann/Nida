"""Nida helpers — sounds + helper entity bootstrapping.

Deze module bevat de setup-helpers die bij iedere integration-load draaien:
  - async_copy_sounds: kopieert MP3's en logo naar /config/www/nida/
  - async_ensure_helpers: maakt de input_boolean helper aan voor suhoor skip
"""
from __future__ import annotations

import logging
import os
import shutil

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


async def async_copy_sounds(hass: HomeAssistant, integration_dir: str) -> None:
    """Kopieer sounds van integration naar /config/www/nida/sounds/.

    Wordt aangeroepen bij elke setup. Bestaande bestanden worden niet
    overschreven, alleen nieuwe bestanden komen erbij.
    """

    def _do_copy() -> int:
        sounds_src = os.path.join(integration_dir, "sounds")
        sounds_dst = hass.config.path("www/nida/sounds")
        www_nida = hass.config.path("www/nida")

        if not os.path.isdir(sounds_src):
            _LOGGER.warning("Sounds source directory not found: %s", sounds_src)
            return 0

        os.makedirs(sounds_dst, exist_ok=True)
        os.makedirs(www_nida, exist_ok=True)

        copied = 0
        for f in sorted(os.listdir(sounds_src)):
            if f.endswith(".mp3"):
                src = os.path.join(sounds_src, f)
                dst = os.path.join(sounds_dst, f)
                if not os.path.exists(dst):
                    shutil.copy2(src, dst)
                    copied += 1
                    _LOGGER.info("Copied sound: %s", f)

        # Logo voor cover art
        logo_dst = os.path.join(www_nida, "logo.png")
        if not os.path.exists(logo_dst):
            for candidate in [
                os.path.join(integration_dir, "images", "logo.png"),
                os.path.join(integration_dir, "brand", "logo.png"),
                os.path.join(integration_dir, "logo.png"),
            ]:
                if os.path.exists(candidate):
                    shutil.copy2(candidate, logo_dst)
                    _LOGGER.info("Nida logo gekopieerd naar www/nida/logo.png")
                    break
            else:
                _LOGGER.debug("Geen logo.png gevonden — cover art niet beschikbaar")

        return copied

    copied = await hass.async_add_executor_job(_do_copy)
    if copied:
        _LOGGER.info("Copied %d sound(s) to www/nida/sounds", copied)
    else:
        _LOGGER.debug("All sounds already present")


async def async_ensure_helpers(hass: HomeAssistant) -> None:
    """Maak benodigde helper entities aan als ze nog niet bestaan."""
    entity_id = "input_boolean.nida_skip_suhoor"
    if hass.states.get(entity_id) is not None:
        return

    try:
        component = hass.data.get("input_boolean")
        if component and hasattr(component, "_collection"):
            await component._collection.async_create(
                {
                    "name": "Nida Skip Suhoor",
                    "icon": "mdi:sleep",
                }
            )
            _LOGGER.info("Helper aangemaakt: %s", entity_id)
        else:
            raise RuntimeError("input_boolean component niet beschikbaar")
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning(
            "Kon helper %s niet aanmaken: %s — maak hem handmatig aan via "
            "Instellingen → Hulpapparaten",
            entity_id,
            e,
        )

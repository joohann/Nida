"""Nida helpers — bridge bundled sound files to Home Assistant's /local/ tree.

media_player.play_media can address local files via the /local/<path> URL,
which HA serves from <config>/www/<path>. Our sounds live inside the
integration package at custom_components/nida/sounds/, which is NOT served
by HA directly. So at setup we mirror them into <config>/www/nida/sounds/.

The copy is idempotent and won't clobber a file the user has already
placed at the destination path — that lets advanced users override a
shipped default by dropping their own file in www/nida/sounds/<rel>.

Changelog:
  2.0.1 (2026-06-28): New file — async_copy_sounds() runs at every setup,
                      mirrors custom_components/nida/sounds/** into
                      <config>/www/nida/sounds/**.
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


async def async_copy_sounds(hass: HomeAssistant) -> None:
    """Mirror bundled sound files into <config>/www/nida/sounds/.

    Runs the actual disk traversal + copies inside an executor job so the
    HA event loop stays free. Missing source dir logs a warning instead of
    raising, because a partial install (no sounds yet) shouldn't break the
    rest of the integration setup.
    """
    src_root = Path(__file__).parent / "sounds"
    dst_root = Path(hass.config.path("www")) / "nida" / "sounds"

    def _do_copy() -> int:
        if not src_root.is_dir():
            _LOGGER.warning(
                "Nida sounds directory not found at %s; nothing copied",
                src_root,
            )
            return 0

        dst_root.mkdir(parents=True, exist_ok=True)
        copied = 0
        for src_file in src_root.rglob("*"):
            if not src_file.is_file():
                continue
            # Skip the catalog JSON itself — it's metadata, not playable.
            if src_file.suffix == ".json":
                continue
            rel = src_file.relative_to(src_root)
            dst_file = dst_root / rel
            if dst_file.exists():
                continue
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            copied += 1
            _LOGGER.debug("Copied Nida sound %s -> %s", src_file, dst_file)
        return copied

    copied = await hass.async_add_executor_job(_do_copy)
    if copied:
        _LOGGER.info("Nida: copied %d sound file(s) into %s", copied, dst_root)


async def async_copy_brand(hass: HomeAssistant) -> None:
    """Mirror brand/icon.png into <config>/www/nida/brand/ (2.3.12).

    Same idea as async_copy_sounds and for the same reason: the file
    lives inside the integration package, which Home Assistant does not
    serve, and the iOS Companion app has to be able to FETCH it over the
    HA connection to show it as a notification attachment. Copying it
    under www/ gives it a /local/nida/brand/icon.png URL.

    Kept as a separate function rather than folded into async_copy_sounds
    because the two have different failure meanings: no sounds is worth a
    warning (nothing will play), no brand icon is worth a debug line at
    most (notifications simply carry no image).

    Like the sounds mirror this never overwrites, so dropping your own
    icon.png in www/nida/brand/ replaces the shipped one.
    """
    src_root = Path(__file__).parent / "brand"
    dst_root = Path(hass.config.path("www")) / "nida" / "brand"

    def _do_copy() -> int:
        if not src_root.is_dir():
            return 0
        copied = 0
        for src_file in sorted(src_root.glob("*.png")):
            dst_file = dst_root / src_file.name
            if dst_file.exists():
                continue
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            copied += 1
        return copied

    try:
        copied = await hass.async_add_executor_job(_do_copy)
        if copied:
            _LOGGER.info("Nida: copied %d brand image(s) into %s", copied, dst_root)
    except Exception as err:  # noqa: BLE001
        # Never let a cosmetic asset break setup.
        _LOGGER.debug("Nida: could not copy brand images (%s)", err)

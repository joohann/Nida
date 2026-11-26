"""Nida helpers — bridge bundled sound files to Home Assistant's /local/ tree.

media_player.play_media can address local files via the /local/<path> URL,
which HA serves from <config>/www/<path>. Our sounds live inside the
integration package at custom_components/nida/sounds/, which is NOT served
by HA directly. So at setup we mirror them into <config>/www/nida/sounds/.

The copy is idempotent and won't clobber a file the user has already
placed at the destination path — that lets advanced users override a
shipped default by dropping their own file in www/nida/sounds/<rel>.

Changelog:
  2.5.4 (2026-11-12): async_copy_brand now refreshes a shipped brand image
                      that changed between versions instead of skipping any
                      existing file. A .nida_shipped.json fingerprint plus a
                      bootstrap set of former shipped hashes tells a stale
                      shipped copy (safe to refresh) from a real user
                      override (left untouched). Fixes the borderless
                      notification icon never reaching installs that still
                      had the previous one. async_brand_rev publishes
                      icon_notify-<rev>.png so the notify URL changes
                      whenever the icon does (phones cache by URL).
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


async def async_brand_rev(hass: HomeAssistant) -> str:
    """Publish a versioned copy of the notification icon (2.5.4).

    The icon URL used to be fixed, so the iOS/Android Companion app cached
    the image indefinitely and kept showing an old icon (e.g. the bordered
    2.4.5 one) after the file was replaced. The version therefore has to
    be part of the URL.

    It must be in the FILE NAME, not in a query string: the iOS app
    resolves a relative attachment URL with
    activeURL.appendingPathComponent(url), which percent-encodes "?" to
    "%3F". "icon_notify.png?v=x" then becomes a 404 and iOS silently drops
    the image. So this writes www/nida/brand/icon_notify-<rev>.png next to
    the plain file and removes stale versioned copies.

    <rev> is a short hash of the icon actually served from www/ (not the
    shipped source), so a custom icon the user placed there is versioned
    and shown as well. Must run after async_copy_brand. Returns "" when
    anything fails; callers then fall back to the plain, unversioned URL.
    """
    brand_dir = Path(hass.config.path("www")) / "nida" / "brand"
    base = brand_dir / "icon_notify.png"

    def _publish() -> str:
        import hashlib

        try:
            data = base.read_bytes()
            rev = hashlib.sha256(data).hexdigest()[:8]
            versioned = brand_dir / f"icon_notify-{rev}.png"
            if not versioned.exists() or versioned.read_bytes() != data:
                versioned.write_bytes(data)
            for old in brand_dir.glob("icon_notify-*.png"):
                if old != versioned:
                    old.unlink(missing_ok=True)
            return rev
        except Exception:  # noqa: BLE001 — cache-busting is best-effort
            return ""

    return await hass.async_add_executor_job(_publish)


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

    Unlike the sounds mirror, a *shipped* icon that changes between
    versions is refreshed in place (2.5.4): the old "never overwrite" rule
    meant an updated brand image never reached installs that already had
    the previous copy — e.g. the borderless notification icon in 2.5.4
    would never replace the bordered 2.3.15 one. A fingerprint sidecar
    (.nida_shipped.json, name -> sha256 of what Nida last wrote) keeps a
    genuine user override working: a destination whose bytes still match
    what Nida wrote is ours to update, while one the user has edited no
    longer matches and is left exactly as it is.
    """
    src_root = Path(__file__).parent / "brand"
    dst_root = Path(hass.config.path("www")) / "nida" / "brand"
    marker = dst_root / ".nida_shipped.json"

    def _do_copy() -> int:
        if not src_root.is_dir():
            return 0
        import hashlib
        import json

        def _sha(path: Path) -> str:
            return hashlib.sha256(path.read_bytes()).hexdigest()

        try:
            shipped = json.loads(marker.read_text()) if marker.exists() else {}
        except Exception:  # noqa: BLE001 — a corrupt marker must not block the copy
            shipped = {}

        # sha256 of every brand image Nida shipped BEFORE the marker existed
        # (pre-2.5.4). An existing destination that still matches one of
        # these is a stale shipped copy, not a user override, so it is safe
        # to refresh on the first 2.5.4 run even without a marker. The
        # marker takes over for every version after this one.
        KNOWN_SHIPPED = {
            # icon_notify.png — 2.4.5, then 2.4.9
            "899087e843616c5fd57510c2cdf57ef69f88965f5a9be3fafa52d2602321578a",
            "3c2101616fdd40d8eadf8dda0e144c2fb76a88e86c10621676e6a0d05f59d3a2",
            # icon.png — the two shipped revisions
            "aae7555bb6793ec2bd528180f6538efb9694e2433e53fe0f9dc342a45038a76a",
            "b43d74ffb201f6092000fab2ad5eade8292cc2839045cbc25f9d13f3a1ff217a",
        }

        copied = 0
        for src_file in sorted(src_root.glob("*.png")):
            dst_file = dst_root / src_file.name
            src_hash = _sha(src_file)
            if dst_file.exists():
                dst_hash = _sha(dst_file)
                if dst_hash == src_hash:
                    # Already current; just make sure we claim ownership so
                    # a later shipped change can refresh it.
                    shipped[src_file.name] = src_hash
                    continue
                # Differs from the shipped source: only overwrite when the
                # destination is a copy WE wrote — either the recorded
                # fingerprint or a known former shipped revision. Anything
                # else is a user override and is left exactly as it is.
                if (
                    dst_hash != shipped.get(src_file.name)
                    and dst_hash not in KNOWN_SHIPPED
                ):
                    continue
            dst_file.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src_file, dst_file)
            shipped[src_file.name] = src_hash
            copied += 1

        try:
            dst_root.mkdir(parents=True, exist_ok=True)
            marker.write_text(json.dumps(shipped))
        except Exception:  # noqa: BLE001 — the marker is best-effort
            pass
        return copied

    try:
        copied = await hass.async_add_executor_job(_do_copy)
        if copied:
            _LOGGER.info("Nida: copied %d brand image(s) into %s", copied, dst_root)
    except Exception as err:  # noqa: BLE001
        # Never let a cosmetic asset break setup.
        _LOGGER.debug("Nida: could not copy brand images (%s)", err)

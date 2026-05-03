"""Nida push notifications — verstuurt via notify.* services.

Ondersteunt:
  - Per-type enable/disable (notify_on_<type>)
  - Per-type targets (notify_target_<type>) met fallback naar notify_target
  - Per-type custom messages (notify_msg_<type>)
  - Per-type critical alerts (iOS/Android push priority)
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Mapping

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from .messages import DEFAULT_TITLE

_LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _is_enabled(options: Mapping[str, Any], notify_type: str) -> bool:
    """Of dit type notificatie aan staat.

    Default: 'prayer' staat aan, andere types staan uit (opt-in).
    """
    type_key = f"notify_on_{notify_type}"
    return bool(options.get(type_key, notify_type == "prayer"))


def _resolve_targets(
    options: Mapping[str, Any],
    entry: ConfigEntry,
    notify_type: str,
) -> list[str]:
    """Welke notify-services moeten gebruikt worden voor dit type.

    Volgorde: notify_target_<type> → notify_target → entry.data.notify_target
    """
    target_key = f"notify_target_{notify_type}"
    target = options.get(
        target_key,
        options.get("notify_target", entry.data.get("notify_target", "")),
    )
    if not target:
        return []
    if isinstance(target, list):
        return [str(t) for t in target if t]
    return [str(target)]


def _build_critical_payload(critical: bool) -> dict[str, Any]:
    """Build de extra 'data' payload voor critical iOS/Android alerts."""
    if not critical:
        return {}
    return {
        "data": {
            "push": {
                "sound": {
                    "name": "default",
                    "critical": 1,
                    "volume": 1.0,
                }
            },
            "ttl": 0,
            "priority": "high",
            "channel": "alarm_stream",
        }
    }


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
async def send_notification(
    hass: HomeAssistant,
    entry: ConfigEntry,
    message: str,
    title: str = DEFAULT_TITLE,
    notify_type: str = "prayer",
) -> None:
    """Stuur push notificatie via geconfigureerde notify services.

    Args:
        hass:        Home Assistant instance
        entry:       Config entry voor deze Nida-installatie
        message:     Default bericht (kan worden overschreven door
                     entry.options.notify_msg_<type>)
        title:       Default titel (kan worden overschreven door
                     entry.options.notify_title)
        notify_type: 'prayer' | 'pre_adhan' | 'tarhim' | 'suhoor'
    """
    options = entry.options if entry.options else entry.data

    if not _is_enabled(options, notify_type):
        return

    targets = _resolve_targets(options, entry, notify_type)
    if not targets:
        return

    # Resolve message + title + critical
    final_message = options.get(f"notify_msg_{notify_type}", message)
    final_title = options.get("notify_title", title)
    critical = bool(
        options.get(
            f"notify_critical_{notify_type}",
            options.get("notify_critical", False),
        )
    )

    extra = _build_critical_payload(critical)

    async def _send_one(target: str) -> None:
        if not target:
            return
        service = target.replace("notify.", "")
        data: dict[str, Any] = {
            "title": final_title,
            "message": final_message,
            **extra,
        }
        try:
            await hass.services.async_call("notify", service, data)
        except Exception as e:  # noqa: BLE001
            _LOGGER.warning("Could not send notification to %s: %s", target, e)

    # Parallel verzenden zodat één traag/falend doel de rest niet blokkeert.
    # return_exceptions=True voorkomt dat één opgegooide exception (b.v.
    # vóór het try/except hierboven) de gather afbreekt.
    await asyncio.gather(
        *(_send_one(t) for t in targets),
        return_exceptions=True,
    )

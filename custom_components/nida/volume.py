"""Nida volume berekeningen — basis-, nacht- en open-override.

Volgorde van overrides (later wint):
  1. base_volume          — het ingestelde volume voor het gebed
  2. night_volume         — als 'nacht' (na night_start_hour of voor 06:00)
  3. open_volume          — als de open_sensors_group 'on' staat

Open-override vereist een hass-instance. Zonder hass wordt alleen night-override
toegepast (backwards compatible met de oude _get_volume signatuur).
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Mapping

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


def _normalize(raw: Any, fallback: float = 0.5) -> float:
    """Normaliseer een volume-waarde naar 0.0 – 1.0 float.

    Accepteert percentages (0–100) of fracties (0–1). Onleesbaar → fallback.
    """
    try:
        val = float(raw)
    except (TypeError, ValueError):
        return fallback
    if val > 1:
        val = val / 100
    return max(0.0, min(1.0, val))


def _is_night(options: Mapping[str, Any], now: datetime | None = None) -> bool:
    """True als nu binnen het nacht-venster valt."""
    if not options.get("night_volume_enabled", False):
        return False
    night_start = int(options.get("night_start_hour", 22))
    current_hour = (now or datetime.now()).hour
    return current_hour >= night_start or current_hour < 6


def _is_house_open(hass: HomeAssistant | None, options: Mapping[str, Any]) -> bool:
    """True als de geconfigureerde open-sensors-groep 'on' staat."""
    if hass is None:
        return False
    if not options.get("open_volume_enabled", False):
        return False
    sensor_id = options.get("open_sensors_group", "")
    if not sensor_id:
        return False
    state = hass.states.get(sensor_id)
    if state is None:
        return False
    # Accepteer 'on' (binary_sensor / group) of 'open' (cover-achtige entities)
    return state.state in ("on", "open")


def get_volume(
    options: Mapping[str, Any],
    base_vol_key: str,
    base_default: Any,
    hass: HomeAssistant | None = None,
) -> float:
    """Bepaal het effectieve volume voor een afspeel-actie (0.0 – 1.0).

    Args:
        options:        entry.options (of merged dict)
        base_vol_key:   key voor basis-volume, bv. "fajr_volume" / "tarhim_volume"
        base_default:   default als key ontbreekt (mag int 0-100 of float 0-1 zijn)
        hass:           HomeAssistant — vereist voor open-windows override.
                        Zonder hass werkt alleen de nacht-override (backwards
                        compatible met oude callers).
    """
    # 1. Basisvolume
    volume = _normalize(options.get(base_vol_key, base_default))
    src = "base"

    # 2. Nacht-override
    if _is_night(options):
        volume = _normalize(options.get("night_volume", 10))
        src = "night"

    # 3. Open ramen/deuren override (overrulet alles)
    if _is_house_open(hass, options):
        volume = _normalize(options.get("open_volume", 30))
        src = "open"

    if src != "base":
        _LOGGER.debug("Volume override actief: %s → %.0f%%", src, volume * 100)

    return round(volume, 2)

"""Nida configuration — single source of truth.

NidaConfig wraps de ConfigEntry data + options en biedt:
  - Type-safe access tot bekende settings
  - Een .raw fallback voor alle overige settings (.get())
  - Helpers voor de Nida-app (to_dict / from_dict voor REST API)

Alle modules in deze integration horen NidaConfig te gebruiken
in plaats van direct entry.options of entry.data te lezen.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from homeassistant.config_entries import ConfigEntry

from .const import (
    CONF_CITY,
    CONF_COUNTRY,
    CONF_METHOD,
    CONF_PLAY_METHOD,
    CONF_FAJR_SPEAKER,
    CONF_FAJR_VOLUME,
    CONF_FAJR_SOUND,
    CONF_DAY_SPEAKER,
    CONF_DAY_VOLUME,
    CONF_DAY_SOUND,
    CONF_TARHIM_ENABLED,
    CONF_TARHIM_SPEAKER,
    CONF_TARHIM_VOLUME,
    CONF_TARHIM_SOUND,
)


def _as_list(value: Any) -> list[str]:
    """Normaliseer een speaker-veld (str of list) naar een list."""
    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return [str(v) for v in value if v]
    return []


@dataclass(frozen=True)
class NidaConfig:
    """Geünificeerde Nida-configuratie."""

    # Locatie
    city: str = "Amsterdam"
    country: str = "Netherlands"
    method: int = 3

    # Play method
    play_method: str = "media_player"

    # Fajr
    fajr_speakers: list[str] = field(default_factory=list)
    fajr_volume: int = 20
    fajr_sound: str = ""

    # Day adhan
    day_speakers: list[str] = field(default_factory=list)
    day_volume: int = 50
    day_sound: str = ""

    # Jumat (vrijdag)
    jumat_speakers: list[str] = field(default_factory=list)
    jumat_volume: int | None = None
    jumat_sound: str = ""

    # Tarhim
    tarhim_enabled: bool = True
    tarhim_speakers: list[str] = field(default_factory=list)
    tarhim_volume: int = 10
    tarhim_sound: str = ""

    # Suhoor
    suhoor_enabled: bool = True
    suhoor_speakers: list[str] = field(default_factory=list)
    suhoor_volume: int = 50
    suhoor_sound: str = ""
    suhoor_minutes: int = 30
    suhoor_scene: str = ""

    # Night volume override
    night_volume_enabled: bool = False
    night_start_hour: int = 22
    night_volume: int = 10

    # Open ramen/deuren override (volume daalt als de groep open is)
    open_volume_enabled: bool = False
    open_sensors_group: str = ""  # entity_id van binary_sensor / group
    open_volume: int = 30

    # Adhan restore
    adhan_restore_delay: float = 300.0

    # Raw merged dict — fallback voor alle settings die nog niet typed zijn
    # (reminders, notifications, en alle nieuwe velden tijdens refactor)
    raw: dict[str, Any] = field(default_factory=dict)

    # ------------------------------------------------------------------
    # Constructors
    # ------------------------------------------------------------------
    @classmethod
    def from_entry(cls, entry: ConfigEntry) -> "NidaConfig":
        """Bouw config vanuit een Home Assistant ConfigEntry.

        entry.options heeft voorrang op entry.data (options = user changes
        na initial setup).
        """
        merged: dict[str, Any] = {**dict(entry.data), **dict(entry.options or {})}
        return cls.from_dict(merged)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "NidaConfig":
        """Bouw config vanuit een platte dict (entry of API import)."""
        return cls(
            # Locatie
            city=str(data.get(CONF_CITY, "Amsterdam")),
            country=str(data.get(CONF_COUNTRY, "Netherlands")),
            method=int(data.get(CONF_METHOD, 3)),
            # Play
            play_method=str(data.get(CONF_PLAY_METHOD, "media_player")),
            # Fajr
            fajr_speakers=_as_list(data.get(CONF_FAJR_SPEAKER)),
            fajr_volume=int(data.get(CONF_FAJR_VOLUME, 20)),
            fajr_sound=str(data.get(CONF_FAJR_SOUND, "")),
            # Day
            day_speakers=_as_list(data.get(CONF_DAY_SPEAKER)),
            day_volume=int(data.get(CONF_DAY_VOLUME, 50)),
            day_sound=str(data.get(CONF_DAY_SOUND, "")),
            # Jumat
            jumat_speakers=_as_list(data.get("jumat_speaker")),
            jumat_volume=(
                int(data["jumat_volume"]) if "jumat_volume" in data and data["jumat_volume"] is not None else None
            ),
            jumat_sound=str(data.get("jumat_sound", "")),
            # Tarhim
            tarhim_enabled=bool(data.get(CONF_TARHIM_ENABLED, True)),
            tarhim_speakers=_as_list(data.get(CONF_TARHIM_SPEAKER)),
            tarhim_volume=int(data.get(CONF_TARHIM_VOLUME, 10)),
            tarhim_sound=str(data.get(CONF_TARHIM_SOUND, "")),
            # Suhoor
            suhoor_enabled=bool(data.get("suhoor_enabled", True)),
            suhoor_speakers=_as_list(data.get("suhoor_speaker")),
            suhoor_volume=int(data.get("suhoor_volume", 50)),
            suhoor_sound=str(data.get("suhoor_sound", "")),
            suhoor_minutes=int(data.get("suhoor_minutes", 30)),
            suhoor_scene=str(data.get("suhoor_scene", "")),
            # Night
            night_volume_enabled=bool(data.get("night_volume_enabled", False)),
            night_start_hour=int(data.get("night_start_hour", 22)),
            night_volume=int(data.get("night_volume", 10)),
            # Open ramen/deuren
            open_volume_enabled=bool(data.get("open_volume_enabled", False)),
            open_sensors_group=str(data.get("open_sensors_group", "")),
            open_volume=int(data.get("open_volume", 30)),
            # Adhan restore
            adhan_restore_delay=float(data.get("adhan_restore_delay", 300.0)),
            # Raw fallback
            raw=dict(data),
        )

    # ------------------------------------------------------------------
    # Convenience accessors
    # ------------------------------------------------------------------
    def get(self, key: str, default: Any = None) -> Any:
        """Lees een willekeurige setting — fallback op raw dict."""
        return self.raw.get(key, default)

    def speakers_for(self, prayer: str) -> list[str]:
        """Geef de juiste speakers terug voor een gebed.

        Fallback: jumat → day, anders → eigen veld → day.
        """
        prayer = prayer.lower()
        if prayer == "fajr":
            return self.fajr_speakers or self.day_speakers
        if prayer == "jumat":
            return self.jumat_speakers or self.day_speakers
        return self.day_speakers

    def to_dict(self) -> dict[str, Any]:
        """Exporteer als platte dict — voor REST API / Nida-app sync.

        Levert dezelfde key-namen als entry.options gebruikt, zodat
        from_dict(c.to_dict()) round-trip veilig is.
        """
        return dict(self.raw)

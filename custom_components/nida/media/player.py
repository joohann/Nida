"""Nida media player utilities.

Bevat:
  - URL helpers (get_media_url, get_logo_url)
  - Snapshot / restore voor speakers (Sonos-aware met fallback)
  - play_media_with_volume() — bestaande gedrag, volume save+restore
  - play_with_pause_resume() — nieuwe flow: pauze muziek/film vóór adhan,
    speel adhan, hervat erna
"""
from __future__ import annotations

import asyncio
import logging
import socket
from typing import Any

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# URL helpers
# ---------------------------------------------------------------------------
async def get_media_url(hass: HomeAssistant, local_path: str) -> str:
    """Converteer lokaal pad (`/local/...`) naar een absolute URL.

    Music Assistant en sommige speakers vereisen volledige URL's i.p.v.
    relatieve paden; vandaar deze wrapper.
    """
    base_url = hass.config.internal_url or hass.config.external_url
    if not base_url:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
        except Exception:  # noqa: BLE001
            ip = "127.0.0.1"
        base_url = f"http://{ip}:8123"
    base_url = base_url.rstrip("/")
    return f"{base_url}{local_path}"


def get_logo_url(hass: HomeAssistant) -> str:
    """URL van het Nida logo voor cover art op speakers."""
    base_url = hass.config.internal_url or hass.config.external_url or ""
    base_url = base_url.rstrip("/")
    return f"{base_url}/local/nida/logo.png"


# ---------------------------------------------------------------------------
# Snapshot / restore — Sonos-aware met generieke fallback
# ---------------------------------------------------------------------------
def _looks_like_sonos(state) -> bool:
    """Heuristische detectie of een media_player een Sonos is.

    Sonos-entities hebben karakteristieke attributen die andere
    media_player-platforms doorgaans niet hebben.
    """
    if state is None:
        return False
    attrs = state.attributes
    # 'queue_size' / 'shuffle' zijn Sonos-specifiek; 'media_album_name' komt
    # vaker voor maar in combinatie met source-list inhoud is het sterk genoeg
    if "queue_size" in attrs:
        return True
    sources = attrs.get("source_list") or []
    if "TV" in sources or "Line-in" in sources:
        return True
    return False


async def snapshot_speakers(
    hass: HomeAssistant,
    speakers: list[str],
) -> dict[str, Any]:
    """Maak een snapshot van speakers vóór een adhan/reminder.

    Voor Sonos-speakers wordt sonos.snapshot gebruikt (volume + queue + state).
    Voor alle andere wordt state + volume + media_content_id bewaard.
    """
    snapshot: dict[str, Any] = {"sonos": [], "generic": {}}
    sonos_available = hass.services.has_service("sonos", "snapshot")

    for speaker in speakers:
        state = hass.states.get(speaker)
        if state is None:
            continue
        if sonos_available and _looks_like_sonos(state):
            snapshot["sonos"].append(speaker)
        else:
            snapshot["generic"][speaker] = {
                "state": state.state,
                "volume": state.attributes.get("volume_level"),
                "media_content_id": state.attributes.get("media_content_id"),
                "media_content_type": state.attributes.get("media_content_type"),
                "source": state.attributes.get("source"),
            }

    if snapshot["sonos"]:
        try:
            await hass.services.async_call(
                "sonos",
                "snapshot",
                {"entity_id": snapshot["sonos"], "with_group": True},
                blocking=True,
            )
            _LOGGER.debug("Sonos snapshot: %s", snapshot["sonos"])
        except Exception as e:  # noqa: BLE001
            _LOGGER.warning(
                "Sonos snapshot mislukt (%s) — fallback naar generic snapshot",
                e,
            )
            for sp in snapshot["sonos"]:
                state = hass.states.get(sp)
                if state:
                    snapshot["generic"][sp] = {
                        "state": state.state,
                        "volume": state.attributes.get("volume_level"),
                    }
            snapshot["sonos"] = []

    return snapshot


async def pause_speakers(hass: HomeAssistant, speakers: list[str]) -> None:
    """Pauzeer speakers die op dit moment afspelen.

    Gebruikt voor de pauze-vóór-adhan flow. Spelers die al gepauzeerd of
    idle zijn worden overgeslagen om geen unwanted state-changes te triggeren.
    """
    to_pause = []
    for speaker in speakers:
        state = hass.states.get(speaker)
        if state and state.state == "playing":
            to_pause.append(speaker)
    if not to_pause:
        return
    try:
        await hass.services.async_call(
            "media_player",
            "media_pause",
            {"entity_id": to_pause},
            blocking=False,
        )
        _LOGGER.debug("Gepauzeerd vóór adhan: %s", to_pause)
    except Exception as e:  # noqa: BLE001
        _LOGGER.debug("Pause mislukt voor %s: %s", to_pause, e)


async def restore_speakers(
    hass: HomeAssistant,
    snapshot: dict[str, Any],
) -> None:
    """Herstel speakers naar de state van vóór de adhan/reminder."""
    # Sonos: één call doet alles (queue + volume + position)
    if snapshot.get("sonos"):
        try:
            await hass.services.async_call(
                "sonos",
                "restore",
                {"entity_id": snapshot["sonos"], "with_group": True},
                blocking=False,
            )
            _LOGGER.debug("Sonos restore: %s", snapshot["sonos"])
        except Exception as e:  # noqa: BLE001
            _LOGGER.debug("Sonos restore mislukt: %s", e)

    # Generic: volume terug + speel hervatten als was-playing
    for speaker, info in snapshot.get("generic", {}).items():
        try:
            if info.get("volume") is not None:
                await hass.services.async_call(
                    "media_player",
                    "volume_set",
                    {"entity_id": speaker, "volume_level": info["volume"]},
                    blocking=False,
                )
            if info.get("state") == "playing":
                await hass.services.async_call(
                    "media_player",
                    "media_play",
                    {"entity_id": speaker},
                    blocking=False,
                )
        except Exception as e:  # noqa: BLE001
            _LOGGER.debug("Generic restore mislukt voor %s: %s", speaker, e)


# ---------------------------------------------------------------------------
# Afspelen
# ---------------------------------------------------------------------------
async def play_media_with_volume(
    hass: HomeAssistant,
    speakers: list[str],
    media_url: str,
    volume: float,
    cover_url: str | None = None,
    restore_delay: float = 300.0,
) -> None:
    """Speel media af met volume-handling (oude gedrag — backwards compat).

    Bewaart originele volumes, zet doel-volume, speelt af, en zet na
    restore_delay seconden de volumes terug. Geen pauze/resume van content.
    """
    original_volumes: dict[str, float | None] = {}
    for speaker in speakers:
        state = hass.states.get(speaker)
        if state:
            vol = state.attributes.get("volume_level")
            original_volumes[speaker] = float(vol) if vol is not None else None
        else:
            original_volumes[speaker] = None

    try:
        await hass.services.async_call(
            "media_player",
            "volume_set",
            {"entity_id": speakers, "volume_level": volume},
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Volume set mislukt: %s", e)

    await asyncio.sleep(0.5)

    extra: dict = {}
    if cover_url:
        extra["thumbnail"] = cover_url
        extra["media_image_url"] = cover_url

    try:
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": speakers,
                "media_content_id": media_url,
                "media_content_type": "music",
                **({"extra": extra} if extra else {}),
            },
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.error("Afspelen mislukt: %s", e)
        return

    async def _restore() -> None:
        await asyncio.sleep(restore_delay)
        for speaker, orig_vol in original_volumes.items():
            if orig_vol is not None:
                try:
                    await hass.services.async_call(
                        "media_player",
                        "volume_set",
                        {"entity_id": speaker, "volume_level": orig_vol},
                    )
                except Exception as e:  # noqa: BLE001
                    _LOGGER.debug("Volume restore mislukt voor %s: %s", speaker, e)

    hass.async_create_task(_restore())


async def play_with_pause_resume(
    hass: HomeAssistant,
    speakers: list[str],
    media_url: str,
    volume: float,
    duration: float,
    *,
    cover_url: str | None = None,
    extra_pause_entities: list[str] | None = None,
    pre_play_delay: float = 0.5,
    post_play_buffer: float = 5.0,
) -> None:
    """Speel adhan/reminder af met snapshot + pauze + resume flow.

    Stappen:
      1. Snapshot van alle speakers (Sonos-aware)
      2. Pauzeer afspelende speakers + extra_pause_entities (bv. een TV)
      3. Set volume → korte delay
      4. Speel media af
      5. Wacht (duration + post_play_buffer) seconden
      6. Restore speakers (Sonos restore of volume + media_play)

    Args:
        speakers:               Speakers waarop afgespeeld wordt
        media_url:              Volledige URL naar het MP3 bestand
        volume:                 Doel-volume (0.0 – 1.0)
        duration:               Geschatte duur van het MP3 in seconden
        cover_url:              Optioneel — cover art URL
        extra_pause_entities:   Extra entities om te pauzeren maar NIET op af
                                te spelen (bv. een TV in de woonkamer)
        pre_play_delay:         Wachttijd na volume-set vóór play (default 0.5s)
        post_play_buffer:       Extra seconden na duur vóór restore (default 5s)
    """
    # 1. Snapshot
    snapshot = await snapshot_speakers(hass, speakers)

    # 2. Pauzeer afspelende content
    all_to_pause = list(speakers)
    if extra_pause_entities:
        all_to_pause.extend(extra_pause_entities)
    await pause_speakers(hass, all_to_pause)

    # 3. Set volume
    try:
        await hass.services.async_call(
            "media_player",
            "volume_set",
            {"entity_id": speakers, "volume_level": volume},
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Volume set mislukt: %s", e)

    await asyncio.sleep(pre_play_delay)

    # 4. Play
    extra: dict = {}
    if cover_url:
        extra["thumbnail"] = cover_url
        extra["media_image_url"] = cover_url

    try:
        await hass.services.async_call(
            "media_player",
            "play_media",
            {
                "entity_id": speakers,
                "media_content_id": media_url,
                "media_content_type": "music",
                **({"extra": extra} if extra else {}),
            },
        )
    except Exception as e:  # noqa: BLE001
        _LOGGER.error("Afspelen mislukt: %s", e)
        await restore_speakers(hass, snapshot)
        return

    # 5+6. Wacht & restore (in achtergrond zodat caller verder kan)
    async def _delayed_restore() -> None:
        await asyncio.sleep(duration + post_play_buffer)
        await restore_speakers(hass, snapshot)
        # Hervat eventuele extra entities (TV) ook
        if extra_pause_entities:
            for ent in extra_pause_entities:
                state = hass.states.get(ent)
                # Alleen hervatten als hij paused is (niet als idle/off)
                if state and state.state == "paused":
                    try:
                        await hass.services.async_call(
                            "media_player",
                            "media_play",
                            {"entity_id": ent},
                            blocking=False,
                        )
                    except Exception as e:  # noqa: BLE001
                        _LOGGER.debug("Hervatten van %s mislukt: %s", ent, e)

    hass.async_create_task(_delayed_restore())

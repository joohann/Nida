"""Audio utilities — pure Python MP3 duration parser.

Heeft geen externe libraries nodig. Leest Xing/Info VBR header
indien aanwezig, anders schatting via filesize/bitrate.
"""
from __future__ import annotations

import logging
import os
import struct

from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

_BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
_SAMPLERATES = [44100, 48000, 32000]


def get_mp3_duration(path: str) -> float:
    """Lees MP3-duur in seconden (synchroon — call via executor).

    Returnt 0.0 bij fout of onbekend formaat.
    """
    try:
        with open(path, "rb") as f:
            data = f.read()

        offset = 0
        if data[:3] == b"ID3":
            size = (
                (data[6] & 0x7F) << 21
                | (data[7] & 0x7F) << 14
                | (data[8] & 0x7F) << 7
                | (data[9] & 0x7F)
            )
            offset = size + 10

        for i in range(offset, min(offset + 10000, len(data) - 4)):
            if data[i] != 0xFF or (data[i + 1] & 0xE0) != 0xE0:
                continue
            b2 = data[i + 2]
            bitrate_idx = (b2 >> 4) & 0xF
            samplerate_idx = (b2 >> 2) & 0x3
            if bitrate_idx in (0, 15) or samplerate_idx >= len(_SAMPLERATES):
                continue

            bitrate = _BITRATES[bitrate_idx] * 1000
            samplerate = _SAMPLERATES[samplerate_idx]

            # Xing/Info VBR header heeft exacte frame count
            xing_off = i + 36
            if len(data) > xing_off + 12 and data[xing_off : xing_off + 4] in (b"Xing", b"Info"):
                flags = struct.unpack(">I", data[xing_off + 4 : xing_off + 8])[0]
                if flags & 0x1:
                    frames = struct.unpack(">I", data[xing_off + 8 : xing_off + 12])[0]
                    return round(frames * 1152 / samplerate, 1)

            # CBR fallback — schatting via filesize
            frame_size = 144 * bitrate // samplerate
            total_frames = (len(data) - i) // frame_size if frame_size else 0
            return round(total_frames * 1152 / samplerate, 1)

    except Exception as e:  # noqa: BLE001
        _LOGGER.warning("Kon MP3 duur niet lezen van %s: %s", path, e)

    return 0.0


async def async_get_mp3_duration(hass: HomeAssistant, path: str) -> float:
    """Async wrapper — leest MP3-duur via executor (non-blocking)."""
    return await hass.async_add_executor_job(get_mp3_duration, path)


async def async_get_sound_duration(hass: HomeAssistant, sound_filename: str) -> float:
    """Lees duur van een sound bestand in /config/www/nida/sounds/."""
    if not sound_filename:
        return 0.0
    sounds_path = hass.config.path("www/nida/sounds")
    mp3_path = os.path.join(sounds_path, sound_filename)
    return await async_get_mp3_duration(hass, mp3_path)

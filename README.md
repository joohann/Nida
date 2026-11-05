<div align="center">

<img src="https://raw.githubusercontent.com/joohann/Nida/main/custom_components/nida/brand/icon.png" width="120" alt="Nida icon">

# Nida — نداء

**Islamic prayer times, adhan and reminders for Home Assistant.**

[![Marketplace](https://img.shields.io/badge/Home%20Assistant-Marketplace-41BDF5.svg)](https://www.hacs.xyz/docs/marketplace/)
[![Release](https://img.shields.io/github/v/release/joohann/Nida)](https://github.com/joohann/Nida/releases)
[![Hassfest](https://github.com/joohann/Nida/actions/workflows/hassfest.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/hassfest.yml)
[![Validate](https://github.com/joohann/Nida/actions/workflows/validate.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.md) · [Nederlands](README.nl.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md)

</div>

*Nida* means "the call". The integration fetches prayer times from the free
[AlAdhan API](https://aladhan.com/prayer-times-api) (no account or API key),
plays the adhan on your speakers at the right moment, warns you shortly before,
and gives you a settings panel and dashboard cards that match your theme.

## Features

| | |
|---|---|
| **Prayer times** | Imsak, Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha and Midnight, with 15+ calculation methods |
| **Adhan** | Per prayer on/off, own sound and volume, on one or more media players |
| **Pre-adhan** | Jingle and a spoken (TTS) announcement before the prayer, with its own volume for Fajr |
| **Night mode** | Lowers the volume of the adhan, jingle and announcement between set hours |
| **Open-contact volume** | Lower volume when a window or door sensor is open |
| **Music friendly** | Dips or pauses your music, fades it back in and restores playback afterwards; Sonos announcements supported |
| **Ramadan** | Suhoor and iftar reminders, iftar dua, Tarhim, Fajr wake-up alarm with a scene |
| **Notifications** | Push per prayer, Jumu'ah reminder, Hijri calendar events, iOS Live Activity countdown |
| **Duas** | Play a dua on a trigger of your own, or from a button entity |
| **Sound library** | A few sounds ship with Nida, the rest is downloaded on demand from a catalog |
| **Dashboard cards** | Next prayer and Today cards with live countdown, light and dark |
| **10 languages** | English, Dutch, Arabic, Turkish, German, French, Malay, Indonesian, Urdu, Persian |

## Installation

### Marketplace

Nida is being submitted to the Home Assistant Marketplace (HACS, built in from
Home Assistant 2026.11). Once it is listed:

1. Open the **Marketplace** in Home Assistant and search for **Nida**.
2. Download it and restart Home Assistant.

Until then, or on an older Home Assistant with HACS installed, add it as a
custom repository: **HACS → ⋮ → Custom repositories**, URL
`https://github.com/joohann/Nida`, category **Integration**.

### Manual

Copy `custom_components/nida` into your Home Assistant `config/custom_components/`
folder and restart.

## Setup

1. Go to **Settings → Devices & services → Add integration → Nida**.
2. Confirm. Nida is added in one click.
3. Open **Nida** in the sidebar. All other settings live in this panel:
   prayers, sounds, speakers, pre-adhan, night mode, notifications, Ramadan
   and more.

No YAML is needed. Settings are stored in the integration's options.

## Entities

| Entity | Description |
|---|---|
| `sensor.nida_fajr`, `…_dhuhr`, `…_asr`, `…_maghrib`, `…_isha`, `…_sunrise`, … | Time of each prayer (timestamp) |
| `sensor.nida_imsak` | Imsak |
| `sensor.nida_next_prayer` | The next prayer and its time |
| `sensor.nida_hijri_*` | Hijri date, day, month and year |
| `binary_sensor.nida_<prayer>_active` | On while you are inside that prayer's window |
| `switch.nida_<prayer>_adhan` | Turn the adhan for one prayer on or off |
| `button.nida_dua_*` | Play a dua |

Exact entity IDs depend on your device name; check **Settings → Devices & services → Nida**.

## Dashboard cards

The cards are registered automatically; there is nothing to add under Resources.
Pick **Nida** in the card picker, or use YAML:

```yaml
type: custom:nida-card
card_type: now        # now, today, kids, scene_now, scene_today
```

| Option | Description |
|---|---|
| `card_type` | `now` (next prayer), `today` (all prayers), `kids`, `scene_now`, `scene_today` |
| `collapsed` | `today` card only: start folded down to the next prayer |
| `grid_options.rows` | In a Sections view the card fills the given height |

## Requirements

- Home Assistant 2023.1 or newer
- One or more `media_player` entities for the adhan
- A TTS integration if you want the spoken announcement
- The Home Assistant Companion app for push notifications and the Live Activity

## Documentation and support

- [Changelog](CHANGELOG.md)
- [Issues](https://github.com/joohann/Nida/issues): bugs and feature requests
- Prayer data by [AlAdhan](https://aladhan.com)

Pull requests are welcome, including new sounds and translations.

---

<div align="center">

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ*
Made with care for the Muslim community.

</div>

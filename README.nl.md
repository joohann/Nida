<div align="center">

<img src="https://raw.githubusercontent.com/joohann/Nida/main/custom_components/nida/brand/icon.png" width="120" alt="Nida icon">

# Nida — نداء

**Islamitische gebedstijden, adhan en herinneringen voor Home Assistant.**

[![Marketplace](https://img.shields.io/badge/Home%20Assistant-Marketplace-41BDF5.svg)](https://www.hacs.xyz/docs/marketplace/)
[![Release](https://img.shields.io/github/v/release/joohann/Nida)](https://github.com/joohann/Nida/releases)
[![Hassfest](https://github.com/joohann/Nida/actions/workflows/hassfest.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/hassfest.yml)
[![Validate](https://github.com/joohann/Nida/actions/workflows/validate.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.md) · [Nederlands](README.nl.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md)

</div>

*Nida* betekent "de roep". De integratie haalt gebedstijden op bij de gratis
[AlAdhan API](https://aladhan.com/prayer-times-api) (geen account of API-sleutel),
speelt op het juiste moment de adhan af op je speakers, waarschuwt je kort van
tevoren en geeft je een instellingenpaneel en dashboardkaarten die bij je thema passen.

## Functies

| | |
|---|---|
| **Gebedstijden** | Imsak, Fajr, zonsopkomst, Dhuhr, Asr, zonsondergang, Maghrib, Isha en middernacht, met 15+ berekeningsmethodes |
| **Adhan** | Per gebed aan/uit, eigen geluid en volume, op één of meer mediaspelers |
| **Pre-adhan** | Jingle en een gesproken (TTS) aankondiging vóór het gebed, met een eigen volume voor Fajr |
| **Nachtmodus** | Verlaagt het volume van adhan, jingle en aankondiging tussen ingestelde uren |
| **Volume bij open contact** | Lager volume als een raam- of deursensor open staat |
| **Muziekvriendelijk** | Dempt of pauzeert je muziek, laat hem weer inlopen en herstelt het afspelen daarna; Sonos-aankondigingen worden ondersteund |
| **Ramadan** | Suhoor- en iftarherinneringen, iftar-dua, Tarhim, Fajr-wekker met een scène |
| **Meldingen** | Push per gebed, Jumu'ah-herinnering, Hijri-agenda-items, iOS Live Activity met aftelling |
| **Dua's** | Speel een dua af op een eigen trigger, of via een knop-entiteit |
| **Geluidsbibliotheek** | Een paar geluiden zitten in Nida, de rest wordt op aanvraag uit een catalogus gedownload |
| **Dashboardkaarten** | Kaarten Volgend gebed en Vandaag met live aftelling, licht en donker |
| **10 talen** | Engels, Nederlands, Arabisch, Turks, Duits, Frans, Maleis, Indonesisch, Urdu, Perzisch |

## Installatie

### Marketplace

Nida wordt aangemeld bij de Home Assistant Marketplace (HACS, ingebouwd vanaf
Home Assistant 2026.11). Zodra het vermeld staat:

1. Open de **Marketplace** in Home Assistant en zoek naar **Nida**.
2. Download het en herstart Home Assistant.

Tot die tijd, of op een oudere Home Assistant met HACS, voeg je het toe als
aangepaste repository: **HACS → ⋮ → Aangepaste repositories**, URL
`https://github.com/joohann/Nida`, categorie **Integratie**.

### Handmatig

Kopieer `custom_components/nida` naar de map `config/custom_components/` van
Home Assistant en herstart.

## Instellen

1. Ga naar **Instellingen → Apparaten & diensten → Integratie toevoegen → Nida**.
2. Bevestig. Nida is met één klik toegevoegd.
3. Open **Nida** in de zijbalk. Alle andere instellingen staan in dit paneel:
   gebeden, geluiden, speakers, pre-adhan, nachtmodus, meldingen, Ramadan
   en meer.

YAML is niet nodig. Instellingen worden bewaard in de opties van de integratie.

## Entiteiten

| Entiteit | Beschrijving |
|---|---|
| `sensor.nida_fajr`, `…_dhuhr`, `…_asr`, `…_maghrib`, `…_isha`, `…_sunrise`, … | Tijd van elk gebed (timestamp) |
| `sensor.nida_imsak` | Imsak |
| `sensor.nida_next_prayer` | Het volgende gebed en de tijd ervan |
| `sensor.nida_hijri_*` | Hijri-datum, dag, maand en jaar |
| `binary_sensor.nida_<prayer>_active` | Aan zolang je binnen het tijdvak van dat gebed zit |
| `switch.nida_<prayer>_adhan` | Zet de adhan voor één gebed aan of uit |
| `button.nida_dua_*` | Speel een dua af |

De exacte entiteit-ID's hangen af van de naam van je apparaat; kijk bij **Instellingen → Apparaten & diensten → Nida**.

## Dashboardkaarten

De kaarten worden automatisch geregistreerd; je hoeft niets toe te voegen onder Bronnen.
Kies **Nida** in de kaartkiezer, of gebruik YAML:

```yaml
type: custom:nida-card
card_type: now        # now, today, kids, scene_now, scene_today
```

| Optie | Beschrijving |
|---|---|
| `card_type` | `now` (volgend gebed), `today` (alle gebeden), `kids`, `scene_now`, `scene_today` |
| `collapsed` | Alleen kaart `today`: begin ingeklapt tot het volgende gebed |
| `grid_options.rows` | In een Sections-weergave vult de kaart de opgegeven hoogte |

## Vereisten

- Home Assistant 2024.11 of nieuwer
- Een of meer `media_player`-entiteiten voor de adhan
- Een TTS-integratie als je de gesproken aankondiging wilt
- De Home Assistant Companion-app voor pushmeldingen en de Live Activity

## Documentatie en ondersteuning

- [Changelog](CHANGELOG.md)
- [Issues](https://github.com/joohann/Nida/issues): bugs en functieverzoeken
- Gebedsdata van [AlAdhan](https://aladhan.com)

Pull requests zijn welkom, ook voor nieuwe geluiden en vertalingen.

---

<div align="center">

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ*
Met zorg gemaakt voor de moslimgemeenschap.

</div>

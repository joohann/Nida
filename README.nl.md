# 🕌 Nida — Islamitische Gebedstijden voor Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![HA Version](https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue)](https://home-assistant.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<img src="https://raw.githubusercontent.com/joohann/Nida/main/brand/icon.png" width="200">

*Assalāmu ʿAlaykum wa Raḥmatullāhi wa Barakātuh*  — Iftikhar Farzan Izz Al Din Muhsin

**Nida** (نداء) betekent *“de oproep”* — een complete en veelzijdige Home Assistant integratie voor islamitische gebedstijden, met automatische adhan, herinneringen vóór de adhan, speciale Ramadan-functies en een stijlvolle dashboardkaart.

De gebedstijden worden opgehaald via de gratis [AlAdhan API](https://aladhan.com/prayer-times-api) — zonder account of API-sleutel. Moge Allah degenen belonen die dit mogelijk hebben gemaakt. 🤲

🌍 🇬🇧 🇳🇱 🇩🇪 🇫🇷 🇮🇩 🇲🇾 🇸🇦 🇮🇷 🇵🇰

---

## ✨ Functionaliteiten

- 🕐 **Gebedstijden** — Imsak, Fajr, Zonsopgang, Dhuhr, Asr, Zonsondergang, Maghrib, Isha en Middernacht  
- 📅 **Hijri Kalender** — datum, dag, maand, jaar en islamitische feestdagen  
- 🔊 **Automatische Adhan** — wordt afgespeeld via elke media_player  
- 🔔 **Herinneringen vóór de Adhan** — tot 2 herinneringen met geluid en/of TTS  
- 🌙 **Ramadan Functies** — Tarhim vóór Fajr en Suhoor-alarm  
- 🌙 **Nachtvolume** — automatisch lager volume na een ingesteld tijdstip  
- 📱 **Pushmeldingen** — ontvang een melding bij elke gebedstijd  
- ⏭️ **Volgend Gebed Sensor** — toont welk gebed eraan komt  
- 🎵 **Preview Services** — test adhans en tarhim direct vanuit de interface  
- 📊 **Dashboardkaart** — mooie kaart met live afteltimer  
- 🌍 **15+ Rekenmethodes** — o.a. Muslim World League, ISNA en Karachi  
- 🗣️ **Meertalige ondersteuning**

<img width="6180" height="3000" alt="Image" src="https://github.com/user-attachments/assets/9886d410-56f3-4f5c-b3ad-3cab861d6721" />

<img width="6180" height="3000" alt="Image" src="https://github.com/user-attachments/assets/bf29dd2d-da6c-422a-88e7-8986225035a8" />

---

## 📦 Installatie via HACS

1. Ga naar **HACS → Integraties → ⋮ → Custom Repositories**
2. Voeg toe: `https://github.com/joohann/Nida`
3. Kies categorie: **Integration**
4. Klik op **Download**
5. Herstart Home Assistant

---

## ⚙️ Configuratie

Ga naar **Instellingen → Apparaten & Services → Integratie toevoegen → Nida**

De configuratie bestaat uit 6 stappen:

### Stap 1 — Locatie & Rekenmethode

| Veld | Beschrijving | Voorbeeld |
|---|---|---|
| Stad | Jouw stad | `Amsterdam` |
| Land | Jouw land | `Netherlands` |
| Rekenmethode | Islamitische berekeningsmethode | `Muslim World League` |

---

### Stap 2 — Herinneringen vóór de Adhan

Stel tot 2 herinneringen in die vóór elke gebedstijd worden afgespeeld.

| Veld | Beschrijving |
|---|---|
| Herinnering inschakelen | Aan/uit |
| Minuten vóór adhan | Bijvoorbeeld `10` of `5` |
| Geluid | Optionele jingle |
| Taal | nl / en / ar / tr |
| Bericht | Bijvoorbeeld `Over [minutes] minuten is het tijd voor [prayer]` |

Gebruik `[minutes]` en `[prayer]` als placeholders.

---

### Stap 3 — Fajr Adhan

Aparte instellingen voor Fajr (vaak andere recitatie).

| Veld | Beschrijving |
|---|---|
| Fajr Geluid | Kies uit beschikbare Fajr MP3’s |
| Speaker | Media player entiteit |
| Volume | 0 – 100% |

---

### Stap 4 — Dagelijkse Adhan

| Veld | Beschrijving |
|---|---|
| Adhan Geluid | Kies uit beschikbare dag-adhan MP3’s |
| Speaker | Media player entiteit |
| Volume | 0 – 100% |
| Nachtvolume | Optioneel lager volume na ingesteld uur |
| Start nacht | Uur waarop nachtvolume ingaat |

---

### Stap 5 — Meldingen

| Veld | Beschrijving |
|---|---|
| Meld bij elk gebed | Pushmelding bij gebedstijd |
| Verzend naar | Selecteer notify service(s) |
| Titel | Titel van melding |
| Bericht | Gebruik `{prayer}` als variabele |

---

### Stap 6 — Ramadan

| Veld | Beschrijving |
|---|---|
| Suhoor-alarm | Speel geluid vóór einde Suhoor |
| Minuten vóór Imsak | Aantal minuten |
| Suhoor-geluid | Kies MP3 |
| Volume | 0 – 100% |
| Tarhim inschakelen | Speel Tarhim vóór Fajr |
| Tarhim-geluid | Kies MP3 |
| Speaker | Media player |
| Tarhim volume | 0 – 100% |

Tarhim wordt automatisch 6,5 minuten vóór Fajr afgespeeld tijdens Ramadan.

---

(De secties “Sound Files”, “Sensors”, “Services”, “Dashboard Card” en “Calculation Methods” blijven inhoudelijk hetzelfde; alleen begeleidende tekst is vertaald.)

---

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ — Met ❤️ gemaakt voor de moslimgemeenschap*
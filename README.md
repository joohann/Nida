# 🕌 Nida — Islamic Prayer Times for Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![HA Version](https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue)](https://home-assistant.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

*Assalāmu ʿAlaykum wa Raḥmatullāhi wa Barakātuh*
— Iftikhar Farzan Izz Al Din Muhsin

**Nida** (نداء) means *"the call"* — a full-featured Home Assistant integration for Islamic prayer times with automatic adhan, pre-adhan reminders, Ramadan features and a beautiful dashboard card.

Prayer times are fetched from the free [AlAdhan API](https://aladhan.com/prayer-times-api) — no account or API key required. May Allah reward those who built and maintain it. 🤲

---

## ✨ Features

- 🕐 **Prayer Times** — Imsak, Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Midnight
- 📅 **Hijri Calendar** — date, day, month, year and Islamic holidays
- 🔊 **Automatic Adhan** — plays at prayer time via any media player
- 🔔 **Pre-Adhan Reminders** — up to 2 reminders with sound and/or TTS message before each prayer
- 🌙 **Ramadan Features** — Tarhim before Fajr and Suhoor alarm
- 🌙 **Night Volume** — automatically lower volume after a set hour
- 📱 **Push Notifications** — receive a notification at each prayer time
- ⏭️ **Next Prayer Sensor** — shows which prayer is coming up next
- 🎵 **Preview Services** — test adhans and tarhim directly from the UI
- 📊 **Dashboard Card** — beautiful card with live countdown timer
- 🌍 **15+ Calculation Methods** — Muslim World League, ISNA, Karachi and more
- 🗣️ **Multi-language** — English, Dutch, Arabic, Turkish, German, French, Malay, Indonedian, Urdu and Farsi (Persian).

---

## 📦 Installation via HACS

1. Go to **HACS → Integrations → ⋮ → Custom Repositories**
2. Add: `https://github.com/joohann/Nida`
3. Category: **Integration**
4. Click **Download**
5. Restart Home Assistant

---

## ⚙️ Configuration

Go to **Settings → Devices & Services → Add Integration → Nida**

The setup consists of 6 steps:

### Step 1 — Location & Method

| Field | Description | Example |
|---|---|---|
| City | Your city | `Amsterdam` |
| Country | Your country | `Netherlands` |
| Calculation Method | Islamic calculation method | `Muslim World League` |

### Step 2 — Pre-Adhan Reminders

Configure up to 2 reminders that play before each prayer. Each reminder can have a sound and/or a spoken TTS message.

| Field | Description |
|---|---|
| Enable reminder | On/off |
| Minutes before adhan | e.g. `10` or `5` |
| Sound | Optional jingle sound |
| Language | nl / en / ar / tr |
| Message | e.g. `بعد [minutes] دقيقة حان وقت صلاة [prayer]` |

Use `[minutes]` and `[prayer]` as placeholders in your message.

### Step 3 — Fajr Adhan

Separate adhan settings for Fajr (different recitation than daily prayers).

| Field | Description |
|---|---|
| Fajr Adhan Sound | Choose from available Fajr MP3s |
| Speaker | Your media player entity |
| Volume | 0 — 100% |

### Step 4 — Daily Adhan

| Field | Description |
|---|---|
| Adhan Sound | Choose from available day adhan MP3s |
| Speaker | Your media player entity |
| Volume | 0 — 100% |
| Night volume | Optional lower volume after set hour |
| Night start hour | From which hour to use night volume |

### Step 5 — Notifications

| Field | Description |
|---|---|
| Notify at each prayer | Send push notification at prayer time |
| Send notification to | Select notify service(s) |
| Title | Notification title |
| Message | Notification message (use `{prayer}`) |

### Step 6 — Ramadan

| Field | Description |
|---|---|
| Suhoor alarm | Play a sound before Suhoor ends |
| Suhoor alarm minutes | How many minutes before Imsak |
| Suhoor alarm sound | Choose sound |
| Suhoor alarm volume | 0 — 100% |
| Enable Tarhim | Play tarhim before Fajr during Ramadan |
| Tarhim Sound | Choose tarhim MP3 |
| Tarhim Speaker | Your media player entity |
| Tarhim Volume | 0 — 100% |

Tarhim plays automatically 6.5 minutes before Fajr during Ramadan.

---

## 🔊 Sound Files

Place your MP3 files in the `sounds/` folder of the integration. Files are automatically scanned and categorized by name:

| Pattern | Type |
|---|---|
| `*fajr*.mp3` | Fajr adhan |
| `*adhan*.mp3` | Daily adhan |
| `*tarhim*.mp3` | Tarhim |
| `*suhoor*.mp3` | Suhoor alarm |
| `*jingle*.mp3` | Pre-adhan reminder sound |

**Recommended naming:**
```
sounds/
  01-adhan-fajr.mp3
  02-adhan-fajr.mp3
  01-adhan-day.mp3
  02-adhan-day.mp3
  01-tarhim.mp3
  01-suhoor.mp3
  01-jingle.mp3
```

Sound files are automatically copied to `/www/nida/sounds/` on installation so media players can access them without authentication issues.

---

## 📊 Sensors

### 🕌 Prayer Times

| Sensor | Description |
|---|---|
| `sensor.01_imsak` | Imsak time |
| `sensor.02_fajr` | Fajr time |
| `sensor.03_sunrise` | Sunrise time |
| `sensor.04_dhuhr` | Dhuhr time |
| `sensor.05_asr` | Asr time |
| `sensor.06_sunset` | Sunset time |
| `sensor.07_maghrib` | Maghrib time |
| `sensor.08_isha` | Isha time |
| `sensor.09_midnight` | Midnight time |
| `sensor.next_prayer` | Next upcoming prayer with time |
| `sensor.last_played_adhan` | Last played adhan |

Readable versions (e.g. `05:41`) are also available as `sensor.01_imsak_readable`, etc.

### 📅 Hijri Calendar

| Sensor | Description |
|---|---|
| `sensor.hijri_date` | Full Hijri date (e.g. `04-09-1447`) |
| `sensor.hijri_day` | Day number |
| `sensor.hijri_month` | Month name (e.g. `Ramaḍān`) |
| `sensor.hijri_year` | Year |
| `sensor.islamic_holiday_today` | Islamic holiday today (if any) |

---

## 🛠️ Services

### `nida.preview_adhan`

Play an adhan as a preview.

```yaml
service: nida.preview_adhan
data:
  sound: 01-adhan-day.mp3
  speaker: media_player.living_room
  volume: 0.5
```

### `nida.test_prayer`

Test the adhan for a specific prayer.

```yaml
service: nida.test_prayer
data:
  prayer: dhuhr
```

### `nida.test_tarhim`

Test the tarhim recitation.

```yaml
service: nida.test_tarhim
data:
  sound: 01-tarhim.mp3
  speaker: media_player.bedroom
  volume: 0.4
```

---

## 📊 Dashboard Card

Nida includes a beautiful custom Lovelace card (`nida-card.js`) with a live countdown timer that automatically adapts to your Home Assistant light or dark theme.

The card is automatically copied to `/www/nida/nida-card.js` on installation.

**Step 1 — Add the resource** (once):

Go to **Settings → Dashboards → ⋮ → Resources → Add Resource**

| Field | Value |
|---|---|
| URL | `/local/nida/nida-card.js` |
| Resource type | `JavaScript Module` |

**Step 2 — Add the card** to your dashboard:

```yaml
type: custom:nida-card
```

Optional configuration:

```yaml
type: custom:nida-card
theme: auto   # auto (default), light, or dark
```

---

## 🤖 Automation Example

Notifications are built into the setup wizard, but you can also build your own automations using the prayer time sensors:

```yaml
automation:
  - alias: "Notification at Maghrib"
    trigger:
      - platform: time
        at: sensor.07_maghrib
    action:
      - service: notify.mobile_app
        data:
          message: "🌅 Maghrib: {{ states('sensor.07_maghrib_readable') }}"
```

---

## 🌍 Calculation Methods

| ID | Method |
|---|---|
| 0 | Shia Ithna-Ashari |
| 1 | University of Islamic Sciences, Karachi |
| 2 | Islamic Society of North America (ISNA) |
| 3 | Muslim World League |
| 4 | Umm Al-Qura University, Makkah |
| 5 | Egyptian General Authority of Survey |
| 7 | Institute of Geophysics, University of Tehran |
| 8 | Gulf Region |
| 9 | Kuwait |
| 10 | Qatar |
| 11 | Majlis Ugama Islam Singapura |
| 12 | Union Organization Islamic de France |
| 13 | Diyanet İşleri Başkanlığı, Turkey |
| 14 | Spiritual Administration of Muslims of Russia |
| 15 | Moonsighting Committee Worldwide |

---

## 🤝 Contributing

Pull requests are welcome! Feel free to add new adhan sounds, translations or features.

---

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ — Made with ❤️ for the Muslim community*

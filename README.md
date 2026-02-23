# 🕌 Prayer Times — Home Assistant Integration

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![HA Version](https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue)](https://home-assistant.io)

A full-featured Home Assistant integration for Islamic prayer times with automatic adhan, Ramadan tarhim and a beautiful dashboard card.

---

## ✨ Features

- 🕐 **Prayer Times** — Imsak, Fajr, Sunrise, Dhuhr, Asr, Sunset, Maghrib, Isha, Midnight
- 📅 **Hijri Calendar** — date, day, month, year and Islamic holidays
- 🔊 **Automatic Adhan** — plays automatically at prayer time via Sonos or other speakers
- 🌙 **Tarhim** — plays automatically 6.5 minutes before Fajr during Ramadan
- ⏭️ **Next Prayer Sensor** — shows which prayer is coming up next
- 🎵 **Preview Services** — test adhans and tarhim directly from the UI
- 📊 **Dashboard Card** — beautiful iframe card with live countdown timer
- 🌍 **15+ Calculation Methods** — Muslim World League, ISNA, Karachi and more
- 🗣️ **Multi-language** — English, Dutch, Arabic

---

## 📦 Installation via HACS

1. Go to **HACS → Integrations → ⋮ → Custom Repositories**
2. Add: `https://github.com/your-username/ha-prayer-times`
3. Category: **Integration**
4. Click **Download**
5. Restart Home Assistant

---

## ⚙️ Configuration

### Step 1 — Location & Method
Go to **Settings → Devices & Services → Add Integration → Prayer Times**

| Field | Description | Example |
|-------|-------------|---------|
| City | Your city | `Amsterdam` |
| Country | Your country | `Netherlands` |
| Calculation Method | Islamic calculation method | `Muslim World League` |

### Step 2 — Adhan Settings
| Field | Description |
|-------|-------------|
| Play Method | `media_player` or `chime_tts` |
| Adhan Sound | Choose from available sounds |
| Speaker | Your media player entity |
| Volume | 0.0 — 1.0 |

### Step 3 — Fajr Settings
Separate settings for the Fajr adhan (different adhan than daily prayers).

### Step 4 — Tarhim (تَرْحِيم) — Ramadan only
Tarhim is a melodious recitation played 6.5 minutes before Fajr during Ramadan to wake people for Suhoor.

| Field | Description |
|-------|-------------|
| Enable Tarhim | On/off during Ramadan |
| Tarhim Sound | Choose from available tarhim files |
| Speaker | Your media player entity |
| Volume | 0.0 — 1.0 |

---

## 🔊 Sound Files

Place your MP3 files in the `sounds/` folder of the integration. The integration automatically scans for:

| Pattern | Type |
|---------|------|
| `*fajr*.mp3` | Fajr adhan |
| `*day*.mp3` | Daily adhan |
| `*tarhim*.mp3` | Tarhim |

**Recommended naming:**
```
sounds/
  01-01-adhan-fajr.mp3
  02-01-adhan-fajr.mp3
  01-02-adhan-day.mp3
  02-02-adhan-day.mp3
  01-tarhim.mp3
  02-tarhim.mp3
```

Sound files are automatically copied to `/www/nida/sounds/` on installation so Sonos and other speakers can access them without authentication issues.

---

## 📊 Sensors

### 🕌 Prayer Times
| Sensor | Description |
|--------|-------------|
| `sensor.01_imsak` | Imsak time (timestamp) |
| `sensor.02_fajr` | Fajr time (timestamp) |
| `sensor.03_sunrise` | Sunrise time (timestamp) |
| `sensor.04_dhuhr` | Dhuhr time (timestamp) |
| `sensor.05_asr` | Asr time (timestamp) |
| `sensor.06_sunset` | Sunset time (timestamp) |
| `sensor.07_maghrib` | Maghrib time (timestamp) |
| `sensor.08_isha` | Isha time (timestamp) |
| `sensor.09_midnight` | Midnight time (timestamp) |
| `sensor.next_prayer` | Next upcoming prayer with time |
| `sensor.last_played_adhan` | Last played adhan |

### 🕐 Prayer Times Readable
| Sensor | Value |
|--------|-------|
| `sensor.01_imsak_readable` | `05:41` |
| `sensor.02_fajr_readable` | `05:51` |
| ... | ... |

### 📅 Hijri Calendar
| Sensor | Description |
|--------|-------------|
| `sensor.hijri_date` | Hijri date (e.g. `04-09-1447`) |
| `sensor.hijri_day` | Day number |
| `sensor.hijri_month` | Month name (e.g. `Ramaḍān`) |
| `sensor.hijri_year` | Year |
| `sensor.islamic_holiday_today` | Islamic holiday today |

---

## 🛠️ Services

### `nida.preview_adhan`
Play an adhan as a preview.
```yaml
service: nida.preview_adhan
data:
  sound: 01-02-adhan-day.mp3
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

## 📱 Dashboard Card

Add this card to your dashboard for a beautiful display with live countdown timer:

```yaml
type: iframe
url: /local/nida/dashboard.html
aspect_ratio: 85%
```

The dashboard is automatically copied to `/www/nida/` on installation — no manual setup needed.

---

## 🤖 Automation Example

```yaml
automation:
  - alias: "Notification at Maghrib"
    trigger:
      - platform: state
        entity_id: sensor.next_prayer
    condition:
      - condition: template
        value_template: "{{ 'Maghrib' in trigger.to_state.state }}"
    action:
      - service: notify.mobile_app
        data:
          message: "🌅 Maghrib time: {{ states('sensor.07_maghrib_readable') }}"
```

---

## 🌍 Calculation Methods

| ID | Method |
|----|--------|
| 1 | University of Islamic Sciences, Karachi |
| 2 | Islamic Society of North America (ISNA) |
| 3 | Muslim World League |
| 4 | Umm Al-Qura University, Makkah |
| 5 | Egyptian General Authority of Survey |
| 9 | Kuwait |
| 10 | Qatar |
| 13 | Diyanet İşleri Başkanlığı, Turkey |
| 15 | Moonsighting Committee Worldwide |

---

## 📡 API

Prayer times are fetched from the [AlAdhan API](https://aladhan.com/prayer-times-api) — free and no API key required. Data is refreshed every 12 hours automatically.

---

## 🤝 Contributing

Pull requests are welcome! Feel free to add new adhan sounds, translations or features.

---

*Made with ❤️ for the Muslim community*

---

## 🔑 Dashboard Card — First Time Setup

The dashboard card needs a Long-Lived Access Token to fetch live data from Home Assistant.

**One-time setup:**

1. Go to your **Profile** (bottom left in HA)
2. Scroll down to **Security → Long-Lived Access Tokens**
3. Click **Create Token**, give it a name (e.g. `Prayer Times Dashboard`)
4. Copy the token
5. Open the dashboard card — a token form will appear
6. Paste the token and click **Save**

The token is stored locally in the card and never needs to be entered again.

> **Tip:** If the card shows "unavailable", your token may have expired. Create a new one and paste it in the card.

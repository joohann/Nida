# 🕌 Nida — Waktu Sholat Islam untuk Home Assistant

[![HACS Custom](https://img.shields.io/badge/HACS-Custom-orange.svg)](https://hacs.xyz)
[![HA Version](https://img.shields.io/badge/Home%20Assistant-2023.1%2B-blue)](https://home-assistant.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

<img src="https://raw.githubusercontent.com/joohann/Nida/main/brand/icon.png" width="200">

*Assalāmu ʿAlaykum wa Raḥmatullāhi wa Barakātuh*  — Iftikhar Farzan Izz Al Din Muhsin

**Nida** (نداء) berarti *“panggilan”* — sebuah integrasi lengkap untuk Home Assistant yang menyediakan waktu sholat, adzan otomatis, pengingat sebelum adzan, fitur khusus Ramadan, serta kartu dashboard yang indah dan informatif.

Waktu sholat diambil dari [AlAdhan API](https://aladhan.com/prayer-times-api) yang gratis — tanpa perlu akun atau API key. Semoga Allah membalas kebaikan para pengembangnya. 🤲

🌍 🇬🇧 🇳🇱 🇩🇪 🇫🇷 🇮🇩 🇲🇾 🇸🇦 🇮🇷 🇵🇰

---

## ✨ Fitur

- 🕐 **Waktu Sholat Lengkap** — Imsak, Subuh, Terbit, Dzuhur, Ashar, Terbenam, Maghrib, Isya, dan Tengah Malam  
- 📅 **Kalender Hijriyah** — tanggal, hari, bulan, tahun, serta hari besar Islam  
- 🔊 **Adzan Otomatis** — diputar melalui media player apa pun  
- 🔔 **Pengingat Sebelum Adzan** — hingga 2 pengingat dengan suara dan/atau TTS  
- 🌙 **Fitur Ramadan** — Tarhim sebelum Subuh dan alarm sahur  
- 🌙 **Volume Malam** — otomatis menurunkan volume setelah jam tertentu  
- 📱 **Notifikasi Push** — menerima pemberitahuan setiap waktu sholat  
- ⏭️ **Sensor Sholat Berikutnya** — menampilkan waktu sholat selanjutnya  
- 🎵 **Layanan Preview** — uji adzan dan tarhim langsung dari antarmuka  
- 📊 **Kartu Dashboard** — kartu cantik dengan hitung mundur waktu sholat  
- 🌍 **15+ Metode Perhitungan** — termasuk Muslim World League, ISNA, Karachi, dan lainnya  
- 🗣️ **Multi-bahasa**

<img width="6180" height="3000" alt="Image" src="https://github.com/user-attachments/assets/9886d410-56f3-4f5c-b3ad-3cab861d6721" />

<img width="6180" height="3000" alt="Image" src="https://github.com/user-attachments/assets/bf29dd2d-da6c-422a-88e7-8986225035a8" />

---

## 📦 Instalasi melalui HACS

1. Buka **HACS → Integrations → ⋮ → Custom Repositories**
2. Tambahkan: `https://github.com/joohann/Nida`
3. Pilih kategori: **Integration**
4. Klik **Download**
5. Restart Home Assistant

---

## ⚙️ Konfigurasi

Masuk ke **Settings → Devices & Services → Add Integration → Nida**

Proses konfigurasi terdiri dari 6 langkah:

---

### Langkah 1 — Lokasi & Metode Perhitungan

| Kolom | Deskripsi | Contoh |
|---|---|---|
| City | Kota Anda | `Jakarta` |
| Country | Negara Anda | `Indonesia` |
| Calculation Method | Metode perhitungan waktu sholat | `Muslim World League` |

---

### Langkah 2 — Pengingat Sebelum Adzan

Atur hingga 2 pengingat sebelum setiap waktu sholat.

| Kolom | Deskripsi |
|---|---|
| Aktifkan pengingat | On/Off |
| Menit sebelum adzan | Misalnya `10` atau `5` |
| Sound | Suara jingle opsional |
| Language | id / en / ar / dll |
| Message | Contoh: `Dalam [minutes] menit akan masuk waktu sholat [prayer]` |

Gunakan `[minutes]` dan `[prayer]` sebagai placeholder.

---

### Langkah 3 — Adzan Subuh

Pengaturan khusus untuk adzan Subuh (biasanya berbeda dari adzan harian).

| Kolom | Deskripsi |
|---|---|
| Fajr Sound | Pilih MP3 adzan Subuh |
| Speaker | Entitas media_player |
| Volume | 0 – 100% |

---

### Langkah 4 — Adzan Harian

| Kolom | Deskripsi |
|---|---|
| Adzan Sound | Pilih MP3 adzan harian |
| Speaker | Entitas media_player |
| Volume | 0 – 100% |
| Night volume | Volume lebih rendah setelah jam tertentu |
| Night start hour | Jam mulai volume malam |

---

### Langkah 5 — Notifikasi

| Kolom | Deskripsi |
|---|---|
| Notify at each prayer | Kirim notifikasi saat waktu sholat |
| Send notification to | Pilih layanan notify |
| Title | Judul notifikasi |
| Message | Gunakan `{prayer}` sebagai variabel |

---

### Langkah 6 — Ramadan

| Kolom | Deskripsi |
|---|---|
| Suhoor alarm | Putar suara sebelum imsak |
| Minutes before Imsak | Berapa menit sebelumnya |
| Suhoor sound | Pilih MP3 |
| Volume | 0 – 100% |
| Enable Tarhim | Putar tarhim sebelum Subuh |
| Tarhim Sound | Pilih MP3 |
| Tarhim Speaker | Entitas media_player |
| Tarhim Volume | 0 – 100% |

Tarhim otomatis diputar 6,5 menit sebelum Subuh selama bulan Ramadan.

---

## 🔊 File Suara

Letakkan file MP3 Anda di folder `sounds/`.  
File akan otomatis dipindai dan dikategorikan berdasarkan nama.

---

## 📊 Sensor

Integrasi ini menyediakan berbagai sensor waktu sholat serta kalender Hijriyah yang dapat digunakan dalam automasi maupun dashboard.

---

## 🛠️ Services

Beberapa layanan tersedia untuk menguji adzan, tarhim, dan notifikasi langsung dari antarmuka Home Assistant.

---

## 📊 Dashboard Card

Nida menyediakan kartu Lovelace khusus (`nida-card.js`) dengan hitung mundur waktu sholat secara real-time.

Kartu otomatis disalin ke `/www/nida/nida-card.js` saat instalasi.

---

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ — Dibuat dengan ❤️ untuk umat Muslim*
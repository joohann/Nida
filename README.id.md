<div align="center">

<img src="https://raw.githubusercontent.com/joohann/Nida/main/custom_components/nida/brand/icon.png" width="120" alt="Nida icon">

# Nida — نداء

**Waktu salat, adzan, dan pengingat Islami untuk Home Assistant.**

[![Marketplace](https://img.shields.io/badge/Home%20Assistant-Marketplace-41BDF5.svg)](https://www.hacs.xyz/docs/marketplace/)
[![Release](https://img.shields.io/github/v/release/joohann/Nida)](https://github.com/joohann/Nida/releases)
[![Hassfest](https://github.com/joohann/Nida/actions/workflows/hassfest.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/hassfest.yml)
[![Validate](https://github.com/joohann/Nida/actions/workflows/validate.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.md) · [Nederlands](README.nl.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md)

</div>

*Nida* berarti "panggilan". Integrasi ini mengambil waktu salat dari
[AlAdhan API](https://aladhan.com/prayer-times-api) gratis (tanpa akun atau kunci API),
memutar adzan di speaker Anda pada saat yang tepat, mengingatkan Anda sebelumnya,
dan menyediakan panel pengaturan serta kartu dasbor yang sesuai dengan tema Anda.

## Fitur

| | |
|---|---|
| **Waktu salat** | Imsak, Subuh, Terbit, Zuhur, Asar, Terbenam, Magrib, Isya, dan Tengah malam, dengan 15+ metode perhitungan |
| **Adzan** | Aktif/nonaktif per salat, suara dan volume sendiri, di satu atau lebih media player |
| **Pra-adzan** | Jingle dan pengumuman lisan (TTS) sebelum salat, dengan volume sendiri untuk Subuh |
| **Mode malam** | Menurunkan volume adzan, jingle, dan pengumuman pada jam yang ditentukan |
| **Volume saat kontak terbuka** | Volume lebih rendah saat sensor jendela atau pintu terbuka |
| **Ramah musik** | Mengecilkan atau menjeda musik Anda, memunculkannya kembali perlahan, dan memulihkan pemutaran setelahnya; pengumuman Sonos didukung |
| **Ramadan** | Pengingat sahur dan berbuka, doa berbuka, Tarhim, alarm bangun Subuh dengan scene |
| **Notifikasi** | Push per salat, pengingat Jumat, acara kalender Hijriah, hitung mundur iOS Live Activity |
| **Doa** | Putar doa dengan pemicu Anda sendiri, atau dari entitas tombol |
| **Pustaka suara** | Beberapa suara disertakan dalam Nida, sisanya diunduh sesuai kebutuhan dari katalog |
| **Kartu dasbor** | Kartu Salat berikutnya dan Hari ini dengan hitung mundur langsung, terang dan gelap |
| **10 bahasa** | Inggris, Belanda, Arab, Turki, Jerman, Prancis, Melayu, Indonesia, Urdu, Persia |

## Instalasi

### Marketplace

Nida sedang diajukan ke Home Assistant Marketplace (HACS, bawaan mulai
Home Assistant 2026.11). Setelah terdaftar:

1. Buka **Marketplace** di Home Assistant dan cari **Nida**.
2. Unduh lalu mulai ulang Home Assistant.

Sampai saat itu, atau pada Home Assistant lama dengan HACS terpasang, tambahkan
sebagai repositori kustom: **HACS → ⋮ → Repositori kustom**, URL
`https://github.com/joohann/Nida`, kategori **Integrasi**.

### Manual

Salin `custom_components/nida` ke folder `config/custom_components/` Home Assistant
Anda lalu mulai ulang.

## Pengaturan

1. Buka **Pengaturan → Perangkat & layanan → Tambah integrasi → Nida**.
2. Konfirmasi. Nida ditambahkan hanya dengan satu klik.
3. Buka **Nida** di bilah samping. Semua pengaturan lainnya ada di panel ini:
   salat, suara, speaker, pra-adzan, mode malam, notifikasi, Ramadan,
   dan lainnya.

YAML tidak diperlukan. Pengaturan disimpan di opsi integrasi.

## Entitas

| Entitas | Deskripsi |
|---|---|
| `sensor.nida_fajr`, `…_dhuhr`, `…_asr`, `…_maghrib`, `…_isha`, `…_sunrise`, … | Waktu setiap salat (timestamp) |
| `sensor.nida_imsak` | Imsak |
| `sensor.nida_next_prayer` | Salat berikutnya dan waktunya |
| `sensor.nida_hijri_*` | Tanggal, hari, bulan, dan tahun Hijriah |
| `binary_sensor.nida_<prayer>_active` | Aktif selama Anda berada dalam rentang waktu salat tersebut |
| `switch.nida_<prayer>_adhan` | Mengaktifkan atau menonaktifkan adzan untuk satu salat |
| `button.nida_dua_*` | Memutar doa |

ID entitas persisnya bergantung pada nama perangkat Anda; lihat **Pengaturan → Perangkat & layanan → Nida**.

## Layanan

| Layanan | Fungsi |
|---|---|
| `nida.play_adhan` | Memutar adzan untuk satu salat di satu atau lebih media player |
| `nida.play_preview` | Pratinjau suara di speaker pilihan |
| `nida.test_pre_adhan` | Menguji seluruh pra-adzan: jingle, jeda, dan pengumuman lisan |

```yaml
service: nida.test_pre_adhan
```

Deskripsi lengkap kolom ada di **Alat pengembang → Aksi**.

## Kartu dasbor

Kartu terdaftar otomatis; tidak perlu menambahkan apa pun di Sumber daya.
Pilih **Nida** di pemilih kartu, atau gunakan YAML:

```yaml
type: custom:nida-card
card_type: now        # now, today, kids, scene_now, scene_today
```

| Opsi | Deskripsi |
|---|---|
| `card_type` | `now` (salat berikutnya), `today` (semua salat), `kids`, `scene_now`, `scene_today` |
| `collapsed` | Hanya kartu `today`: mulai terlipat hingga salat berikutnya |
| `grid_options.rows` | Di tampilan Sections, kartu mengisi tinggi yang ditentukan |

## Persyaratan

- Home Assistant 2023.1 atau lebih baru
- Satu atau lebih entitas `media_player` untuk adzan
- Integrasi TTS jika Anda ingin pengumuman lisan
- Aplikasi Home Assistant Companion untuk notifikasi push dan Live Activity

## Dokumentasi dan dukungan

- [Changelog](CHANGELOG.md)
- [Issues](https://github.com/joohann/Nida/issues): bug dan permintaan fitur
- Data salat dari [AlAdhan](https://aladhan.com)

Pull request diterima, termasuk suara dan terjemahan baru.

---

<div align="center">

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ*
Dibuat dengan penuh perhatian untuk umat Muslim.

</div>

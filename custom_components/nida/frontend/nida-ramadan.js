/**
 * Nida Ramadan Edition — immersive single-column worship layout (ES module).
 *
 * Loaded lazily by nida-panel.js (dynamic import) only while the Ramadan
 * theme is active AND options.ramadan_edition_enabled !== false. The base
 * panel stays byte-for-byte in charge outside Ramadan; this module renders
 * a complete alternative layout (design approved via the v0.3 mockup,
 * 2026-07-11): illustrated hero scene, prayer schedule with Imsak, Ramadan
 * progress (ring + 30-night crescent strip), dua of the day, Quran
 * progress, Laylat al-Qadr card during the last ten nights, and a settings
 * drawer that hosts ALL existing settings sections unchanged.
 *
 * Isolation contract:
 *   - No side effects at import time (safe to import in node for tests).
 *   - Reads panel state only through the public-ish helpers the panel
 *     already exposes (_prayerSchedule, _nextPrayerInfo, _countdown,
 *     _sensorState, _saveSettings, t, _htmlSection*).
 *   - All own DOM ids/classes are prefixed r- / .r-app; all own actions
 *     are prefixed "ramadan-"; all own option keys "ramadan_*"; module
 *     state lives under panel._rmState only.
 *   - Day-phase engine: night / fajr / day / maghrib resolved from the
 *     live prayer schedule; iftar experience (prep → moment → after) is a
 *     time-driven state machine around Maghrib. Testing overrides (never
 *     surfaced in UI): ?rphase=night|fajr|day|maghrib and
 *     ?rmode=prep|moment|after — same query/hash/top-window resolution
 *     as the panel's own ?theme override.
 *
 * Changelog:
 *   2.2.0 (2026-07-11): New file — Ramadan Edition layout module per the
 *                       approved mockup (single column, day phases, iftar
 *                       experience, progress/dua/quran/qadr cards, gear
 *                       drawer with existing settings sections, i18n for
 *                       all ten supported languages). Watercolor ornaments
 *                       from Johann's approved sheet embedded as WebP with
 *                       alpha: mosque header icon, Laylat al-Qadr script +
 *                       hanging lanterns (qadr card), gold lantern
 *                       (progress card), arabesque medallion (dua card).
 *                       Sizing pass after first on-device review (Johann:
 *                       "te groot, kan er te weinig op een pagina"):
 *                       column narrowed 1080→880px (TV 1180px), type
 *                       scale and paddings tightened across all cards,
 *                       hero capped at 320px, schedule rows compacted,
 *                       ornaments scaled down proportionally. Device
 *                       tiers: phone ≤600px (trimmed decorations,
 *                       full-width drawer), tablet 601-1279 (base), pc
 *                       ≥1280 (940px column), tv via Fully Kiosk
 *                       detection (window.fully / UA) or ?rtv=1 —
 *                       couch-distance type scale on a 1280px column,
 *                       deliberately not width-based so wide PC monitors
 *                       stay at pc scale. Footer shows the panel version
 *                       (read from this module's own ?v= import URL),
 *                       matching the base themes' footer-note. Living-day
 *                       pass (Johann's phase review): day phase switches
 *                       to the daylight watercolor with a full light
 *                       palette (cream glass, dark text) — the painting
 *                       is lifted at runtime from the panel's own
 *                       --img-heroramadanlight declaration, no asset
 *                       duplication; Fajr/Maghrib show a sun-below-the-
 *                       horizon glow (east at dawn, west at sunset) on
 *                       both the hero and the page background; page sky
 *                       gradients follow every phase. New ?debug flag
 *                       (with ?ramadan alias in nida-panel.js) renders a
 *                       sticky phase bar: night/fajr/day/maghrib/prep/
 *                       moment/after/qadr, auto, and a ▶ cycle button
 *                       stepping through all looks every 7s.
 */
"use strict";

/* Version for the footer — read from our own import URL: nida-panel.js
   loads this module as ./nida-ramadan.js?v=<NIDA_PANEL_VERSION>, so no
   extra coupling is needed to display the same number the base themes
   show in their footer. */
const MODULE_VERSION = (() => {
  try { return new URL(import.meta.url).searchParams.get("v") || ""; }
  catch (_e) { return ""; }
})();

/* ─────────────────────────── i18n ──────────────────────────────────────
   Own dictionary, falling back to the panel's t() for anything shared
   (prayer_* names, until_iftar, theme_ramadan, minutes_short, ...). */

const T = {
  en: {
    rme_last_ten: "Last Ten Nights",
    rme_next: "Next prayer", rme_remaining: "Remaining", rme_last_prayer: "Last prayer",
    rme_until_suhoor: "Until Suhoor", rme_until_maghrib: "Until Maghrib",
    rme_iftar_time: "Iftar time", rme_break_fast: "Break your fast",
    rme_suhoor: "Suhoor", rme_prepare_meal: "Prepare your meal",
    rme_prepare_iftar: "Prepare for Iftar",
    rme_bismillah: "Bismillah", rme_time_to_break: "It is time to break your fast",
    rme_taqabbal: "May Allah accept from us and from you.",
    rme_today: "Today", rme_imsak: "Imsak",
    rme_progress: "Ramadan progress", rme_days_complete: "Days complete",
    rme_dua_of_day: "Dua of the day",
    rme_quran: "Quran reading", rme_juz: "Juz", rme_of_30: "of 30",
    rme_continue: "Continue your journey",
    rme_night_word: "Night", rme_nights_remaining: "{n} nights remaining",
    rme_odd_night: "Tonight is an odd night", rme_even_night: "Tonight is an even night",
    rme_qadr_seek: "Laylat al-Qadr — seek it in the last ten nights",
    rme_tahajjud: "Tahajjud", rme_dhikr: "Dhikr", rme_dua_word: "Dua", rme_quran_word: "Quran",
    rme_settings: "Settings", rme_taraweeh: "Taraweeh",
    rme_sleep_reminder: "Sleep reminder — rest well after Suhoor",
    rme_fast_begun: "The fast has begun",
    rme_dua_1: "Thirst is gone, the veins are moistened, and the reward is certain, if Allah wills.",
    rme_dua_2: "O Allah, You are Pardoning and You love pardon, so pardon me.",
    rme_dua_3: "O Allah, I ask You for forgiveness and well-being in this world and the Hereafter.",
  },
  nl: {
    rme_last_ten: "Laatste tien nachten",
    rme_next: "Volgend gebed", rme_remaining: "Resterend", rme_last_prayer: "Laatste gebed",
    rme_until_suhoor: "Tot suhoor", rme_until_maghrib: "Tot Maghrib",
    rme_iftar_time: "Iftartijd", rme_break_fast: "Verbreek je vasten",
    rme_suhoor: "Suhoor", rme_prepare_meal: "Bereid je maaltijd voor",
    rme_prepare_iftar: "Bereid je voor op iftar",
    rme_bismillah: "Bismillah", rme_time_to_break: "Het is tijd om je vasten te verbreken",
    rme_taqabbal: "Moge Allah het van ons en van jullie aanvaarden.",
    rme_today: "Vandaag", rme_imsak: "Imsak",
    rme_progress: "Ramadan-voortgang", rme_days_complete: "Dagen voltooid",
    rme_dua_of_day: "Dua van de dag",
    rme_quran: "Quran lezen", rme_juz: "Juz", rme_of_30: "van 30",
    rme_continue: "Vervolg je reis",
    rme_night_word: "Nacht", rme_nights_remaining: "{n} nachten resterend",
    rme_odd_night: "Vannacht is een oneven nacht", rme_even_night: "Vannacht is een even nacht",
    rme_qadr_seek: "Laylat al-Qadr — zoek haar in de laatste tien nachten",
    rme_tahajjud: "Tahajjud", rme_dhikr: "Dhikr", rme_dua_word: "Dua", rme_quran_word: "Quran",
    rme_settings: "Instellingen", rme_taraweeh: "Taraweeh",
    rme_sleep_reminder: "Slaapherinnering — rust goed na suhoor",
    rme_fast_begun: "Het vasten is begonnen",
    rme_dua_1: "De dorst is verdwenen, de aderen zijn bevochtigd en de beloning staat vast, als Allah het wil.",
    rme_dua_2: "O Allah, U bent Vergevingsgezind en U houdt van vergeving, dus vergeef mij.",
    rme_dua_3: "O Allah, ik vraag U om vergeving en welzijn in dit leven en het Hiernamaals.",
  },
  ar: {
    rme_last_ten: "العشر الأواخر",
    rme_next: "الصلاة القادمة", rme_remaining: "المتبقي", rme_last_prayer: "الصلاة السابقة",
    rme_until_suhoor: "حتى السحور", rme_until_maghrib: "حتى المغرب",
    rme_iftar_time: "وقت الإفطار", rme_break_fast: "أفطر الآن",
    rme_suhoor: "السحور", rme_prepare_meal: "جهّز وجبتك",
    rme_prepare_iftar: "استعد للإفطار",
    rme_bismillah: "بسم الله", rme_time_to_break: "حان وقت الإفطار",
    rme_taqabbal: "تقبّل الله منا ومنكم.",
    rme_today: "اليوم", rme_imsak: "الإمساك",
    rme_progress: "تقدّم رمضان", rme_days_complete: "أيام مكتملة",
    rme_dua_of_day: "دعاء اليوم",
    rme_quran: "قراءة القرآن", rme_juz: "جزء", rme_of_30: "من ٣٠",
    rme_continue: "واصل رحلتك",
    rme_night_word: "ليلة", rme_nights_remaining: "{n} ليالٍ متبقية",
    rme_odd_night: "الليلة ليلة وتر", rme_even_night: "الليلة ليلة شفع",
    rme_qadr_seek: "ليلة القدر — التمسها في العشر الأواخر",
    rme_tahajjud: "التهجد", rme_dhikr: "الذكر", rme_dua_word: "دعاء", rme_quran_word: "قرآن",
    rme_settings: "الإعدادات", rme_taraweeh: "التراويح",
    rme_sleep_reminder: "تذكير بالنوم — استرح جيدًا بعد السحور",
    rme_fast_begun: "بدأ الصيام",
    rme_dua_1: "ذهب الظمأ وابتلت العروق وثبت الأجر إن شاء الله.",
    rme_dua_2: "اللهم إنك عفو تحب العفو فاعف عني.",
    rme_dua_3: "اللهم إني أسألك العفو والعافية في الدنيا والآخرة.",
  },
  tr: {
    rme_last_ten: "Son On Gece",
    rme_next: "Sonraki namaz", rme_remaining: "Kalan", rme_last_prayer: "Önceki namaz",
    rme_until_suhoor: "Sahura kadar", rme_until_maghrib: "Akşama kadar",
    rme_iftar_time: "İftar vakti", rme_break_fast: "Orucunu aç",
    rme_suhoor: "Sahur", rme_prepare_meal: "Yemeğini hazırla",
    rme_prepare_iftar: "İftara hazırlan",
    rme_bismillah: "Bismillah", rme_time_to_break: "Orucu açma vakti geldi",
    rme_taqabbal: "Allah bizden ve sizden kabul etsin.",
    rme_today: "Bugün", rme_imsak: "İmsak",
    rme_progress: "Ramazan ilerlemesi", rme_days_complete: "Tamamlanan gün",
    rme_dua_of_day: "Günün duası",
    rme_quran: "Kur'an okuma", rme_juz: "Cüz", rme_of_30: "/ 30",
    rme_continue: "Yolculuğuna devam et",
    rme_night_word: "Gece", rme_nights_remaining: "{n} gece kaldı",
    rme_odd_night: "Bu gece tek gece", rme_even_night: "Bu gece çift gece",
    rme_qadr_seek: "Kadir Gecesi — son on gecede ara",
    rme_tahajjud: "Teheccüd", rme_dhikr: "Zikir", rme_dua_word: "Dua", rme_quran_word: "Kur'an",
    rme_settings: "Ayarlar", rme_taraweeh: "Teravih",
    rme_sleep_reminder: "Uyku hatırlatıcısı — sahurdan sonra iyi dinlen",
    rme_fast_begun: "Oruç başladı",
    rme_dua_1: "Susuzluk gitti, damarlar ıslandı ve inşallah sevap kesinleşti.",
    rme_dua_2: "Allah'ım, sen affedicisin, affı seversin, beni affet.",
    rme_dua_3: "Allah'ım, senden dünyada ve ahirette af ve afiyet dilerim.",
  },
  de: {
    rme_last_ten: "Die letzten zehn Nächte",
    rme_next: "Nächstes Gebet", rme_remaining: "Verbleibend", rme_last_prayer: "Letztes Gebet",
    rme_until_suhoor: "Bis Suhoor", rme_until_maghrib: "Bis Maghrib",
    rme_iftar_time: "Iftar-Zeit", rme_break_fast: "Brich dein Fasten",
    rme_suhoor: "Suhoor", rme_prepare_meal: "Bereite deine Mahlzeit vor",
    rme_prepare_iftar: "Bereite dich auf Iftar vor",
    rme_bismillah: "Bismillah", rme_time_to_break: "Es ist Zeit, das Fasten zu brechen",
    rme_taqabbal: "Möge Allah es von uns und von euch annehmen.",
    rme_today: "Heute", rme_imsak: "Imsak",
    rme_progress: "Ramadan-Fortschritt", rme_days_complete: "Tage vollendet",
    rme_dua_of_day: "Dua des Tages",
    rme_quran: "Koranlesung", rme_juz: "Dschuz", rme_of_30: "von 30",
    rme_continue: "Setze deine Reise fort",
    rme_night_word: "Nacht", rme_nights_remaining: "{n} Nächte verbleibend",
    rme_odd_night: "Heute ist eine ungerade Nacht", rme_even_night: "Heute ist eine gerade Nacht",
    rme_qadr_seek: "Laylat al-Qadr — suche sie in den letzten zehn Nächten",
    rme_tahajjud: "Tahadschud", rme_dhikr: "Dhikr", rme_dua_word: "Dua", rme_quran_word: "Koran",
    rme_settings: "Einstellungen", rme_taraweeh: "Tarawih",
    rme_sleep_reminder: "Schlaf-Erinnerung — ruhe dich nach Suhoor gut aus",
    rme_fast_begun: "Das Fasten hat begonnen",
    rme_dua_1: "Der Durst ist vergangen, die Adern sind benetzt und der Lohn steht fest, so Allah will.",
    rme_dua_2: "O Allah, Du bist verzeihend und liebst das Verzeihen, so verzeihe mir.",
    rme_dua_3: "O Allah, ich bitte Dich um Vergebung und Wohlergehen im Diesseits und im Jenseits.",
  },
  fr: {
    rme_last_ten: "Les dix dernières nuits",
    rme_next: "Prochaine prière", rme_remaining: "Restant", rme_last_prayer: "Dernière prière",
    rme_until_suhoor: "Jusqu'au souhour", rme_until_maghrib: "Jusqu'au Maghrib",
    rme_iftar_time: "Heure de l'iftar", rme_break_fast: "Romps ton jeûne",
    rme_suhoor: "Souhour", rme_prepare_meal: "Prépare ton repas",
    rme_prepare_iftar: "Prépare-toi pour l'iftar",
    rme_bismillah: "Bismillah", rme_time_to_break: "Il est temps de rompre le jeûne",
    rme_taqabbal: "Qu'Allah accepte de nous et de vous.",
    rme_today: "Aujourd'hui", rme_imsak: "Imsak",
    rme_progress: "Progression du Ramadan", rme_days_complete: "Jours accomplis",
    rme_dua_of_day: "Doua du jour",
    rme_quran: "Lecture du Coran", rme_juz: "Juz", rme_of_30: "sur 30",
    rme_continue: "Poursuis ton chemin",
    rme_night_word: "Nuit", rme_nights_remaining: "{n} nuits restantes",
    rme_odd_night: "Cette nuit est une nuit impaire", rme_even_night: "Cette nuit est une nuit paire",
    rme_qadr_seek: "Laylat al-Qadr — cherche-la dans les dix dernières nuits",
    rme_tahajjud: "Tahajjud", rme_dhikr: "Dhikr", rme_dua_word: "Doua", rme_quran_word: "Coran",
    rme_settings: "Paramètres", rme_taraweeh: "Tarawih",
    rme_sleep_reminder: "Rappel de sommeil — repose-toi bien après le souhour",
    rme_fast_begun: "Le jeûne a commencé",
    rme_dua_1: "La soif est partie, les veines sont abreuvées et la récompense est assurée, si Allah le veut.",
    rme_dua_2: "Ô Allah, Tu es Pardonneur et Tu aimes le pardon, alors pardonne-moi.",
    rme_dua_3: "Ô Allah, je Te demande le pardon et le bien-être en ce monde et dans l'au-delà.",
  },
  ms: {
    rme_last_ten: "Sepuluh Malam Terakhir",
    rme_next: "Solat seterusnya", rme_remaining: "Baki", rme_last_prayer: "Solat terakhir",
    rme_until_suhoor: "Hingga sahur", rme_until_maghrib: "Hingga Maghrib",
    rme_iftar_time: "Waktu iftar", rme_break_fast: "Berbukalah",
    rme_suhoor: "Sahur", rme_prepare_meal: "Sediakan hidangan anda",
    rme_prepare_iftar: "Bersedia untuk berbuka",
    rme_bismillah: "Bismillah", rme_time_to_break: "Tiba masa untuk berbuka puasa",
    rme_taqabbal: "Semoga Allah menerima daripada kami dan kamu.",
    rme_today: "Hari ini", rme_imsak: "Imsak",
    rme_progress: "Kemajuan Ramadan", rme_days_complete: "Hari selesai",
    rme_dua_of_day: "Doa hari ini",
    rme_quran: "Bacaan Al-Quran", rme_juz: "Juzuk", rme_of_30: "daripada 30",
    rme_continue: "Teruskan perjalanan anda",
    rme_night_word: "Malam", rme_nights_remaining: "{n} malam berbaki",
    rme_odd_night: "Malam ini malam ganjil", rme_even_night: "Malam ini malam genap",
    rme_qadr_seek: "Lailatul Qadar — carilah pada sepuluh malam terakhir",
    rme_tahajjud: "Tahajud", rme_dhikr: "Zikir", rme_dua_word: "Doa", rme_quran_word: "Al-Quran",
    rme_settings: "Tetapan", rme_taraweeh: "Tarawih",
    rme_sleep_reminder: "Peringatan tidur — berehat selepas sahur",
    rme_fast_begun: "Puasa telah bermula",
    rme_dua_1: "Hilanglah dahaga, basahlah urat-urat dan tetaplah pahala, insya-Allah.",
    rme_dua_2: "Ya Allah, Engkau Maha Pengampun dan suka mengampuni, maka ampunilah aku.",
    rme_dua_3: "Ya Allah, aku memohon keampunan dan kesejahteraan di dunia dan akhirat.",
  },
  id: {
    rme_last_ten: "Sepuluh Malam Terakhir",
    rme_next: "Salat berikutnya", rme_remaining: "Tersisa", rme_last_prayer: "Salat terakhir",
    rme_until_suhoor: "Hingga sahur", rme_until_maghrib: "Hingga Magrib",
    rme_iftar_time: "Waktu berbuka", rme_break_fast: "Berbukalah",
    rme_suhoor: "Sahur", rme_prepare_meal: "Siapkan hidanganmu",
    rme_prepare_iftar: "Bersiap untuk berbuka",
    rme_bismillah: "Bismillah", rme_time_to_break: "Saatnya berbuka puasa",
    rme_taqabbal: "Semoga Allah menerima dari kami dan kalian.",
    rme_today: "Hari ini", rme_imsak: "Imsak",
    rme_progress: "Kemajuan Ramadan", rme_days_complete: "Hari selesai",
    rme_dua_of_day: "Doa hari ini",
    rme_quran: "Membaca Al-Qur'an", rme_juz: "Juz", rme_of_30: "dari 30",
    rme_continue: "Lanjutkan perjalananmu",
    rme_night_word: "Malam", rme_nights_remaining: "{n} malam tersisa",
    rme_odd_night: "Malam ini malam ganjil", rme_even_night: "Malam ini malam genap",
    rme_qadr_seek: "Lailatulqadar — carilah pada sepuluh malam terakhir",
    rme_tahajjud: "Tahajud", rme_dhikr: "Zikir", rme_dua_word: "Doa", rme_quran_word: "Al-Qur'an",
    rme_settings: "Pengaturan", rme_taraweeh: "Tarawih",
    rme_sleep_reminder: "Pengingat tidur — istirahatlah setelah sahur",
    rme_fast_begun: "Puasa telah dimulai",
    rme_dua_1: "Telah hilang dahaga, urat-urat telah basah, dan pahala telah tetap, insya Allah.",
    rme_dua_2: "Ya Allah, Engkau Maha Pemaaf dan menyukai maaf, maka maafkanlah aku.",
    rme_dua_3: "Ya Allah, aku memohon ampunan dan keselamatan di dunia dan akhirat.",
  },
  ur: {
    rme_last_ten: "آخری دس راتیں",
    rme_next: "اگلی نماز", rme_remaining: "باقی", rme_last_prayer: "پچھلی نماز",
    rme_until_suhoor: "سحری تک", rme_until_maghrib: "مغرب تک",
    rme_iftar_time: "افطار کا وقت", rme_break_fast: "روزہ افطار کریں",
    rme_suhoor: "سحری", rme_prepare_meal: "اپنا کھانا تیار کریں",
    rme_prepare_iftar: "افطار کی تیاری کریں",
    rme_bismillah: "بسم اللہ", rme_time_to_break: "روزہ افطار کرنے کا وقت ہو گیا",
    rme_taqabbal: "اللہ ہم سے اور آپ سے قبول فرمائے۔",
    rme_today: "آج", rme_imsak: "امساک",
    rme_progress: "رمضان کی پیش رفت", rme_days_complete: "مکمل دن",
    rme_dua_of_day: "آج کی دعا",
    rme_quran: "قرآن کی تلاوت", rme_juz: "پارہ", rme_of_30: "از ۳۰",
    rme_continue: "اپنا سفر جاری رکھیں",
    rme_night_word: "رات", rme_nights_remaining: "{n} راتیں باقی",
    rme_odd_night: "آج طاق رات ہے", rme_even_night: "آج جفت رات ہے",
    rme_qadr_seek: "لیلۃ القدر — اسے آخری دس راتوں میں تلاش کریں",
    rme_tahajjud: "تہجد", rme_dhikr: "ذکر", rme_dua_word: "دعا", rme_quran_word: "قرآن",
    rme_settings: "ترتیبات", rme_taraweeh: "تراویح",
    rme_sleep_reminder: "نیند کی یاددہانی — سحری کے بعد اچھی طرح آرام کریں",
    rme_fast_begun: "روزہ شروع ہو گیا",
    rme_dua_1: "پیاس بجھ گئی، رگیں تر ہو گئیں اور اجر ثابت ہو گیا، ان شاء اللہ۔",
    rme_dua_2: "اے اللہ! تو معاف کرنے والا ہے، معافی کو پسند کرتا ہے، پس مجھے معاف فرما۔",
    rme_dua_3: "اے اللہ! میں تجھ سے دنیا اور آخرت میں عفو اور عافیت مانگتا ہوں۔",
  },
  fa: {
    rme_last_ten: "ده شب پایانی",
    rme_next: "نماز بعدی", rme_remaining: "باقی‌مانده", rme_last_prayer: "نماز قبلی",
    rme_until_suhoor: "تا سحر", rme_until_maghrib: "تا مغرب",
    rme_iftar_time: "وقت افطار", rme_break_fast: "روزه‌ات را افطار کن",
    rme_suhoor: "سحری", rme_prepare_meal: "غذایت را آماده کن",
    rme_prepare_iftar: "برای افطار آماده شو",
    rme_bismillah: "بسم الله", rme_time_to_break: "وقت افطار فرا رسیده است",
    rme_taqabbal: "خداوند از ما و شما بپذیرد.",
    rme_today: "امروز", rme_imsak: "امساک",
    rme_progress: "پیشرفت رمضان", rme_days_complete: "روزهای کامل‌شده",
    rme_dua_of_day: "دعای روز",
    rme_quran: "تلاوت قرآن", rme_juz: "جزء", rme_of_30: "از ۳۰",
    rme_continue: "سفرت را ادامه بده",
    rme_night_word: "شب", rme_nights_remaining: "{n} شب باقی‌مانده",
    rme_odd_night: "امشب شبی فرد است", rme_even_night: "امشب شبی زوج است",
    rme_qadr_seek: "شب قدر — آن را در ده شب پایانی بجوی",
    rme_tahajjud: "تهجد", rme_dhikr: "ذکر", rme_dua_word: "دعا", rme_quran_word: "قرآن",
    rme_settings: "تنظیمات", rme_taraweeh: "تراویح",
    rme_sleep_reminder: "یادآور خواب — پس از سحری خوب استراحت کن",
    rme_fast_begun: "روزه آغاز شد",
    rme_dua_1: "تشنگی رفت، رگ‌ها تر شد و پاداش، ان‌شاءالله، ثابت گشت.",
    rme_dua_2: "خدایا، تو بخشنده‌ای و بخشش را دوست داری، پس مرا ببخش.",
    rme_dua_3: "خدایا، از تو گذشت و عافیت در دنیا و آخرت را می‌خواهم.",
  },
};

function tr(p, key) {
  const lang = p._effectiveLanguage();
  return T[lang]?.[key] ?? T.en[key] ?? p.t(key);
}

/* Authentic short duas rotated by Ramadan day (Arabic is constant;
   the translation comes from the T dict per language). */
const DUAS = [
  { ar: "ذَهَبَ الظَّمَأُ وَابْتَلَّتِ الْعُرُوقُ وَثَبَتَ الْأَجْرُ إِنْ شَاءَ اللَّهُ", key: "rme_dua_1" },
  { ar: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي", key: "rme_dua_2" },
  { ar: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ", key: "rme_dua_3" },
];

/* ─────────────────────── time / phase engine ──────────────────────────── */

const MIN = 60 * 1000;
const DAY = 24 * 3600 * 1000;

function urlHas(name) {
  // Presence check (?debug without a value) — same query→hash→top-window
  // resolution as urlOverride below.
  const read = (loc) => {
    if (!loc) return false;
    if (new URLSearchParams(loc.search || "").has(name)) return true;
    const h = String(loc.hash || "").replace(/^#/, "");
    return h ? new URLSearchParams(h).has(name) : false;
  };
  if (read(window.location)) return true;
  if (window.top !== window) {
    try { return read(window.top.location); } catch (_e) { /* cross-origin */ }
  }
  return false;
}

function urlOverride(name) {
  // Same query→hash→top-window resolution as the panel's ?theme override.
  const read = (loc) => {
    if (!loc) return null;
    const q = new URLSearchParams(loc.search || "").get(name);
    if (q) return q;
    const h = String(loc.hash || "").replace(/^#/, "");
    return h ? new URLSearchParams(h).get(name) : null;
  };
  let v = read(window.location);
  if (!v && window.top !== window) {
    try { v = read(window.top.location); } catch (_e) { /* cross-origin */ }
  }
  return v;
}

function prayerDates(p) {
  // {fajr,dhuhr,asr,maghrib,isha,imsak} as Date or undefined. Imsak comes
  // from sensor.nida_imsak minus the user's display offset (same rule the
  // base Today-card uses).
  const out = {};
  for (const e of p._prayerSchedule()) out[e.prayer] = e.date;
  const imsakTs = p._sensorState("imsak");
  if (imsakTs) {
    const d = new Date(imsakTs);
    if (!isNaN(d.getTime())) {
      out.imsak = new Date(d.getTime() - (p._imsakOffset?.() ?? 0) * MIN);
    }
  }
  return out;
}

function nextOccurrence(date, now) {
  // Today's stored time, pushed to tomorrow once passed (~1 min/day drift
  // is acceptable, same approximation as _nextPrayerInfo).
  if (!date) return null;
  let t = date.getTime();
  while (t <= now) t += DAY;
  return t;
}

function computeState(p) {
  const now = Date.now();
  const d = prayerDates(p);
  const st = { phase: "night", mode: "normal", focus: "evening",
               target: null, targetKey: null };

  // ── iftar experience state machine around today's Maghrib ──
  if (d.maghrib) {
    const dt = now - d.maghrib.getTime();
    if (dt >= -2 * MIN && dt < 0) st.mode = "prep";
    else if (dt >= 0 && dt < 1.5 * MIN) st.mode = "moment";
    else if (dt >= 1.5 * MIN && dt < 6.5 * MIN) st.mode = "after";
  }

  // ── day phase ──
  if (d.fajr && d.maghrib && d.isha) {
    const fajrT = d.fajr.getTime(), maghribT = d.maghrib.getTime(),
          ishaT = d.isha.getTime();
    if (now >= fajrT && now < fajrT + 90 * MIN) st.phase = "fajr";
    else if (now >= fajrT + 90 * MIN && now < maghribT - 45 * MIN) st.phase = "day";
    else if (now >= maghribT - 45 * MIN && now < ishaT) st.phase = "maghrib";
    else st.phase = "night";
  }

  // ── worship focus + countdown target ──
  const imsakNext = nextOccurrence(d.imsak ?? d.fajr, now);
  const maghribNext = nextOccurrence(d.maghrib, now);
  const fasting = d.imsak && d.maghrib
    ? now >= (d.imsak.getTime()) && now < d.maghrib.getTime()
    : st.phase === "day" || st.phase === "fajr";
  if (fasting) {
    st.focus = "fast"; st.target = maghribNext; st.targetKey = "until_iftar";
  } else {
    st.target = imsakNext; st.targetKey = "rme_until_suhoor";
    // Suhoor focus in the final hours before Imsak; evening otherwise.
    st.focus = imsakNext && imsakNext - now < 4 * 3600 * 1000 ? "suhoor" : "evening";
  }

  // ── Laylat al-Qadr (last ten nights) ──
  const hijriDay = parseInt(p._sensorState("hijri_day"), 10);
  st.day = Number.isFinite(hijriDay) ? Math.min(Math.max(hijriDay, 1), 30) : 1;
  st.qadr = st.day >= 21;

  // ── testing overrides (never surfaced in UI) ──
  const oPhase = urlOverride("rphase"), oMode = urlOverride("rmode");
  if (["night", "fajr", "day", "maghrib"].includes(oPhase)) st.phase = oPhase;
  if (["prep", "moment", "after", "normal"].includes(oMode)) st.mode = oMode;
  if (urlOverride("rqadr") === "1") { st.qadr = true; st.day = Math.max(st.day, 23); }

  // ── ?debug bar override (DEBUG_PRESETS via onAction) ──
  const dbg = p._rmState?.debugOverride;
  if (dbg) {
    st.phase = dbg.phase; st.mode = dbg.mode;
    if (dbg.qadr) { st.qadr = true; st.day = dbg.day ?? 23; }
    else st.qadr = false;
    // Focus + countdown target follow the preset so the label matches the
    // previewed moment (e.g. "Day" shows Until Iftar even at real night).
    if (dbg.focus) {
      st.focus = dbg.focus;
      if (dbg.focus === "fast") {
        st.target = nextOccurrence(d.maghrib, now); st.targetKey = "until_iftar";
      } else {
        st.target = nextOccurrence(d.imsak ?? d.fajr, now);
        st.targetKey = "rme_until_suhoor";
      }
    }
  }

  return st;
}

/* Debug presets — mirrors the approved mockup's preview bar 1:1. */
const DEBUG_PRESETS = {
  night:   { phase: "night",   mode: "normal", qadr: false, focus: "evening" },
  prefajr: { phase: "night",   mode: "normal", qadr: false, focus: "suhoor" },
  fajr:    { phase: "fajr",    mode: "normal", qadr: false, focus: "fast" },
  day:     { phase: "day",     mode: "normal", qadr: false, focus: "fast" },
  maghrib: { phase: "maghrib", mode: "normal", qadr: false, focus: "fast" },
  prep:    { phase: "maghrib", mode: "prep",   qadr: false, focus: "fast" },
  moment:  { phase: "maghrib", mode: "moment", qadr: false, focus: "evening" },
  after:   { phase: "maghrib", mode: "after",  qadr: false, focus: "evening" },
  qadr:    { phase: "night",   mode: "normal", qadr: true, day: 23, focus: "evening" },
};
const DEBUG_ORDER = ["night", "prefajr", "fajr", "day", "maghrib", "prep", "moment", "after", "qadr"];
const DEBUG_LABELS = {
  night: "Night", prefajr: "Pre-Fajr", fajr: "Fajr", day: "Day",
  maghrib: "Maghrib −45m", prep: "Prep", moment: "Moment", after: "After",
  qadr: "Laylat al-Qadr",
};

function fmtCountdown(msLeft) {
  if (msLeft == null) return "—:—:—";
  let s = Math.max(0, Math.floor(msLeft / 1000));
  const h = Math.floor(s / 3600); s -= h * 3600;
  const m = Math.floor(s / 60); s -= m * 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

function hhmm(date) {
  if (!date) return "—";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/* ─────────────────────────── CSS ───────────────────────────────────────
   Scoped under .r-app; palette comes from the host's theme-ramadan-* CSS
   vars (already defined in nida-panel.js _css()), the hero painting from
   --img-heroramadan / --img-heroramadanlight. No hardcoded widths. */

export function css(p) {
  return `
  .r-app{min-height:100vh;font-family:'Inter',system-ui,sans-serif;
    color:var(--nida-text);position:relative;
    --r-gold:#F6C24A;--r-gold-soft:#F9E7A1;--r-green:#36D98A;
    --r-line:rgba(246,194,74,.16);--r-dur:2.8s;
    --r-radius:clamp(14px,1.6vw,22px);--r-gap:clamp(10px,1.4vw,18px)}
  .r-app *{box-sizing:border-box}

  /* page background: crossfading day phases (near-black night, v0.3).
     Absolute inside .r-bgstack, NOT fixed — position:fixed inside the
     panel's shadow tree is unreliable under transformed ancestors
     (the 2.0.11 lesson). .r-bgstack spans the full scroll height. */
  .r-bgstack{position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none}
  .r-sky{position:absolute;inset:0;opacity:0;transition:opacity var(--r-dur) ease}
  .r-sky.n{background:linear-gradient(180deg,#010504 0%,#040E09 55%,#07160E 100%)}
  .r-sky.f{background:linear-gradient(180deg,#0A171E 0%,#1B3A33 45%,#8A5A3C 90%,#C98F5E 115%)}
  .r-sky.d{background:linear-gradient(180deg,#BFD3C4 0%,#DCE5CE 55%,#F2EEDD 100%)}
  .r-sky.m{background:linear-gradient(180deg,#05100A 0%,#123023 45%,#6E3A16 86%,#B4552A 112%)}
  /* page-level horizon warmth: a wide ellipse bleeding down from the top
     edge (the page "horizon" sits behind the hero) — east at Fajr, west
     and redder at Maghrib. */
  .r-sunpage{position:absolute;top:0;left:0;right:0;height:46%;opacity:0;
    pointer-events:none;mix-blend-mode:screen;
    transition:opacity var(--r-dur) ease;
    background:radial-gradient(ellipse 50% 70% at 20% 0%,
      rgba(255,175,135,.4),rgba(255,150,100,.14) 50%,transparent 72%)}
  .r-phase-fajr .r-sunpage{opacity:.85}
  .r-phase-maghrib .r-sunpage{opacity:.95;
    background:radial-gradient(ellipse 52% 72% at 74% 0%,
      rgba(255,130,70,.45),rgba(220,80,45,.18) 50%,transparent 72%)}
  .r-phase-night .r-sky.n,.r-phase-fajr .r-sky.f,
  .r-phase-day .r-sky.d,.r-phase-maghrib .r-sky.m{opacity:1}
  .r-goldwash{position:absolute;inset:0;opacity:0;transition:opacity 2.2s ease;
    background:radial-gradient(ellipse 90% 70% at 50% 60%,rgba(246,194,74,.28),rgba(246,194,74,.06) 55%,transparent 75%)}
  .r-mode-moment .r-goldwash{opacity:1}
  .r-mode-after .r-goldwash{opacity:.55}
  .r-stars{position:absolute;inset:0;opacity:0;transition:opacity var(--r-dur) ease}
  .r-stars i{position:absolute;border-radius:50%;background:#F9E7A1;
    animation:r-tw 4s ease-in-out infinite}
  .r-phase-night .r-stars{opacity:.9}
  .r-phase-fajr .r-stars{opacity:.18}.r-phase-day .r-stars{opacity:0}
  .r-phase-maghrib .r-stars{opacity:.55}
  .r-qadr .r-stars{opacity:1}
  @keyframes r-tw{0%,100%{opacity:.25}50%{opacity:1}}
  @keyframes r-breathe{0%,100%{opacity:.55}50%{opacity:.95}}
  @keyframes r-fadein{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
  @media (prefers-reduced-motion:reduce){
    .r-stars i,.r-hero-glow{animation:none !important}}

  /* single column */
  /* device tiers: phone ≤600 / tablet 601-1279 (base) / pc ≥1280 /
     tv = Fully Kiosk detection (.r-tv class, see html()) or ?rtv=1 —
     deliberately NOT a width media query so a wide PC monitor never
     gets couch-distance TV sizing. */
  .r-wrap{position:relative;z-index:1;width:min(92vw,880px);margin-inline:auto;
    display:flex;flex-direction:column;gap:var(--r-gap);
    padding-block:clamp(12px,2vh,28px) clamp(28px,4vh,56px)}
  @media (min-width:1280px){.r-wrap{width:min(80vw,840px)}}
  .r-sec-hero{order:1}.r-sec-schedule{order:2}.r-sec-qadr{order:3}
  .r-sec-progress{order:4}.r-sec-dua{order:5}.r-sec-quran{order:6}
  .r-focus-evening .r-sec-quran{order:4}
  .r-focus-evening .r-sec-progress{order:5}
  .r-focus-evening .r-sec-dua{order:6}

  /* cards = illustrated scenes */
  .r-card{position:relative;border-radius:var(--r-radius);overflow:hidden;isolation:isolate;
    border:1px solid var(--r-line);
    background:linear-gradient(165deg,rgba(17,36,27,.58),rgba(8,20,15,.4));
    -webkit-backdrop-filter:blur(18px) saturate(1.15);
    backdrop-filter:blur(18px) saturate(1.15);
    box-shadow:0 24px 70px -30px rgba(0,0,0,.8),inset 0 1px 0 rgba(249,231,161,.07);
    transition:border-color 1.8s ease,box-shadow 1.8s ease}
  .r-mode-prep .r-card,.r-mode-moment .r-card,.r-qadr .r-card{
    border-color:rgba(246,194,74,.35);
    box-shadow:0 24px 70px -30px rgba(0,0,0,.8),0 0 42px -18px rgba(246,194,74,.35),
               inset 0 1px 0 rgba(249,231,161,.1)}
  .r-scene{position:absolute;inset:-3%;z-index:0;pointer-events:none;
    background:var(--img-heroramadan) center bottom/cover no-repeat #04100A;
    transition:filter var(--r-dur) ease,opacity var(--r-dur) ease}
  .r-scrim{position:absolute;inset:0;z-index:1;pointer-events:none}
  .r-content{position:relative;z-index:2;padding:clamp(12px,1.8vw,22px)}
  .r-kicker{font-size:clamp(.58rem,.52rem + .2vw,.72rem);letter-spacing:.2em;
    text-transform:uppercase;color:var(--nida-text-dim);font-weight:600}
  .r-sub{color:var(--nida-text-dim);font-size:clamp(.75rem,.68rem + .25vw,.9rem)}
  .r-arabic{font-family:'Amiri','Scheherazade New',serif;direction:rtl}

  /* header */
  .r-header{display:flex;align-items:center;gap:clamp(10px,1.4vw,18px);order:0;
    padding-inline:clamp(2px,.5vw,8px)}
  .r-appicon{width:clamp(38px,3.6vw,50px);aspect-ratio:1;border-radius:26%;flex:none;
    display:grid;place-items:center;
    background:linear-gradient(150deg,#153524,#0B1F15);
    border:1px solid rgba(246,194,74,.45);
    box-shadow:0 0 22px -6px rgba(246,194,74,.35),inset 0 1px 0 rgba(249,231,161,.15)}
  .r-appicon img{width:78%;height:auto;display:block;
    filter:drop-shadow(0 0 10px rgba(54,217,138,.35))}
  .r-brand{display:flex;align-items:baseline;gap:clamp(8px,1vw,14px)}
  .r-brand .t{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:800;
    font-size:clamp(1.25rem,1rem + 1vw,1.8rem)}
  .r-brand .t sup{font-size:.5em;color:var(--r-gold-soft);position:relative;top:-.35em;left:-5px}
  .r-pill{border:1px solid rgba(246,194,74,.55);color:var(--r-gold-soft);
    padding:.3em .95em;border-radius:999px;font-weight:600;white-space:nowrap;
    font-size:clamp(.68rem,.6rem + .25vw,.85rem);background:rgba(246,194,74,.07);
    transition:all 1.2s ease}
  .r-qadr .r-pill{background:rgba(246,194,74,.16);color:#FFEDB8;
    box-shadow:0 0 18px -4px rgba(246,194,74,.5)}
  .r-hright{margin-left:auto;display:flex;gap:clamp(8px,1vw,12px)}
  .r-hbtn{width:clamp(34px,3vw,44px);aspect-ratio:1;border-radius:30%;cursor:pointer;
    display:grid;place-items:center;border:1px solid var(--r-line);
    background:rgba(17,36,27,.55);color:var(--r-gold-soft);
    transition:border-color .3s,box-shadow .3s}
  .r-hbtn:hover{border-color:rgba(246,194,74,.5);box-shadow:0 0 16px -4px rgba(246,194,74,.4)}
  .r-hbtn svg{width:52%;height:52%;fill:none;stroke:currentColor;stroke-width:1.8;
    stroke-linecap:round;stroke-linejoin:round}

  /* hero */
  .r-hero{min-height:clamp(200px,24vh,320px)}
  .r-hero .r-scrim{background:
    linear-gradient(90deg,rgba(4,12,8,.55),rgba(4,12,8,.15) 42%,transparent 60%),
    linear-gradient(0deg,rgba(4,12,8,.45),transparent 45%)}
  /* daylight watercolor layer — --img-light is set at runtime from the
     panel's own --img-heroramadanlight declaration (see live()), so the
     big asset is never duplicated. */
  .r-hero .r-img-day{position:absolute;inset:-3%;z-index:0;opacity:0;
    background:var(--img-light,var(--img-heroramadan)) center 62%/cover no-repeat;
    transition:opacity var(--r-dur) ease}
  .r-phase-day .r-hero .r-img-day{opacity:1}
  /* sun-below-horizon glow: an ellipse anchored just UNDER the bottom
     edge of the painting, so only its upper arc rises above the horizon —
     rosy in the east at Fajr, deeper red-orange in the west at Maghrib. */
  .r-sunglow{position:absolute;left:0;right:0;bottom:0;height:62%;z-index:1;
    opacity:0;pointer-events:none;mix-blend-mode:screen;
    transition:opacity var(--r-dur) ease;
    background:radial-gradient(ellipse 42% 58% at 22% 106%,
      rgba(255,190,150,.85),rgba(255,140,100,.3) 45%,transparent 72%)}
  .r-phase-fajr .r-sunglow{opacity:.95}
  .r-phase-maghrib .r-sunglow{opacity:1;
    background:radial-gradient(ellipse 46% 62% at 72% 108%,
      rgba(255,140,70,.95),rgba(232,92,50,.4) 40%,rgba(200,70,40,.16) 58%,transparent 75%)}
  .r-hero .r-ov{position:absolute;inset:0;z-index:1;opacity:0;pointer-events:none;
    transition:opacity var(--r-dur) ease;mix-blend-mode:screen}
  .r-hero .r-ov.dawn{background:linear-gradient(0deg,rgba(255,172,130,.5),rgba(255,172,130,.08) 45%,transparent 65%)}
  .r-hero .r-ov.warm{background:radial-gradient(ellipse 85% 65% at 72% 105%,rgba(255,196,100,.6),rgba(255,196,100,.12) 55%,transparent 78%)}
  .r-hero .r-ov.bright{background:linear-gradient(0deg,rgba(255,244,214,.34),rgba(255,244,214,.1) 55%,transparent)}
  .r-phase-fajr .r-hero .r-ov.dawn{opacity:.9}
  .r-phase-maghrib .r-hero .r-ov.warm{opacity:.7}
  .r-mode-prep .r-hero .r-ov.warm,.r-mode-moment .r-hero .r-ov.warm,
  .r-mode-after .r-hero .r-ov.warm{opacity:1}
  .r-hero .r-content{min-height:inherit;display:flex;flex-direction:column;
    justify-content:flex-start;padding:clamp(16px,2.2vw,28px)}
  .r-hv{animation:r-fadein 1.1s ease}
  .r-hv-row{display:flex;flex-wrap:wrap;gap:clamp(16px,3vw,44px);align-items:stretch}
  .r-hv-left{flex:1 1 260px;min-width:0}
  /* clock pinned to the TOP of the hero (was vertically centered — it
     landed on the minarets at tablet widths). */
  .r-hv-right{flex:0 1 auto;margin-left:auto;text-align:right;
    display:flex;flex-direction:column;justify-content:flex-start;
    padding-top:clamp(2px,.6vw,10px)}
  /* narrow screens: the right column would wrap BELOW the left block and
     land on the mosque silhouette — instead the countdown moves to the
     TOP (full width, right-aligned above the minarets), matching the
     dynamic-focus priority (countdown first). */
  @media (max-width:900px){
    .r-hero .r-content{justify-content:flex-start}
    .r-hv-row{align-items:flex-start}
    .r-hv-right{order:-1;flex:1 0 100%;width:100%;margin-left:0;
      display:block;text-align:right}
  }
  .r-bigname{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:700;
    font-size:clamp(1.5rem,1.1rem + 1.6vw,2.4rem);line-height:1.05}
  .r-timer{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:700;
    color:var(--r-green);font-size:clamp(2rem,1.3rem + 2.2vw,3.3rem);line-height:1;
    text-shadow:0 0 26px rgba(54,217,138,.35);font-variant-numeric:tabular-nums}
  .r-timer.gold{color:var(--r-gold);text-shadow:0 0 26px rgba(246,194,74,.4)}
  .r-mealline{display:flex;align-items:center;gap:.7em;margin-top:clamp(8px,1.2vw,16px)}
  .r-mealline .ic{width:2.1em;height:2.1em;border-radius:50%;display:grid;place-items:center;
    background:rgba(246,194,74,.14);border:1px solid rgba(246,194,74,.4)}
  .r-mealline .ic svg{width:58%;height:58%;fill:none;stroke:var(--r-gold);stroke-width:1.8;
    stroke-linecap:round}
  .r-mealline b{color:var(--r-gold-soft);display:block;font-weight:600}
  .r-lastblock{margin-top:clamp(8px,1.2vw,14px);padding-top:clamp(6px,1vw,12px);
    border-top:1px solid rgba(249,231,161,.18);max-width:16em}
  .r-lastblock .n{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:700;
    font-size:1.05em}
  .r-lastblock .tm{color:var(--r-green);font-size:.95em}
  .r-chips{display:flex;flex-wrap:wrap;gap:.6em;margin-top:clamp(12px,1.6vw,20px)}
  .r-chip{padding:.42em 1em;border-radius:999px;font-size:.85em;font-weight:500;
    border:1px solid rgba(249,231,161,.25);background:rgba(8,20,15,.45);
    color:var(--r-gold-soft)}
  .r-chip.dim{color:var(--nida-text-dim)}
  .r-hv-center{text-align:center;margin-block:auto} /* ceremonial variants stay centered */
  .r-hv-center .r-arabic{color:var(--r-gold-soft);
    font-size:clamp(1.5rem,1rem + 2vw,2.7rem);line-height:1.7;
    text-shadow:0 0 34px rgba(246,194,74,.45)}
  .r-hv-center .l2{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:700;
    color:var(--r-gold-soft);font-size:clamp(1.05rem,.9rem + 1vw,1.6rem);margin-top:.4em}
  .r-orn{display:flex;align-items:center;gap:1em;justify-content:center;
    margin:clamp(10px,1.6vw,20px) auto;color:var(--r-gold);opacity:.85}
  .r-orn::before,.r-orn::after{content:"";height:1px;width:clamp(40px,7vw,110px);
    background:linear-gradient(90deg,transparent,rgba(246,194,74,.7))}
  .r-orn::after{background:linear-gradient(90deg,rgba(246,194,74,.7),transparent)}

  /* schedule */
  .r-schedule .r-scene{background-size:auto 190%;background-position:62% 78%;
    filter:brightness(.35)}
  .r-schedule .r-scrim{background:linear-gradient(0deg,rgba(4,12,8,.6),rgba(4,12,8,.25) 55%,rgba(4,12,8,.1))}
  .r-schhead{display:flex;flex-wrap:wrap;gap:.6em;align-items:baseline;
    margin-bottom:clamp(10px,1.4vw,18px)}
  .r-schhead .hj{color:var(--r-green);font-weight:600}
  .r-schhead .gg{margin-left:auto;color:var(--nida-text-dim)}
  @media (max-width:600px){.r-schhead .gg{margin-left:0;width:100%}}
  .r-prow{display:flex;align-items:center;gap:1em;
    padding:clamp(5px,.7vw,9px) clamp(8px,1vw,14px);
    border-radius:12px;border:1px solid transparent;transition:all .8s ease}
  .r-prow .nm{font-weight:600;font-size:.95em}
  .r-prow .tag{margin-left:auto;margin-right:1em;font-size:.8em;color:var(--r-gold-soft);
    border:1px solid rgba(246,194,74,.4);border-radius:999px;padding:.25em .9em;
    background:rgba(246,194,74,.08)}
  .r-prow .tag:empty{display:none}
  .r-prow .tm{font-variant-numeric:tabular-nums;font-weight:600;margin-left:auto}
  .r-prow .tag + .tm{margin-left:0}
  .r-prow .ck{width:1.05em;height:1.05em;color:var(--r-green);opacity:0}
  .r-prow.past{opacity:.62}.r-prow.past .ck{opacity:1}
  .r-prow.next{border-color:rgba(246,194,74,.55);background:rgba(246,194,74,.07);opacity:1}
  .r-prow.next .nm,.r-prow.next .tm{color:var(--r-gold-soft)}

  /* progress */
  .r-progress .r-scene{background-size:auto 210%;background-position:88% 72%;
    filter:brightness(.48)}
  .r-progress .r-scrim{background:linear-gradient(90deg,rgba(4,12,8,.55),transparent 55%)}
  .r-progress .r-content{display:flex;flex-wrap:wrap;gap:clamp(16px,2.6vw,36px);
    align-items:center}
  .r-progday{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:800;
    font-size:clamp(1.5rem,1.1rem + 1.4vw,2.3rem);line-height:1.1}
  .r-progday b{color:var(--r-green)}
  .r-progday span{color:var(--nida-text-dim);font-size:.55em;font-weight:600}
  .r-ring{position:relative;width:clamp(84px,9vw,120px);aspect-ratio:1;flex:none}
  .r-ring svg{width:100%;height:100%;transform:rotate(-90deg)}
  .r-ring .bg{fill:none;stroke:rgba(249,231,161,.12);stroke-width:9}
  .r-ring .fg{fill:none;stroke:url(#r-ringgrad);stroke-width:9;stroke-linecap:round;
    filter:drop-shadow(0 0 8px rgba(54,217,138,.45))}
  .r-ring .ctr{position:absolute;inset:0;display:grid;place-items:center}
  .r-ring .ctr svg{transform:none;width:38%;height:38%}
  .r-moonstrip{width:100%;display:flex;flex-wrap:wrap;gap:clamp(4px,.6vw,9px);
    justify-content:center;margin-top:clamp(8px,1.2vw,14px)}
  .r-moonstrip svg{width:clamp(10px,1.1vw,14px);height:clamp(10px,1.1vw,14px)}

  /* dua */
  .r-dua .r-scene{background-size:auto 240%;background-position:12% 30%;
    filter:brightness(.45) blur(1.5px)}
  .r-dua .r-scrim{background:radial-gradient(ellipse at center,rgba(4,12,8,.45),rgba(4,12,8,.12) 75%)}
  .r-dua .r-content{text-align:center;padding:clamp(16px,2.2vw,30px)}
  .r-dua .r-arabic{color:var(--r-gold-soft);font-size:clamp(1.05rem,.9rem + 1vw,1.7rem);
    line-height:1.9;text-shadow:0 0 26px rgba(246,194,74,.3)}
  .r-dua .trans{color:var(--nida-text-dim);max-width:44em;margin:0 auto;
    font-size:clamp(.75rem,.68rem + .3vw,.95rem)}

  /* quran */
  .r-quran .r-scene{background-size:auto 200%;background-position:38% 82%;
    filter:brightness(.4)}
  .r-quran .r-scrim{background:linear-gradient(90deg,rgba(4,12,8,.6),rgba(4,12,8,.2) 55%,transparent)}
  .r-quran .r-content{display:flex;flex-wrap:wrap;align-items:center;
    gap:clamp(14px,2.4vw,32px)}
  .r-quran .val{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:800;
    font-size:clamp(1.3rem,1rem + 1vw,1.9rem);line-height:1.05;display:block}
  .r-quran .val b{color:var(--r-green)}
  .r-quran .val .u{color:var(--nida-text-dim);font-size:.5em;font-weight:600}
  .r-jbtn{width:2.2em;height:2.2em;border-radius:50%;cursor:pointer;font:inherit;
    color:var(--r-gold-soft);background:rgba(246,194,74,.1);
    border:1px solid rgba(246,194,74,.4);font-weight:700;line-height:1}
  .r-jbtn:hover{background:rgba(246,194,74,.2)}

  /* ornament placements */
  .r-qadr-art{width:min(38%,260px);height:auto;display:block;margin:0 auto .4em;
    filter:drop-shadow(0 0 26px rgba(246,194,74,.35))}
  .r-qadr-lanterns{position:absolute;right:clamp(6px,3%,36px);top:0;z-index:1;
    width:clamp(56px,9%,110px);height:auto;opacity:.92;pointer-events:none;
    filter:drop-shadow(0 0 20px rgba(246,194,74,.4));
    animation:r-breathe 6s ease-in-out infinite}
  .r-prog-lantern{position:absolute;right:clamp(10px,4%,40px);top:50%;z-index:1;
    transform:translateY(-50%);width:clamp(42px,6%,78px);height:auto;
    pointer-events:none;filter:drop-shadow(0 0 24px rgba(246,194,74,.55))}
  .r-dua-arab{position:absolute;left:50%;top:50%;z-index:0;
    transform:translate(-50%,-50%);width:min(38%,240px);opacity:.14;
    pointer-events:none}

  /* qadr */
  .r-sec-qadr{display:none}
  .r-qadr .r-sec-qadr{display:block;animation:r-fadein 1.4s ease}
  .r-qadrcard .r-scene{background-size:auto 170%;background-position:18% 22%;
    filter:brightness(.58)}

  /* ── daytime (Dhuhr/Asr): the whole app turns light ──
     Card scenes switch to the daylight watercolor, glass goes cream,
     text flips dark. Scrim overrides need !important because the
     per-card scrims are inline styles. */
  .r-app.r-phase-day{--nida-text:#20342A;--nida-text-dim:#5C6E60;
    --r-line:rgba(150,120,50,.35);--r-gold-soft:#8A6A1F}
  .r-phase-day .r-card{
    background:linear-gradient(165deg,rgba(255,253,246,.8),rgba(240,236,222,.62));
    border-color:rgba(150,120,50,.3)}
  /* calm daytime: only the HERO carries the painting; the other cards go
     clean cream (Johann: "de dag is te druk met dezelfde achtergrond").
     The hero's own night layer fades out too — .r-img-day takes over. */
  .r-phase-day .r-scene{opacity:0}
  .r-phase-day .r-qadr-art,.r-phase-day .r-qadr-lanterns{display:none}
  .r-phase-day .r-qadrchips .r-chip{color:#7A5C14;
    background:rgba(246,194,74,.22);border-color:rgba(150,120,50,.45)}
  .r-phase-day .r-scrim{background:linear-gradient(90deg,rgba(255,252,243,.72),
    rgba(255,252,243,.3) 50%,rgba(255,252,243,.08)) !important}
  .r-phase-day .r-timer{color:#178A50;text-shadow:0 0 22px rgba(23,138,80,.25)}
  .r-phase-day .r-chip{background:rgba(255,255,255,.6);border-color:rgba(32,52,42,.25);color:#3C5244}
  .r-phase-day .r-prow.next{background:rgba(246,194,74,.2)}
  .r-phase-day .r-prow .tag{background:rgba(246,194,74,.25);color:#7A5C14}
  .r-phase-day .r-hbtn{background:rgba(255,253,246,.65);color:#8A6A1F}
  .r-phase-day .r-pill{background:rgba(246,194,74,.18);color:#8A6A1F;
    border-color:rgba(150,120,50,.5)}
  .r-phase-day .r-schhead .hj,.r-phase-day .r-lastblock .tm{color:#178A50}
  .r-phase-day .r-moonstrip svg circle[fill="none"]{stroke:rgba(92,110,96,.5)}
  .r-phase-day .r-dua .r-arabic,.r-phase-day .r-hv-center .r-arabic{
    color:#7A5C14;text-shadow:none}
  .r-qadrcard .r-scrim{background:radial-gradient(ellipse at center,rgba(4,12,8,.5),rgba(4,12,8,.15) 70%)}
  .r-qadrcard .r-content{text-align:center}
  .r-qadrcard .nn{font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:800;
    font-size:clamp(1.35rem,1.05rem + 1.3vw,2.1rem)}
  .r-qadrcard .nn b{color:var(--r-gold)}
  .r-qadrchips{display:flex;flex-wrap:wrap;gap:.6em;justify-content:center;margin-top:1.1em}
  .r-qadrchips .r-chip{border-color:rgba(246,194,74,.5);color:#FFEDB8;
    background:rgba(246,194,74,.1)}

  /* settings drawer — a native <dialog> so showModal() lifts it into the
     top layer, immune to transformed ancestors (2.0.11 lesson). Hosts the
     existing settings sections untouched. */
  .r-drawer{margin:0 0 0 auto;width:min(520px,96vw);height:100dvh;max-height:100dvh;
    border:none;border-left:1px solid rgba(246,194,74,.25);
    background:linear-gradient(200deg,rgba(17,36,27,.97),rgba(8,20,15,.99));
    box-shadow:-30px 0 80px rgba(0,0,0,.6);color:var(--nida-text);
    padding:clamp(14px,2.4vh,26px);overflow-y:auto}
  .r-drawer::backdrop{background:rgba(3,8,6,.6)}
  .r-drawer-head{display:flex;align-items:center;gap:.6em;
    font-family:var(--nida-display-font,'Cairo'),sans-serif;font-weight:700;
    font-size:1.25rem;margin-bottom:.6em}
  .r-drawer-head svg{width:1.1em;height:1.1em;fill:none;stroke:var(--r-gold-soft);
    stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
  .r-dclose{margin-left:auto;cursor:pointer;background:none;border:none;
    color:var(--nida-text-dim);font-size:1.6rem;line-height:1}
  .r-footer{order:9;text-align:center;color:var(--nida-text-dim);
    font-size:.8rem}

  /* ── debug bar (?ramadan&debug) — preview tool, sticky at the bottom.
     Colors hardcoded so the day-phase light palette can't wash it out. */
  .r-debug{position:sticky;bottom:clamp(8px,1.5vh,16px);z-index:30;order:99;
    display:flex;flex-wrap:wrap;justify-content:center;gap:6px;
    margin-inline:auto;padding:8px 12px;border-radius:18px;max-width:100%;
    background:rgba(5,12,9,.88);border:1px solid rgba(249,231,161,.22);
    box-shadow:0 14px 40px rgba(0,0,0,.55)}
  .r-debug .lbl{width:100%;text-align:center;font-size:.58rem;
    letter-spacing:.25em;color:#A7B3A7;text-transform:uppercase}
  .r-debug button{font:inherit;font-size:.72rem;cursor:pointer;
    color:#A7B3A7;background:transparent;border:1px solid transparent;
    border-radius:10px;padding:.35em .8em;transition:all .25s}
  .r-debug button:hover{color:#F5F7F5}
  .r-debug button.on{color:#F9E7A1;border-color:rgba(246,194,74,.5);
    background:rgba(246,194,74,.12)}
  .r-debug button.cy{color:#36D98A;border-color:rgba(54,217,138,.35)}
  .r-debug button.cl{color:#F6C24A;border-color:rgba(246,194,74,.45);
    margin-inline-start:auto}

  /* 2.3.10 — in preview mode the bar is PINNED to the viewport, not
     sticky. As the last child of .r-wrap it had no sticky range to
     travel: a sticky element can only stick while its own parent's box
     is on screen, and .r-wrap ends immediately after it — so it behaved
     like a plain block at the foot of a long scrolling page, which is
     why Johann never found it ("onderin niet het pallet"). A stepper you
     have to go looking for defeats the point of a preview.
     position:fixed is safe here specifically: neither .r-app nor .r-wrap
     is transformed (a transformed ancestor would re-anchor it — the same
     trap that made the settings drawer a <dialog>). The extra bottom
     padding keeps the last card clear of the bar. */
  .r-preview .r-debug{position:fixed;inset-inline:0;bottom:clamp(10px,2vh,20px);
    width:max-content;max-width:min(96vw,940px);margin-inline:auto}
  .r-preview .r-wrap{padding-bottom:clamp(130px,20vh,200px)}

  /* ── phone (≤600px): tighter, decorations trimmed ── */
  @media (max-width:600px){
    .r-wrap{width:96vw}
    .r-hero{min-height:160px}
    .r-content{padding:12px 14px}
    .r-hero .r-content{padding:14px 16px}
    .r-prow{padding:5px 8px}
    .r-moonstrip svg{width:9px;height:9px}
    .r-ring{width:76px}
    .r-qadr-lanterns{display:none}
    .r-qadr-art{width:min(62%,220px)}
    .r-prog-lantern{width:38px;right:8px}
    .r-chips{gap:.4em}
    .r-drawer{width:100vw;border-left:none}
  }

  /* ── tv (.r-tv = Fully Kiosk / ?rtv=1): couch-distance scale ── */
  .r-tv .r-wrap{width:min(78vw,1280px)}
  .r-tv .r-hero{min-height:clamp(320px,34vh,420px)}
  .r-tv .r-content{padding:clamp(20px,2vw,32px)}
  .r-tv .r-kicker{font-size:.85rem}
  .r-tv .r-sub{font-size:1.05rem}
  .r-tv .r-bigname{font-size:clamp(2rem,1.4rem + 1.6vw,3rem)}
  .r-tv .r-timer{font-size:clamp(2.4rem,1.8rem + 1.8vw,3.7rem)}
  .r-tv .r-prow{padding:10px 16px}
  .r-tv .r-prow .nm{font-size:1.15em}
  .r-tv .r-prow .tm{font-size:1.1em}
  .r-tv .r-progday{font-size:clamp(2rem,1.6rem + 1.2vw,2.8rem)}
  .r-tv .r-ring{width:clamp(120px,10vw,160px)}
  .r-tv .r-moonstrip svg{width:16px;height:16px}
  .r-tv .r-dua .r-arabic{font-size:clamp(1.6rem,1.2rem + 1.2vw,2.3rem)}
  .r-tv .r-dua .trans{font-size:1.05rem}
  .r-tv .r-quran .val{font-size:clamp(1.7rem,1.4rem + 1vw,2.4rem)}
  .r-tv .r-qadrcard .nn{font-size:clamp(1.9rem,1.5rem + 1.2vw,2.7rem)}
  .r-tv .r-qadr-art{width:min(44%,360px)}
  .r-tv .r-qadr-lanterns{width:clamp(90px,10%,150px)}
  .r-tv .r-prog-lantern{width:clamp(64px,7%,100px)}
  .r-tv .r-appicon{width:60px}
  .r-tv .r-brand .t{font-size:2.1rem}
  .r-tv .r-pill{font-size:1rem}
  .r-tv .r-hbtn{width:52px}
  .r-tv .r-chip{font-size:1em}
  .r-tv .r-lastblock .n{font-size:1.2em}
  .r-tv .r-hv-center .r-arabic{font-size:clamp(2.2rem,1.6rem + 2vw,3.6rem)}
  .r-tv .r-hv-center .l2{font-size:clamp(1.5rem,1.2rem + 1vw,2.1rem)}
  `;
}

/* ─────────────────────── watercolor ornaments ──────────────────────────
   Sliced from Johann's approved ornament sheet (2026-07-11): watercolor
   mosque icon (header), Laylat al-Qadr script + hanging lanterns (qadr
   card), gold lantern (progress card), arabesque medallion (dua card).
   WebP with alpha, embedded so the HACS zip stays self-contained. */

const ASSETS = {
  mosqueIcon: "data:image/webp;base64,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",
  qadrScript: "data:image/webp;base64,UklGRkaTAABXRUJQVlA4WAoAAAAQAAAAbwEAtwAAQUxQSCxgAAAB/yckSPD/eGtEpO4TkgSwjdsIpAtBpIX/P1hyls5yjuj/BOA/X19wfIC1XfmJC8i3irmdl4H1tJ7WC1k6XIgN8LreWgt+mnMrOHOttL36utJ25rby6rKvyMJENhOuLN9ZtZatuKtsWwqsZacZKglA5sy0Q0FSEdReNvVi3NmDB1Kqknqbk9RkPx5+1LO7aQAg68jjNcg5X7gkzej9NMlND9xfGJI0tnsT8UOSsx/6dUkqlSRBxnGQ5KFJ1ks9VHJIAHByInbydt+kNLoliRwaNgIvR6DVHXa3Q5JISbppC2fl0y50tyTb3jx0w3hRfg0YBmAjbIlt4ZfaId3GLx+/4n7howyIbdsIkjS23H/Rs3t3/xVExAQACAogt9wCOBFA7lzP8nrU8CivT+8K4AMieIFASC6fpEV+u4dnc9lV8CdtCSDhFnoKtL3a6mXvpID9IDvFz3q1TTkOSBEF7Lls07SlLTbFDtImbZo04M5B0/TD9V5X+zm75tp2b+36/a48rNu6rXvvzra129bt7AweuvO48/3OpwVz/um2y/6Hrbdpsz/b2jatRtOXdTvb0+6zrXdiimKbbev7tvXjNN6Xtn7xZRJNVpRbzbJ13zijAqYFFATFVdPj3mJiYgAUhA/es12LGiGJgLxKBB6SaBJdEhUQiPj2HLFRjRqMAuEW4jmybdW2bdvKqbTWx6TNzMzMqMPeAmwBlgpbBIxvVZYcO8YKMPOeLdBqKSXX2tuc4YiYAL21bbu2rS2t9bHvh9ba1iI5TNKAGAiGMLSH+Qt4b8/ejfPIISImANu1bcckyR7Ued33/TzPq3gD6axKTGVm27bGts1t27a990d9sm3btm20Ro14IzKy9o6ICfC//79qO822T+/7HWNMWS7b3eMhHuIetI5ToWfd3aifnFJ3oT1bCpSzSKCGQ5CQYMmOe/bOdlvblq81ZdgPcJLQ64qICfBc25Zi27ZtlVKbmfc+xpi0meEwM4dOlMMcY/G2AkefowOfY82sjwkCRMQE+Lpt27RtW9sHlXMutbbWex+Yay5zrmPbtm3e2tbleXzpqyc8t7Ztm8fGMuZcAx2t1VLyxcLznIiYAA7dt/9Dm+cacmhJDi3Msb/hH/86Dg05VLw9/TOHvBxaUlP19T/+hzaeSxy65/1/iufa/q8hBzrUtjb97yGJHtuAgg0ZI+mjeHERChcWaXu2q8noyUc3NUOI07ItOgHkY8Y6aYwkhfqet5LOJCSbutJHBzvDo4xEEg1pp0PStxF00nhy2xQnJASKPlpUPGInEBCg5AZ1WYGCJBJGqORBE83ldPeELhK24CTB5x5Nj9MFlooRldm+WOquqZV92Hxv8upskd39bQiOAepSy5mfK6NUZRQD9CjZwpiCWIaEFiNpwUWKWpkpWATCcKly6tl0QZI+iRVDmDghbcIQS7TERooJ0allQ0MSxACLCVMEfS8CJKPqBIGDDHDrkFltwX2SMGUmEq6rRJMDIwpjJHGCyorPr+vEjCCjF5uJSjPQ4oDMuHzIrq5XN3151PKzYwsXGbfO6kjipC4j4SJsJHS0tZiFG7tt3mmXQhIJs9btRIJEhdte0ZtvNpjhUw2bOXS9oAsUKFdL3Tsqv/WByr5NCB+bQcjKjFVjqXv0bE6+tGgquk9OK8cdcAlIwqAAtRFyHTGghhSLnfEtuHvEYsuj0FUiqyCnVUf90BkTU3LuIO6DGpgQEgakiBMFmzCQxEICqbCmyzvTaCkSOIUokSBJbugwYl9HsLMiL6V7l+WaTyBK0j7gis3FMtBNi7oQFyW1Ij02E7bIqzOghXBhGMu630bIl1ZOWcWT+xlQ6G5JMySF3LTc5NWQO2RGbZJ+D0Y45oCWm1ji9XsBgURIinlt1z5ry9Cp9pExnTaLkBv55VMHlyQad4rQkltUQK0ryfPdH7T5gXeNZKcq0tk/KlCZTS2QzbbUVIef3mWTzB98wCe/4uM/ZSxDrvWpUStKBFRTRSyGT6IFLmHDxARsMa/eXbq31kwEgpW2GYtKMGQQb9eAhKxC5OTUZ3DtQkLGfJjsOPDh4kQlKJJRY0wcGGwg5PckstLyRmfEcmnR8XYvYDgYCErxXTEBQEAEAEKRbY6ZTHCPXuhXXqkyutyIJQAovG64ak7EZKkQq70E9ju1tT2zlSG7J4wwBGi85oX+iVd/3hF68OBSJCzBLGpcF7qTXcriRqtBixKEzuemheZ8ZrdFGB5/6DrRVcY0sGFg2zOjFlGZvUfy+R7H50p5u1osBgS2eZTuEN/LY2yFrp1D1Ek7TAJo+NobfelJzx/aZCIBelGYw0oIScJGiQIT4Ho43R4ntNIRbUSenTzN5dVABq/9yW+E67mCn+1kSJESIJJEbSayI2EYh844cvSiJ8lJ9i5TWb/2FR6waECQnn3/j8f/BfeFOBYDQEKAUIbKNhgYSOGSiQgNQ2M86+KKhPtZ1SaeyXe//89/9cZQjsv7WoCylqW1meBmsDIzzAga9ev8fzlK2k2EBQEQ4AP/x9fsoCHf8abmA4E1lawVsNq1IwDRAICg/9WyiWkpAycn2c1P/NWLBNLw+eQqMAEQMvzEFC0uh6UAQINBCfryXw1suuGbiCay+0WMACl5zoMAiMhq6cOD1mexpQlp2HjNey9f50ad3PA/H8usdbhvhSv0YO6U9ppAZEG/ivBGhV66l1p8zYq/XF4HXJtSEZCy8IW3LTYzqN+2u6CE4LKwpHzXFQaA9Cp4XUH8GCgsuHjBAEDXkzsApGKgQUimkLivfkpbSTEnURENUDOSmBGSKK1F4JKc9j1fUCtF/yi8UUW5o6XRRK4Jb8spkJRqCSVuhogUDI+ffVRl3+a8pt3knoJQO8LcjOJSuUGQql+CNxpCWQohPvFaWihc9i3QmYWYFCcEmH9Ca4dR9cKv7njyoOy8dsm2oCL//fdvPy4So/vgBAWqVRjRAS3/t/7T33mdoAbQGD1BxS5BQ+Jd3zg2/L/NFzIfgVwAdJ86eRNenzTUSWHpx37uDhb6M//gvY8xGflHVP8fiv2xDwkAEEbnDJlDdAg2/+e/2xABrTWYnUMqgwcg/uPf3/pNErzhofiFxKz/XyIQ+qbods016ukXbIFhZAF7P/eoT0XTn+CNbj5AePNZSO3kwD8ryj2gBHRFN1Cyd70jagN60ll4/YUomFH15Y8l/t8TAJp+8fxbyMWjyTAjPi/mGJQAh6f+KROEXn7lG0BTY5cQnJODpoa6CIDHPOYKQS2l1VJALdhCiBJeqsdFY5NtNNBE+97pYv+q/+cA9oEzRXeffdHI95WQmgUCAAJIYj6/Tx6UZ32fYTJ3UR8fX7bGHX7RlxwfsQQQag4ImJ/8sOFTOvvbWy5jBC5/p2jMtO/wuSd+ab0JzHPx/smsFOJuuMiEXFNkCmRsnQGn7p9gpk06LtErzD3ulr073/+aRsLwsDOIjQmUEHaUlS/2ghow3JKBi0jHqiToa/noqy/meqgRb4dFEW5Skmu9Cy6qaNKj1/82F1x76y8KAYO+dUZSwvR8hDdoA+I5DiBDb4cVb0t5pXz+lT1qjaMY2wSJjEB1Ufj+cWkNInQdh4uIuj9jiCKEjqH5j3zATXoRqEz7nuDphosDkrm3cpI03/l36Qn3F3BxKZszyl0QdrWAi/lSlhLUa/4FaHOfy8v+ng+pKVlBQlZxgIoIcEJz7ol6eUQa2zKvRyF6lxXAoPEvQBkUTQlOLSyh8P1S+8pX98AFxkVG5hi4UN2f/I8vRbr+4iDUHBCepqLegjfqC3xsgKDGhfYUF+vzvlMW5+NqeiganCQhCQPIqTk9XCR+1h2g/p7G15kZ7ONCi2drAACsT+S4/iNERcJWd4UiQAr/diG9BgEGEw+u7vwCV4J/BC4uId/yue0/bG9S3UU4/EKl8/L3Z9B+DyekdCPcbjVusoemRlRuPg1QmAazaXSehTf/267jKX4dIAGAR/K89DaoI/v3tQCqb4OLzETN+gW3a82/e56nR8IXSa6YJ5Gzt31M5vFSGbk5y7CtLvoC9gFIUUPhmoyKt186wQNKCmRE52ZAv2m9ZV5Ww0FAQAwOOepM4gKEy9zgEjB6/+tiQc0f0ge610jMur4vPg54cWK/Vlwb6jvquvExGWqR2fV2rxQq/vtrygE97Qn5OKis20uWILpQAfAhePPbC67r6i8DGoDwIa/kL4J/0XcKzwD4Blz064t+J7QxUAIf8j3hTVTDRb7ed2wFfW/rSF8QMit//ybzPaZ2IerG520D5UMjQhR1JwzFD/8F7lQe5+PVAGCRRQOOtx/+VT8tAXDk9xdSjaADX5Ccyac0zMNCaudP9CJVXeMbgjgfk/8FgrUep31C2SWFXYAwWeIiiEfYGAAS1z5SSZh0Ljo1NQYIeBHIEKrPK6XkrwGIYVQ8yaVzCeC/RluNRo671IUkRfthkJibVJsWAmwRSgi3GfDiXCOFBnyA9NzEPZK1PJgV36s9HJ8GQIkGpaS8LYjYtOS3iARtCweNOgOgQf9fbFR1e9Zzeb4JDMMM/Cjl6QfhX/V64BDI/TdcXLVxHYAqDvVyKo8oX+nDBC5u/VmFErK/AX//OLbi1WGO2PtbpfRLgArmF8g+xATNdX8XAAQCxGSwGwggYDKWFCjcJfyC3AWmHSQfdTjvr7wIeOxrlab6zsxFiADEIlqpfdaG8FSjae17+lq8CALu1RoQXgDWcjd9KODN/8JUiRf/rzSmHoA33wwv1pKENEW/5tpqHOw752t6/pOgQIOmc4qBU9Lj5Q1QrcBx8bEHr+VibdNuSBY/L6N+jfEBoRH+HN+2Q7NvEFzr1Gtk/gfSWn8ObBUrQkpoePbNIcjeJjn0KNRA8bOwYoLXIFDjTC1eF2+Tv+v269MRtAxMEHizN0y7njstJhWUFHgPfgorFLYK+nGfK/OsRA8AGc7drn2jXE6g6cYRTyr9C5ljkzDqlQNWX3NMaywfewNahSQtDZyW9wGTIGlW5zIHqCEAQCsCmry6/cp6YP0wc2tcNMtwET2zfiR8rl/0fDvqasv+HgCdBtMqKjcI5Hi7jPaCt/H2K5OeILT8reKXvvu0gRe2tKC40Es8CFe6Jfgf4f+nFiyjQMzi4OvhRTKtjY4P7mHQAEAyrSgBAVgVB2ZVvmvLtX9VYI5sEOCTEvHKwnpb5ghXAHghD4bGHFe4XwPRYEsQkevnAEOA/r8kliSvh7BYuAynn2qZiabwB1ash4TwNZOJLR0//cXXG4AIAJQsor+WBa7HwH2vP5T6i2ijBYPWrCWg1cHR1wPEOIUR8hQNX+4hzxcIx9f4qkBmANYig0RXdvV4vLoTjKhsCYXKy0wEhaiLBTAAQF9IEaopYNuA4P5A44bFtu9qnLAE7jUAhhZh5TrznqgFCAAGkBAgGBjZykEGusk2AgLAbLb+h85fMrvGKrYSsIU2bQf2Vx5Gt44whkANI7scomlPCZ/rL10UAkAPqwWb/a/BrKHi8RUI4M8qAkDgdc3cpAXgRSwraoBjwwyjRIpkhHAQaNhHTebchPDROI1K9dXzjbBdER2prcfQHqO2gAZoSgikPd5mcfSK8Fq8ABykQfiuU+K6+4tXB0Omc9ZRcgMQaedkIp4nANnGt668BACA2k1Xvr0ZiMkiq7ih4d+B0btW/fiqJfHw5yZmukv+/hPv6tI+E874qd/94AaD2ZQZb974kZ1dl5ykhKXiOz0uuNcF1DIgAAChPjmvvi8U+poTr48qgfJeqRAQACLNN/SFQSNBt51UWIo4OsgfioeLKhnZ3GoqhbdBEVrcCK6YXtpBZIy6deOKzzx2axPUhJKzqp9056YZExKtcIcpYYGgAYEPk6/RF0RVR6Db58IXruQq/0wOSI4UrH/wD7bEB2nfJbP/FShs/3f/N/VEBQLAttG+sXsrAXGDw6UxNfA6+5Pv/Vz6OjfxrZRoyR7U1O+u2BIWkPp3NP8TGttQd/domecOn/rjT/vILbdS3aF839+H0B6vE5uVVZ0nALsHfhKUZIMvAlCILL6ze7L83l/40mvJgBvlZb/6973WaCqtOWRfCZgg7lr8Jx+9Q0fz9s9f3dEyb91W+/7fvF8m1HpKsPcjZzZddv2KRju2F6K/fWf96AmKGjFyMyLIUAuozGDAgACQSYzjKgWebiyXfam5L529rwJITkT7+r9/7DHOXFRm8YMh2eSn3vUudS4CAOZ92nUGFwBGbnZRkP1Ahfjwq/87tOeW/VLWj2fOEIzs30a0iP3FAiOkbdD/1pDUvtLCf+zBv/vhxvPBUely9R4grbzO0izn5FuwGB0YXPtPsAx1twICVT8va630Y4888mdPFRja+aoHH33MdGspCELP8EgeapPeYz+3WXU8+7d0mQrbMMov/7EOS56adu3pr/u69/u2f8xt/+pPt4eT22tttfkJZSq7WRf3ivg5O3GPd9uh/+tQUYBwVeZbn/0bf/Rf1yntCmKIP35tRSpKCmKPzwOuiA/EJPRkwCB6y2qfG0dN04eFbQBSSqJD8ykHfg+8du5DAEIMn6+OBU1Ot9yp0K27toTGzKMQ8CrwnqvCBKjOgRQCKtoYikVLBGH5e0BfSAcQoJAgUOV/D8NwwQgABG6VSpPCow6owCMAAFPCl6plq2YAdO5bg9SF3BFAkwrMlVxGYyGEvl4hw7c64MkIStJ7d4ASpSWYXQtvggUz++/g4qmnjKYMhBuDK7a3N5uqgPjUVBhEiazsrvvP8zgy6ZPxXGz8ygcfe+xdlsE0F8980DuUcI9EHnc5U6984SUilEqHPK7M6wG1/yAhAJ/wOMV/hAB2RimQ3LMUILjozxo4//ajQ5Vvp0KLfG7Ww5ttWTRLAeJAIcx36/elIPzJT3wnrxWSA742t0mQMPgKvOEwkTYrQEIYpJH/C//Psg2OSVTkpQkA+JQWTNz7ytJZRt1zQMGclELadPjw85MGpUaAaMZTS4WCn5mgl+x0ybe7mkPU+SUxmWIKzMKtjbB35jO5FxFo0Jo113je2RcSH6lrhISAiOIX7NwiPKHEyfz1Zg6JEQK1MALvnvqlH/7UKSmB6d+MjRiu/oPiUn7w8TsfyWqtEC1tsmrLIGqvyWFRta98speaailTRI1nQELiQQ3S/P7hmjoyXxva//tMiPFtpgLxSgxNaZvgOw2WKQhwHr/zHqYI9X7nxyq3gyTyj/DGm31++VV/+8GVcUgYPMDrt+EbWslr3selROc/8xGYd71m8B2+yJqWPHcYqF2a1Mg5njpQD/Wmjp7RAsc7GfG1ezxE/lPD6M+ud4P0zKOq1pammyfh/c/9ZrJm6YuZ7bBjSZo3f/ZPoTw+tOjKxlBaxccLqSUzpy+M3RufH9KRgADCaAESx8IgpViLpJOBcngrFxwe6zbJvCRSDcw0VGwF+uQcEDCuKChtjmSRmvOYAPU7TQE+ZXoGPfUzUIGriEIwfojoxa4FP1R4BgJlfHIY7yqOAADOzJQeOmkxpntPK39tlyTEeeB1mAQwAOLm0Z/4/ke3v/tPVSaWDBADIOmFBBAhcl5yoEdHiLfwGR/gb/zqeQll2GQuot5V8ri18FL5/FPp+UGoekQROt1kClNUSXf7XCj+o+4ah2T215h2hERJ7WeuDH0nfWXvwF5rr7H/xaPv+PVeKOi3Dvg1jKiAS/GjB1iXxNKNiP3tW2SUYALwdxCwyKoOFWlyhZfpR84BDf63WksJn1PfGE1nFX424tn0BwZq2AJauh8NUmehramGxwzf/K+53IbM5RG64NNJCWj9KVUh2OVz3JBnHAENAQ83AqIAh0BTfIcov/JtR0le+oVTxcZRcyv1OABCuMhMXLLuO772yz/w0w8JJuV8s1xhBK5/ZTrvBjSCDYvjoQkUgADwVV9IWv7GjKrfW+34qdtiY1Pvm4fE2nT9to0QJkyNnzn5kvXRNoDOhyORaZuYJoo5XfVvBzj1knXmnbqqIfWJDRve/8vdN3Xp1LGmp/58yX++Wt/M83c06IrnJBs6srt4jNpC7x5BA9MKkh1mefO7RUsUYz6+3mKMrSkX2Liq6xg/5Rdc8IOPDthIdlJiqsGsxIpbQMFYr4WqTWswhjHM8e0CfDI9gRD/kpAI/w4s0NkqLVTywTBV1seAan02ihDwOtwKMMA9GUND6yeo3v0qIYTNHCGadDIEPNQHAGjTeHnhe688lO86a0GzmvoFRcDuWtERsRRYMZ9BUDQAVhel5Pj4/gh8IIgmuTURnaYhBlCq2sS/7NJ84Iqssl1yQxDMjl1KHM9LQUx99u7faDXx73WNS92KzMc2bvCXzmKtWUqkvdmfnm76avOO8rz5c026rOvy9lMNcxp0RqJB1HabqiRmoIqUvPFTHRFDCRDrf4Oas7faOny+zVU1fc0/OsISt7KAtjqIgeVDJSYurdKM/BUMwhYUPUvfH48S+wqttHHSAvYVEKhTvwVtv6MVQFq9T8QDqnOzbyr7ZSNQsO3tagYInLwdENlOxtTnC6gEdueruPy4ITX9HQACLdcv+/e4hHV0HMfUPDXRbJQAkPiAscKa6PaOzz39lTcESJkQPaY4F86nDKN2i5JwOlUxHd7pgY+qbm5wqQzLqktLVMkbNwLyiofCFiak0nQs/SXpwzWdC9UilHdEqr78QrIkSdLAcwPPjHxKNwc2uyMfKV1Ra33sTM5OljsHEhqDYNA6jybhhCQwM69P3jAAsEPKsoFnPQwmRjegjp+cW2uq/W94UBt6/6uWY20higtSjJv03zQhQw8QAtGrfR/FU2FTX10GSuDeslG3EyjoXQIs60NcKBP+FAw61pd8rkl2n4Xg2ij36NHl96eR8PXbhRr4Hdeg+NOKic4lgDT3R7B8i4ff9j7fn7bbDQ8AOvMfPqnHHQFtPqFPaiJavGpO+23n/qSugHcC33G4EPqvmWpZOx+o+pIRFMl3AWEuIXuVSajxnUWe6RS+UA0sMDFS6jkRNSUmx0sbYPa3unFy0+m5B47d2vSWtv0FUMoD/w/1axq9Qe98jQguaRxce1165zfu396aGCvv1WK6CuuAV/dp74cE4NAT70h47Xlk4CN/gVZlbR20jOMVTJXht6aSXT+DNnj7vy9Uy0blwdFxi/rpKgvkR7poUuwEiWbuVMB7OwdNyt2E6F/5LlEkf6DdmV56BYAwRv8xTem/Z88UlEHKLo2/pUopmn61zb/4IST89kC7mQ9qCezJFFAUi25bAf53jtanU996pH+sP7iIPZVEuUKbSk88xUw03/HzjkilEz2xXqDWSMjOjOJKZu5mzPiw63F5Jl4IrhNSa1XYM3MbcKbOHCaN5beGJQpnJFBMXusWgpYyNqJpPRVJZj9w43O3V92Z+bef8uzzNdgDl968BlSyTn/nmrcsjOQaDB3+dGT8io2mDIB7dDln2IHP5aR/JAACbgBQAshrngAAid6hSqumKWChJYhvGD132X79/Q+5vO7jIfKxIDL3Obck9SYgoK5bHsssDIFicjwY31YHGvXxnOW/a6dCrWlWj4h5HwZQSM/eIVs/f9We/XFeETpcjFZ9ALgyH8zEUHcUr2YBGJtLlFE+kAVGNt6mJJl+duC5nmx73cygPndi79Lts6lFUSbp9P3MMELfNYuWkix3zXGFPvCa89rjWn8HqiqS2rH8spF0G28BzkCd0xXrJZX0z9FwrvkGidrLuw2lt9OymTEp1ejtH1/OZcOawJoo+cvPf/z7qo0GNmVKJ8AhdFl7vQlByktrNcj6gsGFoB6vZlF3SM5+NqdnARrvVQYMAQDIl6IaDPTDTmHJ9nbTP1gEIv27I27jPwFLDfzyzWq+j/nKH3Ltqk0hCgbusNxSk0+QqfNs/nUlUCCeTdjXbgTwlQXFV9sDXyj4TBE5drT5txt05MfEWDv+oh/zFiqieXeo9h9G1zS/06wXyxkROv0bMCs3fVE6dOiT9dEo0iXWFtqXjE1mh5TZVa+Alh8IdLrRT+pYyGOmOLrrmR5Dhvdw7vtifzU0TG+b8RTq2PDiDyswJHrF0RuAS/BfTtffsrkFtDLDQ/Lt83OE6KAwwMvMdOQg9NFY37rmkz//qo/xJtQRjVC0ceKcZQoCNCCo6VtWlZ7uhSDLp9K07jJmaEoEj54DZGykATloAOBk3AICwOuMlvd/bk0o87xnajAe9VbcB56qUW3nf4+AhnwPmYlXay0wtHUh32zIsuYEA78QwG0nu1zVvA3KIuor1jMnsJRKEIxCfuW2xfDKmqGPgprvtXRbAoSBOTu++JIq7G7a/sHNJlEIL03aqz67UUhh9p8PVtPWqqg4vrIKdsw9ncnyxlYkGrrrzer1V6ogoQzpsP/znn7v9ownPVVeYce3ZdMZKoBtnnx/QSJQ10BvmTIo9UF++IUdUU4VkezfWgVkFVDD49FY6Oa5X6iLFGp4NlR84d4llxrGWU36Xhj/pr0g4FcgEi8clw7VLTUCTdZAfthclGcgacJpyu2nAFDpIgoTbCsLVFUPz2NKo3e/2971vfHFV6xv1yaj5if7bxJgDjm4+dn3/ZDtW+itCJzabIImNFj/vU+GrIjBQ3LoM1kfLB0MX/kWKQENbmnd5TSuUnwmTAECNXNRc2jKCJ46umywo9KjwH/78LefGwHHpuvfNc9AoMo5ueg6S0MxlQzectXchW1RsibZPkemYeU7q5648wZDkUDX7JLtG6OGM12MKUuWR+CZeSt9T3DZDSAnCleVuWHiN9bkXYcQHuKHtwGgloGFHz21U4swePTe6kYxJar8qAYnEpuZu3RDGxs53N5lysJf/2pBs6+OUgjrB6961+Ob3RCfnY5ao9M+KcScpyWhYYJQ4u4d9EBkPVCXMeL5K1sjLb0QrPAcILlgkmqiKdT0mdGqsVwuWE20oYX1LiFxuD0KLM/2c08SX3tHygoo0QTnQJJBKa8pZ523SO7JIDDaBuApA7lm3Gx0jDK1UCMyEP1/yIRuLDsxKlNeOYBg1r//bgQHmsLMACBIYe6nl0tQ6b1lI3ulYAYPRUUVL7ZDMR/rc4PDcxFopd+wsNGgg2HXCIICnutfFlC+q7vbiSlLHAIEVSQqQKGWplKriUsBFZnrV0gQDgRzWz8dkiIGBpE6ZNW1KLSY6fjKfOXAiu9OYqHmVrS9nl/+ceGGiAFgRohhJy3fq5JvKgGtatFEdDuTVbJMiGLlN/fREAUCQaCVvaMSrukEJRFoW2NkZu22hgWNlsvRDbCoxPSPflZu/U5r6OsgU5f+aqUSZdDYVEc0Dg8JzWC9p1VWBIMEwOPPdCUQiTQ6vRKqkJCGMiibeKnlrcWWkhsDzYsciOZBcWKdVoAWANNaa2JVgxTZO//5jpWLFWeOQREMGQAoxHLziznRYqKGivoo0QCTtcAMLakGCj7X010AxGyVE4wDUYpJrcEAUEFTlkxETYABLyNCtLVKFiKagvastAHxKpMSKMZz5tFYJwPs0MIR2nQpGUtSwpBQDdQwVY3PflebNlLMQA+ZwvDAnwh3Fc8+yt1Ei6iioc2bjK/cnmCModKs6QNkONGwcVFTmBb9EADxZ76x7KIcPVoyjwtyyS+vQxx5RqNiAaTyn9wmrkWk4lbcAUBQY2vDLhqICESpYkKjFkw7EE/47iIFgGoiGlAgiDKC18OQpEI5i0g0RWGkblEV0YVIhTCwTCkFQ9FEaBiv0rEaCwAMCFHUZiRAMKRBIADz5PQmMMEWffpvN7aBVgB6ppIhIEGjUETDJJoph4Y8gWijLihmE6Di16FUyDIZoBPg6FssiiRha2z3e++8oUVrA4EgMRRRxKQ+/reUUyH0VYe0STrL26DlAc9/BseqRiRsEc8QTOklP/OVy7paBLGMq/uvfchzCxxhA6XM/1lGc0qSm0N/xTEC1ZffPN7pLAoP9w4vCZHqY5w2fYmpUIfrJ4Nh0mzL609UK615+u0nLnZzPKQmpjkJkI2xc00jN8T0OgEAZb76YahZvuzM1XvLX7sogdUeu/P8nZwMBgPZlsZZMYYKDkitOW4D0bgR2jtsksWy4nKSBBDLWbQGMK/PltnsdXxxaLER02Tmnn918fztmWRuVO3M5E3kV3v9sU97uD8DR5O9lg00+f+Cs/O8dURSA1wXy/YzDz7rU4+ZeOpCLNugBR0CFWj84PWnZai6E4Fjw3qqO33ahtL07cE94vL4f3u8KVBvtV87CWDkeu9608zcNLDNVUjNPM3bPRWBgbUnRluZvD6tLiyJabozz7zFXTrK212sgpzo3oiiRz56wQHlq/0/j7eL+Lpjcsq6CNl8wPZG0X17NigMGmAv2jZUy4s70wA+A7zl6lXVtublOQ2m3VzIZT+xxnVNigwbd3vrnZDFf5Z+nuMsPMgqUc3qe5k8noEk+fVrZgIYxTqqard9xREECHHdVlDI3oV5YHAYPv8aKBwgGpMBj239T6EWC23I1do+gHVzFmMTh2CGPCrrq5y4HENin6diYT41PnI3Erf/bE9UhgbzaX8Qls1+3WKLwMD+ttaVba12jWPtytQyQnnODYxi06qIGJmE19E0MuiVSSDjJa0ZuPeRK5WqKKJEm7fN1Y6IZkbAja1Vg0FGhB7M+QhUku/VmCAobPrcJ7GLA9Ic3onhC6zdIpe3ytWzYWPXy+//B0vLDBNgg6WwC4bX7XabqT8NMDJIRrLE+s6IQRACXLFA4adDebcHiObPbNSQMBKT6VV99qqCEi4ZAa0Th4xq6ammuSnP8rXlhYKtKmZebB9StEMdpj5NiufEHOIm4rHqAnOGq9dU1bB0YWIIODtdRusTNUFQdMAUWV6I6r0i0UOYW1U0Teiyyp1K5L5lkSsaXBSp3k6Ltjp3p3vI1UoqHg2KIFv4MI+FEao/F7BDAWq3iVKwDuojIjCPOjT0mK62h+o5c+3FtCCz37Vlpaas6W0EjSPkGN52TH+pRUEpWXINJAQQ4MdgGwMZgyEWE/vl+XKqJs1zz8DdV3gOEt3AkIlYhbdHABpYKaBATehm7P3AmKczNIJ7//cVdLus42aYmOBtNgXCJIqjZcxzb1lsre8mtrY0V+NwiCSBFCOQqMZocrEBZI6CoBFTa1etX27dyYpveL/DQLQpgtgiusugBVROVKdls2mhXX1Ne8dnAiYlvIwQiihqAaykesxstidMDdE10QioASBdpqqASpt9PjEUt12OP4nIluZ1TrzWoo/gmyKt6wsbLCqzKx7+WAFFrYzLuh2jhUoNKKAAmQWDLVUWggEKAIgmSEznpcrmFKfNIw+dTY0oQoGiZhRdJl1he4EaxSILzSE2MmyXXAINkAogAi2jUCKDWYgi04RZwuDTDBDkp8S5BpsuBJA0GqAKAwKRlBBDqfOphYtkaxyFkGbQpqMaxCiSLBoADVYRAEQS0JRACm/nAhLCRqpigsqD7UmXW5JTw1isuC6RriIBhWSLY7L/+EVA4Whnz2Fn0uaK0CUQKMqwDGEAVCJ8BqCAAPrcAqpgdCSCt5pgnhAJAgG2diMGWgo2KADRFFGCsSgWSYbosEDTgbDl0QgSRAuSYUUBwQMDQkWS7+NlSYGIhJISKrIIDAQcDJpQGFnVYq5ctDyKTHlxShAwUBThxhJIAnxHQSHRVCCmm2C5gAarCEcjAQlC4+dULHSN9axR0GKw+Mp9AfYoAXfOKwcRz3xmYlpL/ek1fzUIg4KKFGqCAUA2HBIIaIKKagVyZAujBwsK7s7OIAQIRdBIdaEnBGYYLBWTKAYASmgVgBCxSCJIg2BRSYFRQVMgKK0JgomYDoD0EZKMFcAIS5YlaKSCqCYkiJBUY8c8npysFoQmKRsNAZKRhBlmCbDJglAqAghaE0CAAC0zi/YCXgYZKRXZlFc83J83y79sNK/eGEGwMebGew4CcP+sP+dH7Bg0hfk/WHNADDdw8AD3sXx/IB3zs00+v1zDZ2u3DRZ9QKzowyEoAnob2HpTJH5P+6DYm/EThIyNJQt4fl4uIRLH4CWgIC6ImVfwvkF6waI3j/V/uHw+60IG4JQ0kgIyxRIxTuNgpB/CPnlTB0oQvqM+gWo1RZ962ZQCGv/GhUFk59gZGRjppo/dRZebOqadvzVNAYIIibU3rd90JlvSA0rw6LrkQtuEHU2/n0QLmoySISU0iBd0RZ57jmusI419UQw0p3bGeijp9qrBjC1NCuQdzP16SSU2UAuqBv8pl3Prx/fyJTDzCgJtzRfYyFN4Y8Lo9TNw19sc9vIdsWFBL2T4Z/i2BslAGP/3aAfpgXz4Rj6EXcrNk0ebJ+ScTbHCv2sookRtFxeSASz4bgcmuTm2nHP52CYo7OOdwZKQkyn4mCo3hTAi8zg/cil4nISTzCRCUNxFgiR6WfyZqQunuuSWu7izN4TMKLHt2RGTelxwF5LzZ43fj1OzyAwI3CdykBMPf5LFD55wSpsifmr30ho6ByAY+N9XBDFPItwqQ2FQ5UvXHGXXl5o3RLoMmtYGqDSU+l6u4FDLfcdhO04IZwXD5CHgsSKJGL44CBMWHaayAsXhtgj6UAqILpmTRhv5wlbsJ6vx5xYy7edwsiiWoSCq1uP4/Tri7D2wC4BZhAk7FhmxuE2n2DgYAmbgb7Si5wAHXZdwGsq2/5elCk/TMbdQ18gQoieb31Jbu2Hr4g8UkAn/6depuYSc04/3AY0n8yO/gpC71DoiAuyRyMiNBJMxnmpwJkHCBR25TDLZ4A2FG0YiUylbdgwXLqp4hgvH7g4uJLhjlzr0RibB8QvGeSHN+/BThFEgEkyYmjsnJTYdxqGNyvpbNLlfBAJmiHXN70vaAfD4eQH3dkxYMFcABpEMsao2bEACoAJodBPKVDcVDqzLsJDpo2rBcNgBE4HBUBQOv5IHStAy3WOnDM5+kIMNCZ052Ng+vWCCVjHNIGPRbf6sAljIBNIgUsps3Oy92+AFb2WQ6tuUe46fAxL2xGZscdOaIyvt5xkFYIIVfs+IDhLCjw1AIEo4FU0EgaaFYRGbGCESgJ7MxQZB5qT6+y8PsSwpqfxaPzEorGKJiISlCzJrViNcA4rvFkgMZEKIHC8Jl0ZDtR8jxq0OFpA40kydSgCWaiMugABU2pEqT2dlCcqUWDaDBsdlCWCqcKGfST7Q/PaJQZbcGUDbrnXy7vghoSqLAWPBr75WufsRBOc1QCMEjYQgBagSECIooM+oMG/mEdDzgv7SHcsv66AVRJqB+FU8t6mZKN5AwQkyHxoElIcgSGDSS1pzl7wktxBMzONd0jT8kbvIIQG1SBeCD2e0cJxmiIkFDBk6FwxzjbCMOfhsaJf7sw807ndZGMrKULPmHb3yG/DFDz+CUL4wVyebsB1T9rnf3uBlG8vIoGsiGxXX8eBl3SJNecqChS0ywcnA4dQGLcfUJst0l32/YxM0EMjyJTPme8xg4XSiHWV3ikAGY6YBMBvkRTC8Sx2UeA0DoRYjY70tdUjMPAJOM70aoCi7X80oGlQCoEEQURO4yNYATOw89PAi3DEwiIa5jfHr486DsClqHV/Da8FkjZxsp94rgGe/EeJA1E0g8GC4QRYfi1VKXNzKcdaHxfcM83BkZCVhGQtLNqeGjDR2Lo1dl+/ly8w7tpJxPic39j7s+cgyHcBwjHspdPkGGT7l0fR8AqzgbfUW1ZgsYgiA5jaUnRO+cCBiyO2rHp27jcQeZDJJUMH1Yi0ZoEFUSQDkA0LMbe/I3aDzIsSZH8MkhsI2GCLLUwlwTMUcVbwwk+QcKfF2UZPEoSAPQnSEJSmcGuLHU/GcYuRnsoDOSIIHCyzRhJ8LgzCDagzmo0PTSJRIGeZYZVKkhTmgQfEPU/1RCAI4J+9+uUl0GQZGXUJlEt7A7A03dbHeOtZjBOcBB2agRr5R1MnI8RhyFMHUSRwD0Q1Ysi1WWsJEdHB5jM00Ts2LmrCo0ZmMzwRmSqHJALfQP8C1GP0eJW4ECWNFw8+x5gCHSLJwp6EqzHwwpjIygKOUdCXGc0zMLp9MKEhnYPC7H4HRXY+uF0WIoLcTJHfxD4/plpxuioSxxM8hObzH8oP8NJsJLEskQkShRmEhUTcNjOkttmWbEwH/cH10DUxibQeeI44sxuXINm6YMgHZac5CojAX93WiPLoRRsONOS+4PdLZbQsJTNOuzZ7ladlS6WnqfHi6Pt8pCoyqEiglN3Pu+dfu3OGc0Y6CBBqY2mIZG6AZJP5E/VEJboNq4YrI1NbtkDRmMMlQHuL8OR0DkGzSZNXkmOMIK4QMuONcLGZoTgc3uGx24hpUmBo2SXEDs2zLssNm53gEFlyHKFPRAVKretzATrOdnDiMpbco35YsmUmrI39amZGIQeJmjmH//K9vgCFJORKHWbw1FzxHHuhAMGAZsLwTDQsKV3brWUcmYKhOtKSClbEErMxhz9OIi+C2T16onIboByP60TjRmSVHF9A0zsRdxGO3xrAMgTg1AxsYuCWABCFAoHliQtg0PST6zYeTu6YW3HN+UG/sbmPdNO2H6q0YX7jgj6nnEqcURIuyRDjOf/n3csqIuxSIGtDDQvQME8OYGhAPIFWDoFw0mpNdnGpFMr9hwQ5S9AGzw5+F0vm+ACc7/Oo8+PE0JH4zo/weCRnDLGtDnvzhrMsmDVb0OxiyhilrwinMRaxRmEJpRHYgOh+E+XEsNCXyt/XiC7kDX3WGOayD4X2XGx/8kdqCgMxhCP3bEEArBbQuLMxnYKPmPcaLwDDZxibmzYIUHo7RhxvziagtIr7w02ExExeTeUzF00k/srEiwUBKyNfrhi+4zJecbrtI5ntRoToj6MxYUiS/K4hP67CCZCJZVp2OojgmQBIVFEkoKCAgKO2mAghEuF7hV3Tosh3FgSosap1JGQ/XR/Mwwk+UADNG4sysQskAaoLAVPMElvGeM8zZHOuY0o0l24APrrCTdi4pVO98L1MdQMybbBmMSV9NAZ55slYXVrweUPLg2+gahw5XZGR7CuEPDZtUX7b7RrZ33/id2BtThTHcUXbr8sU5XIldBvNJZ2tQQJoFFjSgIlyDndeK6VKxe8va7pWbjxyHWEF7mXP3zSkch4apH4dOzQCVSRzXbYDH5xpIgB6Vqew0/pKTmGRsbsD0/LlTHE0uW/RjRpKP8kii4JIYMZyX2SGQfJIzEFEM0xAcQZQSfhGXeCZT0Fwk4SSw7JQQ9Aq5kIVPzqgJ1yQRfgQUOZLMICKJmEeQOAkiyFJQhE2CAMSQJYNNpNnk3rNR77F3zQvXH6uzzkGsJbR29Ko5k5/PdWbZG0Bh3YYWo0rqv2JJDXocT4W8iYO3oR1LKGyxG1tuhamUCTKgEcZyo0oTBoVQ2EjKz7RYIVMmIWE5ERaojEB0Ln7d1OxWQ74nJEhm+HBhfDTbdINxx4I4+6Na5pRemdmkKmNjWQ8LFIIO2iQrZMLB5+6Tg8a5XWfxzj88ud7I3f+2lr+Vz99TP+yPD1Y/vH82X9EbE4eGMBJBGUlotc5tURL0JMF3ELcJ4hrebLxEyYWZLd5g24UTSTi2cMbnzHQowrpkxDLmhnyRSNQYThIwzhDCy75ssBsjXpiBIQ7HFmhejSa5iDt1sbeNgD5QJggEQeJsqlsKcaZZbJ0l11Ahb2AvWvPnHfdolD7w7A+PvfKjE1uvPZQ6fWt83wv8nhON8VMGnjiwfGRav6XGURoZhsyUHQnQhyll8KtOKAWwAdYVssLAVTB+OzgFDZHBIgwJlEXcRKSu15mRAAzgLmUMGaLbBmoGYtgFr3NTcSO76cg+gqxMSV4sMmLqMx5lXVin1QHioDgzUMLwibDN6djE6S55GWo5tdiUvnh6rsv++5X+I4fiH7n0yMt8Y8fobHkMVj3derQu+PV7l/V7oY2NpzRJ0RSj5lhEYDQ3aCANnuNIFELJ5y7RBFK4vO2Ni/CYlnxD5lkx05qD+DVuLyXHTJ1+lxpSB6jciyo2IoCY4YKOotEjGhFFd3vHbnHh4zMlIE7NDuCy+MKlkeCUhYxtYcimmfyB04aUgBXBJTT1prFiIH+58vS5xyNZX6zdxP5+XEX597c05mNXzDpPWw0Hc7wsI/nnRcUh0UhG7k9Pt4EEEKU6rVCh7G4DTAwRMhe8ZLhcWPAugCn3bhgg0/0CJndsSrhlaJwvkPCQj4mLBIKgEILZN8a4nfaT4MBYAmceLIkvJNzAZUcXmSMmGSPGM2agvysi3dWYZ1BJWZQ1JkyYUMJR01vW0iv88hw4/cD5e49+pTa31Jy6Y89xj4zb8Eq4o2/yeHH/zAFIAqfz25buvJ1X1Bq0VEzC6+dssfm771LRK6uyiC9sG8t9N30BHb1QtkcMgIPOSRksAmUJqsVOKIapgwGTxuWRTGhExJCNgSM7JYY8g5oGOa1GNcl2B/GGNlpgER3Tx8zj8wfrzZlHMp0aBBAAJChahEmJLgs2MBBAJXtng8b535dKvsGPTNcNnMgVCm7jszSu9w/OiKPG/h7tujoBvZBue0AACJSABVFAREAg5cic/BVKgxNLs8WJ5BxYZUMMrp8JFhphSuBxmXkwiPYbeXGDqRuA9Q2wFUcKUdzQFyakJzZO31O3gyXVER2Z6IAx1szpzDdbGjt2TR5wPQY/lGnvmWfefIhv6yMJBFDAMGABBcs/+Mqp+rrcaPdgjYNPq8aM21eKTM8KVgB0GbXMTc9LDEqliS7ArBydbdw4ANEmGmbFfNsDBABKuOV8/UOEG1DaA4i9lSWJDao0oGaLKhB0HJcJW5IwyQkBLlp6mjj+eGoIgHlzxqU3zDAjDuMZ5xF0k0gT5ynamXkMMmRTPqTxM4nDa4BTcBhBh4eZURIJCNIJwkFQOHSc6eetyUMLz3a2OAcOzNtzenGz11eElKNLRKEyJfK0ZlapQLB6MkA8CJqj5hJOkQQ0JZ3vb51f0BQQSAGR82dMrHrbLMhIM7MxJx0SHLGEL8JHhs6TwXIwUHkB1c6aozhN3kagV9FAzAzTYCi6MMWeQCbxyXAS4PT3uF2EjYvvlHxUWK7DkBAZhqeM8BwLWyqRzRIpoZBhhooC/XtemJ0bfHjIT8Mj8onjbb17Z6d7BjDNaUEQMIVXRKZbz0gC9Z6RyDqYtYoVKGBmQXgAEAmq5uu+cdmCz3ywZGMIkZhffqCvHmMxKhKJsM+G0w8KKBDED3MhcnmZH3JkOvimRBRPz8mHTaYODcMwuEgUmQ7IYEKWNTNOpmIYJmNzB053h4oq2hzIltS2y3ZuDRIgmxkY3dYnPBixOsIeDkSLhayta5OHx6yjfQMtoSb/+LMZI+w0z0Zprv666QXb11xZUTF54xUZk/gl7pclU9Jb7I4Byi01/e4YgTqS4MGFVXMLd3pKSi3QHN53c0o2MMrSPPnjczodzE0ZIUJQZPyhK4gAZioLKRaHwTiEUWOeS4O80UyCO/JjSZd42WAx3TQ4KJ8XSdhSx+57NTeImaixisFVCbjZlLE8ZeBuwMuCXPrS3ahE8dyYKkRL5vEZY95oqeHM0V7MsZRanMtHcNnm+tmT+9q2b1h/1Tumq0pcKq1YXSbmVM/K/wGQ8QZyEwBKMDTvZM/8shT0uQQQ84GHRxfjRSMnEXNAcFd/xh86n2r1G4IIMYtg8GwmsCLrUhlf8pQgFLOkIWYhKIfhsrgQyJ7GiAtGBeUiwguNcR5kjoxotapLvqdZQKxouBF2MKEacBZFxylPEVxfgP+4rjF+d9x/24s1qw5MFMKhCYWEZMvq/viD3vnxYnc8jrQzG7m+CwTB1JWVrf6eGkKfI8MAV4SXdfDJe19x0JUAYAKQlKi2RqlEEQXLsiSiRRNclComqktkE881252rEhIn9/lsvRF9QITsSEKzmFCnZBMNW0ZjGqawdyPQQZJ8o/FQSGwf5OUrEk900Z1DsLhgHlbgCRrdFiMs8lCbHijE/d/42oFu59RebNin311+orgmeLSApmqrm3ZGH59IX9+SrjdlurKHd17KS0QSLtxR2bxmprsVe1FPz/f+zadZrA1gZru//PC7gSAAStQBu3TIE0etvjmeR7ptaEe9su0ZgAYHKCJoVAAwyJTw9oIKKA2AplQGksKgkeHqRb0ajH69Wp3A6YvCtC0Cso0IUgU1GEQFLQBQNvSFMEVDhoFiAFC5gCoEUNogAIq6aABqkcl9sy8VePJEeqony7q7jbrC2SZHriPkVeq7mceYkFvFY5Z9XshAwvfGl8CtkTaPxuVdtMkigtDuDz2IlGhEhdbh5oTELiWbZCiFJTBGpNNnGMugZIEAgESaKBAwTEdhWHmlYcpIclhOpDpHGsrDYQeyuJmHU9PeE6Ipu0hDMOCUhgoaQrkyMjg8bCyASiyzUGE4wbWYRA4+opaofc3yLy0uNQjwHzoiwhmYAeRYlZYJUlSiagoVoDxba8OoG1uBMISa9qPsPFmAqwlgYK2sClxWWSOoPnEFMxARNHIghjgJXgBcdBoURZ1GIktIqRBEooFohSQIWKQlw40CMkiYJCCCWrlscahE5xFOkJAHcGN3sxpFAgRIgqIp2BRJFqECkCA3UCVTBZgIGKTNcqZEl7mAshx1pVs+TNpDJk797FW25kRBRczpoO+VIJcxZVsAgRm7JRCj0YAU4VS4tZNloJu9YMpJKawFBkAwUOP8vqWVCgGsE2WryOoaUYfHoP+fQQQ3pMCSAKlQAVAEWZYyBRQpcNUhbYWdBgzFM1EahKBJl5hZidumScNikhIslo0CyGq0BZtwOhJFlYj9iCmDcCBRSKoy4FSUS5Rf8gvHh9akz51LyJZKs2e194tec11PsooMF3xKVKPl5AqYAY6Ke8YJuCDhlkMJZ9yqQL1xAybM5CkKTLQLhBT2UCq3jmrMK13HYE0/HwmCjAInqYOdj8cWxtd1XOv66tefjKrirDcyPYSoFBSD4KhPjSEYlWsMSTUqC8g26SEM72WvVXET1eKSNLyVQi2tlrWth+S6ILwuN8QplxjtZgI5FvjTGNDVuKDCaDzOiNyPnmEYWmToyVyp6vYHulUx+Rj72j9ZX1hjqDBT60wlW0s5yE75PgcQxcSg6IMAbFYOLTnnJ1ZOdHIoBB5V9XZQCRSrkFuuk1nKewcba3/xwOxqhsvMws9BCAWCqDI5v9+lthWY63/9oqlYnIZywBxcE6ADdBsGERqCLofQS8341Ak9M/QFSeqh7LhvGsOdv80jOtEx1hjdsemMZd3UOs39gd46jDbhyNy0SZ+X+JtSGKjjnLXsUbcxXV2fbu7XQBuPG3osVvXc2/ItbX9vsRedXt00frC5fEqaLaezJO8TlAAgwEq1wK1wQQNeNdaFchTPGt25OcIvqECklwSyvmKSKC377f/9N39ReclM5jfoiHgKyAm+6JDS/hJ1pTj+kz/4Lybae+92tCAPRgeSU3GssVYV5Z1251uuZVEjy3qe27lE3vF7hr1VgUwvrun+/P/1//zF7xQLS03T7RLrOoI+HZZDrMvs31uWcbMsQ6v8xpoMAhxbjBv96mO91qzrcF1H7uHk7YjqPS7rlk70pwYT6ITegVnVcxP9eypeN5opS0UVanhdVTudgwAVEHq5JR1du58R0bwRAZFA7liCCCMbx8h52nyeEk20+o//4c//QahTTC4TIxMTncSowF2ST/50v87IN//2z/7dY3u1suNRlp6c+QePrm/OeO36ftZePr1+fNlf+HvBb+U0fvPX8+bFWgqw4/uhRxy3DzWElPPcX3D6/4D8+X/9b3/3b74+FdvN6frX3wq2Ou7bflo3p35M3vzKK/9mLMexa6fTftmnvxmK36L3//vua3/2Q8ey+9081Lz8VmL/y/+oKI6dqwv19a/YOz6u7JH4dutwT0dj3wlX2tOeVpan4LUC0O5hAyAEiI6cEKpna/qWxjrf6Z5PUqFwBEFdDRqY7FqpEREMAHa+978efa9XSqgwyGIJSUsZSKIiCQgKiUTCFSpdOndz+Lb7Zy55a23q+RZ6gk7PysTaoMMCRccECZNlU0ul0AZRcOWMVdSJSXH+ee7IUqeNQbRawRoCVQ0gDQFppkGhTNu8WCbcEWwwzpTLcfhcrWEow7PRcdjUGdGntHvovEJT9hhpFGFb65lsjGiJXpTnbH/AWmr1VAvfZcNPX2q4L88eWzFzV2OThO/53m+4fLy+db70vcPPqK7UQH/F3rQzotgLzPm0bEWrAOZo7nzryuOjdzV2gKTGbdIVAARDQMs6prUCqVPllp7yQ/91eWomgRIt2K6WkAG6GE4CqBE5ACX++Q+/986XfjuOVm92B9szgOdzyGofXxWy/ZyC8RFkaFuEE1cawmOYUUnGMRLRUG9RwUohbBslFQFWcM0UYWGgzOVN4RpIy1lr+Fih1OLmRiOjDKuDfSpdMIDJ8u7SseRdVKZLJx/rfXGORUp/2Zc9ZycwJhylJk31II0dX09y45N9t1fCiw2Z4ftGjKpzHzy/xy+bX3Pl+x/3o6rWN58Nj/vl9OblBzVADkBgERAIID2tvf6bw5kf1DUE7qPqXmnIiohsdTJgSK00mMxNHP+xD3uuz2UWRRdhgimDBoslRbUGJCAm//dT3ztXlvE0mR32j/5qPvFd38qG9WbUWJyYDli5UFBkCsHBaoj749zO5kIq/ddHnwxbbZbDDeUrvWS2pdVaGHaB8OkUIlcUmx51bDpFiBspKrOlNs0wTRxniuyBeYwHpTRJ6uWq3uFX7ERn6sih53bNP1Pufenxfan4bDZoTkjYvaB0+NAjfQH/f3adWvgcnNx+LluEqjFwK0JnTkxWXLh0rV8bG1AjadakAV+r5WG4VIcwOE5hwCEsfuWXJrxvXMj6vffvJh6FllCEgKSOlBIRSAYCwNlHfMM3PNkA0gRtEEVqECZpRUBrUeoe+PzfhhmFrC8sDFs2rYgfLoua1oD/wYHnFiUChEQMkjUTJoLNTKwqW+nD6PdjdcVir4wWMud27xBrbXWaU2xpTOvhtnNZrlhglaKmSSxCVdo9wLsOdSQD4ZfrvPDaKuKcnzOeVu6RfmfHpHFFKHe8UBF7uh2iy3ILfe+TqQdtasuDZpUq48CE8ba7p0S1t5r+VTBizZSw93RXdTkwPGqaNM7UXjOJEzqWmaXICgwwnHqgrJGARten3nbf2esiBjGTYzutiKJW8w+UR7QiIAOQx8Lt9Oj3fP773D4DjCK1OAbpvioqVjmdGt53rrn3cChnaLPS1nOEUWatNHuk1ehes+0hdf9TyT8MG+JJo/S9Fx7549/8o4Wrd1VuPPZcV1dby+LLNtTkH+sZnLRz2N34tHI/o10fG3A8X6Zh62zjY211MGJ2HLPGRCA/WKyKXYrLf+GnZxcKXX1H9d/vOFTIR06VH0hOr2y1z9952jw/NvzSs/sC9toFdOPgBqiMHLnrqJW7++ZLHst+u/nPoziVo4dszt49cSrkx3v7CXcMkUhvfuYFLxX5ZOLnS04fGIOCI41yLA9bcIFuQMgRATUos6gfbWwFBgQIDUBIbW1MmxfTvS//7KfOCW1PDafwQzXy/i/95cNX9p6ocT0lqw1tkFJZBggpjHIdasm3GAce7xzrmKrhlZNVfbmDI6PYe+QKrPGXTJ0dzLZVpBjO8NDIK2c7hRNkvPJ/PmwHbr3/y29+SMdy5wQ1oVdntflkpXQR4tb5cuVL2UBTWvA5Tw1Usb+W20M/8dbP82r0gR2n9huVjU1/GTvbLCTRpxt6HowemVi7+2u99u59U1M7xMOR+Y9GPsMGSUQjtBqp4OKql40I464LWgCkG/a2q09FEx96xkk1DF88Wm4eFIs2EwB8PdSVRBYRZMoWJLpz7bpNcwMSiGLYGmHiNHkYbfBcF8JlPdg8+YsrEpzjbU0D7ngQC9kaWcpJ6lYurAGnMLn00NrlXW6rMfgB4zksFspnvnTv4bHKVVXTNbGhiB8MHr/UikCotz7as3wD2VPWv7ffPX7O1sq/9sgnVMTipUNaCTOyRdi2prNO3ApnMmbV/TwR23+gaB3vOVRb9fxl+p9n020rXJaK6OZoeYkyyWwaq8Y6KqKTp5ziVWn580OOv93qLdbtue5t7tNkfKjXL8YL5fRgZVZYRhkQ0JnXZn1/0yg1iqUypMlwVF27cXu6BfBIgGAYLqKAYDhUBDTBoO03t45f86vbfvThpnBlBQYmTXTSUWbzdsU4X9apH8jLOut5XDWFEPUo5xmr7Eqgbr81WbTYSPeaS4/PLlvZXTPxvsfmLA08vm9LKjVnI5xZYTbtXvCio8aTnjQtzHedLeW87vMR/p/x5vFSc/3C9ftvuq/FPk6KUyiz3eLA6cTB4mja6cMfxFe8UlMeebbu7WIIR2jjC8OJscsvb6/78KHx0uyesf4zYyNF5aZu3tNd3ZPratIjex582h1NR3+dFnKotjrz4ODuzEgwf9Nu71BkjeNNgIFUEYYLc42g70pqQzb4+rPe7yKQ5Gm+Yy/wRAARAQGANM7t9qS65r1Xdmgi78qplfbAxB8LqLALSHN4aABt1RrhaFz2tT8e3XY7J7xipV+ergxFPNTlsRhtCxQCyxpZadPCBQvmLavZePPKKLa1XV45/bQlKpE2MfeYWlqtHVk+HQzm+pdvWKESkcDcIBa1G2NB0zU4UJMJG22K1KKYYrnw6YJoB+4M9ajW1fTuU+IDrX9icdNsFbVL1wym6C03/qbaQLelebwoy5pDld/XUDPvVDePM88bCyoBkWxxVr74U77sZXfUZav/7K4fbV+zP8O8MpQmWHWfY5SGvNRPvefoJTPeLjeiCXHr/zoX7Y1TetZDwhI1N9wYDrHiAh6tCWHmB+KIIN9GrIDagEduQ+XDoSHHYVlFRSxMh4Bro6x1CQiN5UzbLkU64uP+nKUVIlJT0WI3QU22Uaf2nUvWrue7E8WA7ydmqKo7/rg3+s9htaoYMYrHeUuQOAY1MQyg/TIFahiCo0bApB2GWLiroXw8s/LZoSvrZ4dOjhSu50+WRgQbWw0HBo/NGreOTjTVF0N8rxSolLCfWM7+UZNOuVI1LDuTIRF/U0e2Jzc53ji4+fb1pmK3n3nqq82AYPnAlAUYh1/z+R9ZDQBFQhJ1GhAiw2YciR5QgJsYm5itK5vWr3v5BwcLJhZgSKoEDRSqDEQj5k1joLJudarbZvNwrDN4drJEJQQkpVSxiip/RCWgaj2sWtqMWFEOMMC6pvQwMZ9cev2i3ffw1oGmTaLW//srBzeXz8/fxv8xkfCq50QNVk6HvJ4AkU5hmDKtOGhChdQegh5PBjHfdzhbn50tTWV/NzPvav6EMxM2G1ui+06nx0lHidaLo1KodBmE0LStbXrA6XdoOJCmDYPBSj94pv+0p61+ZoZVOWgSYNlQfYpVBg2cyT3Pfb0NEaEiNTOSwBv2ouizaRbHYsDx7DFKrUXsB+6He2lFWrsBRN3CAAWg5BlYialU2QYTraimofkDKYGCgkVMDyo6GnnPNJkp1be0ViLVFUFuJgJe9tBoYtmOuUcKse+R4HjOO3q88mi+fZ1/iWptbltfUwxGTJnJ2+GAZYVnVXWwECLMp8zjBkhTiZhTXWKR5o557k+HJvpOz1ZGo27LlmY9r3Z16H+D0jYGrh95AgoWqfGksAG8renjdtApJIQXkAcjyalCaSYfYlKNGyD3FzZy3UaobVkoIKAUhzHK4eP9ljAQcOj4Ep8CeSMvv/iXLwQFyI4T8GRNMaZkPlgNur13HExfIE1GblX3J2MT5106f+7p6/I6nzDP9naXc5Gn4wKBEkVGXRliQadgxiy/4yWx6IvHzw08jlMWsgC1aGkol2vKzZmBvtLUyr0Dxg72lZqoMXcw9/7akbollTZzsqNPet8rnRiJHPdQzOpxmA3ZUB4a7lezYRtIxAJfUNMuqPR/R5ZUL+pN1p880atPnXjRuMnu6Vq6uWrY/BxypZCNRgNWxcLg8LNZAj5AXmN2VkEJuauFKHEXD3JkpzQAAhtdMvfKVvrRpMoKDEQMMBF+/6KKEFhPs4cZCdwJOaswghpBh0jTxCwDCaDLpMb9K3cfnFVhMC901RBtHh+IBziTn55pg8QqW74GHWNzywHTC7aVxOqluaFyCkvrp+3xqC0pl2OHXpKxYncRzot3tz4coM9oN2VN9Vdbd23oNF7dr6RQLYvtDsMZjCxybDFL4iyQz+Wj83R+IqhRKodWacPM0XsHCvvWXOukcjMyLQfP92K1lzpMD53pOy+4BtBaSN8XE6OOBEE1ACAA0xoBUWuigCgJZIblBAgBWo3m8NTXfSIETCAnRZY3SwEWeWI7SgI2eJQIAIiIEC+6RIMGVFLx1t6o1vKEsXIfBi6W04PTqLj/1KMDw9aWRzRV0OhvWdw5etiEc5MLS+lHm9SyysutOl2pLaSZ6vFh3fiSHWlsaFuazcp7TzWZy9Xmd737kYOphqCqnYvZefXls8teWGJ3xOSeeKZnKafhSPJsyGpDIfWIPuqxPE8/k2xonVcaP3ykOp1vWnUdOo5b82qrERqbSPZoQYCCBl1jasQkaFQUAEEj0aARAEAjaJABAhJnrN3t5x4Dtvu6uzeqxOZhLU0bVa1Kbq1JULEjYREZIAFQHi1A0EQTBuABAFFApWKCE0Sw17wv45SH2G+Lp3xwuHpwkMCI1JIoYgy/ZJSm4mQmSF49GojCuFt7+lFAg/uWPVoeltNnL1lSXFXx11v+1NN8ui073XTZy23hNe7ewGO6Qx1RPutviJ2Pz7eHvXKoKVrWBvhH/RyoiKsdS0UmxoOjTPE6feqdpT3V5Y5i++jMmNc6OGNgpxzhW+LdoKkC0Nwrg2BtnmjMowAAooFoAlSFgUgEglnIMECA+UoE7MabX3LkWPP8b/rCWcpr/OZ1V8u8fedV4TaJPlHbXTG0YO7XABDIjDKKsqmqC7anVhO22VOu62xR6zKYlUbWlItVLI0Njhf8fpjfmKexMFXajzmzsUJ7Ay+NwMyqE9U7Uj37Z1+oF5WjEwpK7e37B5cv2J0e655et9V4eqA5DWbYmo4Gg9Vm82TOIQE/Fc4T0l8Yr47aCXZstDDg14Unen8ynem6zn3OrXTHZ7RRjA9cubp/sPg7lQjgbAxpGeNpXICOy0w+vvVmRkD56Og868OEkcd7V2RLNZ/J0ua5N30vX8SVS/fMZp4OKNQZkKBgs4gOChBAGYCPNqdtE2G3gebhitze/qwL/QMOFmgKEJyooQk4d4eXDeZ2Y83PAbPPvdxuYvf5gzNT/YkzXtvu4fnzZvLDpizJ6l+HFqwcfLL9dCzUMDy4e6ZQzWrtwkMvVDC7Cmdze3TesfoC0fTLi+PWZCwwkBjiY8uXKz399Es1WQoT05uOlQopN3h5dmSs4rlpdxACcEzF5T4CEVAq5ggNbQrBXTiKM1L79DBbSsr3Ibp6RwsYUlYna048GUwNjZEUcicIkAVQVVf3PO+gitwuAwllzPIl52b3N28YAfrOjHmH2XboCukKIxf4El2mKexiPuORquxTHEZLuRn56ERN/WyTmZoyCARG5/a6LxXjQXbZW0/c5ZUrq8L8xYGz/UPlZePdlemhqvju6coVfTPeE27aHIOjpWRiUWXw4NSZ6QOJsdWDA0wfHJkKKmPF5Q8XyDOzIsiWD10pDQRvVaJpbtuQFYDCHJhd1G4L1ITEeAa4RqM8eb5HL/Ix+8vcvMp310goFQM1SQTttkIw7y8r4Tq/NtLIXhApX+2PMXVrneDoSGWmdKSgWZanBfu9qh8YswJgNHU3pYeSZCSSEtEpFQ4PuyLgaS5dUw+agc+sdn53ya5Qco7OjJaLsbFk2SSth08ECoMHpjbpwdZ6s6f4pBkY7/KcE2tiAfv5xXhFR/KqO8ow4THXdbs++PJh95cDOjJrCQTeEDBI5kihRtv33ld7GgVgUMZwBVC3cBkoiDwaEVaBtqSV7R9qemHp6RPh0cCband9VBeaAZMZD0bvPSUkfMtiJoJmLD6eVtSlXLZYEV88lnEYgOterr/8jFO2Wx+p7J60cABMJ8gnRcPnd6WYh9oj5aiEInvP79cHe0/brYn8cRY+Mzc/cTId751YYjQNxS+pjfsrb159dbJhXttC3MwNL7bRaDIj++6979yETys3v/s965kznVJAFGQGwI6ZLoe073pe/d2fexBRM1yUDJRDtayKFrWvmlp2pc5vEjl0Q09evy1EjdrxTSoJJBONG61eHXhIZklO8FZeUrlDaQDNfOTDBYOCkeTqscHFgaF5MHAmVMjlg5YmChNju0MogVlzINRBqx/xX74UlcGCdmjwitwr7rEwLWwZOJydqR067vaikTeLY6buDxBtD1X5bn+dA/TAsWP+si5Wo+UxN9qWWLQHXQmgmuXpVwsGuvGD4/bofd+2a5arOBU7aGEDX0mww26WTKmSVnp7LDOmBaU3QICyEGUbkBnCgF1dqBbaLLSkVpoLnoZMlyq7+am6fEbUnBtM8xmH+AqFAChMIwBIVTHsdDjLh2abksFX2bruS694ItQeywULE4lcckn+ZKZ8irYMDJ+szVU6yWJJOnCK5cz5/UV28BHdm8behmsWUd+X+52lSlo6CCChntfvOPJ3B0ybjDqr14qLP/rXD7ds5HPUAESroiUl84SHD3If3DBgkgS7beIgudxyliEECCC3BCvaE4KVCoCAQQDdpABQNMuZGmvrPJQTKlwmiILbtKBNSTUQMRSEsyqzfSqivNH3td2Smz41ZI64YtwN5VR0w4IFqaG9qSNORgbM2YHxWNAhKh62p0Afub02f2jtgNUx5L2cCi4OBHcTqttXPxQp4K6/wbsdlA0ka92K3J/823su04zvZBcraAAAtAKrYCvtGxYPG0w+51QBSGkc9BIy+tmle+mOh1zDouMSAvW1OVPRvErMbs2bEqfklF2Sf+vyF77PxpMDgOfPvAY+enKd1TdWVN828s+d5VHBg+FQTYaOFHRqbHnjyEkje4WTbySDpsSoXQ+KNnR2Ttw3c6nYavY9kyor/7PTT/20naatX9BWDFDW1ccZmS0o3kEl9sk3hocBBltvbHYYWDqj8nXL/Xq5QWlp2Ey0BAQiJlWC6tO99rV/7kgWHVpjJBlkkqqAkkfZ6G0RGeKusgqD14m1YLdptx5oxq3rRfHkP+O1ywdzyuFBaKtx7OeOTsWjrrG9swQQbXJjGC5l88ETPMICz0aDM4dPLoz1ZtLVmQb/aL1UMEOCADGaiqW9DxBbM0AM2rXtzriYhbLeZIA7KynUtesva+RRAdDcpvqhq//RXHdZ3aO5r13JuKrGr92hFBCudDReDGi7HPh/72EevYBnPk6WqGvKJ3IzC03OJxxGHV13aEzmx2xzdV1ZFmrcNis16RRLbhDNqJ01cXDmDDVlZLzsTIu5/eNzdjc7IzuDXkmOwEiYMRyHzRiSgXtVi2CiMUcnSMLFoAIhPMqckJsBBXeqj6ycsNs8/gPuaQeeTkXtfPODZDB+4fu3DMUAo2SylShKzPlF4lObApc6u2kf9UbPjlqZ9wK7HXi1MyBozHJLyzuCedObc2pL5JL5LXag0dB/7+/J54ZK8UxFhfOSUb2gpwTHTisymSTFzfO7KRUTZUM2QIgqZYcoOK6eYNBRnuy/4WkBZBtPvaQVVTRzcgMwDyCjSzUSpnEUTkWjYZHklO17BjsW3snLBobVewIBDZfUJzrdpspUqfIYiBYQFBjNuvTqrBsNx4PPZKoChUs2dld2hotdjYWVc6ua37Wwpb7g9332f7qn/uY3PPf0+EnTqFBN0X2jbLzeQxJ1G4KHPAyExAwSgkFhAixAABmn1Ya09bRrwrwyUT5XJCaYhQ7QCK4XXzIyX59zAFQ1gBoS5JbqDgMyFdIDcBiHKoBAajo9+1nfS4/lh0bCGOsIIA0MlC0z3WRMdYx9vYQBaeNqu6JHiVc67oGxBxZW0QNc8wnTTBsTJCNne7NyExiCAtgQo3pObK3y02zt5Cd+9toIm8GoBucskN0ZGxYBkUQJwS1ys5Ujp+Mc3rglQ9GM1SaI1ByoQn6OPxSIlODnv9mF8YP/e9DtrPTii58eO7bdjcCa6QUHJpbuqweCUVqKtA+frVvZt2HXTBAWJxOnzlmZrA64ebEkMUXzlQeOGRjAIha+4kAVSyqGVU7Dpzz8J/e0wISuR0xqHYSMoBCIXmao1KkYANEP7qlTLKoAQAguCaUw6vDkIJVCQNgPCXcEoAFsv/1jH537s1JnmOc8le42wqbyyFgsmOSZefN+ry+JAjjG6FnS1IQfrH10Ro0V8yvvnw1RCVrvaE70+41fu8cwMSiAZRmS9Izter0gdAnDRh5QE5Ku+/Vv2cweqjJnq5wCttYXFJPGWgOYNWLFpr9+64WAVPH8FKmS4xu9QTTn127/90e9MO0OxzamQ38rXiDRYgOxoGuy6WxFw5HayVcf6U6MHjwZP0hFpOKJ+hMvfM7L++h5avbOzWzjQ1/x1RBs+u+VgNYFdZV9BgQYtc3S5u3bXe3SMl9iwkavTVT92zBKwBFOv/b9rxUC0Td3gGxEYJoGqLDk5Q6OD6YTsUjWUcS9+bOYuCx3gryrZveJodk9NEnG9SRblxi5ywfn5jHftBoip9n0us88QUY4HoO2mz3z87/gsAygaHHkiL6tSoKziAL3wUldN6grcC8qPCJQiLQJuksVASr6AggbKKDoJQilO2/O/bRPTVmNODXNKMvWbSbnZ5bw+/eng827/Ynl7pi99FBAWsGspd/jjunEU1u6w7UJOPC+00ZN/o7/+Osr7JqAGKhK4qlYVWHOsgUU6CZGZaScPSRMEWqm+Pga/BGI0gpjgAhSRVSCAemtxkxWh043V+gprGjJ3K0Yjk/4kbjHnTkHxsu5yfMjofKw5ZjNv6ueTVQVMuu4aMfqEbTFIydmZX7trtj4tdFZ9w3/9k+XwLcBDBoyKKqZkEFLCSSR/Xb2OLSdnFHxZpKEBXDr2cgqp4JA2AoCyKq0YTit/VQV2mJkGqcAQlQ4ZHueOhbOJGuTc6b6cgk5rW6nE+a4QBo4jV5JjHmjD/tnHYDD8Ud+bQGoACEJGcViO/epl01K8DE5MY4WphaAEzJrAS01QbKci6ICLiDH6Q4jA6ChFByGoUyuLTOKmciU4hPG5LBnGlkEIcFVgCoBJiINZEA1hUCAXGHN4DGBCGCTRmlZm37OMZzNUD8PNxIOUZRbTnWBoGw9E8KjlkKxVa0AeoIUqEambOlaLrranaFlnVSOlgoEKgmKBACKZZUCmQDpJLzUDJZKgo/YyFyM0keBR8Ho4akFSXQUkZAkTpGJBJI4MpDeJgQRnQdbA4LUYzabpQw6hmU0TM5DZeoqlxNLKF6WVNUWuURkSAGHAQgENHcLQRADEBVQKrlddxMBojFCZxZoCeHJLwZAkSI8SEISukNpS9rX0cTwGKs0EChoUiWCkKJyRc3abbft7lRuiXbsEbzexgSKAI23b4+2UklCggHBHMJ9XlUBFNKhbWAenjAjcn7Jw9GCaDGQ145ypjHRKFDZuBFaDjcAQwBCBHDt9iHIB6+462iWU4xyLsw/P0kFwIPN1cVNYRjOgoXWM33YhpYSmWHwUT3QUOWByStSQlLInQ2JhpBHSTYJgQACWYQSXgboAkUjP8XB8/o5IfQBefeOSWL+msuuuDAaIa9CCPO5dEnYNk8AIgQC1xLCyx88AQEE3IR2QhIjPUsClI9QqjM4CHhWQHXckmaoSyIrJ2Ns5CQgQ/YGvcOYjgZFFsEpR9dMgJIakSGrsX1fCAiimeRm3ZQ2zQxhjISSACCJtkVVNwXkVAbW7ezFnAN+7R9+CBRAiv2THdW/XasPG6XlQ0Uqs5HioSQgEB6vWIK8ZhlNq8YxwEjp+HnPWDcVwEE7JFIFYoQAQmXvzjr5XUggbDcDAJbEQs8W8un9954zM04px5uuMZ6ZTNBNY4uBXuiFDQjyivKIbi1ykBHCq7ZJGTEA6RAS8ycVMpRpCjKKVXphrBsIu/MDQhF1lfY//MMOL3cGJelWd3fvizCKa3TJ15/WLyFqZcO5NlB3UY+rNzSKLLGkRAKSJRuDY8CKK0IyEYyoGzwKXYSf3tHcvFFVxz/8sx/8TNMACBCbw0czasMUfvCeLayDC4Ssur5eolINBiRugk0cOdEAorr2vDaJ26nrfrvMyUGoUcr45h0D14YkwACNEi2YKcQw6ppLFB/cTtzFUxu2CM/Rv+67v+31Dhh+c7B+vcnB+0JCeMZm8uBAFxhVRGUakxWAAgugCbFxzb5oqLbbzpdVACW39xWEWfRO6Q69JgkgcH0jo6AQFHV/8+3XXvI2ROJTvvpy8uIjCTA//aYZDZGF/HFjiWMULEKYJJQhQWvPCsEYCgmot6UMJHEeZDISQDQNjPdeKKQV+cW/vyO9Ud/807/yuZc+KJdhTFXN8N0sgHxMARrYH+m6kVseJQlbdDzP3aXoIwmAG6i7Zfi3JdWIxQICeX9jFZyIXdp689quYPzVLxatYDn2v+ybn9a+QYqTAJJqVAARZApEELCB2lpzS4Ztm3b/JO26ALMwm6EApaz2r5gHS0AhLbGK+O5yAaQXOEefvU01AfkWRAUQzCd9w0NoPCMQdxZaAAqgmuijGRcv5HWmMwULElGrRm31AkCuOxR7GomzwhSwETscWbfXj59+f00Qc5tq0QrQ3jwt6qdFpwI8sYn/i76MLAp+BhIT/LjsntQIABa/QlSYKFuBUyQdsk0VaTya3H70riBsNwGEj6rUM1/F542Hi0goHKWzuMOQG4s8KKsGYaFFYIWqvG5qLmzcPuWnJwS0aUXmJR/30GryGRkFedWTl8/Q/w9ICAvqawDi0V47OhNJ+5yWgprV+IAR3Ud99nmfWKWPACIg4aObRKMakA+QC7kBYgs+5UIGBFZQOCD0MgAAUJYAnQEqcAG4AD5tMJJGpCMhoSs52sCADYliJ2vrzYoxCq0OH6E7hrV6QmJvXH6v/ru2J/o+8V/Pv8p6UGrx87vpi5sT+j/632ze0/sGg/JfxjOb7DdL5l+9v4Xyt3w/R15gvQL8wv7WfuV7xnpS/qvqAf1f/Ff//sS/QG8vP2WP77/0/269qH//+wB///bW4Gf/G+jHxq/VeD/iq9p+7XvtfdGVP0n+981/5P+Lv53+K9NO9f5m6gX5Z/Qv+B6Nf3fZoaZ/vfQF9ufvH/X/x3kZ6iPvH+q9gP+b/13/u/3r1y/5vhXfU/+H+3vwAfzj/Af+f/U+6X/b/+//Vfm37XPzv/Xf/H/afAP/OP796dP//96/7rezN+5J62g2+JPrM1rtNsEWeE9G5RsORUCw2RmX4Disvt/rP2EJl6M7zffXW1YzWHFY7B3udLdgaGX84qo/XvvKxUMmXTN4YbcrJFkdqqv8lWfaekIH7kkFbWWgS0/MhhwyyNvXgM7etd0xw6EzxJ0FewINLGIIdLcCGVQ3sMlUo6i0DniDaz51dp3lYqQQd2sBg6qb9uP+bnRNymIdpuLZwHZsNdUv8v5jo6EJGf+ppeh00zAHWsypA36hf9mdkBZBD6M8el2XTK3C0DFBOQwpjjIIm8jEVcITdTzY96hDXa92MXjM6ls3/ayB6kfMOqCBKzwI6duudKg+Fb/Z6viz9F/3xLqfHUcr/06RkVtysNNh2GPCRYsYNWse4QMf6RY9BIS/yowLHgkGbyglUekfQbQXceDF4/18+quZf+vThPoQ82i+ZJeGo3poYsM174JHY95RwB81Eb3TBeC3Rx0iO9578FiqdwsETz1F31AD1+yNrzjTX0Vco3W5vhid7quSSXsYrz5/KMrC43PgMC+4/csfK1vFY5xBUPcoOZw4WIIWTxDWc6VSash0Q2wUZANsUuP0JyojAdnppulnEu029BQAGIwsBc4FMFR+3ukSkp82Nt/ANbK/wttjqaI1fu5dZkHbd2AEebJ90pyOd0ENs85XDAA8Do2Bt9k/Lu1INX/VQIKvAeZ6uTyvHqwXE7I3KGWbcRnn6jPuv8XAj1PXNBzqGS9qR36vqz4/qRzIobqrQk7khr5kT0I8mNOsM66Y8hT/jAM1W5vchF9y2QfIuo5A40m9OpEO+4BE1Ai2eR83O4erRlUDAJ01dDBbZiBYUap4LiYxrNQmAbxaDTi603droHdeuAUwHSXQ54wxwWOyViA32AvlFZvW4qOhFA87ppJrmv1+EiRKFhTa2cH0jpgfcaeaqvPVciT6K/uFws5SZkQDPld36+8kvdPmvfHZ7smJi9wfLaOefOMJSuqo/A9dECVf//o19T95hJI3eZ9dY+4skAXAAB1Ggov0gdoltx7PlCEay5j9XmeUD5Hqa0sNVfCiVIg5HdiKQD6W0CM29gqhb/tFJjY9HHZ+eyc2O2tCGGanqZ0CgQL+d1arhHD8Oes4f7wJLYUsq/Dj+uOmHlBgJDdzZSwEpQBg4tmwosRkgTFH7g7yaAgNFHFDe+PWpWkqNWcoCkczQEpgPSsE14uFuFxW4d+tE93gDvg78qN4pZJQQzGBPcp3rMGEoKAzeawA/vkDUDl/55+SH8pdmbsnFaDzkNpBw8iJBiNW5XBxKUo3uwKiSlOYkr+SxHP/AAddVA4qehOXnr+tEYX0TUbHLVYXTmiSJG+De6of+IkQ3aPTuN5lWVdKIaDn9YJBXU6LzkdstJgo/hxfUt8m2jmgDNPfE+/fhYXbUKJapMaxjkKfAysX74wCMJig7q18+mqgagW79VZyWnkOvd+pPH7ttiLRsqOuif5UD3TdP2xpRQccBGjDtEjrQH0oc7UTT6Z4X0EvYS7zMveKCz7wk3pC5u9tld+OVGkIBOaOghg8sxdbruUckercuZCKlkfGy6wdE/NuwWh+Yi9uCxjV9eHe/zEkKFJeBjYrKapbe5vcwKAoJ2lyasoUPOxzcs+FXVJSrFWnHdlBz78vuhr87YGQUFJEz/DMWotvcIFtOsEHm8v4nrf5I1g49Z/winromJu9IQt1lg9V8er5Ot73od++lEc6jsXowSdTaMBp8a7sx1pj8nwCZJBEDmAWMcogPToCsyTIGDXyfJH+Uz9Z4IJs9zZ0WJvc9bhl08ENew8Y4HgXKfBIO23oBCTlNKbzW1HFcvBzHbg7yK9GMERW0vcIIeqnngre5AQAatrjC3e2OQ6R72KDxmpnJASpz0WEB0y9gkKQujp6RtKZivQerDgvafkBguBMyemYBe/wEIuEkjNtbVpPImBjC6je/6IwNURFTkpT0km9xIbPT7Y6aq69ICxpM5A0R4Uf9u3OIWI6ZH91IGMUPqKjpC6o0mfZVxZLd5jVPZn0oc4/bEtoldXeLqeAFX/ZaKh6GF+g/dBvI2TbzxyUhvRQhiwq89fNx/1hv02+IxEXru1NeB+pUuIqaMBP5O0d1oVVxV66h1Loh1WSzTfUp5NTFkfwGv/XsjV90jbWihyZ0v/N1NH3LT7Mc6m7sdnrEtwlAMyDc5PCWYEs5o6A+X2rfUvi+YLjxz6IaaLPCO4B2I1oaBz9i6dNOKNyqP7lFfAUzsHZbEQX8UC8Q064lchWZiz3xJgZTnopA2LfpKQ/FASYYaVFQkgAEoprtX1+T91AfNwKN3kfY/jeRDr/UjYi5tjyYuygw6rc5fwsVPvR0ACnjr2KGG9SUmjg0+pkn2YHqVs5RhDFJ59MtUqI3Pbw92VbeTIEvGHs9rQywplU9Sd24ymgR/W1cj/9c2egEvFRAVgeVxbmgzYLcW3Ze02TSwNZfCQk1+/wLs5RhHjFfjBM5f9kiXBIKhcSuqm2jztugeicK4uDQqCjCwK1k53B85ExDzxn8bf3tiHtWLIwU4qaAec4e9Ocx8Lx1LuuGmjq59+aDQwBo5t/wX5Agxfgc4j9R67a684QxHrXdDMNvPBJnSKt8fRrWSB1hFOt3O0ECvsdzaX4uLrE+l7vMYt8/CVylEfgVSBN1cJmCqwj9zwC8ORMm8PuXCk85XBoheNMbwHfL2AWqHTR/jg7GDeUpdjnOOdZuYnbkbOPVati/xPHwR2pP/e0+lwEhM/EKRcXG0SYqnu47wiY/dJcoE8JBKcuuoHWqUZKKoJW61tH4It36PAJrBgmhBCbAwpzEN7cW0mpYUAMJpVqJIpaNqEb+QxJQS3AA1uBt42XNHbF+I0Iv/c5JmsrvcPU34u4ksniBIuFxApiNz6SxD6X33Hv1PrkjuEBkGfWEG12hAxN7kKTk6w6G16dG77GiHf3jsPAEkIhQN7daaYYfLzxCplqdf3p0aeD/6euGt37/C8YGohr5MIVAiYOgZjxGzC92mfl1ESDavBpYgJgn/qnZYbmPFYip55I9M+8SywHw3rgz2x+ToHJAOyDetYNT+sMUJc8wDuP4pkwiVMRF3745dGuaPGs1UgN9HLTi0RYxPwqZl/af9bufl1MDg7IcHqAfUeWW/U4Uk/2MnxUE8JIcQ2gsKA47qrzBtQ6Mk8tbHBhpVhHoVbaEu/ET9XLtjuAESJ5NdeobZy235uPEoz5DR+5Usm4hXFyPmahlHnRoJV0+vBda8KhS6qSW8LpZGQtCKfIR2Ynbnf7U7Csso88BBcpgQ502Dta2jUjUfiJp50wNYB4IuaFBKuBv8BKt+B2m6xqdSTsCQYF6RuoGNR5WHgI0ddg2ZnMCov1nLacvbpqOU1+gfS59fx1vcb8UUSdfi4BDcOdruiJqAilNNKXymM3/UiaXPtEbki765IIM/X6lah4H9MdW1GFtryuMHLkRsT/OwJUwDZO3tcGScD2L6sUeKGF434um/xe43CkWGL38suPc2b9SoR6QbS0fi/aoeKnfp0bPY1+IEQRNXwUjB1gfVdDbUIlzuxEjaoEHr4u4oYtu9lA1oQKfnQGJ3iAQwDj1tj6+QoZP3F9R7NP6gaL8hUeItP5507qAQDGg59VP6NTccC2rfBNMfsKm4aMeqFejMzY9lOv3n7xv1Xk02CzZ90/oa7RU8aGb2S8rSIgXopCnZvpGMhinH+vdUuhD/912C4akqoYz3PzoJLcKasJpE9+8jDlw7DsIJGpr66xC67ObGfBZgqZpNpPwUBcXJABI0McPzF0LiOwQXRnULoc+gfK+d5gPJgyKIMMNwp+5aD8iY3TxfbeoZX7pSGe9OOeORUxJQHNuKKcfXDv8vZ85HyljHrmdUyQf8oKP/ifSlGjRmbGXum+Kt5T1F/CvS1A6F+7Lp3M/yyZcavNc/ltZlm/d3rSABzsPqFh9FJaV73LsMrC0ydWscFldi2lQAGUTc048WN9z9eidctLwX8GSv2aq3ThV1uROFWdoxyAcp+o9V2jLa25qbXrviOvW7BYqZPvkVzkMeBWwRCcNm8RhNkmYaO6qLd+91cZGjjZCQLHRcv1z/YYmrLP6+1QBTmvOR7qsE+yn9/BC+FH0EP8hays2MZG50B0AwOrlQQXz5Ym7NO8vszh91v1j/0wQqYIyxW4ViP9MxJvBUrKBlLMcGFFafWorNItuigoPJ0NHqct4BPs0anQ4VORjuqilY7aw23/FveEuD97qQfXHxMQ2lvDlbsnuvRX+wLZme5/VpnmCv9pPRbQgQ/uPbEH5W6ViVLPJoJOhHU6Azt7iFt9j/avsDa0Rc57RJXHDhdyl2gveSSy0+1s9JWx0JllLohbaLZ2HrXSmOb6Dkzn0zi1DDd5U91UYJoZEbDyNB4moxEXtZ3PerryXWBKuKMC1XaE/z47ZBTQcJAY0rUWp1n40B4t8qB6t/6jvM0AXlcU7vXFhN4DbxqIfy5qd6OCvrNum14sCefcBcHzrFWytpbv3tSmRTkE9rXrYRUR9tkVTO/TOnCnl2MBxTtgXi1YoSht85NSLXgFoxK7i9RGD79cWPhKriQsrBR6DDtSmL2XAGVox3sbvxc/b9UGL2yg6JnuZ+q+HRCPUiWZX7Pl798Fopl7op1iFPXfHale7ICYseLFsN83zVMc8BnnYbb3mdsy177DcKrlGDmDuzjEEfe1u0SvFXjlUgclEBJoFr9snZ1n0RTh7qDKqNUeSQEkJkJ9cLLkEqcGzC3r+YtWW74FK+oFPYG9MqllBPjsritpM3ijtURsvH4m+yg+dLBejSyc/4OxXr27LZX7Z4bGJ1q4xvZlpmrAosnQ2nDpH6CTYboPZIkyrgFO2edqpzp8LlCdT+0q9+BvmjWHiQ7HJW6QsN4xGk0TqulSLYcOVu0ydjzfzg5FiKgyF0l9CN5RVulZEo7I+cmJm+Om46ceZHaPXhpbTdT4AarzRaoSLFsvqZwGMQho30Ffuwq/38h0+cUcWTO9p4+xYgpCVpkf2EAzBZjqNsqldluRAfxEqOAT0PFwkO5QSLLfBGvJiWkEXNhvQas4Zm0T4Cy7iuXgOJJQGTH0uWM/wLGa6g290OTJotgT1foplIY+mmyF9eXkd+lb1BTOZa7QeXyEaEru/yHpmnIM3f+Kdn07QLATISynzRXyQkWt2G7oTmgCqVwuwY3cGT6rRhPUsI4Pf8pjf0u/f53JOdHWvZejQuZwSIc/zRnmRgm19zFQlGp288QQySkMPuv2Ael2BCI1yVjRKZx+r30cHHZ1fcsYXbwvjpseAVPZWhdtwgnLc8OYO3bPwC3o1wiec9t5nugmkTC2pH0wCJ6kdP87+T9uj12TnOldLCIGQ56owEm2xXH454c0brdLtKNfrIvybQ0GpOduy7qSSt9G5Yh5FfiK4oPbsU9/rErh9GA0onoQGvwpg1n+abWqZIIwzvTglyYblod26CEQAax5EliGdWZNiuqfWJPfLx715iqGdqPwveVRrSJZTeaBHmjTYH61qNMD5p7Wb3J1BmmBthKZcDhgtt3hjoueb09qZyTtfdF/jp+K50L3zp+jWSW9K7HCUddJ/jwk4A82mq8xmtUbkwXn/gBPLdGfMwTHsoocID55Jtb1pzMHTwpLsGCpcS5Kx8LwH3Sq/w7rq/SsMZc0yZ2YccAsDrbyYYA5QHHZ/6KXQ7AT7Vg0Hy023MYUgwf2R00Mi/aMlt8YkGlvZeW1RbW0L0mNVz7Memli1Y1Xtu17NIR02npDGHZcDrX/z9Dxvd28buNbwbr2NnER3+PeA3CD1XF62sDqv4C1RzDWohfzNCfYT6wPUJHCelVzbkKGES+Ph6QPjV7jRq9Eg3/ZHFD2Elw88XZKPq2tVaJlskf+J2hJNrPXAwSnW6b+FZrFu/e0JFbMCzbjECQ21fri5EcZo1G/RVM/hWi3K1OpFyOprGGOJdm897hJ0mkNZ/q842lj+b2MU9heX/birjEwD2TQq2aivoRlVLpAYzufsAwPV1ZU6+uir9XH9M5vRZMCrN77fbkKwR8UZbN2P2mFijllYCrketEU3fCy/+Oq2p6FVwDrmD+L9toUfFvxysGL4mdVTk+QYuW9aUQLWS0ZNyjuQZy6IvjnGIOYOeRgljkj6K7oD+JPt83I/n4gJq7cTT613x0hjOjA8wbJRyC3c0eQdvliEoBuOu01YQ5XsaM5c8/uy7xLu094bELVZtCPYCbtE54pMn/dZ10ol1yNRnjQUK30BXEo90YOarPDnJbK1MUYt5SXE4XRAVTh8eS/Cy0RbMyJRqxgA8oov9W+8Mb5/XMvESQNb+Kk/fl8AAnezcG5ixsQP9mUPYvLg3SuZ00kIVQLp5ckuPA0EvCsXI6hdcoaQnqIOhrqwsULH2367H0kdRP3HuvvmjmmFz5NP4bPvR/9/jBClMsvBXyLTfCFV6g65fZJXqnDE2gfGjyURNBgkaQZZ712tP6EB51utQvcqlaYuUUBwImsUcCKh1QL6UVh2Yo49P1PnEvffjE7C6z0UyA7H0DaJDSUqAaD6GRQSndccWIalri99o7qL1WqL9FTFVzLzWSQ6oIdGxVyUI9KeznsTWm9fWBUqJkZSxzwYqS+9ohdeBJ+/Z9ozfaj6S8ln2prJJjDBSBnIjKJYyiPVokC589r2nrKL8imdk+NuIbD73cIQENyzpc2kkY+0/jDWfR6OIU1bCDF2uDdnbcl2+cKWitgCyZcnANQtxoi3maP8g79zUysGQ+dhbBlPWJMQLUw6e+ixRHZxHUfg87QW5AUXYhHprT3Jckj+Kdim/dv2Y9CcPAbi3BGFXTay6K6JRRyU4qEmuEDC0yrGjpGwYHv/KaJuRJomYi9o9RANywhPvRrPtDbNIebDzWc7LozY2ESstICvlfGCiepFzuOWLMJfnbMPMJA2ii9iKHAwd0/Ej7BqMezchzqppQlGHIEyQo+wWrstWMXaPTFSFASgB/33Mz15d4sBKcy+KIOi3nVuIxipPAi5eTES+UoIavciqYPFtvpMnQdnxxNDD968jaXWZFit9zn9wPTQCnH73fptsgyCZ5chXsEHuaY/buRmw9qk6/b/LGJ0iSz4bgg+SvxHmOfL3AW9GiJZL3YFI1hMFb8cUopHrp/peH9+u8RIZBxhmmruFiT30gQcGH8sUCzvdwvKcHPympLn2aK5wfU/ypSLgZ2u0M0iR6K+mM8FDUbextMDYifgqKwGMLTFq7TcmwBiUZsoT9M1/zYwQ58g/1P5y57dfDoD3hs9MrXDa6xuCyU5CKJsWHX7oS020MYtedY9ewJw/a8nnnEjWzK3IehGE0eLUyLeR6YUZPg0WkQ+npFF2rz8bJE8SEwH9ZB+UCbNZyElKY/BEiyidBimi20oVtLR+mEi+YIo0w1+sljVFRL2x844dZjcpQtgK8dyvI3/1tGqtxQChBmbbUAFpUdLnPtleXblnnhrYnk4Tx2SipzfY3+TtceVJx4q9AbkPROF9xyykuH0JTT7OoRd8TZ0kc6SenZh30Q8qzsQJ3pn8J1z8ls8ObyFh9MizVfZqgz+61BVG9PBnfI+2JhaGyp5Vs9isWTiJMXaumGgKsQD57+0auARcHm24fydqgj+wgMkF7dx6ZinPFbFnXTfZQcynHIgf8lMHazOCdmqDijNaR+CjIQ1rbWippVb6F9o+2xQDthGYl7N4wdsos+MjsFsx9dlkeKOoMtDwP7QarvcY4jNDhxBTqEJsrwJAa+Xoayr/xF+yYd1RBvEwRad23Np7twHQQwH9I7tw8MV5Hllczq7oukkU10Do/GKAsEv5ebrhWOakpJIUIEfs/m8FK90hW+S4vPGNmR/GIB8dnRh7g+6Ir/vUJf4vH7H8d+t25VCTNHBsPy1nyrsosbCFCePk3wjS9PziwMStwqySnzXUkjgF8mFqDvPZbgS1EcG/oYiKq4G8HqDgpDXLS2w4tJpXzd9tca9BMysR9PGNMWl96sOrE6erahG1x/hIM0MMXbBftlr0bAPyRLG8V9uKYZuXgj9BPGjpAZku/DkxOHPpbfvslYLMmLqZhreyYj5Eli6oDY2frgvX4hj8smrw3tParI9p3QvpnlZgTHlfIeAPgnzVY0kLTJFfzdWCTbEiaXSJsiww3T0d3GpZqniO5c5B/71Dpqm9fJS3KB6ykoK6Hlg3CeOO21540ZxWZu7BCuGloBx7u2RHewZvhRb/b0BeikzxSjEByqtz/p4t4l7PJkNfUv1vjhqsvxff+eiALYq6yD+WhMh5Vf5+JIFwcjP98UHUj2r/MBDlVtkMeWSdFJK99APdEeTjoX4XimReJTF1AkSlq0qKmSiTSdJ9UZf8YDi3LTphGXi70bSgfVLcuD5ObOd3Ami+sHAC7xq1uG+3jSdVM2+vZoeeBp9sEO/7jB3RFQxhta1HNmnQJ8wEcUg1iRy1iA8xVfanQa1vyH2k+v9RS2rjzq3adDNQZo1e1DwIhIKuTZxPx4jPXkOO/4x1b7qoAPjqek1urbA4pCAWYsAsK2v9t06RtC5B1dJe6YMc/WQVHop1jFFYcbUbHZ6BTkAOC9pZT/vPI2W+1xM68R2XNPl5slTP9T91Ac7C15Mfv9aBH8A6taV8Gin/Hd7X9fBvXDIZRtD+dVBBH6gaOjrin7UAUPwyRjyIEKJN9af4qaPDbJC8X6dMox3KyRncLx8g5wB+1g6MoA1NjsG4JT71Y/WxsRa/4e/u0vUjB2LD5XUD0UF6InPDPa1RMM3ir6O1r8h8Myq+DWXtmqOS9iYL3xjJVO1rmmylmrzPJCTFDb9awOdb7vje2k5TuLevFhs/Xd5QLWJlsWsr4jtU8NuXQ+pBApDBeNzolNRiO9Tede/0gmL6FcmHLxQbvDDmOjBxKqnqnyjdcL4jhPkFBbQms0ex/qzHcP4TYnmqZO0pl2eKiCYg2z+CIPRJyRh/A9pICOEAENFM+Ll6uE2s4qXLcyhcnfeLyp2NG435k07bjx9w0DtIAqwTsuKmCCTOWoBFlPmjhPSYxLL3AdN+WNktf3/UG89nvhvGP3jIMePWh4nk+8qlpcbfX8f1a1adsWowm/B2+f904IR8LbY/lB90rsbsL2XnwQBcwcqg5F9G6BvG9niasfFhNzZfRKE21ZN6M9qLZT5OQwpGdhy259s6EE+TMVaiKusFc9mE460hNpFoYZfsjfoN6HBkkHRWBLNbZrmQ1tHDXsU4gsph8tAKXihzu10IJoNEMfe1nCbKNlTFIJzhLSh78UQ/ezOX5u3t3vNFCKuiLryO7sTr1oQ1hVOeEfdztCJY3+VXSWJmpAL2wKXahZz0e8+pLPhycIr6k3PxBgytCN4QiGWVlN/vCLB3nBxqwnj7F9LsXB6JdNM5i6Kx58j9pQGF5vJftiEmUsw10dRyqgf03g2qJYLUwzvPqARqfv7/LXZ0ybTkOPx7tUrJvl1dR7eWjQSJYNXncVafT8E/QqibeXDJr/nmgA8otKuN/4mlmaRxO70/Dcea19moUi3PCscjy3sJCgpQjFqqSaSkLt5iTO4AdxpG75ofl5fDY+qUAS7S1nZT0TCfJOXeyQTqxeARN6zAEpND3luN56scDJVIC1FY+WXPI0HsUrnTi4gWJUy66aJpwZBmw8UgLhAiTXeLzyiGP52FTBfva9iA7l+w2ktN5gwWIrXJ12NmLolw55PpIHc9IOToMMUmhjCfh7ubjIoX+l6Jp/zBMSymxfdtVH3SMm9kO9ypJ6ZdXS28tILL0qc1EEXqHK0Pk0O57N0PUgrSQBPPciFivA6PfGmCDmJxZ7vMAjdtaXgsP2XT5y8G3e7E4slIcQ+SuAAHqzJvQLOtwOsbUDzKiXxN+17LS0U+HlLQe2wj+OYW8CMwxQBxw6pB1TYZnPyA9uGCxWvIXlqZ5Umn1lRlUr0QPMqmd3J6qPfbHpgJq30NtOsr875yF6+AzkM9liXlkDf8yG7WaituhTVGk9FrspMtYeBBwvdDpZhfSj+YpvvKRY3I178pH6tXI12nqsPUaLQfXEJ1n1me1aXqdcvPOYOt3uLxZEIZ8POEomv930mJU5lIc/69fPoNTkN4TGOZLkjOjRhpY0c7AU5jr2qVLiIkGkM++XBq6fbND8xzjoOIK3vHC5E6FsfhlgVjyNYyl19rVYBlqoawRigSNrlibYc7fjKdeXsoLMe/ljx+c2GRDIVup+95OPJHhHH/IBsA7dgX2wlKHsVBD5U2agp6nK/AzoKRSCmMqUaJcZKYYZfMHNAq60VdEQJO2Q750VjPaT4bk2Z31G0pKmpP0ebH6TeH5neu0+PCjFeBzaLxyqJLBEqkyOWDUcuJ/vh4MWj+jwisjc7zdy/PeGzWNkFDdvWi9P7y4UJV6sONOoGloaIFicP8IJEGygM2X7V94N+oXv5c3WYUtsGI8G7+ALIqUZde2ykZ2XzGHKZY5sAxHUS+CRJmMZD2qUtCJqXDCKHvlefUL2ouAezA2fBWaalmjr8qjpGMF4PfA4gL2k+7ETg1l6d2KLKFmW8YsU2T9Kf6sdhLxg7ZXN94Od9ZZwTOii+lHK2PMqXR/z46oLxsMN7kPwSmOMrw+M/tlrC0tt+NXenLWKwFjdnlVQnAIPQdFHvd2gHnAykkAMdaFxsOhVaVea8bMmV+3oGaftlaA9VxecLalfsZXpX+ateI8X/bbhx95M7q4u/61CZXaMLPDIVkU6JbtDuPT29LDnldZGlw7OX9bK76aFbtNM8IYTNZ7Z4wNuYQ28lrWsxMsPTQAVZTYsTpjWqrBVCcEdlSLiQKlOo03Zkd3U7oFB+Hzw2xickwLOKD+UDN/N0tathwaAYgC8F6q0uJxXsRPJUEMY2ZIb0Xls6CrGbSciCC78Mh8nfAnYmJ8YbWnHgpiuUb4md8oUYQ6SGPCCDwjaH+AMfDlSreDHb5cf8KsW7OUWNB0a1N/zr2nJir03CTjW19pE0FtYLoUSFncYuak1LnFEMfnwhcSATIbHgBq4LH5siFbJOGyHycQRf5098xLZ6eY6O7eSozXw9WNYi5z5UngIWo9R6pw1qFF+0BFmpcI844HTLnAaMB4FysYnYU7dw6VcVRMdy1PyNL0SyPGV2826yHF1g9vht2MbWArrVzhYRHz84/Kq+mZ7WPHTaTn18zAEA5MHKfZ7N7d9Chxk/7AYRJeRXqoiv6ixC0OIqdk4RLV9MSTY8038RmxbuoxqwSkmmf5YMhUL4aA4uEyhn5JuINJ4LYVNMf6XhdllkcGNy3rq+ai3Ga5dyOSuJolqnOKgW9XyllTvOd16uTQLMoVztk8m7uCROHmXEi+yznjFZ1wgzXz24qeO6zKhywss6sxrf69Sv7rrK1avsopS5Wcd6Pb9/9tBYSYQtiejy4t+BXH4dVW33a98unwnaR3ZAzl6X6x7b39yQ0I/dIqqXV6YKtomnq6/L5Ma6qld+hmwoKDEk4opAo18y64zEo6CpfuU47hWks6wBZpODERSXXCfRhtrLiwME36+gLzBo1JQsoI3CUMBbf2e/eZAmPpqSTR7c70JsHW19rhtdK7/n+/6gCnj5kHeuMVJ7BGUnycFOwlO1hQkZSv0WMN01miLROJbe2KAivg7B/GpAXGeE6hVzakxew6sa3H1+BZElRogVOfpnJZIjXhgia+sRSM7uXWI0DYVUrCLr4a+63X13z4zg84bsLP/fiLmV6WwFeXbz+4Ua8k9cQ8sN0tRh/Kw3fRQhvQHMNI2ieqJOUTI6zn6wS5D7oTnGx9b/FkUjc8Li+P8k5PApTYgDtKsCkT/S/mx+gZX7SCOHhUoqgSElxnbs1Ns5+0kEIXLZvs7Z/YW3clPZnI/7Mb8kfl/WIZmkZiZnoaS71UUzVmv+vHMU2BZsasAgX/w1yESQ3fgmjB/lcAxRt5M3rG1r85C+iawogYaamyGbGxLfpcX3KpSS5OjIdK8v7ItqPy424qu2VkvO8bXCFfH64KCYFF6oaur+evPkN79lgckbMoi9T0WxJYnHifzG+H/+Y33CVlPWy6NX53z/rMBx8/77athtMIn8l/Nr0JsX9AtQjWxMHI4NL0cFlG63Q1L5FxCwKJCxbvSOi2VwD5MUvfABVKejyLIKGoXPg1+PnMFGcAdvFyLDIAQt0Oeyh7yjaSAJfgilRmh04uWQ0PVSSC7QKt1TIHPftAB+huJNKqtjctPgWqADVRe+maurfQYncExa1sjXnvjYbLyaFc+qIhyM0368TAmCTY7CjXmn/C6qGO4DN8lLm6iM65zm+0ldz2ItW+0tpLQqC4g5v3ADR1JCoEvxnCGfD6n+bVXmQDjOiQNinBbufwDGAga1A3O9+gb3UDvHsIQxLOt3dh9KhQgtA3sGXA+wD5bphBJi6jNz+8DPnUJ6SdP9L9/Rz5oGfXrJZ3UdwFNzoWgIfCOWsByVbBlSBJF86GB2wci1BvYMuA0u+VF46N17KTVXpVzkpL5TEXkG8fYP2RRn4qCABAqx7PE6/TuazE80gXcAf1Rdfh3afj3yWMI/tL3BOd7vRg+WPkkJJXkJUnQGm1RQt6crYxWJXSrY0SflApNMyycT41J24lg9ioTJ5Usg4JnaS+EpjSKJZ49ud0eVkAL5Jj6DtfiSTq2gsO6l1utqeL+eKT2hRl0gMbEsnY+v3T7dLfEzEhgQW4ND7lHnKmK2ClbZLk/bXc+l3EvngNALWzxhpeYJkCZgFJOO/yjZCKV3syAKUChNx9oACFyj+WY9ROrvXGV8n4rH8GZeC+XuICjbv/9kNWQ7o2c+Lnb17X+UQXeRQyLjNcu4K4UR3jMB+Vr0HOYX1zipJ8uZTk1JdBnD35wmodE0f9ndshLrz2x/tHkQaqZmL4SvQwgwA9oBJmHJnCjKa+AFFuZqIadxI3g26BMN16YnHgSG+hfqPscav948F8aag9PKPv5dfqAWzHqHHKEHfMGkufuS7swE625lfJHxp9O+DR80OcreORzQn+/2Sq3+yXR7HEUrERS2WB3/jx1cFuYF867p3iX+N2i/nZdkesy7iK15qzCYLzkFzYPrJ2xCINXGGYSlpic4mtT7wHrBdW/oJSA60Brlb04cuJhvUcRx05UfB66liJplsahkrZ8MmwW6R88ldgoHKfYv7GuqraCM6jT9TCbA0K+VXn2ipFzJ8azAg9lcIf3DmdkVdE5ymyVMe4rACy1LsFX0rbtfMXVSjkl2A0svUeRVdK6aL7AVCcDxRWY1VLxfWH4GDm2sc57PbwTEoqYESLuXfa26bwzEWqEbtxg998U8vzd5dp4upIE7b8ec8wFZTBc54JAf1UtyV9T0Wh7e4D6pvMt1eB2rmIu4a4AON7WYSxn1TKcDDRe9BB7jKDutod3nI6i91VI6tUNkyMEPGEYTkDDSIytQMDij0jaY9VWusZRFj4C8xQ+2NqbkcJmGdHcCMPnsM/czjplDb8YwVnfbd3e9OS7vQRdQpDPuXPVEIcKykUfHYYuoAPJg5AwBuevUySI4amrj5RFqNrta2YYJA/uLVOkQLKEdei7+caUz4z/BuwJJ2K/tRqLUh5NWKaW6UglZUx1UEYmbEHCCf3zn+H8CbHkPKEsLyoDgG6HmBZO7iX5fxLViz8NYeI6zs6Ro3gs/YKBh07rqJ5Zb4yvRLXrMGT5zsH8HZ5m1O9sx2WPnfw3xywonEt8rcMyHf0i8afytXxAMTYLYV9rvfngH1s6lhIcibrrn9YYLt8nBzDPztE2Wto+lNN/u00Xv+LOyVR1WyMkMoimPVyHnZOFsu0RkiSwMb6ccGIW1h7UAdLJvIRO3ID23FIC1Q1zB6jxUUIlUEs77xt2VyCiKBZ3n1fy8z0R/JlEYiZfew1YS3eLriC6gCmh8aBfhq7W6lY+dnv4xEO9o5+bpSz19e0miPuk8uXRlT/rQudhgGmQqpYox5OLnTEAucNhQ/PuUiW9I4c84VDRDAu2hAbpK6ikR5Eybt9cHMHWeAWBuYhs2xo//m68KJOxhp9448J3cKwge8G4nfeK3/+664yZwPPjK957Oua+QON73xDYBnEGvNxNiVMuG6j2NbdhW7ReNhT6hkssZu01fCCkETS/VwsNWehIWTN8rDf0y4P1YNZYWX+t9rCibW1vNT2NfUot6448fY2vf7k/KMtobn/NIIKO3YNhoXmAc1TzvkZRFqNLwLmmIANsnHTa0Gyl+2FPpWqqsk6uRjYvaBRACi9HbFgQWORoIXEe069BRcBpWtxn0f5w1yVk3qAUnJ6TKgbQZJ3+IinsMOHH9I2Xm+Vwi5h7SU5HPN5dYzDxldAAvtm/NKjVt8yVPMZeFvkYENeDtqlIeYzueKPLd3Epye6jVrAmE7ATQNjm/bhQ8rSWtMGeD9s+hgkPe8J/Cl0OOZWV0uyhd5IqmZiq3uZRD0WrD1810dL30RwSs2tk5alDtcbUW2B6lMfob953vq+ZMkknKds2M5dO84KBSQHE4+nN07UNw7xU82gnVvEINTxkgCL11xjpkjUpctJgSFlIfh7HYs5/coAz+qC1BDEdhXix2Bz9u1axfppi6mWN2+VrrCCaXBLLfvL0Mo9Onj+XltRvvv4ViIfB09UkgHKw1Ns4IinrrHC38WXwUhR4IB4yHPLp67nnaCJ0FFzvzbmM0N37f/wLNDL6ikmo7Xb9kbN//8i7XZJL5A1n5YnI/n0fCw9k45bWNuVI2FXy8Ov7ogS6d2wLJNPf/kP430EYxynyjzFtvNJoPd7xqaabo/JrYj2NVSwMgUK27Ej18HLfsed+bRkSkTUwqxa9lowjDHBw8T6WyuL9iV6zKEDlahfyN9iLH9Dgd3SVnEFbFHJsXu6HKPtWCBv/IoiR5Ey0eD2vqvcGd07LH5knakkGQm9vqzaqKb+NamqO9K1L2XK8/YnRFXhOfhqQ9YugL9bVPMJi3qnWNFot8mFpGGWS7H2dVLASKji8DjEgCOoN+JDpsyUA9R/6uLvxtVLxtkFoZXnKhf3OEjIiUR/MWsKfdgbduVgRPzU3WNNR3rdSONqegtmviydBheTKOYcvfJ/9izm6sPSFZu+GruvAUl2BdCeRCtDyg5/O82GwdEdeAKnfhwwbhrMo0/ktybuxvBKoNdt4vMI9Lp08v7uBSUsqNUhmuU1kSexXh+zyAr319whNybCsET1GUVV24zkf0ZNurQIs2YHkK4TQPL9PvjwtKzY7YPujBclXKREX9UvLXHw8+0IYRZt8Oe01yQ6dLBIRnXGr0BhoRcqMbEUteWY/tae0H6r0J6JUlFa8ZmH4BHjtREsxQ1lfdz393bnKLxWvVxv+UnWvwCIO4+FwFhm/4l7w4+tw/XCFeG+oUZnsQAzjVsgBL6gpgl/KA7y0ZdjJgJ87EwwDmGaTXANNWPbgh5tOmTDQlcSimKErpgxjXFMub5xZHK89yHPH4mTVDUisl4IQ43uaQm8CmEGQRJHktwVbsxlCjNGnNHWCe33fjFodIq+TQl4d0L6pj6niJ8X3eI3y5Hk8w59h2Dd/E3iHx62PONGLXTZTgR/5MZgWnPmc2EKInbHmSD2nPRPu+6ALhn4tpvSToiVWAQJv5P39qXr4e4SJJCV6zQy+fuBlBDGCTRusOK0vL0dPxYBliFyyEe60Rj7XnIQirQXY5miwX//gS0ZU8Xff8RJ5U9+8lUl6pDOuweGh5LBgTYm7rnAtyEFG7s1PNEJmyqUjXD1CfcHJfbLJQedTDwt69EWpAvyjm149hGp3lmE+smL/v5tsKVkDRYdHmP7VldWCCBWGYolXMYIkLoJtVT/pOtoNqhdJT+7bGMneXt5qrvutI0Hi2F2+Ck5UMZG6If/6khDn18w3dPfuSKrBz1qQnui3yAGa7eL8nLabZarxL/io4YtD37aCrzSZkUfVJa73QMJhCPoEp2oWkWpaC6fcdrNdbHWtprZ3iqL3vZbg3K5pDQ+ErbzvfxsoVWAoRsqiGpx+PABdL5LYIVOKutVZvbK8P643rRHKkH0m1bw4Hs7NMLzlcdURRnHQrqK5siKF7McU9l3PDifG0paCM2DCG2m3eFctVCzhFfYwEu9Xw6rR0gWFdhxUUlhZ/RXQp9/shgvFQeUssfnaVOik2113xd3PNneQERBvduBYWJCy9znjZumIUyGtd2nKHzQwlcUXEcvOBGImP+WVXYy6ccf0DMYxJ1eGTlSobWy06RD1HL1+3cy4Ag+301flhB4bEfoVg1wnWZPSGAaPF0rqV+I41T2Gdyuzsz3Dhix1W19iYdE0W2Txy3pulbdTfcNqbtiZMA49u3dJSstjA5QHrEzofl1KmPcWtguPuhz2QUHFDBSY9OFuv6DN/BBZa68t2/TZSVny+CRtZJQGacZVcBu9Fv92DPkrq+xXxp18So24F1VmwiIcH+EIJFSOQLborLvSfayqaN/ajbBXofw8lfx25qnWRBpKAMkax1aFw1cw1uPDHiTw9/OvAc+IypVYmL4dQp1QtYQxHH6AXYqIF8PoGRceB4Qu9ELDMZHGChiXxY+hPyDYUoqIOjvSm5K+T2J9j77VIiHQ766lrGmmnTcAUgD8ipc+wsB2szzrUXih+IQhkrq75F1QS98lwC0QmelvX7HoeNhQcDv1o4cdIF1YADKkVKfIoVidTpP7p9lDwwWXlQ6G/bj0HlGpAlxL3qZN4RnmTkpTIXrK0Bh/T6mwtbfL+9ECAT9MUXppYJ9zAeukEPoIW3MXkcdOdvnsaZ+oXJNfiOsi4Cy7P6y3+4j+gEA8FzhdIIn+zX5z2SWTpQ1yCk6gHtyrVL8pdnXaUgnFJBqKsLPvpu6KvMAGkP1TVuxcHnBHbwhYcIxL2v1YcK+Jq0iGS3LhIldyHbY49iEebbxOCD9EI2qJxwZKiM3X+53mdiy5F9gJ/0J2+pJCPxDYmHnWq3tfO/o2XWS4lUshfUF4K31SK2tv3aGnVec6oDKL+7/RdlO93Bsl2Qwp0yhPpFsdOP+ZjMnB4oGIzrlwBi/MA7Uf8ICz8d18HLBtpqTy4dAcNccgbpz8WIdAq/3VQhhdlzLuXGIA",
  lanternsHang: "data:image/webp;base64,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",
  lanternGold: "data:image/webp;base64,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",
  arabesque: "data:image/webp;base64,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",
};

/* ─────────────────────────── SVG bits ─────────────────────────────────── */

const SVG_GEAR = `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/>
  <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34 1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87 1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/></svg>`;
const SVG_MOON = `<svg viewBox="0 0 24 24"><path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A7 7 0 0 0 20 14.5 Z"/></svg>`;
const SVG_MEAL = `<svg viewBox="0 0 24 24"><path d="M7 3 v6 M4.5 3 v4.5 M9.5 3 v4.5 M7 9 v12"/>
  <path d="M16 3 c-2 3 -2 6 0 8 v10 M16 11 c2-2 2-5 0-8"/></svg>`;
const SVG_CHECK = `<svg class="ck" viewBox="0 0 24 24"><path d="M4 12.5 L9.5 18 L20 6.5"
  fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"
  stroke-linejoin="round"/></svg>`;
const SVG_SPARK = `<svg viewBox="0 0 24 24" style="width:1.1em;height:1.1em;flex:none">
  <path d="M12 0 L14.2 9.8 L24 12 L14.2 14.2 L12 24 L9.8 14.2 L0 12 L9.8 9.8 Z"
  fill="currentColor"/></svg>`;

function moonstrip(day) {
  // 30 mini moons, waxing across the month; completed nights gold.
  let out = "";
  for (let i = 0; i < 30; i++) {
    const done = i < day, ph = i / 29, dx = -11 + 22 * ph;
    out += `<svg viewBox="0 0 20 20">
      <defs><clipPath id="r-mc${i}"><circle cx="10" cy="10" r="7"/></clipPath></defs>
      <circle cx="10" cy="10" r="7" fill="${done ? "rgba(246,194,74,.9)" : "none"}"
              stroke="${done ? "none" : "rgba(167,179,167,.35)"}" stroke-width="1.3"/>
      ${done && ph <= 0.97
        ? `<circle cx="${(dx - 4).toFixed(1)}" cy="10" r="7.2" fill="#0B1D14"
               clip-path="url(#r-mc${i})"/>` : ""}
    </svg>`;
  }
  return out;
}

function starfield(n) {
  // Deterministic pseudo-random star positions (stable across renders).
  let out = "", seed = 42;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < n; i++) {
    const x = (rnd() * 100).toFixed(1), y = (rnd() * 55).toFixed(1),
          s = (0.5 + rnd() * 1.6).toFixed(1),
          d = (rnd() * 5).toFixed(1), du = (3 + rnd() * 4).toFixed(1);
    out += `<i style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;
      animation-delay:${d}s;animation-duration:${du}s"></i>`;
  }
  return out;
}

/* ─────────────────────────── HTML ─────────────────────────────────────── */

function ensureState(p) {
  if (!p._rmState) p._rmState = { ...computeState(p), drawerOpen: false };
  return p._rmState;
}

function heroContent(p, st) {
  const d = prayerDates(p);
  if (st.mode === "prep") {
    return `<div class="r-hv r-hv-center">
      <div class="r-kicker" style="color:var(--r-gold-soft)">${tr(p, "rme_prepare_iftar")}</div>
      <div class="r-timer gold" data-r-live="timer" style="margin-top:.25em">--:--:--</div>
      <div class="r-sub" style="margin-top:.4em">${tr(p, "rme_until_maghrib")}</div>
    </div>`;
  }
  if (st.mode === "moment") {
    return `<div class="r-hv r-hv-center">
      <div class="r-arabic">بِسْمِ اللَّهِ</div>
      <div class="r-orn">${SVG_SPARK}</div>
      <div class="l2">${tr(p, "rme_bismillah")}</div>
      <div class="r-sub" style="font-size:clamp(.9rem,.8rem + .4vw,1.15rem);margin-top:.3em">
        ${tr(p, "rme_time_to_break")}</div>
    </div>`;
  }
  if (st.mode === "after") {
    return `<div class="r-hv r-hv-center">
      <div class="r-arabic">تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ</div>
      <div class="r-orn">${SVG_SPARK}</div>
      <div class="r-sub" style="font-size:clamp(.85rem,.75rem + .4vw,1.1rem)">
        ${tr(p, "rme_taqabbal")}</div>
    </div>`;
  }

  // normal countdown variant
  const next = p._nextPrayer();
  const nextName = next ? p.t("prayer_" + next) : "—";
  const last = p._lastPrayerInfo?.();
  const untilLabel = st.targetKey === "until_iftar"
    ? p.t("until_iftar") : tr(p, st.targetKey);

  let meal = "";
  if (st.focus === "fast" && next === "maghrib") {
    meal = `<div class="r-mealline"><span class="ic">${SVG_MEAL}</span>
      <span><span class="r-kicker" style="letter-spacing:.14em">${tr(p, "rme_iftar_time")}</span>
      <b>${tr(p, "rme_break_fast")}</b></span></div>`;
  } else if (st.focus === "suhoor") {
    meal = `<div class="r-mealline"><span class="ic">${SVG_MEAL}</span>
      <span><span class="r-kicker" style="letter-spacing:.14em">${tr(p, "rme_suhoor")}</span>
      <b>${tr(p, "rme_prepare_meal")}</b></span></div>`;
  }

  let chips = "";
  if (st.focus === "evening") {
    const ishaT = hhmm(d.isha);
    chips = `<span class="r-chip">${p.t("prayer_isha")} · ${ishaT}</span>
      <span class="r-chip dim">${tr(p, "rme_taraweeh")}</span>
      <span class="r-chip dim">${tr(p, "rme_dhikr")}</span>`;
  } else if (st.focus === "suhoor") {
    chips = `<span class="r-chip">${tr(p, "rme_sleep_reminder")}</span>`;
  } else if (st.phase === "fajr") {
    chips = `<span class="r-chip">${tr(p, "rme_fast_begun")} · ${tr(p, "rme_imsak")} ${hhmm(d.imsak)}</span>`;
  }

  return `<div class="r-hv">
    <div class="r-hv-row">
      <div class="r-hv-left">
        <div class="r-kicker">${tr(p, "rme_next")}</div>
        <div class="r-bigname">${nextName}</div>
        ${meal}
        ${last ? `<div class="r-lastblock">
            <div class="r-kicker">${tr(p, "rme_last_prayer")}</div>
            <div class="n">${p.t("prayer_" + last.prayer)}</div>
            <div class="tm">${hhmm(last.date)}</div>
          </div>` : ""}
        ${chips ? `<div class="r-chips">${chips}</div>` : ""}
      </div>
      <div class="r-hv-right">
        <div class="r-kicker">${tr(p, "rme_remaining")}</div>
        <div class="r-timer" data-r-live="timer">--:--:--</div>
        <div class="r-sub" data-r-live="until"
             style="font-size:clamp(.85rem,.75rem+.35vw,1.05rem);color:var(--nida-text)">
          ${untilLabel}</div>
      </div>
    </div>
  </div>`;
}

function scheduleCard(p, st) {
  const d = prayerDates(p);
  const now = Date.now();
  const next = p._nextPrayer();
  const rows = [["imsak", tr(p, "rme_imsak")], ["fajr"], ["dhuhr"], ["asr"],
                ["maghrib"], ["isha"]].map(([key, label]) => {
    const date = d[key];
    const isNext = key === next;
    const past = date ? date.getTime() < now && !isNext : false;
    const tag = key === "maghrib"
      ? `<span class="tag" data-live="iftar-tag">${p._iftarTagText?.() ?? ""}</span>` : "";
    return `<div class="r-prow ${isNext ? "next" : past ? "past" : ""}">
      <span class="nm">${label ?? p.t("prayer_" + key)}</span>
      ${tag}
      <span class="tm">${hhmm(date)}</span>
      ${SVG_CHECK}
    </div>`;
  }).join("");

  return `<section class="r-card r-schedule r-sec-schedule">
    <div class="r-scene"></div><div class="r-scrim"></div>
    <div class="r-content">
      <div class="r-schhead">
        <span class="r-kicker" style="color:var(--nida-text)">${tr(p, "rme_today")}</span>
        <span class="hj" data-live="hijri-date">${p._hijriDateText()}</span>
        <span class="gg" data-live="hijri-greg">${p._gregorianDateText()}</span>
      </div>
      ${rows}
    </div>
  </section>`;
}

function progressCard(p, st) {
  const day = st.day, pct = Math.round((day / 30) * 100);
  const C = 326.7, off = (C * (1 - day / 30)).toFixed(1);
  return `<section class="r-card r-progress r-sec-progress">
    <div class="r-scene"></div><div class="r-scrim"></div>
    <img class="r-prog-lantern" src="${ASSETS.lanternGold}" alt="">
    <div class="r-content">
      <div style="flex:1 1 220px;min-width:0">
        <div class="r-kicker">${tr(p, "rme_progress")}</div>
        <div class="r-progday"><b>${day}</b> <span>/ 30</span></div>
        <div class="r-sub">${tr(p, "rme_days_complete")} ·
          <span style="color:var(--r-gold-soft)">${pct}%</span></div>
      </div>
      <div class="r-ring">
        <svg viewBox="0 0 120 120">
          <defs><linearGradient id="r-ringgrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stop-color="#F6C24A"/><stop offset="1" stop-color="#36D98A"/>
          </linearGradient></defs>
          <circle class="bg" cx="60" cy="60" r="52"/>
          <circle class="fg" cx="60" cy="60" r="52"
                  stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
        </svg>
        <div class="ctr"><svg viewBox="0 0 24 24" style="color:var(--r-gold-soft)">
          <path d="M20 14.5 A8.5 8.5 0 1 1 9.5 4 A7 7 0 0 0 20 14.5 Z" fill="currentColor"/>
        </svg></div>
      </div>
      <div class="r-moonstrip">${moonstrip(day)}</div>
    </div>
  </section>`;
}

function duaCard(p, st) {
  const dua = DUAS[st.day % DUAS.length];
  return `<section class="r-card r-dua r-sec-dua">
    <div class="r-scene"></div><div class="r-scrim"></div>
    <img class="r-dua-arab" src="${ASSETS.arabesque}" alt="">
    <div class="r-content">
      <div class="r-kicker">${tr(p, "rme_dua_of_day")}</div>
      <p class="r-arabic" style="margin-top:.6em">${dua.ar}</p>
      <div class="r-orn">${SVG_SPARK}</div>
      <p class="trans">${tr(p, dua.key)}</p>
    </div>
  </section>`;
}

function quranCard(p) {
  const juz = Math.min(Math.max(parseInt(p._settings?.ramadan_quran_juz, 10) || 1, 1), 30);
  const C = 326.7, off = (C * (1 - juz / 30)).toFixed(1);
  return `<section class="r-card r-quran r-sec-quran">
    <div class="r-scene"></div><div class="r-scrim"></div>
    <div class="r-content">
      <span style="flex:1 1 220px;min-width:0">
        <span class="r-kicker">${tr(p, "rme_quran")}</span>
        <span class="val">${tr(p, "rme_juz")} <b>${juz}</b>
          <span class="u">${tr(p, "rme_of_30")}</span></span>
        <span class="r-sub">${tr(p, "rme_continue")}</span>
      </span>
      <span style="display:flex;gap:.5em;align-items:center">
        <button class="r-jbtn" data-action="ramadan-juz-minus" aria-label="−">−</button>
        <button class="r-jbtn" data-action="ramadan-juz-plus" aria-label="+">+</button>
      </span>
      <span class="r-ring" style="width:clamp(78px,8vw,110px)">
        <svg viewBox="0 0 120 120">
          <circle class="bg" cx="60" cy="60" r="52"/>
          <circle class="fg" cx="60" cy="60" r="52"
                  stroke-dasharray="${C}" stroke-dashoffset="${off}"/>
        </svg>
      </span>
    </div>
  </section>`;
}

function qadrCard(p, st) {
  return `<section class="r-card r-qadrcard r-sec-qadr">
    <div class="r-scene"></div><div class="r-scrim"></div>
    <img class="r-qadr-lanterns" src="${ASSETS.lanternsHang}" alt="">
    <div class="r-content">
      <img class="r-qadr-art" src="${ASSETS.qadrScript}" alt="Laylat al-Qadr">
      <div class="r-kicker" style="color:var(--r-gold-soft)">${tr(p, "rme_qadr_seek")}</div>
      <div class="nn" style="margin-top:.3em">${tr(p, "rme_night_word")}
        <b>${st.day}</b> / 30</div>
      <div class="r-sub" style="margin-top:.35em">
        ${tr(p, "rme_nights_remaining").replace("{n}", 30 - st.day)} ·
        <span style="color:var(--r-gold-soft)">
          ${tr(p, st.day % 2 ? "rme_odd_night" : "rme_even_night")}</span></div>
      <div class="r-qadrchips">
        <span class="r-chip">${tr(p, "rme_quran_word")}</span>
        <span class="r-chip">${tr(p, "rme_dua_word")}</span>
        <span class="r-chip">${tr(p, "rme_tahajjud")}</span>
        <span class="r-chip">${tr(p, "rme_dhikr")}</span>
      </div>
    </div>
  </section>`;
}

function debugBar(p, st) {
  // 1:1 met de goedgekeurde mockup-previewbalk. Clicking the active phase
  // again returns to live ("auto") behaviour.
  //
  // 2.3.8 — this bar used to be reachable only via ?debug in the URL, so
  // in practice only by whoever knew the flag existed. Johann asked for a
  // button that opens the Ramadan Edition as a preview "zodat je alles
  // kan doorlopen" — which is exactly this bar, it just needed a door.
  // The Ramadan settings section now has that button; when the preview is
  // what's driving the layout (rather than it genuinely being Ramadan),
  // the bar also carries the way back out.
  const btn = (k) => `<button data-action="ramadan-debug" data-key="${k}"
      class="${st.debugKey === k ? "on" : ""}">${DEBUG_LABELS[k]}</button>`;
  return `<nav class="r-debug">
    <span class="lbl">${p._ramadanPreview ? p.t("ramadan_preview_bar_label") : "Preview — Day phases &amp; modes"}</span>
    ${DEBUG_ORDER.map(btn).join("")}
    <button data-action="ramadan-debug-seq" class="cy">${p._rmDebugSeq ? "◼ Stop" : "▶ Iftar sequence"}</button>
    ${p._ramadanPreview ? `
      <button data-action="ramadan-preview-close" class="cl">✕ ${p.t("ramadan_preview_close")}</button>
    ` : ""}
  </nav>`;
}

function drawer(p, st) {
  // Native <dialog> so the top layer escapes any transformed ancestor —
  // the same lesson the panel's overlay portal learned in 2.0.11.
  return `<dialog class="r-drawer" data-r-drawer>
    <div class="r-drawer-head">${SVG_GEAR} ${tr(p, "rme_settings")}
      <button class="r-dclose" data-action="ramadan-close-drawer" aria-label="close">×</button>
    </div>
    ${p._htmlSectionLocation()}
    ${p._htmlSectionPrayers()}
    ${p._htmlSectionSpeakers()}
    ${p._htmlSectionSounds()}
    ${p._htmlSectionSoundModes()}
    ${p._htmlSectionDua()}
    ${p._htmlSectionNotifications()}
    ${p._htmlSectionJumuah()}
    ${p._htmlSectionRamadan()}
    ${p._htmlSectionIslamicCalendar()}
    ${p._htmlSectionSetup()}
  </dialog>`;
}

export function html(p) {
  const st = { ...ensureState(p), ...computeState(p) };
  Object.assign(p._rmState, st);

  // TV detection: Fully Kiosk Browser exposes window.fully and a "Fully"
  // UA token; ?rtv=1|0 forces it for testing on any device.
  const rtv = urlOverride("rtv");
  const isTV = rtv === "1" || (rtv !== "0" &&
    (typeof window.fully !== "undefined" ||
     /Fully|CrKey|SmartTV|BRAVIA|Tizen|Web0S|WebOS/i.test(navigator.userAgent || "")));

  const cls = `r-app r-phase-${st.phase} r-mode-${st.mode} r-focus-${st.focus}` +
    (st.qadr ? " r-qadr" : "") + (st.drawerOpen ? " r-drawer-open" : "") +
    (isTV ? " r-tv" : "") + (p._ramadanPreview ? " r-preview" : "");

  return `
    <style>${css(p)}</style>
    <div class="${cls}">
      <div class="r-bgstack">
        <div class="r-sky n"></div><div class="r-sky f"></div>
        <div class="r-sky d"></div><div class="r-sky m"></div>
        <div class="r-stars">${starfield(70)}</div>
        <div class="r-sunpage"></div>
        <div class="r-goldwash"></div>
      </div>
      <div class="r-wrap">
        <header class="r-header">
          <div class="r-appicon"><img src="${ASSETS.mosqueIcon}" alt="Nida"></div>
          <div class="r-brand">
            <span class="t">Nida<sup>2</sup></span>
            <span class="r-pill">${st.qadr ? tr(p, "rme_last_ten") : p.t("theme_ramadan")}</span>
          </div>
          <div class="r-hright">
            <button class="r-hbtn" data-action="ramadan-open-drawer"
                    title="${tr(p, "rme_settings")}">${SVG_GEAR}</button>
            <span class="r-hbtn" style="cursor:default"
                  title="${p.t("theme_ramadan")}">${SVG_MOON}</span>
            <button class="r-hbtn" data-action="open-language"
                    title="${p._languageLabel?.() ?? ""}">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/>
                <path d="M3 12 h18 M12 3 a14 14 0 0 1 0 18 M12 3 a14 14 0 0 0 0 18"/></svg>
            </button>
          </div>
        </header>

        <section class="r-card r-hero r-sec-hero">
          <div class="r-scene"></div>
          <div class="r-img-day"></div>
          <div class="r-sunglow"></div>
          <div class="r-ov dawn"></div><div class="r-ov warm"></div><div class="r-ov bright"></div>
          <div class="r-scrim"></div>
          <div class="r-content">${heroContent(p, st)}</div>
        </section>

        ${scheduleCard(p, st)}
        ${qadrCard(p, st)}
        ${progressCard(p, st)}
        ${duaCard(p, st)}
        ${quranCard(p)}

        <footer class="r-footer">Nida ${MODULE_VERSION}${MODULE_VERSION ? " · " : ""}${p.t("theme_ramadan")} Edition</footer>
        ${(urlHas("debug") || p._ramadanPreview) ? debugBar(p, st) : ""}
      </div>
      ${drawer(p, st)}
    </div>
  `;
}

/* ─────────────────────────── live tick ────────────────────────────────── */

export function live(p) {
  const root = p.shadowRoot;
  if (!root) return;
  const st = ensureState(p);

  // One-time: lift the daylight painting out of the panel's own CSS text
  // (--img-heroramadanlight lives inside the theme-ramadan-light block and
  // wouldn't resolve under ramadan-dark) and pin it on .r-app as
  // --img-light. No asset duplication — string reuse at runtime.
  const app = root.querySelector(".r-app");
  if (app && !app.style.getPropertyValue("--img-light")) {
    if (p._rmLightHero === undefined) {
      const m = /--img-heroramadanlight:\s*url\("(data:[^"]+)"\)/.exec(p._css());
      p._rmLightHero = m ? m[1] : "";
    }
    if (p._rmLightHero) {
      app.style.setProperty("--img-light", `url("${p._rmLightHero}")`);
    }
  }
  const fresh = computeState(p);

  // Structural flips → one full re-render (cached, same pattern as the
  // panel's _todayNextCache).
  if (fresh.phase !== st.phase || fresh.mode !== st.mode ||
      fresh.focus !== st.focus || fresh.qadr !== st.qadr ||
      fresh.day !== st.day) {
    Object.assign(st, fresh);
    p._render();
    return;
  }
  Object.assign(st, fresh);

  const setText = (sel, txt) => {
    const el = root.querySelector(sel);
    if (el) el.textContent = txt;
  };
  setText('[data-r-live="timer"]',
    fmtCountdown(st.target ? st.target - Date.now() : null));
  setText('[data-live="iftar-tag"]', p._iftarTagText?.() ?? "");
  setText('[data-live="hijri-date"]', p._hijriDateText());
  setText('[data-live="hijri-greg"]', p._gregorianDateText());

  // Drawer <dialog> open/close sync (showModal puts it in the top layer).
  const dlg = root.querySelector("[data-r-drawer]");
  if (dlg) {
    if (st.drawerOpen && !dlg.open) {
      dlg.showModal();
      dlg.addEventListener("close", () => { st.drawerOpen = false; }, { once: true });
    } else if (!st.drawerOpen && dlg.open) dlg.close();
  }
}

/* ─────────────────────────── actions ──────────────────────────────────── */

export function onAction(p, action, target) {
  const st = ensureState(p);
  if (action === "ramadan-open-drawer") {
    st.drawerOpen = true;
    live(p);
  } else if (action === "ramadan-close-drawer") {
    st.drawerOpen = false;
    live(p);
  } else if (action === "ramadan-juz-plus" || action === "ramadan-juz-minus") {
    const cur = Math.min(Math.max(parseInt(p._settings?.ramadan_quran_juz, 10) || 1, 1), 30);
    const next = Math.min(Math.max(cur + (action.endsWith("plus") ? 1 : -1), 1), 30);
    if (next !== cur) p._saveSettings({ ramadan_quran_juz: next });
  } else if (action === "ramadan-preview-close") {
    // Leave the preview: drop any phase override and the auto-sequence
    // too, so re-opening later starts from live rather than resuming
    // whatever phase was pinned when it was closed.
    (p._rmDebugSeq || []).forEach(clearTimeout);
    p._rmDebugSeq = null;
    st.debugOverride = null;
    st.debugKey = null;
    p._ramadanPreview = false;
    p._render();
  } else if (action === "ramadan-debug") {
    const key = target?.dataset?.key;
    if (!key || !DEBUG_PRESETS[key] || st.debugKey === key) {
      st.debugOverride = null; st.debugKey = null;   // toggle off → live
    } else {
      st.debugOverride = DEBUG_PRESETS[key]; st.debugKey = key;
    }
    p._render();
  } else if (action === "ramadan-debug-seq") {
    // ▶ Iftar sequence — plays prep → moment → after → back to live,
    // with the same pacing as the approved mockup.
    const stop = () => {
      (p._rmDebugSeq || []).forEach(clearTimeout);
      p._rmDebugSeq = null;
    };
    if (p._rmDebugSeq) {
      stop();
      st.debugOverride = null; st.debugKey = null;
    } else {
      const set = (k) => {
        st.debugOverride = k ? DEBUG_PRESETS[k] : null;
        st.debugKey = k || null;
        p._render();
      };
      set("prep");
      p._rmDebugSeq = [
        setTimeout(() => set("moment"), 7000),
        setTimeout(() => set("after"), 14000),
        setTimeout(() => { set(null); stop(); }, 22000),
      ];
    }
    p._render();
  }
}



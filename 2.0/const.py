"""Nida constanten — domain, sound-categorieën, gebedsnamen, sensor entity_ids.

Changelog:
  2.0.1 (2026-06-28): DEFAULT_SOUNDS toegevoegd — de drie standaard mp3-paden
                      die meegeleverd worden in sounds/. Worden door
                      services.py gebruikt als fallback wanneer
                      options.sound_<categorie> niet gezet is. Plus
                      OPT_ADHAN_MEDIA_PLAYERS option-key voor de scheduler.
  2.0.0 (2026-06-27): Sensor-set herzien — PRAYERS afgeschaald van 9 naar de
                      5 gebeden met adhan (imsak/sunrise/sunset/midnight eruit,
                      komen pas terug bij Ramadan-herbouw). Entity_id-naamgeving
                      gewijzigd van volgnummer-prefix (sensor.02_fajr) naar
                      domain-prefix (sensor.nida_fajr) — geen migratie, schone
                      herbouw. Sound-categorieën (fajr_adhan/adhan/pre_adhan_jingle)
                      vervangen de oude per-gebed _SOUND_FIELDS.
"""
from __future__ import annotations

DOMAIN = "nida"

# ─────────────────────────────────────────────────────────────────────────────
# Config flow / options keys (basisinstellingen, niet sound-gerelateerd)
# ─────────────────────────────────────────────────────────────────────────────
CONF_CITY = "city"
CONF_COUNTRY = "country"
CONF_METHOD = "method"

# ─────────────────────────────────────────────────────────────────────────────
# Gebeden — alleen de 5 met een adhan-afspeelmoment. imsak/sunrise/sunset/
# midnight zijn bewust geschrapt in 2.0.0 fase 1 (zie changelog hierboven);
# komen terug zodra Ramadan/vasten-features herbouwd worden.
# ─────────────────────────────────────────────────────────────────────────────
PRAYERS = ("fajr", "dhuhr", "asr", "maghrib", "isha")

# Zelfde lijst, behouden als apart symbool omdat scheduler.py (nog te
# herbouwen) hiermee onderscheid moet kunnen maken zodra niet-adhan-momenten
# weer terugkomen. Voor nu identiek aan PRAYERS.
ADHAN_PRAYERS = PRAYERS

# ─────────────────────────────────────────────────────────────────────────────
# Sound-categorieën — bepalen WELK geluid, los van de per-gebed aan/uit-toggle
# ─────────────────────────────────────────────────────────────────────────────
SOUND_CATEGORY_FAJR_ADHAN = "fajr_adhan"
SOUND_CATEGORY_ADHAN = "adhan"  # geldt voor dhuhr/asr/maghrib/isha samen
SOUND_CATEGORY_PRE_ADHAN_JINGLE = "pre_adhan_jingle"

SOUND_CATEGORIES = (
    SOUND_CATEGORY_FAJR_ADHAN,
    SOUND_CATEGORY_ADHAN,
    SOUND_CATEGORY_PRE_ADHAN_JINGLE,
)

# Mapping van gebed → welke sound-categorie voor dat gebed geldt.
# Gebruikt door scheduler/services om het juiste bestand te kiezen.
PRAYER_SOUND_CATEGORY = {
    "fajr": SOUND_CATEGORY_FAJR_ADHAN,
    "dhuhr": SOUND_CATEGORY_ADHAN,
    "asr": SOUND_CATEGORY_ADHAN,
    "maghrib": SOUND_CATEGORY_ADHAN,
    "isha": SOUND_CATEGORY_ADHAN,
}

# Options-key voor de per-gebed aan/uit-toggle, bijv. options["enabled_fajr"].
# Onafhankelijk van de sound-categorie-keuze.
OPT_ENABLED_PREFIX = "enabled_"

# Options-key per sound-categorie, bijv. options["sound_fajr_adhan"].
OPT_SOUND_PREFIX = "sound_"

# Options-key voor de multi-select lijst van media_player entity_ids waar
# de scheduler de adhan op zal afspelen. Opgeslagen als list[str]. Leeg of
# afwezig = scheduler kan niets afspelen, services.py logt een warning.
OPT_ADHAN_MEDIA_PLAYERS = "adhan_media_players"

# ─────────────────────────────────────────────────────────────────────────────
# Standaard mp3-bestanden die meegeleverd worden in sounds/<categorie>/.
# Paden zijn relatief aan custom_components/nida/sounds/ en — na
# helpers.async_copy_sounds() — ook aan <config>/www/nida/sounds/. Worden
# in services.py gebruikt als options.sound_<categorie> niet is ingevuld.
# ─────────────────────────────────────────────────────────────────────────────
DEFAULT_SOUNDS = {
    SOUND_CATEGORY_FAJR_ADHAN: "adhan/adhan_fajr_ahmed_saeed_al-omrany.mp3",
    SOUND_CATEGORY_ADHAN: "adhan/adhan_day_ahmed_saeed_al-omrany.mp3",
    SOUND_CATEGORY_PRE_ADHAN_JINGLE: "pre_adhan_jingle/announcement.mp3",
}

# ─────────────────────────────────────────────────────────────────────────────
# Sensor entity_id-naamgeving — domain-prefix, geen volgnummer (2.0.0).
# Oude conventie was sensor.02_fajr (volgnummer-prefix, voor UI-sortering);
# vervangen omdat de set kleiner is en domain-prefix duidelijker groepeert
# bij het zoeken naar "nida" in de entity-lijst. Geen migratiepad — bestaande
# 1.x entity_ids breken bewust bij deze herbouw.
# ─────────────────────────────────────────────────────────────────────────────
SENSOR_ENTITY_PREFIX = "nida_"

# Hijri-velden die rechtstreeks uit coordinator.data["data"]["date"]["hijri"]
# komen (Aladhan-response bevat dit al, geen extra API-call nodig).
HIJRI_FIELDS = ("date", "day", "month", "year", "holiday")

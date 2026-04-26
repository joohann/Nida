"""Default notification messages — per type, met vertalingen.

Gebruikers kunnen deze overschrijven via entry.options met sleutels:
  - notify_msg_prayer
  - notify_msg_pre_adhan
  - notify_msg_tarhim
  - notify_msg_suhoor

Placeholders in de templates ({prayer}, {minutes}) worden gevuld via
get_default_message(notify_type, lang=..., **kwargs).
"""
from __future__ import annotations

# Standaard titel voor alle Nida-notificaties
DEFAULT_TITLE = "🕌 Nida"

# Geldige notification types — gedeeld met config_flow / NidaConfig
NOTIFICATION_TYPES = ("prayer", "pre_adhan", "tarhim", "suhoor")

# Engels = fallback / default
DEFAULT_MESSAGES: dict[str, str] = {
    "prayer": "It is time for {prayer} prayer 🕌",
    "pre_adhan": "{prayer} in {minutes} minutes",
    "tarhim": "Tarhim — Fajr starts soon 🌙",
    "suhoor": "Last chance for Suhoor 🍽️",
}

# Vertalingen — taalkeyed
TRANSLATED_MESSAGES: dict[str, dict[str, str]] = {
    "nl": {
        "prayer": "Het is tijd voor {prayer} 🕌",
        "pre_adhan": "{prayer} over {minutes} minuten",
        "tarhim": "Tarhim — Fajr begint binnenkort 🌙",
        "suhoor": "Laatste kans voor Suhoor 🍽️",
    },
    "id": {
        "prayer": "Waktunya sholat {prayer} 🕌",
        "pre_adhan": "{prayer} dalam {minutes} menit",
        "tarhim": "Tarhim — Fajr akan segera tiba 🌙",
        "suhoor": "Kesempatan terakhir untuk Sahur 🍽️",
    },
    "ar": {
        "prayer": "حان وقت صلاة {prayer} 🕌",
        "pre_adhan": "صلاة {prayer} بعد {minutes} دقيقة",
        "tarhim": "ترحيم — الفجر يقترب 🌙",
        "suhoor": "آخر فرصة للسحور 🍽️",
    },
    "tr": {
        "prayer": "{prayer} namazı vakti 🕌",
        "pre_adhan": "{prayer} namazına {minutes} dakika kaldı",
        "tarhim": "Tarhim — Fajr yaklaşıyor 🌙",
        "suhoor": "Sahur için son fırsat 🍽️",
    },
    "de": {
        "prayer": "Es ist Zeit für das {prayer}-Gebet 🕌",
        "pre_adhan": "{prayer} in {minutes} Minuten",
        "tarhim": "Tarhim — Fajr beginnt bald 🌙",
        "suhoor": "Letzte Chance für Suhoor 🍽️",
    },
    "fr": {
        "prayer": "C'est l'heure de la prière {prayer} 🕌",
        "pre_adhan": "{prayer} dans {minutes} minutes",
        "tarhim": "Tarhim — Fajr commence bientôt 🌙",
        "suhoor": "Dernière chance pour le Suhoor 🍽️",
    },
}


def get_default_message(notify_type: str, lang: str = "en", **kwargs) -> str:
    """Geeft het default bericht voor een type, eventueel vertaald.

    Args:
        notify_type:  een van NOTIFICATION_TYPES
        lang:         taalcode (nl, en, id, ar, tr, de, fr)
        **kwargs:     placeholder-waarden voor de format string
                      (bv. prayer="Fajr", minutes=10)

    Returns:
        Het ingevulde bericht. Onbekend type → lege string.
        Onbekende taal → fallback naar Engels.
    """
    table = TRANSLATED_MESSAGES.get(lang, DEFAULT_MESSAGES)
    template = table.get(notify_type) or DEFAULT_MESSAGES.get(notify_type, "")
    try:
        return template.format(**kwargs)
    except (KeyError, IndexError):
        # Placeholder ontbreekt — return template ongeformatteerd
        return template

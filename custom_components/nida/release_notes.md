# Nida v1.0.9 — Ramadan UI & Tarhim fixes

## What's Changed

### 🕌 Nida Card
- **Ramadan balk** — nieuw volledig-breed grid item direct onder de voortgangsbalk, alleen zichtbaar tijdens Ramadan. Toont dag · Imsak · Iftar · Iftar over in dezelfde stijl als de gebedsitems
- **Ramadan slot** — toont nu de eerstvolgende actie (Suhoor alarm / Tarhim / pre-adhan / adhan) in plaats van de vaste Imsak/Iftar informatie
- **Header stijl** — header heeft nu dezelfde border, border-radius en achtergrond als de gebedsitems eronder voor een consistente kaartopmaak
- **Tarhim timing** — de kaart leest de exacte tarhim tijd via de nieuwe sensor `sensor.nida_tarhim_readable` voor correcte sortering in de nachtelijke actievolgorde (Suhoor alarm → Tarhim → Fajr)

### ⚙️ Integratie
- **Nieuwe sensor: `sensor.nida_tarhim_readable`** — wordt automatisch ingesteld door de integratie zodra de tarhim tijd berekend is (formaat `HH:MM`). Kan gebruikt worden in automations of als referentie in de kaart
- **Tarhim buffer** verhoogd van 5 naar 10 seconden voor Fajr, zodat de adhan niet over de tarhim heen speelt

## Upgrade notes
Geen handmatige acties vereist. De sensor `sensor.nida_tarhim_readable` wordt automatisch aangemaakt bij de eerste tarhim berekening (dus tijdens Ramadan wanneer tarhim ingeschakeld is).

---

## Files to update in repo
| Bestand | Pad |
|---|---|
| `nida-card.js` | `www/nida-card.js` |
| `__init__.py` | `custom_components/nida/__init__.py` |
| `manifest.json` | `custom_components/nida/manifest.json` |

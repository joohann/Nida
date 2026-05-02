# Nida v1.1.5 — Vasten platform & volume fix

## What's Changed

### 🌙 Nieuw: Vasten (sunnah & fard)
Nida ondersteunt nu volledige vasten-tracking als losse platform, zonder dat je een Hijri-kalender hoeft te combineren met automations.

**Drie nieuwe binary sensors:**
- `binary_sensor.nida_fasting_recommended` — `on` op dagen waarop vasten verdienstelijk is (Ramadan, maandag/donderdag, witte dagen 13-14-15 van elke Hijri-maand, Ashura/Tasua, Arafah, Dhul-Hijjah 1-8, Shawwal-6). Het attribuut `fasting_type` geeft het exacte type terug.
- `binary_sensor.nida_fasting_forbidden` — `on` op dagen waarop vasten verboden is (Eid al-Fitr, Eid al-Adha, Tashreeq 11-13 Dhul-Hijjah). Attribuut `reason` toont de grond.
- `binary_sensor.nida_currently_fasting` — `on` zodra de switch hieronder aan staat én we in het Fajr→Maghrib venster zitten. Schakelt automatisch uit bij Maghrib.

**Eén nieuwe switch:**
- `switch.nida_intend_to_fast` — gebruikersintentie "ik vast vandaag". State wordt bewaard over HA-restarts via `RestoreEntity`. Handig om een dagelijkse automation te koppelen ("Reset om 03:00", "Zet aan tijdens hele Ramadan").

De vasten-logica zit in een pure `fasting.py` module zonder HA-imports, dus volledig unit-testbaar. Edge cases die afhankelijk zijn van persoonlijke status (pelgrim op Arafah, offer op Tashreeq) worden in de attribuut-tekst gemeld in plaats van automatisch uitgesloten.

### 🔊 Volume fix in pre-adhan reminder
- **Volume-sprong tussen chime en TTS opgelost** — chime en TTS draaien nu binnen één snapshot/set/restore cyclus. De oude implementatie gebruikte twee aparte cycli waarbij de restore-task van de chime midden in de TTS vuurde, hoorbaar als een plotselinge volume-sprong tijdens de aankondiging.
- **Restore-marge verlengd** — extra `RESTORE_TAIL_SECONDS` na laatste audio voorkomt dat het oorspronkelijke volume terugkeert vóór de speaker klaar is met afspelen.

### ⚡ Performance
- **Reminder config resolution** — de pre-adhan reminder lost zijn configuratie nu alleen op binnen het reminder-venster (~30s vóór gebed) in plaats van bij elke scheduler-tick. Minder log-spam, lagere idle-load.

### ♻️ Architectuur
- **`__init__.py` afgeslankt naar 78 regels** — alle lifecycle-logica blijft daar, alle functionaliteit is verdeeld over `coordinator.py`, `scheduler.py`, `volume.py`, `helpers.py`, `media/*`, `notify/*`, `services.py`, `services_yaml.py`.
- **`media/__init__.py.bak6` en `.bak7` verwijderd** — backup-files uit eerdere refactor-rondes opgeruimd.
- **Nieuw constant `ATTR_USER_INTENDS_FAST`** in `const.py` — wordt door de switch op de coordinator gezet zodat de binary sensors niet via `hass.states` hoeven te lezen.

### 🛠️ Services
- **`services.yaml` herzien** — schemas en velden bijgewerkt voor consistente UI in de Developer Tools, inclusief duidelijkere selectors en omschrijvingen voor de nieuwe vasten-services.

### 🕌 Nida Card
- **`nida-card.js` bijgewerkt** — kleine UI-tweaks gesynchroniseerd met de live HA-instance.

## Upgrade notes

Geen handmatige acties vereist. Bij eerste laad na update:
- De drie `binary_sensor.nida_fasting_*` entities en `switch.nida_intend_to_fast` worden automatisch aangemaakt onder het bestaande Nida apparaat.
- De switch start in `off` — zet hem aan op een dag dat je daadwerkelijk vast als je `nida_currently_fasting` wilt laten triggeren.
- Bestaande sensors, automations en de Nida card blijven werken zoals voorheen.

**Wil je auto-reset van de intent-switch?** Dat is bewust niet in code gedaan. Voorbeeld-automation:

```yaml
trigger:
  - platform: time
    at: "03:00:00"
action:
  - service: switch.turn_off
    target:
      entity_id: switch.nida_intend_to_fast
```

Of laat 'm de hele Ramadan aan staan via een blueprint die op `binary_sensor.nida_fasting_recommended` met `fasting_type: ramadan` triggert.

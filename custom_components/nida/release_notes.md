# Nida v1.1.6 — Correctness sweep

Dit is een gerichte stabiliteits- en correctheidsrelease bovenop v1.1.5. Geen nieuwe gebruikersfeatures — alle wijzigingen lossen bugs op die in een diepte-analyse van de codebase naar boven kwamen, of versterken bestaande gedragingen die onder edge cases stuk gingen.

## 🐛 Bugs opgelost

### Pre-adhan reminder volume-sprong (échte fix dit keer)
v1.1.5 claimde dat de hoorbare volume-sprong tussen chime en TTS was opgelost, maar de nieuwe single-snapshot/restore code stond in een bestand dat door niets werd geïmporteerd — `media/reminder.py` (de live versie) bevatte nog steeds het oude tweede-cyclus pad. v1.1.6 mergt de fix in op de juiste locatie en verwijdert de orphaned top-level reminder.py.

### Suhoor alarm speelde geen geluid bij verse installaties
Het config_flow schreef opties weg onder de keys `suhoor_alarm_enabled` / `suhoor_alarm_minutes` / `suhoor_alarm_sound` / `suhoor_alarm_volume`, terwijl `media/suhoor.py` en `services.py` de oude keys `suhoor_enabled` / `suhoor_minutes` / `suhoor_sound` / `suhoor_volume` lazen. Effect: de UI toonde een geselecteerde sound, maar runtime kreeg een lege string en sloeg het afspelen stilletjes over. Reads accepteren nu beide key-formaten met de nieuwe vorm als primair en de oude als fallback voor bestaande installaties.

### `binary_sensor.nida_currently_fasting` bleef tot 60s achterlopen na restart
De fasting-intent switch wordt via `RestoreEntity` hersteld na herstart, maar de coordinator kreeg geen `async_update_listeners()` ping. De gekoppelde `currently_fasting` sensor bleef daardoor `off` tot zijn eigen minuten-tick een keer vuurde. Nu update de sensor onmiddellijk.

### Stale prayer times in het uur na middernacht
De coordinator polde elke 12 uur en gebruikte `date.today()` om de API-URL te bouwen. Tussen middernacht en de volgende reguliere refresh kon Fajr van vandaag dus nog op gisterens timestamp staan — typisch ~1 minuut afwijking, soms meer rond DST-switches. Er draait nu een extra refresh om 00:01 lokale tijd zodat `date.today()` de nieuwe dag direct meepakt.

### `_parse_today` was niet DST-safe
De fasting binary sensors parseten `"HH:MM"` strings naar lokaal datetime door `dt_util.now().tzinfo` te koppelen aan een naïeve datetime van vandaag. Op DST-overgangsdagen kunnen Fajr (vroeg) en Maghrib (laat) aan verschillende kanten van de switch liggen, waardoor één van de twee een uur verschoof. Nu via `dt_util.as_local()` dat de zoneinfo voor de exacte datum raadpleegt.

### Ramadan-detectie via fragiele substring-match
`_is_ramadan()` checkte `"Rama" in coordinator.data["data"]["date"]["hijri"]["month"]["en"]`. Werkt prima zolang Aladhan "Ramadan" blijft schrijven, maar breekt zodra ze ooit naar "Ramaḍān" of "Ramazan" overstappen. Nu via `month.number == 9` — het canonieke veld in de API.

## 🔒 Security & best practices

### SSL-verificatie staat weer aan
De coordinator zette `aiohttp.TCPConnector(ssl=False)`, wat zinloos was — `api.aladhan.com` heeft een geldig Let's Encrypt certificaat. Het uitschakelen creëerde een onnodig MITM-risico op het lokale netwerk waarop iemand timing- en Hijri-data zou kunnen manipuleren. Verwijderd.

### Gedeelde aiohttp session
De coordinator maakte voor elke fetch een nieuwe `aiohttp.ClientSession()` aan. Nu via `async_get_clientsession(hass)` — connection pooling, juiste lifecycle, lagere overhead. Standaardpatroon voor alle HA-integraties.

## ⚡ Performance & architectuur

### Echte SensorEntity voor `nida_suhoor_readable` en `nida_tarhim_readable`
Deze sensors werden tot v1.1.5 als "ghost entities" weggeschreven via `hass.states.async_set()` direct vanuit de scheduler en de media-modules. Gevolg: ze omzeilden het entity registry, hadden geen `unique_id`, hingen niet onder het Nida device, en waren kort `unavailable` na elke restart tot de scheduler ze opnieuw plaatste.

In v1.1.6 zijn het echte `SensorEntity` instances onder het Nida device:

- `NidaSuhoorReadableSensor` — leest `suhoor_alarm_enabled` + `suhoor_alarm_minutes`, berekent `Fajr - X minuten`, rolt automatisch door naar morgen wanneer vandaag's tijd voorbij is.
- `NidaTarhimReadableSensor` — cachet de tarhim MP3-duur bij setup, berekent `Fajr - duration - 10s buffer`, retourneert alleen een waarde tijdens Ramadan.

Beide tikken elke minuut via `async_track_time_interval` zodat de getoonde tijd accuraat blijft over rollovers heen.

### Parallelle push-notifications
De notify-loop verstuurde naar elk target sequentieel. Bij drie of meer devices kon één traag of falend doel (offline telefoon die TLS opnieuw probeerde) de hele dispatch boven een seconde duwen. Nu via `asyncio.gather` met `return_exceptions=True` zodat één falende target de rest niet blokkeert.

## ⬆️ Upgrade notes

Geen handmatige acties vereist. Bij eerste laad na update:

- `sensor.nida_suhoor_readable` en `sensor.nida_tarhim_readable` verschijnen als echte entities onder het Nida device. Eventuele bestaande Lovelace cards die naar deze entity-IDs verwijzen blijven gewoon werken — de entity-IDs zijn bewust gelijk gebleven.
- Bestaande automations, sensors, switches en de Nida card zijn ongewijzigd.
- Suhoor alarms die in v1.1.5 stilletjes faalden vanwege de key-mismatch werken nu zonder dat je iets in de options-flow hoeft te wijzigen.

## 📦 Changelog (commits)

```
58790f3 fase 6: midnight refresh, DST-safe parsing, parallel notifications
594981f fase 5+6: real sensors, suhoor key fix, robust Ramadan check
aa1592b perf(coordinator): use HA shared aiohttp session
b58e821 fix(coordinator): re-enable SSL verification
cb9b2d4 fix(switch): notify listeners after restoring intent flag
c78d89c fix(reminder): apply volume-jump fix in media/reminder.py (was dead code)
```

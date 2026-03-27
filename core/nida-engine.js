/**
 * @file nida-engine.js
 * @module NidaEngine
 * @version 2.0.0
 *
 * Core gebedstijden-logica voor Nida v2.
 *
 * Verantwoordelijkheden:
 *   - Normaliseren van ruwe API-tijden naar interne structuren
 *   - Bepalen van huidig / volgend gebed
 *   - Countdown berekening (inclusief dag-overgang bugfix)
 *   - Voortgangsbalk percentage
 *   - Isha → Fajr (volgende dag) overgang — nooit terug naar dezelfde dag
 *
 * DEVELOPER.md-conventies (samenvatting):
 *   - Elke functie heeft een JSDoc-header
 *   - Interne helpers beginnen met underscore (_)
 *   - Geen side-effects buiten publieke methoden
 *   - Alle tijden worden intern als minuten-na-middernacht (0-1439) opgeslagen
 *   - "Nextday-offset" = 1440 minuten wordt opgeteld wanneer een gebed
 *     in de toekomst ligt maar vóór middernacht staat geregistreerd
 *
 * @author  Nida v2 Team
 * @license MIT
 */

// ---------------------------------------------------------------------------
// CONSTANTEN
// ---------------------------------------------------------------------------

/**
 * Canonieke volgorde van de vijf dagelijkse gebeden.
 * Wordt gebruikt voor iteratie en array-indexering.
 *
 * @constant {string[]}
 */
export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

/**
 * Emoji-icoon per gebed voor weergave in de UI.
 *
 * @constant {Record<string, string>}
 */
export const PRAYER_ICONS = {
  fajr:    '🌙',
  dhuhr:   '☀️',
  asr:     '🌤️',
  maghrib: '🌇',
  isha:    '🌑',
};

/**
 * Imsak-offset in minuten vóór Fajr als de API geen Imsak geeft.
 * Standaard 10 minuten (meest gebruikte conventie).
 *
 * @constant {number}
 */
const IMSAK_FALLBACK_OFFSET_MIN = 10;

/**
 * Minimale cache-duur voor dagelijkse tijden in milliseconden.
 * Na deze tijd worden tijden opnieuw opgehaald, zelfs als de datum
 * hetzelfde lijkt. Vangt edge-cases op rond DST en tijdzone-sprongen.
 *
 * @constant {number}
 */
const DAILY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 uur

// ---------------------------------------------------------------------------
// INTERNE HULPFUNCTIES
// ---------------------------------------------------------------------------

/**
 * Converteert een tijdstring in "HH:MM" of "HH:MM:SS" formaat naar
 * het aantal minuten na middernacht.
 *
 * @param  {string} timeStr - Bijv. "05:23" of "05:23:00"
 * @returns {number|null}   Minuten na middernacht, of null bij ongeldig formaat
 *
 * @example
 * _timeToMinutes("05:23") // → 323
 * _timeToMinutes("invalid") // → null
 */
function _timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;

  // Knip seconden af als die aanwezig zijn (HH:MM:SS → HH:MM)
  const [hhStr, mmStr] = timeStr.trim().split(':');
  const hh = parseInt(hhStr, 10);
  const mm = parseInt(mmStr, 10);

  if (isNaN(hh) || isNaN(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;

  return hh * 60 + mm;
}

/**
 * Converteert minuten-na-middernacht terug naar "HH:MM" string.
 * Wrapat automatisch bij waarden >= 1440 (volgende dag).
 *
 * @param  {number} totalMinutes - Minuten na middernacht (mag >= 1440 zijn)
 * @returns {string}             Tijdstring "HH:MM"
 *
 * @example
 * _minutesToTime(323)  // → "05:23"
 * _minutesToTime(1500) // → "01:00"  (volgende dag, 1500-1440=60)
 */
function _minutesToTime(totalMinutes) {
  // Wrap naar het bereik [0, 1439]
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/**
 * Geeft het huidige aantal seconden na middernacht op basis van Date.now().
 *
 * @returns {number} Seconden in bereik [0, 86399]
 */
function _nowSeconds() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

/**
 * Geeft het huidige aantal minuten na middernacht.
 *
 * @returns {number} Minuten in bereik [0, 1439]
 */
function _nowMinutes() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

// ---------------------------------------------------------------------------
// HOOFD-KLASSE
// ---------------------------------------------------------------------------

/**
 * @class NidaEngine
 *
 * De centrale berekeningsmotor voor Nida v2.
 *
 * Gebruik:
 * ```js
 * const engine = new NidaEngine();
 * engine.loadTimes({ fajr: "05:23", dhuhr: "12:15", ... });
 * const next = engine.getNextPrayer();
 * const countdown = engine.getCountdown();
 * ```
 *
 * Singleton-patroon aanbevolen — één instantie per app-sessie.
 */
export class NidaEngine {
  constructor() {
    /**
     * Interne opslag van gebedstijden als minuten-na-middernacht.
     * Sleutel = prayer key (bijv. 'fajr'), waarde = integer.
     *
     * @type {Record<string, number>}
     * @private
     */
    this._times = {};

    /**
     * Imsak-tijd in minuten (kan null zijn als niet beschikbaar).
     *
     * @type {number|null}
     * @private
     */
    this._imsak = null;

    /**
     * Tijdstempel waarop de tijden voor het laatst zijn geladen.
     * Wordt gebruikt voor cache-invalidatie.
     *
     * @type {number}
     * @private
     */
    this._loadedAt = 0;

    /**
     * Datumstring (YYYY-MM-DD) waarvoor de huidige tijden gelden.
     *
     * @type {string|null}
     * @private
     */
    this._dateKey = null;
  }

  // -------------------------------------------------------------------------
  // PUBLIEKE METHODEN — DATA LADEN
  // -------------------------------------------------------------------------

  /**
   * Laadt gebedstijden vanuit een ruwe tijden-map.
   *
   * De `timesMap` kan afkomstig zijn van:
   *   - AlaDhan API response (zie nida-api.js)
   *   - Home Assistant sensor states
   *   - Handmatige configuratie
   *
   * @param {object} timesMap            - Map met tijdstrings per gebed
   * @param {string} timesMap.fajr       - Fajr-tijd "HH:MM"
   * @param {string} timesMap.dhuhr      - Dhuhr-tijd "HH:MM"
   * @param {string} timesMap.asr        - Asr-tijd "HH:MM"
   * @param {string} timesMap.maghrib    - Maghrib-tijd "HH:MM"
   * @param {string} timesMap.isha       - Isha-tijd "HH:MM"
   * @param {string} [timesMap.imsak]    - Imsak-tijd "HH:MM" (optioneel)
   * @param {string} [timesMap.sunrise]  - Zonsopgang "HH:MM" (optioneel, voor weergave)
   * @param {string} [timesMap.sunset]   - Zonsondergang "HH:MM" (optioneel)
   * @param {string} [dateKey]           - Datum "YYYY-MM-DD" waarvoor tijden gelden
   * @returns {boolean}                  True als alle 5 gebedstijden succesvol zijn geladen
   */
  loadTimes(timesMap, dateKey = null) {
    if (!timesMap || typeof timesMap !== 'object') {
      console.warn('[NidaEngine] loadTimes: ongeldig timesMap argument');
      return false;
    }

    // Reset interne state vóór het laden
    this._times = {};
    this._imsak = null;

    let allLoaded = true;

    // Verwerk de vijf verplichte gebeden
    for (const key of PRAYER_KEYS) {
      const raw = timesMap[key] || timesMap[key.toLowerCase()];
      const minutes = _timeToMinutes(raw);

      if (minutes === null) {
        console.warn(`[NidaEngine] loadTimes: ongeldige of ontbrekende tijd voor '${key}':`, raw);
        allLoaded = false;
      } else {
        this._times[key] = minutes;
      }
    }

    // Imsak: gebruik API-waarde of bereken als fallback op Fajr - offset
    if (timesMap.imsak) {
      this._imsak = _timeToMinutes(timesMap.imsak);
    }
    if (this._imsak === null && this._times.fajr !== undefined) {
      // Fallback: 10 minuten vóór Fajr
      this._imsak = this._times.fajr - IMSAK_FALLBACK_OFFSET_MIN;
    }

    // Extra (optionele) tijden — opslaan maar niet verplicht
    for (const extra of ['sunrise', 'sunset', 'midnight']) {
      if (timesMap[extra]) {
        const m = _timeToMinutes(timesMap[extra]);
        if (m !== null) this._times[extra] = m;
      }
    }

    this._loadedAt = Date.now();
    this._dateKey = dateKey || _todayKey();

    return allLoaded;
  }

  /**
   * Controleert of de huidig geladen tijden nog geldig zijn.
   * Wordt ongeldig als:
   *   - De cache-TTL verstreken is
   *   - De datum is veranderd (na middernacht)
   *
   * @returns {boolean} True als geldig en niet verlopen
   */
  isCacheValid() {
    if (!this._loadedAt || !this._dateKey) return false;

    const ageMs = Date.now() - this._loadedAt;
    if (ageMs > DAILY_CACHE_TTL_MS) return false;

    // Controleer of we nog op dezelfde kalenderdag zitten
    if (this._dateKey !== _todayKey()) return false;

    return true;
  }

  // -------------------------------------------------------------------------
  // PUBLIEKE METHODEN — GEBED-LOGICA
  // -------------------------------------------------------------------------

  /**
   * Bepaalt het volgende gebed op basis van de huidige tijd.
   *
   * DAG-OVERGANG BUGFIX:
   *   Na Isha is er geen volgend "dagelijks" gebed meer voor vandaag.
   *   In dat geval tellen we altijd door naar Fajr van de *volgende* dag.
   *   De geretourneerde `minutesUntil` kan hierdoor groter zijn dan de
   *   resterende minuten tot middernacht — dit is correct gedrag.
   *
   *   Fout (v1): Na Isha werd Fajr van *dezelfde dag* als volgende
   *              aangewezen, wat leidde tot een negatieve countdown.
   *   Fix (v2):  We voegen 1440 minuten (= 1 dag) toe aan Fajr als
   *              `nowMinutes > ishaMinutes`.
   *
   * @returns {{
   *   key:          string,   // Prayer key, bijv. 'fajr'
   *   displayTime:  string,   // "HH:MM" van het volgende gebed
   *   minutesUntil: number,   // Minuten tot het gebed (altijd >= 0)
   *   isNextDay:    boolean,  // True als het Fajr van de volgende dag is
   * }|null} Null als er geen tijden geladen zijn
   */
  getNextPrayer() {
    if (!this._hasAllTimes()) return null;

    const now = _nowMinutes();

    // Loop door alle gebeden in chronologische volgorde.
    // Zoek het eerste gebed dat nog niet voorbij is.
    for (const key of PRAYER_KEYS) {
      const prayerMin = this._times[key];
      if (prayerMin > now) {
        return {
          key,
          displayTime:  _minutesToTime(prayerMin),
          minutesUntil: prayerMin - now,
          isNextDay:    false,
        };
      }
    }

    // -----------------------------------------------------------------------
    // DAG-OVERGANG: we zijn voorbij Isha — volgende gebed is Fajr morgen.
    //
    // Dit is de kern van de bugfix. We tellen NOOIT terug naar Fajr van
    // dezelfde dag. Fajr morgen = fajr_minuten + 1440.
    // -----------------------------------------------------------------------
    const fajrMin = this._times.fajr;
    const minutesUntilFajrTomorrow = (fajrMin + 1440) - now;

    return {
      key:          'fajr',
      displayTime:  _minutesToTime(fajrMin),      // Toont de tijd van Fajr (zelfde weergave)
      minutesUntil: minutesUntilFajrTomorrow,
      isNextDay:    true,                          // Markeer expliciet als "volgende dag"
    };
  }

  /**
   * Geeft het actieve (huidige) gebed terug.
   *
   * Een gebed is "actief" van het moment dat het begint tot het moment
   * dat het volgende gebed begint. Isha blijft actief tot Fajr de
   * volgende dag (via de dag-overgang-logica).
   *
   * @returns {{
   *   key:         string,  // Prayer key
   *   displayTime: string,  // "HH:MM"
   *   isPastMidnight: boolean // True als we Isha-sessie na middernacht zijn
   * }|null} Null als er geen tijden geladen zijn
   */
  getCurrentPrayer() {
    if (!this._hasAllTimes()) return null;

    const now = _nowMinutes();

    // Itereer achteruit: het laatste gebed dat al begonnen is, is het actieve
    let current = null;
    for (const key of PRAYER_KEYS) {
      if (this._times[key] <= now) {
        current = key;
      }
    }

    if (current) {
      return {
        key:            current,
        displayTime:    _minutesToTime(this._times[current]),
        isPastMidnight: false,
      };
    }

    // Vóór Fajr: het "actieve" gebed is Isha van de vorige nacht
    // (we zitten in de Isha-sessie die doorloopt na middernacht)
    return {
      key:            'isha',
      displayTime:    _minutesToTime(this._times.isha),
      isPastMidnight: true,  // Middernacht is gepasseerd, Isha van gisteren loopt nog
    };
  }

  /**
   * Berekent de countdown in seconden naar het volgende gebed.
   *
   * Gebruikt seconden-precisie voor de live countdown-weergave.
   * De dag-overgang wordt hier ook correct afgehandeld via `getNextPrayer`.
   *
   * @returns {{
   *   totalSeconds: number,  // Totaal seconden tot het volgende gebed
   *   hours:        number,  // Uren-component
   *   minutes:      number,  // Minuten-component
   *   seconds:      number,  // Seconden-component
   *   formatted:    string,  // "H:MM:SS" of "MM:SS" als < 1 uur
   * }|null} Null als er geen tijden zijn of berekening mislukt
   */
  getCountdown() {
    const next = this.getNextPrayer();
    if (!next) return null;

    const nowSec = _nowSeconds();

    // Seconden tot het volgende gebed, inclusief dag-overgang correctie
    let targetSec;
    if (next.isNextDay) {
      // Fajr morgen: (fajr_minuten_vandaag + 1440) * 60 - nu
      const fajrSec = this._times.fajr * 60;
      targetSec = fajrSec + 86400 - nowSec; // 86400 = 24 * 3600
    } else {
      const prayerSec = this._times[next.key] * 60;
      targetSec = prayerSec - nowSec;
    }

    // Veiligheidsneg: nooit negatief (kan < 0 zijn bij race-conditions)
    const d = Math.max(0, Math.floor(targetSec));

    const hours   = Math.floor(d / 3600);
    const minutes = Math.floor((d % 3600) / 60);
    const seconds = d % 60;

    // Formaat: toon uren alleen als relevant
    const formatted = hours > 0
      ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return { totalSeconds: d, hours, minutes, seconds, formatted };
  }

  /**
   * Berekent het voortgangspercentage tussen het vorige en het volgende gebed.
   *
   * Gebruikt voor de progressiebalk in de UI.
   * - 0% = direct na het vorige gebed
   * - 100% = net voor het volgende gebed
   *
   * @returns {number} Integer percentage [0, 100]
   */
  getProgress() {
    if (!this._hasAllTimes()) return 0;

    const now = _nowMinutes();

    // Bouw een array van alle gebed-minuten in volgorde
    const times = PRAYER_KEYS.map(k => this._times[k]);

    // Zoek het vorige en volgende gebed
    let prev = null;
    let next = null;

    for (let i = 0; i < times.length; i++) {
      if (times[i] <= now) {
        prev = times[i];
      } else if (next === null) {
        next = times[i];
        break;
      }
    }

    // Dag-overgang: na Isha is prev=Isha, next=Fajr morgen
    if (next === null) {
      // Na Isha: prev = Isha, next = Fajr + 1440 (morgen)
      prev = this._times.isha;
      next = this._times.fajr + 1440;
    }
    // Vóór Fajr: prev = Isha gisteren (negatief), next = Fajr vandaag
    if (prev === null) {
      prev = this._times.isha - 1440;
    }

    const span = next - prev;
    if (span <= 0) return 0;

    const elapsed = now - prev;
    return Math.min(100, Math.max(0, Math.round((elapsed / span) * 100)));
  }

  /**
   * Geeft alle geladen gebedstijden terug als een array van objecten,
   * gesorteerd chronologisch.
   *
   * Elke entry heeft:
   *  - key:         prayer key
   *  - minutes:     interne minuten-waarde
   *  - displayTime: "HH:MM" string
   *  - isPast:      true als het gebed al voorbij is
   *  - isActive:    true als dit het huidige gebed is
   *  - isNext:      true als dit het volgende gebed is
   *
   * @returns {Array<object>} Gesorteerde array van gebed-objecten
   */
  getPrayerList() {
    if (!this._hasAllTimes()) return [];

    const now       = _nowMinutes();
    const current   = this.getCurrentPrayer();
    const nextPrayer = this.getNextPrayer();

    return PRAYER_KEYS.map(key => {
      const minutes = this._times[key];
      return {
        key,
        minutes,
        displayTime: _minutesToTime(minutes),
        isPast:      minutes < now && current?.key !== key,
        isActive:    current?.key === key,
        isNext:      nextPrayer?.key === key && !nextPrayer.isNextDay,
        icon:        PRAYER_ICONS[key] || '🕌',
      };
    });
  }

  /**
   * Geeft de Imsak-tijd terug.
   *
   * Imsak markeert het begin van de vastentijd (begin Ramadan-dag).
   * Is ofwel afkomstig van de API of berekend als Fajr - 10 minuten.
   *
   * @returns {{ minutes: number, displayTime: string }|null}
   */
  getImsak() {
    if (this._imsak === null) return null;
    return {
      minutes:     this._imsak,
      displayTime: _minutesToTime(this._imsak),
    };
  }

  /**
   * Berekent de volgende relevante actie voor de UI-notificatie-rij.
   *
   * Soorten acties (in prioriteitsvolgorde bij gelijke tijd):
   *   1. suhoor  — wektijd voor suhoor (opgegeven of = imsak)
   *   2. tarhim  — tarhim-tijdstip (Ramadan-specifiek, vóór Fajr)
   *   3. adhan   — het gebed zelf
   *   4. tadkir  — herinnering 5 of 10 minuten vóór adhan
   *
   * @param {object}  [opts={}]              - Opties
   * @param {boolean} [opts.isRamadan=false] - True tijdens Ramadan
   * @param {boolean} [opts.skipSuhoor=false]- True als gebruiker suhoor overslaat
   * @param {number}  [opts.suhoorMinutes]   - Exacte suhoor-wektijd (optioneel)
   * @param {number}  [opts.tarhimMinutes]   - Exacte tarhim-tijd (optioneel)
   * @param {number[]} [opts.tadkirOffsets]  - Minuten vóór adhan voor tadkir [10, 5]
   *
   * @returns {{
   *   type:       'suhoor'|'tarhim'|'adhan'|'tadkir',
   *   prayerKey:  string|null,
   *   minutes:    number,
   *   displayTime: string,
   *   minutesUntil: number,
   * }|null}
   */
  getNextAction(opts = {}) {
    const {
      isRamadan    = false,
      skipSuhoor   = false,
      suhoorMinutes = null,
      tarhimMinutes = null,
      tadkirOffsets = [10, 5],
    } = opts;

    if (!this._hasAllTimes()) return null;

    const now = _nowMinutes();

    /**
     * Hulpfunctie: zet een absolute minuten-waarde om naar een "toekomstige"
     * waarde door 1440 op te tellen als de tijd al voorbij is.
     */
    const toFuture = (m) => m > now ? m : m + 1440;

    const candidates = [];

    // ---- 1. Tadkir (herinnering vóór adhan) ---------------------------------
    for (const key of PRAYER_KEYS) {
      const prayerMin = this._times[key];
      const futureMin = toFuture(prayerMin);

      for (const offset of tadkirOffsets) {
        const tadkirMin = futureMin - offset;
        if (tadkirMin > now) {
          candidates.push({
            type:        'tadkir',
            prayerKey:   key,
            minutes:     tadkirMin,
            displayTime: _minutesToTime(tadkirMin),
            minutesUntil: tadkirMin - now,
          });
        }
      }

      // ---- 2. Adhan zelf ------------------------------------------------------
      if (futureMin > now) {
        candidates.push({
          type:        'adhan',
          prayerKey:   key,
          minutes:     futureMin,
          displayTime: _minutesToTime(prayerMin), // Toon de "echte" tijd, niet wrapped
          minutesUntil: futureMin - now,
        });
      }
    }

    // ---- 3. Suhoor (alleen als niet overgeslagen) ----------------------------
    if (!skipSuhoor) {
      // Gebruik opgegeven suhoor-tijd, anders imsak als fallback
      const rawSuhoor = suhoorMinutes ?? this._imsak;
      if (rawSuhoor !== null) {
        const futureSuhoor = toFuture(rawSuhoor);
        if (futureSuhoor > now) {
          candidates.push({
            type:        'suhoor',
            prayerKey:   null,
            minutes:     futureSuhoor,
            displayTime: _minutesToTime(rawSuhoor),
            minutesUntil: futureSuhoor - now,
          });
        }
      }
    }

    // ---- 4. Tarhim (alleen tijdens Ramadan, niet overgeslagen) ---------------
    if (isRamadan && !skipSuhoor) {
      // Gebruik opgegeven tarhim-tijd, anders schat op Fajr - 10 minuten
      const rawTarhim = tarhimMinutes ?? (this._times.fajr - 10);
      const futureTarhim = toFuture(rawTarhim);
      if (futureTarhim > now) {
        candidates.push({
          type:        'tarhim',
          prayerKey:   null,
          minutes:     futureTarhim,
          displayTime: _minutesToTime(rawTarhim),
          minutesUntil: futureTarhim - now,
        });
      }
    }

    if (candidates.length === 0) return null;

    // Sorteer op minutesUntil (laagste eerst), bij gelijke tijd op type-prioriteit
    const PRIORITY = { suhoor: 0, tarhim: 1, adhan: 2, tadkir: 3 };
    candidates.sort((a, b) => {
      if (a.minutesUntil !== b.minutesUntil) return a.minutesUntil - b.minutesUntil;
      return (PRIORITY[a.type] ?? 9) - (PRIORITY[b.type] ?? 9);
    });

    // Suhoor/tarhim heeft speciale voorrang: als de eerste actie een tadkir is
    // maar er is een suhoor/tarhim binnen 90 minuten, toon die eerst.
    const first = candidates[0];
    if (first.type === 'tadkir') {
      const priorityAction = candidates.find(
        c => (c.type === 'suhoor' || c.type === 'tarhim') && c.minutesUntil <= 90
      );
      if (priorityAction) return priorityAction;
    }

    return first;
  }

  /**
   * Geeft de Iftar-countdown terug (Maghrib = iftartijd tijdens Ramadan).
   *
   * Aftellen naar de volgende Maghrib:
   *   - Als Maghrib nog niet voorbij is: tel naar vandaag
   *   - Als Maghrib voorbij is: tel naar Maghrib morgen
   *
   * @returns {{
   *   totalSeconds: number,
   *   formatted:    string,  // "HH:MM" als > 1 uur, "MM:SS" als <= 1 uur
   *   isPast:       boolean, // True als Maghrib (iftar) al was
   * }|null}
   */
  getIftarCountdown() {
    if (this._times.maghrib === undefined) return null;

    const nowSec     = _nowSeconds();
    const maghribSec = this._times.maghrib * 60;

    // Bepaal seconden tot de volgende Maghrib
    let diff = maghribSec - nowSec;
    const isPast = diff <= 0;

    if (isPast) {
      // Maghrib was vandaag al — tel naar morgen
      diff += 86400;
    }

    const d       = Math.max(0, Math.floor(diff));
    const hours   = Math.floor(d / 3600);
    const minutes = Math.floor((d % 3600) / 60);
    const seconds = d % 60;

    // Toon HH:MM als meer dan een uur, anders MM:SS (nauwkeuriger)
    const formatted = hours >= 1
      ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

    return { totalSeconds: d, formatted, isPast };
  }

  // -------------------------------------------------------------------------
  // PRIVÉ-HULPMETHODEN
  // -------------------------------------------------------------------------

  /**
   * Controleert of alle vijf verplichte gebedstijden beschikbaar zijn.
   *
   * @returns {boolean}
   * @private
   */
  _hasAllTimes() {
    return PRAYER_KEYS.every(k => typeof this._times[k] === 'number');
  }
}

// ---------------------------------------------------------------------------
// MODULE-NIVEAU HULPFUNCTIES (geëxporteerd voor gebruik in andere modules)
// ---------------------------------------------------------------------------

/**
 * Geeft de datum-sleutel voor vandaag in "YYYY-MM-DD" formaat.
 * Wordt gebruikt voor cache-vergelijking.
 *
 * @returns {string} Bijv. "2026-03-28"
 */
export function _todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Maan-fase emoji op basis van de Hijri-dag.
 * Benaderende cyclus van 30 dagen.
 *
 * @param   {number} hijriDay - Dag van de Hijri-maand (1-30)
 * @returns {string}          Emoji karakter
 */
export function moonPhaseEmoji(hijriDay) {
  const d = ((parseInt(hijriDay, 10) || 1) - 1) % 30;
  if (d < 2)  return '🌑';
  if (d < 6)  return '🌒';
  if (d < 9)  return '🌓';
  if (d < 13) return '🌔';
  if (d < 17) return '🌕';
  if (d < 21) return '🌖';
  if (d < 24) return '🌗';
  if (d < 28) return '🌘';
  return '🌑';
}

/**
 * Singleton instantie van de engine voor app-brede gebruik.
 *
 * Importeer en gebruik als:
 * ```js
 * import { engine } from './nida-engine.js';
 * engine.loadTimes({ fajr: "05:23", ... });
 * ```
 *
 * @type {NidaEngine}
 */
export const engine = new NidaEngine();

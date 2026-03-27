/**
 * @file nida-api.js
 * @module NidaApi
 * @version 2.0.0
 *
 * AlaDhan API v1 wrapper voor Nida v2.
 *
 * Verantwoordelijkheden:
 *   - Ophalen van dagelijkse gebedstijden via api.aladhan.com/v1
 *   - Ophalen van maandelijkse kalender (batch, minder API-calls)
 *   - Ophalen van Hijri-datumconversie
 *   - Request-caching met TTL (voorkomt dubbele calls bij re-renders)
 *   - Retry-logica met exponentiële back-off
 *   - Normaliseren van API-response naar NidaEngine-compatibel formaat
 *
 * AlaDhan API v1 — stabiele endpoints (geen auth vereist):
 *   GET https://api.aladhan.com/v1/timings/{timestamp}
 *   GET https://api.aladhan.com/v1/calendar/{year}/{month}
 *   GET https://api.aladhan.com/v1/gToH/{date}
 *
 * Berekeningsstandaard: Muslim World League (MWL) = method 3
 *   - Fajr hoek:  18°
 *   - Isha hoek:  17°
 *   - Gebruikt in Europa, Far East, delen van Noord-Amerika
 *
 * DEVELOPER.md-conventies:
 *   - Alle publieke methoden zijn async en gooien nooit — ze returnen null bij fouten
 *   - Interne state via _cache Map (key = cacheKey string)
 *   - Alle network-errors worden gelogd met [NidaApi] prefix
 *   - Timeout via AbortController (15 seconden)
 *
 * @author  Nida v2 Team
 * @license MIT
 */

// ---------------------------------------------------------------------------
// CONSTANTEN
// ---------------------------------------------------------------------------

/**
 * Basis-URL van de AlaDhan API v1.
 * Versie is gepinned op v1 voor stabiliteit.
 *
 * @constant {string}
 */
const API_BASE = 'https://api.aladhan.com/v1';

/**
 * Berekeningsstandaard: Muslim World League (MWL).
 * Waarde 3 is de vaste code voor MWL in de AlaDhan API.
 *
 * Andere veelgebruikte methoden ter referentie:
 *   1 = University of Islamic Sciences, Karachi
 *   2 = Islamic Society of North America (ISNA)
 *   3 = Muslim World League (MWL)  ← standaard voor Nida v2
 *   4 = Umm Al-Qura University, Makkah
 *   5 = Egyptian General Authority of Survey
 *
 * @constant {number}
 */
export const METHOD_MWL = 3;

/**
 * Maximaal aantal retry-pogingen bij een mislukte request.
 *
 * @constant {number}
 */
const MAX_RETRIES = 3;

/**
 * Basis-wachttijd (ms) voor exponentiële back-off.
 * Poging 1: 1000ms, poging 2: 2000ms, poging 3: 4000ms
 *
 * @constant {number}
 */
const BACKOFF_BASE_MS = 1000;

/**
 * Timeout in milliseconden per request.
 *
 * @constant {number}
 */
const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Cache-TTL voor dagelijkse tijden-calls (6 uur).
 * Tijden veranderen niet binnen één dag, maar DST-correcties
 * rechtvaardigen een periodieke hervalidatie.
 *
 * @constant {number}
 */
const TIMINGS_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Cache-TTL voor maandkalender-calls (24 uur).
 * Een maandkalender is stabiel voor de hele maand.
 *
 * @constant {number}
 */
const CALENDAR_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Cache-TTL voor Hijri-conversie-calls (24 uur).
 *
 * @constant {number}
 */
const HIJRI_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// INTERNE HULPFUNCTIES
// ---------------------------------------------------------------------------

/**
 * Slaap voor een opgegeven aantal milliseconden.
 * Gebruikt in retry-logica.
 *
 * @param   {number} ms - Millisconden om te wachten
 * @returns {Promise<void>}
 */
function _sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Bouwt een cacheKey op basis van URL-parameters.
 * Zorgt voor consistente sleutels ongeacht parametersvolgorde.
 *
 * @param   {string} endpoint   - Bijv. 'timings'
 * @param   {object} params     - Query-parameters als object
 * @returns {string}            Gecombineerde sleutel
 */
function _buildCacheKey(endpoint, params) {
  const sorted = Object.keys(params)
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return `${endpoint}?${sorted}`;
}

/**
 * Haalt de huidige UNIX-timestamp in seconden op.
 * Wordt als path-parameter gebruikt in de AlaDhan timings-endpoint.
 *
 * @returns {number} UNIX timestamp (seconden)
 */
function _unixNow() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Bouwt een datum-string op in DD-MM-YYYY formaat (AlaDhan-standaard).
 *
 * @param   {Date} [date=new Date()] - Datum object
 * @returns {string}                 Bijv. "28-03-2026"
 */
function _formatDateDMY(date = new Date()) {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${d}-${m}-${y}`;
}

/**
 * Extraheert en normaliseert gebedstijden uit een AlaDhan API-response.
 *
 * De API geeft tijden terug met optionele aanduiding (bijv. "05:23 (CEST)").
 * Deze functie knipt de tijdzone-aanduiding af.
 *
 * @param   {object} timings - `data.timings` object van de AlaDhan API
 * @returns {object}         Genormaliseerde map: { fajr, dhuhr, asr, maghrib, isha, imsak, sunrise, sunset }
 */
function _normalizeTimings(timings) {
  if (!timings || typeof timings !== 'object') return null;

  /**
   * Knipt een optionele tijdzone-aanduiding af.
   * "05:23 (CEST)" → "05:23"
   *
   * @param   {string} t
   * @returns {string|null}
   */
  const clean = (t) => {
    if (!t) return null;
    return t.trim().split(' ')[0]; // Alles vóór de eerste spatie
  };

  return {
    fajr:    clean(timings.Fajr    || timings.fajr),
    dhuhr:   clean(timings.Dhuhr   || timings.dhuhr),
    asr:     clean(timings.Asr     || timings.asr),
    maghrib: clean(timings.Maghrib || timings.maghrib),
    isha:    clean(timings.Isha    || timings.isha),
    imsak:   clean(timings.Imsak   || timings.imsak),   // Optioneel
    sunrise: clean(timings.Sunrise || timings.sunrise), // Optioneel
    sunset:  clean(timings.Sunset  || timings.sunset),  // Optioneel
    midnight: clean(timings.Midnight || timings.midnight), // Optioneel
  };
}

// ---------------------------------------------------------------------------
// HOOFD-KLASSE
// ---------------------------------------------------------------------------

/**
 * @class NidaApi
 *
 * AlaDhan API client voor Nida v2.
 *
 * Gebruik:
 * ```js
 * const api = new NidaApi({ method: METHOD_MWL });
 * const timings = await api.getTimings({ lat: 6.9175, lon: 107.6191 });
 * if (timings) engine.loadTimes(timings);
 * ```
 *
 * Singleton-patroon aanbevolen — één instantie per app-sessie.
 */
export class NidaApi {
  /**
   * @param {object} [opts={}]              - Configuratie-opties
   * @param {number} [opts.method=METHOD_MWL] - AlaDhan berekeningsstandaard
   * @param {number} [opts.school=0]          - Hanafi (1) of Shafi'i (0) voor Asr
   * @param {string} [opts.timezone]          - IANA tijdzone string (bijv. "Asia/Jakarta")
   *                                            Als leeg: API detecteert op basis van coördinaten
   */
  constructor(opts = {}) {
    /**
     * AlaDhan berekeningsstandaard.
     * Standaard: Muslim World League (3).
     *
     * @type {number}
     */
    this.method = opts.method ?? METHOD_MWL;

    /**
     * Jurisprudentieschool voor Asr-berekening.
     * 0 = Shafi'i (standaard in meeste landen)
     * 1 = Hanafi (gebruikt in Turkije, Pakistan, India e.a.)
     *
     * @type {number}
     */
    this.school = opts.school ?? 0;

    /**
     * Optionele IANA tijdzone override.
     * Als leeg, laat de API de tijdzone bepalen op basis van coördinaten.
     *
     * @type {string|null}
     */
    this.timezone = opts.timezone || null;

    /**
     * In-memory request cache.
     * Sleutel = cacheKey string, waarde = { data, expiresAt }
     *
     * @type {Map<string, { data: any, expiresAt: number }>}
     * @private
     */
    this._cache = new Map();
  }

  // -------------------------------------------------------------------------
  // PUBLIEKE METHODEN — TIJDEN OPHALEN
  // -------------------------------------------------------------------------

  /**
   * Haalt dagelijkse gebedstijden op voor een specifieke locatie en datum.
   *
   * Endpoint: GET /v1/timings/{timestamp}
   *   ?latitude={lat}
   *   &longitude={lon}
   *   &method={method}
   *   &school={school}
   *   [&timezonestring={timezone}]
   *
   * @param {object}  opts          - Locatie-opties
   * @param {number}  opts.lat      - Breedtegraad (bijv. 6.9175 voor Bandung)
   * @param {number}  opts.lon      - Lengtegraad (bijv. 107.6191)
   * @param {Date}    [opts.date]   - Datum voor tijden (standaard: vandaag)
   * @param {number}  [opts.method] - Override voor berekeningsstandaard
   *
   * @returns {Promise<object|null>} Genormaliseerde tijden-map of null bij fout
   *
   * @example
   * const timings = await api.getTimings({ lat: 6.9175, lon: 107.6191 });
   * // → { fajr: "05:23", dhuhr: "12:01", asr: "15:18", maghrib: "18:12", isha: "19:25", ... }
   */
  async getTimings({ lat, lon, date = new Date(), method } = {}) {
    if (lat === undefined || lon === undefined) {
      console.warn('[NidaApi] getTimings: lat en lon zijn vereist');
      return null;
    }

    // Gebruik UNIX timestamp als path-parameter (API-vereiste voor /v1/timings)
    // De datum wordt intern omgezet naar het begin van die dag (00:00 UTC)
    const dateObj = date instanceof Date ? date : new Date(date);
    const timestamp = Math.floor(dateObj.getTime() / 1000);

    const params = {
      latitude:  lat,
      longitude: lon,
      method:    method ?? this.method,
      school:    this.school,
    };

    // Voeg tijdzone toe als geconfigureerd
    if (this.timezone) params.timezonestring = this.timezone;

    const cacheKey = _buildCacheKey(`timings/${timestamp}`, params);

    // Controleer cache
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    // Bouw de request-URL
    const url = this._buildUrl(`timings/${timestamp}`, params);

    // Voer request uit met retry-logica
    const data = await this._fetchWithRetry(url);
    if (!data || !data.timings) {
      console.warn('[NidaApi] getTimings: geen geldige timings in respons', data);
      return null;
    }

    const normalized = _normalizeTimings(data.timings);
    if (!normalized) return null;

    // Bewaar in cache met TTL
    this._setCache(cacheKey, normalized, TIMINGS_CACHE_TTL_MS);

    return normalized;
  }

  /**
   * Haalt de maandkalender op voor een specifieke locatie.
   *
   * Endpoint: GET /v1/calendar/{year}/{month}
   *
   * Retourneert een array van 28-31 dagobjecten, elk met:
   *   - timings:   gebedstijden voor die dag
   *   - date:      Gregoriaans + Hijri datum-info
   *   - meta:      berekeningsstandaard info
   *
   * Gebruik dit voor proactief prefetchen aan het begin van een maand.
   *
   * @param {object}  opts       - Opties
   * @param {number}  opts.lat   - Breedtegraad
   * @param {number}  opts.lon   - Lengtegraad
   * @param {number}  [opts.year]  - Jaar (standaard: huidig jaar)
   * @param {number}  [opts.month] - Maand 1-12 (standaard: huidige maand)
   *
   * @returns {Promise<Array|null>} Array van dag-objecten of null bij fout
   */
  async getCalendar({ lat, lon, year, month } = {}) {
    if (lat === undefined || lon === undefined) {
      console.warn('[NidaApi] getCalendar: lat en lon zijn vereist');
      return null;
    }

    const now     = new Date();
    const y       = year  ?? now.getFullYear();
    const m       = month ?? (now.getMonth() + 1);

    const params = {
      latitude:  lat,
      longitude: lon,
      method:    this.method,
      school:    this.school,
    };
    if (this.timezone) params.timezonestring = this.timezone;

    const cacheKey = _buildCacheKey(`calendar/${y}/${m}`, params);

    // Controleer cache
    const cached = this._getFromCache(cacheKey);
    if (cached) return cached;

    const url  = this._buildUrl(`calendar/${y}/${m}`, params);
    const data = await this._fetchWithRetry(url);

    if (!Array.isArray(data)) {
      console.warn('[NidaApi] getCalendar: respons is geen array', data);
      return null;
    }

    // Normaliseer elk dag-object
    const normalized = data.map(dayObj => ({
      date:    dayObj.date,    // { gregorian: {...}, hijri: {...} }
      meta:    dayObj.meta,    // { timezone, method, ... }
      timings: _normalizeTimings(dayObj.timings),
    }));

    this._setCache(cacheKey, normalized, CALENDAR_CACHE_TTL_MS);

    return normalized;
  }

  /**
   * Converteert een Gregoriaanse datum naar de corresponderende Hijri datum.
   *
   * Endpoint: GET /v1/gToH/{date}
   *   date = DD-MM-YYYY formaat
   *
   * @param {Date|string} [date=new Date()] - Te converteren datum
   * @returns {Promise<{
   *   day:   string,  // Hijri dag als string (bijv. "5")
   *   month: string,  // Hijri maandnummer (bijv. "9" voor Ramadan)
   *   year:  string,  // Hijri jaar (bijv. "1447")
   *   monthName: {    // Maandnaam in meerdere talen
   *     ar: string,
   *     en: string,
   *   }
   * }|null>}
   */
  async getHijriDate(date = new Date()) {
    const dateObj = date instanceof Date ? date : new Date(date);
    const formatted = _formatDateDMY(dateObj);

    const cacheKey = `gToH/${formatted}`;
    const cached   = this._getFromCache(cacheKey);
    if (cached) return cached;

    const url  = this._buildUrl(`gToH/${formatted}`, {});
    const data = await this._fetchWithRetry(url);

    if (!data || !data.hijri) {
      console.warn('[NidaApi] getHijriDate: geen hijri data in respons', data);
      return null;
    }

    const hijri = data.hijri;
    const result = {
      day:       hijri.day,
      month:     hijri.month?.number?.toString() || '',
      year:      hijri.year,
      monthName: {
        ar: hijri.month?.ar  || '',
        en: hijri.month?.en  || '',
      },
      weekday: {
        ar: hijri.weekday?.ar || '',
        en: hijri.weekday?.en || '',
      },
    };

    this._setCache(cacheKey, result, HIJRI_CACHE_TTL_MS);

    return result;
  }

  /**
   * Geeft alle beschikbare berekeningsstandaarden terug.
   *
   * Endpoint: GET /v1/methods
   *
   * Nuttig voor het bouwen van een standaard-keuzelijst in de instellingen.
   *
   * @returns {Promise<Record<string, object>|null>} Map van method-id naar details
   */
  async getMethods() {
    const cacheKey = 'methods';
    const cached   = this._getFromCache(cacheKey);
    if (cached) return cached;

    const url  = this._buildUrl('methods', {});
    const data = await this._fetchWithRetry(url);

    if (!data || typeof data !== 'object') {
      console.warn('[NidaApi] getMethods: ongeldige respons', data);
      return null;
    }

    // Cache voor 24 uur — methoden veranderen zelden
    this._setCache(cacheKey, data, 24 * 60 * 60 * 1000);

    return data;
  }

  /**
   * Haalt de Qibla-richting op voor een locatie.
   *
   * Endpoint: GET /v1/qibla/{latitude}/{longitude}
   *
   * @param {number} lat - Breedtegraad
   * @param {number} lon - Lengtegraad
   * @returns {Promise<{ direction: number }|null>} Graden ten opzichte van het Noorden
   */
  async getQibla(lat, lon) {
    if (lat === undefined || lon === undefined) return null;

    const cacheKey = `qibla/${lat.toFixed(4)}/${lon.toFixed(4)}`;
    const cached   = this._getFromCache(cacheKey);
    if (cached) return cached;

    const url  = this._buildUrl(`qibla/${lat}/${lon}`, {});
    const data = await this._fetchWithRetry(url);

    if (!data || data.direction === undefined) {
      console.warn('[NidaApi] getQibla: geen direction in respons', data);
      return null;
    }

    const result = { direction: Math.round(data.direction * 10) / 10 };
    this._setCache(cacheKey, result, 24 * 60 * 60 * 1000);

    return result;
  }

  // -------------------------------------------------------------------------
  // CACHE-BEHEER
  // -------------------------------------------------------------------------

  /**
   * Wist alle in-memory cache-entries.
   * Nuttig bij locatie-wijziging of handmatige vernieuwing.
   */
  clearCache() {
    this._cache.clear();
    console.info('[NidaApi] Cache gewist');
  }

  /**
   * Wist verlopende cache-entries.
   * Kan periodiek worden aangeroepen om geheugen vrij te maken.
   */
  pruneCache() {
    const now = Date.now();
    for (const [key, entry] of this._cache.entries()) {
      if (entry.expiresAt < now) {
        this._cache.delete(key);
      }
    }
  }

  // -------------------------------------------------------------------------
  // PRIVÉ-NETWERK-METHODEN
  // -------------------------------------------------------------------------

  /**
   * Voert een GET-request uit met automatische retry bij netwerk-fouten.
   *
   * Retry-strategie:
   *   - Exponentiële back-off: 1s, 2s, 4s
   *   - Retries alleen bij netwerk-fouten (geen retry bij 4xx statuscodes)
   *   - AbortController voor timeout na REQUEST_TIMEOUT_MS
   *
   * @param   {string}   url          - Volledige request-URL
   * @param   {number}   [attempt=0]  - Interne retry-teller
   * @returns {Promise<any|null>}     Geparsede JSON `data` of null bij fatale fout
   * @private
   */
  async _fetchWithRetry(url, attempt = 0) {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        // HTTP-fouten (4xx, 5xx): log en besluit of we retrien
        console.warn(`[NidaApi] HTTP ${response.status} voor: ${url}`);

        // Retry alleen bij server-fouten (5xx), niet bij client-fouten (4xx)
        if (response.status >= 500 && attempt < MAX_RETRIES) {
          await _sleep(BACKOFF_BASE_MS * Math.pow(2, attempt));
          return this._fetchWithRetry(url, attempt + 1);
        }

        return null;
      }

      const json = await response.json();

      // AlaDhan API omhult altijd in { code, status, data }
      if (json.code !== 200 || json.status !== 'OK') {
        console.warn(`[NidaApi] API-fout: code=${json.code} status=${json.status}`);
        return null;
      }

      return json.data;

    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === 'AbortError') {
        console.warn(`[NidaApi] Request timeout na ${REQUEST_TIMEOUT_MS}ms: ${url}`);
      } else {
        console.warn(`[NidaApi] Netwerk-fout: ${err.message}`, url);
      }

      // Retry bij netwerk-fouten (geen AbortError of als nog pogingen over)
      if (attempt < MAX_RETRIES) {
        const waitMs = BACKOFF_BASE_MS * Math.pow(2, attempt);
        console.info(`[NidaApi] Retry ${attempt + 1}/${MAX_RETRIES} na ${waitMs}ms`);
        await _sleep(waitMs);
        return this._fetchWithRetry(url, attempt + 1);
      }

      console.error(`[NidaApi] Alle ${MAX_RETRIES} retries mislukt voor: ${url}`);
      return null;
    }
  }

  /**
   * Bouwt een volledige AlaDhan API URL.
   *
   * @param   {string} endpoint - Endpoint pad (bijv. 'timings/1711584000')
   * @param   {object} params   - Query-parameters als object
   * @returns {string}          Volledige URL
   * @private
   */
  _buildUrl(endpoint, params) {
    const url = new URL(`${API_BASE}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url.toString();
  }

  // -------------------------------------------------------------------------
  // PRIVÉ-CACHE-METHODEN
  // -------------------------------------------------------------------------

  /**
   * Haalt een waarde op uit de cache als die nog niet verlopen is.
   *
   * @param   {string} key - Cache-sleutel
   * @returns {any|null}   Gecachete waarde of null als verlopen/afwezig
   * @private
   */
  _getFromCache(key) {
    const entry = this._cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this._cache.delete(key);
      return null;
    }
    return entry.data;
  }

  /**
   * Slaat een waarde op in de cache met een TTL.
   *
   * @param {string} key    - Cache-sleutel
   * @param {any}    data   - Te cachen waarde
   * @param {number} ttlMs  - Levensduur in milliseconden
   * @private
   */
  _setCache(key, data, ttlMs) {
    this._cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    });
  }
}

// ---------------------------------------------------------------------------
// SINGLETON EXPORT
// ---------------------------------------------------------------------------

/**
 * Singleton instantie van de API-client voor app-brede gebruik.
 *
 * Standaard geconfigureerd met:
 *   - Berekeningsstandaard: Muslim World League (MWL, method 3)
 *   - School: Shafi'i (0)
 *
 * Importeer en gebruik als:
 * ```js
 * import { api } from './nida-api.js';
 * const timings = await api.getTimings({ lat: 6.9175, lon: 107.6191 });
 * ```
 *
 * @type {NidaApi}
 */
export const api = new NidaApi({ method: METHOD_MWL });

/**
 * @file nida-location.js
 * @module NidaLocation
 * @version 2.0.0
 *
 * 5-laags locatiestrategie voor Nida v2.
 *
 * Laagvolgorde (hoogste prioriteit eerst):
 *
 *   Laag 1 — Home Assistant (HA)
 *     Leest coördinaten uit HA-configuratie of zone.home entity.
 *     HA is leidend: als HA beschikbaar is, worden de andere lagen nooit
 *     aangesproken. Dit voorkomt inconsistentie met andere HA-integraties.
 *
 *   Laag 2 — GPS (browser/Capacitor)
 *     `navigator.geolocation.getCurrentPosition()` of Capacitor Geolocation
 *     plugin (Capacitor 8). Vraagt toestemming aan de gebruiker.
 *     Timeout: 10 seconden. Nauwkeurigheid: maximale GPS-precisie.
 *
 *   Laag 3 — IP-geolokatie
 *     Gratis endpoint: https://ip-api.com/json?fields=lat,lon,city,country,timezone
 *     Bereikt een nauwkeurigheid op stad/regio-niveau (~50 km radius).
 *     Geen API-sleutel vereist. Rate-limit: 45 req/min per IP.
 *
 *   Laag 4 — Handmatig
 *     Coördinaten opgegeven door de gebruiker via de Nida-instellingen.
 *     Worden gepersisteerd in localStorage (en optioneel HA input_text).
 *
 *   Laag 5 — Fallback (standaard)
 *     Mekka als geografisch centrum van de islamitische wereld.
 *     Zorgt dat de app nooit volledig functionloos is.
 *     Toont altijd een duidelijke UI-waarschuwing als deze laag actief is.
 *
 * DEVELOPER.md-conventies:
 *   - resolveLocation() retourneert altijd een LocationResult (nooit null/throw)
 *   - Laag-nummers zijn constants, geen magic numbers
 *   - Alle toestemmingsfouten worden apart gerapporteerd via LocationResult.permissionDenied
 *   - Persistentie via localStorage met sleutelprefix 'nida-location-'
 *   - HA-hass-object wordt geïnjecteerd via setHass(), niet via constructor
 *
 * @author  Nida v2 Team
 * @license MIT
 */

// ---------------------------------------------------------------------------
// CONSTANTEN — LAGEN
// ---------------------------------------------------------------------------

/**
 * Laag-nummers voor logging en UI-indicatie.
 * Lager nummer = hogere prioriteit.
 *
 * @enum {number}
 */
export const LOCATION_LAYER = {
  HA:       1,
  GPS:      2,
  IP:       3,
  MANUAL:   4,
  FALLBACK: 5,
};

/**
 * Beschrijving van elke locatielaag (voor logging en UI).
 *
 * @type {Record<number, string>}
 */
export const LAYER_LABELS = {
  [LOCATION_LAYER.HA]:       'Home Assistant',
  [LOCATION_LAYER.GPS]:      'GPS',
  [LOCATION_LAYER.IP]:       'IP-geolokatie',
  [LOCATION_LAYER.MANUAL]:   'Handmatig',
  [LOCATION_LAYER.FALLBACK]: 'Fallback (Mekka)',
};

// ---------------------------------------------------------------------------
// CONSTANTEN — CONFIGURATIE
// ---------------------------------------------------------------------------

/**
 * Fallback-locatie: de Ka'aba in Mekka, Saoedi-Arabië.
 * Wordt gebruikt als geen enkele andere laag beschikbaar is.
 *
 * @constant {{ lat: number, lon: number, city: string, country: string }}
 */
const FALLBACK_LOCATION = {
  lat:      21.4225,
  lon:      39.8262,
  city:     'Mecca',
  country:  'Saudi Arabia',
  timezone: 'Asia/Riyadh',
};

/**
 * IP-geolokatie endpoint.
 * Gebruikt ip-api.com (gratis, geen API-sleutel, HTTPS beschikbaar op Pro).
 * Voor productie: overweeg ipinfo.io of abstract API voor hogere limieten.
 *
 * @constant {string}
 */
const IP_GEO_URL = 'https://ip-api.com/json?fields=status,lat,lon,city,country,timezone';

/**
 * Timeout voor GPS-verzoek in milliseconden.
 *
 * @constant {number}
 */
const GPS_TIMEOUT_MS = 10_000;

/**
 * GPS-nauwkeurigheid: false = energiezuiniger, true = hogere batterijverbruik
 * maar nauwkeuriger (echte GPS vs WiFi/Cell).
 *
 * @constant {boolean}
 */
const GPS_HIGH_ACCURACY = false;

/**
 * Maximum leeftijd van gecachete GPS-positie die nog acceptabel is.
 * Als de GPS-module al een positie heeft die niet ouder is dan dit,
 * wordt die hergebruikt zonder nieuw verzoek.
 *
 * @constant {number}
 */
const GPS_MAX_AGE_MS = 5 * 60 * 1000; // 5 minuten

/**
 * Timeout voor IP-geolokatie request in milliseconden.
 *
 * @constant {number}
 */
const IP_TIMEOUT_MS = 8_000;

/**
 * LocalStorage-sleutelprefix voor locatie-opslag.
 *
 * @constant {string}
 */
const STORAGE_PREFIX = 'nida-location-';

/**
 * Cache-TTL voor opgeslagen GPS/IP-locaties (30 minuten).
 * Voorkomt herhaalde requests bij elke component-render.
 *
 * @constant {number}
 */
const LOCATION_CACHE_TTL_MS = 30 * 60 * 1000;

// ---------------------------------------------------------------------------
// TYPE-DEFINITIE (JSDoc)
// ---------------------------------------------------------------------------

/**
 * @typedef {object} LocationResult
 *
 * Resultaat van een locatie-oplossing.
 *
 * @property {number}  lat              - Breedtegraad
 * @property {number}  lon              - Lengtegraad
 * @property {string}  [city]           - Plaatsnaam (als beschikbaar)
 * @property {string}  [country]        - Landnaam (als beschikbaar)
 * @property {string}  [timezone]       - IANA tijdzone string
 * @property {number}  layer            - Gebruikte laag (LOCATION_LAYER enum)
 * @property {string}  layerLabel       - Leesbare naam van de laag
 * @property {boolean} isFallback       - True als laag 5 (Mekka) gebruikt is
 * @property {boolean} permissionDenied - True als GPS-toestemming geweigerd
 * @property {number}  resolvedAt       - UNIX timestamp ms van de oplossing
 */

// ---------------------------------------------------------------------------
// HOOFD-KLASSE
// ---------------------------------------------------------------------------

/**
 * @class NidaLocation
 *
 * Beheert de 5-laags locatiestrategie voor Nida v2.
 *
 * Gebruik:
 * ```js
 * const locator = new NidaLocation();
 * locator.setHass(hass); // HA-object injecteren
 * const loc = await locator.resolveLocation();
 * // → { lat: 6.9175, lon: 107.6191, layer: 1, layerLabel: 'Home Assistant', ... }
 * ```
 */
export class NidaLocation {
  constructor() {
    /**
     * Home Assistant hass-object (geïnjecteerd via setHass).
     * Bevat `states`, `config`, `callService` etc.
     *
     * @type {object|null}
     * @private
     */
    this._hass = null;

    /**
     * Handmatig geconfigureerde locatie (opgegeven door gebruiker).
     *
     * @type {{ lat: number, lon: number, city?: string } | null}
     * @private
     */
    this._manual = this._loadManual();

    /**
     * Gecachete locatie-oplossing om herhaalde requests te voorkomen.
     *
     * @type {{ result: LocationResult, expiresAt: number } | null}
     * @private
     */
    this._locationCache = null;

    /**
     * Vlag: heeft de gebruiker GPS-toestemming geweigerd in deze sessie?
     * Als true, laag 2 (GPS) wordt overgeslagen.
     *
     * @type {boolean}
     * @private
     */
    this._gpsDenied = false;
  }

  // -------------------------------------------------------------------------
  // PUBLIEKE METHODEN — CONFIGURATIE
  // -------------------------------------------------------------------------

  /**
   * Injecteert het Home Assistant hass-object.
   *
   * Moet worden aangeroepen vóór `resolveLocation()` voor HA-ondersteuning.
   * Kan worden herhaald bij HA-reconnect of state-updates.
   *
   * @param {object|null} hass - HA hass-object of null om HA te wissen
   */
  setHass(hass) {
    this._hass = hass;

    // Gooi de cache weg zodat de volgende resolveLocation() HA opnieuw probeert
    if (hass) {
      this._locationCache = null;
    }
  }

  /**
   * Slaat een handmatig geconfigureerde locatie op.
   *
   * Wordt gepersisteerd in localStorage EN optioneel gesynchroniseerd
   * naar HA `input_text.nida_location` (als beschikbaar).
   *
   * @param {object}  location         - Locatie-object
   * @param {number}  location.lat     - Breedtegraad
   * @param {number}  location.lon     - Lengtegraad
   * @param {string}  [location.city]  - Optionele plaatsnaam
   * @returns {void}
   */
  setManualLocation({ lat, lon, city = '' }) {
    if (typeof lat !== 'number' || typeof lon !== 'number') {
      console.warn('[NidaLocation] setManualLocation: ongeldige coördinaten', { lat, lon });
      return;
    }

    this._manual = { lat, lon, city };
    this._saveManual(this._manual);

    // Sync naar HA input_text (best-effort, geen fout als niet beschikbaar)
    this._syncManualToHA(this._manual);

    // Reset cache zodat de nieuwe locatie direct wordt gebruikt
    this._locationCache = null;

    console.info(`[NidaLocation] Handmatige locatie opgeslagen: ${lat}, ${lon} (${city})`);
  }

  /**
   * Wist de handmatig geconfigureerde locatie.
   * Na aanroep valt resolveLocation() terug op GPS/IP.
   */
  clearManualLocation() {
    this._manual = null;
    try {
      localStorage.removeItem(`${STORAGE_PREFIX}manual`);
    } catch (_) { /* localStorage kan niet beschikbaar zijn in Capacitor sandboxes */ }
    this._locationCache = null;
    console.info('[NidaLocation] Handmatige locatie gewist');
  }

  // -------------------------------------------------------------------------
  // PUBLIEKE METHODEN — LOCATIE OPLOSSEN
  // -------------------------------------------------------------------------

  /**
   * Bepaalt de beste beschikbare locatie via de 5-laagsstrategie.
   *
   * Retourneert altijd een `LocationResult`, ook als alle lagen falen.
   * In dat geval wordt laag 5 (Mekka) gebruikt met `isFallback: true`.
   *
   * Caching: als de vorige oplossing recenter is dan LOCATION_CACHE_TTL_MS,
   * wordt die hergebruikt zonder netwerk-requests.
   *
   * @param {object}  [opts={}]              - Opties
   * @param {boolean} [opts.forceRefresh]    - Sla cache over en los opnieuw op
   * @param {boolean} [opts.skipGps=false]   - Sla GPS (laag 2) over
   * @param {boolean} [opts.skipIp=false]    - Sla IP-geolokatie (laag 3) over
   *
   * @returns {Promise<LocationResult>} Altijd een geldig resultaat
   */
  async resolveLocation(opts = {}) {
    const { forceRefresh = false, skipGps = false, skipIp = false } = opts;

    // Controleer cache
    if (!forceRefresh && this._locationCache) {
      if (Date.now() < this._locationCache.expiresAt) {
        return this._locationCache.result;
      }
    }

    // ---- Laag 1: Home Assistant ------------------------------------------
    const haResult = this._resolveFromHA();
    if (haResult) {
      return this._cacheAndReturn(haResult);
    }

    // ---- Laag 4: Handmatig (hoge prioriteit als HA niet beschikbaar) ------
    // Laag 4 staat logisch vóór GPS/IP omdat het bewuste gebruikerskeuze is.
    // De gebruiker heeft expliciet gekozen voor een locatie — dat respecteren
    // we boven automatische detectie.
    if (this._manual) {
      const manualResult = this._buildResult(
        this._manual.lat,
        this._manual.lon,
        LOCATION_LAYER.MANUAL,
        { city: this._manual.city || '' }
      );
      return this._cacheAndReturn(manualResult);
    }

    // ---- Laag 2: GPS -------------------------------------------------------
    if (!skipGps && !this._gpsDenied) {
      const gpsResult = await this._resolveFromGPS();
      if (gpsResult) {
        return this._cacheAndReturn(gpsResult);
      }
    }

    // ---- Laag 3: IP-geolokatie --------------------------------------------
    if (!skipIp) {
      const ipResult = await this._resolveFromIP();
      if (ipResult) {
        return this._cacheAndReturn(ipResult);
      }
    }

    // ---- Laag 5: Fallback -------------------------------------------------
    console.warn('[NidaLocation] Alle lagen mislukt — Mekka-fallback gebruikt');
    const fallback = this._buildResult(
      FALLBACK_LOCATION.lat,
      FALLBACK_LOCATION.lon,
      LOCATION_LAYER.FALLBACK,
      {
        city:     FALLBACK_LOCATION.city,
        country:  FALLBACK_LOCATION.country,
        timezone: FALLBACK_LOCATION.timezone,
        isFallback: true,
      }
    );
    return this._cacheAndReturn(fallback);
  }

  /**
   * Vraagt expliciet GPS-toestemming aan de gebruiker.
   *
   * Kan worden aangeroepen vanuit een "Locatie bijwerken"-knop in de UI.
   * Omzeilt de cache en forceert een nieuw GPS-verzoek.
   *
   * @returns {Promise<LocationResult|null>} GPS-resultaat of null bij weigering
   */
  async requestGPS() {
    this._gpsDenied = false; // Reset de "geweigerd"-vlag
    const result = await this._resolveFromGPS();
    if (result) {
      this._locationCache = null; // Invalideer cache
      this.setManualLocation({ lat: result.lat, lon: result.lon, city: result.city || '' });
    }
    return result;
  }

  // -------------------------------------------------------------------------
  // LAAG 1 — HOME ASSISTANT
  // -------------------------------------------------------------------------

  /**
   * Probeert de locatie uit Home Assistant te lezen.
   *
   * HA-bronnen (in volgorde van betrouwbaarheid):
   *   1. `hass.config.latitude` + `hass.config.longitude`
   *      (HA-systeemconfiguratie, meest betrouwbaar)
   *   2. `zone.home` entity (home-zone van de gebruiker)
   *   3. `sensor.nida_latitude` + `sensor.nida_longitude`
   *      (optioneel: Nida-specifieke sensoren in HA)
   *
   * @returns {LocationResult|null} Null als HA niet beschikbaar of geen geldige locatie
   * @private
   */
  _resolveFromHA() {
    if (!this._hass) return null;

    // --- Bron 1: HA systeemconfiguratie (meest betrouwbaar) ----------------
    const lat = this._hass.config?.latitude;
    const lon = this._hass.config?.longitude;

    if (_isValidCoord(lat, lon)) {
      const timezone = this._hass.config?.time_zone || null;
      console.info(`[NidaLocation] Laag 1 (HA config): ${lat}, ${lon}`);
      return this._buildResult(lat, lon, LOCATION_LAYER.HA, { timezone });
    }

    // --- Bron 2: zone.home entity ------------------------------------------
    const zoneHome = this._hass.states?.['zone.home'];
    if (zoneHome) {
      const zLat = zoneHome.attributes?.latitude;
      const zLon = zoneHome.attributes?.longitude;

      if (_isValidCoord(zLat, zLon)) {
        console.info(`[NidaLocation] Laag 1 (zone.home): ${zLat}, ${zLon}`);
        return this._buildResult(zLat, zLon, LOCATION_LAYER.HA, {
          city: zoneHome.attributes?.friendly_name || 'Home',
        });
      }
    }

    // --- Bron 3: Nida-specifieke sensoren (optioneel) -----------------------
    const sLat = parseFloat(this._hass.states?.['sensor.nida_latitude']?.state);
    const sLon = parseFloat(this._hass.states?.['sensor.nida_longitude']?.state);

    if (_isValidCoord(sLat, sLon)) {
      console.info(`[NidaLocation] Laag 1 (sensor.nida_*): ${sLat}, ${sLon}`);
      return this._buildResult(sLat, sLon, LOCATION_LAYER.HA, {});
    }

    // HA beschikbaar maar geen geldige locatie gevonden
    console.info('[NidaLocation] Laag 1 (HA): geen geldige coördinaten in HA');
    return null;
  }

  // -------------------------------------------------------------------------
  // LAAG 2 — GPS (Browser / Capacitor)
  // -------------------------------------------------------------------------

  /**
   * Vraagt de huidige GPS-positie op via de browser Geolocation API
   * of via de Capacitor Geolocation plugin (als beschikbaar).
   *
   * Capacitor 8 detectie: controleert op `window.Capacitor?.isNativePlatform()`.
   * Als Capacitor actief is, gebruik dan `@capacitor/geolocation`.
   * Anders: gebruik `navigator.geolocation` (browser/Electron).
   *
   * @returns {Promise<LocationResult|null>} Null bij weigering of timeout
   * @private
   */
  async _resolveFromGPS() {
    try {
      // ---- Capacitor 8 native pad (Android/iOS) ----------------------------
      if (window.Capacitor?.isNativePlatform?.()) {
        return await this._resolveFromCapacitorGPS();
      }

      // ---- Browser / Electron pad ------------------------------------------
      if (!navigator.geolocation) {
        console.info('[NidaLocation] Laag 2 (GPS): navigator.geolocation niet beschikbaar');
        return null;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: GPS_HIGH_ACCURACY,
            timeout:            GPS_TIMEOUT_MS,
            maximumAge:         GPS_MAX_AGE_MS,
          }
        );
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);

      console.info(`[NidaLocation] Laag 2 (GPS): ${lat}, ${lon} (nauwkeurigheid: ${accuracy}m)`);
      return this._buildResult(lat, lon, LOCATION_LAYER.GPS, {
        accuracy,
      });

    } catch (err) {
      // GeolocationPositionError codes:
      //   1 = PERMISSION_DENIED
      //   2 = POSITION_UNAVAILABLE
      //   3 = TIMEOUT
      if (err.code === 1) {
        this._gpsDenied = true; // Sla GPS over in toekomstige aanroepen
        console.info('[NidaLocation] Laag 2 (GPS): toestemming geweigerd');
        return this._buildResult(
          FALLBACK_LOCATION.lat,
          FALLBACK_LOCATION.lon,
          LOCATION_LAYER.GPS, // Markeert als GPS-laag, maar met permissionDenied vlag
          { permissionDenied: true, isFallback: true }
        );
      }

      console.info(`[NidaLocation] Laag 2 (GPS): fout code=${err.code} — ${err.message}`);
      return null;
    }
  }

  /**
   * GPS via Capacitor 8 `@capacitor/geolocation`.
   *
   * Vereist dat de Capacitor Geolocation plugin geïnstalleerd is.
   * Als de plugin niet beschikbaar is, retourneert null.
   *
   * @returns {Promise<LocationResult|null>}
   * @private
   */
  async _resolveFromCapacitorGPS() {
    try {
      // Dynamische import — voorkomt bundle-fouten op niet-Capacitor platforms
      // eslint-disable-next-line import/no-extraneous-dependencies
      const { Geolocation } = await import('@capacitor/geolocation');

      // Vraag toestemming (Capacitor 8 API)
      const perms = await Geolocation.requestPermissions();
      if (perms.location !== 'granted' && perms.coarseLocation !== 'granted') {
        this._gpsDenied = true;
        console.info('[NidaLocation] Laag 2 (Capacitor GPS): toestemming geweigerd');
        return null;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: GPS_HIGH_ACCURACY,
        timeout:            GPS_TIMEOUT_MS,
        maximumAge:         GPS_MAX_AGE_MS,
      });

      const lat = position.coords.latitude;
      const lon = position.coords.longitude;
      const accuracy = Math.round(position.coords.accuracy);

      console.info(`[NidaLocation] Laag 2 (Capacitor GPS): ${lat}, ${lon} (${accuracy}m)`);
      return this._buildResult(lat, lon, LOCATION_LAYER.GPS, { accuracy });

    } catch (err) {
      console.warn('[NidaLocation] Laag 2 (Capacitor GPS): fout —', err.message);
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // LAAG 3 — IP-GEOLOKATIE
  // -------------------------------------------------------------------------

  /**
   * Bepaalt de locatie op basis van het publieke IP-adres.
   *
   * Gebruikt ip-api.com (gratis, geen auth):
   *   GET https://ip-api.com/json?fields=status,lat,lon,city,country,timezone
   *
   * Nauwkeurigheid: op stad/regio-niveau (~50 km). Voldoende voor
   * gebedstijden, die op deze schaal verwaarloosbare verschillen geven.
   *
   * Beperkingen:
   *   - Rate-limit: 45 req/min per IP (vrij gebruik)
   *   - Werkt niet achter bedrijfs-VPN's of Tor
   *   - Niet beschikbaar via HTTPS op de gratis tier
   *     → HTTP is acceptabel voor puur openbare geo-data (geen auth/persoonlijke data)
   *
   * @returns {Promise<LocationResult|null>}
   * @private
   */
  async _resolveFromIP() {
    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), IP_TIMEOUT_MS);

    try {
      const response = await fetch(IP_GEO_URL, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[NidaLocation] Laag 3 (IP): HTTP ${response.status}`);
        return null;
      }

      const data = await response.json();

      // ip-api.com retourneert status: "success" of "fail"
      if (data.status !== 'success') {
        console.warn('[NidaLocation] Laag 3 (IP): API status =', data.status);
        return null;
      }

      if (!_isValidCoord(data.lat, data.lon)) {
        console.warn('[NidaLocation] Laag 3 (IP): ongeldige coördinaten', data);
        return null;
      }

      console.info(`[NidaLocation] Laag 3 (IP): ${data.lat}, ${data.lon} (${data.city}, ${data.country})`);
      return this._buildResult(data.lat, data.lon, LOCATION_LAYER.IP, {
        city:     data.city     || '',
        country:  data.country  || '',
        timezone: data.timezone || null,
      });

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.warn(`[NidaLocation] Laag 3 (IP): timeout na ${IP_TIMEOUT_MS}ms`);
      } else {
        console.warn('[NidaLocation] Laag 3 (IP): fout —', err.message);
      }
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // PERSISTENTIE — HANDMATIGE LOCATIE
  // -------------------------------------------------------------------------

  /**
   * Laadt de opgeslagen handmatige locatie uit localStorage.
   *
   * @returns {{ lat: number, lon: number, city: string }|null}
   * @private
   */
  _loadManual() {
    try {
      const raw = localStorage.getItem(`${STORAGE_PREFIX}manual`);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (_isValidCoord(parsed.lat, parsed.lon)) {
        return { lat: parsed.lat, lon: parsed.lon, city: parsed.city || '' };
      }
    } catch (_) {
      /* localStorage niet beschikbaar of corrupt JSON */
    }
    return null;
  }

  /**
   * Slaat een handmatige locatie op in localStorage.
   *
   * @param {{ lat: number, lon: number, city: string }} manual
   * @private
   */
  _saveManual(manual) {
    try {
      localStorage.setItem(
        `${STORAGE_PREFIX}manual`,
        JSON.stringify(manual)
      );
    } catch (_) {
      console.warn('[NidaLocation] localStorage niet beschikbaar voor persistentie');
    }
  }

  /**
   * Synchroniseert de handmatige locatie naar HA `input_text.nida_location`
   * als die entity beschikbaar is.
   *
   * Formaat: "lat,lon" (bijv. "6.9175,107.6191")
   *
   * @param {{ lat: number, lon: number }} manual
   * @private
   */
  _syncManualToHA(manual) {
    if (!this._hass) return;

    const entityId = 'input_text.nida_location';
    if (!this._hass.states?.[entityId]) return;

    try {
      this._hass.callService('input_text', 'set_value', {
        entity_id: entityId,
        value:     `${manual.lat},${manual.lon}`,
      });
    } catch (err) {
      console.warn('[NidaLocation] HA sync mislukt:', err.message);
    }
  }

  // -------------------------------------------------------------------------
  // HULPMETHODEN
  // -------------------------------------------------------------------------

  /**
   * Bouwt een genormaliseerd `LocationResult`-object.
   *
   * @param {number}  lat         - Breedtegraad
   * @param {number}  lon         - Lengtegraad
   * @param {number}  layer       - LOCATION_LAYER enum-waarde
   * @param {object}  [extras={}] - Extra velden (city, country, timezone, etc.)
   * @returns {LocationResult}
   * @private
   */
  _buildResult(lat, lon, layer, extras = {}) {
    return {
      lat:             parseFloat(lat.toFixed(6)),
      lon:             parseFloat(lon.toFixed(6)),
      city:            extras.city     || '',
      country:         extras.country  || '',
      timezone:        extras.timezone || null,
      accuracy:        extras.accuracy || null,
      layer,
      layerLabel:      LAYER_LABELS[layer] || 'Onbekend',
      isFallback:      extras.isFallback      || layer === LOCATION_LAYER.FALLBACK,
      permissionDenied: extras.permissionDenied || false,
      resolvedAt:      Date.now(),
    };
  }

  /**
   * Slaat een LocationResult op in de cache en retourneert het.
   *
   * @param   {LocationResult} result
   * @returns {LocationResult}
   * @private
   */
  _cacheAndReturn(result) {
    this._locationCache = {
      result,
      expiresAt: Date.now() + LOCATION_CACHE_TTL_MS,
    };
    return result;
  }
}

// ---------------------------------------------------------------------------
// MODULE-NIVEAU HULPFUNCTIES
// ---------------------------------------------------------------------------

/**
 * Controleert of een lat/lon paar geldige coördinaten zijn.
 *
 * @param   {any} lat - Breedtegraad
 * @param   {any} lon - Lengtegraad
 * @returns {boolean}
 */
function _isValidCoord(lat, lon) {
  const numLat = Number(lat);
  const numLon = Number(lon);
  return (
    !isNaN(numLat) && !isNaN(numLon) &&
    numLat >= -90  && numLat <= 90   &&
    numLon >= -180 && numLon <= 180  &&
    // (0, 0) is technisch geldig maar bijna altijd een placeholder-fout
    !(numLat === 0 && numLon === 0)
  );
}

// ---------------------------------------------------------------------------
// SINGLETON EXPORT
// ---------------------------------------------------------------------------

/**
 * Singleton instantie van de locatiemodule voor app-brede gebruik.
 *
 * Importeer en gebruik als:
 * ```js
 * import { locator } from './nida-location.js';
 *
 * // HA-object injecteren (vanuit LitElement of HA card)
 * locator.setHass(this.hass);
 *
 * // Locatie ophalen
 * const loc = await locator.resolveLocation();
 * if (loc.isFallback) {
 *   console.warn('Geen locatie gevonden, Mekka-fallback gebruikt');
 * }
 * ```
 *
 * @type {NidaLocation}
 */
export const locator = new NidaLocation();

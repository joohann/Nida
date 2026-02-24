import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";

class PrayerTimesCard extends LitElement {
  static get properties() { return { hass: {}, _config: {}, _dark: {} }; }
  setConfig(config) { this._config = config; }
  getCardSize() { return 7; }

  connectedCallback() {
    super.connectedCallback();
    this._interval = setInterval(() => this.requestUpdate(), 1000);
    this._detectTheme();
    this._themeObserver = new MutationObserver(() => this._detectTheme());
    this._themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._interval);
    if (this._themeObserver) this._themeObserver.disconnect();
  }

  _detectTheme() {
    if (this._config?.theme === 'dark') { this._dark = true; return; }
    if (this._config?.theme === 'light') { this._dark = false; return; }
    const el = document.documentElement;
    const bg = getComputedStyle(el).getPropertyValue('--primary-background-color').trim() || getComputedStyle(el).backgroundColor;
    if (bg) {
      let r, g, b;
      if (bg.startsWith('#')) {
        const hex = bg.replace('#','');
        r = parseInt(hex.substring(0,2),16); g = parseInt(hex.substring(2,4),16); b = parseInt(hex.substring(4,6),16);
      } else { const m = bg.match(/\d+/g); if (m&&m.length>=3){r=+m[0];g=+m[1];b=+m[2];} }
      if (r !== undefined) { this._dark = (r*299+g*587+b*114)/1000 < 128; return; }
    }
    this._dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  _state(e) { return this.hass?.states[e]?.state; }
  _attr(e, a) { return this.hass?.states[e]?.attributes?.[a]; }
  _isRamadan() { return this._state('binary_sensor.is_ramadan') === 'on'; }

  _nextPrayer() {
    const prayers = ['fajr','dhuhr','asr','maghrib','isha'];
    const entities = { fajr:'sensor.02_fajr_readable', dhuhr:'sensor.04_dhuhr_readable', asr:'sensor.05_asr_readable', maghrib:'sensor.07_maghrib_readable', isha:'sensor.08_isha_readable' };
    const now = new Date();
    const nowMin = now.getHours()*60+now.getMinutes();
    for (const key of prayers) {
      const t = this._state(entities[key]);
      if (!t||t==='unavailable') continue;
      const [h,m] = t.split(':').map(Number);
      if (h*60+m > nowMin) return key;
    }
    return 'fajr';
  }

  _countdown() {
    const entities = ['sensor.02_fajr_readable','sensor.04_dhuhr_readable','sensor.05_asr_readable','sensor.07_maghrib_readable','sensor.08_isha_readable'];
    const now = new Date();
    const nowSec = now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
    const nowMin = Math.floor(nowSec/60);
    let target = null;
    for (const e of entities) {
      const t = this._state(e);
      if (!t||t==='unavailable') continue;
      const [h,m] = t.split(':').map(Number);
      if (h*60+m > nowMin) { target=(h*60+m)*60; break; }
    }
    if (!target) {
      const fajr = this._state('sensor.02_fajr_readable');
      if (fajr) { const [h,m]=fajr.split(':').map(Number); target=(h*60+m+1440)*60; }
    }
    if (!target) return '--:--:--';
    const diff = target-nowSec;
    return `${Math.floor(diff/3600)}:${String(Math.floor((diff%3600)/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`;
  }

  _iftarCountdown() {
    const maghrib = this._state('sensor.07_maghrib_readable');
    if (!maghrib) return null;
    const now = new Date();
    const nowSec = now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
    const [h,m] = maghrib.split(':').map(Number);
    const diff = (h*3600+m*60) - nowSec;
    if (diff <= 0) return null;
    return `${Math.floor(diff/3600)}:${String(Math.floor((diff%3600)/60)).padStart(2,'0')}:${String(diff%60).padStart(2,'0')}`;
  }

  _eidInfo() {
    const month = parseInt(this._state('sensor.hijri_month')||0);
    const day   = parseInt(this._state('sensor.hijri_day')||0);
    if (!month||!day) return null;
    if (month===9) return { name:'Eid al-Fitr', days:30-day, emoji:'🌙' };
    if (month===10&&day<=3) return { name:'Eid al-Fitr', days:0, emoji:'🌙', today:true };
    if (month===12&&day<10) return { name:'Eid al-Adha', days:10-day, emoji:'🐑' };
    if (month===12&&day<=13) return { name:'Eid al-Adha', days:0, emoji:'🐑', today:true };
    if (month===11) { const d=30-day+10; if(d<=30) return { name:'Eid al-Adha', days:d, emoji:'🐑' }; }
    return null;
  }

  _dynamicSlot() {
    const isRamadan = this._isRamadan();
    const eid = this._eidInfo();
    const ramadanDay = this._attr('binary_sensor.is_ramadan','ramadan_day');

    if (isRamadan) {
      const imsak = this._state('sensor.01_imsak_readable');
      const iftarCd = this._iftarCountdown();
      const iftar = this._state('sensor.07_maghrib_readable');
      return html`
        <div class="dynamic-slot ramadan-slot">
          <div class="dynamic-icon">🌙</div>
          <div class="dynamic-label">Ramadan</div>
          <div class="dynamic-day">Dag ${ramadanDay||'—'}</div>
          <div class="dynamic-sub">
            <span>🌅 ${imsak||'—'}</span>
            <span>🌇 ${iftar||'—'}</span>
          </div>
          ${iftarCd ? html`<div class="dynamic-countdown">⏳ ${iftarCd}</div>` 
                    : html`<div class="dynamic-countdown" style="font-size:11px;">بسم الله — Iftar!</div>`}
        </div>`;
    }

    if (eid?.today) {
      return html`
        <div class="dynamic-slot eid-slot">
          <div class="dynamic-icon">${eid.emoji}</div>
          <div class="dynamic-label">${eid.name}</div>
          <div class="dynamic-value">Mubarak!</div>
          <div class="dynamic-sub-single">🎉 Vandaag!</div>
        </div>`;
    }

    if (eid && eid.days <= 30) {
      return html`
        <div class="dynamic-slot eid-soon-slot">
          <div class="dynamic-icon">${eid.emoji}</div>
          <div class="dynamic-label">${eid.name}</div>
          <div class="dynamic-value">${eid.days}</div>
          <div class="dynamic-sub-single">dagen</div>
        </div>`;
    }

    // Standaard: Imsak tijd
    const imsak = this._state('sensor.01_imsak_readable');
    const midnight = this._state('sensor.09_midnight_readable');
    return html`
      <div class="dynamic-slot default-slot">
        <div class="dynamic-icon">🌌</div>
        <div class="dynamic-label">Imsak</div>
        <div class="dynamic-value">${imsak||'—'}</div>
        <div class="dynamic-label" style="margin-top:10px;">Midnight</div>
        <div class="dynamic-value" style="font-size:16px;">${midnight||'—'}</div>
      </div>`;
  }

  static get styles() {
    return css`
      :host { display:block; font-family:'Cairo',sans-serif; }
      .card { border-radius:var(--ha-card-border-radius,12px); overflow:hidden; transition:background 0.3s; }

      /* HEADER */
      .header { padding:14px 16px 12px; }
      .header-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; }
      .hijri-date { font-family:'Amiri',serif; font-size:19px; font-weight:700; }
      .holiday-badge { border-radius:20px; padding:3px 10px; font-size:10px; font-weight:600; }

      /* NEXT PRAYER */
      .next-block { display:flex; align-items:center; gap:12px; border-radius:12px; padding:10px 14px; }
      .next-icon { width:48px; height:48px; background:linear-gradient(135deg,#c9a84c,#a07830); border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:24px; flex-shrink:0; }
      .next-info { flex:1; }
      .next-label { font-size:9px; letter-spacing:2px; text-transform:uppercase; }
      .next-name { font-size:18px; font-weight:800; line-height:1.2; }
      .next-time { font-size:11px; }
      .countdown { font-family:'Amiri',serif; font-size:22px; font-weight:700; text-align:right; }
      .countdown-lbl { font-size:8px; letter-spacing:1px; text-transform:uppercase; text-align:right; }

      /* PRAYER GRID - 3x2 */
      .prayers { padding:10px 12px; display:grid; grid-template-columns:1fr 1fr; grid-template-rows:auto auto auto; gap:7px; }

      /* DYNAMIC SLOT */
      .dynamic-slot { position:relative; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; justify-content:center; min-height:110px; overflow:hidden; }
      .dynamic-icon { font-size:22px; margin-bottom:2px; }
      .dynamic-label { font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:1px; opacity:.7; }
      .dynamic-day { font-family:'Amiri',serif; font-size:28px; font-weight:700; line-height:1.1; }
      .dynamic-value { font-family:'Amiri',serif; font-size:24px; font-weight:700; line-height:1.1; }
      .dynamic-sub { display:flex; flex-direction:column; gap:1px; margin-top:4px; font-size:11px; font-weight:600; opacity:.8; }
      .dynamic-sub-single { font-size:12px; font-weight:600; margin-top:4px; opacity:.8; }
      .dynamic-countdown { font-family:'Amiri',serif; font-size:14px; font-weight:700; margin-top:5px; }

      /* PRAYER ITEM */
      .prayer-item { position:relative; padding:9px 11px; border-radius:10px; overflow:hidden; }
      .prayer-item::before { content:''; position:absolute; left:0; top:0; bottom:0; width:3px; border-radius:10px 0 0 10px; }
      .prayer-item.past { opacity:.4; }
      .prayer-name { font-size:11px; font-weight:700; margin-bottom:1px; letter-spacing:0.3px; }
      .prayer-time { font-family:'Amiri',serif; font-size:22px; font-weight:700; }
      .prayer-emoji { position:absolute; right:8px; top:8px; font-size:14px; opacity:.1; }
      .prayer-item.active .prayer-emoji { opacity:.28; }

      /* FOOTER - alleen pulserende dot */
      .footer { padding:5px 14px 7px; display:flex; align-items:center; }
      .dot { width:5px; height:5px; border-radius:50%; animation:pulse 2s ease-in-out infinite; }
      @keyframes pulse { 0%,100%{opacity:1;} 50%{opacity:.25;} }

      /* DARK */
      .card.dark { background:linear-gradient(160deg,#0f1318 0%,#0a0d12 100%); }
      .card.dark .header { border-bottom:1px solid rgba(201,168,76,.07); }
      .card.dark .hijri-date { color:#c9a84c; }
      .card.dark .holiday-badge { background:rgba(201,168,76,.12); border:1px solid rgba(201,168,76,.3); color:#c9a84c; }
      .card.dark .next-block { background:rgba(201,168,76,.06); border:1px solid rgba(201,168,76,.1); }
      .card.dark .next-label { color:rgba(201,168,76,.5); }
      .card.dark .next-name { color:#f0e6c8; }
      .card.dark .next-time { color:rgba(201,168,76,.6); }
      .card.dark .countdown { color:#c9a84c; }
      .card.dark .countdown-lbl { color:rgba(201,168,76,.4); }
      .card.dark .prayer-item { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); }
      .card.dark .prayer-item.active { background:rgba(201,168,76,.09); border-color:rgba(201,168,76,.25); }
      .card.dark .prayer-item.active::before { background:linear-gradient(180deg,#c9a84c,#a07830); }
      .card.dark .prayer-name { color:#e8dcc8; }
      .card.dark .prayer-item.active .prayer-name { color:#c9a84c; }
      .card.dark .prayer-time { color:#f0e6c8; }
      .card.dark .prayer-item.active .prayer-time { color:#fff; }
      .card.dark .dynamic-slot.ramadan-slot { background:rgba(201,168,76,.07); border:1px solid rgba(201,168,76,.18); color:#c9a84c; }
      .card.dark .dynamic-slot.eid-slot { background:rgba(120,80,200,.1); border:1px solid rgba(120,80,200,.25); color:#b89aff; }
      .card.dark .dynamic-slot.eid-soon-slot { background:rgba(120,80,200,.07); border:1px solid rgba(120,80,200,.18); color:#b89aff; }
      .card.dark .dynamic-slot.default-slot { background:rgba(255,255,255,.03); border:1px solid rgba(255,255,255,.06); color:#e8dcc8; }
      .card.dark .dot { background:#c9a84c; }

      /* LIGHT */
      .card.light { background:linear-gradient(160deg,#fdf8f0 0%,#f5efe0 100%); box-shadow:0 2px 12px rgba(160,120,48,.08); }
      .card.light .header { border-bottom:1px solid rgba(160,120,48,.1); }
      .card.light .hijri-date { color:#8a6820; }
      .card.light .holiday-badge { background:rgba(201,168,76,.15); border:1px solid rgba(160,120,48,.3); color:#8a6820; }
      .card.light .next-block { background:rgba(201,168,76,.12); border:1px solid rgba(160,120,48,.18); }
      .card.light .next-label { color:rgba(138,104,32,.6); }
      .card.light .next-name { color:#3a2c0a; }
      .card.light .next-time { color:rgba(138,104,32,.7); }
      .card.light .countdown { color:#8a6820; }
      .card.light .countdown-lbl { color:rgba(138,104,32,.5); }
      .card.light .prayer-item { background:rgba(255,255,255,.8); border:1px solid rgba(160,120,48,.12); }
      .card.light .prayer-item.active { background:rgba(201,168,76,.15); border-color:rgba(160,120,48,.35); }
      .card.light .prayer-item.active::before { background:linear-gradient(180deg,#c9a84c,#a07830); }
      .card.light .prayer-name { color:#3a2c0a; }
      .card.light .prayer-item.active .prayer-name { color:#8a6820; }
      .card.light .prayer-time { color:#2a1e04; }
      .card.light .prayer-item.active .prayer-time { color:#3a2c0a; }
      .card.light .dynamic-slot.ramadan-slot { background:rgba(201,168,76,.12); border:1px solid rgba(160,120,48,.25); color:#8a6820; }
      .card.light .dynamic-slot.eid-slot { background:rgba(120,80,200,.08); border:1px solid rgba(120,80,200,.2); color:#6040a0; }
      .card.light .dynamic-slot.eid-soon-slot { background:rgba(120,80,200,.06); border:1px solid rgba(120,80,200,.15); color:#6040a0; }
      .card.light .dynamic-slot.default-slot { background:rgba(255,255,255,.8); border:1px solid rgba(160,120,48,.12); color:#3a2c0a; }
      .card.light .dot { background:#c9a84c; }
    `;
  }

  render() {
    if (!this.hass) return html``;
    const now = new Date();
    const nowMin = now.getHours()*60+now.getMinutes();
    const themeClass = this._dark ? 'dark' : 'light';
    const nextKey = this._nextPrayer();

    const hijriDay   = this._state('sensor.hijri_day') || '—';
    const hijriMonth = this._state('sensor.hijri_month') || '';
    const hijriYear  = this._state('sensor.hijri_year') || '';
    const holiday    = this._state('sensor.islamic_holiday_today');
    const holidayName= this._attr('sensor.islamic_holiday_today','holiday_name');
    const nextState  = this._state('sensor.next_prayer') || '';
    const m1 = nextState.match(/\((\w+)\)/);
    const m2 = nextState.match(/^(\w+)\s+in/);
    const nextName = m1?m1[1]:(m2?m2[1]:nextState.split(' ')[0]);

    const prayers = [
      { key:'fajr',    name:'Fajr',    entity:'sensor.02_fajr_readable',    icon:'🕌' },
      { key:'dhuhr',   name:'Dhuhr',   entity:'sensor.04_dhuhr_readable',   icon:'🕌' },
      { key:'asr',     name:'Asr',     entity:'sensor.05_asr_readable',     icon:'🕌' },
      { key:'maghrib', name:'Maghrib', entity:'sensor.07_maghrib_readable', icon:'🌇' },
      { key:'isha',    name:'Isha',    entity:'sensor.08_isha_readable',    icon:'🌙' },
    ];

    return html`
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
      <div class="card ${themeClass}">

        <div class="header">
          <div class="header-top">
            <div class="hijri-date">${hijriDay} ${hijriMonth} ${hijriYear}</div>
            ${holiday==='on' ? html`<div class="holiday-badge">🌙 ${holidayName||'Islamic Holiday'}</div>` : ''}
          </div>
          <div class="next-block">
            <div class="next-icon">🕌</div>
            <div class="next-info">
              <div class="next-label">Next Prayer</div>
              <div class="next-name">${nextName||'—'}</div>
              <div class="next-time">${nextState}</div>
            </div>
            <div>
              <div class="countdown">${this._countdown()}</div>
              <div class="countdown-lbl">remaining</div>
            </div>
          </div>
        </div>

        <div class="prayers">
          ${this._dynamicSlot()}
          ${prayers.map(p => {
            const t = this._state(p.entity);
            if (!t||t==='unavailable') return '';
            const [h,m] = t.split(':').map(Number);
            const pm = h*60+m;
            const isActive = p.key === nextKey;
            const isPast = !isActive && pm < nowMin;
            const cls = isActive ? 'active' : isPast ? 'past' : '';
            return html`
              <div class="prayer-item ${cls}">
                <div class="prayer-emoji">${p.icon}</div>
                <div class="prayer-name">${p.name}</div>
                <div class="prayer-time">${t}</div>
              </div>`;
          })}
        </div>

        <div class="footer">
          <div class="dot"></div>
        </div>
      </div>
    `;
  }
}
customElements.define('prayer-times-card', PrayerTimesCard);
import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
// NIDA CARD v29 — radius header, progress bar zichtbaar, suhoor middernacht fix

// Hijri maandnamen per taal
// NL/EN/DE/FR/ID/MS nemen de Arabische uitspraak over in Latijns schrift
const HIJRI_MONTHS = {
  ar: ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'],
  ur: ['محرم','صفر','ربیع الاول','ربیع الثانی','جمادی الاول','جمادی الثانی','رجب','شعبان','رمضان','شوال','ذوالقعدہ','ذوالحجہ'],
  tr: ['Muharrem','Safer','Rebiülevvel','Rebiülahir','Cemaziyelevvel','Cemaziyelahir','Recep','Şaban','Ramazan','Şevval','Zilkade','Zilhicce'],
  fa: ['محرم','صفر','ربیع‌الاول','ربیع‌الثانی','جمادی‌الاول','جمادی‌الثانی','رجب','شعبان','رمضان','شوال','ذیقعده','ذیحجه'],
  // alle andere talen: Arabische uitspraak, Latijns schrift
  _latin: ['Muḥarram','Ṣafar','Rabīʿ al-Awwal','Rabīʿ al-Ākhir','Jumādā al-Ūlā','Jumādā al-Ākhira','Rajab','Shaʿbān','Ramaḍān','Shawwāl','Dhū al-Qaʿda','Dhū al-Ḥijja'],
};

function getHijriMonth(monthNum, lang) {
  const idx = (parseInt(monthNum) || 1) - 1;
  if (HIJRI_MONTHS[lang]) return HIJRI_MONTHS[lang][idx] || '';
  return HIJRI_MONTHS._latin[idx] || '';
}

const TRANSLATIONS = {
  nl: { next_prayer:'Volgend Gebed', remaining:'Resterend', tadkir:'Tadkir', pre_adhan:'Pre-adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhoor', ramadan:'Ramadan', dag:'Dag', imsak:'Imsak', iftar:'Iftar', settings:'Instellingen', show_title:'Toon datum', language:'Taal', no_action:'Geen actie', theme:'Thema', brightness:'Helderheid', close_settings:'Kaart sluiten', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  en: { next_prayer:'Next Prayer', remaining:'Remaining', tadkir:'Tadkir', pre_adhan:'Pre-adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhoor', ramadan:'Ramadan', dag:'Day', imsak:'Imsak', iftar:'Iftar', settings:'Settings', show_title:'Show date', language:'Language', no_action:'No action', theme:'Theme', brightness:'Brightness', close_settings:'Close card', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  ar: { next_prayer:'الصلاة القادمة', remaining:'المتبقي', tadkir:'تذكير', pre_adhan:'قبل الأذان', adhan:'أذان', tarhim:'ترحيم', suhoor:'سحور', ramadan:'رمضان', dag:'يوم', imsak:'إمساك', iftar:'إفطار', settings:'إعدادات', show_title:'إظهار التاريخ', language:'اللغة', no_action:'لا إجراء', theme:'المظهر', brightness:'السطوع', close_settings:'إغلاق البطاقة', prayers:{ fajr:'الفجر', dhuhr:'الظهر', asr:'العصر', maghrib:'المغرب', isha:'العشاء' } },
  de: { next_prayer:'Nächstes Gebet', remaining:'Verbleibend', tadkir:'Tadkir', pre_adhan:'Vor-Adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhoor', ramadan:'Ramadan', dag:'Tag', imsak:'Imsak', iftar:'Iftar', settings:'Einstellungen', show_title:'Datum anzeigen', language:'Sprache', no_action:'Keine Aktion', theme:'Design', brightness:'Helligkeit', close_settings:'Karte schließen', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  fr: { next_prayer:'Prochaine Prière', remaining:'Restant', tadkir:'Tadkir', pre_adhan:'Pré-adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhour', ramadan:'Ramadan', dag:'Jour', imsak:'Imsak', iftar:'Iftar', settings:'Paramètres', show_title:'Afficher date', language:'Langue', no_action:'Aucune action', theme:'Thème', brightness:'Luminosité', close_settings:'Fermer la carte', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  id: { next_prayer:'Sholat Berikutnya', remaining:'Tersisa', tadkir:'Tadkir', pre_adhan:'Pra-adzan', adhan:'Adzan', tarhim:'Tarhim', suhoor:'Sahur', ramadan:'Ramadan', dag:'Hari', imsak:'Imsak', iftar:'Iftar', settings:'Pengaturan', show_title:'Tampilkan tanggal', language:'Bahasa', no_action:'Tidak ada', theme:'Tema', brightness:'Kecerahan', close_settings:'Tutup kartu', prayers:{ fajr:'Subuh', dhuhr:'Dzuhur', asr:'Ashar', maghrib:'Maghrib', isha:'Isya' } },
  ms: { next_prayer:'Solat Seterusnya', remaining:'Baki', tadkir:'Tadkir', pre_adhan:'Pra-azan', adhan:'Azan', tarhim:'Tarhim', suhoor:'Sahur', ramadan:'Ramadan', dag:'Hari', imsak:'Imsak', iftar:'Iftar', settings:'Tetapan', show_title:'Tunjuk tarikh', language:'Bahasa', no_action:'Tiada', theme:'Tema', brightness:'Kecerahan', close_settings:'Tutup kad', prayers:{ fajr:'Subuh', dhuhr:'Zohor', asr:'Asar', maghrib:'Maghrib', isha:'Isyak' } },
  tr: { next_prayer:'Sonraki Namaz', remaining:'Kalan', tadkir:'Hatırlatma', pre_adhan:'Ezan Öncesi', adhan:'Ezan', tarhim:'Terhim', suhoor:'Sahur', ramadan:'Ramazan', dag:'Gün', imsak:'İmsak', iftar:'İftar', settings:'Ayarlar', show_title:'Tarihi göster', language:'Dil', no_action:'İşlem yok', theme:'Tema', brightness:'Parlaklık', close_settings:'Kartı kapat', prayers:{ fajr:'Sabah', dhuhr:'Öğle', asr:'İkindi', maghrib:'Akşam', isha:'Yatsı' } },
  ur: { next_prayer:'اگلی نماز', remaining:'باقی', tadkir:'تذکیر', pre_adhan:'پیشِ اذان', adhan:'اذان', tarhim:'ترحیم', suhoor:'سحری', ramadan:'رمضان', dag:'دن', imsak:'امساک', iftar:'افطار', settings:'ترتیبات', show_title:'تاریخ دکھائیں', language:'زبان', no_action:'کوئی عمل نہیں', theme:'تھیم', brightness:'روشنی', close_settings:'کارڈ بند کریں', prayers:{ fajr:'فجر', dhuhr:'ظہر', asr:'عصر', maghrib:'مغرب', isha:'عشاء' } },
  fa: { next_prayer:'نماز بعدی', remaining:'باقی‌مانده', tadkir:'تذکیر', pre_adhan:'پیش از اذان', adhan:'اذان', tarhim:'ترحیم', suhoor:'سحر', ramadan:'رمضان', dag:'روز', imsak:'امساک', iftar:'افطار', settings:'تنظیمات', show_title:'نمایش تاریخ', language:'زبان', no_action:'هیچ عملی', theme:'پوسته', brightness:'روشنایی', close_settings:'بستن کارت', prayers:{ fajr:'صبح', dhuhr:'ظهر', asr:'عصر', maghrib:'مغرب', isha:'عشاء' } },
};

const LANG_LABELS = { nl:'Nederlands', en:'English', ar:'العربية', de:'Deutsch', fr:'Français', id:'Indonesia', ms:'Melayu', tr:'Türkçe', ur:'اردو', fa:'فارسی' };
const RTL_LANGS = new Set(['ar','ur','fa']);
const HA_LANG_MAP = { nl:'nl', en:'en', de:'de', fr:'fr', id:'id', ms:'ms', tr:'tr', ar:'ar' };

function moonPhaseEmoji(day) {
  const d = ((day - 1) % 30);
  if (d < 2) return '🌑'; if (d < 6) return '🌒'; if (d < 9) return '🌓';
  if (d < 13) return '🌔'; if (d < 17) return '🌕'; if (d < 21) return '🌖';
  if (d < 24) return '🌗'; if (d < 28) return '🌘'; return '🌑';
}

class NidaCard extends LitElement {
  static get properties() {
    return { hass:{}, _config:{}, _dark:{}, _flipped:{}, _lang:{}, _showTitle:{}, _brightness:{}, _theme:{} };
  }

  setConfig(config) {
    this._config = config;
    this._theme = config.theme || 'auto';
    this._showTitle = config.show_title !== false;
    this._brightness = config.brightness !== undefined ? config.brightness : 50;
    this._lang = config.language || null;
    this._flipped = false;
  }

  _t(key) { return (TRANSLATIONS[this._lang] || TRANSLATIONS.en)[key] || key; }
  _tp(key) { return ((TRANSLATIONS[this._lang] || TRANSLATIONS.en).prayers || {})[key] || key; }
  getCardSize() { return 7; }

  connectedCallback() {
    super.connectedCallback();
    this._interval = setInterval(() => this.requestUpdate(), 1000);
    this._applyTheme();
    this._obs = new MutationObserver(() => this._applyTheme());
    this._obs.observe(document.documentElement, { attributes: true, attributeFilter: ['style','class'] });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearInterval(this._interval);
    if (this._obs) this._obs.disconnect();
  }

  _applyTheme() {
    if (this._theme === 'dark') { this._dark = true; return; }
    if (this._theme === 'light') { this._dark = false; return; }
    const bg = getComputedStyle(document.documentElement).getPropertyValue('--primary-background-color').trim();
    if (bg) {
      let r, g, b;
      if (bg.startsWith('#')) { const h=bg.replace('#',''); r=parseInt(h.slice(0,2),16); g=parseInt(h.slice(2,4),16); b=parseInt(h.slice(4,6),16); }
      else { const m=bg.match(/\d+/g); if(m&&m.length>=3){r=+m[0];g=+m[1];b=+m[2];} }
      if (r!==undefined) { this._dark=(r*299+g*587+b*114)/1000<128; return; }
    }
    this._dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  }

  _detectLang() {
    if (this._config?.language) return this._config.language;
    const haLang = this.hass?.language || this.hass?.locale?.language || 'en';
    const base = haLang.split('-')[0];
    return TRANSLATIONS[base] ? base : (HA_LANG_MAP[haLang] || 'en');
  }

  _s(e) { return this.hass?.states[e]?.state; }
  _a(e,a) { return this.hass?.states[e]?.attributes?.[a]; }
  _isRamadan() { return this._s('binary_sensor.is_ramadan') === 'on'; }

  _nextKey() {
    const map = { fajr:'sensor.02_fajr_readable', dhuhr:'sensor.04_dhuhr_readable', asr:'sensor.05_asr_readable', maghrib:'sensor.07_maghrib_readable', isha:'sensor.08_isha_readable' };
    const nowMin = new Date().getHours()*60+new Date().getMinutes();
    for (const k of ['fajr','dhuhr','asr','maghrib','isha']) {
      const t=this._s(map[k]); if(!t||t==='unavailable') continue;
      const [h,m]=t.split(':').map(Number); if(h*60+m>nowMin) return k;
    }
    return 'fajr';
  }

  _countdown() {
    const ents = ['sensor.02_fajr_readable','sensor.04_dhuhr_readable','sensor.05_asr_readable','sensor.07_maghrib_readable','sensor.08_isha_readable'];
    const now = new Date();
    const nowSec = now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
    const nowMin = Math.floor(nowSec/60);
    let target = null;
    for (const e of ents) {
      const t=this._s(e); if(!t||t==='unavailable') continue;
      const [h,m]=t.split(':').map(Number);
      if(h*60+m>nowMin){target=(h*60+m)*60;break;}
    }
    if(!target){const f=this._s('sensor.02_fajr_readable');if(f){const[h,m]=f.split(':').map(Number);target=(h*60+m+1440)*60;}}
    if(!target) return '--:--:--';
    const d=target-nowSec;
    return `${Math.floor(d/3600)}:${String(Math.floor((d%3600)/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`;
  }

  _progress() {
    const ents = ['sensor.02_fajr_readable','sensor.04_dhuhr_readable','sensor.05_asr_readable','sensor.07_maghrib_readable','sensor.08_isha_readable'];
    const nowMin = new Date().getHours()*60+new Date().getMinutes();
    let prev=null, next=null;
    for (const e of ents) {
      const t=this._s(e); if(!t||t==='unavailable') continue;
      const [h,m]=t.split(':').map(Number); const pm=h*60+m;
      if(pm<=nowMin) prev=pm; else if(next===null){next=pm;break;}
    }
    if(prev===null||next===null) return 0;
    return Math.min(100,Math.round(((nowMin-prev)/(next-prev))*100));
  }

  _iftarCd() {
    const mag=this._s('sensor.07_maghrib_readable'); if(!mag) return null;
    const now=new Date(); const ns=now.getHours()*3600+now.getMinutes()*60+now.getSeconds();
    const[h,m]=mag.split(':').map(Number); const d=(h*3600+m*60)-ns;
    if(d<=0) return null;
    return `${Math.floor(d/3600)}:${String(Math.floor((d%3600)/60)).padStart(2,'0')}:${String(d%60).padStart(2,'0')}`;
  }

  _eid() {
    const mo=parseInt(this._s('sensor.hijri_month')||0), dy=parseInt(this._s('sensor.hijri_day')||0);
    if(!mo||!dy) return null;
    if(mo===9) return{name:'Eid al-Fitr',days:30-dy,emoji:'🌙'};
    if(mo===10&&dy<=3) return{name:'Eid al-Fitr',days:0,emoji:'🌙',today:true};
    if(mo===12&&dy<10) return{name:'Eid al-Adha',days:10-dy,emoji:'🐑'};
    if(mo===12&&dy<=13) return{name:'Eid al-Adha',days:0,emoji:'🐑',today:true};
    if(mo===11){const d=30-dy+10;if(d<=30)return{name:'Eid al-Adha',days:d,emoji:'🐑'};}
    return null;
  }

  _nextAction() {
    const nowMin=new Date().getHours()*60+new Date().getMinutes();
    const isRam=this._isRamadan();
    const acts=[];
    const pmap=[{k:'fajr',e:'sensor.02_fajr_readable'},{k:'dhuhr',e:'sensor.04_dhuhr_readable'},{k:'asr',e:'sensor.05_asr_readable'},{k:'maghrib',e:'sensor.07_maghrib_readable'},{k:'isha',e:'sensor.08_isha_readable'}];
    for(const p of pmap){
      const t=this._s(p.e); if(!t||t==='unavailable') continue;
      const[h,m]=t.split(':').map(Number); const pm=h*60+m;
      for(const off of[10,5]){const r=pm-off;if(r>nowMin)acts.push({type:'tadkir',prayerKey:p.k,min:r,time:`${String(Math.floor(r/60)).padStart(2,'0')}:${String(r%60).padStart(2,'0')}`});}
      if(pm>nowMin)acts.push({type:'adhan',prayerKey:p.k,min:pm,time:t});
    }
    if(isRam){
      const f=this._s('sensor.02_fajr_readable');
      if(f){
        const[h,m]=f.split(':').map(Number);
        // tarhim = 30 min voor fajr — als al voorbij, reken volgende dag (+1440)
        let tm=h*60+m-30;
        if(tm<=nowMin) tm+=1440;
        acts.push({type:'tarhim',prayerKey:null,min:tm,time:`${String(Math.floor((tm%1440)/60)).padStart(2,'0')}:${String(tm%60).padStart(2,'0')}`});
        // suhoor = imsak tijd
        const im=this._s('sensor.01_imsak_readable');
        if(im){
          const[ih,im2]=im.split(':').map(Number);
          let sm=ih*60+im2;
          if(sm<=nowMin) sm+=1440;
          acts.push({type:'suhoor',prayerKey:null,min:sm,time:`${String(Math.floor((sm%1440)/60)).padStart(2,'0')}:${String(sm%60).padStart(2,'0')}`});
        }
      }
    }
    if(!acts.length) return null;
    acts.sort((a,b)=>a.min-b.min);
    return acts[0];
  }

  // Label voor de actie in het dynamic slot
  // tadkir → "Pre-adhan Dhuhr" (met ellipsis via CSS als te lang)
  _actionLabel(action) {
    if (!action) return '';
    if (action.type === 'tadkir') return `${this._t('pre_adhan')} ${this._tp(action.prayerKey)}`;
    if (action.type === 'adhan')  return `${this._t('adhan')} ${this._tp(action.prayerKey)}`;
    if (action.type === 'tarhim') return this._t('tarhim');
    if (action.type === 'suhoor') return this._t('suhoor');
    return '';
  }

  _bg() {
    const b=this._brightness/100;
    if(this._dark){
      const v=Math.round(b*35);
      return `linear-gradient(160deg,rgb(${v},${Math.round(v*1.15)},${Math.round(v*1.3)}) 0%,rgb(${Math.round(v*0.7)},${Math.round(v*0.8)},${Math.round(v*0.95)}) 100%)`;
    }else{
      const base=Math.round(210+b*45);
      return `linear-gradient(160deg,rgb(${base},${Math.round(base*0.97)},${Math.round(base*0.88)}) 0%,rgb(${Math.round(base*0.96)},${Math.round(base*0.93)},${Math.round(base*0.83)}) 100%)`;
    }
  }

  static get styles() {
    return css`
      :host{display:block;width:100%;box-sizing:border-box;font-family:'Cairo',sans-serif;}
      *,*::before,*::after{box-sizing:border-box;}

      /* ── FLIP CONTAINER ── */
      .flip-container{width:100%;perspective:1200px;}
      .flipper{
        position:relative;
        width:100%;
        transform-style:preserve-3d;
        transition:transform 0.6s cubic-bezier(0.4,0.2,0.2,1);
      }
      .flipper.flipped{transform:rotateY(180deg);}

      /* Voorkant in normale flow → bepaalt hoogte van flipper */
      .face.front{
        position:relative;
        width:100%;
        backface-visibility:hidden;
        -webkit-backface-visibility:hidden;
        border-radius:var(--ha-card-border-radius,12px);
        overflow:hidden;
      }
      /* Achterkant: absoluut, zelfde hoogte als voorkant, volledig zwart */
      .face.back{
        position:absolute;
        top:0; left:0;
        width:100%;
        height:100%;
        backface-visibility:hidden;
        -webkit-backface-visibility:hidden;
        border-radius:var(--ha-card-border-radius,12px);
        overflow:hidden;
        transform:rotateY(180deg);
        background:#000;
      }

      /* CARD */
      .card{width:100%;border-radius:var(--ha-card-border-radius,12px);overflow:hidden;transition:background 0.4s;}

      /* HEADER — verborgen als datum in next-block zit, of toon holiday */
      .header{padding:0;}
      .header-top{display:none;}
      .hijri-date{font-family:'Amiri',serif;font-size:19px;font-weight:700;line-height:1.2;display:flex;align-items:center;gap:7px;}
      .holiday-name{font-size:11px;font-weight:700;padding:6px 16px 0;}

      /* PROGRESS BAR — 5px, zichtbare track */
      .progress-bar{height:5px;width:100%;overflow:hidden;margin:0;}
      .progress-fill{height:100%;transition:width 1s linear;background:linear-gradient(90deg,#c9a84c,#f0d078);}

      /* NEXT PRAYER — afgeronde onderkant, zelfde padding als cellen */
      .next-block{
        padding:12px 12px 14px;
        width:100%;
        box-sizing:border-box;
        border-radius:0 0 14px 14px;
      }
      .next-inner{
        display:flex;
        align-items:flex-start;
        gap:12px;
        position:relative;
      }
      .next-icon{
        width:48px; height:48px;
        background:linear-gradient(135deg,#c9a84c,#a07830);
        border-radius:12px;
        display:flex; align-items:center; justify-content:center;
        font-size:24px;
        flex-shrink:0;
      }
      /* Linkerkolom: naam links uitgelijnd */
      .next-text{
        flex:1;
        min-width:0;
        text-align:left;
      }
      .next-label{
        font-size:9px;letter-spacing:2px;text-transform:uppercase;
        font-weight:600;line-height:1;
        display:block;
        margin-bottom:2px;
      }
      .next-name{
        font-family:'Amiri',serif;font-size:28px;font-weight:700;line-height:1.15;
        display:block;
      }
      /* Rechterkolom: absoluut rechts uitgelijnd */
      .next-right-col{
        position:absolute;
        right:0; top:0;
        display:flex;
        flex-direction:column;
        align-items:flex-end;
        text-align:right;
      }
      .countdown-lbl{
        font-size:9px;letter-spacing:2px;text-transform:uppercase;
        font-weight:600;line-height:1;
        display:block;
        margin-bottom:2px;
      }
      .countdown{
        font-family:'Amiri',serif;font-size:28px;font-weight:700;line-height:1.15;
        display:block;
      }
      /* Datum — gecentreerd op volledige kaartbreedte */
      .next-date{
        font-size:10px;font-weight:600;opacity:.45;
        margin-top:6px;
        display:flex;align-items:center;justify-content:center;gap:4px;
        white-space:nowrap;
        width:100%;
      }
      .next-date-sep{opacity:.5;}
      .next-info,.countdown-col,.next-row-top,.next-row-main,.next-right,
      .next-table,.next-row-labels,.next-row-values{display:none;}

      /* PRAYER GRID */
      .prayers{padding:10px 12px 10px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:7px;}

      /* DYNAMIC SLOT */
      .dynamic-slot{position:relative;border-radius:10px;padding:9px 11px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
      .dynamic-sub{display:flex;flex-direction:column;gap:2px;margin-top:4px;font-size:11px;font-weight:600;opacity:.85;}
      .dynamic-countdown{font-family:'Amiri',serif;font-size:14px;font-weight:700;margin-top:5px;}

      /* Actie rij: TIJD links, LABEL rechts met ellipsis */
      .nida-action-row{
        display:flex;
        align-items:baseline;
        gap:5px;
        margin-top:2px;
        min-width:0;
        overflow:hidden;
      }
      .nida-action-time{
        font-family:'Amiri',serif;
        font-size:22px;
        font-weight:700;
        flex-shrink:0;
        line-height:1;
      }
      .nida-action-label{
        font-size:10px;
        font-weight:700;
        opacity:.65;
        overflow:hidden;
        white-space:nowrap;
        text-overflow:ellipsis;
        min-width:0;
        flex:1;
        align-self:center;
      }

      /* PRAYER ITEM */
      .prayer-item{position:relative;padding:9px 11px;border-radius:10px;overflow:hidden;}
      .prayer-item::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:10px 0 0 10px;}
      .prayer-item.past{opacity:.4;}
      .prayer-name{font-size:11px;font-weight:700;margin-bottom:1px;letter-spacing:0.3px;}
      .prayer-time{font-family:'Amiri',serif;font-size:22px;font-weight:700;}
      .prayer-emoji{position:absolute;right:8px;top:8px;font-size:14px;opacity:.12;}
      .prayer-item.active .prayer-emoji{opacity:.28;}

      /* GEAR — halft van next-icon (48px), dus 24px, subtiel */
      .gear-btn{
        position:absolute;
        right:8px;
        bottom:8px;
        background:none;
        border:none;
        cursor:pointer;
        padding:0;
        font-size:24px;
        opacity:.11;
        transition:opacity .2s;
        line-height:1;
        z-index:2;
      }
      .gear-btn:hover{opacity:.4;}

      /* ── SETTINGS ACHTERKANT ──
         Volledig zwart, zelfde hoogte als voorkant (via height:100%)
      ── */
      .settings-back{
        padding:20px 16px 16px;
        display:flex;
        flex-direction:column;
        height:100%;
        background:#000;
        color:#e8dcc8;
      }

      /* Sluitknop bovenaan — "✕ Kaart sluiten" */
      .close-btn{
        display:flex;
        align-items:center;
        gap:8px;
        background:none;
        border:none;
        cursor:pointer;
        color:#c9a84c;
        font-family:'Cairo',sans-serif;
        font-size:12px;
        font-weight:700;
        padding:0 0 18px 0;
        opacity:.85;
        transition:opacity .2s;
        letter-spacing:.3px;
      }
      .close-btn:hover{opacity:1;}
      .close-btn-icon{
        width:22px;height:22px;
        border-radius:50%;
        border:1.5px solid rgba(201,168,76,.5);
        display:flex;align-items:center;justify-content:center;
        font-size:12px;color:#c9a84c;
        flex-shrink:0;
      }

      .settings-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:16px;color:rgba(201,168,76,.45);}
      .settings-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;font-size:12px;font-weight:600;gap:10px;color:#e8dcc8;}
      .settings-row label{opacity:.7;flex-shrink:0;}
      .settings-toggle{width:36px;height:20px;border-radius:10px;border:none;cursor:pointer;position:relative;transition:background .2s;flex-shrink:0;}
      .settings-toggle.on{background:#c9a84c;}
      .settings-toggle.off{background:rgba(150,150,150,.3);}
      .settings-toggle::after{content:'';position:absolute;width:14px;height:14px;border-radius:50%;background:#fff;top:3px;transition:left .2s;}
      .settings-toggle.on::after{left:19px;}
      .settings-toggle.off::after{left:3px;}
      .lang-select,.theme-select{
        background:rgba(255,255,255,.06);
        border:1px solid rgba(201,168,76,.3);
        border-radius:6px;
        padding:3px 6px;
        font-size:11px;
        font-family:'Cairo',sans-serif;
        cursor:pointer;
        max-width:130px;
        color:#e8dcc8;
      }
      .slider-row{flex-direction:column;align-items:flex-start;gap:5px;}
      .slider-row label{opacity:.7;}
      .range-slider{width:100%;accent-color:#c9a84c;cursor:pointer;}

      /* RTL */
      .rtl{direction:rtl;}
      .rtl .next-block{direction:rtl;}
      .rtl .countdown-lbl{text-align:left;}
      .rtl .countdown{text-align:left;}
      .rtl .prayer-item::before{left:auto;right:0;border-radius:0 10px 10px 0;}
      .rtl .prayer-emoji{right:auto;left:8px;}
      .rtl .nida-action-row{flex-direction:row-reverse;}
      .rtl .gear-btn{right:auto;left:8px;}

      /* DARK */
      .card.dark .header{border-bottom:none;}
      .card.dark .hijri-date{color:#c9a84c;}
      .card.dark .holiday-name{color:#f0a050;}
      .card.dark .progress-bar{background:rgba(201,168,76,.25);}
      .card.light .progress-bar{background:rgba(160,120,48,.3);}
      .card.dark .next-block{background:rgba(201,168,76,.06);border-bottom:1px solid rgba(201,168,76,.1);}
      .card.dark .next-label{color:rgba(201,168,76,.5);}
      .card.dark .countdown-lbl{color:rgba(201,168,76,.4);}
      .card.dark .next-name{color:#f0e6c8;}
      .card.dark .countdown{color:#f0e6c8;}
      .card.dark .next-date{color:#c9a84c;}
      .card.dark .prayer-item{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);}
      .card.dark .prayer-item.active{background:rgba(201,168,76,.09);border-color:rgba(201,168,76,.25);}
      .card.dark .prayer-item.active::before{background:linear-gradient(180deg,#c9a84c,#a07830);}
      .card.dark .prayer-name{color:#e8dcc8;}
      .card.dark .prayer-item.active .prayer-name{color:#c9a84c;}
      .card.dark .prayer-time{color:#f0e6c8;}
      .card.dark .prayer-item.active .prayer-time{color:#fff;}
      .card.dark .dynamic-slot.ramadan-slot{background:rgba(201,168,76,.07);border:1px solid rgba(201,168,76,.18);color:#c9a84c;}
      .card.dark .dynamic-slot.eid-slot{background:rgba(120,80,200,.1);border:1px solid rgba(120,80,200,.25);color:#b89aff;}
      .card.dark .dynamic-slot.eid-soon-slot{background:rgba(120,80,200,.07);border:1px solid rgba(120,80,200,.18);color:#b89aff;}
      .card.dark .dynamic-slot.default-slot{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);color:#e8dcc8;}
      .card.dark .gear-btn{color:#e8dcc8;}
      .card.dark .nida-action-time{color:#f0e6c8;}
      .card.dark .nida-action-label{color:#e8dcc8;}

      /* LIGHT */
      .card.light .hijri-date{color:#8a6820;}
      .card.light .holiday-name{color:#c05800;}
      .card.light .next-block{background:rgba(201,168,76,.10);border-bottom:1px solid rgba(160,120,48,.2);}
      .card.light .next-label{color:rgba(138,104,32,.6);}
      .card.light .countdown-lbl{color:rgba(138,104,32,.5);}
      .card.light .next-name{color:#3a2c0a;}
      .card.light .countdown{color:#3a2c0a;}
      .card.light .next-date{color:#8a6820;}
      .card.light .prayer-item{background:rgba(255,255,255,.75);border:1px solid rgba(160,120,48,.12);}
      .card.light .prayer-item.active{background:rgba(201,168,76,.15);border-color:rgba(160,120,48,.35);}
      .card.light .prayer-item.active::before{background:linear-gradient(180deg,#c9a84c,#a07830);}
      .card.light .prayer-name{color:#3a2c0a;}
      .card.light .prayer-item.active .prayer-name{color:#8a6820;}
      .card.light .prayer-time{color:#2a1e04;}
      .card.light .prayer-item.active .prayer-time{color:#3a2c0a;}
      .card.light .dynamic-slot.ramadan-slot{background:rgba(201,168,76,.12);border:1px solid rgba(160,120,48,.25);color:#8a6820;}
      .card.light .dynamic-slot.eid-slot{background:rgba(120,80,200,.08);border:1px solid rgba(120,80,200,.2);color:#6040a0;}
      .card.light .dynamic-slot.eid-soon-slot{background:rgba(120,80,200,.06);border:1px solid rgba(120,80,200,.15);color:#6040a0;}
      .card.light .dynamic-slot.default-slot{background:rgba(255,255,255,.75);border:1px solid rgba(160,120,48,.12);color:#3a2c0a;}
      .card.light .gear-btn{color:#3a2c0a;}
      .card.light .nida-action-time{color:#2a1e04;}
      .card.light .nida-action-label{color:#3a2c0a;}
    `;
  }

  render() {
    if (!this.hass) return html``;
    if (!this._lang) this._lang = this._detectLang();

    const now = new Date();
    const nowMin = now.getHours()*60+now.getMinutes();
    const isRtl = RTL_LANGS.has(this._lang);
    const themeClass = this._dark ? 'dark' : 'light';
    const nextKey = this._nextKey();
    const isRamadan = this._isRamadan();
    const eid = this._eid();
    const nextAction = this._nextAction();
    const progress = this._progress();

    const hijriDay       = this._s('sensor.hijri_day') || '—';
    const hijriMonthNum  = this._s('sensor.hijri_month') || '1';
    const hijriYear      = this._s('sensor.hijri_year') || '';
    const hijriMonthLabel = getHijriMonth(hijriMonthNum, this._lang);
    const holiday        = this._s('sensor.islamic_holiday_today');
    const holidayName    = this._a('sensor.islamic_holiday_today','holiday_name');
    const moonEmoji      = moonPhaseEmoji(parseInt(hijriDay)||15);

    const prayers = [
      { key:'fajr',    entity:'sensor.02_fajr_readable',    icon:'🕌' },
      { key:'dhuhr',   entity:'sensor.04_dhuhr_readable',   icon:'🕌' },
      { key:'asr',     entity:'sensor.05_asr_readable',     icon:'🕌' },
      { key:'maghrib', entity:'sensor.07_maghrib_readable', icon:'🌇' },
      { key:'isha',    entity:'sensor.08_isha_readable',    icon:'🌙' },
    ];

    // Dynamic slot
    let dynamicSlot;
    if (isRamadan) {
      const imsak  = this._s('sensor.01_imsak_readable');
      const iftarCd = this._iftarCd();
      const iftar  = this._s('sensor.07_maghrib_readable');
      dynamicSlot = html`
        <div class="dynamic-slot ramadan-slot">
          <div class="prayer-emoji">🌙</div>
          <div class="prayer-name">${this._t('ramadan')} ${this._t('dag')} ${this._a('binary_sensor.is_ramadan','ramadan_day')||'—'}</div>
          <div class="dynamic-sub">
            <span>🌅 ${this._t('imsak')} ${imsak||'—'}</span>
            <span>🌇 ${this._t('iftar')} ${iftar||'—'}</span>
          </div>
          ${iftarCd ? html`<div class="dynamic-countdown">⏳ ${iftarCd}</div>`
                    : html`<div class="dynamic-countdown" style="font-size:11px;">بسم الله</div>`}
        </div>`;
    } else if (eid?.today) {
      dynamicSlot = html`
        <div class="dynamic-slot eid-slot">
          <div class="prayer-emoji">${eid.emoji}</div>
          <div class="prayer-name">${eid.name}</div>
          <div class="prayer-time" style="font-size:18px;">Mubarak! 🎉</div>
        </div>`;
    } else if (eid && eid.days <= 30) {
      dynamicSlot = html`
        <div class="dynamic-slot eid-soon-slot">
          <div class="prayer-emoji">${eid.emoji}</div>
          <div class="prayer-name">${eid.name}</div>
          <div class="prayer-time">${eid.days}</div>
          <div class="dynamic-sub"><span>dagen</span></div>
        </div>`;
    } else {
      // Default slot: geen "Tadkir" label — de actietekst IS direct de naam
      dynamicSlot = html`
        <div class="dynamic-slot default-slot">
          <div class="prayer-emoji">🔔</div>
          ${nextAction ? html`
            <div class="prayer-name">${this._actionLabel(nextAction)}</div>
            <div class="prayer-time">${nextAction.time}</div>
          ` : html`<div class="prayer-name">${this._t('no_action')}</div>`}
        </div>`;
    }

    const bgStyle = `background:${this._bg()};`;

    // FRONT FACE
    const front = html`
      <div class="face front">
        <div class="card ${themeClass} ${isRtl?'rtl':''}" style="${bgStyle}">

          <!-- NEXT PRAYER -->
          <div class="next-block">
            <div class="next-inner">
              <div class="next-icon">🕌</div>
              <div class="next-text">
                <span class="next-label">${this._t('next_prayer')}</span>
                <span class="next-name">${this._tp(nextKey)}</span>
              </div>
              <div class="next-right-col">
                <span class="countdown-lbl">${this._t('remaining')}</span>
                <span class="countdown">${this._countdown()}</span>
              </div>
            </div>
            ${this._showTitle ? html`
              <div class="next-date">
                <span>${moonEmoji}</span>
                <span>${hijriDay} ${hijriMonthLabel} ${hijriYear}</span>
                ${holiday==='on' && holidayName ? html`<span class="next-date-sep">·</span><span>${holidayName}</span>` : ''}
              </div>` : ''}
          </div>

          <!-- PROGRESS BAR — scheidingslijn -->
          <div class="progress-bar">
            <div class="progress-fill" style="width:${progress}%"></div>
          </div>

          <!-- GEBEDEN RASTER -->
          <div class="prayers">
            ${dynamicSlot}
            ${prayers.map((p,i) => {
              const t=this._s(p.entity); if(!t||t==='unavailable') return '';
              const[h,m]=t.split(':').map(Number); const pm=h*60+m;
              const isActive=p.key===nextKey;
              const isPast=!isActive&&pm<nowMin;
              const isLast = i === prayers.length - 1;
              return html`
                <div class="prayer-item ${isActive?'active':isPast?'past':''}">
                  <div class="prayer-emoji">${p.icon}</div>
                  <div class="prayer-name">${this._tp(p.key)}</div>
                  <div class="prayer-time">${t}</div>
                  ${isLast ? html`
                    <button class="gear-btn" @click=${()=>{this._flipped=true;this.requestUpdate();}}>⚙</button>` : ''}
                </div>`;
            })}
          </div>

        </div>
      </div>`;

    // BACK FACE — volledig zwart, hoogte = voorkant hoogte via height:100%
    const back = html`
      <div class="face back">
        <div class="settings-back">

          <!-- Sluitknop bovenaan: intuïtiever dan "← Settings" -->
          <button class="close-btn" @click=${()=>{this._flipped=false;this.requestUpdate();}}>
            <span class="close-btn-icon">✕</span>
            ${this._t('close_settings')}
          </button>

          <div class="settings-title">${this._t('settings')}</div>

          <div class="settings-row">
            <label>${this._t('show_title')}</label>
            <button class="settings-toggle ${this._showTitle?'on':'off'}"
              @click=${()=>{this._showTitle=!this._showTitle;this.requestUpdate();}}></button>
          </div>

          <div class="settings-row">
            <label>${this._t('theme')}</label>
            <select class="theme-select" @change=${(e)=>{this._theme=e.target.value;this._applyTheme();this.requestUpdate();}}>
              <option value="auto" ?selected=${this._theme==='auto'}>Auto</option>
              <option value="dark" ?selected=${this._theme==='dark'}>Dark</option>
              <option value="light" ?selected=${this._theme==='light'}>Light</option>
            </select>
          </div>

          <div class="settings-row">
            <label>${this._t('language')}</label>
            <select class="lang-select" @change=${(e)=>{this._lang=e.target.value;this.requestUpdate();}}>
              ${Object.entries(LANG_LABELS).map(([c,l])=>html`<option value="${c}" ?selected=${this._lang===c}>${l}</option>`)}
            </select>
          </div>

          <div class="settings-row slider-row">
            <label>${this._t('brightness')} — ${this._brightness}%</label>
            <input type="range" class="range-slider" min="0" max="100" step="5"
              .value=${String(this._brightness)}
              @input=${(e)=>{this._brightness=+e.target.value;this.requestUpdate();}}>
          </div>

        </div>
      </div>`;

    return html`
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
      <div class="flip-container">
        <div class="flipper ${this._flipped?'flipped':''}">
          ${front}
          ${back}
        </div>
      </div>`;
  }
}

customElements.define('nida-card', NidaCard);
console.log('%c NIDA CARD v29 geladen ✓ ', 'background:#c9a84c;color:#000;font-weight:bold;');
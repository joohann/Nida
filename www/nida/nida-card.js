import { LitElement, html, css } from "https://unpkg.com/lit-element@2.4.0/lit-element.js?module";
// NIDA CARD v43 — feat: collapsed state persistent, skip suhoor/tarhim button, settings toggle

// Hijri maandnamen per taal
const HIJRI_MONTHS = {
  ar: ['محرم','صفر','ربيع الأول','ربيع الآخر','جمادى الأولى','جمادى الآخرة','رجب','شعبان','رمضان','شوال','ذو القعدة','ذو الحجة'],
  ur: ['محرم','صفر','ربیع الاول','ربیع الثانی','جمادی الاول','جمادی الثانی','رجب','شعبان','رمضان','شوال','ذوالقعدہ','ذوالحجہ'],
  tr: ['Muharrem','Safer','Rebiülevvel','Rebiülahir','Cemaziyelevvel','Cemaziyelahir','Recep','Şaban','Ramazan','Şevval','Zilkade','Zilhicce'],
  fa: ['محرم','صفر','ربیع‌الاول','ربیع‌الثانی','جمادی‌الاول','جمادی‌الثانی','رجب','شعبان','رمضان','شوال','ذیقعده','ذیحجه'],
  _latin: ['Muḥarram','Ṣafar','Rabīʿ al-Awwal','Rabīʿ al-Ākhir','Jumādā al-Ūlā','Jumādā al-Ākhira','Rajab','Shaʿbān','Ramaḍān','Shawwāl','Dhū al-Qaʿda','Dhū al-Ḥijja'],
};

function getHijriMonth(monthNum, lang) {
  const idx = (parseInt(monthNum) || 1) - 1;
  if (HIJRI_MONTHS[lang]) return HIJRI_MONTHS[lang][idx] || '';
  return HIJRI_MONTHS._latin[idx] || '';
}

const TRANSLATIONS = {
  nl: { next_prayer:'Volgend Gebed', remaining:'Resterend', tadkir:'Tadkir', pre_adhan:'Pre-adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhoor', ramadan:'Ramadan', dag:'Dag', imsak:'Imsak', iftar:'Iftar', settings:'Instellingen', show_title:'Toon datum', language:'Taal', no_action:'Geen actie', theme:'Thema', brightness:'Helderheid', close_settings:'Kaart sluiten', skip_suhoor:'Suhoor overslaan', show_skip_suhoor:'Toon "suhoor overslaan"', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  en: { next_prayer:'Next Prayer', remaining:'Remaining', tadkir:'Tadkir', pre_adhan:'Pre-adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhoor', ramadan:'Ramadan', dag:'Day', imsak:'Imsak', iftar:'Iftar', settings:'Settings', show_title:'Show date', language:'Language', no_action:'No action', theme:'Theme', brightness:'Brightness', close_settings:'Close card', skip_suhoor:'Skip Suhoor', show_skip_suhoor:'Show "skip suhoor"', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  ar: { next_prayer:'الصلاة القادمة', remaining:'المتبقي', tadkir:'تذكير', pre_adhan:'قبل الأذان', adhan:'أذان', tarhim:'ترحيم', suhoor:'سحور', ramadan:'رمضان', dag:'يوم', imsak:'إمساك', iftar:'إفطار', settings:'إعدادات', show_title:'إظهار التاريخ', language:'اللغة', no_action:'لا إجراء', theme:'المظهر', brightness:'السطوع', close_settings:'إغلاق البطاقة', skip_suhoor:'تخطي السحور', show_skip_suhoor:'إظهار "تخطي السحور"', prayers:{ fajr:'الفجر', dhuhr:'الظهر', asr:'العصر', maghrib:'المغرب', isha:'العشاء' } },
  de: { next_prayer:'Nächstes Gebet', remaining:'Verbleibend', tadkir:'Tadkir', pre_adhan:'Vor-Adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhoor', ramadan:'Ramadan', dag:'Tag', imsak:'Imsak', iftar:'Iftar', settings:'Einstellungen', show_title:'Datum anzeigen', language:'Sprache', no_action:'Keine Aktion', theme:'Design', brightness:'Helligkeit', close_settings:'Karte schließen', skip_suhoor:'Suhoor überspringen', show_skip_suhoor:'"Suhoor überspringen" zeigen', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  fr: { next_prayer:'Prochaine Prière', remaining:'Restant', tadkir:'Tadkir', pre_adhan:'Pré-adhan', adhan:'Adhan', tarhim:'Tarhim', suhoor:'Suhour', ramadan:'Ramadan', dag:'Jour', imsak:'Imsak', iftar:'Iftar', settings:'Paramètres', show_title:'Afficher date', language:'Langue', no_action:'Aucune action', theme:'Thème', brightness:'Luminosité', close_settings:'Fermer la carte', skip_suhoor:'Ignorer Suhour', show_skip_suhoor:'Afficher "ignorer suhour"', prayers:{ fajr:'Fajr', dhuhr:'Dhuhr', asr:'Asr', maghrib:'Maghrib', isha:'Isha' } },
  id: { next_prayer:'Sholat Berikutnya', remaining:'Tersisa', tadkir:'Tadkir', pre_adhan:'Pra-adzan', adhan:'Adzan', tarhim:'Tarhim', suhoor:'Sahur', ramadan:'Ramadan', dag:'Hari', imsak:'Imsak', iftar:'Iftar', settings:'Pengaturan', show_title:'Tampilkan tanggal', language:'Bahasa', no_action:'Tidak ada', theme:'Tema', brightness:'Kecerahan', close_settings:'Tutup kartu', skip_suhoor:'Lewati Sahur', show_skip_suhoor:'Tampilkan "lewati sahur"', prayers:{ fajr:'Subuh', dhuhr:'Dzuhur', asr:'Ashar', maghrib:'Maghrib', isha:'Isya' } },
  ms: { next_prayer:'Solat Seterusnya', remaining:'Baki', tadkir:'Tadkir', pre_adhan:'Pra-azan', adhan:'Azan', tarhim:'Tarhim', suhoor:'Sahur', ramadan:'Ramadan', dag:'Hari', imsak:'Imsak', iftar:'Iftar', settings:'Tetapan', show_title:'Tunjuk tarikh', language:'Bahasa', no_action:'Tiada', theme:'Tema', brightness:'Kecerahan', close_settings:'Tutup kad', skip_suhoor:'Langkau Sahur', show_skip_suhoor:'Tunjuk "langkau sahur"', prayers:{ fajr:'Subuh', dhuhr:'Zohor', asr:'Asar', maghrib:'Maghrib', isha:'Isyak' } },
  tr: { next_prayer:'Sonraki Namaz', remaining:'Kalan', tadkir:'Hatırlatma', pre_adhan:'Ezan Öncesi', adhan:'Ezan', tarhim:'Terhim', suhoor:'Sahur', ramadan:'Ramazan', dag:'Gün', imsak:'İmsak', iftar:'İftar', settings:'Ayarlar', show_title:'Tarihi göster', language:'Dil', no_action:'İşlem yok', theme:'Tema', brightness:'Parlaklık', close_settings:'Kartı kapat', skip_suhoor:'Sahuru Atla', show_skip_suhoor:'"Sahuru atla" göster', prayers:{ fajr:'Sabah', dhuhr:'Öğle', asr:'İkindi', maghrib:'Akşam', isha:'Yatsı' } },
  ur: { next_prayer:'اگلی نماز', remaining:'باقی', tadkir:'تذکیر', pre_adhan:'پیشِ اذان', adhan:'اذان', tarhim:'ترحیم', suhoor:'سحری', ramadan:'رمضان', dag:'دن', imsak:'امساک', iftar:'افطار', settings:'ترتیبات', show_title:'تاریخ دکھائیں', language:'زبان', no_action:'کوئی عمل نہیں', theme:'تھیم', brightness:'روشنی', close_settings:'کارڈ بند کریں', skip_suhoor:'سحری چھوڑیں', show_skip_suhoor:'"سحری چھوڑیں" دکھائیں', prayers:{ fajr:'فجر', dhuhr:'ظہر', asr:'عصر', maghrib:'مغرب', isha:'عشاء' } },
  fa: { next_prayer:'نماز بعدی', remaining:'باقی‌مانده', tadkir:'تذکیر', pre_adhan:'پیش از اذان', adhan:'اذان', tarhim:'ترحیم', suhoor:'سحر', ramadan:'رمضان', dag:'روز', imsak:'امساک', iftar:'افطار', settings:'تنظیمات', show_title:'نمایش تاریخ', language:'زبان', no_action:'هیچ عملی', theme:'پوسته', brightness:'روشنایی', close_settings:'بستن کارت', skip_suhoor:'رد کردن سحر', show_skip_suhoor:'نمایش "رد کردن سحر"', prayers:{ fajr:'صبح', dhuhr:'ظهر', asr:'عصر', maghrib:'مغرب', isha:'عشاء' } },
};


const INTRO_TRANSLATIONS = {
  en: {
    step1_title: 'Tap to collapse',
    step1_body:  'Tap the top section to hide prayer times for a compact view.',
    step1_btn:   'Show me ▶',
    step1_skip:  'skip',
    step2_title: 'Settings',
    step2_body:  'Tap the gear icon at the bottom right to adjust language, theme and brightness.',
    step2_btn:   'Got it ✓',
  },
  nl: {
    step1_title: 'Tik om in te klappen',
    step1_body:  'Tik op het bovenste vlak om de gebedstijden te verbergen.',
    step1_btn:   'Laat zien ▶',
    step1_skip:  'overslaan',
    step2_title: 'Instellingen',
    step2_body:  'Tik op het tandwieltje rechtsonder om taal, thema en helderheid aan te passen.',
    step2_btn:   'Begrepen ✓',
  },
  ar: {
    step1_title: 'اضغط للطي',
    step1_body:  'اضغط على الجزء العلوي لإخفاء أوقات الصلاة للحصول على عرض مضغوط.',
    step1_btn:   'أرني ▶',
    step1_skip:  'تخطي',
    step2_title: 'الإعدادات',
    step2_body:  'اضغط على أيقونة الترس في أسفل اليمين لضبط اللغة والمظهر والسطوع.',
    step2_btn:   'فهمت ✓',
  },
  de: {
    step1_title: 'Tippen zum Einklappen',
    step1_body:  'Tippe auf den oberen Bereich, um die Gebetszeiten auszublenden.',
    step1_btn:   'Zeig mir ▶',
    step1_skip:  'überspringen',
    step2_title: 'Einstellungen',
    step2_body:  'Tippe auf das Zahnrad-Symbol unten rechts, um Sprache, Design und Helligkeit anzupassen.',
    step2_btn:   'Verstanden ✓',
  },
  fr: {
    step1_title: 'Appuyez pour réduire',
    step1_body:  'Appuyez sur la section supérieure pour masquer les heures de prière.',
    step1_btn:   'Montrer ▶',
    step1_skip:  'passer',
    step2_title: 'Paramètres',
    step2_body:  "Appuyez sur l'icône d'engrenage en bas à droite pour régler la langue, le thème et la luminosité.",
    step2_btn:   'Compris ✓',
  },
  id: {
    step1_title: 'Ketuk untuk menyembunyikan',
    step1_body:  'Ketuk bagian atas untuk menyembunyikan waktu sholat agar lebih ringkas.',
    step1_btn:   'Tunjukkan ▶',
    step1_skip:  'lewati',
    step2_title: 'Pengaturan',
    step2_body:  'Ketuk ikon roda gigi di kanan bawah untuk mengatur bahasa, tema, dan kecerahan.',
    step2_btn:   'Mengerti ✓',
  },
  ms: {
    step1_title: 'Ketik untuk lipat',
    step1_body:  'Ketik bahagian atas untuk menyembunyikan waktu solat bagi paparan ringkas.',
    step1_btn:   'Tunjuk ▶',
    step1_skip:  'langkau',
    step2_title: 'Tetapan',
    step2_body:  'Ketik ikon gear di kanan bawah untuk melaraskan bahasa, tema dan kecerahan.',
    step2_btn:   'Faham ✓',
  },
  tr: {
    step1_title: 'Katlamak için dokun',
    step1_body:  'Namaz vakitlerini gizlemek için üst bölüme dokun.',
    step1_btn:   'Göster ▶',
    step1_skip:  'atla',
    step2_title: 'Ayarlar',
    step2_body:  'Dil, tema ve parlaklığı ayarlamak için sağ alttaki dişli simgesine dokun.',
    step2_btn:   'Anladım ✓',
  },
  ur: {
    step1_title: 'تہ کرنے کے لیے ٹیپ کریں',
    step1_body:  'نماز کے اوقات چھپانے کے لیے اوپری حصے پر ٹیپ کریں۔',
    step1_btn:   'دکھائیں ▶',
    step1_skip:  'چھوڑیں',
    step2_title: 'ترتیبات',
    step2_body:  'زبان، تھیم اور روشنی ایڈجسٹ کرنے کے لیے نیچے دائیں طرف گیئر آئیکن ٹیپ کریں۔',
    step2_btn:   'سمجھ گیا ✓',
  },
  fa: {
    step1_title: 'برای جمع کردن ضربه بزنید',
    step1_body:  'برای پنهان کردن اوقات نماز، روی بخش بالایی ضربه بزنید.',
    step1_btn:   'نشان بده ▶',
    step1_skip:  'رد شدن',
    step2_title: 'تنظیمات',
    step2_body:  'برای تنظیم زبان، پوسته و روشنایی، روی آیکون چرخ‌دنده در پایین راست ضربه بزنید.',
    step2_btn:   'فهمیدم ✓',
  },
};

function getIntroT(lang, key) {
  return (INTRO_TRANSLATIONS[lang] || INTRO_TRANSLATIONS.en)[key] || INTRO_TRANSLATIONS.en[key] || '';
}

const LANG_LABELS = { nl:'Nederlands', en:'English', ar:'العربية', de:'Deutsch', fr:'Français', id:'Indonesia', ms:'Melayu', tr:'Türkçe', ur:'اردو', fa:'فارسی' };
const RTL_LANGS = new Set(['ar','ur','fa']);
const HA_LANG_MAP = { nl:'nl', en:'en', de:'de', fr:'fr', id:'id', ms:'ms', tr:'tr', ar:'ar' };

function moonPhaseEmoji(day) {
  const d = ((day - 1) % 30);
  if (d < 2) return '🌑'; if (d < 6) return '🌒'; if (d < 9) return '🌓';
  if (d < 13) return '🌔'; if (d < 17) return '🌕'; if (d < 21) return '🌖';
  if (d < 24) return '🌗'; if (d < 28) return '🌘'; return '🌑';
}

// Helperfunctie: geeft een sleutel terug die uniek is per nacht (reset na Maghrib)
// Zodat "suhoor overslaan" alleen die nacht geldt
function _nightKey() {
  const now = new Date();
  // Na middernacht maar voor Fajr valt nog onder "gisternacht" qua suhoor
  // We gebruiken simpelweg de datum van vandaag als de uur >= 12, anders gisteren
  const h = now.getHours();
  const d = new Date(now);
  if (h < 12) d.setDate(d.getDate() - 1);
  return `nida-skip-suhoor-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

class NidaCard extends LitElement {
  static get properties() {
    return {
      hass:{}, _config:{}, _dark:{}, _flipped:{}, _lang:{}, _showTitle:{},
      _brightness:{}, _theme:{},
      _collapsed:{ type: Boolean },
      _introStep:{ type: Number },
      _introDemo:{ type: Boolean },
      _skipSuhoor:{ type: Boolean },
      _showSkipSuhoorBtn:{ type: Boolean },
    };
  }

  setConfig(config) {
    this._config = config;
    this._theme = config.theme || 'auto';
    this._showTitle = config.show_title !== false;
    this._brightness = config.brightness !== undefined ? config.brightness : 50;
    this._lang = config.language || null;
    this._flipped = false;

    // Herstel collapsed state uit localStorage
    const savedCollapsed = localStorage.getItem('nida-collapsed');
    this._collapsed = savedCollapsed === 'true';

    // Herstel skip suhoor (per nacht)
    this._skipSuhoor = localStorage.getItem(_nightKey()) === 'true';

    // Toon/verberg de skip-suhoor knop (instelbaar via settings, standaard aan)
    this._showSkipSuhoorBtn = config.show_skip_suhoor !== false;

    const seen = localStorage.getItem('nida-intro-seen');
    this._introStep = seen ? 0 : 1;
    this._introDemo = false;
  }

  _startIntroDemo() {
    this._introDemo = true;
    this._collapsed = true;
    this.requestUpdate();
    setTimeout(() => {
      this._collapsed = false;
      this.requestUpdate();
      setTimeout(() => {
        this._introDemo = false;
        this.requestUpdate();
      }, 700);
    }, 900);
  }

  _introNext() {
    if (this._introStep === 1) {
      this._introStep = 2;
      this.requestUpdate();
    } else {
      this._introStep = 0;
      localStorage.setItem('nida-intro-seen', '1');
      this.requestUpdate();
    }
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
    return 'en';
  }

  _s(e) { return this.hass?.states[e]?.state; }
  _a(e,a) { return this.hass?.states[e]?.attributes?.[a]; }
  _isRamadan() { return this._s('binary_sensor.is_ramadan') === 'on'; }

  // Toggle collapsed + sla op in localStorage
  _toggleCollapse(e) {
    e.stopPropagation();
    this._collapsed = !this._collapsed;
    localStorage.setItem('nida-collapsed', String(this._collapsed));
    this.requestUpdate();
  }

  // Toggle skip suhoor (voor deze nacht)
  _toggleSkipSuhoor(e) {
    e.stopPropagation();
    this._skipSuhoor = !this._skipSuhoor;
    localStorage.setItem(_nightKey(), String(this._skipSuhoor));
    this.requestUpdate();
  }

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
    const times = [];
    for (const e of ents) {
      const t=this._s(e); if(!t||t==='unavailable') continue;
      const [h,m]=t.split(':').map(Number); times.push(h*60+m);
    }
    if(times.length===0) return 0;
    let prev=null, next=null;
    for(const pm of times) {
      if(pm<=nowMin) prev=pm; else if(next===null){next=pm;break;}
    }
    if(next===null && prev!==null) { next = times[0]+1440; }
    if(prev===null && next!==null) { prev = times[times.length-1]-1440; }
    if(prev===null||next===null) return 0;
    const span = next-prev;
    if(span<=0) return 0;
    return Math.min(100,Math.max(0,Math.round(((nowMin-prev)/span)*100)));
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

    const _fmt = (min) => {
      const m = ((min % 1440) + 1440) % 1440;
      return `${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
    };

    const pmap=[{k:'fajr',e:'sensor.02_fajr_readable'},{k:'dhuhr',e:'sensor.04_dhuhr_readable'},{k:'asr',e:'sensor.05_asr_readable'},{k:'maghrib',e:'sensor.07_maghrib_readable'},{k:'isha',e:'sensor.08_isha_readable'}];
    for(const p of pmap){
      const t=this._s(p.e); if(!t||t==='unavailable') continue;
      const[h,m]=t.split(':').map(Number);
      let pm=h*60+m;
      if(pm<=nowMin) pm+=1440;
      for(const off of[10,5]){
        const r=pm-off;
        if(r>nowMin) acts.push({type:'tadkir',prayerKey:p.k,min:r,time:_fmt(r)});
      }
      acts.push({type:'adhan',prayerKey:p.k,min:pm,time:_fmt(pm)});
    }

    // Suhoor: overgeslagen? Dan niet tonen
    if (!this._skipSuhoor) {
      const imsak=this._s('sensor.01_imsak_readable');
      if(imsak && imsak!=='unavailable'){
        const[ih,im]=imsak.split(':').map(Number);
        let sm=ih*60+im;
        if(sm<=nowMin) sm+=1440;
        acts.push({type:'suhoor',prayerKey:null,min:sm,time:_fmt(sm)});
      }
    }

    // Tarhim: alleen tijdens Ramadan en niet overgeslagen
    if(isRam && !this._skipSuhoor){
      const f=this._s('sensor.02_fajr_readable');
      if(f && f!=='unavailable'){
        const[fh,fm]=f.split(':').map(Number);
        let tm=fh*60+fm-30;
        if(tm<=nowMin) tm+=1440;
        acts.push({type:'tarhim',prayerKey:null,min:tm,time:_fmt(tm)});
      }
    }

    if(!acts.length) return null;
    acts.sort((a,b)=>a.min-b.min);
    return acts[0];
  }

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

      .flip-container{width:100%;perspective:1200px;}
      .flipper{
        position:relative;
        width:100%;
        transform-style:preserve-3d;
        transition:transform 0.6s cubic-bezier(0.4,0.2,0.2,1);
      }
      .flipper.flipped{transform:rotateY(180deg);}

      .face.front{
        position:relative;
        width:100%;
        backface-visibility:hidden;
        -webkit-backface-visibility:hidden;
        border-radius:var(--ha-card-border-radius,12px);
        overflow:hidden;
      }
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
        z-index:10;
      }
      .flipper.flipped .gear-btn{
        visibility:hidden;
        pointer-events:none;
      }

      .card{width:100%;border-radius:var(--ha-card-border-radius,12px);overflow:hidden;transition:background 0.4s;min-height:120px;box-sizing:border-box;}

      .header{padding:0;}
      .header-top{display:none;}
      .hijri-date{font-family:'Amiri',serif;font-size:19px;font-weight:700;line-height:1.2;display:flex;align-items:center;gap:7px;}
      .holiday-name{font-size:11px;font-weight:700;padding:6px 16px 0;}

      .header-block{
        border-radius:12px;
        overflow:hidden;
        margin:8px 8px 8px 8px;
        cursor:pointer;
        user-select:none;
        -webkit-tap-highlight-color:transparent;
        transition:transform 0.1s ease;
      }
      .header-block:active{
        transform:scale(0.995);
      }

      .progress-bar{
        height:10px;
        width:calc(100% - 24px);
        margin:0 12px 4px;
        border-radius:99px;
        overflow:hidden;
        position:relative;
      }
      .progress-fill{
        height:100%;
        border-radius:99px;
        transition:width 1s linear;
        background:linear-gradient(90deg,#c9a84c,#f0d078);
        position:relative;
        overflow:hidden;
        animation:progress-glow 3s ease-in-out infinite;
      }
      .progress-fill::after{
        content:'';
        position:absolute;
        top:0;
        left:-100%;
        width:60%;
        height:100%;
        background:linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent);
        animation:progress-shimmer 3s ease-in-out infinite;
      }

      @keyframes progress-glow{
        0%,100% { box-shadow: 0 0 3px rgba(201,168,76,0.2); }
        50%      { box-shadow: 0 0 8px rgba(201,168,76,0.6); }
      }
      @keyframes progress-shimmer{
        0%   { left:-100%; }
        100% { left:160%; }
      }

      .next-block{
        padding:10px 12px 6px;
        width:100%;
        box-sizing:border-box;
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
      .next-date{
        font-size:10px;font-weight:800;opacity:.55;
        margin-top:6px;
        display:flex;align-items:center;justify-content:center;gap:4px;
        white-space:nowrap;
        width:100%;
      }
      .next-date-sep{opacity:.5;}
      .next-info,.countdown-col,.next-row-top,.next-row-main,.next-right,
      .next-table,.next-row-labels,.next-row-values{display:none;}

      /* ── INKLAPBARE PRAYERS WRAPPER ── */
      .prayers-wrapper{
        display:grid;
        grid-template-rows:1fr;
        transition:grid-template-rows 0.4s cubic-bezier(0.4,0,0.2,1),
                   opacity 0.35s ease,
                   transform 0.35s cubic-bezier(0.4,0,0.2,1);
        opacity:1;
        transform:translateY(0);
        overflow:hidden;
      }
      .prayers-wrapper.collapsed{
        grid-template-rows:0fr;
        opacity:0;
        transform:translateY(-6px);
      }
      .prayers-wrapper-inner{
        min-height:0;
        overflow:hidden;
      }

      .prayers{padding:0 8px 8px;display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:1fr;gap:7px;}

      .dynamic-slot{position:relative;border-radius:10px;padding:9px 11px;display:flex;flex-direction:column;justify-content:center;overflow:hidden;}
      .dynamic-sub{display:flex;flex-direction:column;gap:2px;margin-top:4px;font-size:11px;font-weight:600;opacity:.85;}
      .dynamic-countdown{font-family:'Amiri',serif;font-size:14px;font-weight:700;margin-top:5px;}

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

      .prayer-item{position:relative;padding:9px 11px;border-radius:10px;overflow:hidden;}
      .prayer-item::before{content:'';position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:10px 0 0 10px;}
      .prayer-item.past{opacity:.4;}
      .prayer-name{font-size:11px;font-weight:700;margin-bottom:1px;letter-spacing:0.3px;}
      .prayer-time{font-family:'Amiri',serif;font-size:22px;font-weight:700;}
      .prayer-emoji{position:absolute;right:8px;top:8px;font-size:14px;opacity:.12;}
      .prayer-item.active .prayer-emoji{opacity:.28;}
      .card.light .prayer-emoji{opacity:.25;}
      .card.light .prayer-item.active .prayer-emoji{opacity:.45;}

      .gear-btn{
        position:absolute;
        right:8px;
        bottom:8px;
        background:none;
        border:none;
        cursor:pointer;
        padding:0;
        font-size:24px;
        opacity:.13;
        transition:opacity .2s;
        line-height:1;
        z-index:2;
      }
      .gear-btn:hover{opacity:.45;}
      .face.back .gear-btn{display:none;}

      /* ── SKIP SUHOOR KNOP ── */
      .skip-suhoor-bar{
        padding:0 8px 8px;
      }
      .skip-suhoor-btn{
        width:100%;
        border:none;
        border-radius:10px;
        padding:9px 14px;
        cursor:pointer;
        font-family:'Cairo',sans-serif;
        font-size:11px;
        font-weight:700;
        letter-spacing:0.3px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        transition:opacity 0.2s, transform 0.1s;
        -webkit-tap-highlight-color:transparent;
      }
      .skip-suhoor-btn:active{ transform:scale(0.98); }
      .skip-suhoor-btn.active{
        background:rgba(201,168,76,0.18);
        color:#c9a84c;
        border:1px solid rgba(201,168,76,0.35);
      }
      .skip-suhoor-btn.inactive{
        background:rgba(255,255,255,0.05);
        border:1px solid rgba(255,255,255,0.1);
      }
      .card.light .skip-suhoor-btn.inactive{
        background:rgba(0,0,0,0.04);
        border:1px solid rgba(160,120,48,0.15);
      }
      .card.light .skip-suhoor-btn.active{
        background:rgba(201,168,76,0.12);
        border:1px solid rgba(160,120,48,0.3);
        color:#8a6820;
      }

      /* ── SETTINGS ACHTERKANT ── */
      .settings-back{
        padding:20px 16px 16px;
        display:flex;
        flex-direction:column;
        height:100%;
        background:#000;
        color:#e8dcc8;
      }
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
      .card.dark .header-block{background:rgba(201,168,76,.06);border-bottom:none;}
      .card.dark .progress-bar{background:rgba(201,168,76,.35);}
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
      .card.dark .skip-suhoor-btn.inactive{color:rgba(232,220,200,0.5);}

      /* LIGHT */
      .card.light .hijri-date{color:#8a6820;}
      .card.light .holiday-name{color:#c05800;}
      .card.light .header-block{background:rgba(201,168,76,.10);border-bottom:none;}
      .card.light .progress-bar{background:rgba(160,120,48,.35);}
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
      .card.light .skip-suhoor-btn.inactive{color:rgba(58,44,10,0.4);}

      /* ── INTRO OVERLAY ── */
      .intro-overlay{
        position:absolute;
        inset:0;
        z-index:100;
        border-radius:var(--ha-card-border-radius,12px);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:center;
        padding:18px 20px 16px;
        text-align:center;
        backdrop-filter:blur(3px);
        -webkit-backdrop-filter:blur(3px);
        background:rgba(0,0,0,0.72);
        animation:intro-fade-in 0.4s ease;
        gap:10px;
      }
      @keyframes intro-fade-in{
        from{ opacity:0; transform:scale(0.97); }
        to  { opacity:1; transform:scale(1); }
      }
      .intro-icon{font-size:32px;line-height:1;animation:intro-icon-bounce 0.6s cubic-bezier(0.36,0.07,0.19,0.97) both;}
      @keyframes intro-icon-bounce{
        0%,100%{ transform:translateY(0); }
        30%    { transform:translateY(-8px); }
        60%    { transform:translateY(-3px); }
      }
      .intro-title{font-family:'Cairo',sans-serif;font-size:13px;font-weight:800;color:#f0e6c8;letter-spacing:0.3px;line-height:1.3;}
      .intro-body{font-family:'Cairo',sans-serif;font-size:11px;font-weight:500;color:rgba(240,230,200,0.75);line-height:1.5;max-width:240px;}
      .intro-demo-bar{width:80%;height:7px;border-radius:99px;background:rgba(201,168,76,0.25);overflow:hidden;margin:2px 0;}
      .intro-demo-fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#c9a84c,#f0d078);width:60%;}
      .intro-demo-rows{display:flex;flex-direction:column;gap:3px;width:80%;overflow:hidden;transition:max-height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.4s ease;max-height:60px;opacity:1;}
      .intro-demo-rows.collapsed{max-height:0;opacity:0;}
      .intro-demo-row{height:8px;border-radius:6px;background:rgba(240,230,200,0.15);}
      .intro-step-dots{display:flex;gap:5px;margin-top:2px;}
      .intro-dot{width:6px;height:6px;border-radius:50%;background:rgba(201,168,76,0.3);transition:background 0.2s;}
      .intro-dot.active{background:#c9a84c;}
      .intro-btn{background:linear-gradient(135deg,#c9a84c,#a07830);border:none;border-radius:8px;color:#1a1200;font-family:'Cairo',sans-serif;font-size:12px;font-weight:800;padding:7px 20px;cursor:pointer;letter-spacing:0.3px;transition:opacity 0.2s;margin-top:2px;}
      .intro-btn:hover{opacity:0.85;}
      .intro-skip{font-size:10px;color:rgba(240,230,200,0.35);cursor:pointer;text-decoration:underline;background:none;border:none;font-family:'Cairo',sans-serif;padding:0;}
      .intro-skip:hover{color:rgba(240,230,200,0.6);}
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
      dynamicSlot = html`
        <div class="dynamic-slot default-slot">
          <div class="prayer-emoji">🔔</div>
          ${nextAction ? html`
            <div class="prayer-name">${this._actionLabel(nextAction)}</div>
            <div class="prayer-time">${nextAction.time}</div>
          ` : html`<div class="prayer-name">${this._t('no_action')}</div>`}
        </div>`;
    }

    // Skip suhoor knop — alleen tonen als showSkipSuhoorBtn aan staat
    // en wanneer suhoor relevant is (Ramadan of als imsak sensor beschikbaar is)
    const imsakAvail = this._s('sensor.01_imsak_readable') && this._s('sensor.01_imsak_readable') !== 'unavailable';
    const showSkipBtn = this._showSkipSuhoorBtn && (isRamadan || imsakAvail);

    const skipSuhoorBar = showSkipBtn ? html`
      <div class="skip-suhoor-bar">
        <button
          class="skip-suhoor-btn ${this._skipSuhoor ? 'active' : 'inactive'}"
          @click=${this._toggleSkipSuhoor}>
          ${this._skipSuhoor ? '✓' : '😴'}
          ${this._t('skip_suhoor')}
          ${this._skipSuhoor ? html`<span style="opacity:.5;font-size:10px;">— ${this._t('tarhim')} &amp; ${this._t('suhoor')}</span>` : ''}
        </button>
      </div>` : '';

    const bgStyle = `background:${this._bg()};`;

    // FRONT FACE
    const front = html`
      <div class="face front">
        <div class="card ${themeClass} ${isRtl?'rtl':''}${this._collapsed?' collapsed':''}" style="${bgStyle}">

          <div class="header-block" @click=${this._toggleCollapse}>
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
            <div class="progress-bar">
              <div class="progress-fill" style="width:${progress}%"></div>
            </div>
          </div>

          <div class="prayers-wrapper${this._collapsed?' collapsed':''}">
            <div class="prayers-wrapper-inner">
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
                        <button class="gear-btn" @click=${(e)=>{e.stopPropagation();this._flipped=true;this.requestUpdate();}}>⚙</button>` : ''}
                    </div>`;
                })}
              </div>

              <!-- SKIP SUHOOR KNOP -->
              ${skipSuhoorBar}

            </div>
          </div>

        </div>
      </div>`;

    // BACK FACE
    const back = html`
      <div class="face back">
        <div class="settings-back">
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
            <label>${this._t('show_skip_suhoor')}</label>
            <button class="settings-toggle ${this._showSkipSuhoorBtn?'on':'off'}"
              @click=${()=>{this._showSkipSuhoorBtn=!this._showSkipSuhoorBtn;this.requestUpdate();}}></button>
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

    // INTRO OVERLAY
    const introOverlay = this._introStep > 0 ? html`
      <div class="intro-overlay">
        ${this._introStep === 1 ? html`
          <div class="intro-icon">👆</div>
          <div class="intro-title">${getIntroT(this._lang,'step1_title')}</div>
          <div class="intro-body">${getIntroT(this._lang,'step1_body')}</div>
          <div class="intro-demo-bar"><div class="intro-demo-fill"></div></div>
          <div class="intro-demo-rows ${this._introDemo?'collapsed':''}">
            <div class="intro-demo-row"></div>
            <div class="intro-demo-row" style="width:85%"></div>
            <div class="intro-demo-row" style="width:70%"></div>
          </div>
          <div class="intro-step-dots">
            <div class="intro-dot active"></div>
            <div class="intro-dot"></div>
          </div>
          <button class="intro-btn" @click=${()=>{ this._startIntroDemo(); setTimeout(()=>this._introNext(), 1800); }}>${getIntroT(this._lang,'step1_btn')}</button>
          <button class="intro-skip" @click=${()=>{ this._introStep=0; localStorage.setItem('nida-intro-seen','1'); this.requestUpdate(); }}>${getIntroT(this._lang,'step1_skip')}</button>
        ` : html`
          <div class="intro-icon">⚙️</div>
          <div class="intro-title">${getIntroT(this._lang,'step2_title')}</div>
          <div class="intro-body">${getIntroT(this._lang,'step2_body')}</div>
          <div class="intro-step-dots">
            <div class="intro-dot"></div>
            <div class="intro-dot active"></div>
          </div>
          <button class="intro-btn" @click=${()=>this._introNext()}>${getIntroT(this._lang,'step2_btn')}</button>
        `}
      </div>` : '';

    return html`
      <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@300;400;600;700;800&display=swap" rel="stylesheet">
      <div class="flip-container" style="position:relative;">
        <div class="flipper ${this._flipped?'flipped':''}">
          ${front}
          ${back}
        </div>
        ${introOverlay}
      </div>`;
  }
}

customElements.define('nida-card', NidaCard);
console.log('%c NIDA CARD v43 geladen ✓ ', 'background:#c9a84c;color:#000;font-weight:bold;');
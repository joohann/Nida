<div align="center">

<img src="https://raw.githubusercontent.com/joohann/Nida/main/custom_components/nida/brand/icon.png" width="120" alt="Nida icon">

# Nida — نداء

**مواقيت الصلاة والأذان والتذكيرات الإسلامية لـ Home Assistant.**

[![Marketplace](https://img.shields.io/badge/Home%20Assistant-Marketplace-41BDF5.svg)](https://www.hacs.xyz/docs/marketplace/)
[![Release](https://img.shields.io/github/v/release/joohann/Nida)](https://github.com/joohann/Nida/releases)
[![Hassfest](https://github.com/joohann/Nida/actions/workflows/hassfest.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/hassfest.yml)
[![Validate](https://github.com/joohann/Nida/actions/workflows/validate.yml/badge.svg)](https://github.com/joohann/Nida/actions/workflows/validate.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[English](README.md) · [Nederlands](README.nl.md) · [العربية](README.ar.md) · [Bahasa Indonesia](README.id.md)

</div>

<div dir="rtl" align="right">

*نداء* تعني "الدعوة". يجلب هذا التكامل مواقيت الصلاة من
[AlAdhan API](https://aladhan.com/prayer-times-api) المجاني (دون حساب أو مفتاح API)،
ويشغّل الأذان على مكبرات الصوت لديك في الوقت المناسب، وينبّهك قبله بقليل،
ويوفّر لك لوحة إعدادات وبطاقات لوحة تحكم تتناسب مع سمتك.

## الميزات

| | |
|---|---|
| **مواقيت الصلاة** | الإمساك، الفجر، الشروق، الظهر، العصر، الغروب، المغرب، العشاء ومنتصف الليل، مع أكثر من 15 طريقة حساب |
| **الأذان** | تفعيل/إيقاف لكل صلاة، صوت ومستوى صوت خاصان، على مشغّل وسائط واحد أو أكثر |
| **ما قبل الأذان** | نغمة وإعلان صوتي (TTS) قبل الصلاة، مع مستوى صوت خاص بالفجر |
| **الوضع الليلي** | يخفّض صوت الأذان والنغمة والإعلان بين ساعات تحددها |
| **مستوى الصوت عند فتح المستشعر** | صوت أخفض عند فتح مستشعر نافذة أو باب |
| **ملائم للموسيقى** | يخفّض موسيقاك أو يوقفها مؤقتاً، ثم يعيدها تدريجياً ويستأنف التشغيل بعد ذلك؛ إعلانات Sonos مدعومة |
| **رمضان** | تذكيرات السحور والإفطار، دعاء الإفطار، التسبيح (Tarhim)، منبّه الفجر مع مشهد |
| **الإشعارات** | إشعار لكل صلاة، تذكير الجمعة، أحداث التقويم الهجري، عدّ تنازلي عبر iOS Live Activity |
| **الأدعية** | شغّل دعاءً عند محفّز من اختيارك، أو من كيان زر |
| **مكتبة الأصوات** | بعض الأصوات مرفقة مع Nida والباقي يُنزَّل عند الطلب من كتالوج |
| **بطاقات لوحة التحكم** | بطاقتا الصلاة القادمة واليوم مع عدّ تنازلي مباشر، فاتحة وداكنة |
| **10 لغات** | الإنجليزية، الهولندية، العربية، التركية، الألمانية، الفرنسية، الملايوية، الإندونيسية، الأردية، الفارسية |

## التثبيت

### Marketplace

يجري تقديم Nida إلى Home Assistant Marketplace (HACS، مدمج بدءاً من
Home Assistant 2026.11). بمجرد إدراجه:

1. افتح **Marketplace** في Home Assistant وابحث عن **Nida**.
2. نزّله ثم أعد تشغيل Home Assistant.

إلى ذلك الحين، أو على إصدار أقدم من Home Assistant مع HACS، أضفه كمستودع
مخصص: **HACS ← ⋮ ← المستودعات المخصصة**، الرابط
`https://github.com/joohann/Nida`، الفئة **Integration**.

### يدوياً

انسخ `custom_components/nida` إلى مجلد `config/custom_components/` في
Home Assistant ثم أعد التشغيل.

## الإعداد

1. انتقل إلى **الإعدادات ← الأجهزة والخدمات ← إضافة تكامل ← Nida**.
2. أكّد. تُضاف Nida بنقرة واحدة.
3. افتح **Nida** من الشريط الجانبي. جميع الإعدادات الأخرى في هذه اللوحة:
   الصلوات، الأصوات، مكبرات الصوت، ما قبل الأذان، الوضع الليلي، الإشعارات، رمضان
   وغير ذلك.

لا حاجة إلى YAML. تُحفظ الإعدادات في خيارات التكامل.

## الكيانات

| الكيان | الوصف |
|---|---|
| `sensor.nida_fajr`, `…_dhuhr`, `…_asr`, `…_maghrib`, `…_isha`, `…_sunrise`, … | وقت كل صلاة (timestamp) |
| `sensor.nida_imsak` | الإمساك |
| `sensor.nida_next_prayer` | الصلاة القادمة ووقتها |
| `sensor.nida_hijri_*` | التاريخ الهجري واليوم والشهر والسنة |
| `binary_sensor.nida_<prayer>_active` | يعمل ما دمت داخل نافذة تلك الصلاة |
| `switch.nida_<prayer>_adhan` | تفعيل الأذان لصلاة واحدة أو إيقافه |
| `button.nida_dua_*` | تشغيل دعاء |

تعتمد معرّفات الكيانات الدقيقة على اسم جهازك؛ راجع **الإعدادات ← الأجهزة والخدمات ← Nida**.

## بطاقات لوحة التحكم

تُسجَّل البطاقات تلقائياً؛ لا حاجة لإضافة شيء ضمن الموارد.
اختر **Nida** من منتقي البطاقات، أو استخدم YAML:

</div>

```yaml
type: custom:nida-card
card_type: now        # now, today, kids, scene_now, scene_today
```

<div dir="rtl" align="right">

| الخيار | الوصف |
|---|---|
| `card_type` | `now` (الصلاة القادمة)، `today` (كل الصلوات)، `kids`، `scene_now`، `scene_today` |
| `collapsed` | بطاقة `today` فقط: تبدأ مطوية إلى الصلاة القادمة |
| `grid_options.rows` | في عرض Sections تملأ البطاقة الارتفاع المحدد |

## المتطلبات

- Home Assistant 2024.11 أو أحدث
- كيان `media_player` واحد أو أكثر للأذان
- تكامل TTS إذا أردت الإعلان الصوتي
- تطبيق Home Assistant Companion للإشعارات وLive Activity

## التوثيق والدعم

- [سجل التغييرات](CHANGELOG.md)
- [Issues](https://github.com/joohann/Nida/issues): الأخطاء وطلبات الميزات
- بيانات الصلاة من [AlAdhan](https://aladhan.com)

طلبات السحب (Pull requests) مرحّب بها، بما فيها الأصوات والترجمات الجديدة.

</div>

---

<div align="center">

*بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ*
صُنع بعناية من أجل المجتمع المسلم.

</div>

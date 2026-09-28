# مستيكا — Misteka Cakes

موقع طلب تورت عربي، ثابت على GitHub Pages، مع طبقة بيانات جاهزة لـ Supabase.

## التشغيل

```bash
npm install
npm run dev
```

البناء:

```bash
npm run build
npm run preview
```

## البيانات المحلية وSupabase

الأسعار الأساسية مأخوذة من `reference/basic-prices-1.jpeg` و`reference/basic-prices-2.jpeg`.

بدون إعداد Supabase يعمل الموقع بالبيانات المحلية، والطلب يُحفظ في المتصفح فقط.

عند ضبط المتغيرات العامة يصبح Supabase مصدر الحقيقة للكتالوج والطلبات والتوفر:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

انسخي `.env.example` إلى `.env.local`.

لا تضعي مفتاح `service_role` في أي متغير يبدأ بـ `VITE_`.

نفّذي SQL الموجود في `supabase/schema.sql` داخل مشروع Supabase (جداول الكتالوج، الطلبات، RLS، التخزين، والبذرة).

## التوفر وحجز الموعد

التحقق من الموعد في الواجهة استرشادي فقط ولا يحجز الموعد.
عند الحفظ يعتمد المشروع على فهرس فريد للموعد النشط في قاعدة البيانات.
إذا سبق طلب آخر لنفس اليوم والساعة يُرفض الحفظ ويُطلب اختيار وقت آخر.
التأكيد النهائي للموعد يبقى بعد مراجعة النشاط.

## الصور المرجعية

Bucket خاص: `order-references` (غير عام).
العميل يرفع الصورة بعد إنشاء الطلب تحت مجلد رقم الطلب، ولا يملك صلاحية قراءة الصور من التخزين.
المعاينة في المتصفح تبقى من ملف الجلسة فقط.

## GitHub Pages

المسارات تستخدم HashRouter والأصول نسبية (`base: './'`).

في إعدادات المستودع أضيفي Secrets:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

سير العمل في `.github/workflows/pages.yml` يمرّرهما أثناء `npm run build`.

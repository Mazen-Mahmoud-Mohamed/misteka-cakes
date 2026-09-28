# مستيكا — Misteka Cakes

موقع طلب تورت عربي، نسخة أولى ثابتة يمكن نشرها على GitHub Pages.

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

## البيانات

الأسعار الأساسية مأخوذة من ملفات `reference/basic-prices-1.jpeg` و`reference/basic-prices-2.jpeg`.
صور التورت في الكتالوج من مجلد `examples`.
إذا لم تُضبط متغيرات Supabase، يعمل الموقع ببيانات محلية، والطلب يُحفظ في المتصفح فقط ولا يُرسل إلى النشاط.

انسخ `.env.example` إلى `.env.local` عند الربط:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

لا تضعي مفتاح `service_role` في أي متغير يبدأ بـ `VITE_`.

جدول الطلبات المقترح في `supabase/schema.sql`.

## GitHub Pages

المسارات تستخدم HashRouter والأصول نسبية (`base: './'`)، لذلك يعمل الموقع من مجلد المشروع على GitHub Pages.
سير العمل في `.github/workflows/pages.yml` يبني `dist` وينشره. فعّلي GitHub Pages من مصدر GitHub Actions في إعدادات المستودع.

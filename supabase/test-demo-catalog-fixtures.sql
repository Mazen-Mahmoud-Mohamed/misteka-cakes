-- TEST/DEMO catalog fixtures for ordering-model QA.
-- Safe to re-run (upsert by fixed ids). Does NOT touch cakes, historical orders,
-- or existing production products (e.g. product-x0u574).

-- Reusable TEST flavor option
insert into public.option_definitions (id, name, description, selection_type, sort_order, enabled)
values (
  'opt-test-demo-flavor',
  'TEST DEMO — النكهة',
  'خيار نكهة مؤقت للاختبار — احذفيه من لوحة التحكم لاحقًا',
  'single',
  900,
  true
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  selection_type = excluded.selection_type,
  enabled = excluded.enabled,
  updated_at = now();

insert into public.option_definition_values (id, definition_id, name, price_adjustment, sort_order, enabled)
values
  ('opt-test-demo-flavor-choc', 'opt-test-demo-flavor', 'شوكولاتة', 0, 1, true),
  ('opt-test-demo-flavor-van', 'opt-test-demo-flavor', 'فانيليا', 0, 2, true),
  ('opt-test-demo-flavor-rv', 'opt-test-demo-flavor', 'ريد فلفيت', 15, 3, true)
on conflict (id) do update set
  name = excluded.name,
  price_adjustment = excluded.price_adjustment,
  enabled = excluded.enabled;

-- Ensure sugar-paste exists (also seeded by migration)
insert into public.option_definitions (id, name, description, selection_type, sort_order, enabled)
values (
  'opt-sugar-paste',
  'عجينة سكر للتزيين',
  'إضافة عجينة سكر اختيارية للتزيين',
  'toggle',
  10,
  true
)
on conflict (id) do nothing;

insert into public.option_definition_values (id, definition_id, name, price_adjustment, sort_order, enabled)
values ('opt-sugar-paste-yes', 'opt-sugar-paste', 'نعم', 50, 1, true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEST DEMO products (separate ids — never overwrite real catalog rows)
-- ---------------------------------------------------------------------------

insert into public.products (
  id, name, description, category_id, ordering_model, pricing_mode,
  fixed_price, price_note, legacy_cake_id, qty_min, qty_max, qty_step,
  image_key, image_alt, sort_order, enabled
) values
(
  'test-demo-cupcake-pkg',
  'TEST DEMO — كب كيك شوكولاتة (باكدجات)',
  'منتج اختبار مؤقت — باكدجات 6/12/24. احذفيه من لوحة التحكم لاحقًا.',
  'cupcake-chocolate', 'quantity', 'fixed',
  null, 'أسعار تجريبية للاختبار فقط', null, 1, 99, 1,
  '', 'TEST DEMO cupcake', 900, true
),
(
  'test-demo-donut-pkg',
  'TEST DEMO — دوناتس (باكدجات)',
  'منتج اختبار مؤقت — باكدجات 6/12/24.',
  'donut-dark-chocolate', 'quantity', 'fixed',
  null, 'أسعار تجريبية', null, 1, 99, 1,
  '', 'TEST DEMO donuts', 910, true
),
(
  'test-demo-cakepop-pkg',
  'TEST DEMO — كيك بوبس (باكدجات)',
  'منتج اختبار مؤقت — باكدجات 6/12/24.',
  'cakepop-chocolate', 'quantity', 'fixed',
  null, 'أسعار تجريبية', null, 1, 99, 1,
  '', 'TEST DEMO cake pops', 920, true
),
(
  'test-demo-cookies-weight',
  'TEST DEMO — كوكيز (بالوزن)',
  'منتج اختبار مؤقت — شرائح وزن 500ج / 1كجم / 2كجم.',
  'cookie-american', 'weight', 'fixed',
  null, 'أسعار تجريبية بالوزن', null, null, null, null,
  '', 'TEST DEMO cookies weight', 930, true
),
(
  'test-demo-cookies-qty',
  'TEST DEMO — كوكيز (كمية حرّة)',
  'منتج اختبار مؤقت — كمية بحد أدنى/أقصى + سعر قطعة.',
  'cookie-american', 'quantity', 'fixed',
  18, '18 ج للقطعة — تجريبي', null, 6, 48, 6,
  '', 'TEST DEMO cookies qty', 940, true
),
(
  'test-demo-fixed',
  'TEST DEMO — منتج بسعر ثابت',
  'منتج اختبار مؤقت — سعر ثابت للقطعة.',
  'cupcake-vanilla', 'fixed_item', 'fixed',
  95, 'سعر ثابت تجريبي', null, null, null, null,
  '', 'TEST DEMO fixed', 950, true
),
(
  'test-demo-quote',
  'TEST DEMO — اطلب السعر',
  'منتج اختبار مؤقت — بدون دفع؛ تواصل واتساب فقط.',
  'celebration', 'quote', 'quote',
  null, 'يُحدَّد السعر بعد التواصل', null, null, null, null,
  '', 'TEST DEMO quote', 960, true
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category_id = excluded.category_id,
  ordering_model = excluded.ordering_model,
  fixed_price = excluded.fixed_price,
  price_note = excluded.price_note,
  qty_min = excluded.qty_min,
  qty_max = excluded.qty_max,
  qty_step = excluded.qty_step,
  image_alt = excluded.image_alt,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled,
  updated_at = now();

-- Package tiers: cupcakes / donuts / cake pops
insert into public.product_price_tiers (
  id, product_id, tier_kind, label, package_qty, qty_min, qty_max, weight_grams, price, sort_order, enabled
) values
  ('test-demo-cupcake-6', 'test-demo-cupcake-pkg', 'package', '6 قطع', 6, null, null, null, 180, 10, true),
  ('test-demo-cupcake-12', 'test-demo-cupcake-pkg', 'package', '12 قطعة', 12, null, null, null, 330, 20, true),
  ('test-demo-cupcake-24', 'test-demo-cupcake-pkg', 'package', '24 قطعة', 24, null, null, null, 600, 30, true),
  ('test-demo-donut-6', 'test-demo-donut-pkg', 'package', '6 قطع', 6, null, null, null, 160, 10, true),
  ('test-demo-donut-12', 'test-demo-donut-pkg', 'package', '12 قطعة', 12, null, null, null, 300, 20, true),
  ('test-demo-donut-24', 'test-demo-donut-pkg', 'package', '24 قطعة', 24, null, null, null, 560, 30, true),
  ('test-demo-cakepop-6', 'test-demo-cakepop-pkg', 'package', '6 قطع', 6, null, null, null, 140, 10, true),
  ('test-demo-cakepop-12', 'test-demo-cakepop-pkg', 'package', '12 قطعة', 12, null, null, null, 260, 20, true),
  ('test-demo-cakepop-24', 'test-demo-cakepop-pkg', 'package', '24 قطعة', 24, null, null, null, 480, 30, true),
  -- Weight cookies
  ('test-demo-cookie-w500', 'test-demo-cookies-weight', 'weight', '500 جرام', null, null, null, 500, 120, 10, true),
  ('test-demo-cookie-w1000', 'test-demo-cookies-weight', 'weight', '1 كجم', null, null, null, 1000, 220, 20, true),
  ('test-demo-cookie-w2000', 'test-demo-cookies-weight', 'weight', '2 كجم', null, null, null, 2000, 400, 30, true),
  -- Quantity ranges for free-qty cookies (optional tiers)
  ('test-demo-cookie-r1', 'test-demo-cookies-qty', 'quantity_range', '6–11 قطعة', null, 6, 11, null, 18, 10, true),
  ('test-demo-cookie-r2', 'test-demo-cookies-qty', 'quantity_range', '12–23 قطعة', null, 12, 23, null, 16, 20, true),
  ('test-demo-cookie-r3', 'test-demo-cookies-qty', 'quantity_range', '24–48 قطعة', null, 24, 48, null, 14, 30, true)
on conflict (id) do update set
  label = excluded.label,
  package_qty = excluded.package_qty,
  qty_min = excluded.qty_min,
  qty_max = excluded.qty_max,
  weight_grams = excluded.weight_grams,
  price = excluded.price,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;

-- Link options to package products
insert into public.product_option_links (id, product_id, definition_id, required, sort_order, enabled)
values
  ('plink-test-cupcake-flavor', 'test-demo-cupcake-pkg', 'opt-test-demo-flavor', true, 10, true),
  ('plink-test-cupcake-sugar', 'test-demo-cupcake-pkg', 'opt-sugar-paste', false, 20, true),
  ('plink-test-donut-flavor', 'test-demo-donut-pkg', 'opt-test-demo-flavor', true, 10, true),
  ('plink-test-cakepop-flavor', 'test-demo-cakepop-pkg', 'opt-test-demo-flavor', true, 10, true),
  ('plink-test-cakepop-sugar', 'test-demo-cakepop-pkg', 'opt-sugar-paste', false, 20, true),
  ('plink-test-fixed-sugar', 'test-demo-fixed', 'opt-sugar-paste', false, 10, true)
on conflict (id) do update set
  required = excluded.required,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;

-- TEST DEMO offer: fixed product full price + cupcake package percent off + customer_picks from donuts category
insert into public.offers (
  id, name, description, image_key, image_alt, badge_label,
  pricing_rule, custom_bundle_price, starts_at, ends_at, sort_order, enabled
) values (
  'test-demo-offer-mix',
  'TEST DEMO — باقة مختلطة',
  'عرض اختبار مؤقت: منتج ثابت بسعر كامل + كب كيك بخصم 20٪ + اختيار دوناتس من التصنيف. احذفيه لاحقًا.',
  '', 'TEST DEMO offer', 'TEST DEMO',
  'components', null, null, null, 900, true
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  badge_label = excluded.badge_label,
  pricing_rule = excluded.pricing_rule,
  enabled = excluded.enabled,
  updated_at = now();

insert into public.offer_components (
  id, offer_id, product_id, category_id, quantity, role_label,
  component_pricing, discount_percent, discount_amount, customer_picks, sort_order
) values
(
  'test-demo-oc-fixed', 'test-demo-offer-mix', 'test-demo-fixed', null, 1, 'منتج ثابت',
  'full_price', null, null, false, 10
),
(
  'test-demo-oc-cupcake', 'test-demo-offer-mix', 'test-demo-cupcake-pkg', null, 1, 'كب كيك باكدج',
  'percent_off', 20, null, false, 20
),
(
  'test-demo-oc-donut-pick', 'test-demo-offer-mix', null, 'cat-donuts', 1, 'اختاري دوناتس',
  'full_price', null, null, true, 30
)
on conflict (id) do update set
  product_id = excluded.product_id,
  category_id = excluded.category_id,
  quantity = excluded.quantity,
  role_label = excluded.role_label,
  component_pricing = excluded.component_pricing,
  discount_percent = excluded.discount_percent,
  customer_picks = excluded.customer_picks,
  sort_order = excluded.sort_order;

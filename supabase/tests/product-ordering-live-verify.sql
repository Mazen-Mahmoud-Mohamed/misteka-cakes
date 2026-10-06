-- Non-order verification for TEST/DEMO fixtures + cake regression.
-- Does NOT call place_order. Does NOT insert orders.
-- Returns a single JSON report row.

select jsonb_build_object(
  'counts', jsonb_build_object(
    'cakes', (select count(*) from public.cakes),
    'cake_products', (select count(*) from public.products where legacy_cake_id is not null),
    'all_products', (select count(*) from public.products),
    'test_products', (select count(*) from public.products where id like 'test-demo-%'),
    'real_cupcake_untouched', (select jsonb_build_object(
      'id', id, 'name', name, 'ordering_model', ordering_model, 'fixed_price', fixed_price
    ) from public.products where id = 'product-x0u574'),
    'orders', (select count(*) from public.orders),
    'orders_product', (select count(*) from public.orders where order_kind = 'product'),
    'tiers', (select count(*) from public.product_price_tiers where id like 'test-demo-%'),
    'option_defs', (select count(*) from public.option_definitions where id like 'opt-test-demo-%' or id = 'opt-sugar-paste'),
    'links', (select count(*) from public.product_option_links where id like 'plink-test-%'),
    'offers', (select count(*) from public.offers where id like 'test-demo-%')
  ),
  'cake_resolve', (
    select jsonb_build_object(
      'ok', r.ok, 'code', r.code, 'unit_price', r.unit_price, 'ordering_model', r.ordering_model, 'size_label', r.size_label
    )
    from public.order_resolve_configured_price(
      (select id from public.products where legacy_cake_id is not null and enabled limit 1),
      (select id from public.cake_sizes where enabled order by sort_order limit 1),
      null,
      1
    ) r
  ),
  'cupcake_pkg_12', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'unit_price', r.unit_price, 'line_qty', r.line_qty, 'tier_label', r.tier_label)
    from public.order_resolve_configured_price('test-demo-cupcake-pkg', null, 'test-demo-cupcake-12', 1) r
  ),
  'donut_pkg_6', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'unit_price', r.unit_price, 'line_qty', r.line_qty)
    from public.order_resolve_configured_price('test-demo-donut-pkg', null, 'test-demo-donut-6', 1) r
  ),
  'cakepop_pkg_24', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'unit_price', r.unit_price, 'line_qty', r.line_qty)
    from public.order_resolve_configured_price('test-demo-cakepop-pkg', null, 'test-demo-cakepop-24', 1) r
  ),
  'cookie_weight_1kg', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'unit_price', r.unit_price, 'tier_label', r.tier_label)
    from public.order_resolve_configured_price('test-demo-cookies-weight', null, 'test-demo-cookie-w1000', 1) r
  ),
  'cookie_qty_12', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'unit_price', r.unit_price, 'line_qty', r.line_qty)
    from public.order_resolve_configured_price('test-demo-cookies-qty', null, 'test-demo-cookie-r2', 12) r
  ),
  'fixed_item', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'unit_price', r.unit_price)
    from public.order_resolve_configured_price('test-demo-fixed', null, null, 1) r
  ),
  'quote_blocked', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'message', r.message)
    from public.order_resolve_configured_price('test-demo-quote', null, null, 1) r
  ),
  'fake_tier_other_product', (
    select jsonb_build_object('ok', r.ok, 'code', r.code)
    from public.order_resolve_configured_price('test-demo-cupcake-pkg', null, 'test-demo-donut-12', 1) r
  ),
  'invalid_tier_id', (
    select jsonb_build_object('ok', r.ok, 'code', r.code)
    from public.order_resolve_configured_price('test-demo-cupcake-pkg', null, 'does-not-exist', 1) r
  ),
  'qty_below_min', (
    select jsonb_build_object('ok', r.ok, 'code', r.code)
    from public.order_resolve_configured_price('test-demo-cookies-qty', null, null, 2) r
  ),
  'options_required_missing', (
    select jsonb_build_object('ok', r.ok, 'code', r.code, 'message', r.message)
    from public.order_resolve_option_lines('test-demo-cupcake-pkg', array[]::text[]) r
  ),
  'options_ok_with_sugar', (
    select jsonb_build_object('ok', r.ok, 'options_total', r.options_total, 'lines', r.lines)
    from public.order_resolve_option_lines(
      'test-demo-cupcake-pkg',
      array['opt-test-demo-flavor-choc', 'opt-sugar-paste-yes']::text[]
    ) r
  ),
  'foreign_option_rejected', (
    select jsonb_build_object('ok', r.ok, 'code', r.code)
    from public.order_resolve_option_lines('test-demo-fixed', array['opt-test-demo-flavor-choc']::text[]) r
  ),
  'pricing_page_rows', (
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'model', p.ordering_model,
      'tiers', (select count(*) from public.product_price_tiers t where t.product_id = p.id and t.enabled)
    ) order by p.sort_order)
    from public.products p
    where p.enabled and p.id like 'test-demo-%'
  ),
  'cake_sizes_unchanged_sample', (
    select jsonb_agg(jsonb_build_object('id', id, 'label', label, 'price', price) order by sort_order)
    from (
      select id, label, price, sort_order from public.cake_sizes where enabled order by sort_order limit 3
    ) s
  ),
  'security', jsonb_build_object(
    'anon_resolve', has_function_privilege('anon', 'public.order_resolve_configured_price(text,text,text,integer)', 'EXECUTE'),
    'anon_options', has_function_privilege('anon', 'public.order_resolve_option_lines(text,text[])', 'EXECUTE'),
    'anon_place', has_function_privilege('anon', 'public.place_order(jsonb)', 'EXECUTE'),
    'rls_tiers', (select relrowsecurity from pg_class where oid = 'public.product_price_tiers'::regclass),
    'rls_links', (select relrowsecurity from pg_class where oid = 'public.product_option_links'::regclass)
  )
) as report;

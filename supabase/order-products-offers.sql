-- Misteka Cakes — Server-authoritative product / offer ordering
-- Apply AFTER: products-system.sql (and existing place_order / advisor-hardening.sql)
-- Safe to re-run.
--
-- Goals:
--   • Keep legacy cake place_order behavior byte-compatible for cake payloads
--   • Accept product / offer orders by ID selections only (never trust client prices)
--   • Snapshot line items in order_items + price_lines for historical integrity
--   • RLS: no direct public writes; SECURITY DEFINER RPCs only

-- ---------------------------------------------------------------------------
-- orders: additive columns (nullable / defaults preserve legacy rows)
-- ---------------------------------------------------------------------------

alter table public.orders
  add column if not exists order_kind text not null default 'cake';

alter table public.orders drop constraint if exists orders_order_kind_check;
alter table public.orders
  add constraint orders_order_kind_check
  check (order_kind in ('cake', 'product', 'offer'));

alter table public.orders add column if not exists product_id text;
alter table public.orders add column if not exists offer_id text;
alter table public.orders add column if not exists offer_name text;

create index if not exists orders_product_id_idx on public.orders (product_id) where product_id is not null;
create index if not exists orders_offer_id_idx on public.orders (offer_id) where offer_id is not null;

-- ---------------------------------------------------------------------------
-- order_items: historical priced lines (immutable after insert for customers)
-- ---------------------------------------------------------------------------

create table if not exists public.order_items (
  id text primary key,
  order_id text not null references public.orders (id) on delete cascade,
  line_type text not null
    check (line_type in (
      'cake', 'product', 'option', 'offer_component', 'discount', 'bundle', 'delivery'
    )),
  product_id text,
  product_name text not null default '',
  option_id text,
  option_name text not null default '',
  option_value_id text,
  option_value_name text not null default '',
  offer_component_id text,
  quantity integer not null default 1 check (quantity > 0),
  unit_price numeric,
  discount_amount numeric not null default 0 check (discount_amount >= 0),
  discount_label text not null default '',
  line_total numeric,
  sort_order integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_idx on public.order_items (order_id, sort_order);

alter table public.order_items enable row level security;

revoke all on table public.order_items from anon, authenticated;
grant select on table public.order_items to authenticated;

drop policy if exists "admin_select_order_items" on public.order_items;
create policy "admin_select_order_items"
  on public.order_items for select to authenticated
  using (public.is_admin());

-- No public INSERT/UPDATE/DELETE policies — only SECURITY DEFINER RPCs write.

-- ---------------------------------------------------------------------------
-- Helpers: product unit price from DB (never from client)
-- ---------------------------------------------------------------------------

create or replace function public.order_resolve_product_price(
  p_product_id text,
  p_size_id text default null
)
returns table (
  ok boolean,
  code text,
  message text,
  product_name text,
  unit_price numeric,
  pending boolean,
  pricing_mode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  -- Thin wrapper: authoritative pricing lives in order_resolve_configured_price
  -- (defined in product-ordering-models.sql).
  return query
  select r.ok, r.code, r.message, r.product_name, r.unit_price, r.pending,
    case r.ordering_model
      when 'cake_servings' then 'cake_sizes'
      when 'quote' then 'quote'
      else 'fixed'
    end
  from public.order_resolve_configured_price(p_product_id, p_size_id, null, 1) r;
end;
$$;

revoke all on function public.order_resolve_product_price(text, text) from public;
revoke all on function public.order_resolve_product_price(text, text) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers: validate option_value_ids (legacy product_options + option library)
-- ---------------------------------------------------------------------------

create or replace function public.order_resolve_option_lines(
  p_product_id text,
  p_option_value_ids text[]
)
returns table (
  ok boolean,
  code text,
  message text,
  lines jsonb,
  options_total numeric,
  pending boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_ids text[] := coalesce(p_option_value_ids, array[]::text[]);
  v_lines jsonb := '[]'::jsonb;
  v_total numeric := 0;
  v_value_id text;
  v_legacy public.product_option_values%rowtype;
  v_legacy_opt public.product_options%rowtype;
  v_def_val public.option_definition_values%rowtype;
  v_def public.option_definitions%rowtype;
  v_link public.product_option_links%rowtype;
  v_override public.product_option_link_value_overrides%rowtype;
  v_price numeric;
  v_enabled boolean;
  v_req record;
  v_seen text[] := array[]::text[];
begin
  -- Required legacy options
  for v_req in
    select o.id, o.name
    from public.product_options o
    where o.product_id = p_product_id and o.enabled = true and o.required = true
  loop
    if not exists (
      select 1
      from public.product_option_values ov
      where ov.option_id = v_req.id and ov.enabled = true and ov.id = any (v_ids)
    ) then
      return query select false, 'invalid_option', 'اختاري: ' || v_req.name, null::jsonb, null::numeric, false;
      return;
    end if;
  end loop;

  -- Required linked library definitions (non-text)
  for v_req in
    select l.id as link_id, d.id as def_id, d.name, d.selection_type
    from public.product_option_links l
    join public.option_definitions d on d.id = l.definition_id
    where l.product_id = p_product_id and l.enabled = true and d.enabled = true and l.required = true
      and d.selection_type in ('toggle', 'single', 'multi', 'quantity')
  loop
    if not exists (
      select 1
      from public.option_definition_values dv
      where dv.definition_id = v_req.def_id and dv.enabled = true and dv.id = any (v_ids)
    ) then
      return query select false, 'invalid_option', 'اختاري: ' || v_req.name, null::jsonb, null::numeric, false;
      return;
    end if;
  end loop;

  foreach v_value_id in array v_ids
  loop
    if v_value_id = any (v_seen) then
      continue;
    end if;
    v_seen := array_append(v_seen, v_value_id);

    -- Legacy product-scoped option value
    select * into v_legacy from public.product_option_values where id = v_value_id;
    if found then
      if v_legacy.enabled is distinct from true then
        return query select false, 'invalid_option', 'خيار غير صالح.', null::jsonb, null::numeric, false;
        return;
      end if;
      select * into v_legacy_opt from public.product_options where id = v_legacy.option_id;
      if not found or v_legacy_opt.product_id is distinct from p_product_id or v_legacy_opt.enabled is distinct from true then
        return query select false, 'invalid_option', 'الخيار لا ينتمي لهذا المنتج.', null::jsonb, null::numeric, false;
        return;
      end if;
      v_lines := v_lines || jsonb_build_array(jsonb_build_object(
        'line_type', 'option',
        'product_id', p_product_id,
        'option_id', v_legacy_opt.id,
        'option_name', v_legacy_opt.name,
        'option_value_id', v_legacy.id,
        'option_value_name', v_legacy.name,
        'quantity', 1,
        'unit_price', v_legacy.price_adjustment,
        'discount_amount', 0,
        'discount_label', '',
        'line_total', v_legacy.price_adjustment,
        'product_name', ''
      ));
      v_total := v_total + coalesce(v_legacy.price_adjustment, 0);
      continue;
    end if;

    -- Library definition value
    select * into v_def_val from public.option_definition_values where id = v_value_id;
    if not found then
      return query select false, 'invalid_option', 'خيار غير صالح.', null::jsonb, null::numeric, false;
      return;
    end if;
    if v_def_val.enabled is distinct from true then
      return query select false, 'invalid_option', 'خيار غير صالح.', null::jsonb, null::numeric, false;
      return;
    end if;
    select * into v_def from public.option_definitions where id = v_def_val.definition_id;
    if not found or v_def.enabled is distinct from true then
      return query select false, 'invalid_option', 'خيار غير صالح.', null::jsonb, null::numeric, false;
      return;
    end if;
    select * into v_link from public.product_option_links
    where product_id = p_product_id and definition_id = v_def.id and enabled = true;
    if not found then
      return query select false, 'invalid_option', 'الخيار لا ينتمي لهذا المنتج.', null::jsonb, null::numeric, false;
      return;
    end if;
    v_price := v_def_val.price_adjustment;
    v_enabled := true;
    select * into v_override from public.product_option_link_value_overrides
    where link_id = v_link.id and definition_value_id = v_def_val.id;
    if found then
      v_price := v_override.price_adjustment;
      if v_override.enabled is not null then
        v_enabled := v_override.enabled;
      end if;
    end if;
    if not v_enabled then
      return query select false, 'invalid_option', 'خيار غير صالح.', null::jsonb, null::numeric, false;
      return;
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'line_type', 'option',
      'product_id', p_product_id,
      'option_id', v_def.id,
      'option_name', v_def.name,
      'option_value_id', v_def_val.id,
      'option_value_name', v_def_val.name,
      'quantity', 1,
      'unit_price', v_price,
      'discount_amount', 0,
      'discount_label', '',
      'line_total', v_price,
      'product_name', ''
    ));
    v_total := v_total + coalesce(v_price, 0);
  end loop;

  return query select true, null::text, null::text, v_lines, v_total, false;
end;
$$;

revoke all on function public.order_resolve_option_lines(text, text[]) from public;
revoke all on function public.order_resolve_option_lines(text, text[]) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- place_order: branch cake | product | offer
-- ---------------------------------------------------------------------------

create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_kind text := coalesce(nullif(trim(payload->>'order_kind'), ''), 'cake');

  v_id text := coalesce(nullif(payload->>'id', ''), gen_random_uuid()::text);
  v_order_number text;
  v_customer_name text := trim(coalesce(payload->>'customer_name', ''));
  v_phone text := trim(coalesce(payload->>'phone', ''));
  v_service_type text := coalesce(payload->>'service_type', '');
  v_area_id text := nullif(trim(coalesce(payload->>'area_id', '')), '');
  v_address_notes text := trim(coalesce(payload->>'address_notes', ''));
  v_design_mode text := coalesce(payload->>'design_mode', '');
  v_cake_id text := nullif(trim(coalesce(payload->>'cake_id', '')), '');
  v_size_id text := trim(coalesce(payload->>'size_id', ''));
  v_servings integer := nullif(payload->>'servings', '')::integer;
  v_event_date date := nullif(payload->>'event_date', '')::date;
  v_event_time text := coalesce(payload->>'event_time', '');
  v_filling_id text := nullif(trim(coalesce(payload->>'filling_id', '')), '');
  v_notes text := trim(coalesce(payload->>'notes', ''));
  v_reference_image text := nullif(trim(coalesce(payload->>'reference_image', '')), '');
  v_extra_ids text[] := coalesce(
    array(
      select distinct x
      from jsonb_array_elements_text(coalesce(payload->'extra_ids', '[]'::jsonb)) as t(x)
    ),
    array[]::text[]
  );

  v_product_id text := nullif(trim(coalesce(payload->>'product_id', '')), '');
  v_quantity integer := null;
  v_price_tier_id text := nullif(trim(coalesce(payload->>'price_tier_id', '')), '');
  v_option_value_ids text[] := coalesce(
    array(
      select distinct x
      from jsonb_array_elements_text(coalesce(payload->'option_value_ids', '[]'::jsonb)) as t(x)
    ),
    array[]::text[]
  );
  v_offer_id text := nullif(trim(coalesce(payload->>'offer_id', '')), '');
  v_offer_selections jsonb := coalesce(payload->'offer_selections', '[]'::jsonb);
  v_ordering_model text := null;
  v_tier_label text := null;
  v_line_qty integer := 1;

  v_min_advance_days integer := 3;
  v_today_cairo date := (timezone('Africa/Cairo', now()))::date;
  v_min_date date;

  v_cake public.cakes%rowtype;
  v_size public.cake_sizes%rowtype;
  v_filling public.fillings%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_extra public.design_extras%rowtype;
  v_product public.products%rowtype;
  v_offer public.offers%rowtype;
  v_component public.offer_components%rowtype;

  v_cake_name text;
  v_size_label text;
  v_custom_size boolean := false;
  v_custom_design boolean := false;
  v_offer_name text := null;
  v_product_name_snap text := null;

  v_base_price numeric := null;
  v_filling_price numeric := null;
  v_extras_price numeric := null;
  v_delivery_price numeric := null;
  v_total_price numeric := 0;
  v_pending text[] := array[]::text[];
  v_price_lines jsonb := '[]'::jsonb;
  v_extras_snapshot jsonb := '[]'::jsonb;
  v_known_extras_sum numeric := 0;
  v_extras_complete boolean := true;
  v_extra_id text;
  v_constraint text;

  v_price_ok boolean;
  v_price_code text;
  v_price_msg text;
  v_unit numeric;
  v_pending_price boolean;
  v_pricing_mode text;
  v_opt_ok boolean;
  v_opt_code text;
  v_opt_msg text;
  v_opt_lines jsonb;
  v_opt_total numeric;
  v_opt_pending boolean;
  v_line_total numeric;
  v_discount numeric;
  v_sort integer := 0;
  v_item jsonb;
  v_sel jsonb;
  v_comp_product_id text;
  v_comp_size_id text;
  v_comp_options text[];
  v_comp_qty integer;
  v_in_category boolean;
begin
  -- Client price/status/total keys in payload are intentionally ignored.
  v_min_date := v_today_cairo + v_min_advance_days;
  v_order_number := 'MK-' || upper(substr(replace(v_id, '-', ''), 1, 8));

  if v_order_kind not in ('cake', 'product', 'offer') then
    return jsonb_build_object('ok', false, 'code', 'invalid_order_kind', 'message', 'نوع الطلب غير صالح.');
  end if;

  if v_customer_name = '' or char_length(v_customer_name) < 2 or char_length(v_customer_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer', 'message', 'اكتبي الاسم بشكل صحيح.');
  end if;

  if char_length(v_address_notes) > 500 or char_length(v_notes) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_notes', 'message', 'الملاحظات أطول من المسموح.');
  end if;

  if v_phone !~ '^01[0125][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_phone', 'message', 'اكتبي رقم موبايل مصري صحيح.');
  end if;

  if v_service_type not in ('delivery', 'pickup') then
    return jsonb_build_object('ok', false, 'code', 'invalid_service', 'message', 'اختاري التوصيل أو الاستلام.');
  end if;

  -- Servings required for cake orders only. Product/offer paths default to 1.
  if v_order_kind = 'cake' then
    if v_servings is null or v_servings < 1 or v_servings > 999 then
      return jsonb_build_object('ok', false, 'code', 'invalid_servings', 'message', 'اكتبي عدد الأفراد بالأرقام.');
    end if;
  else
    v_servings := coalesce(v_servings, 1);
    if v_servings < 1 or v_servings > 999 then
      v_servings := 1;
    end if;
  end if;

  if v_event_date is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_date', 'message', 'اختاري تاريخ الاستلام.');
  end if;

  if v_event_date < v_min_date then
    return jsonb_build_object(
      'ok', false,
      'code', 'date_too_soon',
      'message', 'الحجز يجب أن يكون قبل موعد الاستلام بـ 3 أيام على الأقل.'
    );
  end if;

  if v_event_time not in ('12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00') then
    return jsonb_build_object('ok', false, 'code', 'invalid_time', 'message', 'اختاري وقتًا صالحًا.');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_event_date::text || '|' || v_event_time));

  if public.slot_is_taken(v_event_date, v_event_time) then
    return jsonb_build_object(
      'ok', false,
      'code', 'slot_taken',
      'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.'
    );
  end if;

  if v_service_type = 'delivery' then
    select * into v_zone from public.delivery_zones where id = v_area_id and enabled = true;
    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'invalid_area',
        'message', 'اختاري منطقة التوصيل. التوصيل حاليًا داخل القاهرة والجيزة فقط.'
      );
    end if;
  else
    v_area_id := null;
  end if;

  if v_reference_image is not null
     and v_reference_image !~ ('^' || v_id || '/reference\.(jpg|jpeg|png|webp)$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_reference', 'message', 'مسار الصورة المرجعية غير صالح.');
  end if;

  -- =========================================================================
  -- PRODUCT ORDER
  -- =========================================================================
  if v_order_kind = 'product' then
    if v_product_id is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_product', 'message', 'اختاري المنتج.');
    end if;
    begin
      v_quantity := coalesce(nullif(payload->>'quantity', '')::integer, 1);
    exception
      when others then
        return jsonb_build_object('ok', false, 'code', 'invalid_quantity', 'message', 'الكمية غير صالحة.');
    end;
    if v_quantity is null or v_quantity < 1 or v_quantity > 999 then
      return jsonb_build_object('ok', false, 'code', 'invalid_quantity', 'message', 'الكمية غير صالحة.');
    end if;

    -- Ignore client prices: resolve from ordering_model + tiers
    select r.ok, r.code, r.message, r.product_name, r.unit_price, r.line_qty, r.pending, r.ordering_model, r.tier_id, r.tier_label, r.size_label
      into v_price_ok, v_price_code, v_price_msg, v_product_name_snap, v_unit, v_line_qty, v_pending_price, v_ordering_model, v_price_tier_id, v_tier_label, v_size_label
    from public.order_resolve_configured_price(
      v_product_id,
      nullif(v_size_id, ''),
      v_price_tier_id,
      v_quantity
    ) r;

    if not v_price_ok then
      return jsonb_build_object('ok', false, 'code', v_price_code, 'message', v_price_msg);
    end if;

    if v_pending_price or v_unit is null then
      return jsonb_build_object('ok', false, 'code', coalesce(v_price_code, 'invalid_product_price'), 'message', coalesce(v_price_msg, 'سعر المنتج غير مُعد.'));
    end if;

    v_quantity := coalesce(v_line_qty, v_quantity);
    v_pricing_mode := case v_ordering_model
      when 'cake_servings' then 'cake_sizes'
      when 'quote' then 'quote'
      else 'fixed'
    end;

    select o.ok, o.code, o.message, o.lines, o.options_total, o.pending
      into v_opt_ok, v_opt_code, v_opt_msg, v_opt_lines, v_opt_total, v_opt_pending
    from public.order_resolve_option_lines(v_product_id, v_option_value_ids) o;

    if not v_opt_ok then
      return jsonb_build_object('ok', false, 'code', v_opt_code, 'message', v_opt_msg);
    end if;

    -- Package/weight/fixed: unit_price is the line total; quantity models use unit × qty
    if v_ordering_model in ('quantity', 'custom') and coalesce(v_price_tier_id, '') <> ''
       and exists (
         select 1 from public.product_price_tiers t
         where t.id = v_price_tier_id and t.tier_kind = 'package'
       ) then
      v_base_price := v_unit;
      v_quantity := coalesce((select package_qty from public.product_price_tiers where id = v_price_tier_id), v_quantity);
      v_line_qty := 1; -- option multiplier: once per package order
    elsif v_ordering_model = 'weight' then
      v_base_price := v_unit;
      v_line_qty := 1;
      v_quantity := 1;
    elsif v_ordering_model = 'fixed_item' then
      v_base_price := v_unit;
      v_line_qty := 1;
      v_quantity := 1;
    elsif v_ordering_model = 'cake_servings' then
      v_base_price := v_unit;
      v_line_qty := 1;
      v_quantity := 1;
    else
      v_base_price := v_unit * v_quantity;
      v_line_qty := v_quantity;
    end if;

    v_total_price := v_base_price;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base',
      'label', v_product_name_snap || case
        when v_tier_label is not null and v_tier_label <> '' then ' — ' || v_tier_label
        when v_line_qty > 1 then ' × ' || v_line_qty
        else ''
      end,
      'amount', v_base_price,
      'status', 'known'
    ));

    if v_opt_total > 0 then
      v_extras_price := v_opt_total * v_line_qty;
      v_total_price := v_total_price + v_extras_price;
      for v_item in select * from jsonb_array_elements(v_opt_lines)
      loop
        v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
          'id', v_item->>'option_value_id',
          'label', (v_item->>'option_name') || ': ' || (v_item->>'option_value_name'),
          'amount', (v_item->>'line_total')::numeric * v_line_qty,
          'status', 'known'
        ));
      end loop;
    else
      v_extras_price := 0;
    end if;

    if v_service_type = 'delivery' then
      v_delivery_price := null;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'delivery', 'label', 'التوصيل', 'amount', null, 'status', 'outside',
        'note', 'التوصيل عبر أوبر على حساب العميل.'
      ));
    end if;

    v_design_mode := 'catalog';
    v_custom_design := false;
    v_cake_id := null;
    v_cake_name := v_product_name_snap;
    v_size_id := coalesce(nullif(v_size_id, ''), coalesce(v_price_tier_id, 'custom'));
    v_size_label := coalesce(nullif(v_size_label, ''), coalesce(v_tier_label, 'منتج'));
    v_filling_id := 'none';
    select * into v_filling from public.fillings where id = 'none';
    if not found then
      v_filling.name := '—';
      v_filling.id := 'none';
    end if;
    v_filling_price := 0;
    v_extras_snapshot := '[]'::jsonb;

    begin
      insert into public.orders (
        id, order_number, customer_name, phone, area, area_id, address_notes, service_type,
        cake_id, cake_name, design_mode, custom_design, reference_image, servings, size, size_id,
        event_date, event_time, filling, filling_id, filling_price, extras, notes,
        base_price, extras_price, delivery_price, total_price, pending_charges, price_lines,
        status, created_at, order_kind, product_id, offer_id, offer_name
      ) values (
        v_id, v_order_number, v_customer_name, v_phone,
        case when v_service_type = 'delivery' then v_zone.name else null end,
        v_area_id, v_address_notes, v_service_type,
        null, v_cake_name, v_design_mode, false, v_reference_image, v_servings, v_size_label, v_size_id,
        v_event_date, v_event_time, coalesce(v_filling.name, '—'), coalesce(v_filling.id, 'none'), v_filling_price,
        v_extras_snapshot, v_notes,
        v_base_price, v_extras_price, v_delivery_price, v_total_price, to_jsonb(v_pending), v_price_lines,
        'pending_review', now(), 'product', v_product_id, null, null
      );
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'orders_active_slot_uidx' then
          return jsonb_build_object('ok', false, 'code', 'slot_taken', 'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.');
        end if;
        return jsonb_build_object('ok', false, 'code', 'order_conflict', 'message', 'تعذّر حفظ الطلب. أعيدي المحاولة.');
    end;

    v_sort := 0;
    v_line_total := v_base_price;
    insert into public.order_items (
      id, order_id, line_type, product_id, product_name, quantity, unit_price, discount_amount, line_total, sort_order, meta
    ) values (
      v_id || '-line-' || v_sort, v_id, 'product', v_product_id, v_product_name_snap, greatest(v_quantity, 1), v_unit, 0, v_line_total, v_sort,
      jsonb_build_object(
        'ordering_model', v_ordering_model,
        'price_tier_id', v_price_tier_id,
        'tier_label', v_tier_label,
        'size_id', v_size_id
      )
    );
    v_sort := v_sort + 1;
    for v_item in select * from jsonb_array_elements(v_opt_lines)
    loop
      insert into public.order_items (
        id, order_id, line_type, product_id, product_name, option_id, option_name, option_value_id, option_value_name,
        quantity, unit_price, discount_amount, line_total, sort_order
      ) values (
        v_id || '-line-' || v_sort, v_id, 'option', v_product_id, v_product_name_snap,
        v_item->>'option_id', v_item->>'option_name', v_item->>'option_value_id', v_item->>'option_value_name',
        greatest(v_quantity, 1), (v_item->>'unit_price')::numeric, 0, (v_item->>'line_total')::numeric * greatest(v_quantity, 1), v_sort
      );
      v_sort := v_sort + 1;
    end loop;

    return jsonb_build_object(
      'ok', true,
      'order', jsonb_build_object(
        'id', v_id, 'orderNumber', v_order_number, 'customerName', v_customer_name, 'phone', v_phone,
        'area', case when v_service_type = 'delivery' then v_zone.name else null end,
        'areaId', v_area_id, 'addressNotes', v_address_notes, 'serviceType', v_service_type,
        'cakeId', null, 'cakeName', v_cake_name, 'designMode', v_design_mode, 'customDesign', false,
        'referenceImage', v_reference_image, 'servings', v_servings, 'size', v_size_label, 'sizeId', v_size_id,
        'date', v_event_date, 'time', v_event_time,
        'filling', coalesce(v_filling.name, '—'), 'fillingId', coalesce(v_filling.id, 'none'), 'fillingPrice', v_filling_price,
        'extras', v_extras_snapshot, 'notes', v_notes,
        'basePrice', v_base_price, 'extrasPrice', v_extras_price, 'deliveryPrice', v_delivery_price,
        'totalPrice', v_total_price, 'pendingCharges', to_jsonb(v_pending), 'priceLines', v_price_lines,
        'status', 'pending_review', 'createdAt', now(),
        'orderKind', 'product', 'productId', v_product_id, 'offerId', null, 'offerName', null,
        'quantity', v_quantity, 'priceTierId', v_price_tier_id, 'orderingModel', v_ordering_model
      )
    );
  end if;

  -- =========================================================================
  -- OFFER ORDER
  -- =========================================================================
  if v_order_kind = 'offer' then
    if v_offer_id is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_offer', 'message', 'العرض غير صالح.');
    end if;

    select * into v_offer from public.offers where id = v_offer_id;
    if not found or v_offer.enabled is distinct from true then
      return jsonb_build_object('ok', false, 'code', 'invalid_offer', 'message', 'العرض غير متاح.');
    end if;
    if v_offer.starts_at is not null and v_offer.starts_at > now() then
      return jsonb_build_object('ok', false, 'code', 'offer_not_started', 'message', 'العرض لم يبدأ بعد.');
    end if;
    if v_offer.ends_at is not null and v_offer.ends_at < now() then
      return jsonb_build_object('ok', false, 'code', 'offer_expired', 'message', 'انتهت صلاحية العرض.');
    end if;

    v_offer_name := v_offer.name;
    v_cake_name := 'عرض: ' || v_offer.name;
    v_design_mode := 'catalog';
    v_custom_design := false;
    v_cake_id := null;
    v_size_id := 'custom';
    v_size_label := 'باقة';
    v_filling_id := 'none';
    select * into v_filling from public.fillings where id = 'none';
    if not found then
      v_filling.name := '—';
      v_filling.id := 'none';
    end if;
    v_filling_price := 0;
    v_extras_snapshot := '[]'::jsonb;
    v_extras_price := 0;

    -- Load components from DB only (ignore client component definitions / discounts)
    for v_component in
      select * from public.offer_components where offer_id = v_offer_id order by sort_order, id
    loop
      v_comp_product_id := v_component.product_id;
      v_comp_size_id := null;
      v_comp_options := array[]::text[];
      v_comp_qty := v_component.quantity;

      -- Find matching client selection by component_id only (for customer_picks / size / options)
      v_sel := null;
      select s into v_sel
      from jsonb_array_elements(v_offer_selections) s
      where s->>'component_id' = v_component.id
      limit 1;

      if v_component.customer_picks or (v_component.product_id is null and v_component.category_id is not null) then
        if v_sel is null or nullif(trim(v_sel->>'product_id'), '') is null then
          return jsonb_build_object('ok', false, 'code', 'missing_offer_selection', 'message', 'اختاري منتجًا ضمن العرض.');
        end if;
        v_comp_product_id := trim(v_sel->>'product_id');

        -- Must belong to component.category_id (or match fixed product)
        if v_component.product_id is not null and v_comp_product_id is distinct from v_component.product_id then
          return jsonb_build_object('ok', false, 'code', 'invalid_offer_selection', 'message', 'اختيار العرض غير مطابق.');
        end if;
        if v_component.category_id is not null then
          select exists (
            select 1 from public.products p
            where p.id = v_comp_product_id
              and p.enabled = true
              and (
                p.category_id = v_component.category_id
                or p.category_id in (
                  select c.id from public.product_categories c where c.parent_id = v_component.category_id
                )
              )
          ) into v_in_category;
          if not v_in_category then
            return jsonb_build_object('ok', false, 'code', 'invalid_offer_selection', 'message', 'المنتج خارج تصنيف العرض.');
          end if;
        end if;
      elsif v_component.product_id is null then
        return jsonb_build_object('ok', false, 'code', 'invalid_offer', 'message', 'مكوّن العرض غير مكتمل.');
      end if;

      if v_sel is not null then
        v_comp_size_id := nullif(trim(coalesce(v_sel->>'size_id', '')), '');
        v_comp_options := coalesce(
          array(select distinct x from jsonb_array_elements_text(coalesce(v_sel->'option_value_ids', '[]'::jsonb)) t(x)),
          array[]::text[]
        );
        -- Ignore client quantity / prices / discounts
      end if;

      select r.ok, r.code, r.message, r.product_name, r.unit_price, r.pending, r.pricing_mode
        into v_price_ok, v_price_code, v_price_msg, v_product_name_snap, v_unit, v_pending_price, v_pricing_mode
      from public.order_resolve_product_price(v_comp_product_id, v_comp_size_id) r;

      if not v_price_ok then
        return jsonb_build_object('ok', false, 'code', v_price_code, 'message', v_price_msg);
      end if;

      select o.ok, o.code, o.message, o.lines, o.options_total, o.pending
        into v_opt_ok, v_opt_code, v_opt_msg, v_opt_lines, v_opt_total, v_opt_pending
      from public.order_resolve_option_lines(v_comp_product_id, v_comp_options) o;

      if not v_opt_ok then
        return jsonb_build_object('ok', false, 'code', v_opt_code, 'message', v_opt_msg);
      end if;

      -- Component pricing from DB definition only (never from client).
      v_discount := 0;
      if v_component.component_pricing = 'included_in_bundle' and v_offer.pricing_rule is distinct from 'custom_bundle' then
        return jsonb_build_object('ok', false, 'code', 'invalid_offer', 'message', 'إعداد العرض غير مكتمل.');
      end if;
      if v_offer.pricing_rule = 'custom_bundle' or v_component.component_pricing = 'included_in_bundle' then
        v_line_total := 0;
        v_discount := coalesce(v_unit, 0) * v_comp_qty;
      elsif v_pending_price then
        -- Includes quote products — not allowed in paid offer checkout.
        return jsonb_build_object('ok', false, 'code', coalesce(v_price_code, 'quote_only'), 'message', coalesce(v_price_msg, 'أحد منتجات العرض يتطلب طلب سعر.'));
      elsif v_component.component_pricing = 'free' then
        v_discount := coalesce(v_unit, 0) * v_comp_qty;
        v_line_total := 0;
      elsif v_component.component_pricing = 'percent_off' then
        v_discount := round((coalesce(v_unit, 0) * v_comp_qty) * (coalesce(v_component.discount_percent, 0) / 100.0), 2);
        v_line_total := greatest(0, coalesce(v_unit, 0) * v_comp_qty - v_discount);
      elsif v_component.component_pricing = 'fixed_off' then
        v_discount := least(coalesce(v_unit, 0) * v_comp_qty, coalesce(v_component.discount_amount, 0));
        v_line_total := greatest(0, coalesce(v_unit, 0) * v_comp_qty - v_discount);
      else
        -- full_price
        v_line_total := coalesce(v_unit, 0) * v_comp_qty;
      end if;

      if v_offer.pricing_rule <> 'custom_bundle' and v_component.component_pricing <> 'included_in_bundle' then
        if v_line_total is null then
          null;
        elsif v_total_price is not null then
          v_total_price := v_total_price + v_line_total;
        end if;
      end if;

      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_component.id,
        'label', coalesce(nullif(v_component.role_label, ''), v_product_name_snap),
        'amount', v_line_total,
        'status', case when v_line_total is null then 'pending' else 'known' end,
        'note', case
          when v_component.component_pricing = 'free' then 'هدية'
          when v_component.component_pricing = 'percent_off' then 'خصم ' || coalesce(v_component.discount_percent, 0)::text || '%'
          else null
        end
      ));

      v_sort := v_sort + 1;

      -- Option add-ons priced from DB only.
      if v_opt_total > 0 then
        if v_total_price is not null then
          v_total_price := v_total_price + (v_opt_total * v_comp_qty);
        end if;
        v_extras_price := coalesce(v_extras_price, 0) + (v_opt_total * v_comp_qty);
        for v_item in select * from jsonb_array_elements(v_opt_lines)
        loop
          v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
            'id', v_item->>'option_value_id',
            'label', (v_item->>'option_name') || ': ' || (v_item->>'option_value_name'),
            'amount', (v_item->>'line_total')::numeric * v_comp_qty,
            'status', 'known'
          ));
        end loop;
      end if;
    end loop;

    if v_offer.pricing_rule = 'custom_bundle' then
      if v_offer.custom_bundle_price is null then
        return jsonb_build_object('ok', false, 'code', 'invalid_offer', 'message', 'سعر الباقة غير مُعد.');
      end if;
      v_base_price := v_offer.custom_bundle_price;
      v_total_price := v_offer.custom_bundle_price + coalesce(v_extras_price, 0);
      v_price_lines := jsonb_build_array(jsonb_build_object(
        'id', 'bundle', 'label', 'سعر الباقة: ' || v_offer.name, 'amount', v_offer.custom_bundle_price, 'status', 'known'
      )) || v_price_lines;
    else
      v_base_price := v_total_price;
    end if;

    if v_service_type = 'delivery' then
      v_delivery_price := null;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'delivery', 'label', 'التوصيل', 'amount', null, 'status', 'outside',
        'note', 'التوصيل عبر أوبر على حساب العميل.'
      ));
    end if;

    begin
      insert into public.orders (
        id, order_number, customer_name, phone, area, area_id, address_notes, service_type,
        cake_id, cake_name, design_mode, custom_design, reference_image, servings, size, size_id,
        event_date, event_time, filling, filling_id, filling_price, extras, notes,
        base_price, extras_price, delivery_price, total_price, pending_charges, price_lines,
        status, created_at, order_kind, product_id, offer_id, offer_name
      ) values (
        v_id, v_order_number, v_customer_name, v_phone,
        case when v_service_type = 'delivery' then v_zone.name else null end,
        v_area_id, v_address_notes, v_service_type,
        null, v_cake_name, v_design_mode, false, v_reference_image, v_servings, v_size_label, v_size_id,
        v_event_date, v_event_time, coalesce(v_filling.name, '—'), coalesce(v_filling.id, 'none'), v_filling_price,
        v_extras_snapshot, v_notes,
        v_base_price, v_extras_price, v_delivery_price, v_total_price, to_jsonb(v_pending), v_price_lines,
        'pending_review', now(), 'offer', null, v_offer_id, v_offer_name
      );
    exception
      when unique_violation then
        get stacked diagnostics v_constraint = constraint_name;
        if v_constraint = 'orders_active_slot_uidx' then
          return jsonb_build_object('ok', false, 'code', 'slot_taken', 'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.');
        end if;
        return jsonb_build_object('ok', false, 'code', 'order_conflict', 'message', 'تعذّر حفظ الطلب. أعيدي المحاولة.');
    end;

    -- Re-walk components to snapshot order_items now that order exists
    v_sort := 0;
    for v_component in
      select * from public.offer_components where offer_id = v_offer_id order by sort_order, id
    loop
      v_comp_product_id := v_component.product_id;
      v_comp_size_id := null;
      v_comp_options := array[]::text[];
      v_comp_qty := v_component.quantity;
      v_sel := null;
      select s into v_sel from jsonb_array_elements(v_offer_selections) s where s->>'component_id' = v_component.id limit 1;
      if v_sel is not null and nullif(trim(v_sel->>'product_id'), '') is not null then
        v_comp_product_id := trim(v_sel->>'product_id');
        v_comp_size_id := nullif(trim(coalesce(v_sel->>'size_id', '')), '');
        v_comp_options := coalesce(
          array(select distinct x from jsonb_array_elements_text(coalesce(v_sel->'option_value_ids', '[]'::jsonb)) t(x)),
          array[]::text[]
        );
      end if;

      select r.product_name, r.unit_price, r.pending
        into v_product_name_snap, v_unit, v_pending_price
      from public.order_resolve_product_price(v_comp_product_id, v_comp_size_id) r;

      select o.lines, o.options_total into v_opt_lines, v_opt_total
      from public.order_resolve_option_lines(v_comp_product_id, v_comp_options) o;

      v_discount := 0;
      if v_component.component_pricing = 'included_in_bundle' and v_offer.pricing_rule is distinct from 'custom_bundle' then
        return jsonb_build_object('ok', false, 'code', 'invalid_offer', 'message', 'إعداد العرض غير مكتمل.');
      end if;
      if v_offer.pricing_rule = 'custom_bundle' or v_component.component_pricing = 'included_in_bundle' then
        v_line_total := 0;
        v_discount := coalesce(v_unit, 0) * v_comp_qty;
      elsif v_pending_price then
        return jsonb_build_object('ok', false, 'code', 'quote_only', 'message', 'أحد منتجات العرض يتطلب طلب سعر.');
      elsif v_component.component_pricing = 'free' then
        v_discount := coalesce(v_unit, 0) * v_comp_qty;
        v_line_total := 0;
      elsif v_component.component_pricing = 'percent_off' then
        v_discount := round((coalesce(v_unit, 0) * v_comp_qty) * (coalesce(v_component.discount_percent, 0) / 100.0), 2);
        v_line_total := greatest(0, coalesce(v_unit, 0) * v_comp_qty - v_discount);
      elsif v_component.component_pricing = 'fixed_off' then
        v_discount := least(coalesce(v_unit, 0) * v_comp_qty, coalesce(v_component.discount_amount, 0));
        v_line_total := greatest(0, coalesce(v_unit, 0) * v_comp_qty - v_discount);
      else
        v_line_total := coalesce(v_unit, 0) * v_comp_qty;
      end if;

      insert into public.order_items (
        id, order_id, line_type, product_id, product_name, offer_component_id,
        quantity, unit_price, discount_amount, discount_label, line_total, sort_order, meta
      ) values (
        v_id || '-oc-' || v_sort, v_id, 'offer_component', v_comp_product_id, coalesce(v_product_name_snap, ''), v_component.id,
        v_comp_qty, v_unit, v_discount,
        case
          when v_component.component_pricing = 'free' then 'هدية'
          when v_component.component_pricing = 'percent_off' then 'خصم نسبة'
          when v_component.component_pricing = 'fixed_off' then 'خصم مبلغ'
          when v_component.component_pricing = 'included_in_bundle' then 'ضمن الباقة'
          else ''
        end,
        v_line_total, v_sort,
        jsonb_build_object('component_pricing', v_component.component_pricing, 'size_id', v_comp_size_id)
      );
      v_sort := v_sort + 1;

      for v_item in select * from jsonb_array_elements(coalesce(v_opt_lines, '[]'::jsonb))
      loop
        insert into public.order_items (
          id, order_id, line_type, product_id, product_name, option_id, option_name, option_value_id, option_value_name,
          quantity, unit_price, discount_amount, line_total, sort_order
        ) values (
          v_id || '-oc-' || v_sort, v_id, 'option', v_comp_product_id, coalesce(v_product_name_snap, ''),
          v_item->>'option_id', v_item->>'option_name', v_item->>'option_value_id', v_item->>'option_value_name',
          v_comp_qty, (v_item->>'unit_price')::numeric, 0, (v_item->>'line_total')::numeric * v_comp_qty, v_sort
        );
        v_sort := v_sort + 1;
      end loop;
    end loop;

    if v_offer.pricing_rule = 'custom_bundle' then
      insert into public.order_items (
        id, order_id, line_type, product_name, quantity, unit_price, discount_amount, line_total, sort_order
      ) values (
        v_id || '-bundle', v_id, 'bundle', v_offer.name, 1, v_offer.custom_bundle_price, 0, v_offer.custom_bundle_price, -1
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'order', jsonb_build_object(
        'id', v_id, 'orderNumber', v_order_number, 'customerName', v_customer_name, 'phone', v_phone,
        'area', case when v_service_type = 'delivery' then v_zone.name else null end,
        'areaId', v_area_id, 'addressNotes', v_address_notes, 'serviceType', v_service_type,
        'cakeId', null, 'cakeName', v_cake_name, 'designMode', v_design_mode, 'customDesign', false,
        'referenceImage', v_reference_image, 'servings', v_servings, 'size', v_size_label, 'sizeId', v_size_id,
        'date', v_event_date, 'time', v_event_time,
        'filling', coalesce(v_filling.name, '—'), 'fillingId', coalesce(v_filling.id, 'none'), 'fillingPrice', v_filling_price,
        'extras', v_extras_snapshot, 'notes', v_notes,
        'basePrice', v_base_price, 'extrasPrice', v_extras_price, 'deliveryPrice', v_delivery_price,
        'totalPrice', v_total_price, 'pendingCharges', to_jsonb(v_pending), 'priceLines', v_price_lines,
        'status', 'pending_review', 'createdAt', now(),
        'orderKind', 'offer', 'productId', null, 'offerId', v_offer_id, 'offerName', v_offer_name
      )
    );
  end if;

  -- =========================================================================
  -- LEGACY CAKE ORDER (unchanged pricing rules)
  -- =========================================================================
  if v_design_mode not in ('catalog', 'similar', 'custom') then
    return jsonb_build_object('ok', false, 'code', 'invalid_design_mode', 'message', 'نوع التصميم غير صالح.');
  end if;

  v_custom_design := v_design_mode <> 'catalog';
  v_custom_size := v_size_id = 'custom';

  if v_design_mode in ('catalog', 'similar') then
    if v_cake_id is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_cake', 'message', 'اختاري التصميم.');
    end if;
    select * into v_cake from public.cakes where id = v_cake_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_cake', 'message', 'التصميم المختار غير متاح.');
    end if;
    v_cake_name := v_cake.name;
  else
    v_cake_id := null;
    v_cake_name := null;
  end if;

  if v_custom_size then
    v_size_label := 'مقاس حسب الطلب';
    v_base_price := null;
    v_total_price := null;
    v_pending := array_append(v_pending, 'سعر المقاس');
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base', 'label', 'سعر المقاس', 'amount', null, 'status', 'pending',
      'note', 'مقاس حسب الطلب، وغير موجود في قائمة الأسعار الحالية.'
    ));
  else
    select * into v_size from public.cake_sizes where id = v_size_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_size', 'message', 'المقاس المختار غير متاح.');
    end if;
    if v_cake_id is not null and v_cake.available_size_ids is not null
       and jsonb_typeof(v_cake.available_size_ids) = 'array'
       and not (v_cake.available_size_ids ? v_size_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_size', 'message', 'المقاس غير متاح لهذا التصميم.');
    end if;
    v_size_label := v_size.label;
    v_base_price := v_size.price;
    v_total_price := v_size.price;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base', 'label', 'سعر المقاس (' || v_size.label || ')', 'amount', v_size.price, 'status', 'known'
    ));
  end if;

  if v_filling_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'اختاري الحشوة.');
  end if;
  select * into v_filling from public.fillings where id = v_filling_id and enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'الحشوة المختارة غير متاحة.');
  end if;
  if v_cake_id is not null and v_cake.filling_ids is not null
     and jsonb_typeof(v_cake.filling_ids) = 'array'
     and not (v_cake.filling_ids ? v_filling_id) then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'الحشوة غير متاحة لهذا التصميم.');
  end if;

  if not (v_filling.id = 'none' and coalesce(v_filling.price, 0) = 0) then
    if v_filling.price is null then
      v_filling_price := null;
      v_pending := array_append(v_pending, v_filling.name);
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'filling', 'label', v_filling.name, 'amount', null, 'status', v_filling.price_status
      ));
    else
      v_filling_price := v_filling.price;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'filling', 'label', v_filling.name, 'amount', v_filling.price, 'status', 'known',
        'note', case when v_filling.price = 0 then 'بدون إضافة' else null end
      ));
      if v_total_price is not null then
        v_total_price := v_total_price + v_filling.price;
      end if;
    end if;
  else
    v_filling_price := 0;
  end if;

  foreach v_extra_id in array v_extra_ids loop
    select * into v_extra from public.design_extras where id = v_extra_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_extra', 'message', 'إحدى إضافات التصميم غير متاحة.');
    end if;
    if v_cake_id is not null and v_cake.extra_ids is not null
       and jsonb_typeof(v_cake.extra_ids) = 'array'
       and not (v_cake.extra_ids ? v_extra_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_extra', 'message', 'إحدى إضافات التصميم غير متاحة لهذا التصميم.');
    end if;

    v_extras_snapshot := v_extras_snapshot || jsonb_build_array(jsonb_build_object(
      'id', v_extra.id, 'name', v_extra.name, 'price', v_extra.price, 'priceStatus', v_extra.price_status
    ));

    if v_extra.price is null then
      v_extras_complete := false;
      v_pending := array_append(v_pending, v_extra.name);
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_extra.id, 'label', v_extra.name, 'amount', null, 'status', v_extra.price_status, 'note', v_extra.description
      ));
    else
      v_known_extras_sum := v_known_extras_sum + v_extra.price;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_extra.id, 'label', v_extra.name, 'amount', v_extra.price, 'status', 'known'
      ));
      if v_total_price is not null then
        v_total_price := v_total_price + v_extra.price;
      end if;
    end if;
  end loop;

  if v_extras_complete then
    v_extras_price := v_known_extras_sum;
  else
    v_extras_price := null;
  end if;

  if v_service_type = 'delivery' then
    v_delivery_price := null;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'delivery', 'label', 'التوصيل', 'amount', null, 'status', 'outside',
      'note', 'التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.'
    ));
  end if;

  begin
    insert into public.orders (
      id, order_number, customer_name, phone, area, area_id, address_notes, service_type,
      cake_id, cake_name, design_mode, custom_design, reference_image, servings, size, size_id,
      event_date, event_time, filling, filling_id, filling_price, extras, notes,
      base_price, extras_price, delivery_price, total_price, pending_charges, price_lines,
      status, created_at, order_kind, product_id, offer_id, offer_name
    ) values (
      v_id, v_order_number, v_customer_name, v_phone,
      case when v_service_type = 'delivery' then v_zone.name else null end,
      v_area_id, v_address_notes, v_service_type,
      v_cake_id, v_cake_name, v_design_mode, v_custom_design, v_reference_image, v_servings, v_size_label, v_size_id,
      v_event_date, v_event_time, v_filling.name, v_filling.id, v_filling_price, v_extras_snapshot, v_notes,
      v_base_price, v_extras_price, v_delivery_price, v_total_price, to_jsonb(v_pending), v_price_lines,
      'pending_review', now(), 'cake', null, null, null
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_active_slot_uidx' then
        return jsonb_build_object(
          'ok', false, 'code', 'slot_taken',
          'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.'
        );
      end if;
      return jsonb_build_object('ok', false, 'code', 'order_conflict', 'message', 'تعذّر حفظ الطلب. أعيدي المحاولة.');
  end;

  insert into public.order_items (
    id, order_id, line_type, product_id, product_name, quantity, unit_price, discount_amount, line_total, sort_order, meta
  ) values (
    v_id || '-cake', v_id, 'cake', v_cake_id, coalesce(v_cake_name, 'تصميم مخصص'), 1, v_base_price, 0, v_base_price, 0,
    jsonb_build_object('size_id', v_size_id, 'filling_id', v_filling.id, 'design_mode', v_design_mode)
  );

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_id, 'orderNumber', v_order_number, 'customerName', v_customer_name, 'phone', v_phone,
      'area', case when v_service_type = 'delivery' then v_zone.name else null end,
      'areaId', v_area_id, 'addressNotes', v_address_notes, 'serviceType', v_service_type,
      'cakeId', v_cake_id, 'cakeName', v_cake_name, 'designMode', v_design_mode, 'customDesign', v_custom_design,
      'referenceImage', v_reference_image, 'servings', v_servings, 'size', v_size_label, 'sizeId', v_size_id,
      'date', v_event_date, 'time', v_event_time,
      'filling', v_filling.name, 'fillingId', v_filling.id, 'fillingPrice', v_filling_price,
      'extras', v_extras_snapshot, 'notes', v_notes,
      'basePrice', v_base_price, 'extrasPrice', v_extras_price, 'deliveryPrice', v_delivery_price,
      'totalPrice', v_total_price, 'pendingCharges', to_jsonb(v_pending), 'priceLines', v_price_lines,
      'status', 'pending_review', 'createdAt', now(),
      'orderKind', 'cake', 'productId', null, 'offerId', null, 'offerName', null
    )
  );
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;
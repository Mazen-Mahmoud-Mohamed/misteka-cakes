-- Misteka Cakes — Phase 2 Supabase schema (security-hardened)
-- Apply in the Supabase SQL editor (or via CLI migration).
-- Frontend uses ONLY the anon/publishable key (VITE_SUPABASE_ANON_KEY).
-- Never put the service-role key in Vite env vars.
--
-- Integrity model:
-- 1) Anonymous clients do NOT insert into orders directly.
-- 2) place_order(...) validates catalog FKs and recomputes prices from tables.
-- 3) Frontend price fields are ignored for persisted totals.
-- 4) Slot conflicts are enforced by a partial unique index.
-- 5) Reference uploads must match the exact path declared on the order.

-- ---------------------------------------------------------------------------
-- Catalog tables (public read, no public write)
-- ---------------------------------------------------------------------------

create table if not exists public.cake_sizes (
  id text primary key,
  pricing_group text not null check (pricing_group in ('single', 'two-tier')),
  label text not null,
  servings_label text not null,
  servings_min integer,
  servings_max integer,
  price numeric not null check (price >= 0),
  sort_order integer not null default 0,
  enabled boolean not null default true
);

create table if not exists public.cakes (
  id text primary key,
  name text not null,
  description text not null default '',
  image_key text not null,
  image_alt text not null default '',
  image_position text not null default 'center',
  category text not null check (category in ('birthday', 'celebration')),
  pricing_group text not null check (pricing_group in ('single', 'two-tier')),
  base_price numeric,
  price_note text not null default '',
  serving_info text not null default '',
  available_size_ids jsonb not null default '[]'::jsonb,
  filling_ids jsonb not null default '[]'::jsonb,
  extra_ids jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  enabled boolean not null default true
);

create table if not exists public.fillings (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric,
  price_status text not null check (price_status in ('known', 'pending', 'quote', 'outside')),
  sort_order integer not null default 0,
  enabled boolean not null default true
);

create table if not exists public.design_extras (
  id text primary key,
  name text not null,
  description text not null default '',
  price numeric,
  price_status text not null check (price_status in ('known', 'pending', 'quote', 'outside')),
  sort_order integer not null default 0,
  enabled boolean not null default true
);

create table if not exists public.delivery_zones (
  id text primary key,
  name text not null,
  enabled boolean not null default true,
  sort_order integer not null default 0
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id text primary key,
  order_number text not null unique,
  customer_name text not null,
  phone text not null,
  area text,
  area_id text,
  address_notes text not null default '',
  service_type text not null check (service_type in ('delivery', 'pickup')),
  cake_id text,
  cake_name text,
  design_mode text not null check (design_mode in ('catalog', 'similar', 'custom')),
  custom_design boolean not null default false,
  reference_image text,
  servings integer not null check (servings > 0),
  size text not null,
  size_id text not null,
  event_date date not null,
  event_time text not null,
  filling text not null default '',
  filling_id text,
  filling_price numeric,
  extras jsonb not null default '[]'::jsonb,
  notes text not null default '',
  base_price numeric,
  extras_price numeric,
  delivery_price numeric,
  total_price numeric,
  pending_charges jsonb not null default '[]'::jsonb,
  price_lines jsonb not null default '[]'::jsonb,
  status text not null default 'pending_review'
    check (status in ('pending_review', 'confirmed', 'cancelled', 'rejected')),
  created_at timestamptz not null default now()
);

alter table public.orders add column if not exists area_id text;
alter table public.orders add column if not exists cake_name text;
alter table public.orders add column if not exists size_id text;
alter table public.orders add column if not exists filling_id text;
alter table public.orders add column if not exists price_lines jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists address_notes text not null default '';
alter table public.orders add column if not exists notes text not null default '';
alter table public.orders add column if not exists filling text not null default '';
alter table public.orders add column if not exists extras jsonb not null default '[]'::jsonb;
alter table public.orders add column if not exists pending_charges jsonb not null default '[]'::jsonb;

-- Active orders cannot share the same exact date+time.
-- cancelled/rejected do not block the slot.
create unique index if not exists orders_active_slot_uidx
  on public.orders (event_date, event_time)
  where status not in ('cancelled', 'rejected');

-- Intentionally no extra date-only index: slot lookups use (event_date, event_time)
-- via orders_active_slot_uidx / slot_is_taken. Drop if an older deploy created it.
drop index if exists public.orders_event_date_idx;

-- ---------------------------------------------------------------------------
-- Privileges / RLS
-- ---------------------------------------------------------------------------

alter table public.cake_sizes enable row level security;
alter table public.cakes enable row level security;
alter table public.fillings enable row level security;
alter table public.design_extras enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.orders enable row level security;

-- INTENTIONAL: orders has RLS enabled and ZERO policies for anon/authenticated.
-- Direct table access is denied. Writes go only through place_order / clear_order_reference_image
-- (SECURITY DEFINER). Do not add broad SELECT/INSERT policies for public roles.

revoke all on table public.cake_sizes from anon, authenticated;
revoke all on table public.cakes from anon, authenticated;
revoke all on table public.fillings from anon, authenticated;
revoke all on table public.design_extras from anon, authenticated;
revoke all on table public.delivery_zones from anon, authenticated;
revoke all on table public.orders from anon, authenticated;

-- Catalog: read-only for public roles
grant select on table public.cake_sizes to anon, authenticated;
grant select on table public.cakes to anon, authenticated;
grant select on table public.fillings to anon, authenticated;
grant select on table public.design_extras to anon, authenticated;
grant select on table public.delivery_zones to anon, authenticated;

-- Orders: NO direct insert/select/update/delete for anon.
-- Creation goes through place_order() only.

drop policy if exists "public_read_enabled_cake_sizes" on public.cake_sizes;
drop policy if exists "public_read_enabled_cakes" on public.cakes;
drop policy if exists "public_read_enabled_fillings" on public.fillings;
drop policy if exists "public_read_enabled_design_extras" on public.design_extras;
drop policy if exists "public_read_enabled_delivery_zones" on public.delivery_zones;
drop policy if exists "public_create_pending_orders" on public.orders;

-- USING only (SELECT). No WITH CHECK write policies on catalog tables.
create policy "public_read_enabled_cake_sizes"
  on public.cake_sizes for select to anon, authenticated
  using (enabled = true);

create policy "public_read_enabled_cakes"
  on public.cakes for select to anon, authenticated
  using (enabled = true);

create policy "public_read_enabled_fillings"
  on public.fillings for select to anon, authenticated
  using (enabled = true);

create policy "public_read_enabled_design_extras"
  on public.design_extras for select to anon, authenticated
  using (enabled = true);

create policy "public_read_enabled_delivery_zones"
  on public.delivery_zones for select to anon, authenticated
  using (enabled = true);

-- No SELECT/UPDATE/DELETE policies on public.orders for anon/authenticated.

-- ---------------------------------------------------------------------------
-- Availability check (no customer fields returned)
-- ---------------------------------------------------------------------------

create or replace function public.slot_is_taken(slot_date date, slot_time text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders
    where event_date = slot_is_taken.slot_date
      and event_time = slot_is_taken.slot_time
      and status not in ('cancelled', 'rejected')
  );
$$;

revoke all on function public.slot_is_taken(date, text) from public;
grant execute on function public.slot_is_taken(date, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- place_order: validates references + recomputes prices server-side
-- Keep min advance days in sync with src/data/options.ts bookingRules.minAdvanceDays
-- ---------------------------------------------------------------------------

create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  v_min_advance_days integer := 3;
  v_today_cairo date := (timezone('Africa/Cairo', now()))::date;
  v_min_date date;

  v_cake public.cakes%rowtype;
  v_size public.cake_sizes%rowtype;
  v_filling public.fillings%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_extra public.design_extras%rowtype;

  v_cake_name text;
  v_size_label text;
  v_custom_size boolean := false;
  v_custom_design boolean := false;

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
begin
  -- Client price/status keys in payload are intentionally ignored.
  v_min_date := v_today_cairo + v_min_advance_days;
  v_order_number := 'MK-' || upper(substr(replace(v_id, '-', ''), 1, 8));

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

  if v_design_mode not in ('catalog', 'similar', 'custom') then
    return jsonb_build_object('ok', false, 'code', 'invalid_design_mode', 'message', 'نوع التصميم غير صالح.');
  end if;

  if v_servings is null or v_servings < 1 or v_servings > 999 then
    return jsonb_build_object('ok', false, 'code', 'invalid_servings', 'message', 'اكتبي عدد الأفراد بالأرقام.');
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

  -- Serialize concurrent bookings for the same slot within this transaction.
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

  v_custom_design := v_design_mode <> 'catalog';

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

  if v_size_id = 'custom' then
    v_custom_size := true;
    v_size_label := 'مقاس حسب الطلب';
    v_base_price := null;
    v_pending := array_append(v_pending, 'سعر المقاس');
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base',
      'label', 'سعر المقاس',
      'amount', null,
      'status', 'pending',
      'note', 'مقاس حسب الطلب، وغير موجود في قائمة الأسعار الحالية.'
    ));
    v_total_price := null;
  else
    select * into v_size from public.cake_sizes where id = v_size_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_size', 'message', 'المقاس المختار غير متاح.');
    end if;
    if v_cake_id is not null and not (v_cake.available_size_ids ? v_size_id) then
      -- allow two-tier sizes even if cake lists single sizes? Current MVP cakes list single only.
      -- Strict: size must be listed on cake when cake is selected.
      return jsonb_build_object('ok', false, 'code', 'invalid_size', 'message', 'المقاس غير متاح لهذا التصميم.');
    end if;
    v_size_label := v_size.label;
    v_base_price := v_size.price;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base',
      'label', 'سعر المقاس (' || v_size.label || ')',
      'amount', v_size.price,
      'status', 'known'
    ));
    v_total_price := v_size.price;
  end if;

  if v_filling_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'اختاري الحشوة.');
  end if;
  select * into v_filling from public.fillings where id = v_filling_id and enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'الحشوة المختارة غير متاحة.');
  end if;
  if v_cake_id is not null and not (v_cake.filling_ids ? v_filling_id) then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'الحشوة غير متاحة لهذا التصميم.');
  end if;

  if not (v_filling.id = 'none' and coalesce(v_filling.price, -1) = 0) then
    if v_filling.price is null then
      v_pending := array_append(v_pending, v_filling.name);
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'filling',
        'label', v_filling.name,
        'amount', null,
        'status', v_filling.price_status
      ));
    else
      v_filling_price := v_filling.price;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'filling',
        'label', v_filling.name,
        'amount', v_filling.price,
        'status', 'known'
      ));
      if v_total_price is not null then
        v_total_price := v_total_price + v_filling.price;
      end if;
    end if;
  end if;

  foreach v_extra_id in array v_extra_ids loop
    select * into v_extra from public.design_extras where id = v_extra_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_extra', 'message', 'إحدى إضافات التصميم غير متاحة.');
    end if;
    if v_cake_id is not null and not (v_cake.extra_ids ? v_extra_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_extra', 'message', 'إحدى الإضافات غير متاحة لهذا التصميم.');
    end if;

    v_extras_snapshot := v_extras_snapshot || jsonb_build_array(jsonb_build_object(
      'id', v_extra.id,
      'name', v_extra.name,
      'price', v_extra.price,
      'priceStatus', v_extra.price_status
    ));

    if v_extra.price is null then
      v_extras_complete := false;
      v_pending := array_append(v_pending, v_extra.name);
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_extra.id,
        'label', v_extra.name,
        'amount', null,
        'status', v_extra.price_status,
        'note', v_extra.description
      ));
    else
      v_known_extras_sum := v_known_extras_sum + v_extra.price;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_extra.id,
        'label', v_extra.name,
        'amount', v_extra.price,
        'status', 'known'
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
    -- Current business rule: Uber is outside cake price (no fixed fee seeded).
    v_delivery_price := null;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'delivery',
      'label', 'التوصيل',
      'amount', null,
      'status', 'outside',
      'note', 'التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.'
    ));
  end if;

  if v_reference_image is not null
     and v_reference_image !~ ('^' || v_id || '/reference\.(jpg|jpeg|png|webp)$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_reference', 'message', 'مسار الصورة المرجعية غير صالح.');
  end if;

  begin
    insert into public.orders (
      id, order_number, customer_name, phone, area, area_id, address_notes, service_type,
      cake_id, cake_name, design_mode, custom_design, reference_image, servings, size, size_id,
      event_date, event_time, filling, filling_id, filling_price, extras, notes,
      base_price, extras_price, delivery_price, total_price, pending_charges, price_lines,
      status, created_at
    ) values (
      v_id,
      v_order_number,
      v_customer_name,
      v_phone,
      case when v_service_type = 'delivery' then v_zone.name else null end,
      v_area_id,
      v_address_notes,
      v_service_type,
      v_cake_id,
      v_cake_name,
      v_design_mode,
      v_custom_design,
      v_reference_image,
      v_servings,
      v_size_label,
      v_size_id,
      v_event_date,
      v_event_time,
      v_filling.name,
      v_filling.id,
      v_filling_price,
      v_extras_snapshot,
      v_notes,
      v_base_price,
      v_extras_price,
      v_delivery_price,
      v_total_price,
      to_jsonb(v_pending),
      v_price_lines,
      'pending_review',
      now()
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_active_slot_uidx' then
        return jsonb_build_object(
          'ok', false,
          'code', 'slot_taken',
          'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.'
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'code', 'order_conflict',
        'message', 'تعذّر حفظ الطلب. أعيدي المحاولة.'
      );
  end;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_id,
      'orderNumber', v_order_number,
      'customerName', v_customer_name,
      'phone', v_phone,
      'area', case when v_service_type = 'delivery' then v_zone.name else null end,
      'areaId', v_area_id,
      'addressNotes', v_address_notes,
      'serviceType', v_service_type,
      'cakeId', v_cake_id,
      'cakeName', v_cake_name,
      'designMode', v_design_mode,
      'customDesign', v_custom_design,
      'referenceImage', v_reference_image,
      'servings', v_servings,
      'size', v_size_label,
      'sizeId', v_size_id,
      'date', v_event_date,
      'time', v_event_time,
      'filling', v_filling.name,
      'fillingId', v_filling.id,
      'fillingPrice', v_filling_price,
      'extras', v_extras_snapshot,
      'notes', v_notes,
      'basePrice', v_base_price,
      'extrasPrice', v_extras_price,
      'deliveryPrice', v_delivery_price,
      'totalPrice', v_total_price,
      'pendingCharges', to_jsonb(v_pending),
      'priceLines', v_price_lines,
      'status', 'pending_review',
      'createdAt', now()
    )
  );
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

-- Clear declared reference path if upload fails (pending + recent only).
-- Requires the exact path so callers cannot clear an arbitrary order by ID alone
-- without also knowing the declared object key.
create or replace function public.clear_order_reference_image(order_id text, expected_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if order_id is null or expected_path is null then
    return jsonb_build_object('ok', false, 'cleared', false);
  end if;

  if expected_path !~ ('^' || order_id || '/reference\.(jpg|jpeg|png|webp)$') then
    return jsonb_build_object('ok', false, 'cleared', false);
  end if;

  update public.orders
  set reference_image = null
  where id = order_id
    and status = 'pending_review'
    and created_at > now() - interval '30 minutes'
    and reference_image = expected_path;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true, 'cleared', v_updated > 0);
end;
$$;

drop function if exists public.clear_order_reference_image(text);
revoke all on function public.clear_order_reference_image(text, text) from public;
grant execute on function public.clear_order_reference_image(text, text) to anon, authenticated;

-- Storage policies cannot SELECT public.orders under anon RLS.
-- This helper runs as definer and returns only a boolean — no order rows leak.
create or replace function public.order_reference_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.reference_image = order_reference_upload_allowed.object_name
      and o.status = 'pending_review'
      and o.created_at > now() - interval '30 minutes'
      and order_reference_upload_allowed.object_name
            ~ ('^' || o.id || '/reference\.(jpg|jpeg|png|webp)$')
  );
$$;

revoke all on function public.order_reference_upload_allowed(text) from public;
grant execute on function public.order_reference_upload_allowed(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private order reference images
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'order-references',
  'order-references',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon_upload_order_reference" on storage.objects;
drop policy if exists "anon_read_order_reference" on storage.objects;
drop policy if exists "anon_update_order_reference" on storage.objects;
drop policy if exists "anon_delete_order_reference" on storage.objects;

-- INSERT only, and only to the exact path declared on a fresh pending order.
-- No SELECT / UPDATE / DELETE policies for anon => cannot read, list, overwrite, or delete.
create policy "anon_upload_order_reference"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'order-references'
    and name ~ '^[0-9a-fA-F-]{36}/reference\.(jpg|jpeg|png|webp)$'
    and public.order_reference_upload_allowed(name)
  );

-- ---------------------------------------------------------------------------
-- Seed: MVP catalog / pricing (exact reference prices)
-- ---------------------------------------------------------------------------

insert into public.cake_sizes (id, pricing_group, label, servings_label, servings_min, servings_max, price, sort_order) values
  ('single-14', 'single', '14 سم', '4 أفراد', 4, 4, 500, 10),
  ('single-16', 'single', '16 سم', '7 أفراد', 7, 7, 600, 20),
  ('single-18', 'single', '18 سم', '10 أفراد', 10, 10, 700, 30),
  ('single-20', 'single', '20 سم', '15 فرد', 15, 15, 800, 40),
  ('single-24', 'single', '24 سم', '20 - 23 فرد', 20, 23, 1100, 50),
  ('single-26', 'single', '26 سم', '25 - 27 فرد', 25, 27, 1350, 60),
  ('single-30', 'single', '30 سم', '30 - 35 فرد', 30, 35, 1700, 70),
  ('tier-14-20', 'two-tier', '14 فوق × 20 تحت', '20 فرد', 20, 20, 1500, 110),
  ('tier-18-24', 'two-tier', '18 فوق × 24 تحت', '30 فرد', 30, 30, 1800, 120),
  ('tier-20-26', 'two-tier', '20 فوق × 26 تحت', '35 فرد', 35, 35, 2200, 130),
  ('tier-24-30', 'two-tier', '24 فوق × 30 تحت', '50+ فرد', 50, null, 2600, 140)
on conflict (id) do update set
  pricing_group = excluded.pricing_group,
  label = excluded.label,
  servings_label = excluded.servings_label,
  servings_min = excluded.servings_min,
  servings_max = excluded.servings_max,
  price = excluded.price,
  sort_order = excluded.sort_order,
  enabled = true;

insert into public.fillings (id, name, description, price, price_status, sort_order) values
  ('none', 'بدون حشوة إضافية', 'التورتة بدون حشوة مضافة.', 0, 'known', 10),
  ('nutella', 'نوتيلا', 'السعر غير محدد بعد.', null, 'pending', 20),
  ('blueberry', 'توت أزرق', 'السعر غير محدد بعد.', null, 'pending', 30),
  ('mango', 'مانجا', 'السعر غير محدد بعد.', null, 'pending', 40)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  price_status = excluded.price_status,
  sort_order = excluded.sort_order,
  enabled = true;

insert into public.design_extras (id, name, description, price, price_status, sort_order) values
  ('sugar-figures', 'مجسمات عجينة سكر', 'يتم تحديد السعر بعد المعاينة حسب حجم المجسم وتعقيده.', null, 'quote', 10),
  ('edible-print', 'صور قابلة للأكل', 'السعر غير محدد بعد.', null, 'pending', 20)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  price = excluded.price,
  price_status = excluded.price_status,
  sort_order = excluded.sort_order,
  enabled = true;

insert into public.delivery_zones (id, name, enabled, sort_order) values
  ('cairo', 'القاهرة', true, 10),
  ('giza', 'الجيزة', true, 20)
on conflict (id) do update set
  name = excluded.name,
  enabled = excluded.enabled,
  sort_order = excluded.sort_order;

insert into public.cakes (
  id, name, description, image_key, image_alt, image_position, category, pricing_group,
  base_price, price_note, serving_info, available_size_ids, filling_ids, extra_ids, sort_order
) values
  (
    'butterflies', 'تورتة الفراشات', 'تورتة وردية بفراشات ولمسات ذهبية.',
    'butterflies', 'تورتة وردية مزينة بفراشات وخرز لؤلؤ', 'center', 'birthday', 'single',
    null,
    'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.',
    'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.',
    '["single-14","single-16","single-18","single-20","single-24","single-26","single-30"]'::jsonb,
    '["none","nutella","blueberry","mango"]'::jsonb,
    '["sugar-figures","edible-print"]'::jsonb,
    10
  ),
  (
    'flowers', 'تورتة الورود', 'كريمة بيضاء مع ورود وردية وكريمية ولمعة ذهبية.',
    'flowers', 'تورتة بيضاء مزينة بورود وردية وكريمية وورق ذهب', 'center', 'celebration', 'single',
    null,
    'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.',
    'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.',
    '["single-14","single-16","single-18","single-20","single-24","single-26","single-30"]'::jsonb,
    '["none","nutella","blueberry","mango"]'::jsonb,
    '["sugar-figures","edible-print"]'::jsonb,
    20
  ),
  (
    'ribbons', 'تورتة الفيونكات', 'حواف مزخرفة وفيونكات، مناسبة لعيد الميلاد.',
    'ribbons', 'تورتة بنفسجية فاتحة بحواف مزخرفة وفيونكات', 'center', 'birthday', 'single',
    null,
    'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.',
    'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.',
    '["single-14","single-16","single-18","single-20","single-24","single-26","single-30"]'::jsonb,
    '["none","nutella","blueberry","mango"]'::jsonb,
    '["sugar-figures","edible-print"]'::jsonb,
    30
  ),
  (
    'gold-butterflies', 'تورتة الفراشات الذهبية', 'سطح وردي مع فراشات وورق ذهب.',
    'gold-butterflies', 'تورتة وردية بفراشات ذهبية وكتابة على السطح', 'center', 'birthday', 'single',
    null,
    'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.',
    'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.',
    '["single-14","single-16","single-18","single-20","single-24","single-26","single-30"]'::jsonb,
    '["none","nutella","blueberry","mango"]'::jsonb,
    '["sugar-figures","edible-print"]'::jsonb,
    40
  ),
  (
    'pearls', 'تورتة اللؤلؤ', 'خرز لؤلؤ وفراشات وردية مع رقم في المنتصف.',
    'pearls', 'تورتة وردية بلؤلؤ وفراشات ورقم من الخرز', 'center', 'birthday', 'single',
    null,
    'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.',
    'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.',
    '["single-14","single-16","single-18","single-20","single-24","single-26","single-30"]'::jsonb,
    '["none","nutella","blueberry","mango"]'::jsonb,
    '["sugar-figures","edible-print"]'::jsonb,
    50
  ),
  (
    'bouquet', 'بوكيه الورد', 'تورتة على شكل بوكيه ورد، مع فيونكة.',
    'bouquet', 'تورتة على شكل بوكيه ورد خوخي مع فيونكة ذهبية', 'center 40%', 'celebration', 'single',
    null,
    'السعر حسب المقاس من قائمة التورت الأساسية. تفاصيل التصميم خارج القائمة تُراجع قبل التأكيد.',
    'عدد الأفراد يحدد المقاس المناسب من قائمة الأسعار.',
    '["single-14","single-16","single-18","single-20","single-24","single-26","single-30"]'::jsonb,
    '["none","nutella","blueberry","mango"]'::jsonb,
    '["sugar-figures","edible-print"]'::jsonb,
    60
  )
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  image_key = excluded.image_key,
  image_alt = excluded.image_alt,
  image_position = excluded.image_position,
  category = excluded.category,
  pricing_group = excluded.pricing_group,
  base_price = excluded.base_price,
  price_note = excluded.price_note,
  serving_info = excluded.serving_info,
  available_size_ids = excluded.available_size_ids,
  filling_ids = excluded.filling_ids,
  extra_ids = excluded.extra_ids,
  sort_order = excluded.sort_order,
  enabled = true;

-- Allow two-tier sizes on catalog cakes (structure choice in the order flow).
update public.cakes
set available_size_ids = (
  select coalesce(jsonb_agg(id order by sort_order), '[]'::jsonb)
  from public.cake_sizes
  where enabled = true
)
where enabled = true;

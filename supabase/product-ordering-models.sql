-- Misteka — Configuration-driven product ordering models
-- Apply AFTER: products-system.sql, order-products-offers.sql
-- Additive only. Does NOT rewrite historical orders. Does NOT drop cake tables.
-- Safe to re-run.

-- ---------------------------------------------------------------------------
-- products: ordering model + quantity bounds
-- ---------------------------------------------------------------------------

alter table public.products
  add column if not exists ordering_model text;

alter table public.products
  add column if not exists qty_min integer;

alter table public.products
  add column if not exists qty_max integer;

alter table public.products
  add column if not exists qty_step integer;

alter table public.products drop constraint if exists products_ordering_model_check;
alter table public.products
  add constraint products_ordering_model_check
  check (
    ordering_model is null
    or ordering_model in (
      'cake_servings', 'quantity', 'fixed_item', 'weight', 'quote', 'custom'
    )
  );

alter table public.products drop constraint if exists products_qty_bounds_check;
alter table public.products
  add constraint products_qty_bounds_check
  check (
    qty_min is null
    or (
      qty_min >= 1
      and (qty_max is null or qty_max >= qty_min)
      and (qty_step is null or qty_step >= 1)
    )
  );

-- Backfill from legacy pricing_mode (product config remains authoritative after this)
update public.products
set ordering_model = case pricing_mode
  when 'cake_sizes' then 'cake_servings'
  when 'fixed' then 'fixed_item'
  when 'quote' then 'quote'
  else 'fixed_item'
end
where ordering_model is null;

alter table public.products
  alter column ordering_model set default 'fixed_item';

update public.products set ordering_model = 'fixed_item' where ordering_model is null;
alter table public.products alter column ordering_model set not null;

update public.products
set qty_min = coalesce(qty_min, 1),
    qty_max = coalesce(qty_max, 99),
    qty_step = coalesce(qty_step, 1)
where ordering_model in ('quantity', 'custom')
  and (qty_min is null or qty_max is null or qty_step is null);

-- Keep pricing_mode in sync for older readers (additive compatibility)
create or replace function public.sync_pricing_mode_from_ordering_model()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.pricing_mode := case new.ordering_model
    when 'cake_servings' then 'cake_sizes'
    when 'quote' then 'quote'
    when 'fixed_item' then 'fixed'
    else 'fixed'
  end;
  if new.ordering_model = 'cake_servings' and new.legacy_cake_id is null then
    raise exception 'cake_servings requires legacy_cake_id';
  end if;
  return new;
end;
$$;

drop trigger if exists products_sync_pricing_mode on public.products;
create trigger products_sync_pricing_mode
  before insert or update of ordering_model, legacy_cake_id
  on public.products
  for each row execute function public.sync_pricing_mode_from_ordering_model();

-- ---------------------------------------------------------------------------
-- product_price_tiers: packages / quantity ranges / weight / unit markers
-- ---------------------------------------------------------------------------

create table if not exists public.product_price_tiers (
  id text primary key,
  product_id text not null references public.products (id) on update cascade on delete cascade,
  tier_kind text not null
    check (tier_kind in ('package', 'quantity_range', 'weight', 'unit')),
  label text not null check (length(btrim(label)) > 0),
  -- package: exact quantity in the pack
  package_qty integer check (package_qty is null or package_qty > 0),
  -- quantity_range: inclusive band; price is per-unit within band
  qty_min integer check (qty_min is null or qty_min > 0),
  qty_max integer check (qty_max is null or qty_max > 0),
  -- weight: grams
  weight_grams integer check (weight_grams is null or weight_grams > 0),
  price numeric not null check (price >= 0),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint product_price_tiers_package_ok check (
    tier_kind <> 'package' or package_qty is not null
  ),
  constraint product_price_tiers_range_ok check (
    tier_kind <> 'quantity_range'
    or (qty_min is not null and qty_max is not null and qty_max >= qty_min)
  ),
  constraint product_price_tiers_weight_ok check (
    tier_kind <> 'weight' or weight_grams is not null
  )
);

create index if not exists product_price_tiers_product_idx
  on public.product_price_tiers (product_id, sort_order);

alter table public.product_price_tiers enable row level security;

grant select on table public.product_price_tiers to anon, authenticated;
grant insert, update, delete on table public.product_price_tiers to authenticated;

drop policy if exists "public_read_enabled_product_price_tiers" on public.product_price_tiers;
drop policy if exists "admin_select_product_price_tiers" on public.product_price_tiers;
drop policy if exists "admin_insert_product_price_tiers" on public.product_price_tiers;
drop policy if exists "admin_update_product_price_tiers" on public.product_price_tiers;
drop policy if exists "admin_delete_product_price_tiers" on public.product_price_tiers;

create policy "public_read_enabled_product_price_tiers"
  on public.product_price_tiers for select to anon, authenticated
  using (
    enabled = true
    and exists (
      select 1 from public.products p
      join public.product_categories c on c.id = p.category_id
      where p.id = product_id and p.enabled = true and c.enabled = true
    )
  );

create policy "admin_select_product_price_tiers"
  on public.product_price_tiers for select to authenticated
  using (public.is_admin());

create policy "admin_insert_product_price_tiers"
  on public.product_price_tiers for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_product_price_tiers"
  on public.product_price_tiers for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_product_price_tiers"
  on public.product_price_tiers for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Reusable option library
-- ---------------------------------------------------------------------------

create table if not exists public.option_definitions (
  id text primary key,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  selection_type text not null default 'single'
    check (selection_type in ('toggle', 'single', 'multi', 'text', 'textarea', 'quantity')),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists option_definitions_enabled_idx
  on public.option_definitions (enabled, sort_order);

drop trigger if exists option_definitions_set_updated_at on public.option_definitions;
create trigger option_definitions_set_updated_at
  before update on public.option_definitions
  for each row execute function public.set_updated_at();

create table if not exists public.option_definition_values (
  id text primary key,
  definition_id text not null references public.option_definitions (id)
    on update cascade on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  price_adjustment numeric not null default 0 check (price_adjustment >= 0),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists option_definition_values_def_idx
  on public.option_definition_values (definition_id, sort_order);

create table if not exists public.product_option_links (
  id text primary key,
  product_id text not null references public.products (id) on update cascade on delete cascade,
  definition_id text not null references public.option_definitions (id)
    on update cascade on delete restrict,
  required boolean not null default false,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (product_id, definition_id)
);

create index if not exists product_option_links_product_idx
  on public.product_option_links (product_id, sort_order);

-- Optional per-product value price overrides (still one reusable definition)
create table if not exists public.product_option_link_value_overrides (
  id text primary key,
  link_id text not null references public.product_option_links (id)
    on update cascade on delete cascade,
  definition_value_id text not null references public.option_definition_values (id)
    on update cascade on delete cascade,
  price_adjustment numeric not null check (price_adjustment >= 0),
  enabled boolean,
  unique (link_id, definition_value_id)
);

alter table public.option_definitions enable row level security;
alter table public.option_definition_values enable row level security;
alter table public.product_option_links enable row level security;
alter table public.product_option_link_value_overrides enable row level security;

grant select on table public.option_definitions to anon, authenticated;
grant select on table public.option_definition_values to anon, authenticated;
grant select on table public.product_option_links to anon, authenticated;
grant select on table public.product_option_link_value_overrides to anon, authenticated;
grant insert, update, delete on table public.option_definitions to authenticated;
grant insert, update, delete on table public.option_definition_values to authenticated;
grant insert, update, delete on table public.product_option_links to authenticated;
grant insert, update, delete on table public.product_option_link_value_overrides to authenticated;

drop policy if exists "public_read_enabled_option_definitions" on public.option_definitions;
drop policy if exists "admin_all_option_definitions" on public.option_definitions;
create policy "public_read_enabled_option_definitions"
  on public.option_definitions for select to anon, authenticated
  using (enabled = true);
create policy "admin_select_option_definitions"
  on public.option_definitions for select to authenticated using (public.is_admin());
create policy "admin_insert_option_definitions"
  on public.option_definitions for insert to authenticated with check (public.is_admin());
create policy "admin_update_option_definitions"
  on public.option_definitions for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_option_definitions"
  on public.option_definitions for delete to authenticated using (public.is_admin());

drop policy if exists "public_read_enabled_option_definition_values" on public.option_definition_values;
create policy "public_read_enabled_option_definition_values"
  on public.option_definition_values for select to anon, authenticated
  using (
    enabled = true
    and exists (select 1 from public.option_definitions d where d.id = definition_id and d.enabled = true)
  );
create policy "admin_select_option_definition_values"
  on public.option_definition_values for select to authenticated using (public.is_admin());
create policy "admin_insert_option_definition_values"
  on public.option_definition_values for insert to authenticated with check (public.is_admin());
create policy "admin_update_option_definition_values"
  on public.option_definition_values for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_option_definition_values"
  on public.option_definition_values for delete to authenticated using (public.is_admin());

drop policy if exists "public_read_product_option_links" on public.product_option_links;
create policy "public_read_product_option_links"
  on public.product_option_links for select to anon, authenticated
  using (
    enabled = true
    and exists (
      select 1 from public.products p
      where p.id = product_id and p.enabled = true
    )
  );
create policy "admin_select_product_option_links"
  on public.product_option_links for select to authenticated using (public.is_admin());
create policy "admin_insert_product_option_links"
  on public.product_option_links for insert to authenticated with check (public.is_admin());
create policy "admin_update_product_option_links"
  on public.product_option_links for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_product_option_links"
  on public.product_option_links for delete to authenticated using (public.is_admin());

drop policy if exists "public_read_product_option_link_value_overrides" on public.product_option_link_value_overrides;
create policy "public_read_product_option_link_value_overrides"
  on public.product_option_link_value_overrides for select to anon, authenticated
  using (
    exists (
      select 1 from public.product_option_links l
      where l.id = link_id and l.enabled = true
    )
  );
create policy "admin_select_product_option_link_value_overrides"
  on public.product_option_link_value_overrides for select to authenticated using (public.is_admin());
create policy "admin_insert_product_option_link_value_overrides"
  on public.product_option_link_value_overrides for insert to authenticated with check (public.is_admin());
create policy "admin_update_product_option_link_value_overrides"
  on public.product_option_link_value_overrides for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin_delete_product_option_link_value_overrides"
  on public.product_option_link_value_overrides for delete to authenticated using (public.is_admin());

-- Seed a reusable sugar-paste option (idempotent; attach via admin)
insert into public.option_definitions (id, name, description, selection_type, sort_order, enabled)
values (
  'opt-sugar-paste',
  'عجينة سكر للتزيين',
  'إضافة عجينة سكر اختيارية للتزيين',
  'toggle',
  10,
  true
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  selection_type = excluded.selection_type,
  updated_at = now();

insert into public.option_definition_values (id, definition_id, name, price_adjustment, sort_order, enabled)
values ('opt-sugar-paste-yes', 'opt-sugar-paste', 'نعم', 50, 1, true)
on conflict (id) do update set
  name = excluded.name,
  price_adjustment = excluded.price_adjustment,
  enabled = excluded.enabled;

-- ---------------------------------------------------------------------------
-- Price resolution helper (tiers + models). Never trusts client prices.
-- ---------------------------------------------------------------------------

create or replace function public.order_resolve_configured_price(
  p_product_id text,
  p_size_id text default null,
  p_price_tier_id text default null,
  p_quantity integer default 1
)
returns table (
  ok boolean,
  code text,
  message text,
  product_name text,
  unit_price numeric,
  line_qty integer,
  pending boolean,
  ordering_model text,
  tier_id text,
  tier_label text,
  size_label text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_category public.product_categories%rowtype;
  v_cake public.cakes%rowtype;
  v_size public.cake_sizes%rowtype;
  v_tier public.product_price_tiers%rowtype;
  v_qty integer := coalesce(p_quantity, 1);
  v_step integer;
begin
  select * into v_product from public.products where id = p_product_id;
  if not found or v_product.enabled is distinct from true then
    return query select false, 'invalid_product', 'المنتج المختار غير متاح.', null::text, null::numeric, 1, false, null::text, null::text, null::text, null::text;
    return;
  end if;

  select * into v_category from public.product_categories where id = v_product.category_id;
  if not found or v_category.enabled is distinct from true then
    return query select false, 'invalid_product', 'تصنيف المنتج غير متاح.', null::text, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
    return;
  end if;

  while v_category.parent_id is not null loop
    select * into v_category from public.product_categories where id = v_category.parent_id;
    if not found or v_category.enabled is distinct from true then
      return query select false, 'invalid_product', 'تصنيف المنتج غير متاح.', null::text, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
  end loop;

  if v_product.ordering_model = 'quote' then
    return query select false, 'quote_only', 'هذا المنتج يتطلب طلب سعر، وليس طلبًا مدفوعًا.', v_product.name, null::numeric, 1, true, v_product.ordering_model, null::text, null::text, null::text;
    return;
  end if;

  -- Cake servings (legacy sizes)
  if v_product.ordering_model = 'cake_servings' then
    if v_product.legacy_cake_id is null then
      return query select false, 'invalid_product', 'منتج التورت غير مربوط بمقاس.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    select * into v_cake from public.cakes where id = v_product.legacy_cake_id and enabled = true;
    if not found then
      return query select false, 'invalid_product', 'التورتة المرتبطة غير متاحة.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    if p_size_id is null or p_size_id = '' or p_size_id = 'custom' then
      return query select false, 'invalid_size', 'اختاري المقاس.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    select * into v_size from public.cake_sizes where id = p_size_id and enabled = true;
    if not found then
      return query select false, 'invalid_size', 'المقاس المختار غير متاح.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    if v_cake.available_size_ids is not null
       and jsonb_typeof(v_cake.available_size_ids) = 'array'
       and not (v_cake.available_size_ids ? p_size_id) then
      return query select false, 'invalid_size', 'المقاس غير متاح لهذا المنتج.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    return query select true, null::text, null::text, v_product.name, v_size.price, 1, false, v_product.ordering_model, null::text, null::text, v_size.label;
    return;
  end if;

  -- Fixed item
  if v_product.ordering_model = 'fixed_item' then
    if v_product.fixed_price is null then
      return query select false, 'invalid_product_price', 'سعر المنتج غير مُعد.', v_product.name, null::numeric, 1, true, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    return query select true, null::text, null::text, v_product.name, v_product.fixed_price, 1, false, v_product.ordering_model, null::text, null::text, 'منتج'::text;
    return;
  end if;

  -- Weight: must pick a weight tier
  if v_product.ordering_model = 'weight' then
    if p_price_tier_id is null or p_price_tier_id = '' then
      return query select false, 'invalid_tier', 'اختاري الوزن.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    select * into v_tier from public.product_price_tiers
    where id = p_price_tier_id and product_id = p_product_id and enabled = true and tier_kind = 'weight';
    if not found then
      return query select false, 'invalid_tier', 'خيار الوزن غير صالح.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    return query select true, null::text, null::text, v_product.name, v_tier.price, 1, false, v_product.ordering_model, v_tier.id, v_tier.label, v_tier.label;
    return;
  end if;

  -- Quantity / custom: packages, ranges, or per-unit
  if v_product.ordering_model in ('quantity', 'custom') then
    -- Explicit package / unit tier selection
    if p_price_tier_id is not null and p_price_tier_id <> '' then
      select * into v_tier from public.product_price_tiers
      where id = p_price_tier_id and product_id = p_product_id and enabled = true;
      if not found then
        return query select false, 'invalid_tier', 'الباقة أو الشريحة غير صالحة.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
        return;
      end if;
      if v_tier.tier_kind = 'package' then
        return query select true, null::text, null::text, v_product.name, v_tier.price, v_tier.package_qty, false, v_product.ordering_model, v_tier.id, v_tier.label, v_tier.label;
        return;
      end if;
      if v_tier.tier_kind = 'unit' then
        v_step := coalesce(v_product.qty_step, 1);
        if v_qty < coalesce(v_product.qty_min, 1)
           or v_qty > coalesce(v_product.qty_max, 99)
           or ((v_qty - coalesce(v_product.qty_min, 1)) % v_step) <> 0 then
          return query select false, 'invalid_quantity', 'الكمية غير صالحة.', v_product.name, null::numeric, v_qty, false, v_product.ordering_model, null::text, null::text, null::text;
          return;
        end if;
        return query select true, null::text, null::text, v_product.name, v_tier.price, v_qty, false, v_product.ordering_model, v_tier.id, v_tier.label, v_tier.label;
        return;
      end if;
      if v_tier.tier_kind = 'quantity_range' then
        if v_qty < v_tier.qty_min or v_qty > v_tier.qty_max then
          return query select false, 'invalid_quantity', 'الكمية خارج شريحة السعر.', v_product.name, null::numeric, v_qty, false, v_product.ordering_model, null::text, null::text, null::text;
          return;
        end if;
        return query select true, null::text, null::text, v_product.name, v_tier.price, v_qty, false, v_product.ordering_model, v_tier.id, v_tier.label, v_tier.label;
        return;
      end if;
      return query select false, 'invalid_tier', 'نوع الشريحة غير مدعوم هنا.', v_product.name, null::numeric, v_qty, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;

    -- No tier id: require package list OR resolve by quantity against ranges / unit price
    if exists (
      select 1 from public.product_price_tiers t
      where t.product_id = p_product_id and t.enabled and t.tier_kind = 'package'
    ) then
      return query select false, 'invalid_tier', 'اختاري الباقة.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;

    -- quantity_range match
    select * into v_tier from public.product_price_tiers t
    where t.product_id = p_product_id and t.enabled and t.tier_kind = 'quantity_range'
      and v_qty between t.qty_min and t.qty_max
    order by t.sort_order
    limit 1;
    if found then
      return query select true, null::text, null::text, v_product.name, v_tier.price, v_qty, false, v_product.ordering_model, v_tier.id, v_tier.label, v_tier.label;
      return;
    end if;

    -- per-unit via fixed_price
    if v_product.fixed_price is null then
      return query select false, 'invalid_product_price', 'سعر المنتج غير مُعد.', v_product.name, null::numeric, v_qty, true, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    v_step := coalesce(v_product.qty_step, 1);
    if v_qty < coalesce(v_product.qty_min, 1)
       or v_qty > coalesce(v_product.qty_max, 99)
       or ((v_qty - coalesce(v_product.qty_min, 1)) % v_step) <> 0 then
      return query select false, 'invalid_quantity', 'الكمية غير صالحة.', v_product.name, null::numeric, v_qty, false, v_product.ordering_model, null::text, null::text, null::text;
      return;
    end if;
    return query select true, null::text, null::text, v_product.name, v_product.fixed_price, v_qty, false, v_product.ordering_model, null::text, null::text, 'كمية'::text;
    return;
  end if;

  return query select false, 'invalid_product', 'طريقة البيع غير معروفة.', v_product.name, null::numeric, 1, false, v_product.ordering_model, null::text, null::text, null::text;
end;
$$;

revoke all on function public.order_resolve_configured_price(text, text, text, integer) from public;
revoke all on function public.order_resolve_configured_price(text, text, text, integer) from anon, authenticated;

-- Resolve linked library options + legacy per-product options
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

  -- Required linked definitions (non-text)
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

-- Keep legacy helper as thin wrapper for older callers / cake paths
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

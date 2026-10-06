-- Misteka Cakes — Flexible products / categories / options / offers
-- Apply AFTER: schema.sql, admin-dashboard.sql, admin-catalog.sql, admin-cms.sql
-- Safe to re-run. Preserves cakes, cake_sizes, fillings, design_extras, orders, place_order.
--
-- Strategy:
--   • product_categories = hierarchical taxonomy (source of truth for catalog nav)
--   • cake_categories stays for cakes.category FK; synced for cake leaf categories
--   • products wraps catalog items; cake products link via legacy_cake_id
--   • product_options / product_option_values = reusable add-ons
--   • offers / offer_components = promotional bundles
-- Public: read enabled/visible rows only. Writes: is_admin() only.

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- product_categories
-- ---------------------------------------------------------------------------

create table if not exists public.product_categories (
  id text primary key,
  parent_id text references public.product_categories (id) on update cascade on delete restrict,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  kind text not null default 'standard'
    check (kind in ('standard', 'offers')),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_categories_no_self_parent check (parent_id is distinct from id),
  constraint product_categories_offers_is_root check (
    kind <> 'offers' or parent_id is null
  )
);

create index if not exists product_categories_parent_idx
  on public.product_categories (parent_id, sort_order);
create index if not exists product_categories_enabled_idx
  on public.product_categories (enabled, sort_order);

drop trigger if exists product_categories_set_updated_at on public.product_categories;
create trigger product_categories_set_updated_at
  before update on public.product_categories
  for each row execute function public.set_updated_at();

alter table public.product_categories enable row level security;

grant select on table public.product_categories to anon, authenticated;
grant insert, update, delete on table public.product_categories to authenticated;

drop policy if exists "public_read_enabled_product_categories" on public.product_categories;
drop policy if exists "admin_select_all_product_categories" on public.product_categories;
drop policy if exists "admin_insert_product_categories" on public.product_categories;
drop policy if exists "admin_update_product_categories" on public.product_categories;
drop policy if exists "admin_delete_product_categories" on public.product_categories;

create policy "public_read_enabled_product_categories"
  on public.product_categories for select to anon, authenticated
  using (enabled = true);

create policy "admin_select_all_product_categories"
  on public.product_categories for select to authenticated
  using (public.is_admin());

create policy "admin_insert_product_categories"
  on public.product_categories for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_product_categories"
  on public.product_categories for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_product_categories"
  on public.product_categories for delete to authenticated
  using (public.is_admin());

-- Seed top-level + requested subcategories (idempotent)
insert into public.product_categories (id, parent_id, name, description, kind, sort_order, enabled) values
  ('cat-cakes', null, 'التورت', 'تورت حسب المقاس والحشوة', 'standard', 10, true),
  ('cat-cupcakes', null, 'كب كيك', '', 'standard', 20, true),
  ('cat-cakepops', null, 'كيك بوبس', '', 'standard', 30, true),
  ('cat-donuts', null, 'دونتس', '', 'standard', 40, true),
  ('cat-cookies', null, 'كوكيز', '', 'standard', 50, true),
  ('cat-offers', null, 'العروض والباقات', 'عروض وباقات ترويجية', 'offers', 60, true),
  -- Preserve existing cake category IDs under التورت
  ('birthday', 'cat-cakes', 'أعياد ميلاد', '', 'standard', 10, true),
  ('celebration', 'cat-cakes', 'مناسبات', '', 'standard', 20, true),
  -- Cupcakes
  ('cupcake-chocolate', 'cat-cupcakes', 'شوكولاتة', '', 'standard', 10, true),
  ('cupcake-vanilla', 'cat-cupcakes', 'فانيليا', '', 'standard', 20, true),
  ('cupcake-red-velvet', 'cat-cupcakes', 'ريد فلفيت', '', 'standard', 30, true),
  -- Cake pops
  ('cakepop-chocolate', 'cat-cakepops', 'شوكولاتة', '', 'standard', 10, true),
  ('cakepop-vanilla', 'cat-cakepops', 'فانيليا', '', 'standard', 20, true),
  -- Donuts
  ('donut-dark-chocolate', 'cat-donuts', 'شوكولاتة بني', '', 'standard', 10, true),
  ('donut-white-chocolate', 'cat-donuts', 'شوكولاتة بيضاء', '', 'standard', 20, true),
  -- Cookies
  ('cookie-american', 'cat-cookies', 'أمريكان كوكيز', '', 'standard', 10, true)
on conflict (id) do update set
  parent_id = excluded.parent_id,
  name = excluded.name,
  kind = excluded.kind,
  sort_order = excluded.sort_order,
  updated_at = now();

-- Keep cake_categories in sync for birthday/celebration (cakes.category FK)
insert into public.cake_categories (id, name, description, sort_order, enabled)
select id, name, description, sort_order, enabled
from public.product_categories
where id in ('birthday', 'celebration')
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled;

-- Sync trigger: cake leaf categories under التورت mirror into cake_categories
create or replace function public.sync_cake_category_from_product_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    -- Only attempt delete of unused cake_categories; ignore if cakes still reference
    if old.parent_id = 'cat-cakes' then
      begin
        delete from public.cake_categories where id = old.id;
      exception when foreign_key_violation then
        null;
      end;
    end if;
    return old;
  end if;

  if new.parent_id = 'cat-cakes' and new.kind = 'standard' then
    insert into public.cake_categories (id, name, description, sort_order, enabled)
    values (new.id, new.name, new.description, new.sort_order, new.enabled)
    on conflict (id) do update set
      name = excluded.name,
      description = excluded.description,
      sort_order = excluded.sort_order,
      enabled = excluded.enabled;
  end if;
  return new;
end;
$$;

drop trigger if exists product_categories_sync_cake_categories on public.product_categories;
create trigger product_categories_sync_cake_categories
  after insert or update or delete on public.product_categories
  for each row execute function public.sync_cake_category_from_product_category();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table if not exists public.products (
  id text primary key,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  category_id text not null references public.product_categories (id)
    on update cascade on delete restrict,
  pricing_mode text not null default 'fixed'
    check (pricing_mode in ('cake_sizes', 'fixed', 'quote')),
  fixed_price numeric check (fixed_price is null or fixed_price >= 0),
  price_note text not null default '',
  legacy_cake_id text unique references public.cakes (id)
    on update cascade on delete set null,
  image_key text not null default '',
  image_alt text not null default '',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_cake_sizes_need_legacy check (
    pricing_mode <> 'cake_sizes' or legacy_cake_id is not null
  )
);

create index if not exists products_category_idx on public.products (category_id, sort_order);
create index if not exists products_enabled_idx on public.products (enabled, sort_order);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row execute function public.set_updated_at();

alter table public.products enable row level security;

grant select on table public.products to anon, authenticated;
grant insert, update, delete on table public.products to authenticated;

drop policy if exists "public_read_enabled_products" on public.products;
drop policy if exists "admin_select_all_products" on public.products;
drop policy if exists "admin_insert_products" on public.products;
drop policy if exists "admin_update_products" on public.products;
drop policy if exists "admin_delete_products" on public.products;

drop policy if exists "public_read_enabled_products" on public.products;
create policy "public_read_enabled_products"
  on public.products for select to anon, authenticated
  using (
    enabled = true
    and exists (
      select 1 from public.product_categories c
      where c.id = category_id and c.enabled = true
    )
  );

create policy "admin_select_all_products"
  on public.products for select to authenticated
  using (public.is_admin());

create policy "admin_insert_products"
  on public.products for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_products"
  on public.products for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_products"
  on public.products for delete to authenticated
  using (public.is_admin());

-- Migrate existing cakes → products (same id, no duplicates)
insert into public.products (
  id, name, description, category_id, pricing_mode, fixed_price, price_note,
  legacy_cake_id, image_key, image_alt, sort_order, enabled
)
select
  c.id,
  c.name,
  c.description,
  c.category,
  'cake_sizes',
  null,
  coalesce(c.price_note, ''),
  c.id,
  c.image_key,
  coalesce(nullif(c.image_alt, ''), c.name),
  c.sort_order,
  c.enabled
from public.cakes c
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  category_id = excluded.category_id,
  pricing_mode = 'cake_sizes',
  legacy_cake_id = excluded.legacy_cake_id,
  image_key = excluded.image_key,
  image_alt = excluded.image_alt,
  sort_order = excluded.sort_order,
  enabled = excluded.enabled,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- product_images (gallery; primary image also mirrored on products.image_key)
-- ---------------------------------------------------------------------------

create table if not exists public.product_images (
  id text primary key,
  product_id text not null references public.products (id) on update cascade on delete cascade,
  image_key text not null check (length(btrim(image_key)) > 0),
  image_alt text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists product_images_product_idx
  on public.product_images (product_id, sort_order);

alter table public.product_images enable row level security;

grant select on table public.product_images to anon, authenticated;
grant insert, update, delete on table public.product_images to authenticated;

drop policy if exists "public_read_product_images" on public.product_images;
drop policy if exists "admin_select_product_images" on public.product_images;
drop policy if exists "admin_insert_product_images" on public.product_images;
drop policy if exists "admin_update_product_images" on public.product_images;
drop policy if exists "admin_delete_product_images" on public.product_images;

-- Public can read images only for enabled products
create policy "public_read_product_images"
  on public.product_images for select to anon, authenticated
  using (
    exists (
      select 1 from public.products p
      where p.id = product_id and p.enabled = true
    )
  );

create policy "admin_select_product_images"
  on public.product_images for select to authenticated
  using (public.is_admin());

create policy "admin_insert_product_images"
  on public.product_images for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_product_images"
  on public.product_images for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_product_images"
  on public.product_images for delete to authenticated
  using (public.is_admin());

-- Seed primary images for migrated cakes
insert into public.product_images (id, product_id, image_key, image_alt, sort_order)
select
  c.id || '-img-1',
  c.id,
  c.image_key,
  coalesce(nullif(c.image_alt, ''), c.name),
  0
from public.cakes c
where c.image_key is not null and length(btrim(c.image_key)) > 0
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- product_options + product_option_values (reusable add-ons)
-- ---------------------------------------------------------------------------

create table if not exists public.product_options (
  id text primary key,
  product_id text not null references public.products (id) on update cascade on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  selection_type text not null default 'toggle'
    check (selection_type in ('toggle', 'single', 'multi')),
  required boolean not null default false,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_options_product_idx
  on public.product_options (product_id, sort_order);

drop trigger if exists product_options_set_updated_at on public.product_options;
create trigger product_options_set_updated_at
  before update on public.product_options
  for each row execute function public.set_updated_at();

create table if not exists public.product_option_values (
  id text primary key,
  option_id text not null references public.product_options (id) on update cascade on delete cascade,
  name text not null check (length(btrim(name)) > 0),
  price_adjustment numeric not null default 0 check (price_adjustment >= 0),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists product_option_values_option_idx
  on public.product_option_values (option_id, sort_order);

alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;

grant select on table public.product_options to anon, authenticated;
grant insert, update, delete on table public.product_options to authenticated;
grant select on table public.product_option_values to anon, authenticated;
grant insert, update, delete on table public.product_option_values to authenticated;

drop policy if exists "public_read_enabled_product_options" on public.product_options;
drop policy if exists "admin_all_select_product_options" on public.product_options;
drop policy if exists "admin_insert_product_options" on public.product_options;
drop policy if exists "admin_update_product_options" on public.product_options;
drop policy if exists "admin_delete_product_options" on public.product_options;

create policy "public_read_enabled_product_options"
  on public.product_options for select to anon, authenticated
  using (
    enabled = true
    and exists (select 1 from public.products p where p.id = product_id and p.enabled = true)
  );

create policy "admin_all_select_product_options"
  on public.product_options for select to authenticated
  using (public.is_admin());

create policy "admin_insert_product_options"
  on public.product_options for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_product_options"
  on public.product_options for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_product_options"
  on public.product_options for delete to authenticated
  using (public.is_admin());

drop policy if exists "public_read_enabled_product_option_values" on public.product_option_values;
drop policy if exists "admin_select_product_option_values" on public.product_option_values;
drop policy if exists "admin_insert_product_option_values" on public.product_option_values;
drop policy if exists "admin_update_product_option_values" on public.product_option_values;
drop policy if exists "admin_delete_product_option_values" on public.product_option_values;

create policy "public_read_enabled_product_option_values"
  on public.product_option_values for select to anon, authenticated
  using (
    enabled = true
    and exists (
      select 1 from public.product_options o
      join public.products p on p.id = o.product_id
      where o.id = option_id and o.enabled = true and p.enabled = true
    )
  );

create policy "admin_select_product_option_values"
  on public.product_option_values for select to authenticated
  using (public.is_admin());

create policy "admin_insert_product_option_values"
  on public.product_option_values for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_product_option_values"
  on public.product_option_values for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_product_option_values"
  on public.product_option_values for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- offers + offer_components
-- ---------------------------------------------------------------------------

create table if not exists public.offers (
  id text primary key,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  image_key text not null default '',
  image_alt text not null default '',
  badge_label text not null default 'عرض خاص',
  pricing_rule text not null default 'components'
    check (pricing_rule in ('components', 'custom_bundle')),
  custom_bundle_price numeric check (custom_bundle_price is null or custom_bundle_price >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint offers_dates_ok check (ends_at is null or starts_at is null or ends_at >= starts_at),
  constraint offers_custom_bundle_price check (
    pricing_rule <> 'custom_bundle' or custom_bundle_price is not null
  )
);

create index if not exists offers_enabled_idx on public.offers (enabled, sort_order);

drop trigger if exists offers_set_updated_at on public.offers;
create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

create table if not exists public.offer_components (
  id text primary key,
  offer_id text not null references public.offers (id) on update cascade on delete cascade,
  product_id text references public.products (id) on update cascade on delete restrict,
  category_id text references public.product_categories (id) on update cascade on delete restrict,
  quantity integer not null default 1 check (quantity > 0),
  role_label text not null default '',
  component_pricing text not null default 'full_price'
    check (component_pricing in ('full_price', 'percent_off', 'fixed_off', 'free', 'included_in_bundle')),
  discount_percent numeric check (discount_percent is null or (discount_percent >= 0 and discount_percent <= 100)),
  discount_amount numeric check (discount_amount is null or discount_amount >= 0),
  customer_picks boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint offer_components_target check (
    product_id is not null or category_id is not null
  ),
  constraint offer_components_percent check (
    component_pricing <> 'percent_off' or discount_percent is not null
  ),
  constraint offer_components_fixed check (
    component_pricing <> 'fixed_off' or discount_amount is not null
  )
);

create index if not exists offer_components_offer_idx
  on public.offer_components (offer_id, sort_order);

alter table public.offers enable row level security;
alter table public.offer_components enable row level security;

grant select on table public.offers to anon, authenticated;
grant insert, update, delete on table public.offers to authenticated;
grant select on table public.offer_components to anon, authenticated;
grant insert, update, delete on table public.offer_components to authenticated;

drop policy if exists "public_read_active_offers" on public.offers;
drop policy if exists "admin_select_offers" on public.offers;
drop policy if exists "admin_insert_offers" on public.offers;
drop policy if exists "admin_update_offers" on public.offers;
drop policy if exists "admin_delete_offers" on public.offers;

create policy "public_read_active_offers"
  on public.offers for select to anon, authenticated
  using (
    enabled = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
  );

create policy "admin_select_offers"
  on public.offers for select to authenticated
  using (public.is_admin());

create policy "admin_insert_offers"
  on public.offers for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_offers"
  on public.offers for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_offers"
  on public.offers for delete to authenticated
  using (public.is_admin());

drop policy if exists "public_read_offer_components" on public.offer_components;
drop policy if exists "admin_select_offer_components" on public.offer_components;
drop policy if exists "admin_insert_offer_components" on public.offer_components;
drop policy if exists "admin_update_offer_components" on public.offer_components;
drop policy if exists "admin_delete_offer_components" on public.offer_components;

create policy "public_read_offer_components"
  on public.offer_components for select to anon, authenticated
  using (
    exists (
      select 1 from public.offers o
      where o.id = offer_id
        and o.enabled = true
        and (o.starts_at is null or o.starts_at <= now())
        and (o.ends_at is null or o.ends_at >= now())
    )
  );

create policy "admin_select_offer_components"
  on public.offer_components for select to authenticated
  using (public.is_admin());

create policy "admin_insert_offer_components"
  on public.offer_components for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_offer_components"
  on public.offer_components for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "admin_delete_offer_components"
  on public.offer_components for delete to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Storage: allow product/offer image paths in cake-images bucket
-- (reuse existing public bucket; extend path regex for admin writes)
-- ---------------------------------------------------------------------------

drop policy if exists "admin_insert_cake_images" on storage.objects;
drop policy if exists "admin_update_cake_images" on storage.objects;

create policy "admin_insert_cake_images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cake-images'
    and name ~ '^(cakes|products|offers)/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'
    and public.is_admin()
  );

create policy "admin_update_cake_images"
  on storage.objects for update to authenticated
  using (bucket_id = 'cake-images' and public.is_admin())
  with check (
    bucket_id = 'cake-images'
    and name ~ '^(cakes|products|offers)/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Convenience: public product count helper for admin (SECURITY DEFINER)
-- ---------------------------------------------------------------------------

create or replace function public.admin_category_product_counts()
returns table (category_id text, product_count bigint)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  return query
    select p.category_id, count(*)::bigint
    from public.products p
    group by p.category_id;
end;
$$;

revoke all on function public.admin_category_product_counts() from public;
grant execute on function public.admin_category_product_counts() to authenticated;

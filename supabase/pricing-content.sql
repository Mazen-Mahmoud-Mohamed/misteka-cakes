-- Misteka Cakes — Admin-managed public pricing page content
-- Apply after supabase/product-ordering-models.sql (requires public.is_admin(),
-- public.cake_sizes, public.products, public.product_price_tiers).
--
-- Additive and safe to re-run:
--   • creates public.pricing_sections and public.pricing_items
--   • RLS: anon/authenticated read enabled rows only; writes require public.is_admin()
--   • seeds the current public pricing layout once (on conflict do nothing)
--   • does NOT touch cakes, sizes, products, tiers, offers or orders
--
-- Linked rows (cake_size / product / product_tier) store no price: the public page
-- reads the live price from the linked catalog row. Checkout pricing stays in
-- place_order and is never read from these tables.

create table if not exists public.pricing_sections (
  id text primary key,
  title text not null,
  description text not null default '',
  width text not null default 'full' check (width in ('full', 'half')),
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_sections_title_len check (char_length(trim(title)) between 1 and 120)
);

create table if not exists public.pricing_items (
  id text primary key,
  section_id text not null references public.pricing_sections (id) on update cascade on delete cascade,
  item_kind text not null
    check (item_kind in ('price', 'note', 'text', 'cake_size', 'product', 'product_tier')),
  label text not null default '',
  sublabel text not null default '',
  price numeric check (price is null or price >= 0),
  unit text not null default '',
  note text not null default '',
  cake_size_id text references public.cake_sizes (id) on update cascade on delete cascade,
  product_id text references public.products (id) on update cascade on delete cascade,
  price_tier_id text references public.product_price_tiers (id) on update cascade on delete cascade,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_items_link_shape check (
    case item_kind
      when 'price' then price is not null and char_length(trim(label)) > 0
        and cake_size_id is null and product_id is null and price_tier_id is null
      when 'note' then char_length(trim(label)) > 0 and price is null
        and cake_size_id is null and product_id is null and price_tier_id is null
      when 'text' then char_length(trim(label)) > 0 and price is null
        and cake_size_id is null and product_id is null and price_tier_id is null
      when 'cake_size' then cake_size_id is not null and price is null
        and product_id is null and price_tier_id is null
      when 'product' then product_id is not null and price is null
        and cake_size_id is null and price_tier_id is null
      when 'product_tier' then price_tier_id is not null and price is null
        and cake_size_id is null and product_id is null
    end
  )
);

create index if not exists pricing_items_section_sort_idx on public.pricing_items (section_id, sort_order);

create or replace function public.set_pricing_content_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pricing_sections_set_updated_at on public.pricing_sections;
create trigger pricing_sections_set_updated_at
  before update on public.pricing_sections
  for each row execute function public.set_pricing_content_updated_at();

drop trigger if exists pricing_items_set_updated_at on public.pricing_items;
create trigger pricing_items_set_updated_at
  before update on public.pricing_items
  for each row execute function public.set_pricing_content_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.pricing_sections enable row level security;
alter table public.pricing_items enable row level security;

revoke all on table public.pricing_sections from anon, authenticated;
revoke all on table public.pricing_items from anon, authenticated;
grant select on table public.pricing_sections to anon;
grant select on table public.pricing_items to anon;
grant select, insert, update, delete on table public.pricing_sections to authenticated;
grant select, insert, update, delete on table public.pricing_items to authenticated;

drop policy if exists "public_read_enabled_pricing_sections" on public.pricing_sections;
create policy "public_read_enabled_pricing_sections"
  on public.pricing_sections for select to anon, authenticated
  using (enabled = true);

drop policy if exists "public_read_enabled_pricing_items" on public.pricing_items;
create policy "public_read_enabled_pricing_items"
  on public.pricing_items for select to anon, authenticated
  using (
    enabled = true
    and exists (
      select 1 from public.pricing_sections s
      where s.id = pricing_items.section_id and s.enabled = true
    )
  );

drop policy if exists "admin_select_pricing_sections" on public.pricing_sections;
create policy "admin_select_pricing_sections"
  on public.pricing_sections for select to authenticated using (public.is_admin());
drop policy if exists "admin_insert_pricing_sections" on public.pricing_sections;
create policy "admin_insert_pricing_sections"
  on public.pricing_sections for insert to authenticated with check (public.is_admin());
drop policy if exists "admin_update_pricing_sections" on public.pricing_sections;
create policy "admin_update_pricing_sections"
  on public.pricing_sections for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin_delete_pricing_sections" on public.pricing_sections;
create policy "admin_delete_pricing_sections"
  on public.pricing_sections for delete to authenticated using (public.is_admin());

drop policy if exists "admin_select_pricing_items" on public.pricing_items;
create policy "admin_select_pricing_items"
  on public.pricing_items for select to authenticated using (public.is_admin());
drop policy if exists "admin_insert_pricing_items" on public.pricing_items;
create policy "admin_insert_pricing_items"
  on public.pricing_items for insert to authenticated with check (public.is_admin());
drop policy if exists "admin_update_pricing_items" on public.pricing_items;
create policy "admin_update_pricing_items"
  on public.pricing_items for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "admin_delete_pricing_items" on public.pricing_items;
create policy "admin_delete_pricing_items"
  on public.pricing_items for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- One-time seed reproducing the current public pricing page.
-- on conflict do nothing: re-running never overwrites admin edits.
-- ---------------------------------------------------------------------------

insert into public.pricing_sections (id, title, description, width, sort_order, enabled) values
  ('ps-cakes-single', 'التورت — دور واحد', '', 'half', 10, true),
  ('ps-cakes-two-tier', 'التورت — دورين', 'عدد الأفراد تقريبي، كما في قائمة الأسعار.', 'half', 20, true),
  ('ps-notes', 'ملاحظات', '', 'full', 1000, true)
on conflict (id) do nothing;

insert into public.pricing_items (id, section_id, item_kind, cake_size_id, sort_order)
select 'pi-size-' || s.id,
       case when s.pricing_group = 'single' then 'ps-cakes-single' else 'ps-cakes-two-tier' end,
       'cake_size', s.id, s.sort_order
from public.cake_sizes s
where s.enabled = true
on conflict (id) do nothing;

insert into public.pricing_items (id, section_id, item_kind, label, sort_order) values
  ('pi-note-1', 'ps-notes', 'note', 'يمكن تنفيذ جميع المقاسات حسب طلب العميل.', 10),
  ('pi-note-2', 'ps-notes', 'note', 'التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.', 20),
  ('pi-note-3', 'ps-notes', 'note', 'المجسمات والتصاميم الخاصة يتم تحديد سعرها بعد المعاينة حسب حجم التصميم وتعقيده.', 30)
on conflict (id) do nothing;

-- One section per visible top-level category (except offers/cakes) that has priced products.
insert into public.pricing_sections (id, title, description, width, sort_order, enabled)
select 'ps-cat-' || c.id, c.name, '', 'full', 100 + c.sort_order, true
from public.product_categories c
where c.parent_id is null
  and c.enabled = true
  and c.kind <> 'offers'
  and c.id <> 'cat-cakes'
  and exists (
    select 1 from public.products p
    left join public.product_categories pc on pc.id = p.category_id
    where p.enabled = true
      and coalesce(p.ordering_model, 'fixed_item') <> 'cake_servings'
      and (p.category_id = c.id or pc.parent_id = c.id)
  )
on conflict (id) do nothing;

-- Products with enabled package/weight/range tiers → one linked row per tier
insert into public.pricing_items (id, section_id, item_kind, price_tier_id, sort_order)
select 'pi-tier-' || t.id,
       'ps-cat-' || coalesce(pc.parent_id, pc.id),
       'product_tier', t.id, p.sort_order * 100 + t.sort_order
from public.product_price_tiers t
join public.products p on p.id = t.product_id and p.enabled = true
join public.product_categories pc on pc.id = p.category_id
where t.enabled = true
  and t.tier_kind in ('package', 'weight', 'quantity_range')
  and exists (select 1 from public.pricing_sections s where s.id = 'ps-cat-' || coalesce(pc.parent_id, pc.id))
on conflict (id) do nothing;

-- Products without such tiers → one linked product row (fixed price or "اطلب السعر")
insert into public.pricing_items (id, section_id, item_kind, product_id, sort_order)
select 'pi-product-' || p.id,
       'ps-cat-' || coalesce(pc.parent_id, pc.id),
       'product', p.id, p.sort_order * 100
from public.products p
join public.product_categories pc on pc.id = p.category_id
where p.enabled = true
  and coalesce(p.ordering_model, 'fixed_item') <> 'cake_servings'
  and (p.fixed_price is not null or p.ordering_model = 'quote' or p.pricing_mode = 'quote')
  and not exists (
    select 1 from public.product_price_tiers t
    where t.product_id = p.id and t.enabled = true
      and t.tier_kind in ('package', 'weight', 'quantity_range')
  )
  and exists (select 1 from public.pricing_sections s where s.id = 'ps-cat-' || coalesce(pc.parent_id, pc.id))
on conflict (id) do nothing;

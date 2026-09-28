-- Misteka Cakes — optional Supabase setup.
-- The website runs without this file.
-- Use only the anon key in VITE_SUPABASE_ANON_KEY.
-- Never put the service-role key in frontend env vars.

create table if not exists public.orders (
  id text primary key,
  order_number text not null,
  customer_name text not null,
  phone text not null,
  area text,
  address_notes text,
  service_type text not null,
  cake_id text,
  design_mode text,
  custom_design boolean not null default false,
  reference_image text,
  servings integer,
  size text,
  event_date date not null,
  event_time text not null,
  filling text,
  extras jsonb not null default '[]'::jsonb,
  notes text,
  base_price numeric,
  filling_price numeric,
  extras_price numeric,
  delivery_price numeric,
  total_price numeric,
  pending_charges jsonb not null default '[]'::jsonb,
  status text not null default 'pending_review',
  created_at timestamptz not null default now()
);

alter table public.orders enable row level security;

revoke all on public.orders from anon, authenticated;

-- Existence check only. Does not return customer details.
create or replace function public.slot_is_taken(slot_date date, slot_time text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.orders
    where event_date = slot_date
      and event_time = slot_time
      and status not in ('cancelled', 'rejected')
  );
$$;

revoke all on function public.slot_is_taken(date, text) from public;
grant execute on function public.slot_is_taken(date, text) to anon, authenticated;

create policy "public can create orders"
  on public.orders
  for insert
  to anon
  with check (status = 'pending_review');

grant insert on public.orders to anon;

-- Later, not required for this version:
-- cakes, cake_sizes, fillings, extras, delivery_zones
-- storage buckets: cake-images, order-references
-- Add a storage policy before enabling reference-image upload.

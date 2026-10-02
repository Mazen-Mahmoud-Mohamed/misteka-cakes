-- Misteka Cakes — Admin CMS: dynamic cake categories + admin cake image uploads
-- Apply after supabase/admin-catalog.sql. Safe to re-run.
-- Public: read visible categories, read cake images via public URL.
-- Writes: authenticated admins only (public.is_admin()).

-- ---------------------------------------------------------------------------
-- cake_categories
-- ---------------------------------------------------------------------------

create table if not exists public.cake_categories (
  id text primary key,
  name text not null check (length(btrim(name)) > 0),
  description text not null default '',
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.cake_categories (id, name, sort_order) values
  ('birthday', 'أعياد ميلاد', 10),
  ('celebration', 'مناسبات', 20)
on conflict (id) do nothing;

alter table public.cake_categories enable row level security;

grant select on table public.cake_categories to anon, authenticated;
grant insert, update, delete on table public.cake_categories to authenticated;

drop policy if exists "public_read_enabled_cake_categories" on public.cake_categories;
drop policy if exists "admin_select_all_cake_categories" on public.cake_categories;
drop policy if exists "admin_insert_cake_categories" on public.cake_categories;
drop policy if exists "admin_update_cake_categories" on public.cake_categories;
drop policy if exists "admin_delete_cake_categories" on public.cake_categories;

create policy "public_read_enabled_cake_categories"
  on public.cake_categories for select to anon, authenticated
  using (enabled = true);

create policy "admin_select_all_cake_categories"
  on public.cake_categories for select to authenticated
  using (public.is_admin());

create policy "admin_insert_cake_categories"
  on public.cake_categories for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_cake_categories"
  on public.cake_categories for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Hard delete only succeeds for unused categories (FK below is RESTRICT).
create policy "admin_delete_cake_categories"
  on public.cake_categories for delete to authenticated
  using (public.is_admin());

-- cakes.category: fixed CHECK list -> FK to cake_categories
alter table public.cakes drop constraint if exists cakes_category_check;
alter table public.cakes drop constraint if exists cakes_category_fkey;
alter table public.cakes
  add constraint cakes_category_fkey
  foreign key (category) references public.cake_categories (id)
  on update cascade on delete restrict;

-- ---------------------------------------------------------------------------
-- Storage: cake images (public read, admin-only write)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'cake-images',
  'cake-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin_select_cake_images" on storage.objects;
drop policy if exists "admin_insert_cake_images" on storage.objects;
drop policy if exists "admin_update_cake_images" on storage.objects;
drop policy if exists "admin_delete_cake_images" on storage.objects;

create policy "admin_select_cake_images"
  on storage.objects for select to authenticated
  using (bucket_id = 'cake-images' and public.is_admin());

create policy "admin_insert_cake_images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'cake-images'
    and name ~ '^cakes/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'
    and public.is_admin()
  );

create policy "admin_update_cake_images"
  on storage.objects for update to authenticated
  using (bucket_id = 'cake-images' and public.is_admin())
  with check (
    bucket_id = 'cake-images'
    and name ~ '^cakes/[a-z0-9-]+\.(jpg|jpeg|png|webp)$'
    and public.is_admin()
  );

create policy "admin_delete_cake_images"
  on storage.objects for delete to authenticated
  using (bucket_id = 'cake-images' and public.is_admin());

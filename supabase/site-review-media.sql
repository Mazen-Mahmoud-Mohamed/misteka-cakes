-- Misteka Cakes — Multi-image admin testimonials
-- Apply AFTER site-reviews-public-table.sql (already live).
-- Safe to re-run. Does not weaken RLS or recreate SECURITY DEFINER views.
--
-- ONE site_reviews row may have MANY site_review_media rows.
-- Public read uses site_review_media_public (safe columns only).

-- ---------------------------------------------------------------------------
-- Private media table (admin-managed; cascades with site_reviews)
-- ---------------------------------------------------------------------------

create table if not exists public.site_review_media (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.site_reviews (id) on delete cascade,
  image_path text not null check (length(trim(image_path)) > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint site_review_media_sort_nonneg check (sort_order >= 0)
);

create index if not exists site_review_media_review_sort_idx
  on public.site_review_media (review_id, sort_order);

create unique index if not exists site_review_media_review_path_uidx
  on public.site_review_media (review_id, image_path);

alter table public.site_review_media enable row level security;

revoke all on table public.site_review_media from anon, authenticated;
grant select, insert, update, delete on table public.site_review_media to authenticated;

drop policy if exists "admin_select_site_review_media" on public.site_review_media;
create policy "admin_select_site_review_media"
  on public.site_review_media for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin_insert_site_review_media" on public.site_review_media;
create policy "admin_insert_site_review_media"
  on public.site_review_media for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin_update_site_review_media" on public.site_review_media;
create policy "admin_update_site_review_media"
  on public.site_review_media for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_delete_site_review_media" on public.site_review_media;
create policy "admin_delete_site_review_media"
  on public.site_review_media for delete
  to authenticated
  using (public.is_admin());

-- Max 8 images per review (admin testimonials).
create or replace function public.enforce_site_review_media_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count integer;
begin
  select count(*)::integer into v_count
  from public.site_review_media m
  where m.review_id = new.review_id
    and (tg_op <> 'UPDATE' or m.id is distinct from new.id);

  if v_count >= 8 then
    raise exception 'site_review_media_limit: max 8 images per review';
  end if;

  return new;
end;
$$;

drop trigger if exists site_review_media_limit on public.site_review_media;
create trigger site_review_media_limit
  before insert or update of review_id on public.site_review_media
  for each row
  execute function public.enforce_site_review_media_limit();

-- ---------------------------------------------------------------------------
-- Public-safe media table (published testimonials only)
-- ---------------------------------------------------------------------------

create table if not exists public.site_review_media_public (
  media_id uuid primary key,
  review_id uuid not null references public.site_reviews (id) on delete cascade,
  image_path text not null,
  sort_order integer not null default 0
);

create index if not exists site_review_media_public_review_sort_idx
  on public.site_review_media_public (review_id, sort_order);

alter table public.site_review_media_public enable row level security;

revoke all on table public.site_review_media_public from anon, authenticated;

-- Opaque review_id is required for joining public reviews ↔ media (not PII).
grant select (review_id, image_path, sort_order)
  on table public.site_review_media_public to anon, authenticated;

drop policy if exists "anyone_select_site_review_media_public" on public.site_review_media_public;
create policy "anyone_select_site_review_media_public"
  on public.site_review_media_public for select
  to anon, authenticated
  using (true);

-- Also expose review_id on site_reviews_public for client joins (opaque UUID only).
grant select (review_id)
  on table public.site_reviews_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Sync public media when private media changes (only if parent is published)
-- ---------------------------------------------------------------------------

create or replace function public.sync_site_review_media_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text;
  v_review_id uuid;
  v_media_id uuid;
begin
  if tg_op = 'DELETE' then
    delete from public.site_review_media_public where media_id = old.id;
    return old;
  end if;

  v_review_id := new.review_id;
  v_media_id := new.id;

  select r.status into v_status
  from public.site_reviews r
  where r.id = v_review_id;

  if v_status = 'published' then
    insert into public.site_review_media_public (media_id, review_id, image_path, sort_order)
    values (v_media_id, v_review_id, new.image_path, new.sort_order)
    on conflict (media_id) do update set
      review_id = excluded.review_id,
      image_path = excluded.image_path,
      sort_order = excluded.sort_order;
  else
    delete from public.site_review_media_public where media_id = v_media_id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_site_review_media_public() from public;

drop trigger if exists site_review_media_sync_public on public.site_review_media;
create trigger site_review_media_sync_public
  after insert or update or delete on public.site_review_media
  for each row
  execute function public.sync_site_review_media_public();

-- When a review is unpublished/deleted, clear public media (review sync already clears public review).
create or replace function public.sync_site_reviews_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.site_review_media_public where review_id = old.id;
    delete from public.site_reviews_public where review_id = old.id;
    return old;
  end if;

  if new.status = 'published' then
    insert into public.site_reviews_public (
      review_id,
      display_name,
      review_text,
      image_path,
      source,
      published_at,
      sort_order,
      featured
    )
    values (
      new.id,
      new.display_name,
      new.review_text,
      new.image_path,
      new.source,
      new.published_at,
      new.sort_order,
      new.featured
    )
    on conflict (review_id) do update set
      display_name = excluded.display_name,
      review_text = excluded.review_text,
      image_path = excluded.image_path,
      source = excluded.source,
      published_at = excluded.published_at,
      sort_order = excluded.sort_order,
      featured = excluded.featured;

    -- Re-sync media public rows for this review (covers publish-after-media edge cases).
    insert into public.site_review_media_public (media_id, review_id, image_path, sort_order)
    select m.id, m.review_id, m.image_path, m.sort_order
    from public.site_review_media m
    where m.review_id = new.id
    on conflict (media_id) do update set
      review_id = excluded.review_id,
      image_path = excluded.image_path,
      sort_order = excluded.sort_order;
  else
    delete from public.site_review_media_public where review_id = new.id;
    delete from public.site_reviews_public where review_id = new.id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: legacy site_reviews.image_path → one media row (no duplicates)
-- ---------------------------------------------------------------------------

insert into public.site_review_media (review_id, image_path, sort_order)
select r.id, r.image_path, 0
from public.site_reviews r
where r.image_path is not null
  and length(trim(r.image_path)) > 0
  and not exists (
    select 1 from public.site_review_media m
    where m.review_id = r.id and m.image_path = r.image_path
  );

-- Public media backfill for published reviews
insert into public.site_review_media_public (media_id, review_id, image_path, sort_order)
select m.id, m.review_id, m.image_path, m.sort_order
from public.site_review_media m
join public.site_reviews r on r.id = m.review_id
where r.status = 'published'
on conflict (media_id) do update set
  review_id = excluded.review_id,
  image_path = excluded.image_path,
  sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Storage: allow nested paths {review_id}/{file}.{ext} while keeping legacy flat paths
-- ---------------------------------------------------------------------------

drop policy if exists "admin_insert_testimonials" on storage.objects;
create policy "admin_insert_testimonials"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'testimonials'
    and public.is_admin()
    and (
      name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      or name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-z]+\.(jpg|jpeg|png|webp)$'
    )
  );

drop policy if exists "admin_update_testimonials" on storage.objects;
create policy "admin_update_testimonials"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'testimonials' and public.is_admin())
  with check (
    bucket_id = 'testimonials'
    and public.is_admin()
    and (
      name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
      or name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-z]+\.(jpg|jpeg|png|webp)$'
    )
  );

notify pgrst, 'reload schema';

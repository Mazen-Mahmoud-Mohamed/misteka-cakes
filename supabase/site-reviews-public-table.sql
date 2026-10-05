-- Misteka Cakes — Replace SECURITY DEFINER public view with a public-safe table
-- Apply AFTER site-reviews.sql + site-reviews-admin-screenshots.sql (already live).
-- Safe to re-run.
--
-- Root cause: site_reviews_public was a view with security_invoker=false (SECURITY DEFINER),
-- which Supabase Advisor flags as CRITICAL.
--
-- Fix: dedicated table containing ONLY public columns, maintained by a trigger when
-- site_reviews.status = 'published'. Anon never gets SELECT on private site_reviews.

-- ---------------------------------------------------------------------------
-- Drop the SECURITY DEFINER view (same name reused for the table / PostgREST API)
-- ---------------------------------------------------------------------------

drop view if exists public.site_reviews_public cascade;

-- ---------------------------------------------------------------------------
-- Public-safe table (published rows only — never pending/rejected)
-- ---------------------------------------------------------------------------

create table if not exists public.site_reviews_public (
  review_id uuid primary key references public.site_reviews (id) on delete cascade,
  display_name text,
  review_text text,
  image_path text,
  source text not null
    check (source in ('customer', 'whatsapp', 'facebook', 'instagram', 'manual')),
  published_at timestamptz,
  sort_order integer not null default 0,
  featured boolean not null default false
);

create index if not exists site_reviews_public_sort_idx
  on public.site_reviews_public (sort_order, published_at desc nulls last);

alter table public.site_reviews_public enable row level security;

revoke all on table public.site_reviews_public from anon, authenticated;

-- Column-level SELECT: never grant review_id (internal sync key) to public roles.
grant select (
  display_name,
  review_text,
  image_path,
  source,
  published_at,
  sort_order,
  featured
) on table public.site_reviews_public to anon, authenticated;

drop policy if exists "anyone_select_site_reviews_public" on public.site_reviews_public;
create policy "anyone_select_site_reviews_public"
  on public.site_reviews_public for select
  to anon, authenticated
  using (true);

-- No INSERT/UPDATE/DELETE policies for anon/authenticated (default deny).
-- Writes happen via security-definer sync trigger (table owner bypasses RLS)
-- and ON DELETE CASCADE from site_reviews.

drop policy if exists "admin_select_site_reviews_public" on public.site_reviews_public;

-- ---------------------------------------------------------------------------
-- Sync trigger: keep public table in lockstep with published site_reviews rows
-- ---------------------------------------------------------------------------

create or replace function public.sync_site_reviews_public()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
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
  else
    delete from public.site_reviews_public where review_id = new.id;
  end if;

  return new;
end;
$$;

revoke all on function public.sync_site_reviews_public() from public;

drop trigger if exists site_reviews_sync_public on public.site_reviews;
create trigger site_reviews_sync_public
  after insert or update or delete on public.site_reviews
  for each row
  execute function public.sync_site_reviews_public();

-- ---------------------------------------------------------------------------
-- Backfill currently published reviews
-- ---------------------------------------------------------------------------

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
select
  r.id,
  r.display_name,
  r.review_text,
  r.image_path,
  r.source,
  r.published_at,
  r.sort_order,
  r.featured
from public.site_reviews r
where r.status = 'published'
on conflict (review_id) do update set
  display_name = excluded.display_name,
  review_text = excluded.review_text,
  image_path = excluded.image_path,
  source = excluded.source,
  published_at = excluded.published_at,
  sort_order = excluded.sort_order,
  featured = excluded.featured;

-- Remove any stale public rows that are no longer published (should be none after drop view).
delete from public.site_reviews_public p
where not exists (
  select 1 from public.site_reviews r
  where r.id = p.review_id and r.status = 'published'
);

notify pgrst, 'reload schema';

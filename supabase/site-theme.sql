-- Misteka Cakes — Site Theme / Appearance controls
-- Apply after supabase/admin-dashboard.sql (requires public.is_admin()).
-- Safe to re-run. Does not weaken existing RLS.

-- ---------------------------------------------------------------------------
-- site_themes
-- ---------------------------------------------------------------------------

create table if not exists public.site_themes (
  id text primary key,
  enabled boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.site_themes enable row level security;

revoke all on table public.site_themes from anon, authenticated;
grant select on table public.site_themes to anon, authenticated;
grant update on table public.site_themes to authenticated;

-- Keep updated_at fresh on every row update.
create or replace function public.set_site_themes_updated_at()
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

drop trigger if exists site_themes_set_updated_at on public.site_themes;
create trigger site_themes_set_updated_at
  before update on public.site_themes
  for each row
  execute function public.set_site_themes_updated_at();

-- ---------------------------------------------------------------------------
-- Seed (idempotent; do not duplicate rows)
-- ---------------------------------------------------------------------------

insert into public.site_themes (id, enabled, config)
values
  ('pixel_snow', true, '{}'::jsonb),
  (
    'ramadan',
    false,
    '{"lanterns":true,"crescent":true,"decorations":true,"intensity":"medium"}'::jsonb
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

drop policy if exists "public_read_site_themes" on public.site_themes;
create policy "public_read_site_themes"
  on public.site_themes for select
  to anon, authenticated
  using (true);

drop policy if exists "admin_update_site_themes" on public.site_themes;
create policy "admin_update_site_themes"
  on public.site_themes for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- No INSERT / DELETE policies for anon or authenticated.
-- Rows are seeded by this SQL file only.

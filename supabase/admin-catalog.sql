-- Misteka Cakes — Phase 3b Admin Catalog Management
-- Apply after supabase/admin-dashboard.sql
-- Admins may manage catalog rows (including disabled).
-- Public/anon still only SELECT enabled rows via existing policies.
-- Soft-disable preferred; no DELETE grants.

-- ---------------------------------------------------------------------------
-- Grants (writes for authenticated; RLS still requires is_admin())
-- ---------------------------------------------------------------------------

grant select, insert, update on table public.cake_sizes to authenticated;
grant select, insert, update on table public.cakes to authenticated;
grant select, insert, update on table public.fillings to authenticated;
grant select, insert, update on table public.design_extras to authenticated;
grant select, insert, update on table public.delivery_zones to authenticated;

-- ---------------------------------------------------------------------------
-- cake_sizes
-- ---------------------------------------------------------------------------

drop policy if exists "admin_select_all_cake_sizes" on public.cake_sizes;
drop policy if exists "admin_insert_cake_sizes" on public.cake_sizes;
drop policy if exists "admin_update_cake_sizes" on public.cake_sizes;

create policy "admin_select_all_cake_sizes"
  on public.cake_sizes for select to authenticated
  using (public.is_admin());

create policy "admin_insert_cake_sizes"
  on public.cake_sizes for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_cake_sizes"
  on public.cake_sizes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- cakes
-- ---------------------------------------------------------------------------

drop policy if exists "admin_select_all_cakes" on public.cakes;
drop policy if exists "admin_insert_cakes" on public.cakes;
drop policy if exists "admin_update_cakes" on public.cakes;

create policy "admin_select_all_cakes"
  on public.cakes for select to authenticated
  using (public.is_admin());

create policy "admin_insert_cakes"
  on public.cakes for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_cakes"
  on public.cakes for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- fillings
-- ---------------------------------------------------------------------------

drop policy if exists "admin_select_all_fillings" on public.fillings;
drop policy if exists "admin_insert_fillings" on public.fillings;
drop policy if exists "admin_update_fillings" on public.fillings;

create policy "admin_select_all_fillings"
  on public.fillings for select to authenticated
  using (public.is_admin());

create policy "admin_insert_fillings"
  on public.fillings for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_fillings"
  on public.fillings for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- design_extras
-- ---------------------------------------------------------------------------

drop policy if exists "admin_select_all_design_extras" on public.design_extras;
drop policy if exists "admin_insert_design_extras" on public.design_extras;
drop policy if exists "admin_update_design_extras" on public.design_extras;

create policy "admin_select_all_design_extras"
  on public.design_extras for select to authenticated
  using (public.is_admin());

create policy "admin_insert_design_extras"
  on public.design_extras for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_design_extras"
  on public.design_extras for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ---------------------------------------------------------------------------
-- delivery_zones
-- ---------------------------------------------------------------------------

drop policy if exists "admin_select_all_delivery_zones" on public.delivery_zones;
drop policy if exists "admin_insert_delivery_zones" on public.delivery_zones;
drop policy if exists "admin_update_delivery_zones" on public.delivery_zones;

create policy "admin_select_all_delivery_zones"
  on public.delivery_zones for select to authenticated
  using (public.is_admin());

create policy "admin_insert_delivery_zones"
  on public.delivery_zones for insert to authenticated
  with check (public.is_admin());

create policy "admin_update_delivery_zones"
  on public.delivery_zones for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

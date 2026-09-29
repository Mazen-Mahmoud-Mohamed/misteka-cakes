-- Misteka Cakes — Phase 3 Admin Dashboard
-- Apply in the Supabase SQL editor after Phase 2 schema.
-- Safe / idempotent where practical.
-- Does NOT weaken anonymous order access.
-- Does NOT grant service_role to the browser.

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------

create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  enabled boolean not null default true
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;

-- Admins may read their own membership row (for UI gating only — RLS on orders
-- still uses is_admin() server-side).
grant select on table public.admin_users to authenticated;

drop policy if exists "admin_read_own_membership" on public.admin_users;
create policy "admin_read_own_membership"
  on public.admin_users for select
  to authenticated
  using (id = auth.uid() and enabled = true);

-- No INSERT/UPDATE/DELETE policies for authenticated → no self-promotion.

-- ---------------------------------------------------------------------------
-- is_admin(): authorization helper (never trust client email)
-- ---------------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users au
    where au.id = auth.uid()
      and au.enabled = true
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Orders: admin SELECT only (anon remains locked out)
-- ---------------------------------------------------------------------------

grant select on table public.orders to authenticated;

drop policy if exists "admin_select_orders" on public.orders;
create policy "admin_select_orders"
  on public.orders for select
  to authenticated
  using (public.is_admin());

-- Intentionally NO direct UPDATE/DELETE grants or policies for authenticated.
-- Status changes go through admin_update_order_status() only.

-- ---------------------------------------------------------------------------
-- admin_update_order_status: status-only mutation + slot integrity
-- ---------------------------------------------------------------------------

create or replace function public.admin_update_order_status(order_id text, new_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_constraint text;
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'غير مصرح.');
  end if;

  if order_id is null or trim(order_id) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_order', 'message', 'معرّف الطلب غير صالح.');
  end if;

  if new_status not in ('pending_review', 'confirmed', 'cancelled', 'rejected') then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'message', 'حالة الطلب غير صالحة.');
  end if;

  select * into v_order from public.orders where id = order_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'الطلب غير موجود.');
  end if;

  if v_order.status = new_status then
    return jsonb_build_object(
      'ok', true,
      'order', jsonb_build_object(
        'id', v_order.id,
        'status', v_order.status
      )
    );
  end if;

  -- Business transitions for MVP:
  -- pending_review → confirmed | rejected | cancelled
  -- confirmed → cancelled
  -- rejected/cancelled → (no reopen in this phase)
  if v_order.status = 'pending_review' and new_status in ('confirmed', 'rejected', 'cancelled') then
    null;
  elsif v_order.status = 'confirmed' and new_status = 'cancelled' then
    null;
  else
    return jsonb_build_object(
      'ok', false,
      'code', 'invalid_transition',
      'message', 'لا يمكن تغيير حالة هذا الطلب بهذه الطريقة.'
    );
  end if;

  begin
    update public.orders
    set status = new_status
    where id = order_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_active_slot_uidx' then
        return jsonb_build_object(
          'ok', false,
          'code', 'slot_taken',
          'message', 'هذا الموعد لم يعد متاحًا لطلب آخر.'
        );
      end if;
      return jsonb_build_object('ok', false, 'code', 'conflict', 'message', 'تعذّر تحديث الطلب.');
  end;

  select * into v_order from public.orders where id = order_id;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_order.id,
      'orderNumber', v_order.order_number,
      'status', v_order.status
    )
  );
end;
$$;

revoke all on function public.admin_update_order_status(text, text) from public;
grant execute on function public.admin_update_order_status(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket — admin SELECT for signed URLs only
-- ---------------------------------------------------------------------------

drop policy if exists "admin_read_order_references" on storage.objects;
create policy "admin_read_order_references"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'order-references'
    and public.is_admin()
  );

-- No public bucket. No anon SELECT. Upload policy from Phase 2 unchanged.

-- ---------------------------------------------------------------------------
-- Optional: seed note
-- After creating the Auth user in Supabase Dashboard (Authentication → Users),
-- insert their UUID:
--
--   insert into public.admin_users (id, enabled)
--   values ('<auth-user-uuid>', true)
--   on conflict (id) do update set enabled = true;
--
-- Do not put the service_role key in Vite or GitHub Pages secrets.
-- ---------------------------------------------------------------------------

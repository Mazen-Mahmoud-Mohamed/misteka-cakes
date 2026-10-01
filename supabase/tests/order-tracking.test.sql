-- Server-side tests for supabase/order-tracking.sql.
-- Run in the Supabase SQL editor (or psql) AFTER applying the migration.
-- Everything runs inside a transaction and is rolled back; no data is kept.
-- Any failure raises an exception naming the broken rule.

begin;

do $$
declare
  v_status text;
  v_statuses text[] := array['pending_review','confirmed','preparing','in_production','ready','out_for_delivery','delivered','rejected','cancelled'];
  v_i integer := 0;
  v_res jsonb;
  v_admin uuid := gen_random_uuid();
  v_id text;
begin
  -- Fixtures: one order per status for phone A, one order for phone B.
  foreach v_status in array v_statuses loop
    v_i := v_i + 1;
    insert into public.orders (id, order_number, customer_name, phone, service_type, design_mode, servings, size, size_id,
                               event_date, event_time, status, address_notes, notes)
    values ('qa-' || v_i, 'MK-AA00000' || v_i, 'QA', '01012345678', 'delivery', 'catalog', 10, '20 سم', 'single-20',
            date '2099-01-01' + v_i, '16:00', v_status, 'SECRET-ADDRESS', 'SECRET-NOTES');
  end loop;
  insert into public.orders (id, order_number, customer_name, phone, service_type, design_mode, servings, size, size_id,
                             event_date, event_time, status)
  values ('qa-other', 'MK-BBFFFFFF', 'Other', '01198765432', 'pickup', 'catalog', 10, '20 سم', 'single-20',
          date '2099-02-01', '16:00', 'pending_review');

  -- Anonymous role: no direct table access.
  if has_table_privilege('anon', 'public.orders', 'SELECT') then raise exception 'anon can SELECT orders'; end if;
  if has_table_privilege('anon', 'public.orders', 'UPDATE') then raise exception 'anon can UPDATE orders'; end if;
  if has_table_privilege('anon', 'public.orders', 'DELETE') then raise exception 'anon can DELETE orders'; end if;
  if has_table_privilege('anon', 'public.order_status_events', 'SELECT') then raise exception 'anon can SELECT order_status_events'; end if;
  if has_table_privilege('anon', 'public.order_lookup_attempts', 'SELECT') then raise exception 'anon can SELECT lookup attempts'; end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'orders' and 'anon' = any (roles)) then
    raise exception 'orders has an anon policy';
  end if;
  if not has_function_privilege('anon', 'public.track_customer_orders(text)', 'EXECUTE') then raise exception 'anon cannot track'; end if;
  if has_function_privilege('anon', 'public.admin_update_order_status(text,text,text)', 'EXECUTE') then raise exception 'anon can run admin RPC'; end if;

  -- Lookup is phone-scoped and minimal.
  v_res := public.track_customer_orders('+20 101 234 5678');
  if not (v_res->>'ok')::boolean then raise exception 'lookup failed: %', v_res; end if;
  if jsonb_array_length(v_res->'orders') < 9 then raise exception 'lookup missing orders: %', v_res; end if;
  if v_res::text like '%MK-BBFFFFFF%' then raise exception 'lookup leaked another customer order'; end if;
  if v_res::text like '%SECRET%' or v_res::text like '%customer_name%' or v_res::text like '%phone%' then
    raise exception 'lookup leaked private fields';
  end if;
  if (public.track_customer_orders('123')->>'code') <> 'invalid_phone' then raise exception 'bad phone accepted'; end if;

  -- Details require the owning phone.
  if (public.get_customer_order('01198765432', 'MK-AA000001')->>'ok')::boolean then raise exception 'details opened with wrong phone'; end if;
  v_res := public.get_customer_order('01012345678', 'mk-aa000001');
  if not (v_res->>'ok')::boolean then raise exception 'details failed: %', v_res; end if;
  if v_res::text like '%SECRET%' then raise exception 'details leaked address/notes'; end if;

  -- Customer cancellation: wrong phone refused; only pending_review succeeds.
  if (public.customer_cancel_order('01198765432', 'MK-AA000001')->>'ok')::boolean then raise exception 'cancel with wrong phone succeeded'; end if;
  v_i := 0;
  foreach v_status in array v_statuses loop
    v_i := v_i + 1;
    v_res := public.customer_cancel_order('01012345678', 'MK-AA00000' || v_i);
    if (v_res->>'ok')::boolean <> (v_status = 'pending_review') then
      raise exception 'customer cancel for % returned %', v_status, v_res;
    end if;
  end loop;
  if (select status from public.orders where id = 'qa-1') <> 'cancelled' then raise exception 'pending order not cancelled'; end if;
  if (select cancelled_by from public.orders where id = 'qa-1') <> 'customer' then raise exception 'cancelled_by not recorded'; end if;
  if (public.customer_cancel_order('01012345678', 'MK-AA000001')->>'ok')::boolean then raise exception 'cancelled order cancelled twice'; end if;
  if (select status from public.orders where id = 'qa-2') <> 'confirmed' then raise exception 'confirmed order changed'; end if;
  if not exists (select 1 from public.order_status_events where order_id = 'qa-1' and status = 'cancelled' and actor = 'customer') then
    raise exception 'customer cancel not logged';
  end if;

  -- Admin lifecycle (impersonate an admin user).
  insert into auth.users (id, email) values (v_admin, 'qa-admin@example.test');
  insert into public.admin_users (id, enabled) values (v_admin, true);
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  if not public.is_admin() then raise exception 'admin impersonation failed'; end if;

  v_id := 'qa-2'; -- confirmed, delivery
  foreach v_status in array array['preparing','in_production','ready','out_for_delivery','delivered'] loop
    v_res := public.admin_update_order_status(v_id, v_status);
    if not (v_res->>'ok')::boolean then raise exception 'lifecycle step % failed: %', v_status, v_res; end if;
  end loop;
  if (public.admin_update_order_status(v_id, 'cancelled')->>'ok')::boolean then raise exception 'delivered order cancelled'; end if;

  if (public.admin_update_order_status('qa-4', 'out_for_delivery')->>'ok')::boolean then raise exception 'skipped in_production → out_for_delivery'; end if;
  if (public.admin_update_order_status('qa-4', 'cancelled')->>'ok')::boolean then raise exception 'in_production cancelled'; end if;
  if not (public.admin_update_order_status('qa-3', 'cancelled')->>'ok')::boolean then raise exception 'preparing could not be cancelled'; end if;
  if (public.admin_update_order_status('qa-other', 'confirmed')->>'ok')::boolean is not true then raise exception 'confirm failed'; end if;
  update public.orders set status = 'ready' where id = 'qa-other';
  if (public.admin_update_order_status('qa-other', 'out_for_delivery')->>'ok')::boolean then raise exception 'pickup went out for delivery'; end if;
  if not (public.admin_update_order_status('qa-other', 'delivered')->>'ok')::boolean then raise exception 'pickup ready → delivered failed'; end if;

  -- Rejection requires a reason, which the customer then sees.
  insert into public.orders (id, order_number, customer_name, phone, service_type, design_mode, servings, size, size_id,
                             event_date, event_time, status)
  values ('qa-rej', 'MK-CC000001', 'QA', '01012345678', 'delivery', 'catalog', 10, '20 سم', 'single-20',
          date '2099-03-01', '16:00', 'pending_review');
  if (public.admin_update_order_status('qa-rej', 'rejected')->>'code') <> 'reason_required' then raise exception 'reject without reason allowed'; end if;
  if (public.admin_update_order_status('qa-rej', 'rejected', '  ')->>'code') <> 'reason_required' then raise exception 'blank reason allowed'; end if;
  if not (public.admin_update_order_status('qa-rej', 'rejected', 'الموعد محجوز')->>'ok')::boolean then raise exception 'reject failed'; end if;
  if (public.get_customer_order('01012345678', 'MK-CC000001')->'order'->>'rejectionReason') <> 'الموعد محجوز' then
    raise exception 'rejection reason not visible to customer';
  end if;
  if (public.admin_update_order_status('qa-rej', 'confirmed')->>'ok')::boolean then raise exception 'rejected order reopened'; end if;

  -- Non-admin cannot change status.
  perform set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
  if (public.admin_update_order_status('qa-5', 'out_for_delivery')->>'code') <> 'forbidden' then raise exception 'non-admin changed status'; end if;

  raise notice 'order-tracking tests: all passed';
end;
$$;

rollback;

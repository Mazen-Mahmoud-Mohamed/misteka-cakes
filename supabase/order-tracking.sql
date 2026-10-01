-- Misteka Cakes — Customer order tracking + full order lifecycle
-- Apply in the Supabase SQL editor AFTER schema.sql, admin-dashboard.sql and
-- advisor-hardening.sql. Safe to run multiple times.
--
-- Security model is unchanged:
--   * public.orders keeps RLS with no anon policies and no anon grants.
--   * Customers read/cancel only through SECURITY DEFINER RPCs that require the
--     ordering phone number and return a minimal, whitelisted set of fields.
--   * Admin status changes still go through admin_update_order_status().

-- ---------------------------------------------------------------------------
-- 1. Lifecycle statuses + rejection reason
-- ---------------------------------------------------------------------------

do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.orders'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.orders drop constraint %I', r.conname);
  end loop;
end;
$$;

alter table public.orders
  add constraint orders_status_check check (status in (
    'pending_review', 'confirmed', 'preparing', 'in_production', 'ready',
    'out_for_delivery', 'delivered', 'rejected', 'cancelled'
  ));

alter table public.orders add column if not exists rejection_reason text;
alter table public.orders add column if not exists cancelled_by text;
alter table public.orders add column if not exists status_updated_at timestamptz;

alter table public.orders drop constraint if exists orders_cancelled_by_check;
alter table public.orders
  add constraint orders_cancelled_by_check check (cancelled_by is null or cancelled_by in ('customer', 'admin'));

alter table public.orders drop constraint if exists orders_rejection_reason_len;
alter table public.orders
  add constraint orders_rejection_reason_len check (rejection_reason is null or char_length(rejection_reason) <= 500);

create index if not exists orders_phone_created_idx on public.orders (phone, created_at desc);

-- orders_active_slot_uidx (status not in cancelled/rejected) is intentionally
-- unchanged: every new in-progress status keeps holding its slot.

-- ---------------------------------------------------------------------------
-- 2. Status history (written only by trigger)
-- ---------------------------------------------------------------------------

create table if not exists public.order_status_events (
  id bigint generated always as identity primary key,
  order_id text not null references public.orders (id) on delete cascade,
  status text not null,
  actor text not null default 'system' check (actor in ('customer', 'admin', 'system')),
  created_at timestamptz not null default now()
);

create index if not exists order_status_events_order_idx on public.order_status_events (order_id, created_at);

alter table public.order_status_events enable row level security;
revoke all on table public.order_status_events from anon, authenticated;
grant select on table public.order_status_events to authenticated;

drop policy if exists "admin_select_order_status_events" on public.order_status_events;
create policy "admin_select_order_status_events"
  on public.order_status_events for select
  to authenticated
  using (public.is_admin());

create or replace function public.log_order_status_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor text := coalesce(nullif(current_setting('mestika.status_actor', true), ''), 'system');
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.order_status_events (order_id, status, actor, created_at)
    values (new.id, new.status, v_actor, now());
  end if;
  return new;
end;
$$;

revoke all on function public.log_order_status_event() from public, anon, authenticated;

drop trigger if exists orders_status_event on public.orders;
create trigger orders_status_event
  after insert or update of status on public.orders
  for each row execute function public.log_order_status_event();

-- Backfill the creation event for orders that predate this migration.
insert into public.order_status_events (order_id, status, actor, created_at)
select o.id, 'pending_review', 'system', o.created_at
from public.orders o
where not exists (select 1 from public.order_status_events e where e.order_id = o.id);

-- ---------------------------------------------------------------------------
-- 3. Helpers
-- ---------------------------------------------------------------------------

-- Same normalization as the storefront (src/utils/phone.ts) + +20 prefix.
create or replace function public.normalize_customer_phone(raw text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when d ~ '^0020' then '0' || substr(d, 5)
    when d ~ '^20' and char_length(d) = 12 then '0' || substr(d, 3)
    else d
  end
  from (
    select regexp_replace(
      translate(coalesce(raw, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'),
      '[^0-9]', '', 'g'
    ) as d
  ) s;
$$;

revoke all on function public.normalize_customer_phone(text) from public;

-- Throttle for anonymous lookups (anti-enumeration). Keyed by a hash of the
-- client IP from PostgREST request headers; raw IPs are never stored.
create table if not exists public.order_lookup_attempts (
  id bigint generated always as identity primary key,
  client_key text not null,
  created_at timestamptz not null default now()
);

create index if not exists order_lookup_attempts_key_idx on public.order_lookup_attempts (client_key, created_at);

alter table public.order_lookup_attempts enable row level security;
revoke all on table public.order_lookup_attempts from anon, authenticated;

create or replace function public.order_lookup_throttled()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), '')::jsonb, '{}'::jsonb);
  v_ip text := coalesce(
    nullif(trim(split_part(v_headers->>'x-forwarded-for', ',', 1)), ''),
    nullif(v_headers->>'x-real-ip', ''),
    'unknown'
  );
  v_key text := md5('mestika-lookup|' || v_ip);
  v_count integer;
begin
  delete from public.order_lookup_attempts where created_at < now() - interval '1 hour';

  select count(*) into v_count
  from public.order_lookup_attempts
  where client_key = v_key and created_at > now() - interval '10 minutes';

  if v_count >= 30 then
    return true;
  end if;

  insert into public.order_lookup_attempts (client_key) values (v_key);
  return false;
end;
$$;

revoke all on function public.order_lookup_throttled() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. Customer RPCs (anon)
-- ---------------------------------------------------------------------------

-- Minimal list for a phone number. No names, addresses, notes or images.
create or replace function public.track_customer_orders(p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_customer_phone(p_phone);
  v_orders jsonb;
begin
  if v_phone !~ '^01[0125][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_phone', 'message', 'اكتبي رقم موبايل مصري صحيح.');
  end if;

  if public.order_lookup_throttled() then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'محاولات كثيرة. انتظري بضع دقائق ثم أعيدي المحاولة.');
  end if;

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t."createdAt" desc), '[]'::jsonb)
  into v_orders
  from (
    select
      o.order_number as "orderNumber",
      o.status,
      o.created_at as "createdAt",
      o.cake_name as "cakeName",
      o.design_mode as "designMode",
      o.size,
      o.event_date as "date"
    from public.orders o
    where o.phone = v_phone
    order by o.created_at desc
    limit 20
  ) t;

  return jsonb_build_object('ok', true, 'orders', v_orders);
end;
$$;

-- Full customer-safe details; requires phone AND order number.
create or replace function public.get_customer_order(p_phone text, p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_customer_phone(p_phone);
  v_number text := upper(trim(coalesce(p_order_number, '')));
  v_order public.orders%rowtype;
  v_events jsonb;
begin
  if v_phone !~ '^01[0125][0-9]{8}$' or v_number !~ '^MK-[0-9A-F]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  if public.order_lookup_throttled() then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'محاولات كثيرة. انتظري بضع دقائق ثم أعيدي المحاولة.');
  end if;

  select * into v_order from public.orders where order_number = v_number and phone = v_phone;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('status', e.status, 'at', e.created_at) order by e.created_at, e.id), '[]'::jsonb)
  into v_events
  from public.order_status_events e
  where e.order_id = v_order.id;

  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'createdAt', v_order.created_at,
    'cakeName', v_order.cake_name,
    'designMode', v_order.design_mode,
    'size', v_order.size,
    'servings', v_order.servings,
    'filling', v_order.filling,
    'extras', coalesce((select jsonb_agg(x->>'name') from jsonb_array_elements(v_order.extras) x), '[]'::jsonb),
    'serviceType', v_order.service_type,
    'area', v_order.area,
    'date', v_order.event_date,
    'time', v_order.event_time,
    'totalPrice', v_order.total_price,
    'pendingCharges', v_order.pending_charges,
    'rejectionReason', case when v_order.status = 'rejected' then v_order.rejection_reason end,
    'cancelledBy', case when v_order.status = 'cancelled' then v_order.cancelled_by end,
    'canCancel', v_order.status = 'pending_review',
    'events', v_events
  ));
end;
$$;

-- Customer cancellation: only while pending_review, only for the owning phone.
create or replace function public.customer_cancel_order(p_phone text, p_order_number text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_customer_phone(p_phone);
  v_number text := upper(trim(coalesce(p_order_number, '')));
  v_order public.orders%rowtype;
begin
  if v_phone !~ '^01[0125][0-9]{8}$' or v_number !~ '^MK-[0-9A-F]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  if public.order_lookup_throttled() then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'محاولات كثيرة. انتظري بضع دقائق ثم أعيدي المحاولة.');
  end if;

  select * into v_order
  from public.orders
  where order_number = v_number and phone = v_phone
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  if v_order.status <> 'pending_review' then
    return jsonb_build_object(
      'ok', false,
      'code', 'not_cancellable',
      'message', 'لا يمكن إلغاء الطلب بعد بدء مراجعته. تواصلي معنا عبر واتساب.',
      'status', v_order.status
    );
  end if;

  perform set_config('mestika.status_actor', 'customer', true);

  update public.orders
  set status = 'cancelled', cancelled_by = 'customer', status_updated_at = now()
  where id = v_order.id and status = 'pending_review';

  return jsonb_build_object('ok', true, 'status', 'cancelled');
end;
$$;

revoke all on function public.track_customer_orders(text) from public;
revoke all on function public.get_customer_order(text, text) from public;
revoke all on function public.customer_cancel_order(text, text) from public;
grant execute on function public.track_customer_orders(text) to anon, authenticated;
grant execute on function public.get_customer_order(text, text) to anon, authenticated;
grant execute on function public.customer_cancel_order(text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Admin status RPC with the full lifecycle (replaces the 2-arg version)
-- ---------------------------------------------------------------------------
-- pending_review   → confirmed | rejected (reason required) | cancelled
-- confirmed        → preparing | cancelled
-- preparing        → in_production | cancelled
-- in_production    → ready
-- ready            → out_for_delivery (delivery) | delivered (pickup)
-- out_for_delivery → delivered
-- delivered / rejected / cancelled are terminal.

drop function if exists public.admin_update_order_status(text, text);

create or replace function public.admin_update_order_status(order_id text, new_status text, reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_constraint text;
  v_reason text := nullif(trim(coalesce(reason, '')), '');
  v_allowed text[];
begin
  if not public.is_admin() then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'غير مصرح.');
  end if;

  if order_id is null or trim(order_id) = '' then
    return jsonb_build_object('ok', false, 'code', 'invalid_order', 'message', 'معرّف الطلب غير صالح.');
  end if;

  if new_status is null or new_status not in (
    'pending_review', 'confirmed', 'preparing', 'in_production', 'ready',
    'out_for_delivery', 'delivered', 'rejected', 'cancelled'
  ) then
    return jsonb_build_object('ok', false, 'code', 'invalid_status', 'message', 'حالة الطلب غير صالحة.');
  end if;

  select * into v_order from public.orders where id = order_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'الطلب غير موجود.');
  end if;

  if v_order.status = new_status then
    return jsonb_build_object('ok', true, 'order', jsonb_build_object('id', v_order.id, 'status', v_order.status));
  end if;

  v_allowed := case v_order.status
    when 'pending_review' then array['confirmed', 'rejected', 'cancelled']
    when 'confirmed' then array['preparing', 'cancelled']
    when 'preparing' then array['in_production', 'cancelled']
    when 'in_production' then array['ready']
    when 'ready' then case when v_order.service_type = 'delivery' then array['out_for_delivery'] else array['delivered'] end
    when 'out_for_delivery' then array['delivered']
    else array[]::text[]
  end;

  if not (new_status = any (v_allowed)) then
    return jsonb_build_object('ok', false, 'code', 'invalid_transition', 'message', 'لا يمكن تغيير حالة هذا الطلب بهذه الطريقة.');
  end if;

  if new_status = 'rejected' then
    if v_reason is null or char_length(v_reason) < 3 then
      return jsonb_build_object('ok', false, 'code', 'reason_required', 'message', 'اكتبي سبب رفض الطلب.');
    end if;
    if char_length(v_reason) > 500 then
      return jsonb_build_object('ok', false, 'code', 'reason_too_long', 'message', 'سبب الرفض أطول من المسموح (500 حرف).');
    end if;
  end if;

  perform set_config('mestika.status_actor', 'admin', true);

  begin
    update public.orders
    set status = new_status,
        status_updated_at = now(),
        rejection_reason = case when new_status = 'rejected' then v_reason else rejection_reason end,
        cancelled_by = case when new_status = 'cancelled' then 'admin' else cancelled_by end
    where id = order_id;
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_active_slot_uidx' then
        return jsonb_build_object('ok', false, 'code', 'slot_taken', 'message', 'هذا الموعد لم يعد متاحًا لطلب آخر.');
      end if;
      return jsonb_build_object('ok', false, 'code', 'conflict', 'message', 'تعذّر تحديث الطلب.');
  end;

  select * into v_order from public.orders where id = order_id;

  return jsonb_build_object('ok', true, 'order', jsonb_build_object(
    'id', v_order.id,
    'orderNumber', v_order.order_number,
    'status', v_order.status,
    'rejectionReason', v_order.rejection_reason
  ));
end;
$$;

revoke all on function public.admin_update_order_status(text, text, text) from public;
grant execute on function public.admin_update_order_status(text, text, text) to authenticated;

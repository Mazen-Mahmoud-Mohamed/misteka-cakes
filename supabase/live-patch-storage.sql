-- Live-fix / Advisor patch: storage helper + empty search_path + drop unused index.
-- Does NOT weaken RLS or grant direct orders table access to anon.

drop index if exists public.orders_event_date_idx;

create or replace function public.order_reference_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders o
    where o.reference_image = order_reference_upload_allowed.object_name
      and o.status = 'pending_review'
      and o.created_at > now() - interval '30 minutes'
      and order_reference_upload_allowed.object_name
            ~ ('^' || o.id || '/reference\.(jpg|jpeg|png|webp)$')
  );
$$;

revoke all on function public.order_reference_upload_allowed(text) from public;
grant execute on function public.order_reference_upload_allowed(text) to anon, authenticated;

drop policy if exists "anon_upload_order_reference" on storage.objects;

create policy "anon_upload_order_reference"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'order-references'
    and name ~ '^[0-9a-fA-F-]{36}/reference\.(jpg|jpeg|png|webp)$'
    and public.order_reference_upload_allowed(name)
  );

create or replace function public.slot_is_taken(slot_date date, slot_time text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.orders
    where event_date = slot_is_taken.slot_date
      and event_time = slot_is_taken.slot_time
      and status not in ('cancelled', 'rejected')
  );
$$;

revoke all on function public.slot_is_taken(date, text) from public;
grant execute on function public.slot_is_taken(date, text) to anon, authenticated;

create or replace function public.clear_order_reference_image(order_id text, expected_path text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if order_id is null or expected_path is null then
    return jsonb_build_object('ok', false, 'cleared', false);
  end if;

  if expected_path !~ ('^' || order_id || '/reference\.(jpg|jpeg|png|webp)$') then
    return jsonb_build_object('ok', false, 'cleared', false);
  end if;

  update public.orders
  set reference_image = null
  where id = order_id
    and status = 'pending_review'
    and created_at > now() - interval '30 minutes'
    and reference_image = expected_path;

  get diagnostics v_updated = row_count;
  return jsonb_build_object('ok', true, 'cleared', v_updated > 0);
end;
$$;

drop function if exists public.clear_order_reference_image(text);
revoke all on function public.clear_order_reference_image(text, text) from public;
grant execute on function public.clear_order_reference_image(text, text) to anon, authenticated;

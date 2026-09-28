-- Advisor hardening patch (re-apply after initial schema deploy).
-- Does NOT weaken RLS. Does NOT grant direct orders access to anon.
-- Safe to run multiple times.

-- Unused date-only index (slot lookups use the partial unique index).
drop index if exists public.orders_event_date_idx;

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

create or replace function public.place_order(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id text := coalesce(nullif(payload->>'id', ''), gen_random_uuid()::text);
  v_order_number text;
  v_customer_name text := trim(coalesce(payload->>'customer_name', ''));
  v_phone text := trim(coalesce(payload->>'phone', ''));
  v_service_type text := coalesce(payload->>'service_type', '');
  v_area_id text := nullif(trim(coalesce(payload->>'area_id', '')), '');
  v_address_notes text := trim(coalesce(payload->>'address_notes', ''));
  v_design_mode text := coalesce(payload->>'design_mode', '');
  v_cake_id text := nullif(trim(coalesce(payload->>'cake_id', '')), '');
  v_size_id text := trim(coalesce(payload->>'size_id', ''));
  v_servings integer := nullif(payload->>'servings', '')::integer;
  v_event_date date := nullif(payload->>'event_date', '')::date;
  v_event_time text := coalesce(payload->>'event_time', '');
  v_filling_id text := nullif(trim(coalesce(payload->>'filling_id', '')), '');
  v_notes text := trim(coalesce(payload->>'notes', ''));
  v_reference_image text := nullif(trim(coalesce(payload->>'reference_image', '')), '');
  v_extra_ids text[] := coalesce(
    array(
      select distinct x
      from jsonb_array_elements_text(coalesce(payload->'extra_ids', '[]'::jsonb)) as t(x)
    ),
    array[]::text[]
  );

  v_min_advance_days integer := 3;
  v_today_cairo date := (timezone('Africa/Cairo', now()))::date;
  v_min_date date;

  v_cake public.cakes%rowtype;
  v_size public.cake_sizes%rowtype;
  v_filling public.fillings%rowtype;
  v_zone public.delivery_zones%rowtype;
  v_extra public.design_extras%rowtype;

  v_cake_name text;
  v_size_label text;
  v_custom_size boolean := false;
  v_custom_design boolean := false;

  v_base_price numeric := null;
  v_filling_price numeric := null;
  v_extras_price numeric := null;
  v_delivery_price numeric := null;
  v_total_price numeric := 0;
  v_pending text[] := array[]::text[];
  v_price_lines jsonb := '[]'::jsonb;
  v_extras_snapshot jsonb := '[]'::jsonb;
  v_known_extras_sum numeric := 0;
  v_extras_complete boolean := true;
  v_extra_id text;
  v_constraint text;
begin
  -- Client price/status keys in payload are intentionally ignored.
  v_min_date := v_today_cairo + v_min_advance_days;
  v_order_number := 'MK-' || upper(substr(replace(v_id, '-', ''), 1, 8));

  if v_customer_name = '' or char_length(v_customer_name) < 2 or char_length(v_customer_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_customer', 'message', 'اكتبي الاسم بشكل صحيح.');
  end if;

  if char_length(v_address_notes) > 500 or char_length(v_notes) > 2000 then
    return jsonb_build_object('ok', false, 'code', 'invalid_notes', 'message', 'الملاحظات أطول من المسموح.');
  end if;

  if v_phone !~ '^01[0125][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'invalid_phone', 'message', 'اكتبي رقم موبايل مصري صحيح.');
  end if;

  if v_service_type not in ('delivery', 'pickup') then
    return jsonb_build_object('ok', false, 'code', 'invalid_service', 'message', 'اختاري التوصيل أو الاستلام.');
  end if;

  if v_design_mode not in ('catalog', 'similar', 'custom') then
    return jsonb_build_object('ok', false, 'code', 'invalid_design_mode', 'message', 'نوع التصميم غير صالح.');
  end if;

  if v_servings is null or v_servings < 1 or v_servings > 999 then
    return jsonb_build_object('ok', false, 'code', 'invalid_servings', 'message', 'اكتبي عدد الأفراد بالأرقام.');
  end if;

  if v_event_date is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_date', 'message', 'اختاري تاريخ الاستلام.');
  end if;

  if v_event_date < v_min_date then
    return jsonb_build_object(
      'ok', false,
      'code', 'date_too_soon',
      'message', 'الحجز يجب أن يكون قبل موعد الاستلام بـ 3 أيام على الأقل.'
    );
  end if;

  if v_event_time not in ('12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00') then
    return jsonb_build_object('ok', false, 'code', 'invalid_time', 'message', 'اختاري وقتًا صالحًا.');
  end if;

  perform pg_advisory_xact_lock(hashtext(v_event_date::text || '|' || v_event_time));

  if public.slot_is_taken(v_event_date, v_event_time) then
    return jsonb_build_object(
      'ok', false,
      'code', 'slot_taken',
      'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.'
    );
  end if;

  if v_service_type = 'delivery' then
    select * into v_zone from public.delivery_zones where id = v_area_id and enabled = true;
    if not found then
      return jsonb_build_object(
        'ok', false,
        'code', 'invalid_area',
        'message', 'اختاري منطقة التوصيل. التوصيل حاليًا داخل القاهرة والجيزة فقط.'
      );
    end if;
  else
    v_area_id := null;
  end if;

  v_custom_design := v_design_mode <> 'catalog';

  if v_design_mode in ('catalog', 'similar') then
    if v_cake_id is null then
      return jsonb_build_object('ok', false, 'code', 'invalid_cake', 'message', 'اختاري التصميم.');
    end if;
    select * into v_cake from public.cakes where id = v_cake_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_cake', 'message', 'التصميم المختار غير متاح.');
    end if;
    v_cake_name := v_cake.name;
  else
    v_cake_id := null;
    v_cake_name := null;
  end if;

  if v_size_id = 'custom' then
    v_custom_size := true;
    v_size_label := 'مقاس حسب الطلب';
    v_base_price := null;
    v_pending := array_append(v_pending, 'سعر المقاس');
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base',
      'label', 'سعر المقاس',
      'amount', null,
      'status', 'pending',
      'note', 'مقاس حسب الطلب، وغير موجود في قائمة الأسعار الحالية.'
    ));
    v_total_price := null;
  else
    select * into v_size from public.cake_sizes where id = v_size_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_size', 'message', 'المقاس المختار غير متاح.');
    end if;
    if v_cake_id is not null and not (v_cake.available_size_ids ? v_size_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_size', 'message', 'المقاس غير متاح لهذا التصميم.');
    end if;
    v_size_label := v_size.label;
    v_base_price := v_size.price;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'base',
      'label', 'سعر المقاس (' || v_size.label || ')',
      'amount', v_size.price,
      'status', 'known'
    ));
    v_total_price := v_size.price;
  end if;

  if v_filling_id is null then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'اختاري الحشوة.');
  end if;
  select * into v_filling from public.fillings where id = v_filling_id and enabled = true;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'الحشوة المختارة غير متاحة.');
  end if;
  if v_cake_id is not null and not (v_cake.filling_ids ? v_filling_id) then
    return jsonb_build_object('ok', false, 'code', 'invalid_filling', 'message', 'الحشوة غير متاحة لهذا التصميم.');
  end if;

  if not (v_filling.id = 'none' and coalesce(v_filling.price, -1) = 0) then
    if v_filling.price is null then
      v_pending := array_append(v_pending, v_filling.name);
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'filling',
        'label', v_filling.name,
        'amount', null,
        'status', v_filling.price_status
      ));
    else
      v_filling_price := v_filling.price;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', 'filling',
        'label', v_filling.name,
        'amount', v_filling.price,
        'status', 'known'
      ));
      if v_total_price is not null then
        v_total_price := v_total_price + v_filling.price;
      end if;
    end if;
  end if;

  foreach v_extra_id in array v_extra_ids loop
    select * into v_extra from public.design_extras where id = v_extra_id and enabled = true;
    if not found then
      return jsonb_build_object('ok', false, 'code', 'invalid_extra', 'message', 'إحدى إضافات التصميم غير متاحة.');
    end if;
    if v_cake_id is not null and not (v_cake.extra_ids ? v_extra_id) then
      return jsonb_build_object('ok', false, 'code', 'invalid_extra', 'message', 'إحدى الإضافات غير متاحة لهذا التصميم.');
    end if;

    v_extras_snapshot := v_extras_snapshot || jsonb_build_array(jsonb_build_object(
      'id', v_extra.id,
      'name', v_extra.name,
      'price', v_extra.price,
      'priceStatus', v_extra.price_status
    ));

    if v_extra.price is null then
      v_extras_complete := false;
      v_pending := array_append(v_pending, v_extra.name);
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_extra.id,
        'label', v_extra.name,
        'amount', null,
        'status', v_extra.price_status,
        'note', v_extra.description
      ));
    else
      v_known_extras_sum := v_known_extras_sum + v_extra.price;
      v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
        'id', v_extra.id,
        'label', v_extra.name,
        'amount', v_extra.price,
        'status', 'known'
      ));
      if v_total_price is not null then
        v_total_price := v_total_price + v_extra.price;
      end if;
    end if;
  end loop;

  if v_extras_complete then
    v_extras_price := v_known_extras_sum;
  else
    v_extras_price := null;
  end if;

  if v_service_type = 'delivery' then
    v_delivery_price := null;
    v_price_lines := v_price_lines || jsonb_build_array(jsonb_build_object(
      'id', 'delivery',
      'label', 'التوصيل',
      'amount', null,
      'status', 'outside',
      'note', 'التوصيل عبر أوبر على حساب العميل وخارج سعر التورتة.'
    ));
  end if;

  if v_reference_image is not null
     and v_reference_image !~ ('^' || v_id || '/reference\.(jpg|jpeg|png|webp)$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_reference', 'message', 'مسار الصورة المرجعية غير صالح.');
  end if;

  begin
    insert into public.orders (
      id, order_number, customer_name, phone, area, area_id, address_notes, service_type,
      cake_id, cake_name, design_mode, custom_design, reference_image, servings, size, size_id,
      event_date, event_time, filling, filling_id, filling_price, extras, notes,
      base_price, extras_price, delivery_price, total_price, pending_charges, price_lines,
      status, created_at
    ) values (
      v_id,
      v_order_number,
      v_customer_name,
      v_phone,
      case when v_service_type = 'delivery' then v_zone.name else null end,
      v_area_id,
      v_address_notes,
      v_service_type,
      v_cake_id,
      v_cake_name,
      v_design_mode,
      v_custom_design,
      v_reference_image,
      v_servings,
      v_size_label,
      v_size_id,
      v_event_date,
      v_event_time,
      v_filling.name,
      v_filling.id,
      v_filling_price,
      v_extras_snapshot,
      v_notes,
      v_base_price,
      v_extras_price,
      v_delivery_price,
      v_total_price,
      to_jsonb(v_pending),
      v_price_lines,
      'pending_review',
      now()
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'orders_active_slot_uidx' then
        return jsonb_build_object(
          'ok', false,
          'code', 'slot_taken',
          'message', 'هذا الموعد لم يعد متاحًا. اختاري وقتًا آخر ثم أعيدي المحاولة.'
        );
      end if;
      return jsonb_build_object(
        'ok', false,
        'code', 'order_conflict',
        'message', 'تعذّر حفظ الطلب. أعيدي المحاولة.'
      );
  end;

  return jsonb_build_object(
    'ok', true,
    'order', jsonb_build_object(
      'id', v_id,
      'orderNumber', v_order_number,
      'customerName', v_customer_name,
      'phone', v_phone,
      'area', case when v_service_type = 'delivery' then v_zone.name else null end,
      'areaId', v_area_id,
      'addressNotes', v_address_notes,
      'serviceType', v_service_type,
      'cakeId', v_cake_id,
      'cakeName', v_cake_name,
      'designMode', v_design_mode,
      'customDesign', v_custom_design,
      'referenceImage', v_reference_image,
      'servings', v_servings,
      'size', v_size_label,
      'sizeId', v_size_id,
      'date', v_event_date,
      'time', v_event_time,
      'filling', v_filling.name,
      'fillingId', v_filling.id,
      'fillingPrice', v_filling_price,
      'extras', v_extras_snapshot,
      'notes', v_notes,
      'basePrice', v_base_price,
      'extrasPrice', v_extras_price,
      'deliveryPrice', v_delivery_price,
      'totalPrice', v_total_price,
      'pendingCharges', to_jsonb(v_pending),
      'priceLines', v_price_lines,
      'status', 'pending_review',
      'createdAt', now()
    )
  );
end;
$$;

revoke all on function public.place_order(jsonb) from public;
grant execute on function public.place_order(jsonb) to anon, authenticated;

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

-- Storage policies cannot SELECT public.orders under anon RLS.
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

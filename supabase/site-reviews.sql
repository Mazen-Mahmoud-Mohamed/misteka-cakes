-- Misteka Cakes — Customer Reviews & Testimonials
-- Apply after supabase/order-tracking.sql and supabase/admin-dashboard.sql
-- (requires public.is_admin(), public.normalize_customer_phone, public.order_lookup_throttled).
-- Safe to re-run. Does not weaken existing RLS.

-- ---------------------------------------------------------------------------
-- site_reviews
-- ---------------------------------------------------------------------------

create table if not exists public.site_reviews (
  id uuid primary key default gen_random_uuid(),
  order_id text references public.orders (id) on delete set null,
  order_number text,
  source text not null
    check (source in ('customer', 'whatsapp', 'facebook', 'instagram', 'manual')),
  display_name text not null,
  review_text text not null,
  image_path text,
  status text not null default 'pending'
    check (status in ('pending', 'published', 'rejected')),
  sort_order integer not null default 0,
  featured boolean not null default false,
  published_at timestamptz,
  moderated_at timestamptz,
  moderated_by uuid,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint site_reviews_customer_requires_order
    check (
      (source = 'customer' and order_id is not null and order_number is not null)
      or (source <> 'customer')
    ),
  constraint site_reviews_display_name_len check (char_length(trim(display_name)) between 2 and 80),
  constraint site_reviews_text_len check (char_length(trim(review_text)) between 5 and 1200)
);

create index if not exists site_reviews_status_sort_idx
  on public.site_reviews (status, sort_order, published_at desc nulls last);

create index if not exists site_reviews_order_id_idx
  on public.site_reviews (order_id);

-- One active customer review per order (rejected may be resubmitted).
create unique index if not exists site_reviews_one_active_customer_per_order
  on public.site_reviews (order_id)
  where source = 'customer' and status in ('pending', 'published');

alter table public.site_reviews enable row level security;

revoke all on table public.site_reviews from anon, authenticated;
grant select, insert, update, delete on table public.site_reviews to authenticated;

create or replace function public.set_site_reviews_updated_at()
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

drop trigger if exists site_reviews_set_updated_at on public.site_reviews;
create trigger site_reviews_set_updated_at
  before update on public.site_reviews
  for each row
  execute function public.set_site_reviews_updated_at();

-- ---------------------------------------------------------------------------
-- Safe public view (columns only — never expose order/admin metadata)
-- ---------------------------------------------------------------------------

-- security_invoker = false: view owner bypasses RLS so anon can read ONLY these
-- columns. Anon has no SELECT grant/policy on the base table (column safety).
create or replace view public.site_reviews_public
with (security_invoker = false)
as
select
  display_name,
  review_text,
  image_path,
  source,
  published_at,
  sort_order,
  featured
from public.site_reviews
where status = 'published';

revoke all on table public.site_reviews_public from anon, authenticated;
grant select on table public.site_reviews_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- RLS on site_reviews (no anon SELECT — public reads go through the view only)
-- ---------------------------------------------------------------------------

drop policy if exists "public_select_published_site_reviews" on public.site_reviews;

drop policy if exists "admin_select_all_site_reviews" on public.site_reviews;
create policy "admin_select_all_site_reviews"
  on public.site_reviews for select
  to authenticated
  using (public.is_admin());

drop policy if exists "admin_insert_site_reviews" on public.site_reviews;
create policy "admin_insert_site_reviews"
  on public.site_reviews for insert
  to authenticated
  with check (public.is_admin());

drop policy if exists "admin_update_site_reviews" on public.site_reviews;
create policy "admin_update_site_reviews"
  on public.site_reviews for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "admin_delete_site_reviews" on public.site_reviews;
create policy "admin_delete_site_reviews"
  on public.site_reviews for delete
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- Customer RPC: submit review (no direct INSERT for anon)
-- ---------------------------------------------------------------------------

create or replace function public.submit_customer_review(
  p_phone text,
  p_order_number text,
  p_display_name text,
  p_review_text text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_customer_phone(p_phone);
  v_number text := upper(trim(coalesce(p_order_number, '')));
  v_name text := trim(coalesce(p_display_name, ''));
  v_text text := trim(coalesce(p_review_text, ''));
  v_order public.orders%rowtype;
  v_id uuid;
begin
  if v_phone !~ '^01[0125][0-9]{8}$' or v_number !~ '^MK-[0-9A-F]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    return jsonb_build_object('ok', false, 'code', 'invalid_name', 'message', 'اكتبي اسمًا مناسبًا للعرض (حرفان على الأقل).');
  end if;

  if char_length(v_text) < 5 or char_length(v_text) > 1200 then
    return jsonb_build_object('ok', false, 'code', 'invalid_text', 'message', 'اكتبي رأيك بوضوح (من 5 إلى 1200 حرف).');
  end if;

  if public.order_lookup_throttled() then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'محاولات كثيرة. انتظري بضع دقائق ثم أعيدي المحاولة.');
  end if;

  select * into v_order
  from public.orders
  where order_number = v_number and phone = v_phone;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  if v_order.status <> 'delivered' then
    return jsonb_build_object('ok', false, 'code', 'not_eligible', 'message', 'يمكن إرسال الرأي بعد تسليم الطلب فقط.');
  end if;

  if exists (
    select 1
    from public.site_reviews r
    where r.order_id = v_order.id
      and r.source = 'customer'
      and r.status in ('pending', 'published')
  ) then
    return jsonb_build_object('ok', false, 'code', 'duplicate', 'message', 'تم إرسال رأي لهذا الطلب مسبقًا.');
  end if;

  insert into public.site_reviews (
    order_id,
    order_number,
    source,
    display_name,
    review_text,
    status
  )
  values (
    v_order.id,
    v_order.order_number,
    'customer',
    v_name,
    v_text,
    'pending'
  )
  returning id into v_id;

  return jsonb_build_object('ok', true, 'reviewId', v_id);
end;
$$;

revoke all on function public.submit_customer_review(text, text, text, text) from public;
grant execute on function public.submit_customer_review(text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage helpers + attach image RPC
-- ---------------------------------------------------------------------------

create or replace function public.review_upload_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_review public.site_reviews%rowtype;
begin
  if object_name !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/photo\.(jpg|jpeg|png|webp)$' then
    return false;
  end if;

  v_id := split_part(object_name, '/', 1)::uuid;

  select * into v_review from public.site_reviews where id = v_id;
  if not found then
    return false;
  end if;

  if v_review.source <> 'customer' or v_review.status <> 'pending' then
    return false;
  end if;

  -- One pending image slot; do not allow overwrite of an already-linked path.
  if v_review.image_path is not null then
    return false;
  end if;

  -- Upload window: 30 minutes after review creation.
  if v_review.created_at < now() - interval '30 minutes' then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function public.review_upload_allowed(text) from public;
grant execute on function public.review_upload_allowed(text) to anon, authenticated;

create or replace function public.attach_customer_review_image(
  p_phone text,
  p_order_number text,
  p_review_id uuid,
  p_image_path text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text := public.normalize_customer_phone(p_phone);
  v_number text := upper(trim(coalesce(p_order_number, '')));
  v_path text := trim(coalesce(p_image_path, ''));
  v_order public.orders%rowtype;
  v_review public.site_reviews%rowtype;
begin
  if v_phone !~ '^01[0125][0-9]{8}$' or v_number !~ '^MK-[0-9A-F]{8}$' then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  if public.order_lookup_throttled() then
    return jsonb_build_object('ok', false, 'code', 'rate_limited', 'message', 'محاولات كثيرة. انتظري بضع دقائق ثم أعيدي المحاولة.');
  end if;

  select * into v_order
  from public.orders
  where order_number = v_number and phone = v_phone;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد طلبًا بهذه البيانات.');
  end if;

  select * into v_review from public.site_reviews where id = p_review_id;
  if not found then
    return jsonb_build_object('ok', false, 'code', 'not_found', 'message', 'لم نجد الرأي المطلوب.');
  end if;

  if v_review.source <> 'customer'
     or v_review.status <> 'pending'
     or v_review.order_id is distinct from v_order.id
     or v_review.order_number is distinct from v_order.order_number then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'لا يمكن إرفاق صورة لهذا الرأي.');
  end if;

  if v_review.image_path is not null then
    return jsonb_build_object('ok', false, 'code', 'already_attached', 'message', 'تم إرفاق صورة لهذا الرأي مسبقًا.');
  end if;

  if v_path !~* ('^' || p_review_id::text || '/photo\.(jpg|jpeg|png|webp)$') then
    return jsonb_build_object('ok', false, 'code', 'invalid_path', 'message', 'مسار الصورة غير صالح.');
  end if;

  if not public.review_upload_allowed(v_path) then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'انتهت مهلة رفع الصورة أو الرأي غير قابل للتعديل.');
  end if;

  -- Confirm object exists in private bucket.
  if not exists (
    select 1
    from storage.objects o
    where o.bucket_id = 'review-uploads'
      and o.name = v_path
  ) then
    return jsonb_build_object('ok', false, 'code', 'missing_file', 'message', 'لم يتم العثور على الصورة المرفوعة.');
  end if;

  update public.site_reviews
  set image_path = v_path
  where id = p_review_id
    and status = 'pending'
    and source = 'customer'
    and image_path is null;

  if not found then
    return jsonb_build_object('ok', false, 'code', 'forbidden', 'message', 'لا يمكن إرفاق صورة لهذا الرأي.');
  end if;

  return jsonb_build_object('ok', true, 'reviewId', p_review_id, 'imagePath', v_path);
end;
$$;

revoke all on function public.attach_customer_review_image(text, text, uuid, text) from public;
grant execute on function public.attach_customer_review_image(text, text, uuid, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'review-uploads',
  'review-uploads',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'testimonials',
  'testimonials',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Private pending uploads: customer insert only when helper allows; admin read/delete.
drop policy if exists "anon_upload_review_pending" on storage.objects;
create policy "anon_upload_review_pending"
  on storage.objects for insert
  to anon, authenticated
  with check (
    bucket_id = 'review-uploads'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/photo\.(jpg|jpeg|png|webp)$'
    and public.review_upload_allowed(name)
  );

drop policy if exists "admin_select_review_uploads" on storage.objects;
create policy "admin_select_review_uploads"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'review-uploads' and public.is_admin());

drop policy if exists "admin_delete_review_uploads" on storage.objects;
create policy "admin_delete_review_uploads"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'review-uploads' and public.is_admin());

-- Public testimonials: admin write; public bucket serves published objects.
drop policy if exists "admin_select_testimonials" on storage.objects;
create policy "admin_select_testimonials"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'testimonials' and public.is_admin());

drop policy if exists "admin_insert_testimonials" on storage.objects;
create policy "admin_insert_testimonials"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'testimonials'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and public.is_admin()
  );

drop policy if exists "admin_update_testimonials" on storage.objects;
create policy "admin_update_testimonials"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'testimonials' and public.is_admin())
  with check (
    bucket_id = 'testimonials'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
    and public.is_admin()
  );

drop policy if exists "admin_delete_testimonials" on storage.objects;
create policy "admin_delete_testimonials"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'testimonials' and public.is_admin());

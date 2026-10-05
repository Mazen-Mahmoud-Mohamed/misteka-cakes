-- Misteka Cakes — Admin screenshot testimonials (nullable name/text)
-- Apply AFTER supabase/site-reviews.sql (already live).
-- Safe to re-run. Does not weaken customer review rules or RLS.

-- ---------------------------------------------------------------------------
-- Allow NULL display_name / review_text for screenshot-only admin testimonials.
-- Customer reviews still require both fields (enforced below).
-- ---------------------------------------------------------------------------

alter table public.site_reviews
  alter column display_name drop not null;

alter table public.site_reviews
  alter column review_text drop not null;

alter table public.site_reviews
  drop constraint if exists site_reviews_display_name_len;

alter table public.site_reviews
  drop constraint if exists site_reviews_text_len;

alter table public.site_reviews
  drop constraint if exists site_reviews_customer_requires_order;

alter table public.site_reviews
  drop constraint if exists site_reviews_row_shape;

alter table public.site_reviews
  add constraint site_reviews_row_shape check (
    -- Customer written reviews (unchanged requirements)
    (
      source = 'customer'
      and order_id is not null
      and order_number is not null
      and display_name is not null
      and review_text is not null
      and char_length(trim(display_name)) between 2 and 80
      and char_length(trim(review_text)) between 5 and 1200
    )
    -- Admin screenshot testimonials (image is the content — no fake text/name)
    or (
      source in ('whatsapp', 'facebook', 'instagram')
      and order_id is null
      and order_number is null
      and display_name is null
      and review_text is null
      and image_path is not null
      and length(trim(image_path)) > 0
    )
    -- Legacy admin text testimonials (pre-screenshot migration) — keep readable
    or (
      source in ('whatsapp', 'facebook', 'instagram', 'manual')
      and order_id is null
      and display_name is not null
      and review_text is not null
      and char_length(trim(display_name)) between 2 and 80
      and char_length(trim(review_text)) between 5 and 1200
    )
    -- Legacy / rare manual screenshot (image-only, no fake copy)
    or (
      source = 'manual'
      and order_id is null
      and order_number is null
      and display_name is null
      and review_text is null
      and image_path is not null
      and length(trim(image_path)) > 0
    )
  );

-- Public read layer is the dedicated table + sync trigger in
-- supabase/site-reviews-public-table.sql — do not recreate a SECURITY DEFINER view.

notify pgrst, 'reload schema';

-- Misteka Cakes — block hard-deleting products that have order history
-- Apply after supabase/order-products-offers.sql.
--
-- Additive and safe to re-run:
--   • adds public.product_order_history(text) (admin-only helper)
--   • adds a BEFORE DELETE trigger on public.products
--   • does NOT add foreign keys to orders/order_items and does NOT touch order data
--
-- A product is "historical" when any of these reference it:
--   orders.product_id, order_items.product_id, or (for cake products) orders.cake_id.
-- Historical products can still be hidden (enabled = false); only DELETE is refused.

create or replace function public.product_order_history(p_product_id text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'orders', (select count(*) from public.orders o where o.product_id = p_product_id),
    'order_items', (select count(*) from public.order_items i where i.product_id = p_product_id),
    'cake_orders', (
      select count(*) from public.orders o
      join public.products p on p.legacy_cake_id = o.cake_id
      where p.id = p_product_id
    )
  );
$$;

revoke all on function public.product_order_history(text) from public, anon, authenticated;

create or replace function public.products_block_delete_with_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.orders o where o.product_id = old.id)
     or exists (select 1 from public.order_items i where i.product_id = old.id)
     or (old.legacy_cake_id is not null
         and exists (select 1 from public.orders o where o.cake_id = old.legacy_cake_id)) then
    raise exception 'product_has_order_history'
      using errcode = 'P0001',
            detail = 'product ' || old.id || ' is referenced by historical orders',
            hint = 'لا يمكن حذف منتج له طلبات سابقة. يمكنك إخفاؤه بدلًا من حذفه.';
  end if;
  return old;
end;
$$;

revoke all on function public.products_block_delete_with_history() from public, anon, authenticated;

drop trigger if exists products_block_delete_with_history on public.products;
create trigger products_block_delete_with_history
  before delete on public.products
  for each row execute function public.products_block_delete_with_history();

-- Product delete protection tests. Run AFTER supabase/product-delete-protection.sql.
-- Never writes orders/order_items. Every product change is inside this transaction and rolled back.
-- Deletes run as the table owner, i.e. bypassing the Admin UI and service (case H).
begin;

create temp table qa_results (name text, ok boolean, detail text) on commit drop;

do $$
declare
  v_hist jsonb;
  v_cake text;
  v_msg text;
  v_rows int;
begin
  -- A + B: product with orders.product_id AND order_items.product_id history
  v_hist := public.product_order_history('test-demo-cupcake-pkg');
  insert into qa_results values ('A_has_orders_ref', (v_hist->>'orders')::int > 0, v_hist::text);
  insert into qa_results values ('B_has_order_items_ref', (v_hist->>'order_items')::int > 0, v_hist::text);
  begin
    delete from public.products where id = 'test-demo-cupcake-pkg';
    insert into qa_results values ('AB_delete_with_history_rejected', false, 'delete succeeded');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into qa_results values ('AB_delete_with_history_rejected', v_msg = 'product_has_order_history', v_msg);
  end;

  -- C: product with no history and no offer → delete allowed (undone by raising inside the sub-block)
  v_hist := public.product_order_history('test-demo-cookies-weight');
  begin
    delete from public.products where id = 'test-demo-cookies-weight';
    get diagnostics v_rows = row_count;
    raise exception 'qa_undo_%', v_rows;
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into qa_results values ('C_delete_without_history_allowed', v_msg = 'qa_undo_1', v_msg || ' ' || v_hist::text);
  end;
  insert into qa_results values ('C_row_restored', exists (select 1 from public.products where id = 'test-demo-cookies-weight'), null);

  -- D: product used by an offer (no order history) → existing FK protection
  begin
    delete from public.products where id = 'test-demo-fixed';
    insert into qa_results values ('D_offer_product_protected', false, 'delete succeeded');
  exception when foreign_key_violation then
    insert into qa_results values ('D_offer_product_protected', true, 'foreign_key_violation');
  when others then
    get stacked diagnostics v_msg = message_text;
    insert into qa_results values ('D_offer_product_protected', false, v_msg);
  end;

  -- E: cake product whose cake has historical orders → blocked even when bypassing the service
  select p.id into v_cake
  from public.products p
  where p.legacy_cake_id is not null
    and exists (select 1 from public.orders o where o.cake_id = p.legacy_cake_id)
  limit 1;
  begin
    delete from public.products where id = v_cake;
    insert into qa_results values ('E_cake_with_history_rejected', false, coalesce(v_cake, 'no cake'));
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into qa_results values ('E_cake_with_history_rejected', v_msg = 'product_has_order_history', v_cake || ': ' || v_msg);
  end;

  -- F: hidden product with history stays hide-only
  update public.products set enabled = false where id = 'test-demo-cupcake-pkg';
  insert into qa_results values ('F_hide_allowed', not (select enabled from public.products where id = 'test-demo-cupcake-pkg'), null);
  begin
    delete from public.products where id = 'test-demo-cupcake-pkg';
    insert into qa_results values ('F_hidden_still_undeletable', false, 'delete succeeded');
  exception when others then
    get stacked diagnostics v_msg = message_text;
    insert into qa_results values ('F_hidden_still_undeletable', v_msg = 'product_has_order_history', v_msg);
  end;

  -- Helper is not callable by clients
  insert into qa_results values ('helper_not_public',
    not has_function_privilege('anon', 'public.product_order_history(text)', 'execute')
    and not has_function_privilege('authenticated', 'public.product_order_history(text)', 'execute'), null);
end $$;

select json_build_object(
  'passed', (select count(*) from qa_results where ok),
  'total', (select count(*) from qa_results),
  'results', (select json_agg(json_build_object('name', name, 'ok', ok, 'detail', detail)) from qa_results)
) as result;

rollback;

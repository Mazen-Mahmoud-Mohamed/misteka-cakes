-- Run only AFTER supabase/pricing-content.sql is applied. Everything is rolled back.
-- Touches only pricing_sections / pricing_items inside one transaction. No orders.
begin;

create temp table qa_results (name text, ok boolean, detail text) on commit drop;
grant all on qa_results to anon, authenticated;

-- Fixtures (as owner): hidden section, hidden item, visible manual + text items
insert into public.pricing_sections (id, title, enabled, sort_order) values
  ('qa-hidden-section', 'QA hidden', false, 5000),
  ('qa-visible-section', 'QA visible', true, 5010);
insert into public.pricing_items (id, section_id, item_kind, label, price, unit, enabled, sort_order) values
  ('qa-hidden-item', 'ps-notes', 'price', 'QA hidden row', 1, '', false, 1),
  ('qa-item-in-hidden-section', 'qa-hidden-section', 'note', 'QA note in hidden section', null, '', true, 1),
  ('qa-manual', 'qa-visible-section', 'price', 'QA manual', 123.5, 'قطعة', true, 10),
  ('qa-text', 'qa-visible-section', 'text', 'QA free text', null, '', true, 20);

-- ---------------- anon -------------------------------------------------------
set local role anon;
insert into qa_results select 'anon_hidden_section_invisible', not exists (select 1 from public.pricing_sections where id = 'qa-hidden-section'), null;
insert into qa_results select 'anon_hidden_item_invisible', not exists (select 1 from public.pricing_items where id = 'qa-hidden-item'), null;
insert into qa_results select 'anon_item_in_hidden_section_invisible', not exists (select 1 from public.pricing_items where id = 'qa-item-in-hidden-section'), null;
insert into qa_results select 'anon_reads_visible', (select count(*) from public.pricing_sections where id in ('ps-cakes-single','qa-visible-section')) = 2, null;
insert into qa_results select 'anon_manual_item', exists (select 1 from public.pricing_items where id = 'qa-manual' and price = 123.5 and unit = 'قطعة'), null;
insert into qa_results select 'anon_text_item', exists (select 1 from public.pricing_items where id = 'qa-text' and item_kind = 'text'), null;
do $$
declare ok boolean;
begin
  begin insert into public.pricing_sections (id, title) values ('qa-anon', 'x'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  insert into qa_results values ('anon_insert_denied', ok, null);
  begin update public.pricing_items set label = 'x' where id = 'pi-note-1'; ok := not found;
  exception when insufficient_privilege then ok := true; end;
  insert into qa_results values ('anon_update_denied', ok, null);
  begin delete from public.pricing_items where id = 'pi-note-1'; ok := not found;
  exception when insufficient_privilege then ok := true; end;
  insert into qa_results values ('anon_delete_denied', ok, null);
end $$;
reset role;

-- ---------------- authenticated non-admin -----------------------------------
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-000000000000', 'role', 'authenticated')::text, true);
set local role authenticated;
insert into qa_results select 'non_admin_hidden_invisible', not exists (select 1 from public.pricing_sections where id = 'qa-hidden-section'), null;
do $$
declare ok boolean;
begin
  begin insert into public.pricing_sections (id, title) values ('qa-user', 'x'); ok := false;
  exception when insufficient_privilege then ok := true; end;
  insert into qa_results values ('non_admin_insert_denied', ok, null);
  update public.pricing_items set label = 'x' where id = 'pi-note-1';
  insert into qa_results values ('non_admin_update_noop', not found, null);
  delete from public.pricing_sections where id = 'ps-notes';
  insert into qa_results values ('non_admin_delete_noop', not found, null);
end $$;
reset role;

-- ---------------- admin ------------------------------------------------------
select set_config('request.jwt.claims',
  json_build_object('sub', (select id from public.admin_users where enabled limit 1), 'role', 'authenticated')::text, true);
set local role authenticated;
insert into qa_results select 'admin_sees_hidden', exists (select 1 from public.pricing_sections where id = 'qa-hidden-section'), null;
insert into public.pricing_sections (id, title, sort_order) values ('qa-admin-section', 'QA admin', 6000);
insert into public.pricing_items (id, section_id, item_kind, label, price, sort_order)
  values ('qa-admin-a', 'qa-admin-section', 'price', 'A', 10, 10), ('qa-admin-b', 'qa-admin-section', 'price', 'B', 20, 20);
-- reorder (swap) exactly like swapAdminPricingOrder
update public.pricing_items set sort_order = 20 where id = 'qa-admin-a';
update public.pricing_items set sort_order = 10 where id = 'qa-admin-b';
insert into qa_results select 'admin_reorder',
  (select string_agg(label, ',' order by sort_order) from public.pricing_items where section_id = 'qa-admin-section') = 'B,A', null;
update public.pricing_sections set enabled = false where id = 'qa-admin-section';
insert into qa_results select 'admin_update', not (select enabled from public.pricing_sections where id = 'qa-admin-section'), null;
delete from public.pricing_sections where id = 'qa-admin-section';
insert into qa_results select 'admin_delete_cascades', not exists (select 1 from public.pricing_items where section_id = 'qa-admin-section'), null;
reset role;

-- ---------------- shape constraints ------------------------------------------
do $$
declare ok boolean;
begin
  begin
    insert into public.pricing_items (id, section_id, item_kind, cake_size_id, price)
    values ('qa-bad1', 'ps-notes', 'cake_size', (select id from public.cake_sizes limit 1), 999); ok := false;
  exception when check_violation then ok := true; end;
  insert into qa_results values ('linked_cake_size_rejects_price', ok, null);
  begin
    insert into public.pricing_items (id, section_id, item_kind, price_tier_id, price)
    values ('qa-bad2', 'ps-notes', 'product_tier', (select id from public.product_price_tiers limit 1), 1); ok := false;
  exception when check_violation then ok := true; end;
  insert into qa_results values ('linked_tier_rejects_price', ok, null);
  begin
    insert into public.pricing_items (id, section_id, item_kind, label) values ('qa-bad3', 'ps-notes', 'price', 'no price'); ok := false;
  exception when check_violation then ok := true; end;
  insert into qa_results values ('manual_requires_price', ok, null);
  begin
    insert into public.pricing_items (id, section_id, item_kind, label) values ('qa-bad4', 'ps-notes', 'note', ''); ok := false;
  exception when check_violation then ok := true; end;
  insert into qa_results values ('note_requires_text', ok, null);
end $$;

-- ---------------- live price resolution --------------------------------------
insert into qa_results select 'cake_size_items_live',
  (select count(*) from public.pricing_items i join public.cake_sizes s on s.id = i.cake_size_id where i.price is null)
  = (select count(*) from public.pricing_items where item_kind = 'cake_size'), null;
insert into qa_results select 'tier_items_live',
  (select count(*) from public.pricing_items i join public.product_price_tiers t on t.id = i.price_tier_id where i.price is null)
  = (select count(*) from public.pricing_items where item_kind = 'product_tier'), null;
insert into qa_results select 'product_items_live',
  (select count(*) from public.pricing_items i join public.products p on p.id = i.product_id where i.price is null)
  = (select count(*) from public.pricing_items where item_kind = 'product'), null;

select json_build_object(
  'passed', (select count(*) from qa_results where ok),
  'total', (select count(*) from qa_results),
  'failed', (select coalesce(json_agg(name), '[]'::json) from qa_results where not ok)
) as result;
rollback;

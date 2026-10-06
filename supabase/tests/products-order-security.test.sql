-- Concrete security / pricing contract cases for place_order after:
--   1) products-system.sql
--   2) order-products-offers.sql
-- Run only on staging. Do NOT run against production.
--
-- Offer math examples (illustrative unit prices, not live data):
--
-- A) Gift: cake full_price 500 + cake_pops free 150
--    Expected total = 500
-- B) Percent: cake full_price 500 + cupcakes percent_off 50% on 200
--    Expected total = 500 + 100 = 600
-- C) Fixed off: item 300 with fixed_off 50 → line 250
-- D) Custom bundle: custom_bundle_price 700 + options 40 → total 740
-- E) Full price components: 500 + 150 = 650
--
-- Malicious / invalid cases (all must return ok=false with listed code):

-- A fake product price / total / base in payload → ignored; DB price used
--    code: (success with DB total) OR invalid_* if product missing

-- B fake option price in payload → ignored; price_adjustment from DB

-- C fake total_price in payload → ignored

-- D fake discount_percent on client → ignored; offer_components used

-- E inactive product (enabled=false) → invalid_product

-- F hidden product → invalid_product

-- G disabled category → invalid_product

-- H option_value_id belonging to another product → invalid_option

-- I disabled option_value → invalid_option

-- J offer ends_at < now() → offer_expired

-- K offer starts_at > now() → offer_not_started

-- L forged offer_selections component_id / component_pricing → server loads DB components by offer_id only

-- M customer_picks product outside category_id → invalid_offer_selection

-- N quote pricing_mode product via order_kind=product → quote_only

-- O quantity 0 / negative → invalid_quantity

-- P quantity 100000 or non-numeric → invalid_quantity

-- Q included_in_bundle on non-custom_bundle offer → invalid_offer

-- R cake legacy path without order_kind → unchanged size+filling+extras pricing

-- Extended after product-ordering-models.sql:
-- S fake tier price in payload → ignored; product_price_tiers.price used
-- T fake package price in payload → ignored
-- U fake weight price in payload → ignored
-- V invalid tier id → invalid_tier
-- W tier belonging to another product → invalid_tier
-- X quantity below qty_min / above qty_max / bad step → invalid_quantity
-- Y fake option library price → ignored; definition value / override used
-- Z quote ordering_model forced paid → quote_only
-- AA historical order snapshot integrity (names/prices unchanged on re-read)

-- Static assertions used by scripts/products-order-security-qa.mjs:
--   quote_only rejection exists
--   search_path empty on helpers + place_order
--   customer_picks category enforcement exists
--   revoke helpers from anon/authenticated
-- Also: scripts/product-ordering-security-qa.mjs

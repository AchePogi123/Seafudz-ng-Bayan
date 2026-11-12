-- ============================================================================
-- MIGRATION: 036_inventory_ledger_consumed_and_stock_precision.sql
-- Description: Two additive fixes to inventory bookkeeping. No stock quantity
--   is changed by this migration.
--
--   1. order_inventory_ledger gets a terminal state, CONSUMED.
--      A row used to stay RESERVED forever once its order was served. Served
--      orders were therefore treated as still "holding" stock: wiping
--      transactions gave their ingredients back, voiding a served order put
--      its packaging back on the shelf, "Reload baseline" was refused, and a
--      re-used order id was not deducted. Rows of served orders are now
--      CONSUMED and can never be returned.
--
--   2. Stock is kept to 4 decimals (was 3), matching the ledger. Items stocked
--      in kg / L with recipes in g / ml (22.5 ml = 0.0225 L) were rounded on
--      every order, so an order + cancel did not restore the same amount.
-- ============================================================================

-- 1. Terminal state for stock that was really used
ALTER TABLE order_inventory_ledger DROP CONSTRAINT IF EXISTS order_inventory_ledger_state_check;
ALTER TABLE order_inventory_ledger
  ADD CONSTRAINT order_inventory_ledger_state_check
  CHECK (state IN ('RESERVED', 'RETURNED', 'WASTED', 'CONSUMED'));

-- Close the reservations of orders that were already served, and of orders
-- whose record no longer exists (a deleted served order, or a manual reset):
-- that stock left the shelf long ago and nothing can cancel those orders now.
UPDATE order_inventory_ledger l
   SET state = 'CONSUMED',
       released_at = COALESCE(l.released_at, NOW())
 WHERE l.state = 'RESERVED'
   AND NOT EXISTS (
     SELECT 1 FROM orders o WHERE o.id = l.order_id AND o.status <> 'COMPLETED'
   );

-- 2. Same precision for stock, its movements and the order ledger
ALTER TABLE inventory_ingredients
  ALTER COLUMN current_stock TYPE NUMERIC(14, 4),
  ALTER COLUMN min_stock_level TYPE NUMERIC(14, 4),
  ALTER COLUMN preferred_restock_qty TYPE NUMERIC(14, 4);

ALTER TABLE inventory_transactions
  ALTER COLUMN quantity_delta TYPE NUMERIC(14, 4),
  ALTER COLUMN stock_after TYPE NUMERIC(14, 4);

-- 026_add_cancelled_to_order_items_status.sql
-- Expand order_items_item_status_check constraint to include 'CANCELLED'

DO $$
BEGIN
  ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_item_status_check;
  ALTER TABLE order_items ADD CONSTRAINT order_items_item_status_check
    CHECK (item_status IN ('ACTIVE', 'OUT_OF_STOCK', 'REPLACED', 'REFUNDED', 'CANCELLED'));
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error updating order_items_item_status_check constraint: %', SQLERRM;
END $$;


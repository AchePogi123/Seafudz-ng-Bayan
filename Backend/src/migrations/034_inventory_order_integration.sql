-- ============================================================================
-- MIGRATION: 034_inventory_order_integration.sql
-- Description: Connects inventory to orders.
--   * order_inventory_ledger  - exactly what each order reserved, so a
--     cancellation can return it precisely and only once.
--   * inventory_transactions.order_id - order-driven stock movements.
--   * orders.inventory_prep_started_at - set when the kitchen starts cooking,
--     so a late cancellation writes food off as waste.
--   * current_stock >= 0 guard on inventory_ingredients.
--   * purchase_orders / purchase_order_items - previously browser-only.
--   * recipe_packaging seed (033 shipped the table empty).
-- ============================================================================

-- 1. Ledger of stock reserved per order
CREATE TABLE IF NOT EXISTS order_inventory_ledger (
  id BIGSERIAL PRIMARY KEY,
  order_id VARCHAR(100) NOT NULL,
  order_item_id BIGINT,
  product_id VARCHAR(100),
  ingredient_id VARCHAR(50) NOT NULL REFERENCES inventory_ingredients(id) ON DELETE CASCADE,
  item_type VARCHAR(20) NOT NULL DEFAULT 'FOOD',
  quantity NUMERIC(14, 4) NOT NULL CHECK (quantity > 0),
  state VARCHAR(20) NOT NULL DEFAULT 'RESERVED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at TIMESTAMPTZ,
  CONSTRAINT order_inventory_ledger_state_check CHECK (state IN ('RESERVED', 'RETURNED', 'WASTED'))
);
CREATE INDEX IF NOT EXISTS idx_order_inventory_ledger_order ON order_inventory_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_order_inventory_ledger_open ON order_inventory_ledger(order_id) WHERE state = 'RESERVED';

-- 2. Link stock movements to orders
ALTER TABLE inventory_transactions ADD COLUMN IF NOT EXISTS order_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_order ON inventory_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_ingredient ON inventory_transactions(ingredient_id, timestamp DESC);

-- 3. Kitchen start marker
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_prep_started_at TIMESTAMPTZ;
-- remembers DELIVERY / PICKUP / TAKE_OUT / DINE_IN so an edited order re-reserves the same packaging
ALTER TABLE orders ADD COLUMN IF NOT EXISTS inventory_fulfillment VARCHAR(20);

-- 4. Stock can never go negative
UPDATE inventory_ingredients SET current_stock = 0 WHERE current_stock < 0;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_ingredients_stock_nonnegative'
  ) THEN
    ALTER TABLE inventory_ingredients
      ADD CONSTRAINT inventory_ingredients_stock_nonnegative CHECK (current_stock >= 0);
  END IF;
END $$;

-- 5. Purchase orders (were browser-only)
CREATE TABLE IF NOT EXISTS inventory_purchase_orders (
  id VARCHAR(50) PRIMARY KEY,
  po_number VARCHAR(50) NOT NULL UNIQUE,
  supplier_id VARCHAR(50) REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(150) NOT NULL,
  order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expected_delivery_date TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'PENDING',
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  received_at TIMESTAMPTZ,
  received_by VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT inventory_purchase_orders_status_check
    CHECK (status IN ('PENDING', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED'))
);

CREATE TABLE IF NOT EXISTS inventory_purchase_order_items (
  id VARCHAR(60) PRIMARY KEY,
  purchase_order_id VARCHAR(50) NOT NULL REFERENCES inventory_purchase_orders(id) ON DELETE CASCADE,
  ingredient_id VARCHAR(50) NOT NULL REFERENCES inventory_ingredients(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(150) NOT NULL,
  item_type VARCHAR(20) NOT NULL DEFAULT 'FOOD',
  category VARCHAR(100),
  ordered_quantity NUMERIC(12, 3) NOT NULL,
  received_quantity NUMERIC(12, 3) NOT NULL DEFAULT 0,
  unit VARCHAR(20) NOT NULL,
  unit_cost NUMERIC(10, 3) NOT NULL DEFAULT 0,
  total_cost NUMERIC(12, 2) NOT NULL DEFAULT 0,
  batch_number VARCHAR(80),
  expiration_date DATE
);
CREATE INDEX IF NOT EXISTS idx_inventory_po_items_po ON inventory_purchase_order_items(purchase_order_id);

-- 5b. recipe_packaging was missing the shared-capacity column the admin UI edits
ALTER TABLE recipe_packaging ADD COLUMN IF NOT EXISTS shared_capacity INT;
ALTER TABLE recipe_packaging ADD COLUMN IF NOT EXISTS notes TEXT;

-- 6. Packaging requirements per recipe (TAKEOUT rows apply to pickup, takeout AND delivery orders)
INSERT INTO recipe_packaging (id, product_id, packaging_id, packaging_name, category, quantity, unit, fulfillment_type, scope, estimated_cost) VALUES
('pkg-rec-01-tray', 'all-shrimp-alacarte-199', 'pkg-bento-tray', '3-Compartment Bento Food Tray (Microwaveable)', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 6.5),
('pkg-rec-01-cut', 'all-shrimp-alacarte-199', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-02-bwl', 'all-shrimp-bowl-699', 'pkg-seafood-bowl', 'Large Seafood Sharing Bowl w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 8.5),
('pkg-rec-02-cut', 'all-shrimp-bowl-699', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-03-try', 'all-shrimp-tray-1099', 'pkg-fiesta-tray', 'Aluminum Fiesta Platter Tray w/ Cover', 'Boxes & Bilao Packaging', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 18.0),
('pkg-rec-03-cut', 'all-shrimp-tray-1099', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 2, 'pcs', 'TAKEOUT', 'PER_ITEM', 4.4),
('pkg-rec-04-try', 'mixed-seafoods-alacarte-99', 'pkg-bento-tray', '3-Compartment Bento Food Tray (Microwaveable)', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 6.5),
('pkg-rec-04-cut', 'mixed-seafoods-alacarte-99', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-05-tub', 'mixed-seafoods-tub-189', 'pkg-seafood-tub', 'Clear Round Seafood Tub w/ Sealed Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 7.0),
('pkg-rec-05-cut', 'mixed-seafoods-tub-189', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-06-bwl', 'mixed-seafoods-bowl-699', 'pkg-seafood-bowl', 'Large Seafood Sharing Bowl w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 8.5),
('pkg-rec-06-cut', 'mixed-seafoods-bowl-699', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-07-try', 'mixed-seafoods-tray-1199', 'pkg-fiesta-tray', 'Aluminum Fiesta Platter Tray w/ Cover', 'Boxes & Bilao Packaging', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 18.0),
('pkg-rec-07-cut', 'mixed-seafoods-tray-1199', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 2, 'pcs', 'TAKEOUT', 'PER_ITEM', 4.4),
('pkg-rec-08-try', 'chicken-pastil-35', 'pkg-bento-tray', '3-Compartment Bento Food Tray (Microwaveable)', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 6.5),
('pkg-rec-08-cut', 'chicken-pastil-35', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-09-try', 'fried-noodles-35', 'pkg-bento-tray', '3-Compartment Bento Food Tray (Microwaveable)', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 6.5),
('pkg-rec-09-cut', 'fried-noodles-35', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-10-try', 'chao-fan-35', 'pkg-bento-tray', '3-Compartment Bento Food Tray (Microwaveable)', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 6.5),
('pkg-rec-10-cut', 'chao-fan-35', 'pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'Cutlery, Napkins & Packets', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 2.2),
('pkg-rec-sio-sauce', 'pork-siomai-5', 'pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 1.0),
('pkg-rec-sio-sauce-2', 'beef-siomai-5', 'pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 1.0),
('pkg-rec-sio-sauce-3', 'chicken-siomai-5', 'pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 1.0),
('pkg-rec-sio-sauce-4', 'sharksfin-siomai-5', 'pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 1.0),
('pkg-rec-sio-sauce-5', 'japanese-siomai-6', 'pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 1.0),
('pkg-rec-sauce-cup-addon', 'special-sauce-addon-30', 'pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 1.0),
('pkg-rec-lem-sm-cup', 'lemonade-small-40', 'pkg-cup-16oz', '16oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.2),
('pkg-rec-lem-bg-cup', 'lemonade-big-50', 'pkg-cup-22oz', '22oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 4.0),
('pkg-rec-cuc-sm-cup', 'cucumber-lemonade-small-40', 'pkg-cup-16oz', '16oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.2),
('pkg-rec-cuc-bg-cup', 'cucumber-lemonade-big-50', 'pkg-cup-22oz', '22oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 4.0),
('pkg-rec-shk-sm-cup', 'shake-small-40', 'pkg-cup-16oz', '16oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.2),
('pkg-rec-shk-bg-cup', 'shake-big-50', 'pkg-cup-22oz', '22oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 4.0),
('pkg-rec-pud-cup', 'mango-pudding-50', 'pkg-dessert-cup', 'Dessert Cup w/ Sealed Lid & Spoon', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.5),
('pkg-rec-bcy-cup', 'banana-con-yelo-50', 'pkg-dessert-cup', 'Dessert Cup w/ Sealed Lid & Spoon', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.5),
('pkg-rec-icm-cup', 'ice-cream-50', 'pkg-dessert-cup', 'Dessert Cup w/ Sealed Lid & Spoon', 'Trays, Bowls & Containers', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.5),
('pkg-rec-tea-gl-cup', 'icetea-glass-20', 'pkg-cup-16oz', '16oz Clear Beverage Cup w/ Dome Lid & Straw', 'Cups, Lids & Straws', 1, 'pcs', 'TAKEOUT', 'PER_ITEM', 3.2)
ON CONFLICT (id) DO NOTHING;

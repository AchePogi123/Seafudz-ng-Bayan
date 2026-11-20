-- Purchase orders no longer track cost.
--
-- The admin purchase-order screen asked for a unit cost per line and derived a line total and an
-- order total from it. Purchasing is about quantities received into stock, not about pricing, so
-- the cost columns and everything derived from them are dropped.
--
-- Quantities are also normalised here: lines were stored with whatever unit the user picked while
-- receiving always treated the number as the item's base unit, so a line ordered in kg against a
-- base unit of g received a thousandth of the intended stock. Existing rows are converted.

BEGIN;

-- Convert any line recorded in a related-but-different unit into its item's base unit.
UPDATE inventory_purchase_order_items AS poi
   SET ordered_quantity = poi.ordered_quantity * 1000,
       received_quantity = poi.received_quantity * 1000,
       unit = ing.base_unit
  FROM inventory_ingredients AS ing
 WHERE ing.id = poi.ingredient_id
   AND ((poi.unit = 'kg' AND ing.base_unit = 'g')
     OR (poi.unit = 'L'  AND ing.base_unit = 'ml'));

UPDATE inventory_purchase_order_items AS poi
   SET ordered_quantity = poi.ordered_quantity / 1000,
       received_quantity = poi.received_quantity / 1000,
       unit = ing.base_unit
  FROM inventory_ingredients AS ing
 WHERE ing.id = poi.ingredient_id
   AND ((poi.unit = 'g'  AND ing.base_unit = 'kg')
     OR (poi.unit = 'ml' AND ing.base_unit = 'L'));

-- Any remaining line keeps its number but is labelled with the unit stock is actually held in,
-- so the screen cannot imply a conversion that never happened.
UPDATE inventory_purchase_order_items AS poi
   SET unit = ing.base_unit
  FROM inventory_ingredients AS ing
 WHERE ing.id = poi.ingredient_id
   AND poi.unit IS DISTINCT FROM ing.base_unit;

ALTER TABLE inventory_purchase_order_items DROP COLUMN IF EXISTS unit_cost;
ALTER TABLE inventory_purchase_order_items DROP COLUMN IF EXISTS total_cost;
ALTER TABLE inventory_purchase_orders      DROP COLUMN IF EXISTS total_amount;

COMMIT;

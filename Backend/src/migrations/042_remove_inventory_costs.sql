-- Inventory no longer tracks cost. At all.
--
-- The stockroom answers one question: how much of each thing is on the shelf, and what does that
-- let the kitchen make. It is not a costing system — there is no purchasing spend, no margin
-- analysis and nobody maintaining the per-unit prices — so a `cost_per_unit` sitting on every
-- ingredient was a number the screens had to display, the forms had to ask for and the reports
-- had to total, while being, in practice, stale or zero. Everything derived from it (stock
-- valuation, waste value in pesos, recipe food/packaging cost and gross margin) was derived from
-- that same unmaintained figure, so it is all dropped together. Migration 040 removed the
-- purchase-order side of the same idea; this finishes the job.
--
-- A dish's own SELLING price is not touched: `product_recipes.product_price` mirrors what the
-- customer is charged, which the menu and the POS genuinely need. Only the cost of *inputs* goes.

BEGIN;

-- Keep the recorded figures before the columns go. Dropping a column is irreversible, so they
-- are copied into archive tables first. Nothing in the application reads them; they exist so the
-- numbers can still be answered for or restored.
DO $archive$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'inventory_ingredients' AND column_name = 'cost_per_unit'
  ) AND to_regclass('public.inventory_ingredient_cost_archive') IS NULL THEN
    EXECUTE $sql$
      CREATE TABLE inventory_ingredient_cost_archive AS
        SELECT id, name, item_type, base_unit, current_stock, cost_per_unit, NOW() AS archived_at
          FROM inventory_ingredients
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'recipe_ingredients' AND column_name = 'estimated_cost'
  ) AND to_regclass('public.recipe_ingredient_cost_archive') IS NULL THEN
    EXECUTE $sql$
      CREATE TABLE recipe_ingredient_cost_archive AS
        SELECT id, product_id, ingredient_id, ingredient_name, portion_quantity, unit,
               estimated_cost, NOW() AS archived_at
          FROM recipe_ingredients
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'recipe_packaging' AND column_name = 'estimated_cost'
  ) AND to_regclass('public.recipe_packaging_cost_archive') IS NULL THEN
    EXECUTE $sql$
      CREATE TABLE recipe_packaging_cost_archive AS
        SELECT id, product_id, packaging_id, packaging_name, quantity, unit,
               estimated_cost, NOW() AS archived_at
          FROM recipe_packaging
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_name = 'product_recipes' AND column_name = 'total_raw_cost'
  ) AND to_regclass('public.product_recipe_cost_archive') IS NULL THEN
    EXECUTE $sql$
      CREATE TABLE product_recipe_cost_archive AS
        SELECT product_id, product_name, product_price, total_food_cost, total_packaging_cost,
               total_raw_cost, gross_margin_percent, NOW() AS archived_at
          FROM product_recipes
    $sql$;
  END IF;
END
$archive$;

ALTER TABLE inventory_ingredients DROP COLUMN IF EXISTS cost_per_unit;
ALTER TABLE recipe_ingredients    DROP COLUMN IF EXISTS estimated_cost;
ALTER TABLE recipe_packaging      DROP COLUMN IF EXISTS estimated_cost;

ALTER TABLE product_recipes DROP COLUMN IF EXISTS total_food_cost;
ALTER TABLE product_recipes DROP COLUMN IF EXISTS total_packaging_cost;
ALTER TABLE product_recipes DROP COLUMN IF EXISTS total_raw_cost;
ALTER TABLE product_recipes DROP COLUMN IF EXISTS gross_margin_percent;

COMMIT;

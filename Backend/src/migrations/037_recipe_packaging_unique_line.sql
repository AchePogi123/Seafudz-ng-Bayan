-- Migration: 037_recipe_packaging_unique_line
-- Description: One packaging line per product / item / order type / scope.
--
-- `recipe_ingredients` has had uq_recipe_ingredient from the start, but `recipe_packaging` never
-- got the matching rule, so the same box could be listed twice for the same order type. The
-- servings maths now sums a recipe's lines per item before dividing by stock, so duplicates no
-- longer inflate what a dish can make — but two lines for one box is still a mistake worth
-- refusing at the door rather than quietly adding up.
--
-- A product legitimately keeps SEVERAL packaging rows for the same item when they differ by order
-- type (a tray for take-out, none for dine-in) or by scope (one box per dish plus one bag for the
-- whole order), so those columns are part of the key.

DO $$
BEGIN
  -- Fold any duplicates already in the table into the line that was entered first.
  WITH ranked AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY product_id, packaging_id,
                          COALESCE(fulfillment_type, 'TAKEOUT'), COALESCE(scope, 'PER_ITEM')
             ORDER BY id
           ) AS rn,
           SUM(quantity) OVER (
             PARTITION BY product_id, packaging_id,
                          COALESCE(fulfillment_type, 'TAKEOUT'), COALESCE(scope, 'PER_ITEM')
           ) AS merged_quantity
      FROM recipe_packaging
  )
  UPDATE recipe_packaging rp
     SET quantity = ranked.merged_quantity
    FROM ranked
   WHERE rp.id = ranked.id AND ranked.rn = 1;

  DELETE FROM recipe_packaging rp
   USING (
     SELECT id,
            ROW_NUMBER() OVER (
              PARTITION BY product_id, packaging_id,
                           COALESCE(fulfillment_type, 'TAKEOUT'), COALESCE(scope, 'PER_ITEM')
              ORDER BY id
            ) AS rn
       FROM recipe_packaging
   ) dupes
   WHERE rp.id = dupes.id AND dupes.rn > 1;

  ALTER TABLE recipe_packaging DROP CONSTRAINT IF EXISTS uq_recipe_packaging_line;
  ALTER TABLE recipe_packaging ADD CONSTRAINT uq_recipe_packaging_line
    UNIQUE (product_id, packaging_id, fulfillment_type, scope);
END $$;

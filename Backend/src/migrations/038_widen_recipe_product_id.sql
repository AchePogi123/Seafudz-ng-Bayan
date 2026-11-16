-- Migration: 038_widen_recipe_product_id
-- Description: Let a recipe reference any product id the catalog can mint.
--
-- `products.id` is VARCHAR(100), and a dish created from the admin screen gets the id
-- `custom-<slug up to 60 chars>-<8 hex>`, which can run to 76 characters. The recipe tables were
-- built around the short seeded ids and capped their product_id at 50, so saving a recipe for a
-- newly added dish with a long name failed on "value too long for type character varying(50)".
--
-- Adding a dish now requires a recipe in the same step, so that cap would block the creation of
-- any long-named dish. Widening to 100 matches the products table exactly.

ALTER TABLE recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_product_id_fkey;
ALTER TABLE recipe_packaging DROP CONSTRAINT IF EXISTS recipe_packaging_product_id_fkey;

ALTER TABLE product_recipes   ALTER COLUMN product_id TYPE VARCHAR(100);
ALTER TABLE recipe_ingredients ALTER COLUMN product_id TYPE VARCHAR(100);
ALTER TABLE recipe_packaging   ALTER COLUMN product_id TYPE VARCHAR(100);

ALTER TABLE recipe_ingredients
  ADD CONSTRAINT recipe_ingredients_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES product_recipes(product_id) ON DELETE CASCADE;

ALTER TABLE recipe_packaging
  ADD CONSTRAINT recipe_packaging_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES product_recipes(product_id) ON DELETE CASCADE;

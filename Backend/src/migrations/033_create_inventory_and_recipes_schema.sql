-- ============================================================================
-- MIGRATION: 033_create_inventory_and_recipes_schema.sql
-- Description: Creates official tables for Inventory Management and Recipe (BOM)
--   Modules: inventory_suppliers, inventory_ingredients, product_recipes,
--   recipe_ingredients, recipe_packaging, and inventory_transactions.
--   Populates with actual seafood, meats, produce, seasonings, drinks, desserts,
--   and packaging materials along with authoritative recipe Bill of Materials.
-- ============================================================================

-- 1. Create inventory_suppliers Table
CREATE TABLE IF NOT EXISTS inventory_suppliers (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  contact_number VARCHAR(50),
  email VARCHAR(100),
  address TEXT,
  categories_supplied TEXT[],
  lead_time_days INT DEFAULT 1,
  notes TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create inventory_ingredients Table
CREATE TABLE IF NOT EXISTS inventory_ingredients (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  sku VARCHAR(50),
  item_type VARCHAR(20) NOT NULL DEFAULT 'FOOD', -- 'FOOD' or 'PACKAGING'
  category VARCHAR(100) NOT NULL,
  base_unit VARCHAR(20) NOT NULL, -- 'g', 'pcs', 'ml', 'bottle', etc.
  current_stock NUMERIC(12, 3) NOT NULL DEFAULT 0,
  min_stock_level NUMERIC(12, 3) NOT NULL DEFAULT 0,
  preferred_restock_qty NUMERIC(12, 3) NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC(10, 3) NOT NULL DEFAULT 0,
  supplier_id VARCHAR(50) REFERENCES inventory_suppliers(id) ON DELETE SET NULL,
  supplier_name VARCHAR(150),
  storage_notes TEXT,
  status VARCHAR(30) NOT NULL DEFAULT 'IN_STOCK',
  last_restocked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create product_recipes Table
CREATE TABLE IF NOT EXISTS product_recipes (
  product_id VARCHAR(50) PRIMARY KEY,
  product_name VARCHAR(150) NOT NULL,
  product_category VARCHAR(100),
  product_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  yield_servings INT NOT NULL DEFAULT 1,
  preparation_instructions TEXT,
  total_food_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_packaging_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  total_raw_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  gross_margin_percent NUMERIC(5, 2) NOT NULL DEFAULT 0,
  is_configured BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create recipe_ingredients Table
CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id SERIAL PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL REFERENCES product_recipes(product_id) ON DELETE CASCADE,
  ingredient_id VARCHAR(50) NOT NULL REFERENCES inventory_ingredients(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(150) NOT NULL,
  portion_quantity NUMERIC(10, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_recipe_ingredient UNIQUE (product_id, ingredient_id)
);

-- 5. Create recipe_packaging Table
CREATE TABLE IF NOT EXISTS recipe_packaging (
  id VARCHAR(50) PRIMARY KEY,
  product_id VARCHAR(50) NOT NULL REFERENCES product_recipes(product_id) ON DELETE CASCADE,
  packaging_id VARCHAR(50) NOT NULL REFERENCES inventory_ingredients(id) ON DELETE CASCADE,
  packaging_name VARCHAR(150) NOT NULL,
  category VARCHAR(100),
  quantity NUMERIC(10, 3) NOT NULL DEFAULT 1,
  unit VARCHAR(20) NOT NULL,
  fulfillment_type VARCHAR(20) NOT NULL DEFAULT 'TAKEOUT',
  scope VARCHAR(20) NOT NULL DEFAULT 'PER_ITEM',
  estimated_cost NUMERIC(10, 2) NOT NULL DEFAULT 0
);

-- 6. Create inventory_transactions Table
CREATE TABLE IF NOT EXISTS inventory_transactions (
  id VARCHAR(50) PRIMARY KEY,
  reference_no VARCHAR(50) NOT NULL,
  ingredient_id VARCHAR(50) NOT NULL REFERENCES inventory_ingredients(id) ON DELETE CASCADE,
  ingredient_name VARCHAR(150) NOT NULL,
  item_type VARCHAR(20) NOT NULL DEFAULT 'FOOD',
  category VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL,
  quantity_delta NUMERIC(12, 3) NOT NULL,
  unit VARCHAR(20) NOT NULL,
  stock_after NUMERIC(12, 3) NOT NULL,
  performed_by VARCHAR(100),
  reason TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- SEED DATA: OFFICIAL SUPPLIERS
-- ============================================================================
INSERT INTO inventory_suppliers (id, name, contact_person, contact_number, email, address, categories_supplied, lead_time_days, status) VALUES
('sup-navotas-01', 'Navotas Seafood Port Distributors', 'Mang Rogelio Tan', '0917 888 1234', 'navotas.seafood@ph.example.com', 'Stall 18, Navotas Fish Port Complex, Navotas City', ARRAY['Seafoods'], 1, 'ACTIVE'),
('sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Aling Susan Ramos', '0922 456 7890', 'balintawak.wholesale@ph.example.com', 'Block 4, Balintawak Cloverleaf Market, Quezon City', ARRAY['Vegetables & Produce', 'Grains & Noodles'], 1, 'ACTIVE'),
('sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Eric Villafuerte', '0918 333 9988', 'orders@goldendairy.ph', '14 Industrial Road, Valenzuela City', ARRAY['Dairy & Fats', 'Seasonings & Sauces', 'Meat & Poultry'], 2, 'ACTIVE'),
('sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Cynthia Santos', '0917 555 4321', 'cynthia@metropack.ph', '88 C3 Road, Caloocan City', ARRAY['Trays, Bowls & Containers', 'Cups, Lids & Straws', 'Bags, Pouches & Carriers', 'Cutlery, Napkins & Packets'], 2, 'ACTIVE')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  contact_person = EXCLUDED.contact_person,
  contact_number = EXCLUDED.contact_number,
  address = EXCLUDED.address;

-- ============================================================================
-- SEED DATA: OFFICIAL INGREDIENTS CATALOG
-- ============================================================================
INSERT INTO inventory_ingredients (id, name, sku, item_type, category, base_unit, current_stock, min_stock_level, preferred_restock_qty, cost_per_unit, supplier_id, supplier_name, storage_notes, status) VALUES
-- Seafoods
('ing-shrimp-fresh', 'Fresh Whole Shrimp', 'ING-SEA-SHR-01', 'FOOD', 'Seafoods', 'g', 15000, 3000, 12000, 0.450, 'sup-navotas-01', 'Navotas Seafood Port Distributors', 'Keep in walk-in freezer at -18°C. Thaw in cold running water.', 'IN_STOCK'),
('ing-shrimp-regular-pc', 'Fresh Regular Shrimp (Piece)', 'ING-SEA-SHR-REG', 'FOOD', 'Seafoods', 'pcs', 120, 30, 100, 9.000, 'sup-navotas-01', 'Navotas Seafood Port Distributors', '1 piece ≈ 20g portion. Graded medium fresh shrimp.', 'IN_STOCK'),
('ing-shrimp-jumbo-pc', 'Fresh Jumbo Shrimp (Piece)', 'ING-SEA-SHR-JMB', 'FOOD', 'Seafoods', 'pcs', 80, 25, 80, 16.000, 'sup-navotas-01', 'Navotas Seafood Port Distributors', '1 piece ≈ 37.5g portion. Selected jumbo shrimp.', 'IN_STOCK'),
('ing-crab-halves', 'Crab (Halves)', 'ING-SEA-CRB-01', 'FOOD', 'Seafoods', 'g', 8000, 2000, 8000, 0.550, 'sup-navotas-01', 'Navotas Seafood Port Distributors', 'Cleaned, pre-halved fresh ocean crabs. Store in freezer.', 'IN_STOCK'),
('ing-green-mussels', 'Green Mussels (Tahong)', 'ING-SEA-MUS-01', 'FOOD', 'Seafoods', 'g', 10000, 2500, 10000, 0.220, 'sup-navotas-01', 'Navotas Seafood Port Distributors', 'Fresh green mussels (tahong) cleaned and de-bearded.', 'IN_STOCK'),
('ing-shellfish-clams', 'Shellfish / Clams', 'ING-SEA-CLM-01', 'FOOD', 'Seafoods', 'g', 6000, 1500, 6000, 0.250, 'sup-navotas-01', 'Navotas Seafood Port Distributors', 'Purged clams/shellfish medley. Store chilled on crushed ice.', 'IN_STOCK'),
('ing-squid-rings', 'Squid Rings', 'ING-SEA-SQD-01', 'FOOD', 'Seafoods', 'g', 4000, 1000, 4000, 0.380, 'sup-navotas-01', 'Navotas Seafood Port Distributors', 'Cleaned squid rings for seafood pancit.', 'IN_STOCK'),

-- Produce & Vegetables
('ing-sweet-corn', 'Sweet Corn Cob (Mini Cob Slices)', 'ING-VEG-CRN-01', 'FOOD', 'Vegetables & Produce', 'pcs', 150, 40, 120, 5.000, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', '1 mini cob slice ≈ 40g. Fresh sweet yellow corn.', 'IN_STOCK'),
('ing-mixed-vegetables', 'Mixed Vegetables (Cabbage, Carrots, Peas)', 'ING-VEG-MIX-01', 'FOOD', 'Vegetables & Produce', 'g', 5000, 1500, 5000, 0.120, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Diced crisp carrots, peas, shredded cabbage. Chiller 4°C.', 'IN_STOCK'),
('ing-minced-garlic', 'Minced Garlic', 'ING-VEG-GAR-01', 'FOOD', 'Vegetables & Produce', 'g', 3000, 800, 3000, 0.160, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Freshly minced native garlic cloves. Keep refrigerated.', 'IN_STOCK'),
('ing-chopped-onion', 'Chopped Onion', 'ING-VEG-ONN-01', 'FOOD', 'Vegetables & Produce', 'g', 4000, 1000, 4000, 0.110, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Diced red/yellow onions (1 medium onion ≈ 110g).', 'IN_STOCK'),
('ing-spring-onion', 'Chopped Spring Onion', 'ING-VEG-SPN-01', 'FOOD', 'Vegetables & Produce', 'g', 1000, 300, 1000, 0.180, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Sliced fresh scallions for Chao Fan and garnishing.', 'IN_STOCK'),
('ing-fresh-calamansi', 'Fresh Calamansi', 'ING-VEG-CLM-01', 'FOOD', 'Vegetables & Produce', 'pcs', 400, 100, 300, 1.000, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', '1 piece ≈ 10g whole. Fresh green Philippine lime.', 'IN_STOCK'),
('ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 'ING-VEG-LMN-01', 'FOOD', 'Vegetables & Produce', 'pcs', 150, 40, 100, 4.500, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', '1 wedge ≈ 15g. Fresh yellow lemons.', 'IN_STOCK'),
('ing-fresh-parsley', 'Fresh Parsley', 'ING-VEG-PAR-01', 'FOOD', 'Vegetables & Produce', 'g', 300, 80, 300, 0.350, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Chopped curly parsley garnish.', 'IN_STOCK'),
('ing-fresh-cucumber', 'Fresh Cucumber (Slices)', 'ING-VEG-CUC-01', 'FOOD', 'Vegetables & Produce', 'pcs', 200, 50, 150, 1.500, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', '1 slice ≈ 10g. Crisp cucumber slices for lemonade garnish.', 'IN_STOCK'),
('ing-tomato-cucumber-garnish', 'Tomato / Cucumber Garnish', 'ING-VEG-TCG-01', 'FOOD', 'Vegetables & Produce', 'g', 1500, 400, 1500, 0.120, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh sliced tomato and cucumber garnish for silog meals.', 'IN_STOCK'),
('ing-fresh-mango-cubes', 'Fresh Mango Cubes', 'ING-VEG-MNG-01', 'FOOD', 'Vegetables & Produce', 'g', 2000, 500, 2000, 0.280, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh sweet ripe mango cubes for Mango Pudding.', 'IN_STOCK'),
('ing-caramelized-saba', 'Sweet Caramelized Saba Bananas', 'ING-VEG-SAB-01', 'FOOD', 'Vegetables & Produce', 'g', 3000, 800, 3000, 0.180, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Simmered saba bananas in muscovado for Banana Con Yelo.', 'IN_STOCK'),

-- Meat & Poultry
('ing-shredded-chicken', 'Shredded Chicken (Pastil Filling)', 'ING-MET-CHK-01', 'FOOD', 'Meat & Poultry', 'g', 5000, 1500, 5000, 0.280, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Slow simmered flaked seasoned chicken breast.', 'IN_STOCK'),
('ing-beef-tapa', 'Beef Tapa (Marinated Strips)', 'ING-MET-TAP-01', 'FOOD', 'Meat & Poultry', 'g', 4000, 1000, 4000, 0.420, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Tender marinated sweet-savory beef strips for Tapsilog.', 'IN_STOCK'),
('ing-seasoned-meat-bits', 'Seasoned Meat Bits', 'ING-MET-BTS-01', 'FOOD', 'Meat & Poultry', 'g', 3000, 800, 3000, 0.260, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Savory minced meat bits for Chao Fan fried rice.', 'IN_STOCK'),
('ing-sliced-sausage', 'Sliced Sausage (Smoked Rounds)', 'ING-MET-SSG-01', 'FOOD', 'Meat & Poultry', 'g', 4000, 1000, 4000, 0.320, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Smoked savory sausage coin rounds.', 'IN_STOCK'),
('ing-pork-siomai', 'Pork Siomai', 'ING-MET-SIO-PRK', 'FOOD', 'Meat & Poultry', 'pcs', 250, 50, 200, 2.500, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', '1 piece ≈ 20g. Frozen steamed pork siomai dumplings.', 'IN_STOCK'),
('ing-beef-siomai', 'Beef Siomai', 'ING-MET-SIO-BEF', 'FOOD', 'Meat & Poultry', 'pcs', 200, 50, 180, 2.700, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', '1 piece ≈ 20g. Frozen steamed beef siomai dumplings.', 'IN_STOCK'),
('ing-chicken-siomai', 'Chicken Siomai', 'ING-MET-SIO-CHK', 'FOOD', 'Meat & Poultry', 'pcs', 200, 50, 180, 2.500, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', '1 piece ≈ 20g. Frozen steamed chicken siomai dumplings.', 'IN_STOCK'),
('ing-sharksfin-siomai', 'Sharksfin Siomai', 'ING-MET-SIO-SHK', 'FOOD', 'Meat & Poultry', 'pcs', 180, 40, 150, 2.800, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', '1 piece ≈ 20g. Cantonese style sharksfin dumplings.', 'IN_STOCK'),
('ing-japanese-siomai', 'Japanese Siomai', 'ING-MET-SIO-JPN', 'FOOD', 'Meat & Poultry', 'pcs', 180, 40, 150, 3.200, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', '1 piece ≈ 20g. Nori seaweed-wrapped Japanese pork dumplings.', 'IN_STOCK'),

-- Dairy & Fats
('ing-butter', 'Pure Butter Blend', 'ING-DAR-BUT-01', 'FOOD', 'Dairy & Fats', 'g', 8000, 2000, 8000, 0.280, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Quality unsalted cooking butter. Refrigerate 2°C to 5°C.', 'IN_STOCK'),
('ing-garlic-butter', 'Garlic Butter', 'ING-DAR-GBU-01', 'FOOD', 'Dairy & Fats', 'g', 5000, 1500, 5000, 0.320, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Savory whipped garlic butter blend for shrimp bowls.', 'IN_STOCK'),
('ing-cajun-butter', 'Cajun Butter', 'ING-DAR-CBU-01', 'FOOD', 'Dairy & Fats', 'g', 6000, 1500, 6000, 0.340, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Signature cajun spiced butter blend for seafood boils.', 'IN_STOCK'),
('ing-cooking-oil', 'Cooking Oil', 'ING-DAR-OIL-01', 'FOOD', 'Dairy & Fats', 'g', 10000, 3000, 10000, 0.120, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Refined vegetable cooking oil.', 'IN_STOCK'),
('ing-fresh-eggs', 'Fresh Eggs (Large)', 'ING-DAR-EGG-01', 'FOOD', 'Dairy & Fats', 'pcs', 200, 50, 180, 7.500, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', '1 large egg ≈ 50g. Fresh farm eggs in carton trays.', 'IN_STOCK'),
('ing-creamy-condensed-milk', 'Creamy Milk Base / Condensed Milk', 'ING-DAR-MLK-01', 'FOOD', 'Dairy & Fats', 'g', 5000, 1500, 5000, 0.160, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sweet creamy milk blend for fruit shakes.', 'IN_STOCK'),
('ing-evaporated-milk', 'Evaporated / Condensed Milk', 'ING-DAR-EVP-01', 'FOOD', 'Dairy & Fats', 'g', 4000, 1200, 4000, 0.150, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Rich evaporated milk drizzle for Banana Con Yelo.', 'IN_STOCK'),
('ing-special-ice-cream', 'Special Ice Cream', 'ING-DAR-ICM-01', 'FOOD', 'Dairy & Fats', 'g', 5000, 1500, 5000, 0.220, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', '1 scoop ≈ 100g. Premium ice cream tub in freezer.', 'IN_STOCK'),

-- Grains & Noodles
('ing-steamed-white-rice', 'Steaming White Rice (Jasmine)', 'ING-GRN-RIC-01', 'FOOD', 'Grains & Noodles', 'g', 25000, 6000, 25000, 0.055, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Cooked fluffy Jasmine white rice (1 cup = 200g).', 'IN_STOCK'),
('ing-fried-garlic-rice', 'Fried Rice / Garlic Rice', 'ING-GRN-GRC-01', 'FOOD', 'Grains & Noodles', 'g', 15000, 4000, 15000, 0.070, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Toasted garlic seasoned fried rice (1 serving = 200g).', 'IN_STOCK'),
('ing-pancit-noodles', 'Pancit Noodles (Bihon / Canton)', 'ING-GRN-NDL-01', 'FOOD', 'Grains & Noodles', 'g', 8000, 2000, 8000, 0.120, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Bihon and canton noodle blend for Seafood Pancit.', 'IN_STOCK'),
('ing-street-stirfry-noodles', 'Street Stir-Fry Noodles', 'ING-GRN-SND-01', 'FOOD', 'Grains & Noodles', 'g', 6000, 1500, 6000, 0.110, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh yellow stir-fry noodles for Fried Noodles.', 'IN_STOCK'),

-- Seasonings, Sauces & Spices
('ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 'ING-SEA-CAJ-01', 'FOOD', 'Seasonings & Sauces', 'g', 10000, 2500, 10000, 0.350, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Signature proprietary cajun seafood sauce blend.', 'IN_STOCK'),
('ing-chili-garlic-sauce', 'Chili Garlic Sauce', 'ING-SEA-CGS-01', 'FOOD', 'Seasonings & Sauces', 'g', 3000, 800, 3000, 0.250, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Toasted chili garlic oil dipping sauce for siomai.', 'IN_STOCK'),
('ing-soy-sauce', 'Soy Sauce', 'ING-SEA-SOY-01', 'FOOD', 'Seasonings & Sauces', 'g', 6000, 1500, 6000, 0.080, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Dark brewed soy sauce for cooking and dipping.', 'IN_STOCK'),
('ing-oyster-sauce', 'Oyster Sauce', 'ING-SEA-OYS-01', 'FOOD', 'Seasonings & Sauces', 'g', 4000, 1000, 4000, 0.160, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Savory oyster sauce for pancit.', 'IN_STOCK'),
('ing-vinegar-dip', 'Vinegar Dip / Cane Vinegar', 'ING-SEA-VIN-01', 'FOOD', 'Seasonings & Sauces', 'g', 5000, 1500, 5000, 0.060, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Spiced cane vinegar for chicken pastil and tapsilog dip.', 'IN_STOCK'),
('ing-stirfry-savory-sauce', 'Stir-Fry Savory Sauce / Chao Fan Seasoning', 'ING-SEA-SFS-01', 'FOOD', 'Seasonings & Sauces', 'g', 4000, 1000, 4000, 0.220, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Rich savory wok glaze sauce for fried noodles & Chao Fan.', 'IN_STOCK'),
('ing-paprika', 'Paprika Spice Powder', 'ING-SEA-PAP-01', 'FOOD', 'Seasonings & Sauces', 'g', 2000, 500, 2000, 0.450, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sweet aromatic ground paprika spice.', 'IN_STOCK'),
('ing-cayenne-pepper', 'Cayenne Pepper Powder', 'ING-SEA-CAY-01', 'FOOD', 'Seasonings & Sauces', 'g', 1000, 300, 1000, 0.550, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Fiery ground red cayenne pepper for cajun heat.', 'IN_STOCK'),
('ing-salt', 'Iodized Table Salt', 'ING-SEA-SLT-01', 'FOOD', 'Seasonings & Sauces', 'g', 10000, 2500, 10000, 0.035, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Fine pure iodized table salt.', 'IN_STOCK'),
('ing-black-pepper', 'Cracked Black Pepper', 'ING-SEA-BKP-01', 'FOOD', 'Seasonings & Sauces', 'g', 3000, 800, 3000, 0.380, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Freshly coarse-ground black pepper.', 'IN_STOCK'),
('ing-sugar', 'Refined White Sugar', 'ING-SEA-SGR-01', 'FOOD', 'Seasonings & Sauces', 'g', 8000, 2000, 8000, 0.080, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Fine granulated white cane sugar.', 'IN_STOCK'),

-- Beverages & Bar
('ing-lemon-juice', 'Fresh Lemon Juice', 'ING-BEV-LMJ-01', 'FOOD', 'Beverages & Bar', 'ml', 4000, 1000, 4000, 0.250, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh pure squeezed lemon juice. Keep chilled at 4°C.', 'IN_STOCK'),
('ing-calamansi-juice', 'Fresh Calamansi Juice', 'ING-BEV-CLJ-01', 'FOOD', 'Beverages & Bar', 'ml', 3000, 800, 3000, 0.200, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh pure calamansi extract.', 'IN_STOCK'),
('ing-cucumber-juice', 'Cucumber Juice / Blend', 'ING-BEV-CUB-01', 'FOOD', 'Beverages & Bar', 'ml', 3000, 800, 3000, 0.180, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh blended English cucumber extract.', 'IN_STOCK'),
('ing-fruit-puree', 'Real Fruit / Fruit Puree', 'ING-BEV-FRP-01', 'FOOD', 'Beverages & Bar', 'g', 5000, 1500, 5000, 0.250, 'sup-balintawak-02', 'Balintawak Central Wholesale Produce', 'Fresh fruit / natural puree for shakes.', 'IN_STOCK'),
('ing-sugar-syrup', 'Sugar Syrup', 'ING-BEV-SGS-01', 'FOOD', 'Beverages & Bar', 'ml', 5000, 1500, 5000, 0.100, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Simple sugar syrup dissolved base.', 'IN_STOCK'),
('ing-purified-water', 'Purified Water', 'ING-BEV-WTR-01', 'FOOD', 'Beverages & Bar', 'ml', 20000, 5000, 20000, 0.010, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Reverse-osmosis purified drinking water.', 'IN_STOCK'),
('ing-crushed-ice', 'Crushed Ice / Shaved Ice', 'ING-BEV-ICE-01', 'FOOD', 'Beverages & Bar', 'g', 25000, 5000, 25000, 0.020, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Clean food-grade crushed ice.', 'IN_STOCK'),
('ing-house-iced-tea', 'House Iced Tea Liquid', 'ING-BEV-TEA-01', 'FOOD', 'Beverages & Bar', 'ml', 10000, 2500, 10000, 0.040, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Signature house brewed citrus black iced tea.', 'IN_STOCK'),
('ing-brewed-coffee', 'Hot Brewed Black Coffee', 'ING-BEV-COF-01', 'FOOD', 'Beverages & Bar', 'ml', 4000, 1000, 4000, 0.050, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Freshly brewed aromatic dark roast.', 'IN_STOCK'),
('ing-mineral-water-bottle', 'Bottled Mineral Water (500ml)', 'ING-BEV-BTL-WTR', 'FOOD', 'Beverages & Bar', 'bottle', 120, 30, 100, 7.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 500ml commercial bottled water.', 'IN_STOCK'),
('ing-coke-mismo', 'Coca-Cola Mismo (250ml)', 'ING-BEV-BTL-COK250', 'FOOD', 'Beverages & Bar', 'bottle', 150, 40, 120, 14.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 250ml PET Coke bottles.', 'IN_STOCK'),
('ing-coke-15l', 'Coca-Cola (1.5L)', 'ING-BEV-BTL-COK15L', 'FOOD', 'Beverages & Bar', 'bottle', 40, 12, 30, 65.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 1.5-liter PET Coke bottles.', 'IN_STOCK'),
('ing-sprite-mismo', 'Sprite Mismo (250ml)', 'ING-BEV-BTL-SPR250', 'FOOD', 'Beverages & Bar', 'bottle', 120, 30, 100, 14.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 250ml PET Sprite bottles.', 'IN_STOCK'),
('ing-sprite-15l', 'Sprite (1.5L)', 'ING-BEV-BTL-SPR15L', 'FOOD', 'Beverages & Bar', 'bottle', 35, 10, 30, 60.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 1.5-liter PET Sprite bottles.', 'IN_STOCK'),
('ing-royal-mismo', 'Royal Tru-Orange Mismo (250ml)', 'ING-BEV-BTL-RYL250', 'FOOD', 'Beverages & Bar', 'bottle', 120, 30, 100, 14.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 250ml PET Royal bottles.', 'IN_STOCK'),
('ing-royal-15l', 'Royal Tru-Orange (1.5L)', 'ING-BEV-BTL-RYL15L', 'FOOD', 'Beverages & Bar', 'bottle', 35, 10, 30, 60.000, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sealed 1.5-liter PET Royal Tru-Orange bottles.', 'IN_STOCK'),

-- Desserts
('ing-mango-custard-base', 'Mango Custard Base', 'ING-DES-MCB-01', 'FOOD', 'Other Food', 'g', 4000, 1000, 4000, 0.180, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Chilled mango pudding custard base.', 'IN_STOCK'),
('ing-sweet-mango-syrup', 'Sweet Mango Syrup', 'ING-DES-SMS-01', 'FOOD', 'Seasonings & Sauces', 'g', 3000, 800, 3000, 0.220, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Sweet mango coulis drizzle.', 'IN_STOCK'),
('ing-ube-halaya', 'Ube Halaya Topping', 'ING-DES-UBE-01', 'FOOD', 'Other Food', 'g', 2000, 500, 2000, 0.260, 'sup-golden-dairy-03', 'Golden Dairy, Oils & Seasonings Trading', 'Traditional sweet purple yam jam topping.', 'IN_STOCK'),

-- Packaging Materials
('pkg-bento-tray', '3-Compartment Bento Food Tray (Microwaveable)', 'PKG-TRY-01', 'PACKAGING', 'Trays, Bowls & Containers', 'pcs', 600, 150, 500, 6.500, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Dry packaging storage shelf B2.', 'IN_STOCK'),
('pkg-seafood-bowl', 'Large Seafood Sharing Bowl w/ Lid', 'PKG-BWL-02', 'PACKAGING', 'Trays, Bowls & Containers', 'pcs', 400, 100, 350, 8.500, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Leakproof sharing bowls for seafood bowls.', 'IN_STOCK'),
('pkg-seafood-tub', 'Clear Round Seafood Tub w/ Sealed Lid', 'PKG-TUB-03', 'PACKAGING', 'Trays, Bowls & Containers', 'pcs', 450, 120, 400, 7.000, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Clear tub for Mixed Seafoods Tub portion.', 'IN_STOCK'),
('pkg-fiesta-tray', 'Aluminum Fiesta Platter Tray w/ Cover', 'PKG-TRY-FST', 'PACKAGING', 'Boxes & Bilao Packaging', 'pcs', 250, 60, 200, 18.000, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Sturdy party tray with clear cover.', 'IN_STOCK'),
('pkg-cup-16oz', '16oz Clear Beverage Cup w/ Dome Lid & Straw', 'PKG-CUP-16', 'PACKAGING', 'Cups, Lids & Straws', 'pcs', 700, 200, 600, 3.200, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', '16oz cups for Small Lemonade, Shake, and Iced Tea.', 'IN_STOCK'),
('pkg-cup-22oz', '22oz Clear Beverage Cup w/ Dome Lid & Straw', 'PKG-CUP-22', 'PACKAGING', 'Cups, Lids & Straws', 'pcs', 600, 180, 500, 4.000, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', '22oz cups for Big Lemonade and Shake.', 'IN_STOCK'),
('pkg-dessert-cup', 'Dessert Cup w/ Sealed Lid & Spoon', 'PKG-DES-01', 'PACKAGING', 'Trays, Bowls & Containers', 'pcs', 500, 150, 400, 3.500, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Dessert cups with spoon.', 'IN_STOCK'),
('pkg-cutlery-set', 'Individually Wrapped Spoon & Fork Set w/ Napkin', 'PKG-CUT-01', 'PACKAGING', 'Cutlery, Napkins & Packets', 'pcs', 1200, 300, 1000, 2.200, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Wrapped cutlery packs near dispatch counter.', 'IN_STOCK'),
('pkg-sauce-cup', 'Sauce Dipping Cup (1oz / 2oz) w/ Lid', 'PKG-SCE-01', 'PACKAGING', 'Trays, Bowls & Containers', 'pcs', 800, 200, 600, 1.000, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Portion cups for Special Cajun Sauce add-on & dips.', 'IN_STOCK'),
('pkg-takeout-bag', 'Heavy Duty Takeout Carrier Plastic Bag', 'PKG-BAG-01', 'PACKAGING', 'Bags, Pouches & Carriers', 'pcs', 900, 250, 800, 1.500, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Handled carry bags for order bundle dispatch.', 'IN_STOCK'),
('pkg-sealing-sticker', 'Seafudz Branded Tamper-Evident Sealing Stickers', 'PKG-STK-01', 'PACKAGING', 'Labels & Sealing Stickers', 'pcs', 1500, 400, 1500, 0.850, 'sup-metro-pack-04', 'Metro Pack & Eco Disposables', 'Safety seals placed on takeout trays and drink lids.', 'IN_STOCK')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  sku = EXCLUDED.sku,
  item_type = EXCLUDED.item_type,
  category = EXCLUDED.category,
  base_unit = EXCLUDED.base_unit,
  cost_per_unit = EXCLUDED.cost_per_unit,
  storage_notes = EXCLUDED.storage_notes,
  supplier_id = EXCLUDED.supplier_id,
  supplier_name = EXCLUDED.supplier_name;

-- ============================================================================
-- SEED DATA: OFFICIAL PRODUCT RECIPES (BOM)
-- ============================================================================
INSERT INTO product_recipes (product_id, product_name, product_category, product_price, yield_servings, total_food_cost, total_packaging_cost, total_raw_cost, gross_margin_percent, is_configured, preparation_instructions) VALUES
('all-shrimp-alacarte-199', 'All Shrimp Alacarte', 'Seafoods', 199.00, 1, 99.11, 8.70, 107.81, 46.0, true, 'Sauté 150g shrimp in 50g Cajun butter. Add 30g cajun sauce, paprika, cayenne, salt, and black pepper. Serve with 2 calamansi.'),
('all-shrimp-bowl-699', 'All Shrimp Bowl', 'Seafoods', 699.00, 1, 201.55, 10.70, 212.25, 70.0, true, 'Sauté garlic in 100g garlic butter, add 300g shrimp, 60g cajun sauce, salt, pepper. Garnish with parsley, 3 calamansi, 2 lemon wedges.'),
('all-shrimp-tray-1099', 'All Shrimp Party Tray', 'Seafoods', 1099.00, 1, 517.86, 22.40, 540.26, 51.0, true, 'Melt 250g Cajun butter, sauté garlic and 800g shrimp. Glaze with 120g cajun sauce and spices. Dish into fiesta platter with 6 calamansi and 4 lemon wedges.'),
('mixed-seafoods-alacarte-99', 'Mixed Seafoods Alacarte (Mini)', 'Seafoods', 99.00, 1, 161.87, 8.70, 170.57, 35.0, true, 'Sauté crab, shrimp, mussels, and 2 corn slices in 60g butter. Toss with 30g cajun sauce, salt, and pepper. Serve with 2 calamansi.'),
('mixed-seafoods-tub-189', 'Mixed Seafoods Tub', 'Seafoods', 189.00, 1, 269.67, 9.20, 278.87, 42.0, true, 'Sauté garlic in 90g butter, add crab, shrimp, mussels, clams, and 3 corn slices. Toss with 45g cajun sauce and spices into round sealed tub with 3 calamansi.'),
('mixed-seafoods-bowl-699', 'Mixed Seafoods Bowl', 'Seafoods', 699.00, 1, 505.19, 10.70, 515.89, 62.0, true, 'Wok simmer crab, shrimp, mussels, clams, and 4 corn slices in 150g butter with 90g cajun sauce. Dish into sharing bowl with 4 calamansi and 3 lemon wedges.'),
('mixed-seafoods-tray-1199', 'Mixed Seafoods Fiesta Tray', 'Seafoods', 1199.00, 1, 1022.00, 22.40, 1044.40, 48.0, true, 'Grand Fiesta portion: Saute 600g crab, 600g shrimp, 500g mussels, 300g clams, and 8 corn cobs in 300g butter, garlic, 150g cajun sauce, and spices. Plate with 8 calamansi and 6 lemon wedges.'),
('chicken-pastil-35', 'Chicken Pastil', 'Value Meals', 35.00, 1, 43.77, 8.70, 52.47, 30.0, true, 'Sauté garlic and onion in cooking oil. Add 80g shredded chicken with soy sauce, vinegar, and pepper. Serve over 200g white Jasmine rice.'),
('fried-noodles-35', 'Fried Noodles', 'Value Meals', 35.00, 1, 33.42, 8.70, 42.12, 32.0, true, 'Wok fry 150g street noodles with garlic, oil, and 30g savory stir-fry sauce. Top with 3 steamed pork siomai.'),
('chao-fan-35', 'Chao Fan', 'Value Meals', 35.00, 1, 42.38, 8.70, 51.08, 35.0, true, 'Wok scramble 1 egg with garlic, 50g meat bits, 40g mixed vegetables, 200g rice, and chao fan seasoning. Garnish with chopped spring onion.'),
('pork-siomai-5', 'Pork Siomai', 'Siomai', 5.00, 1, 4.95, 1.00, 5.95, 40.0, true, 'Steam 1 pork siomai dumpling. Serve with chili garlic sauce, soy sauce, and calamansi.'),
('beef-siomai-5', 'Beef Siomai', 'Siomai', 5.00, 1, 5.15, 1.00, 6.15, 38.0, true, 'Steam 1 beef siomai dumpling. Serve with chili garlic sauce, soy sauce, and calamansi.'),
('chicken-siomai-5', 'Chicken Siomai', 'Siomai', 5.00, 1, 4.95, 1.00, 5.95, 40.0, true, 'Steam 1 chicken siomai dumpling. Serve with chili garlic sauce, soy sauce, and calamansi.'),
('sharksfin-siomai-5', 'Sharksfin Siomai', 'Siomai', 5.00, 1, 5.25, 1.00, 6.25, 37.0, true, 'Steam 1 sharksfin dumpling. Serve with chili garlic sauce, soy sauce, and calamansi.'),
('japanese-siomai-6', 'Japanese Siomai', 'Siomai', 6.00, 1, 5.65, 1.00, 6.65, 45.0, true, 'Steam 1 nori Japanese siomai. Serve with chili garlic sauce, soy sauce, and calamansi.'),
('corn-addon-20', 'Sweet Corn', 'Add Ons', 20.00, 1, 5.00, 0.00, 5.00, 75.0, true, 'Simmer 1 sweet corn cob slice in cajun butter broth.'),
('rice-cup-20', 'Extra Steamed Rice (1 Cup)', 'Add Ons', 20.00, 1, 11.00, 0.00, 11.00, 45.0, true, 'Scoop 1 cup (200g) of hot steaming white Jasmine rice.'),
('shrimp-regular-addon-20', 'Shrimp Regular Add-On', 'Add Ons', 20.00, 1, 9.00, 0.00, 9.00, 55.0, true, 'Sauté 1 piece regular shrimp (~20g) in cajun sauce.'),
('shrimp-jumbo-addon-30', 'Shrimp Jumbo Add-On', 'Add Ons', 30.00, 1, 16.00, 0.00, 16.00, 47.0, true, 'Sauté 1 piece jumbo shrimp (~37.5g) in hot cajun butter.'),
('tahong-addon-30', 'Tahong (Mussels) Add-On', 'Add Ons', 30.00, 1, 11.00, 0.00, 11.00, 63.0, true, 'Add 3 pieces (~50g) green mussels into simmer.'),
('sausage-addon-50', 'Sliced Sausage', 'Add Ons', 50.00, 1, 16.00, 0.00, 16.00, 68.0, true, 'Pan-sear 50g sliced sausage coin rounds with cajun butter.'),
('special-sauce-addon-30', 'Special Cajun Seafood Sauce', 'Add Ons', 30.00, 1, 10.50, 1.00, 11.50, 62.0, true, 'Portion 30g hot special cajun seafood dipping sauce.'),
('lemonade-small-40', 'Fresh Lemonade (Small)', 'Shake & Lemonade', 40.00, 1, 22.03, 3.20, 25.23, 37.0, true, 'Shake 22.5ml lemon juice, 15ml calamansi juice, 30ml syrup, 150ml water, and 220g ice. Float 1 lemon slice.'),
('lemonade-big-50', 'Fresh Lemonade (Big)', 'Shake & Lemonade', 50.00, 1, 36.18, 4.00, 40.18, 30.0, true, 'Shake 37.5ml lemon juice, 22.5ml calamansi juice, 45ml syrup, 220ml water, and 330g ice with 2 lemon slices.'),
('cucumber-lemonade-small-40', 'Cucumber Lemonade (Small)', 'Shake & Lemonade', 40.00, 1, 21.43, 3.20, 24.63, 38.0, true, 'Blend 30ml cucumber juice, 22.5ml lemon juice, 30ml syrup, and 150ml water over 220g ice. Garnish with 1 cucumber slice.'),
('cucumber-lemonade-big-50', 'Cucumber Lemonade (Big)', 'Shake & Lemonade', 50.00, 1, 33.78, 4.00, 37.78, 35.0, true, 'Blend 45ml cucumber juice, 37.5ml lemon juice, 45ml syrup, and 220ml water over 330g ice with 2 cucumber slices.'),
('shake-small-40', 'Fruit Shake (Small)', 'Shake & Lemonade', 40.00, 1, 32.64, 3.20, 35.84, 30.0, true, 'Blend 80g fruit puree, 39g milk base, 15ml syrup, 50ml water, and 220g ice into 16oz cup.'),
('shake-big-50', 'Fruit Shake (Big)', 'Shake & Lemonade', 50.00, 1, 52.26, 4.00, 56.26, 32.0, true, 'Blend 130g fruit puree, 58.5g milk base, 30ml syrup, 80ml water, and 330g ice into 22oz cup.'),
('mango-pudding-50', 'Mango Pudding', 'Desserts', 50.00, 1, 38.58, 3.50, 42.08, 32.0, true, 'Layer 120g mango custard, 39g sweet mango syrup, and 30g fresh mango cubes.'),
('banana-con-yelo-50', 'Banana Con Yelo', 'Desserts', 50.00, 1, 35.46, 3.50, 38.96, 35.0, true, 'Layer 100g caramelized saba bananas, 200g shaved ice, 58.5g milk, and 18g ube halaya.'),
('ice-cream-50', 'Special Ice Cream', 'Desserts', 50.00, 1, 22.00, 3.50, 25.50, 55.0, true, 'Scoop 100g ice cream into dessert cup with spoon.'),
('mineral-water-15', 'Mineral Water (500ml)', 'Drinks', 15.00, 1, 7.00, 0.00, 7.00, 53.0, true, 'Serve 1 sealed 500ml bottled mineral water.'),
('black-coffee-30', 'Black Coffee', 'Drinks', 30.00, 1, 12.32, 0.00, 12.32, 59.0, true, 'Pour 240ml hot brewed black coffee with 1 sugar packet on side.'),
('coke-mismo-25', 'Coke Mismo (250ml)', 'Drinks', 25.00, 1, 14.00, 0.00, 14.00, 44.0, true, 'Serve 1 chilled 250ml Coke Mismo bottle.'),
('coke-1-5l-110', 'Coke (1.5L)', 'Drinks', 110.00, 1, 65.00, 0.00, 65.00, 41.0, true, 'Serve 1 chilled 1.5-liter Coca-Cola bottle.'),
('sprite-mismo-25', 'Sprite Mismo (250ml)', 'Drinks', 25.00, 1, 14.00, 0.00, 14.00, 44.0, true, 'Serve 1 chilled 250ml Sprite Mismo bottle.'),
('sprite-1-5l-100', 'Sprite (1.5L)', 'Drinks', 100.00, 1, 60.00, 0.00, 60.00, 40.0, true, 'Serve 1 chilled 1.5-liter Sprite bottle.'),
('royal-mismo-25', 'Royal Mismo (250ml)', 'Drinks', 25.00, 1, 14.00, 0.00, 14.00, 44.0, true, 'Serve 1 chilled 250ml Royal Tru-Orange Mismo bottle.'),
('royal-1-5l-100', 'Royal Tru-Orange (1.5L)', 'Drinks', 100.00, 1, 60.00, 0.00, 60.00, 40.0, true, 'Serve 1 chilled 1.5-liter Royal Tru-Orange bottle.'),
('icetea-glass-20', 'House Iced Tea (Glass)', 'Drinks', 20.00, 1, 17.40, 3.20, 20.60, 42.0, true, 'Pour 300ml cold house iced tea over 220g crushed ice in 16oz cup. Garnish with 1 calamansi wheel.'),
('icetea-pitcher-100', 'House Iced Tea (Pitcher)', 'Drinks', 100.00, 1, 51.80, 0.00, 51.80, 48.0, true, 'In pitcher, combine 1000ml house iced tea, 440g ice cubes, and 3 sliced calamansi.')
ON CONFLICT (product_id) DO UPDATE SET
  product_name = EXCLUDED.product_name,
  product_category = EXCLUDED.product_category,
  product_price = EXCLUDED.product_price,
  total_food_cost = EXCLUDED.total_food_cost,
  total_packaging_cost = EXCLUDED.total_packaging_cost,
  total_raw_cost = EXCLUDED.total_raw_cost,
  gross_margin_percent = EXCLUDED.gross_margin_percent,
  preparation_instructions = EXCLUDED.preparation_instructions;

-- ============================================================================
-- SEED DATA: OFFICIAL RECIPE INGREDIENTS (BOM ITEMS)
-- ============================================================================
-- Delete older BOM ingredient links for these products to ensure clean seed
DELETE FROM recipe_ingredients WHERE product_id IN (
  'all-shrimp-alacarte-199', 'all-shrimp-bowl-699', 'all-shrimp-tray-1099',
  'mixed-seafoods-alacarte-99', 'mixed-seafoods-tub-189', 'mixed-seafoods-bowl-699', 'mixed-seafoods-tray-1199',
  'chicken-pastil-35', 'fried-noodles-35', 'chao-fan-35',
  'pork-siomai-5', 'beef-siomai-5', 'chicken-siomai-5', 'sharksfin-siomai-5', 'japanese-siomai-6',
  'corn-addon-20', 'rice-cup-20', 'shrimp-regular-addon-20', 'shrimp-jumbo-addon-30', 'tahong-addon-30', 'sausage-addon-50', 'special-sauce-addon-30',
  'lemonade-small-40', 'lemonade-big-50', 'cucumber-lemonade-small-40', 'cucumber-lemonade-big-50', 'shake-small-40', 'shake-big-50',
  'mango-pudding-50', 'banana-con-yelo-50', 'ice-cream-50',
  'mineral-water-15', 'black-coffee-30', 'coke-mismo-25', 'coke-1-5l-110', 'sprite-mismo-25', 'sprite-1-5l-100', 'royal-mismo-25', 'royal-1-5l-100',
  'icetea-glass-20', 'icetea-pitcher-100'
);

INSERT INTO recipe_ingredients (product_id, ingredient_id, ingredient_name, portion_quantity, unit, estimated_cost) VALUES
-- All Shrimp Alacarte
('all-shrimp-alacarte-199', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 150, 'g', 67.50),
('all-shrimp-alacarte-199', 'ing-cajun-butter', 'Cajun Butter', 50, 'g', 17.00),
('all-shrimp-alacarte-199', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 30, 'g', 10.50),
('all-shrimp-alacarte-199', 'ing-fresh-calamansi', 'Fresh Calamansi', 2, 'pcs', 2.00),
('all-shrimp-alacarte-199', 'ing-paprika', 'Paprika Spice Powder', 2.3, 'g', 1.04),
('all-shrimp-alacarte-199', 'ing-cayenne-pepper', 'Cayenne Pepper Powder', 0.9, 'g', 0.50),
('all-shrimp-alacarte-199', 'ing-salt', 'Iodized Table Salt', 3, 'g', 0.11),
('all-shrimp-alacarte-199', 'ing-black-pepper', 'Cracked Black Pepper', 1.2, 'g', 0.46),

-- All Shrimp Bowl
('all-shrimp-bowl-699', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 300, 'g', 135.00),
('all-shrimp-bowl-699', 'ing-garlic-butter', 'Garlic Butter', 100, 'g', 32.00),
('all-shrimp-bowl-699', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 60, 'g', 21.00),
('all-shrimp-bowl-699', 'ing-fresh-calamansi', 'Fresh Calamansi', 3, 'pcs', 3.00),
('all-shrimp-bowl-699', 'ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 2, 'pcs', 9.00),
('all-shrimp-bowl-699', 'ing-minced-garlic', 'Minced Garlic', 5, 'g', 0.80),
('all-shrimp-bowl-699', 'ing-fresh-parsley', 'Fresh Parsley', 0.5, 'g', 0.18),
('all-shrimp-bowl-699', 'ing-salt', 'Iodized Table Salt', 3, 'g', 0.11),
('all-shrimp-bowl-699', 'ing-black-pepper', 'Cracked Black Pepper', 1.2, 'g', 0.46),

-- All Shrimp Party Tray
('all-shrimp-tray-1099', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 800, 'g', 360.00),
('all-shrimp-tray-1099', 'ing-cajun-butter', 'Cajun Butter', 250, 'g', 85.00),
('all-shrimp-tray-1099', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 120, 'g', 42.00),
('all-shrimp-tray-1099', 'ing-fresh-calamansi', 'Fresh Calamansi', 6, 'pcs', 6.00),
('all-shrimp-tray-1099', 'ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 4, 'pcs', 18.00),
('all-shrimp-tray-1099', 'ing-minced-garlic', 'Minced Garlic', 10, 'g', 1.60),
('all-shrimp-tray-1099', 'ing-paprika', 'Paprika Spice Powder', 7, 'g', 3.15),
('all-shrimp-tray-1099', 'ing-cayenne-pepper', 'Cayenne Pepper Powder', 1.8, 'g', 0.99),
('all-shrimp-tray-1099', 'ing-salt', 'Iodized Table Salt', 6, 'g', 0.21),
('all-shrimp-tray-1099', 'ing-black-pepper', 'Cracked Black Pepper', 2.4, 'g', 0.91),

-- Mixed Seafoods Alacarte (Mini)
('mixed-seafoods-alacarte-99', 'ing-crab-halves', 'Crab (Halves)', 100, 'g', 55.00),
('mixed-seafoods-alacarte-99', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 100, 'g', 45.00),
('mixed-seafoods-alacarte-99', 'ing-green-mussels', 'Green Mussels (Tahong)', 100, 'g', 22.00),
('mixed-seafoods-alacarte-99', 'ing-sweet-corn', 'Sweet Corn Cob (Mini Cob Slices)', 2, 'pcs', 10.00),
('mixed-seafoods-alacarte-99', 'ing-butter', 'Pure Butter Blend', 60, 'g', 16.80),
('mixed-seafoods-alacarte-99', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 30, 'g', 10.50),
('mixed-seafoods-alacarte-99', 'ing-fresh-calamansi', 'Fresh Calamansi', 2, 'pcs', 2.00),
('mixed-seafoods-alacarte-99', 'ing-salt', 'Iodized Table Salt', 3, 'g', 0.11),
('mixed-seafoods-alacarte-99', 'ing-black-pepper', 'Cracked Black Pepper', 1.2, 'g', 0.46),

-- Mixed Seafoods Tub
('mixed-seafoods-tub-189', 'ing-crab-halves', 'Crab (Halves)', 150, 'g', 82.50),
('mixed-seafoods-tub-189', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 150, 'g', 67.50),
('mixed-seafoods-tub-189', 'ing-green-mussels', 'Green Mussels (Tahong)', 150, 'g', 33.00),
('mixed-seafoods-tub-189', 'ing-shellfish-clams', 'Shellfish / Clams', 100, 'g', 25.00),
('mixed-seafoods-tub-189', 'ing-sweet-corn', 'Sweet Corn Cob (Mini Cob Slices)', 3, 'pcs', 15.00),
('mixed-seafoods-tub-189', 'ing-butter', 'Pure Butter Blend', 90, 'g', 25.20),
('mixed-seafoods-tub-189', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 45, 'g', 15.75),
('mixed-seafoods-tub-189', 'ing-fresh-calamansi', 'Fresh Calamansi', 3, 'pcs', 3.00),
('mixed-seafoods-tub-189', 'ing-minced-garlic', 'Minced Garlic', 10, 'g', 1.60),
('mixed-seafoods-tub-189', 'ing-salt', 'Iodized Table Salt', 6, 'g', 0.21),
('mixed-seafoods-tub-189', 'ing-black-pepper', 'Cracked Black Pepper', 2.4, 'g', 0.91),

-- Mixed Seafoods Bowl
('mixed-seafoods-bowl-699', 'ing-crab-halves', 'Crab (Halves)', 300, 'g', 165.00),
('mixed-seafoods-bowl-699', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 300, 'g', 135.00),
('mixed-seafoods-bowl-699', 'ing-green-mussels', 'Green Mussels (Tahong)', 250, 'g', 55.00),
('mixed-seafoods-bowl-699', 'ing-shellfish-clams', 'Shellfish / Clams', 150, 'g', 37.50),
('mixed-seafoods-bowl-699', 'ing-sweet-corn', 'Sweet Corn Cob (Mini Cob Slices)', 4, 'pcs', 20.00),
('mixed-seafoods-bowl-699', 'ing-butter', 'Pure Butter Blend', 150, 'g', 42.00),
('mixed-seafoods-bowl-699', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 90, 'g', 31.50),
('mixed-seafoods-bowl-699', 'ing-fresh-calamansi', 'Fresh Calamansi', 4, 'pcs', 4.00),
('mixed-seafoods-bowl-699', 'ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 3, 'pcs', 13.50),
('mixed-seafoods-bowl-699', 'ing-salt', 'Iodized Table Salt', 9, 'g', 0.32),
('mixed-seafoods-bowl-699', 'ing-black-pepper', 'Cracked Black Pepper', 3.6, 'g', 1.37),

-- Mixed Seafoods Fiesta Tray
('mixed-seafoods-tray-1199', 'ing-crab-halves', 'Crab (Halves)', 600, 'g', 330.00),
('mixed-seafoods-tray-1199', 'ing-shrimp-fresh', 'Fresh Whole Shrimp', 600, 'g', 270.00),
('mixed-seafoods-tray-1199', 'ing-green-mussels', 'Green Mussels (Tahong)', 500, 'g', 110.00),
('mixed-seafoods-tray-1199', 'ing-shellfish-clams', 'Shellfish / Clams', 300, 'g', 75.00),
('mixed-seafoods-tray-1199', 'ing-sweet-corn', 'Sweet Corn Cob (Mini Cob Slices)', 8, 'pcs', 40.00),
('mixed-seafoods-tray-1199', 'ing-butter', 'Pure Butter Blend', 300, 'g', 84.00),
('mixed-seafoods-tray-1199', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 150, 'g', 52.50),
('mixed-seafoods-tray-1199', 'ing-fresh-calamansi', 'Fresh Calamansi', 8, 'pcs', 8.00),
('mixed-seafoods-tray-1199', 'ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 6, 'pcs', 27.00),
('mixed-seafoods-tray-1199', 'ing-minced-garlic', 'Minced Garlic', 15, 'g', 2.40),
('mixed-seafoods-tray-1199', 'ing-paprika', 'Paprika Spice Powder', 10.5, 'g', 4.73),
('mixed-seafoods-tray-1199', 'ing-salt', 'Iodized Table Salt', 18, 'g', 0.63),
('mixed-seafoods-tray-1199', 'ing-black-pepper', 'Cracked Black Pepper', 7.2, 'g', 2.74),

-- Chicken Pastil
('chicken-pastil-35', 'ing-shredded-chicken', 'Shredded Chicken (Pastil Filling)', 80, 'g', 22.40),
('chicken-pastil-35', 'ing-steamed-white-rice', 'Steaming White Rice (Jasmine)', 200, 'g', 11.00),
('chicken-pastil-35', 'ing-cooking-oil', 'Cooking Oil', 14, 'g', 1.68),
('chicken-pastil-35', 'ing-minced-garlic', 'Minced Garlic', 5, 'g', 0.80),
('chicken-pastil-35', 'ing-chopped-onion', 'Chopped Onion', 55, 'g', 6.05),
('chicken-pastil-35', 'ing-soy-sauce', 'Soy Sauce', 15, 'g', 1.20),
('chicken-pastil-35', 'ing-vinegar-dip', 'Vinegar Dip / Cane Vinegar', 5, 'g', 0.30),
('chicken-pastil-35', 'ing-salt', 'Iodized Table Salt', 3, 'g', 0.11),
('chicken-pastil-35', 'ing-black-pepper', 'Cracked Black Pepper', 0.6, 'g', 0.23),

-- Fried Noodles
('fried-noodles-35', 'ing-street-stirfry-noodles', 'Street Stir-Fry Noodles', 150, 'g', 16.50),
('fried-noodles-35', 'ing-pork-siomai', 'Pork Siomai', 3, 'pcs', 7.50),
('fried-noodles-35', 'ing-stirfry-savory-sauce', 'Stir-Fry Savory Sauce / Chao Fan Seasoning', 30, 'g', 6.60),
('fried-noodles-35', 'ing-cooking-oil', 'Cooking Oil', 14, 'g', 1.68),
('fried-noodles-35', 'ing-minced-garlic', 'Minced Garlic', 5, 'g', 0.80),
('fried-noodles-35', 'ing-salt', 'Iodized Table Salt', 3, 'g', 0.11),
('fried-noodles-35', 'ing-black-pepper', 'Cracked Black Pepper', 0.6, 'g', 0.23),

-- Chao Fan
('chao-fan-35', 'ing-steamed-white-rice', 'Steaming White Rice (Jasmine)', 200, 'g', 11.00),
('chao-fan-35', 'ing-seasoned-meat-bits', 'Seasoned Meat Bits', 50, 'g', 13.00),
('chao-fan-35', 'ing-fresh-eggs', 'Fresh Eggs (Large)', 1, 'pcs', 7.50),
('chao-fan-35', 'ing-mixed-vegetables', 'Mixed Vegetables (Cabbage, Carrots, Peas)', 40, 'g', 4.80),
('chao-fan-35', 'ing-spring-onion', 'Chopped Spring Onion', 6, 'g', 1.08),
('chao-fan-35', 'ing-cooking-oil', 'Cooking Oil', 4.7, 'g', 0.56),
('chao-fan-35', 'ing-stirfry-savory-sauce', 'Stir-Fry Savory Sauce / Chao Fan Seasoning', 15, 'g', 3.30),
('chao-fan-35', 'ing-minced-garlic', 'Minced Garlic', 5, 'g', 0.80),
('chao-fan-35', 'ing-salt', 'Iodized Table Salt', 3, 'g', 0.11),
('chao-fan-35', 'ing-black-pepper', 'Cracked Black Pepper', 0.6, 'g', 0.23),

-- Siomai
('pork-siomai-5', 'ing-pork-siomai', 'Pork Siomai', 1, 'pcs', 2.50),
('pork-siomai-5', 'ing-chili-garlic-sauce', 'Chili Garlic Sauce', 5, 'g', 1.25),
('pork-siomai-5', 'ing-soy-sauce', 'Soy Sauce', 2.5, 'g', 0.20),
('pork-siomai-5', 'ing-fresh-calamansi', 'Fresh Calamansi', 1, 'pcs', 1.00),

('beef-siomai-5', 'ing-beef-siomai', 'Beef Siomai', 1, 'pcs', 2.70),
('beef-siomai-5', 'ing-chili-garlic-sauce', 'Chili Garlic Sauce', 5, 'g', 1.25),
('beef-siomai-5', 'ing-soy-sauce', 'Soy Sauce', 2.5, 'g', 0.20),
('beef-siomai-5', 'ing-fresh-calamansi', 'Fresh Calamansi', 1, 'pcs', 1.00),

('chicken-siomai-5', 'ing-chicken-siomai', 'Chicken Siomai', 1, 'pcs', 2.50),
('chicken-siomai-5', 'ing-chili-garlic-sauce', 'Chili Garlic Sauce', 5, 'g', 1.25),
('chicken-siomai-5', 'ing-soy-sauce', 'Soy Sauce', 2.5, 'g', 0.20),
('chicken-siomai-5', 'ing-fresh-calamansi', 'Fresh Calamansi', 1, 'pcs', 1.00),

('sharksfin-siomai-5', 'ing-sharksfin-siomai', 'Sharksfin Siomai', 1, 'pcs', 2.80),
('sharksfin-siomai-5', 'ing-chili-garlic-sauce', 'Chili Garlic Sauce', 5, 'g', 1.25),
('sharksfin-siomai-5', 'ing-soy-sauce', 'Soy Sauce', 2.5, 'g', 0.20),
('sharksfin-siomai-5', 'ing-fresh-calamansi', 'Fresh Calamansi', 1, 'pcs', 1.00),

('japanese-siomai-6', 'ing-japanese-siomai', 'Japanese Siomai', 1, 'pcs', 3.20),
('japanese-siomai-6', 'ing-chili-garlic-sauce', 'Chili Garlic Sauce', 5, 'g', 1.25),
('japanese-siomai-6', 'ing-soy-sauce', 'Soy Sauce', 2.5, 'g', 0.20),
('japanese-siomai-6', 'ing-fresh-calamansi', 'Fresh Calamansi', 1, 'pcs', 1.00),

-- Add Ons
('corn-addon-20', 'ing-sweet-corn', 'Sweet Corn Cob (Mini Cob Slices)', 1, 'pcs', 5.00),
('rice-cup-20', 'ing-steamed-white-rice', 'Steaming White Rice (Jasmine)', 200, 'g', 11.00),
('shrimp-regular-addon-20', 'ing-shrimp-regular-pc', 'Fresh Regular Shrimp (Piece)', 1, 'pcs', 9.00),
('shrimp-jumbo-addon-30', 'ing-shrimp-jumbo-pc', 'Fresh Jumbo Shrimp (Piece)', 1, 'pcs', 16.00),
('tahong-addon-30', 'ing-green-mussels', 'Green Mussels (Tahong)', 50, 'g', 11.00),
('sausage-addon-50', 'ing-sliced-sausage', 'Sliced Sausage (Smoked Rounds)', 50, 'g', 16.00),
('special-sauce-addon-30', 'ing-special-cajun-sauce', 'Special Cajun Seafood Sauce', 30, 'g', 10.50),

-- Shakes & Lemonades
('lemonade-small-40', 'ing-lemon-juice', 'Fresh Lemon Juice', 22.5, 'ml', 5.63),
('lemonade-small-40', 'ing-calamansi-juice', 'Fresh Calamansi Juice', 15, 'ml', 3.00),
('lemonade-small-40', 'ing-sugar-syrup', 'Sugar Syrup', 30, 'ml', 3.00),
('lemonade-small-40', 'ing-purified-water', 'Purified Water', 150, 'ml', 1.50),
('lemonade-small-40', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 220, 'g', 4.40),
('lemonade-small-40', 'ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 1, 'pcs', 4.50),

('lemonade-big-50', 'ing-lemon-juice', 'Fresh Lemon Juice', 37.5, 'ml', 9.38),
('lemonade-big-50', 'ing-calamansi-juice', 'Fresh Calamansi Juice', 22.5, 'ml', 4.50),
('lemonade-big-50', 'ing-sugar-syrup', 'Sugar Syrup', 45, 'ml', 4.50),
('lemonade-big-50', 'ing-purified-water', 'Purified Water', 220, 'ml', 2.20),
('lemonade-big-50', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 330, 'g', 6.60),
('lemonade-big-50', 'ing-fresh-lemon', 'Fresh Lemon (Wedges / Slices)', 2, 'pcs', 9.00),

('cucumber-lemonade-small-40', 'ing-cucumber-juice', 'Cucumber Juice / Blend', 30, 'ml', 5.40),
('cucumber-lemonade-small-40', 'ing-lemon-juice', 'Fresh Lemon Juice', 22.5, 'ml', 5.63),
('cucumber-lemonade-small-40', 'ing-sugar-syrup', 'Sugar Syrup', 30, 'ml', 3.00),
('cucumber-lemonade-small-40', 'ing-purified-water', 'Purified Water', 150, 'ml', 1.50),
('cucumber-lemonade-small-40', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 220, 'g', 4.40),
('cucumber-lemonade-small-40', 'ing-fresh-cucumber', 'Fresh Cucumber (Slices)', 1, 'pcs', 1.50),

('cucumber-lemonade-big-50', 'ing-cucumber-juice', 'Cucumber Juice / Blend', 45, 'ml', 8.10),
('cucumber-lemonade-big-50', 'ing-lemon-juice', 'Fresh Lemon Juice', 37.5, 'ml', 9.38),
('cucumber-lemonade-big-50', 'ing-sugar-syrup', 'Sugar Syrup', 45, 'ml', 4.50),
('cucumber-lemonade-big-50', 'ing-purified-water', 'Purified Water', 220, 'ml', 2.20),
('cucumber-lemonade-big-50', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 330, 'g', 6.60),
('cucumber-lemonade-big-50', 'ing-fresh-cucumber', 'Fresh Cucumber (Slices)', 2, 'pcs', 3.00),

('shake-small-40', 'ing-fruit-puree', 'Real Fruit / Fruit Puree', 80, 'g', 20.00),
('shake-small-40', 'ing-creamy-condensed-milk', 'Creamy Milk Base / Condensed Milk', 39, 'g', 6.24),
('shake-small-40', 'ing-sugar-syrup', 'Sugar Syrup', 15, 'ml', 1.50),
('shake-small-40', 'ing-purified-water', 'Purified Water', 50, 'ml', 0.50),
('shake-small-40', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 220, 'g', 4.40),

('shake-big-50', 'ing-fruit-puree', 'Real Fruit / Fruit Puree', 130, 'g', 32.50),
('shake-big-50', 'ing-creamy-condensed-milk', 'Creamy Milk Base / Condensed Milk', 58.5, 'g', 9.36),
('shake-big-50', 'ing-sugar-syrup', 'Sugar Syrup', 30, 'ml', 3.00),
('shake-big-50', 'ing-purified-water', 'Purified Water', 80, 'ml', 0.80),
('shake-big-50', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 330, 'g', 6.60),

-- Desserts
('mango-pudding-50', 'ing-mango-custard-base', 'Mango Custard Base', 120, 'g', 21.60),
('mango-pudding-50', 'ing-sweet-mango-syrup', 'Sweet Mango Syrup', 39, 'g', 8.58),
('mango-pudding-50', 'ing-fresh-mango-cubes', 'Fresh Mango Cubes', 30, 'g', 8.40),

('banana-con-yelo-50', 'ing-caramelized-saba', 'Sweet Caramelized Saba Bananas', 100, 'g', 18.00),
('banana-con-yelo-50', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 200, 'g', 4.00),
('banana-con-yelo-50', 'ing-evaporated-milk', 'Evaporated / Condensed Milk', 58.5, 'g', 8.78),
('banana-con-yelo-50', 'ing-ube-halaya', 'Ube Halaya Topping', 18, 'g', 4.68),

('ice-cream-50', 'ing-special-ice-cream', 'Special Ice Cream', 100, 'g', 22.00),

-- Drinks
('mineral-water-15', 'ing-mineral-water-bottle', 'Bottled Mineral Water (500ml)', 1, 'bottle', 7.00),
('black-coffee-30', 'ing-brewed-coffee', 'Hot Brewed Black Coffee', 240, 'ml', 12.00),
('black-coffee-30', 'ing-sugar', 'Refined White Sugar', 4, 'g', 0.32),
('coke-mismo-25', 'ing-coke-mismo', 'Coca-Cola Mismo (250ml)', 1, 'bottle', 14.00),
('coke-1-5l-110', 'ing-coke-15l', 'Coca-Cola (1.5L)', 1, 'bottle', 65.00),
('sprite-mismo-25', 'ing-sprite-mismo', 'Sprite Mismo (250ml)', 1, 'bottle', 14.00),
('sprite-1-5l-100', 'ing-sprite-15l', 'Sprite (1.5L)', 1, 'bottle', 60.00),
('royal-mismo-25', 'ing-royal-mismo', 'Royal Tru-Orange Mismo (250ml)', 1, 'bottle', 14.00),
('royal-1-5l-100', 'ing-royal-15l', 'Royal Tru-Orange (1.5L)', 1, 'bottle', 60.00),
('icetea-glass-20', 'ing-house-iced-tea', 'House Iced Tea Liquid', 300, 'ml', 12.00),
('icetea-glass-20', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 220, 'g', 4.40),
('icetea-glass-20', 'ing-fresh-calamansi', 'Fresh Calamansi', 1, 'pcs', 1.00),
('icetea-pitcher-100', 'ing-house-iced-tea', 'House Iced Tea Liquid', 1000, 'ml', 40.00),
('icetea-pitcher-100', 'ing-crushed-ice', 'Crushed Ice / Shaved Ice', 440, 'g', 8.80),
('icetea-pitcher-100', 'ing-fresh-calamansi', 'Fresh Calamansi', 3, 'pcs', 3.00)
ON CONFLICT (product_id, ingredient_id) DO UPDATE SET
  portion_quantity = EXCLUDED.portion_quantity,
  unit = EXCLUDED.unit,
  estimated_cost = EXCLUDED.estimated_cost;

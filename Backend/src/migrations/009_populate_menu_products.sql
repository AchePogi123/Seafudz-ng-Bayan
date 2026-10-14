-- ============================================
-- MIGRATION: Populate Menu Products for Replacement Flow & Order Consistency
-- Description: Inserts all authoritative menu items into the products table
--   using both client slug IDs and GCP item IDs to ensure full consistency.
-- ============================================

INSERT INTO categories (id, name, description) VALUES
(1, 'Seafood Mixes', 'Signature Seafood Bilaos, Trays, Tubs, and Ala Carte Mixes'),
(2, 'Shrimp Specials', 'Fresh Shrimp Ala Carte, Bowls, and Family Trays'),
(3, 'Crabs & Shellfish', 'Fresh Crabs, Mud Crabs, and Specialty Shellfish Dishes'),
(4, 'Beverages & Shakes', 'Refreshing Sodas, Natural Shakes, Coffee, and Pitchers'),
(5, 'Value Meals & Add-ons', 'Rice Bowls, Siomai, Pastil, Desserts, and Extra Sides')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Insert all authoritative client menu items (slug IDs)
INSERT INTO products (id, category_id, name, description, price, is_available) VALUES
('all-shrimp-alacarte-199', 1, 'All Shrimp Alacarte', 'Fresh, succulent whole shrimps sautéed in signature savory cajun butter spices.', 199.00, true),
('all-shrimp-bowl-699', 1, 'All Shrimp Bowl', 'Hearty sharing bowl packed with garlic butter shrimps and rich sauce.', 699.00, true),
('all-shrimp-tray-1099', 1, 'All Shrimp Party Tray', 'Generous fiesta platter of premium shrimps for family gatherings and celebrations.', 1099.00, true),
('mixed-seafoods-alacarte-99', 1, 'Mixed Seafoods Alacarte (Mini)', 'Delicious mini medley of fresh crab, shrimp, mussels, and sweet corn.', 99.00, true),
('mixed-seafoods-tub-189', 1, 'Mixed Seafoods Tub', 'Generous tub loaded with fresh mixed seafood in special butter garlic sauce.', 189.00, true),
('mixed-seafoods-bowl-699', 1, 'Mixed Seafoods Bowl', 'Feast bowl overflowing with assorted crabs, shrimp, corn, and shellfish.', 699.00, true),
('mixed-seafoods-tray-1199', 1, 'Mixed Seafoods Fiesta Tray', 'The ultimate signature seafood fiesta tray with crabs, shrimps, and mussels.', 1199.00, true),
('chicken-pastil-35', 5, 'Chicken Pastil', 'Savory shredded native chicken pastil served over steaming fragrant white rice.', 35.00, true),
('fried-noodles-35', 5, 'Fried Noodles', 'Stir-fried savory street noodles tossed with crisp vegetables and savory sauce.', 35.00, true),
('chao-fan-35', 5, 'Chao Fan', 'Wok-tossed hearty fried rice with seasoned meat bits, scrambled egg, and aromatics.', 35.00, true),
('pork-siomai-5', 5, 'Pork Siomai', 'Classic steamed pork dumpling served with chili garlic sauce and calamansi.', 5.00, true),
('beef-siomai-5', 5, 'Beef Siomai', 'Juicy beef dumplings bursting with rich savory garlic flavors.', 5.00, true),
('chicken-siomai-5', 5, 'Chicken Siomai', 'Tender chicken dumpling packed with seasoned aromatics.', 5.00, true),
('sharksfin-siomai-5', 5, 'Sharksfin Siomai', 'Special dim sum dumpling with crisp vegetables and savory filling.', 5.00, true),
('japanese-siomai-6', 5, 'Japanese Siomai', 'Steamed dumpling wrapped in Japanese nori seaweed with crabstick topping.', 6.00, true),
('corn-addon-20', 5, 'Sweet Corn', 'Sweet corn cob segments simmered in rich seafood garlic butter sauce.', 20.00, true),
('rice-cup-20', 5, 'Extra Steamed Rice (1 Cup)', 'Freshly steamed white fragrant rice.', 20.00, true),
('shrimp-regular-addon-20', 5, 'Shrimp Regular Add-On', 'Extra fresh regular shrimp cooked in signature Cajun garlic blend.', 20.00, true),
('shrimp-jumbo-addon-30', 5, 'Shrimp Jumbo Add-On', 'Extra jumbo-sized succulent shrimp infused with savory spices.', 30.00, true),
('tahong-addon-30', 5, 'Tahong (Mussels) Add-On', 'Fresh green mussels tossed in butter garlic seasoning.', 30.00, true),
('sausage-addon-50', 5, 'Sliced Sausage', 'Smoked sausage rounds infused with rich seafood boil flavors.', 50.00, true),
('special-sauce-addon-30', 5, 'Special Cajun Seafood Sauce', 'Signature secret spicy garlic butter seafood sauce.', 30.00, true),
('lemonade-small-40', 4, 'Fresh Lemonade (Small)', 'Hand-pressed iced sweet and tangy fresh lemon-calamansi cooler.', 40.00, true),
('lemonade-big-50', 4, 'Fresh Lemonade (Big)', 'Large refreshing cup of freshly squeezed lemonade on ice.', 50.00, true),
('cucumber-lemonade-small-40', 4, 'Cucumber Lemonade (Small)', 'Crisp cucumber juice blended with fresh lemon and crushed ice.', 40.00, true),
('cucumber-lemonade-big-50', 4, 'Cucumber Lemonade (Big)', 'Large cup of cooling iced cucumber lemonade.', 50.00, true),
('shake-small-40', 4, 'Fruit Shake (Small)', 'Smooth, creamy ice-blended refreshing fruit shake.', 40.00, true),
('shake-big-50', 4, 'Fruit Shake (Big)', 'Large ice-blended refreshing fruit shake with creamy finish.', 50.00, true),
('mango-pudding-50', 5, 'Mango Pudding', 'Silky smooth mango custard dessert topped with sweet mango syrup.', 50.00, true),
('banana-con-yelo-50', 5, 'Banana Con Yelo', 'Sweet caramelized saba bananas over shaved ice with rich milk.', 50.00, true),
('ice-cream-50', 5, 'Special Ice Cream', 'Rich and creamy scoop of ice cream for a sweet after-meal delight.', 50.00, true),
('mineral-water-15', 4, 'Mineral Water (500ml)', 'Purified cold bottled drinking water.', 15.00, true),
('black-coffee-30', 4, 'Black Coffee', 'Hot brewed rich aromatic roasted black coffee.', 30.00, true),
('coke-mismo-25', 4, 'Coke Mismo (250ml)', 'Chilled bottle of classic refreshing Coca-Cola.', 25.00, true),
('coke-1-5l-110', 4, 'Coke (1.5L)', 'Large 1.5-liter Coca-Cola bottle perfect for group sharing.', 110.00, true),
('sprite-mismo-25', 4, 'Sprite Mismo (250ml)', 'Chilled bottle of crisp lemon-lime Sprite soda.', 25.00, true),
('sprite-1-5l-100', 4, 'Sprite (1.5L)', 'Large 1.5-liter bottle of crisp refreshing Sprite.', 100.00, true),
('royal-mismo-25', 4, 'Royal Mismo (250ml)', 'Chilled bottle of sweet, fruity Royal Tru-Orange.', 25.00, true),
('royal-1-5l-100', 4, 'Royal Tru-Orange (1.5L)', 'Large 1.5-liter bottle of fruity Royal Tru-Orange soda.', 100.00, true),
('icetea-glass-20', 4, 'House Iced Tea (Glass)', 'Chilled sweetened citrus iced tea served in a glass.', 20.00, true),
('icetea-pitcher-100', 4, 'House Iced Tea (Pitcher)', '1-liter sharing pitcher of refreshing house iced tea.', 100.00, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category_id = EXCLUDED.category_id,
  is_available = EXCLUDED.is_available;


-- Also ensure GCP item-XXX IDs are present
INSERT INTO products (id, category_id, name, description, price, is_available) VALUES
('item-001', 1, 'Mixed Seafoods Alacarte', 'Signature mixed seafoods platter.', 99.00, true),
('item-002', 1, 'Mixed Seafoods Alacarte Tub', 'Signature mixed seafoods served in a tub.', 189.00, true),
('item-003', 1, 'Mixed Seafoods Alacarte Bowl', 'Signature mixed seafoods serving bowl.', 699.00, true),
('item-004', 1, 'Mixed Seafoods Alacarte Tray', 'Signature mixed seafoods feast tray.', 1199.00, true),
('item-005', 2, 'All Shrimp Alacarte', 'Freshly prepared all-shrimp dish.', 199.00, true),
('item-006', 2, 'All Shrimp Bowl', 'Generous all-shrimp bowl platter.', 699.00, true),
('item-007', 2, 'All Shrimp Tray', 'Family-style all-shrimp tray.', 1099.00, true),
('item-008', 5, 'Chao Fan', 'Flavorful fried rice meal.', 35.00, true),
('item-009', 5, 'Chicken Pastil', 'Traditional chicken pastil over rice.', 35.00, true),
('item-010', 5, 'Fried Noodles', 'Savory stir-fried noodles.', 35.00, true),
('item-011', 5, 'Pork Siomai', 'Steamed pork siomai per piece.', 5.00, true),
('item-012', 5, 'Beef Siomai', 'Steamed beef siomai per piece.', 5.00, true),
('item-013', 5, 'Chicken Siomai', 'Steamed chicken siomai per piece.', 5.00, true),
('item-014', 5, 'Sharksfin Siomai', 'Steamed sharksfin siomai per piece.', 5.00, true),
('item-015', 5, 'Japanese Siomai', 'Nori-wrapped Japanese siomai per piece.', 6.00, true),
('item-016', 4, 'Mineral Water 500ml', 'Bottled drinking water.', 15.00, true),
('item-017', 4, 'Coke Mismo 250ml', 'Chilled Coke 250ml.', 25.00, true),
('item-018', 4, 'Sprite Mismo 250ml', 'Chilled Sprite 250ml.', 25.00, true),
('item-019', 4, 'Royal Mismo 250ml', 'Chilled Royal 250ml.', 25.00, true),
('item-020', 4, 'Black Coffee', 'Hot black coffee.', 30.00, true),
('item-021', 4, 'Coke 1.5L', 'Coke 1.5 Liters bottle.', 110.00, true),
('item-022', 4, 'Sprite 1.5L', 'Sprite 1.5 Liters bottle.', 100.00, true),
('item-023', 4, 'Royal 1.5L', 'Royal 1.5 Liters bottle.', 100.00, true),
('item-024', 4, 'Snakes Small', 'Specialty beverage (Small).', 40.00, true),
('item-025', 4, 'Lemonade Small', 'Fresh lemonade juice (Small).', 40.00, true),
('item-026', 4, 'Lemonade Big', 'Fresh lemonade juice (Big).', 50.00, true),
('item-027', 4, 'Cucumber Lemonade Small', 'Cucumber lemonade blend (Small).', 40.00, true),
('item-028', 4, 'Cucumber Lemonade Big', 'Cucumber lemonade blend (Big).', 50.00, true),
('item-029', 5, 'Banana Con Yelo', 'Sweetened banana with shaved ice and milk.', 50.00, true),
('item-030', 5, 'Ice Cream', 'Chilled sweet ice cream.', 50.00, true),
('item-031', 5, 'Mango Pudding', 'Creamy mango pudding dessert.', 50.00, true),
('item-032', 5, 'One Cup Rice', 'Extra steamed white rice.', 20.00, true),
('item-033', 5, 'Corn Add-on', 'Sweet corn cob portion.', 20.00, true),
('item-034', 5, 'Iced Tea Glass', 'Iced tea add-on per glass.', 20.00, true),
('item-035', 5, 'Shrimp Regular Add-on', 'Regular shrimp add-on portion.', 20.00, true),
('item-036', 5, 'Shrimp Jumbo Add-on', 'Jumbo shrimp add-on portion.', 30.00, true),
('item-037', 5, 'Tahong Add-on', 'Fresh mussels add-on portion.', 30.00, true),
('item-038', 5, 'Special Sauce', 'Extra house special sauce.', 30.00, true),
('item-039', 5, 'Sausage Add-on', 'Sausage portion add-on.', 50.00, true),
('item-040', 5, 'Iced Tea Pitcher', 'Full iced tea pitcher.', 100.00, true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  category_id = EXCLUDED.category_id,
  is_available = EXCLUDED.is_available;

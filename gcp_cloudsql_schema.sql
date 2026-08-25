-- ============================================
-- SEAFUDZ NG BAYAN RESTAURANT SYSTEM DATABASE
-- Finalized PostgreSQL / GCP Cloud SQL Schema
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables to allow clean schema replacement
DROP TABLE IF EXISTS kitchen_orders CASCADE;
DROP TABLE IF EXISTS deliveries CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS assistant_calls CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS menu_items CASCADE;
DROP TABLE IF EXISTS categories CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS employees CASCADE;

-- ============================================
-- 1. EMPLOYEES
-- ============================================

CREATE TABLE employees (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID UNIQUE,
    fullname VARCHAR(255) NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL
        CHECK (role IN (
            'admin',
            'cashier',
            'assistant',
            'kitchen',
            'rider'
        )),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 2. CUSTOMERS
-- ============================================

CREATE TABLE customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    supabase_user_id UUID UNIQUE,
    fullname VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(50),
    delivery_address TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 3. CATEGORIES
-- ============================================

CREATE TABLE categories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 4. PRODUCTS
-- ============================================

CREATE TABLE products (
    id VARCHAR(100) PRIMARY KEY,
    category_id BIGINT NOT NULL
        REFERENCES categories(id)
        ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL
        CHECK (price >= 0),
    image TEXT,
    is_available BOOLEAN NOT NULL DEFAULT TRUE,
    preparation_time_mins INT DEFAULT 15
        CHECK (preparation_time_mins > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 5. ORDERS
-- ============================================

CREATE TABLE orders (
    id VARCHAR(100) PRIMARY KEY,
    customer_id UUID
        REFERENCES customers(id)
        ON DELETE SET NULL,
    cashier_id UUID
        REFERENCES employees(id)
        ON DELETE SET NULL,
    assistant_id UUID
        REFERENCES employees(id)
        ON DELETE SET NULL,
    order_type VARCHAR(50) NOT NULL
        CHECK (order_type IN (
            'ONLINE',
            'ON_SITE'
        )),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'IN_PROCESS',
            'COMPLETED',
            'CANCELLED'
        )),
    subtotal NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (subtotal >= 0),
    tax NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (tax >= 0),
    delivery_fee NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (delivery_fee >= 0),
    total NUMERIC(10,2) NOT NULL DEFAULT 0
        CHECK (total >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 6. ORDER ITEMS
-- ============================================

CREATE TABLE order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,
    product_id VARCHAR(100)
        REFERENCES products(id)
        ON DELETE RESTRICT,
    product_name_snapshot VARCHAR(255) NOT NULL,
    unit_price NUMERIC(10,2) NOT NULL
        CHECK (unit_price >= 0),
    quantity INT NOT NULL DEFAULT 1
        CHECK (quantity > 0),
    subtotal NUMERIC(10,2) NOT NULL
        CHECK (subtotal >= 0),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 7. PAYMENTS
-- ============================================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL
        CHECK (payment_method IN (
            'CASH',
            'GCASH',
            'CARD',
            'ONLINE'
        )),
    amount NUMERIC(10,2) NOT NULL
        CHECK (amount >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'PAID',
            'FAILED',
            'REFUNDED'
        )),
    reference_number VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 8. DELIVERIES
-- ============================================

CREATE TABLE deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL UNIQUE
        REFERENCES orders(id)
        ON DELETE CASCADE,
    rider_id UUID
        REFERENCES employees(id)
        ON DELETE SET NULL,
    delivery_address TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'ASSIGNED',
            'PICKED_UP',
            'DELIVERED',
            'CANCELLED'
        )),
    assigned_at TIMESTAMPTZ,
    picked_up_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 9. KITCHEN ORDERS
-- ============================================

CREATE TABLE kitchen_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id VARCHAR(100) NOT NULL UNIQUE
        REFERENCES orders(id)
        ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN (
            'PENDING',
            'IN_PROCESS',
            'COMPLETED',
            'CANCELLED'
        )),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 10. ASSISTANT CALLS
-- ============================================

CREATE TABLE assistant_calls (
    id VARCHAR(100) PRIMARY KEY,
    assistant_id UUID REFERENCES employees(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL DEFAULT 'Call Waiter',
    status VARCHAR(50) NOT NULL DEFAULT 'Pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_cashier ON orders(cashier_id);
CREATE INDEX idx_orders_assistant ON orders(assistant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_deliveries_rider ON deliveries(rider_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_kitchen_orders_status ON kitchen_orders(status);


-- ============================================
-- AUTOMATIC TIMESTAMP TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_employees_modtime') THEN
        CREATE TRIGGER update_employees_modtime BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_customers_modtime') THEN
        CREATE TRIGGER update_customers_modtime BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_products_modtime') THEN
        CREATE TRIGGER update_products_modtime BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_orders_modtime') THEN
        CREATE TRIGGER update_orders_modtime BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_deliveries_modtime') THEN
        CREATE TRIGGER update_deliveries_modtime BEFORE UPDATE ON deliveries FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_kitchen_orders_modtime') THEN
        CREATE TRIGGER update_kitchen_orders_modtime BEFORE UPDATE ON kitchen_orders FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assistant_calls_modtime') THEN
        CREATE TRIGGER update_assistant_calls_modtime BEFORE UPDATE ON assistant_calls FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
    END IF;
END $$;


-- ============================================
-- SEED DATA
-- ============================================

INSERT INTO employees (id, supabase_user_id, fullname, username, email, role) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', '11111111-1111-1111-1111-111111111111', 'Maria Santos', 'cashier1', 'cashier@seafudz.ph', 'cashier'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22', '22222222-2222-2222-2222-222222222222', 'Chef Juan Dela Cruz', 'kitchen1', 'kitchen@seafudz.ph', 'kitchen'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', '33333333-3333-3333-3333-333333333333', 'Rider Alex Ramos', 'rider1', 'rider@seafudz.ph', 'rider'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', '44444444-4444-4444-4444-444444444444', 'Assistant Grace', 'assistant1', 'assistant@seafudz.ph', 'assistant'),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55', '55555555-5555-5555-5555-555555555555', 'Admin Manager', 'admin1', 'admin@seafudz.ph', 'admin')
ON CONFLICT (id) DO NOTHING;

INSERT INTO customers (id, supabase_user_id, fullname, email, phone, delivery_address) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', '66666666-6666-6666-6666-666666666666', 'Juan Tamad', 'customer1@gmail.com', '09171234567', '123 Mabini St, Sampaloc, Manila'),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', '77777777-7777-7777-7777-777777777777', 'Ana Reyes', 'ana.reyes@yahoo.com', '09189876543', '45 Quezon Ave, Quezon City')
ON CONFLICT (id) DO NOTHING;

INSERT INTO categories (id, name, description) VALUES
(1, 'Seafood Mixes', 'Signature Seafood Bilaos, Trays, Tubs, and Ala Carte Mixes'),
(2, 'Shrimp Specials', 'Fresh Shrimp Ala Carte, Bowls, and Family Trays'),
(3, 'Crabs & Shellfish', 'Fresh Crabs, Mud Crabs, and Specialty Shellfish Dishes'),
(4, 'Beverages & Shakes', 'Refreshing Sodas, Natural Shakes, Coffee, and Pitchers'),
(5, 'Value Meals & Add-ons', 'Rice Bowls, Siomai, Pastil, Desserts, and Extra Sides')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

INSERT INTO products (id, category_id, name, description, price, image, is_available, preparation_time_mins) VALUES
-- Mixed Seafoods
('item-001', 1, 'Mixed Seafoods Alacarte', 'Signature mixed seafoods platter.', 99.00, '/src/assets/menu/Mixedseafoods_Mixed Seafoods Alacarte_99 pesos.JPG', true, 15),
('item-002', 1, 'Mixed Seafoods Alacarte Tub', 'Signature mixed seafoods served in a tub.', 189.00, '/src/assets/menu/Mixedseafoods_Mixed Seafoods Alacarte_Tub_189 pesos.JPG', true, 15),
('item-003', 1, 'Mixed Seafoods Alacarte Bowl', 'Signature mixed seafoods serving bowl.', 699.00, '/src/assets/menu/Mixedseafoods_Mixed Seafoods Alacarte_Bowl_699 pesos.JPG', true, 20),
('item-004', 1, 'Mixed Seafoods Alacarte Tray', 'Signature mixed seafoods feast tray.', 1199.00, '/src/assets/menu/Mixedseafoods_Mixed Seafoods Alacarte_Tray_1199 pesos.png', true, 25),
-- Shrimp Specials
('item-005', 2, 'All Shrimp Alacarte', 'Freshly prepared all-shrimp dish.', 199.00, '/src/assets/menu/ALL SHRIMP_Alacarte_199 pesos.JPG', true, 15),
('item-006', 2, 'All Shrimp Bowl', 'Generous all-shrimp bowl platter.', 699.00, '/src/assets/menu/ALL SHRIMP_Bowl_699 pesos.JPG', true, 20),
('item-007', 2, 'All Shrimp Tray', 'Family-style all-shrimp tray.', 1099.00, '/src/assets/menu/ALL SHRIMP_Tray_1099 pesos.JPG', true, 25),
-- Value Meals & Fried Rice
('item-008', 5, 'Chao Fan', 'Flavorful fried rice meal.', 35.00, '/src/assets/menu/chao_fan_VALUE MEALS_35 pesos.JPG', true, 10),
('item-009', 5, 'Chicken Pastil', 'Traditional chicken pastil over rice.', 35.00, '/src/assets/menu/Chicken-Pastil_VALUE MEALS_35 pesos.JPG', true, 10),
('item-010', 5, 'Fried Noodles', 'Savory stir-fried noodles.', 35.00, '/src/assets/menu/Fried_Noodles_VALUE MEALS_35 pesos.JPG', true, 10),
-- Siomai
('item-011', 5, 'Pork Siomai', 'Steamed pork siomai per piece.', 5.00, '/src/assets/menu/pork_siomai_SIOMAI_5 pesos.JPG', true, 5),
('item-012', 5, 'Beef Siomai', 'Steamed beef siomai per piece.', 5.00, '/src/assets/menu/beef_siomai_SIOMAI_5 pesos.JPG', true, 5),
('item-013', 5, 'Chicken Siomai', 'Steamed chicken siomai per piece.', 5.00, '/src/assets/menu/chicken_siomai_SIOMAI_5 pesos.JPG', true, 5),
('item-014', 5, 'Sharksfin Siomai', 'Steamed sharksfin siomai per piece.', 5.00, '/src/assets/menu/sharksfin_siomai_SIOMAI_5 pesos.JPG', true, 5),
('item-015', 5, 'Japanese Siomai', 'Nori-wrapped Japanese siomai per piece.', 6.00, '/src/assets/menu/japanese_siomai_SIOMAI_6 pesos.JPG', true, 5),
-- Drinks
('item-016', 4, 'Mineral Water 500ml', 'Bottled drinking water.', 15.00, '/src/assets/menu/Mineral Wate_500ml_DRINKS_15 pesos.JPG', true, 2),
('item-017', 4, 'Coke Mismo 250ml', 'Chilled Coke 250ml.', 25.00, '/src/assets/menu/cokemismo_250ml_DRINKS_25 pesos.JPG', true, 2),
('item-018', 4, 'Sprite Mismo 250ml', 'Chilled Sprite 250ml.', 25.00, '/src/assets/menu/spritemismo_250ml_DRINKS_25 pesos.JPG', true, 2),
('item-019', 4, 'Royal Mismo 250ml', 'Chilled Royal 250ml.', 25.00, '/src/assets/menu/royalmismo_250ml_DRINKS_25 pesos.JPG', true, 2),
('item-020', 4, 'Black Coffee', 'Hot black coffee.', 30.00, '/src/assets/menu/blackcoffee_Black Coffee_30 pesos.JPG', true, 5),
('item-021', 4, 'Coke 1.5L', 'Coke 1.5 Liters bottle.', 110.00, '/src/assets/menu/coke_1.5liters_DRINKS_110 pesos.JPG', true, 2),
('item-022', 4, 'Sprite 1.5L', 'Sprite 1.5 Liters bottle.', 100.00, '/src/assets/menu/sprite_1.5_DRINKS_100 pesos.JPG', true, 2),
('item-023', 4, 'Royal 1.5L', 'Royal 1.5 Liters bottle.', 100.00, '/src/assets/menu/royal_1.5_DRINKS_100 pesos.JPG', true, 2),
-- Shakes & Lemonade
('item-024', 4, 'Snakes Small', 'Specialty beverage (Small).', 40.00, '/src/assets/menu/snakes_small_SHAKE&LEMONADE_40 peso.JPG', true, 5),
('item-025', 4, 'Lemonade Small', 'Fresh lemonade juice (Small).', 40.00, '/src/assets/menu/Lemonade_small_SHAKE&LEMONADE_40 pesos.JPG', true, 5),
('item-026', 4, 'Lemonade Big', 'Fresh lemonade juice (Big).', 50.00, '/src/assets/menu/Lemonade_big_SHAKE&LEMONADE_50 pesos.JPG', true, 5),
('item-027', 4, 'Cucumber Lemonade Small', 'Cucumber lemonade blend (Small).', 40.00, '/src/assets/menu/cucumberlemonade_small_SHAKE&LEMONADE_40 pesos.JPG', true, 5),
('item-028', 4, 'Cucumber Lemonade Big', 'Cucumber lemonade blend (Big).', 50.00, '/src/assets/menu/cucumberLemonade big_SHAKE&LEMONADE_50 pesos.JPG', true, 5),
-- Desserts
('item-029', 5, 'Banana Con Yelo', 'Sweetened banana with shaved ice and milk.', 50.00, '/src/assets/menu/bananaconyelo_DESSERTS_50 pesos.JPG', true, 8),
('item-030', 5, 'Ice Cream', 'Chilled sweet ice cream.', 50.00, '/src/assets/menu/icecream_DESSERTS_50 pesos.JPG', true, 3),
('item-031', 5, 'Mango Pudding', 'Creamy mango pudding dessert.', 50.00, '/src/assets/menu/Mango Pudding_DESSERTS_50 pesos.JPG', true, 3),
-- Seafood Add-ons & Sides
('item-032', 5, 'One Cup Rice', 'Extra steamed white rice.', 20.00, '/src/assets/menu/Rice_one cup_SEAFOODS ADD ONS_20 pesos.JPG', true, 3),
('item-033', 5, 'Corn Add-on', 'Sweet corn cob portion.', 20.00, '/src/assets/menu/Corn_SEAFOODS ADD ONS_20 pesos.JPEG', true, 5),
('item-034', 5, 'Iced Tea Glass', 'Iced tea add-on per glass.', 20.00, '/src/assets/menu/icetea_ADD ONS_DRINKS_20 pesos.JPG', true, 2),
('item-035', 5, 'Shrimp Regular Add-on', 'Regular shrimp add-on portion.', 20.00, '/src/assets/menu/Shrimp Regular_SEAFOODS ADD ONS_20 pesos.JPG', true, 10),
('item-036', 5, 'Shrimp Jumbo Add-on', 'Jumbo shrimp add-on portion.', 30.00, '/src/assets/menu/Shrimp Jumbo_SEAFOODS ADD ONS 30 pesos.JPG', true, 10),
('item-037', 5, 'Tahong Add-on', 'Fresh mussels add-on portion.', 30.00, '/src/assets/menu/Tahong_SEAFOODS ADD ONS_30 pesos.JPG', true, 10),
('item-038', 5, 'Special Sauce', 'Extra house special sauce.', 30.00, '/src/assets/menu/specailsauce_SEAFOODS ADD ONS_30 pesos.JPG', true, 2),
('item-039', 5, 'Sausage Add-on', 'Sausage portion add-on.', 50.00, '/src/assets/menu/sausage_SEAFOODS ADD ONS_50 pesos.JPEG', true, 8),
('item-040', 5, 'Iced Tea Pitcher', 'Full iced tea pitcher.', 100.00, '/src/assets/menu/icetea_SEAFOODS ADD ONS_100 pesos.JPG', true, 3)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  price = EXCLUDED.price,
  image = EXCLUDED.image,
  category_id = EXCLUDED.category_id,
  preparation_time_mins = EXCLUDED.preparation_time_mins;

INSERT INTO orders (id, customer_id, cashier_id, assistant_id, order_type, status, subtotal, tax, delivery_fee, total, notes, created_at) VALUES
('ORD-1001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'ON_SITE', 'COMPLETED', 2400.00, 288.00, 0.00, 2688.00, 'Dine-in Order', NOW() - INTERVAL '1 hour'),
('ORD-1002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, 'ONLINE', 'IN_PROCESS', 1850.00, 222.00, 100.00, 2172.00, 'Deliver ASAP', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes) VALUES
(1, 'ORD-1001', 'item-001', 'Mixed Seafoods Alacarte', 99.00, 1, 99.00, 'Extra sauce'),
(2, 'ORD-1002', 'item-005', 'All Shrimp Alacarte', 199.00, 1, 199.00, 'Medium spicy')
ON CONFLICT (id) DO NOTHING;

INSERT INTO payments (id, order_id, payment_method, amount, status, reference_number, paid_at) VALUES
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c11', 'ORD-1001', 'GCASH', 2688.00, 'PAID', 'GCASH-998877', NOW() - INTERVAL '1 hour'),
('c0eebc99-9c0b-4ef8-bb6d-6bb9bd380c22', 'ORD-1002', 'ONLINE', 2172.00, 'PAID', 'PAY-554433', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO deliveries (id, order_id, rider_id, delivery_address, status, assigned_at, notes) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380d11', 'ORD-1002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33', '45 Quezon Ave, Quezon City', 'ASSIGNED', NOW() - INTERVAL '20 minutes', 'Ring doorbell')
ON CONFLICT (id) DO NOTHING;

INSERT INTO kitchen_orders (id, order_id, status, started_at, completed_at) VALUES
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e11', 'ORD-1001', 'COMPLETED', NOW() - INTERVAL '50 minutes', NOW() - INTERVAL '30 minutes'),
('e0eebc99-9c0b-4ef8-bb6d-6bb9bd380e22', 'ORD-1002', 'IN_PROCESS', NOW() - INTERVAL '25 minutes', NULL)
ON CONFLICT (id) DO NOTHING;

INSERT INTO assistant_calls (id, assistant_id, type, status, created_at) VALUES
('CALL-001', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Water Refill', 'Pending', NOW() - INTERVAL '5 minutes'),
('CALL-002', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Request Bill', 'Pending', NOW() - INTERVAL '2 minutes')
ON CONFLICT (id) DO NOTHING;
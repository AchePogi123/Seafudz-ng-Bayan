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
DROP TABLE IF EXISTS tables CASCADE;
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
-- 5. TABLES (RESTING/FLOOR SEATING LAYOUT)
-- ============================================

CREATE TABLE tables (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    seats INT NOT NULL DEFAULT 4,
    section VARCHAR(100) NOT NULL DEFAULT 'Main Dining',
    status VARCHAR(50) NOT NULL DEFAULT 'Available'
        CHECK (status IN ('Available', 'Occupied', 'Reserved', 'Cleaning')),
    shape VARCHAR(50) DEFAULT 'square',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================
-- 6. ORDERS
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
    table_id VARCHAR(100)
        REFERENCES tables(id)
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
-- 7. ORDER ITEMS
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
-- 8. PAYMENTS
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
-- 9. DELIVERIES
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
-- 10. KITCHEN ORDERS
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
-- 11. ASSISTANT CALLS
-- ============================================

CREATE TABLE assistant_calls (
    id VARCHAR(100) PRIMARY KEY,
    table_id VARCHAR(100) REFERENCES tables(id) ON DELETE CASCADE,
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
CREATE INDEX idx_orders_table ON orders(table_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_type ON orders(order_type);
CREATE INDEX idx_order_items_order ON order_items(order_id);
CREATE INDEX idx_order_items_product ON order_items(product_id);
CREATE INDEX idx_payments_order ON payments(order_id);
CREATE INDEX idx_deliveries_rider ON deliveries(rider_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_kitchen_orders_status ON kitchen_orders(status);
CREATE INDEX idx_assistant_calls_table ON assistant_calls(table_id);


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
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tables_modtime') THEN
        CREATE TRIGGER update_tables_modtime BEFORE UPDATE ON tables FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
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
(1, 'Seafood', 'Seafood Mixes, Paellas, and Bilao Feasts'),
(2, 'Shrimp', 'Freshly caught Tiger Prawns and Buttered Shrimp'),
(3, 'Crab', 'Mud Crabs and Soft-Shell Crabs'),
(4, 'Drinks', 'Refreshing Juices, Shakes, and Soft Drinks'),
(5, 'Sides', 'Rice Bowls, Sauces, and Dips')
ON CONFLICT (id) DO NOTHING;

INSERT INTO products (id, category_id, name, description, price, image, is_available, preparation_time_mins) VALUES
('item-001', 1, 'Seafood Bilao Feast', 'Generous combination of grilled prawns, crabs, clams, and squid over garlic butter rice.', 2400.00, 'https://images.unsplash.com/photo-1559737671-6386bb0b5f14?w=500&auto=format&fit=crop&q=60', true, 20),
('item-002', 1, 'Seafood Cajun Boil', 'Cajun-spiced seafood bucket with corn on the cob, potatoes, sausage, and mixed shellfish.', 1850.00, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=60', true, 18),
('item-003', 1, 'Classic Seafood Paella', 'Rich Spanish rice dish loaded with mussels, shrimp, squid rings, and saffron seasoning.', 1650.00, 'https://images.unsplash.com/photo-1534080564583-6be75777b70a?w=500&auto=format&fit=crop&q=60', true, 25),
('item-004', 1, 'Grilled Seafood Platter', 'Assorted charcoal-grilled pompano, prawns, stuffed squid, and buttered clams.', 2100.00, 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=500&auto=format&fit=crop&q=60', true, 20),
('item-005', 1, 'Crispy Seafood Basket', 'Deep-fried golden fish fillet, calamari rings, and butterfly shrimp served with tartar dip.', 980.00, 'https://images.unsplash.com/photo-1579712267685-42da233cb09b?w=500&auto=format&fit=crop&q=60', true, 15),
('item-006', 2, 'Garlic Butter Prawns', 'Sauteed jumbo prawns drenched in garlic butter sauce topped with toasted garlic chips.', 1250.00, 'https://images.unsplash.com/photo-1565680018434-b513d5e5fd47?w=500&auto=format&fit=crop&q=60', true, 15),
('item-007', 3, 'Sweet & Chili Crab Bucket', 'Fresh mud crabs simmered in sweet & spicy garlic tomato glaze.', 1950.00, 'https://images.unsplash.com/photo-1559737671-6386bb0b5f14?w=500&auto=format&fit=crop&q=60', true, 25),
('item-008', 4, 'Fresh Calamansi Juice Pitcher', 'Chilled fresh local calamansi juice infused with honey.', 280.00, 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?w=500&auto=format&fit=crop&q=60', true, 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO tables (id, name, seats, section, status, shape) VALUES
('Table 1', 'Table 1', 4, 'Main Dining', 'Available', 'square'),
('Table 2', 'Table 2', 2, 'Main Dining', 'Available', 'round'),
('Table 3', 'Table 3', 6, 'Main Dining', 'Available', 'rectangle'),
('Table 4', 'Table 4', 4, 'Main Dining', 'Available', 'square'),
('Table 5', 'Table 5', 8, 'VIP Family Alcove', 'Available', 'rectangle'),
('Table 6', 'Table 6', 4, 'VIP Family Alcove', 'Available', 'round'),
('Table 7', 'Table 7', 2, 'Alfresco Patio', 'Available', 'round'),
('Table 8', 'Table 8', 4, 'Alfresco Patio', 'Available', 'square'),
('Table 9', 'Table 9', 6, 'Alfresco Patio', 'Available', 'rectangle'),
('Table 10', 'Table 10', 4, 'Main Dining', 'Available', 'square'),
('Table 11', 'Table 11', 2, 'Main Dining', 'Available', 'round'),
('Table 12', 'Table 12', 8, 'VIP Bilao Party', 'Available', 'rectangle')
ON CONFLICT (id) DO NOTHING;

INSERT INTO orders (id, customer_id, cashier_id, assistant_id, table_id, order_type, status, subtotal, tax, delivery_fee, total, notes, created_at) VALUES
('ORD-1001', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Table 1', 'ON_SITE', 'COMPLETED', 2400.00, 288.00, 0.00, 2688.00, 'Dine-in Table 1', NOW() - INTERVAL '1 hour'),
('ORD-1002', 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b22', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', NULL, NULL, 'ONLINE', 'IN_PROCESS', 1850.00, 222.00, 100.00, 2172.00, 'Deliver ASAP', NOW() - INTERVAL '30 minutes')
ON CONFLICT (id) DO NOTHING;

INSERT INTO order_items (id, order_id, product_id, product_name_snapshot, unit_price, quantity, subtotal, notes) VALUES
(1, 'ORD-1001', 'item-001', 'Seafood Bilao Feast', 2400.00, 1, 2400.00, 'Garlic rice bed'),
(2, 'ORD-1002', 'item-002', 'Seafood Cajun Boil', 1850.00, 1, 1850.00, 'Medium spicy')
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

INSERT INTO assistant_calls (id, table_id, assistant_id, type, status, created_at) VALUES
('CALL-001', 'Table 3', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Water Refill', 'Pending', NOW() - INTERVAL '5 minutes'),
('CALL-002', 'Table 7', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44', 'Request Bill', 'Pending', NOW() - INTERVAL '2 minutes')
ON CONFLICT (id) DO NOTHING;

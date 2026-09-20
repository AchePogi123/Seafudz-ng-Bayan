-- ============================================
-- MIGRATION 002: SEED DUMMY USERS FOR SEAFUDZ NG BAYAN
-- Adds additional employee staff profiles and customer accounts
-- ============================================

INSERT INTO employees (id, supabase_user_id, fullname, username, email, role, is_active) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a66', '88888888-8888-8888-8888-888888888888', 'Maria Santos', 'cashier2', 'maria.cashier@seafudz.ph', 'cashier', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a77', '99999999-9999-9999-9999-999999999999', 'Chef Ben', 'kitchen2', 'chef.ben@seafudz.ph', 'kitchen', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a88', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dan Cruz', 'rider2', 'dan.rider@seafudz.ph', 'rider', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Joy Flores', 'assistant2', 'joy.floor@seafudz.ph', 'assistant', true),
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380aaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Super Admin Chief', 'admin2', 'admin2@seafudz.ph', 'admin', true)
ON CONFLICT (email) DO UPDATE SET
  fullname = EXCLUDED.fullname,
  username = EXCLUDED.username,
  role = EXCLUDED.role;

INSERT INTO customers (id, supabase_user_id, fullname, email, phone, delivery_address, is_active) VALUES
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b33', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Pedro Penduko', 'pedro.penduko@gmail.com', '09191112222', '88 Roxas Blvd, Pasay City', true),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b44', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Clara Dizon', 'clara.dizon@gmail.com', '09203334444', '123 BGC High Street, Taguig City', true),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b55', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Mark Bautista', 'mark.bautista@yahoo.com', '09225556666', '77 Katipunan Ave, Quezon City', true),
('b0eebc99-9c0b-4ef8-bb6d-6bb9bd380b66', '11112222-3333-4444-5555-666677778888', 'Lisa Manoban', 'lisa.manoban@gmail.com', '09178889999', 'VIP Tower, Eastwood City', true)
ON CONFLICT (email) DO UPDATE SET
  fullname = EXCLUDED.fullname,
  phone = EXCLUDED.phone,
  delivery_address = EXCLUDED.delivery_address;

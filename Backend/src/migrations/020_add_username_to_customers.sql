-- Migration 020: Ensure username, avatar, and password_hash exist on customers and employees
ALTER TABLE customers ADD COLUMN IF NOT EXISTS username VARCHAR(100);
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Create lowercase username index on customers
CREATE INDEX IF NOT EXISTS customers_username_lower_idx ON customers (LOWER(username));

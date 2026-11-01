-- Add avatar column to customers and employees
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar TEXT;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS avatar TEXT;

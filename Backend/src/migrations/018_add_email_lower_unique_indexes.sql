-- Migration 018: Add case-insensitive unique indexes on email for customers and employees

-- Ensure customers cannot register multiple accounts with the same email in different cases
CREATE UNIQUE INDEX IF NOT EXISTS customers_email_lower_unique 
ON customers (LOWER(email));

-- Ensure employees cannot have duplicate emails in different cases
CREATE UNIQUE INDEX IF NOT EXISTS employees_email_lower_unique 
ON employees (LOWER(email));

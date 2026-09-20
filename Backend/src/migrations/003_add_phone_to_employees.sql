-- Migration 003: Add phone column to employees table
ALTER TABLE employees ADD COLUMN IF NOT EXISTS phone VARCHAR(50);

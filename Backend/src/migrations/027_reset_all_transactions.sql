-- Migration 027: Safe Production Reset of Order Transactions
-- Wipes transactional tables while strictly preserving employees, customers, products, categories, tables, and migrations

TRUNCATE TABLE 
  order_items, 
  payments, 
  refunds, 
  deliveries, 
  kitchen_orders, 
  assistant_calls, 
  orders 
RESTART IDENTITY CASCADE;

-- Restore full product servings availability
UPDATE products SET remaining_servings = NULL;

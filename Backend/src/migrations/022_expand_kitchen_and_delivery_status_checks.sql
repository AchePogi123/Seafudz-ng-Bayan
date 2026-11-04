-- ============================================
-- MIGRATION: 022_expand_kitchen_and_delivery_status_checks.sql
-- Description: Expands kitchen_orders_status_check and deliveries_status_check
--   to support all active ecosystem statuses without database constraint exceptions.
-- ============================================

-- 1. Expand kitchen_orders status check to allow PREPARING, COOKING, and READY
ALTER TABLE kitchen_orders DROP CONSTRAINT IF EXISTS kitchen_orders_status_check;
ALTER TABLE kitchen_orders ADD CONSTRAINT kitchen_orders_status_check
    CHECK (status IN (
        'PENDING',
        'IN_PROCESS',
        'PREPARING',
        'COOKING',
        'READY',
        'COMPLETED',
        'CANCELLED',
        'OUT_OF_STOCK'
    ));

-- 2. Expand deliveries status check to allow IN_TRANSIT and OUT_FOR_DELIVERY
ALTER TABLE deliveries DROP CONSTRAINT IF EXISTS deliveries_status_check;
ALTER TABLE deliveries ADD CONSTRAINT deliveries_status_check
    CHECK (status IN (
        'PENDING',
        'ASSIGNED',
        'PICKED_UP',
        'IN_TRANSIT',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED'
    ));


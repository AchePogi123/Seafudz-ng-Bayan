-- Supplier lead time in hours
--
-- lead_time_days was a whole number with a floor of 1, so a vendor that delivers
-- in 10 hours could only be recorded as "1 day". Hours is the finer unit and
-- still expresses days exactly (2 days = 48), so it becomes the stored one.

ALTER TABLE inventory_suppliers ADD COLUMN IF NOT EXISTS lead_time_hours INT;

-- Carry every existing vendor over at the same real duration
UPDATE inventory_suppliers
   SET lead_time_hours = GREATEST(1, COALESCE(lead_time_days, 1) * 24)
 WHERE lead_time_hours IS NULL;

ALTER TABLE inventory_suppliers ALTER COLUMN lead_time_hours SET DEFAULT 24;
ALTER TABLE inventory_suppliers ALTER COLUMN lead_time_hours SET NOT NULL;

ALTER TABLE inventory_suppliers DROP COLUMN IF EXISTS lead_time_days;

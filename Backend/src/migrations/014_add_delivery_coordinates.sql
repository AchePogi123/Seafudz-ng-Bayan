ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_latitude DOUBLE PRECISION
    CHECK (delivery_latitude BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS delivery_longitude DOUBLE PRECISION
    CHECK (delivery_longitude BETWEEN -180 AND 180);

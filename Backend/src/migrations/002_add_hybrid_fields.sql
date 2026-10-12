-- ============================================
-- 2. ADD HYBRID PAYMENT FIELDS TO payments
-- ============================================

-- Add cash_amount and gcash_amount columns to track split payments
ALTER TABLE payments
  ADD COLUMN cash_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN gcash_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN reference_number VARCHAR(255),
  ADD CONSTRAINT positive_cash_amount CHECK (cash_amount >= 0),
  ADD CONSTRAINT positive_gcash_amount CHECK (gcash_amount >= 0);

-- Ensure reference_number is provided for GCash and Hybrid payments via a trigger
CREATE OR REPLACE FUNCTION validate_payment_reference() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.payment_method = 'GCASH' OR NEW.payment_method = 'HYBRID') AND (NEW.reference_number IS NULL OR trim(NEW.reference_number) = '') THEN
    RAISE EXCEPTION 'Reference number is required for GCash or Hybrid payments';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_validate_payment_reference ON payments;
CREATE TRIGGER trg_validate_payment_reference
BEFORE INSERT OR UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION validate_payment_reference();

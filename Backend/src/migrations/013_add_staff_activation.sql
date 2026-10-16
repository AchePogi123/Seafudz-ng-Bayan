ALTER TABLE employees
ADD COLUMN IF NOT EXISTS activation_status VARCHAR(20) NOT NULL DEFAULT 'active';

ALTER TABLE employees
ADD COLUMN IF NOT EXISTS activation_token_hash TEXT,
ADD COLUMN IF NOT EXISTS activation_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ;

UPDATE employees
SET activation_status = CASE WHEN is_active THEN 'active' ELSE 'inactive' END
WHERE activation_status = 'active' AND NOT is_active;

DO $$
BEGIN
  ALTER TABLE employees
    ADD CONSTRAINT employees_activation_status_check
    CHECK (activation_status IN ('pending', 'active', 'inactive'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS employees_activation_token_hash_unique
ON employees (activation_token_hash)
WHERE activation_token_hash IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM employees
    GROUP BY LOWER(username)
    HAVING COUNT(*) > 1
  ) THEN
    CREATE INDEX IF NOT EXISTS employees_username_lower_idx
    ON employees (LOWER(username));
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS employees_username_lower_unique
    ON employees (LOWER(username));
  END IF;
END $$;

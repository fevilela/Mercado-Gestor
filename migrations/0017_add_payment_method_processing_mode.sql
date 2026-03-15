ALTER TABLE payment_methods
ADD COLUMN IF NOT EXISTS processing_mode text DEFAULT 'manual';

UPDATE payment_methods
SET processing_mode = CASE
  WHEN tef_method IS NOT NULL AND trim(tef_method) <> '' THEN 'tef'
  ELSE 'manual'
END
WHERE processing_mode IS NULL
   OR trim(processing_mode) = '';

ALTER TABLE payment_methods
ALTER COLUMN processing_mode SET DEFAULT 'manual';

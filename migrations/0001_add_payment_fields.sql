ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS "payment_nsu" text,
  ADD COLUMN IF NOT EXISTS "payment_brand" text,
  ADD COLUMN IF NOT EXISTS "payment_provider" text,
  ADD COLUMN IF NOT EXISTS "payment_authorization" text,
  ADD COLUMN IF NOT EXISTS "payment_reference" text;

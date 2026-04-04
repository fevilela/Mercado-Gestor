ALTER TABLE "product_ingredients"
ADD COLUMN IF NOT EXISTS "consumption_unit" text NOT NULL DEFAULT 'kg';

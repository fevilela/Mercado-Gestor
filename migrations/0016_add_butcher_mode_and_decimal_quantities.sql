ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS butcher_enabled boolean DEFAULT false;

ALTER TABLE products
ADD COLUMN IF NOT EXISTS operational_config jsonb;

ALTER TABLE products
ALTER COLUMN stock TYPE numeric(12,3) USING stock::numeric(12,3),
ALTER COLUMN stock SET DEFAULT 0,
ALTER COLUMN min_stock TYPE numeric(12,3) USING min_stock::numeric(12,3),
ALTER COLUMN min_stock SET DEFAULT 10,
ALTER COLUMN max_stock TYPE numeric(12,3) USING max_stock::numeric(12,3),
ALTER COLUMN max_stock SET DEFAULT 100;

ALTER TABLE sale_items
ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric(12,3);

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS sale_unit text DEFAULT 'UN',
ADD COLUMN IF NOT EXISTS stock_quantity numeric(12,3),
ADD COLUMN IF NOT EXISTS stock_unit text;

ALTER TABLE inventory_movements
ALTER COLUMN quantity TYPE numeric(12,3) USING quantity::numeric(12,3);

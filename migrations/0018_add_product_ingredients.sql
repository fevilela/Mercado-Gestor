ALTER TABLE products
  ADD COLUMN IF NOT EXISTS is_ingredient boolean DEFAULT false;

CREATE TABLE IF NOT EXISTS product_ingredients (
  id serial PRIMARY KEY,
  product_id integer NOT NULL,
  ingredient_product_id integer NOT NULL,
  quantity numeric(12, 3) NOT NULL DEFAULT 1,
  sort_order integer DEFAULT 0,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS product_ingredients_product_id_idx
  ON product_ingredients (product_id);

CREATE INDEX IF NOT EXISTS product_ingredients_ingredient_product_id_idx
  ON product_ingredients (ingredient_product_id);

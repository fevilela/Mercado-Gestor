-- Phase 0: Multiempresa + Unidades
-- Estruturas base para suportar:
-- 1) Multi-CNPJ por usuario
-- 2) Varias unidades por CNPJ
-- 3) Estoque por unidade

CREATE TABLE IF NOT EXISTS "business_units" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL,
  "code" text NOT NULL,
  "name" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "business_units_company_code_idx"
  ON "business_units" ("company_id", "code");

CREATE UNIQUE INDEX IF NOT EXISTS "business_units_company_name_idx"
  ON "business_units" ("company_id", "name");

CREATE TABLE IF NOT EXISTS "user_company_accesses" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "company_id" integer NOT NULL,
  "is_default" boolean DEFAULT false,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_company_accesses_user_company_idx"
  ON "user_company_accesses" ("user_id", "company_id");

CREATE TABLE IF NOT EXISTS "user_unit_accesses" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" varchar NOT NULL,
  "unit_id" integer NOT NULL,
  "role_id" integer NOT NULL,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_unit_accesses_user_unit_idx"
  ON "user_unit_accesses" ("user_id", "unit_id");

CREATE TABLE IF NOT EXISTS "product_stocks" (
  "id" serial PRIMARY KEY NOT NULL,
  "company_id" integer NOT NULL,
  "unit_id" integer NOT NULL,
  "product_id" integer NOT NULL,
  "variation_id" integer,
  "stock" integer NOT NULL DEFAULT 0,
  "min_stock" integer DEFAULT 10,
  "max_stock" integer DEFAULT 100,
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "product_stocks_unit_product_variation_idx"
  ON "product_stocks" ("unit_id", "product_id", "variation_id");

ALTER TABLE "sales"
  ADD COLUMN IF NOT EXISTS "unit_id" integer;

ALTER TABLE "inventory_movements"
  ADD COLUMN IF NOT EXISTS "unit_id" integer;

ALTER TABLE "pos_terminals"
  ADD COLUMN IF NOT EXISTS "unit_id" integer;

ALTER TABLE "payment_machines"
  ADD COLUMN IF NOT EXISTS "unit_id" integer;

ALTER TABLE "cash_registers"
  ADD COLUMN IF NOT EXISTS "unit_id" integer;

ALTER TABLE "cash_movements"
  ADD COLUMN IF NOT EXISTS "unit_id" integer;

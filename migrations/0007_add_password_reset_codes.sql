CREATE TABLE IF NOT EXISTS "password_reset_codes" (
  "id" serial PRIMARY KEY,
  "company_id" integer NOT NULL,
  "user_id" varchar NOT NULL,
  "email" text NOT NULL,
  "cnpj" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_password_reset_codes_user_email"
  ON "password_reset_codes" ("user_id", "email");

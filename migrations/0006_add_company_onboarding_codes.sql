CREATE TABLE IF NOT EXISTS "company_onboarding_codes" (
  "id" serial PRIMARY KEY,
  "company_id" integer NOT NULL,
  "user_id" varchar NOT NULL,
  "email" text NOT NULL,
  "code_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_company_onboarding_codes_user_email"
  ON "company_onboarding_codes" ("user_id", "email");

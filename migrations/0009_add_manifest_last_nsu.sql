ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS manifest_last_nsu text;

ALTER TABLE "company_settings"
ADD COLUMN IF NOT EXISTS "receipt_header_text" text,
ADD COLUMN IF NOT EXISTS "receipt_footer_text" text,
ADD COLUMN IF NOT EXISTS "receipt_show_seller" boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS "nfce_print_layout" jsonb;

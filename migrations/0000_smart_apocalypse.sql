CREATE TABLE "cash_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"cash_register_id" integer NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "cash_registers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"terminal_id" integer,
	"user_id" varchar NOT NULL,
	"user_name" text NOT NULL,
	"opening_amount" numeric(10, 2) NOT NULL,
	"closing_amount" numeric(10, 2),
	"expected_amount" numeric(10, 2),
	"difference" numeric(10, 2),
	"status" text DEFAULT 'open' NOT NULL,
	"notes" text,
	"opened_at" timestamp DEFAULT now(),
	"closed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" serial PRIMARY KEY NOT NULL,
	"cnpj" text NOT NULL,
	"ie" text,
	"razao_social" text NOT NULL,
	"nome_fantasia" text,
	"email" text,
	"phone" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "companies_cnpj_unique" UNIQUE("cnpj")
);
--> statement-breakpoint
CREATE TABLE "company_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"cnpj" text,
	"ie" text,
	"razao_social" text,
	"nome_fantasia" text,
	"fiscal_enabled" boolean DEFAULT false,
	"csc_token" text,
	"csc_id" text,
	"stone_code" text,
	"stone_enabled" boolean DEFAULT false,
	"mp_access_token" text,
	"mp_terminal_id" text,
	"mp_enabled" boolean DEFAULT false,
	"printer_enabled" boolean DEFAULT false,
	"printer_model" text,
	"printer_port" text,
	"printer_baud_rate" integer DEFAULT 9600,
	"printer_columns" integer DEFAULT 48,
	"printer_cut_command" boolean DEFAULT true,
	"printer_beep_on_sale" boolean DEFAULT true,
	"barcode_scanner_enabled" boolean DEFAULT true,
	"barcode_scanner_auto_add" boolean DEFAULT true,
	"barcode_scanner_beep" boolean DEFAULT true,
	"cash_register_required" boolean DEFAULT true,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"cpf_cnpj" text,
	"type" text DEFAULT 'Regular' NOT NULL,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"credit_limit" numeric(10, 2) DEFAULT '0',
	"loyalty_points" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "inventory_movements" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"product_id" integer NOT NULL,
	"variation_id" integer,
	"type" text NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"reference_id" integer,
	"reference_type" text,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "kit_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"kit_product_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"user_id" varchar,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"reference_id" integer,
	"reference_type" text,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payables" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"description" text NOT NULL,
	"supplier_id" integer,
	"supplier_name" text,
	"category" text DEFAULT 'Outros' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"paid_date" timestamp,
	"status" text DEFAULT 'Pendente' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" text NOT NULL,
	"action" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE "pos_terminals" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"code" text,
	"description" text,
	"is_autonomous" boolean DEFAULT false,
	"requires_sangria" boolean DEFAULT false,
	"requires_suprimento" boolean DEFAULT false,
	"requires_opening" boolean DEFAULT true,
	"requires_closing" boolean DEFAULT true,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"url" text NOT NULL,
	"is_primary" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "product_variations" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"attributes" jsonb,
	"extra_price" numeric(10, 2) DEFAULT '0',
	"stock" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"ean" text,
	"sku" text,
	"category" text NOT NULL,
	"unit" text DEFAULT 'UN' NOT NULL,
	"brand" text,
	"type" text,
	"ncm" text,
	"cest" text,
	"description" text,
	"main_image_url" text,
	"purchase_price" numeric(10, 2),
	"margin" numeric(5, 2),
	"price" numeric(10, 2) NOT NULL,
	"promo_price" numeric(10, 2),
	"promo_start" timestamp,
	"promo_end" timestamp,
	"stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 10,
	"max_stock" integer DEFAULT 100,
	"is_kit" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"supplier_id" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "receivables" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"description" text NOT NULL,
	"customer_id" integer,
	"customer_name" text,
	"sale_id" integer,
	"category" text DEFAULT 'Vendas' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"due_date" timestamp NOT NULL,
	"received_date" timestamp,
	"status" text DEFAULT 'Pendente' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"role_id" integer NOT NULL,
	"permission_id" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_system_role" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"sale_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"user_id" varchar,
	"customer_id" integer,
	"customer_name" text DEFAULT 'Consumidor Final' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"items_count" integer NOT NULL,
	"payment_method" text NOT NULL,
	"status" text DEFAULT 'Concluído' NOT NULL,
	"nfce_protocol" text,
	"nfce_status" text DEFAULT 'Pendente' NOT NULL,
	"nfce_key" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" serial PRIMARY KEY NOT NULL,
	"company_id" integer,
	"name" text NOT NULL,
	"contact" text,
	"phone" text,
	"email" text,
	"cnpj" text,
	"address" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"payment_terms" text,
	"lead_time" integer,
	"rating" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"is_active" boolean DEFAULT true,
	"last_login" timestamp,
	"created_at" timestamp DEFAULT now()
);

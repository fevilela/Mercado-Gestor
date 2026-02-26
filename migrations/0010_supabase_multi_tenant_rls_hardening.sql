-- Multi-tenant hardening for Supabase (single project / shared PostgreSQL)
-- Implements tenant isolation with RLS, company_id enforcement, indexes, and audit trail.

-- ---------------------------------------------------------------------------
-- 1) Ensure tenant key exists in child business tables that previously lacked it
-- ---------------------------------------------------------------------------

ALTER TABLE public.product_variations
  ADD COLUMN IF NOT EXISTS company_id integer;

ALTER TABLE public.product_media
  ADD COLUMN IF NOT EXISTS company_id integer;

ALTER TABLE public.kit_items
  ADD COLUMN IF NOT EXISTS company_id integer;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS company_id integer;

ALTER TABLE public.role_permissions
  ADD COLUMN IF NOT EXISTS company_id integer;

-- Backfill child tables from their parent rows
UPDATE public.product_variations pv
SET company_id = p.company_id
FROM public.products p
WHERE pv.product_id = p.id
  AND pv.company_id IS NULL;

UPDATE public.product_media pm
SET company_id = p.company_id
FROM public.products p
WHERE pm.product_id = p.id
  AND pm.company_id IS NULL;

UPDATE public.kit_items ki
SET company_id = p.company_id
FROM public.products p
WHERE ki.kit_product_id = p.id
  AND ki.company_id IS NULL;

UPDATE public.sale_items si
SET company_id = s.company_id
FROM public.sales s
WHERE si.sale_id = s.id
  AND si.company_id IS NULL;

UPDATE public.role_permissions rp
SET company_id = r.company_id
FROM public.roles r
WHERE rp.role_id = r.id
  AND rp.company_id IS NULL;

-- Validate backfill before making mandatory on the new columns
DO $$
DECLARE
  _missing int;
BEGIN
  SELECT count(*) INTO _missing FROM public.product_variations WHERE company_id IS NULL;
  IF _missing > 0 THEN
    RAISE EXCEPTION 'product_variations still has % rows without company_id', _missing;
  END IF;

  SELECT count(*) INTO _missing FROM public.product_media WHERE company_id IS NULL;
  IF _missing > 0 THEN
    RAISE EXCEPTION 'product_media still has % rows without company_id', _missing;
  END IF;

  SELECT count(*) INTO _missing FROM public.kit_items WHERE company_id IS NULL;
  IF _missing > 0 THEN
    RAISE EXCEPTION 'kit_items still has % rows without company_id', _missing;
  END IF;

  SELECT count(*) INTO _missing FROM public.sale_items WHERE company_id IS NULL;
  IF _missing > 0 THEN
    RAISE EXCEPTION 'sale_items still has % rows without company_id', _missing;
  END IF;

  SELECT count(*) INTO _missing FROM public.role_permissions WHERE company_id IS NULL;
  IF _missing > 0 THEN
    RAISE EXCEPTION 'role_permissions still has % rows without company_id', _missing;
  END IF;
END $$;

ALTER TABLE public.product_variations ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.product_media ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.kit_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.sale_items ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE public.role_permissions ALTER COLUMN company_id SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 2) Supabase tenant helper functions (JWT + auth.uid fallback)
-- ---------------------------------------------------------------------------

CREATE SCHEMA IF NOT EXISTS app;

CREATE OR REPLACE FUNCTION app.jwt_claims()
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;

CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _uid uuid;
  _claims jsonb;
  _sub text;
BEGIN
  _claims := app.jwt_claims();
  _sub := NULLIF(_claims ->> 'sub', '');
  IF _sub IS NOT NULL THEN
    RETURN _sub;
  END IF;

  BEGIN
    _uid := auth.uid();
  EXCEPTION WHEN undefined_function THEN
    _uid := NULL;
  END;

  RETURN _uid::text;
END;
$$;

CREATE OR REPLACE FUNCTION app.current_company_id()
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _claims jsonb;
  _company_id integer;
  _uid uuid;
BEGIN
  _claims := app.jwt_claims();

  BEGIN
    _company_id := NULLIF(_claims ->> 'company_id', '')::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    _company_id := NULL;
  END;
  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;

  BEGIN
    _company_id := NULLIF(_claims #>> '{app_metadata,company_id}', '')::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    _company_id := NULL;
  END;
  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;

  BEGIN
    _company_id := NULLIF(_claims #>> '{user_metadata,company_id}', '')::integer;
  EXCEPTION WHEN invalid_text_representation THEN
    _company_id := NULL;
  END;
  IF _company_id IS NOT NULL THEN
    RETURN _company_id;
  END IF;

  BEGIN
    _uid := auth.uid();
  EXCEPTION WHEN undefined_function THEN
    _uid := NULL;
  END;

  IF _uid IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT u.company_id
    INTO _company_id
  FROM public.users u
  WHERE u.id = _uid::text
  LIMIT 1;

  RETURN _company_id;
END;
$$;

CREATE OR REPLACE FUNCTION app.is_service_role()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE((app.jwt_claims() ->> 'role') = 'service_role', false)
$$;

GRANT USAGE ON SCHEMA app TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3) Enforce company_id for tenant tables (server-side, not frontend-dependent)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION app.enforce_company_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _tenant_id integer;
BEGIN
  _tenant_id := app.current_company_id();

  -- Service role is allowed to write across tenants for administrative tasks.
  IF app.is_service_role() THEN
    RETURN NEW;
  END IF;

  IF _tenant_id IS NULL THEN
    RAISE EXCEPTION 'company_id not available in JWT/session context';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
    RAISE EXCEPTION 'company_id is immutable';
  END IF;

  IF NEW.company_id IS NULL THEN
    NEW.company_id := _tenant_id;
  END IF;

  IF NEW.company_id IS DISTINCT FROM _tenant_id THEN
    RAISE EXCEPTION 'cross-tenant write denied';
  END IF;

  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Audit trail for inserts/updates/deletes (fiscal traceability)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id bigserial PRIMARY KEY,
  company_id integer,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  record_pk jsonb,
  old_data jsonb,
  new_data jsonb,
  changed_by_user_id text,
  jwt_sub text,
  occurred_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS audit_logs_company_id_idx ON public.audit_logs (company_id);
CREATE INDEX IF NOT EXISTS audit_logs_table_name_idx ON public.audit_logs (table_name);
CREATE INDEX IF NOT EXISTS audit_logs_occurred_at_idx ON public.audit_logs (occurred_at DESC);

CREATE OR REPLACE FUNCTION app.audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  _new_data jsonb;
  _old_data jsonb;
  _company_id integer;
  _pk jsonb;
  _user_id text;
  _jwt_sub text;
BEGIN
  IF TG_TABLE_SCHEMA = 'public' AND TG_TABLE_NAME = 'audit_logs' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF TG_OP = 'INSERT' THEN
    _new_data := to_jsonb(NEW);
    _old_data := NULL;
    _company_id := COALESCE((_new_data ->> 'company_id')::integer, NULL);
    _pk := jsonb_build_object('id', _new_data -> 'id');
  ELSIF TG_OP = 'UPDATE' THEN
    _new_data := to_jsonb(NEW);
    _old_data := to_jsonb(OLD);
    _company_id := COALESCE((_new_data ->> 'company_id')::integer, (_old_data ->> 'company_id')::integer);
    _pk := jsonb_build_object('id', COALESCE(_new_data -> 'id', _old_data -> 'id'));
  ELSE
    _new_data := NULL;
    _old_data := to_jsonb(OLD);
    _company_id := COALESCE((_old_data ->> 'company_id')::integer, NULL);
    _pk := jsonb_build_object('id', _old_data -> 'id');
  END IF;

  -- companies table identifies tenant by its primary key itself
  IF _company_id IS NULL AND TG_TABLE_NAME = 'companies' THEN
    _company_id := COALESCE((COALESCE(_new_data, _old_data) ->> 'id')::integer, NULL);
  END IF;

  _jwt_sub := NULLIF(app.jwt_claims() ->> 'sub', '');
  _user_id := app.current_user_id();

  INSERT INTO public.audit_logs (
    company_id,
    table_name,
    action,
    record_pk,
    old_data,
    new_data,
    changed_by_user_id,
    jwt_sub
  )
  VALUES (
    _company_id,
    TG_TABLE_NAME,
    TG_OP,
    _pk,
    _old_data,
    _new_data,
    _user_id,
    _jwt_sub
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Tenant indexes (performance as tenant count and volume grow)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'audit_logs'
  LOOP
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON public.%I (company_id)',
      r.table_name || '_company_id_idx',
      r.table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 6) Attach tenant enforcement trigger to every tenant table (except audit_logs)
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'audit_logs'
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_enforce_company_id ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_enforce_company_id BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.enforce_company_id()',
      r.table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 7) Attach audit trigger to tenant tables + companies
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT table_name
    FROM (
      SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables t
        ON t.table_schema = c.table_schema
       AND t.table_name = c.table_name
      WHERE c.table_schema = 'public'
        AND c.column_name = 'company_id'
        AND t.table_type = 'BASE TABLE'
        AND c.table_name <> 'audit_logs'
      UNION ALL
      SELECT 'companies'
    ) x
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_row_change ON public.%I', r.table_name);
    EXECUTE format(
      'CREATE TRIGGER trg_audit_row_change AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION app.audit_row_change()',
      r.table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 8) Row Level Security (mandatory tenant isolation)
-- ---------------------------------------------------------------------------

-- Companies are isolated by their own primary key (tenant id)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS companies_tenant_select ON public.companies;
DROP POLICY IF EXISTS companies_tenant_update ON public.companies;

CREATE POLICY companies_tenant_select
  ON public.companies
  FOR SELECT
  USING (app.is_service_role() OR id = app.current_company_id());

CREATE POLICY companies_tenant_update
  ON public.companies
  FOR UPDATE
  USING (app.is_service_role() OR id = app.current_company_id())
  WITH CHECK (app.is_service_role() OR id = app.current_company_id());

-- audit_logs also contains tenant data and must be protected
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_logs_tenant_select ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_insert ON public.audit_logs;
DROP POLICY IF EXISTS audit_logs_tenant_delete ON public.audit_logs;

CREATE POLICY audit_logs_tenant_select
  ON public.audit_logs
  FOR SELECT
  USING (app.is_service_role() OR company_id = app.current_company_id());

-- Inserts happen through SECURITY DEFINER trigger; keep policy strict for direct API attempts
CREATE POLICY audit_logs_tenant_insert
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (app.is_service_role() OR company_id = app.current_company_id());

CREATE POLICY audit_logs_tenant_delete
  ON public.audit_logs
  FOR DELETE
  USING (app.is_service_role());

-- Apply RLS to every table that stores tenant rows via company_id
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.table_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema
     AND t.table_name = c.table_name
    WHERE c.table_schema = 'public'
      AND c.column_name = 'company_id'
      AND t.table_type = 'BASE TABLE'
      AND c.table_name <> 'audit_logs'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', r.table_name);

    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_tenant_select', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_tenant_insert', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_tenant_update', r.table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.table_name || '_tenant_delete', r.table_name);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (app.is_service_role() OR company_id = app.current_company_id())',
      r.table_name || '_tenant_select',
      r.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (app.is_service_role() OR company_id = app.current_company_id())',
      r.table_name || '_tenant_insert',
      r.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (app.is_service_role() OR company_id = app.current_company_id()) WITH CHECK (app.is_service_role() OR company_id = app.current_company_id())',
      r.table_name || '_tenant_update',
      r.table_name
    );

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (app.is_service_role() OR company_id = app.current_company_id())',
      r.table_name || '_tenant_delete',
      r.table_name
    );
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 9) Optional integrity constraints (safe if existing data is clean)
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'users'
      AND column_name = 'company_id'
      AND is_nullable = 'YES'
  ) THEN
    -- no-op (users.company_id is already NOT NULL in current schema)
    NULL;
  END IF;
END $$;

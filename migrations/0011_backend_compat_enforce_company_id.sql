-- Backend compatibility for tenant enforcement trigger.
-- Rationale:
-- The app writes directly via a trusted server connection (not Supabase JWT),
-- so request.jwt.claims may be absent. In that case, allow writes that already
-- provide NEW.company_id explicitly, while preserving company_id immutability.

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

  -- Compatibility path for trusted backend connections without JWT/session claims.
  -- Require explicit company_id on the row and keep it immutable on updates.
  IF _tenant_id IS NULL THEN
    IF TG_OP = 'UPDATE' AND OLD.company_id IS DISTINCT FROM NEW.company_id THEN
      RAISE EXCEPTION 'company_id is immutable';
    END IF;

    IF NEW.company_id IS NULL THEN
      RAISE EXCEPTION 'company_id not available in JWT/session context';
    END IF;

    RETURN NEW;
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


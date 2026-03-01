-- Phase 1: Backfill inicial para modelo multiempresa + unidades.
-- 1) Cria unidade MATRIZ para empresas que ainda nao possuem unidade.
-- 2) Popula vinculos de acesso por empresa e unidade com base em users.
-- 3) Preenche unit_id nas tabelas operacionais legadas.

INSERT INTO "business_units" ("company_id", "code", "name", "is_active")
SELECT c.id, 'MATRIZ', 'Matriz', true
FROM "companies" c
LEFT JOIN "business_units" bu
  ON bu.company_id = c.id
 AND upper(bu.code) = 'MATRIZ'
WHERE bu.id IS NULL;

INSERT INTO "user_company_accesses" ("user_id", "company_id", "is_default", "is_active")
SELECT u.id, u.company_id, true, true
FROM "users" u
LEFT JOIN "user_company_accesses" uca
  ON uca.user_id = u.id
 AND uca.company_id = u.company_id
WHERE uca.id IS NULL;

INSERT INTO "user_unit_accesses" ("user_id", "unit_id", "role_id", "is_active")
SELECT
  u.id,
  bu.id AS unit_id,
  u.role_id,
  true
FROM "users" u
JOIN "business_units" bu
  ON bu.company_id = u.company_id
LEFT JOIN "user_unit_accesses" uua
  ON uua.user_id = u.id
 AND uua.unit_id = bu.id
WHERE uua.id IS NULL;

UPDATE "sales" s
SET "unit_id" = bu.id
FROM "business_units" bu
WHERE s.unit_id IS NULL
  AND bu.company_id = s.company_id
  AND upper(bu.code) = 'MATRIZ';

UPDATE "inventory_movements" im
SET "unit_id" = bu.id
FROM "business_units" bu
WHERE im.unit_id IS NULL
  AND bu.company_id = im.company_id
  AND upper(bu.code) = 'MATRIZ';

UPDATE "pos_terminals" pt
SET "unit_id" = bu.id
FROM "business_units" bu
WHERE pt.unit_id IS NULL
  AND bu.company_id = pt.company_id
  AND upper(bu.code) = 'MATRIZ';

UPDATE "payment_machines" pm
SET "unit_id" = bu.id
FROM "business_units" bu
WHERE pm.unit_id IS NULL
  AND bu.company_id = pm.company_id
  AND upper(bu.code) = 'MATRIZ';

UPDATE "cash_registers" cr
SET "unit_id" = bu.id
FROM "business_units" bu
WHERE cr.unit_id IS NULL
  AND bu.company_id = cr.company_id
  AND upper(bu.code) = 'MATRIZ';

UPDATE "cash_movements" cm
SET "unit_id" = bu.id
FROM "business_units" bu
WHERE cm.unit_id IS NULL
  AND bu.company_id = cm.company_id
  AND upper(bu.code) = 'MATRIZ';

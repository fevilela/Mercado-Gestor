ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS crt text DEFAULT '1';

ALTER TABLE company_settings
ADD COLUMN IF NOT EXISTS fiscal_environment text DEFAULT 'homologacao';

CREATE TABLE IF NOT EXISTS simples_nacional_aliquots (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  annex text NOT NULL,
  range_start decimal(12, 2) DEFAULT '0',
  range_end decimal(12, 2) DEFAULT '0',
  nominal_aliquot decimal(5, 2) DEFAULT '0',
  effective_aliquot decimal(5, 2) DEFAULT '0',
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sefaz_transmission_logs (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  action text NOT NULL,
  environment text NOT NULL,
  request_payload jsonb,
  response_payload jsonb,
  success boolean DEFAULT false,
  created_at timestamp DEFAULT now()
);

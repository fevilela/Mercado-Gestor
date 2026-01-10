CREATE TABLE IF NOT EXISTS fiscal_xml_storage (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  document_type text NOT NULL,
  document_key text NOT NULL,
  xml_content text NOT NULL,
  authorized_at timestamp,
  expires_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS manifest_documents (
  id serial PRIMARY KEY,
  company_id integer NOT NULL,
  document_key text NOT NULL,
  issuer_cnpj text NOT NULL,
  receiver_cnpj text NOT NULL,
  xml_content text NOT NULL,
  downloaded_at timestamp,
  created_at timestamp DEFAULT now()
);

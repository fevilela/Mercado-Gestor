ALTER TABLE pos_terminals
ADD COLUMN IF NOT EXISTS mp_access_token text;

ALTER TABLE pos_terminals
ADD COLUMN IF NOT EXISTS stone_client_id text;

ALTER TABLE pos_terminals
ADD COLUMN IF NOT EXISTS stone_client_secret text;

ALTER TABLE users ADD COLUMN IF NOT EXISTS password text;

DROP INDEX IF EXISTS users_email_idx;
CREATE UNIQUE INDEX users_email_idx ON users USING btree (email);

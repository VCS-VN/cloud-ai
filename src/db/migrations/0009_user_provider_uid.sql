ALTER TABLE users RENAME COLUMN firebase_uid TO provider_uid;
ALTER TABLE users RENAME COLUMN auth_provider TO provider;

UPDATE users
SET provider = upper(provider)
WHERE provider IN ('google', 'github');

ALTER INDEX IF EXISTS users_firebase_uid_idx RENAME TO users_provider_uid_idx;

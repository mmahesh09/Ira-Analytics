-- Least-privilege runtime role for Rankwise.
--
-- The API, the worker and Better Auth only read and write rows; nothing at runtime changes the schema. Giving them
-- a role without DDL rights means a SQL injection or a compromised app server can't drop or alter tables, create
-- functions, or touch the migration history. Schema changes stay with the database owner:
--   - Alembic:  MIGRATION_DATABASE_URL = the owner's connection string (backend/alembic/env.py)
--   - Better Auth: `npx auth migrate` with DATABASE_URL = the owner's connection string, run from your machine
--
-- Run once, as the database owner (Neon: neondb_owner, in the SQL Editor), AFTER both migrations have run:
--   1. Neon Console → Roles → New role "rankwise_app" (Neon generates the password), or:
--        CREATE ROLE rankwise_app LOGIN PASSWORD '<generate a long random password>';
--   2. Run the statements below.
--   3. Set DATABASE_URL (Render, Vercel, Cloudflare) to rankwise_app's pooled connection string, and
--      MIGRATION_DATABASE_URL (Render / the backend host only) to the owner's.
-- Re-running is safe. Tables created later by the owner are covered by the DEFAULT PRIVILEGES below.

-- nobody but the owner may create objects in the schema (PostgreSQL 15+ already defaults to this)
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rankwise_app;

-- row access to every existing table and sequence (app tables and Better Auth's)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO rankwise_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO rankwise_app;

-- and to tables the owner creates in future migrations
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rankwise_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO rankwise_app;

-- the migration history is the owner's business
REVOKE INSERT, UPDATE, DELETE ON alembic_version FROM rankwise_app;

-- Check (as rankwise_app): both must fail with "permission denied"
--   CREATE TABLE probe (id int);
--   DROP TABLE sites;

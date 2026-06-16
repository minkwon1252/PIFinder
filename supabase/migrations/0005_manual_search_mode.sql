-- =============================================================================
-- Mode C — manual database search runs.
-- Adds a new value to the pi_finder_mode enum. Kept in its own migration so the
-- value is committed before any later migration/runtime uses it (Postgres does
-- not allow using a freshly-added enum value in the same transaction).
-- =============================================================================
alter type pi_finder_mode add value if not exists 'manual_search';

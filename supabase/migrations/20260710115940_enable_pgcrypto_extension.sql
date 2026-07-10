-- Required for sign_badge()'s real HMAC-SHA256 signing. This was actually
-- enabled a few steps earlier via a raw query rather than a tracked
-- migration — recording it properly now so it doesn't become another
-- untracked schema change (idempotent, safe to run again).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

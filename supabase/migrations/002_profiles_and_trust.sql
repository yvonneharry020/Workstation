-- ============================================================
-- 002: Core Profiles and Trust Scores
-- ============================================================

-- Master profiles table (one row per auth.users entry)
CREATE TABLE profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL,
  email         TEXT NOT NULL,
  phone         TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  is_suspended  BOOLEAN NOT NULL DEFAULT false,
  suspended_at  TIMESTAMPTZ,
  suspended_reason TEXT,
  device_fingerprint TEXT,
  last_seen_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trust scores (one row per profile)
CREATE TABLE trust_scores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  score        SMALLINT NOT NULL DEFAULT 0 CHECK (score >= 0 AND score <= 100),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Events that change trust score
CREATE TABLE trust_score_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL,
  delta        SMALLINT NOT NULL,
  reason       TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Function: auto-update profiles.updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

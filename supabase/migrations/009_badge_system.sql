-- ============================================================
-- 009: Cryptographic Badge System
-- ============================================================

-- Badges issued by companies to candidates
CREATE TABLE badges (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issuer_id       UUID NOT NULL REFERENCES company_profiles(id) ON DELETE RESTRICT,
  recipient_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE RESTRICT,
  issued_by       UUID NOT NULL REFERENCES profiles(id),
  role_held       TEXT NOT NULL,
  start_date      DATE NOT NULL,
  end_date        DATE,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  recommendation  TEXT,
  performance_rating SMALLINT CHECK (performance_rating >= 1 AND performance_rating <= 5),
  status          badge_status NOT NULL DEFAULT 'active',
  revoked_at      TIMESTAMPTZ,
  revoked_by      UUID REFERENCES profiles(id),
  revocation_reason TEXT,
  revocation_is_public BOOLEAN NOT NULL DEFAULT true,
  issued_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_badges_updated_at
  BEFORE UPDATE ON badges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Cryptographic signatures for badge verification
CREATE TABLE badge_signatures (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id    UUID NOT NULL UNIQUE REFERENCES badges(id) ON DELETE CASCADE,
  payload     JSONB NOT NULL,
  signature   TEXT NOT NULL,
  key_version TEXT NOT NULL DEFAULT 'v1',
  signed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Badge disputes raised by candidates
CREATE TABLE badge_disputes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id        UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  raised_by       UUID NOT NULL REFERENCES profiles(id),
  reason          TEXT NOT NULL,
  evidence_urls   TEXT[],
  status          TEXT NOT NULL DEFAULT 'pending',
  resolution      TEXT,
  resolved_by     UUID REFERENCES profiles(id),
  resolved_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_badge_disputes_updated_at
  BEFORE UPDATE ON badge_disputes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

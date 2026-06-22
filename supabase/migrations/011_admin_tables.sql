-- ============================================================
-- 011: Admin Tables — Action Log, Flagged Content
-- ============================================================

-- Full audit log of every admin action
CREATE TABLE admin_action_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    UUID NOT NULL REFERENCES profiles(id),
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   UUID,
  details     JSONB DEFAULT '{}',
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Flagged content queue
CREATE TABLE flagged_content (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type    flag_content_type NOT NULL,
  content_id      UUID NOT NULL,
  flagged_by      UUID REFERENCES profiles(id),
  flag_reason     TEXT NOT NULL,
  ai_flagged      BOOLEAN NOT NULL DEFAULT false,
  ai_flag_details JSONB,
  status          flag_status NOT NULL DEFAULT 'pending',
  reviewed_by     UUID REFERENCES profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_notes    TEXT,
  action_taken    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_flagged_content_updated_at
  BEFORE UPDATE ON flagged_content
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- OTP codes (for phone verification — used with Termii or mock)
CREATE TABLE otp_codes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       TEXT NOT NULL,
  code        TEXT NOT NULL,
  purpose     TEXT NOT NULL DEFAULT 'phone_verification',
  attempts    SMALLINT NOT NULL DEFAULT 0,
  max_attempts SMALLINT NOT NULL DEFAULT 3,
  is_used     BOOLEAN NOT NULL DEFAULT false,
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Platform configuration (feature flags, weights, limits)
CREATE TABLE platform_config (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key         TEXT NOT NULL UNIQUE,
  value       JSONB NOT NULL,
  description TEXT,
  updated_by  UUID REFERENCES profiles(id),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO platform_config (key, value, description) VALUES
  ('trust_score_weights', '{"phone_verified":10,"nin_verified":20,"liveness_verified":15,"documents_verified":20,"badge_received":5,"positive_interactions":2}', 'Trust score delta per verification event'),
  ('badge_revocation_window_hours', '72', 'Hours within which a badge can be revoked without reason visible'),
  ('max_nin_attempts_per_day', '3', 'Max NIN verification attempts per phone number per 24h'),
  ('max_liveness_attempts_per_day', '3', 'Max liveness check attempts per user per 24h'),
  ('max_applications_per_hour', '20', 'Max job applications per candidate per hour'),
  ('max_bulk_emails_per_day', '500', 'Max bulk emails per company per day'),
  ('verification_review_sla_hours', '48', 'Target hours to review verification submissions'),
  ('dev_mode_otp', '"123456"', 'Mock OTP code used in development (replace with null in production)');

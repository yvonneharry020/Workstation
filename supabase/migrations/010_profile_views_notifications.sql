-- ============================================================
-- 010: Profile Views, Notifications, Push Tokens
-- ============================================================

-- Profile view log (who viewed whose profile)
CREATE TABLE profile_views (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_view CHECK (viewer_id != viewed_id)
);

-- In-app notifications inbox
CREATE TABLE notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB DEFAULT '{}',
  is_read     BOOLEAN NOT NULL DEFAULT false,
  read_at     TIMESTAMPTZ,
  action_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Device push notification tokens
CREATE TABLE push_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  device_id   TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  last_used   TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

CREATE TRIGGER trg_push_tokens_updated_at
  BEFORE UPDATE ON push_tokens
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Notification preferences per user
CREATE TABLE notification_preferences (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  push_profile_viewed   BOOLEAN NOT NULL DEFAULT true,
  push_application      BOOLEAN NOT NULL DEFAULT true,
  push_email_opened     BOOLEAN NOT NULL DEFAULT true,
  push_interview        BOOLEAN NOT NULL DEFAULT true,
  push_badge            BOOLEAN NOT NULL DEFAULT true,
  push_job_match        BOOLEAN NOT NULL DEFAULT true,
  email_profile_viewed  BOOLEAN NOT NULL DEFAULT false,
  email_application     BOOLEAN NOT NULL DEFAULT true,
  email_interview       BOOLEAN NOT NULL DEFAULT true,
  email_badge           BOOLEAN NOT NULL DEFAULT true,
  email_job_match       BOOLEAN NOT NULL DEFAULT true,
  whatsapp_opted_in     BOOLEAN NOT NULL DEFAULT false,
  whatsapp_phone        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_notification_prefs_updated_at
  BEFORE UPDATE ON notification_preferences
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

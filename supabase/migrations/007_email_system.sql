-- ============================================================
-- 007: Email System — Sent Log, Open Tracking, Templates
-- ============================================================

-- Email templates saved by companies
CREATE TABLE email_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  subject     TEXT NOT NULL,
  body_html   TEXT NOT NULL,
  variables   TEXT[] DEFAULT '{}',
  is_system   BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_email_templates_updated_at
  BEFORE UPDATE ON email_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- All emails sent through the platform
CREATE TABLE emails_sent (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  sent_by         UUID NOT NULL REFERENCES profiles(id),
  recipient_id    UUID REFERENCES profiles(id),
  recipient_email TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_html       TEXT,
  template_id     UUID REFERENCES email_templates(id),
  application_id  UUID REFERENCES job_applications(id),
  job_id          UUID REFERENCES job_postings(id),
  resend_email_id TEXT,
  open_token      TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  scheduled_for   TIMESTAMPTZ,
  sent_at         TIMESTAMPTZ,
  status          TEXT NOT NULL DEFAULT 'pending',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email open events (fired when 1x1 tracking pixel loads)
CREATE TABLE email_open_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_id        UUID NOT NULL REFERENCES emails_sent(id) ON DELETE CASCADE,
  open_token      TEXT NOT NULL,
  ip_address      TEXT,
  user_agent      TEXT,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

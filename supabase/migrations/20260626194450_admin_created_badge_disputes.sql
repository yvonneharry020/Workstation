
ALTER TABLE badge_disputes
  ALTER COLUMN badge_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS created_by_admin  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS candidate_name    text,
  ADD COLUMN IF NOT EXISTS candidate_email   text,
  ADD COLUMN IF NOT EXISTS company_name      text,
  ADD COLUMN IF NOT EXISTS role_held         text,
  ADD COLUMN IF NOT EXISTS badge_period      text,
  ADD COLUMN IF NOT EXISTS priority          text NOT NULL DEFAULT 'medium'
                                             CHECK (priority IN ('low', 'medium', 'high')),
  ADD COLUMN IF NOT EXISTS admin_notes       text;

ALTER TABLE badge_disputes
  DROP CONSTRAINT IF EXISTS badge_disputes_status_check;

ALTER TABLE badge_disputes
  ADD CONSTRAINT badge_disputes_status_check
  CHECK (status IN ('open', 'investigating', 'upheld', 'badge_removed', 'info_requested', 'pending'));


ALTER TABLE staff_profiles
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS nationality     TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url    TEXT,
  ADD COLUMN IF NOT EXISTS education       JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS work_history    JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS cv_filename     TEXT,
  ADD COLUMN IF NOT EXISTS cv_size_bytes   BIGINT,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_fields   JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS staff_profiles_email_idx ON staff_profiles(email);

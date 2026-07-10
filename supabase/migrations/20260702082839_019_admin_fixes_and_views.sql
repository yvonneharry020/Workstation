
-- ============================================================
-- 019: Fix is_admin(), create admin_broadcasts, add views
-- ============================================================

-- 1. Fix is_admin() to include super_admin role
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql
  STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'super_admin')
  );
$$;

-- 2. Create admin_broadcasts table (was missing from migration 016)
CREATE TABLE IF NOT EXISTS admin_broadcasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'info',
  target        TEXT NOT NULL DEFAULT 'all',
  sent_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_by_email TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  expires_at    TIMESTAMPTZ,
  read_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE admin_broadcasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_broadcasts_admin_all" ON admin_broadcasts
  FOR ALL USING (is_admin());

CREATE POLICY "admin_broadcasts_read_auth" ON admin_broadcasts
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Add admin UPDATE policy on profiles (needed for ban/suspend actions)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'profiles'
      AND policyname = 'profiles_admin_update'
  ) THEN
    EXECUTE 'CREATE POLICY profiles_admin_update ON profiles FOR UPDATE USING (is_admin())';
  END IF;
END $$;

-- 4. Add job_status enum values for moderation
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'rejected';

-- 5. Create candidates view
CREATE OR REPLACE VIEW candidates AS
SELECT
  cp.id,
  cp.id          AS user_id,
  p.email,
  (cp.first_name || ' ' || cp.last_name) AS full_name,
  COALESCE(cv.overall_status::TEXT, 'pending') AS verification_status,
  COALESCE(ts.score, 0)                  AS trust_score,
  cp.created_at,
  cp.headline    AS experience,
  NULL::TEXT[]   AS skills
FROM candidate_profiles cp
JOIN  profiles            p  ON p.id  = cp.id
LEFT JOIN candidate_verification cv ON cv.candidate_id = cp.id
LEFT JOIN trust_scores           ts ON ts.profile_id   = cp.id;

-- 6. Create companies view
CREATE OR REPLACE VIEW companies AS
SELECT
  cp.id,
  cp.id              AS user_id,
  p.email,
  cp.company_name    AS name,
  cp.company_name    AS full_name,
  COALESCE(cv.overall_status::TEXT, 'pending') AS verification_status,
  cp.industry,
  cp.created_at
FROM company_profiles cp
JOIN  profiles          p  ON p.id  = cp.id
LEFT JOIN company_verification cv ON cv.company_id = cp.id;

-- 7. Create jobs view (maps job_postings columns to names the admin code expects)
CREATE OR REPLACE VIEW jobs AS
SELECT
  jp.id,
  jp.title,
  jp.company_id,
  jp.description,
  jp.status::TEXT         AS status,
  jp.employment_type::TEXT AS type,
  jp.city                 AS location,
  jp.created_at,
  cp.company_name
FROM job_postings jp
LEFT JOIN company_profiles cp ON cp.id = jp.company_id;

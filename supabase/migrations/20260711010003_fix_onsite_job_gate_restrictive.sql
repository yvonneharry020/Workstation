-- Gate on-site/hybrid job postings on verified business address —
-- security requirement: candidates should only be sent to a physically
-- confirmed office. Remote postings are never gated.
--
-- Must be RESTRICTIVE, not permissive: job_postings_company_all already
-- permits any insert where company_id = get_my_company_id() with no
-- work_mode check, and permissive policies OR together — a second
-- permissive policy here would add another way to succeed, not narrow
-- anything. RESTRICTIVE policies AND with permissive ones instead, which
-- is what an actual gate needs. Verified directly against pg_policy
-- after the first (permissive) attempt, not assumed from CREATE
-- succeeding — confirmed with a live insert test before and after.
CREATE POLICY "job_postings_onsite_requires_verified_address" ON job_postings
  AS RESTRICTIVE
  FOR INSERT WITH CHECK (
    work_mode = 'remote'
    OR EXISTS (
      SELECT 1 FROM company_verification
      WHERE company_id = job_postings.company_id AND documents_status = 'approved'
    )
  );

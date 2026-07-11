-- Gap found while wiring up the job-post UI: the INSERT-only gate could
-- be bypassed by creating a draft as 'remote' (allowed) then updating
-- work_mode to 'on_site'/'hybrid' later — updates weren't covered.
-- Extending the same RESTRICTIVE check to UPDATE closes that. Verified
-- with a live test: draft created as remote, then update to on_site
-- correctly rejected.
CREATE POLICY "job_postings_onsite_update_requires_verified_address" ON job_postings
  AS RESTRICTIVE
  FOR UPDATE WITH CHECK (
    work_mode = 'remote'
    OR EXISTS (
      SELECT 1 FROM company_verification
      WHERE company_id = job_postings.company_id AND documents_status = 'approved'
    )
  );

-- Real bug found live-testing the Job Queue's admin close button: the
-- RESTRICTIVE UPDATE policy from earlier tonight applied its address-
-- verification check to EVERY update on job_postings, not just updates
-- that actually change work_mode. An admin trying to close (or otherwise
-- touch) an unverified company's on_site job got silently blocked by RLS —
-- completely unrelated to what they were actually trying to do.
--
-- RLS policies only see the resulting NEW row; they can't reference OLD to
-- tell "did this column actually change." A BEFORE UPDATE trigger can, so
-- move this specific check there instead of leaving it as a policy.
DROP POLICY IF EXISTS "job_postings_onsite_update_requires_verified_address" ON job_postings;

CREATE OR REPLACE FUNCTION public.enforce_onsite_requires_verified_address()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.work_mode IS DISTINCT FROM OLD.work_mode
     AND NEW.work_mode <> 'remote'
     AND NOT EXISTS (
       SELECT 1 FROM company_verification
       WHERE company_id = NEW.company_id AND documents_status = 'approved'
     ) THEN
    RAISE EXCEPTION 'Business address must be verified before posting on-site or hybrid jobs.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_onsite_requires_verified_address ON job_postings;
CREATE TRIGGER trg_enforce_onsite_requires_verified_address
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION enforce_onsite_requires_verified_address();

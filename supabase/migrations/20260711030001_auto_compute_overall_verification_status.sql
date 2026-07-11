-- The "Status" column in User Management has been stuck on "pending" forever
-- for every candidate/company, no matter what the third-party (mocked, for
-- now) verification actually returned. Root cause: overall_status was never
-- recomputed anywhere — company onboarding hardcoded it to the literal
-- string 'pending' even after cac_status passed, and the candidate mock
-- flow never touched candidate_verification at all (it only wrote booleans
-- on candidate_profiles). These triggers make overall_status a computed
-- value, driven by whichever individual checks are actually implemented
-- today (NIN + liveness for candidates, CAC for companies) — so it stays
-- correct automatically as those checks change, from any client.
--
-- Scoped to only recompute when the driving sub-status columns themselves
-- change (not on every update) — a manual ban only sets overall_status
-- directly (see /ops/users banUser()), and must not be silently overwritten
-- back to 'approved' the next time some unrelated column on the same row
-- is touched by a different write path.
CREATE OR REPLACE FUNCTION public.compute_candidate_overall_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.nin_status IS NOT DISTINCT FROM OLD.nin_status
     AND NEW.liveness_status IS NOT DISTINCT FROM OLD.liveness_status THEN
    RETURN NEW;
  END IF;

  IF NEW.nin_status = 'approved' AND NEW.liveness_status = 'approved' THEN
    NEW.overall_status := 'approved';
  ELSIF NEW.nin_status = 'rejected' OR NEW.liveness_status = 'rejected' THEN
    NEW.overall_status := 'rejected';
  ELSE
    NEW.overall_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_candidate_overall_status ON candidate_verification;
CREATE TRIGGER trg_compute_candidate_overall_status
  BEFORE INSERT OR UPDATE ON candidate_verification
  FOR EACH ROW EXECUTE FUNCTION compute_candidate_overall_status();

CREATE OR REPLACE FUNCTION public.compute_company_overall_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.cac_status IS NOT DISTINCT FROM OLD.cac_status THEN
    RETURN NEW;
  END IF;

  -- Business address (documents_status) is intentionally excluded — that's
  -- a separate, optional gate for on-site/hybrid job posting, not part of
  -- whether the company itself is a legitimate verified business.
  IF NEW.cac_status = 'approved' THEN
    NEW.overall_status := 'approved';
  ELSIF NEW.cac_status = 'rejected' THEN
    NEW.overall_status := 'rejected';
  ELSE
    NEW.overall_status := 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_company_overall_status ON company_verification;
CREATE TRIGGER trg_compute_company_overall_status
  BEFORE INSERT OR UPDATE ON company_verification
  FOR EACH ROW EXECUTE FUNCTION compute_company_overall_status();

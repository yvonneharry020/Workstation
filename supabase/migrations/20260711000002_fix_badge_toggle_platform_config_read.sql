-- badges_company_issue needs to read platform_config['badges.require_verified_company'],
-- but that key isn't in the public-read whitelist added earlier this session
-- (scoped deliberately to just 3 client-facing keys) — so under a normal
-- company session the subquery returned zero rows, not false, and NULL
-- fails a WITH CHECK. Caught by testing before shipping. Fix: a
-- SECURITY DEFINER helper, matching the existing get_my_company_id()/
-- is_admin() pattern, rather than widening the public platform_config
-- whitelist for every future toggle.
CREATE OR REPLACE FUNCTION public.badges_require_verified_company()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE((value #>> '{}')::boolean, false)
  FROM platform_config
  WHERE key = 'badges.require_verified_company';
$$;

REVOKE ALL ON FUNCTION public.badges_require_verified_company() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.badges_require_verified_company() TO authenticated;

DROP POLICY "badges_company_issue" ON badges;
CREATE POLICY "badges_company_issue" ON badges
  FOR INSERT WITH CHECK (
    badge_type = 'company'
    AND issuer_id = get_my_company_id()
    AND (
      NOT badges_require_verified_company()
      OR EXISTS (
        SELECT 1 FROM company_verification
        WHERE company_id = get_my_company_id() AND overall_status = 'approved'
      )
    )
    AND EXISTS (
      SELECT 1 FROM candidate_work_history wh
      WHERE wh.id = work_history_id
        AND wh.candidate_id = recipient_id
        AND lower(trim(wh.company_name)) = lower(trim((SELECT company_name FROM company_profiles WHERE id = get_my_company_id())))
    )
  );

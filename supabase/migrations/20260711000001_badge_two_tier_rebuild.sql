-- Splits the single badges table into two real types: company-issued
-- (one employer vouching for one specific job) and admin-issued (staff
-- human-verifying an entire profile). See workstation-badge-system-plan
-- memory for the full spec this implements.

CREATE TYPE badge_type_enum AS ENUM ('company', 'admin');

ALTER TABLE badges ADD COLUMN badge_type badge_type_enum NOT NULL DEFAULT 'company';
-- Admin badges have no company issuer.
ALTER TABLE badges ALTER COLUMN issuer_id DROP NOT NULL;
-- Company badges attach to one specific listed job, not free-text role/dates.
ALTER TABLE badges ADD COLUMN work_history_id UUID REFERENCES candidate_work_history(id) ON DELETE CASCADE;

ALTER TABLE badges ADD CONSTRAINT badges_type_shape_check CHECK (
  (badge_type = 'company' AND issuer_id IS NOT NULL AND work_history_id IS NOT NULL)
  OR
  (badge_type = 'admin' AND issuer_id IS NULL)
);

-- Toggleable launch gate — off during preview testing, flip to true for
-- production via the existing /config admin page. No code deploy needed
-- to turn it on later.
INSERT INTO platform_config (key, value, description)
VALUES (
  'badges.require_verified_company',
  'false',
  'Gate: only CAC-verified companies may issue company badges. Keep false during preview testing; set true for production launch.'
)
ON CONFLICT (key) DO NOTHING;

-- Rewrite company issuance policy: adds the verification gate (toggleable)
-- and the company-name match against the candidate's own listed employer
-- for that job — the hard backstop against issuing a badge for work the
-- candidate never listed as being at this company. Always on, not gated
-- by the toggle above; this isn't a launch-readiness switch, it's basic
-- integrity that should hold in preview too.
DROP POLICY "badges_company_issue" ON badges;
CREATE POLICY "badges_company_issue" ON badges
  FOR INSERT WITH CHECK (
    badge_type = 'company'
    AND issuer_id = get_my_company_id()
    AND (
      NOT (SELECT COALESCE((value #>> '{}')::boolean, false) FROM platform_config WHERE key = 'badges.require_verified_company')
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
-- badges_admin (existing, is_admin() FOR ALL) already covers admin-badge
-- issuance — no separate policy needed for that path.

-- Per-entry evidence: lets the review page show "proof for job #3" vs
-- "proof for degree #1" as distinct reviewable items instead of one
-- undifferentiated pile per candidate.
ALTER TABLE verification_documents ADD COLUMN work_history_id UUID REFERENCES candidate_work_history(id) ON DELETE CASCADE;
ALTER TABLE verification_documents ADD COLUMN education_id UUID REFERENCES candidate_education(id) ON DELETE CASCADE;

-- Admin-badge request worklist — created when a candidate asks for full
-- profile verification via chat. Gives the Management room a clean
-- queryable queue instead of parsing chat content to find requests.
CREATE TABLE admin_badge_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  chat_thread_id UUID REFERENCES chat_threads(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at     TIMESTAMPTZ,
  decided_by     UUID REFERENCES profiles(id)
);

ALTER TABLE admin_badge_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_badge_requests_candidate_own" ON admin_badge_requests
  FOR SELECT USING (candidate_id = auth.uid());
CREATE POLICY "admin_badge_requests_candidate_insert" ON admin_badge_requests
  FOR INSERT WITH CHECK (candidate_id = auth.uid());
CREATE POLICY "admin_badge_requests_staff" ON admin_badge_requests
  FOR ALL USING (is_admin() OR is_staff_room('management'))
  WITH CHECK (is_admin() OR is_staff_room('management'));

-- sign_badge(): the signed payload needs badge_type and work_history_id
-- added, or the tamper-evidence built earlier this session has a gap —
-- the new fields wouldn't be covered by the signature.
CREATE OR REPLACE FUNCTION public.sign_badge(p_badge_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_badge     record;
  v_payload   jsonb;
  v_signature text;
  v_secret    text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'badge_hmac_signing_key';

  IF v_secret IS NULL THEN
    RAISE EXCEPTION 'Badge signing key not configured';
  END IF;

  SELECT id, issuer_id, recipient_id, role_held, issued_at, badge_type, work_history_id
  INTO v_badge
  FROM badges
  WHERE id = p_badge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  IF v_badge.badge_type = 'company' AND v_badge.issuer_id IS DISTINCT FROM get_my_company_id() THEN
    RAISE EXCEPTION 'Not authorized to sign this badge';
  END IF;
  IF v_badge.badge_type = 'admin' AND NOT is_admin() THEN
    RAISE EXCEPTION 'Not authorized to sign this badge';
  END IF;

  v_payload := jsonb_build_object(
    'badgeId', v_badge.id,
    'badgeType', v_badge.badge_type,
    'issuerId', v_badge.issuer_id,
    'recipientId', v_badge.recipient_id,
    'workHistoryId', v_badge.work_history_id,
    'roleHeld', v_badge.role_held,
    'issuedAt', v_badge.issued_at
  );

  v_signature := encode(
    hmac(
      convert_to(v_payload::text, 'UTF8')::bytea,
      convert_to(v_secret, 'UTF8')::bytea,
      'sha256'::text
    ),
    'hex'
  );

  INSERT INTO badge_signatures (badge_id, payload, signature, key_version, signed_at)
  VALUES (v_badge.id, v_payload, v_signature, 'v3-two-tier', now());

  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_badge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_badge(uuid) TO authenticated;

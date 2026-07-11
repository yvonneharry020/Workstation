-- Live-tested against a real staff account (profiles.role='staff',
-- staff_members.permissions.management=true — not profiles.role IN
-- ('admin','super_admin')) and confirmed it hit "Not authorized to sign
-- this badge": sign_badge() only checked is_admin() for admin badges,
-- while the new badges_management_issue_admin_badge policy (previous
-- migration) already lets this same staff member INSERT the badge row
-- itself. The insert would succeed and the immediately-following sign
-- call would fail — same authorization boundary, now consistent on
-- both sides.
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
  IF v_badge.badge_type = 'admin' AND NOT (is_admin() OR is_staff_room('management')) THEN
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

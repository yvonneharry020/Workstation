-- CRITICAL bug found by testing: `v_badge.issuer_id <> get_my_company_id()`
-- is NULL (not true/false) whenever get_my_company_id() returns NULL — which
-- it does for any caller who isn't a company at all (candidates, or an
-- authenticated user with no company_profiles/company_team_members row).
-- plpgsql treats a NULL IF-condition as false, so the authorization check
-- silently did nothing for exactly the attacker case that matters most:
-- a non-company caller signing an arbitrary badge. Verified exploitable
-- with a live test before this fix; IS DISTINCT FROM is null-safe and
-- closes it. Re-verified blocked after this fix, before reporting done.

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
  v_secret    text := '60111ef5b33ab7402a6acd076c89b1e2fcb04ca7c2202f53662fd470c48425d7';
BEGIN
  SELECT id, issuer_id, recipient_id, role_held, issued_at
  INTO v_badge
  FROM badges
  WHERE id = p_badge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge not found';
  END IF;

  IF v_badge.issuer_id IS DISTINCT FROM get_my_company_id() THEN
    RAISE EXCEPTION 'Not authorized to sign this badge';
  END IF;

  v_payload := jsonb_build_object(
    'badgeId', v_badge.id,
    'issuerId', v_badge.issuer_id,
    'recipientId', v_badge.recipient_id,
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
  VALUES (v_badge.id, v_payload, v_signature, 'v1', now());

  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_badge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_badge(uuid) TO authenticated;

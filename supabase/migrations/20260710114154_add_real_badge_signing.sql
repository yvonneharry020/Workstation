-- badges/issue.tsx computed a "signature" client-side with mockSignature() —
-- a plain bit-shift checksum, not cryptography — while telling the user
-- "Badge will be cryptographically signed with HMAC-SHA256" and "has been
-- cryptographically signed." That claim was false. Rather than water down
-- the copy, this makes the claim true: a server-side SECURITY DEFINER
-- function computes a real HMAC-SHA256 using pgcrypto, keyed with a secret
-- that only server-side function code can read (no client, including an
-- authenticated badge issuer, can retrieve the key itself — only call the
-- function and get a signature back). The function re-derives the payload
-- from the actual badges row rather than trusting client-sent fields, and
-- checks the caller actually owns the badge being signed (issuer_id =
-- get_my_company_id()) since SECURITY DEFINER bypasses badges' own RLS.

CREATE OR REPLACE FUNCTION public.sign_badge(p_badge_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  IF v_badge.issuer_id <> get_my_company_id() THEN
    RAISE EXCEPTION 'Not authorized to sign this badge';
  END IF;

  v_payload := jsonb_build_object(
    'badgeId', v_badge.id,
    'issuerId', v_badge.issuer_id,
    'recipientId', v_badge.recipient_id,
    'roleHeld', v_badge.role_held,
    'issuedAt', v_badge.issued_at
  );

  v_signature := encode(hmac(v_payload::text, v_secret, 'sha256'), 'hex');

  INSERT INTO badge_signatures (badge_id, payload, signature, key_version, signed_at)
  VALUES (v_badge.id, v_payload, v_signature, 'v1', now());

  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_badge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_badge(uuid) TO authenticated;

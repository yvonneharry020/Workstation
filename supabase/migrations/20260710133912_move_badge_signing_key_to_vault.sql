-- The 5 prior sign_badge() migrations hardcoded the HMAC signing secret as a
-- plaintext literal in the function body, which meant it was sitting in
-- migration files about to be committed to git. That secret is being treated
-- as compromised and rotated. The new value lives only in Supabase Vault
-- (supabase_vault extension, already installed on this project) and is never
-- written to a file. This function reads it at call time via
-- vault.decrypted_secrets, scoped by secret name. SECURITY DEFINER means
-- this runs with the function owner's privileges regardless of caller, which
-- is what grants access to the vault view here — ordinary callers still
-- cannot read vault.decrypted_secrets directly.

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
  VALUES (v_badge.id, v_payload, v_signature, 'v2-vault', now());

  RETURN v_signature;
END;
$$;

REVOKE ALL ON FUNCTION public.sign_badge(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sign_badge(uuid) TO authenticated;

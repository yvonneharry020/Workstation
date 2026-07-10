
-- Delete account function for companies
CREATE OR REPLACE FUNCTION delete_company_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  -- Cascade deletes from child tables via FK constraints
  DELETE FROM company_profiles WHERE id = v_uid;
  DELETE FROM profiles WHERE id = v_uid;
  -- Remove the auth user last
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- Delete account function for candidates
CREATE OR REPLACE FUNCTION delete_candidate_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM candidate_profiles WHERE id = v_uid;
  DELETE FROM profiles WHERE id = v_uid;
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$;

-- v1 (fix_profiles_role_self_escalation) used a raw subquery in WITH CHECK
-- that caused "infinite recursion detected in policy for relation profiles",
-- because that subquery is itself subject to profiles' own SELECT RLS
-- policy, which creates a cycle. Fix: use the existing get_user_role()
-- helper (SECURITY DEFINER, bypasses RLS internally) instead of a raw
-- subquery.

ALTER POLICY "profiles_update_own" ON profiles
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = get_user_role()
  );

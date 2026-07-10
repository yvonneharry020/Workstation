-- Close self-escalation hole: profiles_update_own allowed any authenticated
-- user to change their own `role` column (e.g. candidate -> admin) because
-- the UPDATE policy had a USING clause (which row) but no WITH CHECK clause
-- (what the new row is allowed to contain).
--
-- This adds WITH CHECK so the update is only accepted if `role` in the new
-- row matches the role already on file. All other self-editable columns
-- (name, phone, avatar, etc.) are unaffected. Admin-driven role changes are
-- unaffected: they go through the separate `profiles_admin_update` policy
-- (USING is_admin()), and service-role/backend calls bypass RLS entirely.

ALTER POLICY "profiles_update_own" ON profiles
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT p.role FROM profiles p WHERE p.id = auth.uid())
  );

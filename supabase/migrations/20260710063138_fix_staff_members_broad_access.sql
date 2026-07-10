-- staff_members had one policy, "admin_full_access_staff", granting FOR ALL
-- (select/insert/update/delete) to any authenticated user (auth.role() =
-- 'authenticated'). That let any signed-in candidate/company account insert
-- a row naming their own email + role:'admin' + arbitrary permissions JSON
-- and self-grant staff/admin tooling access, or edit any existing staff
-- member's role/permissions.
--
-- Fix: split into two policies.
--  - Real admins (profiles.role admin/super_admin via is_admin()) keep full
--    ALL access, matching the original policy's intent.
--  - Any staff member may additionally SELECT their own row (matched by
--    email against the JWT, same convention already used by is_staff_room())
--    so the app can still load their own name/role/permissions after login.
-- No non-admin gets INSERT/UPDATE/DELETE on this table anymore.

DROP POLICY "admin_full_access_staff" ON staff_members;

CREATE POLICY "staff_members_admin_all" ON staff_members
  FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "staff_members_self_read" ON staff_members
  FOR SELECT
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

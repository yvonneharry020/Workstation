
-- Helper: checks whether the current authenticated user is an active staff
-- member with access to a specific admin-panel room (matched by email, since
-- staff_members.user_id is not populated). Mirrors getAllowedRooms() in
-- apps/admin/lib/staff-auth.ts: role = 'admin' grants every room.
CREATE OR REPLACE FUNCTION is_staff_room(target_room text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM staff_members sm
    WHERE lower(sm.email) = lower(auth.jwt() ->> 'email')
      AND sm.is_active = true
      AND (
        sm.role = 'admin'
        OR COALESCE((sm.permissions ->> target_room)::boolean, false) = true
      )
  );
$$;

-- invoices: used by finance pages and the admin analytics page
DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_staff_access" ON invoices
  FOR ALL
  USING (is_admin() OR is_staff_room('finance') OR is_staff_room('admin'))
  WITH CHECK (is_admin() OR is_staff_room('finance') OR is_staff_room('admin'));

-- refunds: finance room only
DROP POLICY IF EXISTS "refunds_all" ON refunds;
CREATE POLICY "refunds_staff_access" ON refunds
  FOR ALL
  USING (is_admin() OR is_staff_room('finance'))
  WITH CHECK (is_admin() OR is_staff_room('finance'));

-- payment_failures: finance room only (policy name already claimed
-- admin-only, this actually enforces it)
DROP POLICY IF EXISTS "Admins manage payment failures" ON payment_failures;
CREATE POLICY "payment_failures_staff_access" ON payment_failures
  FOR ALL
  USING (is_admin() OR is_staff_room('finance'))
  WITH CHECK (is_admin() OR is_staff_room('finance'));

-- background_jobs: technical room only
DROP POLICY IF EXISTS "background_jobs_all" ON background_jobs;
CREATE POLICY "background_jobs_staff_access" ON background_jobs
  FOR ALL
  USING (is_admin() OR is_staff_room('technical'))
  WITH CHECK (is_admin() OR is_staff_room('technical'));

-- integration_health_logs: technical room only
DROP POLICY IF EXISTS "integration_health_logs_all" ON integration_health_logs;
CREATE POLICY "integration_health_logs_staff_access" ON integration_health_logs
  FOR ALL
  USING (is_admin() OR is_staff_room('technical'))
  WITH CHECK (is_admin() OR is_staff_room('technical'));

-- admin_notifications: management (ops) room only
DROP POLICY IF EXISTS "admin_notifications_all" ON admin_notifications;
CREATE POLICY "admin_notifications_staff_access" ON admin_notifications
  FOR ALL
  USING (is_admin() OR is_staff_room('management'))
  WITH CHECK (is_admin() OR is_staff_room('management'));

-- escalations: admin room only (used by the disputes page); actually
-- enforces what the old policy name already claimed
DROP POLICY IF EXISTS "Authenticated staff can manage escalations" ON escalations;
CREATE POLICY "escalations_staff_access" ON escalations
  FOR ALL
  USING (is_admin() OR is_staff_room('admin'))
  WITH CHECK (is_admin() OR is_staff_room('admin'));

-- notifications: fix the "admin" policy that was USING (true) and was
-- silently defeating the correctly-scoped notifications_own policy.
-- notifications_own (user_id = auth.uid()) is untouched and still correct.
DROP POLICY IF EXISTS "Admins manage notifications" ON notifications;
CREATE POLICY "notifications_staff_access" ON notifications
  FOR ALL
  USING (is_admin() OR is_staff_room('admin') OR is_staff_room('management'))
  WITH CHECK (is_admin() OR is_staff_room('admin') OR is_staff_room('management'));

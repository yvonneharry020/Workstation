-- Same deep audit extended to Finance and Technical rooms as requested.
-- payroll_runs, payroll_run_items, and data_requests have RLS enabled with
-- ZERO policies at all — the same "wide open but silently locked for
-- everyone, including admins" pattern as verification_documents found
-- earlier tonight. Finance's entire Payroll page has never worked for
-- anyone. subscription_plans has no admin/staff policy at all either —
-- only an anon read of active plans, so even the super admin can't
-- currently edit a plan.

CREATE POLICY "payroll_runs_finance_all" ON payroll_runs
  FOR ALL USING (is_admin() OR is_staff_room('finance'))
  WITH CHECK (is_admin() OR is_staff_room('finance'));

CREATE POLICY "payroll_run_items_finance_all" ON payroll_run_items
  FOR ALL USING (is_admin() OR is_staff_room('finance'))
  WITH CHECK (is_admin() OR is_staff_room('finance'));

-- Used by both /compliance (admin room) and finance's board-report page.
CREATE POLICY "data_requests_staff_all" ON data_requests
  FOR ALL USING (is_admin() OR is_staff_room('finance'))
  WITH CHECK (is_admin() OR is_staff_room('finance'));

CREATE POLICY "subscription_plans_admin_finance_all" ON subscription_plans
  FOR ALL USING (is_admin() OR is_staff_room('finance'))
  WITH CHECK (is_admin() OR is_staff_room('finance'));

-- clock_sessions / staff_work_config already have an "own row only" read
-- policy (a staff member sees their own clock-ins / pay config) — additive,
-- doesn't touch that. Finance's payroll calculation needs every staff
-- member's data, not just their own.
CREATE POLICY "clock_sessions_finance_read" ON clock_sessions
  FOR SELECT USING (is_admin() OR is_staff_room('finance'));

CREATE POLICY "staff_work_config_finance_read" ON staff_work_config
  FOR SELECT USING (is_admin() OR is_staff_room('finance'));

CREATE POLICY "staff_members_finance_read" ON staff_members
  FOR SELECT USING (is_staff_room('finance'));

-- platform_config: scoped narrowly to the vat.* keys finance actually
-- edits (/finance/vat) — not broadened to the whole table, since it also
-- holds unrelated platform-wide settings like the badge verification gate.
CREATE POLICY "platform_config_finance_vat" ON platform_config
  FOR ALL USING (is_staff_room('finance') AND key LIKE 'vat.%')
  WITH CHECK (is_staff_room('finance') AND key LIKE 'vat.%');

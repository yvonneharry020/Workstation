-- badges_management_issue_admin_badge only covers INSERT — management
-- staff could issue an admin badge but had no way to revoke or reactivate
-- one afterward. Scoped to badge_type = 'admin' only; company-issued badges
-- stay the company's own domain (badges_company_revoke) or admin's.
CREATE POLICY "badges_management_update_admin_badge" ON badges
  FOR UPDATE
  USING (is_staff_room('management') AND badge_type = 'admin')
  WITH CHECK (is_staff_room('management') AND badge_type = 'admin');

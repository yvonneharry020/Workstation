-- Deep audit requested tonight: every table with an is_admin() policy was
-- checked for is_staff_room('management') coverage. These seven are
-- confirmed gaps that directly parallel the job_postings/candidate_profiles/
-- admin_broadcasts bugs found earlier tonight — management staff (not
-- literal profiles.role = 'admin') silently failing on core moderation
-- actions their own room's pages are built for.

-- profiles: /ops/users' Suspend and Ban buttons update is_active/is_suspended
-- directly on this table — confirmed silently failing for management staff,
-- same "UI shows success, DB never changed" bug as the Job Queue toggle.
CREATE POLICY "profiles_management_read" ON profiles
  FOR SELECT USING (is_staff_room('management'));
CREATE POLICY "profiles_management_update" ON profiles
  FOR UPDATE USING (is_staff_room('management')) WITH CHECK (is_staff_room('management'));

-- candidate_verification / company_verification: the actual per-check detail
-- table behind the Verification Queue page (nin_status, liveness_status,
-- cac_status, documents_status, etc.) — staff could only ever see the
-- COALESCE'd summary via the candidates/companies views, never the detail.
CREATE POLICY "candidate_verification_staff_read" ON candidate_verification
  FOR SELECT USING (is_admin() OR is_staff_room('management'));
CREATE POLICY "company_verification_staff_all" ON company_verification
  FOR ALL USING (is_admin() OR is_staff_room('management'))
  WITH CHECK (is_admin() OR is_staff_room('management'));

-- candidate_skills: same gap as work_history/education fixed earlier tonight
-- — the Verification Queue / candidate detail views need this too.
CREATE POLICY "candidate_skills_staff_read" ON candidate_skills
  FOR SELECT USING (is_admin() OR is_staff_room('management'));

-- job_applications: Applications page in the management room.
CREATE POLICY "job_applications_management_all" ON job_applications
  FOR ALL USING (is_staff_room('management')) WITH CHECK (is_staff_room('management'));

-- flagged_content: Trust & Safety > Flagged Content page — this is what
-- was producing the 400 error observed earlier tonight on that page.
CREATE POLICY "flagged_content_management_all" ON flagged_content
  FOR ALL USING (is_staff_room('management')) WITH CHECK (is_staff_room('management'));

-- ticket_timeline: Support Tickets page in the management room.
CREATE POLICY "ticket_timeline_management_all" ON ticket_timeline
  FOR ALL USING (is_staff_room('management')) WITH CHECK (is_staff_room('management'));

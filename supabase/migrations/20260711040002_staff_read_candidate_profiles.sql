-- candidate_profiles had no staff-read policy at all — only the candidate
-- themselves, companies (visibility permitting), and literal is_admin().
-- Management-room staff could see full_name/email etc. via the candidates
-- view (already scoped for is_staff_room), but never avatar_url directly,
-- since the Verification Queue and User Management pages read it straight
-- from this table. Same additive pattern as the work_history/education
-- staff-read policies from earlier this session.
CREATE POLICY "candidate_profiles_staff_read" ON candidate_profiles
  FOR SELECT USING (is_admin() OR is_staff_room('management') OR is_staff_room('technical'));

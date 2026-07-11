-- job_postings had no policy for is_staff_room('management') at all — only
-- literal is_admin(). This meant management staff using the Job Queue page
-- could only ever see ACTIVE jobs (via the public-read policy) and every
-- Admin Close click silently failed to persist: the UI updated its local
-- state optimistically regardless of whether the underlying write actually
-- succeeded, so it looked like it worked but nothing changed in the
-- database. Same gap, same fix pattern as candidate_profiles/admin_broadcasts
-- earlier tonight.
CREATE POLICY "job_postings_management_all" ON job_postings
  FOR ALL
  USING (is_staff_room('management'))
  WITH CHECK (is_staff_room('management'));

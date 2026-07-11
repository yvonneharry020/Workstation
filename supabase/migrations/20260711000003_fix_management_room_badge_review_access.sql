-- Caught by testing the new admin-badge-requests review page: candidate_work_history
-- and candidate_education have no policy letting staff/admin read them (only the
-- candidate themselves and any company role can), so the review page returned
-- nothing for a candidate with real listed jobs. Additive fix — existing policies
-- (candidate-own, company-read) untouched.
CREATE POLICY "work_history_staff_read" ON candidate_work_history
  FOR SELECT USING (is_admin() OR is_staff_room('management'));
CREATE POLICY "education_staff_read" ON candidate_education
  FOR SELECT USING (is_admin() OR is_staff_room('management'));

-- verification_documents has RLS enabled with ZERO policies — the table is
-- completely locked for every normal role right now. This also means the
-- pre-existing /ops/verifications page (unrelated to this session's work)
-- has been silently non-functional: every read returns no rows and every
-- update affects zero rows under RLS, regardless of its separate
-- 'verified' vs 'approved' status-value bug. Not fixing that page's own
-- bug here (out of scope), but the underlying table needs to actually be
-- readable/writable for either page to work at all.
CREATE POLICY "verification_documents_candidate_own" ON verification_documents
  FOR ALL USING (candidate_id = auth.uid())
  WITH CHECK (candidate_id = auth.uid());
CREATE POLICY "verification_documents_staff" ON verification_documents
  FOR ALL USING (is_admin() OR is_staff_room('management'))
  WITH CHECK (is_admin() OR is_staff_room('management'));

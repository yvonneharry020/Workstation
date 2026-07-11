-- The existing "badges_admin" policy only allows profiles.role IN ('admin',
-- 'super_admin') to touch the badges table. Management-room staff (like the
-- real staff account used to test the verification queue this session) are
-- authorized via staff_members/is_staff_room('management'), a separate
-- system — they had no way to actually insert the admin badge they just
-- finished reviewing. Scoped narrowly to INSERT of admin badges only, and
-- only once every job/degree the candidate listed has an approved
-- verification_documents entry — the same "fully reviewed" gate the
-- review page enforces client-side, now backed server-side too.
CREATE POLICY "badges_management_issue_admin_badge" ON badges
  FOR INSERT WITH CHECK (
    badge_type = 'admin'
    AND is_staff_room('management')
    AND issued_by = auth.uid()
    AND NOT EXISTS (
      SELECT 1 FROM candidate_work_history wh
      WHERE wh.candidate_id = recipient_id
        AND NOT EXISTS (
          SELECT 1 FROM verification_documents vd
          WHERE vd.work_history_id = wh.id AND vd.status = 'approved'
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM candidate_education ed
      WHERE ed.candidate_id = recipient_id
        AND NOT EXISTS (
          SELECT 1 FROM verification_documents vd
          WHERE vd.education_id = ed.id AND vd.status = 'approved'
        )
    )
    AND EXISTS (
      SELECT 1 FROM candidate_work_history wh WHERE wh.candidate_id = recipient_id
      UNION
      SELECT 1 FROM candidate_education ed WHERE ed.candidate_id = recipient_id
    )
  );

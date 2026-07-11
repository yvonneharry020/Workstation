-- Same security requirement as the on-site/hybrid job posting gate:
-- candidates should only be sent to a physically confirmed office.
-- RESTRICTIVE (not permissive) for the same reason as job_postings —
-- must AND with the existing ownership policy, not OR another way in.
CREATE POLICY "interview_slots_in_person_requires_verified_address" ON interview_slots
  AS RESTRICTIVE
  FOR INSERT WITH CHECK (
    meeting_type != 'in_person'
    OR EXISTS (
      SELECT 1 FROM company_verification
      WHERE company_id = interview_slots.company_id AND documents_status = 'approved'
    )
  );

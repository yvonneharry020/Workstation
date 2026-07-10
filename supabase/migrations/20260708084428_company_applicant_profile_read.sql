
CREATE POLICY "profiles_company_applicant_read"
ON public.profiles
FOR SELECT
USING (
  get_user_role() = 'company' AND
  EXISTS (
    SELECT 1 FROM job_applications ja
    JOIN job_postings jp ON jp.id = ja.job_id
    WHERE ja.candidate_id = profiles.id
    AND jp.company_id = auth.uid()
  )
);

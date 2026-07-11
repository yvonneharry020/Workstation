-- Storage RLS for the company-docs bucket (just created — it never
-- existed before, so every onboarding document upload has been failing
-- outright). Private bucket: company reads/writes only their own folder
-- (path prefixed with their own company_id), staff can read everything
-- for review. No public access — these are sensitive business documents,
-- not logos/banners.
CREATE POLICY "company_docs_own_folder_all" ON storage.objects
  FOR ALL USING (
    bucket_id = 'company-docs' AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'company-docs' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "company_docs_staff_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'company-docs' AND (is_admin() OR is_staff_room('management'))
  );

-- Document recency check (any address proof older than 6 months isn't
-- acceptable) and the office video — the two things a company submits
-- for business-address verification.
ALTER TABLE company_verification ADD COLUMN address_proof_document_date DATE;
ALTER TABLE company_verification ADD COLUMN office_video_url TEXT;

-- Once business address is approved, it's locked — this is what gets
-- sent to candidates for in-person interviews and on-site/hybrid roles,
-- so it must not be editable after verification without going through
-- staff again. Enforced at the database level, not just hidden in the
-- UI, since a company could otherwise call the update API directly.
CREATE OR REPLACE FUNCTION public.prevent_locked_address_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.headquarters_address IS DISTINCT FROM OLD.headquarters_address THEN
    IF EXISTS (
      SELECT 1 FROM company_verification
      WHERE company_id = NEW.id AND documents_status = 'approved'
    ) THEN
      RAISE EXCEPTION 'Business address is locked after verification. Contact support to request a change.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_locked_address_change
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION prevent_locked_address_change();

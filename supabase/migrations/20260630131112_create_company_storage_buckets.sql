
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('company-logos', 'company-logos', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('company-banners', 'company-banners', true, 10485760, ARRAY['image/jpeg','image/jpg','image/png','image/webp']),
  ('verification-docs', 'verification-docs', false, 20971520, ARRAY['application/pdf','image/jpeg','image/jpg','image/png'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "company_logos_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "company_logos_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'company-logos');

CREATE POLICY "company_logos_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-logos' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "company_banners_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'company-banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "company_banners_select" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'company-banners');

CREATE POLICY "company_banners_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'company-banners' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "verification_docs_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "verification_docs_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'verification-docs' AND (storage.foldername(name))[1] = auth.uid()::text);


-- Create company-gallery storage bucket (was missing)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('company-gallery', 'company-gallery', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Create candidate-gallery storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('candidate-gallery', 'candidate-gallery', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company-gallery
CREATE POLICY "company_gallery_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-gallery');

CREATE POLICY "company_gallery_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'company-gallery' AND auth.role() = 'authenticated');

CREATE POLICY "company_gallery_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'company-gallery' AND auth.role() = 'authenticated');

CREATE POLICY "company_gallery_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'company-gallery' AND auth.role() = 'authenticated');

-- Storage policies for candidate-gallery
CREATE POLICY "candidate_gallery_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-gallery');

CREATE POLICY "candidate_gallery_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'candidate-gallery' AND auth.role() = 'authenticated');

CREATE POLICY "candidate_gallery_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'candidate-gallery' AND auth.role() = 'authenticated');

CREATE POLICY "candidate_gallery_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'candidate-gallery' AND auth.role() = 'authenticated');

-- Create candidate_gallery table
CREATE TABLE IF NOT EXISTS candidate_gallery (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  image_url   text NOT NULL,
  caption     text,
  sort_order  smallint NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE candidate_gallery ENABLE ROW LEVEL SECURITY;

-- RLS: candidates manage their own gallery
CREATE POLICY "candidate_gallery_own" ON candidate_gallery
  FOR ALL USING (candidate_id = auth.uid());

-- RLS: anyone authenticated can read gallery images (companies browsing profiles)
CREATE POLICY "candidate_gallery_public_read" ON candidate_gallery
  FOR SELECT USING (true);

-- Security advisor flagged 7 storage buckets (avatars, candidate-gallery,
-- chat-attachments, company-banners, company-gallery, company-logos,
-- staff-cvs) with a broad SELECT policy on storage.objects that lets any
-- caller — including anon — list every file in the bucket via the Storage
-- API, not just fetch a single file by a known URL. staff-cvs is the
-- serious case: any anonymous request could enumerate every staff
-- member's CV.
--
-- Checked before changing anything: every real upload/download call site
-- in the app uses upload() + getPublicUrl() only — nothing calls list()
-- on these buckets from the candidate/company/mobile apps. getPublicUrl()
-- fetches are served by Supabase's public-object endpoint, which is
-- gated by the bucket's own `public` flag and does NOT go through these
-- RLS policies at all — so removing the broad SELECT policy does not
-- break any existing "view this file" behavior anywhere.
--
-- The one thing that DOES depend on this exact policy: the admin tech
-- storage explorer (apps/admin/app/(tech)/tech/storage/page.tsx) calls
-- .list() on these same buckets, and there is no other read policy
-- backing it. A straight DROP would silently break that admin tool.
-- Fix: replace "anyone can list" with "only admins can list" per bucket,
-- rather than removing listing entirely.

DROP POLICY "avatars_public_select" ON storage.objects;
CREATE POLICY "avatars_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars' AND is_admin());

DROP POLICY "candidate_gallery_public_read" ON storage.objects;
CREATE POLICY "candidate_gallery_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'candidate-gallery' AND is_admin());

DROP POLICY "Chat attachments are publicly readable" ON storage.objects;
CREATE POLICY "chat_attachments_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-attachments' AND is_admin());

DROP POLICY "company_banners_select" ON storage.objects;
CREATE POLICY "company_banners_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-banners' AND is_admin());

DROP POLICY "company_gallery_public_read" ON storage.objects;
CREATE POLICY "company_gallery_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-gallery' AND is_admin());

DROP POLICY "company_logos_select" ON storage.objects;
CREATE POLICY "company_logos_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'company-logos' AND is_admin());

DROP POLICY "staff_cv_read_public" ON storage.objects;
CREATE POLICY "staff_cv_admin_list" ON storage.objects
  FOR SELECT USING (bucket_id = 'staff-cvs' AND is_admin());

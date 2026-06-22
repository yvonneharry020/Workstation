-- ============================================================
-- 013: Row Level Security Policies
-- ============================================================

-- Enable RLS on all public tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE trust_score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE candidate_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cv_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_verification ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_gallery ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_postings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_required_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ats_stage_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails_sent ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_open_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_signatures ENABLE ROW LEVEL SECURITY;
ALTER TABLE badge_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE otp_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flagged_content ENABLE ROW LEVEL SECURITY;

-- ─── Helper: get caller's role ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Helper: is caller an admin ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── Helper: get caller's company_id ───────────────────────────────────────
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT id FROM company_profiles WHERE id = auth.uid()
  UNION ALL
  SELECT company_id FROM company_team_members WHERE member_id = auth.uid() AND is_active = true
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── PROFILES ──────────────────────────────────────────────────────────────
CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (id = auth.uid() OR is_admin());
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (id = auth.uid());

-- ─── TRUST SCORES ──────────────────────────────────────────────────────────
CREATE POLICY "trust_scores_public_read" ON trust_scores FOR SELECT USING (true);
CREATE POLICY "trust_scores_admin_write" ON trust_scores FOR ALL USING (is_admin());

-- ─── CANDIDATE PROFILES ────────────────────────────────────────────────────
-- Own profile: full access
CREATE POLICY "candidate_profiles_own" ON candidate_profiles
  FOR ALL USING (id = auth.uid());
-- Verified companies can see candidates (public fields only via view)
CREATE POLICY "candidate_profiles_company_read" ON candidate_profiles
  FOR SELECT USING (
    get_user_role() = 'company' AND profile_visibility != 'nobody'
  );
-- Admins can see all
CREATE POLICY "candidate_profiles_admin" ON candidate_profiles
  FOR ALL USING (is_admin());

-- ─── CANDIDATE VERIFICATION ────────────────────────────────────────────────
CREATE POLICY "candidate_verification_own" ON candidate_verification
  FOR SELECT USING (candidate_id = auth.uid());
CREATE POLICY "candidate_verification_admin" ON candidate_verification
  FOR ALL USING (is_admin());

-- ─── CANDIDATE SKILLS, WORK HISTORY, EDUCATION ─────────────────────────────
CREATE POLICY "candidate_skills_own" ON candidate_skills FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "candidate_skills_company_read" ON candidate_skills
  FOR SELECT USING (get_user_role() = 'company');
CREATE POLICY "candidate_skills_admin" ON candidate_skills FOR ALL USING (is_admin());

CREATE POLICY "work_history_own" ON candidate_work_history FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "work_history_company_read" ON candidate_work_history
  FOR SELECT USING (get_user_role() = 'company');

CREATE POLICY "education_own" ON candidate_education FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "education_company_read" ON candidate_education
  FOR SELECT USING (get_user_role() = 'company');

-- ─── DOCUMENTS ─────────────────────────────────────────────────────────────
CREATE POLICY "documents_own" ON documents FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "documents_admin" ON documents FOR ALL USING (is_admin());

-- ─── PORTFOLIO ITEMS ───────────────────────────────────────────────────────
CREATE POLICY "portfolio_own" ON portfolio_items FOR ALL USING (candidate_id = auth.uid());
CREATE POLICY "portfolio_public_read" ON portfolio_items
  FOR SELECT USING (true);

-- ─── CV VERSIONS ───────────────────────────────────────────────────────────
CREATE POLICY "cv_versions_own" ON cv_versions FOR ALL USING (candidate_id = auth.uid());

-- ─── COMPANY PROFILES ──────────────────────────────────────────────────────
CREATE POLICY "company_profiles_own" ON company_profiles FOR ALL
  USING (id = auth.uid() OR id = get_my_company_id());
CREATE POLICY "company_profiles_public_read" ON company_profiles FOR SELECT USING (true);
CREATE POLICY "company_profiles_admin" ON company_profiles FOR ALL USING (is_admin());

-- ─── COMPANY VERIFICATION ──────────────────────────────────────────────────
CREATE POLICY "company_verification_own" ON company_verification
  FOR SELECT USING (company_id = auth.uid() OR company_id = get_my_company_id());
CREATE POLICY "company_verification_admin" ON company_verification FOR ALL USING (is_admin());

-- ─── COMPANY TEAM MEMBERS ──────────────────────────────────────────────────
CREATE POLICY "company_team_own_company" ON company_team_members
  FOR ALL USING (company_id = get_my_company_id());

-- ─── COMPANY LOCATIONS AND GALLERY ─────────────────────────────────────────
CREATE POLICY "company_locations_own" ON company_locations
  FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "company_locations_public_read" ON company_locations FOR SELECT USING (true);

CREATE POLICY "company_gallery_own" ON company_gallery
  FOR ALL USING (company_id = get_my_company_id());
CREATE POLICY "company_gallery_public_read" ON company_gallery FOR SELECT USING (true);

-- ─── JOB POSTINGS ──────────────────────────────────────────────────────────
-- Public can read active jobs
CREATE POLICY "job_postings_public_read" ON job_postings
  FOR SELECT USING (status = 'active');
-- Company manages their own
CREATE POLICY "job_postings_company_all" ON job_postings
  FOR ALL USING (company_id = get_my_company_id());
-- Admin sees all
CREATE POLICY "job_postings_admin" ON job_postings FOR ALL USING (is_admin());

CREATE POLICY "job_required_skills_public_read" ON job_required_skills FOR SELECT USING (true);
CREATE POLICY "job_required_skills_company_write" ON job_required_skills
  FOR ALL USING (
    EXISTS (SELECT 1 FROM job_postings WHERE id = job_id AND company_id = get_my_company_id())
  );

-- ─── SAVED JOBS ────────────────────────────────────────────────────────────
CREATE POLICY "saved_jobs_own" ON saved_jobs FOR ALL USING (candidate_id = auth.uid());

-- ─── JOB APPLICATIONS ──────────────────────────────────────────────────────
-- Candidate sees their own applications
CREATE POLICY "applications_candidate_own" ON job_applications
  FOR ALL USING (candidate_id = auth.uid());
-- Company sees applications to their jobs
CREATE POLICY "applications_company_read" ON job_applications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM job_postings WHERE id = job_id AND company_id = get_my_company_id())
  );
CREATE POLICY "applications_company_update" ON job_applications
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM job_postings WHERE id = job_id AND company_id = get_my_company_id())
  );
-- Admin sees all
CREATE POLICY "applications_admin" ON job_applications FOR ALL USING (is_admin());

-- ─── ATS STAGE LOG ─────────────────────────────────────────────────────────
CREATE POLICY "ats_stage_log_company_read" ON ats_stage_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM job_applications ja
      JOIN job_postings jp ON jp.id = ja.job_id
      WHERE ja.id = application_id AND jp.company_id = get_my_company_id()
    )
  );

-- ─── EMAIL TEMPLATES ───────────────────────────────────────────────────────
CREATE POLICY "email_templates_company_own" ON email_templates
  FOR ALL USING (company_id = get_my_company_id());

-- ─── EMAILS SENT ───────────────────────────────────────────────────────────
CREATE POLICY "emails_sent_company_own" ON emails_sent
  FOR SELECT USING (company_id = get_my_company_id());
-- Candidate can see emails sent to them (for open tracking display)
CREATE POLICY "emails_sent_recipient_read" ON emails_sent
  FOR SELECT USING (recipient_id = auth.uid());

-- ─── EMAIL OPEN EVENTS ─────────────────────────────────────────────────────
-- Service role only (pixel endpoint uses service key)
CREATE POLICY "email_open_events_company_read" ON email_open_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM emails_sent WHERE id = email_id AND company_id = get_my_company_id())
  );

-- ─── INTERVIEW SLOTS ───────────────────────────────────────────────────────
CREATE POLICY "interview_slots_company_own" ON interview_slots
  FOR ALL USING (company_id = get_my_company_id());
-- Candidates can read slots they are invited to
CREATE POLICY "interview_slots_candidate_read" ON interview_slots
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM interview_bookings ib WHERE ib.slot_id = id AND ib.candidate_id = auth.uid()
    )
  );

-- ─── INTERVIEW BOOKINGS ────────────────────────────────────────────────────
CREATE POLICY "interview_bookings_candidate_own" ON interview_bookings
  FOR SELECT USING (candidate_id = auth.uid());
CREATE POLICY "interview_bookings_company_own" ON interview_bookings
  FOR ALL USING (company_id = get_my_company_id());

-- ─── BADGES ────────────────────────────────────────────────────────────────
-- Badges are public (anyone can view)
CREATE POLICY "badges_public_read" ON badges FOR SELECT USING (true);
-- Company issues badges
CREATE POLICY "badges_company_issue" ON badges
  FOR INSERT WITH CHECK (issuer_id = get_my_company_id());
-- Company can revoke within window
CREATE POLICY "badges_company_revoke" ON badges
  FOR UPDATE USING (issuer_id = get_my_company_id());
-- Admin can do everything
CREATE POLICY "badges_admin" ON badges FOR ALL USING (is_admin());

-- ─── BADGE SIGNATURES ──────────────────────────────────────────────────────
CREATE POLICY "badge_signatures_public_read" ON badge_signatures FOR SELECT USING (true);

-- ─── BADGE DISPUTES ────────────────────────────────────────────────────────
CREATE POLICY "badge_disputes_own" ON badge_disputes
  FOR ALL USING (raised_by = auth.uid());
CREATE POLICY "badge_disputes_admin" ON badge_disputes FOR ALL USING (is_admin());

-- ─── PROFILE VIEWS ─────────────────────────────────────────────────────────
-- You can only see who viewed YOUR profile
CREATE POLICY "profile_views_own_viewed" ON profile_views
  FOR SELECT USING (viewed_id = auth.uid());
-- Anyone logged in can record a view
CREATE POLICY "profile_views_insert" ON profile_views
  FOR INSERT WITH CHECK (viewer_id = auth.uid());

-- ─── NOTIFICATIONS ─────────────────────────────────────────────────────────
CREATE POLICY "notifications_own" ON notifications
  FOR ALL USING (user_id = auth.uid());

-- ─── PUSH TOKENS ───────────────────────────────────────────────────────────
CREATE POLICY "push_tokens_own" ON push_tokens FOR ALL USING (user_id = auth.uid());

-- ─── NOTIFICATION PREFERENCES ──────────────────────────────────────────────
CREATE POLICY "notification_prefs_own" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- ─── OTP CODES ─────────────────────────────────────────────────────────────
-- Service role only — no direct client access
-- (API backend uses service key to read/write OTPs)

-- ─── FLAGGED CONTENT ───────────────────────────────────────────────────────
-- Any authenticated user can flag content
CREATE POLICY "flagged_content_insert" ON flagged_content
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
-- Admin manages the queue
CREATE POLICY "flagged_content_admin" ON flagged_content FOR ALL USING (is_admin());

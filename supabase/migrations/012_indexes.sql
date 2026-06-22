-- ============================================================
-- 012: Performance Indexes
-- ============================================================

-- profiles
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_is_active ON profiles(is_active);

-- candidate_profiles
CREATE INDEX idx_candidate_profiles_state ON candidate_profiles(preferred_state_id);
CREATE INDEX idx_candidate_profiles_experience ON candidate_profiles(experience_level);
CREATE INDEX idx_candidate_profiles_open_to_work ON candidate_profiles(is_open_to_work);

-- candidate_skills
CREATE INDEX idx_candidate_skills_skill ON candidate_skills(skill_id);
CREATE INDEX idx_candidate_skills_candidate ON candidate_skills(candidate_id);

-- company_profiles
CREATE INDEX idx_company_profiles_industry ON company_profiles(industry);
CREATE INDEX idx_company_profiles_state ON company_profiles(headquarters_state);

-- job_postings
CREATE INDEX idx_job_postings_company ON job_postings(company_id);
CREATE INDEX idx_job_postings_status ON job_postings(status);
CREATE INDEX idx_job_postings_category ON job_postings(category_id);
CREATE INDEX idx_job_postings_state ON job_postings(state_id);
CREATE INDEX idx_job_postings_employment_type ON job_postings(employment_type);
CREATE INDEX idx_job_postings_experience_level ON job_postings(experience_level);
CREATE INDEX idx_job_postings_published_at ON job_postings(published_at DESC);
CREATE INDEX idx_job_postings_deadline ON job_postings(application_deadline);
-- Full-text search on job title and description
CREATE INDEX idx_job_postings_fts ON job_postings
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description,'')));

-- job_applications
CREATE INDEX idx_applications_job ON job_applications(job_id);
CREATE INDEX idx_applications_candidate ON job_applications(candidate_id);
CREATE INDEX idx_applications_status ON job_applications(status);
CREATE INDEX idx_applications_stage ON job_applications(pipeline_stage);
CREATE INDEX idx_applications_submitted ON job_applications(submitted_at DESC);
CREATE INDEX idx_applications_open_token ON job_applications(email_open_token);

-- emails_sent
CREATE INDEX idx_emails_sent_company ON emails_sent(company_id);
CREATE INDEX idx_emails_sent_recipient ON emails_sent(recipient_id);
CREATE INDEX idx_emails_sent_open_token ON emails_sent(open_token);
CREATE INDEX idx_emails_sent_application ON emails_sent(application_id);

-- email_open_events
CREATE INDEX idx_email_open_events_token ON email_open_events(open_token);
CREATE INDEX idx_email_open_events_email ON email_open_events(email_id);

-- interview_bookings
CREATE INDEX idx_interview_bookings_candidate ON interview_bookings(candidate_id);
CREATE INDEX idx_interview_bookings_company ON interview_bookings(company_id);
CREATE INDEX idx_interview_bookings_application ON interview_bookings(application_id);
CREATE INDEX idx_interview_bookings_status ON interview_bookings(status);

-- badges
CREATE INDEX idx_badges_recipient ON badges(recipient_id);
CREATE INDEX idx_badges_issuer ON badges(issuer_id);
CREATE INDEX idx_badges_status ON badges(status);

-- profile_views
CREATE INDEX idx_profile_views_viewed ON profile_views(viewed_id, viewed_at DESC);
CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_id, viewed_at DESC);

-- notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- push_tokens
CREATE INDEX idx_push_tokens_user ON push_tokens(user_id) WHERE is_active = true;

-- otp_codes
CREATE INDEX idx_otp_codes_phone ON otp_codes(phone, expires_at);

-- trust_score_events
CREATE INDEX idx_trust_events_profile ON trust_score_events(profile_id, created_at DESC);

-- flagged_content
CREATE INDEX idx_flagged_content_status ON flagged_content(status, created_at DESC);
CREATE INDEX idx_flagged_content_type ON flagged_content(content_type, content_id);

-- admin_action_log
CREATE INDEX idx_admin_log_admin ON admin_action_log(admin_id, created_at DESC);
CREATE INDEX idx_admin_log_target ON admin_action_log(target_type, target_id);

-- ats_stage_log
CREATE INDEX idx_ats_stage_log_application ON ats_stage_log(application_id, changed_at DESC);

-- documents
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_scan_status ON documents(scan_status);
CREATE INDEX idx_documents_type ON documents(document_type);

-- saved_jobs
CREATE INDEX idx_saved_jobs_candidate ON saved_jobs(candidate_id);
CREATE INDEX idx_saved_jobs_job ON saved_jobs(job_id);

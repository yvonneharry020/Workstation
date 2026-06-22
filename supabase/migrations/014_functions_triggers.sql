-- ============================================================
-- 014: Utility Functions and Triggers
-- ============================================================

-- Auto-create profile row when a new auth user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, role, email)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'candidate'),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-create trust_score row when profile is created
CREATE OR REPLACE FUNCTION handle_new_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO trust_scores (profile_id, score)
  VALUES (NEW.id, 0)
  ON CONFLICT (profile_id) DO NOTHING;

  INSERT INTO notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_profile_created
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile();

-- Increment trust score when a verification step passes
CREATE OR REPLACE FUNCTION update_trust_score(
  p_profile_id UUID,
  p_event_type TEXT,
  p_delta SMALLINT,
  p_reason TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO trust_score_events (profile_id, event_type, delta, reason)
  VALUES (p_profile_id, p_event_type, p_delta, p_reason);

  UPDATE trust_scores
  SET score = GREATEST(0, LEAST(100, score + p_delta)),
      updated_at = NOW()
  WHERE profile_id = p_profile_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment job applications_count when an application is submitted
CREATE OR REPLACE FUNCTION increment_applications_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE job_postings
  SET applications_count = applications_count + 1
  WHERE id = NEW.job_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_increment_applications_count
  AFTER INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION increment_applications_count();

-- Record profile view only if not viewed by same company in last 4 hours
CREATE OR REPLACE FUNCTION record_profile_view(
  p_viewer_id UUID,
  p_viewed_id UUID
)
RETURNS VOID AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profile_views
    WHERE viewer_id = p_viewer_id
      AND viewed_id = p_viewed_id
      AND viewed_at > NOW() - INTERVAL '4 hours'
  ) THEN
    INSERT INTO profile_views (viewer_id, viewed_id)
    VALUES (p_viewer_id, p_viewed_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Mark email as opened and update application tracker
CREATE OR REPLACE FUNCTION record_email_open(p_open_token TEXT)
RETURNS VOID AS $$
DECLARE
  v_email_id UUID;
  v_application_id UUID;
BEGIN
  -- Get the email record
  SELECT id, application_id INTO v_email_id, v_application_id
  FROM emails_sent
  WHERE open_token = p_open_token AND sent_at IS NOT NULL
  LIMIT 1;

  IF v_email_id IS NULL THEN RETURN; END IF;

  -- Log the open event
  INSERT INTO email_open_events (email_id, open_token)
  VALUES (v_email_id, p_open_token)
  ON CONFLICT DO NOTHING;

  -- Update application email_opened_at (only first time)
  IF v_application_id IS NOT NULL THEN
    UPDATE job_applications
    SET email_opened_at = NOW()
    WHERE id = v_application_id AND email_opened_at IS NULL;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up expired OTPs (run via cron/pg_cron or backend scheduler)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Realtime: enable relevant tables for Supabase Realtime subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE job_applications;
ALTER PUBLICATION supabase_realtime ADD TABLE interview_bookings;
ALTER PUBLICATION supabase_realtime ADD TABLE candidate_verification;
ALTER PUBLICATION supabase_realtime ADD TABLE company_verification;

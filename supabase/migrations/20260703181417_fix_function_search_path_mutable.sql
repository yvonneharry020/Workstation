
-- Fix function_search_path_mutable warnings: pin search_path = 'public' on all affected functions

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public'
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_chat_thread_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_ticket_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_staff_timestamp()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.generate_ticket_number()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public'
AS $$
BEGIN
  NEW.ticket_number = 'TKT-' || LPAD(nextval('ticket_number_seq')::text, 5, '0');
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.increment_applications_count()
RETURNS trigger LANGUAGE plpgsql SET search_path = 'public'
AS $$
BEGIN
  UPDATE job_postings SET applications_count = applications_count + 1 WHERE id = NEW.job_id;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS user_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$ SELECT role FROM profiles WHERE id = auth.uid(); $$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'super_admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT id FROM company_profiles WHERE id = auth.uid()
  UNION ALL
  SELECT company_id FROM company_team_members WHERE member_id = auth.uid() AND is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO trust_scores (profile_id, score) VALUES (NEW.id, 0) ON CONFLICT (profile_id) DO NOTHING;
  INSERT INTO notification_preferences (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.update_trust_score(
  p_profile_id uuid, p_event_type text, p_delta smallint, p_reason text DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO trust_score_events (profile_id, event_type, delta, reason)
  VALUES (p_profile_id, p_event_type, p_delta, p_reason);
  UPDATE trust_scores
  SET score = GREATEST(0, LEAST(100, score + p_delta)), updated_at = NOW()
  WHERE profile_id = p_profile_id;
END; $$;

CREATE OR REPLACE FUNCTION public.record_profile_view(p_viewer_id uuid, p_viewed_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profile_views
    WHERE viewer_id = p_viewer_id AND viewed_id = p_viewed_id
      AND viewed_at > NOW() - INTERVAL '4 hours'
  ) THEN
    INSERT INTO profile_views (viewer_id, viewed_id) VALUES (p_viewer_id, p_viewed_id);
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.record_email_open(p_open_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE
  v_email_id UUID;
  v_application_id UUID;
BEGIN
  SELECT id, application_id INTO v_email_id, v_application_id
  FROM emails_sent WHERE open_token = p_open_token AND sent_at IS NOT NULL LIMIT 1;
  IF v_email_id IS NULL THEN RETURN; END IF;
  INSERT INTO email_open_events (email_id, open_token) VALUES (v_email_id, p_open_token) ON CONFLICT DO NOTHING;
  IF v_application_id IS NOT NULL THEN
    UPDATE job_applications SET email_opened_at = NOW()
    WHERE id = v_application_id AND email_opened_at IS NULL;
  END IF;
END; $$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
DECLARE v_count INTEGER;
BEGIN
  DELETE FROM otp_codes WHERE expires_at < NOW() - INTERVAL '1 hour';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

CREATE OR REPLACE FUNCTION public.handle_chat_message_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.sender_type = 'user' THEN
    UPDATE chat_threads SET
      last_message = CASE
        WHEN NEW.content IS NOT NULL AND NEW.content != '' THEN NEW.content
        WHEN NEW.attachment_type = 'image' THEN '📷 Image'
        WHEN NEW.attachment_type = 'file' THEN '📎 ' || COALESCE(NEW.attachment_name, 'File')
        ELSE 'Attachment'
      END,
      last_message_at = NEW.created_at,
      unread_admin = unread_admin + 1
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_parent_on_child_resolve()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.status = 'resolved' AND NEW.parent_ticket_id IS NOT NULL
     AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    UPDATE support_tickets SET
      dept_resolved = TRUE,
      dept_resolved_by_email = NEW.resolved_by_email,
      dept_resolved_at = COALESCE(NEW.resolved_at, now())
    WHERE id = NEW.parent_ticket_id;
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.sync_parent_on_admin_dispute_decision()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public'
AS $$
BEGIN
  IF NEW.parent_dispute_id IS NOT NULL AND NEW.status IN ('resolved', 'denied')
     AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    UPDATE badge_disputes SET
      admin_resolved = TRUE,
      admin_decision = NEW.status,
      admin_decided_by_email = NEW.admin_decided_by_email,
      admin_decided_at = COALESCE(NEW.resolved_at, now())
    WHERE id = NEW.parent_dispute_id;
  END IF;
  RETURN NEW;
END; $$;

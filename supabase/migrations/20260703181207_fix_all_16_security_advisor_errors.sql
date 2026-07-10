
-- ============================================================
-- Fix 1: Security Definer Views → Security Invoker (3 errors)
-- Views only join public schema tables — safe to switch
-- ============================================================
ALTER VIEW public.candidates SET (security_invoker = on);
ALTER VIEW public.companies SET (security_invoker = on);
ALTER VIEW public.jobs SET (security_invoker = on);

-- ============================================================
-- Fix 2: RLS Disabled in Public — Public reference tables (4 errors)
-- These are lookup/reference tables — anyone can read, no client writes
-- ============================================================
ALTER TABLE public.nigerian_states ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read nigerian_states"
  ON public.nigerian_states FOR SELECT USING (true);

ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read skills"
  ON public.skills FOR SELECT USING (true);

ALTER TABLE public.cv_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read cv_templates"
  ON public.cv_templates FOR SELECT USING (true);

ALTER TABLE public.job_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read job_categories"
  ON public.job_categories FOR SELECT USING (true);

-- ============================================================
-- Fix 3: RLS Disabled in Public — Admin-only audit/config tables (5 errors)
-- These tables store sensitive logs and config — admins only
-- ============================================================
ALTER TABLE public.admin_action_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only admin_action_log"
  ON public.admin_action_log USING (is_admin());

ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only platform_config"
  ON public.platform_config USING (is_admin());

ALTER TABLE public.db_passcodes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only db_passcodes"
  ON public.db_passcodes USING (is_admin());

ALTER TABLE public.db_access_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only db_access_log"
  ON public.db_access_log FOR SELECT USING (is_admin());

ALTER TABLE public.data_export_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins only data_export_log"
  ON public.data_export_log FOR SELECT USING (is_admin());

-- ============================================================
-- Fix 4: profile_field_changes — user sees own, admins see all (1 error)
-- ============================================================
ALTER TABLE public.profile_field_changes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own profile_field_changes"
  ON public.profile_field_changes FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "Admins can read all profile_field_changes"
  ON public.profile_field_changes FOR SELECT
  USING (is_admin());

-- ============================================================
-- Fix 5: ats_custom_stages — company owns their stages, admins read all (1 error)
-- ============================================================
ALTER TABLE public.ats_custom_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Companies manage their ats_custom_stages"
  ON public.ats_custom_stages
  USING (company_id = get_my_company_id());
CREATE POLICY "Admins can read all ats_custom_stages"
  ON public.ats_custom_stages FOR SELECT
  USING (is_admin());

-- ============================================================
-- Fix 6: ticket_timeline — submitter sees their ticket's timeline, admins see all (1 error)
-- ============================================================
ALTER TABLE public.ticket_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read timeline for their own tickets"
  ON public.ticket_timeline FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.support_tickets st
      WHERE st.id = ticket_timeline.ticket_id
        AND st.submitted_by = auth.uid()
    )
  );
CREATE POLICY "Admins can read all ticket_timeline"
  ON public.ticket_timeline FOR SELECT
  USING (is_admin());

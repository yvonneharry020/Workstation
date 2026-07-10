-- The 20260703181207 security-advisor fix locked platform_config to
-- "Admins only" for every operation, including SELECT. That's correct for
-- most rows here (dev_mode_otp, rate limits, trust score weights, VAT tax
-- ID) but breaks a legitimate existing read path: apps/mobile's
-- usePlatformConfig hook queries this table unauthenticated, on every app
-- launch (even pre-login), for maintenance_mode / maintenance_message /
-- minimum_app_version to drive the offline/maintenance/forced-update
-- overlay. That query currently returns nothing under RLS, silently
-- disabling maintenance mode and forced updates the moment those keys are
-- ever seeded — caught by tracing actual call sites, not just the
-- migration diff. Fix: add a second, permissive SELECT policy scoped to
-- exactly the three keys the app reads. Postgres OR's permissive policies
-- together per command, so admins still see every row via the existing
-- policy, and everyone else sees only these three. Write access is
-- untouched — the original "Admins only" policy still governs
-- INSERT/UPDATE/DELETE for all callers.
CREATE POLICY "Public read of client-facing platform config"
  ON public.platform_config
  FOR SELECT
  USING (key IN ('maintenance_mode', 'maintenance_message', 'minimum_app_version'));

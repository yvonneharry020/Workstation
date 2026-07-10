-- users_own_tickets had USING ((auth.uid() = submitted_by) OR (auth.role() =
-- 'authenticated')) — the OR against a condition true for every logged-in
-- user made the whole policy equivalent to "any authenticated user, full ALL
-- access" on every ticket, not just their own. Any user could read/edit/
-- delete any other user's support ticket, including staff-only fields like
-- internal_notes and resolution_note.
--
-- Fix: submitters get ALL access to their own ticket only. A new generic
-- is_active_staff() helper (same SECURITY DEFINER/email-match pattern as
-- the existing is_staff_room()) grants staff of any department full access
-- to all tickets, since ops/finance/tech ticket-management pages all need
-- to see and act on tickets across departments, not just their own room.

CREATE OR REPLACE FUNCTION is_active_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM staff_members sm
    WHERE lower(sm.email) = lower(auth.jwt() ->> 'email')
      AND sm.is_active = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

DROP POLICY "users_own_tickets" ON support_tickets;

CREATE POLICY "support_tickets_own" ON support_tickets
  FOR ALL
  USING (auth.uid() = submitted_by)
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "support_tickets_staff_all" ON support_tickets
  FOR ALL
  USING (is_active_staff())
  WITH CHECK (is_active_staff());

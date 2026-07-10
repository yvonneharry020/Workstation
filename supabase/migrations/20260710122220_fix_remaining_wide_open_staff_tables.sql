-- Found via a full RLS sweep while assessing the "privileged writes trust RLS"
-- pattern from the code audit. A July 9 migration already fixed several
-- similarly-open policies (invoices, refunds, payment_failures) but missed
-- these — every one of them still grants ANY authenticated user (any
-- candidate or company account, not just staff) full ALL (read/write/
-- delete) access, via `auth.role() = 'authenticated'`. None of these tables
-- are referenced anywhere in the mobile app (verified by grep), so they are
-- purely internal/admin-facing — restricting to staff breaks nothing real.

DROP POLICY "auth_access_announcements" ON announcements;
CREATE POLICY "announcements_staff_all" ON announcements
  FOR ALL USING (is_active_staff()) WITH CHECK (is_active_staff());

DROP POLICY "auth_access_feature_flags" ON feature_flags;
CREATE POLICY "feature_flags_staff_all" ON feature_flags
  FOR ALL USING (is_active_staff()) WITH CHECK (is_active_staff());

DROP POLICY "auth_access_incidents" ON incidents;
CREATE POLICY "incidents_staff_all" ON incidents
  FOR ALL USING (is_active_staff()) WITH CHECK (is_active_staff());

DROP POLICY "auth_access_costs" ON platform_costs;
CREATE POLICY "platform_costs_staff_all" ON platform_costs
  FOR ALL USING (is_active_staff()) WITH CHECK (is_active_staff());

DROP POLICY "auth_access_subs" ON platform_subscriptions;
CREATE POLICY "platform_subscriptions_staff_all" ON platform_subscriptions
  FOR ALL USING (is_active_staff()) WITH CHECK (is_active_staff());

DROP POLICY "auth_access_webhooks" ON webhook_logs;
CREATE POLICY "webhook_logs_staff_all" ON webhook_logs
  FOR ALL USING (is_active_staff()) WITH CHECK (is_active_staff());

-- chat_threads / chat_messages are a genuine user-facing support-chat
-- feature (chat_threads.user_id is the candidate/company who opened it), so
-- unlike the tables above these need real per-user scoping, not staff-only:
-- the thread's own owner, or any active staff member handling support chat.

DROP POLICY "threads_all" ON chat_threads;
CREATE POLICY "chat_threads_own_or_staff" ON chat_threads
  FOR ALL
  USING (user_id = auth.uid() OR is_active_staff())
  WITH CHECK (user_id = auth.uid() OR is_active_staff());

DROP POLICY "messages_all" ON chat_messages;
CREATE POLICY "chat_messages_own_thread_or_staff" ON chat_messages
  FOR ALL
  USING (
    is_active_staff()
    OR EXISTS (SELECT 1 FROM chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  )
  WITH CHECK (
    is_active_staff()
    OR EXISTS (SELECT 1 FROM chat_threads t WHERE t.id = thread_id AND t.user_id = auth.uid())
  );

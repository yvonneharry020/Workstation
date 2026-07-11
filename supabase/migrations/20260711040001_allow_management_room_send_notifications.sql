-- Notifications ("Send Notification") is a management-room feature
-- (/ops/notifications) — the underlying admin_broadcasts table only granted
-- is_admin(), so every management staff member correctly got a 403 trying
-- to use their own room's feature. Additive permissive policy, same pattern
-- as the rest of the room-scoped access already in place.
CREATE POLICY "admin_broadcasts_management_all" ON admin_broadcasts
  FOR ALL
  USING (is_staff_room('management'))
  WITH CHECK (is_staff_room('management'));

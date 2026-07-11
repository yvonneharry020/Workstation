-- Needed for badge issuance/revocation to reflect instantly on the
-- candidate's mobile profile — same gap as admin_broadcasts found earlier.
ALTER PUBLICATION supabase_realtime ADD TABLE badges;

-- notifications was already in the realtime publication; admin_broadcasts
-- was not, so the new mobile subscriptions for platform-wide broadcasts
-- would silently never fire. Same fix pattern as the earlier
-- add_chat_tables_to_realtime_publication migration.
ALTER PUBLICATION supabase_realtime ADD TABLE admin_broadcasts;

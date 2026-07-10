
-- Auto-update thread counters on every message insert via trigger
-- This replaces client-side unread_admin=1 (broken increment) with proper DB-level increment

CREATE OR REPLACE FUNCTION handle_chat_message_insert()
RETURNS TRIGGER AS $$
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_chat_message_insert ON chat_messages;

CREATE TRIGGER on_chat_message_insert
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION handle_chat_message_insert();

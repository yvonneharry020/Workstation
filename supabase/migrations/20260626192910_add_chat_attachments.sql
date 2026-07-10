
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS attachment_url   text,
  ADD COLUMN IF NOT EXISTS attachment_type  text CHECK (attachment_type IN ('image', 'file')),
  ADD COLUMN IF NOT EXISTS attachment_name  text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

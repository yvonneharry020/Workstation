
CREATE TABLE IF NOT EXISTS staff_messages (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sender_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name    TEXT        NOT NULL,
  sender_email   TEXT        NOT NULL,
  sender_department TEXT,
  body           TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  mentions       TEXT[]      NOT NULL DEFAULT '{}'
);

ALTER TABLE staff_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_messages_select"
  ON staff_messages FOR SELECT TO authenticated USING (true);

CREATE POLICY "staff_messages_insert"
  ON staff_messages FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

CREATE INDEX staff_messages_created_at_idx ON staff_messages (created_at ASC);

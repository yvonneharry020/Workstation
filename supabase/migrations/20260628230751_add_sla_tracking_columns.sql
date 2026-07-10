
-- Ticket lifecycle tracking
ALTER TABLE support_tickets
  ADD COLUMN IF NOT EXISTS created_by_email     TEXT,
  ADD COLUMN IF NOT EXISTS first_responded_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transferred_by_email TEXT,
  ADD COLUMN IF NOT EXISTS resolved_by_email    TEXT;

-- Staff attribution on chat messages
ALTER TABLE chat_messages
  ADD COLUMN IF NOT EXISTS sender_email TEXT;

-- Chat thread tracking
ALTER TABLE chat_threads
  ADD COLUMN IF NOT EXISTS first_admin_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_email    TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at          TIMESTAMPTZ;

-- Full ticket event history
CREATE TABLE IF NOT EXISTS ticket_timeline (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID        NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  event       TEXT        NOT NULL,
  actor_email TEXT,
  from_dept   TEXT,
  to_dept     TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ticket_timeline_ticket_id_idx  ON ticket_timeline(ticket_id);
CREATE INDEX IF NOT EXISTS ticket_timeline_created_at_idx ON ticket_timeline(created_at DESC);

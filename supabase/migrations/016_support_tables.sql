-- ============================================================
-- 016: Support Tables — ticket_timeline, admin_broadcasts
-- ============================================================

-- Lifecycle event log for support tickets
CREATE TABLE ticket_timeline (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id   UUID NOT NULL REFERENCES support_tickets(id) ON DELETE CASCADE,
  event       TEXT NOT NULL,
  actor_email TEXT,
  to_dept     TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ticket_timeline_ticket_id ON ticket_timeline(ticket_id);

-- Admin broadcast notifications (separate from per-user notifications)
CREATE TABLE admin_broadcasts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'info',
  target        TEXT NOT NULL DEFAULT 'all',
  sent_by       TEXT,
  sent_by_email TEXT,
  is_active     BOOLEAN NOT NULL DEFAULT true,
  expires_at    TIMESTAMPTZ,
  read_count    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

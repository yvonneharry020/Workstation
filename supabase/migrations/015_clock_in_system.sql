-- ============================================================
-- 015: Clock-In / Payroll System
-- ============================================================
-- Assumes staff_members table already exists (created outside migrations)

-- ── Staff work configuration ─────────────────────────────────
-- One row per staff member — upserted when admin changes settings.
-- hourly_rate is computed from monthly_salary and stored at clock-in
-- time so historical sessions are not affected by salary changes.

CREATE TABLE staff_work_config (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id                  UUID NOT NULL UNIQUE REFERENCES staff_members(id) ON DELETE CASCADE,
  staff_email                      TEXT NOT NULL,
  monthly_salary_naira             NUMERIC(15, 2) NOT NULL DEFAULT 0,
  work_days                        INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  -- 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat 7=Sun
  work_start_time                  TIME NOT NULL DEFAULT '09:00:00',
  work_end_time                    TIME NOT NULL DEFAULT '17:00:00',
  break_duration_minutes           INTEGER NOT NULL DEFAULT 60,
  presence_check_interval_minutes  INTEGER NOT NULL DEFAULT 120,
  updated_by                       TEXT NOT NULL,
  created_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_staff_work_config_updated_at
  BEFORE UPDATE ON staff_work_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Clock sessions ───────────────────────────────────────────
-- One row per staff member per calendar day.
-- total_worked_seconds / total_break_seconds accumulate COMPLETED
-- intervals only; the current live interval is NOT included here —
-- the client adds it from current_interval_started_at.

CREATE TABLE clock_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id             UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  staff_email                 TEXT NOT NULL,
  staff_full_name             TEXT NOT NULL DEFAULT '',
  session_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in_time               TIMESTAMPTZ,
  clock_out_time              TIMESTAMPTZ,
  last_heartbeat_at           TIMESTAMPTZ,
  current_interval_started_at TIMESTAMPTZ,   -- start of the current active work or break interval
  total_worked_seconds        BIGINT NOT NULL DEFAULT 0,
  total_break_seconds         BIGINT NOT NULL DEFAULT 0,
  overtime_seconds            BIGINT NOT NULL DEFAULT 0,
  overtime_approved           BOOLEAN NOT NULL DEFAULT false,
  overtime_approved_by        TEXT,
  overtime_approved_at        TIMESTAMPTZ,
  -- Rate locked at clock-in time to protect against salary changes mid-session
  hourly_rate_naira           NUMERIC(12, 4) NOT NULL DEFAULT 0,
  standard_work_seconds       INTEGER NOT NULL DEFAULT 25200, -- 7 hours default
  status                      TEXT NOT NULL DEFAULT 'active',
  -- 'active' | 'on_break' | 'completed' | 'auto_logged_out'
  next_presence_check_at      TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_member_id, session_date)
);

CREATE TRIGGER trg_clock_sessions_updated_at
  BEFORE UPDATE ON clock_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Enable realtime for admin live board
ALTER TABLE clock_sessions REPLICA IDENTITY FULL;

-- ── Clock events ─────────────────────────────────────────────
-- Append-only audit log. Never update or delete rows here.
-- Every state transition produces one event.
-- event_type values:
--   clock_in | break_start | break_end | clock_out
--   presence_pass | presence_fail | presence_timeout | auto_logout
--   heartbeat_lost

CREATE TABLE clock_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES clock_sessions(id) ON DELETE CASCADE,
  staff_member_id  UUID NOT NULL REFERENCES staff_members(id),
  staff_email      TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  event_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- server-recorded, never trust client
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Presence checks ──────────────────────────────────────────
-- One row per check attempt (1, 2, or 3 per 2-hour interval).
-- status: 'pending' | 'passed' | 'expired' | 'auto_logout_triggered'

CREATE TABLE presence_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES clock_sessions(id) ON DELETE CASCADE,
  staff_member_id  UUID NOT NULL REFERENCES staff_members(id),
  staff_email      TEXT NOT NULL,
  attempt_number   INTEGER NOT NULL DEFAULT 1,
  expires_at       TIMESTAMPTZ NOT NULL,  -- created_at + 60 seconds
  responded_at     TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_presence_checks_updated_at
  BEFORE UPDATE ON presence_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Indexes ──────────────────────────────────────────────────

CREATE INDEX idx_clock_sessions_staff_date
  ON clock_sessions(staff_member_id, session_date DESC);

CREATE INDEX idx_clock_sessions_status
  ON clock_sessions(status)
  WHERE status IN ('active', 'on_break');

CREATE INDEX idx_clock_sessions_date
  ON clock_sessions(session_date DESC);

CREATE INDEX idx_clock_events_session
  ON clock_events(session_id, event_time DESC);

CREATE INDEX idx_clock_events_staff
  ON clock_events(staff_member_id, event_time DESC);

CREATE INDEX idx_presence_checks_session_pending
  ON presence_checks(session_id, attempt_number DESC)
  WHERE status = 'pending';

CREATE INDEX idx_staff_work_config_email
  ON staff_work_config(staff_email);

-- ── Row Level Security ───────────────────────────────────────
-- API routes use service role key and bypass RLS entirely.
-- These policies protect direct anon/authenticated access.

ALTER TABLE staff_work_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_checks    ENABLE ROW LEVEL SECURITY;

-- Staff can read their own config
CREATE POLICY "staff_can_read_own_config"
  ON staff_work_config FOR SELECT
  USING (staff_email = auth.jwt() ->> 'email');

-- Staff can read their own sessions
CREATE POLICY "staff_can_read_own_sessions"
  ON clock_sessions FOR SELECT
  USING (staff_email = auth.jwt() ->> 'email');

-- Staff can read their own events
CREATE POLICY "staff_can_read_own_events"
  ON clock_events FOR SELECT
  USING (staff_email = auth.jwt() ->> 'email');

-- Staff can read their own presence checks
CREATE POLICY "staff_can_read_own_checks"
  ON presence_checks FOR SELECT
  USING (staff_email = auth.jwt() ->> 'email');

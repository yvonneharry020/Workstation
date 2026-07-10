-- ============================================================
-- 015: Clock-In / Payroll System
-- ============================================================

CREATE TABLE staff_work_config (
  id                               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id                  UUID NOT NULL UNIQUE REFERENCES staff_members(id) ON DELETE CASCADE,
  staff_email                      TEXT NOT NULL,
  monthly_salary_naira             NUMERIC(15, 2) NOT NULL DEFAULT 0,
  work_days                        INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
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

CREATE TABLE clock_sessions (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id             UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  staff_email                 TEXT NOT NULL,
  staff_full_name             TEXT NOT NULL DEFAULT '',
  session_date                DATE NOT NULL DEFAULT CURRENT_DATE,
  clock_in_time               TIMESTAMPTZ,
  clock_out_time              TIMESTAMPTZ,
  last_heartbeat_at           TIMESTAMPTZ,
  current_interval_started_at TIMESTAMPTZ,
  total_worked_seconds        BIGINT NOT NULL DEFAULT 0,
  total_break_seconds         BIGINT NOT NULL DEFAULT 0,
  overtime_seconds            BIGINT NOT NULL DEFAULT 0,
  overtime_approved           BOOLEAN NOT NULL DEFAULT false,
  overtime_approved_by        TEXT,
  overtime_approved_at        TIMESTAMPTZ,
  hourly_rate_naira           NUMERIC(12, 4) NOT NULL DEFAULT 0,
  standard_work_seconds       INTEGER NOT NULL DEFAULT 25200,
  status                      TEXT NOT NULL DEFAULT 'active',
  next_presence_check_at      TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(staff_member_id, session_date)
);

CREATE TRIGGER trg_clock_sessions_updated_at
  BEFORE UPDATE ON clock_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE clock_sessions REPLICA IDENTITY FULL;

CREATE TABLE clock_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES clock_sessions(id) ON DELETE CASCADE,
  staff_member_id  UUID NOT NULL REFERENCES staff_members(id),
  staff_email      TEXT NOT NULL,
  event_type       TEXT NOT NULL,
  event_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata         JSONB,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE presence_checks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID NOT NULL REFERENCES clock_sessions(id) ON DELETE CASCADE,
  staff_member_id  UUID NOT NULL REFERENCES staff_members(id),
  staff_email      TEXT NOT NULL,
  attempt_number   INTEGER NOT NULL DEFAULT 1,
  expires_at       TIMESTAMPTZ NOT NULL,
  responded_at     TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_presence_checks_updated_at
  BEFORE UPDATE ON presence_checks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE INDEX idx_clock_sessions_staff_date   ON clock_sessions(staff_member_id, session_date DESC);
CREATE INDEX idx_clock_sessions_status       ON clock_sessions(status) WHERE status IN ('active', 'on_break');
CREATE INDEX idx_clock_sessions_date         ON clock_sessions(session_date DESC);
CREATE INDEX idx_clock_events_session        ON clock_events(session_id, event_time DESC);
CREATE INDEX idx_clock_events_staff          ON clock_events(staff_member_id, event_time DESC);
CREATE INDEX idx_presence_checks_session_pending ON presence_checks(session_id, attempt_number DESC) WHERE status = 'pending';
CREATE INDEX idx_staff_work_config_email     ON staff_work_config(staff_email);

ALTER TABLE staff_work_config  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE clock_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE presence_checks    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "staff_can_read_own_config"    ON staff_work_config FOR SELECT USING (staff_email = auth.jwt() ->> 'email');
CREATE POLICY "staff_can_read_own_sessions"  ON clock_sessions    FOR SELECT USING (staff_email = auth.jwt() ->> 'email');
CREATE POLICY "staff_can_read_own_events"    ON clock_events      FOR SELECT USING (staff_email = auth.jwt() ->> 'email');
CREATE POLICY "staff_can_read_own_checks"    ON presence_checks   FOR SELECT USING (staff_email = auth.jwt() ->> 'email');
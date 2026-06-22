-- ============================================================
-- 008: Interview Scheduling System
-- ============================================================

-- Available interview time slots set by a company
CREATE TABLE interview_slots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id      UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  job_id          UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  created_by      UUID NOT NULL REFERENCES profiles(id),
  slot_date       DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  duration_mins   SMALLINT NOT NULL DEFAULT 30,
  meeting_type    TEXT NOT NULL DEFAULT 'zoom',
  meeting_link    TEXT,
  meeting_id      TEXT,
  is_booked       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Confirmed interview bookings
CREATE TABLE interview_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id         UUID NOT NULL UNIQUE REFERENCES interview_slots(id) ON DELETE CASCADE,
  application_id  UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_id      UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  booking_token   TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  status          interview_status NOT NULL DEFAULT 'booked',
  ical_uid        TEXT,
  candidate_confirmed_at  TIMESTAMPTZ,
  company_confirmed_at    TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    UUID REFERENCES profiles(id),
  cancellation_reason TEXT,
  no_show_notes   TEXT,
  interview_notes TEXT,
  internal_rating SMALLINT CHECK (internal_rating >= 1 AND internal_rating <= 5),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_interview_bookings_updated_at
  BEFORE UPDATE ON interview_bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

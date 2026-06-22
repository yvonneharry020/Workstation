-- ============================================================
-- 006: Applications and ATS
-- ============================================================

-- Job applications
CREATE TABLE job_applications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  candidate_id      UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  cv_version_id     UUID REFERENCES cv_versions(id),
  cover_note        TEXT,
  screening_answers JSONB DEFAULT '{}',
  status            application_status NOT NULL DEFAULT 'submitted',
  pipeline_stage    pipeline_stage NOT NULL DEFAULT 'new',
  -- Email tracking
  email_sent_at     TIMESTAMPTZ,
  email_opened_at   TIMESTAMPTZ,
  email_open_token  TEXT UNIQUE DEFAULT gen_random_uuid()::TEXT,
  -- Company internal notes
  internal_notes    TEXT,
  skills_match_pct  SMALLINT,
  submitted_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (job_id, candidate_id)
);

CREATE TRIGGER trg_job_applications_updated_at
  BEFORE UPDATE ON job_applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ATS: custom pipeline stage definitions per company job
CREATE TABLE ats_custom_stages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  job_id     UUID REFERENCES job_postings(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ATS: log of every stage change per application
CREATE TABLE ats_stage_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES job_applications(id) ON DELETE CASCADE,
  changed_by     UUID REFERENCES profiles(id),
  from_stage     pipeline_stage,
  to_stage       pipeline_stage NOT NULL,
  note           TEXT,
  changed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 005: Job Categories, Job Postings, Saved Jobs
-- ============================================================

-- Job categories reference table
CREATE TABLE job_categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  slug       TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO job_categories (name, slug) VALUES
  ('Technology & Software','technology-software'),
  ('Finance & Accounting','finance-accounting'),
  ('Sales & Marketing','sales-marketing'),
  ('Human Resources','human-resources'),
  ('Legal','legal'),
  ('Healthcare & Medical','healthcare-medical'),
  ('Education & Training','education-training'),
  ('Engineering','engineering'),
  ('Creative & Design','creative-design'),
  ('Customer Service','customer-service'),
  ('Operations & Logistics','operations-logistics'),
  ('Administration','administration'),
  ('Banking & Insurance','banking-insurance'),
  ('Consulting','consulting'),
  ('Media & Communications','media-communications'),
  ('Real Estate','real-estate'),
  ('Oil & Gas','oil-gas'),
  ('Agriculture','agriculture'),
  ('Construction','construction'),
  ('Non-Profit & NGO','non-profit-ngo');

-- Job postings
CREATE TABLE job_postings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id          UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  posted_by           UUID NOT NULL REFERENCES profiles(id),
  category_id         UUID REFERENCES job_categories(id),
  title               TEXT NOT NULL,
  department          TEXT,
  employment_type     employment_type NOT NULL,
  work_mode           work_mode NOT NULL,
  experience_level    experience_level NOT NULL,
  state_id            SMALLINT REFERENCES nigerian_states(id),
  city                TEXT,
  description         TEXT NOT NULL,
  requirements        TEXT,
  benefits            TEXT,
  salary_min          INTEGER,
  salary_max          INTEGER,
  salary_is_confidential BOOLEAN NOT NULL DEFAULT false,
  application_deadline DATE,
  screening_questions JSONB DEFAULT '[]',
  status              job_status NOT NULL DEFAULT 'draft',
  ai_scam_flagged     BOOLEAN NOT NULL DEFAULT false,
  ai_scan_result      JSONB,
  views_count         INTEGER NOT NULL DEFAULT 0,
  applications_count  INTEGER NOT NULL DEFAULT 0,
  published_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_job_postings_updated_at
  BEFORE UPDATE ON job_postings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Required skills per job (many-to-many)
CREATE TABLE job_required_skills (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id      UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  skill_id    UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  is_required BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (job_id, skill_id)
);

-- Saved / bookmarked jobs by candidates
CREATE TABLE saved_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  job_id       UUID NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  saved_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, job_id)
);

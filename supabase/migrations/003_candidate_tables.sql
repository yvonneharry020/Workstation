-- ============================================================
-- 003: Candidate Tables
-- ============================================================

-- Skills reference table (shared by candidates and jobs)
CREATE TABLE skills (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL UNIQUE,
  category   TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Nigerian states reference table
CREATE TABLE nigerian_states (
  id    SMALLSERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  code  TEXT NOT NULL UNIQUE
);

INSERT INTO nigerian_states (name, code) VALUES
  ('Abia','AB'),('Adamawa','AD'),('Akwa Ibom','AK'),('Anambra','AN'),
  ('Bauchi','BA'),('Bayelsa','BY'),('Benue','BE'),('Borno','BO'),
  ('Cross River','CR'),('Delta','DE'),('Ebonyi','EB'),('Edo','ED'),
  ('Ekiti','EK'),('Enugu','EN'),('Federal Capital Territory','FC'),
  ('Gombe','GO'),('Imo','IM'),('Jigawa','JI'),('Kaduna','KD'),
  ('Kano','KN'),('Katsina','KT'),('Kebbi','KB'),('Kogi','KO'),
  ('Kwara','KW'),('Lagos','LA'),('Nasarawa','NA'),('Niger','NI'),
  ('Ogun','OG'),('Ondo','ON'),('Osun','OS'),('Oyo','OY'),
  ('Plateau','PL'),('Rivers','RI'),('Sokoto','SO'),('Taraba','TA'),
  ('Yobe','YO'),('Zamfara','ZA');

-- Candidate profiles
CREATE TABLE candidate_profiles (
  id                    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  first_name            TEXT NOT NULL,
  last_name             TEXT NOT NULL,
  other_names           TEXT,
  headline              TEXT,
  bio                   TEXT,
  avatar_url            TEXT,
  date_of_birth         DATE,
  gender                TEXT,
  state_of_origin_id    SMALLINT REFERENCES nigerian_states(id),
  preferred_state_id    SMALLINT REFERENCES nigerian_states(id),
  nin_number            TEXT,          -- stored encrypted via pgcrypto
  nin_verified          BOOLEAN NOT NULL DEFAULT false,
  liveness_verified     BOOLEAN NOT NULL DEFAULT false,
  phone_verified        BOOLEAN NOT NULL DEFAULT false,
  experience_years      SMALLINT,
  experience_level      experience_level,
  desired_salary_min    INTEGER,
  desired_salary_max    INTEGER,
  salary_is_negotiable  BOOLEAN DEFAULT true,
  preferred_work_mode   work_mode,
  employment_status     TEXT,
  github_url            TEXT,
  linkedin_url          TEXT,
  portfolio_url         TEXT,
  profile_visibility    TEXT NOT NULL DEFAULT 'verified_companies',
  show_profile_views    BOOLEAN NOT NULL DEFAULT true,
  is_open_to_work       BOOLEAN NOT NULL DEFAULT true,
  profile_completion    SMALLINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_candidate_profiles_updated_at
  BEFORE UPDATE ON candidate_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Candidate verification steps tracking
CREATE TABLE candidate_verification (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id          UUID NOT NULL UNIQUE REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  overall_status        verification_status NOT NULL DEFAULT 'not_started',
  -- Step 1: Phone OTP
  phone_otp_status      verification_status NOT NULL DEFAULT 'not_started',
  phone_otp_verified_at TIMESTAMPTZ,
  -- Step 2: NIN
  nin_status            verification_status NOT NULL DEFAULT 'not_started',
  nin_verified_at       TIMESTAMPTZ,
  nin_provider_ref      TEXT,
  nin_failure_reason    TEXT,
  nin_attempt_count     SMALLINT NOT NULL DEFAULT 0,
  -- Step 3: Liveness
  liveness_status       verification_status NOT NULL DEFAULT 'not_started',
  liveness_verified_at  TIMESTAMPTZ,
  liveness_provider_ref TEXT,
  liveness_failure_reason TEXT,
  liveness_attempt_count SMALLINT NOT NULL DEFAULT 0,
  -- Step 4: Documents
  documents_status      verification_status NOT NULL DEFAULT 'not_started',
  documents_reviewed_at TIMESTAMPTZ,
  documents_reviewer_id UUID REFERENCES profiles(id),
  documents_rejection_reason TEXT,
  -- Step 5: Employment history
  employment_history_status verification_status NOT NULL DEFAULT 'not_started',
  -- Admin review
  admin_reviewed_at     TIMESTAMPTZ,
  admin_reviewer_id     UUID REFERENCES profiles(id),
  admin_rejection_reason TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_candidate_verification_updated_at
  BEFORE UPDATE ON candidate_verification
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Candidate skills (many-to-many)
CREATE TABLE candidate_skills (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  skill_id     UUID NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (candidate_id, skill_id)
);

-- Candidate work history
CREATE TABLE candidate_work_history (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id    UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  company_name    TEXT NOT NULL,
  role_title      TEXT NOT NULL,
  employment_type employment_type,
  start_date      DATE NOT NULL,
  end_date        DATE,
  is_current      BOOLEAN NOT NULL DEFAULT false,
  location        TEXT,
  description     TEXT,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_work_history_updated_at
  BEFORE UPDATE ON candidate_work_history
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Candidate education history
CREATE TABLE candidate_education (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id   UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  institution    TEXT NOT NULL,
  degree         TEXT NOT NULL,
  field_of_study TEXT,
  start_year     SMALLINT,
  end_year       SMALLINT,
  grade          TEXT,
  sort_order     SMALLINT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_education_updated_at
  BEFORE UPDATE ON candidate_education
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Documents (used by both candidates and companies)
CREATE TABLE documents (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  document_type   document_type NOT NULL,
  file_name       TEXT NOT NULL,
  storage_path    TEXT NOT NULL,
  file_size_bytes INTEGER,
  mime_type       TEXT,
  scan_status     scan_status NOT NULL DEFAULT 'pending',
  scan_result     JSONB,
  scan_completed_at TIMESTAMPTZ,
  is_verified     BOOLEAN NOT NULL DEFAULT false,
  verified_at     TIMESTAMPTZ,
  verified_by     UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Portfolio items
CREATE TABLE portfolio_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id  UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  description   TEXT,
  project_url   TEXT,
  thumbnail_url TEXT,
  technologies  TEXT[],
  item_type     TEXT NOT NULL DEFAULT 'project',
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_portfolio_items_updated_at
  BEFORE UPDATE ON portfolio_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- CV templates (platform-managed)
CREATE TABLE cv_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  preview_url TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Candidate saved CV versions
CREATE TABLE cv_versions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id UUID NOT NULL REFERENCES candidate_profiles(id) ON DELETE CASCADE,
  template_id  UUID REFERENCES cv_templates(id),
  label        TEXT NOT NULL DEFAULT 'My CV',
  sections     JSONB NOT NULL DEFAULT '{}',
  pdf_url      TEXT,
  generated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_cv_versions_updated_at
  BEFORE UPDATE ON cv_versions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

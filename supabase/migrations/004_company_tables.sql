-- ============================================================
-- 004: Company Tables
-- ============================================================

-- Company profiles
CREATE TABLE company_profiles (
  id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  company_name        TEXT NOT NULL,
  legal_name          TEXT,
  rc_number           TEXT,
  industry            TEXT,
  company_size        company_size,
  founded_year        SMALLINT,
  website_url         TEXT,
  linkedin_url        TEXT,
  twitter_url         TEXT,
  instagram_url       TEXT,
  logo_url            TEXT,
  cover_banner_url    TEXT,
  about               TEXT,
  culture_description TEXT,
  headquarters_state  SMALLINT REFERENCES nigerian_states(id),
  headquarters_city   TEXT,
  headquarters_address TEXT,
  business_email      TEXT NOT NULL,
  business_phone      TEXT,
  -- Email integration
  gmail_connected       BOOLEAN NOT NULL DEFAULT false,
  gmail_account         TEXT,
  outlook_connected     BOOLEAN NOT NULL DEFAULT false,
  outlook_account       TEXT,
  -- Zoom/Meet integration
  zoom_connected        BOOLEAN NOT NULL DEFAULT false,
  zoom_account          TEXT,
  google_meet_connected BOOLEAN NOT NULL DEFAULT false,
  -- CAC verification
  cac_verified          BOOLEAN NOT NULL DEFAULT false,
  cac_verified_at       TIMESTAMPTZ,
  director_nin_verified BOOLEAN NOT NULL DEFAULT false,
  -- Status
  is_profile_complete   BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_company_profiles_updated_at
  BEFORE UPDATE ON company_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Company offices/locations
CREATE TABLE company_locations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  state_id    SMALLINT REFERENCES nigerian_states(id),
  city        TEXT,
  address     TEXT,
  is_primary  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Company team members (additional users under a company)
CREATE TABLE company_team_members (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  member_id   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  email       TEXT NOT NULL,
  role        company_member_role NOT NULL DEFAULT 'recruiter',
  invited_by  UUID REFERENCES profiles(id),
  invited_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (company_id, email)
);

-- Company verification steps
CREATE TABLE company_verification (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id               UUID NOT NULL UNIQUE REFERENCES company_profiles(id) ON DELETE CASCADE,
  overall_status           verification_status NOT NULL DEFAULT 'not_started',
  -- Step 1: CAC / RC Number
  cac_status               verification_status NOT NULL DEFAULT 'not_started',
  cac_verified_at          TIMESTAMPTZ,
  cac_provider_ref         TEXT,
  cac_result               JSONB,
  cac_failure_reason       TEXT,
  -- Step 2: Director identity
  director_nin_status      verification_status NOT NULL DEFAULT 'not_started',
  director_nin_verified_at TIMESTAMPTZ,
  director_nin_provider_ref TEXT,
  -- Step 3: Business email domain
  domain_status            verification_status NOT NULL DEFAULT 'not_started',
  domain_verified_at       TIMESTAMPTZ,
  -- Step 4: Business documents
  documents_status         verification_status NOT NULL DEFAULT 'not_started',
  documents_reviewed_at    TIMESTAMPTZ,
  documents_reviewer_id    UUID REFERENCES profiles(id),
  documents_rejection_reason TEXT,
  -- Step 5: Manual review
  manual_review_status     verification_status NOT NULL DEFAULT 'not_started',
  manual_reviewed_at       TIMESTAMPTZ,
  manual_reviewer_id       UUID REFERENCES profiles(id),
  manual_rejection_reason  TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_company_verification_updated_at
  BEFORE UPDATE ON company_verification
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Company gallery photos
CREATE TABLE company_gallery (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  image_url   TEXT NOT NULL,
  caption     TEXT,
  sort_order  SMALLINT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

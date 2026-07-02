-- ATS Tables: company-created custom tracking spreadsheets
CREATE TABLE ats_tables (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES company_profiles(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ATS Rows: individual entries inside an ATS table
CREATE TABLE ats_rows (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id     UUID NOT NULL REFERENCES ats_tables(id) ON DELETE CASCADE,
  candidate_id UUID REFERENCES candidate_profiles(id) ON DELETE SET NULL,
  label        TEXT NOT NULL,
  stage        TEXT NOT NULL DEFAULT 'prospect',
  notes        TEXT,
  data         JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ats_tables_company_id ON ats_tables(company_id);
CREATE INDEX idx_ats_rows_table_id ON ats_rows(table_id);

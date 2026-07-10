
-- 1. job_id on ats_tables (one table per job post)
ALTER TABLE ats_tables ADD COLUMN IF NOT EXISTS job_id UUID REFERENCES job_postings(id) ON DELETE SET NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ats_tables_job_id_unique') THEN
    ALTER TABLE ats_tables ADD CONSTRAINT ats_tables_job_id_unique UNIQUE (job_id);
  END IF;
END $$;

-- 2. application_id on ats_rows (one row per application)
ALTER TABLE ats_rows ADD COLUMN IF NOT EXISTS application_id UUID REFERENCES job_applications(id) ON DELETE CASCADE;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ats_rows_application_id_unique') THEN
    ALTER TABLE ats_rows ADD CONSTRAINT ats_rows_application_id_unique UNIQUE (application_id);
  END IF;
END $$;

-- 3. company_message on interview_slots
ALTER TABLE interview_slots ADD COLUMN IF NOT EXISTS company_message TEXT;

-- 4. Rename offer_made → hired in pipeline_stage
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'pipeline_stage' AND e.enumlabel = 'offer_made') THEN
    ALTER TYPE pipeline_stage RENAME VALUE 'offer_made' TO 'hired';
  END IF;
END $$;

-- 5. Rename offer_made → hired in application_status
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'application_status' AND e.enumlabel = 'offer_made') THEN
    ALTER TYPE application_status RENAME VALUE 'offer_made' TO 'hired';
  END IF;
END $$;

-- 6. Indexes
CREATE INDEX IF NOT EXISTS idx_ats_tables_job_id ON ats_tables(job_id);
CREATE INDEX IF NOT EXISTS idx_ats_rows_application_id ON ats_rows(application_id);

-- 7. BEFORE INSERT: auto-set pipeline to reviewed when a table exists for the job
CREATE OR REPLACE FUNCTION handle_application_ats_stage()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM ats_tables WHERE job_id = NEW.job_id) AND NEW.pipeline_stage = 'new' THEN
    NEW.pipeline_stage = 'reviewed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_handle_application_ats_stage ON job_applications;
CREATE TRIGGER trg_handle_application_ats_stage
  BEFORE INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION handle_application_ats_stage();

-- 8. AFTER INSERT: auto-create ats_row when candidate applies
CREATE OR REPLACE FUNCTION create_ats_row_for_new_application()
RETURNS TRIGGER AS $$
DECLARE
  v_table_id UUID;
  v_name TEXT;
BEGIN
  SELECT id INTO v_table_id FROM ats_tables WHERE job_id = NEW.job_id LIMIT 1;
  IF v_table_id IS NOT NULL THEN
    SELECT first_name || ' ' || last_name INTO v_name FROM candidate_profiles WHERE id = NEW.candidate_id;
    INSERT INTO ats_rows (table_id, candidate_id, application_id, label, stage)
    VALUES (v_table_id, NEW.candidate_id, NEW.id, COALESCE(v_name, 'Candidate'), 'prospect')
    ON CONFLICT (application_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_create_ats_row_for_new_application ON job_applications;
CREATE TRIGGER trg_create_ats_row_for_new_application
  AFTER INSERT ON job_applications
  FOR EACH ROW EXECUTE FUNCTION create_ats_row_for_new_application();

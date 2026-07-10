
ALTER TABLE job_postings
  ADD COLUMN IF NOT EXISTS screening_type TEXT NOT NULL DEFAULT 'normal'
    CHECK (screening_type IN ('normal', 'timed_quiz')),
  ADD COLUMN IF NOT EXISTS quiz_duration_minutes INTEGER
    CHECK (quiz_duration_minutes IS NULL OR (quiz_duration_minutes >= 5 AND quiz_duration_minutes <= 180));

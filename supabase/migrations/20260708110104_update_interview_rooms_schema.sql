
ALTER TABLE public.interview_rooms
  ADD COLUMN IF NOT EXISTS job_posting_id UUID REFERENCES public.job_postings(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS job_title      TEXT,
  ADD COLUMN IF NOT EXISTS interview_type TEXT NOT NULL DEFAULT 'live',
  ADD COLUMN IF NOT EXISTS scheduled_at   TIMESTAMPTZ;


CREATE TABLE IF NOT EXISTS public.interview_rooms (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room_name     TEXT        NOT NULL,
  room_url      TEXT        NOT NULL,
  label         TEXT        NOT NULL DEFAULT 'Interview Room',
  status        TEXT        NOT NULL DEFAULT 'active',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

ALTER TABLE public.interview_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "company_own_rooms" ON public.interview_rooms
  FOR ALL USING (company_id = auth.uid());

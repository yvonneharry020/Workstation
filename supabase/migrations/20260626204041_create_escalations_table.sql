
CREATE TABLE IF NOT EXISTS escalations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  source_type     text NOT NULL DEFAULT 'manual' CHECK (source_type IN ('ticket','chat','dispute','manual')),
  source_id       uuid,
  subject         text NOT NULL,
  description     text NOT NULL,
  level           text NOT NULL DEFAULT 'L1' CHECK (level IN ('L1','L2','L3')),
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','resolved')),
  assigned_to     text,
  user_name       text,
  user_email      text,
  resolved_at     timestamptz,
  notes           text,
  raised_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  raised_by_email text
);

ALTER TABLE escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated staff can manage escalations"
  ON escalations FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

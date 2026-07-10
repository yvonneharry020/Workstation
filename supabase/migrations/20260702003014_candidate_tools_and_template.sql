
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS tools TEXT[] DEFAULT '{}';

INSERT INTO cv_templates (name, preview_url, sort_order) VALUES
  ('Classic', null, 0),
  ('Modern', null, 1),
  ('Minimal', null, 2)
ON CONFLICT DO NOTHING;

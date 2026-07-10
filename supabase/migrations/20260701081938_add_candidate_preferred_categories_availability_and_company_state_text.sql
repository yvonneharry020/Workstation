
ALTER TABLE candidate_profiles
  ADD COLUMN IF NOT EXISTS preferred_categories text[],
  ADD COLUMN IF NOT EXISTS availability text;

ALTER TABLE company_profiles
  ADD COLUMN IF NOT EXISTS headquarters_state_text text;

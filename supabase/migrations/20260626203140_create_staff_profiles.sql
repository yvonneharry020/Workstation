
CREATE TABLE IF NOT EXISTS staff_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  staff_member_id       uuid REFERENCES staff_members(id) ON DELETE SET NULL,

  full_name             text,
  phone                 text,
  date_of_birth         date,
  gender                text CHECK (gender IN ('male', 'female', 'prefer_not_to_say', 'other')),
  profile_photo_url     text,

  street_address        text,
  city                  text,
  state                 text,
  country               text DEFAULT 'Nigeria',

  emergency_name        text,
  emergency_relationship text,
  emergency_phone       text,

  job_title             text,
  department            text,
  start_date            date,
  bio                   text,

  cv_url                text,
  certificate_urls      text[],
  national_id_type      text CHECK (national_id_type IN ('nin','bvn','passport','drivers_license','voters_card')),
  national_id_number    text,

  profile_complete      boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);

ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff view own profile"
  ON staff_profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Staff insert own profile"
  ON staff_profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff update own profile"
  ON staff_profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

INSERT INTO storage.buckets (id, name, public)
VALUES ('staff-documents', 'staff-documents', false)
ON CONFLICT (id) DO NOTHING;

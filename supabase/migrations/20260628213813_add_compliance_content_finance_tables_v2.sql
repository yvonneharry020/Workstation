
CREATE TABLE IF NOT EXISTS data_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  request_type text NOT NULL CHECK (request_type IN ('access','deletion','portability','correction')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','rejected')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  notes text
);
CREATE INDEX IF NOT EXISTS idx_data_requests_status ON data_requests(status);
ALTER TABLE data_requests ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  category text,
  target_audience text DEFAULT 'all' CHECK (target_audience IN ('candidate','company','all')),
  is_published boolean DEFAULT false,
  view_count int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS tutorials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  video_url text,
  thumbnail_url text,
  target_audience text DEFAULT 'all' CHECK (target_audience IN ('candidate','company','all')),
  step_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  category text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE tutorials ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  owner_user_id uuid,
  owner_email text,
  discount_type text DEFAULT 'percentage' CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric DEFAULT 0,
  uses_count int DEFAULT 0,
  max_uses int,
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS budget_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  month text NOT NULL,
  budgeted_amount numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_budget_entries_month ON budget_entries(month);
ALTER TABLE budget_entries ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS verification_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidate_id uuid NOT NULL,
  doc_type text NOT NULL,
  file_url text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  notes text,
  uploaded_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_verification_documents_candidate ON verification_documents(candidate_id);
ALTER TABLE verification_documents ENABLE ROW LEVEL SECURITY;

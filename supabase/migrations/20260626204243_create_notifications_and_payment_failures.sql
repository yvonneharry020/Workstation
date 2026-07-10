
CREATE TABLE IF NOT EXISTS notifications (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  title         text NOT NULL,
  body          text NOT NULL,
  type          text NOT NULL DEFAULT 'info' CHECK (type IN ('info','warning','success','announcement')),
  target        text NOT NULL DEFAULT 'all' CHECK (target IN ('all','candidates','companies')),
  sent_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_by_email text,
  is_active     boolean NOT NULL DEFAULT true,
  expires_at    timestamptz,
  read_count    integer NOT NULL DEFAULT 0
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notifications"
  ON notifications FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS payment_failures (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  user_id          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name        text,
  user_email       text,
  amount           numeric(15,2),
  currency         text NOT NULL DEFAULT 'NGN',
  payment_method   text,
  error_code       text,
  error_message    text,
  gateway          text,
  gateway_ref      text,
  status           text NOT NULL DEFAULT 'pending_retry' CHECK (status IN ('pending_retry','investigating','resolved','refunded','written_off')),
  retry_count      integer NOT NULL DEFAULT 0,
  resolved_at      timestamptz,
  notes            text,
  investigated_by  text
);

ALTER TABLE payment_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage payment failures"
  ON payment_failures FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

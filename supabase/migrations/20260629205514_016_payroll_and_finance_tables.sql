
-- ============================================================
-- 016: Payroll Runs + Subscription Plans + Finance Snapshots
-- ============================================================

-- ── Payroll runs ─────────────────────────────────────────────
-- One row per month. Stores the finalized payroll summary.
CREATE TABLE payroll_runs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  month               TEXT NOT NULL UNIQUE,        -- YYYY-MM
  pulled_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pulled_by           TEXT,
  status              TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft','approved','paid')),
  total_staff         INTEGER NOT NULL DEFAULT 0,
  total_days_worked   INTEGER NOT NULL DEFAULT 0,
  total_hours_worked  NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_gross_pay     NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_overtime_pay  NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_net_pay       NUMERIC(15,2) NOT NULL DEFAULT 0,
  currency            TEXT NOT NULL DEFAULT 'NGN',
  notes               TEXT,
  approved_by         TEXT,
  approved_at         TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ
);

CREATE TRIGGER trg_payroll_runs_updated_at
  BEFORE UPDATE ON payroll_runs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── Payroll run items ────────────────────────────────────────
-- One row per staff member per payroll run.
CREATE TABLE payroll_run_items (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payroll_run_id        UUID NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
  staff_member_id       UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  staff_name            TEXT NOT NULL,
  staff_email           TEXT NOT NULL,
  department            TEXT,
  role                  TEXT,
  days_worked           INTEGER NOT NULL DEFAULT 0,
  total_hours_worked    NUMERIC(10,2) NOT NULL DEFAULT 0,
  hourly_rate_naira     NUMERIC(12,4) NOT NULL DEFAULT 0,
  monthly_salary_naira  NUMERIC(15,2) NOT NULL DEFAULT 0,
  regular_pay           NUMERIC(15,2) NOT NULL DEFAULT 0,
  overtime_hours        NUMERIC(10,2) NOT NULL DEFAULT 0,
  overtime_pay          NUMERIC(15,2) NOT NULL DEFAULT 0,
  gross_pay             NUMERIC(15,2) NOT NULL DEFAULT 0,
  deductions            NUMERIC(15,2) NOT NULL DEFAULT 0,
  bonuses               NUMERIC(15,2) NOT NULL DEFAULT 0,
  net_pay               NUMERIC(15,2) NOT NULL DEFAULT 0,
  payment_status        TEXT NOT NULL DEFAULT 'pending'
                        CHECK (payment_status IN ('pending','paid','on_hold')),
  paid_at               TIMESTAMPTZ,
  notes                 TEXT
);

CREATE INDEX idx_payroll_run_items_run ON payroll_run_items(payroll_run_id);
CREATE INDEX idx_payroll_run_items_staff ON payroll_run_items(staff_member_id);

-- ── Subscription plans ───────────────────────────────────────
-- Finance team creates plans here; mobile app reads them.
CREATE TABLE subscription_plans (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  name              TEXT NOT NULL,
  description       TEXT,
  user_type         TEXT NOT NULL DEFAULT 'candidate'
                    CHECK (user_type IN ('candidate','company','both')),
  price_monthly     NUMERIC(12,2) NOT NULL DEFAULT 0,
  price_yearly      NUMERIC(12,2),
  currency          TEXT NOT NULL DEFAULT 'NGN',
  billing_cycle     TEXT NOT NULL DEFAULT 'monthly'
                    CHECK (billing_cycle IN ('monthly','yearly','one_time')),
  trial_days        INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('active','draft','archived')),
  is_featured       BOOLEAN NOT NULL DEFAULT FALSE,
  tag               TEXT,
  sort_order        INTEGER NOT NULL DEFAULT 0,
  paystack_plan_code TEXT,
  benefits          JSONB NOT NULL DEFAULT '[]'::JSONB,
  highlights        JSONB NOT NULL DEFAULT '{}'::JSONB,
  metadata          JSONB NOT NULL DEFAULT '{}'::JSONB
);

CREATE TRIGGER trg_subscription_plans_updated_at
  BEFORE UPDATE ON subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_can_read_active_plans"
  ON subscription_plans FOR SELECT
  USING (status = 'active');

-- RLS for payroll (admin only via service role — policies block anon)
ALTER TABLE payroll_runs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_run_items ENABLE ROW LEVEL SECURITY;

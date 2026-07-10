# WORKSTATION

> A trust-first, end-to-end verified recruitment platform built for Nigeria.

WORKSTATION solves the most dangerous problem in the Nigerian job market: neither candidates nor companies can confidently know who they are dealing with. Recruitment fraud costs Nigerian job seekers millions of naira every year. WORKSTATION fixes this from both sides simultaneously.

Every candidate is NIN-verified with a biometric liveness check. Every company is CAC-registered and director-verified. Every employment badge is cryptographically signed and publicly verifiable. Every job application email has open tracking so candidates know the moment their application has been seen.

This is not another job board. This is trust infrastructure for the Nigerian workforce.

---

## What Makes WORKSTATION Different

| Feature | Jobberman | NgCareers | WORKSTATION |
|---|---|---|---|
| Candidate NIN Verification | Partial | No | **Full** |
| Company CAC Verification | Basic | No | **Deep** |
| AI Document Fraud Detection | No | No | **Yes** |
| Airtable-Style ATS | No | No | **Yes** |
| Email Open Tracking | No | No | **Yes** |
| Cryptographic Employment Badges | No | No | **Yes** |
| Built-in CV Builder | Basic | No | **Full** |
| Rich Portfolio Profile | No | No | **Yes** |
| Profile View Intelligence | No | No | **Yes** |
| Integrated Interview Scheduling | No | No | **Yes** |

---

## Platform Sides

| Side | Who | What They Do |
|---|---|---|
| **Candidate App** | Job seekers | Verify identity, browse jobs, apply, track applications, build CV, manage portfolio, receive employment badges |
| **Company App** | Employers | Post jobs, manage applicants in ATS, send bulk email, schedule interviews, issue cryptographic badges |
| **Admin Panel** | Internal team | Superadmin, finance (payroll/invoices/refunds/subscriptions), ops (moderation/support/onboarding), tech (deployments/incidents/monitoring), and staff (clock-in/attendance) dashboards |
| **Public** | Anyone | Browse jobs, view company profiles, verify badges at `/verify/badge/{id}` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo SDK 54 (React Native), Expo Router v6, NativeWind v4 |
| Web | Next.js 15, TypeScript, TailwindCSS |
| Backend | None separate — Supabase (Postgres + Row Level Security + Edge Functions) is the entire backend. There is no Python/FastAPI service anywhere in this repo. |
| Database | Supabase (PostgreSQL), Supabase Realtime |
| Auth | Supabase Auth |
| Email | Resend + custom open-tracking pixel |
| Identity Verification | Smile Identity (NIN, liveness, face match) — **not yet wired up**; production calls currently return a clear "not configured" error rather than a fake pass. Mock mode (`EXPO_PUBLIC_MOCK_VERIFICATION=true`) is used for development. |
| Company Verification | Dojah (CAC registry) — **not yet wired up**, same mock/error pattern as above |
| SMS OTP | Termii — **not yet wired up**, mocked in development (`services/mock/sms.ts`) |
| Payments | Paystack — referenced in the finance schema and admin UI, but refund/cancellation actions currently only update internal database status and do not call the live Paystack API yet |
| Build & Deploy | EAS Build, EAS Submit, Vercel |
| Monorepo | Turborepo |

---

## Project Structure

```
workstation/
├── apps/
│   ├── mobile/          # Expo React Native app (~100 screens across candidate/company/onboarding/auth)
│   └── admin/           # Internal admin panel — Next.js (fully built: admin, finance, ops, tech, staff role dashboards)
├── packages/
│   ├── types/           # Shared TypeScript types (mirrors Supabase schema) — lightly adopted so far
│   └── validators/      # Shared Zod validation schemas — lightly adopted so far
├── supabase/
│   ├── migrations/      # Database migrations — see below for current count
│   └── functions/       # Supabase Edge Functions (server-side-only logic, e.g. third-party API calls)
└── turbo.json
```

The admin panel is not a future phase — it is a large, functioning part of this repo today (over 140 route files across five role-scoped dashboards: superadmin, finance, ops, tech, and staff).

---

## Database Schema

86 tables across all platform domains (run `list_tables` against the live Supabase project for the exact current list — this section covers the major categories, not every table):

- **Users & Trust:** `profiles`, `trust_scores`, `trust_score_events`
- **Candidates:** `candidate_profiles`, `candidate_verification`, `candidate_skills`, `candidate_work_history`, `candidate_education`, `documents`, `portfolio_items`, `cv_versions`
- **Companies:** `company_profiles`, `company_verification`, `company_team_members`, `company_locations`, `company_gallery`
- **Jobs:** `job_postings`, `job_required_skills`, `saved_jobs`
- **Applications & ATS:** `job_applications`, `ats_stage_log`, ATS pipeline tables
- **Email System:** `email_templates`, `emails_sent`, `email_open_events`
- **Interviews:** `interview_slots`, `interview_bookings`, `interview_rooms`
- **Badges:** `badges`, `badge_signatures`, `badge_disputes`
- **Notifications:** `notifications`, `push_tokens`, `notification_preferences`
- **Staff & HR:** `staff_members`, `clock_sessions`, `clock_events`, `staff_work_config`
- **Finance:** `payroll_runs`, `payroll_run_items`, `platform_subscriptions`, `invoices`, `refunds`, `payment_failures`, `platform_costs`
- **Support & Ops:** `support_tickets`, `flagged_content`, `escalations`
- **Tech/Platform monitoring:** `incidents`, `feature_flags`, `webhook_logs`, `audit_logs`
- **Reference:** `nigerian_states`, `otp_codes`

Row Level Security is enabled on every table. If you're changing anything auth/permissions-related, read the actual policies in `supabase/migrations/013_rls_policies.sql` and the later `fix_*` migrations rather than assuming from this list.

---

## Build Phases

| Phase | Focus | Timeline |
|---|---|---|
| **Phase 1** | Auth, verification flows, profiles, job posting + application, basic ATS | Months 1–3 |
| **Phase 2** | Email tracking, badge system, CV builder, bulk email, trust scores, interview scheduling | Months 4–7 |
| **Phase 3** | Daily.co video interview rooms, Meilisearch, Paystack subscriptions, multi-team accounts | Months 8–10 |
| **Phase 4** | AI matching, skills assessments, employer ratings, expansion | Months 11–14 |

---

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)

### Install
```bash
git clone https://github.com/yvonneharry020/Workstation.git
cd workstation
pnpm install
```

### Environment Setup
Each app has its own env file, in its own directory (not `apps/mobile/.env.example` — that path doesn't exist):
```bash
cp .env.example apps/mobile/.env.local              # mobile — EXPO_PUBLIC_* vars
cp apps/admin/.env.example apps/admin/.env.local    # admin — NEXT_PUBLIC_* + service-role key
```
The two apps use different variable prefixes and largely different vars (Supabase service-role key, Resend, Paystack, and Vercel/EAS deployment-monitoring tokens are admin-only) — check each `.env.example` rather than assuming one covers both.

### Run Mobile App
```bash
cd apps/mobile
pnpm start
```

### Run Admin Panel
```bash
cd apps/admin
pnpm dev
```

---

*Built for Nigeria. Ready for Africa.*

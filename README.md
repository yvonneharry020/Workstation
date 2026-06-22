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
| **Admin Panel** | Internal team | Review verification submissions, moderate flagged content, manage platform analytics |
| **Public** | Anyone | Browse jobs, view company profiles, verify badges at `/verify/badge/{id}` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Mobile | Expo (React Native), Expo Router v3, NativeWind v4 |
| Web | Next.js 14, TypeScript, TailwindCSS |
| Backend | FastAPI (Python), Pydantic v2, SQLAlchemy |
| Database | Supabase (PostgreSQL 17), Supabase Realtime |
| Auth | Supabase Auth |
| Email | Resend + custom open-tracking pixel |
| Identity Verification | Smile Identity (NIN, liveness, face match) |
| Company Verification | Dojah (CAC registry) |
| SMS OTP | Termii |
| Payments | Paystack |
| Build & Deploy | EAS Build, EAS Submit, Vercel |
| Monorepo | Turborepo |

---

## Project Structure

```
workstation/
├── apps/
│   ├── mobile/          # Expo React Native app (90 screens)
│   └── admin/           # Internal admin panel — Next.js (coming Phase 2)
├── packages/
│   ├── types/           # Shared TypeScript types (mirrors Supabase schema)
│   └── validators/      # Shared Zod validation schemas
├── supabase/
│   └── migrations/      # 14 database migrations — 42 tables
└── turbo.json
```

---

## Database Schema

42 tables across all platform domains:

- **Users & Trust:** `profiles`, `trust_scores`, `trust_score_events`
- **Candidates:** `candidate_profiles`, `candidate_verification`, `candidate_skills`, `candidate_work_history`, `candidate_education`, `documents`, `portfolio_items`, `cv_templates`, `cv_versions`
- **Companies:** `company_profiles`, `company_verification`, `company_team_members`, `company_locations`, `company_gallery`
- **Jobs:** `job_postings`, `job_categories`, `job_required_skills`, `skills`, `saved_jobs`
- **Applications & ATS:** `job_applications`, `ats_custom_stages`, `ats_stage_log`
- **Email System:** `email_templates`, `emails_sent`, `email_open_events`
- **Interviews:** `interview_slots`, `interview_bookings`
- **Badges:** `badges`, `badge_signatures`, `badge_disputes`
- **Notifications:** `notifications`, `push_tokens`, `notification_preferences`
- **Admin:** `admin_action_log`, `flagged_content`, `platform_config`
- **Reference:** `nigerian_states`, `otp_codes`

---

## Build Phases

| Phase | Focus | Timeline |
|---|---|---|
| **Phase 1** | Auth, verification flows, profiles, job posting + application, basic ATS | Months 1–3 |
| **Phase 2** | Email tracking, badge system, CV builder, bulk email, trust scores, interview scheduling | Months 4–7 |
| **Phase 3** | LiveKit video rooms, Meilisearch, Paystack subscriptions, multi-team accounts | Months 8–10 |
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
```bash
cp apps/mobile/.env.example apps/mobile/.env.local
# Fill in your Supabase URL and anon key
```

### Run Mobile App
```bash
cd apps/mobile
pnpm start
```

---

*Built for Nigeria. Ready for Africa.*

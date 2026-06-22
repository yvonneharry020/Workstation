-- ============================================================
-- 001: Extensions and Enums
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- User roles
CREATE TYPE user_role AS ENUM ('candidate', 'company', 'admin');

-- Verification status
CREATE TYPE verification_status AS ENUM (
  'not_started',
  'pending',
  'in_review',
  'approved',
  'rejected',
  'requires_resubmission'
);

-- Job related enums
CREATE TYPE employment_type AS ENUM (
  'full_time',
  'part_time',
  'contract',
  'internship',
  'freelance'
);

CREATE TYPE work_mode AS ENUM ('remote', 'hybrid', 'on_site');

CREATE TYPE job_status AS ENUM ('draft', 'active', 'paused', 'closed', 'expired');

CREATE TYPE experience_level AS ENUM (
  'entry',
  'junior',
  'mid',
  'senior',
  'lead',
  'executive'
);

-- Application pipeline stages
CREATE TYPE pipeline_stage AS ENUM (
  'new',
  'reviewed',
  'shortlisted',
  'interview_scheduled',
  'offer_made',
  'rejected',
  'withdrawn'
);

-- Application status
CREATE TYPE application_status AS ENUM (
  'submitted',
  'viewed',
  'shortlisted',
  'interview_scheduled',
  'offer_made',
  'rejected',
  'withdrawn'
);

-- Interview status
CREATE TYPE interview_status AS ENUM (
  'pending_booking',
  'booked',
  'confirmed',
  'completed',
  'no_show_candidate',
  'no_show_company',
  'cancelled',
  'rescheduled'
);

-- Badge status
CREATE TYPE badge_status AS ENUM ('active', 'revoked');

-- Notification types
CREATE TYPE notification_type AS ENUM (
  'profile_viewed',
  'application_submitted',
  'application_status_changed',
  'email_opened',
  'interview_scheduled',
  'interview_reminder',
  'badge_received',
  'badge_revoked',
  'job_match',
  'verification_approved',
  'verification_rejected',
  'system'
);

-- Flagged content types
CREATE TYPE flag_content_type AS ENUM (
  'job_posting',
  'company_profile',
  'candidate_profile',
  'badge',
  'document',
  'email'
);

-- Flag status
CREATE TYPE flag_status AS ENUM (
  'pending',
  'reviewed',
  'dismissed',
  'actioned',
  'escalated'
);

-- Document types
CREATE TYPE document_type AS ENUM (
  'nin_document',
  'academic_certificate',
  'professional_certificate',
  'nysc_certificate',
  'cac_certificate',
  'scuml_certificate',
  'proof_of_address',
  'other'
);

-- Document scan status
CREATE TYPE scan_status AS ENUM (
  'pending',
  'processing',
  'passed',
  'flagged',
  'failed'
);

-- Company size
CREATE TYPE company_size AS ENUM (
  '1_10',
  '11_50',
  '51_200',
  '201_500',
  '500_plus'
);

-- Team member role within company
CREATE TYPE company_member_role AS ENUM ('admin', 'recruiter', 'viewer');

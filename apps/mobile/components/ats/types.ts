// Pipeline stages — matches DB enum pipeline_stage
export type PipelineStage =
  | 'new'
  | 'reviewed'
  | 'shortlisted'
  | 'interview_scheduled'
  | 'hired'
  | 'rejected'
  | 'withdrawn'

// Stages a company user can manually set (system manages 'new'; candidates set 'withdrawn')
export const COMPANY_STAGES: PipelineStage[] = [
  'shortlisted',
  'interview_scheduled',
  'hired',
  'rejected',
]

export const PIPELINE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string; border: string }> = {
  new:                 { label: 'New',         color: '#3B82F6', bg: '#EFF6FF', border: '#BFDBFE' },
  reviewed:            { label: 'Reviewing',   color: '#8B5CF6', bg: '#F5F3FF', border: '#C4B5FD' },
  shortlisted:         { label: 'Shortlisted', color: '#7C4B2A', bg: '#F9F1E8', border: '#C49060' },
  interview_scheduled: { label: 'Interview',   color: '#F59E0B', bg: '#FFFBEB', border: '#FDE68A' },
  hired:               { label: 'Hired',       color: '#22C55E', bg: '#F0FDF4', border: '#BBF7D0' },
  rejected:            { label: 'Rejected',    color: '#EF4444', bg: '#FEF2F2', border: '#FECACA' },
  withdrawn:           { label: 'Withdrawn',   color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
}

export const PIPELINE_ORDER: PipelineStage[] = [
  'new',
  'reviewed',
  'shortlisted',
  'interview_scheduled',
  'hired',
  'rejected',
  'withdrawn',
]

// Fully-hydrated row (after JOIN transform) — all data needed for the grid
export interface AtsRowFull {
  id: string
  table_id: string
  application_id: string | null
  candidate_id: string | null
  created_at: string

  // job_applications
  pipeline_stage: PipelineStage
  cover_note: string | null
  screening_answers: Record<string, unknown> | null
  internal_notes: string | null
  skills_match_pct: number | null
  ai_match_analysis: AiMatchAnalysis | null

  // candidate_profiles (flat)
  full_name: string
  gender: string | null
  date_of_birth: string | null
  avatar_url: string | null
  headline: string | null
  bio: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  github_url: string | null
  location: string | null   // nigerian_states.name

  // profiles
  email: string
  phone: string | null
}

// AI scoring — the "why" behind skills_match_pct, written by the
// ats-ai-score edge function. Never shown as a bare percentage — always
// alongside this reasoning.
export interface AiMatchAnalysis {
  matchedCriteria: string[]
  missingCriteria: string[]
  reasoning: string
  criteriaHash: string
  scoredAt: string
  model: string
}

export interface AiMatchCriteria {
  customInstructions: string
  mustHaveSkills: string[]
  niceToHaveSkills: string[]
  minYearsExperience: number | null
  requiredDegree: string | null
  requiredBadges: ('admin' | 'company')[]
  allowedColumns: string[]
  updatedAt?: string
}

export const AI_MATCH_COLUMNS: { key: string; label: string }[] = [
  { key: 'full_name', label: 'Full Name' },
  { key: 'cover',     label: 'Cover Letter' },
  { key: 'profile',   label: 'Profile (skills, work history, education)' },
  { key: 'screening', label: 'Screening Answers' },
]

// Raw shape from Supabase join (before transform)
export interface AtsRowRaw {
  id: string
  table_id: string
  application_id: string | null
  candidate_id: string | null
  created_at: string
  job_applications: {
    pipeline_stage: string
    cover_note: string | null
    screening_answers: Record<string, unknown> | null
    internal_notes: string | null
    skills_match_pct: number | null
    ai_match_analysis: AiMatchAnalysis | null
  } | null
  candidate_profiles: {
    first_name: string
    last_name: string
    gender: string | null
    date_of_birth: string | null
    avatar_url: string | null
    headline: string | null
    bio: string | null
    linkedin_url: string | null
    portfolio_url: string | null
    github_url: string | null
    nigerian_states: { name: string } | null
  } | null
}

export function transformAtsRow(
  raw: AtsRowRaw,
  profileMap: Record<string, { email: string; phone: string | null }>,
): AtsRowFull {
  const cp = raw.candidate_profiles
  const ja = raw.job_applications
  const pr = raw.candidate_id ? (profileMap[raw.candidate_id] ?? null) : null

  return {
    id:             raw.id,
    table_id:       raw.table_id,
    application_id: raw.application_id,
    candidate_id:   raw.candidate_id,
    created_at:     raw.created_at,

    pipeline_stage:    (ja?.pipeline_stage ?? 'new') as PipelineStage,
    cover_note:        ja?.cover_note ?? null,
    screening_answers: ja?.screening_answers ?? null,
    internal_notes:    ja?.internal_notes ?? null,
    skills_match_pct:  ja?.skills_match_pct ?? null,
    ai_match_analysis: ja?.ai_match_analysis ?? null,

    full_name:    cp ? `${cp.first_name} ${cp.last_name}`.trim() : 'Unknown',
    gender:       cp?.gender ?? null,
    date_of_birth: cp?.date_of_birth ?? null,
    avatar_url:   cp?.avatar_url ?? null,
    headline:     cp?.headline ?? null,
    bio:          cp?.bio ?? null,
    linkedin_url: cp?.linkedin_url ?? null,
    portfolio_url: cp?.portfolio_url ?? null,
    github_url:   cp?.github_url ?? null,
    location:     cp?.nigerian_states?.name ?? null,

    email: pr?.email ?? '',
    phone: pr?.phone ?? null,
  }
}

export function calcAge(dateOfBirth: string | null): string {
  if (!dateOfBirth) return '—'
  const dob   = new Date(dateOfBirth)
  const today = new Date()
  let age = today.getFullYear() - dob.getFullYear()
  const m = today.getMonth() - dob.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--
  return age >= 0 ? String(age) : '—'
}

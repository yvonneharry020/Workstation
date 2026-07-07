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
  'hired',
  'rejected',
]

export const PIPELINE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string; border: string }> = {
  new:                 { label: 'New',         color: '#94A3B8', bg: '#F1F5F9', border: '#CBD5E1' },
  reviewed:            { label: 'Reviewing',   color: '#0EA5E9', bg: '#E0F2FE', border: '#BAE6FD' },
  shortlisted:         { label: 'Shortlisted', color: '#F59E0B', bg: '#FEF3C7', border: '#FDE68A' },
  interview_scheduled: { label: 'Interview',   color: '#8B5CF6', bg: '#EDE9FE', border: '#C4B5FD' },
  hired:               { label: 'Hired',       color: '#0DD4C3', bg: '#CCFBF1', border: '#99F6E4' },
  rejected:            { label: 'Rejected',    color: '#EF4444', bg: '#FEE2E2', border: '#FECACA' },
  withdrawn:           { label: 'Withdrawn',   color: '#9CA3AF', bg: '#F3F4F6', border: '#E5E7EB' },
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

export type RowStage =
  | 'prospect'
  | 'contacted'
  | 'interviewing'
  | 'offer'
  | 'hired'
  | 'rejected'

export interface AtsRowData {
  email?: string
  phone?: string
  location?: string
  role?: string
  cover_letter?: string
  profile_url?: string
}

export interface AtsRow {
  id: string
  table_id: string
  candidate_id: string | null
  label: string
  stage: RowStage
  notes: string | null
  data: AtsRowData | null
  created_at: string
}

export const STAGE_CONFIG: Record<
  RowStage,
  { label: string; color: string; bg: string; border: string }
> = {
  prospect:     { label: 'Prospect',     color: '#6366F1', bg: '#EEF2FF', border: '#C7D2FE' },
  contacted:    { label: 'Contacted',    color: '#0EA5E9', bg: '#E0F2FE', border: '#BAE6FD' },
  interviewing: { label: 'Interviewing', color: '#F59E0B', bg: '#FEF3C7', border: '#FDE68A' },
  offer:        { label: 'Offer',        color: '#10B981', bg: '#D1FAE5', border: '#A7F3D0' },
  hired:        { label: 'Hired',        color: '#0DD4C3', bg: '#CCFBF1', border: '#99F6E4' },
  rejected:     { label: 'Rejected',     color: '#EF4444', bg: '#FEE2E2', border: '#FECACA' },
}

export const STAGE_ORDER: RowStage[] = [
  'prospect',
  'contacted',
  'interviewing',
  'offer',
  'hired',
  'rejected',
]

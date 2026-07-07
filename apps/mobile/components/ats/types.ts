export type RowStage = 'prospect' | 'contacted' | 'interviewing' | 'offer' | 'hired' | 'rejected'

export interface AtsRow {
  id: string
  table_id: string
  candidate_id: string | null
  label: string
  stage: RowStage
  notes: string | null
  created_at: string
}

export const STAGE_CONFIG: Record<RowStage, { label: string; color: string; bg: string }> = {
  prospect:     { label: 'Prospect',     color: '#818CF8', bg: 'rgba(129,140,248,0.12)' },
  contacted:    { label: 'Contacted',    color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
  interviewing: { label: 'Interviewing', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  offer:        { label: 'Offer',        color: '#22C55E', bg: 'rgba(34,197,94,0.12)'  },
  hired:        { label: 'Hired',        color: '#0DD4C3', bg: 'rgba(13,212,195,0.12)' },
  rejected:     { label: 'Rejected',     color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
}

export const STAGE_ORDER: RowStage[] = [
  'prospect',
  'contacted',
  'interviewing',
  'offer',
  'hired',
  'rejected',
]

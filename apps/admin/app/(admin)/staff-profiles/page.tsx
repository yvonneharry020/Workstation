import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Staff Profiles' }

interface StaffRow {
  id: string
  email: string
  full_name: string | null
  role: string
  is_active: boolean
}

interface ProfileRow {
  staff_member_id: string
  full_name: string | null
  phone: string | null
  date_of_birth: string | null
  gender: string | null
  nationality: string | null
  street_address: string | null
  city: string | null
  state: string | null
  country: string | null
  emergency_name: string | null
  emergency_phone: string | null
  linkedin_url: string | null
  national_id_type: string | null
  education: unknown[]
  work_history: unknown[]
  cv_url: string | null
  locked_fields: Record<string, boolean>
}

const PERSONAL_KEYS = [
  'full_name', 'phone', 'date_of_birth', 'gender', 'nationality',
  'street_address', 'city', 'state', 'country', 'emergency_name',
  'emergency_phone', 'linkedin_url', 'national_id_type',
]

function calcCompletion(profile: ProfileRow | null): number {
  if (!profile) return 0
  const locked = profile.locked_fields ?? {}
  const personal = PERSONAL_KEYS.filter(k => locked[k]).length
  const edu      = Array.isArray(profile.education) && profile.education.length > 0 ? 1 : 0
  const work     = Array.isArray(profile.work_history) && profile.work_history.length > 0 ? 1 : 0
  const cv       = locked.cv ? 1 : 0
  const total    = PERSONAL_KEYS.length + 3
  return Math.round(((personal + edu + work + cv) / total) * 100)
}

function RoleChip({ role }: { role: string }) {
  const map: Record<string, string> = {
    staff:      'bg-blue-500/10 text-blue-400 border-blue-500/20',
    viewer:     'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    admin:      'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    superadmin: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  }
  const cls = map[role] ?? 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wide border rounded-full px-2 py-0.5 ${cls}`}>
      {role}
    </span>
  )
}

function CompletionBar({ pct }: { pct: number }) {
  const color = pct === 100 ? 'bg-emerald-500' : pct >= 50 ? 'bg-amber-500' : 'bg-rose-500'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[11px] font-mono font-medium min-w-[32px] text-right"
        style={{ color: 'var(--tx-2)' }}>
        {pct}%
      </span>
    </div>
  )
}

export default async function StaffProfilesPage() {
  const admin = createAdminClient()

  const [{ data: members }, { data: profiles }] = await Promise.all([
    admin.from('staff_members').select('id,email,full_name,role,is_active').order('full_name'),
    admin.from('staff_profiles').select('*'),
  ])

  const profileMap = new Map<string, ProfileRow>()
  for (const p of profiles ?? []) {
    profileMap.set(p.staff_member_id, p as ProfileRow)
  }

  const rows = (members ?? []).map(m => ({
    ...(m as StaffRow),
    profile: profileMap.get(m.id) ?? null,
    completion: calcCompletion(profileMap.get(m.id) ?? null),
  }))

  const total    = rows.length
  const complete = rows.filter(r => r.completion === 100).length
  const started  = rows.filter(r => r.completion > 0 && r.completion < 100).length

  return (
    <div className="p-6 max-w-5xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--tx-1)' }}>
          Staff Profiles
        </h1>
        <p className="text-[13px] mt-1" style={{ color: 'var(--tx-3)' }}>
          View each staff member&apos;s onboarding profile and CV
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total Staff',        value: total,    color: 'text-indigo-400' },
          { label: 'Profiles Complete',  value: complete, color: 'text-emerald-400' },
          { label: 'In Progress',        value: started,  color: 'text-amber-400' },
        ].map(c => (
          <div key={c.label}
            className="rounded-xl p-4 border"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--tx-3)' }}>{c.label}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ borderBottomColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
              className="border-b">
              <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide"
                style={{ color: 'var(--tx-3)' }}>Name</th>
              <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide"
                style={{ color: 'var(--tx-3)' }}>Email</th>
              <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide"
                style={{ color: 'var(--tx-3)' }}>Role</th>
              <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide w-40"
                style={{ color: 'var(--tx-3)' }}>Profile</th>
              <th className="text-left px-4 py-3 font-semibold text-[11px] uppercase tracking-wide"
                style={{ color: 'var(--tx-3)' }}>CV</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.id}
                style={{
                  borderBottomColor: i < rows.length - 1 ? 'var(--border)' : undefined,
                  opacity: row.is_active ? 1 : 0.5,
                }}
                className={i < rows.length - 1 ? 'border-b' : ''}>
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--tx-1)' }}>
                  {row.profile?.full_name ?? row.full_name ?? '—'}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--tx-2)' }}>{row.email}</td>
                <td className="px-4 py-3">
                  <RoleChip role={row.role} />
                </td>
                <td className="px-4 py-3 w-40">
                  <CompletionBar pct={row.completion} />
                </td>
                <td className="px-4 py-3">
                  {row.profile?.cv_url ? (
                    <span className="text-[11px] text-emerald-400 font-medium">Uploaded</span>
                  ) : (
                    <span className="text-[11px]" style={{ color: 'var(--tx-3)' }}>None</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/staff-profiles/${row.id}`}
                    className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[13px]"
                  style={{ color: 'var(--tx-3)' }}>
                  No staff members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const metadata = { title: 'Staff Profile' }

interface EducationEntry {
  id: string
  institution: string
  degree: string
  field_of_study: string
  start_year: number
  end_year: number | null
  grade: string
}

interface WorkEntry {
  id: string
  company: string
  position: string
  start_date: string
  end_date: string | null
  is_current: boolean
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: 'var(--tx-3)' }}>
        {label}
      </p>
      <p className="text-[13px]" style={{ color: value ? 'var(--tx-1)' : 'var(--tx-3)' }}>
        {value || '—'}
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border p-5 mb-4"
      style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <h2 className="text-[13px] font-bold uppercase tracking-wide mb-4"
        style={{ color: 'var(--tx-2)' }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

export default async function StaffProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const admin = createAdminClient()

  const [{ data: member }, { data: profile }] = await Promise.all([
    admin.from('staff_members').select('*').eq('id', id).maybeSingle(),
    admin.from('staff_profiles').select('*').eq('staff_member_id', id).maybeSingle(),
  ])

  if (!member) notFound()

  const edu: EducationEntry[]  = (profile?.education   as EducationEntry[])  ?? []
  const work: WorkEntry[]      = (profile?.work_history as WorkEntry[])       ?? []
  const locked: Record<string, boolean> = (profile?.locked_fields as Record<string, boolean>) ?? {}

  const PERSONAL_KEYS = [
    'full_name', 'phone', 'date_of_birth', 'gender', 'nationality',
    'street_address', 'city', 'state', 'country', 'emergency_name',
    'emergency_phone', 'linkedin_url', 'national_id_type',
  ]
  const filledPersonal = PERSONAL_KEYS.filter(k => locked[k]).length
  const total          = PERSONAL_KEYS.length + 3
  const pct = profile
    ? Math.round(((filledPersonal + (edu.length > 0 ? 1 : 0) + (work.length > 0 ? 1 : 0) + (locked.cv ? 1 : 0)) / total) * 100)
    : 0

  const cvUrl = profile?.cv_url as string | null

  return (
    <div className="p-6 max-w-3xl">
      {/* Back + header */}
      <div className="mb-6">
        <Link href="/staff-profiles"
          className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors mb-3 inline-block">
          ← All Staff Profiles
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold font-display" style={{ color: 'var(--tx-1)' }}>
              {profile?.full_name ?? member.full_name ?? member.email}
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{member.email}</p>
          </div>
          <div className="text-right">
            <p className="text-[28px] font-bold leading-none"
              style={{ color: pct === 100 ? '#10B981' : pct >= 50 ? '#F59E0B' : '#F43F5E' }}>
              {pct}%
            </p>
            <p className="text-[11px] mt-1" style={{ color: 'var(--tx-3)' }}>complete</p>
          </div>
        </div>
      </div>

      {/* Personal info */}
      <Section title="Personal Information">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name"       value={profile?.full_name} />
          <Field label="Email"           value={profile?.email ?? member.email} />
          <Field label="Phone"           value={profile?.phone} />
          <Field label="Date of Birth"   value={profile?.date_of_birth} />
          <Field label="Gender"          value={profile?.gender} />
          <Field label="Nationality"     value={profile?.nationality} />
          <Field label="Street Address"  value={profile?.street_address} />
          <Field label="City"            value={profile?.city} />
          <Field label="State"           value={profile?.state} />
          <Field label="Country"         value={profile?.country} />
          <Field label="LinkedIn"        value={profile?.linkedin_url} />
          <Field label="National ID Type" value={profile?.national_id_type} />
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[11px] font-semibold uppercase tracking-wide mb-2"
            style={{ color: 'var(--tx-3)' }}>Emergency Contact</p>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name"  value={profile?.emergency_name} />
            <Field label="Phone" value={profile?.emergency_phone} />
          </div>
        </div>
      </Section>

      {/* Education */}
      <Section title="Education">
        {edu.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No education entries added yet.</p>
        ) : (
          <div className="space-y-3">
            {edu.map((e) => (
              <div key={e.id} className="rounded-lg p-3 border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                  {e.degree} in {e.field_of_study}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-2)' }}>{e.institution}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--tx-3)' }}>
                  {e.start_year} – {e.end_year ?? 'Present'}
                  {e.grade ? ` · Grade: ${e.grade}` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Work history */}
      <Section title="Work Experience">
        {work.length === 0 ? (
          <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No work history entries added yet.</p>
        ) : (
          <div className="space-y-3">
            {work.map((w) => (
              <div key={w.id} className="rounded-lg p-3 border"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                  {w.position}
                </p>
                <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-2)' }}>{w.company}</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--tx-3)' }}>
                  {w.start_date} – {w.is_current ? 'Present' : (w.end_date ?? '—')}
                </p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* CV */}
      <Section title="Curriculum Vitae">
        {!cvUrl ? (
          <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No CV uploaded yet.</p>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-[13px] font-medium" style={{ color: 'var(--tx-1)' }}>
                  {profile?.cv_filename ?? 'CV Document'}
                </p>
                {profile?.cv_size_bytes ? (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                    {(Number(profile.cv_size_bytes) / 1024 / 1024).toFixed(2)} MB
                  </p>
                ) : null}
              </div>
              <a
                href={cvUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Open in new tab ↗
              </a>
            </div>
            {/* Inline PDF viewer */}
            <div className="rounded-lg overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
              <iframe
                src={cvUrl}
                className="w-full"
                style={{ height: '600px' }}
                title="Staff CV"
              />
            </div>
          </div>
        )}
      </Section>
    </div>
  )
}

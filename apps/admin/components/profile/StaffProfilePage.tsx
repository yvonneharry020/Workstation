'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  getOrCreateProfileAction,
  savePersonalFieldsAction,
  addEducationEntryAction,
  addWorkEntryAction,
  saveCvAction,
} from '@/lib/profile-actions'
import type { StaffProfile, EducationEntry, WorkEntry } from '@/lib/profile-actions'
import { Lock, Plus, Upload, Check, Loader2, AlertCircle, X } from 'lucide-react'

// ─── Completion ───────────────────────────────────────────────────────────────

const PERSONAL_KEYS = [
  'full_name','phone','date_of_birth','gender','nationality',
  'street_address','city','state','country',
  'emergency_name','emergency_phone','linkedin_url','national_id_type',
]

function calcCompletion(p: StaffProfile): number {
  const locked = p.locked_fields
  const personal = PERSONAL_KEYS.filter(k => locked[k]).length
  const hasEdu  = p.education.some(e => e.locked)
  const hasWork = p.work_history.some(w => w.locked)
  const hasCv   = !!locked.cv
  const total   = PERSONAL_KEYS.length + 3
  return Math.round(((personal + (hasEdu ? 1 : 0) + (hasWork ? 1 : 0) + (hasCv ? 1 : 0)) / total) * 100)
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function CompletionRing({ pct }: { pct: number }) {
  const r = 22
  const circ = 2 * Math.PI * r
  return (
    <svg width="60" height="60" className="-rotate-90">
      <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="5"/>
      <circle cx="30" cy="30" r={r} fill="none" stroke="#6366f1" strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={circ - (pct / 100) * circ}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.7s ease' }}/>
    </svg>
  )
}

function Field({ label, value, locked, editing, children }: {
  label: string
  value?: string | null
  locked?: boolean
  editing?: boolean
  children?: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>
          {label}
        </span>
        {locked && <Lock size={9} className="text-indigo-400 flex-shrink-0" />}
      </div>
      {editing && !locked ? (
        children
      ) : (
        <p className={`text-[13px] leading-snug ${value ? '' : 'italic'}`}
          style={{ color: value ? 'var(--tx-1)' : 'var(--tx-3)' }}>
          {value || 'Not filled'}
        </p>
      )}
    </div>
  )
}

function Input({ value, onChange, placeholder, type = 'text', disabled }: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full text-[13px] px-3 py-2 rounded-lg border outline-none transition-colors
        disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
        color: 'var(--tx-1)',
      }}
    />
  )
}

function Select({ value, onChange, options, disabled }: {
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
}) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      className="w-full text-[13px] px-3 py-2 rounded-lg border outline-none
        disabled:opacity-50 disabled:cursor-not-allowed"
      style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}>
      <option value="">Select…</option>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function SectionCard({ title, icon, badge, children }: {
  title: string
  icon: React.ReactNode
  badge?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)' }}>
      <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <span style={{ color: 'var(--tx-3)' }}>{icon}</span>
          <h2 className="text-[15px] font-semibold" style={{ color: 'var(--tx-1)' }}>{title}</h2>
        </div>
        {badge}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  )
}

function SaveBtn({ saving, saved, onClick, disabled }: {
  saving: boolean; saved: boolean; onClick: () => void; disabled?: boolean
}) {
  return (
    <button onClick={onClick} disabled={saving || disabled}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40
        ${saved ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-600/30' : 'bg-indigo-600 hover:bg-indigo-700 text-white'}`}>
      {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
      {saving ? 'Saving…' : saved ? 'Saved' : 'Save & Lock Fields'}
    </button>
  )
}

// ─── Personal Section ─────────────────────────────────────────────────────────

function PersonalSection({ profile, onUpdated }: {
  profile: StaffProfile
  onUpdated: (locked: Record<string, boolean>, updates: Record<string, string>) => void
}) {
  const locked = profile.locked_fields
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    full_name:              profile.full_name ?? '',
    phone:                  profile.phone ?? '',
    date_of_birth:          profile.date_of_birth ?? '',
    gender:                 profile.gender ?? '',
    nationality:            profile.nationality ?? '',
    street_address:         profile.street_address ?? '',
    city:                   profile.city ?? '',
    state:                  profile.state ?? '',
    country:                profile.country ?? '',
    emergency_name:         profile.emergency_name ?? '',
    emergency_relationship: profile.emergency_relationship ?? '',
    emergency_phone:        profile.emergency_phone ?? '',
    linkedin_url:           profile.linkedin_url ?? '',
    national_id_type:       profile.national_id_type ?? '',
    national_id_number:     profile.national_id_number ?? '',
    bio:                    profile.bio ?? '',
  })

  const hasUnlocked = PERSONAL_KEYS.some(k => !locked[k])
  const allLocked   = PERSONAL_KEYS.every(k => locked[k])

  async function handleSave() {
    setSaving(true)
    setError(null)
    const result = await savePersonalFieldsAction(profile.staff_member_id, form)
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setSaved(true)
    setEditing(false)
    onUpdated(result.lockedFields ?? locked, form)
    setTimeout(() => setSaved(false), 3000)
  }

  const f = (key: string) => form[key as keyof typeof form]
  const set = (key: string) => (v: string) => setForm(prev => ({ ...prev, [key]: v }))
  const display = (key: keyof typeof form) => {
    const raw = profile[key as keyof StaffProfile]
    return typeof raw === 'string' ? raw : null
  }

  return (
    <SectionCard
      title="Personal Information"
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
      badge={
        allLocked ? (
          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
            <Lock size={9}/> Locked
          </span>
        ) : !editing ? (
          <button onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--tx-2)' }}>
            Edit
          </button>
        ) : null
      }
    >
      <div className="grid grid-cols-2 gap-x-6 gap-y-5">
        {/* Row 1 */}
        <Field label="Full Name" value={display('full_name')} locked={locked.full_name} editing={editing}>
          <Input value={f('full_name')} onChange={set('full_name')} placeholder="Your legal full name" />
        </Field>
        <Field label="Email Address">
          <p className="text-[13px]" style={{ color: 'var(--tx-2)' }}>{profile.email ?? '—'}</p>
        </Field>

        {/* Row 2 */}
        <Field label="Phone Number" value={display('phone')} locked={locked.phone} editing={editing}>
          <Input value={f('phone')} onChange={set('phone')} placeholder="+234 800 000 0000" />
        </Field>
        <Field label="Date of Birth" value={display('date_of_birth')} locked={locked.date_of_birth} editing={editing}>
          <Input type="date" value={f('date_of_birth')} onChange={set('date_of_birth')} />
        </Field>

        {/* Row 3 */}
        <Field label="Gender" value={profile.gender ? profile.gender.replace('_', ' ') : null} locked={locked.gender} editing={editing}>
          <Select value={f('gender')} onChange={set('gender')} options={[
            { value: 'male', label: 'Male' },
            { value: 'female', label: 'Female' },
            { value: 'other', label: 'Other' },
            { value: 'prefer_not_to_say', label: 'Prefer not to say' },
          ]} />
        </Field>
        <Field label="Nationality" value={display('nationality')} locked={locked.nationality} editing={editing}>
          <Input value={f('nationality')} onChange={set('nationality')} placeholder="e.g. Nigerian" />
        </Field>

        {/* Row 4 — Address spanning full width */}
        <div className="col-span-2">
          <Field label="Street Address" value={display('street_address')} locked={locked.street_address} editing={editing}>
            <Input value={f('street_address')} onChange={set('street_address')} placeholder="House number, street name" />
          </Field>
        </div>

        {/* Row 5 */}
        <Field label="City" value={display('city')} locked={locked.city} editing={editing}>
          <Input value={f('city')} onChange={set('city')} placeholder="e.g. Lagos" />
        </Field>
        <Field label="State / Province" value={display('state')} locked={locked.state} editing={editing}>
          <Input value={f('state')} onChange={set('state')} placeholder="e.g. Lagos State" />
        </Field>

        {/* Row 6 */}
        <Field label="Country" value={display('country')} locked={locked.country} editing={editing}>
          <Input value={f('country')} onChange={set('country')} placeholder="e.g. Nigeria" />
        </Field>
        <Field label="LinkedIn URL" value={display('linkedin_url')} locked={locked.linkedin_url} editing={editing}>
          <Input value={f('linkedin_url')} onChange={set('linkedin_url')} placeholder="https://linkedin.com/in/yourname" />
        </Field>

        {/* National ID */}
        <Field label="ID Type" value={display('national_id_type')} locked={locked.national_id_type} editing={editing}>
          <Select value={f('national_id_type')} onChange={set('national_id_type')} options={[
            { value: 'NIN', label: 'National ID (NIN)' },
            { value: 'BVN', label: 'Bank Verification No. (BVN)' },
            { value: 'Passport', label: 'International Passport' },
            { value: "Driver's License", label: "Driver's License" },
            { value: 'Voter Card', label: "Voter's Card" },
          ]} />
        </Field>
        <Field label="ID Number" value={display('national_id_number')} locked={locked.national_id_number} editing={editing}>
          <Input value={f('national_id_number')} onChange={set('national_id_number')} placeholder="ID number" />
        </Field>

        {/* Emergency contact */}
        <div className="col-span-2 pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--tx-3)' }}>Emergency Contact</p>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Contact Name" value={display('emergency_name')} locked={locked.emergency_name} editing={editing}>
              <Input value={f('emergency_name')} onChange={set('emergency_name')} placeholder="Full name" />
            </Field>
            <Field label="Relationship" value={display('emergency_relationship')} locked={locked.emergency_relationship} editing={editing}>
              <Input value={f('emergency_relationship')} onChange={set('emergency_relationship')} placeholder="e.g. Mother" />
            </Field>
            <Field label="Contact Phone" value={display('emergency_phone')} locked={locked.emergency_phone} editing={editing}>
              <Input value={f('emergency_phone')} onChange={set('emergency_phone')} placeholder="+234 800 000 0000" />
            </Field>
          </div>
        </div>

        {/* Bio */}
        <div className="col-span-2">
          <Field label="Short Bio" value={display('bio')} locked={locked.bio} editing={editing}>
            <textarea
              value={f('bio')} onChange={e => set('bio')(e.target.value)}
              placeholder="A brief professional summary about yourself…"
              rows={3}
              className="w-full text-[13px] px-3 py-2 rounded-lg border outline-none resize-none"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
            />
          </Field>
        </div>
      </div>

      {editing && (
        <div className="mt-5 pt-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border)' }}>
          <SaveBtn saving={saving} saved={saved} onClick={handleSave} />
          <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm font-medium"
            style={{ color: 'var(--tx-3)' }}>Cancel</button>
          {error && (
            <span className="flex items-center gap-1.5 text-[12px] text-rose-400">
              <AlertCircle size={13}/>{error}
            </span>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Education Section ────────────────────────────────────────────────────────

const DEGREES = [
  'High School Certificate (WAEC/NECO)',
  'Ordinary National Diploma (OND)',
  'Higher National Diploma (HND)',
  'Bachelor\'s Degree (B.Sc / B.A / B.Eng)',
  'Postgraduate Diploma (PGD)',
  'Master\'s Degree (M.Sc / M.A / MBA)',
  'Doctor of Philosophy (Ph.D)',
  'Professional Certificate',
  'Other',
]

const EMPTY_EDU = {
  institution: '', degree: '', field_of_study: '',
  start_year: '', end_year: '', grade: '',
}

function EducationSection({ profile, onUpdated }: {
  profile: StaffProfile
  onUpdated: (entries: EducationEntry[]) => void
}) {
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [form, setForm]       = useState(EMPTY_EDU)

  const set = (k: string) => (v: string) => setForm(p => ({ ...p, [k]: v }))

  async function handleAdd() {
    if (!form.institution || !form.degree || !form.field_of_study || !form.start_year) {
      setError('Institution, degree, field of study, and start year are required.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await addEducationEntryAction(profile.staff_member_id, {
      institution:   form.institution,
      degree:        form.degree,
      field_of_study:form.field_of_study,
      start_year:    Number(form.start_year),
      end_year:      form.end_year ? Number(form.end_year) : null,
      grade:         form.grade,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setSaved(true)
    setAdding(false)
    setForm(EMPTY_EDU)
    onUpdated([...profile.education, result.entry!])
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <SectionCard
      title="Education Background"
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>}
      badge={
        saved ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <Check size={11}/> Saved
          </span>
        ) : null
      }
    >
      {/* Existing locked entries */}
      {profile.education.length > 0 && (
        <div className="space-y-3 mb-5">
          {profile.education.map(e => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3.5 rounded-xl border"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <Lock size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>{e.institution}</p>
                <p className="text-[12px]" style={{ color: 'var(--tx-2)' }}>
                  {e.degree} — {e.field_of_study}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                  {e.start_year}{e.end_year ? ` – ${e.end_year}` : ' – Present'}
                  {e.grade && <> &middot; {e.grade}</>}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold" style={{ color: 'var(--tx-2)' }}>New Education Entry</p>
            <button onClick={() => { setAdding(false); setForm(EMPTY_EDU); setError(null) }}>
              <X size={14} style={{ color: 'var(--tx-3)' }} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Institution / School *</label>
              <Input value={form.institution} onChange={set('institution')} placeholder="e.g. University of Lagos" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Degree / Certificate *</label>
              <Select value={form.degree} onChange={set('degree')} options={DEGREES.map(d => ({ value: d, label: d }))} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Field of Study *</label>
              <Input value={form.field_of_study} onChange={set('field_of_study')} placeholder="e.g. Computer Science" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Start Year *</label>
              <Input type="number" value={form.start_year} onChange={set('start_year')} placeholder="e.g. 2016" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>End Year (leave blank if ongoing)</label>
              <Input type="number" value={form.end_year} onChange={set('end_year')} placeholder="e.g. 2020" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Grade / Class of Degree</label>
              <Input value={form.grade} onChange={set('grade')} placeholder="e.g. Second Class Upper (2:1)" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SaveBtn saving={saving} saved={false} onClick={handleAdd} />
            {error && (
              <span className="flex items-center gap-1.5 text-[12px] text-rose-400">
                <AlertCircle size={12}/>{error}
              </span>
            )}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>
            Once saved, this entry is permanently locked and cannot be edited.
          </p>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-colors w-full justify-center"
          style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', borderStyle: 'dashed' }}>
          <Plus size={14}/> Add Education
        </button>
      )}
    </SectionCard>
  )
}

// ─── Work History Section ─────────────────────────────────────────────────────

const EMPTY_WORK = {
  company: '', position: '', start_date: '', end_date: '', is_current: false,
}

function WorkSection({ profile, onUpdated }: {
  profile: StaffProfile
  onUpdated: (entries: WorkEntry[]) => void
}) {
  const [adding, setAdding]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [form, setForm]       = useState(EMPTY_WORK)

  const set = (k: string) => (v: string | boolean) =>
    setForm(p => ({ ...p, [k]: v }))

  async function handleAdd() {
    if (!form.company || !form.position || !form.start_date) {
      setError('Company name, job title, and start date are required.')
      return
    }
    setSaving(true)
    setError(null)
    const result = await addWorkEntryAction(profile.staff_member_id, {
      company:    form.company,
      position:   form.position,
      start_date: form.start_date,
      end_date:   form.is_current ? null : (form.end_date || null),
      is_current: form.is_current,
    })
    setSaving(false)
    if (result.error) { setError(result.error); return }
    setSaved(true)
    setAdding(false)
    setForm(EMPTY_WORK)
    onUpdated([...profile.work_history, result.entry!])
    setTimeout(() => setSaved(false), 3000)
  }

  function formatDate(d: string | null) {
    if (!d) return ''
    const dt = new Date(d)
    return dt.toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
  }

  return (
    <SectionCard
      title="Work Experience"
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
      badge={
        saved ? (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
            <Check size={11}/> Saved
          </span>
        ) : null
      }
    >
      {profile.work_history.length > 0 && (
        <div className="space-y-3 mb-5">
          {profile.work_history.map(w => (
            <div key={w.id} className="flex items-start gap-3 px-4 py-3.5 rounded-xl border"
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
              <Lock size={12} className="text-indigo-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>{w.company}</p>
                <p className="text-[12px]" style={{ color: 'var(--tx-2)' }}>{w.position}</p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                  {formatDate(w.start_date)} – {w.is_current ? 'Present' : formatDate(w.end_date)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding ? (
        <div className="rounded-xl border p-4 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-semibold" style={{ color: 'var(--tx-2)' }}>New Work Experience</p>
            <button onClick={() => { setAdding(false); setForm(EMPTY_WORK); setError(null) }}>
              <X size={14} style={{ color: 'var(--tx-3)' }} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Company Name *</label>
              <Input value={form.company} onChange={set('company')} placeholder="e.g. Google Nigeria" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Job Title / Position *</label>
              <Input value={form.position} onChange={set('position')} placeholder="e.g. Software Engineer" />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>Start Date *</label>
              <Input type="month" value={form.start_date} onChange={set('start_date')} />
            </div>
            <div>
              <label className="text-[10px] font-semibold uppercase tracking-wider block mb-1" style={{ color: 'var(--tx-3)' }}>End Date</label>
              <Input type="month" value={form.end_date} onChange={set('end_date')} disabled={form.is_current} />
              <label className="flex items-center gap-2 mt-1.5 cursor-pointer">
                <input type="checkbox" checked={form.is_current}
                  onChange={e => set('is_current')(e.target.checked)}
                  className="w-3.5 h-3.5 rounded accent-indigo-500" />
                <span className="text-[11px]" style={{ color: 'var(--tx-3)' }}>I currently work here</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <SaveBtn saving={saving} saved={false} onClick={handleAdd} />
            {error && (
              <span className="flex items-center gap-1.5 text-[12px] text-rose-400">
                <AlertCircle size={12}/>{error}
              </span>
            )}
          </div>
          <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>
            Once saved, this entry is permanently locked and cannot be edited.
          </p>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl border text-[13px] font-medium transition-colors w-full justify-center"
          style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', borderStyle: 'dashed' }}>
          <Plus size={14}/> Add Work Experience
        </button>
      )}
    </SectionCard>
  )
}

// ─── CV Section ───────────────────────────────────────────────────────────────

function CvSection({ profile, onUpdated }: {
  profile: StaffProfile
  onUpdated: (url: string, filename: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [done, setDone]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const locked  = profile.locked_fields.cv

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const ALLOWED = ['application/pdf', 'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    if (!ALLOWED.includes(file.type)) {
      setError('Only PDF or Word documents are accepted.'); return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File must be under 10 MB.'); return
    }
    setUploading(true)
    setError(null)

    const supabase = createClient()
    const path     = `${profile.staff_member_id}/${Date.now()}-${file.name.replace(/\s+/g, '_')}`
    const { error: upErr } = await supabase.storage.from('staff-cvs').upload(path, file, { upsert: false })
    if (upErr) { setError(upErr.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('staff-cvs').getPublicUrl(path)
    const result = await saveCvAction(profile.staff_member_id, publicUrl, file.name, file.size)
    setUploading(false)
    if (result.error) { setError(result.error); return }
    setDone(true)
    onUpdated(publicUrl, file.name)
  }

  function formatBytes(b: number | null) {
    if (!b) return ''
    if (b < 1024) return `${b} B`
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`
    return `${(b / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <SectionCard
      title="CV / Resume"
      icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>}
    >
      {locked || done ? (
        <div className="flex items-center gap-4 px-4 py-4 rounded-xl border"
          style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--tx-1)' }}>
              {profile.cv_filename ?? 'CV uploaded'}
            </p>
            {profile.cv_size_bytes && (
              <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{formatBytes(profile.cv_size_bytes)}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Lock size={12} className="text-indigo-400" />
            <span className="text-[11px] font-medium text-indigo-400">Locked</span>
          </div>
        </div>
      ) : (
        <div>
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx" onChange={handleFile} className="hidden" />
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="w-full flex flex-col items-center gap-3 px-6 py-8 rounded-xl border-2 border-dashed transition-colors disabled:opacity-50"
            style={{ borderColor: 'var(--border)', color: 'var(--tx-3)' }}>
            {uploading
              ? <Loader2 size={24} className="animate-spin text-indigo-400" />
              : <Upload size={24} />}
            <div className="text-center">
              <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-2)' }}>
                {uploading ? 'Uploading your CV…' : 'Click to upload your CV'}
              </p>
              <p className="text-[11px] mt-1">PDF or Word document · Max 10 MB</p>
              <p className="text-[11px] mt-0.5 font-medium text-amber-400">Once uploaded, your CV is permanently locked</p>
            </div>
          </button>
          {error && (
            <p className="flex items-center gap-1.5 text-[12px] text-rose-400 mt-2">
              <AlertCircle size={12}/>{error}
            </p>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StaffProfilePage() {
  const [profile, setProfile] = useState<StaffProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await getOrCreateProfileAction()
    setLoading(false)
    if (result.error) { setError(result.error); return }
    setProfile(result.profile ?? null)
  }, [])

  useEffect(() => { void load() }, [load])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 size={24} className="animate-spin" style={{ color: 'var(--tx-3)' }} />
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="flex flex-col items-center gap-3 py-32">
        <AlertCircle size={24} className="text-rose-400" />
        <p className="text-sm" style={{ color: 'var(--tx-2)' }}>{error ?? 'Profile not found.'}</p>
        <button onClick={load} className="text-sm text-indigo-400 underline">Try again</button>
      </div>
    )
  }

  const pct  = calcCompletion(profile)
  const name = profile.full_name ?? profile.email ?? 'Staff Member'
  const initials = name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()

  return (
    <div className="flex flex-col min-h-full">
      {/* Hero header */}
      <div className="px-8 py-8 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-[60px] h-[60px] rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
              <span className="text-white text-xl font-bold">{initials}</span>
            </div>
          </div>

          {/* Name & email */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold font-display" style={{ color: 'var(--tx-1)' }}>
              {profile.full_name ?? 'Your Profile'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--tx-3)' }}>{profile.email}</p>
          </div>

          {/* Completion ring */}
          <div className="flex items-center gap-3 flex-shrink-0">
            <div className="relative">
              <CompletionRing pct={pct} />
              <span className="absolute inset-0 flex items-center justify-center text-[11px] font-bold"
                style={{ color: 'var(--tx-1)' }}>
                {pct}%
              </span>
            </div>
            <div>
              <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>Profile Completion</p>
              <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>
                {pct === 100 ? 'All sections filled' : 'Continue filling your profile'}
              </p>
            </div>
          </div>
        </div>

        {pct < 100 && (
          <div className="mt-5 p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/20 flex items-start gap-2.5">
            <AlertCircle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
            <p className="text-[12px] text-amber-300 leading-snug">
              Fill in your profile information below. <strong>Once you save a field, it is permanently locked</strong> and cannot be changed — make sure the information is accurate before saving.
            </p>
          </div>
        )}
      </div>

      {/* Sections */}
      <div className="px-8 py-6 space-y-5 max-w-4xl">
        <PersonalSection
          profile={profile}
          onUpdated={(lockedFields, updates) =>
            setProfile(p => p ? {
              ...p,
              ...updates,
              locked_fields: lockedFields,
            } : p)
          }
        />

        <EducationSection
          profile={profile}
          onUpdated={entries => setProfile(p => p ? { ...p, education: entries } : p)}
        />

        <WorkSection
          profile={profile}
          onUpdated={entries => setProfile(p => p ? { ...p, work_history: entries } : p)}
        />

        <CvSection
          profile={profile}
          onUpdated={(url, filename) =>
            setProfile(p => p ? {
              ...p,
              cv_url: url,
              cv_filename: filename,
              locked_fields: { ...p.locked_fields, cv: true },
            } : p)
          }
        />
      </div>
    </div>
  )
}

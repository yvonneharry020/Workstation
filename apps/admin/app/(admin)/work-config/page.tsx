'use client'

import { useState, useEffect, useCallback } from 'react'
import { computeHourlyRate, formatNaira } from '@/lib/clock-utils'
import { Settings2, Save, AlertCircle, Pencil, Clock, Calendar, Banknote, Coffee } from 'lucide-react'

interface StaffWorkConfig {
  id: string
  staff_member_id: string
  staff_email: string
  monthly_salary_naira: number
  work_days: number[]
  work_start_time: string
  work_end_time: string
  break_duration_minutes: number
  presence_check_interval_minutes: number
  updated_by: string
  updated_at: string
}

interface StaffMember {
  id: string
  email: string
  full_name: string
  role: string
  is_active: boolean
}

type ConfigDraft = Omit<StaffWorkConfig, 'id' | 'updated_by' | 'updated_at'>

const DAYS = [
  { num: 1, label: 'Mon' },
  { num: 2, label: 'Tue' },
  { num: 3, label: 'Wed' },
  { num: 4, label: 'Thu' },
  { num: 5, label: 'Fri' },
  { num: 6, label: 'Sat' },
  { num: 7, label: 'Sun' },
]

const DAY_LABELS: Record<number, string> = { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' }

const DEFAULT_CONFIG: Omit<ConfigDraft, 'staff_member_id' | 'staff_email'> = {
  monthly_salary_naira:            0,
  work_days:                       [1, 2, 3, 4, 5],
  work_start_time:                 '09:00',
  work_end_time:                   '17:00',
  break_duration_minutes:          60,
  presence_check_interval_minutes: 120,
}

export default function WorkConfigPage() {
  const [staff,    setStaff]    = useState<StaffMember[]>([])
  const [configs,  setConfigs]  = useState<StaffWorkConfig[]>([])
  const [drafts,   setDrafts]   = useState<Record<string, ConfigDraft>>({})
  const [saving,   setSaving]   = useState<Record<string, boolean>>({})
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [editing,  setEditing]  = useState<Record<string, boolean>>({})
  const [loading,  setLoading]  = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/work-config')
      const json = await res.json() as { configs: StaffWorkConfig[]; staff: StaffMember[] }
      setStaff(json.staff ?? [])
      setConfigs(json.configs ?? [])

      const initialDrafts: Record<string, ConfigDraft> = {}
      const initialEditing: Record<string, boolean>    = {}

      for (const member of json.staff ?? []) {
        const existing = (json.configs ?? []).find(c => c.staff_member_id === member.id)
        initialDrafts[member.id] = existing
          ? {
              staff_member_id:                 existing.staff_member_id,
              staff_email:                     existing.staff_email,
              monthly_salary_naira:            existing.monthly_salary_naira,
              work_days:                       existing.work_days,
              work_start_time:                 existing.work_start_time.slice(0, 5),
              work_end_time:                   existing.work_end_time.slice(0, 5),
              break_duration_minutes:          existing.break_duration_minutes,
              presence_check_interval_minutes: existing.presence_check_interval_minutes,
            }
          : {
              staff_member_id: member.id,
              staff_email:     member.email,
              ...DEFAULT_CONFIG,
            }
        // Configured cards start collapsed; unconfigured open so admin can fill them in
        initialEditing[member.id] = !existing
      }

      setDrafts(initialDrafts)
      setEditing(prev => {
        // Preserve any in-progress editing state — only apply defaults for newly loaded members
        const next = { ...prev }
        for (const [id, val] of Object.entries(initialEditing)) {
          if (!(id in prev)) next[id] = val
        }
        return next
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  function updateDraft(staffId: string, field: keyof ConfigDraft, value: unknown) {
    setDrafts(prev => ({
      ...prev,
      [staffId]: { ...prev[staffId], [field]: value },
    }))
    setErrors(prev => ({ ...prev, [staffId]: '' }))
  }

  function toggleDay(staffId: string, dayNum: number) {
    const current = drafts[staffId]?.work_days ?? []
    const next    = current.includes(dayNum)
      ? current.filter(d => d !== dayNum)
      : [...current, dayNum].sort((a, b) => a - b)
    updateDraft(staffId, 'work_days', next)
  }

  async function saveConfig(staffId: string) {
    const draft = drafts[staffId]
    if (!draft) return

    if (draft.monthly_salary_naira <= 0) {
      setErrors(prev => ({ ...prev, [staffId]: 'Monthly salary must be greater than zero.' }))
      return
    }
    if (draft.work_days.length === 0) {
      setErrors(prev => ({ ...prev, [staffId]: 'Select at least one work day.' }))
      return
    }
    if (draft.work_start_time >= draft.work_end_time) {
      setErrors(prev => ({ ...prev, [staffId]: 'Start time must be before end time.' }))
      return
    }

    setSaving(prev => ({ ...prev, [staffId]: true }))
    try {
      const res = await fetch('/api/work-config', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...draft,
          work_start_time: `${draft.work_start_time}:00`,
          work_end_time:   `${draft.work_end_time}:00`,
        }),
      })
      const json = await res.json() as { config?: StaffWorkConfig; error?: string }
      if (json.error) {
        setErrors(prev => ({ ...prev, [staffId]: json.error! }))
      } else {
        // Clear any previous error and collapse the card to compact view
        setErrors(prev => ({ ...prev, [staffId]: '' }))
        setEditing(prev => ({ ...prev, [staffId]: false }))
        void load()
      }
    } finally {
      setSaving(prev => ({ ...prev, [staffId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-6 h-6 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-8 py-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'rgba(99,102,241,0.12)', color: '#818CF8' }}
          >
            <Settings2 size={15} />
          </div>
          <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
            Work Configuration
          </h1>
        </div>
        <p className="text-[13px]" style={{ color: 'var(--tx-2)' }}>
          Set salary, working hours, break time, and schedule per staff member. The system uses these values to compute hourly rates and payroll.
        </p>
      </div>

      <div className="px-8 py-6 space-y-4">
        {staff.length === 0 && (
          <div className="text-center py-16">
            <Settings2 size={28} className="mx-auto mb-3 opacity-20" style={{ color: 'var(--tx-3)' }} />
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-2)' }}>No active staff members found.</p>
            <p className="text-[12px] mt-1" style={{ color: 'var(--tx-3)' }}>Add staff in Staff Management first.</p>
          </div>
        )}

        {staff.map(member => {
          const draft      = drafts[member.id]
          const isSaving   = saving[member.id]  ?? false
          const err        = errors[member.id]  ?? ''
          const isEditing  = editing[member.id] ?? false
          const existing   = configs.find(c => c.staff_member_id === member.id)
          const hourlyRate = draft ? computeHourlyRate({
            monthly_salary_naira:   draft.monthly_salary_naira,
            work_days:              draft.work_days,
            work_start_time:        `${draft.work_start_time}:00`,
            work_end_time:          `${draft.work_end_time}:00`,
            break_duration_minutes: draft.break_duration_minutes,
          }) : 0

          const avatarLetters = member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

          return (
            <div
              key={member.id}
              className="rounded-2xl overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-card)',
                border:          '1px solid var(--border)',
                boxShadow:       'var(--shadow-card)',
              }}
            >
              {/* ── Compact view ── shown when config exists and not editing */}
              {existing && !isEditing ? (
                <div className="px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: '#6366F1' }}
                    >
                      {avatarLetters}
                    </div>
                    <div>
                      <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>{member.full_name}</p>
                      <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{member.email}</p>
                    </div>
                  </div>

                  {/* Key stats row */}
                  <div className="flex items-center gap-6">
                    <CompactStat icon={<Banknote size={12} />} label="Salary" value={`₦${existing.monthly_salary_naira.toLocaleString()}/mo`} />
                    <CompactStat icon={<Clock size={12} />}    label="Hours"  value={`${existing.work_start_time.slice(0,5)} – ${existing.work_end_time.slice(0,5)}`} />
                    <CompactStat icon={<Calendar size={12} />} label="Days"   value={existing.work_days.map(d => DAY_LABELS[d]).join(', ')} />
                    <CompactStat icon={<Coffee size={12} />}   label="Break"  value={`${existing.break_duration_minutes} min`} />
                    <div className="text-right">
                      <p className="text-[10px]" style={{ color: 'var(--tx-3)' }}>Hourly Rate</p>
                      <p className="text-[13px] font-bold" style={{ color: '#818CF8' }}>{formatNaira(hourlyRate)}/hr</p>
                    </div>
                    <button
                      onClick={() => setEditing(prev => ({ ...prev, [member.id]: true }))}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                      style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.2)' }}
                    >
                      <Pencil size={11} />
                      Edit
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Edit / configure form ── */
                <>
                  {/* Staff header */}
                  <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: '#6366F1' }}
                      >
                        {avatarLetters}
                      </div>
                      <div>
                        <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>{member.full_name}</p>
                        <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{member.email}</p>
                      </div>
                      {!existing && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border text-amber-400 bg-amber-500/10 border-amber-500/20">
                          Not configured
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3">
                      {hourlyRate > 0 && (
                        <div className="text-right">
                          <p className="text-[10px]" style={{ color: 'var(--tx-3)' }}>Hourly Rate</p>
                          <p className="text-[14px] font-bold" style={{ color: '#818CF8' }}>
                            {formatNaira(hourlyRate)}/hr
                          </p>
                        </div>
                      )}
                      {existing && (
                        <button
                          onClick={() => {
                            setEditing(prev => ({ ...prev, [member.id]: false }))
                            setErrors(prev => ({ ...prev, [member.id]: '' }))
                          }}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={() => void saveConfig(member.id)}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg text-[12px] font-semibold transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#6366F1', color: 'white' }}
                      >
                        {isSaving
                          ? <div className="w-3 h-3 rounded-full border border-current border-t-transparent animate-spin" />
                          : <Save size={12} />
                        }
                        {isSaving ? 'Saving…' : 'Save'}
                      </button>
                    </div>
                  </div>

                  {/* Config fields */}
                  {draft && (
                    <div className="px-6 py-5 grid grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--tx-3)' }}>
                          Monthly Salary (₦)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.monthly_salary_naira || ''}
                          onChange={e => updateDraft(member.id, 'monthly_salary_naira', parseFloat(e.target.value) || 0)}
                          placeholder="e.g. 300000"
                          className="w-full px-3 py-2 rounded-lg text-[13px] border transition-colors"
                          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--tx-3)' }}>
                          Work Hours
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="time"
                            value={draft.work_start_time}
                            onChange={e => updateDraft(member.id, 'work_start_time', e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg text-[13px] border"
                            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
                          />
                          <span className="text-[12px]" style={{ color: 'var(--tx-3)' }}>to</span>
                          <input
                            type="time"
                            value={draft.work_end_time}
                            onChange={e => updateDraft(member.id, 'work_end_time', e.target.value)}
                            className="flex-1 px-3 py-2 rounded-lg text-[13px] border"
                            style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
                          />
                        </div>
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--tx-3)' }}>
                          Break Duration (minutes)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={480}
                          value={draft.break_duration_minutes}
                          onChange={e => updateDraft(member.id, 'break_duration_minutes', parseInt(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-lg text-[13px] border"
                          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-1.5" style={{ color: 'var(--tx-3)' }}>
                          Presence Check Every (minutes)
                        </label>
                        <input
                          type="number"
                          min={30}
                          max={480}
                          value={draft.presence_check_interval_minutes}
                          onChange={e => updateDraft(member.id, 'presence_check_interval_minutes', parseInt(e.target.value) || 120)}
                          className="w-full px-3 py-2 rounded-lg text-[13px] border"
                          style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="text-[11px] font-semibold uppercase tracking-wider block mb-2" style={{ color: 'var(--tx-3)' }}>
                          Work Days
                        </label>
                        <div className="flex gap-2">
                          {DAYS.map(day => {
                            const active = draft.work_days.includes(day.num)
                            return (
                              <button
                                key={day.num}
                                onClick={() => toggleDay(member.id, day.num)}
                                className="w-10 h-8 rounded-lg text-[11px] font-semibold transition-all"
                                style={{
                                  backgroundColor: active ? '#6366F1' : 'var(--bg-elevated)',
                                  color:           active ? 'white'   : 'var(--tx-3)',
                                  border:          active ? 'none'    : '1px solid var(--border)',
                                }}
                              >
                                {day.label}
                              </button>
                            )
                          })}
                        </div>
                      </div>

                      {hourlyRate > 0 && (
                        <div
                          className="col-span-2 rounded-xl px-4 py-3"
                          style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)' }}
                        >
                          <div className="grid grid-cols-4 gap-4 text-center">
                            <SummaryCell label="Hourly Rate"       value={formatNaira(hourlyRate)} />
                            <SummaryCell label="Overtime Rate (1.5×)" value={formatNaira(hourlyRate * 1.5)} />
                            <SummaryCell label="Work Days/Week"    value={`${draft.work_days.length} days`} />
                            <SummaryCell label="Break/Day"         value={`${draft.break_duration_minutes} min`} />
                          </div>
                        </div>
                      )}

                      {err && (
                        <div className="col-span-2 flex items-center gap-2 text-[12px] text-rose-400">
                          <AlertCircle size={12} />
                          {err}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CompactStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span style={{ color: 'var(--tx-3)' }}>{icon}</span>
      <div>
        <p className="text-[10px]" style={{ color: 'var(--tx-3)' }}>{label}</p>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--tx-1)' }}>{value}</p>
      </div>
    </div>
  )
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px]" style={{ color: 'var(--tx-3)' }}>{label}</p>
      <p className="text-[13px] font-bold mt-0.5" style={{ color: '#818CF8' }}>{value}</p>
    </div>
  )
}

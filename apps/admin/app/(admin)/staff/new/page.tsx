'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { sendEmailClient } from '@/lib/email/client'

const ROLES = [
  { value: 'admin',  label: 'Admin',  desc: 'Full access to all rooms automatically' },
  { value: 'staff',  label: 'Staff',  desc: 'Full working access in assigned rooms' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only in assigned rooms — cannot create, send, or modify' },
] as const

type RoleValue = 'admin' | 'staff' | 'viewer'

const ROOMS = [
  {
    key: 'admin',
    label: 'Admin Room',
    desc: 'Main admin panel — users, analytics, audit log, system config',
    color: 'bg-indigo-900/30 border-indigo-700/40 text-indigo-300',
    dot: 'bg-indigo-400',
  },
  {
    key: 'management',
    label: 'Management Room',
    desc: 'Operations — verifications, support tickets, badge disputes, live chat',
    color: 'bg-ops-900/30 border-ops-700/40 text-ops-300',
    dot: 'bg-ops-400',
  },
  {
    key: 'technical',
    label: 'Technical Room',
    desc: 'Engineering — feature flags, releases, system health, tech tickets',
    color: 'bg-tech-900/30 border-tech-700/40 text-tech-300',
    dot: 'bg-tech-400',
  },
  {
    key: 'finance',
    label: 'Finance Room',
    desc: 'Finance — invoices, billing, payroll, financial reports',
    color: 'bg-finance-900/30 border-finance-700/40 text-finance-300',
    dot: 'bg-finance-400',
  },
]

export default function NewStaffPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName]   = useState('')
  const [email, setEmail]         = useState('')
  const [role, setRole]           = useState<RoleValue>('staff')
  const [roomAccess, setRoomAccess] = useState<Record<string, boolean>>({
    admin: false, management: false, technical: false, finance: false,
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function toggleRoom(key: string) {
    if (role === 'admin') return
    setRoomAccess(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const finalRoomAccess = role === 'admin'
    ? { admin: true, management: true, technical: true, finance: true }
    : roomAccess

  async function handleCreate() {
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.')
      return
    }
    if (role !== 'admin' && !Object.values(roomAccess).some(Boolean)) {
      setError('Assign at least one room, or set the role to Admin.')
      return
    }
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()

    const { error: dbError } = await supabase.from('staff_members').insert({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role,
      department: null,
      permissions: finalRoomAccess,
      invited_by: user?.id ?? null,
      invite_sent_at: new Date().toISOString(),
      is_active: true,
    })

    if (dbError) {
      setError(dbError.message.includes('unique') ? 'A staff member with this email already exists.' : dbError.message)
      setSaving(false)
      return
    }

    // Generate a real Supabase invite link via the server (requires service-role key)
    const inviteRes = await fetch('/api/staff/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim().toLowerCase() }),
    })
    const inviteJson = await inviteRes.json() as { inviteUrl?: string; error?: string }
    if (!inviteRes.ok || !inviteJson.inviteUrl) {
      setError(inviteJson.error ?? 'Failed to generate invite link. Please try again.')
      setSaving(false)
      return
    }

    // Send branded invite email with the real invite link
    const roomLabels: Record<string, string> = {
      admin: 'Admin Room', management: 'Management Room', technical: 'Technical Room', finance: 'Finance Room',
    }
    const enabledRooms = Object.entries(finalRoomAccess)
      .filter(([, v]) => v)
      .map(([k]) => roomLabels[k] ?? k)

    await sendEmailClient('staff-invite', email.trim().toLowerCase(), {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      role,
      rooms: enabledRooms,
      loginUrl: inviteJson.inviteUrl,
      invitedBy: user?.email ?? 'Admin',
    })

    await supabase.from('audit_logs').insert({
      event: 'admin.staff_created',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_name: fullName.trim(),
      target_type: 'staff_member',
      severity: 'info',
      app: 'admin_panel',
      metadata: { email: email.trim(), role, rooms: finalRoomAccess },
    })

    router.push('/staff')
  }

  const accessedRooms = Object.values(finalRoomAccess).filter(Boolean).length

  return (
    <div className="flex flex-col min-h-full">
      <div className="px-8 py-5 border-b border-surface-border flex items-center gap-4">
        <button onClick={() => router.push('/staff')}
          className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold font-display text-text-primary">Add Staff Member</h1>
          <p className="text-xs text-text-muted mt-0.5">{"They'll receive a login invite to their email"}</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-2xl space-y-6">
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">{error}</div>
        )}

        {/* Basic info + Role */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5 space-y-4">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Staff Details</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Full Name *</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="e.g. Tunde Adeyemi"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Email Address *</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@workstation.ng"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Role</label>
            <div className="flex flex-col gap-1.5">
              {ROLES.map(r => (
                <label key={r.value}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${role === r.value ? 'bg-admin-900/40 border-admin-500/40' : 'bg-surface-elevated border-surface-border hover:border-admin-800'}`}>
                  <input type="radio" name="role" value={r.value} checked={role === r.value} onChange={() => setRole(r.value)} className="hidden" />
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${role === r.value ? 'border-admin-500 bg-admin-500' : 'border-surface-border bg-transparent'}`}>
                    {role === r.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{r.label}</p>
                    <p className="text-[10px] text-text-muted">{r.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Room Access */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Room Access</p>
              {role === 'admin' ? (
                <p className="text-xs text-admin-400 mt-0.5">Admin role has access to all rooms automatically</p>
              ) : (
                <p className="text-xs text-text-muted mt-0.5">{accessedRooms} of {ROOMS.length} rooms enabled</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {ROOMS.map(room => {
              const isOn = finalRoomAccess[room.key] ?? false
              const isDisabled = role === 'admin'
              return (
                <div key={room.key}
                  onClick={() => toggleRoom(room.key)}
                  className={`flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors
                    ${isOn ? room.color + ' border-opacity-60' : 'bg-surface-elevated border-surface-border'}
                    ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-elevated/80'}`}>
                  <div className="flex items-center gap-3">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOn ? room.dot : 'bg-surface-border'}`} />
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{room.label}</p>
                      <p className="text-[10px] text-text-muted mt-0.5">{room.desc}</p>
                    </div>
                  </div>
                  <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isOn ? 'bg-admin-500' : 'bg-surface-border'} ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </div>
              )
            })}
          </div>

          {role === 'viewer' && (
            <div className="mt-3 px-4 py-3 bg-surface-elevated rounded-xl border border-surface-border">
              <p className="text-[11px] text-text-secondary">
                <span className="font-semibold text-text-primary">Viewer mode:</span> This staff member can see everything in their assigned rooms but cannot create, send, resolve, or take any actions.
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button onClick={() => router.push('/staff')}
            className="flex-1 py-3 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button onClick={handleCreate} disabled={saving || !fullName.trim() || !email.trim()}
            className="flex-1 py-3 rounded-xl bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
            {saving ? 'Sending invite…' : 'Create Staff & Send Invite'}
          </button>
        </div>
      </div>
    </div>
  )
}

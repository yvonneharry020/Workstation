'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import {
  resendStaffInviteAction,
  toggleStaffActiveAction,
  saveStaffPermissionsAction,
} from '@/lib/auth-actions'

interface StaffMember {
  id: string
  created_at: string
  email: string
  full_name: string
  role: 'admin' | 'staff' | 'viewer'
  department: string | null
  is_active: boolean
  invite_sent_at: string | null
  last_login_at: string | null
  permissions: Record<string, boolean>
}

type RoleValue = 'admin' | 'staff' | 'viewer'

const ROLES = [
  { value: 'admin',  label: 'Admin',  desc: 'Full access to all rooms automatically' },
  { value: 'staff',  label: 'Staff',  desc: 'Full working access in assigned rooms' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only — cannot create, send, or modify anything' },
] as const

const ROOMS = [
  {
    key: 'admin',
    label: 'Admin Room',
    desc: 'Main admin panel — users, analytics, audit log, system config',
    color: 'bg-indigo-900/30 border-indigo-700/40 text-indigo-300',
    dot: 'bg-indigo-400',
    activeToggle: 'bg-indigo-500',
  },
  {
    key: 'management',
    label: 'Management Room',
    desc: 'Operations — verifications, support tickets, badge disputes, live chat',
    color: 'bg-ops-900/30 border-ops-700/40 text-ops-300',
    dot: 'bg-ops-400',
    activeToggle: 'bg-ops-500',
  },
  {
    key: 'technical',
    label: 'Technical Room',
    desc: 'Engineering — feature flags, releases, system health, tech tickets',
    color: 'bg-tech-900/30 border-tech-700/40 text-tech-300',
    dot: 'bg-tech-400',
    activeToggle: 'bg-tech-500',
  },
  {
    key: 'finance',
    label: 'Finance Room',
    desc: 'Finance — invoices, billing, payroll, financial reports',
    color: 'bg-finance-900/30 border-finance-700/40 text-finance-300',
    dot: 'bg-finance-400',
    activeToggle: 'bg-finance-500',
  },
]

const ROLE_STYLES = {
  admin:  { label: 'Admin',  bg: '#A855F715', text: '#A855F7', border: '#A855F730' },
  staff:  { label: 'Staff',  bg: '#0DD4C315', text: '#0DD4C3', border: '#0DD4C330' },
  viewer: { label: 'Viewer', bg: '#47556920', text: '#94A3B8', border: '#47556940' },
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function StaffEditPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [member, setMember]           = useState<StaffMember | null>(null)
  const [loading, setLoading]         = useState(true)
  const [saving, setSaving]           = useState(false)
  const [saved, setSaved]             = useState(false)
  const [role, setRole]               = useState<RoleValue>('staff')
  const [roomAccess, setRoomAccess]   = useState<Record<string, boolean>>({
    admin: false, management: false, technical: false, finance: false,
  })
  const [inviting, setInviting]       = useState(false)
  const [inviteSent, setInviteSent]   = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [toggling, setToggling]       = useState(false)
  const [toggleError, setToggleError] = useState<string | null>(null)

  const fetchMember = useCallback(async () => {
    const { data } = await supabase.from('staff_members').select('*').eq('id', id).single()
    if (data) {
      const m = data as StaffMember
      setMember(m)
      setRole(m.role)
      // Migrate legacy page-based permissions to room-based if needed
      const perms = m.permissions ?? {}
      const hasRoomKeys = 'admin' in perms || 'management' in perms || 'technical' in perms || 'finance' in perms
      if (hasRoomKeys) {
        setRoomAccess({
          admin:      perms.admin      ?? false,
          management: perms.management ?? false,
          technical:  perms.technical  ?? false,
          finance:    perms.finance    ?? false,
        })
      }
    }
    setLoading(false)
  }, [supabase, id])

  useEffect(() => { void fetchMember() }, [fetchMember])

  function toggleRoom(key: string) {
    if (role === 'admin') return
    setRoomAccess(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function handleRoleChange(newRole: RoleValue) {
    setRole(newRole)
    setSaved(false)
  }

  const finalRoomAccess = role === 'admin'
    ? { admin: true, management: true, technical: true, finance: true }
    : roomAccess

  async function handleSave() {
    if (!member) return
    setSaving(true)

    const result = await saveStaffPermissionsAction(
      id,
      member.full_name,
      member.email,
      role,
      finalRoomAccess,
      member.role,
      (member.permissions as Record<string, boolean>) ?? {},
    )

    if (result.error) {
      setSaving(false)
      setToggleError(result.error)
      return
    }

    setMember(prev => prev ? { ...prev, role, permissions: finalRoomAccess } : prev)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function toggleActive() {
    if (!member || toggling) return
    setToggling(true)
    setToggleError(null)
    const next = !member.is_active
    const result = await toggleStaffActiveAction(id, member.full_name, member.email, next)
    if (result.error) {
      setToggleError(result.error)
    } else {
      setMember(prev => prev ? { ...prev, is_active: next } : prev)
    }
    setToggling(false)
  }

  async function handleResendInvite() {
    if (!member || inviting) return
    setInviting(true)
    setInviteError(null)
    setInviteSent(false)

    const roomLabels: Record<string, string> = {
      admin: 'Admin Room', management: 'Management Room',
      technical: 'Technical Room', finance: 'Finance Room',
    }
    const enabledRooms = Object.entries(finalRoomAccess)
      .filter(([, v]) => v)
      .map(([k]) => roomLabels[k] ?? k)

    try {
      const result = await resendStaffInviteAction(
        id, member.email, member.full_name, member.role, enabledRooms,
      )

      if (result.error) {
        setInviteError(result.error)
      } else {
        setInviteSent(true)
        setMember(prev => prev ? { ...prev, invite_sent_at: new Date().toISOString() } : prev)
        setTimeout(() => setInviteSent(false), 4000)
      }
    } catch (err: unknown) {
      setInviteError(err instanceof Error ? err.message : 'Failed to send invite. Try again.')
    } finally {
      setInviting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center py-20 text-text-muted">Loading…</div>
  if (!member) return <div className="flex items-center justify-center py-20 text-text-muted">Staff member not found.</div>

  const roleStyle = ROLE_STYLES[member.role]
  const enabledRooms = Object.values(finalRoomAccess).filter(Boolean).length

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/staff')}
            className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-admin-800 flex items-center justify-center">
              <span className="text-admin-300 text-sm font-semibold">
                {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold font-display text-text-primary">{member.full_name}</h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                  style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}>
                  {roleStyle.label}
                </span>
                {!member.is_active && (
                  <span className="text-[10px] text-text-muted bg-surface-elevated border border-surface-border px-1.5 py-0.5 rounded-full">Deactivated</span>
                )}
              </div>
              <p className="text-xs text-text-secondary">{member.email}</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {!member.last_login_at && (
              <button
                onClick={handleResendInvite}
                disabled={inviting}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border disabled:opacity-50 ${
                  inviteSent
                    ? 'bg-trust-high-bg text-trust-high border-trust-high-border'
                    : 'bg-surface-elevated border-surface-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {inviting ? 'Sending…' : inviteSent ? 'Invite sent ✓' : 'Resend invite'}
              </button>
            )}
            <button
              onClick={toggleActive}
              disabled={toggling}
              className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors border disabled:opacity-50 ${
                member.is_active
                  ? 'bg-error/10 text-error border-error/20 hover:bg-error/20'
                  : 'bg-trust-high-bg text-trust-high border-trust-high-border hover:bg-green-900/30'
              }`}
            >
              {toggling
                ? 'Updating…'
                : member.is_active
                  ? 'Deactivate Access'
                  : 'Reactivate Access'}
            </button>
            <button onClick={handleSave} disabled={saving}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${saved ? 'bg-trust-high-bg text-trust-high border border-trust-high-border' : 'bg-admin-500 hover:bg-admin-600 text-white'}`}>
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
            </button>
          </div>
          {inviteError && (
            <p className="text-[11px] text-error">{inviteError}</p>
          )}
          {toggleError && (
            <p className="text-[11px] text-error">{toggleError}</p>
          )}
        </div>
      </div>

      <div className="px-8 py-6 max-w-4xl grid grid-cols-3 gap-6">
        {/* Left column — account info */}
        <div className="col-span-1 space-y-4">
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Account Info</p>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Email</p>
              <p className="text-sm text-text-primary break-all">{member.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Current Role</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}>
                {roleStyle.label}
              </span>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Joined</p>
              <p className="text-xs text-text-primary">{formatDate(member.created_at)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Last Login</p>
              <p className="text-xs text-text-primary">{formatDate(member.last_login_at)}</p>
            </div>
            {!member.last_login_at && member.invite_sent_at && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Invite Sent</p>
                <p className="text-xs text-amber-400">{formatDate(member.invite_sent_at)}</p>
              </div>
            )}
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Access Status</p>
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${member.is_active ? 'bg-trust-high-bg border-trust-high-border' : 'bg-error/10 border-error/30'}`}>
              <span className={`w-2 h-2 rounded-full ${member.is_active ? 'bg-trust-high' : 'bg-error'}`} />
              <p className={`text-xs font-semibold ${member.is_active ? 'text-trust-high' : 'text-error'}`}>
                {member.is_active ? 'Active — can log in' : 'Deactivated — login blocked'}
              </p>
            </div>
            <p className="text-[10px] text-text-muted mt-2">{enabledRooms} of {ROOMS.length} rooms enabled</p>
          </div>
        </div>

        {/* Right column — edit role + rooms */}
        <div className="col-span-2 space-y-5">
          {/* Role */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Role</p>
            <div className="flex flex-col gap-1.5">
              {ROLES.map(r => (
                <label key={r.value}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border cursor-pointer transition-colors ${role === r.value ? 'bg-admin-900/40 border-admin-500/40' : 'bg-surface-elevated border-surface-border hover:border-admin-800'}`}>
                  <input type="radio" name="edit-role" value={r.value} checked={role === r.value} onChange={() => handleRoleChange(r.value)} className="hidden" />
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

          {/* Room access */}
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Room Access</p>
                {role === 'admin' ? (
                  <p className="text-xs text-admin-400 mt-0.5">Admin role has access to all rooms</p>
                ) : (
                  <p className="text-xs text-text-muted mt-0.5">Toggle which rooms this staff member can enter</p>
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
                      ${isOn ? `${room.color}` : 'bg-surface-elevated border-surface-border'}
                      ${isDisabled ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-elevated/80'}`}>
                    <div className="flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOn ? room.dot : 'bg-surface-border'}`} />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{room.label}</p>
                        <p className="text-[10px] text-text-muted mt-0.5">{room.desc}</p>
                      </div>
                    </div>
                    <div className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${isOn ? room.activeToggle : 'bg-surface-border'} ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                )
              })}
            </div>

            {role === 'viewer' && (
              <div className="mt-3 px-4 py-3 bg-surface-elevated rounded-xl border border-surface-border">
                <p className="text-[11px] text-text-secondary">
                  <span className="font-semibold text-text-primary">Viewer mode:</span> This staff member can see everything in their enabled rooms but all action buttons are disabled — they cannot create, send, resolve, or modify anything.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-surface-border mt-4">
              <button onClick={handleSave} disabled={saving}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${saved ? 'bg-trust-high-bg text-trust-high border border-trust-high-border' : 'bg-admin-500 hover:bg-admin-600 text-white'}`}>
                {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

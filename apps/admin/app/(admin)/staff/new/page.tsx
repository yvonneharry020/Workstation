'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DEPARTMENTS = ['Support', 'Technical', 'Billing', 'Verification', 'Management', 'Operations']
const ROLES = [
  { value: 'admin',  label: 'Admin',  desc: 'Full access to all pages' },
  { value: 'staff',  label: 'Staff',  desc: 'Access to assigned pages only' },
  { value: 'viewer', label: 'Viewer', desc: 'Read-only access to assigned pages' },
] as const

// All admin panel pages a staff member can be given access to
const ALL_PAGES = [
  { key: 'dashboard',              label: 'Dashboard' },
  { key: 'verifications_candidates', label: 'Candidate Verifications' },
  { key: 'verifications_companies', label: 'Company Verifications' },
  { key: 'flagged',                label: 'Flagged Content' },
  { key: 'jobs',                   label: 'Job Moderation' },
  { key: 'users',                  label: 'User Management' },
  { key: 'disputes',               label: 'Badge Disputes' },
  { key: 'tickets',                label: 'Support Tickets' },
  { key: 'chat',                   label: 'Live Chat' },
  { key: 'analytics',              label: 'Analytics' },
  { key: 'audit_log',              label: 'Audit Log' },
  { key: 'staff',                  label: 'Staff Management' },
  { key: 'config',                 label: 'System Config' },
]

export default function NewStaffPage() {
  const router = useRouter()
  const supabase = createClient()

  const [fullName, setFullName]     = useState('')
  const [email, setEmail]           = useState('')
  const [role, setRole]             = useState<'admin' | 'staff' | 'viewer'>('staff')
  const [department, setDepartment] = useState('')
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(ALL_PAGES.map(p => [p.key, false]))
  )
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  function togglePerm(key: string) {
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function selectAll(value: boolean) {
    setPermissions(Object.fromEntries(ALL_PAGES.map(p => [p.key, value])))
  }

  async function handleCreate() {
    if (!fullName.trim() || !email.trim()) {
      setError('Full name and email are required.')
      return
    }
    setSaving(true)
    setError(null)

    // If admin role, grant all permissions automatically
    const finalPerms = role === 'admin'
      ? Object.fromEntries(ALL_PAGES.map(p => [p.key, true]))
      : permissions

    const { data: { user } } = await supabase.auth.getUser()

    const { error: dbError } = await supabase.from('staff_members').insert({
      email: email.trim().toLowerCase(),
      full_name: fullName.trim(),
      role,
      department: department || null,
      permissions: finalPerms,
      invited_by: user?.id ?? null,
      invite_sent_at: new Date().toISOString(),
      is_active: true,
    })

    if (dbError) {
      setError(dbError.message.includes('unique') ? 'A staff member with this email already exists.' : dbError.message)
      setSaving(false)
      return
    }

    // Invite the user via Supabase Auth (sends email with magic link / password setup)
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    await supabase.auth.admin?.inviteUserByEmail?.(email.trim().toLowerCase(), {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    })

    // Log to audit
    await supabase.from('audit_logs').insert({
      event: 'admin.staff_created',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_name: fullName.trim(),
      target_type: 'staff_member',
      severity: 'info',
      app: 'admin_panel',
      metadata: { email: email.trim(), role, department },
    })

    router.push('/staff')
  }

  const selectedCount = Object.values(permissions).filter(Boolean).length

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-surface-border flex items-center gap-4">
        <button onClick={() => router.push('/staff')} className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div>
          <h1 className="text-lg font-semibold font-display text-text-primary">Add Staff Member</h1>
          <p className="text-xs text-text-muted mt-0.5">They'll receive a login invite to their email</p>
        </div>
      </div>

      <div className="px-8 py-6 max-w-2xl space-y-6">
        {error && (
          <div className="bg-error/10 border border-error/30 rounded-xl px-4 py-3 text-sm text-error">{error}</div>
        )}

        {/* Basic info */}
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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Department</label>
              <select value={department} onChange={e => setDepartment(e.target.value)}
                className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary focus:border-admin-500 focus:outline-none">
                <option value="">No department</option>
                {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Role</label>
              <div className="flex flex-col gap-1.5">
                {ROLES.map(r => (
                  <label key={r.value} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${role === r.value ? 'bg-admin-900/40 border-admin-500/40' : 'bg-surface-elevated border-surface-border hover:border-admin-800'}`}>
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
        </div>

        {/* Page permissions */}
        <div className="bg-surface-card border border-surface-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Page Permissions</p>
              {role === 'admin' ? (
                <p className="text-xs text-admin-400 mt-0.5">Admin role has access to all pages automatically</p>
              ) : (
                <p className="text-xs text-text-muted mt-0.5">{selectedCount} of {ALL_PAGES.length} pages selected</p>
              )}
            </div>
            {role !== 'admin' && (
              <div className="flex gap-2">
                <button onClick={() => selectAll(true)} className="text-xs text-admin-400 hover:text-admin-300 font-semibold transition-colors">Select all</button>
                <span className="text-text-muted">·</span>
                <button onClick={() => selectAll(false)} className="text-xs text-text-muted hover:text-text-secondary font-semibold transition-colors">Clear</button>
              </div>
            )}
          </div>

          <div className="space-y-1">
            {ALL_PAGES.map(page => {
              const isChecked = role === 'admin' ? true : (permissions[page.key] ?? false)
              const isDisabled = role === 'admin'
              return (
                <label key={page.key} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${isChecked ? 'bg-admin-900/30 border-admin-800/40' : 'bg-surface-elevated border-surface-border'} ${isDisabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:bg-surface-elevated/60'}`}>
                  <span className="text-sm text-text-primary">{page.label}</span>
                  <div
                    onClick={() => !isDisabled && togglePerm(page.key)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${isChecked ? 'bg-admin-500' : 'bg-surface-border'} ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isChecked ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              )
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button onClick={() => router.push('/staff')} className="flex-1 py-3 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">
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

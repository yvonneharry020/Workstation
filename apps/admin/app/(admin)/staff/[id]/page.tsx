'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

const ALL_PAGES = [
  { key: 'dashboard',               label: 'Dashboard',                 group: 'Main' },
  { key: 'verifications_candidates', label: 'Candidate Verifications',   group: 'Main' },
  { key: 'verifications_companies', label: 'Company Verifications',     group: 'Main' },
  { key: 'flagged',                 label: 'Flagged Content',           group: 'Main' },
  { key: 'jobs',                    label: 'Job Moderation',            group: 'Main' },
  { key: 'users',                   label: 'User Management',           group: 'Main' },
  { key: 'disputes',                label: 'Badge Disputes',            group: 'Support' },
  { key: 'tickets',                 label: 'Support Tickets',           group: 'Support' },
  { key: 'chat',                    label: 'Live Chat',                 group: 'Support' },
  { key: 'analytics',               label: 'Analytics',                 group: 'Platform' },
  { key: 'audit_log',               label: 'Audit Log',                 group: 'Platform' },
  { key: 'staff',                   label: 'Staff Management',          group: 'Platform' },
  { key: 'config',                  label: 'System Config',             group: 'Platform' },
]

const GROUPS = ['Main', 'Support', 'Platform'] as const

const ROLE_STYLES = {
  admin:  { label: 'Admin',  bg: '#A855F715', text: '#A855F7', border: '#A855F730' },
  staff:  { label: 'Staff',  bg: '#0DD4C315', text: '#0DD4C3', border: '#0DD4C330' },
  viewer: { label: 'Viewer', bg: '#47556920', text: '#94A3B8', border: '#47556940' },
}

function formatDate(iso: string | null) {
  if (!iso) return 'Never'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function StaffProfilePage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const supabase = createClient()

  const [member, setMember] = useState<StaffMember | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [permissions, setPermissions] = useState<Record<string, boolean>>({})

  const fetchMember = useCallback(async () => {
    const { data } = await supabase.from('staff_members').select('*').eq('id', id).single()
    if (data) {
      setMember(data as StaffMember)
      setPermissions((data as StaffMember).permissions ?? {})
    }
    setLoading(false)
  }, [supabase, id])

  useEffect(() => { void fetchMember() }, [fetchMember])

  function togglePerm(key: string) {
    if (member?.role === 'admin') return
    setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
    setSaved(false)
  }

  function setGroup(group: string, value: boolean) {
    if (member?.role === 'admin') return
    const keys = ALL_PAGES.filter(p => p.group === group).map(p => p.key)
    setPermissions(prev => {
      const next = { ...prev }
      keys.forEach(k => { next[k] = value })
      return next
    })
    setSaved(false)
  }

  async function handleSave() {
    if (!member) return
    setSaving(true)
    const finalPerms = member.role === 'admin'
      ? Object.fromEntries(ALL_PAGES.map(p => [p.key, true]))
      : permissions
    await supabase.from('staff_members').update({ permissions: finalPerms }).eq('id', id)
    setMember(prev => prev ? { ...prev, permissions: finalPerms } : prev)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.staff_permissions_updated',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'staff_member',
      target_name: member.full_name,
      severity: 'info',
      app: 'admin_panel',
      metadata: { permissions: finalPerms },
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function toggleActive() {
    if (!member) return
    await supabase.from('staff_members').update({ is_active: !member.is_active }).eq('id', id)
    setMember(prev => prev ? { ...prev, is_active: !prev.is_active } : prev)
  }

  async function handleResendInvite() {
    if (!member) return
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin
    await supabase.auth.admin?.inviteUserByEmail?.(member.email, {
      redirectTo: `${origin}/auth/callback?next=/dashboard`,
    })
    await supabase.from('staff_members').update({ invite_sent_at: new Date().toISOString() }).eq('id', id)
    setMember(prev => prev ? { ...prev, invite_sent_at: new Date().toISOString() } : prev)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted py-20">Loading…</div>
    )
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted py-20">Staff member not found.</div>
    )
  }

  const roleStyle = ROLE_STYLES[member.role]
  const selectedCount = member.role === 'admin'
    ? ALL_PAGES.length
    : Object.values(permissions).filter(Boolean).length

  return (
    <div className="flex flex-col min-h-full">
      {/* Header */}
      <div className="px-8 py-5 border-b border-surface-border flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/staff')} className="w-9 h-9 rounded-lg bg-surface-elevated border border-surface-border flex items-center justify-center text-text-secondary hover:text-text-primary transition-colors">
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
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}>
                  {roleStyle.label}
                </span>
                {!member.is_active && (
                  <span className="text-[10px] text-text-muted bg-surface-elevated border border-surface-border px-1.5 py-0.5 rounded-full">Deactivated</span>
                )}
              </div>
              <p className="text-xs text-text-secondary">{member.email}{member.department ? ` · ${member.department}` : ''}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!member.last_login_at && (
            <button onClick={handleResendInvite} className="px-3 py-2 rounded-lg bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors">
              Resend invite
            </button>
          )}
          <button onClick={toggleActive}
            className={`px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${member.is_active ? 'bg-error/10 text-error border border-error/20 hover:bg-error/20' : 'bg-trust-high-bg text-trust-high border border-trust-high-border hover:bg-green-900/30'}`}>
            {member.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
          <button onClick={handleSave} disabled={saving || member.role === 'admin'}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors disabled:opacity-40 ${saved ? 'bg-trust-high-bg text-trust-high border border-trust-high-border' : 'bg-admin-500 hover:bg-admin-600 text-white'}`}>
            {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Permissions'}
          </button>
        </div>
      </div>

      <div className="px-8 py-6 grid grid-cols-3 gap-6 max-w-5xl">
        {/* Info cards */}
        <div className="col-span-1 space-y-3">
          <div className="bg-surface-card border border-surface-border rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Account Info</p>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Email</p>
              <p className="text-sm text-text-primary">{member.email}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Role</p>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full border" style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}>
                {roleStyle.label}
              </span>
            </div>
            {member.department && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Department</p>
                <p className="text-sm text-text-primary">{member.department}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Joined</p>
              <p className="text-sm text-text-primary">{formatDate(member.created_at)}</p>
            </div>
            <div>
              <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Last login</p>
              <p className="text-sm text-text-primary">{formatDate(member.last_login_at)}</p>
            </div>
            {!member.last_login_at && member.invite_sent_at && (
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">Invite sent</p>
                <p className="text-xs text-amber-400">{formatDate(member.invite_sent_at)}</p>
              </div>
            )}
          </div>

          <div className="bg-surface-card border border-surface-border rounded-xl p-4">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Access Summary</p>
            <div className="text-3xl font-bold text-text-primary font-display">{selectedCount}</div>
            <p className="text-xs text-text-muted mt-0.5">of {ALL_PAGES.length} pages</p>
          </div>
        </div>

        {/* Permissions */}
        <div className="col-span-2">
          <div className="bg-surface-card border border-surface-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Page Permissions</p>
                {member.role === 'admin'
                  ? <p className="text-xs text-admin-400 mt-0.5">Admin role has access to all pages</p>
                  : <p className="text-xs text-text-muted mt-0.5">Toggle pages this staff member can access</p>
                }
              </div>
            </div>

            {GROUPS.map(group => {
              const pages = ALL_PAGES.filter(p => p.group === group)
              const groupPerms = member.role === 'admin'
                ? pages.map(() => true)
                : pages.map(p => permissions[p.key] ?? false)
              const allOn = groupPerms.every(Boolean)
              const someOn = groupPerms.some(Boolean)

              return (
                <div key={group} className="mb-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider">{group}</p>
                    {member.role !== 'admin' && (
                      <button onClick={() => setGroup(group, !allOn)}
                        className="text-[10px] font-semibold text-admin-400 hover:text-admin-300 transition-colors">
                        {allOn ? 'Disable all' : someOn ? 'Enable all' : 'Enable all'}
                      </button>
                    )}
                  </div>
                  <div className="space-y-1">
                    {pages.map(page => {
                      const isOn = member.role === 'admin' ? true : (permissions[page.key] ?? false)
                      const isDisabled = member.role === 'admin'
                      return (
                        <div key={page.key} className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-colors ${isOn ? 'bg-admin-900/30 border-admin-800/40' : 'bg-surface-elevated border-surface-border'} ${isDisabled ? 'opacity-60' : 'cursor-pointer hover:bg-surface-elevated/60'}`}
                          onClick={() => togglePerm(page.key)}>
                          <span className="text-sm text-text-primary">{page.label}</span>
                          <div className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${isOn ? 'bg-admin-500' : 'bg-surface-border'} ${isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${isOn ? 'translate-x-4' : 'translate-x-0.5'}`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {member.role !== 'admin' && (
              <div className="pt-3 border-t border-surface-border">
                <button onClick={handleSave} disabled={saving}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40 ${saved ? 'bg-trust-high-bg text-trust-high border border-trust-high-border' : 'bg-admin-500 hover:bg-admin-600 text-white'}`}>
                  {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save Permissions'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

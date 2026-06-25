'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
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

const ROLE_STYLES = {
  admin:  { label: 'Admin',  bg: '#A855F715', text: '#A855F7', border: '#A855F730' },
  staff:  { label: 'Staff',  bg: '#0DD4C315', text: '#0DD4C3', border: '#0DD4C330' },
  viewer: { label: 'Viewer', bg: '#47556920', text: '#94A3B8', border: '#47556940' },
}

function relativeTime(iso: string | null) {
  if (!iso) return 'Never'
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days}d ago`
}

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchStaff = useCallback(async () => {
    const { data } = await supabase
      .from('staff_members')
      .select('*')
      .order('created_at', { ascending: false })
    if (data) setStaff(data as StaffMember[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchStaff() }, [fetchStaff])

  // Real-time
  useEffect(() => {
    const ch = supabase
      .channel('staff-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_members' }, () => {
        void fetchStaff()
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, fetchStaff])

  async function toggleActive(member: StaffMember) {
    await supabase.from('staff_members').update({ is_active: !member.is_active }).eq('id', member.id)
    setStaff(prev => prev.map(s => s.id === member.id ? { ...s, is_active: !s.is_active } : s))
  }

  const activeCount   = staff.filter(s => s.is_active).length
  const pendingCount  = staff.filter(s => !s.last_login_at).length

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Staff Management"
        subtitle={`${activeCount} active · ${pendingCount} pending invite`}
        actions={
          <button
            onClick={() => router.push('/staff/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add Staff
          </button>
        }
      />

      <div className="px-8 py-6">
        {loading ? (
          <div className="text-center text-text-muted py-16">Loading staff…</div>
        ) : staff.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-admin-900/40 border border-admin-800/40 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-admin-400"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            </div>
            <p className="text-text-primary font-semibold mb-1">No staff members yet</p>
            <p className="text-text-muted text-sm mb-6">Add your first staff member and set their page permissions.</p>
            <button onClick={() => router.push('/staff/new')} className="px-5 py-2.5 rounded-xl bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors">
              Add your first staff member
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {staff.map(member => {
              const roleStyle = ROLE_STYLES[member.role]
              const permCount = Object.values(member.permissions).filter(Boolean).length
              return (
                <div
                  key={member.id}
                  className={`bg-surface-card border rounded-xl px-5 py-4 flex items-center gap-5 cursor-pointer hover:bg-surface-elevated/40 transition-colors ${member.is_active ? 'border-surface-border' : 'border-surface-border opacity-60'}`}
                  onClick={() => router.push(`/staff/${member.id}`)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-admin-800 flex items-center justify-center flex-shrink-0">
                    <span className="text-admin-300 text-sm font-semibold font-display">
                      {member.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-text-primary">{member.full_name}</p>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: roleStyle.bg, color: roleStyle.text, borderColor: roleStyle.border }}>
                        {roleStyle.label}
                      </span>
                      {!member.last_login_at && (
                        <span className="text-[9px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full">Pending</span>
                      )}
                      {!member.is_active && (
                        <span className="text-[9px] font-semibold text-text-muted bg-surface-elevated border border-surface-border px-1.5 py-0.5 rounded-full">Deactivated</span>
                      )}
                    </div>
                    <p className="text-xs text-text-secondary">{member.email}</p>
                    {member.department && <p className="text-[10px] text-text-muted mt-0.5">{member.department}</p>}
                  </div>

                  {/* Meta */}
                  <div className="text-right flex-shrink-0 space-y-0.5">
                    <p className="text-xs text-text-secondary font-semibold">{permCount} page{permCount !== 1 ? 's' : ''} access</p>
                    <p className="text-[10px] text-text-muted">Last login: {relativeTime(member.last_login_at)}</p>
                  </div>

                  {/* Active toggle */}
                  <div
                    onClick={e => { e.stopPropagation(); void toggleActive(member) }}
                    className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer flex-shrink-0 ${member.is_active ? 'bg-admin-500' : 'bg-surface-elevated border border-surface-border'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${member.is_active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>

                  {/* Chevron */}
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted flex-shrink-0"><polyline points="9 18 15 12 9 6"/></svg>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

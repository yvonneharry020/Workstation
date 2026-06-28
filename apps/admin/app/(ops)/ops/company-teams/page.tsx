'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

interface TeamMember {
  id: string
  company_id: string
  member_id: string | null
  email: string
  role: string
  invited_at: string
  accepted_at: string | null
  is_active: boolean
  profile: { full_name: string | null; avatar_url: string | null } | null
}

const ROLE_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  admin:     { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
  manager:   { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)' },
  recruiter: { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
  viewer:    { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function RoleBadge({ role }: { role: string }) {
  const s = ROLE_STYLE[role] ?? ROLE_STYLE.viewer
  return (
    <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: '6px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', textTransform: 'capitalize' }}>
      {role}
    </span>
  )
}

export default function CompanyTeamsPage() {
  const supabase = createClient()
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('company_team_members')
      .select('*, profile:profiles!member_id(full_name, avatar_url)')
      .order('invited_at', { ascending: false })
    setMembers((data ?? []) as TeamMember[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function toggleActive(id: string, currentActive: boolean) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    const newActive = !currentActive
    await supabase.from('company_team_members').update({ is_active: newActive }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.team_member_${newActive ? 'reactivated' : 'deactivated'}`,
      actor_email: user?.email ?? null, actor_id: user?.id ?? null,
      actor_type: 'admin', target_id: id, target_type: 'company_team_member',
      severity: 'info', app: 'admin_panel',
    })
    setMembers(prev => prev.map(m => m.id === id ? { ...m, is_active: newActive } : m))
    setActing(null)
  }

  const filtered = members.filter(m => {
    if (search && !m.email.toLowerCase().includes(search.toLowerCase()) && !m.company_id.toLowerCase().includes(search.toLowerCase())) return false
    if (roleFilter !== 'all' && m.role !== roleFilter) return false
    if (activeFilter === 'active' && !m.is_active) return false
    if (activeFilter === 'inactive' && m.is_active) return false
    return true
  })

  // group by company
  const byCompany: Record<string, TeamMember[]> = {}
  for (const m of filtered) {
    if (!byCompany[m.company_id]) byCompany[m.company_id] = []
    byCompany[m.company_id].push(m)
  }

  const total = members.length
  const active = members.filter(m => m.is_active).length
  const inactive = members.filter(m => !m.is_active).length
  const companiesWithTeams = new Set(members.map(m => m.company_id)).size

  const roles = Array.from(new Set(members.map(m => m.role)))

  const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Company Teams" subtitle="Manage team members across all companies" />
      <div className="p-6 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Members', value: total },
            { label: 'Active', value: active, color: '#34D399' },
            { label: 'Inactive', value: inactive, color: '#9CA3AF' },
            { label: 'Companies with Teams', value: companiesWithTeams, color: '#F59E0B' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
              <p className="text-[28px] font-bold font-display" style={{ color: s.color ?? 'var(--tx-1)' }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={CARD} className="p-5 flex items-center gap-4 flex-wrap">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by email or company ID…"
            style={{ flex: '1 1 220px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }} />
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', cursor: 'pointer', outline: 'none' }}>
            <option value="all">All Roles</option>
            {roles.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-1.5">
            {(['all', 'active', 'inactive'] as const).map(f => (
              <button key={f} onClick={() => setActiveFilter(f)}
                style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize',
                  border: `1px solid ${activeFilter === f ? '#F59E0B' : 'var(--border)'}`,
                  backgroundColor: activeFilter === f ? 'rgba(245,158,11,0.12)' : 'var(--bg-base)',
                  color: activeFilter === f ? '#F59E0B' : 'var(--tx-3)' }}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped by Company */}
        {loading ? (
          <div style={{ ...CARD, color: 'var(--tx-3)' }} className="p-12 text-center">Loading…</div>
        ) : Object.keys(byCompany).length === 0 ? (
          <div style={CARD} className="p-12 text-center">
            <p style={{ color: 'var(--tx-3)' }}>No team members found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.entries(byCompany).map(([companyId, companyMembers]) => {
              const isCollapsed = collapsed.has(companyId)
              return (
                <div key={companyId} style={CARD} className="overflow-hidden">
                  {/* Company header */}
                  <button
                    onClick={() => {
                      const next = new Set(collapsed)
                      if (isCollapsed) next.delete(companyId); else next.add(companyId)
                      setCollapsed(next)
                    }}
                    className="w-full px-6 py-4 flex items-center justify-between"
                    style={{ borderBottom: isCollapsed ? 'none' : '1px solid var(--border)', backgroundColor: 'rgba(245,158,11,0.04)', cursor: 'pointer', textAlign: 'left' }}>
                    <div className="flex items-center gap-3">
                      <div style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: '#F59E0B' }} />
                      <span className="font-mono text-[12px]" style={{ color: 'var(--tx-3)' }}>Company</span>
                      <span className="font-semibold text-[13px]" style={{ color: 'var(--tx-1)' }}>{companyId.slice(0, 12)}…</span>
                      <span style={{ padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, backgroundColor: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                        {companyMembers.length} member{companyMembers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <span style={{ color: 'var(--tx-3)', fontSize: '12px' }}>{isCollapsed ? '▶' : '▼'}</span>
                  </button>

                  {!isCollapsed && (
                    <table className="w-full text-[13px]">
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          {['Member', 'Email', 'Role', 'Invited', 'Accepted', 'Status', 'Action'].map(h => (
                            <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {companyMembers.map((m, i) => {
                          const isActing = acting === m.id
                          return (
                            <tr key={m.id} style={{ borderBottom: i < companyMembers.length - 1 ? '1px solid var(--border)' : 'none', opacity: isActing ? 0.6 : 1 }}>
                              <td className="px-5 py-3 font-medium" style={{ color: 'var(--tx-1)' }}>
                                {m.profile?.full_name ?? <span style={{ color: 'var(--tx-3)', fontStyle: 'italic' }}>No profile</span>}
                              </td>
                              <td className="px-5 py-3" style={{ color: 'var(--tx-2)' }}>{m.email}</td>
                              <td className="px-5 py-3"><RoleBadge role={m.role} /></td>
                              <td className="px-5 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDate(m.invited_at)}</td>
                              <td className="px-5 py-3" style={{ color: 'var(--tx-3)' }}>{m.accepted_at ? fmtDate(m.accepted_at) : '—'}</td>
                              <td className="px-5 py-3">
                                <span style={{
                                  color: m.is_active ? '#34D399' : '#9CA3AF',
                                  backgroundColor: m.is_active ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.1)',
                                  border: `1px solid ${m.is_active ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.3)'}`,
                                  borderRadius: '6px', fontSize: '11px', fontWeight: 600, padding: '3px 8px',
                                }}>
                                  {m.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </td>
                              <td className="px-5 py-3">
                                <button onClick={() => toggleActive(m.id, m.is_active)} disabled={isActing}
                                  style={{ padding: '4px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '6px', cursor: 'pointer',
                                    border: `1px solid ${m.is_active ? 'rgba(239,68,68,0.3)' : 'rgba(52,211,153,0.3)'}`,
                                    backgroundColor: m.is_active ? 'rgba(239,68,68,0.08)' : 'rgba(52,211,153,0.08)',
                                    color: m.is_active ? '#F87171' : '#34D399' }}>
                                  {m.is_active ? 'Deactivate' : 'Reactivate'}
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

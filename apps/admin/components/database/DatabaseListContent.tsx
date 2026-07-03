'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createTabClient } from '@/lib/supabase/tab-client'

interface UserRecord {
  id: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  is_suspended: boolean
  device_fingerprint: string | null
  last_seen_at: string | null
  created_at: string
  displayName: string
  nin: string | null
  rc_number: string | null
  userType: 'candidate' | 'company' | 'other'
}

interface Props {
  baseRoute: string
}

type FilterType = 'all' | 'candidate' | 'company'

function initials(name: string): string {
  if (!name.trim()) return '??'
  return name.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase()
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function maskNin(nin: string | null): string {
  if (!nin) return '—'
  return nin.slice(0, 3) + '•'.repeat(8)
}

export default function DatabaseListContent({ baseRoute }: Props) {
  const router = useRouter()
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [refreshing, setRefreshing] = useState(false)

  const loadUsers = useCallback(async () => {
    const supabase = createTabClient()

    const [candidatesRes, companiesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(`
          id, email, phone, role, is_active, is_suspended,
          device_fingerprint, last_seen_at, created_at,
          candidate_profiles ( id, first_name, last_name, nin_number, profile_completion )
        `)
        .eq('role', 'candidate')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('profiles')
        .select(`
          id, email, phone, role, is_active, is_suspended,
          device_fingerprint, last_seen_at, created_at,
          company_profiles ( id, company_name, rc_number, is_verified )
        `)
        .eq('role', 'company')
        .order('created_at', { ascending: false })
        .limit(500),
    ])

    const records: UserRecord[] = []

    for (const row of candidatesRes.data ?? []) {
      const cp = Array.isArray(row.candidate_profiles)
        ? row.candidate_profiles[0]
        : (row.candidate_profiles as { first_name?: string; last_name?: string; nin_number?: string } | null)
      const firstName = cp?.first_name ?? ''
      const lastName = cp?.last_name ?? ''
      records.push({
        id: row.id,
        email: row.email ?? '',
        phone: row.phone ?? null,
        role: row.role ?? 'candidate',
        is_active: row.is_active ?? true,
        is_suspended: row.is_suspended ?? false,
        device_fingerprint: row.device_fingerprint ?? null,
        last_seen_at: row.last_seen_at ?? null,
        created_at: row.created_at ?? '',
        displayName: ([firstName, lastName].filter(Boolean).join(' ') || row.email) ?? 'Unknown',
        nin: (cp as { nin_number?: string } | null)?.nin_number ?? null,
        rc_number: null,
        userType: 'candidate',
      })
    }

    for (const row of companiesRes.data ?? []) {
      const cp = Array.isArray(row.company_profiles)
        ? row.company_profiles[0]
        : (row.company_profiles as { company_name?: string; rc_number?: string } | null)
      records.push({
        id: row.id,
        email: row.email ?? '',
        phone: row.phone ?? null,
        role: row.role ?? 'company',
        is_active: row.is_active ?? true,
        is_suspended: row.is_suspended ?? false,
        device_fingerprint: row.device_fingerprint ?? null,
        last_seen_at: row.last_seen_at ?? null,
        created_at: row.created_at ?? '',
        displayName: (cp as { company_name?: string } | null)?.company_name ?? row.email ?? 'Unknown',
        nin: null,
        rc_number: (cp as { rc_number?: string } | null)?.rc_number ?? null,
        userType: 'company',
      })
    }

    setUsers(records)
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { void loadUsers() }, [loadUsers])

  function handleRefresh() {
    setRefreshing(true)
    setLoading(true)
    void loadUsers()
  }

  const filtered = users.filter(u => {
    if (filter !== 'all' && u.userType !== filter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      u.displayName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.phone ?? '').includes(q) ||
      (u.nin ? maskNin(u.nin).includes(q) || u.nin.includes(q) : false) ||
      (u.rc_number ?? '').toLowerCase().includes(q) ||
      (u.device_fingerprint ?? '').toLowerCase().includes(q)
    )
  })

  const CARD = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-card)',
  }

  const TAG_COLORS: Record<string, { color: string; bg: string }> = {
    candidate: { color: '#818CF8', bg: 'rgba(99,102,241,0.1)' },
    company:   { color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
  }

  return (
    <div className="p-6 space-y-5">
      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: users.length, color: '#818CF8' },
          { label: 'Candidates', value: users.filter(u => u.userType === 'candidate').length, color: '#38BDF8' },
          { label: 'Companies', value: users.filter(u => u.userType === 'company').length, color: '#34D399' },
        ].map(s => (
          <div key={s.label} style={{ ...CARD, padding: '18px 20px' }}>
            <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            <p className="text-[28px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div style={{ ...CARD, padding: '16px 20px' }} className="flex items-center gap-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, email, NIN, phone, RC number, device fingerprint…"
          style={{
            flex: '1 1 280px', padding: '9px 14px',
            borderRadius: '10px',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-base)',
            color: 'var(--tx-1)', fontSize: '13px', outline: 'none',
          }}
        />
        <div className="flex items-center gap-1.5">
          {(['all', 'candidate', 'company'] as FilterType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
                cursor: 'pointer', textTransform: 'capitalize',
                border: `1px solid ${filter === f ? '#6366F1' : 'var(--border)'}`,
                backgroundColor: filter === f ? 'rgba(99,102,241,0.12)' : 'var(--bg-base)',
                color: filter === f ? '#818CF8' : 'var(--tx-3)',
              }}
            >
              {f === 'all' ? 'All Users' : f === 'candidate' ? 'Candidates' : 'Companies'}
            </button>
          ))}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          style={{
            padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600,
            cursor: refreshing ? 'default' : 'pointer',
            border: '1px solid var(--border)',
            backgroundColor: 'var(--bg-base)',
            color: 'var(--tx-3)', display: 'flex', alignItems: 'center', gap: '6px',
          }}
        >
          <span style={{ display: 'inline-block', animation: refreshing ? 'spin 0.7s linear infinite' : 'none' }}>↻</span>
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

      {/* User list */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
          <p className="text-[14px] font-semibold" style={{ color: 'var(--tx-1)' }}>
            Users {!loading && `(${filtered.length})`}
          </p>
          <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>
            Click any row to open user folder
          </p>
        </div>

        {loading ? (
          <div className="p-12 text-center" style={{ color: 'var(--tx-3)', fontSize: '13px' }}>Loading users…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center" style={{ color: 'var(--tx-3)', fontSize: '13px' }}>
            {search ? 'No users match your search' : 'No users found'}
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['User', 'Email', 'Type', 'Status', 'Last Seen', 'Joined'].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => {
                const tag = TAG_COLORS[u.userType] ?? TAG_COLORS.candidate
                const isLast = i === filtered.length - 1
                return (
                  <tr
                    key={u.id}
                    onClick={() => router.push(`${baseRoute}/${u.id}`)}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--border)',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '10px', flexShrink: 0,
                          backgroundColor: 'rgba(99,102,241,0.12)',
                          border: '1px solid rgba(99,102,241,0.2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '11px', fontWeight: 700, color: '#818CF8',
                        }}>
                          {initials(u.displayName)}
                        </div>
                        <span className="font-semibold" style={{ color: 'var(--tx-1)' }}>
                          {u.displayName}
                        </span>
                        {!u.is_active && (
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#F87171', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '4px', padding: '1px 5px' }}>
                            DELETED
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-2)' }}>{u.email}</td>
                    <td className="px-5 py-3">
                      <span style={{ color: tag.color, backgroundColor: tag.bg, border: `1px solid ${tag.color}40`, borderRadius: '6px', fontSize: '11px', fontWeight: 600, padding: '3px 8px', textTransform: 'capitalize' }}>
                        {u.userType}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {u.is_suspended ? (
                        <span style={{ color: '#FBBF24', fontSize: '11px', fontWeight: 600 }}>Suspended</span>
                      ) : u.is_active ? (
                        <span style={{ color: '#34D399', fontSize: '11px', fontWeight: 600 }}>Active</span>
                      ) : (
                        <span style={{ color: '#F87171', fontSize: '11px', fontWeight: 600 }}>Deleted</span>
                      )}
                    </td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDate(u.last_seen_at)}</td>
                    <td className="px-5 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDate(u.created_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

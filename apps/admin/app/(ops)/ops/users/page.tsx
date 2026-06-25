'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  full_name: string
  email: string
  verification_status: string
  trust_score: number | null
  created_at: string
  type: 'candidate' | 'company'
  name?: string
}

const STATUS_COLORS: Record<string, string> = {
  verified: 'bg-green-900/20 text-green-400 border-green-800/30',
  pending: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  rejected: 'bg-red-900/20 text-red-400 border-red-800/30',
  suspended: 'bg-red-900/30 text-red-400 border-red-800/40',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function OpsUsersPage() {
  const supabase = createClient()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | 'candidate' | 'company'>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [warnMsg, setWarnMsg] = useState<Record<string, string>>({})

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: candData }, { data: compData }] = await Promise.all([
      supabase.from('candidates').select('id,full_name,email,verification_status,trust_score,created_at').order('created_at', { ascending: false }),
      supabase.from('companies').select('id,name,email,verification_status,created_at').order('created_at', { ascending: false }),
    ])
    const all: User[] = [
      ...((candData ?? []) as User[]).map(u => ({ ...u, type: 'candidate' as const })),
      ...((compData ?? []) as unknown as (User & { name: string })[]).map(u => ({ ...u, full_name: u.name, type: 'company' as const })),
    ]
    setUsers(all)
    setLoading(false)
  }

  async function warnUser(user: User) {
    setActing(user.id)
    const { data: { user: admin } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.user_warned',
      actor_email: admin?.email ?? null,
      actor_id: admin?.id ?? null,
      actor_type: 'admin',
      target_id: user.id,
      target_type: user.type,
      target_name: user.full_name,
      severity: 'warning',
      app: 'admin_panel',
    })
    setWarnMsg(prev => ({ ...prev, [user.id]: 'Warning issued and logged.' }))
    setTimeout(() => setWarnMsg(prev => { const n = { ...prev }; delete n[user.id]; return n }), 3000)
    setActing(null)
  }

  async function freezeUser(user: User) {
    setActing(user.id)
    const { data: { user: admin } } = await supabase.auth.getUser()
    const table = user.type === 'candidate' ? 'candidates' : 'companies'
    await supabase.from(table as never).update({ verification_status: 'rejected' }).eq('id', user.id)
    await supabase.from('audit_logs').insert({
      event: 'admin.user_frozen',
      actor_email: admin?.email ?? null,
      actor_id: admin?.id ?? null,
      actor_type: 'admin',
      target_id: user.id,
      target_type: user.type,
      target_name: user.full_name,
      severity: 'critical',
      app: 'admin_panel',
    })
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, verification_status: 'rejected' } : u))
    setActing(null)
  }

  const filtered = users.filter(u =>
    (typeFilter === 'all' || u.type === typeFilter) &&
    (search === '' || u.full_name?.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">User Management</h1>
        <p className="text-sm text-text-secondary mt-0.5">Operational user management — warn, freeze, and monitor users across the platform.</p>
      </div>

      <div className="px-8 py-3 border-b border-surface-border flex items-center gap-3 flex-wrap">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email…" className="w-64 bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-ops-500" />
        <div className="flex gap-1">
          {(['all','candidate','company'] as const).map(t => (
            <button key={t} onClick={() => setTypeFilter(t)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${typeFilter === t ? 'bg-ops-900/50 text-ops-300 border border-ops-800/30' : 'text-text-secondary hover:text-text-primary'}`}>{t}</button>
          ))}
        </div>
        <span className="text-xs text-text-muted ml-auto">{filtered.length} users</span>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated border-b border-surface-border">
                  {['User','Type','Status','Trust Score','Joined','Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {filtered.map(user => (
                  <tr key={user.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-text-primary">{user.full_name}</p>
                      <p className="text-xs text-text-muted">{user.email}</p>
                      {warnMsg[user.id] && <p className="text-xs text-green-400 mt-0.5">{warnMsg[user.id]}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${user.type === 'candidate' ? 'bg-blue-900/20 text-blue-400 border-blue-800/30' : 'bg-purple-900/20 text-purple-400 border-purple-800/30'}`}>{user.type}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_COLORS[user.verification_status] ?? ''}`}>{user.verification_status}</span>
                    </td>
                    <td className="px-4 py-3 text-text-muted">{user.trust_score !== null ? `${user.trust_score}%` : '—'}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => void warnUser(user)} disabled={acting === user.id} className="px-3 py-1.5 bg-yellow-900/20 border border-yellow-800/30 text-yellow-400 text-xs font-semibold rounded-lg hover:bg-yellow-900/30 transition-colors disabled:opacity-40">Warn</button>
                        {user.verification_status !== 'rejected' && (
                          <button onClick={() => void freezeUser(user)} disabled={acting === user.id} className="px-3 py-1.5 bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-40">Freeze</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

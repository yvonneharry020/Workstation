'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Candidate {
  id: string
  user_id: string
  full_name: string
  email: string
  verification_status: string
  trust_score: number | null
  created_at: string
  skills: string[] | null
  experience: string | null
}

interface Company {
  id: string
  user_id: string
  name: string
  email: string
  verification_status: string
  industry: string | null
  created_at: string
}

type Tab = 'candidates' | 'companies'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  verified: 'bg-green-900/20 text-green-400 border-green-800/30',
  rejected: 'bg-red-900/20 text-red-400 border-red-800/30',
  under_review: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
}

export default function VerificationsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('candidates')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: candData }, { data: compData }] = await Promise.all([
      supabase.from('candidates').select('id,user_id,full_name,email,verification_status,trust_score,created_at,skills,experience').order('created_at', { ascending: false }),
      supabase.from('companies').select('id,user_id,name,email,verification_status,industry,created_at').order('created_at', { ascending: false }),
    ])
    setCandidates((candData ?? []) as Candidate[])
    setCompanies((compData ?? []) as Company[])
    setLoading(false)
  }

  async function updateCandidateStatus(id: string, status: string) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('candidates').update({ verification_status: status }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.candidate_verification_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'candidate',
      severity: 'info',
      app: 'admin_panel',
    })
    setCandidates(prev => prev.map(c => c.id === id ? { ...c, verification_status: status } : c))
    setActing(null)
  }

  async function updateCompanyStatus(id: string, status: string) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('companies').update({ verification_status: status }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.company_verification_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'company',
      severity: 'info',
      app: 'admin_panel',
    })
    setCompanies(prev => prev.map(c => c.id === id ? { ...c, verification_status: status } : c))
    setActing(null)
  }

  const filteredCandidates = candidates.filter(c => filter === 'all' || c.verification_status === filter)
  const filteredCompanies = companies.filter(c => filter === 'all' || c.verification_status === filter)
  const pendingCand = candidates.filter(c => c.verification_status === 'pending').length
  const pendingComp = companies.filter(c => c.verification_status === 'pending').length

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Verification Queue</h1>
        <p className="text-sm text-text-secondary mt-0.5">Review and approve candidate and company accounts.</p>
      </div>

      <div className="px-8 py-3 border-b border-surface-border flex items-center gap-4">
        <div className="flex gap-1">
          <button onClick={() => setTab('candidates')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'candidates' ? 'bg-ops-900/50 text-ops-300 border border-ops-800/30' : 'text-text-secondary hover:text-text-primary'}`}>
            Candidates
            {pendingCand > 0 && <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-1.5 py-0.5">{pendingCand}</span>}
          </button>
          <button onClick={() => setTab('companies')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${tab === 'companies' ? 'bg-ops-900/50 text-ops-300 border border-ops-800/30' : 'text-text-secondary hover:text-text-primary'}`}>
            Companies
            {pendingComp > 0 && <span className="text-[10px] font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-1.5 py-0.5">{pendingComp}</span>}
          </button>
        </div>
        <div className="flex gap-1 ml-4">
          {['all','pending','verified','rejected','under_review'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${filter === s ? 'bg-surface-elevated text-text-primary border border-surface-border' : 'text-text-muted hover:text-text-primary'}`}>{s.replace('_',' ')}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : tab === 'candidates' ? (
          <div className="space-y-2">
            {filteredCandidates.map(c => (
              <div key={c.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-ops-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-ops-400 text-sm font-bold">{c.full_name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{c.full_name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_COLORS[c.verification_status] ?? ''}`}>{c.verification_status}</span>
                    </div>
                    <p className="text-xs text-text-muted">{c.email}</p>
                    <p className="text-xs text-text-muted mt-0.5">Joined {formatDate(c.created_at)}{c.trust_score !== null ? ` · Trust: ${c.trust_score}%` : ''}</p>
                  </div>
                </div>
                {c.verification_status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => void updateCandidateStatus(c.id, 'verified')} disabled={acting === c.id} className="px-3 py-1.5 bg-green-900/20 border border-green-800/30 text-green-400 text-xs font-semibold rounded-lg hover:bg-green-900/30 transition-colors disabled:opacity-40">Approve</button>
                    <button onClick={() => void updateCandidateStatus(c.id, 'rejected')} disabled={acting === c.id} className="px-3 py-1.5 bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-40">Reject</button>
                  </div>
                )}
              </div>
            ))}
            {filteredCandidates.length === 0 && <p className="text-text-muted text-sm">No candidates with status: {filter}.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCompanies.map(c => (
              <div key={c.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-ops-900/30 flex items-center justify-center flex-shrink-0">
                    <span className="text-ops-400 text-sm font-bold">{c.name?.[0]?.toUpperCase() ?? '?'}</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_COLORS[c.verification_status] ?? ''}`}>{c.verification_status}</span>
                    </div>
                    <p className="text-xs text-text-muted">{c.email}{c.industry ? ` · ${c.industry}` : ''}</p>
                    <p className="text-xs text-text-muted mt-0.5">Registered {formatDate(c.created_at)}</p>
                  </div>
                </div>
                {c.verification_status === 'pending' && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => void updateCompanyStatus(c.id, 'verified')} disabled={acting === c.id} className="px-3 py-1.5 bg-green-900/20 border border-green-800/30 text-green-400 text-xs font-semibold rounded-lg hover:bg-green-900/30 transition-colors disabled:opacity-40">Approve</button>
                    <button onClick={() => void updateCompanyStatus(c.id, 'rejected')} disabled={acting === c.id} className="px-3 py-1.5 bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-40">Reject</button>
                  </div>
                )}
              </div>
            ))}
            {filteredCompanies.length === 0 && <p className="text-text-muted text-sm">No companies with status: {filter}.</p>}
          </div>
        )}
      </div>
    </div>
  )
}

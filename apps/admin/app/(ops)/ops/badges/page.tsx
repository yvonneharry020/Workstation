'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Badge {
  id: string
  candidate_id: string
  candidate_name: string | null
  badge_type: string
  badge_label: string | null
  issued_by: string | null
  issued_at: string
  is_active: boolean
  metadata: Record<string, unknown>
}

interface Candidate {
  id: string
  full_name: string
  email: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const BADGE_ICONS: Record<string, string> = {
  verified: '✅',
  top_candidate: '⭐',
  skill_expert: '🎯',
  fast_responder: '⚡',
  trusted: '🛡️',
  featured: '🏆',
}

export default function BadgesPage() {
  const supabase = createClient()
  const [badges, setBadges] = useState<Badge[]>([])
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [loading, setLoading] = useState(true)
  const [issuingTo, setIssuingTo] = useState<string | null>(null)
  const [issueForm, setIssueForm] = useState({ candidateId: '', badgeType: 'verified', badgeLabel: '' })
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: badgeData }, { data: candData }] = await Promise.all([
      supabase.from('badges').select('*').order('issued_at', { ascending: false }).limit(50),
      supabase.from('candidates').select('id,full_name,email').order('created_at', { ascending: false }).limit(100),
    ])
    setBadges((badgeData ?? []) as Badge[])
    setCandidates((candData ?? []) as Candidate[])
    setLoading(false)
  }

  async function issueBadge() {
    if (!issueForm.candidateId || !issueForm.badgeType) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const candidate = candidates.find(c => c.id === issueForm.candidateId)
    const { data } = await supabase.from('badges').insert({
      candidate_id: issueForm.candidateId,
      candidate_name: candidate?.full_name ?? null,
      badge_type: issueForm.badgeType,
      badge_label: issueForm.badgeLabel || issueForm.badgeType,
      issued_by: user?.email ?? 'admin',
      issued_at: new Date().toISOString(),
      is_active: true,
    }).select().single()
    if (data) setBadges(prev => [data as Badge, ...prev])
    await supabase.from('audit_logs').insert({
      event: 'admin.badge_issued',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: issueForm.candidateId,
      target_type: 'candidate',
      severity: 'info',
      app: 'admin_panel',
      metadata: { badge_type: issueForm.badgeType },
    })
    setIssuingTo(null)
    setIssueForm({ candidateId: '', badgeType: 'verified', badgeLabel: '' })
    setSaving(false)
  }

  async function revokeBadge(id: string) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('badges').update({ is_active: false }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: 'admin.badge_revoked',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'badge',
      severity: 'warning',
      app: 'admin_panel',
    })
    setBadges(prev => prev.map(b => b.id === id ? { ...b, is_active: false } : b))
    setActing(null)
  }

  const stats = {
    total: badges.length,
    active: badges.filter(b => b.is_active).length,
    revoked: badges.filter(b => !b.is_active).length,
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Badge Management</h1>
          <p className="text-sm text-text-secondary mt-0.5">Issue and revoke badges for candidates. Badges appear on candidate profiles.</p>
        </div>
        <button onClick={() => setIssuingTo('new')} className="px-4 py-2 bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold rounded-xl transition-colors">+ Issue Badge</button>
      </div>

      <div className="px-8 py-4 border-b border-surface-border flex gap-4">
        {Object.entries(stats).map(([k, v]) => (
          <div key={k} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
            <div className="text-2xl font-bold font-display text-text-primary">{v}</div>
            <div className="text-xs text-text-muted capitalize">{k}</div>
          </div>
        ))}
      </div>

      {issuingTo === 'new' && (
        <div className="px-8 py-5 border-b border-surface-border bg-ops-900/5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Issue Badge</p>
          <div className="grid grid-cols-3 gap-4 max-w-2xl mb-4">
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Candidate</label>
              <select value={issueForm.candidateId} onChange={e => setIssueForm(p => ({ ...p, candidateId: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500">
                <option value="">Select candidate…</option>
                {candidates.map(c => <option key={c.id} value={c.id}>{c.full_name} ({c.email})</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Badge Type</label>
              <select value={issueForm.badgeType} onChange={e => setIssueForm(p => ({ ...p, badgeType: e.target.value }))} className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500">
                {Object.keys(BADGE_ICONS).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted uppercase tracking-wider block mb-1">Display Label (optional)</label>
              <input value={issueForm.badgeLabel} onChange={e => setIssueForm(p => ({ ...p, badgeLabel: e.target.value }))} placeholder="e.g. Top Candidate 2026" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={issueBadge} disabled={saving || !issueForm.candidateId} className="px-5 py-2 bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">{saving ? 'Issuing…' : 'Issue Badge'}</button>
            <button onClick={() => setIssuingTo(null)} className="px-5 py-2 bg-surface-elevated border border-surface-border text-text-secondary text-sm rounded-xl hover:text-text-primary">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : badges.length === 0 ? (
          <p className="text-sm text-text-muted">No badges issued yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-surface-elevated border-b border-surface-border">
                  {['Badge','Candidate','Type','Issued By','Date','Status',''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {badges.map(b => (
                  <tr key={b.id} className="hover:bg-surface-elevated/50 transition-colors">
                    <td className="px-4 py-3 text-xl">{BADGE_ICONS[b.badge_type] ?? '🏅'}</td>
                    <td className="px-4 py-3 text-text-primary font-semibold">{b.candidate_name ?? b.candidate_id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-text-secondary capitalize">{b.badge_label ?? b.badge_type}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{b.issued_by ?? 'system'}</td>
                    <td className="px-4 py-3 text-text-muted text-xs">{formatDate(b.issued_at)}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${b.is_active ? 'bg-green-900/20 text-green-400 border-green-800/30' : 'bg-red-900/20 text-red-400 border-red-800/30'}`}>{b.is_active ? 'Active' : 'Revoked'}</span>
                    </td>
                    <td className="px-4 py-3">
                      {b.is_active && (
                        <button onClick={() => void revokeBadge(b.id)} disabled={acting === b.id} className="px-3 py-1.5 bg-red-900/10 border border-red-800/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/20 transition-colors disabled:opacity-40">
                          {acting === b.id ? '…' : 'Revoke'}
                        </button>
                      )}
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

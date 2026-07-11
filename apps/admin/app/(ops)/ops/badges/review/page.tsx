'use client'

import { useState, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

interface CandidateResult {
  id: string
  full_name: string
  email: string | null
}

interface WorkHistoryEntry {
  id: string
  company_name: string
  role_title: string
  start_date: string
  end_date: string | null
  is_current: boolean
}

interface EducationEntry {
  id: string
  institution: string
  degree: string
  field_of_study: string | null
  start_year: number | null
  end_year: number | null
}

interface ApprovedEntry {
  work_history_id: string | null
  education_id: string | null
  reviewed_by: string | null
  reviewed_at: string | null
}

interface IssuedBadge {
  id: string
  recipient_id: string
  recipient_name: string
  issued_by: string | null
  issuer_label: string
  issued_at: string
  status: string
}

function formatDate(d: string | null) {
  if (!d) return 'Present'
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

type Tab = 'issue' | 'history'

export default function AdminBadgeReviewPage() {
  const supabase = createClient()
  const router = useRouter()

  const [tab, setTab] = useState<Tab>('issue')
  const [history, setHistory] = useState<IssuedBadge[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [revokingRowId, setRevokingRowId] = useState<string | null>(null)
  const [revokeReason, setRevokeReason] = useState('')
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [historyError, setHistoryError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<CandidateResult[]>([])
  const [candidate, setCandidate] = useState<CandidateResult | null>(null)
  const [workHistory, setWorkHistory] = useState<WorkHistoryEntry[]>([])
  const [education, setEducation] = useState<EducationEntry[]>([])
  const [approvedEntries, setApprovedEntries] = useState<ApprovedEntry[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [issuing, setIssuing] = useState(false)
  const [staffEmail, setStaffEmail] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [existingBadge, setExistingBadge] = useState<string | null>(null)

  async function runSearch(term: string) {
    setSearch(term)
    if (term.trim().length < 2) {
      setResults([])
      return
    }
    setSearching(true)
    // Same two-step pattern used by the company-side Issue Badge search —
    // candidate_profiles and profiles aren't FK-chained for PostgREST to
    // embed, so email matches are resolved as a separate id lookup first.
    const { data: emailMatches } = await supabase
      .from('profiles')
      .select('id, email')
      .ilike('email', `%${term.trim()}%`)
      .eq('role', 'candidate')
    const emailIds = (emailMatches ?? []).map((p: { id: string }) => p.id)
    const emailById = new Map((emailMatches ?? []).map((p: { id: string; email: string }) => [p.id, p.email]))

    const nameFilter = `first_name.ilike.%${term.trim()}%,last_name.ilike.%${term.trim()}%`
    const orFilter = emailIds.length > 0 ? `${nameFilter},id.in.(${emailIds.join(',')})` : nameFilter

    const { data } = await supabase
      .from('candidate_profiles')
      .select('id, first_name, last_name')
      .or(orFilter)
      .limit(15)

    const rows = (data ?? []) as { id: string; first_name: string; last_name: string }[]
    setResults(rows.map(r => ({
      id: r.id,
      full_name: `${r.first_name} ${r.last_name}`.trim(),
      email: emailById.get(r.id) ?? null,
    })))
    setSearching(false)
  }

  // Every admin badge with who issued it and when — so a wrong decision
  // can be traced back to the staff member who made it.
  async function loadHistory() {
    setLoadingHistory(true)
    const { data: badgeRows } = await supabase
      .from('badges')
      .select('id, recipient_id, issued_by, issued_at, status')
      .eq('badge_type', 'admin')
      .order('issued_at', { ascending: false })

    const rows = (badgeRows ?? []) as { id: string; recipient_id: string; issued_by: string | null; issued_at: string; status: string }[]
    const recipientIds = [...new Set(rows.map(r => r.recipient_id))]
    const issuerIds = [...new Set(rows.map(r => r.issued_by).filter((v): v is string => !!v))]

    const [{ data: recipients }, { data: issuerProfiles }] = await Promise.all([
      recipientIds.length > 0
        ? supabase.from('candidate_profiles').select('id, first_name, last_name').in('id', recipientIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
      issuerIds.length > 0
        ? supabase.from('profiles').select('id, email').in('id', issuerIds)
        : Promise.resolve({ data: [] as { id: string; email: string }[] }),
    ])

    const issuerEmails = (issuerProfiles ?? []).map(p => p.email).filter(Boolean)
    const { data: staffRows } = issuerEmails.length > 0
      ? await supabase.from('staff_members').select('email, full_name').in('email', issuerEmails)
      : { data: [] as { email: string; full_name: string | null }[] }

    const recipientMap = new Map((recipients ?? []).map(r => [r.id, `${r.first_name} ${r.last_name}`.trim()]))
    const emailByProfileId = new Map((issuerProfiles ?? []).map(p => [p.id, p.email]))
    const nameByEmail = new Map((staffRows ?? []).map(s => [s.email.toLowerCase(), s.full_name]))

    setHistory(rows.map(r => {
      const email = r.issued_by ? emailByProfileId.get(r.issued_by) ?? null : null
      const staffName = email ? nameByEmail.get(email.toLowerCase()) : null
      return {
        id: r.id,
        recipient_id: r.recipient_id,
        recipient_name: recipientMap.get(r.recipient_id) ?? 'Unknown candidate',
        issued_by: r.issued_by,
        issuer_label: staffName ? `${staffName} (${email})` : email ?? 'Unknown staff',
        issued_at: r.issued_at,
        status: r.status,
      }
    }))
    setLoadingHistory(false)
  }

  async function revokeBadge(id: string) {
    setTogglingId(id)
    setHistoryError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateErr } = await supabase
      .from('badges')
      .update({
        status: 'revoked',
        revoked_at: new Date().toISOString(),
        revoked_by: user?.id ?? null,
        revocation_reason: revokeReason.trim() || null,
      })
      .eq('id', id)

    if (updateErr) {
      setHistoryError(`Could not revoke badge: ${updateErr.message}`)
      setTogglingId(null)
      return
    }

    await supabase.from('audit_logs').insert({
      event: 'admin.badge_revoked',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'badge',
      severity: 'warning',
      app: 'admin_panel',
      metadata: { reason: revokeReason.trim() || null },
    })

    setHistory(prev => prev.map(h => h.id === id ? { ...h, status: 'revoked' } : h))
    setRevokingRowId(null)
    setRevokeReason('')
    setTogglingId(null)
  }

  async function reactivateBadge(id: string) {
    setTogglingId(id)
    setHistoryError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateErr } = await supabase
      .from('badges')
      .update({ status: 'active', revoked_at: null, revoked_by: null, revocation_reason: null })
      .eq('id', id)

    if (updateErr) {
      setHistoryError(`Could not reactivate badge: ${updateErr.message}`)
      setTogglingId(null)
      return
    }

    await supabase.from('audit_logs').insert({
      event: 'admin.badge_reactivated',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'badge',
      severity: 'info',
      app: 'admin_panel',
    })

    setHistory(prev => prev.map(h => h.id === id ? { ...h, status: 'active' } : h))
    setTogglingId(null)
  }

  function switchTab(next: Tab) {
    setTab(next)
    if (next === 'history' && history.length === 0) void loadHistory()
  }

  async function openCandidate(c: CandidateResult) {
    setCandidate(c)
    setLoadingDetail(true)
    setError(null)
    setExistingBadge(null)

    const { data: { user } } = await supabase.auth.getUser()
    setStaffEmail(user?.email ?? null)

    const [{ data: wh }, { data: ed }, { data: vd }, { data: badge }] = await Promise.all([
      supabase.from('candidate_work_history').select('id, company_name, role_title, start_date, end_date, is_current').eq('candidate_id', c.id).order('start_date', { ascending: false }),
      supabase.from('candidate_education').select('id, institution, degree, field_of_study, start_year, end_year').eq('candidate_id', c.id).order('start_year', { ascending: false }),
      supabase.from('verification_documents').select('work_history_id, education_id, reviewed_by, reviewed_at').eq('candidate_id', c.id).eq('status', 'approved'),
      supabase.from('badges').select('id').eq('recipient_id', c.id).eq('badge_type', 'admin').eq('status', 'active').maybeSingle(),
    ])

    setWorkHistory((wh ?? []) as WorkHistoryEntry[])
    setEducation((ed ?? []) as EducationEntry[])
    setApprovedEntries((vd ?? []) as ApprovedEntry[])
    setExistingBadge((badge as { id: string } | null)?.id ?? null)
    setLoadingDetail(false)
  }

  function closeCandidate() {
    setCandidate(null)
    setWorkHistory([])
    setEducation([])
    setApprovedEntries([])
    setExistingBadge(null)
  }

  function isWorkApproved(id: string) {
    return approvedEntries.some(e => e.work_history_id === id)
  }
  function isEducationApproved(id: string) {
    return approvedEntries.some(e => e.education_id === id)
  }

  async function approveEntry(kind: 'work' | 'education', id: string) {
    if (!candidate) return
    setActing(id)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    // No file_url — proof for admin verification arrives via live chat, not
    // upload. This row exists purely as the reviewable "this specific job/
    // degree was checked" record, with who and when for accountability.
    const { error: insertErr } = await supabase.from('verification_documents').insert({
      candidate_id: candidate.id,
      doc_type: kind === 'work' ? 'work_history' : 'education',
      file_url: null,
      status: 'approved',
      work_history_id: kind === 'work' ? id : null,
      education_id: kind === 'education' ? id : null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })

    if (insertErr) {
      setError(`Could not approve entry: ${insertErr.message}`)
      setActing(null)
      return
    }

    setApprovedEntries(prev => [...prev, {
      work_history_id: kind === 'work' ? id : null,
      education_id: kind === 'education' ? id : null,
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    }])
    setActing(null)
  }

  const hasEntries = workHistory.length > 0 || education.length > 0
  const allApproved = hasEntries
    && workHistory.every(w => isWorkApproved(w.id))
    && education.every(e => isEducationApproved(e.id))

  async function issueAdminBadge() {
    if (!candidate || !allApproved) return
    setIssuing(true)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const { data: badge, error: badgeErr } = await supabase
      .from('badges')
      .insert({
        badge_type: 'admin',
        issuer_id: null,
        recipient_id: candidate.id,
        issued_by: user?.id,
        role_held: 'Full Profile Verification',
        start_date: new Date().toISOString().slice(0, 10),
        status: 'active',
        issued_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (badgeErr || !badge) {
      setError(`Could not issue badge: ${badgeErr?.message ?? 'unknown error'}`)
      setIssuing(false)
      return
    }

    const { error: signErr } = await supabase.rpc('sign_badge', { p_badge_id: (badge as { id: string }).id })
    if (signErr) {
      setError(`Badge created but signing failed: ${signErr.message}`)
      setIssuing(false)
      return
    }

    await supabase.from('audit_logs').insert({
      event: 'admin.badge_issued',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: candidate.id,
      target_type: 'candidate',
      severity: 'info',
      app: 'admin_panel',
      metadata: { badge_id: (badge as { id: string }).id },
    })

    setExistingBadge((badge as { id: string }).id)
    setHistory([]) // stale — refetch next time the Issued Badges tab is opened
    setIssuing(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Admin Badge Review" subtitle="Search a candidate to review their listed work history and education" />

      <div className="px-8 pt-4 flex gap-1 border-b border-surface-border">
        <button
          onClick={() => switchTab('issue')}
          className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'issue' ? 'border-ops-500 text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          Search &amp; Issue
        </button>
        <button
          onClick={() => switchTab('history')}
          className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${tab === 'history' ? 'border-ops-500 text-text-primary' : 'border-transparent text-text-muted hover:text-text-primary'}`}
        >
          Issued Badges
        </button>
      </div>

      {tab === 'history' ? (
        <div className="px-8 py-4 flex-1 overflow-y-auto">
          {historyError && (
            <div className="max-w-3xl bg-red-900/20 border border-red-800/30 text-red-400 text-sm px-4 py-2.5 rounded-lg mb-4">{historyError}</div>
          )}
          {loadingHistory ? (
            <p className="text-text-muted text-sm">Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-text-muted text-sm">No admin badges issued yet.</p>
          ) : (
            <div className="max-w-3xl overflow-x-auto rounded-xl border border-surface-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-surface-elevated border-b border-surface-border">
                    {['Candidate', 'Issued By', 'Date & Time', 'Status', 'Actions'].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-text-muted">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-border">
                  {history.map(h => (
                    <Fragment key={h.id}>
                      <tr className="hover:bg-surface-elevated/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-text-primary">{h.recipient_name}</td>
                        <td className="px-4 py-3 text-text-secondary">{h.issuer_label}</td>
                        <td className="px-4 py-3 text-text-muted text-xs">{formatDateTime(h.issued_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${h.status === 'active' ? 'bg-trust-high-bg text-trust-high border-trust-high-border' : 'bg-red-900/20 text-red-400 border-red-800/30'}`}>
                            {h.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {h.status === 'active' ? (
                            <button
                              onClick={() => { setRevokingRowId(revokingRowId === h.id ? null : h.id); setRevokeReason('') }}
                              disabled={togglingId === h.id}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-800/30 text-red-400 hover:bg-red-900/20 transition-colors"
                            >
                              Revoke
                            </button>
                          ) : (
                            <button
                              onClick={() => void reactivateBadge(h.id)}
                              disabled={togglingId === h.id}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-trust-high-border text-trust-high hover:bg-trust-high-bg transition-colors"
                            >
                              {togglingId === h.id ? '…' : 'Reactivate'}
                            </button>
                          )}
                        </td>
                      </tr>
                      {revokingRowId === h.id && (
                        <tr key={`${h.id}-revoke`} className="bg-surface-elevated/30">
                          <td colSpan={5} className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                autoFocus
                                value={revokeReason}
                                onChange={e => setRevokeReason(e.target.value)}
                                placeholder="Reason for revoking (optional)…"
                                className="flex-1 px-3 py-1.5 rounded-lg bg-surface-card border border-surface-border text-sm text-text-primary outline-none focus:border-red-500"
                              />
                              <button
                                onClick={() => void revokeBadge(h.id)}
                                disabled={togglingId === h.id}
                                className="text-xs font-bold px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors"
                              >
                                {togglingId === h.id ? '…' : 'Confirm Revoke'}
                              </button>
                              <button
                                onClick={() => { setRevokingRowId(null); setRevokeReason('') }}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg text-text-muted hover:text-text-primary transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
      <div className="px-8 py-4 flex-1 overflow-y-auto">
        {!candidate ? (
          <div className="max-w-xl">
            <div className="bg-ops-900/10 border border-ops-800/20 rounded-xl px-4 py-3 mb-4">
              <p className="text-xs text-text-secondary">
                This is a full profile verification, not a single job. Candidates send their proof (payslips, certificates, references) via live chat — nothing is uploaded here. You&apos;ll only see the work history and education they wrote in their profile — no age or other personal details.
              </p>
            </div>
            <input
              autoFocus
              value={search}
              onChange={e => void runSearch(e.target.value)}
              placeholder="Search candidate by name or email…"
              className="w-full px-4 py-2.5 rounded-xl bg-surface-card border border-surface-border text-sm text-text-primary outline-none focus:border-ops-500"
            />
            <div className="mt-3 space-y-2">
              {searching && <p className="text-xs text-text-muted">Searching…</p>}
              {results.map(r => (
                <button
                  key={r.id}
                  onClick={() => void openCandidate(r)}
                  className="w-full text-left bg-surface-card border border-surface-border rounded-xl p-3 hover:border-ops-500/50 transition-colors"
                >
                  <p className="text-sm font-semibold text-text-primary">{r.full_name}</p>
                  {r.email && <p className="text-xs text-text-muted">{r.email}</p>}
                </button>
              ))}
              {!searching && search.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-text-muted">No candidates found.</p>
              )}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl">
            <button onClick={closeCandidate} className="text-xs font-semibold text-ops-300 hover:underline mb-4">
              ← Back to search
            </button>

            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">{candidate.full_name}</h2>
                {candidate.email && <p className="text-xs text-text-muted">{candidate.email}</p>}
              </div>
              <button
                onClick={() => router.push(`/ops/chat?user=${candidate.id}`)}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-surface-border text-text-secondary hover:text-text-primary transition-colors"
              >
                Open chat with candidate →
              </button>
            </div>

            {error && (
              <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-sm px-4 py-2.5 rounded-lg mb-4">{error}</div>
            )}

            {existingBadge && (
              <div className="flex items-center gap-3 bg-trust-high-bg border border-trust-high-border rounded-xl px-4 py-3 mb-4">
                <Badge tone="bronze" size="sm" />
                <p className="text-sm font-semibold text-trust-high">Admin badge already issued to this candidate.</p>
              </div>
            )}

            {loadingDetail ? (
              <p className="text-text-muted text-sm">Loading…</p>
            ) : !hasEntries ? (
              <p className="text-text-muted text-sm">This candidate hasn&apos;t added any work history or education to their profile yet.</p>
            ) : (
              <div className="space-y-6">
                {workHistory.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Work Experience</h3>
                    <div className="space-y-2">
                      {workHistory.map(w => {
                        const approved = isWorkApproved(w.id)
                        const approvedMeta = approvedEntries.find(e => e.work_history_id === w.id)
                        return (
                          <div key={w.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{w.role_title} · {w.company_name}</p>
                              <p className="text-xs text-text-muted mt-0.5">{formatDate(w.start_date)} — {w.is_current ? 'Present' : formatDate(w.end_date)}</p>
                              {approved && approvedMeta?.reviewed_at && (
                                <p className="text-[11px] text-trust-high mt-1">Approved {formatDateTime(approvedMeta.reviewed_at)}</p>
                              )}
                            </div>
                            {approved ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-trust-high-bg text-trust-high border border-trust-high-border">Approved</span>
                            ) : (
                              <button
                                onClick={() => void approveEntry('work', w.id)}
                                disabled={acting === w.id}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-trust-high-border text-trust-high hover:bg-trust-high-bg transition-colors"
                              >
                                {acting === w.id ? '…' : 'Approve'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {education.length > 0 && (
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted mb-2">Education</h3>
                    <div className="space-y-2">
                      {education.map(e => {
                        const approved = isEducationApproved(e.id)
                        const approvedMeta = approvedEntries.find(a => a.education_id === e.id)
                        return (
                          <div key={e.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start justify-between">
                            <div>
                              <p className="text-sm font-semibold text-text-primary">{e.degree}{e.field_of_study ? `, ${e.field_of_study}` : ''}</p>
                              <p className="text-xs text-text-muted mt-0.5">{e.institution} · {e.start_year ?? '—'}–{e.end_year ?? '—'}</p>
                              {approved && approvedMeta?.reviewed_at && (
                                <p className="text-[11px] text-trust-high mt-1">Approved {formatDateTime(approvedMeta.reviewed_at)}</p>
                              )}
                            </div>
                            {approved ? (
                              <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-trust-high-bg text-trust-high border border-trust-high-border">Approved</span>
                            ) : (
                              <button
                                onClick={() => void approveEntry('education', e.id)}
                                disabled={acting === e.id}
                                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-trust-high-border text-trust-high hover:bg-trust-high-bg transition-colors"
                              >
                                {acting === e.id ? '…' : 'Approve'}
                              </button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {!existingBadge && (
                  <button
                    onClick={() => void issueAdminBadge()}
                    disabled={!allApproved || issuing}
                    className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
                      allApproved
                        ? 'bg-ops-500 hover:bg-ops-600 text-white'
                        : 'bg-surface-elevated text-text-muted cursor-not-allowed'
                    }`}
                  >
                    {issuing ? 'Issuing…' : allApproved ? 'Issue Admin Badge' : 'Approve every entry above to issue'}
                  </button>
                )}

                {staffEmail && (
                  <p className="text-[11px] text-text-muted text-center">Signed in as {staffEmail} — every approval and issuance records your account.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      )}
    </div>
  )
}

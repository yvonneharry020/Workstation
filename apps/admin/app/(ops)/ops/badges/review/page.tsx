'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import TopBar from '@/components/layout/TopBar'
import { Badge } from '@/components/ui/Badge'
import { createClient } from '@/lib/supabase/client'

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

function formatDate(d: string | null) {
  if (!d) return 'Present'
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AdminBadgeReviewPage() {
  const supabase = createClient()
  const router = useRouter()

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
    setIssuing(false)
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="Admin Badge Review" subtitle="Search a candidate to review their listed work history and education" />

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
    </div>
  )
}

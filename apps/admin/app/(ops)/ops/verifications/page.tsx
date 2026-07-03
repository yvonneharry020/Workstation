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
  avatar_url: string | null
}

interface Company {
  id: string
  user_id: string
  name: string
  email: string
  verification_status: string
  industry: string | null
  created_at: string
  logo_url: string | null
}

interface VerificationDoc {
  id: string
  candidate_id: string
  doc_type: 'nin' | 'passport' | 'degree' | 'liveness' | 'other'
  file_url: string | null
  status: 'pending' | 'verified' | 'rejected'
  notes: string | null
  uploaded_at: string
}

type Tab = 'candidates' | 'companies'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_COLORS: Record<string, string> = {
  pending:      'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  verified:     'bg-green-900/20 text-green-400 border-green-800/30',
  rejected:     'bg-red-900/20 text-red-400 border-red-800/30',
  under_review: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
}

const DOC_LABELS: Record<string, string> = {
  nin:       'NIN',
  passport:  'Passport',
  degree:    'Degree Certificate',
  liveness:  'Liveness Check',
  other:     'Other Document',
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url)
}

function DocStatusBadge({ status }: { status: string }) {
  const styles: Record<string, { color: string; bg: string; border: string }> = {
    pending:  { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)' },
    verified: { color: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)' },
    rejected: { color: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  }
  const s = styles[status] ?? styles.pending
  return (
    <span style={{ color: s.color, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>
      {status}
    </span>
  )
}

export default function VerificationsPage() {
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('candidates')
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [filter, setFilter] = useState('pending')

  // Doc drawer state
  const [docDrawerCandidateId, setDocDrawerCandidateId] = useState<string | null>(null)
  const [docs, setDocs] = useState<VerificationDoc[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docActing, setDocActing] = useState<string | null>(null)
  const [docNotes, setDocNotes] = useState<Record<string, string>>({})

  useEffect(() => { void load() }, [])

  async function load() {
    const [{ data: candData }, { data: compData }, { data: avatarData }, { data: logoData }] = await Promise.all([
      supabase.from('candidates').select('id,user_id,full_name,email,verification_status,trust_score,created_at,skills,experience').order('created_at', { ascending: false }),
      supabase.from('companies').select('id,user_id,name,email,verification_status,industry,created_at').order('created_at', { ascending: false }),
      supabase.from('candidate_profiles').select('id,avatar_url'),
      supabase.from('company_profiles').select('id,logo_url'),
    ])
    const avatarMap = new Map((avatarData ?? []).map((r: { id: string; avatar_url: string | null }) => [r.id, r.avatar_url]))
    const logoMap = new Map((logoData ?? []).map((r: { id: string; logo_url: string | null }) => [r.id, r.logo_url]))
    setCandidates((candData ?? []).map(c => ({ ...c, avatar_url: avatarMap.get(c.id) ?? null })) as Candidate[])
    setCompanies((compData ?? []).map(c => ({ ...c, logo_url: logoMap.get(c.id) ?? null })) as Company[])
    setLoading(false)
  }

  async function openDocDrawer(candidateId: string) {
    setDocDrawerCandidateId(candidateId)
    setDocsLoading(true)
    const { data } = await supabase
      .from('verification_documents')
      .select('*')
      .eq('candidate_id', candidateId)
      .order('uploaded_at', { ascending: false })
    setDocs((data ?? []) as VerificationDoc[])
    setDocsLoading(false)
  }

  function closeDocDrawer() {
    setDocDrawerCandidateId(null)
    setDocs([])
    setDocNotes({})
  }

  async function updateDocStatus(doc: VerificationDoc, status: 'verified' | 'rejected') {
    setDocActing(doc.id)
    const { data: { user } } = await supabase.auth.getUser()
    const notes = docNotes[doc.id] ?? null
    await supabase.from('verification_documents').update({ status, notes }).eq('id', doc.id)
    await supabase.from('audit_logs').insert({
      event: `admin.doc_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: doc.id,
      target_type: 'verification_document',
      severity: 'info',
      app: 'admin_panel',
    })
    setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, status, notes } : d))
    setDocActing(null)
  }

  async function requestReupload(doc: VerificationDoc) {
    setDocActing(`reupload-${doc.id}`)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('admin_notifications').insert({
      type: 'reupload_request',
      category: 'verification',
      title: 'Document Re-upload Required',
      body: `Please re-upload your ${DOC_LABELS[doc.doc_type] ?? doc.doc_type}. Notes: ${docNotes[doc.id] ?? 'Please provide a clearer photo.'}`,
      is_read: false,
      metadata: { doc_id: doc.id, candidate_id: doc.candidate_id, requested_by: user?.id ?? null },
    })
    setDocActing(null)
    alert('Re-upload request sent to candidate')
  }

  async function updateCandidateStatus(id: string, status: string) {
    setActing(id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('candidate_verification').update({ overall_status: status }).eq('candidate_id', id)
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
    await supabase.from('company_verification').update({ overall_status: status }).eq('company_id', id)
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
  const filteredCompanies  = companies.filter(c => filter === 'all' || c.verification_status === filter)
  const pendingCand = candidates.filter(c => c.verification_status === 'pending').length
  const pendingComp = companies.filter(c => c.verification_status === 'pending').length

  const drawerCandidate = candidates.find(c => c.id === docDrawerCandidateId)

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
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
                  <div className="w-9 h-9 rounded-full bg-ops-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {c.avatar_url
                      ? <img src={c.avatar_url} alt={c.full_name} className="w-full h-full object-cover" />
                      : <span className="text-ops-400 text-sm font-bold">{c.full_name?.[0]?.toUpperCase() ?? '?'}</span>
                    }
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
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => void openDocDrawer(c.id)}
                    style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    View Docs
                  </button>
                  {c.verification_status === 'pending' && (
                    <>
                      <button onClick={() => void updateCandidateStatus(c.id, 'verified')} disabled={acting === c.id} className="px-3 py-1.5 bg-green-900/20 border border-green-800/30 text-green-400 text-xs font-semibold rounded-lg hover:bg-green-900/30 transition-colors disabled:opacity-40">Approve</button>
                      <button onClick={() => void updateCandidateStatus(c.id, 'rejected')} disabled={acting === c.id} className="px-3 py-1.5 bg-red-900/20 border border-red-800/30 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/30 transition-colors disabled:opacity-40">Reject</button>
                    </>
                  )}
                </div>
              </div>
            ))}
            {filteredCandidates.length === 0 && <p className="text-text-muted text-sm">No candidates with status: {filter}.</p>}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCompanies.map(c => (
              <div key={c.id} className="bg-surface-card border border-surface-border rounded-xl p-4 flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-ops-900/30 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {c.logo_url
                      ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                      : <span className="text-ops-400 text-sm font-bold">{c.name?.[0]?.toUpperCase() ?? '?'}</span>
                    }
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

      {/* Document Viewer Drawer */}
      {docDrawerCandidateId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeDocDrawer} />
          <div style={{ position: 'relative', width: 520, height: '100%', backgroundColor: 'var(--bg-surface)', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Verification Documents</h3>
                {drawerCandidate && <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>{drawerCandidate.full_name} · {drawerCandidate.email}</p>}
              </div>
              <button onClick={closeDocDrawer} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {docsLoading ? (
              <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>Loading documents…</p>
            ) : docs.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>No documents uploaded yet.</p>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 6 }}>The candidate has not submitted any identity documents.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {docs.map(doc => (
                  <div key={doc.id} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    {/* Doc header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{DOC_LABELS[doc.doc_type] ?? doc.doc_type}</p>
                        <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>Uploaded {formatDate(doc.uploaded_at)}</p>
                      </div>
                      <DocStatusBadge status={doc.status} />
                    </div>

                    {/* File preview */}
                    {doc.file_url ? (
                      isImageUrl(doc.file_url) ? (
                        <div style={{ marginBottom: 12, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={doc.file_url} alt={DOC_LABELS[doc.doc_type] ?? 'Document'} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', backgroundColor: 'var(--bg-base)' }} />
                        </div>
                      ) : (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 8, backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', marginBottom: 12, textDecoration: 'none' }}>
                          <span style={{ fontSize: 20 }}>📄</span>
                          <div>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#6366F1' }}>View Document</p>
                            <p style={{ fontSize: 10, color: 'var(--tx-3)' }}>{doc.file_url.split('/').pop()}</p>
                          </div>
                        </a>
                      )
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 12 }}>No file attached.</p>
                    )}

                    {/* Existing notes */}
                    {doc.notes && (
                      <p style={{ fontSize: 11, color: 'var(--tx-3)', backgroundColor: 'var(--bg-base)', padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                        Note: {doc.notes}
                      </p>
                    )}

                    {/* Notes input */}
                    <textarea
                      placeholder="Add reviewer notes (optional)…"
                      value={docNotes[doc.id] ?? ''}
                      onChange={e => setDocNotes(prev => ({ ...prev, [doc.id]: e.target.value }))}
                      rows={2}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: 12, resize: 'vertical', marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
                    />

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {doc.status !== 'verified' && (
                        <button onClick={() => void updateDocStatus(doc, 'verified')} disabled={docActing === doc.id}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)', color: '#34D399', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          {docActing === doc.id ? '…' : '✓ Verify'}
                        </button>
                      )}
                      {doc.status !== 'rejected' && (
                        <button onClick={() => void updateDocStatus(doc, 'rejected')} disabled={docActing === doc.id}
                          style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                          {docActing === doc.id ? '…' : '✗ Reject'}
                        </button>
                      )}
                      <button onClick={() => void requestReupload(doc)} disabled={docActing === `reupload-${doc.id}`}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.08)', color: '#FBBF24', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                        {docActing === `reupload-${doc.id}` ? '…' : '↑ Request Re-upload'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

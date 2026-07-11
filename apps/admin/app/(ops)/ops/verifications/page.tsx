'use client'

import { useState, useEffect } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

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

interface CompanyDocs {
  cac_cert_url: string | null
  scuml_url: string | null
  address_proof_url: string | null
  address_proof_document_date: string | null
  office_video_url: string | null
  documents_status: string
  documents_reviewer_id: string | null
  documents_reviewed_at: string | null
  documents_rejection_reason: string | null
}

const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6

function isDocumentStale(dateStr: string | null): boolean {
  if (!dateStr) return false
  return Date.now() - new Date(dateStr).getTime() > SIX_MONTHS_MS
}

type Tab = 'candidates' | 'companies'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

const STATUS_COLORS: Record<string, string> = {
  not_started:  'bg-surface-muted text-text-muted border-surface-border',
  pending:      'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  in_review:    'bg-blue-900/20 text-blue-400 border-blue-800/30',
  approved:     'bg-green-900/20 text-green-400 border-green-800/30',
  rejected:     'bg-red-900/20 text-red-400 border-red-800/30',
  requires_resubmission: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
}

function isImageUrl(url: string) {
  return /\.(jpg|jpeg|png|gif|webp|bmp)(\?.*)?$/i.test(url)
}

function DocLink({ label, url }: { label: string; url: string | null }) {
  if (!url) {
    return (
      <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 4 }}>{label}</p>
        <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>Not uploaded yet.</p>
      </div>
    )
  }
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 8 }}>{label}</p>
      {isImageUrl(url) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={label} style={{ width: '100%', maxHeight: 220, objectFit: 'contain', backgroundColor: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--border)' }} />
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6366F1', textDecoration: 'underline' }}>
          View document
        </a>
      )}
    </div>
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
  const [error, setError] = useState<string | null>(null)

  // Company doc drawer
  const [docDrawerCompanyId, setDocDrawerCompanyId] = useState<string | null>(null)
  const [companyDocs, setCompanyDocs] = useState<CompanyDocs | null>(null)
  const [docsLoading, setDocsLoading] = useState(false)
  const [rejectionNote, setRejectionNote] = useState('')

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
    // Only companies that have actually requested business-address verification
    // belong in this queue — staff can't action anything for a company that
    // hasn't submitted, so 'not_started' rows are excluded unconditionally.
    setCompanies((compData ?? [])
      .filter((c: { verification_status: string }) => c.verification_status !== 'not_started')
      .map((c: Omit<Company, 'logo_url'>) => ({ ...c, logo_url: logoMap.get(c.id) ?? null })) as Company[])
    setLoading(false)
  }

  async function openDocDrawer(companyId: string) {
    setDocDrawerCompanyId(companyId)
    setDocsLoading(true)
    setRejectionNote('')
    const { data } = await supabase
      .from('company_verification')
      .select('cac_cert_url, scuml_url, address_proof_url, address_proof_document_date, office_video_url, documents_status, documents_reviewer_id, documents_reviewed_at, documents_rejection_reason')
      .eq('company_id', companyId)
      .maybeSingle()
    setCompanyDocs((data as CompanyDocs | null) ?? {
      cac_cert_url: null, scuml_url: null, address_proof_url: null, address_proof_document_date: null, office_video_url: null,
      documents_status: 'not_started', documents_reviewer_id: null, documents_reviewed_at: null, documents_rejection_reason: null,
    })
    setDocsLoading(false)
  }

  function closeDocDrawer() {
    setDocDrawerCompanyId(null)
    setCompanyDocs(null)
  }

  // Companies only — this is the one manual staff approval step (business
  // address proof + CAC cert + SCUML); everything else about a company is
  // third-party verified. Upserts because no company_verification row may
  // exist yet, and records who decided + when for accountability.
  async function decideCompanyDocuments(companyId: string, status: 'approved' | 'rejected') {
    setActing(companyId)
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: updateErr } = await supabase.from('company_verification').upsert({
      company_id: companyId,
      documents_status: status,
      documents_reviewer_id: user?.id ?? null,
      documents_reviewed_at: new Date().toISOString(),
      documents_rejection_reason: status === 'rejected' ? (rejectionNote.trim() || null) : null,
    }, { onConflict: 'company_id' })

    if (updateErr) {
      setError(`Could not save decision: ${updateErr.message}`)
      setActing(null)
      return
    }

    await supabase.from('audit_logs').insert({
      event: `admin.company_documents_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: companyId,
      target_type: 'company',
      severity: 'info',
      app: 'admin_panel',
      metadata: { note: rejectionNote.trim() || null },
    })

    setCompanies(prev => prev.map(c => c.id === companyId ? { ...c, verification_status: status } : c))
    setCompanyDocs(prev => prev ? { ...prev, documents_status: status, documents_reviewer_id: user?.id ?? null, documents_reviewed_at: new Date().toISOString() } : prev)
    setActing(null)
  }

  const filteredCandidates = candidates.filter(c => filter === 'all' || c.verification_status === filter)
  const filteredCompanies  = companies.filter(c => filter === 'all' || c.verification_status === filter)
  const pendingCand = candidates.filter(c => c.verification_status === 'pending').length
  const pendingComp = companies.filter(c => c.verification_status === 'pending').length

  const drawerCompany = companies.find(c => c.id === docDrawerCompanyId)

  return (
    <div className="flex flex-col" style={{ minHeight: '100vh', backgroundColor: 'var(--bg-base)' }}>
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">Verification Queue</h1>
        <p className="text-sm text-text-secondary mt-0.5">
          Candidates are verified automatically by our identity provider — nothing to review here. Companies need one manual step: confirming their business-address proof after CAC checks pass.
        </p>
      </div>

      {error && (
        <div className="mx-8 mt-4 bg-red-900/20 border border-red-800/30 text-red-400 text-sm px-4 py-2.5 rounded-lg">{error}</div>
      )}

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
          {['all','pending','approved','rejected','in_review'].map(s => (
            <button key={s} onClick={() => setFilter(s)} className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-colors ${filter === s ? 'bg-surface-elevated text-text-primary border border-surface-border' : 'text-text-muted hover:text-text-primary'}`}>{s.replace('_',' ')}</button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-4">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : tab === 'candidates' ? (
          <div className="space-y-2">
            <div className="bg-ops-900/10 border border-ops-800/20 rounded-xl px-4 py-3 mb-2">
              <p className="text-xs text-text-secondary">Identity (NIN, liveness) is verified automatically by the identity provider — status shown for visibility only, nothing to action here.</p>
            </div>
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
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_COLORS[c.verification_status] ?? ''}`}>{c.verification_status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-text-muted">{c.email}</p>
                    <p className="text-xs text-text-muted mt-0.5">Joined {formatDate(c.created_at)}{c.trust_score !== null ? ` · Trust: ${c.trust_score}%` : ''}</p>
                  </div>
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
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border capitalize ${STATUS_COLORS[c.verification_status] ?? ''}`}>{c.verification_status.replace('_', ' ')}</span>
                    </div>
                    <p className="text-xs text-text-muted">{c.email}{c.industry ? ` · ${c.industry}` : ''}</p>
                    <p className="text-xs text-text-muted mt-0.5">Registered {formatDate(c.created_at)}</p>
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => void openDocDrawer(c.id)}
                    style={{ padding: '5px 11px', borderRadius: 7, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                    View Business Documents
                  </button>
                </div>
              </div>
            ))}
            {filteredCompanies.length === 0 && <p className="text-text-muted text-sm">No companies with status: {filter}.</p>}
          </div>
        )}
      </div>

      {/* Company Business Documents Drawer */}
      {docDrawerCompanyId && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={closeDocDrawer} />
          <div style={{ position: 'relative', width: 520, height: '100%', backgroundColor: 'var(--bg-surface)', overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>Business Documents</h3>
                {drawerCompany && <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 2 }}>{drawerCompany.name} · {drawerCompany.email}</p>}
              </div>
              <button onClick={closeDocDrawer} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 22, lineHeight: 1 }}>×</button>
            </div>

            {docsLoading ? (
              <p style={{ color: 'var(--tx-3)', fontSize: 13 }}>Loading documents…</p>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <DocLink label="CAC Certificate" url={companyDocs?.cac_cert_url ?? null} />
                  <div>
                    <DocLink label="Business Address Proof" url={companyDocs?.address_proof_url ?? null} />
                    {companyDocs?.address_proof_document_date && (
                      <p style={{ fontSize: 11, marginTop: 6, color: isDocumentStale(companyDocs.address_proof_document_date) ? '#F87171' : 'var(--tx-3)' }}>
                        Document dated {formatDate(companyDocs.address_proof_document_date)}
                        {isDocumentStale(companyDocs.address_proof_document_date) ? ' — older than 6 months, should not be accepted' : ''}
                      </p>
                    )}
                  </div>
                  <DocLink label="SCUML Certificate" url={companyDocs?.scuml_url ?? null} />
                  <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 8 }}>Office Walkthrough Video</p>
                    {companyDocs?.office_video_url ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={companyDocs.office_video_url} controls style={{ width: '100%', maxHeight: 260, borderRadius: 8, backgroundColor: 'var(--bg-base)' }} />
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>Not uploaded yet.</p>
                    )}
                  </div>
                </div>

                {companyDocs?.documents_reviewed_at && (
                  <div style={{ backgroundColor: 'var(--bg-base)', borderRadius: 10, padding: 12 }}>
                    <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>
                      Last reviewed {formatDateTime(companyDocs.documents_reviewed_at)}
                      {companyDocs.documents_rejection_reason ? ` — ${companyDocs.documents_rejection_reason}` : ''}
                    </p>
                  </div>
                )}

                {companyDocs?.documents_status !== 'approved' && (
                  <>
                    <textarea
                      placeholder="Rejection reason (only needed if rejecting)…"
                      value={rejectionNote}
                      onChange={e => setRejectionNote(e.target.value)}
                      rows={2}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: 12, resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => void decideCompanyDocuments(docDrawerCompanyId, 'approved')}
                        disabled={acting === docDrawerCompanyId}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(52,211,153,0.4)', backgroundColor: 'rgba(52,211,153,0.08)', color: '#34D399', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                        {acting === docDrawerCompanyId ? '…' : '✓ Approve'}
                      </button>
                      <button
                        onClick={() => void decideCompanyDocuments(docDrawerCompanyId, 'rejected')}
                        disabled={acting === docDrawerCompanyId}
                        style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>
                        {acting === docDrawerCompanyId ? '…' : '✗ Reject'}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface Candidate { id: string; full_name: string | null; email: string; verification_status: string | null }
interface Company { id: string; company_name: string | null; email: string; verification_status: string | null }
interface Job { id: string; title: string; status: string | null }
interface Flagged { id: string; content_type: string; reason: string; status: string | null }

interface Results {
  candidates: Candidate[]
  companies: Company[]
  jobs: Job[]
  flagged: Flagged[]
}

const EMPTY: Results = { candidates: [], companies: [], jobs: [], flagged: [] }

export default function SearchPage() {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get('q') ?? '')
  const [results, setResults] = useState<Results>(EMPTY)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const runSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(EMPTY); return }
    setLoading(true)
    const [byName, byEmail, companies, jobs, flagged] = await Promise.all([
      supabase.from('candidates').select('id,full_name,email,verification_status').ilike('full_name', `%${q}%`).limit(5),
      supabase.from('candidates').select('id,full_name,email,verification_status').ilike('email', `%${q}%`).limit(5),
      supabase.from('companies').select('id,company_name,email,verification_status').ilike('company_name', `%${q}%`).limit(5),
      supabase.from('job_postings').select('id,title,status').ilike('title', `%${q}%`).limit(5),
      supabase.from('flagged_content').select('id,content_type,reason,status').ilike('reason', `%${q}%`).limit(5),
    ])
    const seen = new Set<string>()
    const candidates: Candidate[] = []
    for (const c of [...(byName.data ?? []), ...(byEmail.data ?? [])]) {
      if (!seen.has(c.id)) { seen.add(c.id); candidates.push(c as Candidate) }
    }
    setResults({
      candidates,
      companies: (companies.data ?? []) as Company[],
      jobs: (jobs.data ?? []) as Job[],
      flagged: (flagged.data ?? []) as Flagged[],
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => { void runSearch(query) }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, runSearch])

  const total = results.candidates.length + results.companies.length + results.jobs.length + results.flagged.length
  const hasQuery = query.length >= 2

  function statusBadge(status: string | null) {
    const map: Record<string, { color: string; bg: string }> = {
      verified: { color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
      pending: { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
      rejected: { color: '#F87171', bg: 'rgba(239,68,68,0.1)' },
      active: { color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
      closed: { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' },
    }
    const s = map[status ?? ''] ?? { color: '#9CA3AF', bg: 'rgba(156,163,175,0.1)' }
    return (
      <span style={{ color: s.color, backgroundColor: s.bg, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, textTransform: 'capitalize' }}>
        {status ?? 'unknown'}
      </span>
    )
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Global Search" subtitle="Search across candidates, companies, jobs, and flagged content" />
      <div className="p-6 space-y-5">

        {/* Search box */}
        <div style={CARD} className="p-4">
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            </span>
            <input
              autoFocus
              value={query}
              onChange={e => { setQuery(e.target.value); router.replace(`/search?q=${encodeURIComponent(e.target.value)}`, { scroll: false }) }}
              placeholder="Search candidates, companies, jobs, flagged content…"
              style={{ width: '100%', padding: '10px 14px 10px 40px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--tx-1)', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
            />
            <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx-3)', fontSize: 11, fontFamily: 'monospace', backgroundColor: 'var(--bg-base)', padding: '2px 6px', borderRadius: 4, border: '1px solid var(--border)' }}>Ctrl+K</span>
          </div>
          {hasQuery && <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 8 }}>{loading ? 'Searching…' : `${total} result${total !== 1 ? 's' : ''} for "${query}"`}</p>}
        </div>

        {/* Results */}
        {hasQuery && !loading && total === 0 && (
          <div style={{ ...CARD, padding: '48px', textAlign: 'center' }}>
            <p style={{ color: 'var(--tx-3)', fontSize: 14 }}>No results found for &quot;{query}&quot;</p>
            <p style={{ color: 'var(--tx-3)', fontSize: 12, marginTop: 4 }}>Try a different search term</p>
          </div>
        )}

        {results.candidates.length > 0 && (
          <div style={CARD} className="overflow-hidden">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Candidates</span>
              <span style={{ backgroundColor: 'rgba(56,189,248,0.1)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{results.candidates.length}</span>
            </div>
            {results.candidates.map(c => (
              <div key={c.id} onClick={() => router.push('/users')} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{c.full_name ?? 'Unnamed'}</p>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>{c.email}</p>
                </div>
                {statusBadge(c.verification_status)}
              </div>
            ))}
          </div>
        )}

        {results.companies.length > 0 && (
          <div style={CARD} className="overflow-hidden">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Companies</span>
              <span style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{results.companies.length}</span>
            </div>
            {results.companies.map(c => (
              <div key={c.id} onClick={() => router.push('/users')} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{c.company_name ?? 'Unnamed'}</p>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>{c.email}</p>
                </div>
                {statusBadge(c.verification_status)}
              </div>
            ))}
          </div>
        )}

        {results.jobs.length > 0 && (
          <div style={CARD} className="overflow-hidden">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Jobs</span>
              <span style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{results.jobs.length}</span>
            </div>
            {results.jobs.map(j => (
              <div key={j.id} onClick={() => router.push('/jobs')} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <p style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{j.title}</p>
                {statusBadge(j.status)}
              </div>
            ))}
          </div>
        )}

        {results.flagged.length > 0 && (
          <div style={CARD} className="overflow-hidden">
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>Flagged Items</span>
              <span style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>{results.flagged.length}</span>
            </div>
            {results.flagged.map(f => (
              <div key={f.id} onClick={() => router.push('/flagged')} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-surface)')}
                onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                <div>
                  <p style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 500 }}>{f.reason.slice(0, 60)}{f.reason.length > 60 ? '…' : ''}</p>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', textTransform: 'capitalize' }}>{f.content_type}</p>
                </div>
                {statusBadge(f.status)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

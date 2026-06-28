'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

function fmt(n: number) { return '₦' + n.toLocaleString('en-NG') }

interface ReportData {
  candidates: { total: number; thisMonth: number; verified: number }
  companies: { total: number; verified: number }
  jobs: { total: number; active: number; filled: number }
  applications: { total: number; hiredThisMonth: number }
  revenue: { totalInvoiced: number; mrr: number }
  health: { flagged: number; dsrPending: number; verificationQueue: number }
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx-1)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12, paddingBottom: 6, borderBottom: '2px solid var(--border)' }}>{title}</h3>
      {children}
    </div>
  )
}

function MetricRow({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{label}</span>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {note && <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>{note}</span>}
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>{value}</span>
      </div>
    </div>
  )
}

export default function BoardReportPage() {
  const supabase = createClient()
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const [
      candTotal, candThisMonth, candVerified,
      compTotal, compVerified,
      jobTotal, jobActive, jobFilled,
      appTotal, appHired,
      invoiceSum, subs,
      flagged, dsrPending, verQueue,
    ] = await Promise.all([
      supabase.from('candidates').select('*', { count: 'exact', head: true }),
      supabase.from('candidates').select('*', { count: 'exact', head: true }).gte('created_at', monthStart),
      supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
      supabase.from('companies').select('*', { count: 'exact', head: true }),
      supabase.from('companies').select('*', { count: 'exact', head: true }).eq('verification_status', 'verified'),
      supabase.from('job_postings').select('*', { count: 'exact', head: true }),
      supabase.from('job_postings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('job_postings').select('*', { count: 'exact', head: true }).eq('status', 'filled'),
      supabase.from('job_applications').select('*', { count: 'exact', head: true }),
      supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'hired').gte('updated_at', monthStart),
      supabase.from('invoices').select('amount').eq('status', 'paid'),
      supabase.from('platform_subscriptions').select('amount').eq('status', 'active'),
      supabase.from('flagged_content').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('data_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    ])

    const totalInvoiced = (invoiceSum.data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)
    const mrr = (subs.data ?? []).reduce((s: number, r: { amount: number }) => s + Number(r.amount), 0)

    setData({
      candidates: { total: candTotal.count ?? 0, thisMonth: candThisMonth.count ?? 0, verified: candVerified.count ?? 0 },
      companies: { total: compTotal.count ?? 0, verified: compVerified.count ?? 0 },
      jobs: { total: jobTotal.count ?? 0, active: jobActive.count ?? 0, filled: jobFilled.count ?? 0 },
      applications: { total: appTotal.count ?? 0, hiredThisMonth: appHired.count ?? 0 },
      revenue: { totalInvoiced, mrr },
      health: { flagged: flagged.count ?? 0, dsrPending: dsrPending.count ?? 0, verificationQueue: verQueue.count ?? 0 },
    })
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const now = new Date()
  const monthLabel = now.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })

  function generateHighlights(): string[] {
    if (!data) return []
    const h: string[] = []
    if (data.candidates.thisMonth > 0) h.push(`${data.candidates.thisMonth} new candidates joined this month (${data.candidates.total} total).`)
    if (data.applications.hiredThisMonth > 0) h.push(`${data.applications.hiredThisMonth} successful placement${data.applications.hiredThisMonth > 1 ? 's' : ''} this month.`)
    if (data.revenue.mrr > 0) h.push(`Monthly Recurring Revenue stands at ${fmt(data.revenue.mrr)}, projecting ${fmt(data.revenue.mrr * 12)} ARR.`)
    if (data.health.flagged > 0) h.push(`${data.health.flagged} flagged content item${data.health.flagged > 1 ? 's' : ''} awaiting moderation review.`)
    if (data.health.verificationQueue > 0) h.push(`${data.health.verificationQueue} candidate${data.health.verificationQueue > 1 ? 's' : ''} pending verification in the queue.`)
    return h
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <style>{`@media print { .no-print { display: none !important; } body { background: white; } }`}</style>
      <div className="no-print">
        <TopBar title="Board Report" subtitle="Executive summary across all platform rooms" />
      </div>
      <div className="p-6">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }} className="no-print">
          <div />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => void load()} style={{ padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Refresh Data</button>
            <button onClick={() => window.print()} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Print / Download PDF</button>
          </div>
        </div>

        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {/* Report header */}
          <div style={{ textAlign: 'center', marginBottom: 32, padding: '24px 0', borderBottom: '2px solid var(--border)' }}>
            <h1 style={{ fontSize: 24, fontWeight: 900, color: 'var(--tx-1)', letterSpacing: '-0.02em' }}>WORKSTATION — BOARD REPORT</h1>
            <p style={{ fontSize: 14, color: 'var(--tx-3)', marginTop: 6 }}>{monthLabel} · Confidential</p>
          </div>

          {loading ? (
            <div className="p-16 text-center"><p style={{ color: 'var(--tx-3)' }}>Fetching platform data…</p></div>
          ) : !data ? null : (
            <>
              <Section title="1. User Metrics">
                <MetricRow label="Total Candidates" value={data.candidates.total.toLocaleString('en-NG')} />
                <MetricRow label="New Candidates This Month" value={data.candidates.thisMonth} />
                <MetricRow label="Verified Candidates" value={data.candidates.verified} note={`${data.candidates.total > 0 ? Math.round((data.candidates.verified / data.candidates.total) * 100) : 0}% verified`} />
                <MetricRow label="Total Companies" value={data.companies.total.toLocaleString('en-NG')} />
                <MetricRow label="Verified Companies" value={data.companies.verified} note={`${data.companies.total > 0 ? Math.round((data.companies.verified / data.companies.total) * 100) : 0}% verified`} />
              </Section>

              <Section title="2. Marketplace Activity">
                <MetricRow label="Total Jobs Posted" value={data.jobs.total.toLocaleString('en-NG')} />
                <MetricRow label="Active Job Listings" value={data.jobs.active} />
                <MetricRow label="Filled Positions" value={data.jobs.filled} />
                <MetricRow label="Total Applications" value={data.applications.total.toLocaleString('en-NG')} />
                <MetricRow label="Successful Placements This Month" value={data.applications.hiredThisMonth} />
              </Section>

              <Section title="3. Revenue">
                <MetricRow label="Total Invoiced (All Time)" value={fmt(data.revenue.totalInvoiced)} />
                <MetricRow label="Monthly Recurring Revenue (MRR)" value={fmt(data.revenue.mrr)} />
                <MetricRow label="Projected ARR" value={fmt(data.revenue.mrr * 12)} />
              </Section>

              <Section title="4. Platform Health">
                <MetricRow label="Pending Flagged Content" value={data.health.flagged} note={data.health.flagged > 10 ? '⚠ High' : 'Normal'} />
                <MetricRow label="NDPR Data Requests Pending" value={data.health.dsrPending} />
                <MetricRow label="Verification Queue" value={data.health.verificationQueue} />
              </Section>

              {generateHighlights().length > 0 && (
                <Section title="5. Key Highlights">
                  <ul style={{ paddingLeft: 20, margin: 0 }}>
                    {generateHighlights().map((h, i) => (
                      <li key={i} style={{ fontSize: 13, color: 'var(--tx-2)', marginBottom: 8, lineHeight: 1.6 }}>{h}</li>
                    ))}
                  </ul>
                </Section>
              )}

              <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>Generated {new Date().toLocaleString('en-NG')} · Workstation Admin Panel · Confidential</p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

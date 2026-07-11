'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import { Users, Building2, Briefcase, Activity, FileText, AlertTriangle, TrendingUp, Shield } from 'lucide-react'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface LiveStats {
  candidatesTotal: number
  candidatesPending: number
  candidatesVerified: number
  companiesTotal: number
  companiesVerified: number
  jobsTotal: number
  jobsActive: number
  jobsFilled: number
  applicationsTotal: number
  applicationsHired: number
  applicationsRejected: number
  revenueTotal: number
  activeSubscriptions: number
  flaggedPending: number
  activityLast7d: number
  invoiceCount: number
}

function KpiCard({
  label, value, sub, color, Icon, delta,
}: {
  label: string; value: string; sub?: string; color: string; Icon: React.ElementType; delta?: number
}) {
  return (
    <div style={{ ...CARD, padding: '18px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</p>
        <div style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--tx-1)', fontFamily: 'var(--font-mono)', lineHeight: 1 }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        {sub && <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>{sub}</p>}
        {delta !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 700, color: delta >= 0 ? '#34D399' : '#F87171' }}>
            {delta >= 0 ? '+' : ''}{delta}%
          </span>
        )}
      </div>
    </div>
  )
}

function StatBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
        <span style={{ fontSize: 12, color: 'var(--tx-2)' }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)', fontFamily: 'var(--font-mono)' }}>
          {value.toLocaleString()} <span style={{ color: 'var(--tx-3)', fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div style={{ height: 7, borderRadius: 4, backgroundColor: 'var(--bg-surface)' }}>
        <div style={{ height: '100%', width: `${pct}%`, borderRadius: 4, backgroundColor: color, transition: 'width 0.5s' }} />
      </div>
    </div>
  )
}

function SectionCard({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={CARD}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{title}</p>
        {sub && <p style={{ fontSize: 11, color: 'var(--tx-3)', marginTop: 2 }}>{sub}</p>}
      </div>
      <div style={{ padding: '16px 20px' }}>{children}</div>
    </div>
  )
}

export default function AnalyticsPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<LiveStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadStats = useCallback(async () => {
    setLoading(true)
    try {
      const [
        { count: candidatesTotal },
        { count: candidatesPending },
        { count: candidatesVerified },
        { count: companiesTotal },
        { count: companiesVerified },
        { count: jobsTotal },
        { count: jobsActive },
        { count: jobsFilled },
        { count: applicationsTotal },
        { count: applicationsHired },
        { count: applicationsRejected },
        { data: revenueData },
        { count: activeSubscriptions },
        { count: flaggedPending },
        { count: activityLast7d },
        { count: invoiceCount },
      ] = await Promise.all([
        supabase.from('candidates').select('*', { count: 'exact', head: true }),
        supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('companies').select('*', { count: 'exact', head: true }),
        supabase.from('companies').select('*', { count: 'exact', head: true }).eq('verification_status', 'approved'),
        supabase.from('job_postings').select('*', { count: 'exact', head: true }),
        supabase.from('job_postings').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('job_postings').select('*', { count: 'exact', head: true }).eq('status', 'closed'),
        supabase.from('job_applications').select('*', { count: 'exact', head: true }),
        supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'offer_made'),
        supabase.from('job_applications').select('*', { count: 'exact', head: true }).eq('status', 'rejected'),
        supabase.from('invoices').select('amount').eq('status', 'paid'),
        supabase.from('platform_subscriptions').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('flagged_content').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('audit_logs').select('*', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
        supabase.from('invoices').select('*', { count: 'exact', head: true }).eq('status', 'paid'),
      ])

      const revenueTotal = (revenueData ?? []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0)

      setStats({
        candidatesTotal:    candidatesTotal    ?? 0,
        candidatesPending:  candidatesPending  ?? 0,
        candidatesVerified: candidatesVerified ?? 0,
        companiesTotal:     companiesTotal     ?? 0,
        companiesVerified:  companiesVerified  ?? 0,
        jobsTotal:          jobsTotal          ?? 0,
        jobsActive:         jobsActive         ?? 0,
        jobsFilled:         jobsFilled         ?? 0,
        applicationsTotal:  applicationsTotal  ?? 0,
        applicationsHired:  applicationsHired  ?? 0,
        applicationsRejected: applicationsRejected ?? 0,
        revenueTotal,
        activeSubscriptions: activeSubscriptions ?? 0,
        flaggedPending:     flaggedPending     ?? 0,
        activityLast7d:     activityLast7d     ?? 0,
        invoiceCount:       invoiceCount       ?? 0,
      })
      setLastRefresh(new Date())
    } finally {
      setLoading(false)
    }
  }, [supabase])

  useEffect(() => {
    void loadStats()
    const interval = setInterval(() => { void loadStats() }, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadStats])

  const fmtNGN = (n: number) =>
    n >= 1_000_000 ? `₦${(n / 1_000_000).toFixed(1)}M` : `₦${n.toLocaleString('en-NG')}`

  const verifyRate = stats && stats.candidatesTotal > 0
    ? Math.round((stats.candidatesVerified / stats.candidatesTotal) * 100)
    : 0

  const offerRate = stats && stats.applicationsTotal > 0
    ? Math.round((stats.applicationsHired / stats.applicationsTotal) * 100)
    : 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--tx-1)' }}>Platform Analytics</h1>
          <p style={{ fontSize: 12, color: 'var(--tx-3)', marginTop: 4 }}>
            Live data · {lastRefresh ? `Last updated ${lastRefresh.toLocaleTimeString('en-NG')}` : 'Loading…'}
          </p>
        </div>
        <button onClick={() => void loadStats()} disabled={loading}
          style={{ padding: '8px 18px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Refreshing…' : '↻ Refresh'}
        </button>
      </div>

      {loading && !stats ? (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <p style={{ color: 'var(--tx-3)', fontSize: 14 }}>Loading live data…</p>
        </div>
      ) : !stats ? null : (
        <>
          {/* KPI Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 20 }}>
            <KpiCard label="Total Candidates"    value={stats.candidatesTotal.toLocaleString()}    sub={`${stats.candidatesPending} pending`}       color="#6366F1" Icon={Users}         />
            <KpiCard label="Total Companies"     value={stats.companiesTotal.toLocaleString()}     sub={`${stats.companiesVerified} verified`}       color="#06B6D4" Icon={Building2}     />
            <KpiCard label="Total Revenue"       value={fmtNGN(stats.revenueTotal)}               sub={`${stats.invoiceCount} paid invoices`}       color="#F59E0B" Icon={TrendingUp}    />
            <KpiCard label="Active Subscriptions" value={stats.activeSubscriptions.toLocaleString()} sub="currently active"                         color="#10B981" Icon={Activity}      />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
            <KpiCard label="Job Postings"       value={stats.jobsTotal.toLocaleString()}           sub={`${stats.jobsActive} active`}                color="#8B5CF6" Icon={Briefcase}    />
            <KpiCard label="Applications"       value={stats.applicationsTotal.toLocaleString()}   sub={`${offerRate}% offer rate`}                   color="#EC4899" Icon={FileText}      />
            <KpiCard label="Flagged Content"    value={stats.flaggedPending.toLocaleString()}      sub="pending review"                              color="#EF4444" Icon={AlertTriangle} />
            <KpiCard label="7-Day Activity"     value={stats.activityLast7d.toLocaleString()}      sub="audit log events"                            color="#06B6D4" Icon={Shield}        />
          </div>

          {/* Detail sections */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <SectionCard title="Candidate Verification Breakdown" sub="Status distribution across all candidates">
              <StatBar label="Verified"     value={stats.candidatesVerified}                                          max={stats.candidatesTotal} color="#34D399" />
              <StatBar label="Pending"      value={stats.candidatesPending}                                           max={stats.candidatesTotal} color="#FBBF24" />
              <StatBar label="Other"        value={stats.candidatesTotal - stats.candidatesVerified - stats.candidatesPending} max={stats.candidatesTotal} color="#9CA3AF" />
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, backgroundColor: 'var(--bg-surface)' }}>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Verification Rate</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: verifyRate >= 70 ? '#34D399' : verifyRate >= 40 ? '#FBBF24' : '#F87171', fontFamily: 'var(--font-mono)' }}>
                  {verifyRate}%
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Application Pipeline" sub="Status distribution across all applications">
              <StatBar label="Offer Made" value={stats.applicationsHired}    max={stats.applicationsTotal} color="#34D399" />
              <StatBar label="Rejected"   value={stats.applicationsRejected} max={stats.applicationsTotal} color="#F87171" />
              <StatBar label="In Progress" value={Math.max(0, stats.applicationsTotal - stats.applicationsHired - stats.applicationsRejected)} max={stats.applicationsTotal} color="#6366F1" />
              <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: 'var(--bg-surface)' }}>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Jobs Active</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#6366F1', fontFamily: 'var(--font-mono)' }}>{stats.jobsActive}</p>
                </div>
                <div style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: 'var(--bg-surface)' }}>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Jobs Closed</p>
                  <p style={{ fontSize: 22, fontWeight: 800, color: '#34D399', fontFamily: 'var(--font-mono)' }}>{stats.jobsFilled}</p>
                </div>
              </div>
            </SectionCard>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>
            <SectionCard title="Company Overview" sub="Verification and activity metrics">
              <StatBar label="Verified Companies"   value={stats.companiesVerified}                              max={stats.companiesTotal} color="#06B6D4" />
              <StatBar label="Unverified"           value={stats.companiesTotal - stats.companiesVerified}       max={stats.companiesTotal} color="#9CA3AF" />
              <div style={{ marginTop: 16, padding: '12px 16px', borderRadius: 10, backgroundColor: 'var(--bg-surface)' }}>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Company Verification Rate</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: '#06B6D4', fontFamily: 'var(--font-mono)' }}>
                  {stats.companiesTotal > 0 ? Math.round((stats.companiesVerified / stats.companiesTotal) * 100) : 0}%
                </p>
              </div>
            </SectionCard>

            <SectionCard title="Platform Health Summary" sub="Key health indicators at a glance">
              {[
                { label: 'Active Revenue',       value: fmtNGN(stats.revenueTotal),                  color: '#F59E0B', icon: '💰' },
                { label: 'Active Subscriptions', value: stats.activeSubscriptions.toString(),         color: '#10B981', icon: '✅' },
                { label: 'Pending Flags',        value: stats.flaggedPending.toString(),              color: stats.flaggedPending > 10 ? '#EF4444' : '#FBBF24', icon: '🚩' },
                { label: 'Admin Activity (7d)',  value: stats.activityLast7d.toLocaleString(),        color: '#6366F1', icon: '📊' },
              ].map(item => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 16 }}>{item.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>{item.label}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: item.color, fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                </div>
              ))}
            </SectionCard>
          </div>
        </>
      )}
    </div>
  )
}

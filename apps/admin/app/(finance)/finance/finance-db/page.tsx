'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Download, ChevronDown, ChevronUp, Database } from 'lucide-react'

const USD_RATE = 1600
const VAT_RATE = 0.075

function fmtNGN(n: number) { return '₦' + Math.round(n).toLocaleString('en-NG') }
function fmtUSD(n: number) { return '$' + n.toFixed(2) }
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
}

interface Sub {
  amount: number
  status: string
  user_type: string
  started_at: string
  cancelled_at: string | null
}

interface Cost {
  month: string
  category: string
  amount: number
  currency: string
}

interface PayrollRun {
  month: string
  total_net_pay: number
  total_staff: number
  status: string
}

interface VatInvoice {
  amount: number
  vat_amount: number
  paid_at: string
}

interface ReferralCode {
  discount_type: string
  discount_value: number
  uses_count: number
}

interface MonthRecord {
  month: string
  candidateRevenue: number
  companyRevenue: number
  totalRevenue: number
  referralDiscount: number
  grossRevenue: number
  vatCollected: number
  netRevenue: number
  platformCostUSD: number
  platformCostNGN: number
  totalPlatformCostNGN: number
  salaryCost: number
  totalExpenses: number
  operatingProfit: number
  marginPct: number
  activeSubCount: number
  newSubCount: number
  churnCount: number
  payrollStatus: string | null
  payrollStaff: number
}

export default function FinanceDbPage() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [records, setRecords] = useState<MonthRecord[]>([])
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)
  const [sortAsc, setSortAsc] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: subData },
      { data: costData },
      { data: payrollData },
      { data: vatData },
      { data: refData },
    ] = await Promise.all([
      supabase.from('platform_subscriptions').select('amount,status,user_type,started_at,cancelled_at'),
      supabase.from('platform_costs').select('month,category,amount,currency'),
      supabase.from('payroll_runs').select('month,total_net_pay,total_staff,status'),
      supabase.from('invoices').select('amount,vat_amount,paid_at').eq('status', 'paid'),
      supabase.from('referral_codes').select('discount_type,discount_value,uses_count').gt('uses_count', 0),
    ])

    const subs = (subData ?? []) as Sub[]
    const costs = (costData ?? []) as Cost[]
    const payrolls = (payrollData ?? []) as PayrollRun[]
    const vatInvoices = (vatData ?? []) as VatInvoice[]
    const refCodes = (refData ?? []) as ReferralCode[]

    // build month set
    const monthSet = new Set<string>()
    subs.forEach(s => monthSet.add(s.started_at.slice(0, 7)))
    costs.forEach(c => monthSet.add(c.month))
    payrolls.forEach(p => monthSet.add(p.month))
    vatInvoices.forEach(v => monthSet.add(v.paid_at.slice(0, 7)))

    const totalMonths = monthSet.size || 1
    const totalReferralDiscount = refCodes.reduce((sum, c) => {
      if (c.discount_type === 'fixed') return sum + c.discount_value * c.uses_count
      return sum
    }, 0)
    const avgReferralDiscount = totalReferralDiscount / totalMonths

    const monthRecords: MonthRecord[] = [...monthSet].map(month => {
      const monthSubs = subs.filter(s => {
        const start = s.started_at.slice(0, 7)
        const cancelled = s.cancelled_at ? s.cancelled_at.slice(0, 7) : null
        return start <= month && (!cancelled || cancelled >= month)
      })
      const candidateRevenue = monthSubs.filter(s => s.user_type === 'candidate').reduce((s, r) => s + r.amount, 0)
      const companyRevenue = monthSubs.filter(s => s.user_type === 'company').reduce((s, r) => s + r.amount, 0)
      const totalRevenue = candidateRevenue + companyRevenue
      const referralDiscount = avgReferralDiscount
      const grossRevenue = totalRevenue - referralDiscount
      const vatCollected = vatInvoices.filter(v => v.paid_at.startsWith(month)).reduce((s, v) => s + (v.vat_amount ?? 0), 0)
      const netRevenue = grossRevenue - vatCollected

      const platformCostUSD = costs.filter(c => c.month === month && c.currency === 'USD').reduce((s, c) => s + c.amount, 0)
      const platformCostNGN = costs.filter(c => c.month === month && c.currency === 'NGN').reduce((s, c) => s + c.amount, 0)
      const totalPlatformCostNGN = platformCostUSD * USD_RATE + platformCostNGN

      const payroll = payrolls.find(p => p.month === month)
      const salaryCost = payroll?.status === 'paid' ? (payroll.total_net_pay ?? 0) : 0

      const totalExpenses = totalPlatformCostNGN + salaryCost
      const operatingProfit = netRevenue - totalExpenses
      const marginPct = grossRevenue > 0 ? Math.round((operatingProfit / grossRevenue) * 100) : 0

      const newSubCount = subs.filter(s => s.started_at.startsWith(month)).length
      const churnCount = subs.filter(s => s.cancelled_at?.startsWith(month)).length

      return {
        month,
        candidateRevenue,
        companyRevenue,
        totalRevenue,
        referralDiscount,
        grossRevenue,
        vatCollected,
        netRevenue,
        platformCostUSD,
        platformCostNGN,
        totalPlatformCostNGN,
        salaryCost,
        totalExpenses,
        operatingProfit,
        marginPct,
        activeSubCount: monthSubs.length,
        newSubCount,
        churnCount,
        payrollStatus: payroll?.status ?? null,
        payrollStaff: payroll?.total_staff ?? 0,
      }
    })

    const sorted = monthRecords.sort((a, b) => b.month.localeCompare(a.month))
    setRecords(sorted)
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const displayRecords = sortAsc ? [...records].reverse() : records

  const totalRevenue = records.reduce((s, r) => s + r.grossRevenue, 0)
  const totalExpenses = records.reduce((s, r) => s + r.totalExpenses, 0)
  const totalProfit = records.reduce((s, r) => s + r.operatingProfit, 0)
  const totalSalary = records.reduce((s, r) => s + r.salaryCost, 0)

  function exportCSV() {
    const rows = [
      ['Month', 'Sub Revenue (₦)', 'Candidate (₦)', 'Company (₦)', 'Referral Discount (₦)', 'Gross Revenue (₦)', 'VAT (₦)', 'Net Revenue (₦)', 'Platform Cost (₦)', 'Salary Cost (₦)', 'Total Expenses (₦)', 'Operating Profit (₦)', 'Margin %', 'Active Subs', 'New Subs', 'Churned', 'Payroll Status'].join(','),
      ...records.map(r => [
        r.month,
        Math.round(r.totalRevenue),
        Math.round(r.candidateRevenue),
        Math.round(r.companyRevenue),
        Math.round(r.referralDiscount),
        Math.round(r.grossRevenue),
        Math.round(r.vatCollected),
        Math.round(r.netRevenue),
        Math.round(r.totalPlatformCostNGN),
        Math.round(r.salaryCost),
        Math.round(r.totalExpenses),
        Math.round(r.operatingProfit),
        `${r.marginPct}%`,
        r.activeSubCount,
        r.newSubCount,
        r.churnCount,
        r.payrollStatus ?? 'none',
      ].join(','))
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `finance-records-all.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const PAYROLL_PILL: Record<string, { color: string; bg: string; label: string }> = {
    paid:     { color: '#10B981', bg: 'rgba(16,185,129,0.1)',  label: 'Paid' },
    approved: { color: '#6366F1', bg: 'rgba(99,102,241,0.1)', label: 'Approved' },
    draft:    { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)', label: 'Draft' },
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: 'rgba(99,102,241,0.12)' }}>
            <Database size={18} style={{ color: '#818CF8' }} />
          </div>
          <div>
            <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
              Finance Records
            </h1>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
              Complete monthly archive — revenue, costs, salary, P&L for every period
            </p>
          </div>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', backgroundColor: 'var(--bg-card)' }}>
          <Download size={14} /> Export All CSV
        </button>
      </div>

      <div className="px-8 py-6 space-y-5">
        {/* All-time summary KPIs */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Gross Revenue', value: fmtNGN(totalRevenue), color: '#10B981', sub: `${records.length} months` },
            { label: 'Total Salary Paid', value: fmtNGN(totalSalary), color: '#F59E0B', sub: 'All payroll runs' },
            { label: 'Total Expenses', value: fmtNGN(totalExpenses), color: '#F87171', sub: 'Platform + Salary' },
            { label: 'Cumulative Profit', value: fmtNGN(totalProfit), color: totalProfit >= 0 ? '#10B981' : '#F87171', sub: 'All-time operating P&L' },
          ].map(k => (
            <div key={k.label} className="rounded-2xl p-5"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--tx-3)' }}>{k.label}</p>
              <p className="text-[20px] font-bold font-display" style={{ color: k.color }}>{k.value}</p>
              <p className="text-[11px] mt-1" style={{ color: 'var(--tx-3)' }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Sort control */}
        <div className="flex items-center justify-between">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--tx-2)' }}>
            {records.length} monthly records
          </p>
          <button onClick={() => setSortAsc(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--tx-3)', backgroundColor: 'var(--bg-card)' }}>
            {sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            {sortAsc ? 'Oldest first' : 'Newest first'}
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <div className="rounded-2xl p-12 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <Database size={32} style={{ color: 'var(--tx-3)', margin: '0 auto 12px' }} />
            <p className="text-[15px] font-semibold" style={{ color: 'var(--tx-2)' }}>No financial records yet</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--tx-3)' }}>
              Records will appear here once subscriptions, costs, or payroll data exists.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
            {/* Table header */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                    {['Month', 'Sub Revenue', 'Candidate', 'Company', 'Platform Cost', 'Salary Cost', 'Total Expenses', 'Operating Profit', 'Margin', 'Subs', 'Payroll', ''].map(h => (
                      <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayRecords.map(r => {
                    const isOpen = expandedMonth === r.month
                    const pill = r.payrollStatus ? PAYROLL_PILL[r.payrollStatus] : null
                    return (
                      <>
                        <tr key={r.month}
                          onClick={() => setExpandedMonth(isOpen ? null : r.month)}
                          style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.backgroundColor = isOpen ? 'var(--bg-elevated)' : 'transparent')}
                        >
                          <td style={{ padding: '12px 14px' }}>
                            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', whiteSpace: 'nowrap' }}>{monthLabel(r.month)}</p>
                            <p style={{ fontSize: 10, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{r.month}</p>
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#10B981', whiteSpace: 'nowrap' }}>{fmtNGN(r.totalRevenue)}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#38BDF8', whiteSpace: 'nowrap' }}>{fmtNGN(r.candidateRevenue)}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: '#A78BFA', whiteSpace: 'nowrap' }}>{fmtNGN(r.companyRevenue)}</td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>
                            {r.totalPlatformCostNGN > 0 ? fmtNGN(r.totalPlatformCostNGN) : <span style={{ color: 'var(--tx-3)' }}>—</span>}
                            {r.platformCostUSD > 0 && <p style={{ fontSize: 10, color: 'var(--tx-3)' }}>{fmtUSD(r.platformCostUSD)}</p>}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 12, color: r.salaryCost > 0 ? '#FBBF24' : 'var(--tx-3)', whiteSpace: 'nowrap' }}>
                            {r.salaryCost > 0 ? fmtNGN(r.salaryCost) : '—'}
                          </td>
                          <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: '#F87171', whiteSpace: 'nowrap' }}>
                            {r.totalExpenses > 0 ? fmtNGN(r.totalExpenses) : <span style={{ color: 'var(--tx-3)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <span style={{ fontSize: 14, fontWeight: 800, color: r.operatingProfit >= 0 ? '#10B981' : '#F87171' }}>
                              {r.operatingProfit >= 0 ? '+' : ''}{fmtNGN(r.operatingProfit)}
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: r.marginPct >= 0 ? '#34D399' : '#F87171' }}>
                              {r.marginPct}%
                            </span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <p style={{ fontSize: 13, color: 'var(--tx-1)', fontWeight: 600 }}>{r.activeSubCount}</p>
                            {r.newSubCount > 0 && <p style={{ fontSize: 10, color: '#34D399' }}>+{r.newSubCount} new</p>}
                            {r.churnCount > 0 && <p style={{ fontSize: 10, color: '#F87171' }}>-{r.churnCount} churned</p>}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {pill ? (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, color: pill.color, backgroundColor: pill.bg, whiteSpace: 'nowrap' }}>
                                {pill.label} {r.payrollStaff > 0 ? `· ${r.payrollStaff} staff` : ''}
                              </span>
                            ) : (
                              <span style={{ fontSize: 10, color: 'var(--tx-3)' }}>No payroll</span>
                            )}
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            {isOpen ? <ChevronUp size={14} color="var(--tx-3)" /> : <ChevronDown size={14} color="var(--tx-3)" />}
                          </td>
                        </tr>

                        {isOpen && (
                          <tr key={`${r.month}-detail`} style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                            <td colSpan={12} style={{ padding: '16px 20px' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                                {[
                                  { label: 'Gross Revenue', value: fmtNGN(r.grossRevenue), color: '#10B981' },
                                  { label: 'VAT Collected', value: fmtNGN(r.vatCollected), color: '#F59E0B' },
                                  { label: 'Net Revenue', value: fmtNGN(r.netRevenue), color: '#38BDF8' },
                                  { label: 'Referral Discounts', value: fmtNGN(r.referralDiscount), color: '#A78BFA' },
                                ].map(d => (
                                  <div key={d.label} style={{ padding: '12px 16px', borderRadius: 10, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                                    <p style={{ fontSize: 10, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d.label}</p>
                                    <p style={{ fontSize: 16, fontWeight: 700, color: d.color }}>{d.value}</p>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
                {/* Totals */}
                <tfoot>
                  <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'rgba(99,102,241,0.05)' }}>
                    <td style={{ padding: '12px 14px', fontSize: 12, fontWeight: 800, color: 'var(--tx-1)' }}>ALL TIME</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#10B981' }}>{fmtNGN(totalRevenue)}</td>
                    <td colSpan={2} />
                    <td colSpan={1} />
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#FBBF24' }}>{fmtNGN(totalSalary)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#F87171' }}>{fmtNGN(totalExpenses)}</td>
                    <td style={{ padding: '12px 14px', fontSize: 14, fontWeight: 800, color: totalProfit >= 0 ? '#10B981' : '#F87171' }}>
                      {totalProfit >= 0 ? '+' : ''}{fmtNGN(totalProfit)}
                    </td>
                    <td colSpan={4} />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

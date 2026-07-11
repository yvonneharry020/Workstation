'use client'

import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'

const VAT_RATE = 0.075
const USD_RATE = 1600

function fmtNGN(n: number) { return '₦' + Math.round(n).toLocaleString('en-NG') }
function fmtUSD(n: number) { return '$' + n.toFixed(2) }
function yyyymm(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
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

interface PLRow {
  label: string
  value: string
  valueRaw: number
  indent?: boolean
  bold?: boolean
  divider?: boolean
  positive?: boolean
  negative?: boolean
  muted?: boolean
  highlight?: boolean
}

export default function ReportsPage() {
  const supabase = createClient()
  const now = new Date()

  const [selectedMonth, setSelectedMonth] = useState(yyyymm(now))
  const [loading, setLoading] = useState(true)

  const [activeSubs, setActiveSubs] = useState<Sub[]>([])
  const [allSubs, setAllSubs] = useState<Sub[]>([])
  const [costs, setCosts] = useState<Cost[]>([])
  const [payroll, setPayroll] = useState<PayrollRun | null>(null)
  const [vatInvoices, setVatInvoices] = useState<VatInvoice[]>([])
  const [referralCodes, setReferralCodes] = useState<ReferralCode[]>([])
  const [availableMonths, setAvailableMonths] = useState<string[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [
      { data: subData },
      { data: costData },
      { data: payrollData },
      { data: vatData },
      { data: refData },
    ] = await Promise.all([
      supabase.from('platform_subscriptions').select('amount,status,user_type,started_at,cancelled_at').order('started_at'),
      supabase.from('platform_costs').select('month,category,amount,currency').order('month'),
      supabase.from('payroll_runs').select('month,total_net_pay,status').eq('status', 'paid'),
      supabase.from('invoices').select('amount,vat_amount,paid_at').eq('status', 'paid'),
      supabase.from('referral_codes').select('discount_type,discount_value,uses_count').gt('uses_count', 0),
    ])

    const subs = (subData ?? []) as Sub[]
    setAllSubs(subs)
    setActiveSubs(subs.filter(s => s.status === 'active'))
    setCosts((costData ?? []) as Cost[])
    setPayroll((payrollData ?? []).find(p => p.month === selectedMonth) as PayrollRun | null ?? null)
    setVatInvoices((vatData ?? []) as VatInvoice[])
    setReferralCodes((refData ?? []) as ReferralCode[])

    // Build available months from data
    const monthSet = new Set<string>()
    subs.forEach(s => monthSet.add(s.started_at.slice(0, 7)));
    (costData ?? []).forEach((c: Cost) => monthSet.add(c.month));
    (vatData ?? []).forEach((v: VatInvoice) => monthSet.add(v.paid_at.slice(0, 7)));
    // always include current month
    monthSet.add(yyyymm(now))
    const sorted = [...monthSet].sort().reverse()
    setAvailableMonths(sorted)
    if (!monthSet.has(selectedMonth)) setSelectedMonth(sorted[0] ?? yyyymm(now))

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, selectedMonth])

  // reload payroll when month changes without refetching everything
  useEffect(() => {
    void load()
  }, [load])

  // ── Calculations ──────────────────────────────────────────

  // All subscriptions that were active at any point in the selected month
  const monthActiveSubs = allSubs.filter(s => {
    const start = s.started_at.slice(0, 7)
    const cancelled = s.cancelled_at ? s.cancelled_at.slice(0, 7) : null
    return start <= selectedMonth && (!cancelled || cancelled >= selectedMonth)
  })

  const candidateRevenue = monthActiveSubs.filter(s => s.user_type === 'candidate').reduce((sum, s) => sum + s.amount, 0)
  const companyRevenue = monthActiveSubs.filter(s => s.user_type === 'company').reduce((sum, s) => sum + s.amount, 0)
  const totalSubscriptionRevenue = candidateRevenue + companyRevenue

  // New subscribers this month
  const newSubs = allSubs.filter(s => s.started_at.startsWith(selectedMonth)).length
  // Churned this month
  const churnedSubs = allSubs.filter(s => s.cancelled_at?.startsWith(selectedMonth)).length
  const churnedRevenue = allSubs.filter(s => s.cancelled_at?.startsWith(selectedMonth)).reduce((s, r) => s + r.amount, 0)

  // Referral discounts applied (estimate for month — we don't have per-month breakdown on codes)
  const referralDiscount = referralCodes.reduce((sum, c) => {
    if (c.discount_type === 'fixed') return sum + c.discount_value * c.uses_count
    return sum
  }, 0) / Math.max(availableMonths.length, 1) // avg per month

  // Gross revenue after referral discounts
  const grossRevenue = totalSubscriptionRevenue - referralDiscount

  // VAT collected this month (from paid invoices)
  const vatCollected = vatInvoices
    .filter(i => i.paid_at.startsWith(selectedMonth))
    .reduce((s, i) => s + (i.vat_amount ?? 0), 0)

  // Net revenue (after VAT remittance)
  const netRevenue = grossRevenue - vatCollected

  // Platform costs this month (USD → NGN)
  const platformCostsUSD = costs
    .filter(c => c.month === selectedMonth && c.currency === 'USD')
    .reduce((s, c) => s + c.amount, 0)
  const platformCostsNGN = costs
    .filter(c => c.month === selectedMonth && c.currency === 'NGN')
    .reduce((s, c) => s + c.amount, 0)
  const totalPlatformCostNGN = platformCostsUSD * USD_RATE + platformCostsNGN

  // Staff salary (from paid payroll run)
  const salaryCost = payroll?.total_net_pay ?? 0
  const hasSalary = salaryCost > 0
  const salaryNote = payroll
    ? payroll.status === 'paid' ? 'From approved payroll run' : 'Payroll not yet paid'
    : 'No payroll run for this month'

  // Total expenses
  const totalExpenses = totalPlatformCostNGN + salaryCost

  // Operating profit
  const operatingProfit = netRevenue - totalExpenses

  // Margin %
  const marginPct = grossRevenue > 0 ? Math.round((operatingProfit / grossRevenue) * 100) : 0

  // Month navigation
  const currentIdx = availableMonths.indexOf(selectedMonth)
  const canPrev = currentIdx < availableMonths.length - 1
  const canNext = currentIdx > 0

  function prevMonth() { if (canPrev) setSelectedMonth(availableMonths[currentIdx + 1]) }
  function nextMonth() { if (canNext) setSelectedMonth(availableMonths[currentIdx - 1]) }

  function exportCSV() {
    const rows: string[] = [
      `P&L Report — ${monthLabel(selectedMonth)}`,
      '',
      'REVENUE',
      `Candidate Subscriptions,${candidateRevenue}`,
      `Company Subscriptions,${companyRevenue}`,
      `Total Subscription Revenue,${totalSubscriptionRevenue}`,
      `Referral Discounts,-${referralDiscount.toFixed(0)}`,
      `Gross Revenue,${grossRevenue.toFixed(0)}`,
      '',
      'DEDUCTIONS',
      `VAT Collected (7.5%),-${vatCollected.toFixed(0)}`,
      `Net Revenue,${netRevenue.toFixed(0)}`,
      '',
      'EXPENSES',
      `Platform Costs (Infra),-${totalPlatformCostNGN.toFixed(0)}`,
      `Staff Salary Costs,-${salaryCost.toFixed(0)}`,
      `Total Expenses,-${totalExpenses.toFixed(0)}`,
      '',
      'RESULT',
      `Operating Profit,${operatingProfit.toFixed(0)}`,
      `Net Margin %,${marginPct}%`,
      '',
      'ADDITIONAL',
      `New Subscribers,${newSubs}`,
      `Churned Subscribers,${churnedSubs}`,
      `Churned Revenue,-${churnedRevenue}`,
      `USD Exchange Rate,${USD_RATE}`,
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `pnl-${selectedMonth}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  // Build P&L rows
  const plRows: PLRow[] = [
    { label: 'REVENUE', value: '', valueRaw: 0, bold: true, divider: true },
    { label: 'Candidate Subscriptions', value: fmtNGN(candidateRevenue), valueRaw: candidateRevenue, indent: true },
    { label: 'Company Subscriptions', value: fmtNGN(companyRevenue), valueRaw: companyRevenue, indent: true },
    { label: 'Total Subscription Revenue', value: fmtNGN(totalSubscriptionRevenue), valueRaw: totalSubscriptionRevenue, bold: true },
    { label: 'Referral & Promo Discounts', value: `-${fmtNGN(referralDiscount)}`, valueRaw: -referralDiscount, indent: true, negative: true, muted: true },
    { label: 'Gross Revenue', value: fmtNGN(grossRevenue), valueRaw: grossRevenue, bold: true, highlight: true },

    { label: 'DEDUCTIONS', value: '', valueRaw: 0, bold: true, divider: true },
    { label: 'VAT Collected & Remitted (7.5%)', value: `-${fmtNGN(vatCollected)}`, valueRaw: -vatCollected, indent: true, negative: true },
    { label: 'Net Revenue', value: fmtNGN(netRevenue), valueRaw: netRevenue, bold: true },

    { label: 'EXPENSES', value: '', valueRaw: 0, bold: true, divider: true },
    {
      label: `Platform Costs (Infra)  ${platformCostsUSD > 0 ? `· ${fmtUSD(platformCostsUSD)} USD` : ''}`,
      value: `-${fmtNGN(totalPlatformCostNGN)}`,
      valueRaw: -totalPlatformCostNGN,
      indent: true,
      negative: true,
    },
    { label: `Staff Salary Costs  · ${salaryNote}`, value: hasSalary ? `-${fmtNGN(salaryCost)}` : '—', valueRaw: -salaryCost, indent: true, negative: hasSalary, muted: !hasSalary },
    { label: 'Total Expenses', value: `-${fmtNGN(totalExpenses)}`, valueRaw: -totalExpenses, bold: true, negative: true },

    { label: 'RESULT', value: '', valueRaw: 0, bold: true, divider: true },
    { label: 'Operating Profit', value: fmtNGN(operatingProfit), valueRaw: operatingProfit, bold: true, highlight: true, positive: operatingProfit >= 0 },
    { label: 'Net Margin', value: `${marginPct}%`, valueRaw: marginPct, bold: true, positive: marginPct >= 0 },
  ]

  return (
    <div className="flex flex-col min-h-full" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>P&L Reports</h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
            Full profit & loss by month — subscription revenue, costs, salary, VAT
          </p>
        </div>
        <button onClick={exportCSV}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-colors"
          style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#10B981', backgroundColor: 'rgba(16,185,129,0.08)' }}>
          <Download size={14} /> Export CSV
        </button>
      </div>

      {/* Month navigator */}
      <div className="px-8 py-3 border-b flex items-center gap-3 flex-wrap" style={{ borderColor: 'var(--border)' }}>
        <button onClick={prevMonth} disabled={!canPrev}
          className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)' }}>
          <ChevronLeft size={14} />
        </button>
        <div className="flex gap-1 flex-wrap">
          {availableMonths.map(m => (
            <button key={m} onClick={() => setSelectedMonth(m)}
              className="px-3 py-1 rounded-lg text-[12px] font-semibold transition-colors"
              style={{
                backgroundColor: selectedMonth === m ? 'rgba(16,185,129,0.15)' : 'transparent',
                color: selectedMonth === m ? '#10B981' : 'var(--tx-3)',
                border: `1px solid ${selectedMonth === m ? 'rgba(16,185,129,0.4)' : 'transparent'}`,
              }}>
              {monthLabel(m)}
            </button>
          ))}
        </div>
        <button onClick={nextMonth} disabled={!canNext}
          className="w-8 h-8 rounded-lg flex items-center justify-center border transition-colors disabled:opacity-30"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)' }}>
          <ChevronRight size={14} />
        </button>
      </div>

      <div className="px-8 py-6 space-y-6 max-w-4xl">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          </div>
        ) : (
          <>
            {/* Summary KPIs */}
            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Gross Revenue', value: fmtNGN(grossRevenue), color: '#10B981', sub: `${monthActiveSubs.length} active subscribers` },
                { label: 'Total Expenses', value: fmtNGN(totalExpenses), color: '#F87171', sub: `Platform + Salary` },
                { label: 'Operating Profit', value: fmtNGN(operatingProfit), color: operatingProfit >= 0 ? '#10B981' : '#F87171', sub: `${marginPct}% margin` },
              ].map(k => (
                <div key={k.label} className="rounded-2xl p-5"
                  style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
                  <p className="text-[12px] font-semibold mb-2" style={{ color: 'var(--tx-3)' }}>{k.label}</p>
                  <p className="text-[22px] font-bold font-display" style={{ color: k.color }}>{k.value}</p>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--tx-3)' }}>{k.sub}</p>
                </div>
              ))}
            </div>

            {/* P&L Statement */}
            <div className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
              <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
                <p className="text-[14px] font-bold" style={{ color: 'var(--tx-1)' }}>
                  Profit & Loss Statement — {monthLabel(selectedMonth)}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                  NGN figures · USD converted at ₦{USD_RATE}/$ · VAT 7.5% (FIRS)
                </p>
              </div>
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {plRows.map((row, i) => {
                  if (row.divider) {
                    return (
                      <div key={i} className="px-6 py-2.5"
                        style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderTop: i > 0 ? '2px solid var(--border)' : undefined }}>
                        <p className="text-[10px] font-black tracking-widest uppercase" style={{ color: 'var(--tx-3)' }}>
                          {row.label}
                        </p>
                      </div>
                    )
                  }
                  const textColor = row.highlight
                    ? (row.positive === false ? '#F87171' : row.positive === true ? '#10B981' : '#10B981')
                    : row.positive === true
                    ? '#10B981'
                    : row.positive === false
                    ? '#F87171'
                    : row.negative
                    ? '#F87171'
                    : row.muted
                    ? 'var(--tx-3)'
                    : 'var(--tx-1)'

                  return (
                    <div key={i}
                      className="flex items-center justify-between px-6 py-3"
                      style={{ backgroundColor: row.highlight ? 'rgba(16,185,129,0.05)' : 'transparent' }}>
                      <span className={`text-[13px] ${row.indent ? 'pl-4' : ''}`}
                        style={{ color: row.bold ? 'var(--tx-1)' : 'var(--tx-2)', fontWeight: row.bold ? 700 : 400 }}>
                        {row.label}
                      </span>
                      <span className="text-[13px] font-bold tabular-nums" style={{ color: textColor }}>
                        {row.value}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Subscriber activity */}
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl p-5"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Subscriber Activity</p>
                {[
                  { label: 'Active This Month', value: monthActiveSubs.length, color: '#10B981' },
                  { label: 'Candidate Subscribers', value: monthActiveSubs.filter(s => s.user_type === 'candidate').length, color: '#38BDF8' },
                  { label: 'Company Subscribers', value: monthActiveSubs.filter(s => s.user_type === 'company').length, color: '#A78BFA' },
                  { label: 'New This Month', value: newSubs, color: '#34D399' },
                  { label: 'Churned This Month', value: churnedSubs, color: '#F87171' },
                  { label: 'Churned Revenue', value: fmtNGN(churnedRevenue), color: '#F87171' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b last:border-0"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="text-[12px]" style={{ color: 'var(--tx-3)' }}>{row.label}</span>
                    <span className="text-[13px] font-bold" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl p-5"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-card)' }}>
                <p className="text-[13px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Cost Breakdown</p>
                {costs.filter(c => c.month === selectedMonth).length === 0 && !hasSalary ? (
                  <p className="text-[12px] py-4 text-center" style={{ color: 'var(--tx-3)' }}>No costs recorded for {monthLabel(selectedMonth)}</p>
                ) : (
                  <>
                    {costs.filter(c => c.month === selectedMonth).map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b"
                        style={{ borderColor: 'var(--border)' }}>
                        <span className="text-[12px] capitalize" style={{ color: 'var(--tx-3)' }}>{c.category}</span>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>
                          {c.currency === 'USD' ? `$${c.amount.toFixed(2)}` : fmtNGN(c.amount)}
                        </span>
                      </div>
                    ))}
                    {hasSalary && (
                      <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                        <span className="text-[12px]" style={{ color: 'var(--tx-3)' }}>Staff Salaries (paid)</span>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--tx-1)' }}>{fmtNGN(salaryCost)}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-3">
                      <span className="text-[12px] font-bold" style={{ color: 'var(--tx-2)' }}>Total (NGN)</span>
                      <span className="text-[14px] font-bold" style={{ color: '#F87171' }}>{fmtNGN(totalExpenses)}</span>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Salary status alert */}
            {!hasSalary && (
              <div className="rounded-xl p-4 flex items-start gap-3"
                style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <span style={{ color: '#FBBF24', fontSize: 18 }}>⚠</span>
                <div>
                  <p className="text-[13px] font-semibold" style={{ color: '#FBBF24' }}>Staff salary not included in this P&L</p>
                  <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                    Go to <strong>Staff Payroll</strong>, pull and approve the payroll run for {monthLabel(selectedMonth)},
                    then mark it as <em>Paid</em> — it will automatically appear here.
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

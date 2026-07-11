'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import { computeSessionPay, formatDuration } from '@/lib/clock-utils'
import {
  Download, RefreshCw, CheckCircle, DollarSign,
  Users, Calendar, Clock, ChevronDown, ChevronUp,
} from 'lucide-react'

const CARD = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

function fmt(n: number) {
  return '₦' + n.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtHours(seconds: number) {
  return (seconds / 3600).toFixed(2) + 'h'
}
function yyyymm(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return new Date(Number(y), Number(m) - 1).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
}

interface ClockSession {
  staff_member_id: string
  staff_full_name: string
  staff_email: string
  session_date: string
  total_worked_seconds: number
  overtime_seconds: number
  overtime_approved: boolean
  hourly_rate_naira: number
  status: string
}

interface StaffSummary {
  staff_member_id: string
  staff_name: string
  staff_email: string
  department: string | null
  role: string | null
  daysWorked: number
  totalWorkedSeconds: number
  overtimeSeconds: number
  overtimePay: number
  regularPay: number
  grossPay: number
  hourlyRate: number
  monthlySalary: number
  deductions: number
  bonuses: number
  netPay: number
}

interface PayrollRun {
  id: string
  month: string
  status: string
  total_staff: number
  total_days_worked: number
  total_hours_worked: number
  total_gross_pay: number
  total_net_pay: number
  pulled_at: string
  approved_by: string | null
  paid_at: string | null
}

interface PayrollItem {
  id: string
  staff_name: string
  staff_email: string
  department: string | null
  role: string | null
  days_worked: number
  total_hours_worked: number
  hourly_rate_naira: number
  monthly_salary_naira: number
  regular_pay: number
  overtime_hours: number
  overtime_pay: number
  gross_pay: number
  deductions: number
  bonuses: number
  net_pay: number
  payment_status: string
  notes: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  draft:    { label: 'Draft',    color: '#F59E0B', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.3)' },
  approved: { label: 'Approved', color: '#6366F1', bg: 'rgba(99,102,241,0.1)', border: 'rgba(99,102,241,0.3)' },
  paid:     { label: 'Paid',     color: '#10B981', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.3)' },
}

const PAY_STATUS: Record<string, { color: string; bg: string }> = {
  pending:  { color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  paid:     { color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
  on_hold:  { color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
}

export default function PayrollPage() {
  const supabase = createClient()
  const now = new Date()

  const [month, setMonth] = useState(yyyymm(now))
  const [pulling, setPulling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState(false)
  const [existingRun, setExistingRun] = useState<PayrollRun | null>(null)
  const [runItems, setRunItems] = useState<PayrollItem[]>([])
  const [preview, setPreview] = useState<StaffSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedStaff, setExpandedStaff] = useState<string | null>(null)
  const [editingItem, setEditingItem] = useState<string | null>(null)
  const [itemEdits, setItemEdits] = useState<Record<string, { deductions: string; bonuses: string; notes: string }>>({})

  const loadRun = useCallback(async () => {
    setLoading(true)
    setPreview([])
    const { data: run } = await supabase
      .from('payroll_runs')
      .select('*')
      .eq('month', month)
      .maybeSingle()

    if (run) {
      setExistingRun(run as PayrollRun)
      const { data: items } = await supabase
        .from('payroll_run_items')
        .select('*')
        .eq('payroll_run_id', run.id)
        .order('staff_name')
      setRunItems((items ?? []) as PayrollItem[])
    } else {
      setExistingRun(null)
      setRunItems([])
    }
    setLoading(false)
  }, [supabase, month])

  useEffect(() => { void loadRun() }, [loadRun])

  async function pullRecords() {
    setPulling(true)
    const start = `${month}-01`
    // last day of month
    const [y, m] = month.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    const end = `${month}-${String(lastDay).padStart(2, '0')}`

    const [{ data: sessions }, { data: staffRows }] = await Promise.all([
      supabase
        .from('clock_sessions')
        .select('staff_member_id,staff_full_name,staff_email,session_date,total_worked_seconds,overtime_seconds,overtime_approved,hourly_rate_naira,status')
        .gte('session_date', start)
        .lte('session_date', end)
        .in('status', ['completed', 'auto_logged_out']),
      supabase
        .from('staff_members')
        .select('id,full_name,email,department,role')
        .eq('is_active', true),
    ])

    const staffMeta = new Map((staffRows ?? []).map(s => [s.id, s]))

    // also grab staff_work_config for monthly salary
    const staffIds = [...new Set((sessions ?? []).map(s => s.staff_member_id))]
    const { data: configs } = await supabase
      .from('staff_work_config')
      .select('staff_member_id,monthly_salary_naira')
      .in('staff_member_id', staffIds.length ? staffIds : ['00000000-0000-0000-0000-000000000000'])

    const configMap = new Map((configs ?? []).map(c => [c.staff_member_id, c.monthly_salary_naira]))

    const grouped = new Map<string, ClockSession[]>()
    for (const s of (sessions ?? []) as ClockSession[]) {
      const existing = grouped.get(s.staff_member_id) ?? []
      grouped.set(s.staff_member_id, [...existing, s])
    }

    const summaries: StaffSummary[] = []
    for (const [staffId, staffSessions] of grouped) {
      const meta = staffMeta.get(staffId)
      const monthlySalary = Number(configMap.get(staffId) ?? 0)
      const totalWorkedSec = staffSessions.reduce((s, r) => s + r.total_worked_seconds, 0)
      const overtimeSec = staffSessions.reduce((s, r) => s + r.overtime_seconds, 0)
      const overtimeApproved = staffSessions.some(r => r.overtime_approved)
      const hourlyRate = staffSessions[0]?.hourly_rate_naira ?? 0

      const { regularPay, overtimePay, totalPay } = computeSessionPay(
        totalWorkedSec, overtimeSec, overtimeApproved, hourlyRate
      )

      summaries.push({
        staff_member_id: staffId,
        staff_name: staffSessions[0]?.staff_full_name ?? meta?.full_name ?? 'Unknown',
        staff_email: staffSessions[0]?.staff_email ?? meta?.email ?? '',
        department: meta?.department ?? null,
        role: meta?.role ?? null,
        daysWorked: staffSessions.length,
        totalWorkedSeconds: totalWorkedSec,
        overtimeSeconds: overtimeSec,
        overtimePay,
        regularPay,
        grossPay: totalPay,
        hourlyRate: Number(hourlyRate),
        monthlySalary,
        deductions: 0,
        bonuses: 0,
        netPay: totalPay,
      })
    }

    setPreview(summaries.sort((a, b) => a.staff_name.localeCompare(b.staff_name)))
    setPulling(false)
  }

  async function savePayrollRun() {
    if (!preview.length) return
    setSaving(true)

    const totalStaff = preview.length
    const totalDays = preview.reduce((s, p) => s + p.daysWorked, 0)
    const totalHours = preview.reduce((s, p) => s + p.totalWorkedSeconds / 3600, 0)
    const totalGross = preview.reduce((s, p) => s + p.grossPay, 0)
    const totalOvertime = preview.reduce((s, p) => s + p.overtimePay, 0)
    const totalNet = preview.reduce((s, p) => s + p.netPay, 0)

    const { data: run } = await supabase
      .from('payroll_runs')
      .upsert({
        month,
        status: 'draft',
        total_staff: totalStaff,
        total_days_worked: totalDays,
        total_hours_worked: totalHours,
        total_gross_pay: totalGross,
        total_overtime_pay: totalOvertime,
        total_net_pay: totalNet,
        currency: 'NGN',
      }, { onConflict: 'month' })
      .select()
      .single()

    if (run) {
      await supabase.from('payroll_run_items').delete().eq('payroll_run_id', run.id)
      await supabase.from('payroll_run_items').insert(
        preview.map(p => ({
          payroll_run_id: run.id,
          staff_member_id: p.staff_member_id,
          staff_name: p.staff_name,
          staff_email: p.staff_email,
          department: p.department,
          role: p.role,
          days_worked: p.daysWorked,
          total_hours_worked: p.totalWorkedSeconds / 3600,
          hourly_rate_naira: p.hourlyRate,
          monthly_salary_naira: p.monthlySalary,
          regular_pay: p.regularPay,
          overtime_hours: p.overtimeSeconds / 3600,
          overtime_pay: p.overtimePay,
          gross_pay: p.grossPay,
          deductions: p.deductions,
          bonuses: p.bonuses,
          net_pay: p.netPay,
          payment_status: 'pending',
        }))
      )
    }

    setSaving(false)
    setPreview([])
    void loadRun()
  }

  async function approveRun() {
    if (!existingRun) return
    setActing(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('payroll_runs').update({
      status: 'approved',
      approved_by: user?.email ?? 'finance admin',
      approved_at: new Date().toISOString(),
    }).eq('id', existingRun.id)
    await supabase.from('audit_logs').insert({
      event: 'admin.payroll_run_approved',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: existingRun.id,
      target_type: 'payroll_run',
      severity: 'warning',
      app: 'admin_panel',
      metadata: { month: existingRun.month, total_net_pay: existingRun.total_net_pay },
    })
    setActing(false)
    void loadRun()
  }

  async function markPaid() {
    if (!existingRun) return
    setActing(true)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('payroll_runs').update({
      status: 'paid',
      paid_at: new Date().toISOString(),
    }).eq('id', existingRun.id)
    await supabase.from('payroll_run_items').update({ payment_status: 'paid', paid_at: new Date().toISOString() })
      .eq('payroll_run_id', existingRun.id)
    await supabase.from('audit_logs').insert({
      event: 'admin.payroll_run_paid',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: existingRun.id,
      target_type: 'payroll_run',
      severity: 'warning',
      app: 'admin_panel',
      metadata: { month: existingRun.month, total_net_pay: existingRun.total_net_pay },
    })
    setActing(false)
    void loadRun()
  }

  async function saveItemEdit(itemId: string) {
    const edit = itemEdits[itemId]
    if (!edit) return
    const item = runItems.find(i => i.id === itemId)
    if (!item) return
    const deductions = parseFloat(edit.deductions) || 0
    const bonuses = parseFloat(edit.bonuses) || 0
    const netPay = item.gross_pay + bonuses - deductions
    await supabase.from('payroll_run_items').update({ deductions, bonuses, net_pay: netPay, notes: edit.notes || null }).eq('id', itemId)
    setEditingItem(null)
    void loadRun()
  }

  function exportCSV(items: PayrollItem[]) {
    const rows = [
      ['Staff Name', 'Email', 'Department', 'Role', 'Days Worked', 'Total Hours', 'Hourly Rate (₦)', 'Monthly Salary (₦)', 'Regular Pay (₦)', 'Overtime Hours', 'Overtime Pay (₦)', 'Gross Pay (₦)', 'Bonuses (₦)', 'Deductions (₦)', 'Net Pay (₦)', 'Status'].join(','),
      ...items.map(i => [
        i.staff_name, i.staff_email, i.department ?? '', i.role ?? '',
        i.days_worked, i.total_hours_worked.toFixed(2), i.hourly_rate_naira.toFixed(4),
        i.monthly_salary_naira.toFixed(2), i.regular_pay.toFixed(2), i.overtime_hours.toFixed(2),
        i.overtime_pay.toFixed(2), i.gross_pay.toFixed(2), i.bonuses.toFixed(2),
        i.deductions.toFixed(2), i.net_pay.toFixed(2), i.payment_status,
      ].join(','))
    ]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `payroll-${month}.csv`
    a.click()
  }

  const totalGross = existingRun?.total_gross_pay ?? preview.reduce((s, p) => s + p.grossPay, 0)
  const totalNet = existingRun?.total_net_pay ?? preview.reduce((s, p) => s + p.netPay, 0)
  const totalDays = existingRun?.total_days_worked ?? preview.reduce((s, p) => s + p.daysWorked, 0)
  const totalHours = existingRun?.total_hours_worked ?? preview.reduce((s, p) => s + p.totalWorkedSeconds / 3600, 0)
  const displayItems = existingRun ? runItems : []
  const displayPreview = !existingRun ? preview : []
  const runStatus = existingRun ? STATUS_CONFIG[existingRun.status] : null

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Header */}
      <div className="px-8 py-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-[22px] font-bold font-display tracking-tight" style={{ color: 'var(--tx-1)' }}>
            Staff Payroll
          </h1>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--tx-2)' }}>
            Pull monthly attendance records to calculate staff pay
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="px-3 py-2 rounded-xl text-[13px] border outline-none"
            style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border)', color: 'var(--tx-1)' }}
          />
          {existingRun && (
            <button
              onClick={() => exportCSV(runItems)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold border transition-colors"
              style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', backgroundColor: 'var(--bg-card)' }}
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Pull Banner — shown when no existing run and no preview */}
        {!loading && !existingRun && !preview.length && (
          <div className="rounded-2xl p-8 flex flex-col items-center gap-4 text-center"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
              <RefreshCw size={24} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-[17px] font-bold" style={{ color: 'var(--tx-1)' }}>
                No payroll run for {monthLabel(month)}
              </p>
              <p className="text-[13px] mt-1" style={{ color: 'var(--tx-3)' }}>
                Pull attendance records from the clock system to calculate what each staff member earned this month.
              </p>
            </div>
            <button
              onClick={() => void pullRecords()}
              disabled={pulling}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold text-white transition-all"
              style={{ backgroundColor: pulling ? 'rgba(16,185,129,0.5)' : '#10B981' }}
            >
              <RefreshCw size={15} className={pulling ? 'animate-spin' : ''} />
              {pulling ? 'Pulling Records…' : 'Pull Records'}
            </button>
          </div>
        )}

        {/* Preview banner — show after pull but before save */}
        {displayPreview.length > 0 && (
          <div className="rounded-xl p-4 flex items-center justify-between"
            style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div>
              <p className="text-[13px] font-bold" style={{ color: '#FBBF24' }}>Preview — Not Saved Yet</p>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                Review records below then click Save to create the payroll run for {monthLabel(month)}.
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setPreview([])} className="px-4 py-2 rounded-xl text-[12px] font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--tx-3)', backgroundColor: 'var(--bg-card)' }}>
                Cancel
              </button>
              <button onClick={() => void savePayrollRun()} disabled={saving}
                className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                style={{ backgroundColor: saving ? 'rgba(99,102,241,0.5)' : '#6366F1' }}>
                {saving ? 'Saving…' : 'Save Payroll Run'}
              </button>
            </div>
          </div>
        )}

        {/* Existing run — status bar */}
        {existingRun && runStatus && (
          <div className="rounded-xl p-4 flex items-center justify-between"
            style={{ backgroundColor: runStatus.bg, border: `1px solid ${runStatus.border}` }}>
            <div className="flex items-center gap-3">
              <CheckCircle size={16} style={{ color: runStatus.color }} />
              <div>
                <p className="text-[13px] font-bold" style={{ color: runStatus.color }}>
                  {monthLabel(month)} — {runStatus.label}
                </p>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>
                  Pulled {new Date(existingRun.pulled_at).toLocaleDateString('en-NG')}
                  {existingRun.approved_by ? ` · Approved by ${existingRun.approved_by}` : ''}
                  {existingRun.paid_at ? ` · Paid ${new Date(existingRun.paid_at).toLocaleDateString('en-NG')}` : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => void pullRecords()} disabled={pulling}
                className="flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold border"
                style={{ borderColor: 'var(--border)', color: 'var(--tx-2)', backgroundColor: 'var(--bg-card)' }}>
                <RefreshCw size={12} className={pulling ? 'animate-spin' : ''} />
                Re-pull
              </button>
              {existingRun.status === 'draft' && (
                <button onClick={() => void approveRun()} disabled={acting}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ backgroundColor: '#6366F1' }}>
                  {acting ? 'Approving…' : 'Approve Run'}
                </button>
              )}
              {existingRun.status === 'approved' && (
                <button onClick={() => void markPaid()} disabled={acting}
                  className="px-4 py-2 rounded-xl text-[12px] font-bold text-white"
                  style={{ backgroundColor: '#10B981' }}>
                  {acting ? 'Marking…' : 'Mark as Paid'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* KPI row */}
        {(displayItems.length > 0 || displayPreview.length > 0) && (
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Staff Members', value: String(displayItems.length || displayPreview.length), icon: <Users size={18} />, color: '#6366F1', bg: 'rgba(99,102,241,0.12)' },
              { label: 'Total Days Worked', value: String(totalDays), icon: <Calendar size={18} />, color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
              { label: 'Total Hours Worked', value: totalHours.toFixed(1) + 'h', icon: <Clock size={18} />, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
              { label: 'Total Net Pay', value: fmt(totalNet), icon: <DollarSign size={18} />, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
            ].map(k => (
              <div key={k.label} style={CARD} className="p-5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ backgroundColor: k.bg }}>
                  <span style={{ color: k.color }}>{k.icon}</span>
                </div>
                <p className="text-[20px] font-bold font-display" style={{ color: k.color }}>{k.value}</p>
                <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{k.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Staff table — existing run items */}
        {displayItems.length > 0 && (
          <div style={{ ...CARD, overflow: 'hidden' }}>
            <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[14px] font-bold" style={{ color: 'var(--tx-1)' }}>
                Staff Payroll Records — {monthLabel(month)}
              </p>
              <p className="text-[12px]" style={{ color: 'var(--tx-3)' }}>{displayItems.length} staff members</p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Staff', 'Days', 'Hours', 'Hourly Rate', 'Regular Pay', 'OT Pay', 'Bonuses', 'Deductions', 'Net Pay', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', backgroundColor: 'var(--bg-elevated)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayItems.map(item => {
                  const ps = PAY_STATUS[item.payment_status] ?? PAY_STATUS.pending
                  const isEditing = editingItem === item.id
                  const edit = itemEdits[item.id] ?? { deductions: String(item.deductions), bonuses: String(item.bonuses), notes: item.notes ?? '' }
                  return (
                    <React.Fragment key={item.id}>
                      <tr
                        style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                        onClick={() => setExpandedStaff(expandedStaff === item.id ? null : item.id)}
                        onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
                        onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <td style={{ padding: '11px 14px' }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{item.staff_name}</p>
                          <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>{item.department ?? item.role ?? item.staff_email}</p>
                        </td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tx-2)' }}>{item.days_worked}d</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tx-2)' }}>{item.total_hours_worked.toFixed(1)}h</td>
                        <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{fmt(item.hourly_rate_naira)}/hr</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 600 }}>{fmt(item.regular_pay)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: item.overtime_pay > 0 ? '#F59E0B' : 'var(--tx-3)' }}>{fmt(item.overtime_pay)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: item.bonuses > 0 ? '#34D399' : 'var(--tx-3)' }}>{fmt(item.bonuses)}</td>
                        <td style={{ padding: '11px 14px', fontSize: 13, color: item.deductions > 0 ? '#F87171' : 'var(--tx-3)' }}>{item.deductions > 0 ? `-${fmt(item.deductions)}` : '₦0'}</td>
                        <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 800, color: '#10B981' }}>{fmt(item.net_pay)}</td>
                        <td style={{ padding: '11px 14px' }}>
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6, textTransform: 'capitalize', color: ps.color, backgroundColor: ps.bg }}>
                            {item.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '11px 14px' }}>
                          {expandedStaff === item.id ? <ChevronUp size={14} color="var(--tx-3)" /> : <ChevronDown size={14} color="var(--tx-3)" />}
                        </td>
                      </tr>
                      {expandedStaff === item.id && (
                        <tr key={`${item.id}-detail`} style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                          <td colSpan={11} style={{ padding: '16px 24px' }}>
                            {!isEditing ? (
                              <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
                                <div>
                                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>Email</p>
                                  <p style={{ fontSize: 13, color: 'var(--tx-1)' }}>{item.staff_email}</p>
                                </div>
                                <div>
                                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>Monthly Salary</p>
                                  <p style={{ fontSize: 13, color: 'var(--tx-1)' }}>{fmt(item.monthly_salary_naira)}</p>
                                </div>
                                <div>
                                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 2 }}>Overtime Hours</p>
                                  <p style={{ fontSize: 13, color: 'var(--tx-1)' }}>{item.overtime_hours.toFixed(2)}h</p>
                                </div>
                                {existingRun?.status !== 'paid' && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setEditingItem(item.id); setItemEdits(prev => ({ ...prev, [item.id]: { deductions: String(item.deductions), bonuses: String(item.bonuses), notes: item.notes ?? '' } })) }}
                                    style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-2)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                                    Edit Adjustments
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                <div>
                                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Bonuses (₦)</p>
                                  <input type="number" value={edit.bonuses}
                                    onChange={ev => setItemEdits(p => ({ ...p, [item.id]: { ...edit, bonuses: ev.target.value } }))}
                                    style={{ width: 130, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
                                </div>
                                <div>
                                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Deductions (₦)</p>
                                  <input type="number" value={edit.deductions}
                                    onChange={ev => setItemEdits(p => ({ ...p, [item.id]: { ...edit, deductions: ev.target.value } }))}
                                    style={{ width: 130, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
                                </div>
                                <div>
                                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4 }}>Notes</p>
                                  <input value={edit.notes}
                                    onChange={ev => setItemEdits(p => ({ ...p, [item.id]: { ...edit, notes: ev.target.value } }))}
                                    placeholder="Optional note"
                                    style={{ width: 200, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
                                </div>
                                <button onClick={() => void saveItemEdit(item.id)}
                                  style={{ padding: '7px 16px', borderRadius: 8, border: 'none', backgroundColor: '#10B981', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Save</button>
                                <button onClick={() => setEditingItem(null)}
                                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 12, cursor: 'pointer' }}>Cancel</button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  )
                })}
              </tbody>
              {/* Totals footer */}
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'rgba(16,185,129,0.05)' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>TOTAL</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--tx-2)' }}>{totalDays}d</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--tx-2)' }}>{totalHours.toFixed(1)}h</td>
                  <td colSpan={4} />
                  <td colSpan={2} />
                  <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: '#10B981' }}>{fmt(totalNet)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Preview table — before save */}
        {displayPreview.length > 0 && (
          <div style={{ ...CARD, overflow: 'hidden' }}>
            <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <p className="text-[14px] font-bold" style={{ color: 'var(--tx-1)' }}>
                Preview — {monthLabel(month)} ({displayPreview.length} staff)
              </p>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Staff', 'Days Worked', 'Total Hours', 'Hourly Rate', 'Regular Pay', 'Overtime Pay', 'Gross Pay'].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', backgroundColor: 'var(--bg-elevated)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayPreview.map(p => (
                  <tr key={p.staff_member_id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{p.staff_name}</p>
                      <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>{p.staff_email}</p>
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tx-2)' }}>{p.daysWorked}d</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: 'var(--tx-2)' }}>{fmtHours(p.totalWorkedSeconds)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace' }}>
                      {p.hourlyRate > 0 ? `${fmt(p.hourlyRate)}/hr` : <span style={{ color: '#F87171' }}>No rate set</span>}
                    </td>
                    <td style={{ padding: '11px 14px', fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{fmt(p.regularPay)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 13, color: p.overtimePay > 0 ? '#F59E0B' : 'var(--tx-3)' }}>{fmt(p.overtimePay)}</td>
                    <td style={{ padding: '11px 14px', fontSize: 14, fontWeight: 800, color: '#10B981' }}>{fmt(p.grossPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'rgba(16,185,129,0.05)' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>TOTAL</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--tx-2)' }}>{displayPreview.reduce((s, p) => s + p.daysWorked, 0)}d</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600, color: 'var(--tx-2)' }}>{fmtHours(displayPreview.reduce((s, p) => s + p.totalWorkedSeconds, 0))}</td>
                  <td colSpan={3} />
                  <td style={{ padding: '12px 14px', fontSize: 15, fontWeight: 800, color: '#10B981' }}>{fmt(totalGross)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-7 h-7 rounded-full border-2 border-emerald-500/30 border-t-emerald-500 animate-spin" />
          </div>
        )}
      </div>
    </div>
  )
}

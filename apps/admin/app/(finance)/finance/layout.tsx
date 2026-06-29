'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeptSidebar from '@/components/department/DeptSidebar'

interface FinanceCounts {
  paymentFailures: number
  pendingRefunds: number
  financeTickets: number
}

const ZERO: FinanceCounts = { paymentFailures: 0, pendingRefunds: 0, financeTickets: 0 }

function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function SubscriptionIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
}
function TransactionIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
}
function InvoiceIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function PieIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
}
function CostIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
}
function ReportIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
}
function FailureIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/><line x1="8" y1="15" x2="16" y2="15" strokeDasharray="2 2"/></svg>
}
function RefundIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.5"/></svg>
}
function TicketInboxIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function CommsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function MailIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function ChurnIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><path d="M18 9l-5 5-2-2-4 4"/></svg>
}
function AgingIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function ForecastIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"/><polyline points="7 12 12 7 15 10 19 6"/></svg>
}
function VatIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
}
function GatewayIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
}
function BudgetIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg>
}
function BoardIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
}
function ReferralIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
}

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<FinanceCounts>(ZERO)

  useEffect(() => {
    const supabase = createClient()

    async function refreshCounts() {
      const [
        { count: paymentFailures },
        { count: pendingRefunds },
        { count: financeTickets },
      ] = await Promise.all([
        supabase.from('payment_failures').select('*', { count: 'exact', head: true })
          .eq('status', 'pending_retry'),
        supabase.from('refunds').select('*', { count: 'exact', head: true })
          .eq('status', 'pending'),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true })
          .eq('department', 'accounting')
          .not('status', 'in', '("resolved","closed")'),
      ])

      setCounts({
        paymentFailures: paymentFailures ?? 0,
        pendingRefunds:  pendingRefunds  ?? 0,
        financeTickets:  financeTickets  ?? 0,
      })
    }

    void refreshCounts()

    const channel = supabase
      .channel('finance-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_failures' }, () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'refunds' },          () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets' },  () => void refreshCounts())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { href: '/finance/dashboard', label: 'Dashboard', icon: <GridIcon /> },
      ],
    },
    {
      label: 'Revenue',
      items: [
        { href: '/finance/subscriptions', label: 'Subscriptions',    icon: <SubscriptionIcon /> },
        { href: '/finance/transactions',  label: 'Transactions',     icon: <TransactionIcon /> },
        { href: '/finance/invoices',      label: 'Invoices',         icon: <InvoiceIcon /> },
        { href: '/finance/referrals',     label: 'Referrals & Promos', icon: <ReferralIcon /> },
      ],
    },
    {
      label: 'Analysis',
      items: [
        { href: '/finance/plans',        label: 'Plan Analytics',    icon: <PieIcon /> },
        { href: '/finance/costs',        label: 'Platform Costs',    icon: <CostIcon /> },
        { href: '/finance/reports',      label: 'P&L Reports',       icon: <ReportIcon /> },
        { href: '/finance/churn',        label: 'Churn Analysis',    icon: <ChurnIcon /> },
        { href: '/finance/aging',        label: 'AR Aging',          icon: <AgingIcon /> },
        { href: '/finance/forecasting',  label: 'Forecasting',       icon: <ForecastIcon /> },
        { href: '/finance/budget',       label: 'Budget vs Actuals', icon: <BudgetIcon /> },
        { href: '/finance/board-report', label: 'Board Report',      icon: <BoardIcon /> },
      ],
    },
    {
      label: 'Compliance',
      items: [
        { href: '/finance/vat',     label: 'VAT & Tax',        icon: <VatIcon /> },
        { href: '/finance/gateway', label: 'Paystack Gateway', icon: <GatewayIcon /> },
      ],
    },
    {
      label: 'Operations',
      items: [
        { href: '/finance/refunds',          label: 'Refunds',          icon: <RefundIcon />,  badge: counts.pendingRefunds },
        { href: '/finance/payment-failures', label: 'Payment Failures', icon: <FailureIcon />, badge: counts.paymentFailures },
      ],
    },
    {
      label: 'Support Inbox',
      items: [
        { href: '/finance/tickets', label: 'Tickets Inbox', icon: <TicketInboxIcon />, badge: counts.financeTickets },
      ],
    },
    {
      label: 'Internal',
      items: [
        { href: '/finance/admin-inbox', label: 'Admin Inbox', icon: <MailIcon /> },
        { href: '/finance/staff-comms', label: '# general',   icon: <CommsIcon /> },
      ],
    },
  ]

  return (
    <div className="flex min-h-screen">
      <DeptSidebar color="finance" roomLabel="Finance Room" navGroups={navGroups} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}

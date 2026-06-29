'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import DeptSidebar from '@/components/department/DeptSidebar'

interface OpsCounts {
  candidateQueue: number
  companyQueue: number
  jobModeration: number
  liveChat: number
  supportTickets: number
  flaggedContent: number
  badgeDisputes: number
}

const ZERO: OpsCounts = {
  candidateQueue: 0, companyQueue: 0, jobModeration: 0,
  liveChat: 0, supportTickets: 0,
  flaggedContent: 0, badgeDisputes: 0,
}

// ─── Icons ────────────────────────────────────────────────────────────────────
function GridIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function CandidateIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
}
function CompanyIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
}
function BriefcaseIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/><line x1="8" y1="11" x2="8" y2="11"/><line x1="16" y1="11" x2="16" y2="11"/></svg>
}
function TicketIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/></svg>
}
function TimerIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
}
function FlagIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
}
function BadgeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
}
function UsersIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function ChatIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function AlertIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
}
function BellIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
}
function CommsIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
}
function FunnelIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
}
function ChartIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>
}
function EyeIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
}
function CalendarIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
}
function PipelineIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
}
function DocumentIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
}
function PortfolioIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
}
function MailIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
}
function TeamIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
}
function PlacementIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
}
// ─────────────────────────────────────────────────────────────────────────────

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  const [counts, setCounts] = useState<OpsCounts>(ZERO)

  useEffect(() => {
    const supabase = createClient()

    async function refreshCounts() {
      const [
        { count: candidateQueue },
        { count: companyQueue },
        { count: jobModeration },
        { count: liveChat },
        { count: supportTickets },
        { count: flaggedContent },
        { count: badgeDisputes },
      ] = await Promise.all([
        supabase.from('candidates').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('companies').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
        supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('chat_threads').select('*', { count: 'exact', head: true }).gt('unread_admin', 0),
        supabase.from('support_tickets').select('*', { count: 'exact', head: true }).eq('status', 'sent').is('parent_ticket_id', null),
        supabase.from('flagged_content').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('badge_disputes').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      ])

      setCounts({
        candidateQueue: candidateQueue ?? 0,
        companyQueue:   companyQueue   ?? 0,
        jobModeration:  jobModeration  ?? 0,
        liveChat:       liveChat       ?? 0,
        supportTickets: supportTickets ?? 0,
        flaggedContent: flaggedContent ?? 0,
        badgeDisputes:  badgeDisputes  ?? 0,
      })
    }

    void refreshCounts()

    const channel = supabase
      .channel('ops-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' },     () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' },      () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' },           () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' },   () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'support_tickets'}, () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'flagged_content'}, () => void refreshCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_disputes' }, () => void refreshCounts())
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }, [])

  const navGroups = [
    {
      label: 'Overview',
      items: [
        { href: '/ops/dashboard', label: 'Dashboard', icon: <GridIcon /> },
      ],
    },
    {
      label: 'Verification',
      items: [
        { href: '/ops/verifications', label: 'Candidate Queue', icon: <CandidateIcon />, badge: counts.candidateQueue },
        { href: '/ops/verifications', label: 'Company Queue',   icon: <CompanyIcon />,   badge: counts.companyQueue },
        { href: '/ops/jobs',          label: 'Job Moderation',  icon: <BriefcaseIcon />, badge: counts.jobModeration },
      ],
    },
    {
      label: 'Support',
      items: [
        { href: '/ops/chat',    label: 'Live Chat',       icon: <ChatIcon />,   badge: counts.liveChat },
        { href: '/ops/tickets', label: 'Support Tickets', icon: <TicketIcon />, badge: counts.supportTickets },
      ],
    },
    {
      label: 'Trust & Safety',
      items: [
        { href: '/ops/moderation', label: 'Flagged Content', icon: <FlagIcon />,  badge: counts.flaggedContent },
        { href: '/ops/badges',     label: 'Badge Disputes',  icon: <BadgeIcon />, badge: counts.badgeDisputes },
      ],
    },
    {
      label: 'Pipeline',
      items: [
        { href: '/ops/interviews',  label: 'Interviews',       icon: <CalendarIcon /> },
        { href: '/ops/applications',label: 'Applications',     icon: <PipelineIcon /> },
        { href: '/ops/onboarding',  label: 'Onboarding Funnel',icon: <FunnelIcon /> },
        { href: '/ops/placements',  label: 'Placements',       icon: <PlacementIcon /> },
      ],
    },
    {
      label: 'Platform Content',
      items: [
        { href: '/ops/cvs',           label: 'CV Management',       icon: <DocumentIcon /> },
        { href: '/ops/portfolio',     label: 'Portfolio Moderation', icon: <PortfolioIcon /> },
        { href: '/ops/email-monitor', label: 'Email Monitor',        icon: <MailIcon /> },
        { href: '/ops/company-teams', label: 'Company Teams',        icon: <TeamIcon /> },
      ],
    },
    {
      label: 'Users',
      items: [
        { href: '/ops/users',         label: 'User Management', icon: <UsersIcon /> },
        { href: '/ops/notifications', label: 'Notifications', icon: <BellIcon /> },
      ],
    },
    {
      label: 'Team Analytics',
      items: [
        { href: '/ops/profile-views', label: 'Profile Views', icon: <EyeIcon /> },
      ],
    },
    {
      label: 'Internal',
      items: [
        { href: '/ops/admin-inbox', label: 'Admin Inbox', icon: <MailIcon /> },
        { href: '/ops/staff-comms', label: '# general',   icon: <CommsIcon /> },
      ],
    },
  ]

  return (
    <div className="flex min-h-screen">
      <DeptSidebar color="ops" roomLabel="Management Room" navGroups={navGroups} />
      <main className="flex-1 min-w-0 overflow-auto">{children}</main>
    </div>
  )
}

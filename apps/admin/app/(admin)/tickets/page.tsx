'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_TICKETS } from '@/lib/mock-data'

type TicketStatus = 'open' | 'in_progress' | 'resolved'
type TicketCategory = 'technical' | 'badge_dispute' | 'moderation' | 'billing'
type TicketPriority = 'urgent' | 'standard'

interface Ticket {
  id: string
  subject: string
  category: TicketCategory
  userEmail: string
  userName: string
  status: TicketStatus
  priority: TicketPriority
  submittedAt: string
  message: string
  assignedTo: string | null
}

const CATEGORY_LABELS: Record<TicketCategory, string> = {
  technical: 'Technical',
  badge_dispute: 'Badge Dispute',
  moderation: 'Moderation',
  billing: 'Billing',
}

const STATUS_STYLES: Record<TicketStatus, string> = {
  open: 'bg-error/15 text-error border-error/30',
  in_progress: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  resolved: 'bg-trust-high-bg text-trust-high border-trust-high-border',
}

const PRIORITY_STYLES: Record<TicketPriority, { dot: string; label: string }> = {
  urgent: { dot: 'bg-error', label: 'Urgent (4h SLA)' },
  standard: { dot: 'bg-trust-mid', label: 'Standard (48h SLA)' },
}

function formatRelativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function SupportTicketsPage() {
  const [tickets, setTickets] = useState<Ticket[]>(MOCK_TICKETS)
  const [statusFilter, setStatusFilter] = useState<TicketStatus | 'all'>('all')
  const [categoryFilter, setCategoryFilter] = useState<TicketCategory | 'all'>('all')
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const filtered = tickets.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.status === statusFilter
    const matchCat = categoryFilter === 'all' || t.category === categoryFilter
    return matchStatus && matchCat
  })

  const selected = tickets.find((t) => t.id === selectedTicket)

  const handleResolve = (id: string) => {
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: 'resolved' as TicketStatus } : t))
    if (selectedTicket === id) setSelectedTicket(null)
  }

  const handleAssign = (id: string) => {
    setTickets((prev) => prev.map((t) => t.id === id ? { ...t, status: 'in_progress' as TicketStatus, assignedTo: 'admin@workstation.ng' } : t))
    setAssigningId(null)
  }

  const handleSendReply = () => {
    if (!replyText.trim()) return
    setReplyText('')
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Support Tickets"
        subtitle={`${tickets.filter((t) => t.status === 'open').length} open · ${tickets.filter((t) => t.status === 'in_progress').length} in progress`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Ticket list */}
        <div className="w-[420px] flex-shrink-0 border-r border-surface-border flex flex-col">
          {/* Filters */}
          <div className="px-5 py-4 border-b border-surface-border space-y-3">
            <div className="flex gap-2">
              {(['all', 'open', 'in_progress', 'resolved'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold capitalize transition-colors ${
                    statusFilter === s ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {s === 'in_progress' ? 'In Progress' : s}
                </button>
              ))}
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'technical', 'badge_dispute', 'moderation', 'billing'] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold transition-colors ${
                    categoryFilter === c ? 'bg-surface-muted text-text-primary' : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  {c === 'all' ? 'All' : CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Ticket items */}
          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {filtered.map((ticket) => {
              const isSelected = selectedTicket === ticket.id
              return (
                <button
                  key={ticket.id}
                  onClick={() => setSelectedTicket(isSelected ? null : ticket.id)}
                  className={`w-full text-left px-5 py-4 transition-colors ${
                    isSelected ? 'bg-admin-900/40 border-l-2 border-l-admin-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_STYLES[ticket.priority].dot}`} />
                      <p className="text-xs font-semibold text-text-primary truncate">{ticket.subject}</p>
                    </div>
                    <span className="text-[9px] text-text-muted font-mono flex-shrink-0">{formatRelativeTime(ticket.submittedAt)}</span>
                  </div>
                  <p className="text-xs text-text-secondary truncate mb-2">{ticket.userName}</p>
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border px-1 py-0.5 rounded font-mono ${STATUS_STYLES[ticket.status]}`}>
                      {ticket.status === 'in_progress' ? 'In Prog' : ticket.status}
                    </span>
                    <span className="text-[9px] text-text-muted">{CATEGORY_LABELS[ticket.category]}</span>
                    {ticket.assignedTo && (
                      <span className="text-[9px] text-admin-400 ml-auto truncate">{ticket.assignedTo}</span>
                    )}
                  </div>
                </button>
              )
            })}
            {filtered.length === 0 && (
              <div className="py-12 text-center text-text-muted">
                <p className="text-sm">No tickets match filters.</p>
              </div>
            )}
          </div>
        </div>

        {/* Ticket detail */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <p className="text-sm">Select a ticket to view</p>
              </div>
            </div>
          ) : (
            <div className="p-8 max-w-2xl">
              {/* Header */}
              <div className="mb-6">
                <div className="flex items-start gap-3 mb-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${PRIORITY_STYLES[selected.priority].dot}`} />
                  <div>
                    <h2 className="text-lg font-semibold font-display text-text-primary">{selected.subject}</h2>
                    <div className="flex items-center gap-3 mt-1.5">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>
                        {selected.status}
                      </span>
                      <span className="text-xs text-text-secondary">{PRIORITY_STYLES[selected.priority].label}</span>
                      <span className="text-xs text-text-muted font-mono">{CATEGORY_LABELS[selected.category]}</span>
                    </div>
                  </div>
                </div>

                {/* User info */}
                <div className="bg-surface-elevated rounded-lg px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-text-primary">{selected.userName}</p>
                    <p className="text-xs text-text-secondary">{selected.userEmail}</p>
                  </div>
                  <span className="text-xs text-text-muted font-mono">{formatRelativeTime(selected.submittedAt)}</span>
                </div>
              </div>

              {/* Original message */}
              <div className="bg-surface-card rounded-xl border border-surface-border p-5 mb-5">
                <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Original Message</p>
                <p className="text-sm text-text-body leading-relaxed">{selected.message}</p>
              </div>

              {/* Assignee */}
              <div className="flex items-center justify-between mb-5">
                <div>
                  <p className="text-xs text-text-secondary mb-0.5">Assigned to</p>
                  <p className="text-sm text-text-primary">{selected.assignedTo ?? 'Unassigned'}</p>
                </div>
                {!selected.assignedTo && (
                  <button
                    onClick={() => handleAssign(selected.id)}
                    className="px-3 py-1.5 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-xs font-semibold transition-colors"
                  >
                    Assign to me
                  </button>
                )}
              </div>

              {/* Reply input */}
              {selected.status !== 'resolved' && (
                <div className="space-y-3">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write a reply to the user..."
                    rows={4}
                    className="w-full bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none"
                  />
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSendReply}
                      disabled={!replyText.trim()}
                      className="px-4 py-2 rounded-lg bg-admin-500 hover:bg-admin-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                    >
                      Send Reply
                    </button>
                    <button
                      onClick={() => handleResolve(selected.id)}
                      className="px-4 py-2 rounded-lg bg-trust-high-bg text-trust-high border border-trust-high-border text-sm font-semibold hover:bg-green-900/30 transition-colors"
                    >
                      Mark Resolved
                    </button>
                  </div>
                </div>
              )}

              {selected.status === 'resolved' && (
                <div className="flex items-center gap-2 text-trust-high text-sm">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                  Ticket resolved
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

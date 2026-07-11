'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import TopBar from '@/components/layout/TopBar'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'

type DisputeStatus = 'pending' | 'resolved' | 'denied' | 'info_requested'
type DisputePriority = 'low' | 'medium' | 'high'

const DISPUTE_REASONS = [
  { value: 'never_worked',     label: 'Never worked at this company' },
  { value: 'wrong_dates',      label: 'Wrong employment dates' },
  { value: 'wrong_role',       label: 'Wrong job title / role' },
  { value: 'mutual_agreement', label: 'Both parties request removal' },
  { value: 'fraud',            label: 'Suspected fraudulent issuance' },
  { value: 'other',            label: 'Other / see description' },
]

const STATUS_META: Record<DisputeStatus, { label: string; badge: string }> = {
  pending:        { label: 'Pending',          badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  resolved:       { label: 'Resolved',         badge: 'bg-trust-high-bg text-trust-high border-trust-high-border' },
  denied:         { label: 'Denied',           badge: 'bg-error/10 text-error border-error/30' },
  info_requested: { label: 'Info Requested',   badge: 'bg-ops-900/30 text-ops-300 border-ops-700/40' },
}

const PRIORITY_META: Record<DisputePriority, { label: string; dot: string; badge: string }> = {
  high:   { label: 'High',   dot: 'bg-red-400',    badge: 'bg-red-900/30 text-red-400 border-red-800/40' },
  medium: { label: 'Medium', dot: 'bg-yellow-400', badge: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40' },
  low:    { label: 'Low',    dot: 'bg-blue-400',   badge: 'bg-blue-900/30 text-blue-400 border-blue-800/40' },
}

interface Dispute {
  id: string
  created_at: string
  candidate_name: string | null
  candidate_email: string | null
  company_name: string | null
  role_held: string | null
  badge_period: string | null
  reason: string
  resolution: string | null
  status: DisputeStatus
  priority: DisputePriority
  admin_notes: string | null
  evidence_urls: string[] | null
  created_by_staff_email: string | null
  routed_to_admin: boolean
  admin_resolved: boolean
  admin_decision: string | null
  admin_decided_by_email: string | null
  admin_decided_at: string | null
}

interface FormState {
  candidateName: string
  candidateEmail: string
  companyName: string
  roleHeld: string
  badgePeriod: string
  reason: string
  description: string
  priority: DisputePriority
  evidenceUrls: string
}

const EMPTY_FORM: FormState = {
  candidateName: '', candidateEmail: '', companyName: '',
  roleHeld: '', badgePeriod: '', reason: 'never_worked',
  description: '', priority: 'medium', evidenceUrls: '',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

function initials(name: string | null) {
  if (!name) return '??'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 text-text-muted ${open ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

// ─── New Dispute Modal ────────────────────────────────────────────────────────

function NewDisputeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const set = (field: keyof FormState, value: string) =>
    setForm(prev => ({ ...prev, [field]: value }))

  async function handleSubmit() {
    if (!form.candidateName.trim()) { setError('Candidate name is required.'); return }
    if (!form.companyName.trim()) { setError('Company name is required.'); return }
    if (!form.description.trim()) { setError('Description is required.'); return }
    setSaving(true)
    setError(null)

    const evidenceUrls = form.evidenceUrls.split('\n').map(u => u.trim()).filter(Boolean)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: dbError } = await supabase.from('badge_disputes').insert({
      created_by_admin: false,
      created_by_staff_email: user?.email ?? null,
      raised_by: user?.id ?? null,
      candidate_name: form.candidateName.trim(),
      candidate_email: form.candidateEmail.trim() || null,
      company_name: form.companyName.trim(),
      role_held: form.roleHeld.trim() || null,
      badge_period: form.badgePeriod.trim() || null,
      reason: form.description.trim(),
      admin_notes: `Reason: ${DISPUTE_REASONS.find(r => r.value === form.reason)?.label ?? form.reason}`,
      evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
      status: 'pending',
      priority: form.priority,
    })

    if (dbError) { setError('Failed to create dispute. Please try again.'); setSaving(false); return }

    await supabase.from('audit_logs').insert({
      event: 'ops.badge_dispute_created',
      actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin',
      severity: 'info', app: 'admin_panel',
      metadata: { candidate: form.candidateName, company: form.companyName },
    })

    setSaving(false)
    onCreated()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface-elevated border-b border-surface-border px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h3 className="text-base font-semibold font-display text-text-primary">Record Badge Dispute</h3>
            <p className="text-xs text-text-muted mt-0.5">Log a badge complaint brought in by a client</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Client Details</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Full name <span className="text-error">*</span></label>
                <input value={form.candidateName} onChange={e => set('candidateName', e.target.value)}
                  placeholder="e.g. Funmilayo Adeleke"
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Email</label>
                <input value={form.candidateEmail} onChange={e => set('candidateEmail', e.target.value)}
                  placeholder="user@email.com" type="email"
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Badge in Question</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Company (badge issuer) <span className="text-error">*</span></label>
                <input value={form.companyName} onChange={e => set('companyName', e.target.value)}
                  placeholder="e.g. TechCorp Nigeria Ltd"
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Role on badge</label>
                  <input value={form.roleHeld} onChange={e => set('roleHeld', e.target.value)}
                    placeholder="e.g. Senior Engineer"
                    className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Employment period</label>
                  <input value={form.badgePeriod} onChange={e => set('badgePeriod', e.target.value)}
                    placeholder="e.g. Jan 2022 – Dec 2023"
                    className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Dispute Details</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Reason category</label>
                <select value={form.reason} onChange={e => set('reason', e.target.value)}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none">
                  {DISPUTE_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">What the client reported <span className="text-error">*</span></label>
                <textarea value={form.description} onChange={e => set('description', e.target.value)}
                  placeholder="Describe the complaint and proof brought by the client…" rows={4}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Priority</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as DisputePriority[]).map(p => (
                    <button key={p} type="button" onClick={() => set('priority', p)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors capitalize
                        ${form.priority === p ? PRIORITY_META[p].badge : 'border-surface-border text-text-secondary hover:border-ops-600'}`}>
                      <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${PRIORITY_META[p].dot}`} />
                      {PRIORITY_META[p].label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Evidence URLs (one per line)</label>
            <textarea value={form.evidenceUrls} onChange={e => set('evidenceUrls', e.target.value)}
              placeholder="Paste file/image URLs the client provided, one per line…" rows={3}
              className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none font-mono" />
          </div>

          {error && (
            <div className="bg-error/10 border border-error/30 rounded-lg px-4 py-3">
              <p className="text-sm text-error">{error}</p>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-surface-elevated border-t border-surface-border px-6 py-4 flex gap-3 rounded-b-2xl">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold hover:bg-surface-elevated transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2.5 rounded-lg bg-ops-500 hover:bg-ops-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {saving ? 'Recording…' : 'Record Dispute'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Decision Modal ───────────────────────────────────────────────────────────

type StaffAction = 'resolved' | 'denied' | 'info_requested'

const ACTION_META: Record<StaffAction, { label: string; desc: string; btnClass: string }> = {
  resolved: {
    label: 'Mark Resolved',
    desc: 'The dispute has been settled. The client\'s complaint was addressed.',
    btnClass: 'bg-trust-high/90 hover:bg-trust-high text-surface-base',
  },
  denied: {
    label: 'Deny Dispute',
    desc: 'The badge dispute is rejected. The badge claim is valid as issued.',
    btnClass: 'bg-error/80 hover:bg-error text-white',
  },
  info_requested: {
    label: 'Request More Information',
    desc: 'More evidence or details are needed from the client before a decision can be made.',
    btnClass: 'bg-ops-500 hover:bg-ops-600 text-white',
  },
}

function DecisionModal({
  disputeId, candidateName, action, onClose, onDone,
}: {
  disputeId: string; candidateName: string | null; action: StaffAction; onClose: () => void; onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const meta = ACTION_META[action]

  async function handleConfirm() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()

    await supabase.from('badge_disputes').update({
      status: action,
      resolution: note.trim() || null,
      resolved_by: user?.id ?? null,
      resolved_at: action !== 'info_requested' ? now : null,
      info_requested_at: action === 'info_requested' ? now : null,
      updated_at: now,
    }).eq('id', disputeId)

    await supabase.from('audit_logs').insert({
      event: `ops.badge_dispute_${action}`,
      actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin',
      target_id: disputeId, target_type: 'badge_dispute', target_name: candidateName,
      severity: action === 'denied' ? 'warning' : 'info', app: 'admin_panel',
      metadata: { note: note.trim() || null },
    })

    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold font-display text-text-primary">{meta.label}</h3>
          <p className="text-sm text-text-muted mt-0.5">{candidateName ?? 'Dispute'}</p>
        </div>
        <div className="bg-surface-muted rounded-lg px-4 py-3">
          <p className="text-sm text-text-secondary">{meta.desc}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Decision note (optional)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Notes for the record…" rows={3}
            className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold hover:bg-surface-elevated transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 ${meta.btnClass}`}>
            {saving ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Send to Admin Modal ──────────────────────────────────────────────────────

function SendToAdminModal({ dispute, onClose, onDone }: { dispute: Dispute; onClose: () => void; onDone: () => void }) {
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const supabase = createClient()

  async function handleSend() {
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('badge_disputes').insert({
      parent_dispute_id: dispute.id,
      created_by_admin: false,
      created_by_staff_email: user?.email ?? null,
      raised_by: user?.id ?? null,
      candidate_name: dispute.candidate_name,
      candidate_email: dispute.candidate_email,
      company_name: dispute.company_name,
      role_held: dispute.role_held,
      badge_period: dispute.badge_period,
      reason: dispute.reason,
      admin_notes: note.trim() || `Escalated from management by ${user?.email ?? 'staff'}`,
      evidence_urls: dispute.evidence_urls,
      status: 'open',
      priority: dispute.priority,
    })

    await supabase.from('badge_disputes').update({
      routed_to_admin: true,
      updated_at: new Date().toISOString(),
    }).eq('id', dispute.id)

    await supabase.from('audit_logs').insert({
      event: 'ops.badge_dispute_sent_to_admin',
      actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin',
      target_id: dispute.id, target_type: 'badge_dispute', target_name: dispute.candidate_name,
      severity: 'info', app: 'admin_panel',
    })

    setSending(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold font-display text-text-primary">Send to Admin</h3>
          <p className="text-sm text-text-muted mt-0.5">
            A copy of this dispute will be sent to the admin for review. Admin can then resolve or deny it.
          </p>
        </div>
        <div className="bg-surface-muted rounded-lg px-4 py-3 space-y-1">
          <p className="text-xs font-semibold text-text-secondary">{dispute.candidate_name}</p>
          <p className="text-[11px] text-text-muted">{dispute.company_name}{dispute.role_held ? ` · ${dispute.role_held}` : ''}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Note to admin (optional)</p>
          <textarea value={note} onChange={e => setNote(e.target.value)}
            placeholder="Explain why this needs admin attention…" rows={3}
            className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold hover:bg-surface-elevated transition-colors">
            Cancel
          </button>
          <button onClick={handleSend} disabled={sending}
            className="flex-1 py-2.5 rounded-lg bg-ops-500 hover:bg-ops-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {sending ? 'Sending…' : 'Send to Admin'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'pending' | 'info_requested' | 'resolved' | 'denied'

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between text-sm gap-4">
      <span className="text-text-secondary flex-shrink-0">{label}</span>
      <span className={`text-text-primary text-right ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

export default function BadgeDisputesPage() {
  const [disputes, setDisputes]     = useState<Dispute[]>([])
  const [loading, setLoading]       = useState(true)
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [filter, setFilter]         = useState<FilterTab>('all')
  const [showNew, setShowNew]       = useState(false)
  const [decisionModal, setDecisionModal] = useState<{ id: string; name: string | null; action: StaffAction } | null>(null)
  const [adminModal, setAdminModal] = useState<Dispute | null>(null)
  const supabase = createClient()

  const fetchDisputes = useCallback(async () => {
    const { data } = await supabase
      .from('badge_disputes')
      .select('*')
      .is('parent_dispute_id', null)
      .eq('created_by_admin', false)
      .order('created_at', { ascending: false })
    setDisputes((data ?? []) as Dispute[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchDisputes() }, [fetchDisputes])

  useEffect(() => {
    const ch = supabase.channel('ops-badge-disputes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_disputes' }, () => void fetchDisputes())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, fetchDisputes])

  const filtered = disputes.filter(d => {
    if (filter === 'all') return true
    return d.status === filter
  })

  const counts = {
    all: disputes.length,
    pending: disputes.filter(d => d.status === 'pending').length,
    info_requested: disputes.filter(d => d.status === 'info_requested').length,
    resolved: disputes.filter(d => d.status === 'resolved').length,
    denied: disputes.filter(d => d.status === 'denied').length,
  }

  const isTerminal = (status: DisputeStatus) => status === 'resolved' || status === 'denied'

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Badge Disputes"
        subtitle={`${disputes.length} total · ${counts.pending} pending`}
        actions={
          <div className="flex items-center gap-4">
            <Link href="/ops/badges/review" className="text-xs font-semibold text-ops-300 hover:underline">
              Review Admin Badges →
            </Link>
            <button onClick={() => setShowNew(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Record Dispute
            </button>
          </div>
        }
      />

      <div className="px-8 py-6 space-y-5">
        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {([
            { key: 'all',           label: 'All' },
            { key: 'pending',       label: 'Pending' },
            { key: 'info_requested',label: 'Info Requested' },
            { key: 'resolved',      label: 'Resolved' },
            { key: 'denied',        label: 'Denied' },
          ] as { key: FilterTab; label: string }[]).map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border
                ${filter === key ? 'bg-ops-500 text-white border-ops-500' : 'bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary'}`}>
              {label}
              <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center
                ${filter === key ? 'bg-white/20 text-white' : 'bg-surface-muted text-text-muted'}`}>
                {counts[key]}
              </span>
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div className="py-24 text-center text-text-muted text-sm">Loading disputes…</div>
        ) : filtered.length === 0 ? (
          <div className="py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto mb-4">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-muted">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-text-primary mb-1">No disputes here</p>
            <p className="text-xs text-text-muted">When clients raise badge concerns, record them here.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(dispute => {
              const isOpen = expanded === dispute.id
              const statusMeta = STATUS_META[dispute.status] ?? STATUS_META.pending
              const priorityMeta = PRIORITY_META[dispute.priority] ?? PRIORITY_META.medium
              const terminal = isTerminal(dispute.status)

              return (
                <div key={dispute.id}
                  className="bg-surface-card rounded-xl border border-surface-border overflow-hidden transition-colors">

                  {/* Card header */}
                  <button onClick={() => setExpanded(isOpen ? null : dispute.id)}
                    className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-ops-900 border border-ops-700 flex items-center justify-center flex-shrink-0">
                        <span className="text-ops-300 text-xs font-bold font-display">{initials(dispute.candidate_name)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary truncate">{dispute.candidate_name ?? 'Unknown'}</p>
                          <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityMeta.badge}`}>
                            <span className={`w-1 h-1 rounded-full ${priorityMeta.dot}`} />
                            {priorityMeta.label}
                          </span>
                          {dispute.routed_to_admin && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-admin-900/30 text-admin-300 border-admin-700/40">
                              → Admin
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-text-muted truncate">
                          {dispute.company_name ? `Badge from ${dispute.company_name}` : 'Badge dispute'}
                          {dispute.role_held ? ` · ${dispute.role_held}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 flex-shrink-0 ml-3">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${statusMeta.badge}`}>
                        {statusMeta.label}
                      </span>
                      <span className="text-[10px] text-text-muted font-mono hidden md:block">{formatDate(dispute.created_at)}</span>
                      <ChevronIcon open={isOpen} />
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div className="border-t border-surface-border px-5 py-5 space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2.5">
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Badge Details</p>
                          {dispute.company_name && <Row label="Company" value={dispute.company_name} />}
                          {dispute.role_held && <Row label="Role" value={dispute.role_held} />}
                          {dispute.badge_period && <Row label="Period" value={dispute.badge_period} />}
                          {dispute.candidate_email && <Row label="Email" value={dispute.candidate_email} mono />}
                          {dispute.created_by_staff_email && <Row label="Logged by" value={dispute.created_by_staff_email} mono />}
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Client&apos;s Complaint</p>
                          <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated rounded-lg p-3">{dispute.reason}</p>
                          {dispute.admin_notes && (
                            <p className="text-[10px] text-text-muted mt-2 italic">{dispute.admin_notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Evidence */}
                      {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                        <div>
                          <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Evidence</p>
                          <div className="flex flex-wrap gap-2">
                            {dispute.evidence_urls.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[11px] text-ops-300 bg-ops-900/30 border border-ops-700/30 hover:border-ops-500/50 rounded-lg px-3 py-1.5 transition-colors">
                                <FileIcon />File {i + 1}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Resolution info */}
                      {terminal && dispute.resolution && (
                        <div className={`rounded-xl p-4 border ${dispute.status === 'resolved' ? 'bg-trust-high-bg border-trust-high-border' : 'bg-error/10 border-error/30'}`}>
                          <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${dispute.status === 'resolved' ? 'text-trust-high' : 'text-error'}`}>
                            {STATUS_META[dispute.status].label}
                          </p>
                          <p className="text-sm text-text-primary">{dispute.resolution}</p>
                        </div>
                      )}

                      {/* Admin decision */}
                      {dispute.admin_resolved && (
                        <div className={`rounded-xl p-4 border flex items-start gap-3
                          ${dispute.admin_decision === 'resolved' ? 'bg-trust-high-bg border-trust-high-border' : 'bg-error/10 border-error/30'}`}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                            className={dispute.admin_decision === 'resolved' ? 'text-trust-high mt-0.5 flex-shrink-0' : 'text-error mt-0.5 flex-shrink-0'}>
                            {dispute.admin_decision === 'resolved'
                              ? <><polyline points="20 6 9 17 4 12"/></>
                              : <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>
                            }
                          </svg>
                          <div>
                            <p className={`text-xs font-semibold uppercase tracking-wider ${dispute.admin_decision === 'resolved' ? 'text-trust-high' : 'text-error'}`}>
                              Admin {dispute.admin_decision === 'resolved' ? 'Resolved' : 'Denied'} this dispute
                            </p>
                            {dispute.admin_decided_by_email && (
                              <p className="text-[11px] text-text-muted mt-0.5">By {dispute.admin_decided_by_email}</p>
                            )}
                            {dispute.admin_decided_at && (
                              <p className="text-[11px] text-text-muted">On {formatTime(dispute.admin_decided_at)}</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      {!terminal && (
                        <div className="pt-3 border-t border-surface-border space-y-3">
                          {/* Three action buttons */}
                          <div className="grid grid-cols-3 gap-2">
                            <button
                              onClick={() => setDecisionModal({ id: dispute.id, name: dispute.candidate_name, action: 'resolved' })}
                              className="py-2.5 rounded-xl bg-trust-high-bg text-trust-high border border-trust-high-border text-xs font-semibold hover:opacity-80 transition-opacity">
                              Resolved
                            </button>
                            <button
                              onClick={() => setDecisionModal({ id: dispute.id, name: dispute.candidate_name, action: 'info_requested' })}
                              className="py-2.5 rounded-xl bg-ops-500/15 text-ops-400 border border-ops-500/30 text-xs font-semibold hover:bg-ops-500/25 transition-colors">
                              Request Info
                            </button>
                            <button
                              onClick={() => setDecisionModal({ id: dispute.id, name: dispute.candidate_name, action: 'denied' })}
                              className="py-2.5 rounded-xl bg-error/10 text-error border border-error/30 text-xs font-semibold hover:bg-error/20 transition-colors">
                              Denied
                            </button>
                          </div>

                          {/* Send to Admin */}
                          {!dispute.routed_to_admin ? (
                            <button onClick={() => setAdminModal(dispute)}
                              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary hover:border-admin-500/40 transition-colors">
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14M12 5l7 7-7 7"/>
                              </svg>
                              Send to Admin for Review
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-admin-900/20 border border-admin-700/30">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-admin-400 flex-shrink-0">
                                <polyline points="20 6 9 17 4 12"/>
                              </svg>
                              <p className="text-[11px] text-admin-300 font-medium">Copy sent to Admin — awaiting their decision</p>
                            </div>
                          )}
                        </div>
                      )}

                      {terminal && (
                        <div className="pt-3 border-t border-surface-border">
                          <span className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg border ${statusMeta.badge}`}>
                            {statusMeta.label} — no further action required
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showNew && (
        <NewDisputeModal
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); void fetchDisputes() }}
        />
      )}

      {decisionModal && (
        <DecisionModal
          disputeId={decisionModal.id}
          candidateName={decisionModal.name}
          action={decisionModal.action}
          onClose={() => setDecisionModal(null)}
          onDone={() => { setDecisionModal(null); void fetchDisputes() }}
        />
      )}

      {adminModal && (
        <SendToAdminModal
          dispute={adminModal}
          onClose={() => setAdminModal(null)}
          onDone={() => { setAdminModal(null); void fetchDisputes() }}
        />
      )}
    </div>
  )
}

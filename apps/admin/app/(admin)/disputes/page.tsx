'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type AdminDisputeStatus = 'open' | 'investigating' | 'upheld' | 'badge_removed' | 'info_requested'
type MgmtCopyStatus = 'open' | 'resolved' | 'denied'
type DisputePriority = 'low' | 'medium' | 'high'
type ActionType = 'uphold' | 'remove' | 'info'

const PRIORITY_META: Record<DisputePriority, { label: string; dot: string; badge: string }> = {
  high:   { label: 'High',   dot: 'bg-red-400',    badge: 'bg-red-900/30 text-red-400 border-red-800/40' },
  medium: { label: 'Medium', dot: 'bg-yellow-400', badge: 'bg-yellow-900/30 text-yellow-400 border-yellow-800/40' },
  low:    { label: 'Low',    dot: 'bg-blue-400',   badge: 'bg-blue-900/30 text-blue-400 border-blue-800/40' },
}

const ADMIN_STATUS_META: Record<AdminDisputeStatus, { label: string; badge: string }> = {
  open:          { label: 'Open',           badge: 'bg-error/15 text-error border-error/30' },
  investigating: { label: 'Investigating',  badge: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border' },
  upheld:        { label: 'Badge Upheld',   badge: 'bg-trust-high-bg text-trust-high border-trust-high-border' },
  badge_removed: { label: 'Badge Removed',  badge: 'bg-surface-muted text-text-secondary border-surface-border' },
  info_requested:{ label: 'Info Requested', badge: 'bg-admin-900/30 text-admin-300 border-admin-700/40' },
}

const MGMT_STATUS_META: Record<MgmtCopyStatus, { label: string; badge: string }> = {
  open:     { label: 'Awaiting Review', badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  resolved: { label: 'Resolved',        badge: 'bg-trust-high-bg text-trust-high border-trust-high-border' },
  denied:   { label: 'Denied',          badge: 'bg-error/10 text-error border-error/30' },
}

const DISPUTE_REASONS: { value: string; label: string }[] = [
  { value: 'never_worked',      label: 'Never worked at this company' },
  { value: 'wrong_dates',       label: 'Wrong employment dates' },
  { value: 'wrong_role',        label: 'Wrong job title / role' },
  { value: 'mutual_agreement',  label: 'Both parties request removal' },
  { value: 'fraud',             label: 'Suspected fraudulent issuance' },
  { value: 'other',             label: 'Other / see description' },
]

interface AdminDispute {
  id: string
  created_at: string
  candidate_name: string | null
  candidate_email: string | null
  company_name: string | null
  role_held: string | null
  badge_period: string | null
  reason: string
  resolution: string | null
  status: AdminDisputeStatus
  priority: DisputePriority
  admin_notes: string | null
  evidence_urls: string[] | null
  created_by_admin: boolean
  parent_dispute_id: string | null
  created_by_staff_email: string | null
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
  return name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm gap-4">
      <span className="text-text-secondary flex-shrink-0">{label}</span>
      <span className={`text-text-primary text-right truncate ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

// ─── New Admin Dispute Modal ──────────────────────────────────────────────────

function NewDisputeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  const set = (field: keyof FormState, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }))

  async function handleSubmit() {
    if (!form.candidateName.trim()) { setError('Candidate name is required.'); return }
    if (!form.companyName.trim()) { setError('Company name is required.'); return }
    if (!form.description.trim()) { setError('Description is required.'); return }
    setSaving(true)
    setError(null)

    const evidenceUrls = form.evidenceUrls.split('\n').map((u) => u.trim()).filter(Boolean)
    const { data: { user } } = await supabase.auth.getUser()

    const { error: dbError } = await supabase.from('badge_disputes').insert({
      created_by_admin: true,
      raised_by: user?.id ?? null,
      candidate_name: form.candidateName.trim(),
      candidate_email: form.candidateEmail.trim() || null,
      company_name: form.companyName.trim(),
      role_held: form.roleHeld.trim() || null,
      badge_period: form.badgePeriod.trim() || null,
      reason: form.description.trim(),
      admin_notes: `Reason category: ${DISPUTE_REASONS.find((r) => r.value === form.reason)?.label ?? form.reason}`,
      evidence_urls: evidenceUrls.length > 0 ? evidenceUrls : null,
      status: 'open',
      priority: form.priority,
    })

    if (dbError) { setError('Failed to create dispute. Please try again.'); setSaving(false); return }

    await supabase.from('audit_logs').insert({
      event: 'admin.badge_dispute_created',
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
            <h3 className="text-base font-semibold font-display text-text-primary">New Badge Dispute</h3>
            <p className="text-xs text-text-muted mt-0.5">Record a badge dispute raised via live chat or support ticket</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-muted transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Person Reporting</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Full name <span className="text-error">*</span></label>
                <input value={form.candidateName} onChange={(e) => set('candidateName', e.target.value)} placeholder="e.g. Funmilayo Adeleke"
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Email</label>
                <input value={form.candidateEmail} onChange={(e) => set('candidateEmail', e.target.value)} placeholder="e.g. user@email.com" type="email"
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Badge in Question</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Company (badge issuer) <span className="text-error">*</span></label>
                <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="e.g. TechCorp Nigeria Ltd"
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Role on badge</label>
                  <input value={form.roleHeld} onChange={(e) => set('roleHeld', e.target.value)} placeholder="e.g. Senior Engineer"
                    className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs text-text-muted mb-1 block">Employment period</label>
                  <input value={form.badgePeriod} onChange={(e) => set('badgePeriod', e.target.value)} placeholder="e.g. Jan 2022 – Dec 2023"
                    className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none" />
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-3">Dispute Details</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-muted mb-1 block">Reason category</label>
                <select value={form.reason} onChange={(e) => set('reason', e.target.value)}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-admin-500 focus:outline-none">
                  {DISPUTE_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Description / what was reported <span className="text-error">*</span></label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)}
                  placeholder="Summarise what the user reported…" rows={4}
                  className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs text-text-muted mb-1 block">Priority</label>
                <div className="flex gap-2">
                  {(['low', 'medium', 'high'] as DisputePriority[]).map((p) => (
                    <button key={p} type="button" onClick={() => set('priority', p)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors capitalize
                        ${form.priority === p ? PRIORITY_META[p].badge : 'border-surface-border text-text-secondary hover:border-admin-600'}`}>
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
            <textarea value={form.evidenceUrls} onChange={(e) => set('evidenceUrls', e.target.value)}
              placeholder="Paste file URLs from live chat attachments, one per line…" rows={3}
              className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none font-mono" />
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
            className="flex-1 py-2.5 rounded-lg bg-admin-500 hover:bg-admin-600 disabled:opacity-50 text-white text-sm font-semibold transition-colors">
            {saving ? 'Creating…' : 'Create Dispute Record'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Action Modal (admin-created disputes) ────────────────────────────────────

const ACTION_META: Record<ActionType, { label: string; desc: string; btnClass: string; newStatus: AdminDisputeStatus }> = {
  uphold: {
    label: 'Uphold Badge',
    desc: 'The badge will remain on the candidate\'s profile. Investigation is closed — the claim was not substantiated.',
    btnClass: 'bg-trust-high/90 hover:bg-trust-high text-surface-base',
    newStatus: 'upheld',
  },
  remove: {
    label: 'Remove Badge',
    desc: 'The badge will be removed from the candidate\'s profile. Record the reason below for the audit trail.',
    btnClass: 'bg-error/80 hover:bg-error text-white',
    newStatus: 'badge_removed',
  },
  info: {
    label: 'Request More Info',
    desc: 'Mark this dispute as awaiting additional documentation. Reach out to the relevant party via live chat.',
    btnClass: 'bg-admin-500 hover:bg-admin-600 text-white',
    newStatus: 'info_requested',
  },
}

function ActionModal({ disputeId, candidateName, action, onClose, onDone }: {
  disputeId: string; candidateName: string | null; action: ActionType; onClose: () => void; onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const meta = ACTION_META[action]

  async function handleConfirm() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()

    await supabase.from('badge_disputes').update({
      status: meta.newStatus,
      resolution: note.trim() || null,
      resolved_by: user?.id ?? null,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq('id', disputeId)

    await supabase.from('audit_logs').insert({
      event: `admin.badge_dispute_${meta.newStatus}`,
      actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin',
      target_id: disputeId, target_type: 'badge_dispute', target_name: candidateName,
      severity: action === 'remove' ? 'warning' : 'info', app: 'admin_panel',
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
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes for audit trail…" rows={3}
            className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none" />
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

// ─── Admin Decision Modal (management copies) ─────────────────────────────────

function AdminDecisionModal({ dispute, decision, onClose, onDone }: {
  dispute: AdminDispute; decision: 'resolved' | 'denied'; onClose: () => void; onDone: () => void
}) {
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleConfirm() {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const now = new Date().toISOString()

    await supabase.from('badge_disputes').update({
      status: decision,
      resolution: note.trim() || null,
      admin_decided_by_email: user?.email ?? null,
      resolved_by: user?.id ?? null,
      resolved_at: now,
      updated_at: now,
    }).eq('id', dispute.id)

    await supabase.from('audit_logs').insert({
      event: `admin.badge_dispute_copy_${decision}`,
      actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin',
      target_id: dispute.id, target_type: 'badge_dispute', target_name: dispute.candidate_name,
      severity: decision === 'denied' ? 'warning' : 'info', app: 'admin_panel',
      metadata: { parent_dispute_id: dispute.parent_dispute_id, note: note.trim() || null },
    })

    setSaving(false)
    onDone()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
        <div>
          <h3 className="text-base font-semibold font-display text-text-primary">
            {decision === 'resolved' ? 'Resolve Dispute' : 'Deny Dispute'}
          </h3>
          <p className="text-sm text-text-muted mt-0.5">{dispute.candidate_name ?? 'Dispute'} · from Management</p>
        </div>
        <div className="bg-surface-muted rounded-lg px-4 py-3">
          <p className="text-sm text-text-secondary">
            {decision === 'resolved'
              ? 'Mark this dispute as resolved. Management will be notified via the parent record.'
              : 'Deny this dispute. The badge claim stands. Management will see your decision on the parent record.'}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-text-secondary mb-2">Decision note (optional)</p>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notes for the record…" rows={3}
            className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold hover:bg-surface-elevated transition-colors">
            Cancel
          </button>
          <button onClick={handleConfirm} disabled={saving}
            className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50
              ${decision === 'resolved' ? 'bg-trust-high/90 hover:bg-trust-high text-surface-base' : 'bg-error/80 hover:bg-error text-white'}`}>
            {saving ? 'Saving…' : decision === 'resolved' ? 'Resolve' : 'Deny'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type AdminFilterTab = 'all' | 'open' | 'investigating' | 'resolved'
type ViewMode = 'admin_created' | 'from_management'

export default function BadgeDisputePage() {
  const [adminDisputes, setAdminDisputes] = useState<AdminDispute[]>([])
  const [mgmtCopies, setMgmtCopies] = useState<AdminDispute[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('admin_created')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [filter, setFilter] = useState<AdminFilterTab>('all')
  const [showNewModal, setShowNewModal] = useState(false)
  const [actionModal, setActionModal] = useState<{ id: string; name: string | null; action: ActionType } | null>(null)
  const [decisionModal, setDecisionModal] = useState<{ dispute: AdminDispute; decision: 'resolved' | 'denied' } | null>(null)
  const supabase = createClient()

  const fetchAll = useCallback(async () => {
    const [{ data: adminData }, { data: mgmtData }] = await Promise.all([
      supabase.from('badge_disputes').select('*').eq('created_by_admin', true).order('created_at', { ascending: false }),
      supabase.from('badge_disputes').select('*').not('parent_dispute_id', 'is', null).order('created_at', { ascending: false }),
    ])
    setAdminDisputes((adminData ?? []) as AdminDispute[])
    setMgmtCopies((mgmtData ?? []) as AdminDispute[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void fetchAll() }, [fetchAll])

  useEffect(() => {
    const ch = supabase.channel('admin-badge-disputes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'badge_disputes' }, () => void fetchAll())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, fetchAll])

  // ── Admin disputes section ──────────────────────────────────────────────────

  const adminResolved: AdminDisputeStatus[] = ['upheld', 'badge_removed']

  const filteredAdmin = adminDisputes.filter((d) => {
    if (filter === 'open') return d.status === 'open'
    if (filter === 'investigating') return d.status === 'investigating' || d.status === 'info_requested'
    if (filter === 'resolved') return adminResolved.includes(d.status as AdminDisputeStatus)
    return true
  })

  const adminCounts = {
    open: adminDisputes.filter((d) => d.status === 'open').length,
    investigating: adminDisputes.filter((d) => d.status === 'investigating' || d.status === 'info_requested').length,
    resolved: adminDisputes.filter((d) => adminResolved.includes(d.status as AdminDisputeStatus)).length,
  }

  async function startInvestigating(id: string) {
    await supabase.from('badge_disputes').update({ status: 'investigating', updated_at: new Date().toISOString() }).eq('id', id)
    setAdminDisputes((prev) => prev.map((d) => d.id === id ? { ...d, status: 'investigating' as AdminDisputeStatus } : d))
  }

  // ── Management copies section ───────────────────────────────────────────────

  const pendingMgmt = mgmtCopies.filter((d) => d.status === 'open').length

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Badge Dispute Tracker"
        subtitle={viewMode === 'admin_created'
          ? `${adminDisputes.length} total · ${adminCounts.open} open · ${adminCounts.investigating} under investigation`
          : `${mgmtCopies.length} from management · ${pendingMgmt} awaiting review`}
      />

      <div className="px-8 py-6 space-y-5">
        {/* View mode switcher */}
        <div className="flex gap-2 p-1 bg-surface-elevated border border-surface-border rounded-xl w-fit">
          <button onClick={() => { setViewMode('admin_created'); setExpanded(null) }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors
              ${viewMode === 'admin_created' ? 'bg-admin-500 text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            Admin Disputes
            {adminCounts.open > 0 && (
              <span className={`ml-2 text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center
                ${viewMode === 'admin_created' ? 'bg-white/20 text-white' : 'bg-error/20 text-error'}`}>
                {adminCounts.open}
              </span>
            )}
          </button>
          <button onClick={() => { setViewMode('from_management'); setExpanded(null) }}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors
              ${viewMode === 'from_management' ? 'bg-admin-500 text-white' : 'text-text-secondary hover:text-text-primary'}`}>
            From Management
            {pendingMgmt > 0 && (
              <span className={`ml-2 text-[10px] font-bold rounded-full w-4 h-4 inline-flex items-center justify-center
                ${viewMode === 'from_management' ? 'bg-white/20 text-white' : 'bg-amber-500/20 text-amber-400'}`}>
                {pendingMgmt}
              </span>
            )}
          </button>
        </div>

        {/* ── ADMIN DISPUTES VIEW ── */}
        {viewMode === 'admin_created' && (
          <>
            <div className="flex items-center justify-between">
              <div className="flex gap-3">
                {([
                  { key: 'all',           label: 'All',           count: adminDisputes.length },
                  { key: 'open',          label: 'Open',          count: adminCounts.open },
                  { key: 'investigating', label: 'Investigating',  count: adminCounts.investigating },
                  { key: 'resolved',      label: 'Resolved',      count: adminCounts.resolved },
                ] as { key: AdminFilterTab; label: string; count: number }[]).map(({ key, label, count }) => (
                  <button key={key} onClick={() => setFilter(key)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors border
                      ${filter === key ? 'bg-admin-500 text-white border-admin-500' : 'bg-surface-elevated text-text-secondary border-surface-border hover:text-text-primary'}`}>
                    {label}
                    <span className={`text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center
                      ${filter === key ? 'bg-white/20 text-white' : 'bg-surface-muted text-text-muted'}`}>
                      {count}
                    </span>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors">
                <PlusIcon />New Dispute
              </button>
            </div>

            {loading ? (
              <div className="py-24 text-center text-text-muted text-sm">Loading disputes…</div>
            ) : filteredAdmin.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">No disputes here</p>
                <p className="text-xs text-text-muted">When users raise badge concerns via live chat, log them here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredAdmin.map((dispute) => {
                  const isOpen = expanded === dispute.id
                  const statusMeta = ADMIN_STATUS_META[dispute.status as AdminDisputeStatus] ?? ADMIN_STATUS_META.open
                  const priorityMeta = PRIORITY_META[dispute.priority] ?? PRIORITY_META.medium
                  const isResolved = adminResolved.includes(dispute.status as AdminDisputeStatus)

                  return (
                    <div key={dispute.id} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
                      <button onClick={() => setExpanded(isOpen ? null : dispute.id)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-admin-900 border border-admin-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-admin-300 text-xs font-bold font-display">{initials(dispute.candidate_name)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-semibold text-text-primary truncate">{dispute.candidate_name ?? 'Unknown'}</p>
                              <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityMeta.badge}`}>
                                <span className={`w-1 h-1 rounded-full ${priorityMeta.dot}`} />
                                {priorityMeta.label}
                              </span>
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

                      {isOpen && (
                        <div className="border-t border-surface-border px-5 py-5 space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2.5">
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Badge Details</p>
                              {dispute.company_name && <Row label="Company" value={dispute.company_name} />}
                              {dispute.role_held && <Row label="Role" value={dispute.role_held} />}
                              {dispute.badge_period && <Row label="Period" value={dispute.badge_period} />}
                              {dispute.candidate_email && <Row label="Contact" value={dispute.candidate_email} mono />}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Dispute Description</p>
                              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated rounded-lg p-3">{dispute.reason}</p>
                              {dispute.admin_notes && <p className="text-[10px] text-text-muted mt-2 italic">{dispute.admin_notes}</p>}
                            </div>
                          </div>

                          {dispute.evidence_urls && dispute.evidence_urls.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Evidence</p>
                              <div className="flex flex-wrap gap-2">
                                {dispute.evidence_urls.map((url, i) => (
                                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1.5 text-[11px] text-admin-300 bg-admin-900/30 border border-admin-700/30 hover:border-admin-500/50 rounded-lg px-3 py-1.5 transition-colors">
                                    <FileIcon />File {i + 1}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}

                          {isResolved && dispute.resolution && (
                            <div className="bg-surface-elevated rounded-lg px-4 py-3 border border-surface-border">
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-1">Resolution Note</p>
                              <p className="text-xs text-text-secondary">{dispute.resolution}</p>
                            </div>
                          )}

                          {!isResolved && (
                            <div className="pt-3 border-t border-surface-border space-y-3">
                              {dispute.status === 'open' && (
                                <button onClick={() => void startInvestigating(dispute.id)}
                                  className="w-full py-2 rounded-lg border border-trust-mid-border text-trust-mid text-xs font-semibold bg-trust-mid-bg hover:opacity-80 transition-opacity">
                                  Mark as Investigating
                                </button>
                              )}
                              <div className="flex gap-2">
                                <button onClick={() => setActionModal({ id: dispute.id, name: dispute.candidate_name, action: 'uphold' })}
                                  className="flex-1 py-2.5 rounded-lg bg-trust-high-bg text-trust-high border border-trust-high-border text-xs font-semibold hover:opacity-80 transition-opacity">
                                  Uphold Badge
                                </button>
                                <button onClick={() => setActionModal({ id: dispute.id, name: dispute.candidate_name, action: 'remove' })}
                                  className="flex-1 py-2.5 rounded-lg bg-error/10 text-error border border-error/30 text-xs font-semibold hover:bg-error/20 transition-colors">
                                  Remove Badge
                                </button>
                                <button onClick={() => setActionModal({ id: dispute.id, name: dispute.candidate_name, action: 'info' })}
                                  className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary border border-surface-border text-xs font-semibold hover:bg-surface-elevated transition-colors">
                                  Need More Info
                                </button>
                              </div>
                            </div>
                          )}

                          {isResolved && (
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
          </>
        )}

        {/* ── FROM MANAGEMENT VIEW ── */}
        {viewMode === 'from_management' && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs text-text-muted">
                These are dispute copies sent by management staff who need admin review. Resolve or deny each one — management will see your decision automatically.
              </p>
            </div>

            {loading ? (
              <div className="py-24 text-center text-text-muted text-sm">Loading disputes…</div>
            ) : mgmtCopies.length === 0 ? (
              <div className="py-24 text-center">
                <div className="w-14 h-14 rounded-2xl bg-surface-elevated border border-surface-border flex items-center justify-center mx-auto mb-4">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                    <polyline points="22 4 12 14.01 9 11.01"/>
                  </svg>
                </div>
                <p className="text-sm font-semibold text-text-primary mb-1">No escalations from management</p>
                <p className="text-xs text-text-muted">When management sends a badge dispute for admin review, it appears here.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {mgmtCopies.map((dispute) => {
                  const isOpen = expanded === dispute.id
                  const copyStatus = (dispute.status as MgmtCopyStatus) in MGMT_STATUS_META
                    ? dispute.status as MgmtCopyStatus
                    : 'open'
                  const statusMeta = MGMT_STATUS_META[copyStatus]
                  const priorityMeta = PRIORITY_META[dispute.priority] ?? PRIORITY_META.medium
                  const isDecided = copyStatus === 'resolved' || copyStatus === 'denied'

                  return (
                    <div key={dispute.id} className={`bg-surface-card rounded-xl border overflow-hidden
                      ${!isDecided ? 'border-amber-500/40' : 'border-surface-border'}`}>
                      <button onClick={() => setExpanded(isOpen ? null : dispute.id)}
                        className="w-full text-left px-5 py-4 flex items-center justify-between hover:bg-surface-elevated/40 transition-colors">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-full bg-ops-900 border border-ops-700 flex items-center justify-center flex-shrink-0">
                            <span className="text-ops-300 text-xs font-bold font-display">{initials(dispute.candidate_name)}</span>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-text-primary truncate">{dispute.candidate_name ?? 'Unknown'}</p>
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-ops-900/30 text-ops-300 border-ops-700/40">
                                From Management
                              </span>
                              <span className={`hidden sm:inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded border ${priorityMeta.badge}`}>
                                <span className={`w-1 h-1 rounded-full ${priorityMeta.dot}`} />
                                {priorityMeta.label}
                              </span>
                            </div>
                            <p className="text-xs text-text-muted truncate">
                              {dispute.company_name ? `Badge from ${dispute.company_name}` : 'Badge dispute'}
                              {dispute.created_by_staff_email ? ` · logged by ${dispute.created_by_staff_email}` : ''}
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

                      {isOpen && (
                        <div className="border-t border-surface-border px-5 py-5 space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <div className="space-y-2.5">
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider">Badge Details</p>
                              {dispute.company_name && <Row label="Company" value={dispute.company_name} />}
                              {dispute.role_held && <Row label="Role" value={dispute.role_held} />}
                              {dispute.badge_period && <Row label="Period" value={dispute.badge_period} />}
                              {dispute.candidate_email && <Row label="Contact" value={dispute.candidate_email} mono />}
                              {dispute.created_by_staff_email && <Row label="Logged by" value={dispute.created_by_staff_email} mono />}
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-2">Dispute Description</p>
                              <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated rounded-lg p-3">{dispute.reason}</p>
                              {dispute.admin_notes && <p className="text-[10px] text-text-muted mt-2 italic">{dispute.admin_notes}</p>}
                            </div>
                          </div>

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

                          {isDecided && (
                            <div className={`rounded-xl p-4 border ${copyStatus === 'resolved' ? 'bg-trust-high-bg border-trust-high-border' : 'bg-error/10 border-error/30'}`}>
                              <p className={`text-xs font-semibold uppercase tracking-wider mb-1 ${copyStatus === 'resolved' ? 'text-trust-high' : 'text-error'}`}>
                                {copyStatus === 'resolved' ? 'Resolved' : 'Denied'} by Admin
                              </p>
                              {dispute.admin_decided_by_email && <p className="text-[11px] text-text-muted">By {dispute.admin_decided_by_email}</p>}
                              {dispute.admin_decided_at && <p className="text-[11px] text-text-muted">{formatTime(dispute.admin_decided_at)}</p>}
                              {dispute.resolution && <p className="text-xs text-text-secondary mt-1">{dispute.resolution}</p>}
                            </div>
                          )}

                          {!isDecided && (
                            <div className="pt-3 border-t border-surface-border">
                              <p className="text-[10px] font-bold text-text-secondary uppercase tracking-wider mb-3">Admin Decision</p>
                              <div className="flex gap-3">
                                <button onClick={() => setDecisionModal({ dispute, decision: 'resolved' })}
                                  className="flex-1 py-2.5 rounded-xl bg-trust-high-bg text-trust-high border border-trust-high-border text-xs font-semibold hover:opacity-80 transition-opacity">
                                  Resolve
                                </button>
                                <button onClick={() => setDecisionModal({ dispute, decision: 'denied' })}
                                  className="flex-1 py-2.5 rounded-xl bg-error/10 text-error border border-error/30 text-xs font-semibold hover:bg-error/20 transition-colors">
                                  Deny
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      {showNewModal && (
        <NewDisputeModal onClose={() => setShowNewModal(false)} onCreated={() => { setShowNewModal(false); void fetchAll() }} />
      )}

      {actionModal && (
        <ActionModal disputeId={actionModal.id} candidateName={actionModal.name} action={actionModal.action}
          onClose={() => setActionModal(null)} onDone={() => { setActionModal(null); void fetchAll() }} />
      )}

      {decisionModal && (
        <AdminDecisionModal dispute={decisionModal.dispute} decision={decisionModal.decision}
          onClose={() => setDecisionModal(null)} onDone={() => { setDecisionModal(null); void fetchAll() }} />
      )}
    </div>
  )
}

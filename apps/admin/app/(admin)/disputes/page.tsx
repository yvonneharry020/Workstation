'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_DISPUTES } from '@/lib/mock-data'

type DisputeAction = 'uphold' | 'remove' | 'request_info'

const ACTION_LABELS: Record<DisputeAction, { label: string; desc: string; btnClass: string }> = {
  uphold: {
    label: 'Uphold Badge',
    desc: 'The badge will remain on the candidate\'s profile. A notification will be sent to both parties.',
    btnClass: 'bg-teal-500 hover:bg-teal-600 text-surface-base',
  },
  remove: {
    label: 'Remove Badge',
    desc: 'The badge will be removed from the candidate\'s profile. Both the company and candidate will be notified.',
    btnClass: 'bg-error/15 text-error border border-error/30 hover:bg-error/25',
  },
  request_info: {
    label: 'Request More Info',
    desc: 'Request additional documentation or clarification from one or both parties before making a decision.',
    btnClass: 'bg-surface-muted text-text-secondary hover:bg-surface-elevated',
  },
}

const REASON_LABELS: Record<string, string> = {
  never_worked: 'Never worked at this company',
  wrong_dates: 'Wrong employment dates',
  wrong_role: 'Wrong job title / role',
  mutual_agreement: 'Company & candidate both request removal',
  fraud: 'Suspected fraudulent issuance',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ActionModal {
  disputeId: string
  candidateName: string
  action: DisputeAction
}

export default function BadgeDisputePage() {
  const [disputes, setDisputes] = useState(MOCK_DISPUTES)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)
  const [note, setNote] = useState('')

  const handleAction = () => {
    if (!actionModal) return
    if (actionModal.action !== 'request_info') {
      setDisputes((prev) => prev.filter((d) => d.id !== actionModal.disputeId))
    }
    setActionModal(null)
    setNote('')
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Badge Dispute Queue"
        subtitle={`${disputes.length} active disputes`}
      />

      <div className="px-8 py-6 space-y-4">
        {disputes.length === 0 && (
          <div className="text-center py-24 text-text-secondary">
            <p className="text-sm">No active badge disputes.</p>
          </div>
        )}

        {disputes.map((dispute) => {
          const isExpanded = expanded === dispute.id
          return (
            <div key={dispute.id} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <button
                onClick={() => setExpanded(isExpanded ? null : dispute.id)}
                className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-admin-900 border border-admin-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-admin-300 text-sm font-semibold font-display">
                      {dispute.candidateName.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{dispute.candidateName}</p>
                    <p className="text-xs text-text-secondary">
                      Disputes badge from <span className="text-text-primary">{dispute.badgeFrom}</span>
                    </p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {dispute.reasonLabel}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {dispute.previousDisputes > 0 && (
                    <span className="text-[10px] font-mono font-bold bg-warning/15 text-warning border border-warning/30 px-1.5 py-0.5 rounded">
                      {dispute.previousDisputes} prior dispute{dispute.previousDisputes > 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-xs text-text-muted font-mono">{formatDate(dispute.submittedAt)}</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {isExpanded && (
                <div className="border-t border-surface-border px-6 py-5 space-y-5">
                  {/* Badge details */}
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2.5">
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Badge Details</p>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Role</span>
                        <span className="text-text-primary">{dispute.badgeRole}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Dates</span>
                        <span className="text-text-primary font-mono">{dispute.badgeDates}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Issued by</span>
                        <span className="text-text-primary">{dispute.badgeFrom}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">Dispute Reason</p>
                      <p className="text-xs text-text-secondary leading-relaxed bg-surface-elevated rounded-lg p-3">
                        {dispute.description}
                      </p>
                    </div>
                  </div>

                  {/* Evidence files */}
                  {dispute.evidenceFiles.length > 0 && (
                    <div>
                      <p className="text-xs text-text-secondary mb-2">Evidence provided</p>
                      <div className="flex gap-2">
                        {dispute.evidenceFiles.map((f) => (
                          <div key={f} className="flex items-center gap-2 text-xs text-text-secondary bg-surface-elevated rounded-lg px-3 py-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {f}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-surface-border">
                    {(['uphold', 'remove', 'request_info'] as DisputeAction[]).map((action) => (
                      <button
                        key={action}
                        onClick={() => setActionModal({ disputeId: dispute.id, candidateName: dispute.candidateName, action })}
                        className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${ACTION_LABELS[action].btnClass}`}
                      >
                        {ACTION_LABELS[action].label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold font-display text-text-primary">{ACTION_LABELS[actionModal.action].label}</h3>
              <p className="text-sm text-text-secondary mt-1">{actionModal.candidateName}</p>
            </div>
            <div className="bg-surface-muted rounded-lg px-4 py-3">
              <p className="text-sm text-text-secondary">{ACTION_LABELS[actionModal.action].desc}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Note (optional)</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Decision notes for audit log..."
                rows={3}
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setActionModal(null); setNote('') }} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold">
                Cancel
              </button>
              <button onClick={handleAction} className="flex-1 py-2.5 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

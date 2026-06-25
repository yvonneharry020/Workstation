'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_CANDIDATE_QUEUE } from '@/lib/mock-data'

type ScanStatus = 'passed' | 'flagged' | 'pending'
type QueueAction = 'approve' | 'reject' | 'request_info'

interface RejectModal {
  candidateId: string
  candidateName: string
}

function CheckIcon({ pass }: { pass: boolean }) {
  return pass ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function DocBadge({ status }: { status: ScanStatus }) {
  const map = {
    passed: 'bg-trust-high-bg text-trust-high border-trust-high-border',
    flagged: 'bg-trust-low-bg text-trust-low border-trust-low-border',
    pending: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${map[status]}`}>
      {status}
    </span>
  )
}

function TrustScore({ score }: { score: number }) {
  const color = score >= 70 ? 'text-trust-high' : score >= 50 ? 'text-trust-mid' : 'text-trust-low'
  return (
    <span className={`font-mono font-bold text-sm ${color}`}>{score}</span>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

const REJECT_REASONS = [
  'NIN mismatch — details do not match NIMC records',
  'Liveness check failed — face not verifiable',
  'Document appears tampered or low quality',
  'Uploaded documents do not match profile details',
  'Suspicious application pattern',
]

export default function CandidateVerificationPage() {
  const [queue, setQueue] = useState(MOCK_CANDIDATE_QUEUE)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [rejectModal, setRejectModal] = useState<RejectModal | null>(null)
  const [rejectedReasons, setRejectedReasons] = useState<string[]>([])
  const [rejectNote, setRejectNote] = useState('')
  const [actionedIds, setActionedIds] = useState<Record<string, QueueAction>>({})

  const handleApprove = (id: string) => {
    setActionedIds((prev) => ({ ...prev, [id]: 'approve' }))
    setQueue((prev) => prev.filter((c) => c.id !== id))
  }

  const handleReject = () => {
    if (!rejectModal || rejectedReasons.length === 0) return
    setActionedIds((prev) => ({ ...prev, [rejectModal.candidateId]: 'reject' }))
    setQueue((prev) => prev.filter((c) => c.id !== rejectModal.candidateId))
    setRejectModal(null)
    setRejectedReasons([])
    setRejectNote('')
  }

  const handleRequestInfo = (id: string) => {
    setActionedIds((prev) => ({ ...prev, [id]: 'request_info' }))
    setQueue((prev) => prev.filter((c) => c.id !== id))
  }

  const toggleReason = (r: string) => {
    setRejectedReasons((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    )
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Candidate Verification Queue"
        subtitle={`${queue.length} pending · sorted by submission time`}
      />

      <div className="px-8 py-6 space-y-3">
        {queue.length === 0 && (
          <div className="text-center py-24 text-text-secondary">
            <svg className="w-12 h-12 mx-auto mb-3 text-text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <p className="text-sm">All candidates reviewed for this session.</p>
          </div>
        )}

        {queue.map((candidate) => {
          const isExpanded = expanded === candidate.id
          return (
            <div key={candidate.id} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              {/* Summary row */}
              <button
                onClick={() => setExpanded(isExpanded ? null : candidate.id)}
                className="w-full text-left px-6 py-4 flex items-center justify-between hover:bg-surface-elevated/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-admin-900 border border-admin-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-admin-300 text-sm font-semibold font-display">
                      {candidate.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">{candidate.name}</p>
                    <p className="text-xs text-text-secondary">{candidate.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Checks */}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5">
                      <CheckIcon pass={candidate.ninMatch} />
                      <span className="text-xs text-text-secondary">NIN</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckIcon pass={candidate.livenessPass} />
                      <span className="text-xs text-text-secondary">Liveness</span>
                    </div>
                    <DocBadge status={candidate.docScan} />
                  </div>

                  <div className="flex items-center gap-1 min-w-[64px]">
                    <span className="text-xs text-text-secondary">Score:</span>
                    <TrustScore score={candidate.trustScore} />
                  </div>

                  <span className="text-xs text-text-muted font-mono min-w-[120px] text-right">
                    {formatTime(candidate.submittedAt)}
                  </span>

                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Expanded details */}
              {isExpanded && (
                <div className="border-t border-surface-border px-6 py-5">
                  <div className="grid grid-cols-2 gap-6 mb-5">
                    <div className="space-y-2.5">
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Phone</span>
                        <span className="font-mono text-text-primary">{candidate.phone}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">NIN (masked)</span>
                        <span className="font-mono text-text-primary">{candidate.ninLast4}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-text-secondary">Documents uploaded</span>
                        <span className="text-text-primary">{candidate.documents.length}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-text-secondary mb-2">Uploaded files</p>
                      <div className="space-y-1">
                        {candidate.documents.map((doc) => (
                          <div key={doc} className="flex items-center gap-2 text-xs text-text-secondary bg-surface-elevated rounded-lg px-3 py-2">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {doc}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-3 border-t border-surface-border">
                    <button
                      onClick={() => handleApprove(candidate.id)}
                      className="flex-1 py-2.5 rounded-lg bg-teal-500 hover:bg-teal-600 text-surface-base text-sm font-semibold transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectModal({ candidateId: candidate.id, candidateName: candidate.name })}
                      className="flex-1 py-2.5 rounded-lg bg-error/15 hover:bg-error/25 text-error border border-error/30 text-sm font-semibold transition-colors"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleRequestInfo(candidate.id)}
                      className="flex-1 py-2.5 rounded-lg bg-surface-muted hover:bg-surface-elevated text-text-secondary text-sm font-semibold transition-colors"
                    >
                      Request More Info
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold font-display text-text-primary">Reject Candidate</h3>
              <p className="text-sm text-text-secondary mt-1">{rejectModal.candidateName}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Select rejection reasons (required)</p>
              <div className="space-y-2">
                {REJECT_REASONS.map((r) => (
                  <label key={r} className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rejectedReasons.includes(r)}
                      onChange={() => toggleReason(r)}
                      className="mt-0.5 accent-admin-500"
                    />
                    <span className="text-sm text-text-secondary">{r}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Additional note (optional)</p>
              <textarea
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
                placeholder="Any additional context for the candidate..."
                rows={3}
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => { setRejectModal(null); setRejectedReasons([]); setRejectNote('') }}
                className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold hover:bg-surface-elevated transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={rejectedReasons.length === 0}
                className="flex-1 py-2.5 rounded-lg bg-error hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

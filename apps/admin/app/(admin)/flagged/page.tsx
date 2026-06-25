'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_FLAGGED_ITEMS } from '@/lib/mock-data'

type FlagType = 'job_post' | 'document' | 'behavior' | 'ip_match'
type FlagAction = 'dismiss' | 'warn' | 'suspend' | 'escalate'

const FLAG_TYPE_LABELS: Record<FlagType, string> = {
  job_post: 'Job Post',
  document: 'Document',
  behavior: 'Behavior',
  ip_match: 'IP Match',
}

const FLAG_TYPE_COLORS: Record<FlagType, string> = {
  job_post: 'bg-[#7C2210]/20 text-brand-400 border-brand-800',
  document: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  behavior: 'bg-trust-low-bg text-trust-low border-trust-low-border',
  ip_match: 'bg-admin-900 text-admin-300 border-admin-800',
}

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 90 ? '#EF4444' : value >= 70 ? '#F59E0B' : '#94A3B8'
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-surface-muted rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${value}%`, backgroundColor: color }} />
      </div>
      <span className="text-xs font-mono" style={{ color }}>{value}%</span>
    </div>
  )
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
}

interface ActionModalState {
  itemId: string
  action: FlagAction
  entity: string
}

const ACTION_LABELS: Record<FlagAction, { label: string; color: string; desc: string }> = {
  dismiss: { label: 'Dismiss Flag', color: 'bg-surface-muted text-text-secondary', desc: 'Remove this flag. No action taken against the entity.' },
  warn: { label: 'Issue Warning', color: 'bg-warning/15 text-warning border border-warning/30', desc: 'Send an official warning to the entity. Logged on their profile.' },
  suspend: { label: 'Suspend Account', color: 'bg-error/15 text-error border border-error/30', desc: 'Temporarily suspend the entity\'s account until reviewed.' },
  escalate: { label: 'Escalate', color: 'bg-admin-900 text-admin-300 border border-admin-700', desc: 'Escalate to senior review — e.g. legal, EFCC referral, or major incident.' },
}

export default function FlaggedContentPage() {
  const [items, setItems] = useState(MOCK_FLAGGED_ITEMS)
  const [filterType, setFilterType] = useState<FlagType | 'all'>('all')
  const [actionModal, setActionModal] = useState<ActionModalState | null>(null)
  const [actionNote, setActionNote] = useState('')

  const filtered = filterType === 'all' ? items : items.filter((i) => i.type === filterType)

  const handleConfirmAction = () => {
    if (!actionModal) return
    setItems((prev) => prev.filter((i) => i.id !== actionModal.itemId))
    setActionModal(null)
    setActionNote('')
  }

  const FILTER_TYPES: (FlagType | 'all')[] = ['all', 'job_post', 'document', 'behavior', 'ip_match']

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Flagged Content Review"
        subtitle={`${items.length} flagged items · AI-detected with confidence scores`}
      />

      <div className="px-8 py-6">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-6">
          {FILTER_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                filterType === type
                  ? 'bg-admin-500 text-white'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-muted'
              }`}
            >
              {type === 'all' ? 'All' : FLAG_TYPE_LABELS[type]}
              {type !== 'all' && (
                <span className="ml-1.5 font-mono opacity-70">
                  {items.filter((i) => i.type === type).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 text-text-secondary">
            <p className="text-sm">No flagged items in this category.</p>
          </div>
        )}

        <div className="space-y-4">
          {filtered.map((item) => (
            <div key={item.id} className="bg-surface-card rounded-xl border border-surface-border p-5">
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-1 rounded font-mono flex-shrink-0 ${FLAG_TYPE_COLORS[item.type]}`}>
                    {FLAG_TYPE_LABELS[item.type]}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text-primary leading-snug">{item.title}</p>
                    <p className="text-xs text-text-secondary mt-0.5">{item.entity}</p>
                  </div>
                </div>
                <span className="text-xs text-text-muted font-mono flex-shrink-0">{formatTime(item.flaggedAt)}</span>
              </div>

              {/* Flag details */}
              <div className="bg-surface-elevated rounded-lg p-3.5 mb-4 space-y-2">
                <div className="flex items-start justify-between gap-4">
                  <p className="text-xs text-text-secondary leading-relaxed">{item.flagReason}</p>
                  <ConfidenceBar value={item.confidence} />
                </div>
                <p className="text-xs text-text-muted font-mono leading-relaxed border-t border-surface-border pt-2 mt-1">{item.context}</p>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {(['dismiss', 'warn', 'suspend', 'escalate'] as FlagAction[]).map((action) => (
                  <button
                    key={action}
                    onClick={() => setActionModal({ itemId: item.id, action, entity: item.entity })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${ACTION_LABELS[action].color}`}
                  >
                    {ACTION_LABELS[action].label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action confirmation modal */}
      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold font-display text-text-primary">
                {ACTION_LABELS[actionModal.action].label}
              </h3>
              <p className="text-sm text-text-secondary mt-1">{actionModal.entity}</p>
            </div>

            <div className="bg-surface-muted rounded-lg px-4 py-3">
              <p className="text-sm text-text-secondary">{ACTION_LABELS[actionModal.action].desc}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Action note (optional)</p>
              <textarea
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                placeholder="Internal note for the audit log..."
                rows={3}
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setActionModal(null); setActionNote('') }}
                className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmAction}
                className="flex-1 py-2.5 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

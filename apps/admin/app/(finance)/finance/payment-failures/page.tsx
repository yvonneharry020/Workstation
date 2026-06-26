'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type FailureStatus = 'pending_retry' | 'investigating' | 'resolved' | 'refunded' | 'written_off'

interface PaymentFailure {
  id: string
  created_at: string
  user_id: string | null
  user_name: string | null
  user_email: string | null
  amount: number
  currency: string
  payment_method: string | null
  error_code: string | null
  error_message: string | null
  gateway: string | null
  gateway_ref: string | null
  status: FailureStatus
  retry_count: number
  resolved_at: string | null
  notes: string | null
  investigated_by: string | null
}

const STATUS_STYLES: Record<FailureStatus, string> = {
  pending_retry: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  investigating: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  resolved:      'bg-trust-high-bg text-trust-high border-trust-high-border',
  refunded:      'bg-blue-900/20 text-blue-400 border-blue-800/30',
  written_off:   'bg-surface-muted text-text-muted border-surface-border',
}

const STATUS_LABELS: Record<FailureStatus, string> = {
  pending_retry: 'Pending Retry',
  investigating: 'Investigating',
  resolved:      'Resolved',
  refunded:      'Refunded',
  written_off:   'Written Off',
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
}

function formatAmount(amount: number, currency: string) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: currency || 'NGN', minimumFractionDigits: 0 }).format(amount)
}

const EMPTY: PaymentFailure[] = []

export default function PaymentFailuresPage() {
  const supabase = createClient()
  const [failures, setFailures] = useState<PaymentFailure[]>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<FailureStatus | 'all'>('all')
  const [notes, setNotes] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('payment_failures')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)
      setFailures((data as PaymentFailure[] | null) ?? EMPTY)
      setLoading(false)
    }
    void load()
  }, [supabase])

  const selected = failures.find(f => f.id === selectedId)

  const filtered = failures.filter(f => {
    if (statusFilter !== 'all' && f.status !== statusFilter) return false
    return true
  })

  async function handleStatusChange(status: FailureStatus) {
    if (!selectedId) return
    const { data: { user } } = await supabase.auth.getUser()
    const update: Partial<PaymentFailure> = { status, investigated_by: user?.email ?? null }
    if (status === 'resolved' || status === 'refunded') update.resolved_at = new Date().toISOString()
    await supabase.from('payment_failures').update(update).eq('id', selectedId)
    setFailures(prev => prev.map(f => f.id === selectedId ? { ...f, ...update } : f))
    await supabase.from('audit_logs').insert({
      event: 'admin.payment_failure_updated',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: selectedId,
      target_type: 'payment_failure',
      severity: 'info',
      app: 'admin_panel',
      metadata: { new_status: status },
    })
  }

  async function handleSaveNotes() {
    if (!selectedId || !notes.trim()) return
    setSavingNotes(true)
    await supabase.from('payment_failures').update({ notes: notes.trim() }).eq('id', selectedId)
    setFailures(prev => prev.map(f => f.id === selectedId ? { ...f, notes: notes.trim() } : f))
    setSavingNotes(false)
  }

  const pendingCount = failures.filter(f => f.status === 'pending_retry').length
  const totalValue = failures.filter(f => f.status !== 'resolved' && f.status !== 'refunded' && f.status !== 'written_off')
    .reduce((sum, f) => sum + (f.amount ?? 0), 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Payment Failures"
        subtitle={`${pendingCount} pending retry · ${failures.length} total${totalValue > 0 ? ` · ₦${totalValue.toLocaleString()} at risk` : ''}`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-[400px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border">
            <div className="flex gap-1.5 flex-wrap">
              {(['all','pending_retry','investigating','resolved','refunded','written_off'] as const).map(s => (
                <button key={s} onClick={() => setStatusFilter(s)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${statusFilter === s ? 'bg-finance-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {s === 'all' ? 'All' : STATUS_LABELS[s as FailureStatus]}
                  {s === 'pending_retry' && pendingCount > 0 && <span className="ml-1 text-[9px] bg-amber-500/20 text-amber-400 rounded px-1">{pendingCount}</span>}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading payment failures…</div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center">
                <svg className="w-10 h-10 text-text-muted mx-auto mb-3 opacity-40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <p className="text-text-muted text-sm">No payment failures</p>
                {statusFilter === 'all' && <p className="text-text-muted text-xs mt-1">All payments are processing normally.</p>}
              </div>
            ) : filtered.map(f => {
              const isActive = selectedId === f.id
              return (
                <button key={f.id} onClick={() => { setSelectedId(f.id); setNotes('') }}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${isActive ? 'bg-finance-900/40 border-l-2 border-l-finance-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[f.status]}`}>{STATUS_LABELS[f.status]}</span>
                    <span className="text-[9px] text-text-muted font-mono">{relativeTime(f.created_at)}</span>
                  </div>
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-semibold text-text-primary">{f.user_name ?? 'Unknown user'}</p>
                    <p className="text-sm font-bold text-error">{formatAmount(f.amount ?? 0, f.currency ?? 'NGN')}</p>
                  </div>
                  <p className="text-[11px] text-text-muted">{f.user_email}</p>
                  {f.error_code && <p className="text-[10px] text-text-muted font-mono mt-0.5">{f.error_code} · {f.gateway}</p>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                <p className="text-sm">Select a failure to investigate</p>
              </div>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>{STATUS_LABELS[selected.status]}</span>
                    {selected.gateway && <span className="text-[10px] text-text-muted font-mono">{selected.gateway}</span>}
                    {selected.retry_count > 0 && <span className="text-[10px] text-orange-400 font-mono">{selected.retry_count} retries</span>}
                  </div>
                  <p className="text-lg font-bold text-error">{formatAmount(selected.amount ?? 0, selected.currency ?? 'NGN')}</p>
                  <p className="text-sm text-text-secondary mt-0.5">{selected.user_name} · {selected.user_email}</p>
                  <p className="text-xs text-text-muted">{formatTime(selected.created_at)}</p>
                </div>
              </div>

              <div className="bg-surface-card rounded-xl border border-surface-border divide-y divide-surface-border/50">
                {[
                  { label: 'Error Code', value: selected.error_code },
                  { label: 'Error Message', value: selected.error_message },
                  { label: 'Payment Method', value: selected.payment_method },
                  { label: 'Gateway Ref', value: selected.gateway_ref },
                  { label: 'User ID', value: selected.user_id },
                  { label: 'Investigated By', value: selected.investigated_by },
                ].filter(r => r.value).map(r => (
                  <div key={r.label} className="px-4 py-3 flex items-start justify-between gap-4">
                    <span className="text-xs font-semibold text-text-muted w-32 flex-shrink-0">{r.label}</span>
                    <span className="text-xs text-text-primary font-mono text-right break-all">{r.value}</span>
                  </div>
                ))}
              </div>

              {selected.status !== 'resolved' && selected.status !== 'refunded' && selected.status !== 'written_off' && (
                <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Update Status</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['investigating','resolved','refunded','written_off'] as const).map(s => (
                      <button key={s} onClick={() => handleStatusChange(s)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${selected.status === s ? STATUS_STYLES[s] : 'bg-surface-elevated border-surface-border text-text-secondary hover:text-text-primary'}`}>
                        {STATUS_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-surface-card rounded-xl border border-surface-border p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Investigation Notes</p>
                <textarea value={notes || selected.notes || ''} onChange={e => setNotes(e.target.value)}
                  placeholder="Document your investigation: what you found, actions taken, outcome…" rows={4}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-finance-500 focus:outline-none resize-none mb-2" />
                <button onClick={handleSaveNotes} disabled={savingNotes || !notes.trim()}
                  className="px-3 py-1.5 rounded-lg bg-surface-elevated border border-surface-border text-xs font-semibold text-text-secondary hover:text-text-primary disabled:opacity-40 transition-colors">
                  {savingNotes ? 'Saving…' : 'Save notes'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

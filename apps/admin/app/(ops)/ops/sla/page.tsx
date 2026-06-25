'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Ticket {
  id: string
  title: string
  status: string
  priority: string | null
  created_at: string
  submitted_by_name: string | null
  submitted_by: string
}

const SLA_TARGETS: Record<string, number> = {
  critical: 2,
  high: 8,
  medium: 24,
  low: 72,
}

function hoursAgo(iso: string) {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

export default function SLAPage() {
  const supabase = createClient()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase
      .from('support_tickets')
      .select('id,title,status,priority,created_at,submitted_by_name,submitted_by')
      .neq('status', 'resolved')
      .order('created_at', { ascending: true })
    setTickets((data ?? []) as Ticket[])
    setLoading(false)
  }

  const enriched = tickets.map(t => {
    const elapsed = hoursAgo(t.created_at)
    const target = SLA_TARGETS[t.priority ?? 'medium'] ?? 24
    const breached = elapsed > target
    const pct = Math.min(100, Math.round((elapsed / target) * 100))
    return { ...t, elapsed, target, breached, pct }
  })

  const breached = enriched.filter(t => t.breached)
  const atRisk = enriched.filter(t => !t.breached && t.pct >= 75)
  const healthy = enriched.filter(t => !t.breached && t.pct < 75)

  const avg = enriched.length > 0 ? enriched.reduce((s, t) => s + t.elapsed, 0) / enriched.length : 0

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <h1 className="text-xl font-semibold font-display text-text-primary">SLA Monitor</h1>
        <p className="text-sm text-text-secondary mt-0.5">Response time tracking for open support tickets. SLA targets: Critical 2h, High 8h, Medium 24h, Low 72h.</p>
      </div>

      <div className="px-8 py-4 border-b border-surface-border flex gap-4">
        {[
          { label: 'SLA Breached', value: breached.length, color: 'text-red-400', bg: 'bg-red-900/20 border-red-800/30' },
          { label: 'At Risk', value: atRisk.length, color: 'text-yellow-400', bg: 'bg-yellow-900/20 border-yellow-800/30' },
          { label: 'Healthy', value: healthy.length, color: 'text-green-400', bg: 'bg-green-900/20 border-green-800/30' },
          { label: 'Avg Age', value: formatHours(avg), color: 'text-text-primary', bg: 'bg-surface-card border-surface-border' },
        ].map(s => (
          <div key={s.label} className={`border rounded-xl px-4 py-3 ${s.bg}`}>
            <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
            <div className="text-xs text-text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-3xl space-y-6">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-2xl mb-2">✅</p>
            <p className="text-text-muted text-sm">No open tickets — SLA clear!</p>
          </div>
        ) : (
          <>
            {breached.length > 0 && (
              <div>
                <p className="text-xs font-bold text-red-400 uppercase tracking-wider mb-3">SLA Breached ({breached.length})</p>
                <div className="space-y-2">
                  {breached.map(t => (
                    <div key={t.id} className="bg-red-900/10 border border-red-800/20 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{t.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{t.submitted_by_name ?? t.submitted_by} · Priority: <span className="capitalize">{t.priority ?? 'medium'}</span></p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-sm font-bold text-red-400">{formatHours(t.elapsed)} elapsed</p>
                          <p className="text-xs text-text-muted">Target: {t.target}h</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-red-900/30 rounded-full overflow-hidden">
                        <div className="h-full bg-red-500 rounded-full" style={{ width: '100%' }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {atRisk.length > 0 && (
              <div>
                <p className="text-xs font-bold text-yellow-400 uppercase tracking-wider mb-3">At Risk — {'>'}75% of SLA used ({atRisk.length})</p>
                <div className="space-y-2">
                  {atRisk.map(t => (
                    <div key={t.id} className="bg-yellow-900/10 border border-yellow-800/20 rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{t.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{t.submitted_by_name ?? t.submitted_by} · Priority: <span className="capitalize">{t.priority ?? 'medium'}</span></p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-sm font-bold text-yellow-400">{formatHours(t.elapsed)} / {t.target}h</p>
                          <p className="text-xs text-text-muted">{t.pct}% used</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 bg-surface-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-500 rounded-full transition-all" style={{ width: `${t.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {healthy.length > 0 && (
              <div>
                <p className="text-xs font-bold text-green-400 uppercase tracking-wider mb-3">Healthy ({healthy.length})</p>
                <div className="space-y-2">
                  {healthy.map(t => (
                    <div key={t.id} className="bg-surface-card border border-surface-border rounded-xl p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-text-primary">{t.title}</p>
                          <p className="text-xs text-text-muted mt-0.5">{t.submitted_by_name ?? t.submitted_by} · <span className="capitalize">{t.priority ?? 'medium'}</span></p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p className="text-sm font-semibold text-text-primary">{formatHours(t.elapsed)} / {t.target}h</p>
                          <p className="text-xs text-text-muted">{t.pct}% used</p>
                        </div>
                      </div>
                      <div className="mt-2 h-1 bg-surface-elevated rounded-full overflow-hidden">
                        <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${t.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

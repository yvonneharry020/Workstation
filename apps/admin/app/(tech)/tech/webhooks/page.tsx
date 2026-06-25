'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface WebhookLog {
  id: string
  event_type: string
  source: string
  payload: Record<string, unknown>
  status: string
  error: string | null
  created_at: string
  processed_at: string | null
}

const STATUS_STYLES: Record<string, string> = {
  processed: 'bg-green-900/20 text-green-400 border-green-800/30',
  received: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  failed: 'bg-red-900/20 text-red-400 border-red-800/30',
}

const EVENT_ICONS: Record<string, string> = {
  'charge.success': '✅',
  'charge.failed': '❌',
  'subscription.create': '🔄',
  'subscription.disable': '⏸️',
  'subscription.not_renew': '⚠️',
  'refund.processed': '↩️',
  'transfer.success': '💸',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function WebhooksPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<WebhookLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<WebhookLog | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(100)
    setLogs((data ?? []) as WebhookLog[])
    setLoading(false)
  }

  const filtered = statusFilter === 'all' ? logs : logs.filter(l => l.status === statusFilter)

  const stats = {
    total: logs.length,
    processed: logs.filter(l => l.status === 'processed').length,
    failed: logs.filter(l => l.status === 'failed').length,
    received: logs.filter(l => l.status === 'received').length,
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold font-display text-text-primary">Webhook Logs</h1>
            <p className="text-sm text-text-secondary mt-0.5">Paystack webhook event log. Test mode active.</p>
          </div>
          <button onClick={load} className="px-3 py-2 text-xs font-semibold bg-surface-elevated border border-surface-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </div>
        <div className="flex gap-4 mt-4">
          {Object.entries(stats).map(([k, v]) => (
            <div key={k} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold font-display ${k === 'failed' ? 'text-red-400' : k === 'processed' ? 'text-green-400' : 'text-text-primary'}`}>{v}</div>
              <div className="text-xs text-text-muted capitalize">{k}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-3 border-b border-surface-border flex items-center gap-3">
        {['all', 'processed', 'received', 'failed'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${statusFilter === s ? 'bg-tech-900/50 text-tech-300 border border-tech-800/30' : 'text-text-secondary hover:text-text-primary'}`}>{s}</button>
        ))}
        <span className="text-xs text-text-muted ml-auto">{filtered.length} events</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto px-8 py-4">
          {loading ? (
            <div className="text-text-muted text-sm">Loading…</div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-text-muted">No webhook events found.</p>
          ) : (
            <div className="space-y-1">
              {filtered.map(log => (
                <button key={log.id} onClick={() => setSelected(log)}
                  className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-colors ${selected?.id === log.id ? 'bg-tech-900/20 border-tech-800/30' : 'bg-surface-card border-surface-border hover:bg-surface-elevated'}`}>
                  <span className="text-xl flex-shrink-0">{EVENT_ICONS[log.event_type] ?? '📬'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text-primary font-mono">{log.event_type}</p>
                    <p className="text-xs text-text-muted capitalize">{log.source} · {formatDate(log.created_at)}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 capitalize ${STATUS_STYLES[log.status] ?? ''}`}>{log.status}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-surface-border flex flex-col overflow-y-auto">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Event Detail</p>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Event</p>
                <p className="text-sm text-text-primary mt-0.5 font-mono">{selected.event_type}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Source</p>
                <p className="text-sm text-text-primary mt-0.5 capitalize">{selected.source}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Status</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize mt-0.5 inline-block ${STATUS_STYLES[selected.status] ?? ''}`}>{selected.status}</span>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Received</p>
                <p className="text-sm text-text-primary mt-0.5">{formatDate(selected.created_at)}</p>
              </div>
              {selected.error && (
                <div>
                  <p className="text-[10px] text-red-400 uppercase tracking-wider">Error</p>
                  <p className="text-sm text-red-300 mt-0.5 font-mono text-xs">{selected.error}</p>
                </div>
              )}
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Payload</p>
                <pre className="mt-1 text-[10px] font-mono text-text-muted bg-surface-elevated rounded-lg p-2.5 overflow-auto max-h-64">{JSON.stringify(selected.payload, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface AuditEntry {
  id: string
  event: string
  created_at: string
  metadata: Record<string, unknown>
  actor_email: string | null
  severity: string
}

interface EmailLog {
  id: string
  to: string
  subject: string
  status: string
  sentAt: string
  event: string
  metadata: Record<string, unknown>
}

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-green-900/20 text-green-400 border-green-800/30',
  failed: 'bg-red-900/20 text-red-400 border-red-800/30',
  sent: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  bounced: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function EmailPage() {
  const supabase = createClient()
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchEmail, setSearchEmail] = useState('')
  const [selected, setSelected] = useState<EmailLog | null>(null)

  useEffect(() => { void loadLogs() }, [])

  async function loadLogs() {
    const { data } = await supabase
      .from('audit_logs')
      .select('id,event,created_at,metadata,actor_email,severity')
      .or('event.like.email.%,event.ilike.%invite%,event.ilike.%password_reset%,event.ilike.%notification%')
      .order('created_at', { ascending: false })
      .limit(50)

    const mapped: EmailLog[] = ((data ?? []) as AuditEntry[]).map(e => {
      const m = e.metadata ?? {}
      return {
        id: e.id,
        to: (m.to ?? m.email ?? e.actor_email ?? 'unknown') as string,
        subject: (m.subject ?? e.event.replace(/_/g, ' ').replace('.', ' – ')) as string,
        status: (m.status ?? 'sent') as string,
        sentAt: e.created_at,
        event: e.event,
        metadata: m,
      }
    })
    setLogs(mapped)
    setLoading(false)
  }

  const filtered = logs.filter(l =>
    searchEmail === '' || l.to.toLowerCase().includes(searchEmail.toLowerCase()) || l.subject.toLowerCase().includes(searchEmail.toLowerCase())
  )

  const stats = {
    total: logs.length,
    delivered: logs.filter(l => l.status === 'delivered').length,
    failed: logs.filter(l => l.status === 'failed').length,
    sent: logs.filter(l => !['delivered','failed'].includes(l.status)).length,
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold font-display text-text-primary">Email Inspector</h1>
            <p className="text-sm text-text-secondary mt-0.5">Transactional email logs from the audit trail. Powered by Resend.</p>
          </div>
          <button onClick={loadLogs} className="px-3 py-2 text-xs font-semibold bg-surface-elevated border border-surface-border rounded-lg text-text-secondary hover:text-text-primary transition-colors">Refresh</button>
        </div>
        <div className="flex gap-4 mt-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-text-primary' },
            { label: 'Delivered', value: stats.delivered, color: 'text-green-400' },
            { label: 'Sent', value: stats.sent, color: 'text-blue-400' },
            { label: 'Failed', value: stats.failed, color: 'text-red-400' },
          ].map(s => (
            <div key={s.label} className="bg-surface-card border border-surface-border rounded-xl px-4 py-3">
              <div className={`text-2xl font-bold font-display ${s.color}`}>{s.value}</div>
              <div className="text-xs text-text-muted">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1">
        <div className="flex-1 flex flex-col">
          <div className="px-8 py-3 border-b border-surface-border">
            <input value={searchEmail} onChange={e => setSearchEmail(e.target.value)} placeholder="Filter by email or subject…" className="w-80 bg-surface-elevated border border-surface-border rounded-lg px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-tech-500" />
          </div>
          <div className="flex-1 overflow-y-auto px-8 py-4">
            {loading ? (
              <div className="text-text-muted text-sm">Loading…</div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-text-muted">No email logs found.</p>
            ) : (
              <div className="space-y-1">
                {filtered.map(log => (
                  <button key={log.id} onClick={() => setSelected(log)}
                    className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-colors ${selected?.id === log.id ? 'bg-tech-900/20 border-tech-800/30' : 'bg-surface-card border-surface-border hover:border-surface-border/60'}`}>
                    <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center flex-shrink-0">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-text-muted"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text-primary truncate">{log.subject}</p>
                      <p className="text-xs text-text-muted truncate">{log.to}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 capitalize ${STATUS_STYLES[log.status] ?? STATUS_STYLES.sent}`}>{log.status}</span>
                    <span className="text-xs text-text-muted flex-shrink-0">{formatDate(log.sentAt)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-surface-border flex flex-col">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Email Details</p>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
            </div>
            <div className="p-5 space-y-3 flex-1 overflow-y-auto">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">To</p>
                <p className="text-sm text-text-primary mt-0.5 font-mono">{selected.to}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Subject</p>
                <p className="text-sm text-text-primary mt-0.5">{selected.subject}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Status</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize mt-0.5 inline-block ${STATUS_STYLES[selected.status] ?? STATUS_STYLES.sent}`}>{selected.status}</span>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Sent at</p>
                <p className="text-sm text-text-primary mt-0.5">{formatDate(selected.sentAt)}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Event type</p>
                <p className="text-sm text-text-primary mt-0.5 font-mono text-xs">{selected.event}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Metadata</p>
                <pre className="mt-1 text-[10px] font-mono text-text-muted bg-surface-elevated rounded-lg p-2.5 overflow-auto">{JSON.stringify(selected.metadata, null, 2)}</pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

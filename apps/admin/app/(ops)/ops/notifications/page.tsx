'use client'

import { useState, useEffect } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

type NotifTarget = 'all' | 'candidates' | 'companies'
type NotifType = 'info' | 'warning' | 'success' | 'announcement'

interface Notification {
  id: string
  created_at: string
  title: string
  body: string
  type: NotifType
  target: NotifTarget
  sent_by: string | null
  sent_by_email: string | null
  is_active: boolean
  expires_at: string | null
  read_count: number
}

const TYPE_STYLES: Record<NotifType, { bg: string; text: string; border: string; label: string }> = {
  info:         { bg: 'bg-blue-900/20',   text: 'text-blue-400',   border: 'border-blue-800/30',   label: 'Info' },
  warning:      { bg: 'bg-orange-900/20', text: 'text-orange-400', border: 'border-orange-800/30', label: 'Warning' },
  success:      { bg: 'bg-trust-high-bg', text: 'text-trust-high', border: 'border-trust-high-border', label: 'Success' },
  announcement: { bg: 'bg-ops-900/20',   text: 'text-ops-400',    border: 'border-ops-800/30',    label: 'Announcement' },
}

const TARGET_LABELS: Record<NotifTarget, string> = {
  all: 'Everyone', candidates: 'Candidates only', companies: 'Companies only',
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

const EMPTY: Notification[] = []

export default function OpsNotificationsPage() {
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({
    title: '', body: '', type: 'info' as NotifType, target: 'all' as NotifTarget, expires_at: '',
  })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifications((data as Notification[] | null) ?? EMPTY)
      setLoading(false)
    }
    void load()
  }, [supabase])

  async function handleCreate() {
    if (!form.title.trim() || !form.body.trim()) return
    setCreating(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('notifications').insert({
      title: form.title.trim(),
      body: form.body.trim(),
      type: form.type,
      target: form.target,
      sent_by: user?.id ?? null,
      sent_by_email: user?.email ?? null,
      is_active: true,
      expires_at: form.expires_at || null,
    }).select().single()
    if (!error && data) {
      setNotifications(prev => [data as Notification, ...prev])
      setShowCreate(false)
      setForm({ title: '', body: '', type: 'info', target: 'all', expires_at: '' })
      await supabase.from('audit_logs').insert({
        event: 'ops.notification_sent',
        actor_email: user?.email ?? null,
        actor_id: user?.id ?? null,
        actor_type: 'staff',
        target_type: 'notification',
        target_name: form.title,
        severity: 'info',
        app: 'admin_panel',
        metadata: { type: form.type, target: form.target },
      })
    }
    setCreating(false)
  }

  async function handleToggle(id: string, current: boolean) {
    await supabase.from('notifications').update({ is_active: !current }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_active: !current } : n))
  }

  const activeCount = notifications.filter(n => n.is_active).length

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Notifications"
        subtitle={`${activeCount} active broadcast${activeCount !== 1 ? 's' : ''}`}
        actions={
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Send Notification
          </button>
        }
      />

      <div className="px-8 py-6 max-w-4xl">
        {loading ? (
          <div className="text-text-muted text-sm">Loading notifications…</div>
        ) : notifications.length === 0 ? (
          <div className="py-20 text-center">
            <svg className="w-14 h-14 text-text-muted mx-auto mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            <p className="text-text-primary text-sm font-semibold mb-1">No notifications sent yet</p>
            <p className="text-text-muted text-sm">Send a broadcast to inform all users or specific groups.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map(n => {
              const t = TYPE_STYLES[n.type]
              return (
                <div key={n.id} className={`bg-surface-card border rounded-xl p-5 transition-opacity ${n.is_active ? 'border-surface-border' : 'border-surface-border opacity-50'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={`text-[9px] font-bold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${t.bg} ${t.text} ${t.border}`}>{t.label}</span>
                        <span className="text-[9px] font-semibold text-text-muted">{TARGET_LABELS[n.target]}</span>
                        {!n.is_active && <span className="text-[9px] text-text-muted font-mono">INACTIVE</span>}
                      </div>
                      <p className="text-sm font-semibold text-text-primary mb-0.5">{n.title}</p>
                      <p className="text-sm text-text-secondary leading-relaxed">{n.body}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[10px] text-text-muted">{relativeTime(n.created_at)}</span>
                        {n.sent_by_email && <span className="text-[10px] text-text-muted">by {n.sent_by_email}</span>}
                        {n.expires_at && <span className="text-[10px] text-text-muted">expires {new Date(n.expires_at).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggle(n.id, n.is_active)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors flex-shrink-0 ${n.is_active ? 'bg-error/15 text-error border-error/30 hover:bg-error/25' : 'bg-surface-elevated border-surface-border text-text-secondary hover:text-text-primary'}`}>
                      {n.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShowCreate(false)} />
          <div className="relative bg-surface-card border border-surface-border rounded-2xl w-full max-w-lg mx-4">
            <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
              <h2 className="text-sm font-semibold text-text-primary">Send Notification</h2>
              <button onClick={() => setShowCreate(false)} className="text-text-muted hover:text-text-primary">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Notification type</label>
                <div className="flex gap-2 flex-wrap">
                  {(['info','announcement','success','warning'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize transition-colors ${form.type === t ? `${TYPE_STYLES[t].bg} ${TYPE_STYLES[t].text} ${TYPE_STYLES[t].border}` : 'bg-surface-elevated border-surface-border text-text-secondary'}`}>
                      {TYPE_STYLES[t].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Send to</label>
                <div className="flex gap-2">
                  {(['all','candidates','companies'] as const).map(t => (
                    <button key={t} onClick={() => setForm(f => ({ ...f, target: t }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.target === t ? 'bg-ops-500 text-white border-ops-500' : 'bg-surface-elevated border-surface-border text-text-secondary'}`}>
                      {TARGET_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Title *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Short, clear headline"
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Message *</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="The notification body shown to users…" rows={4}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none" />
              </div>
              <div>
                <label className="text-xs font-semibold text-text-secondary mb-1.5 block">Expires on (optional)</label>
                <input type="datetime-local" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  className="w-full bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:border-ops-500 focus:outline-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowCreate(false)} className="flex-1 py-2.5 rounded-xl bg-surface-elevated border border-surface-border text-sm font-semibold text-text-secondary hover:text-text-primary transition-colors">Cancel</button>
                <button onClick={handleCreate} disabled={creating || !form.title.trim() || !form.body.trim()}
                  className="flex-1 py-2.5 rounded-xl bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold disabled:opacity-40 transition-colors">
                  {creating ? 'Sending…' : 'Send Notification'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

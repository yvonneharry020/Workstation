'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Announcement {
  id: string
  title: string
  body: string
  target: string
  type: string
  status: string
  created_by: string | null
  created_at: string
  scheduled_for: string | null
  sent_at: string | null
  sent_count: number
}

const TYPE_COLORS: Record<string, string> = {
  info: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  warning: 'bg-yellow-900/20 text-yellow-400 border-yellow-800/30',
  maintenance: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  feature: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-surface-elevated text-text-muted border-surface-border',
  scheduled: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  sent: 'bg-green-900/20 text-green-400 border-green-800/30',
}

const BLANK = { title: '', body: '', target: 'all', type: 'info' }

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function AnnouncementsPage() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState(BLANK)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false })
    setAnnouncements((data ?? []) as Announcement[])
    setLoading(false)
  }

  async function createAnnouncement() {
    if (!form.title.trim() || !form.body.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data } = await supabase.from('announcements').insert({
      title: form.title,
      body: form.body,
      target: form.target,
      type: form.type,
      status: 'draft',
      created_by: user?.email ?? 'admin',
    }).select().single()
    if (data) setAnnouncements(prev => [data as Announcement, ...prev])
    setCreating(false)
    setForm(BLANK)
    setSaving(false)
  }

  async function sendAnnouncement(ann: Announcement) {
    setSending(ann.id)
    const { data: targetUsers } = ann.target === 'all'
      ? await supabase.from('candidates').select('id').limit(1000)
      : ann.target === 'candidates'
        ? await supabase.from('candidates').select('id').limit(1000)
        : await supabase.from('companies').select('id').limit(1000)
    const count = (targetUsers ?? []).length
    await supabase.from('announcements').update({ status: 'sent', sent_at: new Date().toISOString(), sent_count: count }).eq('id', ann.id)
    setAnnouncements(prev => prev.map(a => a.id === ann.id ? { ...a, status: 'sent', sent_at: new Date().toISOString(), sent_count: count } : a))
    setSending(null)
  }

  async function deleteAnnouncement(id: string) {
    await supabase.from('announcements').delete().eq('id', id)
    setAnnouncements(prev => prev.filter(a => a.id !== id))
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Announcements</h1>
          <p className="text-sm text-text-secondary mt-0.5">Create and broadcast platform announcements to candidates and/or companies.</p>
        </div>
        <button onClick={() => setCreating(true)} className="px-4 py-2 bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold rounded-xl transition-colors">+ New Announcement</button>
      </div>

      {creating && (
        <div className="px-8 py-5 border-b border-surface-border bg-ops-900/5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-4">Create Announcement</p>
          <div className="space-y-4 max-w-2xl">
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Title" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-ops-500" />
            <textarea value={form.body} onChange={e => setForm(p => ({ ...p, body: e.target.value }))} rows={4} placeholder="Message body…" className="w-full bg-surface-elevated border border-surface-border rounded-lg px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-ops-500 resize-none" />
            <div className="flex gap-4">
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">Target</label>
                <select value={form.target} onChange={e => setForm(p => ({ ...p, target: e.target.value }))} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500">
                  <option value="all">All Users</option>
                  <option value="candidates">Candidates Only</option>
                  <option value="companies">Companies Only</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-text-muted uppercase tracking-wider block mb-1.5">Type</label>
                <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))} className="bg-surface-elevated border border-surface-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-ops-500">
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="feature">New Feature</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createAnnouncement} disabled={saving || !form.title.trim() || !form.body.trim()} className="px-5 py-2 bg-ops-500 hover:bg-ops-600 text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-40">{saving ? 'Saving…' : 'Save as Draft'}</button>
              <button onClick={() => { setCreating(false); setForm(BLANK) }} className="px-5 py-2 bg-surface-elevated border border-surface-border text-text-secondary text-sm rounded-xl hover:text-text-primary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-8 py-4 max-w-3xl space-y-3">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : announcements.length === 0 ? (
          <p className="text-text-muted text-sm">No announcements yet.</p>
        ) : (
          announcements.map(ann => (
            <div key={ann.id} className={`bg-surface-card border rounded-xl p-5 ${ann.status === 'sent' ? 'border-surface-border' : 'border-ops-800/20'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-text-primary">{ann.title}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${TYPE_COLORS[ann.type] ?? ''}`}>{ann.type}</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border capitalize ${STATUS_COLORS[ann.status] ?? ''}`}>{ann.status}</span>
                    <span className="text-[10px] text-text-muted capitalize">→ {ann.target.replace('_',' ')}</span>
                  </div>
                  <p className="text-xs text-text-secondary mt-1.5 line-clamp-2">{ann.body}</p>
                  <p className="text-[10px] text-text-muted mt-1.5">
                    Created by {ann.created_by ?? 'admin'} · {formatDate(ann.created_at)}
                    {ann.sent_at ? ` · Sent ${formatDate(ann.sent_at)} to ${ann.sent_count} users` : ''}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {ann.status === 'draft' && (
                    <button onClick={() => void sendAnnouncement(ann)} disabled={sending === ann.id}
                      className="px-3 py-1.5 bg-ops-500/20 border border-ops-800/30 text-ops-400 text-xs font-semibold rounded-lg hover:bg-ops-500/30 transition-colors disabled:opacity-40">
                      {sending === ann.id ? 'Sending…' : '📣 Send Now'}
                    </button>
                  )}
                  {ann.status === 'draft' && (
                    <button onClick={() => void deleteAnnouncement(ann.id)} className="px-3 py-1.5 bg-red-900/10 border border-red-800/20 text-red-400 text-xs font-semibold rounded-lg hover:bg-red-900/20 transition-colors">Delete</button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

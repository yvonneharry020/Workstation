'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

interface Thread {
  id: string
  created_at: string
  updated_at: string
  user_id: string
  user_name: string
  user_email: string
  user_type: 'candidate' | 'company'
  subject: string
  status: 'open' | 'in_progress' | 'resolved'
  assigned_to: string | null
  last_message: string | null
  last_message_at: string
  unread_admin: number
  unread_user: number
}

interface Message {
  id: string
  created_at: string
  thread_id: string
  sender_id: string | null
  sender_type: 'user' | 'admin'
  sender_name: string
  content: string
  is_read: boolean
  attachment_url: string | null
  attachment_type: 'image' | 'file' | null
  attachment_name: string | null
}

const STATUS_STYLES = {
  open:        'bg-error/15 text-error border-error/30',
  in_progress: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
  resolved:    'bg-trust-high-bg text-trust-high border-trust-high-border',
}

const USER_TYPE_BADGE = {
  candidate: { label: 'Candidate', color: '#0DD4C3' },
  company:   { label: 'Company',   color: '#F59E0B' },
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

function formatMsgTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export default function OpsLiveChatPage() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'open' | 'resolved'>('all')
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const scrollRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const selected = threads.find(t => t.id === selectedId)

  const fetchThreads = useCallback(async () => {
    const { data } = await supabase
      .from('chat_threads')
      .select('*')
      .order('last_message_at', { ascending: false })
    if (data) setThreads(data as Thread[])
    setLoading(false)
  }, [supabase])

  const fetchMessages = useCallback(async (threadId: string) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as Message[])
    await supabase.from('chat_messages').update({ is_read: true }).eq('thread_id', threadId).eq('sender_type', 'user').eq('is_read', false)
    await supabase.from('chat_threads').update({ unread_admin: 0 }).eq('id', threadId)
    setThreads(prev => prev.map(t => t.id === threadId ? { ...t, unread_admin: 0 } : t))
  }, [supabase])

  useEffect(() => { void fetchThreads() }, [fetchThreads])
  useEffect(() => { if (selectedId) void fetchMessages(selectedId) }, [selectedId, fetchMessages])
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const ch = supabase.channel('ops-chat-threads')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chat_threads' }, () => void fetchThreads())
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, fetchThreads])

  useEffect(() => {
    if (!selectedId) return
    const ch = supabase.channel(`ops-chat-msgs-${selectedId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `thread_id=eq.${selectedId}` }, (payload) => {
        setMessages(prev => [...prev, payload.new as Message])
        void supabase.from('chat_messages').update({ is_read: true }).eq('id', (payload.new as Message).id).eq('sender_type', 'user')
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase, selectedId])

  async function handleSendReply() {
    if (!reply.trim() || !selectedId || sending) return
    setSending(true)
    const content = reply.trim()
    setReply('')
    const { error } = await supabase.from('chat_messages').insert({
      thread_id: selectedId,
      sender_type: 'admin',
      sender_name: 'Support Team',
      content,
      is_read: false,
    })
    if (!error) {
      await supabase.from('chat_threads').update({
        last_message: content,
        last_message_at: new Date().toISOString(),
        status: 'in_progress',
        assigned_to: 'support@workstation.ng',
        unread_user: (selected?.unread_user ?? 0) + 1,
      }).eq('id', selectedId)
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('audit_logs').insert({
        event: 'admin.support_reply_sent',
        actor_email: user?.email ?? null,
        actor_id: user?.id ?? null,
        actor_type: 'staff',
        target_id: selectedId,
        target_type: 'chat_thread',
        target_name: selected?.user_name,
        severity: 'info',
        app: 'admin_panel',
        metadata: { thread_id: selectedId, user_type: selected?.user_type },
      })
    }
    setSending(false)
  }

  async function handleResolve() {
    if (!selectedId) return
    await supabase.from('chat_threads').update({ status: 'resolved' }).eq('id', selectedId)
    setThreads(prev => prev.map(t => t.id === selectedId ? { ...t, status: 'resolved' } : t))
  }

  const filteredThreads = threads.filter(t => {
    if (statusFilter === 'unread' && t.unread_admin <= 0) return false
    if (statusFilter === 'open' && t.status !== 'open' && t.status !== 'in_progress') return false
    if (statusFilter === 'resolved' && t.status !== 'resolved') return false
    if (search) {
      const q = search.toLowerCase()
      return t.user_name.toLowerCase().includes(q) || t.user_email.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q)
    }
    return true
  })

  const totalUnread = threads.reduce((sum, t) => sum + t.unread_admin, 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="Live Chat"
        subtitle={`${threads.filter(t => t.status !== 'resolved').length} active · ${totalUnread > 0 ? `${totalUnread} unread` : 'all read'}`}
      />

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        <div className="w-[380px] flex-shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border space-y-2.5">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations…"
                className="w-full bg-surface-elevated border border-surface-border rounded-lg pl-8 pr-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none" />
            </div>
            <div className="flex gap-1.5">
              {([
                { key: 'all', label: 'All' },
                { key: 'unread', label: 'Unread' },
                { key: 'open', label: 'Open' },
                { key: 'resolved', label: 'Resolved' },
              ] as const).map(({ key, label }) => (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${statusFilter === key ? 'bg-ops-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'}`}>
                  {label}
                  {key === 'unread' && totalUnread > 0 && (
                    <span className={`ml-1.5 text-[9px] font-bold rounded-full px-1 py-0.5 ${statusFilter === 'unread' ? 'bg-white/20 text-white' : 'bg-error/20 text-error'}`}>{totalUnread}</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-surface-border/50">
            {loading ? (
              <div className="py-12 text-center text-text-muted text-sm">Loading threads…</div>
            ) : filteredThreads.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-text-muted text-sm mb-1">No conversations yet</p>
                <p className="text-text-muted text-xs">Messages from users will appear here.</p>
              </div>
            ) : filteredThreads.map(t => {
              const typeMeta = USER_TYPE_BADGE[t.user_type]
              const isActive = selectedId === t.id
              return (
                <button key={t.id} onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left px-4 py-3.5 transition-colors ${isActive ? 'bg-ops-900/40 border-l-2 border-l-ops-500' : 'hover:bg-surface-elevated/40 border-l-2 border-l-transparent'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${typeMeta.color}20`, color: typeMeta.color }}>{typeMeta.label}</span>
                      <p className="text-xs font-semibold text-text-primary truncate">{t.user_name}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {t.unread_admin > 0 && (
                        <span className="text-[9px] font-bold bg-error text-white rounded-full w-4 h-4 flex items-center justify-center">{t.unread_admin}</span>
                      )}
                      <span className="text-[9px] text-text-muted font-mono">{relativeTime(t.last_message_at)}</span>
                    </div>
                  </div>
                  <p className="text-[11px] font-semibold text-text-secondary mb-1">{t.subject}</p>
                  <p className="text-[11px] text-text-muted truncate">{t.last_message ?? 'No messages yet'}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${STATUS_STYLES[t.status]}`}>{t.status === 'in_progress' ? 'Active' : t.status}</span>
                    {t.assigned_to && <span className="text-[9px] text-ops-400 truncate">{t.assigned_to}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-text-muted">
              <div className="text-center">
                <svg className="w-12 h-12 mx-auto mb-3 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <p className="text-sm">Select a conversation</p>
              </div>
            </div>
          ) : (
            <>
              <div className="px-6 py-4 border-b border-surface-border flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-semibold text-text-primary">{selected.user_name}</p>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: `${USER_TYPE_BADGE[selected.user_type].color}20`, color: USER_TYPE_BADGE[selected.user_type].color }}>
                      {USER_TYPE_BADGE[selected.user_type].label}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">{selected.user_email} · {selected.subject}</p>
                </div>
                <div className="flex items-center gap-3">
                  {selected.status !== 'resolved' && (
                    <span className={`flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${STATUS_STYLES[selected.status]}`}>
                      {selected.status === 'in_progress' && <span className="w-1.5 h-1.5 rounded-full bg-trust-mid animate-pulse inline-block" />}
                      {selected.status === 'in_progress' ? 'Active' : 'Open'}
                    </span>
                  )}
                  {selected.status !== 'resolved' && (
                    <button onClick={handleResolve} className="px-3 py-1.5 rounded-lg bg-trust-high-bg text-trust-high border border-trust-high-border text-xs font-semibold hover:bg-green-900/30 transition-colors">
                      Resolve
                    </button>
                  )}
                  {selected.status === 'resolved' && (
                    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-2 py-0.5 rounded font-mono ${STATUS_STYLES.resolved}`}>Resolved</span>
                  )}
                </div>
              </div>

              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
                {messages.length === 0 && <div className="text-center text-text-muted text-sm py-8">No messages yet. Send the first reply.</div>}
                {messages.map(msg => {
                  const isAdmin = msg.sender_type === 'admin'
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] ${isAdmin ? 'items-end' : 'items-start'} flex flex-col`}>
                        {msg.attachment_type === 'image' && msg.attachment_url ? (
                          <div className="flex flex-col gap-1.5">
                            <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="block">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={msg.attachment_url} alt={msg.attachment_name ?? 'Attachment'} className={`rounded-xl max-w-[260px] max-h-[200px] object-cover border ${isAdmin ? 'border-ops-400/30' : 'border-surface-border'}`} />
                              <span className={`text-[10px] mt-0.5 block ${isAdmin ? 'text-white/50' : 'text-text-muted'}`}>Click to open</span>
                            </a>
                          </div>
                        ) : msg.attachment_type === 'file' && msg.attachment_url ? (
                          <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer"
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-opacity hover:opacity-80 ${isAdmin ? 'bg-ops-600 border-ops-400/30' : 'bg-surface-elevated border-surface-border'}`}>
                            <svg className={`w-5 h-5 flex-shrink-0 ${isAdmin ? 'text-white/70' : 'text-text-muted'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                            <span className={`text-sm font-medium truncate max-w-[160px] ${isAdmin ? 'text-white' : 'text-text-primary'}`}>{msg.attachment_name ?? 'File'}</span>
                            <svg className={`w-4 h-4 flex-shrink-0 ${isAdmin ? 'text-white/60' : 'text-ops-400'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                          </a>
                        ) : (
                          <div className={`px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${isAdmin ? 'bg-ops-500 text-white rounded-br-sm' : 'bg-surface-elevated border border-surface-border text-text-primary rounded-bl-sm'}`}>
                            {msg.content}
                          </div>
                        )}
                        <div className={`flex items-center gap-1.5 mt-1 ${isAdmin ? 'flex-row-reverse' : ''}`}>
                          <span className="text-[10px] text-text-muted font-semibold">{msg.sender_name}</span>
                          <span className="text-[10px] text-text-muted font-mono">{formatMsgTime(msg.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>

              {selected.status !== 'resolved' ? (
                <div className="px-6 py-4 border-t border-surface-border">
                  <div className="flex gap-3">
                    <textarea
                      value={reply}
                      onChange={e => setReply(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSendReply() } }}
                      placeholder="Type a reply… (Enter to send, Shift+Enter for new line)"
                      rows={2}
                      className="flex-1 bg-surface-elevated border border-surface-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder-text-muted focus:border-ops-500 focus:outline-none resize-none"
                    />
                    <button onClick={handleSendReply} disabled={!reply.trim() || sending}
                      className="px-4 rounded-xl bg-ops-500 hover:bg-ops-600 disabled:opacity-40 text-white text-sm font-semibold transition-colors flex items-center gap-2 self-end pb-3 pt-3">
                      {sending ? (
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                      )}
                      Send
                    </button>
                  </div>
                </div>
              ) : (
                <div className="px-6 py-4 border-t border-surface-border text-center">
                  <p className="text-sm text-trust-high">This conversation has been resolved.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

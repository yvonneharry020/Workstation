'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  created_at: string
  sender_id: string
  sender_name: string
  sender_email: string
  sender_department: string | null
  body: string
  mentions: string[]
}

interface CurrentUser {
  id: string
  name: string
  email: string
  department: string | null
}

interface MentionOption {
  display: string
  insert: string
  type: 'dept' | 'staff'
  sub: string
}

const DEPT_OPTIONS: MentionOption[] = [
  { display: 'Everyone',   insert: 'Everyone',   type: 'dept', sub: 'Notify all staff' },
  { display: 'Technical',  insert: 'Technical',  type: 'dept', sub: 'Tech team' },
  { display: 'Finance',    insert: 'Finance',    type: 'dept', sub: 'Finance team' },
  { display: 'Management', insert: 'Management', type: 'dept', sub: 'Management team' },
  { display: 'Admin',      insert: 'Admin',      type: 'dept', sub: 'Super admin' },
]

const DEPT_BADGE: Record<string, string> = {
  technical:  'bg-tech-500/15 text-tech-400',
  finance:    'bg-finance-500/15 text-finance-400',
  management: 'bg-ops-500/15 text-ops-400',
  admin:      'bg-admin-500/15 text-admin-400',
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(n => n[0] ?? '').join('').toUpperCase() || '?'
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', hour12: true })
}

function fmtDateLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })
}

function renderBody(body: string) {
  const parts = body.split(/(@\w+)/g)
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <span key={i} className="text-admin-300 font-semibold bg-admin-500/10 px-0.5 rounded-sm">{part}</span>
      : <span key={i}>{part}</span>
  )
}

function detectMention(value: string, cursor: number): { query: string; start: number } | null {
  let i = cursor
  while (i > 0 && value[i - 1] !== ' ' && value[i - 1] !== '\n') i--
  const word = value.slice(i, cursor)
  if (word.startsWith('@')) return { query: word.slice(1).toLowerCase(), start: i }
  return null
}

function extractName(row: Record<string, unknown>, fallback: string): string {
  return (
    (row.name as string | null) ??
    (row.first_name ? `${row.first_name as string} ${(row.last_name as string) ?? ''}`.trim() : null) ??
    (row.full_name as string | null) ??
    fallback
  )
}

export default function StaffCommsChannel() {
  const supabase = createClient()
  const [messages, setMessages]       = useState<Message[]>([])
  const [loading, setLoading]         = useState(true)
  const [body, setBody]               = useState('')
  const [sending, setSending]         = useState(false)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)
  const [allMentions, setAllMentions] = useState<MentionOption[]>(DEPT_OPTIONS)
  const [mentionTrigger, setMentionTrigger] = useState<{ query: string; start: number } | null>(null)
  const [mentionIdx, setMentionIdx]   = useState(0)
  const bottomRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Identify current user + build mentions list
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: me } = await supabase
        .from('staff_members')
        .select('*')
        .eq('email', user.email!)
        .maybeSingle()

      const myName = me
        ? extractName(me as Record<string, unknown>, user.email?.split('@')[0] ?? 'Staff')
        : (user.user_metadata?.full_name as string | null)
          ?? user.email?.split('@')[0]
          ?? 'Staff'

      const myDept = (me as Record<string, unknown> | null)?.department as string | null
        ?? (user.email === 'yvonne2okis@gmail.com' ? 'admin' : null)

      setCurrentUser({ id: user.id, name: myName, email: user.email ?? '', department: myDept })

      const { data: staffList } = await supabase
        .from('staff_members')
        .select('*')
        .eq('is_active', true)

      if (staffList?.length) {
        const staffOpts: MentionOption[] = (staffList as Record<string, unknown>[]).map(s => {
          const fullName = extractName(s, (s.email as string).split('@')[0])
          const firstName = fullName.split(' ')[0]
          return {
            display: fullName,
            insert: firstName,
            type: 'staff' as const,
            sub: (s.department as string | null) ?? (s.email as string),
          }
        })
        setAllMentions([...DEPT_OPTIONS, ...staffOpts])
      }
    }
    void init()
  }, [supabase])

  // Load message history
  const loadMessages = useCallback(async () => {
    const { data } = await supabase
      .from('staff_messages')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(300)
    if (data) setMessages(data as Message[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void loadMessages() }, [loadMessages])

  // Real-time subscription — deduplicate against messages already added optimistically
  useEffect(() => {
    const ch = supabase.channel('staff-general-channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'staff_messages' }, (p) => {
        setMessages(prev => {
          const incoming = p.new as Message
          if (prev.some(m => m.id === incoming.id)) return prev
          return [...prev, incoming]
        })
      })
      .subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [supabase])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'instant' as ScrollBehavior : 'smooth' })
  }, [messages, loading])

  // Auto-grow textarea
  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 128)}px`
  }, [body])

  const filteredMentions = mentionTrigger
    ? allMentions.filter(m =>
        m.insert.toLowerCase().startsWith(mentionTrigger.query) ||
        m.display.toLowerCase().includes(mentionTrigger.query)
      ).slice(0, 8)
    : []

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value
    const cursor = e.target.selectionStart ?? val.length
    setBody(val)
    const trigger = detectMention(val, cursor)
    setMentionTrigger(trigger)
    setMentionIdx(0)
  }

  function applyMention(option: MentionOption) {
    if (!mentionTrigger) return
    const wordLen = 1 + mentionTrigger.query.length // "@" + typed chars
    const before  = body.slice(0, mentionTrigger.start)
    const after   = body.slice(mentionTrigger.start + wordLen)
    setBody(`${before}@${option.insert} ${after}`)
    setMentionTrigger(null)
    setMentionIdx(0)
    setTimeout(() => textareaRef.current?.focus(), 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionTrigger && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredMentions.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(filteredMentions[mentionIdx]); return }
      if (e.key === 'Escape')    { setMentionTrigger(null); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() }
  }

  async function handleSend() {
    if (!body.trim() || !currentUser || sending) return
    setSending(true)
    const mentions = (body.match(/@(\w+)/g) ?? []).map(m => m.slice(1))
    const { data: newMsg } = await supabase.from('staff_messages').insert({
      sender_id:         currentUser.id,
      sender_name:       currentUser.name,
      sender_email:      currentUser.email,
      sender_department: currentUser.department,
      body:              body.trim(),
      mentions,
    }).select().single()

    // Immediately add to local state so the sender sees it without waiting for real-time
    if (newMsg) {
      setMessages(prev => [...prev, newMsg as Message])
    }

    setBody('')
    setMentionTrigger(null)
    setSending(false)
  }

  // Group messages by date for separators
  type Group = { date: string; msgs: Message[] }
  const groups = messages.reduce<Group[]>((acc, msg) => {
    const date = fmtDateLabel(msg.created_at)
    const last = acc[acc.length - 1]
    if (last?.date === date) last.msgs.push(msg)
    else acc.push({ date, msgs: [msg] })
    return acc
  }, [])

  return (
    <div className="flex flex-col h-full min-h-0">
      <TopBar title="# general" subtitle="Staff Communications — all departments" />

      {/* Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-text-muted text-sm">Loading…</div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center gap-2">
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-text-muted"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="text-sm text-text-muted">No messages yet — say hello to the team</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.date}>
              {/* Date separator */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-surface-border" />
                <span className="text-[10px] font-semibold text-text-muted uppercase tracking-widest">{group.date}</span>
                <div className="flex-1 h-px bg-surface-border" />
              </div>

              <div className="space-y-0.5">
                {group.msgs.map((msg, idx) => {
                  const deptKey  = msg.sender_department?.toLowerCase() ?? ''
                  const badge    = DEPT_BADGE[deptKey] ?? 'bg-surface-elevated text-text-secondary'
                  const isMine   = msg.sender_id === currentUser?.id
                  const prevSame = idx > 0 && group.msgs[idx - 1].sender_id === msg.sender_id
                  const isMentioned = currentUser && (
                    msg.mentions.includes(currentUser.name.split(' ')[0]) ||
                    msg.mentions.includes('Everyone') ||
                    (currentUser.department && msg.mentions.includes(
                      currentUser.department.charAt(0).toUpperCase() + currentUser.department.slice(1)
                    ))
                  )

                  return (
                    <div key={msg.id}
                      className={`flex gap-3 px-3 py-1.5 rounded-xl transition-colors group
                        ${isMine ? 'flex-row-reverse' : ''}
                        ${isMentioned ? 'bg-admin-500/5 border border-admin-500/20' : 'hover:bg-surface-elevated/40'}`}>

                      {/* Avatar — only show on first message of a run */}
                      <div className="w-8 flex-shrink-0 flex items-start pt-0.5">
                        {!prevSame ? (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ${badge}`}>
                            {initials(msg.sender_name)}
                          </div>
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>

                      <div className={`flex-1 min-w-0 flex flex-col ${isMine ? 'items-end' : ''}`}>
                        {!prevSame && (
                          <div className={`flex items-center gap-2 mb-0.5 ${isMine ? 'flex-row-reverse' : ''}`}>
                            <span className="text-xs font-semibold text-text-primary">{msg.sender_name}</span>
                            {msg.sender_department && (
                              <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-full ${badge}`}>
                                {msg.sender_department}
                              </span>
                            )}
                          </div>
                        )}
                        <div className={`flex items-end gap-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                          <p className="text-sm text-text-primary leading-relaxed break-words max-w-prose">
                            {renderBody(msg.body)}
                          </p>
                          <span className="text-[9px] text-text-muted opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mb-0.5">
                            {fmtTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="border-t border-surface-border px-4 py-3">
        <div className="relative">
          {/* @ Mention dropdown */}
          {mentionTrigger && filteredMentions.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-72 bg-surface-card border border-surface-border rounded-xl shadow-xl overflow-hidden z-20">
              <div className="px-3 py-1.5 border-b border-surface-border/60 bg-surface-elevated/50">
                <p className="text-[9px] font-bold text-text-muted uppercase tracking-widest">Mention</p>
              </div>
              {filteredMentions.map((opt, i) => (
                <button key={`${opt.type}-${opt.insert}`} onClick={() => applyMention(opt)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors border-b border-surface-border/30 last:border-0 ${
                    i === mentionIdx ? 'bg-admin-900/30' : 'hover:bg-surface-elevated'
                  }`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                    opt.type === 'dept' ? 'bg-admin-500/20 text-admin-400' : 'bg-surface-elevated text-text-secondary'
                  }`}>
                    {opt.type === 'dept' ? '#' : initials(opt.display)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary leading-none">@{opt.insert}</p>
                    <p className="text-[10px] text-text-muted truncate mt-0.5">{opt.sub}</p>
                  </div>
                  {opt.type === 'dept' && (
                    <span className="ml-auto text-[9px] text-admin-400 font-bold uppercase bg-admin-500/10 px-1.5 py-0.5 rounded flex-shrink-0">dept</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex items-end gap-2 bg-surface-elevated border border-surface-border rounded-xl px-3 py-2.5 focus-within:border-admin-500/50 transition-colors">
            <textarea
              ref={textareaRef}
              value={body}
              onChange={handleBodyChange}
              onKeyDown={handleKeyDown}
              placeholder="Message #general  ·  Type @ to mention someone"
              rows={1}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none resize-none overflow-y-auto leading-relaxed"
              style={{ minHeight: '22px', maxHeight: '128px' }}
            />
            <button onClick={() => void handleSend()} disabled={!body.trim() || sending || !currentUser}
              className="w-8 h-8 rounded-lg bg-admin-500 hover:bg-admin-600 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center transition-colors flex-shrink-0 self-end">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="white" stroke="white" strokeWidth="0" className="rotate-45">
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
          <p className="text-[10px] text-text-muted mt-1.5 px-1">
            <kbd className="bg-surface-elevated border border-surface-border rounded px-1 text-[9px]">Enter</kbd> send ·
            <kbd className="bg-surface-elevated border border-surface-border rounded px-1 text-[9px] mx-1">Shift+Enter</kbd> new line ·
            <kbd className="bg-surface-elevated border border-surface-border rounded px-1 text-[9px]">@</kbd> mention
          </p>
        </div>
      </div>
    </div>
  )
}

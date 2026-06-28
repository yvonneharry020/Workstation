'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

interface FlaggedItem {
  id: string
  content_type: string
  content_id: string
  reason: string
  reported_by: string | null
  status: string
  severity: string
  created_at: string
  updated_at: string
  reviewer_notes: string | null
}

type SeverityFilter = 'all' | 'critical' | 'high' | 'medium' | 'low'
type StatusFilter = 'all' | 'pending' | 'reviewed' | 'resolved' | 'escalated'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

const SEVERITY_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  critical: { text: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)' },
  high:     { text: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.3)' },
  medium:   { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  low:      { text: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
}

const STATUS_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  pending:   { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)', border: 'rgba(251,191,36,0.3)' },
  reviewed:  { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)', border: 'rgba(56,189,248,0.3)' },
  resolved:  { text: '#34D399', bg: 'rgba(52,211,153,0.1)', border: 'rgba(52,211,153,0.3)' },
  escalated: { text: '#F87171', bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)' },
}

function SeverityPill({ value }: { value: string }) {
  const s = SEVERITY_STYLE[value] ?? SEVERITY_STYLE['low']
  return <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase' }}>{value}</span>
}

function StatusPill({ value }: { value: string }) {
  const s = STATUS_STYLE[value] ?? STATUS_STYLE['pending']
  return <span style={{ color: s.text, backgroundColor: s.bg, border: `1px solid ${s.border}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, fontFamily: 'monospace', textTransform: 'uppercase' }}>{value}</span>
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function FlaggedContentPage() {
  const supabase = createClient()
  const [items, setItems] = useState<FlaggedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [noteItem, setNoteItem] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('flagged_content')
      .select('*')
      .order('created_at', { ascending: false })
    if (!error) setItems((data ?? []) as FlaggedItem[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function updateStatus(id: string, status: 'resolved' | 'escalated' | 'reviewed') {
    setActing(id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, status } : i))
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('flagged_content').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('audit_logs').insert({
      event: `admin.flagged_content_${status}`,
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'flagged_content',
      severity: status === 'escalated' ? 'warning' : 'info',
      app: 'admin_panel',
    })
    setActing(null)
  }

  async function saveNote(id: string) {
    await supabase.from('flagged_content').update({ reviewer_notes: noteText, status: 'reviewed', updated_at: new Date().toISOString() }).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, reviewer_notes: noteText, status: 'reviewed' } : i))
    setNoteItem(null)
    setNoteText('')
  }

  async function bulkResolve() {
    if (selected.size === 0) return
    const ids = Array.from(selected)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('flagged_content').update({ status: 'resolved', updated_at: new Date().toISOString() }).in('id', ids)
    for (const id of ids) {
      await supabase.from('audit_logs').insert({ event: 'admin.flagged_content_resolved', actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: id, target_type: 'flagged_content', severity: 'info', app: 'admin_panel' })
    }
    setItems(prev => prev.map(i => ids.includes(i.id) ? { ...i, status: 'resolved' } : i))
    setSelected(new Set())
  }

  const filtered = items.filter(i => {
    const matchSev = severityFilter === 'all' || i.severity === severityFilter
    const matchStat = statusFilter === 'all' || i.status === statusFilter
    return matchSev && matchStat
  })

  const total = items.length
  const critical = items.filter(i => i.severity === 'critical').length
  const pendingCount = items.filter(i => i.status === 'pending').length
  const resolvedCount = items.filter(i => i.status === 'resolved').length

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allSelected = filtered.length > 0 && filtered.every(i => selected.has(i.id))
  const toggleAll = () => {
    if (allSelected) { setSelected(new Set()) }
    else { setSelected(new Set(filtered.map(i => i.id))) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <TopBar title="Flagged Content" subtitle={`${pendingCount} pending review · ${total} total flagged items`} />

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Total Flagged', value: total, color: 'var(--tx-1)' },
            { label: 'Critical', value: critical, color: '#EF4444' },
            { label: 'Pending Review', value: pendingCount, color: '#FBBF24' },
            { label: 'Resolved', value: resolvedCount, color: '#34D399' },
          ].map(stat => (
            <div key={stat.label} style={{ ...CARD_STYLE, padding: '20px 24px' }}>
              <p style={{ fontSize: 28, fontWeight: 700, color: stat.color, margin: 0, fontFamily: 'var(--font-display)' }}>{stat.value}</p>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Severity:</span>
          {(['all', 'critical', 'high', 'medium', 'low'] as SeverityFilter[]).map(s => (
            <button key={s} onClick={() => setSeverityFilter(s)} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', textTransform: 'capitalize',
              backgroundColor: severityFilter === s ? '#6366F1' : 'var(--bg-elevated)',
              color: severityFilter === s ? '#fff' : 'var(--tx-2)',
            }}>{s}</button>
          ))}
          <div style={{ width: 1, height: 24, backgroundColor: 'var(--border)', margin: '0 8px' }} />
          <span style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Status:</span>
          {(['all', 'pending', 'reviewed', 'resolved', 'escalated'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} style={{
              padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border)', textTransform: 'capitalize',
              backgroundColor: statusFilter === s ? '#6366F1' : 'var(--bg-elevated)',
              color: statusFilter === s ? '#fff' : 'var(--tx-2)',
            }}>{s}</button>
          ))}
          {selected.size > 0 && (
            <button onClick={bulkResolve} style={{ marginLeft: 'auto', padding: '7px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399' }}>
              Bulk Resolve ({selected.size})
            </button>
          )}
        </div>

        {/* Table */}
        <div style={{ ...CARD_STYLE, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '11px 20px', textAlign: 'left' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                </th>
                {['Type', 'Content ID', 'Reason', 'Severity', 'Status', 'Reported', 'Actions'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '11px 20px', fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}><td colSpan={8} style={{ padding: '16px 20px' }}><div style={{ height: 14, backgroundColor: 'var(--bg-elevated)', borderRadius: 6, width: '70%' }} /></td></tr>
              ))}
              {!loading && filtered.map(item => (
                <>
                  <tr key={item.id} style={{ borderBottom: noteItem === item.id ? 'none' : '1px solid var(--border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                    <td style={{ padding: '14px 20px' }}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} style={{ cursor: 'pointer' }} />
                    </td>
                    <td style={{ padding: '14px 20px' }}>
                      <span style={{ fontSize: 11, backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)', padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {item.content_type.replace('_', ' ')}
                      </span>
                    </td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{item.content_id.slice(0, 12)}…</td>
                    <td style={{ padding: '14px 20px', maxWidth: 240 }}>
                      <span style={{ fontSize: 12, color: 'var(--tx-2)', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.reason}</span>
                    </td>
                    <td style={{ padding: '14px 20px' }}><SeverityPill value={item.severity} /></td>
                    <td style={{ padding: '14px 20px' }}><StatusPill value={item.status} /></td>
                    <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{formatDate(item.created_at)}</td>
                    <td style={{ padding: '14px 20px' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap' }}>
                        {item.status !== 'resolved' && (
                          <button onClick={() => updateStatus(item.id, 'resolved')} disabled={acting === item.id} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(52,211,153,0.15)', color: '#34D399', whiteSpace: 'nowrap', opacity: acting === item.id ? 0.6 : 1 }}>Resolve</button>
                        )}
                        {item.status !== 'escalated' && (
                          <button onClick={() => updateStatus(item.id, 'escalated')} disabled={acting === item.id} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', whiteSpace: 'nowrap', opacity: acting === item.id ? 0.6 : 1 }}>Escalate</button>
                        )}
                        <button onClick={() => { setNoteItem(noteItem === item.id ? null : item.id); setNoteText(item.reviewer_notes ?? '') }} style={{ padding: '4px 10px', borderRadius: 7, fontSize: 11, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', whiteSpace: 'nowrap' }}>Note</button>
                      </div>
                    </td>
                  </tr>
                  {noteItem === item.id && (
                    <tr key={`${item.id}-note`} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={8} style={{ padding: '0 20px 16px 56px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <textarea
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Add reviewer note..."
                            rows={2}
                            style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-1)', fontSize: 12, resize: 'none', outline: 'none', fontFamily: 'inherit' }}
                          />
                          <button onClick={() => saveNote(item.id)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: '#6366F1', color: '#fff' }}>Save</button>
                          <button onClick={() => setNoteItem(null)} style={{ padding: '8px 16px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)' }}>Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={8} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--tx-3)', fontSize: 13 }}>No flagged items matching current filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }
const CATEGORIES = ['HR Tips', 'Platform Guide', 'Verification Help', 'Payments', 'Technical']
type Audience = 'candidate' | 'company' | 'all'

interface KBArticle {
  id: string; title: string; content: string; category: string
  target_audience: Audience; is_published: boolean; view_count: number
  created_at: string; updated_at: string
}

const AUD_COLOR: Record<Audience, string> = { candidate: '#38BDF8', company: '#A78BFA', all: '#34D399' }

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

const EMPTY_FORM = { title: '', content: '', category: CATEGORIES[0], target_audience: 'all' as Audience, is_published: false }

export default function KnowledgeBasePage() {
  const supabase = createClient()
  const [articles, setArticles] = useState<KBArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [audFilter, setAudFilter] = useState<'all' | Audience>('all')
  const [showPanel, setShowPanel] = useState(false)
  const [editing, setEditing] = useState<KBArticle | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [acting, setActing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('knowledge_base').select('*').order('created_at', { ascending: false })
    setArticles((data ?? []) as KBArticle[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function getActor() {
    const { data: { user } } = await supabase.auth.getUser(); return user
  }

  async function saveArticle() {
    if (!form.title.trim()) return
    setSaving(true)
    if (editing) {
      await supabase.from('knowledge_base').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editing.id)
    } else {
      await supabase.from('knowledge_base').insert({ ...form })
    }
    setSaving(false); setShowPanel(false); setEditing(null); setForm(EMPTY_FORM)
    void load()
  }

  async function togglePublish(a: KBArticle) {
    setActing(a.id)
    await supabase.from('knowledge_base').update({ is_published: !a.is_published, updated_at: new Date().toISOString() }).eq('id', a.id)
    const user = await getActor()
    await supabase.from('audit_logs').insert({ event: 'admin.kb_' + (a.is_published ? 'unpublished' : 'published'), actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: a.id, target_type: 'kb_article', severity: 'info', app: 'admin_panel' })
    setArticles(prev => prev.map(x => x.id === a.id ? { ...x, is_published: !x.is_published } : x))
    setActing(null)
  }

  async function deleteArticle(id: string) {
    setActing(id)
    await supabase.from('knowledge_base').delete().eq('id', id)
    const user = await getActor()
    await supabase.from('audit_logs').insert({ event: 'admin.kb_deleted', actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: id, target_type: 'kb_article', severity: 'warning', app: 'admin_panel' })
    setArticles(prev => prev.filter(a => a.id !== id))
    setConfirmDelete(null); setActing(null)
  }

  function openEdit(a: KBArticle) {
    setEditing(a)
    setForm({ title: a.title, content: a.content, category: a.category, target_audience: a.target_audience, is_published: a.is_published })
    setShowPanel(true)
  }

  const filtered = articles.filter(a => {
    if (catFilter !== 'all' && a.category !== catFilter) return false
    if (audFilter !== 'all' && a.target_audience !== audFilter && a.target_audience !== 'all') return false
    return true
  })

  const totalViews = articles.reduce((s, a) => s + a.view_count, 0)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Knowledge Base" subtitle="Manage FAQ articles and help documentation" />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Articles', value: articles.length, color: '#F59E0B' },
            { label: 'Published', value: articles.filter(a => a.is_published).length, color: '#34D399' },
            { label: 'Drafts', value: articles.filter(a => !a.is_published).length, color: '#9CA3AF' },
            { label: 'Total Views', value: totalViews.toLocaleString('en-NG'), color: '#38BDF8' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters + add */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${catFilter === c ? '#F59E0B' : 'var(--border)'}`, backgroundColor: catFilter === c ? 'rgba(245,158,11,0.1)' : 'transparent', color: catFilter === c ? '#F59E0B' : 'var(--tx-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{c === 'all' ? 'All' : c}</button>
          ))}
          <div style={{ marginLeft: 8, display: 'flex', gap: 8 }}>
            {(['all', 'candidate', 'company'] as const).map(a => (
              <button key={a} onClick={() => setAudFilter(a)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${audFilter === a ? '#A78BFA' : 'var(--border)'}`, backgroundColor: audFilter === a ? 'rgba(167,139,250,0.1)' : 'transparent', color: audFilter === a ? '#A78BFA' : 'var(--tx-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>{a}</button>
            ))}
          </div>
          <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setShowPanel(true) }} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Article</button>
        </div>

        {/* Article list */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>No articles found</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Title', 'Category', 'Audience', 'Views', 'Status', 'Created', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 16px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--tx-1)', fontWeight: 600, maxWidth: 220 }}>{a.title}</td>
                    <td style={{ padding: '10px 16px' }}><span style={{ backgroundColor: 'rgba(99,102,241,0.1)', color: '#818CF8', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{a.category}</span></td>
                    <td style={{ padding: '10px 16px' }}><span style={{ color: AUD_COLOR[a.target_audience], backgroundColor: `${AUD_COLOR[a.target_audience]}18`, border: `1px solid ${AUD_COLOR[a.target_audience]}40`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 600, textTransform: 'capitalize' }}>{a.target_audience}</span></td>
                    <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--tx-3)' }}>{a.view_count.toLocaleString()}</td>
                    <td style={{ padding: '10px 16px' }}><span style={{ color: a.is_published ? '#34D399' : '#9CA3AF', backgroundColor: a.is_published ? 'rgba(52,211,153,0.1)' : 'rgba(156,163,175,0.1)', border: `1px solid ${a.is_published ? 'rgba(52,211,153,0.3)' : 'rgba(156,163,175,0.3)'}`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{a.is_published ? 'Published' : 'Draft'}</span></td>
                    <td style={{ padding: '10px 16px', fontSize: 11, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{fmtDate(a.created_at)}</td>
                    <td style={{ padding: '10px 16px' }}>
                      {confirmDelete === a.id ? (
                        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                          <button onClick={() => void deleteArticle(a.id)} disabled={acting === a.id} style={{ padding: '3px 8px', borderRadius: 5, backgroundColor: '#F87171', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Confirm</button>
                          <button onClick={() => setConfirmDelete(null)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => openEdit(a)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-2)', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Edit</button>
                          <button onClick={() => void togglePublish(a)} disabled={acting === a.id} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${a.is_published ? 'rgba(156,163,175,0.4)' : 'rgba(52,211,153,0.4)'}`, backgroundColor: a.is_published ? 'rgba(156,163,175,0.08)' : 'rgba(52,211,153,0.08)', color: a.is_published ? '#9CA3AF' : '#34D399', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{a.is_published ? 'Unpublish' : 'Publish'}</button>
                          <button onClick={() => setConfirmDelete(a.id)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Panel */}
        {showPanel && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 480, height: '100%', backgroundColor: 'var(--bg-surface)', padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>{editing ? 'Edit Article' : 'New Article'}</h3>
                <button onClick={() => { setShowPanel(false); setEditing(null) }} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[{ label: 'Title', key: 'title', type: 'text' }].map(f => (
                  <div key={f.key}>
                    <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</p>
                    <input value={(form as Record<string, unknown>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Content</p>
                  <textarea value={form.content} onChange={e => setForm(p => ({ ...p, content: e.target.value }))} rows={6} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Category</p>
                  <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Audience</p>
                  <select value={form.target_audience} onChange={e => setForm(p => ({ ...p, target_audience: e.target.value as Audience }))} style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}>
                    <option value="all">All Users</option>
                    <option value="candidate">Candidates</option>
                    <option value="company">Companies</option>
                  </select>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_published} onChange={e => setForm(p => ({ ...p, is_published: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#34D399' }} />
                  <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>Publish immediately</span>
                </label>
                <button onClick={() => void saveArticle()} disabled={saving} style={{ padding: '10px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Saving…' : editing ? 'Update Article' : 'Create Article'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

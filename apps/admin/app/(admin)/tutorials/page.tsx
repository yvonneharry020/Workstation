'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }
const CATEGORIES = ['Getting Started', 'Verification', 'Job Search', 'Employer Tools', 'Payments']
type Audience = 'candidate' | 'company' | 'all'

interface Tutorial {
  id: string; title: string; description: string | null; video_url: string | null
  thumbnail_url: string | null; target_audience: Audience; step_order: number
  is_active: boolean; category: string; created_at: string
}

const AUD_COLOR: Record<Audience, string> = { candidate: '#38BDF8', company: '#A78BFA', all: '#34D399' }
const EMPTY = { title: '', description: '', video_url: '', thumbnail_url: '', target_audience: 'all' as Audience, step_order: 1, is_active: true, category: CATEGORIES[0] }

export default function TutorialsPage() {
  const supabase = createClient()
  const [tutorials, setTutorials] = useState<Tutorial[]>([])
  const [loading, setLoading] = useState(true)
  const [catFilter, setCatFilter] = useState('all')
  const [showPanel, setShowPanel] = useState(false)
  const [form, setForm] = useState({ ...EMPTY })
  const [saving, setSaving] = useState(false)
  const [acting, setActing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('tutorials').select('*').order('step_order', { ascending: true })
    setTutorials((data ?? []) as Tutorial[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function getActor() {
    const { data: { user } } = await supabase.auth.getUser(); return user
  }

  async function saveTutorial() {
    if (!form.title.trim()) return
    setSaving(true)
    await supabase.from('tutorials').insert({ ...form, description: form.description || null, video_url: form.video_url || null, thumbnail_url: form.thumbnail_url || null })
    setSaving(false); setShowPanel(false); setForm({ ...EMPTY }); void load()
  }

  async function toggleActive(t: Tutorial) {
    setActing(t.id)
    await supabase.from('tutorials').update({ is_active: !t.is_active }).eq('id', t.id)
    setTutorials(prev => prev.map(x => x.id === t.id ? { ...x, is_active: !x.is_active } : x))
    setActing(null)
  }

  async function reorder(t: Tutorial, dir: 'up' | 'down') {
    const idx = tutorials.indexOf(t)
    const swapIdx = dir === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= tutorials.length) return
    const swap = tutorials[swapIdx]
    await Promise.all([
      supabase.from('tutorials').update({ step_order: swap.step_order }).eq('id', t.id),
      supabase.from('tutorials').update({ step_order: t.step_order }).eq('id', swap.id),
    ])
    void load()
  }

  async function deleteTutorial(id: string) {
    setActing(id)
    await supabase.from('tutorials').delete().eq('id', id)
    const user = await getActor()
    await supabase.from('audit_logs').insert({ event: 'admin.tutorial_deleted', actor_email: user?.email ?? null, actor_id: user?.id ?? null, actor_type: 'admin', target_id: id, target_type: 'tutorial', severity: 'warning', app: 'admin_panel' })
    setTutorials(prev => prev.filter(x => x.id !== id))
    setConfirmDelete(null); setActing(null)
  }

  const filtered = catFilter === 'all' ? tutorials : tutorials.filter(t => t.category === catFilter)
  const active = tutorials.filter(t => t.is_active).length
  const byAud = { candidate: tutorials.filter(t => t.target_audience === 'candidate').length, company: tutorials.filter(t => t.target_audience === 'company').length, all: tutorials.filter(t => t.target_audience === 'all').length }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Tutorial Management" subtitle="Manage onboarding tutorial steps and videos shown to new users" />
      <div className="p-6 space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Tutorials', value: tutorials.length, color: '#F59E0B' },
            { label: 'Active', value: active, color: '#34D399' },
            { label: 'Candidate-only', value: byAud.candidate, color: '#38BDF8' },
            { label: 'Company-only', value: byAud.company, color: '#A78BFA' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {['all', ...CATEGORIES].map(c => (
            <button key={c} onClick={() => setCatFilter(c)} style={{ padding: '6px 12px', borderRadius: 8, border: `1px solid ${catFilter === c ? '#F59E0B' : 'var(--border)'}`, backgroundColor: catFilter === c ? 'rgba(245,158,11,0.1)' : 'transparent', color: catFilter === c ? '#F59E0B' : 'var(--tx-3)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{c === 'all' ? 'All' : c}</button>
          ))}
          <button onClick={() => { setShowPanel(true); setForm({ ...EMPTY, step_order: tutorials.length + 1 }) }} style={{ marginLeft: 'auto', padding: '8px 16px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ New Tutorial</button>
        </div>

        {loading ? (
          <div style={CARD} className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
        ) : filtered.length === 0 ? (
          <div style={CARD} className="p-10 text-center"><p style={{ color: 'var(--tx-3)' }}>No tutorials yet</p></div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map((t, idx) => (
              <div key={t.id} style={CARD} className="p-4 flex flex-col gap-3">
                <div style={{ height: 80, borderRadius: 10, backgroundColor: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                  {t.thumbnail_url ? <img src={t.thumbnail_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 28, opacity: 0.3 }}>▶</span>}
                  <span style={{ position: 'absolute', top: 6, left: 6, backgroundColor: '#6366F1', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>#{t.step_order}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', flex: 1 }}>{t.title}</h4>
                  <span style={{ color: AUD_COLOR[t.target_audience], backgroundColor: `${AUD_COLOR[t.target_audience]}18`, border: `1px solid ${AUD_COLOR[t.target_audience]}40`, borderRadius: 4, padding: '1px 6px', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', marginLeft: 6, flexShrink: 0 }}>{t.target_audience}</span>
                </div>
                {t.description && <p style={{ fontSize: 11, color: 'var(--tx-3)', lineHeight: 1.5 }}>{t.description.slice(0, 80)}{t.description.length > 80 ? '…' : ''}</p>}
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  <button onClick={() => void reorder(t, 'up')} disabled={idx === 0 || acting === t.id} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 11, cursor: 'pointer' }}>↑</button>
                  <button onClick={() => void reorder(t, 'down')} disabled={idx === filtered.length - 1 || acting === t.id} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 11, cursor: 'pointer' }}>↓</button>
                  <button onClick={() => void toggleActive(t)} disabled={acting === t.id} style={{ padding: '3px 8px', borderRadius: 5, border: `1px solid ${t.is_active ? 'rgba(52,211,153,0.4)' : 'rgba(156,163,175,0.4)'}`, backgroundColor: t.is_active ? 'rgba(52,211,153,0.08)' : 'rgba(156,163,175,0.08)', color: t.is_active ? '#34D399' : '#9CA3AF', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>{t.is_active ? 'Active' : 'Inactive'}</button>
                  {confirmDelete === t.id ? (
                    <>
                      <button onClick={() => void deleteTutorial(t.id)} disabled={acting === t.id} style={{ padding: '3px 8px', borderRadius: 5, backgroundColor: '#F87171', border: 'none', color: '#fff', fontSize: 10, cursor: 'pointer', fontWeight: 700 }}>Delete?</button>
                      <button onClick={() => setConfirmDelete(null)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 10, cursor: 'pointer' }}>Cancel</button>
                    </>
                  ) : (
                    <button onClick={() => setConfirmDelete(t.id)} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>Delete</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {showPanel && (
          <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: 440, height: '100%', backgroundColor: 'var(--bg-surface)', padding: 24, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx-1)' }}>New Tutorial</h3>
                <button onClick={() => setShowPanel(false)} style={{ border: 'none', background: 'none', color: 'var(--tx-3)', cursor: 'pointer', fontSize: 20 }}>×</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[{ label: 'Title', key: 'title' }, { label: 'Video URL', key: 'video_url' }, { label: 'Thumbnail URL', key: 'thumbnail_url' }].map(f => (
                  <div key={f.key}>
                    <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</p>
                    <input value={(form as Record<string, unknown>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                ))}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Description</p>
                  <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} rows={3} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
                </div>
                {[{ label: 'Category', key: 'category', opts: CATEGORIES }, { label: 'Audience', key: 'target_audience', opts: ['all', 'candidate', 'company'] }].map(f => (
                  <div key={f.key}>
                    <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{f.label}</p>
                    <select value={(form as Record<string, unknown>)[f.key] as string} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}>
                      {f.opts.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </div>
                ))}
                <div>
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Step Order</p>
                  <input type="number" value={form.step_order} onChange={e => setForm(p => ({ ...p, step_order: Number(e.target.value) }))} style={{ width: 80, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }} />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                  <input type="checkbox" checked={form.is_active} onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))} style={{ width: 16, height: 16, accentColor: '#34D399' }} />
                  <span style={{ fontSize: 13, color: 'var(--tx-2)' }}>Active (visible to users)</span>
                </label>
                <button onClick={() => void saveTutorial()} disabled={saving} style={{ padding: '10px', borderRadius: 10, border: 'none', backgroundColor: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Creating…' : 'Create Tutorial'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

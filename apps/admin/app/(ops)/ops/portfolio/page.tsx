'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface PortfolioItem {
  id: string
  candidate_id: string
  title: string
  description: string | null
  image_url: string | null
  project_url: string | null
  tags: string[] | null
  is_featured: boolean
  created_at: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function PortfolioModerationPage() {
  const supabase = createClient()
  const [items, setItems] = useState<PortfolioItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterFeatured, setFilterFeatured] = useState<'all' | 'featured' | 'standard'>('all')
  const [acting, setActing] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('portfolio_items')
      .select('*')
      .order('created_at', { ascending: false })
    setItems((data ?? []) as PortfolioItem[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function flagItem(item: PortfolioItem) {
    setActing(`flag-${item.id}`)
    await supabase.from('flagged_content').insert({
      content_type: 'portfolio',
      content_id: item.id,
      reason: 'Admin flagged for review',
      severity: 'medium',
      status: 'pending',
    })
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.portfolio_flagged',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: item.id,
      target_type: 'portfolio',
      severity: 'info',
      app: 'admin_panel',
    })
    setActing(null)
    alert('Item flagged for review')
  }

  async function removeItem(id: string) {
    setActing(`remove-${id}`)
    await supabase.from('portfolio_items').delete().eq('id', id)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.portfolio_removed',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: id,
      target_type: 'portfolio',
      severity: 'warning',
      app: 'admin_panel',
    })
    setItems(prev => prev.filter(i => i.id !== id))
    setConfirmDelete(null)
    setActing(null)
  }

  async function toggleFeatured(item: PortfolioItem) {
    setActing(`feat-${item.id}`)
    await supabase.from('portfolio_items').update({ is_featured: !item.is_featured }).eq('id', item.id)
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_featured: !i.is_featured } : i))
    setActing(null)
  }

  const filtered = items.filter(item => {
    if (search) {
      const s = search.toLowerCase()
      if (!item.title.toLowerCase().includes(s) && !(item.tags ?? []).some(t => t.toLowerCase().includes(s))) return false
    }
    if (filterFeatured === 'featured' && !item.is_featured) return false
    if (filterFeatured === 'standard' && item.is_featured) return false
    return true
  })

  const totalFeatured = items.filter(i => i.is_featured).length
  const thisWeek = items.filter(i => new Date(i.created_at).getTime() > Date.now() - 7 * 86400000).length

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Portfolio Moderation" subtitle="Review and moderate candidate portfolio content" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Items', value: items.length, color: '#F59E0B' },
            { label: 'Featured', value: totalFeatured, color: '#A78BFA' },
            { label: 'Added This Week', value: thisWeek, color: '#38BDF8' },
            { label: 'Unique Candidates', value: new Set(items.map(i => i.candidate_id)).size, color: '#34D399' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or tag…"
            style={{ flex: 1, minWidth: 200, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--tx-1)', fontSize: 13, outline: 'none' }}
          />
          {(['all', 'featured', 'standard'] as const).map(f => (
            <button key={f} onClick={() => setFilterFeatured(f)}
              style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${filterFeatured === f ? '#F59E0B' : 'var(--border)'}`, backgroundColor: filterFeatured === f ? 'rgba(245,158,11,0.1)' : 'transparent', color: filterFeatured === f ? '#F59E0B' : 'var(--tx-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize' }}>
              {f === 'all' ? 'All' : f === 'featured' ? 'Featured Only' : 'Standard'}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div style={CARD} className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading portfolio items…</p></div>
        ) : filtered.length === 0 ? (
          <div style={CARD} className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No portfolio items found</p></div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {filtered.map(item => (
              <div key={item.id} style={CARD} className="p-4 flex flex-col gap-3">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', flex: 1, marginRight: 8 }}>{item.title}</h4>
                  {item.is_featured && (
                    <span style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#F59E0B', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600, flexShrink: 0 }}>FEATURED</span>
                  )}
                </div>

                {item.description && (
                  <p style={{ fontSize: 11, color: 'var(--tx-3)', lineHeight: 1.5 }}>{item.description.slice(0, 100)}{item.description.length > 100 ? '…' : ''}</p>
                )}

                {item.tags && item.tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {item.tags.slice(0, 4).map(tag => (
                      <span key={tag} style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--tx-3)', borderRadius: 4, padding: '1px 6px', fontSize: 10 }}>{tag}</span>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ fontSize: 10, color: 'var(--tx-3)' }}>{formatDate(item.created_at)}</p>
                  <p style={{ fontSize: 10, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{item.candidate_id.slice(0, 6)}…</p>
                </div>

                {/* Actions */}
                {confirmDelete === item.id ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, color: 'var(--tx-3)' }}>Remove?</span>
                    <button onClick={() => removeItem(item.id)} disabled={acting === `remove-${item.id}`} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', backgroundColor: '#F87171', color: '#fff', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {acting === `remove-${item.id}` ? '…' : 'Confirm'}
                    </button>
                    <button onClick={() => setConfirmDelete(null)} style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <button onClick={() => toggleFeatured(item)} disabled={acting === `feat-${item.id}`} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(167,139,250,0.4)', backgroundColor: 'rgba(167,139,250,0.08)', color: '#A78BFA', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {acting === `feat-${item.id}` ? '…' : item.is_featured ? 'Unfeature' : 'Feature'}
                    </button>
                    <button onClick={() => flagItem(item)} disabled={acting === `flag-${item.id}`} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.08)', color: '#FBBF24', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      {acting === `flag-${item.id}` ? '…' : 'Flag'}
                    </button>
                    <button onClick={() => setConfirmDelete(item.id)} style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 11, cursor: 'pointer', fontWeight: 600 }}>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

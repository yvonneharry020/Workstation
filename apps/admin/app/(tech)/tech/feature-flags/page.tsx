'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface FeatureFlag {
  id: string
  key: string
  label: string
  description: string | null
  enabled: boolean
  app: string
  category: string
  updated_at: string
  updated_by: string | null
}

const APP_COLORS: Record<string, string> = {
  all: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
  candidate_app: 'bg-blue-900/20 text-blue-400 border-blue-800/30',
  company_app: 'bg-emerald-900/20 text-emerald-400 border-emerald-800/30',
  admin_panel: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
}

const CATEGORIES = ['All', 'system', 'access', 'features', 'notifications']

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-NG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function FeatureFlagsPage() {
  const supabase = createClient()
  const [flags, setFlags] = useState<FeatureFlag[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => { void load() }, [])

  async function load() {
    const { data } = await supabase.from('feature_flags').select('*').order('category').order('label')
    setFlags((data ?? []) as FeatureFlag[])
    setLoading(false)
  }

  async function toggleFlag(flag: FeatureFlag) {
    setSaving(flag.id)
    const newValue = !flag.enabled
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('feature_flags')
      .update({ enabled: newValue, updated_by: user?.email ?? 'admin', updated_at: new Date().toISOString() })
      .eq('id', flag.id)

    if (!error) {
      setFlags(prev => prev.map(f => f.id === flag.id ? { ...f, enabled: newValue, updated_by: user?.email ?? 'admin', updated_at: new Date().toISOString() } : f))
      await supabase.from('audit_logs').insert({
        event: `feature_flag.${newValue ? 'enabled' : 'disabled'}`,
        actor_email: user?.email ?? null,
        actor_id: user?.id ?? null,
        actor_type: 'admin',
        severity: 'info',
        app: 'admin_panel',
        metadata: { flag_key: flag.key, new_value: newValue },
      })
      setToast(`${flag.label} ${newValue ? 'enabled' : 'disabled'}`)
      setTimeout(() => setToast(null), 2500)
    }
    setSaving(null)
  }

  const grouped = CATEGORIES.slice(1).reduce<Record<string, FeatureFlag[]>>((acc, cat) => {
    const filtered = flags.filter(f => f.category === cat && (categoryFilter === 'All' || f.category === categoryFilter))
    if (filtered.length > 0) acc[cat] = filtered
    return acc
  }, {})

  const allFiltered = categoryFilter === 'All' ? flags : flags.filter(f => f.category === categoryFilter)
  const enabledCount = allFiltered.filter(f => f.enabled).length

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold font-display text-text-primary">Feature Flags</h1>
          <p className="text-sm text-text-secondary mt-0.5">Toggle features across all apps. Changes are audited and take effect immediately.</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-text-muted">{enabledCount} / {allFiltered.length} enabled</span>
        </div>
      </div>

      <div className="px-8 py-4 border-b border-surface-border flex items-center gap-2">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategoryFilter(c)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${categoryFilter === c ? 'bg-tech-900/50 text-tech-300 border border-tech-800/30' : 'text-text-secondary hover:text-text-primary'}`}>
            {c}
          </button>
        ))}
      </div>

      <div className="px-8 py-6 max-w-4xl space-y-6">
        {loading ? (
          <div className="text-text-muted text-sm">Loading…</div>
        ) : (
          Object.entries(grouped).map(([cat, catFlags]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-wider mb-3">{cat}</p>
              <div className="space-y-2">
                {catFlags.map(flag => {
                  const isSaving = saving === flag.id
                  return (
                    <div key={flag.id} className={`flex items-start justify-between px-4 py-3.5 rounded-xl border transition-colors ${flag.enabled ? 'bg-tech-900/10 border-tech-800/20' : 'bg-surface-card border-surface-border'}`}>
                      <div className="flex-1 min-w-0 pr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-text-primary">{flag.label}</p>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${APP_COLORS[flag.app] ?? ''}`}>{flag.app.replace(/_/g, ' ')}</span>
                        </div>
                        {flag.description && <p className="text-xs text-text-muted mt-0.5">{flag.description}</p>}
                        <p className="text-[10px] text-text-muted mt-1 font-mono">{flag.key} · updated {formatTime(flag.updated_at)}{flag.updated_by ? ` by ${flag.updated_by}` : ''}</p>
                      </div>
                      <button onClick={() => void toggleFlag(flag)} disabled={isSaving}
                        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 mt-0.5 ${flag.enabled ? 'bg-tech-500' : 'bg-surface-border'} ${isSaving ? 'opacity-50' : 'cursor-pointer'}`}>
                        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${flag.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 bg-tech-900/80 border border-tech-700/40 text-tech-300 text-sm font-semibold px-4 py-2.5 rounded-xl backdrop-blur-sm">
          {toast}
        </div>
      )}
    </div>
  )
}

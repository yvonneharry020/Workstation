'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

interface ConfigRow {
  id: string
  key: string
  value: string
  description: string | null
  updated_by: string | null
  updated_at: string
}

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function safeDisplayValue(val: unknown): string {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return JSON.stringify(val)
  return String(val)
}

function getCategoryFromKey(key: string): string {
  const dot = key.indexOf('.')
  return dot === -1 ? 'general' : key.slice(0, dot)
}

interface Toast { type: 'success' | 'error'; message: string }

export default function SystemConfigPage() {
  const supabase = createClient()
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [newKey, setNewKey] = useState('')
  const [newValue, setNewValue] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [addingNew, setAddingNew] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('platform_config')
      .select('*')
      .order('key', { ascending: true })
    if (!error) setConfig((data ?? []) as ConfigRow[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  function showToast(type: 'success' | 'error', message: string) {
    setToast({ type, message })
    setTimeout(() => setToast(null), 3000)
  }

  async function saveRow(row: ConfigRow) {
    const newVal = draftValues[row.id] ?? row.value
    setSaving(row.id)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { error } = await supabase
        .from('platform_config')
        .update({ value: newVal, updated_by: user?.email ?? 'admin', updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
      setConfig(prev => prev.map(c => c.id === row.id ? { ...c, value: newVal, updated_by: user?.email ?? 'admin', updated_at: new Date().toISOString() } : c))
      setDraftValues(prev => { const n = { ...prev }; delete n[row.id]; return n })
      setEditingId(null)
      showToast('success', `Saved: ${row.key}`)
    } catch {
      showToast('error', 'Failed to save. Please try again.')
    }
    setSaving(null)
  }

  async function addNewConfig() {
    if (!newKey.trim() || !newValue.trim()) return
    setSaving('new')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('platform_config')
        .insert({ key: newKey.trim(), value: newValue.trim(), description: newDesc.trim() || null, updated_by: user?.email ?? 'admin', updated_at: new Date().toISOString() })
        .select()
        .single()
      if (error) throw error
      setConfig(prev => [...prev, data as ConfigRow].sort((a, b) => a.key.localeCompare(b.key)))
      setNewKey('')
      setNewValue('')
      setNewDesc('')
      setAddingNew(false)
      showToast('success', `Added: ${newKey}`)
    } catch {
      showToast('error', 'Failed to add config. Key may already exist.')
    }
    setSaving(null)
  }

  function toggleCategory(cat: string) {
    setCollapsed(prev => {
      const n = new Set(prev)
      n.has(cat) ? n.delete(cat) : n.add(cat)
      return n
    })
  }

  const grouped = config.reduce<Record<string, ConfigRow[]>>((acc, row) => {
    const cat = getCategoryFromKey(row.key)
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(row)
    return acc
  }, {})

  const categories = Object.keys(grouped).sort()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', position: 'relative' }}>
      <TopBar title="System Configuration" subtitle={`${config.length} config keys across ${categories.length} categories`} />

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', top: 24, right: 24, zIndex: 999,
          padding: '12px 20px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          backgroundColor: toast.type === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(239,68,68,0.15)',
          color: toast.type === 'success' ? '#34D399' : '#F87171',
          border: `1px solid ${toast.type === 'success' ? 'rgba(52,211,153,0.3)' : 'rgba(239,68,68,0.3)'}`,
          boxShadow: 'var(--shadow-md)',
        }}>
          {toast.message}
        </div>
      )}

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: 48, color: 'var(--tx-3)', fontSize: 13 }}>Loading configuration…</div>
        )}

        {!loading && categories.map(cat => {
          const rows = grouped[cat]
          const isCollapsed = collapsed.has(cat)
          return (
            <div key={cat} style={CARD_STYLE}>
              <button
                onClick={() => toggleCategory(cat)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', borderBottom: isCollapsed ? 'none' : '1px solid var(--border)', background: 'none', border: 'none', borderRadius: isCollapsed ? 16 : '16px 16px 0 0', cursor: 'pointer', borderBottomColor: 'var(--border)', borderBottomStyle: isCollapsed ? 'none' : 'solid', borderBottomWidth: isCollapsed ? 0 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: '4px 12px', borderRadius: 8, backgroundColor: 'rgba(99,102,241,0.12)', color: '#818CF8', fontSize: 12, fontWeight: 700, fontFamily: 'monospace', textTransform: 'uppercase' }}>{cat}</div>
                  <span style={{ fontSize: 12, color: 'var(--tx-3)' }}>{rows.length} {rows.length === 1 ? 'key' : 'keys'}</span>
                </div>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--tx-3)" strokeWidth="2" style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {!isCollapsed && (
                <div>
                  {rows.map((row, i) => {
                    const isDirty = draftValues[row.id] !== undefined
                    const isEditing = editingId === row.id
                    const currentVal = draftValues[row.id] ?? row.value
                    const isToggle = currentVal === 'true' || currentVal === 'false'

                    return (
                      <div key={row.id} style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '16px 24px',
                        borderBottom: i < rows.length - 1 ? '1px solid var(--border)' : 'none',
                        backgroundColor: isDirty ? 'rgba(99,102,241,0.04)' : 'transparent',
                      }}>
                        <div style={{ flex: 1, marginRight: 32 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)', margin: 0 }}>{row.key}</p>
                            {isDirty && <span style={{ fontSize: 10, backgroundColor: 'rgba(99,102,241,0.15)', color: '#818CF8', padding: '2px 8px', borderRadius: 6, fontWeight: 700, fontFamily: 'monospace' }}>UNSAVED</span>}
                          </div>
                          {row.description && <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: '3px 0 0' }}>{row.description}</p>}
                          {row.updated_at && <p style={{ fontSize: 10, color: 'var(--tx-3)', margin: '2px 0 0', fontFamily: 'monospace' }}>Updated {formatDate(row.updated_at)}{row.updated_by ? ` by ${row.updated_by}` : ''}</p>}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                          {isToggle ? (
                            <button
                              role="switch"
                              aria-checked={currentVal === 'true'}
                              onClick={() => setDraftValues(prev => ({ ...prev, [row.id]: currentVal === 'true' ? 'false' : 'true' }))}
                              style={{
                                position: 'relative', width: 44, height: 24, borderRadius: 99, cursor: 'pointer', border: 'none',
                                backgroundColor: currentVal === 'true' ? '#6366F1' : 'var(--bg-elevated)',
                                transition: 'background-color 0.2s',
                              }}
                            >
                              <span style={{
                                position: 'absolute', top: 2, left: currentVal === 'true' ? 22 : 2,
                                width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.2s',
                              }} />
                            </button>
                          ) : isEditing ? (
                            <input
                              autoFocus
                              value={currentVal}
                              onChange={e => setDraftValues(prev => ({ ...prev, [row.id]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') saveRow(row); if (e.key === 'Escape') { setEditingId(null); setDraftValues(prev => { const n = { ...prev }; delete n[row.id]; return n }) } }}
                              style={{ width: 160, padding: '6px 12px', borderRadius: 8, border: '1px solid #6366F1', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'monospace', outline: 'none', textAlign: 'right' }}
                            />
                          ) : (
                            <button
                              onClick={() => { setEditingId(row.id); setDraftValues(prev => ({ ...prev, [row.id]: row.value })) }}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <span style={{ fontSize: 13, fontFamily: 'monospace', color: 'var(--tx-1)' }}>{safeDisplayValue(row.value).length > 40 ? safeDisplayValue(row.value).slice(0, 40) + '…' : safeDisplayValue(row.value)}</span>
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx-3)" strokeWidth="2">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}

                          {isDirty && (
                            <button
                              onClick={() => saveRow(row)}
                              disabled={saving === row.id}
                              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: '#6366F1', color: '#fff', opacity: saving === row.id ? 0.6 : 1 }}
                            >
                              {saving === row.id ? 'Saving…' : 'Save'}
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {/* Add new config */}
        {!loading && (
          <div style={CARD_STYLE}>
            <button
              onClick={() => setAddingNew(!addingNew)}
              style={{ width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', borderRadius: 16 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#818CF8' }}>Add New Config Key</span>
            </button>
            {addingNew && (
              <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Key (e.g. auth.session_timeout)</label>
                    <input
                      value={newKey}
                      onChange={e => setNewKey(e.target.value)}
                      placeholder="category.setting_name"
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Value</label>
                    <input
                      value={newValue}
                      onChange={e => setNewValue(e.target.value)}
                      placeholder="Value..."
                      style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-1)', fontSize: 13, fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', display: 'block', marginBottom: 6 }}>Description (optional)</label>
                  <input
                    value={newDesc}
                    onChange={e => setNewDesc(e.target.value)}
                    placeholder="What does this config key control?"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={addNewConfig}
                    disabled={saving === 'new' || !newKey.trim() || !newValue.trim()}
                    style={{ padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: 'none', backgroundColor: '#6366F1', color: '#fff', opacity: saving === 'new' || !newKey.trim() || !newValue.trim() ? 0.5 : 1 }}
                  >
                    {saving === 'new' ? 'Adding…' : 'Add Config'}
                  </button>
                  <button
                    onClick={() => { setAddingNew(false); setNewKey(''); setNewValue(''); setNewDesc('') }}
                    style={{ padding: '8px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'transparent', color: 'var(--tx-3)' }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_PLATFORM_CONFIG } from '@/lib/mock-data'

type ConfigItem = {
  key: string
  label: string
  value: string
  group: string
  type: 'number' | 'string' | 'toggle'
  description: string
}

const GROUP_LABELS: Record<string, { label: string; desc: string }> = {
  trust: { label: 'Trust Score Weights', desc: 'Control how much each verification component contributes to a user\'s trust score. Weights should sum to 100.' },
  badges: { label: 'Badge Settings', desc: 'Configuration for the employment badge system.' },
  email: { label: 'Email Limits', desc: 'Rate limiting settings for platform email delivery.' },
  dev: { label: 'Developer Settings', desc: 'Testing and API configuration. Clear dev values before production use.' },
  features: { label: 'Feature Flags', desc: 'Toggle platform features on or off. Changes take effect immediately.' },
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${checked ? 'bg-admin-500' : 'bg-surface-muted'}`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}

export default function SystemConfigPage() {
  const [config, setConfig] = useState<ConfigItem[]>(MOCK_PLATFORM_CONFIG)
  const [saved, setSaved] = useState(false)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [draftValues, setDraftValues] = useState<Record<string, string>>({})

  const getValue = (item: ConfigItem) => draftValues[item.key] ?? item.value

  const handleToggle = (key: string, current: string) => {
    const newVal = current === 'true' ? 'false' : 'true'
    setDraftValues((prev) => ({ ...prev, [key]: newVal }))
  }

  const handleEdit = (key: string, val: string) => {
    setEditingKey(key)
    setDraftValues((prev) => ({ ...prev, [key]: val }))
  }

  const handleSave = () => {
    setConfig((prev) =>
      prev.map((item) =>
        draftValues[item.key] !== undefined ? { ...item, value: draftValues[item.key] } : item
      )
    )
    setDraftValues({})
    setEditingKey(null)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const hasDraft = Object.keys(draftValues).length > 0
  const groups = Array.from(new Set(config.map((c) => c.group)))
  const trustTotal = ['trust_weight_nin', 'trust_weight_liveness', 'trust_weight_document', 'trust_weight_employment']
    .map((k) => parseInt(getValue(config.find((c) => c.key === k)!), 10) || 0)
    .reduce((a, b) => a + b, 0)

  return (
    <div className="flex flex-col min-h-full">
      <TopBar
        title="System Configuration"
        subtitle="Platform settings, feature flags, and trust score weights"
        actions={
          hasDraft ? (
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-admin-500 hover:bg-admin-600 text-white text-sm font-semibold transition-colors"
            >
              Save Changes ({Object.keys(draftValues).length})
            </button>
          ) : saved ? (
            <span className="flex items-center gap-2 px-4 py-2 rounded-lg bg-trust-high-bg text-trust-high text-sm font-semibold">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12" /></svg>
              Saved
            </span>
          ) : null
        }
      />

      <div className="px-8 py-6 space-y-8">
        {groups.map((group) => {
          const items = config.filter((c) => c.group === group)
          const meta = GROUP_LABELS[group]
          return (
            <section key={group} className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
              <div className="px-6 py-4 border-b border-surface-border">
                <h2 className="text-sm font-semibold font-display text-text-primary">{meta.label}</h2>
                <p className="text-xs text-text-secondary mt-0.5">{meta.desc}</p>
                {group === 'trust' && (
                  <div className={`mt-2 text-xs font-mono font-bold ${trustTotal === 100 ? 'text-trust-high' : 'text-trust-low'}`}>
                    Weight total: {trustTotal}/100 {trustTotal !== 100 && '⚠ Weights must sum to 100'}
                  </div>
                )}
              </div>
              <div className="divide-y divide-surface-border/50">
                {items.map((item) => {
                  const val = getValue(item)
                  const isDirty = draftValues[item.key] !== undefined
                  return (
                    <div key={item.key} className={`flex items-center justify-between px-6 py-4 ${isDirty ? 'bg-admin-900/30' : ''}`}>
                      <div className="flex-1 mr-8">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-text-primary">{item.label}</p>
                          {isDirty && <span className="text-[10px] font-mono text-admin-400 bg-admin-900 px-1.5 py-0.5 rounded">unsaved</span>}
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{item.description}</p>
                        <p className="text-[10px] font-mono text-text-muted/60 mt-0.5">{item.key}</p>
                      </div>

                      <div className="flex items-center gap-3 flex-shrink-0">
                        {item.type === 'toggle' ? (
                          <Toggle checked={val === 'true'} onChange={() => handleToggle(item.key, val)} />
                        ) : editingKey === item.key ? (
                          <div className="flex items-center gap-2">
                            <input
                              type={item.type === 'number' ? 'number' : 'text'}
                              value={val}
                              onChange={(e) => setDraftValues((prev) => ({ ...prev, [item.key]: e.target.value }))}
                              autoFocus
                              className="w-32 bg-surface-muted border border-admin-500 rounded-lg px-3 py-1.5 text-sm font-mono text-text-primary focus:outline-none text-right"
                            />
                            <button onClick={() => setEditingKey(null)} className="text-xs text-text-muted hover:text-text-secondary">
                              Done
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEdit(item.key, val)}
                            className="flex items-center gap-2 group"
                          >
                            <span className="text-sm font-mono text-text-primary group-hover:text-admin-300 transition-colors">{val}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#564F6A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

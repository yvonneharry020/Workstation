'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

interface ConfigRow {
  id: string
  key: string
  value: string
  description: string | null
  updated_at: string
}

interface AuditEntry {
  id: string
  event: string
  actor_email: string | null
  severity: string
  created_at: string
}

const DEFAULT_RATE_LIMITS = [
  { key: 'rate_limit.api_requests_per_minute', label: 'API Requests / Minute',   default: '60'  },
  { key: 'rate_limit.login_attempts',           label: 'Login Attempts',           default: '5'   },
  { key: 'rate_limit.signup_per_hour',          label: 'Signups / Hour',           default: '10'  },
  { key: 'rate_limit.otp_requests_per_hour',    label: 'OTP Requests / Hour',      default: '5'   },
  { key: 'rate_limit.password_resets_per_day',  label: 'Password Resets / Day',    default: '3'   },
]

function timeDiff(iso: string) {
  const d = Date.now() - new Date(iso).getTime()
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

export default function RateLimitsPage() {
  const supabase = createClient()
  const [config, setConfig] = useState<ConfigRow[]>([])
  const [rateLimitValues, setRateLimitValues] = useState<Record<string, string>>({})
  const [auditEvents, setAuditEvents] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newIp, setNewIp] = useState('')
  const [newIpReason, setNewIpReason] = useState('')
  const [blockingIp, setBlockingIp] = useState(false)
  const [blockError, setBlockError] = useState('')

  const load = useCallback(async () => {
    const [{ data: cfgData }, { data: auditData }] = await Promise.all([
      supabase.from('platform_config').select('*').order('key'),
      supabase.from('audit_logs').select('*').ilike('event', 'rate_limit.%').order('created_at', { ascending: false }).limit(20),
    ])
    const rows = (cfgData ?? []) as ConfigRow[]
    setConfig(rows)

    // Init rate limit values
    const vals: Record<string, string> = {}
    DEFAULT_RATE_LIMITS.forEach(def => {
      const found = rows.find(r => r.key === def.key)
      vals[def.key] = found ? found.value : def.default
    })
    setRateLimitValues(vals)
    setAuditEvents((auditData ?? []) as AuditEntry[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  const saveRateLimit = useCallback(async (key: string) => {
    setSaving(key)
    const value = rateLimitValues[key] ?? '0'
    const existing = config.find(r => r.key === key)
    if (existing) {
      await supabase.from('platform_config').update({ value, updated_at: new Date().toISOString() }).eq('key', key)
    } else {
      await supabase.from('platform_config').insert({ key, value, description: `Rate limit setting: ${key}` })
    }
    await load()
    setSaving(null)
  }, [supabase, rateLimitValues, config, load])

  const blockIp = useCallback(async () => {
    const ip = newIp.trim()
    if (!ip) { setBlockError('IP address is required'); return }
    if (!newIpReason.trim()) { setBlockError('Reason is required'); return }
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d+)?$/
    if (!ipRegex.test(ip)) { setBlockError('Invalid IP address format'); return }
    setBlockingIp(true)
    setBlockError('')
    const key = `blocked_ip.${ip}`
    const existing = config.find(r => r.key === key)
    if (existing) {
      await supabase.from('platform_config').update({ value: newIpReason.trim() }).eq('key', key)
    } else {
      await supabase.from('platform_config').insert({ key, value: newIpReason.trim(), description: `Blocked IP: ${ip}` })
    }
    setNewIp('')
    setNewIpReason('')
    await load()
    setBlockingIp(false)
  }, [supabase, newIp, newIpReason, config, load])

  const unblockIp = useCallback(async (key: string) => {
    await supabase.from('platform_config').delete().eq('key', key)
    setConfig(prev => prev.filter(r => r.key !== key))
  }, [supabase])

  const blockedIps = config.filter(r => r.key.startsWith('blocked_ip.'))
  const now24 = Date.now() - 86_400_000
  const now7d = Date.now() - 7 * 86_400_000
  const events24 = auditEvents.filter(e => new Date(e.created_at).getTime() > now24).length
  const events7d = auditEvents.filter(e => new Date(e.created_at).getTime() > now7d).length

  // Peak hour (rough estimate from last 20 events grouped by hour)
  const hourCounts: Record<number, number> = {}
  auditEvents.forEach(e => { const h = new Date(e.created_at).getHours(); hourCounts[h] = (hourCounts[h] ?? 0) + 1 })
  const peakHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1])[0]

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Rate Limits & IP Blocks" subtitle="Traffic controls and security settings" />

      <div className="p-6 max-w-[1200px] mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Active IP Blocks',  value: blockedIps.length.toString(),                     color: '#F87171' },
            { label: 'Events Today',      value: events24.toString(),                              color: '#FBBF24' },
            { label: 'Events This Week',  value: events7d.toString(),                              color: '#38BDF8' },
            { label: 'Peak Hour',         value: peakHour ? `${peakHour[0]}:00` : '—',            color: '#A78BFA' },
          ].map(kpi => (
            <div key={kpi.label} style={{ ...CARD_STYLE, padding: '18px 20px' }}>
              <p className="text-[11px] uppercase tracking-wide mb-1 font-semibold" style={{ color: 'var(--tx-3)' }}>{kpi.label}</p>
              <p className="text-[26px] font-bold font-display" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Rate limit settings */}
          <div style={{ ...CARD_STYLE, padding: '24px' }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Rate Limit Settings</h2>
            {loading ? <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p> : (
              <div className="space-y-3">
                {DEFAULT_RATE_LIMITS.map(def => (
                  <div key={def.key} className="flex items-center gap-3">
                    <label className="flex-1 text-[13px]" style={{ color: 'var(--tx-2)' }}>{def.label}</label>
                    <input
                      type="number"
                      min="0"
                      value={rateLimitValues[def.key] ?? def.default}
                      onChange={e => setRateLimitValues(prev => ({ ...prev, [def.key]: e.target.value }))}
                      className="w-20 px-2 py-1.5 rounded-lg text-[13px] text-center font-mono"
                      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
                    />
                    <button
                      onClick={() => void saveRateLimit(def.key)}
                      disabled={saving === def.key}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                      style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)', opacity: saving === def.key ? 0.6 : 1 }}
                    >
                      {saving === def.key ? '…' : 'Save'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* IP blocking */}
          <div style={{ ...CARD_STYLE, padding: '24px' }}>
            <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>IP Blocklist</h2>

            {/* Block form */}
            <div className="flex gap-2 mb-4">
              <input
                value={newIp}
                onChange={e => setNewIp(e.target.value)}
                placeholder="IP (e.g. 1.2.3.4)"
                className="flex-1 px-3 py-2 rounded-lg text-[13px] font-mono"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
              />
              <input
                value={newIpReason}
                onChange={e => setNewIpReason(e.target.value)}
                placeholder="Reason"
                className="flex-1 px-3 py-2 rounded-lg text-[13px]"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--tx-1)' }}
              />
              <button
                onClick={() => void blockIp()}
                disabled={blockingIp}
                className="px-4 py-2 rounded-lg text-[12px] font-semibold"
                style={{ backgroundColor: 'rgba(239,68,68,0.15)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', opacity: blockingIp ? 0.6 : 1 }}
              >
                Block
              </button>
            </div>
            {blockError && <p className="text-[12px] mb-2" style={{ color: '#F87171' }}>{blockError}</p>}

            {loading ? <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p> :
              blockedIps.length === 0 ? (
                <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No IPs currently blocked.</p>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto">
                  {blockedIps.map(row => {
                    const ip = row.key.replace('blocked_ip.', '')
                    return (
                      <div key={row.id} className="flex items-center gap-2 py-2" style={{ borderBottom: '1px solid var(--border)' }}>
                        <span className="font-mono text-[12px] flex-1" style={{ color: '#F87171' }}>{ip}</span>
                        <span className="text-[12px] flex-1 truncate" style={{ color: 'var(--tx-2)' }}>{row.value}</span>
                        <button
                          onClick={() => void unblockIp(row.key)}
                          className="px-2 py-1 rounded text-[11px] font-semibold"
                          style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}
                        >
                          Unblock
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            }
          </div>
        </div>

        {/* Rate limit events */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Recent Rate Limit Events</h2>
          {loading ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p>
          ) : auditEvents.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No rate limit events recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Event', 'Actor', 'Severity', 'Time'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 font-semibold text-[11px] uppercase tracking-wide" style={{ color: 'var(--tx-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map(row => (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td className="py-2 pr-4 font-mono text-[12px]" style={{ color: 'var(--tx-1)' }}>{row.event}</td>
                      <td className="py-2 pr-4" style={{ color: 'var(--tx-2)' }}>{row.actor_email ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{
                          backgroundColor: row.severity === 'critical' ? 'rgba(239,68,68,0.1)' : 'rgba(251,191,36,0.1)',
                          color: row.severity === 'critical' ? '#F87171' : '#FBBF24',
                        }}>
                          {row.severity}
                        </span>
                      </td>
                      <td className="py-2" style={{ color: 'var(--tx-3)' }}>{timeDiff(row.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

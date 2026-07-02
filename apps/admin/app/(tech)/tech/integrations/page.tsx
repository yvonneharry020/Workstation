'use client'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import TopBar from '@/components/layout/TopBar'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

type ServiceStatus = 'healthy' | 'degraded' | 'down' | 'checking' | 'unknown'

interface Service {
  id: string
  name: string
  category: string
  url: string
  color: string
}

interface ServiceState {
  status: ServiceStatus
  responseMs: number | null
  checkedAt: Date | null
}

interface HealthLog {
  id: string
  service: string
  status: string
  response_time_ms: number | null
  error_message: string | null
  checked_at: string
}

const SERVICES: Service[] = [
  { id: 'paystack',       name: 'Paystack',       category: 'Payment Gateway',       url: 'https://status.paystack.com/',                                                color: '#0BA4DB' },
  { id: 'supabase',       name: 'Supabase',       category: 'Database / Auth',        url: '__supabase__',                                                               color: '#3ECF8E' },
  { id: 'termii',         name: 'Termii',         category: 'SMS / OTP',              url: 'https://api.ng.termii.com/api/ping',                                          color: '#FF6B35' },
  { id: 'dojah',          name: 'Dojah',          category: 'Identity Verification',  url: 'https://sandbox.dojah.io/health',                                            color: '#6C5CE7' },
  { id: 'smile_identity', name: 'Smile Identity', category: 'Identity Verification',  url: 'https://8444e4f0-8e70-4173-a19e-81f6be66e6b0.mock.pstmn.io/health',         color: '#FDCB6E' },
  { id: 'livekit',        name: 'LiveKit',        category: 'Video Rooms',            url: 'https://livekit.io',                                                         color: '#E84393' },
  { id: 'resend',         name: 'Resend',         category: 'Email Delivery',         url: 'https://status.resend.com',                                                  color: '#000000' },
]

const STATUS_STYLE: Record<ServiceStatus, { text: string; bg: string; border: string; label: string }> = {
  healthy:  { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  label: 'Healthy' },
  degraded: { text: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  border: 'rgba(251,191,36,0.3)',  label: 'Degraded' },
  down:     { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'Down' },
  checking: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)',  label: 'Checking...' },
  unknown:  { text: '#9CA3AF', bg: 'rgba(156,163,175,0.1)', border: 'rgba(156,163,175,0.3)', label: 'Unknown' },
}

function timeDiff(d: Date | null) {
  if (!d) return '—'
  const s = Math.floor((Date.now() - d.getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  return `${Math.floor(s / 3600)}h ago`
}

export default function IntegrationsPage() {
  const supabase = createClient()
  const [states, setStates] = useState<Record<string, ServiceState>>(() =>
    Object.fromEntries(SERVICES.map(s => [s.id, { status: 'unknown' as ServiceStatus, responseMs: null, checkedAt: null }]))
  )
  const [history, setHistory] = useState<HealthLog[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  const loadHistory = useCallback(async () => {
    const { data } = await supabase
      .from('integration_health_logs')
      .select('*')
      .order('checked_at', { ascending: false })
      .limit(20)
    setHistory(data ?? [])
    setHistoryLoading(false)
  }, [supabase])

  useEffect(() => { void loadHistory() }, [loadHistory])

  const checkService = useCallback(async (svc: Service) => {
    setStates(prev => ({ ...prev, [svc.id]: { ...prev[svc.id], status: 'checking' } }))
    const start = Date.now()
    let status: ServiceStatus = 'down'
    let responseMs: number | null = null
    let errorMessage: string | null = null

    try {
      if (svc.url === '__supabase__') {
        // Check supabase by running a lightweight query
        await supabase.from('audit_logs').select('id').limit(1)
        responseMs = Date.now() - start
        status = responseMs < 1000 ? 'healthy' : responseMs < 3000 ? 'degraded' : 'down'
      } else {
        const res = await fetch(`/api/health-proxy?url=${encodeURIComponent(svc.url)}`, {
          signal: AbortSignal.timeout(6000),
        }).catch(() => null)
        responseMs = Date.now() - start
        if (!res) {
          status = 'down'
          errorMessage = 'Request failed or timed out'
        } else if (responseMs < 1000) {
          status = 'healthy'
        } else if (responseMs < 3000) {
          status = 'degraded'
        } else {
          status = 'down'
        }
      }
    } catch (e) {
      responseMs = Date.now() - start
      status = 'down'
      errorMessage = e instanceof Error ? e.message : 'Unknown error'
    }

    const now = new Date()
    setStates(prev => ({ ...prev, [svc.id]: { status, responseMs, checkedAt: now } }))

    await supabase.from('integration_health_logs').insert({
      service: svc.id,
      status,
      response_time_ms: responseMs,
      error_message: errorMessage,
      checked_at: now.toISOString(),
    })
    void loadHistory()
  }, [supabase, loadHistory])

  const checkAll = useCallback(() => {
    SERVICES.forEach(svc => { void checkService(svc) })
  }, [checkService])

  // Auto-refresh every 60s
  useEffect(() => {
    const id = setInterval(checkAll, 60_000)
    return () => clearInterval(id)
  }, [checkAll])

  const healthyCount = Object.values(states).filter(s => s.status === 'healthy').length
  const downCount = Object.values(states).filter(s => s.status === 'down').length

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Integration Health" subtitle="Monitor third-party service availability" />

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Summary row */}
        <div className="flex items-center gap-4 mb-6">
          <div style={{ ...CARD_STYLE, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="text-[13px]" style={{ color: 'var(--tx-2)' }}>Services Up</span>
            <span className="text-[22px] font-bold" style={{ color: '#34D399' }}>{healthyCount}/{SERVICES.length}</span>
          </div>
          {downCount > 0 && (
            <div style={{ ...CARD_STYLE, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, borderColor: 'rgba(239,68,68,0.3)' }}>
              <span className="text-[13px]" style={{ color: '#F87171' }}>Services Down</span>
              <span className="text-[22px] font-bold" style={{ color: '#F87171' }}>{downCount}</span>
            </div>
          )}
          <div className="ml-auto">
            <button
              onClick={checkAll}
              className="px-5 py-2.5 rounded-xl text-[13px] font-semibold transition-all"
              style={{ backgroundColor: 'rgba(6,182,212,0.15)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.3)' }}
            >
              Check All Services
            </button>
          </div>
        </div>

        {/* Service grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {SERVICES.map(svc => {
            const state = states[svc.id]
            const ss = STATUS_STYLE[state.status]
            return (
              <div key={svc.id} style={{ ...CARD_STYLE, padding: '20px' }}>
                <div className="flex items-start gap-3 mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-white font-bold text-[16px]"
                    style={{ backgroundColor: svc.color === '#000000' ? '#374151' : svc.color }}
                  >
                    {svc.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14px] leading-tight" style={{ color: 'var(--tx-1)' }}>{svc.name}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: 'var(--tx-3)' }}>{svc.category}</p>
                  </div>
                  <div
                    className="px-2.5 py-1 rounded-full text-[11px] font-semibold border flex-shrink-0"
                    style={{ color: ss.text, backgroundColor: ss.bg, borderColor: ss.border }}
                  >
                    {ss.label}
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-[11px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Response Time</p>
                    <p className="text-[18px] font-bold font-mono" style={{ color: ss.text }}>
                      {state.responseMs !== null ? `${state.responseMs}ms` : '—'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] mb-0.5" style={{ color: 'var(--tx-3)' }}>Last Checked</p>
                    <p className="text-[12px] font-medium" style={{ color: 'var(--tx-2)' }}>{timeDiff(state.checkedAt)}</p>
                  </div>
                </div>

                <button
                  onClick={() => void checkService(svc)}
                  disabled={state.status === 'checking'}
                  className="w-full py-2 rounded-lg text-[12px] font-semibold transition-all"
                  style={{
                    backgroundColor: 'rgba(6,182,212,0.08)',
                    color: state.status === 'checking' ? 'var(--tx-3)' : '#06B6D4',
                    border: '1px solid rgba(6,182,212,0.2)',
                    cursor: state.status === 'checking' ? 'not-allowed' : 'pointer',
                  }}
                >
                  {state.status === 'checking' ? 'Testing...' : 'Retest'}
                </button>
              </div>
            )
          })}
        </div>

        {/* History table */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <h2 className="text-[15px] font-bold mb-4" style={{ color: 'var(--tx-1)' }}>Check History (Last 20)</h2>
          {historyLoading ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading…</p>
          ) : history.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No history yet. Click &quot;Check All Services&quot; to begin.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Service', 'Status', 'Response Time', 'Error', 'Checked At'].map(h => (
                      <th key={h} className="text-left pb-2 pr-4 font-semibold text-[11px] uppercase tracking-wide" style={{ color: 'var(--tx-3)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map(row => {
                    const s = STATUS_STYLE[(row.status as ServiceStatus) ?? 'unknown']
                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="py-2 pr-4 font-medium capitalize" style={{ color: 'var(--tx-1)' }}>{row.service.replace(/_/g, ' ')}</td>
                        <td className="py-2 pr-4">
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ color: s.text, backgroundColor: s.bg, borderColor: s.border }}>
                            {row.status}
                          </span>
                        </td>
                        <td className="py-2 pr-4 font-mono" style={{ color: 'var(--tx-2)' }}>
                          {row.response_time_ms !== null ? `${row.response_time_ms}ms` : '—'}
                        </td>
                        <td className="py-2 pr-4 max-w-[200px] truncate" style={{ color: '#F87171' }}>
                          {row.error_message ?? '—'}
                        </td>
                        <td className="py-2" style={{ color: 'var(--tx-3)' }}>
                          {new Date(row.checked_at).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

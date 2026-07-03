'use client'
import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'

const CARD: React.CSSProperties = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

type VState = 'READY' | 'ERROR' | 'BUILDING' | 'QUEUED' | 'CANCELED' | string
type EState = 'FINISHED' | 'ERRORED' | 'IN_PROGRESS' | 'NEW' | string

interface VDeploy {
  uid: string
  id: string
  url: string
  state: VState
  target: string | null
  created: number
  buildingAt?: number
  creator: { email?: string; username?: string }
  meta: {
    githubCommitSha?: string
    githubCommitRef?: string
    githubCommitMessage?: string
    githubCommitAuthorName?: string
  }
  inspectorUrl: string
}

interface EBuild {
  id: string
  platform: string
  status: EState
  createdAt: string
  completedAt: string | null
  artifacts?: { buildUrl?: string }
  appVersion?: string
  gitRef?: string
  initiatingActor?: { displayName?: string }
  error?: { errorCode?: string; message?: string }
}

interface ApiResponse {
  vercel: { deployments: VDeploy[]; error: string | null; notConfigured?: boolean }
  expo:   { builds: EBuild[];       error: string | null; notConfigured?: boolean }
}

const V_STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  READY:    { label: 'Success',  dot: '#34D399', badge: 'rgba(52,211,153,0.12)'  },
  ERROR:    { label: 'Failed',   dot: '#F87171', badge: 'rgba(239,68,68,0.12)'   },
  BUILDING: { label: 'Building', dot: '#38BDF8', badge: 'rgba(56,189,248,0.12)'  },
  QUEUED:   { label: 'Queued',   dot: '#A78BFA', badge: 'rgba(167,139,250,0.12)' },
  CANCELED: { label: 'Canceled', dot: '#9CA3AF', badge: 'rgba(156,163,175,0.12)' },
}
const E_STATUS: Record<string, { label: string; dot: string; badge: string }> = {
  FINISHED:    { label: 'Success',     dot: '#34D399', badge: 'rgba(52,211,153,0.12)'  },
  ERRORED:     { label: 'Failed',      dot: '#F87171', badge: 'rgba(239,68,68,0.12)'   },
  IN_PROGRESS: { label: 'Building',    dot: '#38BDF8', badge: 'rgba(56,189,248,0.12)'  },
  NEW:         { label: 'Queued',      dot: '#A78BFA', badge: 'rgba(167,139,250,0.12)' },
}

function timeDiff(ms: number) {
  const d = Date.now() - ms
  if (d < 60_000)     return 'just now'
  if (d < 3_600_000)  return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

function StatusDot({ state, map }: { state: string; map: typeof V_STATUS }) {
  const s = map[state] ?? { label: state, dot: '#9CA3AF', badge: 'rgba(156,163,175,0.12)' }
  return (
    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border"
      style={{ color: s.dot, backgroundColor: s.badge, borderColor: `${s.dot}40` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.dot,
        boxShadow: state === 'BUILDING' || state === 'IN_PROGRESS' ? `0 0 6px ${s.dot}` : 'none' }} />
      {s.label}
    </span>
  )
}

function VercelSection({ data }: { data: ApiResponse['vercel'] }) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [logs, setLogs]         = useState<Record<string, string | null>>({})
  const [loadingLog, setLoadingLog] = useState<string | null>(null)

  const fetchLogs = useCallback(async (id: string) => {
    if (logs[id] !== undefined) { setExpanded(e => e === id ? null : id); return }
    setLoadingLog(id)
    try {
      const res = await fetch(`/api/tech/deployments?buildLogs=${id}`)
      const json = await res.json() as { logs: string | null }
      setLogs(prev => ({ ...prev, [id]: json.logs }))
    } catch {
      setLogs(prev => ({ ...prev, [id]: null }))
    }
    setLoadingLog(null)
    setExpanded(id)
  }, [logs])

  if (data.notConfigured) {
    return (
      <div style={{ ...CARD, padding: '32px', textAlign: 'center' }}>
        <p className="text-[32px] mb-3">🔧</p>
        <p className="text-[15px] font-bold mb-1" style={{ color: 'var(--tx-1)' }}>Vercel not configured</p>
        <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Add VERCEL_API_TOKEN to .env.local</p>
      </div>
    )
  }

  if (data.error) {
    return (
      <div style={{ ...CARD, padding: '20px' }}>
        <p className="text-[13px]" style={{ color: '#F87171' }}>Vercel error: {data.error}</p>
      </div>
    )
  }

  const total   = data.deployments.length
  const success = data.deployments.filter(d => d.state === 'READY').length
  const failed  = data.deployments.filter(d => d.state === 'ERROR').length
  const live    = data.deployments.filter(d => d.state === 'BUILDING' || d.state === 'QUEUED').length

  return (
    <div className="space-y-4">
      {/* Mini stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',    val: total,   color: '#38BDF8' },
          { label: 'Success',  val: success,  color: '#34D399' },
          { label: 'Failed',   val: failed,   color: '#F87171' },
          { label: 'Live',     val: live,     color: '#A78BFA' },
        ].map(k => (
          <div key={k.label} style={{ ...CARD, padding: '14px 16px' }}>
            <p className="text-[10px] uppercase tracking-wide mb-0.5 font-semibold" style={{ color: 'var(--tx-3)' }}>{k.label}</p>
            <p className="text-[22px] font-bold font-display" style={{ color: k.color }}>{k.val}</p>
          </div>
        ))}
      </div>

      {/* Deployment rows */}
      <div style={CARD}>
        {data.deployments.length === 0 ? (
          <p className="p-6 text-[13px]" style={{ color: 'var(--tx-3)' }}>No deployments found.</p>
        ) : data.deployments.map((dep, i) => {
          const sha  = (dep.meta?.githubCommitSha ?? '').slice(0, 7) || '—'
          const msg  = (dep.meta?.githubCommitMessage ?? '').split('\n')[0].slice(0, 72) || 'No commit message'
          const by   = dep.meta?.githubCommitAuthorName ?? dep.creator?.email ?? '—'
          const dur  = dep.buildingAt && dep.created ? Math.round((dep.buildingAt - dep.created) / 1000) : 0
          const isFailed = dep.state === 'ERROR'
          const isLive   = dep.state === 'BUILDING' || dep.state === 'QUEUED'
          const id = dep.uid ?? dep.id

          return (
            <div key={id}>
              <div className="flex items-start gap-3 px-4 py-3.5"
                style={{ borderBottom: i < data.deployments.length - 1 ? '1px solid var(--border)' : 'none',
                  backgroundColor: isFailed ? 'rgba(239,68,68,0.03)' : isLive ? 'rgba(56,189,248,0.03)' : 'transparent' }}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="font-mono text-[11px] px-1.5 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4' }}>{sha}</span>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--tx-3)' }}>#{dep.meta?.githubCommitRef ?? 'main'}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{ color: dep.target === 'production' ? '#FB923C' : '#A78BFA',
                        backgroundColor: dep.target === 'production' ? 'rgba(251,146,60,0.1)' : 'rgba(167,139,250,0.1)',
                        borderColor: dep.target === 'production' ? 'rgba(251,146,60,0.3)' : 'rgba(167,139,250,0.3)' }}>
                      {dep.target ?? 'preview'}
                    </span>
                    <StatusDot state={dep.state} map={V_STATUS} />
                  </div>
                  <p className="text-[13px] font-medium mb-0.5 truncate" style={{ color: 'var(--tx-1)' }}>{msg}</p>
                  <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>
                    {by} · {timeDiff(dep.created)}{dur > 0 ? ` · ${dur}s` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {dep.url && (
                    <a href={`https://${dep.url}`} target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                      Open
                    </a>
                  )}
                  {isFailed && (
                    <button onClick={() => void fetchLogs(id)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                      style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {loadingLog === id ? 'Loading…' : expanded === id ? 'Hide Logs' : 'Error Logs'}
                    </button>
                  )}
                  <a href={dep.inspectorUrl} target="_blank" rel="noopener noreferrer"
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)', border: '1px solid var(--border)' }}>
                    Inspect
                  </a>
                </div>
              </div>
              {isFailed && expanded === id && (
                <div className="px-4 pb-4">
                  <pre className="text-[11px] font-mono leading-relaxed p-3 rounded-xl overflow-x-auto"
                    style={{ backgroundColor: 'rgba(239,68,68,0.06)', color: '#FCA5A5', border: '1px solid rgba(239,68,68,0.2)', maxHeight: 200 }}>
                    {logs[id] ?? 'No error details captured. View full logs in Vercel inspector.'}
                  </pre>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ExpoSection({ data }: { data: ApiResponse['expo'] }) {
  if (data.notConfigured) {
    return (
      <div style={{ ...CARD, padding: '32px' }}>
        <div className="flex items-start gap-4">
          <div className="text-[32px]">📱</div>
          <div className="flex-1">
            <p className="text-[14px] font-bold mb-1" style={{ color: 'var(--tx-1)' }}>EAS Builds not connected</p>
            <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
              Add your Expo credentials to .env.local to see mobile app builds here.
            </p>
            <div style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 10, padding: '14px 16px' }}>
              <p className="text-[11px] font-mono mb-2" style={{ color: 'var(--tx-3)' }}>Add to .env.local:</p>
              <p className="text-[12px] font-mono" style={{ color: '#34D399' }}>EAS_ACCOUNT_TOKEN=your_expo_token</p>
              <p className="text-[12px] font-mono" style={{ color: '#34D399' }}>EAS_PROJECT_ID=your_project_id</p>
              <p className="text-[11px] mt-2" style={{ color: 'var(--tx-3)' }}>
                Get token: expo.dev/accounts/[you]/settings/access-tokens
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (data.error) {
    return (
      <div style={{ ...CARD, padding: '20px' }}>
        <p className="text-[13px]" style={{ color: '#F87171' }}>EAS error: {data.error}</p>
      </div>
    )
  }

  return (
    <div style={CARD}>
      {data.builds.length === 0 ? (
        <p className="p-6 text-[13px]" style={{ color: 'var(--tx-3)' }}>No EAS builds found.</p>
      ) : data.builds.map((build, i) => {
        const isFailed = build.status === 'ERRORED'
        return (
          <div key={build.id} className="px-4 py-3.5 flex items-start gap-3"
            style={{ borderBottom: i < data.builds.length - 1 ? '1px solid var(--border)' : 'none',
              backgroundColor: isFailed ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded border"
                  style={{ color: build.platform === 'ios' ? '#60A5FA' : '#4ADE80',
                    backgroundColor: build.platform === 'ios' ? 'rgba(96,165,250,0.1)' : 'rgba(74,222,128,0.1)',
                    borderColor: build.platform === 'ios' ? 'rgba(96,165,250,0.3)' : 'rgba(74,222,128,0.3)' }}>
                  {build.platform?.toUpperCase() ?? 'APP'}
                </span>
                {build.appVersion && (
                  <span className="text-[11px]" style={{ color: 'var(--tx-3)' }}>v{build.appVersion}</span>
                )}
                {build.gitRef && (
                  <span className="text-[11px] font-mono" style={{ color: 'var(--tx-3)' }}>#{build.gitRef}</span>
                )}
                <StatusDot state={build.status} map={E_STATUS} />
              </div>
              {isFailed && build.error?.message && (
                <p className="text-[11px] mb-0.5" style={{ color: '#FCA5A5' }}>{build.error.message}</p>
              )}
              <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>
                {build.initiatingActor?.displayName ?? '—'} · {timeDiff(new Date(build.createdAt).getTime())}
                {build.completedAt ? ` · ${Math.round((new Date(build.completedAt).getTime() - new Date(build.createdAt).getTime()) / 1000)}s` : ''}
              </p>
            </div>
            {build.artifacts?.buildUrl && (
              <a href={build.artifacts.buildUrl} target="_blank" rel="noopener noreferrer"
                className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex-shrink-0"
                style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}>
                Download
              </a>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function DeploymentPage() {
  const [data, setData]       = useState<ApiResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [lastFetch, setLastFetch] = useState<Date | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const res = await fetch('/api/tech/deployments', { cache: 'no-store' })
      if (!res.ok) throw new Error(`API error ${res.status}`)
      const json = await res.json() as ApiResponse
      setData(json)
      setLastFetch(new Date())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const id = setInterval(() => void load(), 30_000)
    return () => clearInterval(id)
  }, [load])

  const isLive = data?.vercel.deployments.some(d => d.state === 'BUILDING' || d.state === 'QUEUED')
    || data?.expo.builds.some(b => b.status === 'IN_PROGRESS' || b.status === 'NEW')

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar
        title="Deployment Console"
        subtitle={lastFetch ? `Last refreshed ${lastFetch.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}` : 'Loading…'}
        actions={
          <div className="flex items-center gap-2">
            {isLive && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: 'rgba(56,189,248,0.12)', color: '#38BDF8', border: '1px solid rgba(56,189,248,0.3)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                Live Build
              </span>
            )}
            <button onClick={() => { setLoading(true); void load() }}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
              style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.25)' }}>
              Refresh
            </button>
          </div>
        }
      />

      <div className="p-6 space-y-8 max-w-[1200px] mx-auto">
        {loading && !data ? (
          <div style={{ ...CARD, padding: '40px', textAlign: 'center' }}>
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading deployments…</p>
          </div>
        ) : error ? (
          <div style={{ ...CARD, padding: '20px' }}>
            <p className="text-[13px]" style={{ color: '#F87171' }}>Error: {error}</p>
            <button onClick={() => void load()} className="mt-2 text-[12px] px-3 py-1.5 rounded-lg"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Admin Panel — Vercel */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(6,182,212,0.12)', border: '1px solid rgba(6,182,212,0.2)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-sky-400">
                    <path d="M12 2L2 19.5h20L12 2z"/>
                  </svg>
                </div>
                <h2 className="text-[13px] font-bold" style={{ color: 'var(--tx-1)' }}>Admin Panel</h2>
                <span className="text-[11px]" style={{ color: 'var(--tx-3)' }}>Vercel · skiniq.store</span>
              </div>
              <VercelSection data={data.vercel} />
            </section>

            {/* Mobile App — Expo EAS */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md flex items-center justify-center"
                  style={{ backgroundColor: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.2)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                    <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
                    <line x1="12" y1="18" x2="12.01" y2="18"/>
                  </svg>
                </div>
                <h2 className="text-[13px] font-bold" style={{ color: 'var(--tx-1)' }}>Mobile App</h2>
                <span className="text-[11px]" style={{ color: 'var(--tx-3)' }}>Expo EAS · Workstation</span>
              </div>
              <ExpoSection data={data.expo} />
            </section>
          </>
        ) : null}
      </div>
    </div>
  )
}

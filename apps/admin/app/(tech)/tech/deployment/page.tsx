'use client'
import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'

const CARD_STYLE = {
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border)',
  borderRadius: '16px',
  boxShadow: 'var(--shadow-card)',
}

type DeployStatus = 'success' | 'failed' | 'building' | 'queued'
type EnvType = 'production' | 'preview'

interface Deployment {
  id: string
  sha: string
  branch: string
  message: string
  status: DeployStatus
  environment: EnvType
  deployedBy: string
  deployedAt: number
  duration: number
  url: string
}

const STATUS_STYLE: Record<DeployStatus, { text: string; bg: string; border: string; label: string }> = {
  success:  { text: '#34D399', bg: 'rgba(52,211,153,0.1)',  border: 'rgba(52,211,153,0.3)',  label: 'Success' },
  failed:   { text: '#F87171', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.3)',   label: 'Failed' },
  building: { text: '#38BDF8', bg: 'rgba(56,189,248,0.1)',  border: 'rgba(56,189,248,0.3)',  label: 'Building' },
  queued:   { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)', label: 'Queued' },
}

const ENV_STYLE: Record<EnvType, { text: string; bg: string; border: string }> = {
  production: { text: '#FB923C', bg: 'rgba(251,146,60,0.1)',   border: 'rgba(251,146,60,0.3)' },
  preview:    { text: '#A78BFA', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.3)' },
}

function mapState(state: string): DeployStatus {
  if (state === 'READY') return 'success'
  if (state === 'ERROR') return 'failed'
  if (state === 'BUILDING') return 'building'
  if (state === 'QUEUED') return 'queued'
  return 'building'
}

function timeDiff(ms: number) {
  const d = Date.now() - ms
  if (d < 60_000) return 'just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)}m ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)}h ago`
  return `${Math.floor(d / 86_400_000)}d ago`
}

type FilterType = 'all' | 'production' | 'preview'

export default function DeploymentPage() {
  const token = process.env.NEXT_PUBLIC_VERCEL_TOKEN
  const teamId = process.env.NEXT_PUBLIC_VERCEL_TEAM_ID

  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [redeploying, setRedeploying] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)
    try {
      const url = new URL('https://api.vercel.com/v6/deployments')
      url.searchParams.set('limit', '20')
      if (teamId) url.searchParams.set('teamId', teamId)

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`Vercel API error: ${res.status}`)
      const json = await res.json() as { deployments: Record<string, unknown>[] }

      const mapped: Deployment[] = (json.deployments ?? []).map((d: Record<string, unknown>) => {
        const meta = (d.meta ?? {}) as Record<string, string>
        const creator = (d.creator ?? {}) as Record<string, string>
        const buildingAt = typeof d.buildingAt === 'number' ? d.buildingAt : 0
        const createdAt = typeof d.createdAt === 'number' ? d.createdAt : 0
        return {
          id: String(d.uid ?? d.id ?? ''),
          sha: (meta.githubCommitSha ?? '').slice(0, 7) || '—',
          branch: meta.githubCommitRef ?? 'main',
          message: (meta.githubCommitMessage ?? 'No commit message').slice(0, 60),
          status: mapState(String(d.state ?? '')),
          environment: (String(d.target ?? 'preview') === 'production' ? 'production' : 'preview') as EnvType,
          deployedBy: creator.email ?? '—',
          deployedAt: createdAt,
          duration: buildingAt && createdAt ? Math.round((buildingAt - createdAt) / 1000) : 0,
          url: d.url ? `https://${String(d.url)}` : '',
        }
      })
      setDeployments(mapped)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deployments')
    }
    setLoading(false)
  }, [token, teamId])

  useEffect(() => { void load() }, [load])

  const redeploy = useCallback(async (dep: Deployment) => {
    if (!token) return
    setRedeploying(dep.id)
    try {
      const url = new URL('https://api.vercel.com/v13/deployments')
      if (teamId) url.searchParams.set('teamId', teamId)
      await fetch(url.toString(), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ deploymentId: dep.id, name: dep.branch }),
      })
      void load()
    } catch { /* ignore */ }
    setRedeploying(null)
  }, [token, teamId, load])

  const filtered = filter === 'all' ? deployments : deployments.filter(d => d.environment === filter)
  const successCount = deployments.filter(d => d.status === 'success').length
  const successRate = deployments.length > 0 ? Math.round((successCount / deployments.length) * 100) : 0
  const avgDuration = deployments.length > 0
    ? Math.round(deployments.filter(d => d.duration > 0).reduce((s, d) => s + d.duration, 0) / Math.max(1, deployments.filter(d => d.duration > 0).length))
    : 0

  if (!token) {
    return (
      <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
        <TopBar title="Deployment Console" subtitle="Vercel deployment management" />
        <div className="p-6 max-w-[800px] mx-auto">
          <div style={{ ...CARD_STYLE, padding: '40px', textAlign: 'center' }}>
            <div className="text-[40px] mb-4">🔧</div>
            <h2 className="text-[18px] font-bold mb-2" style={{ color: 'var(--tx-1)' }}>Setup Required</h2>
            <p className="text-[14px] mb-6" style={{ color: 'var(--tx-2)' }}>Add your Vercel credentials to enable the deployment console.</p>
            <div style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, padding: '20px', textAlign: 'left' }}>
              <p className="text-[13px] font-mono mb-3" style={{ color: 'var(--tx-2)' }}>Add to your <code style={{ color: '#06B6D4' }}>.env.local</code>:</p>
              <pre className="text-[12px] font-mono" style={{ color: '#34D399' }}>{`NEXT_PUBLIC_VERCEL_TOKEN=your_vercel_api_token
NEXT_PUBLIC_VERCEL_TEAM_ID=team_xxxxxxxxx`}</pre>
            </div>
            <p className="text-[12px] mt-4" style={{ color: 'var(--tx-3)' }}>
              Get your token from: vercel.com/account/tokens
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Deployment Console" subtitle="Vercel deployment management" />

      <div className="p-6 max-w-[1400px] mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Deployments', value: deployments.length.toString(), color: '#38BDF8' },
            { label: 'Success Rate',      value: `${successRate}%`,             color: successRate >= 90 ? '#34D399' : successRate >= 70 ? '#FBBF24' : '#F87171' },
            { label: 'Avg Build Time',    value: avgDuration > 0 ? `${avgDuration}s` : '—', color: '#A78BFA' },
          ].map(kpi => (
            <div key={kpi.label} style={{ ...CARD_STYLE, padding: '18px 20px' }}>
              <p className="text-[11px] uppercase tracking-wide mb-1 font-semibold" style={{ color: 'var(--tx-3)' }}>{kpi.label}</p>
              <p className="text-[26px] font-bold font-display" style={{ color: kpi.color }}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Filter + list */}
        <div style={{ ...CARD_STYLE, padding: '24px' }}>
          <div className="flex items-center gap-3 mb-4">
            {(['all', 'production', 'preview'] as FilterType[]).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold capitalize transition-all"
                style={{
                  backgroundColor: filter === f ? 'rgba(6,182,212,0.15)' : 'var(--bg-elevated)',
                  color: filter === f ? '#06B6D4' : 'var(--tx-2)',
                  border: filter === f ? '1px solid rgba(6,182,212,0.3)' : '1px solid var(--border)',
                }}
              >
                {f}
              </button>
            ))}
            <button onClick={() => void load()} className="ml-auto text-[12px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)' }}>
              Refresh
            </button>
          </div>

          {loading ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>Loading deployments…</p>
          ) : error ? (
            <div className="py-4">
              <p className="text-[13px]" style={{ color: '#F87171' }}>Error: {error}</p>
              <button onClick={() => void load()} className="mt-2 text-[12px] px-3 py-1.5 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>Retry</button>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>No deployments found.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map(dep => {
                const ss = STATUS_STYLE[dep.status]
                const es = ENV_STYLE[dep.environment]
                return (
                  <div key={dep.id} style={{ backgroundColor: 'var(--bg-elevated)', borderRadius: 12, padding: '16px', border: '1px solid var(--border)' }}>
                    <div className="flex items-start gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-mono text-[12px] px-1.5 rounded" style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4' }}>{dep.sha}</span>
                          <span className="text-[12px] font-medium" style={{ color: 'var(--tx-2)' }}>#{dep.branch}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ color: es.text, backgroundColor: es.bg, borderColor: es.border }}>{dep.environment}</span>
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border" style={{ color: ss.text, backgroundColor: ss.bg, borderColor: ss.border }}>{ss.label}</span>
                        </div>
                        <p className="text-[13px] font-medium mb-1 truncate" style={{ color: 'var(--tx-1)' }}>{dep.message}</p>
                        <p className="text-[12px]" style={{ color: 'var(--tx-3)' }}>
                          {dep.deployedBy} · {timeDiff(dep.deployedAt)}{dep.duration > 0 ? ` · ${dep.duration}s` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {dep.url && (
                          <a
                            href={dep.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                            style={{ backgroundColor: 'rgba(52,211,153,0.1)', color: '#34D399', border: '1px solid rgba(52,211,153,0.3)' }}
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => void redeploy(dep)}
                          disabled={redeploying === dep.id}
                          className="px-3 py-1.5 rounded-lg text-[12px] font-semibold transition-all"
                          style={{ backgroundColor: 'rgba(6,182,212,0.1)', color: '#06B6D4', border: '1px solid rgba(6,182,212,0.2)', opacity: redeploying === dep.id ? 0.6 : 1 }}
                        >
                          {redeploying === dep.id ? 'Redeploying…' : 'Redeploy'}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

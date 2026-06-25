'use client'

import { useState } from 'react'

interface Deployment {
  id: string
  sha: string
  branch: string
  message: string
  status: 'success' | 'failed' | 'building'
  environment: string
  deployedBy: string
  deployedAt: string
  duration: number
  url: string
}

const MOCK_DEPLOYMENTS: Deployment[] = [
  { id: 'dep-001', sha: 'a3f89c2', branch: 'main', message: 'feat: add three department rooms', status: 'success', environment: 'production', deployedBy: 'yvonne2okis@gmail.com', deployedAt: new Date(Date.now() - 3600000).toISOString(), duration: 62, url: 'https://workstation-admin.vercel.app' },
  { id: 'dep-002', sha: '64486a4', branch: 'main', message: 'feat: add staff management system', status: 'success', environment: 'production', deployedBy: 'yvonne2okis@gmail.com', deployedAt: new Date(Date.now() - 7200000 * 2).toISOString(), duration: 58, url: 'https://workstation-admin.vercel.app' },
  { id: 'dep-003', sha: 'e017fec', branch: 'main', message: 'feat: build support ticket system', status: 'success', environment: 'production', deployedBy: 'yvonne2okis@gmail.com', deployedAt: new Date(Date.now() - 7200000 * 4).toISOString(), duration: 71, url: 'https://workstation-admin.vercel.app' },
  { id: 'dep-004', sha: '3a91bc5', branch: 'feature/live-chat', message: 'fix: live chat filter labels', status: 'success', environment: 'preview', deployedBy: 'yvonne2okis@gmail.com', deployedAt: new Date(Date.now() - 7200000 * 6).toISOString(), duration: 48, url: 'https://workstation-admin-git-feature-live-chat.vercel.app' },
  { id: 'dep-005', sha: 'b7f234e', branch: 'main', message: 'chore: update dependencies', status: 'failed', environment: 'production', deployedBy: 'yvonne2okis@gmail.com', deployedAt: new Date(Date.now() - 7200000 * 8).toISOString(), duration: 33, url: '' },
]

const STATUS_STYLES: Record<string, string> = {
  success: 'bg-green-900/20 text-green-400 border-green-800/30',
  failed: 'bg-red-900/20 text-red-400 border-red-800/30',
  building: 'bg-blue-900/20 text-blue-400 border-blue-800/30 animate-pulse',
}

const ENV_STYLES: Record<string, string> = {
  production: 'bg-orange-900/20 text-orange-400 border-orange-800/30',
  preview: 'bg-purple-900/20 text-purple-400 border-purple-800/30',
}

function formatDate(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

export default function DeploymentPage() {
  const [selected, setSelected] = useState<Deployment | null>(null)
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null)

  function handleRollback(dep: Deployment) {
    setRollbackTarget(dep.id)
    setTimeout(() => setRollbackTarget(null), 3000)
  }

  return (
    <div className="flex flex-col">
      <div className="px-8 py-6 border-b border-surface-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold font-display text-text-primary">Deployment Console</h1>
            <p className="text-sm text-text-secondary mt-0.5">Deployment history and rollback controls. Live data available after Vercel API token is configured.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-900/20 border border-yellow-800/30 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
            <span className="text-xs text-yellow-400 font-semibold">Mock data — wire Vercel API token to go live</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        <div className="flex-1 overflow-y-auto px-8 py-4">
          <div className="space-y-2">
            {MOCK_DEPLOYMENTS.map((dep, idx) => (
              <button key={dep.id} onClick={() => setSelected(dep)}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl border text-left transition-colors ${selected?.id === dep.id ? 'bg-tech-900/20 border-tech-800/30' : 'bg-surface-card border-surface-border hover:bg-surface-elevated'}`}>
                <div className="flex-shrink-0">
                  {dep.status === 'success' ? (
                    <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  ) : dep.status === 'failed' ? (
                    <div className="w-8 h-8 rounded-full bg-red-900/30 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-blue-900/30 flex items-center justify-center animate-spin">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-text-primary truncate">{dep.message}</p>
                    {idx === 0 && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-tech-900/30 text-tech-400 border border-tech-800/30 flex-shrink-0">CURRENT</span>}
                  </div>
                  <p className="text-xs text-text-muted font-mono mt-0.5">{dep.sha} · {dep.branch}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${ENV_STYLES[dep.environment] ?? ''}`}>{dep.environment}</span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${STATUS_STYLES[dep.status] ?? ''}`}>{dep.status}</span>
                  <span className="text-xs text-text-muted">{formatDate(dep.deployedAt)}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {selected && (
          <div className="w-80 flex-shrink-0 border-l border-surface-border overflow-y-auto">
            <div className="px-5 py-4 border-b border-surface-border flex items-center justify-between">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Deployment Details</p>
              <button onClick={() => setSelected(null)} className="text-text-muted hover:text-text-primary text-xs">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Commit</p>
                <p className="text-sm text-text-primary font-mono mt-0.5">{selected.sha}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Message</p>
                <p className="text-sm text-text-primary mt-0.5">{selected.message}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Branch</p>
                <p className="text-sm text-text-primary font-mono mt-0.5">{selected.branch}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Environment</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize mt-0.5 inline-block ${ENV_STYLES[selected.environment] ?? ''}`}>{selected.environment}</span>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Status</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full border capitalize mt-0.5 inline-block ${STATUS_STYLES[selected.status] ?? ''}`}>{selected.status}</span>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Deployed by</p>
                <p className="text-sm text-text-primary mt-0.5">{selected.deployedBy}</p>
              </div>
              <div>
                <p className="text-[10px] text-text-muted uppercase tracking-wider">Duration</p>
                <p className="text-sm text-text-primary mt-0.5">{selected.duration}s</p>
              </div>
              {selected.url && (
                <div>
                  <p className="text-[10px] text-text-muted uppercase tracking-wider">URL</p>
                  <p className="text-xs text-tech-400 font-mono mt-0.5 break-all">{selected.url}</p>
                </div>
              )}
              <div className="pt-3 border-t border-surface-border space-y-2">
                <button
                  onClick={() => handleRollback(selected)}
                  className={`w-full py-2.5 rounded-xl text-xs font-semibold transition-colors ${rollbackTarget === selected.id ? 'bg-yellow-900/30 text-yellow-400 border border-yellow-800/30' : 'bg-surface-elevated border border-surface-border text-text-secondary hover:text-text-primary'}`}
                >
                  {rollbackTarget === selected.id ? '↩ Rollback triggered (mock)' : '↩ Rollback to this deploy'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

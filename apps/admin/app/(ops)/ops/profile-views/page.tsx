'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTabClient as createClient } from '@/lib/supabase/tab-client'
import TopBar from '@/components/layout/TopBar'

const CARD = { backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-card)' }

interface ProfileView {
  id: string
  viewer_id: string | null
  viewed_profile_id: string
  viewed_at: string
  ip_address: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function maskIp(ip: string | null) {
  if (!ip) return '—'
  const parts = ip.split('.')
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.***. ***`
  return ip.slice(0, 6) + '***'
}

export default function ProfileViewsPage() {
  const supabase = createClient()
  const [views, setViews] = useState<ProfileView[]>([])
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [flagged, setFlagged] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('profile_views')
      .select('*')
      .order('viewed_at', { ascending: false })
      .limit(500)
    setViews((data ?? []) as ProfileView[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { void load() }, [load])

  async function flagViewer(view: ProfileView) {
    if (!view.viewer_id) return
    setActing(view.viewer_id)
    await supabase.from('flagged_content').insert({
      content_type: 'user',
      content_id: view.viewer_id,
      reason: 'Flagged for suspicious profile view pattern',
      severity: 'medium',
      status: 'pending',
    })
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('audit_logs').insert({
      event: 'admin.viewer_flagged',
      actor_email: user?.email ?? null,
      actor_id: user?.id ?? null,
      actor_type: 'admin',
      target_id: view.viewer_id,
      target_type: 'user',
      severity: 'warning',
      app: 'admin_panel',
    })
    setFlagged(prev => new Set([...prev, view.viewer_id!]))
    setActing(null)
  }

  const now = Date.now()
  const day = views.filter(v => new Date(v.viewed_at).getTime() > now - 86400000)
  const week = views.filter(v => new Date(v.viewed_at).getTime() > now - 7 * 86400000)
  const uniqueViewers = new Set(views.map(v => v.viewer_id).filter(Boolean)).size

  // Detect stalking: >10 views of same profile by same viewer
  const pairCounts: Record<string, number> = {}
  views.forEach(v => {
    if (v.viewer_id) {
      const key = `${v.viewer_id}::${v.viewed_profile_id}`
      pairCounts[key] = (pairCounts[key] ?? 0) + 1
    }
  })
  const stalkingPairs = Object.entries(pairCounts).filter(([, c]) => c > 10)
  const flaggedViewerIds = new Set(stalkingPairs.map(([key]) => key.split('::')[0]))

  // Hourly breakdown for last 24h
  const hourlyMap: Record<number, number> = {}
  for (let h = 23; h >= 0; h--) hourlyMap[h] = 0
  day.forEach(v => {
    const hr = new Date(v.viewed_at).getHours()
    hourlyMap[hr] = (hourlyMap[hr] ?? 0) + 1
  })
  const maxHourly = Math.max(...Object.values(hourlyMap), 1)

  // Top viewed profiles
  const profileViewCounts: Record<string, number> = {}
  views.forEach(v => { profileViewCounts[v.viewed_profile_id] = (profileViewCounts[v.viewed_profile_id] ?? 0) + 1 })
  const topProfiles = Object.entries(profileViewCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      <TopBar title="Profile View Analytics" subtitle="Monitor profile views and detect unusual viewing patterns" />
      <div className="p-6 space-y-5">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Views (24h)', value: day.length, color: '#38BDF8' },
            { label: 'Views (7 days)', value: week.length, color: '#F59E0B' },
            { label: 'Unique Viewers', value: uniqueViewers, color: '#A78BFA' },
            { label: 'Flagged Patterns', value: stalkingPairs.length, color: stalkingPairs.length > 0 ? '#F87171' : '#34D399' },
          ].map(s => (
            <div key={s.label} style={CARD} className="p-5">
              <p className="text-[24px] font-bold font-display" style={{ color: s.color }}>{s.value}</p>
              <p className="text-[12px] font-semibold mt-1" style={{ color: 'var(--tx-3)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Stalking alert */}
        {stalkingPairs.length > 0 && (
          <div style={{ padding: '12px 16px', borderRadius: 12, backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#F87171', marginBottom: 4 }}>Suspicious View Patterns Detected</p>
            <p style={{ fontSize: 12, color: 'var(--tx-3)', marginBottom: 8 }}>
              {stalkingPairs.length} viewer{stalkingPairs.length > 1 ? 's have' : ' has'} viewed the same profile more than 10 times.
            </p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {stalkingPairs.slice(0, 5).map(([key, count]) => {
                const [viewerId, profileId] = key.split('::')
                return (
                  <span key={key} style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    {viewerId.slice(0, 8)}… → {profileId.slice(0, 8)}… · {count}×
                  </span>
                )
              })}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-5">
          {/* Hourly timeline */}
          <div style={CARD} className="p-5">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 14 }}>View Activity — Last 24 Hours</h3>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 70 }}>
              {Array.from({ length: 24 }, (_, h) => {
                const count = hourlyMap[h] ?? 0
                return (
                  <div key={h} title={`${h}:00 — ${count} views`} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ width: '100%', height: `${(count / maxHourly) * 54}px`, minHeight: 2, backgroundColor: count > 0 ? '#A78BFA' : 'var(--bg-surface)', borderRadius: '2px 2px 0 0' }} />
                    {h % 6 === 0 && <span style={{ fontSize: 8, color: 'var(--tx-3)' }}>{h}h</span>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Top viewed profiles */}
          <div style={CARD} className="p-5">
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 14 }}>Most Viewed Profiles</h3>
            {topProfiles.length === 0 ? (
              <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>No view data yet</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {topProfiles.map(([profileId, count]) => (
                  <div key={profileId}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                      <span style={{ fontSize: 11, color: 'var(--tx-2)', fontFamily: 'monospace' }}>{profileId.slice(0, 16)}…</span>
                      <span style={{ fontSize: 11, color: '#F59E0B', fontWeight: 700 }}>{count} views</span>
                    </div>
                    <div style={{ height: 4, backgroundColor: 'var(--bg-surface)', borderRadius: 2 }}>
                      <div style={{ height: '100%', width: `${(count / (topProfiles[0][1] || 1)) * 100}%`, backgroundColor: '#F59E0B', borderRadius: 2 }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Views table */}
        <div style={{ ...CARD, overflow: 'hidden' }}>
          {loading ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>Loading…</p></div>
          ) : views.length === 0 ? (
            <div className="p-12 text-center"><p style={{ color: 'var(--tx-3)' }}>No profile view data</p></div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  {['Viewer ID', 'Profile ID', 'IP Address', 'Viewed At', 'Pattern', 'Actions'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '11px 14px', fontSize: 11, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.07em', borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {views.slice(0, 100).map(v => {
                  const isSuspect = v.viewer_id ? flaggedViewerIds.has(v.viewer_id) : false
                  return (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border)', backgroundColor: isSuspect ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace' }}>
                        {v.viewer_id ? v.viewer_id.slice(0, 10) + '…' : 'Guest'}
                      </td>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{v.viewed_profile_id.slice(0, 10)}…</td>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{maskIp(v.ip_address)}</td>
                      <td style={{ padding: '9px 14px', fontSize: 11, color: 'var(--tx-3)', whiteSpace: 'nowrap' }}>{formatDate(v.viewed_at)}</td>
                      <td style={{ padding: '9px 14px' }}>
                        {isSuspect && (
                          <span style={{ color: '#F87171', backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>SUSPICIOUS</span>
                        )}
                      </td>
                      <td style={{ padding: '9px 14px' }}>
                        {v.viewer_id && !flagged.has(v.viewer_id) && (
                          <button onClick={() => flagViewer(v)} disabled={acting === v.viewer_id} style={{ padding: '3px 8px', borderRadius: 5, border: '1px solid rgba(239,68,68,0.4)', backgroundColor: 'rgba(239,68,68,0.08)', color: '#F87171', fontSize: 10, cursor: 'pointer', fontWeight: 600 }}>
                            {acting === v.viewer_id ? '…' : 'Flag'}
                          </button>
                        )}
                        {v.viewer_id && flagged.has(v.viewer_id) && (
                          <span style={{ fontSize: 10, color: '#34D399' }}>Flagged</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

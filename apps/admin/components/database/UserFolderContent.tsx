'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createTabClient } from '@/lib/supabase/tab-client'

interface Props {
  userId: string
  room: string
  baseRoute: string
}

interface Profile {
  id: string
  email: string
  phone: string | null
  role: string
  is_active: boolean
  is_suspended: boolean
  suspended_reason: string | null
  device_fingerprint: string | null
  last_seen_at: string | null
  created_at: string
}

interface CandidateProfile {
  first_name: string | null
  last_name: string | null
  other_names: string | null
  nin_number: string | null
  nin_verified: boolean
  liveness_verified: boolean
  phone_verified: boolean
  experience_years: number | null
  profile_completion: number | null
  gender: string | null
  date_of_birth: string | null
  avatar_url: string | null
}

interface CompanyProfile {
  company_name: string | null
  legal_name: string | null
  rc_number: string | null
  cac_verified: boolean
  is_verified: boolean
  business_email: string | null
  business_phone: string | null
  industry: string | null
  company_size: string | null
  headquarters_city: string | null
  logo_url: string | null
  cover_banner_url: string | null
}

interface ActivityLog {
  id: string
  event: string
  created_at: string
  severity: string | null
  ip_address: string | null
  metadata: Record<string, unknown> | null
  screen_name: string | null
  app_version: string | null
}

interface AdminAction {
  id: string
  action: string
  details: Record<string, unknown> | null
  created_at: string
  ip_address: string | null
}

interface ExportLog {
  id: string
  exported_by_email: string
  format: string
  reason: string
  sha256_hash: string
  exported_at: string
  room: string
}

type Tab = 'identity' | 'activity' | 'applications' | 'views' | 'flags' | 'documents' | 'security' | 'export'

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: 'var(--tx-3)' }}>{label}</p>
      <p className={`text-[13px] ${mono ? 'font-mono' : ''}`} style={{ color: value ? 'var(--tx-1)' : 'var(--tx-3)' }}>
        {value ?? '—'}
      </p>
    </div>
  )
}

function SeverityBadge({ severity }: { severity: string | null }) {
  const map: Record<string, { color: string; bg: string }> = {
    critical: { color: '#F87171', bg: 'rgba(239,68,68,0.1)' },
    high:     { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)' },
    medium:   { color: '#38BDF8', bg: 'rgba(56,189,248,0.1)' },
    low:      { color: '#34D399', bg: 'rgba(52,211,153,0.1)' },
    info:     { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)' },
  }
  const s = severity?.toLowerCase() ?? 'info'
  const c = map[s] ?? map.info
  return (
    <span style={{ color: c.color, backgroundColor: c.bg, border: `1px solid ${c.color}40`, borderRadius: '5px', fontSize: '10px', fontWeight: 700, padding: '2px 6px', textTransform: 'uppercase' }}>
      {s}
    </span>
  )
}

export default function UserFolderContent({ userId, room, baseRoute }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('identity')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null)
  const [companyProfile, setCompanyProfile] = useState<CompanyProfile | null>(null)
  const [activity, setActivity] = useState<ActivityLog[]>([])
  const [adminActions, setAdminActions] = useState<AdminAction[]>([])
  const [exportLogs, setExportLogs] = useState<ExportLog[]>([])
  const [loading, setLoading] = useState(true)
  const [ninRevealed, setNinRevealed] = useState(false)
  const [isOnLegalHold, setIsOnLegalHold] = useState(false)
  const [legalHoldLoading, setLegalHoldLoading] = useState(false)

  // Export tab state
  const [exportReason, setExportReason] = useState('')
  const [exportLoading, setExportLoading] = useState<'json' | 'pdf' | null>(null)

  const loadData = useCallback(async () => {
    const supabase = createTabClient()
    setLoading(true)

    const [profileRes, activityRes, adminActionsRes, exportLogsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select(`
          id, email, phone, role, is_active, is_suspended,
          suspended_reason, device_fingerprint, last_seen_at, created_at
        `)
        .eq('id', userId)
        .single(),
      supabase
        .from('audit_logs')
        .select('id, event, created_at, severity, ip_address, metadata, screen_name, app_version')
        .or(`actor_id.eq.${userId},target_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('admin_action_log')
        .select('id, action, details, created_at, ip_address')
        .eq('target_id', userId)
        .order('created_at', { ascending: false })
        .limit(50),
      supabase
        .from('data_export_log')
        .select('id, exported_by_email, format, reason, sha256_hash, exported_at, room')
        .eq('target_user_id', userId)
        .order('exported_at', { ascending: false })
        .limit(20),
    ])

    if (profileRes.data) {
      const p = profileRes.data as Profile
      setProfile(p)

      if (p.role === 'candidate') {
        const { data: cp } = await supabase
          .from('candidate_profiles')
          .select('first_name, last_name, other_names, nin_number, nin_verified, liveness_verified, phone_verified, experience_years, profile_completion, gender, date_of_birth, avatar_url')
          .eq('id', userId)
          .maybeSingle()
        if (cp) setCandidateProfile(cp as CandidateProfile)
      } else if (p.role === 'company') {
        const { data: cp } = await supabase
          .from('company_profiles')
          .select('company_name, legal_name, rc_number, cac_verified, is_verified, business_email, business_phone, industry, company_size, headquarters_city, logo_url, cover_banner_url')
          .eq('id', userId)
          .maybeSingle()
        if (cp) setCompanyProfile(cp as CompanyProfile)
      }
    }

    setActivity((activityRes.data ?? []) as ActivityLog[])
    setAdminActions((adminActionsRes.data ?? []) as AdminAction[])
    setExportLogs((exportLogsRes.data ?? []) as ExportLog[])

    // Determine legal hold status from admin_action_log
    const holdActions = (adminActionsRes.data ?? []).filter(
      a => a.action === 'legal_hold_set' || a.action === 'legal_hold_released'
    )
    if (holdActions.length > 0) {
      const latest = holdActions[0]
      setIsOnLegalHold(latest.action === 'legal_hold_set')
    }

    setLoading(false)
  }, [userId])

  useEffect(() => { void loadData() }, [loadData])

  async function handleRevealNin() {
    const supabase = createTabClient()
    const staffEmail = (() => {
      try {
        const s = sessionStorage.getItem('_wk_session')
        return s ? (JSON.parse(s) as { email?: string }).email ?? 'unknown' : 'unknown'
      } catch { return 'unknown' }
    })()
    await supabase.from('admin_action_log').insert({
      action: 'nin_revealed',
      target_type: 'candidate',
      target_id: userId,
      details: { revealed_by: staffEmail, room },
    })
    setNinRevealed(true)
  }

  async function handleLegalHold() {
    setLegalHoldLoading(true)
    const supabase = createTabClient()
    const newAction = isOnLegalHold ? 'legal_hold_released' : 'legal_hold_set'
    await supabase.from('admin_action_log').insert({
      action: newAction,
      target_type: 'profile',
      target_id: userId,
      details: { room, toggled_at: new Date().toISOString() },
    })
    setIsOnLegalHold(!isOnLegalHold)
    setLegalHoldLoading(false)
  }

  async function handleExport(format: 'json' | 'pdf') {
    if (!exportReason.trim()) return
    setExportLoading(format)

    const supabase = createTabClient()
    const staffEmail = (() => {
      try {
        const s = sessionStorage.getItem('_wk_session')
        return s ? (JSON.parse(s) as { email?: string }).email ?? 'unknown' : 'unknown'
      } catch { return 'unknown' }
    })()
    const { data: authData } = await supabase.auth.getUser()
    const staffId = authData?.user?.id ?? null

    const exportData = {
      profile,
      candidateProfile,
      companyProfile,
      activityLog: activity,
      adminActions,
      exportedAt: new Date().toISOString(),
      exportedBy: staffEmail,
      room,
      reason: exportReason,
    }

    const jsonStr = JSON.stringify(exportData, null, 2)
    const hash = await sha256(jsonStr)

    await supabase.from('data_export_log').insert({
      exported_by_email: staffEmail,
      exported_by_id: staffId,
      target_user_id: userId,
      reason: exportReason.trim(),
      format,
      sha256_hash: hash,
      room,
    })

    if (format === 'json') {
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-data-${userId.slice(0, 8)}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
    } else {
      const displayName = candidateProfile
        ? `${candidateProfile.first_name ?? ''} ${candidateProfile.last_name ?? ''}`.trim()
        : companyProfile?.company_name ?? profile?.email ?? userId

      const w = window.open('', '_blank', 'width=900,height=700')
      if (w) {
        w.document.write(`<!DOCTYPE html><html><head><title>User Data Export</title>
          <style>body{font-family:sans-serif;padding:40px;color:#111;line-height:1.6}
          h1{color:#3730A3;border-bottom:2px solid #3730A3;padding-bottom:8px}
          .meta{background:#f5f5f5;padding:16px;border-radius:8px;margin:16px 0;font-size:13px}
          .section{margin:20px 0}h2{font-size:16px;color:#374151;margin-bottom:8px}
          pre{background:#f9f9f9;border:1px solid #e5e7eb;padding:16px;border-radius:8px;font-size:11px;overflow-wrap:break-word;white-space:pre-wrap}
          .hash{font-family:monospace;font-size:10px;color:#6B7280;word-break:break-all}
          </style></head><body>
          <h1>Workstation — User Data Export</h1>
          <div class="meta">
            <strong>Subject:</strong> ${displayName}<br/>
            <strong>User ID:</strong> ${userId}<br/>
            <strong>Exported by:</strong> ${staffEmail}<br/>
            <strong>Room:</strong> ${room}<br/>
            <strong>Exported at:</strong> ${new Date().toISOString()}<br/>
            <strong>Reason:</strong> ${exportReason}
          </div>
          <div class="section"><h2>Chain of Custody</h2>
          <p class="hash">SHA-256: ${hash}</p></div>
          <div class="section"><h2>Data</h2><pre>${jsonStr.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre></div>
          </body></html>`)
        w.document.close()
        w.print()
      }
    }

    await loadData()
    setExportLoading(null)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'identity',     label: 'Identity' },
    { key: 'activity',     label: 'Activity Timeline' },
    { key: 'applications', label: 'Applications / Jobs' },
    { key: 'views',        label: 'Views & Interactions' },
    { key: 'flags',        label: 'Flags & Incidents' },
    { key: 'documents',    label: 'Documents' },
    { key: 'security',     label: 'Security' },
    { key: 'export',       label: 'Export' },
  ]

  const CARD = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-card)',
  }

  if (loading) {
    return (
      <div className="p-6">
        <div style={{ ...CARD, padding: '60px', textAlign: 'center', color: 'var(--tx-3)', fontSize: '13px' }}>
          Loading user folder…
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="p-6">
        <div style={{ ...CARD, padding: '60px', textAlign: 'center', color: '#F87171', fontSize: '13px' }}>
          User not found.
        </div>
      </div>
    )
  }

  const displayName = candidateProfile
    ? [candidateProfile.first_name, candidateProfile.other_names, candidateProfile.last_name].filter(Boolean).join(' ')
    : companyProfile?.company_name ?? profile.email

  return (
    <div className="p-6 space-y-5">
      {/* Deleted account banner */}
      {!profile.is_active && (
        <div style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', padding: '12px 20px' }}
          className="flex items-center gap-3">
          <span style={{ color: '#F87171', fontSize: '18px' }}>⚠</span>
          <p style={{ color: '#F87171', fontSize: '13px', fontWeight: 600 }}>
            DELETED ACCOUNT — This user has been deactivated. Data is retained for audit purposes.
          </p>
        </div>
      )}

      {/* Legal hold banner */}
      {isOnLegalHold && (
        <div style={{ backgroundColor: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: '12px', padding: '12px 20px' }}
          className="flex items-center gap-3">
          <span style={{ color: '#FBBF24', fontSize: '18px' }}>🔒</span>
          <p style={{ color: '#FBBF24', fontSize: '13px', fontWeight: 600 }}>
            LEGAL HOLD ACTIVE — Data deletion is frozen pending investigation.
          </p>
        </div>
      )}

      {/* User header card */}
      <div style={{ ...CARD, padding: '24px 28px' }} className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div style={{
            width: '52px', height: '52px', borderRadius: '14px', flexShrink: 0,
            backgroundColor: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '18px', fontWeight: 700, color: '#818CF8',
            overflow: 'hidden',
          }}>
            {(candidateProfile?.avatar_url || companyProfile?.logo_url)
              ? <img
                  src={(candidateProfile?.avatar_url ?? companyProfile?.logo_url) as string}
                  alt={displayName}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              : (displayName[0] ?? '?').toUpperCase()
            }
          </div>
          <div>
            <h2 className="text-[18px] font-bold font-display" style={{ color: 'var(--tx-1)' }}>{displayName}</h2>
            <p className="text-[13px]" style={{ color: 'var(--tx-3)' }}>{profile.email} · {profile.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(baseRoute)}
            style={{ padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-3)' }}
          >
            ← Back to Database
          </button>
          <button
            onClick={handleLegalHold}
            disabled={legalHoldLoading}
            style={{
              padding: '7px 14px', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
              border: `1px solid ${isOnLegalHold ? 'rgba(251,191,36,0.4)' : 'rgba(239,68,68,0.4)'}`,
              backgroundColor: isOnLegalHold ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.08)',
              color: isOnLegalHold ? '#FBBF24' : '#F87171',
            }}
          >
            {legalHoldLoading ? '…' : isOnLegalHold ? 'Release Legal Hold' : 'Set Legal Hold'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ ...CARD, overflow: 'hidden' }}>
        {/* Tab strip */}
        <div className="flex overflow-x-auto border-b" style={{ borderColor: 'var(--border)' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '12px 18px', fontSize: '13px', fontWeight: 600, flexShrink: 0,
                cursor: 'pointer', border: 'none',
                borderBottom: `2px solid ${activeTab === t.key ? '#6366F1' : 'transparent'}`,
                backgroundColor: 'transparent',
                color: activeTab === t.key ? '#818CF8' : 'var(--tx-3)',
                transition: 'color 0.15s',
              }}
            >
              {t.label}
              {t.key === 'export' && (
                <span style={{ marginLeft: '6px', fontSize: '10px', backgroundColor: 'rgba(99,102,241,0.15)', color: '#818CF8', borderRadius: '4px', padding: '1px 5px' }}>
                  {exportLogs.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="p-6">

          {/* ── IDENTITY ── */}
          {activeTab === 'identity' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                <Field label="Email" value={profile.email} />
                <Field label="Phone" value={profile.phone} />
                <Field label="Role" value={profile.role} />
                <Field label="Status" value={
                  profile.is_suspended ? `Suspended — ${profile.suspended_reason ?? 'no reason given'}` :
                  profile.is_active ? 'Active' : 'Deleted'
                } />
                <Field label="Last Seen" value={fmtDateTime(profile.last_seen_at)} />
                <Field label="Account Created" value={fmtDateTime(profile.created_at)} />
                <Field label="Device Fingerprint" value={profile.device_fingerprint} mono />
                <Field label="User ID" value={profile.id} mono />
              </div>

              {candidateProfile && (
                <>
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                    <p className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--tx-3)' }}>Candidate Info</p>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <Field label="Full Name" value={[candidateProfile.first_name, candidateProfile.other_names, candidateProfile.last_name].filter(Boolean).join(' ')} />
                      <Field label="Gender" value={candidateProfile.gender} />
                      <Field label="Date of Birth" value={candidateProfile.date_of_birth} />
                      <Field label="Experience Years" value={candidateProfile.experience_years?.toString() ?? null} />
                      <Field label="Profile Completion" value={candidateProfile.profile_completion ? `${candidateProfile.profile_completion}%` : null} />
                      <Field label="Verifications" value={[
                        candidateProfile.nin_verified ? 'NIN ✓' : null,
                        candidateProfile.liveness_verified ? 'Liveness ✓' : null,
                        candidateProfile.phone_verified ? 'Phone ✓' : null,
                      ].filter(Boolean).join('  ') || 'None'} />
                    </div>

                    {/* Profile photo */}
                    {candidateProfile.avatar_url && (
                      <div className="mt-4">
                        <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tx-3)' }}>Profile Photo</p>
                        <img
                          src={candidateProfile.avatar_url}
                          alt="Profile"
                          style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)' }}
                        />
                      </div>
                    )}

                    {/* NIN (masked + reveal) */}
                    <div className="mt-4">
                      <p className="text-[11px] font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--tx-3)' }}>NIN</p>
                      <div className="flex items-center gap-3">
                        <p className="text-[13px] font-mono" style={{ color: 'var(--tx-1)' }}>
                          {ninRevealed
                            ? (candidateProfile.nin_number ?? '—')
                            : candidateProfile.nin_number
                              ? candidateProfile.nin_number.slice(0, 3) + '•'.repeat(8)
                              : '—'}
                        </p>
                        {candidateProfile.nin_number && !ninRevealed && (
                          <button
                            onClick={handleRevealNin}
                            style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer', border: '1px solid rgba(251,191,36,0.4)', backgroundColor: 'rgba(251,191,36,0.08)', color: '#FBBF24' }}
                          >
                            Reveal (logged)
                          </button>
                        )}
                        {ninRevealed && (
                          <span style={{ fontSize: '11px', color: '#34D399' }}>Reveal logged to audit trail</span>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {companyProfile && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                  <p className="text-[12px] font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--tx-3)' }}>Company Info</p>
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    <Field label="Company Name" value={companyProfile.company_name} />
                    <Field label="Legal Name" value={companyProfile.legal_name} />
                    <Field label="RC Number" value={companyProfile.rc_number} mono />
                    <Field label="Industry" value={companyProfile.industry} />
                    <Field label="Size" value={companyProfile.company_size} />
                    <Field label="City" value={companyProfile.headquarters_city} />
                    <Field label="Business Email" value={companyProfile.business_email} />
                    <Field label="Business Phone" value={companyProfile.business_phone} />
                    <Field label="CAC Verified" value={companyProfile.cac_verified ? 'Yes ✓' : 'No'} />
                    <Field label="Platform Verified" value={companyProfile.is_verified ? 'Yes ✓' : 'No'} />
                  </div>

                  {/* Logo + Banner */}
                  {(companyProfile.logo_url || companyProfile.cover_banner_url) && (
                    <div className="mt-5 space-y-4">
                      {companyProfile.logo_url && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tx-3)' }}>Company Logo</p>
                          <img
                            src={companyProfile.logo_url}
                            alt="Company Logo"
                            style={{ width: '80px', height: '80px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                        </div>
                      )}
                      {companyProfile.cover_banner_url && (
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--tx-3)' }}>Cover Banner</p>
                          <img
                            src={companyProfile.cover_banner_url}
                            alt="Cover Banner"
                            style={{ width: '100%', maxWidth: '480px', height: '120px', borderRadius: '12px', objectFit: 'cover', border: '1px solid var(--border)' }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ACTIVITY TIMELINE ── */}
          {activeTab === 'activity' && (
            <div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                All events where this user was the actor or target — sourced generically from the audit log. New mobile features automatically appear here.
              </p>
              {activity.length === 0 ? (
                <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No activity found.</p>
              ) : (
                <div className="space-y-2">
                  {activity.map(a => (
                    <div key={a.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <p className="text-[13px] font-semibold font-mono" style={{ color: 'var(--tx-1)' }}>{a.event}</p>
                            <SeverityBadge severity={a.severity} />
                            {a.screen_name && (
                              <span style={{ fontSize: '10px', color: '#818CF8', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '4px', padding: '1px 5px' }}>
                                {a.screen_name}
                              </span>
                            )}
                            {a.app_version && (
                              <span style={{ fontSize: '10px', color: 'var(--tx-3)' }}>v{a.app_version}</span>
                            )}
                          </div>
                          {a.metadata && Object.keys(a.metadata).length > 0 && (
                            <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--tx-3)', wordBreak: 'break-all' }}>
                              {JSON.stringify(a.metadata).slice(0, 120)}{JSON.stringify(a.metadata).length > 120 ? '…' : ''}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                          {a.ip_address && <p className="text-[10px] font-mono" style={{ color: 'var(--tx-3)' }}>{a.ip_address}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── APPLICATIONS / JOBS ── */}
          {activeTab === 'applications' && (
            <div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                {profile.role === 'candidate'
                  ? 'Job applications submitted by this candidate — derived from audit log events.'
                  : 'Job posts and recruitment activity for this company — derived from audit log events.'}
              </p>
              {(() => {
                const appEvents = activity.filter(a => {
                  const ev = a.event.toLowerCase()
                  return profile.role === 'candidate'
                    ? ev.includes('application') || ev.includes('apply') || ev.includes('job')
                    : ev.includes('job') || ev.includes('post') || ev.includes('recruit')
                })
                return appEvents.length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No application/job events found in audit log.</p>
                ) : (
                  <div className="space-y-2">
                    {appEvents.map(a => (
                      <div key={a.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-[13px] font-semibold font-mono" style={{ color: 'var(--tx-1)' }}>{a.event}</p>
                            {a.metadata && (
                              <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--tx-3)' }}>
                                {JSON.stringify(a.metadata).slice(0, 100)}
                              </p>
                            )}
                          </div>
                          <p className="text-[11px] flex-shrink-0" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── VIEWS & INTERACTIONS ── */}
          {activeTab === 'views' && (
            <div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                Profile views and platform interactions involving this user.
              </p>
              {(() => {
                const viewEvents = activity.filter(a => {
                  const ev = a.event.toLowerCase()
                  return ev.includes('view') || ev.includes('visit') || ev.includes('seen') || ev.includes('interaction')
                })
                return viewEvents.length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No view events found.</p>
                ) : (
                  <div className="space-y-2">
                    {viewEvents.map(a => (
                      <div key={a.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-[13px] font-mono" style={{ color: 'var(--tx-1)' }}>{a.event}</p>
                          <p className="text-[11px] flex-shrink-0" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── FLAGS & INCIDENTS ── */}
          {activeTab === 'flags' && (
            <div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                Admin actions and flagged events targeting this user.
              </p>
              {adminActions.length === 0 && activity.filter(a => a.event.toLowerCase().includes('flag') || a.event.toLowerCase().includes('report') || a.event.toLowerCase().includes('suspend')).length === 0 ? (
                <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No flags or incidents found.</p>
              ) : (
                <div className="space-y-2">
                  {adminActions.map(a => (
                    <div key={a.id} style={{ backgroundColor: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '10px', padding: '12px 16px' }}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-[13px] font-semibold font-mono" style={{ color: '#F87171' }}>{a.action}</p>
                          {a.details && (
                            <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--tx-3)' }}>
                              {JSON.stringify(a.details).slice(0, 120)}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                          {a.ip_address && <p className="text-[10px] font-mono" style={{ color: 'var(--tx-3)' }}>{a.ip_address}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {activeTab === 'documents' && (
            <div>
              <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                Verification documents and data requests submitted by this user.
              </p>
              {(() => {
                const docEvents = activity.filter(a => {
                  const ev = a.event.toLowerCase()
                  return ev.includes('document') || ev.includes('upload') || ev.includes('cac') || ev.includes('nin') || ev.includes('verif')
                })
                return docEvents.length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No document events found in audit log.</p>
                ) : (
                  <div className="space-y-2">
                    {docEvents.map(a => (
                      <div key={a.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                        <div className="flex items-start justify-between gap-4">
                          <p className="text-[13px] font-mono" style={{ color: 'var(--tx-1)' }}>{a.event}</p>
                          <p className="text-[11px] flex-shrink-0" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          )}

          {/* ── SECURITY ── */}
          {activeTab === 'security' && (
            <div className="space-y-5">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--tx-3)' }}>Auth & Login Events</p>
                {(() => {
                  const authEvents = activity.filter(a => {
                    const ev = a.event.toLowerCase()
                    return ev.includes('auth') || ev.includes('login') || ev.includes('logout') || ev.includes('password') || ev.includes('session')
                  })
                  return authEvents.length === 0 ? (
                    <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No auth events found.</p>
                  ) : (
                    <div className="space-y-2">
                      {authEvents.map(a => (
                        <div key={a.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[13px] font-mono" style={{ color: 'var(--tx-1)' }}>{a.event}</p>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-[11px]" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                              {a.ip_address && <p className="text-[10px] font-mono" style={{ color: 'var(--tx-3)' }}>{a.ip_address}</p>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--tx-3)' }}>Admin Access Log (who viewed this folder)</p>
                {exportLogs.length === 0 && adminActions.filter(a => a.action.includes('nin') || a.action.includes('legal_hold')).length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No admin actions recorded for this user.</p>
                ) : (
                  <div className="space-y-2">
                    {adminActions
                      .filter(a => a.action === 'nin_revealed' || a.action === 'legal_hold_set' || a.action === 'legal_hold_released')
                      .map(a => (
                        <div key={a.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '12px 16px' }}>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="text-[13px] font-mono font-semibold" style={{ color: '#FBBF24' }}>{a.action}</p>
                              {a.details && (
                                <p className="text-[11px] font-mono mt-1" style={{ color: 'var(--tx-3)' }}>
                                  {JSON.stringify(a.details).slice(0, 100)}
                                </p>
                              )}
                            </div>
                            <p className="text-[11px] flex-shrink-0" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(a.created_at)}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── EXPORT ── */}
          {activeTab === 'export' && (
            <div className="space-y-6">
              <div style={{ backgroundColor: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '12px', padding: '20px' }}>
                <p className="text-[13px] font-semibold mb-1" style={{ color: 'var(--tx-1)' }}>Export User Data</p>
                <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                  A mandatory reason is required. All exports are permanently logged with a SHA-256 chain of custody hash.
                </p>
                <textarea
                  value={exportReason}
                  onChange={e => setExportReason(e.target.value)}
                  placeholder="State the legal or operational reason for this export (required)…"
                  rows={3}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '10px',
                    border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)',
                    color: 'var(--tx-1)', fontSize: '13px', outline: 'none', resize: 'vertical',
                  }}
                />
                <div className="flex gap-3 mt-3">
                  <button
                    onClick={() => void handleExport('json')}
                    disabled={!exportReason.trim() || !!exportLoading}
                    style={{
                      padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      cursor: !exportReason.trim() || !!exportLoading ? 'default' : 'pointer',
                      border: '1px solid rgba(52,211,153,0.4)',
                      backgroundColor: 'rgba(52,211,153,0.08)', color: '#34D399',
                      opacity: !exportReason.trim() ? 0.5 : 1,
                    }}
                  >
                    {exportLoading === 'json' ? 'Preparing…' : 'Export JSON'}
                  </button>
                  <button
                    onClick={() => void handleExport('pdf')}
                    disabled={!exportReason.trim() || !!exportLoading}
                    style={{
                      padding: '9px 18px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      cursor: !exportReason.trim() || !!exportLoading ? 'default' : 'pointer',
                      border: '1px solid rgba(99,102,241,0.4)',
                      backgroundColor: 'rgba(99,102,241,0.08)', color: '#818CF8',
                      opacity: !exportReason.trim() ? 0.5 : 1,
                    }}
                  >
                    {exportLoading === 'pdf' ? 'Preparing…' : 'Export PDF'}
                  </button>
                </div>
              </div>

              {/* Export history */}
              <div>
                <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: 'var(--tx-3)' }}>Export History ({exportLogs.length})</p>
                {exportLogs.length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No exports yet.</p>
                ) : (
                  <div className="space-y-2">
                    {exportLogs.map(log => (
                      <div key={log.id} style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px 16px' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontSize: '11px', fontWeight: 700, color: '#818CF8', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '4px', padding: '2px 6px', textTransform: 'uppercase' }}>
                                {log.format}
                              </span>
                              <span style={{ fontSize: '12px', color: 'var(--tx-2)' }}>{log.exported_by_email}</span>
                              <span style={{ fontSize: '11px', color: 'var(--tx-3)' }}>({log.room})</span>
                            </div>
                            <p className="text-[12px]" style={{ color: 'var(--tx-2)' }}>{log.reason}</p>
                            <p className="text-[10px] font-mono mt-1" style={{ color: 'var(--tx-3)', wordBreak: 'break-all' }}>
                              SHA-256: {log.sha256_hash}
                            </p>
                          </div>
                          <p className="text-[11px] flex-shrink-0" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(log.exported_at)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import TopBar from '@/components/layout/TopBar'
import { createTabClient } from '@/lib/supabase/tab-client'

interface PasscodeRecord {
  id: string
  email: string
  created_at: string
  updated_at: string
  last_used_at: string | null
  created_by_email?: string
}

interface AccessLogEntry {
  id: string
  staff_email: string
  room: string
  accessed_at: string
  ip_address: string | null
  session_id: string | null
}

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

export default function DatabaseSecurityPage() {
  const [passcodes, setPasscodes] = useState<PasscodeRecord[]>([])
  const [accessLog, setAccessLog] = useState<AccessLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  // Create form state
  const [createEmail, setCreateEmail] = useState('')
  const [createPasscode, setCreatePasscode] = useState('')
  const [createConfirm, setCreateConfirm] = useState('')
  const [createLoading, setCreateLoading] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState<string | null>(null)

  // Change form state
  const [changeTarget, setChangeTarget] = useState<PasscodeRecord | null>(null)
  const [newPasscode, setNewPasscode] = useState('')
  const [newConfirm, setNewConfirm] = useState('')
  const [changeLoading, setChangeLoading] = useState(false)
  const [changeError, setChangeError] = useState<string | null>(null)
  const [changeSuccess, setChangeSuccess] = useState<string | null>(null)

  const [activeSection, setActiveSection] = useState<'list' | 'create' | 'log'>('list')

  function getAdminEmail(): string {
    try {
      const s = sessionStorage.getItem('_wk_session')
      return s ? (JSON.parse(s) as { email?: string }).email ?? 'unknown' : 'unknown'
    } catch { return 'unknown' }
  }

  const loadData = useCallback(async () => {
    const supabase = createTabClient()
    setLoading(true)

    const [passcodesRes, logRes] = await Promise.all([
      supabase
        .from('db_passcodes')
        .select('id, email, created_at, updated_at, last_used_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('db_access_log')
        .select('id, staff_email, room, accessed_at, ip_address, session_id')
        .order('accessed_at', { ascending: false })
        .limit(50),
    ])

    setPasscodes((passcodesRes.data ?? []) as PasscodeRecord[])
    setAccessLog((logRes.data ?? []) as AccessLogEntry[])
    setLoading(false)
  }, [])

  useEffect(() => { void loadData() }, [loadData])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setCreateError(null)
    setCreateSuccess(null)

    if (!createEmail.trim() || !createPasscode.trim()) {
      setCreateError('Email and passcode are required.')
      return
    }
    if (createPasscode !== createConfirm) {
      setCreateError('Passcodes do not match.')
      return
    }
    if (createPasscode.length < 6) {
      setCreateError('Passcode must be at least 6 characters.')
      return
    }

    setCreateLoading(true)
    const supabase = createTabClient()

    const { data: existing } = await supabase
      .from('db_passcodes')
      .select('id')
      .eq('email', createEmail.trim().toLowerCase())
      .maybeSingle()

    if (existing) {
      setCreateError('A passcode already exists for this email. Use "Change Passcode" instead.')
      setCreateLoading(false)
      return
    }

    const hash = await sha256(createPasscode)
    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData?.user?.id ?? null

    const { error } = await supabase.from('db_passcodes').insert({
      email: createEmail.trim().toLowerCase(),
      passcode_hash: hash,
      created_by: adminId,
      updated_by: adminId,
    })

    if (error) {
      setCreateError(error.message)
      setCreateLoading(false)
      return
    }

    await supabase.from('admin_action_log').insert({
      action: 'db_passcode_created',
      target_type: 'staff',
      details: { email: createEmail.trim().toLowerCase(), created_by: getAdminEmail() },
    })

    setCreateSuccess(`Passcode created for ${createEmail.trim().toLowerCase()}`)
    setCreateEmail('')
    setCreatePasscode('')
    setCreateConfirm('')
    setCreateLoading(false)
    void loadData()
  }

  async function handleChange(e: React.FormEvent) {
    e.preventDefault()
    if (!changeTarget) return
    setChangeError(null)
    setChangeSuccess(null)

    if (!newPasscode.trim()) {
      setChangeError('New passcode is required.')
      return
    }
    if (newPasscode !== newConfirm) {
      setChangeError('Passcodes do not match.')
      return
    }
    if (newPasscode.length < 6) {
      setChangeError('Passcode must be at least 6 characters.')
      return
    }

    setChangeLoading(true)
    const supabase = createTabClient()
    const hash = await sha256(newPasscode)
    const { data: authData } = await supabase.auth.getUser()
    const adminId = authData?.user?.id ?? null

    const { error } = await supabase
      .from('db_passcodes')
      .update({
        passcode_hash: hash,
        updated_at: new Date().toISOString(),
        updated_by: adminId,
      })
      .eq('id', changeTarget.id)

    if (error) {
      setChangeError(error.message)
      setChangeLoading(false)
      return
    }

    await supabase.from('admin_action_log').insert({
      action: 'db_passcode_changed',
      target_type: 'staff',
      details: { email: changeTarget.email, changed_by: getAdminEmail() },
    })

    setChangeSuccess(`Passcode updated for ${changeTarget.email}`)
    setNewPasscode('')
    setNewConfirm('')
    setChangeTarget(null)
    setChangeLoading(false)
    void loadData()
  }

  const CARD = {
    backgroundColor: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: '16px',
    boxShadow: 'var(--shadow-card)',
  }

  return (
    <div style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
      <TopBar title="Database Security Pass" subtitle="Manage staff database access passcodes" />

      <div className="p-6 space-y-5">
        {/* Section tabs */}
        <div style={{ ...CARD, padding: '0' }} className="overflow-hidden">
          <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
            {[
              { key: 'list' as const, label: `Registered Passcodes (${passcodes.length})` },
              { key: 'create' as const, label: 'Create Passcode' },
              { key: 'log' as const, label: `Access Log (${accessLog.length})` },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                style={{
                  padding: '14px 20px', fontSize: '13px', fontWeight: 600,
                  cursor: 'pointer', border: 'none',
                  borderBottom: `2px solid ${activeSection === s.key ? '#6366F1' : 'transparent'}`,
                  backgroundColor: 'transparent',
                  color: activeSection === s.key ? '#818CF8' : 'var(--tx-3)',
                }}
              >
                {s.label}
              </button>
            ))}
          </div>

          <div className="p-6">

            {/* ── REGISTERED PASSCODES ── */}
            {activeSection === 'list' && (
              <div>
                {loading ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>Loading…</p>
                ) : passcodes.length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No passcodes registered yet. Create one below.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Email', 'Created', 'Last Updated', 'Last Used', 'Actions'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {passcodes.map((p, i) => (
                        <tr key={p.id} style={{ borderBottom: i < passcodes.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-4 py-3 font-semibold" style={{ color: 'var(--tx-1)' }}>{p.email}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(p.created_at)}</td>
                          <td className="px-4 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(p.updated_at)}</td>
                          <td className="px-4 py-3" style={{ color: p.last_used_at ? 'var(--tx-2)' : 'var(--tx-3)' }}>
                            {fmtDateTime(p.last_used_at)}
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => {
                                setChangeTarget(p)
                                setChangeError(null)
                                setChangeSuccess(null)
                                setNewPasscode('')
                                setNewConfirm('')
                              }}
                              style={{
                                padding: '5px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 600,
                                cursor: 'pointer', border: '1px solid rgba(99,102,241,0.4)',
                                backgroundColor: 'rgba(99,102,241,0.08)', color: '#818CF8',
                              }}
                            >
                              Change Passcode
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Inline change passcode form */}
                {changeTarget && (
                  <div style={{
                    marginTop: '24px',
                    backgroundColor: 'rgba(99,102,241,0.06)',
                    border: '1px solid rgba(99,102,241,0.2)',
                    borderRadius: '12px',
                    padding: '24px',
                  }}>
                    <div className="flex items-center justify-between mb-4">
                      <p className="font-semibold" style={{ color: 'var(--tx-1)', fontSize: '14px' }}>
                        Change Passcode — <span style={{ color: '#818CF8' }}>{changeTarget.email}</span>
                      </p>
                      <button
                        onClick={() => setChangeTarget(null)}
                        style={{ color: 'var(--tx-3)', fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none' }}
                      >
                        ×
                      </button>
                    </div>

                    <form onSubmit={handleChange} className="space-y-3">
                      <div>
                        <label className="text-[12px] font-semibold" style={{ color: 'var(--tx-3)' }}>New Passcode</label>
                        <input
                          type="password"
                          value={newPasscode}
                          onChange={e => setNewPasscode(e.target.value)}
                          placeholder="Enter new passcode (min 6 chars)"
                          style={{ width: '100%', marginTop: '4px', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
                        />
                      </div>
                      <div>
                        <label className="text-[12px] font-semibold" style={{ color: 'var(--tx-3)' }}>Confirm Passcode</label>
                        <input
                          type="password"
                          value={newConfirm}
                          onChange={e => setNewConfirm(e.target.value)}
                          placeholder="Confirm new passcode"
                          style={{ width: '100%', marginTop: '4px', padding: '9px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
                        />
                      </div>
                      {changeError && <p style={{ color: '#F87171', fontSize: '12px' }}>{changeError}</p>}
                      {changeSuccess && <p style={{ color: '#34D399', fontSize: '12px' }}>{changeSuccess}</p>}
                      <button
                        type="submit"
                        disabled={changeLoading}
                        style={{
                          padding: '9px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                          cursor: changeLoading ? 'default' : 'pointer',
                          backgroundColor: '#6366F1', color: 'white', border: 'none',
                        }}
                      >
                        {changeLoading ? 'Updating…' : 'Update Passcode'}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* ── CREATE PASSCODE ── */}
            {activeSection === 'create' && (
              <div style={{ maxWidth: '480px' }}>
                <p className="text-[13px] mb-5" style={{ color: 'var(--tx-3)' }}>
                  Create a database access passcode for a staff member. The passcode is tied to their login email — it only works when they are logged in as that email address.
                </p>
                <form onSubmit={handleCreate} className="space-y-4">
                  <div>
                    <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--tx-3)' }}>Staff Email</label>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={e => setCreateEmail(e.target.value)}
                      placeholder="staff@workstation.com"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--tx-3)' }}>Passcode (min 6 characters)</label>
                    <input
                      type="password"
                      value={createPasscode}
                      onChange={e => setCreatePasscode(e.target.value)}
                      placeholder="Enter passcode"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                  <div>
                    <label className="text-[12px] font-semibold block mb-1" style={{ color: 'var(--tx-3)' }}>Confirm Passcode</label>
                    <input
                      type="password"
                      value={createConfirm}
                      onChange={e => setCreateConfirm(e.target.value)}
                      placeholder="Confirm passcode"
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-base)', color: 'var(--tx-1)', fontSize: '13px', outline: 'none' }}
                    />
                  </div>
                  {createError && <p style={{ color: '#F87171', fontSize: '12px' }}>{createError}</p>}
                  {createSuccess && <p style={{ color: '#34D399', fontSize: '12px' }}>{createSuccess}</p>}
                  <button
                    type="submit"
                    disabled={createLoading}
                    style={{
                      padding: '10px 24px', borderRadius: '8px', fontSize: '13px', fontWeight: 600,
                      cursor: createLoading ? 'default' : 'pointer',
                      backgroundColor: '#6366F1', color: 'white', border: 'none',
                    }}
                  >
                    {createLoading ? 'Creating…' : 'Create Passcode'}
                  </button>
                </form>
              </div>
            )}

            {/* ── ACCESS LOG ── */}
            {activeSection === 'log' && (
              <div>
                <p className="text-[12px] mb-4" style={{ color: 'var(--tx-3)' }}>
                  Every database access attempt — showing who accessed which room, when, and from which session.
                </p>
                {accessLog.length === 0 ? (
                  <p style={{ color: 'var(--tx-3)', fontSize: '13px' }}>No access events recorded yet.</p>
                ) : (
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {['Staff Email', 'Room', 'Accessed At', 'IP Address', 'Session'].map(h => (
                          <th key={h} className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--tx-3)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {accessLog.map((entry, i) => (
                        <tr key={entry.id} style={{ borderBottom: i < accessLog.length - 1 ? '1px solid var(--border)' : 'none' }}>
                          <td className="px-4 py-3 font-semibold" style={{ color: 'var(--tx-1)' }}>{entry.staff_email}</td>
                          <td className="px-4 py-3">
                            <span style={{ color: '#818CF8', backgroundColor: 'rgba(99,102,241,0.1)', borderRadius: '5px', fontSize: '11px', fontWeight: 600, padding: '2px 7px', textTransform: 'capitalize' }}>
                              {entry.room}
                            </span>
                          </td>
                          <td className="px-4 py-3" style={{ color: 'var(--tx-3)' }}>{fmtDateTime(entry.accessed_at)}</td>
                          <td className="px-4 py-3 font-mono text-[11px]" style={{ color: 'var(--tx-3)' }}>{entry.ip_address ?? '—'}</td>
                          <td className="px-4 py-3 font-mono text-[10px]" style={{ color: 'var(--tx-3)' }}>
                            {entry.session_id ? entry.session_id.slice(0, 12) + '…' : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}

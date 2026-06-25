'use client'

import { useState } from 'react'
import TopBar from '@/components/layout/TopBar'
import { MOCK_USERS } from '@/lib/mock-data'

type UserAction = 'suspend' | 'ban' | 'reactivate' | 'note'

function TrustBadge({ score }: { score: number }) {
  const cls = score >= 70
    ? 'bg-trust-high-bg text-trust-high border-trust-high-border'
    : score >= 50
    ? 'bg-trust-mid-bg text-trust-mid border-trust-mid-border'
    : 'bg-trust-low-bg text-trust-low border-trust-low-border'
  return (
    <span className={`text-xs font-mono font-bold border px-2 py-0.5 rounded ${cls}`}>{score}</span>
  )
}

function VerificationBadge({ status }: { status: 'approved' | 'pending' | 'rejected' }) {
  const map = {
    approved: 'bg-trust-high-bg text-trust-high border-trust-high-border',
    pending: 'bg-trust-mid-bg text-trust-mid border-trust-mid-border',
    rejected: 'bg-trust-low-bg text-trust-low border-trust-low-border',
  }
  return (
    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${map[status]}`}>
      {status}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })
}

interface ActionModal {
  userId: string
  userName: string
  action: UserAction
}

export default function UserManagementPage() {
  const [users, setUsers] = useState(MOCK_USERS)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | 'candidate' | 'company'>('all')
  const [actionModal, setActionModal] = useState<ActionModal | null>(null)
  const [note, setNote] = useState('')

  const filtered = users.filter((u) => {
    const matchesSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    const matchesRole = roleFilter === 'all' || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleAction = () => {
    if (!actionModal) return
    if (actionModal.action === 'suspend') {
      setUsers((prev) => prev.map((u) => u.id === actionModal.userId ? { ...u, isSuspended: true } : u))
    } else if (actionModal.action === 'reactivate') {
      setUsers((prev) => prev.map((u) => u.id === actionModal.userId ? { ...u, isSuspended: false } : u))
    } else if (actionModal.action === 'ban') {
      setUsers((prev) => prev.filter((u) => u.id !== actionModal.userId))
    }
    setActionModal(null)
    setNote('')
  }

  const ACTION_DETAILS: Record<UserAction, { label: string; desc: string; btnClass: string }> = {
    suspend: {
      label: 'Suspend Account',
      desc: 'The user will lose access to their account until reactivated by an admin.',
      btnClass: 'bg-warning/15 text-warning border border-warning/30',
    },
    ban: {
      label: 'Permanently Ban',
      desc: 'The account will be permanently deactivated and cannot be recovered.',
      btnClass: 'bg-error/15 text-error border border-error/30',
    },
    reactivate: {
      label: 'Reactivate Account',
      desc: 'Restore access for this suspended user.',
      btnClass: 'bg-trust-high-bg text-trust-high border border-trust-high-border',
    },
    note: {
      label: 'Add Admin Note',
      desc: 'Add a private note visible to other admins on this user profile.',
      btnClass: 'bg-surface-muted text-text-secondary',
    },
  }

  return (
    <div className="flex flex-col min-h-full">
      <TopBar title="User Management" subtitle={`${filtered.length} users matching current filters`} />

      <div className="px-8 py-6 space-y-5">
        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email..."
              className="w-full bg-surface-card border border-surface-border rounded-lg pl-8 pr-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-2">
            {(['all', 'candidate', 'company'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  roleFilter === r ? 'bg-admin-500 text-white' : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface-card rounded-xl border border-surface-border overflow-hidden">
          <table>
            <thead>
              <tr className="border-b border-surface-border">
                {['User', 'Role', 'Trust Score', 'Verification', 'Registered', 'Last Login', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left text-[10px] font-semibold text-text-muted uppercase tracking-wider px-5 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="border-b border-surface-border/50 last:border-0 hover:bg-surface-elevated/30 transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{user.name}</p>
                      <p className="text-xs text-text-secondary">{user.email}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-xs font-semibold capitalize px-2 py-0.5 rounded-full ${
                      user.role === 'company' ? 'bg-admin-900 text-admin-300' : 'bg-teal-900 text-teal-400'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <TrustBadge score={user.trustScore} />
                  </td>
                  <td className="px-5 py-4">
                    <VerificationBadge status={user.verificationStatus} />
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-text-secondary font-mono">{formatDate(user.registeredAt)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="text-xs text-text-secondary font-mono">{formatDate(user.lastLogin)}</span>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider border px-1.5 py-0.5 rounded font-mono ${
                      user.isSuspended
                        ? 'bg-trust-low-bg text-trust-low border-trust-low-border'
                        : 'bg-trust-high-bg text-trust-high border-trust-high-border'
                    }`}>
                      {user.isSuspended ? 'Suspended' : 'Active'}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      {!user.isSuspended ? (
                        <button
                          onClick={() => setActionModal({ userId: user.id, userName: user.name, action: 'suspend' })}
                          className="text-xs text-warning hover:text-amber-400 font-semibold transition-colors"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => setActionModal({ userId: user.id, userName: user.name, action: 'reactivate' })}
                          className="text-xs text-trust-high hover:text-green-400 font-semibold transition-colors"
                        >
                          Reactivate
                        </button>
                      )}
                      <span className="text-surface-border">·</span>
                      <button
                        onClick={() => setActionModal({ userId: user.id, userName: user.name, action: 'ban' })}
                        className="text-xs text-error hover:text-red-400 font-semibold transition-colors"
                      >
                        Ban
                      </button>
                      <span className="text-surface-border">·</span>
                      <button
                        onClick={() => setActionModal({ userId: user.id, userName: user.name, action: 'note' })}
                        className="text-xs text-text-muted hover:text-text-secondary font-semibold transition-colors"
                      >
                        Note
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {actionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-surface-elevated rounded-2xl border border-surface-border w-full max-w-md p-6 space-y-5">
            <div>
              <h3 className="text-base font-semibold font-display text-text-primary">
                {ACTION_DETAILS[actionModal.action].label}
              </h3>
              <p className="text-sm text-text-secondary mt-1">{actionModal.userName}</p>
            </div>
            <div className="bg-surface-muted rounded-lg px-4 py-3">
              <p className="text-sm text-text-secondary">{ACTION_DETAILS[actionModal.action].desc}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-text-secondary mb-2">Note (optional)</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Internal note for audit log..."
                rows={3}
                className="w-full bg-surface-muted border border-surface-border rounded-lg px-3 py-2.5 text-sm text-text-primary placeholder-text-muted focus:border-admin-500 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setActionModal(null); setNote('') }} className="flex-1 py-2.5 rounded-lg bg-surface-muted text-text-secondary text-sm font-semibold">
                Cancel
              </button>
              <button
                onClick={handleAction}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${ACTION_DETAILS[actionModal.action].btnClass}`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface PresenceCheck {
  id: string
  attempt_number: number
  expires_at: string
}

interface Props {
  check: PresenceCheck
  onRespond: (checkId: string, response: 'pass' | 'timeout') => void
}

export default function PresenceCheckModal({ check, onRespond }: Props) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    const remaining = Math.floor((new Date(check.expires_at).getTime() - Date.now()) / 1000)
    return Math.max(0, remaining)
  })

  const handleTimeout = useCallback(() => {
    onRespond(check.id, 'timeout')
  }, [check.id, onRespond])

  useEffect(() => {
    if (secondsLeft <= 0) {
      handleTimeout()
      return
    }
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id)
          handleTimeout()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [secondsLeft, handleTimeout])

  // Re-sync countdown if the check prop changes (new attempt)
  useEffect(() => {
    const remaining = Math.floor((new Date(check.expires_at).getTime() - Date.now()) / 1000)
    setSecondsLeft(Math.max(0, remaining))
  }, [check.id, check.expires_at])

  const pct   = Math.min(100, Math.max(0, (secondsLeft / 60) * 100))
  const isLow = secondsLeft <= 15
  const circumference = 2 * Math.PI * 40

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className="relative w-[420px] rounded-2xl p-8 flex flex-col items-center text-center"
        style={{
          backgroundColor: 'var(--bg-card)',
          border:          '1px solid var(--border-strong)',
          boxShadow:       'var(--shadow-lg)',
        }}
      >
        {/* Attempt badge */}
        <div
          className="absolute top-4 right-4 text-[10px] font-bold px-2 py-1 rounded-full border"
          style={{ color: 'var(--tx-3)', borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          Attempt {check.attempt_number} of 3
        </div>

        {/* Circular countdown */}
        <div className="relative w-28 h-28 mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke="var(--border)"
              strokeWidth="6"
            />
            <circle
              cx="50" cy="50" r="40"
              fill="none"
              stroke={isLow ? '#EF4444' : '#6366F1'}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={circumference - (pct / 100) * circumference}
              style={{ transition: 'stroke-dashoffset 0.9s linear, stroke 0.3s' }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span
              className="text-3xl font-bold font-mono"
              style={{ color: isLow ? '#EF4444' : 'var(--tx-1)' }}
            >
              {secondsLeft}
            </span>
          </div>
        </div>

        <h2 className="text-[18px] font-bold mb-2" style={{ color: 'var(--tx-1)' }}>
          Are you still there?
        </h2>
        <p className="text-[13px] mb-2" style={{ color: 'var(--tx-2)' }}>
          Confirm you&apos;re still active and working. Your session will be logged out if you don&apos;t respond.
        </p>
        {check.attempt_number > 1 && (
          <p className="text-[12px] mb-5 font-semibold" style={{ color: '#F59E0B' }}>
            Warning: {3 - check.attempt_number} attempt{3 - check.attempt_number === 1 ? '' : 's'} remaining before automatic logout.
          </p>
        )}
        {check.attempt_number === 1 && <div className="mb-5" />}

        <button
          onClick={() => onRespond(check.id, 'pass')}
          className="w-full py-3.5 rounded-xl text-[15px] font-bold text-white transition-all active:scale-95"
          style={{ backgroundColor: '#6366F1' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#4F46E5' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.backgroundColor = '#6366F1' }}
        >
          Yes, I&apos;m here!
        </button>

        <p className="text-[11px] mt-3" style={{ color: 'var(--tx-3)' }}>
          This check appears every 2 hours to confirm active work.
        </p>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}

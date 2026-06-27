'use client'

import { useState, useRef, useEffect } from 'react'
import { TrendingUp, TrendingDown, Calendar, ChevronLeft, ChevronRight, ChevronDown, X } from 'lucide-react'
import type { Insight } from './data'
import { AVAILABLE_MONTHS } from './data'

// ─── Shared axis tick style (SVG supports CSS vars) ───────────────────────────
export const TICK = { fill: 'var(--tx-3)', fontSize: 10, fontFamily: 'var(--font-mono)' }

// ─── Chart tooltip ────────────────────────────────────────────────────────────
export function ChartTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; unit?: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)',
      borderRadius: 10, padding: '12px 14px', boxShadow: 'var(--shadow-md)', minWidth: 148,
    }}>
      <p style={{ color: 'var(--tx-3)', fontSize: 11, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{label}</p>
      {payload.map(p => (
        <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', gap: 20, alignItems: 'center', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: p.color, flexShrink: 0 }} />
            <span style={{ color: 'var(--tx-2)', fontSize: 11 }}>{p.name}</span>
          </div>
          <span style={{ color: 'var(--tx-1)', fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
            {typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{p.unit ?? ''}
          </span>
        </div>
      ))}
    </div>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
export function KpiCard({ label, value, delta, sub, Icon, color }: {
  label: string; value: string; delta: number; sub: string
  Icon: React.ElementType; color: string
}) {
  const up = delta >= 0
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 22px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <p style={{ color: 'var(--tx-3)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</p>
        <div style={{ width: 34, height: 34, borderRadius: 9, backgroundColor: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={15} color={color} />
        </div>
      </div>
      <p style={{ color: 'var(--tx-1)', fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-mono)', marginBottom: 8 }}>{value}</p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {up ? <TrendingUp size={11} color="#10B981" /> : <TrendingDown size={11} color="#EF4444" />}
        <span style={{ color: up ? '#10B981' : '#EF4444', fontSize: 11, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
          {up ? '+' : ''}{delta.toFixed(1)}%
        </span>
        <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>{sub}</span>
      </div>
    </div>
  )
}

// ─── Chart section card ───────────────────────────────────────────────────────
export function ChartCard({ title, sub, right, children }: {
  title: string; sub: string; right?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '22px 22px 14px', boxShadow: 'var(--shadow-card)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <h2 style={{ color: 'var(--tx-1)', fontSize: 13, fontWeight: 600 }}>{title}</h2>
          <p style={{ color: 'var(--tx-3)', fontSize: 11, marginTop: 3 }}>{sub}</p>
        </div>
        {right}
      </div>
      {children}
    </div>
  )
}

// ─── Legend dot ───────────────────────────────────────────────────────────────
export function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ width: 10, height: 2, borderRadius: 2, backgroundColor: color }} />
      <span style={{ color: 'var(--tx-3)', fontSize: 11 }}>{label}</span>
    </div>
  )
}

// ─── Insight card ─────────────────────────────────────────────────────────────
const INSIGHT_COLORS: Record<Insight['type'], { bg: string; border: string; dot: string }> = {
  positive:  { bg: 'rgba(16,185,129,0.06)',  border: 'rgba(16,185,129,0.2)',  dot: '#10B981' },
  warning:   { bg: 'rgba(239,68,68,0.06)',   border: 'rgba(239,68,68,0.2)',   dot: '#EF4444' },
  milestone: { bg: 'rgba(99,102,241,0.06)',  border: 'rgba(99,102,241,0.2)', dot: '#6366F1' },
  info:      { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.2)', dot: '#F59E0B' },
}

export function InsightCard({ insight }: { insight: Insight }) {
  const c = INSIGHT_COLORS[insight.type]
  return (
    <div style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, borderRadius: 12, padding: '14px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: c.dot, flexShrink: 0 }} />
        <p style={{ color: 'var(--tx-1)', fontSize: 12, fontWeight: 700 }}>{insight.title}</p>
      </div>
      <p style={{ color: 'var(--tx-2)', fontSize: 11, lineHeight: 1.5 }}>{insight.body}</p>
    </div>
  )
}

// ─── Month Picker ─────────────────────────────────────────────────────────────
const SHORT_MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

interface MonthPickerProps {
  value: { year: number; month: number } | null
  onChange: (year: number, month: number) => void
  onClear: () => void
}

export function MonthPicker({ value, onChange, onClear }: MonthPickerProps) {
  const [open, setOpen]   = useState(false)
  const [yr,   setYr]     = useState(value?.year ?? 2026)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const years    = [...new Set(AVAILABLE_MONTHS.map(m => m.year))].sort()
  const minY     = years[0]; const maxY = years[years.length - 1]
  const avail    = (y: number, m: number) => AVAILABLE_MONTHS.some(x => x.year === y && x.month === m)
  const lbl      = value ? `${SHORT_MONTHS[value.month - 1]} ${value.year}` : 'Month Report'

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${value ? '#6366F1' : 'var(--border)'}`,
          backgroundColor: value ? 'rgba(99,102,241,0.08)' : 'var(--bg-card)',
          color: value ? '#6366F1' : 'var(--tx-2)', fontSize: 12, fontWeight: 600,
        }}
      >
        <Calendar size={13} />
        {lbl}
        {value
          ? <X size={12} onClick={e => { e.stopPropagation(); onClear() }} style={{ opacity: 0.7 }} />
          : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 200,
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)',
          borderRadius: 12, padding: 16, boxShadow: 'var(--shadow-lg)', minWidth: 220,
        }}>
          {/* Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={() => setYr(y => Math.max(minY, y - 1))} disabled={yr <= minY}
              style={{ background: 'none', border: 'none', cursor: yr > minY ? 'pointer' : 'default', color: yr > minY ? 'var(--tx-1)' : 'var(--tx-3)', padding: 4 }}>
              <ChevronLeft size={14} />
            </button>
            <span style={{ color: 'var(--tx-1)', fontSize: 13, fontWeight: 700 }}>{yr}</span>
            <button onClick={() => setYr(y => Math.min(maxY, y + 1))} disabled={yr >= maxY}
              style={{ background: 'none', border: 'none', cursor: yr < maxY ? 'pointer' : 'default', color: yr < maxY ? 'var(--tx-1)' : 'var(--tx-3)', padding: 4 }}>
              <ChevronRight size={14} />
            </button>
          </div>
          {/* Month grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {SHORT_MONTHS.map((mn, i) => {
              const m = i + 1; const ok = avail(yr, m); const sel = value?.year === yr && value?.month === m
              return (
                <button key={mn} disabled={!ok} onClick={() => { onChange(yr, m); setOpen(false) }}
                  style={{
                    padding: '7px 4px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                    border: `1px solid ${sel ? '#6366F1' : 'transparent'}`,
                    backgroundColor: sel ? '#6366F1' : 'transparent',
                    color: sel ? '#fff' : ok ? 'var(--tx-1)' : 'var(--tx-3)',
                    cursor: ok ? 'pointer' : 'default', opacity: ok ? 1 : 0.35,
                  }}>
                  {mn}
                </button>
              )
            })}
          </div>
          <p style={{ color: 'var(--tx-3)', fontSize: 10, marginTop: 12, textAlign: 'center' }}>
            Data available: Jan 2025 – Jun 2026
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Date Range Picker ────────────────────────────────────────────────────────
const PRESETS = [
  { label: 'Last 3 months', months: 3  },
  { label: 'Last 6 months', months: 6  },
  { label: 'Last year',     months: 12 },
  { label: 'All time',      months: 18 },
]

function toISO(d: Date) { return d.toISOString().slice(0, 10) }
function fromISO(s: string) { const d = new Date(s); return isNaN(d.getTime()) ? null : d }
function disp(d: Date) { return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }

interface RangePickerProps {
  value: { start: Date; end: Date } | null
  onChange: (start: Date, end: Date) => void
  onClear: () => void
}

export function DateRangePicker({ value, onChange, onClear }: RangePickerProps) {
  const [open, setOpen] = useState(false)
  const [s0, setS0] = useState(value ? toISO(value.start) : '2025-01-01')
  const [e0, setE0] = useState(value ? toISO(value.end)   : '2026-06-30')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', fn)
    return () => document.removeEventListener('mousedown', fn)
  }, [])

  const apply = () => {
    const s = fromISO(s0); const e = fromISO(e0)
    if (s && e && s <= e) { onChange(s, e); setOpen(false) }
  }

  const preset = (months: number) => {
    const end = new Date(2026, 5, 30)
    const start = new Date(end); start.setMonth(start.getMonth() - months)
    setS0(toISO(start)); setE0(toISO(end))
    onChange(start, end); setOpen(false)
  }

  const lbl = value ? `${disp(value.start)} → ${disp(value.end)}` : 'Compare Range'

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 12,
    border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)',
    color: 'var(--tx-1)', outline: 'none', fontFamily: 'var(--font-mono)',
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 7, padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
          border: `1px solid ${value ? '#8B5CF6' : 'var(--border)'}`,
          backgroundColor: value ? 'rgba(139,92,246,0.08)' : 'var(--bg-card)',
          color: value ? '#8B5CF6' : 'var(--tx-2)', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap',
        }}
      >
        <Calendar size={13} />
        {lbl}
        {value
          ? <X size={12} onClick={e => { e.stopPropagation(); onClear() }} style={{ opacity: 0.7 }} />
          : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 200,
          backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-strong)',
          borderRadius: 12, padding: 18, boxShadow: 'var(--shadow-lg)', minWidth: 304,
        }}>
          <p style={{ color: 'var(--tx-1)', fontSize: 12, fontWeight: 700, marginBottom: 12 }}>Custom date range</p>

          {/* Presets */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => preset(p.months)}
                style={{ padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)', color: 'var(--tx-2)' }}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Date inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            <div>
              <p style={{ color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>From</p>
              <input type="date" value={s0} min="2025-01-01" max="2026-06-30"
                onChange={e => setS0(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <p style={{ color: 'var(--tx-3)', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 5 }}>To</p>
              <input type="date" value={e0} min="2025-01-01" max="2026-06-30"
                onChange={e => setE0(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <button onClick={apply} style={{
            width: '100%', padding: 9, borderRadius: 8, border: 'none',
            backgroundColor: '#8B5CF6', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>
            Apply Range
          </button>

          <p style={{ color: 'var(--tx-3)', fontSize: 10, marginTop: 10, textAlign: 'center' }}>
            Data range: 1 Jan 2025 – 30 Jun 2026
          </p>
        </div>
      )}
    </div>
  )
}

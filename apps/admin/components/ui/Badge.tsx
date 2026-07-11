export type BadgeTone = 'bronze' | 'silver'

interface BadgeProps {
  tone: BadgeTone
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const TONE_COLORS: Record<BadgeTone, { deep: string; base: string; mid: string; light: string; ring: string }> = {
  bronze: { deep: '#7A4A1E', base: '#B87333', mid: '#D89456', light: '#F0C08A', ring: '#8A5A2A' },
  silver: { deep: '#6E7075', base: '#A9ACB1', mid: '#D0D3D8', light: '#F2F4F6', ring: '#83868C' },
}

const TONE_LABEL: Record<BadgeTone, string> = {
  bronze: 'ADMIN VERIFIED',
  silver: 'COMPANY VERIFIED',
}

const SIZE_MAP = {
  sm: { w: 66, h: 80 },
  md: { w: 99, h: 120 },
  lg: { w: 132, h: 160 },
} as const

// Same design spec as apps/mobile/components/ui/Badge.tsx (Style A medal,
// chosen from the badge-preview design review) — keep both in sync if the
// artwork changes.
export function Badge({ tone, size = 'md', showLabel = false }: BadgeProps) {
  const c = TONE_COLORS[tone]
  const s = SIZE_MAP[size]
  const gradId = `medal-${tone}-${size}`
  const ribbonId = `ribbon-${tone}-${size}`

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <svg width={s.w} height={s.h} viewBox="0 0 132 160">
        <defs>
          <radialGradient id={gradId} cx="38%" cy="32%" r="75%">
            <stop offset="0%" stopColor={c.light} />
            <stop offset="45%" stopColor={c.mid} />
            <stop offset="80%" stopColor={c.base} />
            <stop offset="100%" stopColor={c.deep} />
          </radialGradient>
          <linearGradient id={ribbonId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.base} />
            <stop offset="100%" stopColor={c.deep} />
          </linearGradient>
        </defs>

        <path d="M50 82 L38 150 L58 138 L66 150 L50 82 Z" fill={`url(#${ribbonId})`} />
        <path d="M82 82 L94 150 L74 138 L66 150 L82 82 Z" fill={`url(#${ribbonId})`} />

        <circle cx="66" cy="62" r="52" fill={c.ring} />
        <circle cx="66" cy="62" r="46" fill={`url(#${gradId})`} stroke={c.deep} strokeWidth="1.5" />
        <circle cx="66" cy="62" r="37" fill="none" stroke={tone === 'bronze' ? '#F0C08A99' : '#F2F4F699'} strokeWidth="2" />

        <path
          d="M66 44.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8-6.1-3.4-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7L66 44.5z"
          fill="white"
        />
        <text x="66" y="86" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ffffffcc" fontFamily="system-ui" letterSpacing="0.5">
          {tone === 'bronze' ? 'ADMIN' : 'COMPANY'}
        </text>
      </svg>
      {showLabel && (
        <span style={{ fontSize: 11, fontWeight: 700, color: '#5A4F6E', letterSpacing: 0.3 }}>
          {TONE_LABEL[tone]}
        </span>
      )}
    </div>
  )
}

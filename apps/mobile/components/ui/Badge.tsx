import { View, Text } from 'react-native'
import Svg, { Path, Defs, RadialGradient, LinearGradient, Stop, Circle } from 'react-native-svg'

export type BadgeTone = 'bronze' | 'silver'

interface BadgeProps {
  tone: BadgeTone
  size?: 'sm' | 'md' | 'lg'
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
  sm: { w: 66, h: 80, medalR: 26, iconScale: 0.5, fontSize: 5 },
  md: { w: 99, h: 120, medalR: 39, iconScale: 0.75, fontSize: 6.75 },
  lg: { w: 132, h: 160, medalR: 52, iconScale: 1, fontSize: 9 },
} as const

function StarPath({ scale }: { scale: number }) {
  return (
    <Path
      d="M12 2.5l2.9 6.3 6.9.7-5.2 4.7 1.5 6.8L12 17.6l-6.1 3.4 1.5-6.8-5.2-4.7 6.9-.7L12 2.5z"
      fill="white"
      transform={`scale(${scale})`}
    />
  )
}

export function Badge({ tone, size = 'md' }: BadgeProps) {
  const c = TONE_COLORS[tone]
  const s = SIZE_MAP[size]
  const gradId = `medal-${tone}-${size}`
  const ribbonId = `ribbon-${tone}-${size}`
  const cx = s.w / 2
  const cy = s.medalR + 10

  return (
    <View style={{ width: s.w, height: s.h, alignItems: 'center' }}>
      <Svg width={s.w} height={s.h} viewBox={`0 0 ${s.w} ${s.h}`}>
        <Defs>
          <RadialGradient id={gradId} cx="38%" cy="32%" r="75%">
            <Stop offset="0%" stopColor={c.light} />
            <Stop offset="45%" stopColor={c.mid} />
            <Stop offset="80%" stopColor={c.base} />
            <Stop offset="100%" stopColor={c.deep} />
          </RadialGradient>
          <LinearGradient id={ribbonId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={c.base} />
            <Stop offset="100%" stopColor={c.deep} />
          </LinearGradient>
        </Defs>

        {/* ribbon tails */}
        <Path
          d={`M${cx - s.medalR * 0.3} ${cy + s.medalR * 0.32} L${cx - s.medalR * 0.46} ${s.h - 10} L${cx - s.medalR * 0.15} ${s.h - 22} L${cx - s.medalR * 0.03} ${s.h - 10} Z`}
          fill={`url(#${ribbonId})`}
        />
        <Path
          d={`M${cx + s.medalR * 0.3} ${cy + s.medalR * 0.32} L${cx + s.medalR * 0.46} ${s.h - 10} L${cx + s.medalR * 0.15} ${s.h - 22} L${cx + s.medalR * 0.03} ${s.h - 10} Z`}
          fill={`url(#${ribbonId})`}
        />

        {/* outer ring */}
        <Circle cx={cx} cy={cy} r={s.medalR} fill={c.ring} />
        {/* medal face */}
        <Circle cx={cx} cy={cy} r={s.medalR - 5} fill={`url(#${gradId})`} stroke={c.deep} strokeWidth={1.2} />
        {/* inner rim */}
        <Circle
          cx={cx}
          cy={cy}
          r={s.medalR - 12}
          fill="none"
          stroke={tone === 'bronze' ? '#F0C08A99' : '#F2F4F699'}
          strokeWidth={1.6}
        />
      </Svg>
      {/* star icon overlaid via a second small SVG centered on the medal */}
      <Svg
        width={s.medalR}
        height={s.medalR}
        viewBox="0 0 24 24"
        style={{ position: 'absolute', top: cy - s.medalR / 2, left: cx - s.medalR / 2 }}
      >
        <StarPath scale={s.medalR / 24} />
      </Svg>
    </View>
  )
}

export function BadgeWithLabel({ tone, size = 'md' }: BadgeProps) {
  const s = SIZE_MAP[size]
  return (
    <View style={{ alignItems: 'center', gap: 4 }}>
      <Badge tone={tone} size={size} />
      <Text style={{ fontSize: s.fontSize + 4, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.3 }}>
        {TONE_LABEL[tone]}
      </Text>
    </View>
  )
}

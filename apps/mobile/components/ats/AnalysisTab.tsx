import { useEffect } from 'react'
import { View, Text, ScrollView } from 'react-native'
import Svg, { Path, Circle } from 'react-native-svg'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  FadeInDown,
} from 'react-native-reanimated'
import { AtsRow, STAGE_CONFIG, STAGE_ORDER, RowStage } from './types'

// ─── Donut geometry ───────────────────────────────────────────────────────────
const SIZE    = 220
const CX      = SIZE / 2
const CY      = SIZE / 2
const OUTER_R = 90
const INNER_R = 58
const GAP_DEG = 2.5

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
): string {
  if (endAngle - startAngle >= 359.9) {
    const a2 = startAngle + 180
    const a3 = endAngle - 0.1
    const op1 = polarToCartesian(cx, cy, outerR, startAngle)
    const op2 = polarToCartesian(cx, cy, outerR, a2)
    const op3 = polarToCartesian(cx, cy, outerR, a3)
    const ip1 = polarToCartesian(cx, cy, innerR, startAngle)
    const ip2 = polarToCartesian(cx, cy, innerR, a2)
    const ip3 = polarToCartesian(cx, cy, innerR, a3)
    return [
      `M ${op1.x} ${op1.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${op2.x} ${op2.y}`,
      `A ${outerR} ${outerR} 0 1 1 ${op3.x} ${op3.y}`,
      `L ${ip3.x} ${ip3.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${ip2.x} ${ip2.y}`,
      `A ${innerR} ${innerR} 0 1 0 ${ip1.x} ${ip1.y}`,
      'Z',
    ].join(' ')
  }

  const largeArc   = endAngle - startAngle > 180 ? 1 : 0
  const outerStart = polarToCartesian(cx, cy, outerR, startAngle)
  const outerEnd   = polarToCartesian(cx, cy, outerR, endAngle)
  const innerStart = polarToCartesian(cx, cy, innerR, startAngle)
  const innerEnd   = polarToCartesian(cx, cy, innerR, endAngle)
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ')
}

// ─── Slice data ───────────────────────────────────────────────────────────────
interface SliceData {
  stage:      RowStage
  count:      number
  pct:        number
  startAngle: number
  endAngle:   number
  path:       string
}

function buildSlices(rows: AtsRow[]): SliceData[] {
  const total = rows.length
  if (total === 0) return []

  const counts = STAGE_ORDER.reduce<Record<RowStage, number>>(
    (acc, s) => { acc[s] = rows.filter((r) => r.stage === s).length; return acc },
    {} as Record<RowStage, number>,
  )

  const activeStages = STAGE_ORDER.filter((s) => counts[s] > 0)
  const usableDeg    = 360 - GAP_DEG * activeStages.length

  let cursor = 0
  return activeStages.map((stage) => {
    const count      = counts[stage]
    const pct        = count / total
    const sweep      = pct * usableDeg
    const startAngle = cursor
    const endAngle   = cursor + sweep
    cursor           = endAngle + GAP_DEG
    return {
      stage, count, pct, startAngle, endAngle,
      path: describeArc(CX, CY, OUTER_R, INNER_R, startAngle, endAngle),
    }
  })
}

// ─── Animated slice ───────────────────────────────────────────────────────────
function AnimatedSlice({ slice, delay }: { slice: SliceData; delay: number }) {
  const opacity = useSharedValue(0)
  const scale   = useSharedValue(0.72)
  const cfg     = STAGE_CONFIG[slice.stage]

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }))
    scale.value   = withDelay(delay, withTiming(1, { duration: 420, easing: Easing.out(Easing.back(1.2)) }))
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }))

  return (
    <Animated.View
      style={[animStyle, { position: 'absolute', width: SIZE, height: SIZE }]}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Path d={slice.path} fill={cfg.color} />
      </Svg>
    </Animated.View>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, index }: {
  label: string; value: string; sub: string; color: string; index: number
}) {
  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 80).duration(300)}
      style={{
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E5DFD3',
        shadowColor: '#1A1625',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 30, fontWeight: '800', color, letterSpacing: -0.8, marginBottom: 4 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: '#9A8FA6', lineHeight: 15 }}>
        {sub}
      </Text>
    </Animated.View>
  )
}

// ─── Legend row ───────────────────────────────────────────────────────────────
function LegendRow({ slice, index }: { slice: SliceData; index: number }) {
  const cfg = STAGE_CONFIG[slice.stage]
  const pct = Math.round(slice.pct * 100)

  return (
    <Animated.View
      entering={FadeInDown.delay(160 + index * 60).duration(280)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5DFD3',
        gap: 12,
      }}
    >
      <View style={{
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: cfg.color,
        flexShrink: 0,
      }} />

      <Text style={{ width: 100, fontSize: 13, fontWeight: '600', color: '#1A1625' }}>
        {cfg.label}
      </Text>

      <View style={{ flex: 1, height: 5, backgroundColor: '#E5DFD3', borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 5, backgroundColor: cfg.color, borderRadius: 3 }} />
      </View>

      <View style={{ alignItems: 'flex-end', flexShrink: 0, minWidth: 50 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1625' }}>{slice.count}</Text>
        <Text style={{ fontSize: 10, color: '#9A8FA6' }}>{pct}%</Text>
      </View>
    </Animated.View>
  )
}

// ─── AnalysisTab ─────────────────────────────────────────────────────────────
interface Props { rows: AtsRow[] }

export function AnalysisTab({ rows }: Props) {
  const total      = rows.length
  const hired      = rows.filter((r) => r.stage === 'hired').length
  const rejected   = rows.filter((r) => r.stage === 'rejected').length
  const inPipeline = total - hired - rejected

  const conversionRate = total > 0 ? Math.round((hired    / total) * 100) : 0
  const rejectionRate  = total > 0 ? Math.round((rejected / total) * 100) : 0

  const slices = buildSlices(rows)

  const centerOpacity = useSharedValue(0)
  useEffect(() => {
    centerOpacity.value = withDelay(280, withTiming(1, { duration: 480 }))
  }, [])
  const centerStyle = useAnimatedStyle(() => ({ opacity: centerOpacity.value }))

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F0E8' }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 52 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Donut chart card ── */}
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 22,
          padding: 24,
          alignItems: 'center',
          borderWidth: 1,
          borderColor: '#E5DFD3',
          marginBottom: 20,
          shadowColor: '#1A1625',
          shadowOpacity: 0.04,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 3 },
        }}
      >
        <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 20 }}>
          Pipeline Distribution
        </Text>

        {/* Chart container */}
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {total === 0 ? (
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle
                cx={CX}
                cy={CY}
                r={(OUTER_R + INNER_R) / 2}
                stroke="#E5DFD3"
                strokeWidth={OUTER_R - INNER_R}
                fill="none"
              />
            </Svg>
          ) : (
            slices.map((slice, i) => (
              <AnimatedSlice key={slice.stage} slice={slice} delay={i * 75} />
            ))
          )}

          {/* Center text — fills container so alignItems/justifyContent centres it */}
          <Animated.View
            style={[
              centerStyle,
              {
                position:       'absolute',
                top:            0,
                left:           0,
                right:          0,
                bottom:         0,
                alignItems:     'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Text style={{ fontSize: 34, fontWeight: '800', color: '#1A1625', letterSpacing: -1 }}>
              {total}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.5, textTransform: 'uppercase', marginTop: 2 }}>
              {total === 1 ? 'Candidate' : 'Candidates'}
            </Text>
          </Animated.View>
        </View>
      </Animated.View>

      {/* ── KPI cards ── */}
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        <KpiCard
          label="Hire Rate"
          value={`${conversionRate}%`}
          sub={`${hired} of ${total} hired`}
          color="#0DD4C3"
          index={0}
        />
        <KpiCard
          label="Rejection Rate"
          value={`${rejectionRate}%`}
          sub={`${rejected} of ${total} rejected`}
          color="#EF4444"
          index={1}
        />
      </View>

      {/* ── In pipeline card ── */}
      <Animated.View
        entering={FadeInDown.delay(560).duration(300)}
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: '#E5DFD3',
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 28,
          shadowColor: '#1A1625',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}>
            Still Active
          </Text>
          <Text style={{ fontSize: 13, color: '#5A4F6E' }}>
            Candidates still in the pipeline
          </Text>
        </View>
        <Text style={{ fontSize: 36, fontWeight: '800', color: '#6366F1', letterSpacing: -1 }}>
          {inPipeline}
        </Text>
      </Animated.View>

      {/* ── Stage breakdown ── */}
      {slices.length > 0 && (
        <View style={{
          backgroundColor: '#FFFFFF',
          borderRadius: 18,
          padding: 18,
          borderWidth: 1,
          borderColor: '#E5DFD3',
          shadowColor: '#1A1625',
          shadowOpacity: 0.04,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: '#9A8FA6', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
            Breakdown by Stage
          </Text>
          {slices.map((slice, i) => (
            <LegendRow key={slice.stage} slice={slice} index={i} />
          ))}
        </View>
      )}

      {total === 0 && (
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ alignItems: 'center', paddingTop: 16 }}>
          <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700', marginBottom: 6 }}>No data yet</Text>
          <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center' }}>
            Add candidates in the Data tab to see your analytics.
          </Text>
        </Animated.View>
      )}
    </ScrollView>
  )
}

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

// ─── Donut chart geometry ────────────────────────────────────────────────────
const SIZE     = 230
const CX       = SIZE / 2
const CY       = SIZE / 2
const OUTER_R  = 96
const INNER_R  = 62
const GAP_DEG  = 2   // degrees of gap between slices

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function describeArc(
  cx: number,
  cy: number,
  outerR: number,
  innerR: number,
  startAngle: number,
  endAngle: number,
): string {
  // If it's a full circle, draw two semicircles to avoid degenerate path
  if (endAngle - startAngle >= 359.9) {
    const a1 = startAngle
    const a2 = startAngle + 180
    const a3 = endAngle - 0.1

    const op1 = polarToCartesian(cx, cy, outerR, a1)
    const op2 = polarToCartesian(cx, cy, outerR, a2)
    const op3 = polarToCartesian(cx, cy, outerR, a3)
    const ip1 = polarToCartesian(cx, cy, innerR, a1)
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

  const largeArc = endAngle - startAngle > 180 ? 1 : 0

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

// ─── Chart slice data ────────────────────────────────────────────────────────
interface SliceData {
  stage: RowStage
  count: number
  pct: number
  startAngle: number
  endAngle: number
  path: string
}

function buildSlices(rows: AtsRow[]): SliceData[] {
  const total = rows.length
  if (total === 0) return []

  const counts = STAGE_ORDER.reduce<Record<RowStage, number>>(
    (acc, s) => {
      acc[s] = rows.filter((r) => r.stage === s).length
      return acc
    },
    {} as Record<RowStage, number>,
  )

  const activeStages = STAGE_ORDER.filter((s) => counts[s] > 0)
  const gapTotal     = GAP_DEG * activeStages.length
  const usableDeg    = 360 - gapTotal

  const slices: SliceData[] = []
  let cursor = 0

  for (const stage of activeStages) {
    const count      = counts[stage]
    const pct        = count / total
    const sweep      = pct * usableDeg
    const startAngle = cursor
    const endAngle   = cursor + sweep

    slices.push({
      stage,
      count,
      pct,
      startAngle,
      endAngle,
      path: describeArc(CX, CY, OUTER_R, INNER_R, startAngle, endAngle),
    })

    cursor = endAngle + GAP_DEG
  }

  return slices
}

// ─── Animated slice ───────────────────────────────────────────────────────────
const AnimatedPath = Animated.createAnimatedComponent(Path)

interface AnimatedSliceProps {
  slice: SliceData
  delay: number
}

function AnimatedSlice({ slice, delay }: AnimatedSliceProps) {
  const opacity = useSharedValue(0)
  const scale   = useSharedValue(0.7)

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 400, easing: Easing.out(Easing.cubic) }))
    scale.value   = withDelay(delay, withTiming(1, { duration: 450, easing: Easing.out(Easing.back(1.3)) }))
  }, [])

  const animStyle = useAnimatedStyle(() => ({
    opacity:   opacity.value,
    transform: [{ scale: scale.value }],
  }))

  const cfg = STAGE_CONFIG[slice.stage]

  return (
    <Animated.View
      style={[
        animStyle,
        {
          position: 'absolute',
          width: SIZE,
          height: SIZE,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Path d={slice.path} fill={cfg.color} />
      </Svg>
    </Animated.View>
  )
}

// ─── KPI card ─────────────────────────────────────────────────────────────────
interface KpiCardProps {
  label: string
  value: string
  sub: string
  color: string
  index: number
}

function KpiCard({ label, value, sub, color, index }: KpiCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(400 + index * 80).duration(300)}
      style={{
        flex: 1,
        backgroundColor: '#EDE7DB',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#C8BFB0',
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 8 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 28, fontWeight: '800', color, marginBottom: 2, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: '#9A8FA6' }}>
        {sub}
      </Text>
    </Animated.View>
  )
}

// ─── Legend row ───────────────────────────────────────────────────────────────
interface LegendRowProps {
  slice: SliceData
  index: number
}

function LegendRow({ slice, index }: LegendRowProps) {
  const cfg  = STAGE_CONFIG[slice.stage]
  const pct  = Math.round(slice.pct * 100)

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 70).duration(300)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5DFD3',
        gap: 12,
      }}
    >
      {/* Color dot */}
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color, flexShrink: 0 }} />

      {/* Stage name */}
      <Text style={{ width: 90, fontSize: 13, fontWeight: '600', color: '#1A1625' }}>
        {cfg.label}
      </Text>

      {/* Progress bar */}
      <View style={{ flex: 1, height: 6, backgroundColor: '#DDD6C9', borderRadius: 3, overflow: 'hidden' }}>
        <View style={{ width: `${pct}%`, height: 6, backgroundColor: cfg.color, borderRadius: 3 }} />
      </View>

      {/* Count + pct */}
      <View style={{ alignItems: 'flex-end', flexShrink: 0, minWidth: 52 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: '#1A1625' }}>
          {slice.count}
        </Text>
        <Text style={{ fontSize: 10, color: '#9A8FA6', fontWeight: '500' }}>
          {pct}%
        </Text>
      </View>
    </Animated.View>
  )
}

// ─── AnalysisTab ──────────────────────────────────────────────────────────────
interface Props {
  rows: AtsRow[]
}

export function AnalysisTab({ rows }: Props) {
  const total      = rows.length
  const hired      = rows.filter((r) => r.stage === 'hired').length
  const rejected   = rows.filter((r) => r.stage === 'rejected').length
  const inPipeline = total - hired - rejected

  const conversionRate = total > 0 ? Math.round((hired / total) * 100) : 0
  const rejectionRate  = total > 0 ? Math.round((rejected / total) * 100) : 0

  const slices = buildSlices(rows)

  // Center text animation
  const centerOpacity = useSharedValue(0)
  useEffect(() => {
    centerOpacity.value = withDelay(300, withTiming(1, { duration: 500 }))
  }, [])
  const centerStyle = useAnimatedStyle(() => ({ opacity: centerOpacity.value }))

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Donut chart ── */}
      <View style={{ alignItems: 'center', marginBottom: 32 }}>
        <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
          {total === 0 ? (
            /* Empty ring */
            <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
              <Circle
                cx={CX}
                cy={CY}
                r={(OUTER_R + INNER_R) / 2}
                stroke="#DDD6C9"
                strokeWidth={OUTER_R - INNER_R}
                fill="none"
              />
            </Svg>
          ) : (
            slices.map((slice, i) => (
              <AnimatedSlice key={slice.stage} slice={slice} delay={i * 80} />
            ))
          )}

          {/* Center text */}
          <Animated.View style={[centerStyle, { position: 'absolute', alignItems: 'center' }]}>
            <Text style={{ fontSize: 36, fontWeight: '800', color: '#1A1625', letterSpacing: -1 }}>
              {total}
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '600', color: '#5A4F6E', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {total === 1 ? 'Candidate' : 'Candidates'}
            </Text>
          </Animated.View>
        </View>
      </View>

      {/* ── KPI cards ── */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
        <KpiCard
          label="Hired"
          value={`${conversionRate}%`}
          sub={`${hired} of ${total} candidates`}
          color="#0DD4C3"
          index={0}
        />
        <KpiCard
          label="Rejected"
          value={`${rejectionRate}%`}
          sub={`${rejected} of ${total} candidates`}
          color="#EF4444"
          index={1}
        />
      </View>

      {/* ── In pipeline stat ── */}
      <Animated.View
        entering={FadeInDown.delay(560).duration(300)}
        style={{
          backgroundColor: '#EDE7DB',
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: '#C8BFB0',
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: 28,
        }}
      >
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.7, textTransform: 'uppercase', marginBottom: 4 }}>
            Still in Pipeline
          </Text>
          <Text style={{ fontSize: 13, color: '#9A8FA6' }}>
            Actively being considered
          </Text>
        </View>
        <Text style={{ fontSize: 32, fontWeight: '800', color: '#818CF8', letterSpacing: -0.5 }}>
          {inPipeline}
        </Text>
      </Animated.View>

      {/* ── Legend ── */}
      {slices.length > 0 && (
        <View>
          <Animated.Text
            entering={FadeInDown.delay(160).duration(300)}
            style={{ fontSize: 11, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 }}
          >
            Breakdown by Stage
          </Animated.Text>

          {slices.map((slice, i) => (
            <LegendRow key={slice.stage} slice={slice} index={i} />
          ))}
        </View>
      )}

      {total === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 16 }}>
          <Text style={{ color: '#5A4F6E', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>
            No data yet
          </Text>
          <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center' }}>
            Add candidates in the Data tab to see your analysis.
          </Text>
        </View>
      )}
    </ScrollView>
  )
}

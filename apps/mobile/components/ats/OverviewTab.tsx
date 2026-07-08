import { View, Text, ScrollView } from 'react-native'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { AtsRowFull, PIPELINE_CONFIG, PIPELINE_ORDER, PipelineStage, calcAge } from './types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

// ─── Pipeline summary bar ─────────────────────────────────────────────────────
function PipelineSummary({ rows }: { rows: AtsRowFull[] }) {
  const total = rows.length
  if (total === 0) return null

  const counts = PIPELINE_ORDER.reduce<Record<PipelineStage, number>>(
    (acc, s) => { acc[s] = rows.filter((r) => r.pipeline_stage === s).length; return acc },
    {} as Record<PipelineStage, number>,
  )

  return (
    <Animated.View entering={FadeInUp.duration(400)} style={{ marginBottom: 24 }}>
      <Text style={{ fontSize: 11, fontWeight: '700', color: '#9A8FA6', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
        Pipeline Overview
      </Text>

      {PIPELINE_ORDER.filter((s) => counts[s] > 0).map((stage, i) => {
        const cfg   = PIPELINE_CONFIG[stage]
        const count = counts[stage]
        const pct   = (count / total) * 100
        return (
          <Animated.View
            key={stage}
            entering={FadeInDown.delay(i * 60).duration(300)}
            style={{ marginBottom: 10 }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color }} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#1A1625' }}>{cfg.label}</Text>
              </View>
              <Text style={{ fontSize: 12, fontWeight: '700', color: cfg.color }}>
                {count} <Text style={{ color: '#9A8FA6', fontWeight: '400' }}>({Math.round(pct)}%)</Text>
              </Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#E5DFD3', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: `${pct}%`, height: 6, backgroundColor: cfg.color, borderRadius: 3 }} />
            </View>
          </Animated.View>
        )
      })}
    </Animated.View>
  )
}

// ─── Stat chips ───────────────────────────────────────────────────────────────
function StatChips({ rows }: { rows: AtsRowFull[] }) {
  const total       = rows.length
  const hired       = rows.filter((r) => r.pipeline_stage === 'hired').length
  const rejected    = rows.filter((r) => r.pipeline_stage === 'rejected').length
  const interviewed = rows.filter((r) => r.pipeline_stage === 'interview_scheduled').length

  const chips = [
    { label: 'Total',     value: total,       color: '#FF6240' },
    { label: 'Interview', value: interviewed,  color: '#6366F1' },
    { label: 'Hired',     value: hired,        color: '#0DD4C3' },
    { label: 'Rejected',  value: rejected,     color: '#EF4444' },
  ]

  return (
    <Animated.View
      entering={FadeInDown.duration(350)}
      style={{ flexDirection: 'row', gap: 8, marginBottom: 28 }}
    >
      {chips.map((chip) => (
        <View
          key={chip.label}
          style={{
            flex: 1,
            backgroundColor: '#FFFFFF',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E5DFD3',
            shadowColor: '#1A1625',
            shadowOpacity: 0.04,
            shadowRadius: 8,
            shadowOffset: { width: 0, height: 2 },
          }}
        >
          <Text style={{ fontSize: 22, fontWeight: '800', color: chip.color, letterSpacing: -0.5, marginBottom: 3 }}>
            {chip.value}
          </Text>
          <Text style={{ fontSize: 9, fontWeight: '700', color: '#9A8FA6', letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {chip.label}
          </Text>
        </View>
      ))}
    </Animated.View>
  )
}

// ─── Candidate card ───────────────────────────────────────────────────────────
function CandidateCard({ row, index }: { row: AtsRowFull; index: number }) {
  const cfg = PIPELINE_CONFIG[row.pipeline_stage]
  const age = calcAge(row.date_of_birth)
  const sub = [row.headline, row.location, age !== '—' ? `${age} yrs` : null].filter(Boolean).join(' · ')

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(300)}
      style={{
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#E5DFD3',
        overflow: 'hidden',
        shadowColor: '#1A1625',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      }}
    >
      {/* Left accent bar */}
      <View style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 4,
        backgroundColor: cfg.color,
        borderTopLeftRadius: 16, borderBottomLeftRadius: 16,
      }} />

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 14, paddingVertical: 14, gap: 12 }}>
        {/* Avatar initials */}
        <View style={{
          width: 42, height: 42, borderRadius: 21,
          backgroundColor: cfg.bg,
          borderWidth: 1.5, borderColor: cfg.border,
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '800' }}>
            {row.full_name.split(' ').slice(0, 2).map(w => w[0] ?? '').join('').toUpperCase()}
          </Text>
        </View>

        {/* Info */}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: '#1A1625', marginBottom: 2 }} numberOfLines={1}>
            {row.full_name}
          </Text>
          {sub ? (
            <Text style={{ fontSize: 11, color: '#5A4F6E', marginBottom: 3 }} numberOfLines={1}>{sub}</Text>
          ) : null}
          <Text style={{ fontSize: 10, color: '#9A8FA6' }}>
            Applied {formatDate(row.created_at)}
          </Text>
        </View>

        {/* Stage badge */}
        <View style={{
          backgroundColor: cfg.bg, borderRadius: 8,
          paddingHorizontal: 10, paddingVertical: 5,
          borderWidth: 1, borderColor: cfg.border, flexShrink: 0,
        }}>
          <Text style={{ fontSize: 10, fontWeight: '700', color: cfg.color }}>{cfg.label}</Text>
        </View>
      </View>
    </Animated.View>
  )
}

// ─── OverviewTab ──────────────────────────────────────────────────────────────
interface Props { rows: AtsRowFull[] }

export function OverviewTab({ rows }: Props) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#F5F0E8' }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      <StatChips rows={rows} />
      <PipelineSummary rows={rows} />

      {rows.length === 0 ? (
        <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ alignItems: 'center', paddingTop: 24 }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#EDE7DB', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 24 }}>📋</Text>
          </View>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#1A1625', marginBottom: 6 }}>No candidates yet</Text>
          <Text style={{ fontSize: 13, color: '#9A8FA6', textAlign: 'center' }}>
            Candidates auto-appear here as they apply for this job.
          </Text>
        </Animated.View>
      ) : (
        <>
          <Text style={{ fontSize: 11, fontWeight: '700', color: '#9A8FA6', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
            All Candidates
          </Text>
          {rows.map((row, i) => (
            <CandidateCard key={row.id} row={row} index={i} />
          ))}
        </>
      )}
    </ScrollView>
  )
}

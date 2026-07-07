import { View, Text, ScrollView } from 'react-native'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { AtsRow, STAGE_CONFIG, STAGE_ORDER, RowStage } from './types'

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

interface StatCardProps {
  label: string
  value: number
  color: string
  index: number
}

function StatCard({ label, value, color, index }: StatCardProps) {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 60).duration(350)}
      style={{
        flex: 1,
        backgroundColor: '#EDE7DB',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: '#C8BFB0',
      }}
    >
      <Text style={{ fontSize: 30, fontWeight: '800', color, marginBottom: 4, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 10, fontWeight: '700', color: '#5A4F6E', letterSpacing: 0.8, textTransform: 'uppercase' }}>
        {label}
      </Text>
    </Animated.View>
  )
}

interface Props {
  rows: AtsRow[]
}

export function OverviewTab({ rows }: Props) {
  const total      = rows.length
  const hired      = rows.filter((r) => r.stage === 'hired').length
  const rejected   = rows.filter((r) => r.stage === 'rejected').length
  const inPipeline = total - hired - rejected

  const grouped = STAGE_ORDER.reduce<Record<RowStage, AtsRow[]>>(
    (acc, stage) => {
      acc[stage] = rows.filter((r) => r.stage === stage)
      return acc
    },
    {} as Record<RowStage, AtsRow[]>,
  )

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Stat cards — 2×2 grid */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
        <StatCard label="Total" value={total} color="#FF6240" index={0} />
        <StatCard label="In Pipeline" value={inPipeline} color="#818CF8" index={1} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
        <StatCard label="Hired" value={hired} color="#0DD4C3" index={2} />
        <StatCard label="Rejected" value={rejected} color="#EF4444" index={3} />
      </View>

      {total === 0 && (
        <View style={{ alignItems: 'center', paddingTop: 32 }}>
          <Text style={{ color: '#5A4F6E', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>
            No candidates yet
          </Text>
          <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center' }}>
            Switch to the Data tab to add candidates.
          </Text>
        </View>
      )}

      {/* Grouped sections by stage */}
      {STAGE_ORDER.map((stage) => {
        const stageRows = grouped[stage]
        if (stageRows.length === 0) return null
        const cfg = STAGE_CONFIG[stage]

        return (
          <View key={stage} style={{ marginBottom: 24 }}>
            {/* Section header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: cfg.color }} />
              <Text style={{
                fontSize: 11,
                fontWeight: '700',
                color: cfg.color,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
              }}>
                {cfg.label}
              </Text>
              <View style={{
                backgroundColor: cfg.bg,
                borderRadius: 99,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderWidth: 1,
                borderColor: cfg.color + '50',
              }}>
                <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '700' }}>
                  {stageRows.length}
                </Text>
              </View>
            </View>

            {/* Candidate rows */}
            {stageRows.map((row, i) => (
              <Animated.View
                key={row.id}
                entering={FadeInDown.delay(i * 40).duration(280)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  backgroundColor: '#EDE7DB',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 8,
                  borderWidth: 1,
                  borderColor: '#C8BFB0',
                  gap: 12,
                }}
              >
                {/* Initials avatar */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  backgroundColor: cfg.bg,
                  borderWidth: 1.5,
                  borderColor: cfg.color + '60',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Text style={{ color: cfg.color, fontSize: 12, fontWeight: '800' }}>
                    {getInitials(row.label)}
                  </Text>
                </View>

                {/* Info */}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>
                    {row.label}
                  </Text>
                  {row.notes ? (
                    <Text style={{ color: '#5A4F6E', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                      {row.notes}
                    </Text>
                  ) : null}
                  <Text style={{ color: '#9A8FA6', fontSize: 10, marginTop: 3 }}>
                    Added {formatDate(row.created_at)}
                  </Text>
                </View>

                {/* Stage badge */}
                <View style={{
                  backgroundColor: cfg.bg,
                  borderRadius: 8,
                  paddingHorizontal: 9,
                  paddingVertical: 5,
                  borderWidth: 1,
                  borderColor: cfg.color + '40',
                  flexShrink: 0,
                }}>
                  <Text style={{ color: cfg.color, fontSize: 10, fontWeight: '700' }}>
                    {cfg.label}
                  </Text>
                </View>
              </Animated.View>
            ))}
          </View>
        )
      })}
    </ScrollView>
  )
}

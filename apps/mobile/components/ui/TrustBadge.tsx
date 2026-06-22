import { View, Text } from 'react-native'
import { TRUST_SCORE } from '@/lib/constants'

interface TrustBadgeProps {
  score: number
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#22C55E'
  if (score >= TRUST_SCORE.LOW_THRESHOLD) return '#EAB308'
  return '#EF4444'
}

function getScoreLabel(score: number): string {
  if (score >= 80) return 'High Trust'
  if (score >= TRUST_SCORE.LOW_THRESHOLD) return 'Mid Trust'
  return 'Low Trust'
}

const sizeMap = {
  sm: { circle: 'w-8 h-8', text: 'text-xs', label: 'text-xs' },
  md: { circle: 'w-12 h-12', text: 'text-sm', label: 'text-sm' },
  lg: { circle: 'w-16 h-16', text: 'text-base', label: 'text-sm' },
}

export function TrustBadge({ score, size = 'md', showLabel = false }: TrustBadgeProps) {
  const color = getScoreColor(score)
  const label = getScoreLabel(score)
  const s = sizeMap[size]

  return (
    <View className="items-center gap-1">
      <View
        className={`${s.circle} rounded-full items-center justify-center border-2`}
        style={{ borderColor: color, backgroundColor: `${color}15` }}
      >
        <Text className={`${s.text} font-bold`} style={{ color }}>
          {score}
        </Text>
      </View>
      {showLabel && (
        <Text className={`${s.label} font-medium`} style={{ color }}>
          {label}
        </Text>
      )}
    </View>
  )
}

import { View, Text } from 'react-native'
import Animated, { FadeIn, useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated'
import { useEffect } from 'react'
import Svg, { Circle, Path } from 'react-native-svg'

function WrenchIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="32" fill="#0D0B13" />
      <Circle cx="32" cy="32" r="20" fill="none" stroke="#6366F1" strokeWidth="2" strokeOpacity="0.25" />
      <Path
        d="M38,16 Q44,20 44,26 Q44,30 41,33 L24,50 Q22,52 20,50 Q18,48 20,46 L37,29 Q40,26 40,22 Q40,19 38,16 Z"
        fill="none"
        stroke="#6366F1"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="21.5" cy="48.5" r="3" fill="#6366F1" />
      <Path
        d="M26,20 Q22,18 18,20 Q16,26 20,29 L23,26 L26,29 Q30,25 28,21 Z"
        fill="#6366F1"
        fillOpacity="0.7"
      />
    </Svg>
  )
}

function PulsingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const id = setTimeout(() => {
      opacity.value = withRepeat(
        withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      )
    }, delay)
    return () => clearTimeout(id)
  }, [delay])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        style,
        { width: 8, height: 8, borderRadius: 4, backgroundColor: '#6366F1' },
      ]}
    />
  )
}

type Props = {
  message?: string | null
}

export function MaintenanceScreen({ message }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 bg-surface items-center justify-center px-8 gap-6"
    >
      <WrenchIcon />

      <View className="items-center gap-2">
        <Text className="text-[#1A1625] font-display text-2xl text-center">
          Down for maintenance
        </Text>
        <Text className="text-slate-400 font-sans text-base text-center leading-relaxed">
          {message ?? "We're making Workstation better. We'll be back shortly."}
        </Text>
      </View>

      <View className="bg-surface-card rounded-2xl p-4 border border-surface-border w-full">
        <View className="flex-row items-center gap-3 mb-3">
          <View className="flex-row gap-1.5">
            <PulsingDot delay={0} />
            <PulsingDot delay={200} />
            <PulsingDot delay={400} />
          </View>
          <Text className="text-slate-400 font-sans text-xs">Maintenance in progress</Text>
        </View>
        <Text className="text-[#1A1625] font-sans text-sm">
          Our team is working to restore service. Thank you for your patience.
        </Text>
      </View>

      <View className="absolute bottom-12 flex-row items-center gap-2">
        <View className="w-2 h-2 rounded-full bg-indigo-500" />
        <Text className="text-slate-400 font-sans text-xs">Workstation — system maintenance</Text>
      </View>
    </Animated.View>
  )
}

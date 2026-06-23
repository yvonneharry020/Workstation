import { View, Text, Pressable } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import Svg, { Circle, Line, Path } from 'react-native-svg'

function WifiOffIcon() {
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64">
      <Circle cx="32" cy="32" r="32" fill="#0D0B13" />
      <Path
        d="M32,42 L32,44"
        stroke="#0DD4C3"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <Path
        d="M22,35 Q32,26 42,35"
        fill="none"
        stroke="#0DD4C3"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      <Path
        d="M14,28 Q32,14 50,28"
        fill="none"
        stroke="#0DD4C3"
        strokeWidth="3"
        strokeLinecap="round"
        strokeOpacity="0.3"
      />
      <Line
        x1="12"
        y1="12"
        x2="52"
        y2="52"
        stroke="#EF4444"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  )
}

type Props = {
  onRetry: () => void
}

export function OfflineScreen({ onRetry }: Props) {
  return (
    <Animated.View
      entering={FadeIn.duration(300)}
      className="flex-1 bg-surface items-center justify-center px-8 gap-6"
    >
      <WifiOffIcon />

      <View className="items-center gap-2">
        <Text className="text-white font-display text-2xl text-center">
          No connection
        </Text>
        <Text className="text-slate-400 font-sans text-base text-center leading-relaxed">
          Check your internet connection and try again.
        </Text>
      </View>

      <Pressable
        onPress={onRetry}
        className="bg-surface-card border border-surface-border rounded-2xl px-8 py-3.5 active:opacity-70"
      >
        <Text className="text-teal-500 font-semibold text-base">Try again</Text>
      </Pressable>

      <View className="absolute bottom-12 flex-row items-center gap-2">
        <View className="w-2 h-2 rounded-full bg-red-500" />
        <Text className="text-slate-400 font-sans text-xs">Offline</Text>
      </View>
    </Animated.View>
  )
}

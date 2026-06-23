import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { Storage } from '@/lib/storage'

const TOTAL_SLIDES = 3

function TrustIllustration() {
  return (
    <Svg width="100%" height={240} viewBox="0 0 300 240">
      <Circle cx="150" cy="120" r="108" fill="#FF6240" fillOpacity="0.04" />
      <Circle cx="150" cy="120" r="82" fill="#FF6240" fillOpacity="0.06" />
      <Path
        d="M150,28 L212,56 L212,128 Q212,172 150,197 Q88,172 88,128 L88,56 Z"
        fill="#FF6240"
      />
      <Path
        d="M150,50 L196,73 L196,128 Q196,163 150,179 Q104,163 104,128 L104,73 Z"
        fill="#131118"
      />
      <Path
        d="M123,117 L141,135 L178,91"
        stroke="#FF6240"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="60" cy="68" r="22" fill="#0D0B13" stroke="#0DD4C3" strokeWidth="1.5" />
      <Circle cx="240" cy="68" r="22" fill="#0D0B13" stroke="#0DD4C3" strokeWidth="1.5" />
      <Circle cx="60" cy="175" r="22" fill="#0D0B13" stroke="#0DD4C3" strokeWidth="1.5" />
      <Circle cx="240" cy="175" r="22" fill="#0D0B13" stroke="#0DD4C3" strokeWidth="1.5" />
      <Circle cx="60" cy="62" r="6" fill="#0DD4C3" />
      <Path
        d="M52,76 L68,76"
        stroke="#0DD4C3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <Circle cx="240" cy="62" r="6" fill="#0DD4C3" />
      <Path
        d="M232,76 L248,76"
        stroke="#0DD4C3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <Circle cx="60" cy="169" r="6" fill="#0DD4C3" />
      <Path
        d="M52,182 L68,182"
        stroke="#0DD4C3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <Circle cx="240" cy="169" r="6" fill="#0DD4C3" />
      <Path
        d="M232,182 L248,182"
        stroke="#0DD4C3"
        strokeWidth="2"
        strokeLinecap="round"
        strokeOpacity="0.5"
      />
      <Path
        d="M82,79 L105,96"
        stroke="#0DD4C3"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="4,3"
      />
      <Path
        d="M218,79 L195,96"
        stroke="#0DD4C3"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="4,3"
      />
      <Path
        d="M82,164 L105,150"
        stroke="#0DD4C3"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="4,3"
      />
      <Path
        d="M218,164 L195,150"
        stroke="#0DD4C3"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="4,3"
      />
    </Svg>
  )
}

function SlideProgress({ current }: { current: number }) {
  return (
    <View className="flex-row gap-1.5 items-center">
      {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
        <View
          key={i}
          style={{
            height: 4,
            width: i === current ? 24 : 8,
            borderRadius: 2,
            backgroundColor: i === current ? '#FF6240' : '#3D3850',
          }}
        />
      ))}
    </View>
  )
}

export default function Tutorial1() {
  const router = useRouter()

  const handleSkip = () => {
    Storage.markTutorialSeen()
    router.replace('/(auth)/welcome')
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row justify-between items-center px-6 pt-4 pb-2">
        <View style={{ width: 44 }} />
        <SlideProgress current={0} />
        <Pressable onPress={handleSkip} hitSlop={8} className="px-2 py-1">
          <Text className="text-slate-400 font-sans text-sm">Skip</Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeInUp.delay(50).duration(600)} className="flex-1 justify-center items-center px-6">
        <TrustIllustration />
      </Animated.View>

      <View className="px-6 pb-8 gap-4">
        <Animated.View entering={FadeInDown.delay(150).duration(500)}>
          <View className="bg-surface-card rounded-2xl px-4 py-3 flex-row items-center gap-3 border border-surface-border">
            <View
              style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF6240' }}
            />
            <Text className="text-slate-400 font-sans text-sm flex-1">
              <Text className="text-primary-400 font-semibold">₦22M+ </Text>
              lost to job fraud in Nigeria every year
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(500)} className="gap-2">
          <Text className="text-white font-display text-[26px] leading-tight tracking-tight">
            Nigeria's first{'\n'}
            <Text className="text-primary-500">trust-first</Text>
            {' '}job platform
          </Text>
          <Text className="text-slate-400 font-sans text-base leading-relaxed">
            Every company verified by CAC. Every candidate verified by NIN. Zero tolerance for fraud.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(380).duration(500)}>
          <Pressable
            onPress={() => router.replace('/(tutorial)/tutorial-2')}
            className="bg-primary-500 rounded-2xl py-4 items-center mt-1 active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

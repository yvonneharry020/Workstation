import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { Storage } from '@/lib/storage'

const TOTAL_SLIDES = 3

function CandidateIllustration() {
  return (
    <Svg width="100%" height={240} viewBox="0 0 300 240">
      <Circle cx="150" cy="118" r="105" fill="#FF6240" fillOpacity="0.03" />
      <Circle cx="150" cy="118" r="72" fill="#1E1B2A" stroke="#2A2638" strokeWidth="1.5" />
      <Circle cx="150" cy="100" r="24" fill="#2A2638" />
      <Path
        d="M108,158 Q108,136 129,133 Q150,130 150,130 Q150,130 171,133 Q192,136 192,158"
        fill="#2A2638"
      />
      <Circle
        cx="150"
        cy="118"
        r="82"
        fill="none"
        stroke="#FF6240"
        strokeWidth="4"
        strokeOpacity="0.15"
      />
      <Path
        d="M150,36 A82,82 0 1,1 84,174"
        fill="none"
        stroke="#FF6240"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <Circle cx="220" cy="65" r="28" fill="#131118" stroke="#FF6240" strokeWidth="2" />
      <Circle cx="220" cy="57" r="8" fill="#FF6240" />
      <Path
        d="M209,68 L218,78 L233,60"
        stroke="#FF8264"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="82" cy="65" r="24" fill="#131118" stroke="#0DD4C3" strokeWidth="1.5" />
      <Rect x="72" y="58" width="20" height="3" rx="1.5" fill="#0DD4C3" />
      <Rect x="72" y="64" width="14" height="3" rx="1.5" fill="#0DD4C3" fillOpacity="0.6" />
      <Rect x="72" y="70" width="17" height="3" rx="1.5" fill="#0DD4C3" fillOpacity="0.4" />
      <Circle cx="80" cy="178" r="22" fill="#131118" stroke="#22C55E" strokeWidth="1.5" />
      <Path
        d="M69,178 L79,190 L96,165"
        stroke="#22C55E"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Circle cx="220" cy="178" r="22" fill="#131118" stroke="#F59E0B" strokeWidth="1.5" />
      <Rect x="212" y="170" width="16" height="3" rx="1.5" fill="#F59E0B" />
      <Rect x="212" y="176" width="10" height="3" rx="1.5" fill="#F59E0B" fillOpacity="0.6" />
      <Rect x="212" y="182" width="13" height="3" rx="1.5" fill="#F59E0B" fillOpacity="0.4" />
      <Path
        d="M84,84 L105,100"
        stroke="#0DD4C3"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="3,3"
      />
      <Path
        d="M216,84 L195,100"
        stroke="#FF6240"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="3,3"
      />
      <Path
        d="M86,165 L107,152"
        stroke="#22C55E"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="3,3"
      />
      <Path
        d="M214,165 L193,152"
        stroke="#F59E0B"
        strokeWidth="1"
        strokeOpacity="0.3"
        strokeDasharray="3,3"
      />
    </Svg>
  )
}

function FeatureRow({ icon, label, sub }: { icon: string; label: string; sub: string }) {
  return (
    <View className="flex-row items-start gap-3">
      <View
        className="bg-surface-card border border-surface-border rounded-xl items-center justify-center"
        style={{ width: 36, height: 36 }}
      >
        <Text style={{ fontSize: 16 }}>{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-white font-semibold text-sm">{label}</Text>
        <Text className="text-slate-400 font-sans text-xs mt-0.5">{sub}</Text>
      </View>
    </View>
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

export default function Tutorial2() {
  const router = useRouter()

  const handleSkip = () => {
    Storage.markTutorialSeen()
    router.replace('/(auth)/welcome')
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row justify-between items-center px-6 pt-4 pb-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          className="px-2 py-1"
        >
          <Text className="text-slate-400 font-sans text-sm">←</Text>
        </Pressable>
        <SlideProgress current={1} />
        <Pressable onPress={handleSkip} hitSlop={8} className="px-2 py-1">
          <Text className="text-slate-400 font-sans text-sm">Skip</Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeInUp.delay(50).duration(600)} className="flex-1 justify-center items-center px-6">
        <CandidateIllustration />
      </Animated.View>

      <View className="px-6 pb-8 gap-4">
        <Animated.View entering={FadeInDown.delay(150).duration(500)} className="gap-1.5">
          <Text className="text-white font-display text-[26px] leading-tight tracking-tight">
            Your identity is{'\n'}
            <Text className="text-primary-500">your superpower</Text>
          </Text>
          <Text className="text-slate-400 font-sans text-sm leading-relaxed">
            Verified candidates get seen first. Build your trust score and let your record speak.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(500)} className="gap-3">
          <FeatureRow
            icon="🪪"
            label="NIN-verified identity"
            sub="Stand out to employers as a real, trusted candidate"
          />
          <FeatureRow
            icon="🏅"
            label="Trust score badge"
            sub="Earn a visible badge that grows with every verification"
          />
          <FeatureRow
            icon="📋"
            label="Application tracker"
            sub="See where every application stands in real time"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)}>
          <Pressable
            onPress={() => router.replace('/(tutorial)/tutorial-3')}
            className="bg-primary-500 rounded-2xl py-4 items-center mt-1 active:opacity-80"
          >
            <Text className="text-white font-semibold text-base">Continue</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

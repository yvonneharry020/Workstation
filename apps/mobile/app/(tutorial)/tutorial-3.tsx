import { View, Text, Pressable } from 'react-native'
import { useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Circle, Path, Rect, G } from 'react-native-svg'
import { Storage } from '@/lib/storage'

const TOTAL_SLIDES = 3

function CompanyIllustration() {
  return (
    <Svg width="100%" height={240} viewBox="0 0 300 240">
      <Circle cx="150" cy="108" r="100" fill="#0DD4C3" fillOpacity="0.03" />
      <Rect x="90" y="50" width="120" height="130" rx="6" fill="#1E1B2A" stroke="#3D3850" strokeWidth="1.5" />
      <Rect x="90" y="50" width="120" height="26" rx="6" fill="#2A2638" />
      <Rect x="104" y="90" width="22" height="22" rx="3" fill="#2A2638" />
      <Rect x="139" y="90" width="22" height="22" rx="3" fill="#2A2638" />
      <Rect x="174" y="90" width="22" height="22" rx="3" fill="#2A2638" />
      <Rect x="104" y="122" width="22" height="22" rx="3" fill="#2A2638" />
      <Rect
        x="139"
        y="122"
        width="22"
        height="22"
        rx="3"
        fill="#0DD4C3"
        fillOpacity="0.25"
      />
      <Rect x="174" y="122" width="22" height="22" rx="3" fill="#2A2638" />
      <Rect x="135" y="158" width="30" height="22" rx="3" fill="#2A2638" />
      <Rect x="98" y="55" width="28" height="12" rx="3" fill="#0DD4C3" fillOpacity="0.15" />
      <Path
        d="M98,60 L110,60 M98,63 L107,63"
        stroke="#0DD4C3"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeOpacity="0.6"
      />
      <Circle cx="225" cy="65" r="32" fill="#131118" stroke="#22C55E" strokeWidth="2.5" />
      <Path
        d="M209,65 L220,78 L242,47"
        stroke="#22C55E"
        strokeWidth="5.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <G transform="translate(44, 170)">
        <Circle cx="0" cy="0" r="16" fill="#131118" stroke="#FF6240" strokeWidth="1.5" />
        <Circle cx="0" cy="-6" r="5" fill="#FF6240" />
        <Path d="M-10,8 Q-10,1 0,0 Q10,1 10,8" fill="#FF6240" />
      </G>
      <G transform="translate(72, 205)">
        <Circle cx="0" cy="0" r="13" fill="#131118" stroke="#FF6240" strokeWidth="1.5" strokeOpacity="0.7" />
        <Circle cx="0" cy="-5" r="4" fill="#FF6240" fillOpacity="0.6" />
        <Path d="M-8,6 Q-8,0 0,0 Q8,0 8,6" fill="#FF6240" fillOpacity="0.6" />
      </G>
      <G transform="translate(98, 218)">
        <Circle cx="0" cy="0" r="11" fill="#131118" stroke="#FF6240" strokeWidth="1.5" strokeOpacity="0.4" />
        <Circle cx="0" cy="-4" r="3.5" fill="#FF6240" fillOpacity="0.4" />
        <Path d="M-7,5 Q-7,0 0,0 Q7,0 7,5" fill="#FF6240" fillOpacity="0.4" />
      </G>
      <Path
        d="M60,161 L90,155"
        stroke="#FF6240"
        strokeWidth="1"
        strokeOpacity="0.35"
        strokeDasharray="3,3"
      />
      <Path
        d="M72,193 L90,180"
        stroke="#FF6240"
        strokeWidth="1"
        strokeOpacity="0.25"
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
        <Text className="text-[#1A1625] font-semibold text-sm">{label}</Text>
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
            backgroundColor: i === current ? '#FF6240' : '#C8BFB0',
          }}
        />
      ))}
    </View>
  )
}

export default function Tutorial3() {
  const router = useRouter()

  const handleGetStarted = () => {
    Storage.markTutorialSeen()
    router.replace('/(auth)/register')
  }

  const handleSkip = () => {
    Storage.markTutorialSeen()
    router.replace('/(auth)/welcome')
  }

  const handleSignIn = () => {
    Storage.markTutorialSeen()
    router.replace('/(auth)/login')
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
        <SlideProgress current={2} />
        <Pressable onPress={handleSkip} hitSlop={8} className="px-2 py-1">
          <Text className="text-slate-400 font-sans text-sm">Skip</Text>
        </Pressable>
      </View>

      <Animated.View entering={FadeInUp.delay(50).duration(600)} className="flex-1 justify-center items-center px-6">
        <CompanyIllustration />
      </Animated.View>

      <View className="px-6 pb-8 gap-4">
        <Animated.View entering={FadeInDown.delay(150).duration(500)} className="gap-1.5">
          <Text className="text-[#1A1625] font-display text-[26px] leading-tight tracking-tight">
            Hire people you can{'\n'}
            <Text className="text-teal-500">actually trust</Text>
          </Text>
          <Text className="text-slate-400 font-sans text-sm leading-relaxed">
            CAC-verified companies only. No ghost listings, no scam postings. Real jobs, real candidates.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(260).duration(500)} className="gap-3">
          <FeatureRow
            icon="🏢"
            label="CAC-verified company profiles"
            sub="Your company is trusted from day one"
          />
          <FeatureRow
            icon="📊"
            label="Built-in ATS dashboard"
            sub="Track applications, shortlist, and schedule — all in one place"
          />
          <FeatureRow
            icon="🎯"
            label="Pre-screened candidate pool"
            sub="Every applicant is NIN-verified before they even apply"
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(500)} className="gap-3 mt-1">
          <Pressable
            onPress={handleGetStarted}
            className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-base">Get started</Text>
          </Pressable>
          <Pressable
            onPress={handleSignIn}
            className="border border-surface-border rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-base">Sign in</Text>
          </Pressable>
        </Animated.View>
      </View>
    </SafeAreaView>
  )
}

import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path, Circle, Rect } from 'react-native-svg'

function ShieldIcon({ size = 28, color = '#FF6240' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L4 6V12C4 16.4 7.4 20.5 12 22C16.6 20.5 20 16.4 20 12V6L12 2Z"
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9 12L11 14L15 10"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function CheckBadge({ color = '#0DD4C3' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"
        fill={color}
        fillOpacity={0.15}
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M9.5 11.5L11.5 13.5L15.5 9.5"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

type FeatureItem = {
  icon: string
  title: string
  desc: string
}

const FEATURES: FeatureItem[] = [
  {
    icon: '🪪',
    title: 'NIN-verified candidates',
    desc: 'Every profile is linked to a verified Nigerian identity',
  },
  {
    icon: '🏢',
    title: 'CAC-verified companies',
    desc: 'Every employer is confirmed against the corporate registry',
  },
  {
    icon: '🏅',
    title: 'Trust score system',
    desc: 'See real verification status at a glance, on every profile',
  },
]

function FeatureRow({ icon, title, desc }: FeatureItem) {
  return (
    <View className="flex-row items-start gap-3 mb-4">
      <View
        className="bg-surface-card border border-surface-border rounded-xl items-center justify-center"
        style={{ width: 40, height: 40, flexShrink: 0 }}
      >
        <Text style={{ fontSize: 18 }}>{icon}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-[#1A1625] font-semibold text-sm">{title}</Text>
        <Text className="text-slate-400 font-sans text-xs mt-0.5 leading-4">{desc}</Text>
      </View>
    </View>
  )
}

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface" style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View
          entering={FadeInUp.delay(50).duration(600)}
          className="items-center pt-12 pb-8"
        >
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 20,
              backgroundColor: '#FF6240',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Text
              style={{
                color: '#1A1625',
                fontSize: 36,
                fontWeight: '800',
                lineHeight: 40,
              }}
            >
              W
            </Text>
          </View>

          <Text
            style={{
              color: '#1A1625',
              fontSize: 32,
              fontWeight: '700',
              textAlign: 'center',
              letterSpacing: -0.5,
              marginBottom: 10,
            }}
          >
            Workstation
          </Text>

          <Text className="text-slate-400 text-base text-center leading-6 px-4">
            Nigeria's first trust-first job platform. Every company verified. Every candidate real.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(500)} className="mb-6">
          <View className="bg-surface-card rounded-2xl px-5 py-4 border border-surface-border">
            <View className="flex-row items-center gap-2 mb-3">
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: '#FF6240',
                }}
              />
              <Text className="text-slate-400 text-xs font-medium uppercase tracking-widest">
                Why it matters
              </Text>
            </View>
            <Text className="text-[#1A1625] text-sm leading-5">
              <Text className="text-primary-400 font-semibold">₦22M+ </Text>
              stolen from Nigerian job seekers in documented fraud cases. Workstation was built to end this.
            </Text>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(500)} className="mb-2">
          <View className="flex-row gap-2 mb-5">
            <View className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-3 flex-row items-center gap-2">
              <CheckBadge color="#0DD4C3" />
              <Text className="text-teal-500 text-xs font-semibold flex-1" numberOfLines={1}>
                NIN verified
              </Text>
            </View>
            <View className="flex-1 bg-surface-card border border-surface-border rounded-xl px-3 py-3 flex-row items-center gap-2">
              <CheckBadge color="#22C55E" />
              <Text className="text-green-400 text-xs font-semibold flex-1" numberOfLines={1}>
                CAC verified
              </Text>
            </View>
          </View>

          {FEATURES.map((f) => (
            <FeatureRow key={f.title} {...f} />
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(480).duration(500)} className="gap-3 mt-2">
          <Pressable
            onPress={() => router.push('/(auth)/register')}
            className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
            style={{ backgroundColor: '#FF6240', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text className="text-[#1A1625] font-semibold text-base" style={{ color: '#1A1625', fontWeight: '600', fontSize: 16 }}>Create an account</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/(auth)/login')}
            className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center active:opacity-70"
            style={{ backgroundColor: '#1A1825', borderWidth: 1, borderColor: '#2A2738', borderRadius: 16, paddingVertical: 16, alignItems: 'center' }}
          >
            <Text className="text-[#1A1625] font-semibold text-base" style={{ color: '#1A1625', fontWeight: '600', fontSize: 16 }}>Sign in</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push('/jobs')}
            className="py-2 items-center"
          >
            <Text className="text-primary-400 text-sm font-medium">
              Browse jobs without signing in →
            </Text>
          </Pressable>

          <Text className="text-slate-600 text-xs text-center mt-1">
            By continuing you agree to our Terms of Service and Privacy Policy
          </Text>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

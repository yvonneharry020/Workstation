import { View, Text, Pressable, ScrollView } from 'react-native'
import { useEffect } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSequence,
  withRepeat,
  Easing,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

function ConfettiParticle({ x, delay }: { x: number; delay: number }) {
  const y = useSharedValue(-10)
  const opacity = useSharedValue(0)

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }))
    y.value = withDelay(
      delay,
      withSequence(
        withTiming(280, { duration: 1800, easing: Easing.out(Easing.quad) }),
        withTiming(280, { duration: 0 })
      )
    )
  }, [delay, opacity, y])

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y.value,
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[style]}
    >
      <Text style={{ fontSize: 16 }}>
        {['🎊', '✨', '🎉', '⭐'][Math.floor(x / 80) % 4]}
      </Text>
    </Animated.View>
  )
}

function TrustScoreRing({ score }: { score: number }) {
  const progress = useSharedValue(0)

  useEffect(() => {
    progress.value = withDelay(600, withTiming(score / 100, { duration: 1200, easing: Easing.out(Easing.cubic) }))
  }, [score, progress])

  const circumference = 2 * Math.PI * 44

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: 120, height: 120 }}>
      <Svg width={120} height={120} viewBox="0 0 120 120">
        <Circle
          cx="60" cy="60" r="44"
          stroke="#1E1B2E"
          strokeWidth={8}
          fill="none"
        />
        <Circle
          cx="60" cy="60" r="44"
          stroke="#FF6240"
          strokeWidth={8}
          fill="none"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          strokeLinecap="round"
          transform="rotate(-90 60 60)"
        />
      </Svg>
      <View
        style={{
          position: 'absolute',
          alignItems: 'center',
        }}
      >
        <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '800' }}>{score}</Text>
        <Text style={{ color: '#64748B', fontSize: 11 }}>/ 100</Text>
      </View>
    </View>
  )
}

const ACTION_CARDS = [
  {
    id: 'browse',
    icon: '🔍',
    title: 'Browse jobs',
    desc: 'Explore verified opportunities matching your profile.',
    route: '/(candidate)/jobs',
    primary: true,
  },
  {
    id: 'profile',
    icon: '👤',
    title: 'Complete profile',
    desc: 'Add skills, portfolio links, and a professional photo.',
    route: '/(candidate)/profile',
    primary: false,
  },
  {
    id: 'alerts',
    icon: '🔔',
    title: 'Set job alerts',
    desc: 'Get notified when roles matching your criteria are posted.',
    route: '/(candidate)/settings/alerts',
    primary: false,
  },
]

export default function CandidateApproved() {
  const user = useAuthStore((s) => s.user)
  const setOnboardingComplete = useAuthStore((s) => s.setOnboardingComplete)

  const TRUST_SCORE = 82

  useEffect(() => {
    setOnboardingComplete(true)
    if (user?.id) {
      supabase.from('candidate_profiles').update({
        verification_status: 'approved',
        trust_score: TRUST_SCORE,
        onboarding_complete: true,
      }).eq('id', user.id)
    }
  }, [user?.id, setOnboardingComplete])

  const confettiPositions = [20, 60, 110, 160, 220, 270, 310]
  const confettiDelays = [0, 100, 200, 150, 80, 250, 50]

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Confetti layer */}
        <View style={{ height: 0, overflow: 'visible' }}>
          {confettiPositions.map((x, i) => (
            <ConfettiParticle key={x} x={x} delay={confettiDelays[i] ?? 0} />
          ))}
        </View>

        {/* Badge + heading */}
        <Animated.View entering={FadeInDown.duration(500)} className="items-center mt-16 mb-8">
          <View
            style={{
              width: 100,
              height: 100,
              borderRadius: 50,
              backgroundColor: '#22C55E15',
              borderWidth: 1.5,
              borderColor: '#22C55E40',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 20,
            }}
          >
            <Text style={{ fontSize: 44 }}>🎉</Text>
          </View>

          <Text
            style={{
              color: '#1A1625',
              fontSize: 30,
              fontWeight: '800',
              letterSpacing: -0.5,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            You're verified!
          </Text>
          <Text className="text-slate-400 text-sm text-center leading-5 px-4">
            Your profile has been reviewed and approved. Employers can now discover you on Workstation.
          </Text>
        </Animated.View>

        {/* Trust score */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(500)}
          className="bg-surface-card border border-surface-border rounded-3xl px-5 py-6 items-center mb-6"
        >
          <Text className="text-slate-300 text-sm font-semibold mb-4">Trust score</Text>
          <TrustScoreRing score={TRUST_SCORE} />
          <Text className="text-slate-400 text-xs text-center mt-4 leading-4 px-4">
            Your trust score reflects identity verification strength. Add more details to your
            profile to improve it.
          </Text>

          <View className="flex-row gap-2 mt-4 flex-wrap justify-center">
            {[
              { label: 'Phone ✓', color: '#22C55E' },
              { label: 'NIN ✓', color: '#22C55E' },
              { label: 'Liveness ✓', color: '#22C55E' },
              { label: 'Documents ✓', color: '#22C55E' },
            ].map((badge) => (
              <View
                key={badge.label}
                style={{
                  paddingHorizontal: 10,
                  paddingVertical: 4,
                  borderRadius: 12,
                  backgroundColor: badge.color + '20',
                  borderWidth: 1,
                  borderColor: badge.color + '40',
                }}
              >
                <Text style={{ color: badge.color, fontSize: 11, fontWeight: '600' }}>
                  {badge.label}
                </Text>
              </View>
            ))}
          </View>
        </Animated.View>

        {/* Action cards */}
        <Animated.View entering={FadeInUp.delay(400).duration(500)}>
          <Text className="text-slate-300 text-sm font-semibold mb-3">What would you like to do?</Text>
          {ACTION_CARDS.map((card, i) => (
            <Pressable
              key={card.id}
              onPress={() => router.replace(card.route as Parameters<typeof router.replace>[0])}
              className="flex-row items-center gap-4 rounded-2xl px-5 py-4 mb-3 active:opacity-80"
              style={{
                backgroundColor: card.primary ? '#FF6240' : '#EDE7DB',
                borderWidth: 1,
                borderColor: card.primary ? '#FF6240' : '#C8BFB0',
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: card.primary ? 'rgba(255,255,255,0.15)' : '#3D385030',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 22 }}>{card.icon}</Text>
              </View>
              <View className="flex-1">
                <Text
                  style={{
                    color: '#1A1625',
                    fontSize: 14,
                    fontWeight: '600',
                    marginBottom: 2,
                  }}
                >
                  {card.title}
                </Text>
                <Text
                  style={{
                    color: card.primary ? 'rgba(255,255,255,0.7)' : '#64748B',
                    fontSize: 12,
                    lineHeight: 16,
                  }}
                >
                  {card.desc}
                </Text>
              </View>
              <Text style={{ color: card.primary ? '#1A1625' : '#64748B', fontSize: 18 }}>→</Text>
            </Pressable>
          ))}
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(600).duration(400)} className="items-center mt-4">
          <Pressable onPress={() => router.replace('/(candidate)/' as never)}>
            <Text className="text-slate-500 text-sm">Go to dashboard →</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

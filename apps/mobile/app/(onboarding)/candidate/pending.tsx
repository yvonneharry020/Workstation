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
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CheckStep {
  label: string
  detail: string
  done: boolean
}

const STEPS: CheckStep[] = [
  { label: 'Phone verified', detail: 'SMS code confirmed', done: true },
  { label: 'NIN matched', detail: 'Identity confirmed via NIMC', done: true },
  { label: 'Liveness passed', detail: 'Real person confirmed', done: true },
  { label: 'Documents under review', detail: 'Compliance team reviewing', done: false },
]

const NEXT_STEPS = [
  {
    emoji: '🔍',
    title: 'Document review',
    detail: 'Our compliance team cross-checks your documents and NIN — usually 1–2 business days.',
  },
  {
    emoji: '🏅',
    title: 'Trust badge assigned',
    detail: 'A verified badge and trust score are applied to your public profile.',
  },
  {
    emoji: '🚀',
    title: 'You start getting matched',
    detail: 'Employers can discover and reach out to you directly.',
  },
]

function PulsingOrb() {
  const scale = useSharedValue(1)
  const ringScale = useSharedValue(1)
  const ringOpacity = useSharedValue(0.4)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.07, { duration: 1800 }), withTiming(1, { duration: 1800 })),
      -1,
      true
    )
    ringScale.value = withRepeat(
      withSequence(withTiming(1.4, { duration: 2000, easing: Easing.out(Easing.cubic) }), withTiming(1, { duration: 0 })),
      -1,
      false
    )
    ringOpacity.value = withRepeat(
      withSequence(withTiming(0, { duration: 2000, easing: Easing.out(Easing.cubic) }), withTiming(0.4, { duration: 0 })),
      -1,
      false
    )
  }, [scale, ringScale, ringOpacity])

  const orbStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }))

  return (
    <View style={{ width: 120, height: 120, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 110,
            height: 110,
            borderRadius: 55,
            borderWidth: 2,
            borderColor: '#F59E0B',
          },
          ringStyle,
        ]}
      />
      <Animated.View
        style={[
          {
            width: 88,
            height: 88,
            borderRadius: 44,
            backgroundColor: '#1C1400',
            borderWidth: 2,
            borderColor: '#F59E0B60',
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#F59E0B',
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 16,
            elevation: 10,
          },
          orbStyle,
        ]}
      >
        <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx="12" cy="12" r="10" />
          <Path d="M12 6v6l4 2" />
        </Svg>
      </Animated.View>
    </View>
  )
}

function StepRow({ step, index, isLast }: { step: CheckStep; index: number; isLast: boolean }) {
  const opacity = useSharedValue(0)
  const translateX = useSharedValue(-16)

  useEffect(() => {
    opacity.value = withDelay(200 + index * 100, withTiming(1, { duration: 400 }))
    translateX.value = withDelay(200 + index * 100, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }))
  }, [index, opacity, translateX])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateX: translateX.value }],
  }))

  return (
    <Animated.View style={[{ flexDirection: 'row', alignItems: 'flex-start' }, style]}>
      <View style={{ alignItems: 'center', marginRight: 14, width: 32 }}>
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            backgroundColor: step.done ? '#052E16' : '#1C1400',
            borderWidth: 1.5,
            borderColor: step.done ? '#22C55E60' : '#F59E0B60',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {step.done ? (
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          ) : (
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
          )}
        </View>
        {!isLast && <View style={{ width: 1.5, height: 28, backgroundColor: '#1E1B2E', marginTop: 4 }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: isLast ? 0 : 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
          <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600' }}>{step.label}</Text>
          <View
            style={{
              paddingHorizontal: 7,
              paddingVertical: 3,
              borderRadius: 6,
              backgroundColor: step.done ? '#22C55E15' : '#F59E0B15',
            }}
          >
            <Text style={{ color: step.done ? '#22C55E' : '#F59E0B', fontSize: 10, fontWeight: '700' }}>
              {step.done ? 'Done' : 'Pending'}
            </Text>
          </View>
        </View>
        <Text style={{ color: '#64748B', fontSize: 12 }}>{step.detail}</Text>
      </View>
    </Animated.View>
  )
}

export default function CandidatePending() {
  const user = useAuthStore((s) => s.user)

  useEffect(() => {
    if (user?.id) {
      supabase.from('candidate_profiles').update({
        verification_status: 'pending_review',
      }).eq('id', user.id)
    }
  }, [user?.id])

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09080E' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* ── Hero ── */}
        <Animated.View
          entering={FadeInDown.duration(500)}
          style={{ alignItems: 'center', paddingTop: 52, paddingBottom: 36, paddingHorizontal: 24 }}
        >
          <PulsingOrb />

          <View style={{ backgroundColor: '#F59E0B15', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 5, borderWidth: 1, borderColor: '#F59E0B30', marginTop: 24, marginBottom: 16 }}>
            <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '700', letterSpacing: 1 }}>REVIEW IN PROGRESS</Text>
          </View>

          <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, textAlign: 'center', lineHeight: 36, marginBottom: 12 }}>
            Almost there.{'\n'}Hold tight!
          </Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
            Your documents are with our compliance team. We'll notify you the moment your verification is complete.
          </Text>
        </Animated.View>

        <View style={{ paddingHorizontal: 20 }}>
          {/* ── Verification progress card ── */}
          <Animated.View entering={FadeInUp.delay(150).duration(400)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#0F0D1A', borderRadius: 20, borderWidth: 1, borderColor: '#1E1B2E', padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Verification progress</Text>
                <View style={{ backgroundColor: '#FF624015', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FF624030' }}>
                  <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>3 / 4</Text>
                </View>
              </View>

              {/* Progress bar */}
              <View style={{ height: 5, backgroundColor: '#1E1B2E', borderRadius: 3, overflow: 'hidden', marginBottom: 22 }}>
                <Animated.View
                  entering={FadeInDown.delay(400).duration(1000)}
                  style={{ height: '100%', width: '75%', backgroundColor: '#FF6240', borderRadius: 3 }}
                />
              </View>

              {STEPS.map((step, i) => (
                <StepRow key={step.label} step={step} index={i} isLast={i === STEPS.length - 1} />
              ))}

              <View style={{ marginTop: 16, backgroundColor: '#131118', borderRadius: 12, padding: 12 }}>
                <Text style={{ color: '#475569', fontSize: 12, lineHeight: 18 }}>
                  📬{'  '}You'll receive a push notification and email once your account is approved.
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* ── What happens next ── */}
          <Animated.View entering={FadeInUp.delay(280).duration(400)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#0F0D1A', borderRadius: 20, borderWidth: 1, borderColor: '#1E1B2E', padding: 20 }}>
              <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 20 }}>What happens next</Text>
              {NEXT_STEPS.map((item, i) => (
                <View key={item.title} style={{ flexDirection: 'row', gap: 14, marginBottom: i < NEXT_STEPS.length - 1 ? 18 : 0 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>{item.emoji}</Text>
                    </View>
                    {i < NEXT_STEPS.length - 1 && (
                      <View style={{ width: 1, flex: 1, backgroundColor: '#1E1B2E', marginTop: 6 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: i < NEXT_STEPS.length - 1 ? 12 : 0 }}>
                    <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                    <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 19 }}>{item.detail}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>

          {/* ── Boost CTA ── */}
          <Animated.View entering={FadeInUp.delay(420).duration(400)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#180C00', borderRadius: 20, borderWidth: 1, borderColor: '#FF624030', padding: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ fontSize: 18 }}>⚡</Text>
                </View>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Boost your chances while you wait</Text>
              </View>
              <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 20, marginBottom: 16 }}>
                Candidates with complete work history are{' '}
                <Text style={{ color: '#FF6240', fontWeight: '700' }}>3× more likely</Text>
                {' '}to get shortlisted by top employers.
              </Text>
              <Pressable
                onPress={() => router.push('/(onboarding)/candidate/employment-history')}
                style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Add employment history</Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Skip link */}
          <Animated.View entering={FadeInUp.delay(520).duration(400)}>
            <Pressable
              onPress={() => router.replace('/(candidate)/')}
              style={{ alignItems: 'center', paddingVertical: 16 }}
            >
              <Text style={{ color: '#334155', fontSize: 14 }}>
                Skip for now — go to your dashboard →
              </Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

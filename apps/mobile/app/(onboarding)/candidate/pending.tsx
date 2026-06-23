import { View, Text, Pressable, ScrollView } from 'react-native'
import { useEffect, useRef } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ChecklistItem {
  label: string
  sublabel: string
  done: boolean
  delay: number
}

const CHECKLIST: ChecklistItem[] = [
  { label: 'Phone verified', sublabel: 'SMS code confirmed', done: true, delay: 0 },
  { label: 'NIN matched', sublabel: 'Identity confirmed with NIMC', done: true, delay: 200 },
  { label: 'Liveness passed', sublabel: 'Real person confirmed', done: true, delay: 400 },
  { label: 'Documents submitted', sublabel: 'Under compliance review', done: false, delay: 600 },
]

function ClockIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="10" />
      <Path d="M12 6v6l4 2" />
    </Svg>
  )
}

function AnimatedCheckItem({ item }: { item: ChecklistItem }) {
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(12)

  useEffect(() => {
    opacity.value = withDelay(item.delay, withTiming(1, { duration: 400 }))
    translateY.value = withDelay(item.delay, withTiming(0, { duration: 400, easing: Easing.out(Easing.cubic) }))
  }, [item.delay, opacity, translateY])

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <Animated.View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderBottomWidth: 1,
          borderBottomColor: '#1E1B2E',
        },
        style,
      ]}
    >
      <View
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          backgroundColor: item.done ? '#22C55E20' : '#F59E0B20',
          borderWidth: 1.5,
          borderColor: item.done ? '#22C55E50' : '#F59E0B50',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 14,
        }}
      >
        {item.done ? (
          <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '700' }}>✓</Text>
        ) : (
          <Text style={{ color: '#F59E0B', fontSize: 14 }}>⋯</Text>
        )}
      </View>
      <View className="flex-1">
        <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>{item.label}</Text>
        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 1 }}>{item.sublabel}</Text>
      </View>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          color: item.done ? '#22C55E' : '#F59E0B',
        }}
      >
        {item.done ? 'Done' : 'Pending'}
      </Text>
    </Animated.View>
  )
}

function PulsingRing() {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(withTiming(1.15, { duration: 1000 }), withTiming(1, { duration: 1000 })),
      -1,
      true
    )
    opacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 1000 }), withTiming(0.6, { duration: 1000 })),
      -1,
      true
    )
  }, [opacity, scale])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: 96,
          height: 96,
          borderRadius: 48,
          backgroundColor: '#F59E0B15',
          borderWidth: 1,
          borderColor: '#F59E0B40',
        },
        style,
      ]}
    />
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
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} className="items-center mt-12 mb-10">
          <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <PulsingRing />
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#F59E0B20',
                borderWidth: 1.5,
                borderColor: '#F59E0B40',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1,
              }}
            >
              <ClockIcon />
            </View>
          </View>

          <Text
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: '700',
              letterSpacing: -0.3,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            Verification in progress
          </Text>
          <Text className="text-slate-400 text-sm text-center leading-5 px-4">
            Your documents are being reviewed by our compliance team. This usually takes
            1 – 2 business days.
          </Text>
        </Animated.View>

        {/* Checklist */}
        <Animated.View
          entering={FadeInUp.delay(200).duration(400)}
          className="rounded-2xl overflow-hidden mb-6"
          style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#3D3850' }}
        >
          <View className="px-5 pt-4 pb-3">
            <Text className="text-slate-300 text-sm font-semibold">Verification progress</Text>
          </View>
          {CHECKLIST.map((item) => (
            <AnimatedCheckItem key={item.label} item={item} />
          ))}
          <View className="px-5 py-4">
            <Text className="text-slate-600 text-xs">
              You'll receive an email and push notification once review is complete.
            </Text>
          </View>
        </Animated.View>

        {/* What happens next */}
        <Animated.View
          entering={FadeInUp.delay(400).duration(400)}
          className="rounded-2xl px-5 py-5 mb-6"
          style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#3D3850' }}
        >
          <Text className="text-slate-300 text-sm font-semibold mb-4">What happens next</Text>
          {[
            {
              step: '1',
              title: 'Document review (1 – 2 days)',
              desc: 'Our team cross-checks your documents and NIN record.',
            },
            {
              step: '2',
              title: 'Trust score assigned',
              desc: 'A verified badge and trust score are added to your profile.',
            },
            {
              step: '3',
              title: 'Start getting matched',
              desc: 'Employers can discover and reach out to you directly.',
            },
          ].map((item) => (
            <View key={item.step} className="flex-row gap-4 mb-4">
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: '#FF624020',
                  borderWidth: 1,
                  borderColor: '#FF624040',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{item.step}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-white text-sm font-semibold mb-0.5">{item.title}</Text>
                <Text className="text-slate-400 text-xs leading-4">{item.desc}</Text>
              </View>
            </View>
          ))}
        </Animated.View>

        {/* Employment history CTA */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)}>
          <View
            className="rounded-2xl px-5 py-5 mb-6"
            style={{
              backgroundColor: '#FF624010',
              borderWidth: 1,
              borderColor: '#FF624030',
            }}
          >
            <Text className="text-white text-sm font-semibold mb-1">
              While you wait — add your work history
            </Text>
            <Text className="text-slate-400 text-xs leading-4 mb-4">
              Candidates with employment history listed are 3× more likely to be shortlisted.
            </Text>
            <Pressable
              onPress={() => router.push('/(onboarding)/candidate/employment-history')}
              className="bg-primary-500 rounded-xl py-3 items-center active:opacity-80"
            >
              <Text className="text-white text-sm font-semibold">Add employment history</Text>
            </Pressable>
          </View>

          <Pressable
            onPress={() => router.replace('/(candidate)/')}
            className="py-4 items-center"
          >
            <Text className="text-slate-400 text-sm">Skip for now — go to dashboard →</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

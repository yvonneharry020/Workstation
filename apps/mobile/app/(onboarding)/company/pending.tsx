import { useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withRepeat,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type VerificationStatus = 'not_started' | 'pending' | 'in_review' | 'approved' | 'rejected' | 'requires_resubmission'

interface VerificationData {
  overall_status: VerificationStatus
  cac_status: VerificationStatus
  director_nin_status: VerificationStatus
  domain_status: VerificationStatus
  documents_status: VerificationStatus
  manual_review_status: VerificationStatus
}

const STATUS_CONFIG: Record<VerificationStatus, { label: string; color: string; bg: string; icon: 'check' | 'clock' | 'dot' | 'x' }> = {
  not_started:           { label: 'Not started',       color: '#475569', bg: '#DDD6C9',   icon: 'dot' },
  pending:               { label: 'Pending',            color: '#F59E0B', bg: '#78350F20', icon: 'clock' },
  in_review:             { label: 'In review',          color: '#818CF8', bg: '#312E8120', icon: 'clock' },
  approved:              { label: 'Verified',           color: '#22C55E', bg: '#14532D20', icon: 'check' },
  rejected:              { label: 'Rejected',           color: '#EF4444', bg: '#7F1D1D20', icon: 'x' },
  requires_resubmission: { label: 'Action required',   color: '#F97316', bg: '#7C2D1220', icon: 'clock' },
}

const VERIFICATION_STEPS = [
  { key: 'cac_status' as const,          label: 'CAC registration', weight: 25 },
  { key: 'director_nin_status' as const, label: 'Director identity (NIN)', weight: 20 },
  { key: 'domain_status' as const,       label: 'Business email domain', weight: 10 },
  { key: 'documents_status' as const,    label: 'Business documents', weight: 20 },
  { key: 'manual_review_status' as const, label: 'Human review', weight: 25 },
]

function StatusDot({ status }: { status: VerificationStatus }) {
  const config = STATUS_CONFIG[status]

  const pulse = useSharedValue(1)
  const pulseOpacity = useSharedValue(0.8)

  useEffect(() => {
    if (status === 'pending' || status === 'in_review') {
      pulse.value = withRepeat(withTiming(1.5, { duration: 1000 }), -1, true)
      pulseOpacity.value = withRepeat(withTiming(0, { duration: 1000 }), -1, true)
    }
  }, [pulse, pulseOpacity, status])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
    opacity: pulseOpacity.value,
  }))

  return (
    <View style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
      {(status === 'pending' || status === 'in_review') && (
        <Animated.View style={[pulseStyle, {
          position: 'absolute',
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: config.color,
          opacity: 0.3,
        }]} />
      )}
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: config.color }} />
    </View>
  )
}

function StepRow({
  label,
  status,
  delay,
}: {
  label: string
  status: VerificationStatus
  delay: number
}) {
  const config = STATUS_CONFIG[status]

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(350)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        backgroundColor: '#EDE7DB',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#DDD6C9',
        marginBottom: 8,
      }}
    >
      <StatusDot status={status} />
      <Text style={{ flex: 1, color: '#1A1625', fontSize: 14, fontWeight: '500' }}>{label}</Text>
      <View style={{ backgroundColor: config.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
        <Text style={{ color: config.color, fontSize: 11, fontWeight: '600' }}>{config.label}</Text>
      </View>
    </Animated.View>
  )
}

function HourglassIcon() {
  return (
    <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12m0 0l-4.414 4.414A2 2 0 0 0 7 17.828V22M12 12l4.414-4.414A2 2 0 0 0 17 6.172V2M12 12L7.586 7.586A2 2 0 0 0 7 6.172V2" />
    </Svg>
  )
}

function PulsingRing() {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(0.6)

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.3, { duration: 1500 }), -1, true)
    opacity.value = withRepeat(withTiming(0, { duration: 1500 }), -1, true)
  }, [opacity, scale])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={[style, {
      position: 'absolute',
      width: 100,
      height: 100,
      borderRadius: 50,
      borderWidth: 2,
      borderColor: '#FF6240',
    }]} />
  )
}

function computeTrustScore(data: VerificationData | null): number {
  if (!data) return 0
  let score = 0
  if (data.cac_status === 'approved') score += 25
  if (data.director_nin_status === 'approved') score += 20
  if (data.domain_status === 'approved') score += 10
  if (data.documents_status === 'approved') score += 20
  if (data.manual_review_status === 'approved') score += 25
  return score
}

export default function CompanyPendingScreen() {
  const user = useAuthStore((s) => s.user)

  const { data: verification, isLoading } = useQuery({
    queryKey: ['company-verification', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_verification')
        .select('overall_status, cac_status, director_nin_status, domain_status, documents_status, manual_review_status')
        .eq('company_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as VerificationData | null
    },
    enabled: !!user?.id,
    refetchInterval: 30_000,
  })

  const isFullyApproved = verification?.overall_status === 'approved'
  const trustScore = computeTrustScore(verification ?? null)

  useEffect(() => {
    if (isFullyApproved) {
      const timer = setTimeout(() => {
        router.replace('/(company)/(tabs)')
      }, 2000)
      return () => clearTimeout(timer)
    }
  }, [isFullyApproved])

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  if (isFullyApproved) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Animated.View entering={FadeInUp.duration(500)} className="items-center">
          <View style={{ width: 90, height: 90, borderRadius: 45, backgroundColor: '#22C55E15', borderWidth: 2, borderColor: '#22C55E40', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          </View>
          <Text className="text-[#1A1625] text-2xl font-bold text-center mb-2">Company approved!</Text>
          <Text className="text-slate-400 text-sm text-center leading-5">
            Taking you to your dashboard…
          </Text>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-6"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        <View className="mt-8 mb-8 items-center">
          <View style={{ position: 'relative', width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
            <PulsingRing />
            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#FF624015', borderWidth: 1.5, borderColor: '#FF624040', alignItems: 'center', justifyContent: 'center' }}>
              <HourglassIcon />
            </View>
          </View>

          <Animated.View entering={FadeInDown.duration(400)} className="items-center">
            <Text style={{ color: '#1A1625', fontSize: 26, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center', marginBottom: 8 }}>
              Verification in progress
            </Text>
            <Text className="text-slate-400 text-sm text-center leading-5 px-4">
              Your application is being reviewed. This typically takes{' '}
              <Text className="text-[#1A1625] font-medium">24–48 hours</Text>. We'll notify you when it's done.
            </Text>
          </Animated.View>
        </View>

        {trustScore > 0 && (
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-6">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-slate-400 text-xs font-medium uppercase tracking-wider">Trust Score so far</Text>
              <Text style={{ color: '#FF6240', fontSize: 20, fontWeight: '800' }}>{trustScore}/100</Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#DDD6C9', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${trustScore}%`, backgroundColor: '#FF6240', borderRadius: 3 }} />
            </View>
            <Text className="text-slate-500 text-xs mt-2">
              Trust Score increases with each verification step approved.
            </Text>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <Text className="text-slate-300 font-semibold text-sm mb-3">Verification checklist</Text>
          {VERIFICATION_STEPS.map((step, i) => (
            <StepRow
              key={step.key}
              label={step.label}
              status={verification?.[step.key] ?? 'not_started'}
              delay={i * 80}
            />
          ))}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(600).duration(400)}>
          <View
            className="rounded-2xl p-4 mt-4 mb-6"
            style={{ backgroundColor: '#FF624008', borderWidth: 1, borderColor: '#FF624020' }}
          >
            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>
              While you wait
            </Text>
            <Text className="text-slate-400 text-xs leading-5">
              • You'll receive an email and push notification when your verification is complete{'\n'}
              • Check back here anytime to see your progress{'\n'}
              • If any documents are rejected, you'll be notified with specific reasons and can resubmit{'\n'}
              • Questions? Email <Text className="text-[#1A1625]">support@workstation.ng</Text>
            </Text>
          </View>

          <Pressable
            onPress={() => {
              router.replace('/(company)/(tabs)')
            }}
            className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-slate-300 font-semibold text-base">Go to dashboard (limited access)</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

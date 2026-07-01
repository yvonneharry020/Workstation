import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { useEffect } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface AppliedJobInfo {
  id: string
  title: string
  company_profiles: {
    company_name: string
  } | null
}

interface LatestApplication {
  id: string
}

function CheckIcon() {
  return (
    <Svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function ConfettiDot({ x, y, color }: { x: number; y: number; color: string }) {
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(Math.random() * 400, withSpring(1, { damping: 6 }))
    opacity.value = withDelay(Math.random() * 400, withSpring(1))
  }, [opacity, scale])

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: x,
    top: y,
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View style={style}>
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
    </Animated.View>
  )
}

const CONFETTI = [
  { x: 20, y: 30, color: '#FF6240' },
  { x: 80, y: 10, color: '#0DD4C3' },
  { x: 150, y: 40, color: '#F59E0B' },
  { x: 250, y: 20, color: '#22C55E' },
  { x: 300, y: 50, color: '#FF6240' },
  { x: 340, y: 15, color: '#818CF8' },
]

export default function ApplicationSubmittedScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const user = useAuthStore((s) => s.user)

  const scale = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(200, withSpring(1, { damping: 8, stiffness: 120 }))
  }, [scale])

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const { data: jobInfo, isLoading } = useQuery({
    queryKey: ['applied-job', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, company_profiles(company_name)')
        .eq('id', jobId)
        .single()
      if (error) throw error
      return data as unknown as AppliedJobInfo
    },
    enabled: !!jobId,
  })

  const { data: latestApp } = useQuery({
    queryKey: ['latest-app', jobId, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_applications')
        .select('id')
        .eq('job_id', jobId)
        .eq('candidate_id', user!.id)
        .order('submitted_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      return data as LatestApplication | null
    },
    enabled: !!jobId && !!user?.id,
  })

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  const companyName = jobInfo?.company_profiles?.company_name ?? 'the company'
  const appRef = latestApp?.id?.slice(0, 8).toUpperCase() ?? 'XXXXXXXX'

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48, alignItems: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        {/* Confetti layer */}
        <View style={{ height: 0, width: '100%', overflow: 'visible' }}>
          {CONFETTI.map((dot, i) => (
            <ConfettiDot key={i} x={dot.x} y={dot.y} color={dot.color} />
          ))}
        </View>

        {/* Success icon */}
        <Animated.View
          style={[ringStyle, {
            marginTop: 80,
            marginBottom: 24,
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#22C55E15',
            borderWidth: 2,
            borderColor: '#22C55E40',
            alignItems: 'center',
            justifyContent: 'center',
          }]}
        >
          <CheckIcon />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(400).duration(400)} className="items-center mb-8">
          <Text style={{ color: '#1A1625', fontSize: 26, fontWeight: '700', letterSpacing: -0.3, textAlign: 'center', marginBottom: 8 }}>
            Application submitted!
          </Text>
          <Text className="text-slate-400 text-sm text-center leading-5 px-4">
            Your application was sent to <Text className="text-[#1A1625] font-medium">{companyName}</Text> for{' '}
            <Text className="text-[#1A1625] font-medium">{jobInfo?.title}</Text>
          </Text>
        </Animated.View>

        {/* Reference card */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} className="w-full mb-4">
          <View className="bg-surface-card border border-surface-border rounded-2xl p-4">
            <Text className="text-slate-400 text-xs mb-2">Application reference</Text>
            <Text style={{ color: '#1A1625', fontFamily: 'monospace', fontSize: 20, fontWeight: '700', letterSpacing: 2 }}>
              #{appRef}
            </Text>
            <Text className="text-slate-500 text-xs mt-1">Save this for your records</Text>
          </View>
        </Animated.View>

        {/* Info card */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)} className="w-full mb-8">
          <View
            className="rounded-2xl p-4"
            style={{ backgroundColor: '#FF624010', borderWidth: 1, borderColor: '#FF624030' }}
          >
            <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600', marginBottom: 4 }}>
              Tracking your application
            </Text>
            <Text className="text-slate-400 text-sm leading-5">
              You'll get a notification when <Text className="text-[#1A1625] font-medium">{companyName}</Text> opens your
              application email. Track the full status in My Applications.
            </Text>
          </View>
        </Animated.View>

        {/* Action buttons */}
        <Animated.View entering={FadeInUp.delay(700).duration(400)} className="w-full gap-3">
          <Pressable
            onPress={() => router.replace('/(candidate)/applications')}
            className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-base">Track my application</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(candidate)/jobs')}
            className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-slate-300 font-semibold text-base">Browse more jobs</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

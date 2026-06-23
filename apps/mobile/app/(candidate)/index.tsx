import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface TrustScore {
  score: number
  level: string
}

interface CandidateProfile {
  id: string
  first_name: string
  last_name: string
  headline: string | null
  avatar_url: string | null
  profile_completion: number
  is_open_to_work: boolean
  trust_scores: TrustScore[] | null
}

interface CompanyProfile {
  company_name: string
  logo_url: string | null
  is_verified: boolean
}

interface JobPosting {
  id: string
  title: string
  city: string | null
  work_mode: string
  employment_type: string
  salary_min: number | null
  salary_max: number | null
  salary_is_confidential: boolean
  company_profiles: CompanyProfile | null
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function formatSalary(
  min: number | null,
  max: number | null,
  confidential: boolean,
): string {
  if (confidential) return 'Salary confidential'
  if (!min && !max) return 'Negotiable'
  const f = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1e6).toFixed(1)}M`
      : n >= 1_000
        ? `${Math.round(n / 1_000)}k`
        : String(n)
  if (min && max) return `₦${f(min)}–${f(max)}`
  return min ? `From ₦${f(min)}` : `Up to ₦${f(max!)}`
}

function BellIcon() {
  return (
    <Svg
      width={22}
      height={22}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#94A3B8"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  )
}

function ChevronRightIcon() {
  return (
    <Svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="#64748B"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
}

function TrustScoreRing({ score }: { score: number }) {
  const r = 44
  const circ = 2 * Math.PI * r
  const dash = (score / 100) * circ
  const color = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <View style={{ width: 100, height: 100, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={100} height={100} viewBox="0 0 100 100">
        <Circle cx="50" cy="50" r={r} stroke="#1E1B2E" strokeWidth={7} fill="none" />
        <Circle
          cx="50"
          cy="50"
          r={r}
          stroke={color}
          strokeWidth={7}
          fill="none"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800' }}>{score}</Text>
        <Text style={{ color: '#64748B', fontSize: 10 }}>/ 100</Text>
      </View>
    </View>
  )
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? '#FF6240' : '#3D3850',
        padding: 2,
        justifyContent: 'center',
        alignItems: value ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
    </Pressable>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <View
      className="flex-1 bg-surface-card border border-surface-border rounded-2xl px-3 py-4 items-center"
    >
      <Text style={{ color: '#FF6240', fontSize: 22, fontWeight: '800' }}>{value}</Text>
      <Text className="text-slate-400 text-xs text-center mt-1" numberOfLines={2}>
        {label}
      </Text>
    </View>
  )
}

function WorkModePill({ mode }: { mode: string }) {
  const label = mode === 'remote' ? 'Remote' : mode === 'hybrid' ? 'Hybrid' : 'On-site'
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#0DD4C320',
        borderWidth: 1,
        borderColor: '#0DD4C340',
      }}
    >
      <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

function CompanyInitials({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: '#FF624020',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700' }}>{initials}</Text>
    </View>
  )
}

const QUICK_ACTIONS = [
  { label: 'Find Jobs', route: '/(candidate)/jobs' as const, emoji: '🔍' },
  { label: 'Upload CV', route: '/(candidate)/cv' as const, emoji: '📄' },
  { label: 'My Profile', route: '/(candidate)/profile' as const, emoji: '👤' },
]

export default function CandidateDashboard() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const candidateQuery = useQuery({
    queryKey: ['candidate-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('*, trust_scores(score, level)')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as unknown as CandidateProfile
    },
    enabled: !!user?.id,
  })

  const jobsQuery = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, city, work_mode, employment_type, salary_min, salary_max, salary_is_confidential, company_profiles(company_name, logo_url, is_verified)')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as unknown as JobPosting[]
    },
  })

  const appCountQuery = useQuery({
    queryKey: ['app-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('candidate_id', user!.id)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  const viewCountQuery = useQuery({
    queryKey: ['profile-views-count', user?.id],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const { count, error } = await supabase
        .from('profile_views')
        .select('id', { count: 'exact', head: true })
        .eq('viewed_id', user!.id)
        .gte('viewed_at', weekAgo)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  const toggleMutation = useMutation({
    mutationFn: async (val: boolean) => {
      const { error } = await supabase
        .from('candidate_profiles')
        .update({ is_open_to_work: val })
        .eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['candidate-profile', user?.id] })
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  if (candidateQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const candidate = candidateQuery.data
  const trustScore = candidate?.trust_scores?.[0]?.score ?? 0
  const completion = candidate?.profile_completion ?? 0
  const isOpenToWork = candidate?.is_open_to_work ?? false

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 96 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FF6240"
          />
        }
      >
        {/* Header */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="flex-row items-center justify-between mt-4 mb-6"
        >
          <View>
            <Text className="text-slate-400 text-sm">{getGreeting()}</Text>
            <Text
              style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}
            >
              {candidate?.first_name ?? 'there'} 👋
            </Text>
          </View>
          <Pressable
            onPress={() => router.push('/(candidate)/notifications')}
            className="active:opacity-70"
            hitSlop={12}
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: '#131118',
                borderWidth: 1,
                borderColor: '#1E1B2E',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BellIcon />
            </View>
          </Pressable>
        </Animated.View>

        {/* Trust score + profile completion */}
        <Animated.View
          entering={FadeInDown.delay(80).duration(400)}
          className="flex-row gap-3 mb-4"
        >
          <View className="bg-surface-card border border-surface-border rounded-2xl p-4 items-center justify-center">
            <Text className="text-slate-400 text-xs mb-2">Trust score</Text>
            <TrustScoreRing score={trustScore} />
          </View>

          <View className="flex-1 bg-surface-card border border-surface-border rounded-2xl p-4 justify-between">
            <View>
              <Text className="text-slate-400 text-xs mb-1">Profile completion</Text>
              <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>{completion}%</Text>
            </View>
            <View>
              <View
                style={{
                  height: 6,
                  backgroundColor: '#1E1B2E',
                  borderRadius: 3,
                  marginBottom: 10,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    height: 6,
                    width: `${completion}%`,
                    backgroundColor: '#FF6240',
                    borderRadius: 3,
                  }}
                />
              </View>
              <Pressable
                onPress={() => router.push('/(candidate)/profile/edit')}
                className="active:opacity-70"
              >
                <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>
                  Complete profile →
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>

        {/* Open to work toggle */}
        <Animated.View
          entering={FadeInDown.delay(140).duration(400)}
          className="bg-surface-card border border-surface-border rounded-2xl px-4 py-4 flex-row items-center justify-between mb-4"
        >
          <View>
            <Text className="text-white text-sm font-semibold">Open to work</Text>
            <Text className="text-slate-500 text-xs mt-0.5">
              {isOpenToWork ? 'Companies can find you' : 'Hidden from companies'}
            </Text>
          </View>
          <Toggle
            value={isOpenToWork}
            onToggle={() => toggleMutation.mutate(!isOpenToWork)}
          />
        </Animated.View>

        {/* Stats */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          className="flex-row gap-3 mb-6"
        >
          <StatCard label="Applications" value={appCountQuery.data ?? 0} />
          <StatCard label="Views this week" value={viewCountQuery.data ?? 0} />
          <StatCard label="Interviews" value={0} />
        </Animated.View>

        {/* Recommended jobs */}
        <Animated.View entering={FadeInDown.delay(260).duration(400)} className="mb-6">
          <View className="flex-row items-center justify-between mb-3">
            <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700' }}>
              Recommended jobs
            </Text>
            <Pressable onPress={() => router.push('/(candidate)/jobs')} className="active:opacity-70">
              <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>See all</Text>
            </Pressable>
          </View>

          {jobsQuery.isLoading ? (
            <View className="bg-surface-card border border-surface-border rounded-2xl p-6 items-center">
              <ActivityIndicator color="#FF6240" />
            </View>
          ) : !jobsQuery.data || jobsQuery.data.length === 0 ? (
            <View className="bg-surface-card border border-surface-border rounded-2xl p-6 items-center">
              <Text className="text-slate-400 text-sm text-center">
                Complete your profile to see personalised recommendations
              </Text>
            </View>
          ) : (
            jobsQuery.data.map((job) => (
              <Pressable
                key={job.id}
                onPress={() => router.push(`/(candidate)/jobs/${job.id}` as Parameters<typeof router.push>[0])}
                className="bg-surface-card border border-surface-border rounded-2xl px-4 py-4 mb-3 active:opacity-80"
              >
                <View className="flex-row items-start gap-3">
                  {job.company_profiles?.logo_url ? (
                    <Image
                      source={{ uri: job.company_profiles.logo_url }}
                      style={{ width: 40, height: 40, borderRadius: 10 }}
                      contentFit="cover"
                    />
                  ) : (
                    <CompanyInitials name={job.company_profiles?.company_name ?? 'Co'} />
                  )}
                  <View className="flex-1">
                    <Text
                      className="text-white font-semibold text-sm mb-0.5"
                      numberOfLines={1}
                    >
                      {job.title}
                    </Text>
                    <Text className="text-slate-400 text-xs mb-2" numberOfLines={1}>
                      {job.company_profiles?.company_name}
                      {job.city ? ` · ${job.city}` : ''}
                    </Text>
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <WorkModePill mode={job.work_mode} />
                      <Text className="text-slate-500 text-xs">
                        {formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}
                      </Text>
                    </View>
                  </View>
                  <ChevronRightIcon />
                </View>
              </Pressable>
            ))
          )}
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(320).duration(400)}>
          <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', marginBottom: 12 }}>
            Quick actions
          </Text>
          <View className="flex-row gap-3">
            {QUICK_ACTIONS.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => router.push(action.route)}
                className="flex-1 bg-surface-card border border-surface-border rounded-2xl items-center py-5 active:opacity-80"
              >
                <Text style={{ fontSize: 24, marginBottom: 8 }}>{action.emoji}</Text>
                <Text className="text-white text-xs font-semibold text-center">
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

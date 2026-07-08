import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

interface SavedJobItem {
  id: string
  saved_at: string
  job_postings: {
    id: string
    title: string
    employment_type: string
    work_mode: string
    salary_min: number | null
    salary_max: number | null
    salary_is_confidential: boolean
    city: string | null
    company_profiles: {
      company_name: string
      logo_url: string | null
      is_verified: boolean
    } | null
  } | null
}

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
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

function BookmarkFilledIcon() {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill="#FF6240"
      stroke="#FF6240"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: 44, height: 44, borderRadius: 10 }}
        contentFit="cover"
      />
    )
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#FF624020',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
    </View>
  )
}

function WorkModePill({ mode }: { mode: string }) {
  const labels: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    on_site: 'On-site',
  }
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
      <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '600' }}>
        {labels[mode] ?? mode}
      </Text>
    </View>
  )
}

function EmploymentTypePill({ type }: { type: string }) {
  const labels: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
    freelance: 'Freelance',
  }
  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#DDD6C9',
      }}
    >
      <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '500' }}>
        {labels[type] ?? type}
      </Text>
    </View>
  )
}

function EmptyState() {
  return (
    <View className="flex-1 items-center justify-center px-8 mt-16">
      <Text style={{ fontSize: 40, marginBottom: 16 }}>🔖</Text>
      <Text className="text-[#1A1625] font-semibold text-base text-center mb-2">
        No saved jobs yet
      </Text>
      <Text className="text-slate-400 text-sm text-center leading-5">
        Browse jobs and tap the bookmark icon to save opportunities for later.
      </Text>
    </View>
  )
}

export default function SavedJobsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['saved-jobs', user?.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('saved_jobs')
        .select(`
          id, saved_at,
          job_postings (
            id, title, employment_type, work_mode,
            salary_min, salary_max, salary_is_confidential, city,
            company_profiles ( company_name, logo_url, is_verified )
          )
        `)
        .eq('candidate_id', user!.id)
        .order('saved_at', { ascending: false })
      if (error) throw error
      return rows as unknown as SavedJobItem[]
    },
    enabled: !!user?.id,
  })

  const unsaveMutation = useMutation({
    mutationFn: async (savedJobId: string) => {
      const { error } = await supabase
        .from('saved_jobs')
        .delete()
        .eq('id', savedJobId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] })
    },
    onError: () => {
      Alert.alert('Error', 'Could not remove saved job. Please try again.')
    },
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['saved-jobs', user?.id] })
    setRefreshing(false)
  }

  const handleUnsave = (savedJobId: string) => {
    Alert.alert(
      'Remove saved job',
      'Remove this job from your saved list?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => unsaveMutation.mutate(savedJobId),
        },
      ],
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center gap-3 px-5 pt-4 pb-4"
      >
        <Pressable onPress={() => router.back()} hitSlop={12} className="active:opacity-70">
          <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '600' }}>← Back</Text>
        </Pressable>
        <View className="flex-row items-center gap-3 flex-1">
          <Text
            style={{ color: '#1A1625', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}
          >
            Saved Jobs
          </Text>
          {data && data.length > 0 && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                backgroundColor: '#FF624020',
              }}
            >
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>
                {data.length}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6240"
            />
          }
          ListEmptyComponent={<EmptyState />}
          renderItem={({ item }) => {
            const job = item.job_postings
            if (!job) return null
            const company = job.company_profiles
            const companyName = company?.company_name ?? 'Company'

            return (
              <Pressable
                onPress={() =>
                  router.push(`/(candidate)/jobs/${job.id}` as Parameters<typeof router.push>[0])
                }
                className="bg-surface-card border border-surface-border rounded-2xl px-4 py-4 mb-3 active:opacity-80"
              >
                <View className="flex-row items-start gap-3">
                  <CompanyLogo name={companyName} logoUrl={company?.logo_url ?? null} />

                  <View className="flex-1">
                    <View className="flex-row items-start justify-between mb-1">
                      <View className="flex-1 mr-2">
                        <Text
                          className="text-[#1A1625] font-semibold text-sm mb-0.5"
                          numberOfLines={1}
                        >
                          {job.title}
                        </Text>
                        <View className="flex-row items-center gap-1">
                          <Text className="text-slate-400 text-xs" numberOfLines={1}>
                            {companyName}
                          </Text>
                          {company?.is_verified && <VerifiedBadge size={13} />}
                        </View>
                      </View>

                      <Pressable
                        onPress={() => handleUnsave(item.id)}
                        hitSlop={10}
                        className="active:opacity-70"
                      >
                        <BookmarkFilledIcon />
                      </Pressable>
                    </View>

                    {job.city ? (
                      <Text className="text-slate-500 text-xs mb-2">{job.city}</Text>
                    ) : null}

                    <View className="flex-row flex-wrap gap-2 mb-2">
                      <WorkModePill mode={job.work_mode} />
                      <EmploymentTypePill type={job.employment_type} />
                    </View>

                    <View className="flex-row items-center justify-between">
                      <Text className="text-slate-400 text-xs">
                        {formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}
                      </Text>
                      <Text className="text-slate-500 text-xs">
                        Saved {timeAgo(item.saved_at)}
                      </Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

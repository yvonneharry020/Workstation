import { View, Text, Pressable, ScrollView, ActivityIndicator } from 'react-native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CompanyProfile {
  id: string
  company_name: string
  industry: string | null
  is_verified: boolean
  logo_url: string | null
  city: string | null
}

interface Job {
  id: string
  title: string
  description: string | null
  requirements: string | null
  location: string | null
  job_type: string | null
  salary_min: number | null
  salary_max: number | null
  currency: string | null
  status: string
  created_at: string
  company_profiles: CompanyProfile | null
}

async function fetchJob(id: string): Promise<Job> {
  const { data, error } = await supabase
    .from('jobs')
    .select(`
      id, title, description, requirements, location, job_type,
      salary_min, salary_max, currency, status, created_at,
      company_profiles ( id, company_name, industry, is_verified, logo_url, city )
    `)
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (error) throw new Error(error.message)
  return data as unknown as Job
}

function formatSalary(min: number | null, max: number | null, currency: string | null): string {
  if (!min && !max) return 'Salary negotiable'
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${Math.round(n / 1_000)}k`
    return n.toString()
  }
  const symbol = currency ?? '₦'
  if (min && max) return `${symbol}${fmt(min)} – ${symbol}${fmt(max)}/mo`
  if (min) return `From ${symbol}${fmt(min)}/mo`
  return `Up to ${symbol}${fmt(max!)}/mo`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`
  return `${Math.floor(days / 30)} months ago`
}

function JobTypePill({ label }: { label: string }) {
  return (
    <View className="bg-surface-card border border-surface-border rounded-lg px-3 py-1">
      <Text className="text-slate-400 font-sans text-xs capitalize">{label.replace('_', ' ')}</Text>
    </View>
  )
}

function VerifiedBadge() {
  return (
    <View className="flex-row items-center gap-1 bg-surface-card border border-surface-border rounded-lg px-2.5 py-1">
      <View className="w-1.5 h-1.5 rounded-full bg-green-500" />
      <Text className="text-green-400 font-sans text-xs font-semibold">CAC Verified</Text>
    </View>
  )
}

export default function JobDeepLink() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const { session } = useAuthStore()

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job-public', id],
    queryFn: () => fetchJob(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })

  const handleApply = () => {
    if (session) {
      router.push(`/(candidate)/jobs`)
    } else {
      router.push('/(auth)/welcome')
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} hitSlop={8} className="p-1">
          <Text className="text-slate-400 font-sans text-sm">←</Text>
        </Pressable>
        <View className="flex-row items-center gap-2">
          <View
            className="bg-primary-500 items-center justify-center"
            style={{ width: 28, height: 28, borderRadius: 8 }}
          >
            <Text style={{ fontSize: 13, fontFamily: 'PlusJakartaSans_800ExtraBold', color: '#1A1625' }}>
              W
            </Text>
          </View>
          <Text className="text-[#1A1625] font-semibold text-sm tracking-wide">WORKSTATION</Text>
        </View>
        <View style={{ width: 32 }} />
      </View>

      {isLoading && (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#FF6240" />
          <Text className="text-slate-400 font-sans text-sm mt-4">Loading job details…</Text>
        </View>
      )}

      {isError && (
        <View className="flex-1 items-center justify-center px-8 gap-4">
          <Text className="text-[#1A1625] font-display text-xl text-center">Job not found</Text>
          <Text className="text-slate-400 font-sans text-base text-center leading-relaxed">
            This job may have been removed or is no longer accepting applications.
          </Text>
          <Pressable
            onPress={() => router.replace('/(auth)/welcome')}
            className="bg-primary-500 rounded-2xl px-8 py-3.5 mt-2"
          >
            <Text className="text-[#1A1625] font-semibold text-base">Browse open jobs</Text>
          </Pressable>
        </View>
      )}

      {job && (
        <>
          <ScrollView
            className="flex-1"
            contentContainerStyle={{ paddingBottom: 120 }}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View entering={FadeInDown.delay(100).duration(500)} className="px-5 pt-5 gap-5">
              <View className="bg-surface-card rounded-2xl p-5 border border-surface-border gap-4">
                <View className="flex-row items-start justify-between gap-3">
                  <View
                    className="bg-surface-elevated rounded-xl items-center justify-center border border-surface-border"
                    style={{ width: 52, height: 52 }}
                  >
                    <Text style={{ fontSize: 24 }}>🏢</Text>
                  </View>
                  {job.company_profiles?.is_verified && <VerifiedBadge />}
                </View>

                <View className="gap-1">
                  <Text className="text-[#1A1625] font-display text-xl leading-tight">
                    {job.title}
                  </Text>
                  <Text className="text-primary-400 font-semibold text-base">
                    {job.company_profiles?.company_name ?? 'Company'}
                  </Text>
                  {job.company_profiles?.industry && (
                    <Text className="text-slate-400 font-sans text-sm">
                      {job.company_profiles.industry}
                    </Text>
                  )}
                </View>

                <View className="flex-row flex-wrap gap-2">
                  {job.location && <JobTypePill label={`📍 ${job.location}`} />}
                  {job.job_type && <JobTypePill label={job.job_type} />}
                  <JobTypePill label={timeAgo(job.created_at)} />
                </View>

                <View className="border-t border-surface-border pt-4">
                  <Text className="text-[#1A1625] font-display text-lg">
                    {formatSalary(job.salary_min, job.salary_max, job.currency)}
                  </Text>
                </View>
              </View>

              {job.description && (
                <Animated.View entering={FadeInDown.delay(200).duration(500)} className="gap-3">
                  <Text className="text-[#1A1625] font-semibold text-base">About this role</Text>
                  <Text className="text-slate-400 font-sans text-sm leading-relaxed">
                    {job.description.length > 400
                      ? `${job.description.slice(0, 400)}…`
                      : job.description}
                  </Text>
                </Animated.View>
              )}

              {job.requirements && (
                <Animated.View entering={FadeInDown.delay(300).duration(500)} className="gap-3">
                  <Text className="text-[#1A1625] font-semibold text-base">Requirements</Text>
                  {job.requirements
                    .split('\n')
                    .filter(Boolean)
                    .slice(0, 5)
                    .map((req, i) => (
                      <View key={i} className="flex-row gap-2.5">
                        <View
                          className="w-1.5 h-1.5 rounded-full bg-primary-500 mt-1.5"
                        />
                        <Text className="text-slate-400 font-sans text-sm flex-1 leading-relaxed">
                          {req.replace(/^[-•*]\s*/, '')}
                        </Text>
                      </View>
                    ))}
                </Animated.View>
              )}

              {!session && (
                <Animated.View
                  entering={FadeInDown.delay(400).duration(500)}
                  className="bg-surface-card rounded-2xl p-4 border border-surface-border"
                >
                  <View className="flex-row items-center gap-2 mb-2">
                    <View className="w-2 h-2 rounded-full bg-teal-500" />
                    <Text className="text-[#1A1625] font-semibold text-sm">Free to apply</Text>
                  </View>
                  <Text className="text-slate-400 font-sans text-xs leading-relaxed">
                    Create your Workstation account to apply. NIN verification required — it's free and takes under 2 minutes.
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </ScrollView>

          <View className="absolute bottom-0 left-0 right-0 bg-surface border-t border-surface-border px-5 pt-4 pb-8">
            <Pressable
              onPress={handleApply}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
            >
              <Text className="text-[#1A1625] font-semibold text-base">
                {session ? 'Apply now' : 'Sign in to apply'}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface JobDetail {
  id: string
  title: string
  employment_type: string
  work_mode: string
  experience_level: string
  city: string | null
  description: string
  requirements: string | null
  benefits: string | null
  salary_min: number | null
  salary_max: number | null
  salary_is_confidential: boolean
  application_deadline: string | null
  screening_questions: { question: string; required: boolean }[] | null
  applications_count: number
  published_at: string
  company_id: string
  company_profiles: {
    id: string
    company_name: string
    logo_url: string | null
    is_verified: boolean
    industry: string | null
  } | null
}

interface ExistingApplication {
  id: string
  status: string
  pipeline_stage: string
  submitted_at: string
}

function formatSalary(min: number | null, max: number | null, isConfidential: boolean): string {
  if (isConfidential) return 'Salary confidential'
  if (!min && !max) return 'Salary negotiable'
  const f = (n: number) =>
    n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n)
  if (min && max) return `₦${f(min)} – ₦${f(max)}/mo`
  return min ? `From ₦${f(min)}/mo` : `Up to ₦${f(max!)}/mo`
}

function timeAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function daysUntilDeadline(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86_400_000)
}

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill={filled ? '#FF6240' : 'none'} stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
}


function MetaPill({ label }: { label: string }) {
  return (
    <View className="bg-surface-card border border-surface-border rounded-lg px-3 py-1.5">
      <Text className="text-slate-300 text-xs font-medium">{label}</Text>
    </View>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, { bg: string; text: string }> = {
    submitted: { bg: '#6366F120', text: '#818CF8' },
    reviewing: { bg: '#F59E0B20', text: '#F59E0B' },
    shortlisted: { bg: '#22C55E20', text: '#22C55E' },
    rejected: { bg: '#EF444420', text: '#EF4444' },
    hired: { bg: '#0DD4C320', text: '#0DD4C3' },
  }
  const color = colorMap[status] ?? { bg: '#DDD6C9', text: '#5A4F6E' }
  return (
    <View style={{ backgroundColor: color.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
      <Text style={{ color: color.text, fontSize: 12, fontWeight: '600' }}>{formatLabel(status)}</Text>
    </View>
  )
}

export default function JobDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)

  const { data: job, isLoading, isError } = useQuery({
    queryKey: ['job-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select(
          'id, title, employment_type, work_mode, experience_level, city, description, requirements, benefits, salary_min, salary_max, salary_is_confidential, application_deadline, screening_questions, screening_type, quiz_duration_minutes, applications_count, published_at, company_id, company_profiles(id, company_name, logo_url, is_verified, industry)'
        )
        .eq('id', id!)
        .eq('status', 'active')
        .maybeSingle()
      if (error) throw error
      return data as unknown as JobDetail | null
    },
    enabled: !!id,
  })

  const { data: existingApp } = useQuery({
    queryKey: ['existing-app', id, user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_applications')
        .select('id, status, pipeline_stage, submitted_at')
        .eq('job_id', id)
        .eq('candidate_id', user!.id)
        .maybeSingle()
      return data as ExistingApplication | null
    },
    enabled: !!user?.id && !!id,
  })

  const { data: savedIds = [] } = useQuery({
    queryKey: ['saved-ids', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('saved_jobs').select('job_id').eq('candidate_id', user!.id)
      return data?.map((s) => s.job_id) ?? []
    },
    enabled: !!user?.id,
  })

  const isSaved = savedIds.includes(id)

  const toggleSave = useMutation({
    mutationFn: async () => {
      if (isSaved) {
        await supabase.from('saved_jobs').delete().eq('candidate_id', user!.id).eq('job_id', id)
      } else {
        await supabase.from('saved_jobs').insert({ candidate_id: user!.id, job_id: id })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-ids', user?.id] })
    },
    onError: () => {
      Alert.alert('Error', 'Could not update saved jobs.')
    },
  })

  if (!id || isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  if (isError || !job) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-5">
        <Text className="text-[#1A1625] font-semibold text-base mb-2">Job not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary-400 text-sm">← Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const company = job.company_profiles
  const initials = company?.company_name?.slice(0, 2).toUpperCase() ?? '??'
  const deadline = job.application_deadline ? daysUntilDeadline(job.application_deadline) : null
  const isDeadlineSoon = deadline !== null && deadline <= 7 && deadline >= 0
  const descriptionLong = job.description.length > 400
  const displayedDescription = descriptionLong && !expanded ? job.description.slice(0, 400) + '…' : job.description

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-3 border-b border-surface-border">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackIcon />
        </Pressable>
        <Text className="text-[#1A1625] font-semibold text-sm flex-1 mx-4" numberOfLines={1}>
          {job.title}
        </Text>
        <Pressable onPress={() => toggleSave.mutate()} hitSlop={12}>
          <BookmarkIcon filled={isSaved} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} className="px-5 pt-6 pb-4 items-center">
          {company?.logo_url ? (
            <Image
              source={{ uri: company.logo_url }}
              style={{ width: 72, height: 72, borderRadius: 18, marginBottom: 12 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 18,
                backgroundColor: '#FF624020',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#FF6240', fontSize: 20, fontWeight: '700' }}>{initials}</Text>
            </View>
          )}
          <View className="flex-row items-center gap-2 mb-2">
            <Text className="text-slate-400 text-sm">{company?.company_name}</Text>
            {company?.is_verified && <VerifiedBadge />}
          </View>
          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700', textAlign: 'center', letterSpacing: -0.3 }}>
            {job.title}
          </Text>
          <Text className="text-slate-500 text-xs mt-1">Posted {timeAgo(job.published_at)}</Text>
        </Animated.View>

        {/* Meta pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 8, paddingBottom: 16 }}>
          <MetaPill label={formatLabel(job.work_mode)} />
          <MetaPill label={formatLabel(job.employment_type)} />
          <MetaPill label={formatLabel(job.experience_level)} />
          {job.city && <MetaPill label={job.city} />}
        </ScrollView>

        <View className="px-5">
          {/* Salary card */}
          <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4">
            <Text className="text-slate-400 text-xs mb-1">Compensation</Text>
            <Text style={{ color: '#FF6240', fontSize: 18, fontWeight: '700' }}>
              {formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}
            </Text>
            <Text className="text-slate-500 text-xs mt-0.5">{job.applications_count} people applied</Text>
          </View>

          {/* Deadline warning */}
          {isDeadlineSoon && (
            <View
              className="rounded-xl p-3 mb-4 flex-row items-center gap-2"
              style={{ backgroundColor: '#F59E0B15', borderWidth: 1, borderColor: '#F59E0B40' }}
            >
              <Text style={{ fontSize: 16 }}>⚠️</Text>
              <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '500' }}>
                {deadline === 0 ? 'Deadline is today!' : `${deadline} day${deadline !== 1 ? 's' : ''} left to apply`}
              </Text>
            </View>
          )}

          {/* Description */}
          <View className="mb-5">
            <Text className="text-[#1A1625] font-semibold text-base mb-2">About this role</Text>
            <Text className="text-slate-400 text-sm leading-6">{displayedDescription}</Text>
            {descriptionLong && (
              <Pressable onPress={() => setExpanded((e) => !e)} className="mt-2">
                <Text className="text-primary-400 text-sm font-medium">{expanded ? 'Show less' : 'Read more'}</Text>
              </Pressable>
            )}
          </View>

          {/* Requirements */}
          {job.requirements && (
            <View className="mb-5">
              <Text className="text-[#1A1625] font-semibold text-base mb-2">Requirements</Text>
              {job.requirements
                .split('\n')
                .filter((line) => line.trim().length > 0)
                .map((line, i) => (
                  <View key={i} className="flex-row gap-2 mb-1.5">
                    <Text className="text-primary-400 text-sm">•</Text>
                    <Text className="text-slate-400 text-sm leading-5 flex-1">{line.replace(/^[-•*]\s*/, '')}</Text>
                  </View>
                ))}
            </View>
          )}

          {/* Benefits */}
          {job.benefits && (
            <View className="mb-5">
              <Text className="text-[#1A1625] font-semibold text-base mb-2">Benefits</Text>
              <Text className="text-slate-400 text-sm leading-6">{job.benefits}</Text>
            </View>
          )}

          {/* Screening questions notice */}
          {job.screening_questions && job.screening_questions.length > 0 && (
            <View
              className="rounded-xl p-4 mb-5"
              style={{ backgroundColor: '#6366F115', borderWidth: 1, borderColor: '#6366F130' }}
            >
              <Text style={{ color: '#818CF8', fontSize: 13, fontWeight: '600' }}>
                {job.screening_questions.length} screening question{job.screening_questions.length !== 1 ? 's' : ''}
              </Text>
              <Text className="text-slate-400 text-xs mt-1">
                You'll answer these when you apply for this role.
              </Text>
            </View>
          )}

          {/* Company section */}
          {company && (
            <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-5">
              <Text className="text-slate-400 text-xs mb-3">About the company</Text>
              <View className="flex-row items-center gap-3 mb-3">
                {company.logo_url ? (
                  <Image source={{ uri: company.logo_url }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{initials}</Text>
                  </View>
                )}
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 flex-wrap">
                    <Text className="text-[#1A1625] font-semibold text-sm">{company.company_name}</Text>
                    {company.is_verified && <VerifiedBadge />}
                  </View>
                  {company.industry && <Text className="text-slate-400 text-xs mt-0.5">{company.industry}</Text>}
                </View>
              </View>
              <Pressable
                onPress={() => router.push(`/(candidate)/company/${company.id}`)}
                className="active:opacity-70"
              >
                <Text className="text-primary-400 text-sm font-medium">View company profile →</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky bottom bar */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-3 pb-8 border-t border-surface-border"
        style={{ backgroundColor: '#F5F0E8' }}
      >
        {existingApp ? (
          <View className="flex-row items-center justify-between bg-surface-card rounded-2xl px-4 py-3">
            <View>
              <Text className="text-slate-400 text-xs">Applied {timeAgo(existingApp.submitted_at)}</Text>
              <Text className="text-[#1A1625] text-sm font-semibold mt-0.5">Your application</Text>
            </View>
            <StatusBadge status={existingApp.status} />
          </View>
        ) : (
          <View className="flex-row gap-3">
            <Pressable
              onPress={() => router.push(`/(candidate)/jobs/apply-step1?jobId=${id}`)}
              className="flex-1 bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
            >
              <Text className="text-[#1A1625] font-semibold text-base">Apply now</Text>
            </Pressable>
            <Pressable
              onPress={() => toggleSave.mutate()}
              className="bg-surface-card border border-surface-border rounded-2xl px-4 items-center justify-center active:opacity-80"
            >
              <BookmarkIcon filled={isSaved} />
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  )
}

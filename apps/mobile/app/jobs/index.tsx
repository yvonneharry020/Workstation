import {
  View,
  Text,
  Pressable,
  TextInput,
  FlatList,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  )
}

function MapPinIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <Circle cx={12} cy={9} r={2.5} />
    </Svg>
  )
}

function BriefcaseIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </Svg>
  )
}

function ShieldIcon() {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="#0DD4C3" stroke="none">
      <Path d="M12 2L3 7v5c0 5.25 3.75 10.2 9 11.4C17.25 22.2 21 17.25 21 12V7l-9-5z" />
    </Svg>
  )
}

type Job = {
  id: string
  title: string
  employment_type: string | null
  work_mode: string | null
  city: string | null
  salary_min: number | null
  salary_max: number | null
  created_at: string
  company_profiles: {
    company_name: string
    cac_verified: boolean
  } | null
}

const JOB_TYPES: { label: string; value: string }[] = [
  { label: 'All', value: 'All' },
  { label: 'Full-time', value: 'full_time' },
  { label: 'Part-time', value: 'part_time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Internship', value: 'internship' },
]

function formatSalary(min: number | null, max: number | null): string | null {
  if (!min && !max) return null
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `₦${Math.round(n / 1_000)}k`
    return `₦${n}`
  }
  if (min && max) return `${fmt(min)} – ${fmt(max)}/mo`
  if (min) return `From ${fmt(min)}/mo`
  return `Up to ${fmt(max!)}/mo`
}

function formatPostedDate(isoDate: string): string {
  const diff = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  if (diff < 7) return `${diff}d ago`
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`
  return `${Math.floor(diff / 30)}mo ago`
}

function formatEmploymentType(type: string | null): string | null {
  const map: Record<string, string> = {
    full_time: 'Full-time',
    part_time: 'Part-time',
    contract: 'Contract',
    internship: 'Internship',
    freelance: 'Freelance',
  }
  return type ? (map[type] ?? type) : null
}

function formatWorkMode(mode: string | null): string | null {
  const map: Record<string, string> = {
    remote: 'Remote',
    hybrid: 'Hybrid',
    on_site: 'On-site',
  }
  return mode ? (map[mode] ?? mode) : null
}

function JobCard({ job, onPress }: { job: Job; onPress: () => void }) {
  const company = job.company_profiles
  const salary = formatSalary(job.salary_min, job.salary_max)
  const isVerified = company?.cac_verified ?? false

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-card border border-surface-border rounded-2xl px-4 py-4 mb-3 active:opacity-80"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className="flex-1 mr-3">
          <Text className="text-[#1A1625] font-semibold text-base leading-tight mb-1" numberOfLines={2}>
            {job.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-slate-400 text-sm font-medium">
              {company?.company_name ?? 'Unknown company'}
            </Text>
            {isVerified && (
              <View
                className="flex-row items-center gap-0.5 rounded px-1 py-0.5"
                style={{ backgroundColor: '#0DD4C308' }}
              >
                <ShieldIcon />
                <Text className="text-teal-500 text-xs font-medium">Verified</Text>
              </View>
            )}
          </View>
        </View>
      </View>

      <View className="flex-row flex-wrap gap-2">
        {job.city && (
          <View className="flex-row items-center gap-1 bg-surface-muted rounded-lg px-2 py-1">
            <MapPinIcon />
            <Text className="text-slate-400 text-xs">{job.city}</Text>
          </View>
        )}
        {job.employment_type && (
          <View className="flex-row items-center gap-1 bg-surface-muted rounded-lg px-2 py-1">
            <BriefcaseIcon />
            <Text className="text-slate-400 text-xs">{formatEmploymentType(job.employment_type)}</Text>
          </View>
        )}
        {job.work_mode && (
          <View className="bg-surface-muted rounded-lg px-2 py-1">
            <Text className="text-slate-400 text-xs">{formatWorkMode(job.work_mode)}</Text>
          </View>
        )}
      </View>

      <View className="flex-row items-center justify-between mt-3 pt-3 border-t border-surface-border">
        {salary ? (
          <Text className="text-primary-400 text-sm font-semibold">{salary}</Text>
        ) : (
          <Text className="text-slate-600 text-sm">Salary not listed</Text>
        )}
        <Text className="text-slate-600 text-xs">{formatPostedDate(job.created_at)}</Text>
      </View>
    </Pressable>
  )
}

export default function BrowseJobsScreen() {
  const { session } = useAuthStore()
  const [search, setSearch] = useState('')
  const [activeType, setActiveType] = useState('All')

  const { data: jobs, isLoading, error } = useQuery({
    queryKey: ['public-jobs', search, activeType],
    queryFn: async () => {
      let query = supabase
        .from('job_postings')
        .select(`
          id,
          title,
          employment_type,
          work_mode,
          city,
          salary_min,
          salary_max,
          created_at,
          company_profiles!company_id(
            company_name,
            cac_verified
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(30)

      if (search.trim()) {
        query = query.ilike('title', `%${search.trim()}%`)
      }

      if (activeType !== 'All') {
        query = query.eq('employment_type', activeType)
      }

      const { data, error } = await query
      if (error) throw error
      return data as unknown as Job[]
    },
    staleTime: 60_000,
  })

  const handleApply = (jobId: string) => {
    if (!session) {
      router.push('/(auth)/login')
    } else {
      router.push(`/jobs/${jobId}`)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text
            style={{
              color: '#1A1625',
              fontSize: 22,
              fontWeight: '700',
              letterSpacing: -0.3,
            }}
          >
            Browse Jobs
          </Text>
          {!session && (
            <Pressable onPress={() => router.push('/(auth)/login')} hitSlop={8}>
              <Text className="text-primary-400 text-sm font-semibold">Sign in</Text>
            </Pressable>
          )}
        </View>

        <View className="flex-row items-center bg-surface-card border border-surface-border rounded-xl px-3 gap-2 mb-4">
          <SearchIcon />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search jobs, companies…"
            placeholderTextColor="#475569"
            className="flex-1 py-3 text-[#1A1625] text-sm"
            returnKeyType="search"
          />
        </View>

        <FlatList
          data={JOB_TYPES}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setActiveType(item.value)}
              className="mr-2 rounded-xl px-4 py-2"
              style={{
                backgroundColor: activeType === item.value ? '#FF6240' : '#EDE7DB',
                borderWidth: 1,
                borderColor: activeType === item.value ? '#FF6240' : '#C8BFB0',
              }}
            >
              <Text
                className="text-sm font-medium"
                style={{ color: activeType === item.value ? '#1A1625' : '#94a3b8' }}
              >
                {item.label}
              </Text>
            </Pressable>
          )}
          style={{ marginBottom: 4 }}
        />
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" />
          <Text className="text-slate-400 text-sm mt-3">Loading jobs…</Text>
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center px-10">
          <Text className="text-slate-400 text-center">
            Could not load jobs. Please check your connection and try again.
          </Text>
        </View>
      ) : (
        <FlatList
          data={jobs ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 20 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <JobCard job={item} onPress={() => handleApply(item.id)} />
          )}
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-slate-500 text-base mb-1">No jobs found</Text>
              <Text className="text-slate-600 text-sm">Try adjusting your search or filters</Text>
            </View>
          }
          ListFooterComponent={
            jobs && jobs.length > 0 && !session ? (
              <View className="bg-surface-card border border-surface-border rounded-2xl p-5 mt-2 items-center">
                <Text className="text-[#1A1625] font-semibold text-base mb-2">
                  Ready to apply?
                </Text>
                <Text className="text-slate-400 text-sm text-center mb-4">
                  Create a verified profile to apply to jobs and track your applications.
                </Text>
                <Pressable
                  onPress={() => router.push('/(auth)/register')}
                  className="bg-primary-500 rounded-xl px-8 py-3 active:opacity-80"
                >
                  <Text className="text-[#1A1625] font-semibold text-sm">Create account</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  )
}

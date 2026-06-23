import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { useState, useCallback, useRef } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Image } from 'expo-image'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface Job {
  id: string
  title: string
  employment_type: string
  work_mode: string
  experience_level: string
  city: string | null
  salary_min: number | null
  salary_max: number | null
  salary_is_confidential: boolean
  applications_count: number
  published_at: string
  company_profiles: {
    id: string
    company_name: string
    logo_url: string | null
    is_verified: boolean
  } | null
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

function formatLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round">
      <Circle cx="11" cy="11" r="8" />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  )
}

function BookmarkIcon({ filled }: { filled: boolean }) {
  return (
    <Svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={filled ? '#FF6240' : 'none'}
      stroke="#FF6240"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

const FILTERS = [
  { label: 'All', value: 'all' },
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'on-site' },
  { label: 'Full-time', value: 'full-time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Internship', value: 'internship' },
]

function WorkModePill({ mode }: { mode: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    remote: { bg: '#0DD4C320', text: '#0DD4C3' },
    hybrid: { bg: '#F59E0B20', text: '#F59E0B' },
    on_site: { bg: '#6366F120', text: '#818CF8' },
  }
  const color = colors[mode] ?? { bg: '#1E1B2E', text: '#94A3B8' }
  return (
    <View style={{ backgroundColor: color.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
      <Text style={{ color: color.text, fontSize: 11, fontWeight: '600' }}>{formatLabel(mode)}</Text>
    </View>
  )
}

function JobCard({
  job,
  isSaved,
  onToggleSave,
}: {
  job: Job
  isSaved: boolean
  onToggleSave: (id: string) => void
}) {
  const company = job.company_profiles
  const initials = company?.company_name?.slice(0, 2).toUpperCase() ?? '??'

  return (
    <Pressable
      onPress={() => router.push(`/(candidate)/jobs/${job.id}`)}
      className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3 active:opacity-80"
    >
      <View className="flex-row items-start gap-3 mb-3">
        {company?.logo_url ? (
          <Image
            source={{ uri: company.logo_url }}
            style={{ width: 48, height: 48, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: '#FF624020',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
          </View>
        )}
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm leading-5 mb-0.5" numberOfLines={2}>
            {job.title}
          </Text>
          <View className="flex-row items-center gap-1.5">
            <Text className="text-slate-400 text-xs">{company?.company_name ?? 'Unknown'}</Text>
            {company?.is_verified && <View className="w-1.5 h-1.5 rounded-full bg-green-500" />}
          </View>
        </View>
        <Pressable onPress={() => onToggleSave(job.id)} hitSlop={12}>
          <BookmarkIcon filled={isSaved} />
        </Pressable>
      </View>

      <View className="flex-row flex-wrap gap-2 mb-3">
        <WorkModePill mode={job.work_mode} />
        {job.city && (
          <View className="bg-surface border border-surface-border rounded-md px-2 py-0.5">
            <Text className="text-slate-400 text-xs">{job.city}</Text>
          </View>
        )}
        <View className="bg-surface border border-surface-border rounded-md px-2 py-0.5">
          <Text className="text-slate-400 text-xs">{formatLabel(job.employment_type)}</Text>
        </View>
      </View>

      <View className="flex-row items-center justify-between">
        <Text className="text-primary-400 text-sm font-semibold">
          {formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}
        </Text>
        <View className="flex-row items-center gap-3">
          <Text className="text-slate-500 text-xs">{job.applications_count} applied</Text>
          <Text className="text-slate-600 text-xs">{timeAgo(job.published_at)}</Text>
        </View>
      </View>
    </Pressable>
  )
}

export default function JobsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [searchText, setSearchText] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearchChange = useCallback((text: string) => {
    setSearchText(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const { data: jobs = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['jobs', debouncedSearch, activeFilter],
    queryFn: async () => {
      let q = supabase
        .from('job_postings')
        .select(
          'id, title, employment_type, work_mode, experience_level, city, salary_min, salary_max, salary_is_confidential, applications_count, published_at, company_profiles(id, company_name, logo_url, is_verified)'
        )
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(30)

      if (debouncedSearch.length > 1) q = q.ilike('title', `%${debouncedSearch}%`)
      if (activeFilter === 'remote') q = q.eq('work_mode', 'remote')
      else if (activeFilter === 'hybrid') q = q.eq('work_mode', 'hybrid')
      else if (activeFilter === 'on-site') q = q.eq('work_mode', 'on_site')
      else if (activeFilter === 'full-time') q = q.eq('employment_type', 'full_time')
      else if (activeFilter === 'contract') q = q.eq('employment_type', 'contract')
      else if (activeFilter === 'internship') q = q.eq('employment_type', 'internship')

      const { data, error } = await q
      if (error) throw error
      return data as unknown as Job[]
    },
    staleTime: 1000 * 60 * 2,
  })

  const { data: savedIds = [] } = useQuery({
    queryKey: ['saved-ids', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('saved_jobs').select('job_id').eq('candidate_id', user!.id)
      return data?.map((s) => s.job_id) ?? []
    },
    enabled: !!user?.id,
  })

  const toggleSave = useMutation({
    mutationFn: async (jobId: string) => {
      if (savedIds.includes(jobId)) {
        await supabase.from('saved_jobs').delete().eq('candidate_id', user!.id).eq('job_id', jobId)
      } else {
        await supabase.from('saved_jobs').insert({ candidate_id: user!.id, job_id: jobId })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-ids', user?.id] })
    },
  })

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 pt-4 pb-3">
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', letterSpacing: -0.3, marginBottom: 12 }}>
          Browse Jobs
        </Text>
        <View
          className="flex-row items-center gap-2 bg-surface-card border border-surface-border rounded-2xl px-4"
          style={{ height: 48 }}
        >
          <SearchIcon />
          <TextInput
            value={searchText}
            onChangeText={handleSearchChange}
            placeholder="Search job titles…"
            placeholderTextColor="#475569"
            className="flex-1 text-white text-sm"
            returnKeyType="search"
          />
          {searchText.length > 0 && (
            <Pressable onPress={() => { setSearchText(''); setDebouncedSearch('') }} hitSlop={8}>
              <Text className="text-slate-500 text-sm">✕</Text>
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
      >
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setActiveFilter(f.value)}
            style={{
              paddingHorizontal: 14,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: activeFilter === f.value ? '#FF6240' : '#131118',
              borderWidth: 1,
              borderColor: activeFilter === f.value ? '#FF6240' : '#1E1B2E',
            }}
          >
            <Text
              style={{
                color: activeFilter === f.value ? '#fff' : '#94A3B8',
                fontSize: 13,
                fontWeight: activeFilter === f.value ? '600' : '400',
              }}
            >
              {f.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {!isLoading && (
        <View className="px-5 pb-2">
          <Text className="text-slate-500 text-xs">
            {jobs.length} job{jobs.length !== 1 ? 's' : ''} found
          </Text>
        </View>
      )}

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" />
        </View>
      ) : (
        <FlatList
          data={jobs}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              isSaved={savedIds.includes(item.id)}
              onToggleSave={(id) => toggleSave.mutate(id)}
            />
          )}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <Text style={{ fontSize: 32, marginBottom: 12 }}>🔍</Text>
              <Text className="text-white font-semibold text-base mb-2">No jobs found</Text>
              <Text className="text-slate-400 text-sm text-center leading-5 px-8">
                {debouncedSearch.length > 0
                  ? `No results for "${debouncedSearch}". Try different keywords.`
                  : 'No active jobs match this filter. Try a different one.'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

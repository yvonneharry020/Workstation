import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected' | 'withdrawn'

interface ApplicationRow {
  id: string
  job_id: string
  candidate_id: string
  pipeline_stage: PipelineStage
  email_sent_at: string | null
  email_opened_at: string | null
  skills_match_pct: number | null
  submitted_at: string
  job_postings: { title: string } | null
  candidate_profiles: {
    profiles: { full_name: string; avatar_url: string | null } | null
  } | null
}

const STAGE_CONFIG: Record<PipelineStage, { label: string; color: string; bg: string }> = {
  new:                  { label: 'New',        color: '#818CF8', bg: '#1E293B' },
  reviewed:             { label: 'Reviewed',   color: '#38BDF8', bg: '#082F49' },
  shortlisted:          { label: 'Shortlisted',color: '#0DD4C3', bg: '#042F2E' },
  interview_scheduled:  { label: 'Interview',  color: '#F59E0B', bg: '#451A03' },
  offer_made:           { label: 'Offer Made', color: '#22C55E', bg: '#052E16' },
  rejected:             { label: 'Rejected',   color: '#EF4444', bg: '#450A0A' },
  withdrawn:            { label: 'Withdrawn',  color: '#64748B', bg: '#1E293B' },
}

const FILTER_TABS: { label: string; value: PipelineStage | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Interview', value: 'interview_scheduled' },
  { label: 'Offer', value: 'offer_made' },
]

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function FilterIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z" />
    </Svg>
  )
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  )
}

function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  )
}

function ApplicationCard({ item, index }: { item: ApplicationRow; index: number }) {
  const name = item.candidate_profiles?.profiles?.full_name ?? 'Unknown'
  const avatarUrl = item.candidate_profiles?.profiles?.avatar_url
  const jobTitle = item.job_postings?.title ?? '—'
  const stage = STAGE_CONFIG[item.pipeline_stage]
  const emailSeen = !!item.email_opened_at
  const emailSent = !!item.email_sent_at

  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(company)/candidates/[id]',
            params: { id: item.candidate_id, applicationId: item.id, jobId: item.job_id },
          })
        }
        className="bg-surface-card border border-surface-border rounded-2xl px-4 py-3 mb-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{ width: 44, height: 44, borderRadius: 22 }}
              contentFit="cover"
            />
          ) : (
            <View
              style={{
                width: 44, height: 44, borderRadius: 22,
                backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}

          <View className="flex-1">
            <Text className="text-white font-semibold text-sm" numberOfLines={1}>{name}</Text>
            <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{jobTitle}</Text>
          </View>

          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={{ backgroundColor: stage.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
              <Text style={{ color: stage.color, fontSize: 10, fontWeight: '600' }}>{stage.label}</Text>
            </View>
            {item.skills_match_pct != null && (
              <Text style={{ color: '#FF6240', fontSize: 10, fontWeight: '600' }}>
                {item.skills_match_pct}% match
              </Text>
            )}
          </View>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          <Text className="text-slate-500 text-xs">{timeAgo(item.submitted_at)}</Text>
          {(emailSeen || emailSent) && (
            <View className="flex-row items-center gap-1">
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: emailSeen ? '#22C55E' : '#64748B' }} />
              <MailIcon color={emailSeen ? '#22C55E' : '#64748B'} />
              <Text style={{ color: emailSeen ? '#22C55E' : '#64748B', fontSize: 10, fontWeight: '500' }}>
                {emailSeen ? 'Seen' : 'Sent'}
              </Text>
            </View>
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function ApplicantsScreen() {
  const user = useAuthStore((s) => s.user)
  const [activeFilter, setActiveFilter] = useState<PipelineStage | 'all'>('all')
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const { data: applications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['company-applicants', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id, job_id, candidate_id, pipeline_stage, email_sent_at, email_opened_at,
          skills_match_pct, submitted_at,
          job_postings!inner ( title, company_id ),
          candidate_profiles (
            profiles ( full_name, avatar_url )
          )
        `)
        .eq('job_postings.company_id', user!.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as unknown as ApplicationRow[]
    },
    enabled: !!user?.id,
  })

  const filtered = (applications ?? []).filter((a) => {
    const matchesStage = activeFilter === 'all' || a.pipeline_stage === activeFilter
    const name = a.candidate_profiles?.profiles?.full_name?.toLowerCase() ?? ''
    const matchesSearch = debouncedSearch === '' || name.includes(debouncedSearch.toLowerCase())
    return matchesStage && matchesSearch
  })

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-2">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-white text-2xl font-bold">Applicants</Text>
          <Pressable className="p-2 bg-surface-card border border-surface-border rounded-xl active:opacity-70">
            <FilterIcon />
          </Pressable>
        </View>

        <View className="flex-row items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5 mb-3">
          <SearchIcon />
          <TextInput
            placeholder="Search candidates…"
            placeholderTextColor="#475569"
            value={search}
            onChangeText={handleSearchChange}
            style={{ flex: 1, fontSize: 14, color: '#fff' }}
          />
        </View>

        <View className="flex-row gap-2 mb-1" style={{ flexWrap: 'wrap' }}>
          {FILTER_TABS.map((tab) => {
            const active = activeFilter === tab.value
            return (
              <Pressable
                key={tab.value}
                onPress={() => setActiveFilter(tab.value)}
                style={{
                  backgroundColor: active ? '#FF6240' : '#131118',
                  borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                  borderWidth: 1, borderColor: active ? '#FF6240' : '#1E1B2E',
                }}
              >
                <Text style={{ color: active ? '#fff' : '#64748B', fontSize: 12, fontWeight: active ? '600' : '400' }}>
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {!isLoading && (
          <Text className="text-slate-500 text-xs mt-2 mb-1">
            {filtered.length} applicant{filtered.length !== 1 ? 's' : ''}
          </Text>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <ApplicationCard item={item} index={index} />}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#131118', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <FilterIcon />
              </View>
              <Text className="text-slate-400 font-semibold text-base mb-1">No applicants found</Text>
              <Text className="text-slate-500 text-sm text-center">
                {debouncedSearch ? 'Try a different search term' : 'Post a job to start receiving applications'}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

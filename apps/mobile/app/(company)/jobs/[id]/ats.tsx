import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected' | 'withdrawn'
type SortKey = 'submitted_at' | 'skills_match_pct' | 'full_name'

interface ApplicationRow {
  id: string
  candidate_id: string
  pipeline_stage: PipelineStage
  email_sent_at: string | null
  email_opened_at: string | null
  skills_match_pct: number | null
  submitted_at: string
  candidate_profiles: {
    headline: string | null
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

const STAGE_TABS: { label: string; value: PipelineStage | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'New', value: 'new' },
  { label: 'Reviewed', value: 'reviewed' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Interview', value: 'interview_scheduled' },
  { label: 'Offer', value: 'offer_made' },
  { label: 'Rejected', value: 'rejected' },
]

const MOVABLE_STAGES: PipelineStage[] = ['new', 'reviewed', 'shortlisted', 'interview_scheduled', 'offer_made', 'rejected']

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function MailIcon({ color }: { color: string }) {
  return (
    <Svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  )
}

function ChevronDownIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

function ApplicationCard({
  item,
  index,
  onMoveStage,
  isMoving,
}: {
  item: ApplicationRow
  index: number
  onMoveStage: (id: string, currentStage: PipelineStage) => void
  isMoving: boolean
}) {
  const name = item.candidate_profiles?.profiles?.full_name ?? 'Unknown'
  const avatarUrl = item.candidate_profiles?.profiles?.avatar_url
  const headline = item.candidate_profiles?.headline
  const stage = STAGE_CONFIG[item.pipeline_stage]
  const emailSeen = !!item.email_opened_at
  const emailSent = !!item.email_sent_at

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <View className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3">
        <View className="flex-row items-center gap-3 mb-3">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}
          <View className="flex-1">
            <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1}>{name}</Text>
            {headline && <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{headline}</Text>}
          </View>
          <View style={{ backgroundColor: stage.bg, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ color: stage.color, fontSize: 10, fontWeight: '600' }}>{stage.label}</Text>
          </View>
        </View>

        {item.skills_match_pct != null && (
          <View className="mb-3">
            <View className="flex-row justify-between mb-1">
              <Text className="text-slate-400 text-xs">Skills match</Text>
              <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '600' }}>{item.skills_match_pct}%</Text>
            </View>
            <View style={{ height: 4, backgroundColor: '#DDD6C9', borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${item.skills_match_pct}%`, backgroundColor: '#FF6240', borderRadius: 2 }} />
            </View>
          </View>
        )}

        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2">
            {(emailSeen || emailSent) && (
              <View className="flex-row items-center gap-1">
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: emailSeen ? '#22C55E' : '#64748B' }} />
                <MailIcon color={emailSeen ? '#22C55E' : '#64748B'} />
                <Text style={{ color: emailSeen ? '#22C55E' : '#64748B', fontSize: 10 }}>
                  {emailSeen ? 'Seen' : 'Sent'}
                </Text>
              </View>
            )}
            <Text className="text-slate-500 text-xs">{timeAgo(item.submitted_at)}</Text>
          </View>

          <View className="flex-row gap-2">
            <Pressable
              onPress={() => onMoveStage(item.id, item.pipeline_stage)}
              disabled={isMoving}
              style={{ backgroundColor: '#DDD6C9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}
              className="active:opacity-70"
            >
              <Text className="text-slate-300 text-xs">Stage</Text>
              <ChevronDownIcon />
            </Pressable>

            <Pressable
              onPress={() => router.push({ pathname: '/(company)/candidates/[id]', params: { id: item.candidate_id } })}
              style={{ backgroundColor: '#FF624015', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: '#FF624030' }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Profile</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Animated.View>
  )
}

export default function JobAtsScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
  const [activeStage, setActiveStage] = useState<PipelineStage | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('submitted_at')
  const queryClient = useQueryClient()

  const { data: jobTitle } = useQuery({
    queryKey: ['job-title', jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_postings').select('title').eq('id', jobId!).maybeSingle()
      return (data as { title: string } | null)?.title ?? 'Job'
    },
    enabled: !!jobId,
  })

  const { data: applications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['job-applications', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id, candidate_id, pipeline_stage, email_sent_at, email_opened_at,
          skills_match_pct, submitted_at,
          candidate_profiles (
            headline,
            profiles ( full_name, avatar_url )
          )
        `)
        .eq('job_id', jobId!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as unknown as ApplicationRow[]
    },
    enabled: !!jobId,
  })

  const { mutate: updateStage, isPending: isMoving } = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ pipeline_stage: stage })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job-applications', jobId] })
    },
  })

  const handleMoveStage = (id: string, currentStage: PipelineStage) => {
    const options = MOVABLE_STAGES.filter((s) => s !== currentStage)
    Alert.alert(
      'Move to stage',
      `Current: ${STAGE_CONFIG[currentStage].label}`,
      [
        ...options.map((stage) => ({
          text: STAGE_CONFIG[stage].label,
          onPress: () => updateStage({ id, stage }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  const sortedFiltered = (applications ?? [])
    .filter((a) => activeStage === 'all' || a.pipeline_stage === activeStage)
    .sort((a, b) => {
      if (sortKey === 'skills_match_pct') {
        return (b.skills_match_pct ?? 0) - (a.skills_match_pct ?? 0)
      }
      if (sortKey === 'full_name') {
        const nameA = a.candidate_profiles?.profiles?.full_name ?? ''
        const nameB = b.candidate_profiles?.profiles?.full_name ?? ''
        return nameA.localeCompare(nameB)
      }
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    })

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center gap-3 mb-1">
          <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
            <ArrowLeftIcon />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[#1A1625] text-lg font-bold">Applicants</Text>
            <Text className="text-slate-400 text-xs" numberOfLines={1}>{jobTitle}</Text>
          </View>
          <Pressable
            onPress={() => {
              const keys: SortKey[] = ['submitted_at', 'skills_match_pct', 'full_name']
              const labels = ['Date', 'Match %', 'Name']
              Alert.alert('Sort by', undefined, [
                ...keys.map((k, i) => ({
                  text: labels[i] + (sortKey === k ? ' ✓' : ''),
                  onPress: () => setSortKey(k),
                })),
                { text: 'Cancel', style: 'cancel' as const },
              ])
            }}
            style={{ backgroundColor: '#EDE7DB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#DDD6C9' }}
          >
            <Text className="text-slate-300 text-xs">Sort</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3 -mx-1">
          <View className="flex-row gap-2 px-1 pb-1">
            {STAGE_TABS.map((tab) => {
              const active = activeStage === tab.value
              return (
                <Pressable
                  key={tab.value}
                  onPress={() => setActiveStage(tab.value)}
                  style={{
                    backgroundColor: active ? '#FF6240' : '#EDE7DB',
                    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
                    borderWidth: 1, borderColor: active ? '#FF6240' : '#DDD6C9',
                  }}
                >
                  <Text style={{ color: active ? '#1A1625' : '#64748B', fontSize: 12, fontWeight: active ? '600' : '400' }}>
                    {tab.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        </ScrollView>

        <Text className="text-slate-500 text-xs mt-2">
          {sortedFiltered.length} applicant{sortedFiltered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={sortedFiltered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ApplicationCard
              item={item}
              index={index}
              onMoveStage={handleMoveStage}
              isMoving={isMoving}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-slate-400 font-semibold text-base mb-1">No applicants in this stage</Text>
              <Text className="text-slate-500 text-sm">Change the filter to see others</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

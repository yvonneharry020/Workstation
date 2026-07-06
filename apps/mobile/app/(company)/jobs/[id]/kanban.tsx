import { Dimensions, View, Text, Pressable, ScrollView, FlatList, Alert, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COLUMN_WIDTH = SCREEN_WIDTH * 0.72

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected'

interface ApplicationRow {
  id: string
  candidate_id: string
  pipeline_stage: PipelineStage
  submitted_at: string
  candidate_profiles: {
    first_name: string
    last_name: string
    avatar_url: string | null
  } | null
}

const COLUMNS: { stage: PipelineStage; label: string; color: string; bg: string }[] = [
  { stage: 'new',                 label: 'New',         color: '#818CF8', bg: '#1E293B' },
  { stage: 'reviewed',            label: 'Reviewed',    color: '#38BDF8', bg: '#082F49' },
  { stage: 'shortlisted',         label: 'Shortlisted', color: '#0DD4C3', bg: '#042F2E' },
  { stage: 'interview_scheduled', label: 'Interview',   color: '#F59E0B', bg: '#451A03' },
  { stage: 'offer_made',          label: 'Offer Made',  color: '#22C55E', bg: '#052E16' },
  { stage: 'rejected',            label: 'Rejected',    color: '#EF4444', bg: '#450A0A' },
]

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

function CandidateCard({
  item,
  availableStages,
  onLongPress,
}: {
  item: ApplicationRow
  availableStages: { stage: PipelineStage; label: string }[]
  onLongPress: (id: string, stages: { stage: PipelineStage; label: string }[]) => void
}) {
  const cp = item.candidate_profiles
  const name = cp ? `${cp.first_name} ${cp.last_name}`.trim() : 'Unknown'
  const avatarUrl = cp?.avatar_url

  return (
    <Pressable
      onPress={() =>
        router.push({ pathname: '/(company)/candidates/[id]', params: { id: item.candidate_id } })
      }
      onLongPress={() => onLongPress(item.id, availableStages)}
      style={{
        backgroundColor: '#F5F0E8', borderRadius: 12, padding: 12,
        borderWidth: 1, borderColor: '#DDD6C9', marginBottom: 8,
      }}
      className="active:opacity-80"
    >
      <View className="flex-row items-center gap-2 mb-1">
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} contentFit="cover" />
        ) : (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>{getInitials(name)}</Text>
          </View>
        )}
        <Text className="flex-1 text-[#1A1625] font-medium text-xs" numberOfLines={2}>{name}</Text>
      </View>
      <Text className="text-slate-500 text-xs">{timeAgo(item.submitted_at)}</Text>
      <Text className="text-slate-600 text-xs mt-1">Hold to move stage</Text>
    </Pressable>
  )
}

export default function KanbanScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
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

  const { data: applications, isLoading } = useQuery({
    queryKey: ['job-applications-kanban', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id, candidate_id, pipeline_stage, submitted_at,
          candidate_profiles ( first_name, last_name, avatar_url )
        `)
        .eq('job_id', jobId!)
        .order('submitted_at', { ascending: true })
      if (error) throw error
      return data as unknown as ApplicationRow[]
    },
    enabled: !!jobId,
  })

  const { mutate: moveStage } = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: PipelineStage }) => {
      const { error } = await supabase
        .from('job_applications')
        .update({ pipeline_stage: stage })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['job-applications-kanban', jobId] })
    },
  })

  const handleLongPress = (
    appId: string,
    stages: { stage: PipelineStage; label: string }[],
  ) => {
    Alert.alert(
      'Move to stage',
      'Select the new stage for this candidate',
      [
        ...stages.map(({ stage, label }) => ({
          text: label,
          onPress: () => moveStage({ id: appId, stage }),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ],
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center" edges={['top']}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const byStage = (stage: PipelineStage) =>
    (applications ?? []).filter((a) => a.pipeline_stage === stage)

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center gap-3">
          <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
            <ArrowLeftIcon />
          </Pressable>
          <View className="flex-1">
            <Text className="text-[#1A1625] text-lg font-bold">Kanban Board</Text>
            <Text className="text-slate-400 text-xs" numberOfLines={1}>{jobTitle}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
        className="flex-1"
      >
        {COLUMNS.map((col) => {
          const cards = byStage(col.stage)
          const otherStages = COLUMNS.filter((c) => c.stage !== col.stage)

          return (
            <View
              key={col.stage}
              style={{
                width: COLUMN_WIDTH, backgroundColor: '#EDE7DB',
                borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9',
                overflow: 'hidden',
              }}
            >
              <View style={{ backgroundColor: col.bg, padding: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: col.color, fontSize: 13, fontWeight: '700' }}>{col.label}</Text>
                <View style={{ backgroundColor: col.color + '30', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: col.color, fontSize: 11, fontWeight: '600' }}>{cards.length}</Text>
                </View>
              </View>

              <FlatList
                data={cards}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <CandidateCard
                    item={item}
                    availableStages={otherStages}
                    onLongPress={handleLongPress}
                  />
                )}
                contentContainerStyle={{ padding: 10 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                ListEmptyComponent={
                  <View className="py-8 items-center">
                    <Text className="text-slate-600 text-xs">No candidates</Text>
                  </View>
                }
              />
            </View>
          )
        })}
      </ScrollView>
    </SafeAreaView>
  )
}

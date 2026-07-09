import { Dimensions, View, Text, Pressable, ScrollView, FlatList, ActivityIndicator } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PipelineStage, PIPELINE_CONFIG } from '@/components/ats/types'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const COLUMN_WIDTH = SCREEN_WIDTH * 0.72

const NIGERIAN_STATES: Record<number, string> = {
  1: 'Abia', 2: 'Adamawa', 3: 'Akwa Ibom', 4: 'Anambra', 5: 'Bauchi',
  6: 'Bayelsa', 7: 'Benue', 8: 'Borno', 9: 'Cross River', 10: 'Delta',
  11: 'Ebonyi', 12: 'Edo', 13: 'Ekiti', 14: 'Enugu', 15: 'FCT',
  16: 'Gombe', 17: 'Imo', 18: 'Jigawa', 19: 'Kaduna', 20: 'Kano',
  21: 'Katsina', 22: 'Kebbi', 23: 'Kogi', 24: 'Kwara', 25: 'Lagos',
  26: 'Nasarawa', 27: 'Niger', 28: 'Ogun', 29: 'Ondo', 30: 'Osun',
  31: 'Oyo', 32: 'Plateau', 33: 'Rivers', 34: 'Sokoto', 35: 'Taraba',
  36: 'Yobe', 37: 'Zamfara',
}

const KANBAN_STAGES: PipelineStage[] = ['new', 'reviewed', 'shortlisted', 'interview_scheduled', 'hired', 'rejected']

interface ApplicationRow {
  id: string
  candidate_id: string
  pipeline_stage: PipelineStage
  submitted_at: string
  candidate_profiles: {
    first_name: string
    last_name: string
    avatar_url: string | null
    headline: string | null
    gender: string | null
    date_of_birth: string | null
    state_of_origin_id: number | null
  } | null
}

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
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function CandidateCard({ item }: { item: ApplicationRow }) {
  const cp = item.candidate_profiles
  const name = cp ? `${cp.first_name} ${cp.last_name}`.trim() : 'Unknown'
  const avatarUrl = cp?.avatar_url
  const headline = cp?.headline
  const gender = cp?.gender
  const dob = cp?.date_of_birth
  const stateId = cp?.state_of_origin_id

  const gLetter = gender === 'male' ? 'M' : gender === 'female' ? 'F' : null
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
  const location = stateId ? NIGERIAN_STATES[stateId] : null
  const nameTag = gLetter && age ? `(${gLetter}|${age})` : gLetter ? `(${gLetter})` : age ? `(${age})` : null

  return (
    <Pressable
      onPress={() => router.push(`/(company)/candidates/${item.candidate_id}?applicationId=${item.id}` as any)}
      style={({ pressed }) => ({
        backgroundColor: '#FFFFFF', borderRadius: 14, padding: 12,
        borderWidth: 1, borderColor: '#DDD6C9', marginBottom: 8,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 36, height: 36, borderRadius: 18, flexShrink: 0 }} contentFit="cover" />
        ) : (
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{getInitials(name)}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: 1 }}>
            <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 13 }} numberOfLines={1}>{name}</Text>
            {nameTag ? <Text style={{ color: '#64748B', fontSize: 11 }}>{nameTag}</Text> : null}
          </View>
          {headline ? <Text style={{ color: '#64748B', fontSize: 11 }} numberOfLines={1}>{headline}</Text> : null}
        </View>
      </View>
      {location ? <Text style={{ color: '#94A3B8', fontSize: 10, marginBottom: 4 }}>{location}</Text> : null}
      <Text style={{ color: '#94A3B8', fontSize: 10 }}>{timeAgo(item.submitted_at)}</Text>
    </Pressable>
  )
}

export default function KanbanScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()

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
          candidate_profiles ( first_name, last_name, avatar_url, headline, gender, date_of_birth, state_of_origin_id )
        `)
        .eq('job_id', jobId!)
        .order('submitted_at', { ascending: true })
      if (error) throw error
      return data as unknown as ApplicationRow[]
    },
    enabled: !!jobId,
  })

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }} edges={['top']}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const byStage = (stage: PipelineStage) =>
    (applications ?? []).filter((a) => a.pipeline_stage === stage)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <ArrowLeftIcon />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '700' }}>Kanban Board</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12 }} numberOfLines={1}>{jobTitle}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 12 }}
        style={{ flex: 1 }}
      >
        {KANBAN_STAGES.map((stage) => {
          const cfg = PIPELINE_CONFIG[stage]
          const cards = byStage(stage)

          return (
            <View
              key={stage}
              style={{
                width: COLUMN_WIDTH, backgroundColor: '#EDE7DB',
                borderRadius: 16, borderWidth: 1, borderColor: '#E5DFD3',
                overflow: 'hidden',
              }}
            >
              <View style={{
                backgroundColor: cfg.bg,
                padding: 12,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                borderBottomWidth: 1, borderBottomColor: cfg.border,
              }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cfg.color }} />
                  <Text style={{ color: cfg.color, fontSize: 13, fontWeight: '700' }}>{cfg.label}</Text>
                </View>
                <View style={{ backgroundColor: cfg.color + '20', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: cfg.color, fontSize: 11, fontWeight: '600' }}>{cards.length}</Text>
                </View>
              </View>

              <FlatList
                data={cards}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => <CandidateCard item={item} />}
                contentContainerStyle={{ padding: 10 }}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
                ListEmptyComponent={
                  <View style={{ paddingVertical: 32, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 12 }}>No candidates</Text>
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

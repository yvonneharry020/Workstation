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
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { PipelineStage, PIPELINE_CONFIG } from '@/components/ats/types'

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
    first_name: string
    last_name: string
    avatar_url: string | null
    headline: string | null
    gender: string | null
    date_of_birth: string | null
    state_of_origin_id: number | null
  } | null
}

const STAGE_TABS: { label: string; value: PipelineStage | 'all' }[] = [
  { label: 'All',         value: 'all' },
  { label: 'New',         value: 'new' },
  { label: 'Reviewing',   value: 'reviewed' },
  { label: 'Shortlisted', value: 'shortlisted' },
  { label: 'Interview',   value: 'interview_scheduled' },
  { label: 'Hired',       value: 'hired' },
  { label: 'Rejected',    value: 'rejected' },
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
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function ApplicationCard({ item, index }: { item: ApplicationRow; index: number }) {
  const cp = item.candidate_profiles
  const name = cp ? `${cp.first_name} ${cp.last_name}`.trim() : 'Unknown'
  const avatarUrl = cp?.avatar_url
  const headline = cp?.headline
  const gender = cp?.gender
  const dob = cp?.date_of_birth
  const stateId = cp?.state_of_origin_id
  const stage = PIPELINE_CONFIG[item.pipeline_stage]

  const gLetter = gender === 'male' ? 'M' : gender === 'female' ? 'F' : null
  const age = dob ? Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null
  const location = stateId ? NIGERIAN_STATES[stateId] : null
  const nameTag = gLetter && age ? `(${gLetter}|${age})` : gLetter ? `(${gLetter})` : age ? `(${age})` : null

  return (
    <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
      <Pressable
        onPress={() => router.push(`/(company)/candidates/${item.candidate_id}?applicationId=${item.id}` as any)}
        style={({ pressed }) => ({
          backgroundColor: '#FFFFFF',
          borderRadius: 18,
          borderWidth: 2,
          borderColor: '#B8A898',
          shadowColor: '#1A1625',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.06,
          shadowRadius: 4,
          elevation: 2,
          padding: 16,
          marginBottom: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: item.skills_match_pct != null ? 12 : 0 }}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24, flexShrink: 0 }} contentFit="cover" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{name}</Text>
              {nameTag ? <Text style={{ color: '#64748B', fontSize: 12 }}>{nameTag}</Text> : null}
            </View>
            {headline ? <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 2 }} numberOfLines={1}>{headline}</Text> : null}
            {location ? <Text style={{ color: '#94A3B8', fontSize: 11 }}>{location}</Text> : null}
          </View>
          <View style={{
            backgroundColor: stage.bg, borderRadius: 8,
            paddingHorizontal: 8, paddingVertical: 4,
            borderWidth: 1, borderColor: stage.border, flexShrink: 0,
          }}>
            <Text style={{ color: stage.color, fontSize: 11, fontWeight: '700' }}>{stage.label}</Text>
          </View>
        </View>

        {item.skills_match_pct != null && (
          <View style={{ marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: '#94A3B8', fontSize: 11 }}>Skills match</Text>
              <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '600' }}>{item.skills_match_pct}%</Text>
            </View>
            <View style={{ height: 4, backgroundColor: '#E5DFD3', borderRadius: 2, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${item.skills_match_pct}%`, backgroundColor: '#FF6240', borderRadius: 2 }} />
            </View>
          </View>
        )}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ color: '#94A3B8', fontSize: 11 }}>{timeAgo(item.submitted_at)}</Text>
          {item.email_opened_at && (
            <>
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#22C55E' }} />
              <Text style={{ color: '#22C55E', fontSize: 11 }}>Seen</Text>
            </>
          )}
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function JobAtsScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
  const [activeStage, setActiveStage] = useState<PipelineStage | 'all'>('all')
  const [sortKey, setSortKey] = useState<SortKey>('submitted_at')

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
          candidate_profiles ( first_name, last_name, avatar_url, headline, gender, date_of_birth, state_of_origin_id )
        `)
        .eq('job_id', jobId!)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as unknown as ApplicationRow[]
    },
    enabled: !!jobId,
  })

  const sortedFiltered = (applications ?? [])
    .filter((a) => activeStage === 'all' || a.pipeline_stage === activeStage)
    .sort((a, b) => {
      if (sortKey === 'skills_match_pct') {
        return (b.skills_match_pct ?? 0) - (a.skills_match_pct ?? 0)
      }
      if (sortKey === 'full_name') {
        const cpA = a.candidate_profiles
        const cpB = b.candidate_profiles
        const nameA = cpA ? `${cpA.first_name} ${cpA.last_name}`.trim() : ''
        const nameB = cpB ? `${cpB.first_name} ${cpB.last_name}`.trim() : ''
        return nameA.localeCompare(nameB)
      }
      return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
    })

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
            <ArrowLeftIcon />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '700' }}>Applicants</Text>
            <Text style={{ color: '#94A3B8', fontSize: 12 }} numberOfLines={1}>{jobTitle}</Text>
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
            <Text style={{ color: '#5A4F6E', fontSize: 12 }}>Sort</Text>
          </Pressable>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
          <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 4, paddingBottom: 4 }}>
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

        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 8 }}>
          {sortedFiltered.length} applicant{sortedFiltered.length !== 1 ? 's' : ''}
        </Text>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={sortedFiltered}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <ApplicationCard item={item} index={index} />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 64 }}>
              <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 15, marginBottom: 4 }}>No applicants in this stage</Text>
              <Text style={{ color: '#64748B', fontSize: 13 }}>Change the filter to see others</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

import {
  View,
  Text,
  Pressable,
  SectionList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ShortlistedApplication {
  id: string
  candidate_id: string
  job_id: string
  email_sent_at: string | null
  email_opened_at: string | null
  submitted_at: string
  job_postings: { id: string; title: string } | null
  candidate_profiles: {
    headline: string | null
    profiles: { full_name: string; avatar_url: string | null } | null
  } | null
}

interface Section {
  jobId: string
  jobTitle: string
  data: ShortlistedApplication[]
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

function CalendarIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 2v3M16 2v3M3 8h18M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" />
    </Svg>
  )
}

function EmptyBookmarkIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

function CandidateCard({ item }: { item: ShortlistedApplication }) {
  const name = item.candidate_profiles?.profiles?.full_name ?? 'Unknown'
  const avatarUrl = item.candidate_profiles?.profiles?.avatar_url
  const headline = item.candidate_profiles?.headline
  const emailSeen = !!item.email_opened_at
  const emailSent = !!item.email_sent_at

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        onPress={() =>
          router.push({
            pathname: '/(company)/candidates/[id]',
            params: { id: item.candidate_id, applicationId: item.id, jobId: item.job_id },
          })
        }
        className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-3">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#0DD4C3', fontSize: 14, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}

          <View className="flex-1">
            <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1}>{name}</Text>
            {headline && <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{headline}</Text>}
            <View className="flex-row items-center gap-2 mt-1">
              <Text className="text-slate-500 text-xs">{timeAgo(item.submitted_at)}</Text>
              {(emailSeen || emailSent) && (
                <View className="flex-row items-center gap-1">
                  <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: emailSeen ? '#22C55E' : '#64748B' }} />
                  <MailIcon color={emailSeen ? '#22C55E' : '#64748B'} />
                  <Text style={{ color: emailSeen ? '#22C55E' : '#64748B', fontSize: 10 }}>
                    {emailSeen ? 'Seen' : 'Sent'}
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Pressable
            onPress={() =>
              router.push({
                pathname: '/(company)/interviews/schedule',
                params: { applicationId: item.id },
              })
            }
            style={{
              backgroundColor: '#0DD4C310', borderWidth: 1, borderColor: '#0DD4C330',
              borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
              flexDirection: 'row', alignItems: 'center', gap: 4,
            }}
            className="active:opacity-70"
          >
            <CalendarIcon />
            <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '600' }}>Interview</Text>
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function ShortlistedScreen() {
  const user = useAuthStore((s) => s.user)

  const { data: applications, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['shortlisted-candidates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id, candidate_id, job_id, email_sent_at, email_opened_at, submitted_at,
          job_postings!inner ( id, title, company_id ),
          candidate_profiles (
            headline,
            profiles ( full_name, avatar_url )
          )
        `)
        .eq('pipeline_stage', 'shortlisted')
        .eq('job_postings.company_id', user!.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return data as unknown as ShortlistedApplication[]
    },
    enabled: !!user?.id,
  })

  const sections: Section[] = []
  const jobMap = new Map<string, Section>()

  for (const app of applications ?? []) {
    const jobId = app.job_postings?.id ?? 'unknown'
    const jobTitle = app.job_postings?.title ?? 'Unknown Job'
    if (!jobMap.has(jobId)) {
      const section: Section = { jobId, jobTitle, data: [] }
      jobMap.set(jobId, section)
      sections.push(section)
    }
    jobMap.get(jobId)!.data.push(app)
  }

  const totalCount = (applications ?? []).length

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[#1A1625] text-xl font-bold">Shortlisted</Text>
          {!isLoading && (
            <Text className="text-slate-400 text-xs">
              {totalCount} candidate{totalCount !== 1 ? 's' : ''}
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : sections.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <EmptyBookmarkIcon />
          <Text className="text-slate-400 font-semibold text-lg mt-4 mb-2">No shortlisted candidates</Text>
          <Text className="text-slate-500 text-sm text-center">
            Move candidates to Shortlisted from the ATS to see them here.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <CandidateCard item={item} />}
          renderSectionHeader={({ section }) => (
            <View
              style={{
                backgroundColor: '#F5F0E8', paddingHorizontal: 20, paddingVertical: 8,
                flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
              }}
            >
              <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1} style={{ flex: 1 }}>
                {section.jobTitle}
              </Text>
              <View style={{ backgroundColor: '#0DD4C320', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '600' }}>
                  {section.data.length}
                </Text>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
        />
      )}
    </SafeAreaView>
  )
}

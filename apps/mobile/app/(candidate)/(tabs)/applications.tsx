import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  ScrollView,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ApplicationCard {
  id: string
  job_id: string
  status: string
  pipeline_stage: string
  email_sent_at: string | null
  email_opened_at: string | null
  submitted_at: string
  job_postings: {
    title: string
    company_profiles: {
      company_name: string
      logo_url: string | null
    } | null
  } | null
}

type FilterKey = 'all' | 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'rejected'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',                  label: 'All' },
  { key: 'new',                  label: 'Applied' },
  { key: 'reviewed',             label: 'Reviewing' },
  { key: 'shortlisted',         label: 'Shortlisted' },
  { key: 'interview_scheduled', label: 'Interview' },
  { key: 'rejected',            label: 'Rejected' },
]

const STAGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new:                 { bg: '#EFF6FF', text: '#3B82F6', label: 'Applied' },
  reviewed:            { bg: '#F5F3FF', text: '#8B5CF6', label: 'Reviewing' },
  shortlisted:         { bg: '#F9F1E8', text: '#7C4B2A', label: 'Shortlisted' },
  interview_scheduled: { bg: '#FFFBEB', text: '#F59E0B', label: 'Interview' },
  hired:               { bg: '#F0FDF4', text: '#22C55E', label: 'Hired' },
  rejected:            { bg: '#FEF2F2', text: '#EF4444', label: 'Rejected' },
  withdrawn:           { bg: '#F8FAFC', text: '#64748B', label: 'Withdrawn' },
}

const DEFAULT_STAGE_STYLE = { bg: '#EFF6FF', text: '#3B82F6', label: 'Applied' }

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function CompanyLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{ width: 44, height: 44, borderRadius: 10 }}
        contentFit="cover"
      />
    )
  }
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: 10,
        backgroundColor: '#FF624020',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
    </View>
  )
}

function EmailStatusPill({ sentAt, openedAt }: { sentAt: string | null; openedAt: string | null }) {
  if (openedAt) {
    return (
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
          backgroundColor: '#F0FDF4', borderWidth: 1, borderColor: '#22C55E30',
          alignSelf: 'flex-start', marginTop: 6,
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#22C55E' }} />
        <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>
          Email opened · {timeAgo(openedAt)}
        </Text>
      </View>
    )
  }
  if (sentAt) {
    return (
      <View
        style={{
          flexDirection: 'row', alignItems: 'center', gap: 4,
          paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
          backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0',
          alignSelf: 'flex-start', marginTop: 6,
        }}
      >
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#64748B' }} />
        <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '500' }}>
          Email sent · {timeAgo(sentAt)}
        </Text>
      </View>
    )
  }
  return null
}

function ApplicationItem({ item, onPress }: { item: ApplicationCard; onPress: () => void }) {
  const company = item.job_postings?.company_profiles
  const companyName = company?.company_name ?? 'Company'
  const stage = STAGE_STYLES[item.pipeline_stage] ?? DEFAULT_STAGE_STYLE

  return (
    <Pressable
      onPress={onPress}
      style={{
        backgroundColor: '#F0EBE1', borderRadius: 20, borderWidth: 1,
        borderColor: '#DDD6C9', padding: 16, marginBottom: 12, overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 12, bottom: 12, width: 3, backgroundColor: stage.text, borderRadius: 2 }} />

      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
        <CompanyLogo name={companyName} logoUrl={company?.logo_url ?? null} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700', flex: 1, marginRight: 8, lineHeight: 20 }} numberOfLines={2}>
              {item.job_postings?.title ?? 'Job'}
            </Text>
            <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: stage.bg, borderWidth: 1, borderColor: `${stage.text}30` }}>
              <Text style={{ color: stage.text, fontSize: 10, fontWeight: '700' }}>{stage.label}</Text>
            </View>
          </View>

          <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 2 }} numberOfLines={1}>{companyName}</Text>
          <Text style={{ color: '#334155', fontSize: 11 }}>Applied {timeAgo(item.submitted_at)}</Text>

          <EmailStatusPill sentAt={item.email_sent_at} openedAt={item.email_opened_at} />
        </View>
      </View>
    </Pressable>
  )
}

function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, string> = {
    all:                  "You haven't applied to any jobs yet. Browse jobs to find your next opportunity.",
    new:                  'No pending applications.',
    reviewed:             'No applications currently under review.',
    shortlisted:          "You haven't been shortlisted yet — keep applying!",
    interview_scheduled:  'No interview invitations yet.',
    rejected:             'No rejected applications.',
  }
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, marginTop: 64 }}>
      <Text style={{ fontSize: 40, marginBottom: 16 }}>📋</Text>
      <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 15, textAlign: 'center', marginBottom: 8 }}>
        No applications
      </Text>
      <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
        {messages[filter]}
      </Text>
    </View>
  )
}

export default function ApplicationsScreen() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<FilterKey>('all')
  const [refreshing, setRefreshing] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['my-applications', user?.id],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('job_applications')
        .select(`
          id, job_id, status, pipeline_stage, email_sent_at, email_opened_at, submitted_at,
          job_postings ( title, company_profiles ( company_name, logo_url ) )
        `)
        .eq('candidate_id', user!.id)
        .order('submitted_at', { ascending: false })
      if (error) throw error
      return rows as unknown as ApplicationCard[]
    },
    enabled: !!user?.id,
    staleTime: 0,
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!user?.id) return
    const channel = supabase
      .channel('my-applications-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'job_applications', filter: `candidate_id=eq.${user.id}` },
        () => { queryClient.invalidateQueries({ queryKey: ['my-applications', user.id] }) },
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user?.id, queryClient])

  const onRefresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['my-applications', user?.id] })
    setRefreshing(false)
  }

  const filtered =
    activeFilter === 'all'
      ? data ?? []
      : (data ?? []).filter((a) => a.pipeline_stage === activeFilter)

  const totalCount    = data?.length ?? 0
  const rejectedCount = data?.filter((a) => a.pipeline_stage === 'rejected').length ?? 0
  const hiredCount    = data?.filter((a) => a.pipeline_stage === 'hired').length ?? 0

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <Animated.View
        entering={FadeInDown.duration(350)}
        style={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6 }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '800', letterSpacing: -0.3 }}>
            Applications
          </Text>
          {totalCount > 0 && (
            <View style={{ backgroundColor: '#FF624020', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#FF624030' }}>
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{totalCount}</Text>
            </View>
          )}
        </View>

        {totalCount > 0 && (
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Total',    value: totalCount,    color: '#FF6240' },
              { label: 'Rejected', value: rejectedCount, color: '#EF4444' },
              { label: 'Hired',    value: hiredCount,    color: '#22C55E' },
            ].map((s) => (
              <View key={s.label} style={{ flex: 1, backgroundColor: '#F0EBE1', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', paddingVertical: 12, alignItems: 'center' }}>
                <Text style={{ color: s.color, fontSize: 22, fontWeight: '800' }}>{s.value}</Text>
                <Text style={{ color: '#475569', fontSize: 10, marginTop: 2 }}>{s.label}</Text>
              </View>
            ))}
          </View>
        )}
      </Animated.View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: 20, paddingVertical: 8, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key
          return (
            <Pressable
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={{
                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                backgroundColor: isActive ? '#FF6240' : '#F0EBE1',
                borderWidth: 1,
                borderColor: isActive ? '#FF6240' : '#DDD6C9',
              }}
            >
              <Text style={{ color: isActive ? '#fff' : '#64748B', fontSize: 13, fontWeight: isActive ? '700' : '400' }}>
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6240" />
          }
          ListEmptyComponent={<EmptyState filter={activeFilter} />}
          renderItem={({ item }) => (
            <ApplicationItem
              item={item}
              onPress={() =>
                router.push(`/(candidate)/application/${item.id}` as Parameters<typeof router.push>[0])
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

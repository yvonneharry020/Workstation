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
import { useState } from 'react'
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

type FilterKey = 'all' | 'new' | 'reviewing' | 'shortlisted' | 'rejected'

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'new', label: 'Applied' },
  { key: 'reviewing', label: 'Reviewing' },
  { key: 'shortlisted', label: 'Shortlisted' },
  { key: 'rejected', label: 'Rejected' },
]

const STAGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new:         { bg: '#1E293B', text: '#94A3B8', label: 'Submitted' },
  reviewing:   { bg: '#78350F20', text: '#F59E0B', label: 'Reviewing' },
  shortlisted: { bg: '#14532D20', text: '#22C55E', label: 'Shortlisted' },
  rejected:    { bg: '#7F1D1D20', text: '#EF4444', label: 'Rejected' },
  hired:       { bg: '#FF624020', text: '#FF6240', label: 'Hired' },
}

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

function EmailStatusPill({
  sentAt,
  openedAt,
}: {
  sentAt: string | null
  openedAt: string | null
}) {
  if (openedAt) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
          backgroundColor: '#14532D20',
          borderWidth: 1,
          borderColor: '#22C55E30',
          alignSelf: 'flex-start',
          marginTop: 6,
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
          flexDirection: 'row',
          alignItems: 'center',
          gap: 4,
          paddingHorizontal: 8,
          paddingVertical: 3,
          borderRadius: 8,
          backgroundColor: '#1E293B',
          borderWidth: 1,
          borderColor: '#334155',
          alignSelf: 'flex-start',
          marginTop: 6,
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

function ApplicationItem({
  item,
  onPress,
}: {
  item: ApplicationCard
  onPress: () => void
}) {
  const company = item.job_postings?.company_profiles
  const companyName = company?.company_name ?? 'Company'
  const stage = STAGE_STYLES[item.pipeline_stage] ?? { bg: '#1E293B', text: '#94A3B8', label: 'Submitted' }

  return (
    <Pressable
      onPress={onPress}
      className="bg-surface-card border border-surface-border rounded-2xl px-4 py-4 mb-3 active:opacity-80"
    >
      <View className="flex-row items-start gap-3">
        <CompanyLogo name={companyName} logoUrl={company?.logo_url ?? null} />
        <View className="flex-1">
          <View className="flex-row items-start justify-between mb-1">
            <Text
              className="text-white font-semibold text-sm flex-1 mr-2"
              numberOfLines={1}
            >
              {item.job_postings?.title ?? 'Job'}
            </Text>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 8,
                backgroundColor: stage.bg,
              }}
            >
              <Text style={{ color: stage.text, fontSize: 11, fontWeight: '600' }}>
                {stage.label}
              </Text>
            </View>
          </View>

          <Text className="text-slate-400 text-xs" numberOfLines={1}>
            {companyName}
          </Text>
          <Text className="text-slate-500 text-xs mt-0.5">
            Applied {timeAgo(item.submitted_at)}
          </Text>

          <EmailStatusPill
            sentAt={item.email_sent_at}
            openedAt={item.email_opened_at}
          />
        </View>
      </View>
    </Pressable>
  )
}

function EmptyState({ filter }: { filter: FilterKey }) {
  const messages: Record<FilterKey, string> = {
    all: "You haven't applied to any jobs yet. Browse jobs to find your next opportunity.",
    new: 'No pending applications.',
    reviewing: 'No applications currently under review.',
    shortlisted: "You haven't been shortlisted yet — keep applying!",
    rejected: 'No rejected applications.',
  }
  return (
    <View className="flex-1 items-center justify-center px-8 mt-16">
      <Text style={{ fontSize: 40, marginBottom: 16 }}>📋</Text>
      <Text className="text-white font-semibold text-base text-center mb-2">
        No applications
      </Text>
      <Text className="text-slate-400 text-sm text-center leading-5">
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
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['my-applications', user?.id] })
    setRefreshing(false)
  }

  const filtered =
    activeFilter === 'all'
      ? data ?? []
      : (data ?? []).filter((a) => a.pipeline_stage === activeFilter)

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <Animated.View
        entering={FadeInDown.duration(400)}
        className="flex-row items-center justify-between px-5 pt-4 pb-4"
      >
        <View className="flex-row items-center gap-3">
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', letterSpacing: -0.3 }}>
            My Applications
          </Text>
          {data && data.length > 0 && (
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 10,
                backgroundColor: '#FF624020',
              }}
            >
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>
                {data.length}
              </Text>
            </View>
          )}
        </View>
      </Animated.View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}
      >
        {FILTERS.map((f) => {
          const isActive = activeFilter === f.key
          return (
            <Pressable
              key={f.key}
              onPress={() => setActiveFilter(f.key)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: isActive ? '#FF6240' : '#131118',
                borderWidth: 1,
                borderColor: isActive ? '#FF6240' : '#1E1B2E',
              }}
            >
              <Text
                style={{
                  color: isActive ? '#fff' : '#64748B',
                  fontSize: 13,
                  fontWeight: isActive ? '600' : '400',
                }}
              >
                {f.label}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#FF6240"
            />
          }
          ListEmptyComponent={<EmptyState filter={activeFilter} />}
          renderItem={({ item }) => (
            <ApplicationItem
              item={item}
              onPress={() =>
                router.push(`/(candidate)/jobs/${item.job_id}` as Parameters<typeof router.push>[0])
              }
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}

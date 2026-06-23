import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type InterviewStatus = 'booked' | 'completed' | 'cancelled' | 'no_show'
type FilterTab = 'upcoming' | 'past' | 'cancelled'

interface Interview {
  id: string
  status: InterviewStatus
  created_at: string
  interview_slots: {
    slot_date: string
    start_time: string
    duration_mins: number
    meeting_type: string
    meeting_link: string | null
  } | null
  company_profiles: {
    company_name: string
    logo_url: string | null
  } | null
}

const STATUS_STYLES: Record<InterviewStatus, { bg: string; text: string; label: string }> = {
  booked:    { bg: '#1E3A8A20', text: '#60A5FA', label: 'Upcoming' },
  completed: { bg: '#14532D20', text: '#22C55E', label: 'Completed' },
  cancelled: { bg: '#1E293B',   text: '#94A3B8', label: 'Cancelled' },
  no_show:   { bg: '#78350F20', text: '#F59E0B', label: 'No show' },
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(t: string): string {
  const parts = t.split(':')
  const h = Number(parts[0] ?? '0')
  const m = Number(parts[1] ?? '0')
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

function VideoIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.845v6.31a1 1 0 0 1-1.447.894L15 14M4 8h8a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

function InterviewCard({ interview }: { interview: Interview }) {
  const slot = interview.interview_slots
  const company = interview.company_profiles
  const status = STATUS_STYLES[interview.status]
  const today = new Date().toISOString().slice(0, 10)
  const canJoin = interview.status === 'booked' && slot?.meeting_link && slot?.slot_date >= today

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-start gap-3 mb-3">
        {company?.logo_url ? (
          <Image
            source={{ uri: company.logo_url }}
            style={{ width: 44, height: 44, borderRadius: 10 }}
            contentFit="cover"
          />
        ) : (
          <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#475569', fontSize: 18, fontWeight: '700' }}>
              {company?.company_name?.charAt(0) ?? '?'}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <Text className="text-white font-semibold text-sm">{company?.company_name ?? 'Company'}</Text>
          {slot && (
            <Text className="text-slate-400 text-xs mt-0.5">
              {formatDate(slot.slot_date)} · {formatTime(slot.start_time)}
            </Text>
          )}
          <View className="flex-row items-center gap-2 mt-2">
            {slot && (
              <View style={{ backgroundColor: '#1E1B2E', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Text style={{ color: '#94A3B8', fontSize: 11 }}>{slot.duration_mins} min</Text>
              </View>
            )}
            {slot && (
              <View className="flex-row items-center gap-1">
                <VideoIcon />
                <Text style={{ color: '#94A3B8', fontSize: 11, textTransform: 'capitalize' }}>{slot.meeting_type}</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ backgroundColor: status.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: status.text, fontSize: 11, fontWeight: '600' }}>{status.label}</Text>
        </View>
      </View>

      {canJoin && (
        <Pressable
          onPress={() => Alert.alert('Join meeting', slot?.meeting_link ?? 'No link available')}
          className="flex-row items-center justify-center gap-2 rounded-xl py-3 active:opacity-80"
          style={{ borderWidth: 1, borderColor: '#FF6240', backgroundColor: '#FF624010' }}
        >
          <VideoIcon />
          <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>Join meeting</Text>
        </Pressable>
      )}
    </Animated.View>
  )
}

export default function InterviewHistoryScreen() {
  const user = useAuthStore((s) => s.user)
  const [activeTab, setActiveTab] = useState<FilterTab>('upcoming')

  const { data: interviews = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['interviews', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_bookings')
        .select(`
          id, status, created_at,
          interview_slots ( slot_date, start_time, duration_mins, meeting_type, meeting_link ),
          company_profiles ( company_name, logo_url )
        `)
        .eq('candidate_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Interview[]
    },
    enabled: !!user?.id,
  })

  const today = new Date().toISOString().slice(0, 10)

  const filtered = interviews.filter((i) => {
    const slotDate = i.interview_slots?.slot_date ?? ''
    if (activeTab === 'upcoming') return i.status === 'booked' && slotDate >= today
    if (activeTab === 'past') return i.status === 'completed' || (i.status === 'booked' && slotDate < today)
    return i.status === 'cancelled' || i.status === 'no_show'
  })

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'past', label: 'Past' },
    { key: 'cancelled', label: 'Cancelled' },
  ]

  const emptyLabels: Record<FilterTab, string> = {
    upcoming: 'No upcoming interviews',
    past: 'No past interviews',
    cancelled: 'No cancelled interviews',
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center gap-4 px-5 pt-5 pb-4">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text className="text-white text-2xl font-bold">My Interviews</Text>
      </View>

      {/* Filter tabs */}
      <View className="flex-row px-5 mb-4 gap-2">
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            onPress={() => setActiveTab(key)}
            style={{
              paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
              backgroundColor: activeTab === key ? '#FF6240' : '#131118',
              borderWidth: 1, borderColor: activeTab === key ? '#FF6240' : '#1E1B2E',
            }}
          >
            <Text style={{ color: activeTab === key ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: '600' }}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
        ListEmptyComponent={
          isLoading ? (
            <View className="py-20 items-center">
              <Text className="text-slate-500 text-sm">Loading interviews…</Text>
            </View>
          ) : (
            <View className="py-16 items-center px-6">
              <Text className="text-white text-base font-semibold text-center mb-2">{emptyLabels[activeTab]}</Text>
              <Text className="text-slate-400 text-sm text-center leading-5">
                {activeTab === 'upcoming'
                  ? 'When a company invites you to interview, it will appear here.'
                  : 'Nothing here yet.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <InterviewCard interview={item} />}
      />
    </SafeAreaView>
  )
}

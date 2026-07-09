import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type BadgeStatus = 'active' | 'revoked' | 'disputed'

interface Badge {
  id: string
  role_held: string
  start_date: string
  end_date: string | null
  is_current: boolean
  performance_rating: number | null
  status: BadgeStatus
  issued_at: string
  revoked_at: string | null
  revocation_reason: string | null
  recipient_id: string
  badge_signatures: { badge_id: string }[] | null
  candidate_profiles: {
    first_name: string
    last_name: string
    avatar_url: string | null
  } | null
}

interface BadgeRow {
  id: string
  role_held: string
  start_date: string
  end_date: string | null
  is_current: boolean
  performance_rating: number | null
  status: string
  issued_at: string
  revoked_at: string | null
  revocation_reason: string | null
  recipient_id: string
  badge_signatures: { badge_id: string }[] | null
  candidate_profiles: {
    first_name: string
    last_name: string
    avatar_url: string | null
  } | null
}

type FilterTab = 'all' | 'active' | 'revoked' | 'disputed'

const STATUS_COLORS: Record<BadgeStatus, string> = {
  active: '#0DD4C3',
  revoked: '#EF4444',
  disputed: '#F59E0B',
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.slice(0, 10).split('-')
  return `${day}/${month}/${year}`
}

function canRevoke(issuedAt: string): boolean {
  return Date.now() - new Date(issuedAt).getTime() < 72 * 3600 * 1000
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2zM7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill={filled ? '#F59E0B' : '#DDD6C9'} stroke={filled ? '#F59E0B' : '#334155'} strokeWidth={1} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
}

export default function BadgesHistoryScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState<FilterTab>('all')

  const { data: badges = [], isLoading } = useQuery({
    queryKey: ['badges-history', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select(`
          id, role_held, start_date, end_date, is_current, performance_rating,
          status, issued_at, revoked_at, revocation_reason, recipient_id,
          badge_signatures(badge_id),
          candidate_profiles:recipient_id(first_name, last_name, avatar_url)
        `)
        .eq('issuer_id', user!.id)
        .order('issued_at', { ascending: false })
      if (error) throw error
      return (data as unknown as BadgeRow[]).map((r) => ({ ...r, status: r.status as BadgeStatus })) as Badge[]
    },
    enabled: !!user?.id,
  })

  const revokeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('badges')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['badges-history'] }),
    onError: () => Alert.alert('Error', 'Failed to revoke badge.'),
  })

  const handleRevoke = (badge: Badge) => {
    Alert.alert(
      'Revoke badge?',
      `Revoke the badge for ${badge.candidate_profiles ? `${badge.candidate_profiles.first_name} ${badge.candidate_profiles.last_name}`.trim() : 'this candidate'}? This action cannot be undone after 72 hours.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Revoke', style: 'destructive', onPress: () => revokeMutation.mutate(badge.id) },
      ],
    )
  }

  const filtered = badges.filter((b) => {
    if (filter === 'all') return true
    return b.status === filter
  })

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'revoked', label: 'Revoked' },
    { key: 'disputed', label: 'Disputed' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-2xl font-bold flex-1">Issued Badges</Text>
        <Text style={{ color: '#475569', fontSize: 14, fontWeight: '600' }}>{badges.length}</Text>
        <Pressable
          onPress={() => router.push('/(company)/badges/issue')}
          style={{ backgroundColor: '#FF624015', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, marginLeft: 12, borderWidth: 1, borderColor: '#FF624030' }}
        >
          <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>+ Issue</Text>
        </Pressable>
      </View>

      <View className="flex-row px-5 py-3 gap-2">
        {TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setFilter(t.key)}
            style={{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: filter === t.key ? '#FF6240' : '#EDE7DB', borderWidth: 1, borderColor: filter === t.key ? '#FF6240' : '#DDD6C9' }}
          >
            <Text style={{ color: filter === t.key ? '#1A1625' : '#5A4F6E', fontSize: 12, fontWeight: '600' }}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      {isLoading ? (
        <ActivityIndicator color="#FF6240" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: '#475569', fontSize: 15 }}>No badges found</Text>
              <Pressable onPress={() => router.push('/(company)/badges/issue')} style={{ marginTop: 12 }}>
                <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>Issue your first badge →</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const icp = item.candidate_profiles
            const name = icp ? `${icp.first_name} ${icp.last_name}`.trim() : 'Unknown'
            const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
            const statusColor = STATUS_COLORS[item.status]
            const hasSignature = (item.badge_signatures?.length ?? 0) > 0
            const isRevocable = item.status === 'active' && canRevoke(item.issued_at)
            const rating = item.performance_rating ?? 0

            return (
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
                  {icp?.avatar_url ? (
                    <Image source={{ uri: icp.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                  ) : (
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>{name}</Text>
                    <Text style={{ color: '#1A1625', fontSize: 13, marginTop: 2 }}>{item.role_held}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                      {formatDate(item.start_date)} — {item.is_current ? 'Present' : (item.end_date ? formatDate(item.end_date) : '—')}
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end', gap: 6 }}>
                    <View style={{ backgroundColor: `${statusColor}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                      <Text style={{ color: statusColor, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{item.status}</Text>
                    </View>
                    {hasSignature && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                        <LockIcon />
                        <Text style={{ color: '#0DD4C3', fontSize: 10 }}>Signed</Text>
                      </View>
                    )}
                  </View>
                </View>

                {rating > 0 && (
                  <View style={{ flexDirection: 'row', gap: 3, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <StarIcon key={n} filled={n <= rating} />
                    ))}
                  </View>
                )}

                {isRevocable && (
                  <Pressable
                    onPress={() => handleRevoke(item)}
                    style={{ backgroundColor: '#EF444415', borderRadius: 10, borderWidth: 1, borderColor: '#EF444430', paddingVertical: 10, alignItems: 'center' }}
                  >
                    {revokeMutation.isPending ? (
                      <ActivityIndicator color="#EF4444" size="small" />
                    ) : (
                      <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>Revoke badge</Text>
                    )}
                  </Pressable>
                )}
              </View>
            )
          }}
        />
      )}
    </SafeAreaView>
  )
}

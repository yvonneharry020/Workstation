import {
  View,
  Text,
  Pressable,
  FlatList,
  RefreshControl,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface Badge {
  id: string
  role_held: string
  start_date: string
  end_date: string | null
  is_current: boolean
  recommendation: string | null
  performance_rating: number | null
  status: 'active' | 'revoked'
  revocation_reason: string | null
  issued_at: string
  company_profiles: {
    id: string
    company_name: string
    logo_url: string | null
    is_verified: boolean
  } | null
}

function formatBadgePeriod(start: string, end: string | null, isCurrent: boolean): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${isCurrent ? 'Present' : end ? fmt(end) : '?'}`
}

function StarRating({ rating }: { rating: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Text key={i} style={{ color: i <= rating ? '#FF6240' : '#3D3850', fontSize: 15 }}>
          ★
        </Text>
      ))}
    </View>
  )
}

function ShieldIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

function BadgeCard({ badge }: { badge: Badge }) {
  const [expanded, setExpanded] = useState(false)
  const company = badge.company_profiles

  return (
    <Animated.View
      entering={FadeInDown.duration(300)}
      className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3"
    >
      <View className="flex-row items-start gap-3 mb-3">
        {company?.logo_url ? (
          <Image
            source={{ uri: company.logo_url }}
            style={{ width: 48, height: 48, borderRadius: 12 }}
            contentFit="cover"
          />
        ) : (
          <View
            style={{
              width: 48, height: 48, borderRadius: 12,
              backgroundColor: '#1E1B2E',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Text style={{ color: '#475569', fontSize: 18, fontWeight: '700' }}>
              {company?.company_name?.charAt(0) ?? '?'}
            </Text>
          </View>
        )}

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-white font-semibold text-sm">{company?.company_name ?? 'Unknown company'}</Text>
            {company?.is_verified && (
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: '#22C55E' }} />
            )}
          </View>
          <Text className="text-slate-300 text-sm font-bold mt-0.5">{badge.role_held}</Text>
          <Text className="text-slate-500 text-xs mt-0.5">{formatBadgePeriod(badge.start_date, badge.end_date, badge.is_current)}</Text>
        </View>

        <View
          style={{
            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
            backgroundColor: badge.status === 'active' ? '#14532D20' : '#7F1D1D20',
          }}
        >
          <Text style={{ color: badge.status === 'active' ? '#22C55E' : '#EF4444', fontSize: 11, fontWeight: '600' }}>
            {badge.status === 'active' ? 'Active' : 'Revoked'}
          </Text>
        </View>
      </View>

      {badge.performance_rating !== null && (
        <View className="mb-2">
          <StarRating rating={badge.performance_rating} />
        </View>
      )}

      {badge.recommendation && (
        <Pressable onPress={() => setExpanded((v) => !v)} className="mb-3">
          <Text className="text-slate-400 text-sm leading-5" numberOfLines={expanded ? undefined : 2}>
            "{badge.recommendation}"
          </Text>
          {!expanded && (
            <Text style={{ color: '#FF6240', fontSize: 12, marginTop: 3 }}>Read more</Text>
          )}
        </Pressable>
      )}

      {badge.status === 'revoked' && badge.revocation_reason && (
        <View
          className="rounded-xl p-3 mb-3"
          style={{ backgroundColor: '#7F1D1D20', borderWidth: 1, borderColor: '#EF444430' }}
        >
          <Text style={{ color: '#EF4444', fontSize: 12 }}>Revoked: {badge.revocation_reason}</Text>
        </View>
      )}

      <View className="flex-row items-center justify-between pt-2" style={{ borderTopWidth: 1, borderTopColor: '#1E1B2E' }}>
        <View className="flex-row items-center gap-1">
          <ShieldIcon />
          <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '600' }}>Cryptographically verified</Text>
        </View>

        {badge.status === 'active' && (
          <Pressable
            onPress={() => router.push(`/(candidate)/disputes/${badge.id}` as Parameters<typeof router.push>[0])}
            style={{ borderWidth: 1, borderColor: '#FF6240', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}
            className="active:opacity-70"
          >
            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Dispute</Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

export default function BadgesScreen() {
  const user = useAuthStore((s) => s.user)

  const { data: badges = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['badges', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('*, company_profiles(id, company_name, logo_url, is_verified)')
        .eq('recipient_id', user!.id)
        .order('issued_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Badge[]
    },
    enabled: !!user?.id,
  })

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-5 pt-5 pb-2">
        <Text className="text-white text-2xl font-bold">My Badges</Text>
        {badges.length > 0 && (
          <View
            style={{ backgroundColor: '#FF624020', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 }}
          >
            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{badges.length}</Text>
          </View>
        )}
      </View>

      <FlatList
        data={badges}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
        ListHeaderComponent={
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="rounded-2xl p-4 mb-4"
            style={{ backgroundColor: '#0DD4C315', borderWidth: 1, borderColor: '#0DD4C330' }}
          >
            <View className="flex-row items-center gap-2 mb-1">
              <ShieldIcon />
              <Text style={{ color: '#0DD4C3', fontSize: 13, fontWeight: '700' }}>Badge Trust Boost</Text>
            </View>
            <Text className="text-slate-400 text-sm leading-5">
              Each verified badge adds up to <Text className="text-white font-semibold">+5 points</Text> to your trust score (max +25). Badges are cryptographically signed by employers.
            </Text>
          </Animated.View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-20 items-center">
              <Text className="text-slate-500 text-sm">Loading badges…</Text>
            </View>
          ) : (
            <View className="py-16 items-center px-6">
              <View
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
              >
                <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </Svg>
              </View>
              <Text className="text-white text-base font-semibold text-center mb-2">No badges yet</Text>
              <Text className="text-slate-400 text-sm text-center leading-5">
                Badges are issued by companies you've worked for as cryptographically verified employment records.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => <BadgeCard badge={item} />}
      />
    </SafeAreaView>
  )
}

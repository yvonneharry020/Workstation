import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ProfileView {
  id: string
  viewed_at: string
  viewer_id: string
}

interface CompanyInfo {
  id: string
  company_name: string
  logo_url: string | null
}

function timeAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (days === 0) {
    const hrs = Math.floor((Date.now() - new Date(d).getTime()) / 3_600_000)
    if (hrs === 0) return 'Just now'
    return `${hrs}h ago`
  }
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function EyeIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx="12" cy="12" r="3" />
    </Svg>
  )
}

function SettingsIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </Svg>
  )
}

export default function ProfileViewsScreen() {
  const user = useAuthStore((s) => s.user)

  const { data: candidateData } = useQuery({
    queryKey: ['candidate-settings', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_profiles')
        .select('show_profile_views')
        .eq('id', user!.id)
        .single()
      return data
    },
    enabled: !!user?.id,
  })

  const showViews = candidateData?.show_profile_views ?? true

  const { data: views = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['profile-views', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profile_views')
        .select('id, viewed_at, viewer_id')
        .eq('viewed_id', user!.id)
        .order('viewed_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data ?? []) as ProfileView[]
    },
    enabled: !!user?.id && showViews,
  })

  const viewerIds = [...new Set(views.map((v) => v.viewer_id))]

  const { data: companyMap = {} } = useQuery({
    queryKey: ['company-infos', viewerIds],
    queryFn: async () => {
      if (viewerIds.length === 0) return {}
      const { data } = await supabase
        .from('company_profiles')
        .select('id, company_name, logo_url')
        .in('id', viewerIds)
      const map: Record<string, CompanyInfo> = {}
      ;(data as unknown as CompanyInfo[] ?? []).forEach((c) => { map[c.id] = c })
      return map
    },
    enabled: viewerIds.length > 0,
  })

  const sevenDaysAgo = Date.now() - 7 * 86_400_000
  const viewsThisWeek = views.filter((v) => new Date(v.viewed_at).getTime() >= sevenDaysAgo).length

  if (!showViews) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <View className="px-5 pt-5 pb-4">
          <Text className="text-[#1A1625] text-3xl font-bold">Profile Views</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View
            style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
          >
            <EyeIcon />
          </View>
          <Text className="text-[#1A1625] text-base font-semibold text-center mb-2">Profile views are hidden</Text>
          <Text className="text-slate-400 text-sm text-center leading-5 mb-6">
            Turn on profile views to see which companies are interested in you.
          </Text>
          <Pressable
            onPress={() => router.push('/(candidate)/settings' as Parameters<typeof router.push>[0])}
            className="flex-row items-center gap-2 bg-surface-card border border-surface-border rounded-2xl px-5 py-4 active:opacity-80"
          >
            <SettingsIcon />
            <Text className="text-[#1A1625] text-sm font-semibold">Open privacy settings</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 pt-5 pb-2">
        <Text className="text-[#1A1625] text-2xl font-bold">Profile Views</Text>
      </View>

      <FlatList
        data={views}
        keyExtractor={(v) => v.id}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 8 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
        ListHeaderComponent={
          <Animated.View
            entering={FadeInDown.duration(400)}
            className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-4"
          >
            <Text className="text-slate-400 text-xs mb-1">Views this week</Text>
            <Text className="text-[#1A1625] text-3xl font-bold">{viewsThisWeek}</Text>
            <Text className="text-slate-500 text-xs mt-1">{views.length} total views</Text>
          </Animated.View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View className="py-20 items-center">
              <Text className="text-slate-500 text-sm">Loading…</Text>
            </View>
          ) : (
            <View className="py-16 items-center px-6">
              <View
                style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}
              >
                <EyeIcon />
              </View>
              <Text className="text-[#1A1625] text-base font-semibold text-center mb-2">No views yet</Text>
              <Text className="text-slate-400 text-sm text-center leading-5">
                Complete your profile and get verified to attract company attention.
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => {
          const company = companyMap[item.viewer_id]
          const companyName = company?.company_name ?? 'A verified company'
          const logoUrl = company?.logo_url ?? null
          const companyId = company?.id ?? null
          return (
            <Pressable
              onPress={() => companyId && router.push(`/(candidate)/company/${companyId}` as Parameters<typeof router.push>[0])}
              className="flex-row items-center gap-3 py-4 active:opacity-70"
              style={{ borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}
            >
              {logoUrl ? (
                <Image source={{ uri: logoUrl }} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: '#DDD6C9' }} contentFit="cover" />
              ) : (
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#0DD4C315', alignItems: 'center', justifyContent: 'center' }}>
                  <EyeIcon />
                </View>
              )}
              <View className="flex-1">
                <Text className="text-[#1A1625] text-sm font-medium" numberOfLines={1}>{companyName} viewed your profile</Text>
                <Text className="text-slate-500 text-xs mt-0.5">{new Date(item.viewed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
              </View>
              <Text className="text-slate-500 text-xs">{timeAgo(item.viewed_at)}</Text>
            </Pressable>
          )
        }}
      />
    </SafeAreaView>
  )
}

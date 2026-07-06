import { useState, useCallback, useRef } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useInfiniteQuery } from '@tanstack/react-query'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const PAGE_SIZE = 20

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  headline: string | null
  candidate_skills: { skills: { name: string } | null }[]
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function getSavedKey(userId: string) {
  return `saved_candidates_${userId}`
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={filled ? '#FF6240' : 'none'} stroke={filled ? '#FF6240' : '#64748B'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
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
  isSaved,
  onToggleSave,
}: {
  item: CandidateRow
  isSaved: boolean
  onToggleSave: (id: string) => void
}) {
  const name = `${item.first_name} ${item.last_name}`.trim() || 'Unknown'
  const avatarUrl = item.avatar_url
  const topSkills = item.candidate_skills
    .map((s) => s.skills?.name)
    .filter(Boolean)
    .slice(0, 3) as string[]

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        onPress={() => router.push({ pathname: '/(company)/candidates/[id]', params: { id: item.id } })}
        className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-3 mb-3">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24 }} contentFit="cover" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}

          <View className="flex-1">
            <Text className="text-[#1A1625] font-semibold text-base" numberOfLines={1}>{name}</Text>
            {item.headline && (
              <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={2}>{item.headline}</Text>
            )}
          </View>

          <Pressable
            onPress={() => onToggleSave(item.id)}
            hitSlop={10}
            className="active:opacity-70"
          >
            <StarIcon filled={isSaved} />
          </Pressable>
        </View>

        {topSkills.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5">
            {topSkills.map((skill) => (
              <View
                key={skill}
                style={{ backgroundColor: '#0DD4C310', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: '#0DD4C330' }}
              >
                <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '500' }}>{skill}</Text>
              </View>
            ))}
          </View>
        )}
      </Pressable>
    </Animated.View>
  )
}

export default function BrowseCandidatesScreen() {
  const user = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(text), 300)
  }, [])

  const loadSaved = useCallback(async () => {
    if (!user?.id) return
    try {
      const raw = await AsyncStorage.getItem(getSavedKey(user.id))
      const parsed = raw ? (JSON.parse(raw) as string[]) : []
      setSavedIds(new Set(parsed))
    } catch {
      setSavedIds(new Set())
    }
  }, [user?.id])

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage, refetch, isRefetching } =
    useInfiniteQuery({
      queryKey: ['browse-candidates', debouncedSearch],
      queryFn: async ({ pageParam }) => {
        const from = (pageParam as number) * PAGE_SIZE
        const to = from + PAGE_SIZE - 1
        let query = supabase
          .from('candidate_profiles')
          .select(`
            id, first_name, last_name, avatar_url, headline,
            candidate_skills ( skills ( name ) )
          `)
          .range(from, to)
          .order('id', { ascending: true })

        if (debouncedSearch) {
          query = query.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%`)
        }

        const { data: rows, error } = await query
        if (error) throw error
        await loadSaved()
        return rows as unknown as CandidateRow[]
      },
      initialPageParam: 0,
      getNextPageParam: (lastPage, allPages) =>
        lastPage.length === PAGE_SIZE ? allPages.length : undefined,
    })

  const candidates = data?.pages.flat() ?? []

  const toggleSave = useCallback(
    async (candidateId: string) => {
      if (!user?.id) return
      const key = getSavedKey(user.id)
      const next = new Set(savedIds)
      if (next.has(candidateId)) {
        next.delete(candidateId)
      } else {
        next.add(candidateId)
      }
      setSavedIds(next)
      try {
        await AsyncStorage.setItem(key, JSON.stringify([...next]))
      } catch {
        setSavedIds(savedIds)
      }
    },
    [user?.id, savedIds],
  )

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-3">
        <View className="flex-row items-center gap-3 mb-4">
          <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
            <ArrowLeftIcon />
          </Pressable>
          <Text className="flex-1 text-[#1A1625] text-xl font-bold">Browse Talent</Text>
        </View>

        <View className="flex-row items-center gap-2 bg-surface-card border border-surface-border rounded-xl px-3 py-2.5">
          <SearchIcon />
          <TextInput
            placeholder="Search by name or skill…"
            placeholderTextColor="#475569"
            value={search}
            onChangeText={handleSearchChange}
            style={{ flex: 1, fontSize: 14, color: '#1A1625' }}
          />
        </View>

        {!isLoading && (
          <Text className="text-slate-500 text-xs mt-2">
            {candidates.length}+ approved candidates
          </Text>
        )}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CandidateCard
              item={item}
              isSaved={savedIds.has(item.id)}
              onToggleSave={toggleSave}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />
          }
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) {
              void fetchNextPage()
            }
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View className="py-4 items-center">
                <ActivityIndicator color="#FF6240" size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View className="items-center py-16">
              <Text className="text-slate-400 font-semibold text-base mb-1">No candidates found</Text>
              <Text className="text-slate-500 text-sm">Try a different search term</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

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
  gender: string | null
  date_of_birth: string | null
}

interface SavedEntry {
  id: string
  tag: string
  savedAt: string
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function getSavedKey(userId: string) {
  return `saved_candidates_${userId}`
}

function getAge(dob: string): number {
  const birth = new Date(dob)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) age--
  return age
}

function genderLabel(gender: string | null): string {
  if (!gender) return ''
  if (gender.toLowerCase() === 'male') return 'M'
  if (gender.toLowerCase() === 'female') return 'F'
  return gender.slice(0, 1).toUpperCase()
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
    <Svg width={18} height={18} viewBox="0 0 24 24" fill={filled ? '#FF6240' : 'none'} stroke={filled ? '#FF6240' : '#94A3B8'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function BookmarkIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
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
  const gl = genderLabel(item.gender)
  const age = item.date_of_birth ? getAge(item.date_of_birth) : null
  const metaLine = [gl, age].filter(Boolean).join(' | ')

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        onPress={() => router.push({ pathname: '/(company)/candidates/[id]', params: { id: item.id } })}
        style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 18, padding: 16, marginBottom: 12 }}
        className="active:opacity-80"
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
          ) : (
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FF6240', fontSize: 16, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }} numberOfLines={1}>{name}</Text>
            {metaLine ? (
              <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{metaLine}</Text>
            ) : null}
            {item.headline ? (
              <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 3 }} numberOfLines={2}>{item.headline}</Text>
            ) : null}
          </View>

          <Pressable onPress={() => onToggleSave(item.id)} hitSlop={12} className="active:opacity-70">
            <StarIcon filled={isSaved} />
          </Pressable>
        </View>
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
      if (!raw) { setSavedIds(new Set()); return }
      const parsed = JSON.parse(raw)
      const entries: SavedEntry[] = Array.isArray(parsed) && typeof parsed[0] === 'string'
        ? (parsed as string[]).map(id => ({ id, tag: '', savedAt: new Date().toISOString() }))
        : (parsed as SavedEntry[])
      setSavedIds(new Set(entries.map(e => e.id)))
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

        let idFilter: string[] | null = null
        if (debouncedSearch.trim()) {
          const s = debouncedSearch.trim()
          const { data: emailMatches } = await supabase
            .from('profiles')
            .select('id')
            .ilike('email', `%${s}%`)
            .eq('role', 'candidate')
          idFilter = (emailMatches ?? []).map((p: { id: string }) => p.id)
        }

        let query = supabase
          .from('candidate_profiles')
          .select('id, first_name, last_name, avatar_url, headline, gender, date_of_birth')
          .range(from, to)
          .order('id', { ascending: true })

        if (debouncedSearch.trim()) {
          const s = debouncedSearch.trim()
          const nameFilter = `first_name.ilike.%${s}%,last_name.ilike.%${s}%`
          if (idFilter && idFilter.length > 0) {
            query = query.or(`${nameFilter},id.in.(${idFilter.join(',')})`)
          } else {
            query = query.or(nameFilter)
          }
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
      try {
        const raw = await AsyncStorage.getItem(key)
        let entries: SavedEntry[] = []
        if (raw) {
          const parsed = JSON.parse(raw)
          entries = Array.isArray(parsed) && typeof parsed[0] === 'string'
            ? (parsed as string[]).map(id => ({ id, tag: '', savedAt: new Date().toISOString() }))
            : (parsed as SavedEntry[])
        }
        const isSaved = entries.some(e => e.id === candidateId)
        const updated = isSaved
          ? entries.filter(e => e.id !== candidateId)
          : [...entries, { id: candidateId, tag: '', savedAt: new Date().toISOString() }]
        await AsyncStorage.setItem(key, JSON.stringify(updated))
        setSavedIds(new Set(updated.map(e => e.id)))
      } catch {
        // revert nothing — UI already updated optimistically in query
      }
    },
    [user?.id],
  )

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
            <ArrowLeftIcon />
          </Pressable>
          <Text style={{ flex: 1, color: '#1A1625', fontSize: 20, fontWeight: '800' }}>Browse Talent</Text>
          <Pressable
            onPress={() => router.push('/(company)/candidates/saved' as any)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FF624015', borderRadius: 10, borderWidth: 1, borderColor: '#FF624030', paddingHorizontal: 12, paddingVertical: 7 }}
            className="active:opacity-70"
          >
            <BookmarkIcon />
            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>Saved</Text>
          </Pressable>
        </View>

        {/* Search bar */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', paddingHorizontal: 12, paddingVertical: 10 }}>
          <SearchIcon />
          <TextInput
            placeholder="Search by name or email…"
            placeholderTextColor="#94A3B8"
            value={search}
            onChangeText={handleSearchChange}
            style={{ flex: 1, fontSize: 14, color: '#1A1625' }}
          />
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
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
            if (hasNextPage && !isFetchingNextPage) void fetchNextPage()
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                <ActivityIndicator color="#FF6240" size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingVertical: 60 }}>
              <Text style={{ color: '#475569', fontWeight: '600', fontSize: 15, marginBottom: 6 }}>No candidates found</Text>
              <Text style={{ color: '#64748B', fontSize: 13 }}>Try a different name or email</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

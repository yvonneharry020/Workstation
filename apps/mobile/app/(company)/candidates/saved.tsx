import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface SavedEntry {
  id: string
  tag: string
  savedAt: string
}

interface CandidateRow {
  id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  headline: string | null
  candidate_skills: { skills: { name: string } | null }[]
}

function getSavedKey(userId: string) {
  return `saved_candidates_${userId}`
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

function BookmarkIcon() {
  return (
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

function TagIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" />
      <Circle cx={7} cy={7} r={1.5} fill="#64748B" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function CandidateCard({
  candidateId,
  entry,
  candidate,
  onRemove,
  onEditTag,
}: {
  candidateId: string
  entry: SavedEntry
  candidate: CandidateRow | undefined
  onRemove: (id: string) => void
  onEditTag: (id: string, currentTag: string) => void
}) {
  const name = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : '…'
  const avatarUrl = candidate?.avatar_url
  const headline = candidate?.headline
  const topSkills = candidate?.candidate_skills
    .map((s) => s.skills?.name)
    .filter(Boolean)
    .slice(0, 3) as string[]

  return (
    <Animated.View entering={FadeInDown.duration(300)}>
      <Pressable
        onPress={() => router.push({ pathname: '/(company)/candidates/[id]', params: { id: candidateId } })}
        onLongPress={() =>
          Alert.alert('Remove candidate?', name, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Remove', style: 'destructive', onPress: () => onRemove(candidateId) },
          ])
        }
        className="bg-surface-card border border-surface-border rounded-2xl p-4 mb-3 active:opacity-80"
      >
        <View className="flex-row items-center gap-3 mb-2">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 44, height: 44, borderRadius: 22 }} contentFit="cover" />
          ) : (
            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}

          <View className="flex-1">
            <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1}>{name}</Text>
            {headline && <Text className="text-slate-400 text-xs mt-0.5" numberOfLines={1}>{headline}</Text>}
          </View>

          <Pressable
            onPress={() => onRemove(candidateId)}
            hitSlop={10}
            className="active:opacity-70"
          >
            <XIcon />
          </Pressable>
        </View>

        {topSkills.length > 0 && (
          <View className="flex-row flex-wrap gap-1.5 mb-2">
            {topSkills.map((skill) => (
              <View
                key={skill}
                style={{ backgroundColor: '#0DD4C310', borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: '#0DD4C330' }}
              >
                <Text style={{ color: '#0DD4C3', fontSize: 10, fontWeight: '500' }}>{skill}</Text>
              </View>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => onEditTag(candidateId, entry.tag)}
          className="flex-row items-center gap-1.5 active:opacity-70"
        >
          <TagIcon />
          <Text style={{ color: entry.tag ? '#5A4F6E' : '#475569', fontSize: 12 }}>
            {entry.tag || 'Add tag…'}
          </Text>
        </Pressable>
      </Pressable>
    </Animated.View>
  )
}

export default function SavedCandidatesScreen() {
  const user = useAuthStore((s) => s.user)
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([])
  const [storageLoaded, setStorageLoaded] = useState(false)
  const [tagModalVisible, setTagModalVisible] = useState(false)
  const [tagTargetId, setTagTargetId] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')

  const loadFromStorage = useCallback(async () => {
    if (!user?.id) return
    try {
      const raw = await AsyncStorage.getItem(getSavedKey(user.id))
      const entries: SavedEntry[] = raw ? JSON.parse(raw) : []
      setSavedEntries(entries)
    } catch {
      setSavedEntries([])
    } finally {
      setStorageLoaded(true)
    }
  }, [user?.id])

  useEffect(() => {
    void loadFromStorage()
  }, [loadFromStorage])

  const saveToStorage = async (entries: SavedEntry[]) => {
    if (!user?.id) return
    try {
      await AsyncStorage.setItem(getSavedKey(user.id), JSON.stringify(entries))
    } catch {}
  }

  const savedIds = savedEntries.map((e) => e.id)

  const { data: candidateMap, isLoading: loadingCandidates } = useQuery({
    queryKey: ['saved-candidates-data', savedIds.join(',')],
    queryFn: async () => {
      if (savedIds.length === 0) return new Map<string, CandidateRow>()
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select(`
          id, first_name, last_name, avatar_url, headline,
          candidate_skills ( skills ( name ) )
        `)
        .in('id', savedIds)
      if (error) throw error
      const rows = data as unknown as CandidateRow[]
      return new Map(rows.map((r) => [r.id, r]))
    },
    enabled: storageLoaded && savedIds.length > 0,
  })

  const handleRemove = async (candidateId: string) => {
    const updated = savedEntries.filter((e) => e.id !== candidateId)
    setSavedEntries(updated)
    await saveToStorage(updated)
  }

  const openTagModal = (candidateId: string, currentTag: string) => {
    setTagTargetId(candidateId)
    setTagInput(currentTag)
    setTagModalVisible(true)
  }

  const handleSaveTag = async () => {
    if (!tagTargetId) return
    const updated = savedEntries.map((e) =>
      e.id === tagTargetId ? { ...e, tag: tagInput.trim() } : e,
    )
    setSavedEntries(updated)
    await saveToStorage(updated)
    setTagModalVisible(false)
    setTagTargetId(null)
    setTagInput('')
  }

  const isLoading = !storageLoaded || (savedIds.length > 0 && loadingCandidates)

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="px-5 pt-4 pb-3 flex-row items-center gap-3">
        <Pressable onPress={() => router.back()} hitSlop={10} className="active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[#1A1625] text-xl font-bold">Saved Candidates</Text>
          {!isLoading && (
            <Text className="text-slate-400 text-xs">
              {savedEntries.length} candidate{savedEntries.length !== 1 ? 's' : ''} saved
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : savedEntries.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <BookmarkIcon />
          <Text className="text-slate-400 font-semibold text-lg mt-4 mb-2">No saved candidates</Text>
          <Text className="text-slate-500 text-sm text-center mb-6">
            Tap the star icon on any candidate in the Browse tab to save them here.
          </Text>
          <Pressable
            onPress={() => router.push('/(company)/candidates/browse')}
            style={{ backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
            className="active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-sm">Browse Talent</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={savedEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CandidateCard
              candidateId={item.id}
              entry={item}
              candidate={candidateMap?.get(item.id)}
              onRemove={handleRemove}
              onEditTag={openTagModal}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={tagModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000000AA', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: '#EDE7DB', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 }}>
            <Text className="text-[#1A1625] font-bold text-lg mb-4">Add tag</Text>
            <TextInput
              placeholder="e.g. Strong frontend, Follow up next week…"
              placeholderTextColor="#475569"
              value={tagInput}
              onChangeText={setTagInput}
              autoFocus
              style={{ backgroundColor: '#F5F0E8', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
            />
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setTagModalVisible(false)}
                style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                className="active:opacity-70"
              >
                <Text className="text-slate-300 font-semibold">Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveTag}
                style={{ flex: 1, backgroundColor: '#FF6240', borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}
                className="active:opacity-80"
              >
                <Text className="text-[#1A1625] font-semibold">Save tag</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

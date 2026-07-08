import { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const NIGERIAN_STATES: Record<number, string> = {
  1: 'Abia', 2: 'Adamawa', 3: 'Akwa Ibom', 4: 'Anambra', 5: 'Bauchi',
  6: 'Bayelsa', 7: 'Benue', 8: 'Borno', 9: 'Cross River', 10: 'Delta',
  11: 'Ebonyi', 12: 'Edo', 13: 'Ekiti', 14: 'Enugu', 15: 'FCT',
  16: 'Gombe', 17: 'Imo', 18: 'Jigawa', 19: 'Kaduna', 20: 'Kano',
  21: 'Katsina', 22: 'Kebbi', 23: 'Kogi', 24: 'Kwara', 25: 'Lagos',
  26: 'Nasarawa', 27: 'Niger', 28: 'Ogun', 29: 'Ondo', 30: 'Osun',
  31: 'Oyo', 32: 'Plateau', 33: 'Rivers', 34: 'Sokoto', 35: 'Taraba',
  36: 'Yobe', 37: 'Zamfara',
}

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
  gender: string | null
  date_of_birth: string | null
  state_of_origin_id: number | null
}

function getSavedKey(userId: string) {
  return `saved_candidates_${userId}`
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function getAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
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
    <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
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
  candidate,
  onRemove,
}: {
  candidateId: string
  candidate: CandidateRow | undefined
  onRemove: (id: string) => void
}) {
  const name = candidate ? `${candidate.first_name} ${candidate.last_name}`.trim() : '…'
  const avatarUrl = candidate?.avatar_url
  const headline = candidate?.headline
  const gender = candidate?.gender
  const dob = candidate?.date_of_birth
  const stateId = candidate?.state_of_origin_id

  const gLetter = gender === 'male' ? 'M' : gender === 'female' ? 'F' : null
  const age = dob ? getAge(dob) : null
  const location = stateId ? NIGERIAN_STATES[stateId] : null
  const nameTag = gLetter && age ? `(${gLetter}|${age})` : gLetter ? `(${gLetter})` : age ? `(${age})` : null

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
        style={({ pressed }) => ({
          backgroundColor: '#FFFFFF',
          borderRadius: 18,
          borderWidth: 1,
          borderColor: '#E5DFD3',
          padding: 16,
          marginBottom: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={{ width: 48, height: 48, borderRadius: 24, flexShrink: 0 }} contentFit="cover" />
          ) : (
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '700' }}>{getInitials(name)}</Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
              <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }} numberOfLines={1}>{name}</Text>
              {nameTag ? <Text style={{ color: '#64748B', fontSize: 12 }}>{nameTag}</Text> : null}
            </View>
            {headline ? <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 2 }} numberOfLines={1}>{headline}</Text> : null}
            {location ? <Text style={{ color: '#94A3B8', fontSize: 11 }}>{location}</Text> : null}
          </View>

          <Pressable
            onPress={() => onRemove(candidateId)}
            hitSlop={10}
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <XIcon />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  )
}

export default function SavedCandidatesScreen() {
  const user = useAuthStore((s) => s.user)
  const [savedEntries, setSavedEntries] = useState<SavedEntry[]>([])
  const [storageLoaded, setStorageLoaded] = useState(false)

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
        .select('id, first_name, last_name, avatar_url, headline, gender, date_of_birth, state_of_origin_id')
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

  const isLoading = !storageLoaded || (savedIds.length > 0 && loadingCandidates)

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
      <View style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}>
          <ArrowLeftIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700' }}>Saved Candidates</Text>
          {!isLoading && (
            <Text style={{ color: '#94A3B8', fontSize: 12 }}>
              {savedEntries.length} candidate{savedEntries.length !== 1 ? 's' : ''} saved
            </Text>
          )}
        </View>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : savedEntries.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <BookmarkIcon />
          <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 18, marginTop: 16, marginBottom: 8 }}>No saved candidates</Text>
          <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 24 }}>
            Tap the star icon on any candidate in the Browse tab to save them here.
          </Text>
          <Pressable
            onPress={() => router.push('/(company)/candidates/browse')}
            style={{ backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 12 }}
          >
            <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 14 }}>Browse Talent</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={savedEntries}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CandidateCard
              candidateId={item.id}
              candidate={candidateMap?.get(item.id)}
              onRemove={handleRemove}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  )
}

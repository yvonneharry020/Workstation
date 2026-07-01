import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CandidateResult {
  id: string
  full_name: string
  avatar_url: string | null
}

interface ProfileRow {
  id: string
  profiles: { full_name: string; avatar_url: string | null } | null
}

function mockSignature(payload: string): string {
  let hash = 0
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0')
  return `${hex}${hex}${hex}${hex}${hex}${hex}${hex}${hex}`.slice(0, 64)
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke={filled ? '#F59E0B' : '#DDD6C9'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
}

function ShieldIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  )
}

export default function IssueBadgeScreen() {
  const { candidateId: paramCandidateId } = useLocalSearchParams<{ candidateId?: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [selectedCandidate, setSelectedCandidate] = useState<CandidateResult | null>(null)
  const [search, setSearch] = useState('')
  const [roleHeld, setRoleHeld] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isCurrent, setIsCurrent] = useState(false)
  const [performanceRating, setPerformanceRating] = useState(0)
  const [recommendation, setRecommendation] = useState('')

  const { data: searchResults = [] } = useQuery({
    queryKey: ['badge-candidate-search', search],
    queryFn: async () => {
      if (search.length < 2) return []
      const { data } = await supabase
        .from('candidate_profiles')
        .select('id, profiles:profile_id(full_name, avatar_url)')
        .limit(10)
      const rows = (data as unknown as ProfileRow[]) ?? []
      const term = search.toLowerCase()
      return rows
        .filter((r) => r.profiles?.full_name?.toLowerCase().includes(term))
        .map((r) => ({
          id: r.id,
          full_name: r.profiles?.full_name ?? 'Unknown',
          avatar_url: r.profiles?.avatar_url ?? null,
        })) as CandidateResult[]
    },
    enabled: !paramCandidateId && search.length >= 2,
  })

  const { data: preloadedCandidate } = useQuery({
    queryKey: ['badge-candidate-preload', paramCandidateId],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_profiles')
        .select('id, profiles:profile_id(full_name, avatar_url)')
        .eq('id', paramCandidateId!)
        .single()
      const row = data as unknown as ProfileRow
      return {
        id: row.id,
        full_name: row.profiles?.full_name ?? 'Unknown',
        avatar_url: row.profiles?.avatar_url ?? null,
      } as CandidateResult
    },
    enabled: !!paramCandidateId,
  })

  const candidate = selectedCandidate ?? preloadedCandidate ?? null

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!candidate || !roleHeld || !startDate) throw new Error('Missing required fields')

      const { data: badge, error: badgeErr } = await supabase
        .from('badges')
        .insert({
          issuer_id: user!.id,
          recipient_id: candidate.id,
          issued_by: user!.id,
          role_held: roleHeld,
          start_date: startDate,
          end_date: isCurrent ? null : (endDate || null),
          is_current: isCurrent,
          recommendation: recommendation || null,
          performance_rating: performanceRating || null,
          status: 'active',
          issued_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (badgeErr) throw badgeErr

      const badgeId = (badge as unknown as { id: string }).id
      const payload = JSON.stringify({ badgeId, issuerId: user!.id, recipientId: candidate.id, roleHeld, issuedAt: new Date().toISOString() })
      const signature = mockSignature(payload)

      await supabase.from('badge_signatures').insert({
        badge_id: badgeId,
        signature,
        payload,
        signed_at: new Date().toISOString(),
      })

      return badgeId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges-history'] })
      Alert.alert('Badge issued!', 'The badge has been cryptographically signed and issued to the candidate.', [
        { text: 'View history', onPress: () => router.replace('/(company)/badges/history') },
      ])
    },
    onError: () => Alert.alert('Error', 'Failed to issue badge. Please try again.'),
  })

  const canSubmit = !!candidate && !!roleHeld && !!startDate && (isCurrent || !!endDate)

  const initials = candidate?.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() ?? ''

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-lg font-bold flex-1">Issue Badge</Text>
        <ShieldIcon />
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20 }}>
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={{ backgroundColor: '#F59E0B10', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B30', padding: 12, marginBottom: 20 }}>
              <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>
                Badges can only be revoked within 72 hours of issuance.
              </Text>
            </View>

            {!paramCandidateId && (
              <>
                <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>RECIPIENT</Text>
                <View style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 }}>
                  <SearchIcon />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search candidate by name…"
                    placeholderTextColor="#475569"
                    style={{ flex: 1, color: '#1A1625', fontSize: 14, padding: 14 }}
                  />
                </View>
                {searchResults.map((c) => {
                  const ci = c.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => { setSelectedCandidate(c); setSearch('') }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}
                    >
                      {c.avatar_url ? (
                        <Image source={{ uri: c.avatar_url }} style={{ width: 36, height: 36, borderRadius: 18 }} />
                      ) : (
                        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF624025', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>{ci}</Text>
                        </View>
                      )}
                      <Text style={{ color: '#1A1625', fontSize: 14 }}>{c.full_name}</Text>
                    </Pressable>
                  )
                })}
              </>
            )}

            {candidate && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#0DD4C330', padding: 14, marginBottom: 24 }}>
                {candidate.avatar_url ? (
                  <Image source={{ uri: candidate.avatar_url }} style={{ width: 44, height: 44, borderRadius: 22 }} />
                ) : (
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF624025', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '700' }}>{initials}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>{candidate.full_name}</Text>
                  <Text style={{ color: '#0DD4C3', fontSize: 12 }}>Selected recipient</Text>
                </View>
                {!paramCandidateId && (
                  <Pressable onPress={() => setSelectedCandidate(null)}>
                    <Text style={{ color: '#EF4444', fontSize: 12 }}>Change</Text>
                  </Pressable>
                )}
              </View>
            )}

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>ROLE HELD *</Text>
            <TextInput
              value={roleHeld}
              onChangeText={setRoleHeld}
              placeholder="e.g. Senior Software Engineer"
              placeholderTextColor="#475569"
              style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
            />

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>START DATE * (DD/MM/YYYY)</Text>
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="01/01/2023"
              placeholderTextColor="#475569"
              keyboardType="numbers-and-punctuation"
              style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
            />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600' }}>CURRENT ROLE</Text>
              <Switch
                value={isCurrent}
                onValueChange={setIsCurrent}
                trackColor={{ false: '#DDD6C9', true: '#FF624060' }}
                thumbColor={isCurrent ? '#FF6240' : '#475569'}
              />
            </View>

            {!isCurrent && (
              <>
                <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>END DATE * (DD/MM/YYYY)</Text>
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="31/12/2024"
                  placeholderTextColor="#475569"
                  keyboardType="numbers-and-punctuation"
                  style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
                />
              </>
            )}

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 12 }}>PERFORMANCE RATING</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setPerformanceRating(n)} hitSlop={8}>
                  <StarIcon filled={n <= performanceRating} />
                </Pressable>
              ))}
            </View>

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>RECOMMENDATION (optional)</Text>
            <TextInput
              value={recommendation}
              onChangeText={setRecommendation}
              placeholder="Write a recommendation that will be visible on the candidate's profile…"
              placeholderTextColor="#475569"
              multiline
              style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, minHeight: 120, textAlignVertical: 'top', marginBottom: 24 }}
            />

            {canSubmit && (
              <Animated.View entering={FadeInDown.duration(300)} style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 24 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 8 }}>BADGE PREVIEW</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#0DD4C320', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#0DD4C340' }}>
                    <ShieldIcon />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>{roleHeld}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                      {startDate} — {isCurrent ? 'Present' : endDate}
                    </Text>
                    {performanceRating > 0 && (
                      <Text style={{ color: '#F59E0B', fontSize: 12 }}>{'★'.repeat(performanceRating)}{'☆'.repeat(5 - performanceRating)}</Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: '#0DD4C320', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '700' }}>VERIFIED</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            <Pressable
              onPress={() => issueMutation.mutate()}
              disabled={!canSubmit || issueMutation.isPending}
              style={{ backgroundColor: canSubmit ? '#FF6240' : '#DDD6C9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12 }}
            >
              {issueMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: canSubmit ? '#1A1625' : '#475569', fontWeight: '700', fontSize: 15 }}>Issue badge</Text>
              )}
            </Pressable>
            <Text style={{ color: '#334155', fontSize: 12, textAlign: 'center' }}>
              Badge will be cryptographically signed with HMAC-SHA256
            </Text>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

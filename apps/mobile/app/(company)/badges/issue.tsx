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
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Badge } from '@/components/ui/Badge'

interface CandidateResult {
  id: string
  full_name: string
  email: string | null
  avatar_url: string | null
}

interface WorkHistoryEntry {
  id: string
  company_name: string
  role_title: string
  start_date: string
  end_date: string | null
  is_current: boolean
}

type Step = 'search' | 'pickJob' | 'confirm'

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

function SearchIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="M21 21l-4.35-4.35" />
    </Svg>
  )
}

function CheckCircle() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#9A8FA6" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 10V7a6 6 0 1 1 12 0v3" />
      <Path d="M5 10h14v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V10z" />
    </Svg>
  )
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
}

export default function IssueBadgeScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>('search')
  const [search, setSearch] = useState('')
  const [candidate, setCandidate] = useState<CandidateResult | null>(null)
  const [selectedEntry, setSelectedEntry] = useState<WorkHistoryEntry | null>(null)
  const [performanceRating, setPerformanceRating] = useState(0)
  const [recommendation, setRecommendation] = useState('')

  // The company's own registered name — every job-entry match check below
  // compares against this, both for display (greying out non-matches) and
  // as the same rule RLS enforces server-side.
  const { data: myCompanyName } = useQuery({
    queryKey: ['my-company-name', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('company_profiles').select('company_name').eq('id', user!.id).maybeSingle()
      return (data as { company_name: string } | null)?.company_name ?? ''
    },
    enabled: !!user?.id,
  })

  const { data: searchResults = [] } = useQuery({
    queryKey: ['badge-candidate-search', search],
    queryFn: async () => {
      const term = search.trim()
      if (term.length < 2) return []

      // Same two-step pattern as candidates/browse.tsx — candidate_profiles
      // and profiles aren't FK-chained for PostgREST to embed directly, so
      // email matches are resolved as a separate id lookup first.
      const { data: emailMatches } = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('email', `%${term}%`)
        .eq('role', 'candidate')
      const emailIds = (emailMatches ?? []).map((p: { id: string }) => p.id)
      const emailById = new Map((emailMatches ?? []).map((p: { id: string; email: string }) => [p.id, p.email]))

      const nameFilter = `first_name.ilike.%${term}%,last_name.ilike.%${term}%`
      const orFilter = emailIds.length > 0 ? `${nameFilter},id.in.(${emailIds.join(',')})` : nameFilter

      const { data } = await supabase
        .from('candidate_profiles')
        .select('id, first_name, last_name, avatar_url')
        .or(orFilter)
        .limit(15)

      const rows = (data as unknown as { id: string; first_name: string; last_name: string; avatar_url: string | null }[]) ?? []
      return rows.map((r) => ({
        id: r.id,
        full_name: `${r.first_name} ${r.last_name}`.trim(),
        email: emailById.get(r.id) ?? null,
        avatar_url: r.avatar_url,
      })) as CandidateResult[]
    },
    enabled: search.length >= 2,
  })

  const { data: workHistory = [], isLoading: loadingHistory } = useQuery({
    queryKey: ['badge-candidate-work-history', candidate?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_work_history')
        .select('id, company_name, role_title, start_date, end_date, is_current')
        .eq('candidate_id', candidate!.id)
        .order('sort_order', { ascending: true })
      return (data as WorkHistoryEntry[]) ?? []
    },
    enabled: !!candidate?.id && step === 'pickJob',
  })

  const issueMutation = useMutation({
    mutationFn: async () => {
      if (!candidate || !selectedEntry) throw new Error('Missing required fields')

      const { data: companyId, error: idErr } = await supabase.rpc('get_my_company_id')
      if (idErr || !companyId) throw idErr ?? new Error('Could not resolve your company account')

      const { data: badge, error: badgeErr } = await supabase
        .from('badges')
        .insert({
          issuer_id: companyId,
          recipient_id: candidate.id,
          issued_by: user!.id,
          badge_type: 'company',
          work_history_id: selectedEntry.id,
          role_held: selectedEntry.role_title,
          start_date: selectedEntry.start_date,
          end_date: selectedEntry.is_current ? null : selectedEntry.end_date,
          is_current: selectedEntry.is_current,
          recommendation: recommendation || null,
          performance_rating: performanceRating || null,
          status: 'active',
          issued_at: new Date().toISOString(),
        })
        .select('id')
        .single()
      if (badgeErr) throw badgeErr

      const badgeId = (badge as unknown as { id: string }).id

      // Real HMAC-SHA256 signing happens server-side — the signing key is
      // never sent to or computable by the client. This also re-derives the
      // payload from the actual badges row rather than trusting client state.
      const { error: signErr } = await supabase.rpc('sign_badge', { p_badge_id: badgeId })
      if (signErr) throw signErr

      return badgeId
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['badges-history'] })
      Alert.alert('Badge issued!', 'The badge has been cryptographically signed and issued to the candidate.', [
        { text: 'View history', onPress: () => router.replace('/(company)/badges/history') },
      ])
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : 'Failed to issue badge. Please try again.'
      Alert.alert('Error', message)
    },
  })

  const initials = candidate?.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase() ?? ''
  const normalizedMyName = (myCompanyName ?? '').trim().toLowerCase()

  const isMatchingEntry = (entry: WorkHistoryEntry) => entry.company_name.trim().toLowerCase() === normalizedMyName

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable
          onPress={() => {
            if (step === 'confirm') setStep('pickJob')
            else if (step === 'pickJob') { setStep('search'); setCandidate(null); setSelectedEntry(null) }
            else router.back()
          }}
          className="mr-3 active:opacity-70"
        >
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-2xl font-bold flex-1">Issue Badge</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20 }}>

          {step === 'search' && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>SEARCH CANDIDATE</Text>
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, marginBottom: 8 }}>
                <SearchIcon />
                <TextInput
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search by name or email…"
                  placeholderTextColor="#475569"
                  autoCapitalize="none"
                  style={{ flex: 1, color: '#1A1625', fontSize: 14, padding: 14 }}
                />
              </View>
              {searchResults.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => { setCandidate(c); setSelectedEntry(null); setSearch(''); setStep('pickJob') }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}
                >
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FF624025', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>
                      {c.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                    </Text>
                  </View>
                  <View>
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }}>{c.full_name}</Text>
                    {c.email && <Text style={{ color: '#64748B', fontSize: 12 }}>{c.email}</Text>}
                  </View>
                </Pressable>
              ))}
              {search.length >= 2 && searchResults.length === 0 && (
                <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>No candidates found.</Text>
              )}
            </Animated.View>
          )}

          {step === 'pickJob' && candidate && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 20 }}>
                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF624025', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FF6240', fontSize: 15, fontWeight: '700' }}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>{candidate.full_name}</Text>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>{candidate.email}</Text>
                </View>
              </View>

              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                SELECT THE JOB THIS BADGE IS FOR
              </Text>
              <Text style={{ color: '#9A8FA6', fontSize: 12, marginBottom: 14, lineHeight: 17 }}>
                Only jobs this candidate listed as being at {myCompanyName || 'your company'} can be selected — this
                confirms you actually employed them for this role.
              </Text>

              {loadingHistory ? (
                <ActivityIndicator color="#FF6240" style={{ marginVertical: 24 }} />
              ) : workHistory.length === 0 ? (
                <Text style={{ color: '#9A8FA6', fontSize: 13, textAlign: 'center', paddingVertical: 24 }}>
                  This candidate hasn't listed any work experience yet.
                </Text>
              ) : (
                workHistory.map((entry) => {
                  const matches = isMatchingEntry(entry)
                  return (
                    <Pressable
                      key={entry.id}
                      disabled={!matches}
                      onPress={() => { setSelectedEntry(entry); setStep('confirm') }}
                      style={{
                        backgroundColor: matches ? '#FFFFFF' : '#EDE7DB80',
                        borderRadius: 14,
                        borderWidth: 1.5,
                        borderColor: matches ? '#0DD4C350' : '#DDD6C9',
                        padding: 14,
                        marginBottom: 10,
                        opacity: matches ? 1 : 0.6,
                      }}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>{entry.role_title}</Text>
                          <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 2 }}>{entry.company_name}</Text>
                          <Text style={{ color: '#9A8FA6', fontSize: 11, marginTop: 4 }}>
                            {formatDate(entry.start_date)} – {entry.is_current ? 'Present' : entry.end_date ? formatDate(entry.end_date) : '?'}
                          </Text>
                        </View>
                        {matches ? <CheckCircle /> : <LockIcon />}
                      </View>
                      {!matches && (
                        <Text style={{ color: '#9A8FA6', fontSize: 11, marginTop: 8, fontStyle: 'italic' }}>
                          Not listed as your company
                        </Text>
                      )}
                    </Pressable>
                  )
                })
              )}
            </Animated.View>
          )}

          {step === 'confirm' && candidate && selectedEntry && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <View style={{ backgroundColor: '#F59E0B10', borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B30', padding: 12, marginBottom: 20 }}>
                <Text style={{ color: '#F59E0B', fontSize: 12, fontWeight: '600' }}>
                  Badges can only be revoked within 72 hours of issuance.
                </Text>
              </View>

              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 24 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>ISSUING TO</Text>
                <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700' }}>{candidate.full_name}</Text>
                <View style={{ height: 1, backgroundColor: '#DDD6C9', marginVertical: 12 }} />
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>FOR THE ROLE OF</Text>
                <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700' }}>{selectedEntry.role_title}</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                  {selectedEntry.company_name} · {formatDate(selectedEntry.start_date)} – {selectedEntry.is_current ? 'Present' : selectedEntry.end_date ? formatDate(selectedEntry.end_date) : '?'}
                </Text>
              </View>

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

              <Animated.View entering={FadeInDown.duration(300)} style={{ alignItems: 'center', backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 24 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 10 }}>BADGE PREVIEW</Text>
                <Badge tone="silver" size="md" />
              </Animated.View>

              <Pressable
                onPress={() => issueMutation.mutate()}
                disabled={issueMutation.isPending}
                style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginBottom: 12, opacity: issueMutation.isPending ? 0.7 : 1 }}
              >
                {issueMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Issue badge</Text>
                )}
              </Pressable>
              <Text style={{ color: '#334155', fontSize: 12, textAlign: 'center' }}>
                Badge will be cryptographically signed with HMAC-SHA256
              </Text>
            </Animated.View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

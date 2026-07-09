import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useState, useCallback } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const NIGERIAN_STATES: Record<number, string> = {
  1: 'Abia', 2: 'Adamawa', 3: 'Akwa Ibom', 4: 'Anambra', 5: 'Bauchi',
  6: 'Bayelsa', 7: 'Benue', 8: 'Borno', 9: 'Cross River', 10: 'Delta',
  11: 'Ebonyi', 12: 'Edo', 13: 'Ekiti', 14: 'Enugu', 15: 'Federal Capital Territory',
  16: 'Gombe', 17: 'Imo', 18: 'Jigawa', 19: 'Kaduna', 20: 'Kano',
  21: 'Katsina', 22: 'Kebbi', 23: 'Kogi', 24: 'Kwara', 25: 'Lagos',
  26: 'Nasarawa', 27: 'Niger', 28: 'Ogun', 29: 'Ondo', 30: 'Osun',
  31: 'Oyo', 32: 'Plateau', 33: 'Rivers', 34: 'Sokoto', 35: 'Taraba',
  36: 'Yobe', 37: 'Zamfara',
}

interface CandidateData {
  id: string
  first_name: string
  last_name: string
  headline: string | null
  bio: string | null
  avatar_url: string | null
  github_url: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  profile_completion: number
  is_open_to_work: boolean
  nin_verified: boolean
  phone_verified: boolean
  liveness_verified: boolean
  preferred_work_mode: string | null
  date_of_birth: string | null
  state_of_origin_id: number | null
  updated_at: string
}

interface WorkHistory {
  id: string
  role_title: string
  company_name: string
  start_date: string
  end_date: string | null
  is_current: boolean
  description: string | null
}

interface Education {
  id: string
  institution: string
  degree: string
  field_of_study: string | null
  start_year: number | null
  end_year: number | null
}

interface Skill {
  id: string
  skills: { name: string; category: string | null } | null
}

interface BadgeSummary {
  id: string
  role_held: string
  issued_at: string
  company_profiles: { company_name: string; logo_url: string | null; is_verified: boolean } | null
}

interface GalleryImage {
  id: string
  image_url: string
  sort_order: number
}

const TRUST_LEVEL_COLORS: Record<string, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: '#FFD700',
  platinum: '#0DD4C3',
}

function SmallTrustRing({ score }: { score: number }) {
  const circ = 2 * Math.PI * 36
  const color = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <View style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={80} height={80} viewBox="0 0 80 80">
        <Circle cx="40" cy="40" r="36" stroke="#1E1B2E" strokeWidth={6} fill="none" />
        <Circle
          cx="40" cy="40" r="36" stroke={color} strokeWidth={6} fill="none"
          strokeDasharray={`${(score / 100) * circ} ${circ}`}
          strokeLinecap="round" transform="rotate(-90 40 40)"
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '800' }}>{score}</Text>
      </View>
    </View>
  )
}

function VerifPill({ label, verified }: { label: string; verified: boolean }) {
  const color = verified ? '#22C55E' : '#64748B'
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: color + '15', borderWidth: 1, borderColor: color + '40', marginRight: 6 }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600' }}>{verified ? `${label} ✓` : `${label} ○`}</Text>
    </View>
  )
}

function SectionLabel({ title }: { title: string }) {
  return (
    <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
      {title}
    </Text>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EDE9E0' }}>
      <Text style={{ color: '#94A3B8', fontSize: 12, width: 90, flexShrink: 0 }}>{label}</Text>
      <Text style={{ color: '#1A1625', fontSize: 13, flex: 1, fontWeight: '500' }}>{value}</Text>
    </View>
  )
}

function formatPeriod(start: string, end: string | null, isCurrent: boolean): string {
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })
  return `${fmt(start)} – ${isCurrent ? 'Present' : (end ? fmt(end) : '')}`
}

function formatDob(dob: string): string {
  try {
    return new Date(dob).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dob
  }
}

export default function CandidateProfileScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const { data: candidate, isLoading } = useQuery<CandidateData>({
    queryKey: ['candidate-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw new Error(error.message)
      return (data ?? {}) as unknown as CandidateData
    },
    enabled: !!user?.id,
  })

  const { data: contactRow } = useQuery<{ email: string | null; phone: string | null }>({
    queryKey: ['profile-contact', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('email,phone').eq('id', user!.id).maybeSingle()
      return (data ?? {}) as { email: string | null; phone: string | null }
    },
    enabled: !!user?.id,
  })

  const { data: trustScoreData } = useQuery<{ score: number; level: string } | null>({
    queryKey: ['candidate-trust-score', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('trust_scores').select('score, level').eq('candidate_id', user!.id).maybeSingle()
      return data ?? null
    },
    enabled: !!user?.id,
  })

  const { data: workHistory = [] } = useQuery<WorkHistory[]>({
    queryKey: ['candidate-work', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_work_history').select('*').eq('candidate_id', user!.id)
        .order('start_date', { ascending: false })
      if (error) throw new Error(error.message)
      return (data ?? []) as WorkHistory[]
    },
    enabled: !!user?.id,
  })

  const { data: education = [] } = useQuery<Education[]>({
    queryKey: ['candidate-education', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('candidate_education').select('*').eq('candidate_id', user!.id)
      if (error) throw new Error(error.message)
      return (data ?? []) as Education[]
    },
    enabled: !!user?.id,
  })

  const { data: skills = [] } = useQuery<Skill[]>({
    queryKey: ['candidate-skills', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_skills').select('id, skills(name, category)').eq('candidate_id', user!.id)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as Skill[]
    },
    enabled: !!user?.id,
  })

  const { data: badges = [] } = useQuery<BadgeSummary[]>({
    queryKey: ['candidate-badges-preview', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('badges')
        .select('id, role_held, issued_at, company_profiles(company_name, logo_url, is_verified)')
        .eq('recipient_id', user!.id).eq('status', 'active').limit(3)
      if (error) throw new Error(error.message)
      return (data ?? []) as unknown as BadgeSummary[]
    },
    enabled: !!user?.id,
  })

  const { data: gallery = [] } = useQuery<GalleryImage[]>({
    queryKey: ['candidate-gallery', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_gallery').select('id, image_url, sort_order')
        .eq('candidate_id', user!.id).order('sort_order')
      return (data ?? []) as GalleryImage[]
    },
    enabled: !!user?.id,
  })

  // Refresh all data every time this screen comes into focus (e.g. returning from edit)
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({ queryKey: ['candidate-profile', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['profile-contact', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['candidate-skills', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['candidate-work', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['candidate-education', user?.id] })
      void queryClient.invalidateQueries({ queryKey: ['candidate-gallery', user?.id] })
    }, [queryClient, user?.id])
  )

  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const trustScore = trustScoreData?.score ?? 0
  const trustLevel = trustScoreData?.level ?? 'bronze'
  const levelColor = TRUST_LEVEL_COLORS[trustLevel] ?? '#CD7F32'
  const fullName = candidate ? `${candidate.first_name} ${candidate.last_name}` : 'Your Profile'
  const initials = `${(candidate?.first_name ?? 'U')[0]}${(candidate?.last_name ?? '')[0] ?? ''}`.toUpperCase()

  // Build Basic Info rows — only show filled ones
  const basicInfoRows: { label: string; value: string }[] = []
  if (contactRow?.email) basicInfoRows.push({ label: 'Email', value: contactRow.email })
  if (contactRow?.phone) basicInfoRows.push({ label: 'Phone', value: contactRow.phone })
  if (candidate?.date_of_birth) basicInfoRows.push({ label: 'Date of Birth', value: formatDob(candidate.date_of_birth) })
  if (candidate?.state_of_origin_id) basicInfoRows.push({ label: 'Location', value: NIGERIAN_STATES[candidate.state_of_origin_id] ?? '' })

  // Cache-bust avatar URL using updated_at so expo-image always re-fetches after a new upload
  const avatarUri = candidate?.avatar_url
    ? `${candidate.avatar_url}?v=${encodeURIComponent(candidate.updated_at ?? '')}`
    : null

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 20, marginBottom: 24 }}>
          <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '800', letterSpacing: -0.3 }}>My Profile</Text>
          <Pressable
            onPress={() => router.push('/(candidate)/profile/edit')}
            style={{ backgroundColor: '#FF624015', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#FF624030' }}
            hitSlop={10}
          >
            <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700' }}>Edit</Text>
          </Pressable>
        </Animated.View>

        {/* Hero identity card */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ backgroundColor: '#F0EBE1', borderRadius: 24, borderWidth: 1, borderColor: '#DDD6C9', padding: 20, marginBottom: 16, alignItems: 'center' }}>
          {/* Avatar — cachePolicy reload ensures the new photo appears immediately */}
          {avatarUri ? (
            <Image
              source={{ uri: avatarUri }}
              style={{ width: 88, height: 88, borderRadius: 44, marginBottom: 14, borderWidth: 3, borderColor: '#FF624040' }}
              contentFit="cover"
              cachePolicy="none"
            />
          ) : (
            <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: '#FF624020', borderWidth: 3, borderColor: '#FF624040', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <Text style={{ color: '#FF6240', fontSize: 28, fontWeight: '800' }}>{initials}</Text>
            </View>
          )}

          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 4 }}>{fullName}</Text>
          {candidate?.headline && (
            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 20, marginBottom: 12 }}>{candidate.headline}</Text>
          )}

          {/* Verification + open to work badges */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, justifyContent: 'center', marginBottom: 14 }}>
            <VerifPill label="Phone" verified={candidate?.phone_verified ?? false} />
            <VerifPill label="NIN" verified={candidate?.nin_verified ?? false} />
            <VerifPill label="Liveness" verified={candidate?.liveness_verified ?? false} />
            {candidate?.is_open_to_work && (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#22C55E15', borderWidth: 1, borderColor: '#22C55E40' }}>
                <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>Open to Work</Text>
              </View>
            )}
          </View>

          {/* Trust score */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, width: '100%', backgroundColor: '#EDE7DB', borderRadius: 14, padding: 14 }}>
            <SmallTrustRing score={trustScore} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>Trust Score</Text>
              <Text style={{ color: '#1A1625', fontSize: 26, fontWeight: '800', lineHeight: 30 }}>
                {trustScore}<Text style={{ color: '#475569', fontSize: 13 }}>/100</Text>
              </Text>
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: `${levelColor}20`, borderWidth: 1, borderColor: `${levelColor}40`, alignSelf: 'flex-start', marginTop: 6 }}>
                <Text style={{ color: levelColor, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' }}>{trustLevel}</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Basic Info ── */}
        {basicInfoRows.length > 0 && (
          <Animated.View entering={FadeInDown.delay(90).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="Basic Info" />
              {basicInfoRows.map((row, i) => (
                <View
                  key={row.label}
                  style={{
                    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                    paddingVertical: 10,
                    borderBottomWidth: i < basicInfoRows.length - 1 ? 1 : 0,
                    borderBottomColor: '#EDE9E0',
                  }}
                >
                  <Text style={{ color: '#94A3B8', fontSize: 12, width: 90, flexShrink: 0, marginTop: 1 }}>{row.label}</Text>
                  <Text style={{ color: '#1A1625', fontSize: 13, flex: 1, fontWeight: '500' }}>{row.value}</Text>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── About ── */}
        {candidate?.bio ? (
          <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="About" />
              <Text style={{ color: '#2D2640', fontSize: 14, lineHeight: 22 }}>{candidate.bio}</Text>
            </View>
          </Animated.View>
        ) : null}

        {/* ── Skills ── */}
        {skills.length > 0 && (
          <Animated.View entering={FadeInDown.delay(160).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="Skills" />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {skills.map((s) => (
                  <View key={s.id} style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9' }}>
                    <Text style={{ color: '#2D2640', fontSize: 12, fontWeight: '500' }}>{s.skills?.name ?? ''}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>
        )}

        {/* ── Work Experience ── */}
        {workHistory.length > 0 && (
          <Animated.View entering={FadeInDown.delay(200).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="Work Experience" />
              {workHistory.map((w, idx) => (
                <View key={w.id} style={{ flexDirection: 'row', gap: 12, marginBottom: idx < workHistory.length - 1 ? 18 : 0 }}>
                  <View style={{ alignItems: 'center' }}>
                    <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 14 }}>💼</Text>
                    </View>
                    {idx < workHistory.length - 1 && (
                      <View style={{ width: 1, flex: 1, backgroundColor: '#DDD6C9', marginTop: 4 }} />
                    )}
                  </View>
                  <View style={{ flex: 1, paddingBottom: idx < workHistory.length - 1 ? 12 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700', flex: 1 }}>{w.role_title}</Text>
                      {w.is_current && (
                        <View style={{ backgroundColor: '#22C55E15', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, marginLeft: 8 }}>
                          <Text style={{ color: '#22C55E', fontSize: 10, fontWeight: '700' }}>Current</Text>
                        </View>
                      )}
                    </View>
                    <Text style={{ color: '#5A4F6E', fontSize: 13, marginTop: 2 }}>{w.company_name}</Text>
                    <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>{formatPeriod(w.start_date, w.end_date, w.is_current)}</Text>
                    {w.description && (
                      <Text style={{ color: '#64748B', fontSize: 12, marginTop: 6, lineHeight: 18 }} numberOfLines={3}>{w.description}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Education ── */}
        {education.length > 0 && (
          <Animated.View entering={FadeInDown.delay(240).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="Education" />
              {education.map((e, idx) => (
                <View key={e.id} style={{ flexDirection: 'row', gap: 12, marginBottom: idx < education.length - 1 ? 16 : 0 }}>
                  <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Text style={{ fontSize: 14 }}>🎓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }}>{e.degree}</Text>
                    <Text style={{ color: '#5A4F6E', fontSize: 13, marginTop: 2 }}>{e.institution}</Text>
                    {e.field_of_study && <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{e.field_of_study}</Text>}
                    {(e.start_year || e.end_year) && (
                      <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>{e.start_year} – {e.end_year ?? 'Present'}</Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Badges ── */}
        {badges.length > 0 && (
          <Animated.View entering={FadeInDown.delay(280).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <SectionLabel title="Badges Earned" />
                <Pressable onPress={() => router.push('/(candidate)/badges')} hitSlop={10}>
                  <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>See all →</Text>
                </Pressable>
              </View>
              {badges.map((b, idx) => (
                <View key={b.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: idx > 0 ? 12 : 0, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#DDD6C9' }}>
                  {b.company_profiles?.logo_url ? (
                    <Image source={{ uri: b.company_profiles.logo_url }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 18 }}>🏅</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>{b.role_held}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{b.company_profiles?.company_name}</Text>
                  </View>
                  <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#0DD4C315', borderWidth: 1, borderColor: '#0DD4C330' }}>
                    <Text style={{ color: '#0DD4C3', fontSize: 10, fontWeight: '700' }}>VERIFIED</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* ── Gallery ── */}
        {gallery.length > 0 && (
          <Animated.View entering={FadeInDown.delay(310).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="Gallery" />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {gallery.map((img) => (
                  <Pressable key={img.id} onPress={() => setLightboxUrl(img.image_url)} hitSlop={4}>
                    <Image
                      source={{ uri: img.image_url }}
                      style={{ width: 100, height: 100, borderRadius: 12 }}
                      contentFit="cover"
                      cachePolicy="none"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Animated.View>
        )}

        {/* ── Links ── */}
        {(candidate?.github_url || candidate?.linkedin_url || candidate?.portfolio_url) && (
          <Animated.View entering={FadeInDown.delay(320).duration(350)} style={{ marginBottom: 16 }}>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <SectionLabel title="Links" />
              {[
                { url: candidate?.github_url, emoji: '🐙', label: 'GitHub' },
                { url: candidate?.linkedin_url, emoji: '💼', label: 'LinkedIn' },
                { url: candidate?.portfolio_url, emoji: '🌐', label: 'Portfolio' },
              ].filter((l) => l.url).map((link, idx) => (
                <View key={link.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: '#DDD6C9' }}>
                  <Text style={{ fontSize: 16 }}>{link.emoji}</Text>
                  <View>
                    <Text style={{ color: '#475569', fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 }}>{link.label}</Text>
                    <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 1 }} numberOfLines={1}>{link.url}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Animated.View>
        )}

        {/* As-seen note */}
        <Animated.View entering={FadeInDown.delay(360).duration(350)}>
          <View style={{ backgroundColor: '#0DD4C310', borderWidth: 1, borderColor: '#0DD4C330', borderRadius: 14, padding: 14 }}>
            <Text style={{ color: '#0DD4C3', fontSize: 12, textAlign: 'center', lineHeight: 18 }}>
              👁️  This is exactly how verified companies see your profile
            </Text>
          </View>
        </Animated.View>

      </ScrollView>

      {/* Gallery lightbox */}
      <Modal visible={!!lightboxUrl} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setLightboxUrl(null)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center', justifyContent: 'center' }} onPress={() => setLightboxUrl(null)}>
          {lightboxUrl && (
            <Image
              source={{ uri: lightboxUrl }}
              style={{ width: Dimensions.get('window').width, height: Dimensions.get('window').width, maxHeight: Dimensions.get('window').height * 0.82 }}
              contentFit="contain"
            />
          )}
          <Text style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12, marginTop: 14 }}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

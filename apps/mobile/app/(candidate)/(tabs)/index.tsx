import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, Path, G } from 'react-native-svg'
import { Image } from 'expo-image'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CandidateProfile {
  id: string
  first_name: string
  last_name: string
  headline: string | null
  avatar_url: string | null
  profile_completion: number
  is_open_to_work: boolean
  trust_scores: { score: number; level: string }[] | null
}

interface JobPosting {
  id: string
  title: string
  city: string | null
  work_mode: string
  employment_type: string
  salary_min: number | null
  salary_max: number | null
  salary_is_confidential: boolean
  company_profiles: { company_name: string; logo_url: string | null; is_verified: boolean } | null
}

interface RecentApp {
  id: string
  pipeline_stage: string
  submitted_at: string
  job_postings: { title: string; company_profiles: { company_name: string } | null } | null
}

const STAGE_COLOR: Record<string, string> = {
  new: '#60A5FA',
  reviewed: '#A78BFA',
  shortlisted: '#34D399',
  interview_scheduled: '#F59E0B',
  offer_made: '#22C55E',
  rejected: '#EF4444',
  withdrawn: '#475569',
}

const STAGE_LABEL: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview',
  offer_made: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

function formatSalary(min: number | null, max: number | null, confidential: boolean): string {
  if (confidential) return 'Confidential'
  if (!min && !max) return 'Negotiable'
  const f = (n: number) => (n >= 1_000_000 ? `${(n / 1e6).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n))
  if (min && max) return `₦${f(min)}–${f(max)}`
  return min ? `From ₦${f(min)}` : `Up to ₦${f(max!)}`
}

function TrustRing({ score }: { score: number }) {
  const r = 36
  const circ = 2 * Math.PI * r
  const color = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444'
  return (
    <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={84} height={84} viewBox="0 0 84 84">
        <G rotation="-90" origin="42,42">
          <Circle cx={42} cy={42} r={r} stroke="#1E1B2E" strokeWidth={7} fill="none" />
          <Circle cx={42} cy={42} r={r} stroke={color} strokeWidth={7} fill="none"
            strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round" />
        </G>
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '800' }}>{score}</Text>
        <Text style={{ color: '#64748B', fontSize: 9 }}>/ 100</Text>
      </View>
    </View>
  )
}

function BellIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  )
}

export default function CandidateDashboard() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [refreshing, setRefreshing] = useState(false)

  const { data: candidate, isLoading: profileLoading } = useQuery({
    queryKey: ['candidate-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('*, trust_scores(score, level)')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as unknown as CandidateProfile
    },
    enabled: !!user?.id,
  })

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['recommended-jobs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, city, work_mode, employment_type, salary_min, salary_max, salary_is_confidential, company_profiles(company_name, logo_url, is_verified)')
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data as unknown as JobPosting[]
    },
  })

  const { data: appCount } = useQuery({
    queryKey: ['app-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('candidate_id', user!.id)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  const { data: viewCount } = useQuery({
    queryKey: ['profile-views-count', user?.id],
    queryFn: async () => {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString()
      const { count, error } = await supabase.from('profile_views').select('id', { count: 'exact', head: true }).eq('viewed_id', user!.id).gte('viewed_at', weekAgo)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  const { data: recentApps } = useQuery({
    queryKey: ['recent-apps', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, pipeline_stage, submitted_at, job_postings(title, company_profiles(company_name))')
        .eq('candidate_id', user!.id)
        .order('submitted_at', { ascending: false })
        .limit(3)
      if (error) throw error
      return data as unknown as RecentApp[]
    },
    enabled: !!user?.id,
  })

  const { data: bellCount = 0 } = useQuery<number>({
    queryKey: ['candidate-bell-count', user?.id],
    queryFn: async () => {
      const now = new Date().toISOString()
      const [notifRes, broadcastRes] = await Promise.all([
        supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user!.id).eq('is_read', false),
        supabase.from('admin_broadcasts').select('id', { count: 'exact', head: true }).eq('is_active', true).in('target', ['all', 'candidates']).or(`expires_at.is.null,expires_at.gt.${now}`),
      ])
      return (notifRes.count ?? 0) + (broadcastRes.count ?? 0)
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60,
  })

  const toggleMutation = useMutation({
    mutationFn: async (val: boolean) => {
      const { error } = await supabase.from('candidate_profiles').update({ is_open_to_work: val }).eq('id', user!.id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['candidate-profile', user?.id] }),
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries()
    setRefreshing(false)
  }

  if (profileLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const trustScore = candidate?.trust_scores?.[0]?.score ?? 0
  const completion = candidate?.profile_completion ?? 0
  const isOpenToWork = candidate?.is_open_to_work ?? false
  const metaFirst = user?.user_metadata?.first_name as string | undefined
  const metaLast = user?.user_metadata?.last_name as string | undefined
  const firstName = candidate?.first_name ?? metaFirst ?? 'there'
  const fullName = `${candidate?.first_name ?? metaFirst ?? ''} ${candidate?.last_name ?? metaLast ?? ''}`.trim()
  const initials = `${(candidate?.first_name ?? metaFirst ?? 'U')[0]}${(candidate?.last_name ?? metaLast ?? '')[0] ?? ''}`.toUpperCase()
  const trustColor = trustScore >= 80 ? '#22C55E' : trustScore >= 50 ? '#F59E0B' : '#EF4444'
  const trustLabel = trustScore >= 80 ? 'Verified' : trustScore >= 50 ? 'Partial' : 'Unverified'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6240" />}
      >
        {/* ── Header bar ── */}
        <Animated.View entering={FadeInDown.duration(300)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 }}>
          <View>
            <Text style={{ color: '#475569', fontSize: 12, letterSpacing: 0.3 }}>{greeting()}</Text>
            <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 }}>{firstName} 👋</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(candidate)/notifications' as never)}
            style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}
            hitSlop={12}
          >
            <BellIcon />
            {bellCount > 0 && (
              <View style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: 8, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#F5F0E8' }}>
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '800' }}>{bellCount > 9 ? '9+' : bellCount}</Text>
              </View>
            )}
          </Pressable>
        </Animated.View>

        {/* ── Hero identity card ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ marginHorizontal: 20, marginBottom: 16 }}>
          <View style={{ backgroundColor: '#F0EBE1', borderRadius: 24, borderWidth: 1, borderColor: '#DDD6C9', padding: 20, overflow: 'hidden' }}>
            {/* Subtle glow accent */}
            <View style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: '#FF624008' }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              {/* Avatar */}
              {candidate?.avatar_url ? (
                <Image source={{ uri: candidate.avatar_url }} style={{ width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: '#FF624040' }} contentFit="cover" />
              ) : (
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FF624020', borderWidth: 2, borderColor: '#FF624040', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FF6240', fontSize: 18, fontWeight: '800' }}>{initials}</Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{fullName || firstName}</Text>
                {candidate?.headline && (
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{candidate.headline}</Text>
                )}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <View style={{ backgroundColor: `${trustColor}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: `${trustColor}40` }}>
                    <Text style={{ color: trustColor, fontSize: 10, fontWeight: '700' }}>{trustLabel}</Text>
                  </View>
                  {isOpenToWork && (
                    <View style={{ backgroundColor: '#22C55E15', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#22C55E30' }}>
                      <Text style={{ color: '#22C55E', fontSize: 10, fontWeight: '700' }}>Open to Work</Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Trust ring */}
              <TrustRing score={trustScore} />
            </View>

            {/* Profile completion bar */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#475569', fontSize: 11 }}>Profile strength</Text>
                <Text style={{ color: completion >= 80 ? '#22C55E' : '#FF6240', fontSize: 11, fontWeight: '700' }}>{completion}%</Text>
              </View>
              <View style={{ height: 5, backgroundColor: '#DDD6C9', borderRadius: 3, overflow: 'hidden', marginBottom: 14 }}>
                <View style={{ height: '100%', width: `${completion}%`, backgroundColor: completion >= 80 ? '#22C55E' : '#FF6240', borderRadius: 3 }} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {completion < 80 ? (
                  <Pressable
                    onPress={() => router.push('/(candidate)/profile/edit' as never)}
                    style={{ flex: 1, backgroundColor: '#FF624015', borderRadius: 10, paddingVertical: 9, alignItems: 'center', borderWidth: 1, borderColor: '#FF624030', marginRight: 10 }}
                  >
                    <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>Complete profile →</Text>
                  </Pressable>
                ) : (
                  <Text style={{ color: '#475569', fontSize: 11, flex: 1 }}>Profile complete 🎉</Text>
                )}

                <Pressable
                  onPress={() => toggleMutation.mutate(!isOpenToWork)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                >
                  <View style={{ width: 36, height: 20, borderRadius: 10, backgroundColor: isOpenToWork ? '#22C55E' : '#C8BFB0', padding: 2, justifyContent: 'center', alignItems: isOpenToWork ? 'flex-end' : 'flex-start' }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: '#1A1625' }} />
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 11 }}>Open to work</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* ── Stats row ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 20 }}>
          {[
            { label: 'Applied', value: appCount ?? 0, color: '#FF6240', emoji: '📝', onPress: undefined },
            { label: 'Views (7d)', value: viewCount ?? 0, color: '#0DD4C3', emoji: '👁️', onPress: () => router.push('/(candidate)/profile-views' as never) },
            { label: 'Interviews', value: 0, color: '#A78BFA', emoji: '🗓️', onPress: undefined },
          ].map((s) => (
            <Pressable
              key={s.label}
              onPress={s.onPress ?? undefined}
              style={{ flex: 1, backgroundColor: '#F0EBE1', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', paddingVertical: 14, paddingHorizontal: 10, alignItems: 'center' }}
              className={s.onPress ? 'active:opacity-70' : undefined}
            >
              <Text style={{ fontSize: 18, marginBottom: 4 }}>{s.emoji}</Text>
              <Text style={{ color: s.color, fontSize: 24, fontWeight: '800', lineHeight: 28 }}>{s.value}</Text>
              <Text style={{ color: '#475569', fontSize: 10, marginTop: 2, textAlign: 'center' }}>{s.label}</Text>
              {s.onPress && <Text style={{ color: s.color, fontSize: 9, marginTop: 3, opacity: 0.7 }}>tap to view →</Text>}
            </Pressable>
          ))}
        </Animated.View>

        {/* ── Matched jobs ── */}
        <Animated.View entering={FadeInDown.delay(200).duration(350)} style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 14 }}>
            <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '700' }}>Matched for you</Text>
            <Pressable onPress={() => router.push('/(candidate)/jobs' as never)}>
              <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>See all →</Text>
            </Pressable>
          </View>

          {jobsLoading ? (
            <View style={{ height: 130, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#FF6240" />
            </View>
          ) : !jobs?.length ? (
            <View style={{ marginHorizontal: 20, backgroundColor: '#F0EBE1', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 24, alignItems: 'center' }}>
              <Text style={{ fontSize: 28, marginBottom: 8 }}>🔍</Text>
              <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center' }}>Complete your profile to see tailored job matches</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {jobs.map((job) => {
                const companyName = job.company_profiles?.company_name ?? 'Company'
                const initials2 = companyName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                const modeColor = job.work_mode === 'remote' ? '#0DD4C3' : job.work_mode === 'hybrid' ? '#F59E0B' : '#A78BFA'
                const modeLabel = job.work_mode === 'remote' ? 'Remote' : job.work_mode === 'hybrid' ? 'Hybrid' : 'On-site'
                return (
                  <Pressable
                    key={job.id}
                    onPress={() => router.push(`/(candidate)/jobs/${job.id}` as never)}
                    style={{ width: 252, backgroundColor: '#F0EBE1', borderRadius: 20, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, overflow: 'hidden' }}
                  >
                    {/* Color accent top bar */}
                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: modeColor, borderTopLeftRadius: 20, borderTopRightRadius: 20 }} />

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      {job.company_profiles?.logo_url ? (
                        <Image source={{ uri: job.company_profiles.logo_url }} style={{ width: 40, height: 40, borderRadius: 10 }} contentFit="cover" />
                      ) : (
                        <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: '#FF624015', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF624030' }}>
                          <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '800' }}>{initials2}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700', lineHeight: 18 }} numberOfLines={2}>{job.title}</Text>
                        <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }} numberOfLines={1}>{companyName}{job.city ? ` · ${job.city}` : ''}</Text>
                      </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <View style={{ backgroundColor: `${modeColor}15`, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: `${modeColor}30` }}>
                        <Text style={{ color: modeColor, fontSize: 10, fontWeight: '700' }}>{modeLabel}</Text>
                      </View>
                      <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          )}
        </Animated.View>

        {/* ── Recent applications ── */}
        {(recentApps ?? []).length > 0 && (
          <Animated.View entering={FadeInDown.delay(260).duration(350)} style={{ marginHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '700' }}>Recent applications</Text>
              <Pressable onPress={() => router.push('/(candidate)/applications' as never)}>
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>View all →</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: '#F0EBE1', borderRadius: 20, borderWidth: 1, borderColor: '#DDD6C9', overflow: 'hidden' }}>
              {recentApps!.map((app, idx) => {
                const color = STAGE_COLOR[app.pipeline_stage] ?? '#64748B'
                const label = STAGE_LABEL[app.pipeline_stage] ?? app.pipeline_stage
                const jobTitle = app.job_postings?.title ?? 'Position'
                const companyName = app.job_postings?.company_profiles?.company_name ?? 'Company'
                return (
                  <View key={app.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: idx < recentApps!.length - 1 ? 1 : 0, borderBottomColor: '#DDD6C9' }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, flexShrink: 0, shadowColor: color, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.8, shadowRadius: 4 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{jobTitle}</Text>
                      <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{companyName}</Text>
                    </View>
                    <View style={{ backgroundColor: `${color}20`, borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1, borderColor: `${color}40` }}>
                      <Text style={{ color, fontSize: 10, fontWeight: '700' }}>{label}</Text>
                    </View>
                  </View>
                )
              })}
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

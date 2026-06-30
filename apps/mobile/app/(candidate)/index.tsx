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
  trust_scores: Array<{ score: number; level: string }> | null
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
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: '800' }}>{score}</Text>
        <Text style={{ color: '#64748B', fontSize: 9 }}>/ 100</Text>
      </View>
    </View>
  )
}

function WorkBadge({ mode }: { mode: string }) {
  const label = mode === 'remote' ? 'Remote' : mode === 'hybrid' ? 'Hybrid' : 'On-site'
  const color = mode === 'remote' ? '#0DD4C3' : mode === 'hybrid' ? '#A78BFA' : '#F59E0B'
  return (
    <View style={{ paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, backgroundColor: `${color}20`, borderWidth: 1, borderColor: `${color}40` }}>
      <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{label}</Text>
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#09080E', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const trustScore = candidate?.trust_scores?.[0]?.score ?? 0
  const completion = candidate?.profile_completion ?? 0
  const isOpenToWork = candidate?.is_open_to_work ?? false
  const firstName = candidate?.first_name ?? 'there'
  const initials = `${(candidate?.first_name ?? 'U')[0]}${(candidate?.last_name ?? '')[0] ?? ''}`.toUpperCase()
  const trustColor = trustScore >= 80 ? '#22C55E' : trustScore >= 50 ? '#F59E0B' : '#EF4444'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09080E' }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6240" />}
      >
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(350)} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>{greeting()}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '800', letterSpacing: -0.5 }}>{firstName}</Text>
              {isOpenToWork && (
                <View style={{ backgroundColor: '#22C55E15', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: '#22C55E30' }}>
                  <Text style={{ color: '#22C55E', fontSize: 10, fontWeight: '700' }}>Open to Work</Text>
                </View>
              )}
            </View>
            {candidate?.headline && (
              <Text style={{ color: '#475569', fontSize: 12, marginTop: 2 }} numberOfLines={1}>{candidate.headline}</Text>
            )}
          </View>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Pressable onPress={() => router.push('/(candidate)/notifications' as never)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }} className="active:opacity-70">
              <BellIcon />
            </Pressable>
            {candidate?.avatar_url ? (
              <Image source={{ uri: candidate.avatar_url }} style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 2, borderColor: '#FF624040' }} contentFit="cover" />
            ) : (
              <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#FF624020', borderWidth: 2, borderColor: '#FF624040', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '800' }}>{initials}</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Trust + completion card */}
        <Animated.View entering={FadeInDown.delay(60).duration(350)} style={{ marginHorizontal: 20, marginBottom: 16, backgroundColor: '#131118', borderRadius: 20, borderWidth: 1, borderColor: '#1E1B2E', padding: 20 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 20 }}>
            <TrustRing score={trustScore} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <Text style={{ color: '#94A3B8', fontSize: 12 }}>Profile completion</Text>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{completion}%</Text>
              </View>
              <View style={{ height: 6, backgroundColor: '#1E1B2E', borderRadius: 3, overflow: 'hidden', marginBottom: 10 }}>
                <View style={{ height: '100%', width: `${completion}%`, backgroundColor: completion >= 80 ? '#22C55E' : '#FF6240', borderRadius: 3 }} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: trustColor }} />
                  <Text style={{ color: '#64748B', fontSize: 11 }}>{trustScore >= 80 ? 'Verified' : trustScore >= 50 ? 'Partial' : 'Unverified'}</Text>
                </View>
                <Pressable onPress={() => toggleMutation.mutate(!isOpenToWork)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }} className="active:opacity-70">
                  <View style={{ width: 32, height: 18, borderRadius: 9, backgroundColor: isOpenToWork ? '#22C55E' : '#3D3850', padding: 2, justifyContent: 'center', alignItems: isOpenToWork ? 'flex-end' : 'flex-start' }}>
                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: '#fff' }} />
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 11 }}>Open</Text>
                </Pressable>
              </View>
            </View>
          </View>
          {completion < 80 && (
            <Pressable onPress={() => router.push('/(candidate)/profile/edit' as never)} style={{ marginTop: 14, backgroundColor: '#FF624015', borderRadius: 12, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FF624030' }} className="active:opacity-80">
              <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>Complete your profile to get noticed</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInDown.delay(120).duration(350)} style={{ flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 24 }}>
          {[
            { label: 'Applications', value: appCount ?? 0, color: '#FF6240' },
            { label: 'Profile Views', value: viewCount ?? 0, color: '#0DD4C3' },
            { label: 'Interviews', value: 0, color: '#A78BFA' },
          ].map((s) => (
            <View key={s.label} style={{ flex: 1, backgroundColor: '#131118', borderRadius: 14, borderWidth: 1, borderColor: '#1E1B2E', padding: 14, alignItems: 'center' }}>
              <Text style={{ color: s.color, fontSize: 22, fontWeight: '800' }}>{s.value}</Text>
              <Text style={{ color: '#64748B', fontSize: 10, marginTop: 3, textAlign: 'center' }}>{s.label}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Quick actions */}
        <Animated.View entering={FadeInDown.delay(180).duration(350)} style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Quick actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {([
              { label: 'Browse Jobs', icon: 'briefcase', route: '/(candidate)/jobs', color: '#FF6240' },
              { label: 'My CV', icon: 'document', route: '/(candidate)/cv', color: '#0DD4C3' },
              { label: 'Applied', icon: 'checkmark-circle', route: '/(candidate)/applications', color: '#A78BFA' },
              { label: 'Profile', icon: 'person', route: '/(candidate)/profile', color: '#F59E0B' },
            ] as const).map((action) => (
              <Pressable
                key={action.label}
                onPress={() => router.push(action.route as never)}
                style={{ flex: 1, backgroundColor: `${action.color}10`, borderRadius: 14, borderWidth: 1, borderColor: `${action.color}25`, paddingVertical: 14, alignItems: 'center', gap: 6 }}
                className="active:opacity-70"
              >
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: `${action.color}20`, alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={action.color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
                    {action.icon === 'briefcase' && <><Path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" /><Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></>}
                    {action.icon === 'document' && <><Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" /></>}
                    {action.icon === 'checkmark-circle' && <><Circle cx={12} cy={12} r={10} /><Path d="M9 12l2 2 4-4" /></>}
                    {action.icon === 'person' && <><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx={12} cy={7} r={4} /></>}
                  </Svg>
                </View>
                <Text style={{ color: action.color, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>{action.label}</Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* Matched jobs */}
        <Animated.View entering={FadeInDown.delay(240).duration(350)} style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginHorizontal: 20, marginBottom: 12 }}>
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Matched for you</Text>
            <Pressable onPress={() => router.push('/(candidate)/jobs' as never)} className="active:opacity-70">
              <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>See all</Text>
            </Pressable>
          </View>

          {jobsLoading ? (
            <View style={{ height: 120, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color="#FF6240" />
            </View>
          ) : !jobs?.length ? (
            <View style={{ marginHorizontal: 20, backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center' }}>Complete your profile to see job recommendations</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12 }}>
              {jobs.map((job) => {
                const company = job.company_profiles?.company_name ?? 'Company'
                const initials2 = company.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
                return (
                  <Pressable
                    key={job.id}
                    onPress={() => router.push(`/(candidate)/jobs/${job.id}` as never)}
                    style={{ width: 240, backgroundColor: '#131118', borderRadius: 18, borderWidth: 1, borderColor: '#1E1B2E', padding: 16 }}
                    className="active:opacity-80"
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      {job.company_profiles?.logo_url ? (
                        <Image source={{ uri: job.company_profiles.logo_url }} style={{ width: 38, height: 38, borderRadius: 10 }} contentFit="cover" />
                      ) : (
                        <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                          <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{initials2}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '600' }} numberOfLines={1}>{job.title}</Text>
                        <Text style={{ color: '#64748B', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{company}{job.city ? ` · ${job.city}` : ''}</Text>
                      </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <WorkBadge mode={job.work_mode} />
                      <Text style={{ color: '#475569', fontSize: 11 }}>{formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}</Text>
                    </View>
                  </Pressable>
                )
              })}
            </ScrollView>
          )}
        </Animated.View>

        {/* Recent applications */}
        {(recentApps ?? []).length > 0 && (
          <Animated.View entering={FadeInDown.delay(300).duration(350)} style={{ marginHorizontal: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>Recent applications</Text>
              <Pressable onPress={() => router.push('/(candidate)/applications' as never)} className="active:opacity-70">
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>View all</Text>
              </Pressable>
            </View>
            <View style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', overflow: 'hidden' }}>
              {recentApps!.map((app, idx) => {
                const color = STAGE_COLOR[app.pipeline_stage] ?? '#64748B'
                const label = STAGE_LABEL[app.pipeline_stage] ?? app.pipeline_stage
                const jobTitle = app.job_postings?.title ?? 'Position'
                const companyName = app.job_postings?.company_profiles?.company_name ?? 'Company'
                return (
                  <View key={app.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: idx < recentApps!.length - 1 ? 1 : 0, borderBottomColor: '#1E1B2E' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, flexShrink: 0 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '500' }} numberOfLines={1}>{jobTitle}</Text>
                      <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{companyName}</Text>
                    </View>
                    <View style={{ backgroundColor: `${color}20`, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color, fontSize: 10, fontWeight: '600' }}>{label}</Text>
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

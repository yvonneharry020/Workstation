import { View, Text, ScrollView, Pressable, FlatList, Modal, ActivityIndicator } from 'react-native'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected' | 'withdrawn'

interface VerificationStatus {
  cacVerified: boolean
  directorVerified: boolean
  documentsSubmitted: boolean
  profileComplete: boolean
}

interface RecentApplication {
  id: string
  pipeline_stage: PipelineStage
  email_opened_at: string | null
  submitted_at: string
  job_postings: { title: string } | null
  candidate_profiles: { full_name: string; avatar_url: string | null } | null
}

interface DashboardStats {
  activeJobs: number
  newApplicationsThisWeek: number
  interviewsToday: number
  profileViews: number
  trustScore: number
  companyName: string
  recentApplications: RecentApplication[]
  hasJobs: boolean
}

const STAGE_COLORS: Record<PipelineStage, string> = {
  new: '#60A5FA',
  reviewed: '#A78BFA',
  shortlisted: '#34D399',
  interview_scheduled: '#F59E0B',
  offer_made: '#22C55E',
  rejected: '#EF4444',
  withdrawn: '#475569',
}

const STAGE_LABELS: Record<PipelineStage, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview',
  offer_made: 'Offer',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

function BellIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </Svg>
  )
}

function BriefcaseIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
    </Svg>
  )
}

function PeopleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Circle cx={9} cy={7} r={4} />
      <Path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

function SearchIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#A78BFA" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={11} cy={11} r={8} />
      <Path d="m21 21-4.35-4.35" />
    </Svg>
  )
}

function ShieldAlertIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M12 8v4M12 16h.01" />
    </Svg>
  )
}

function CheckCircleIcon({ done }: { done: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={done ? '#22C55E' : '#475569'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      {done && <Path d="M9 12l2 2 4-4" />}
    </Svg>
  )
}

function VerificationBanner({ userId }: { userId: string }) {
  const { data: status } = useQuery<VerificationStatus>({
    queryKey: ['company-verification-banner', userId],
    queryFn: async () => {
      const [profileRes, verificationRes] = await Promise.all([
        supabase
          .from('company_profiles')
          .select('cac_verified, director_nin_verified, company_name, industry')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('company_verification')
          .select('documents_status')
          .eq('company_id', userId)
          .maybeSingle(),
      ])
      return {
        cacVerified: (profileRes.data as any)?.cac_verified ?? false,
        directorVerified: (profileRes.data as any)?.director_nin_verified ?? false,
        documentsSubmitted: !!(verificationRes.data as any)?.documents_status,
        profileComplete: !!(profileRes.data as any)?.company_name && !!(profileRes.data as any)?.industry,
      }
    },
    staleTime: 30_000,
  })

  if (!status) return null

  const steps = [
    { label: 'CAC Registration', done: status.cacVerified, route: '/(onboarding)/company/step-2' },
    { label: 'Director Identity', done: status.directorVerified, route: '/(onboarding)/company/step-3' },
    { label: 'Business Documents', done: status.documentsSubmitted, route: '/(onboarding)/company/step-4' },
    { label: 'Company Profile', done: status.profileComplete, route: '/(company)/profile/edit' },
  ]

  const isFullyVerified = steps.every((s) => s.done)
  if (isFullyVerified) return null

  const nextStep = steps.find((s) => !s.done)
  const completedCount = steps.filter((s) => s.done).length

  return (
    <Animated.View entering={FadeInDown.delay(80).duration(350)} className="px-5 mb-5">
      <View style={{ backgroundColor: '#1A1506', borderRadius: 16, borderWidth: 1, borderColor: '#F59E0B40', padding: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <ShieldAlertIcon />
          <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700', flex: 1 }}>
            Complete account verification ({completedCount}/{steps.length})
          </Text>
        </View>
        <Text style={{ color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 12 }}>
          Verified companies can post jobs and access full hiring features.
        </Text>
        <View style={{ gap: 8, marginBottom: 14 }}>
          {steps.map((step) => (
            <Pressable
              key={step.label}
              onPress={() => router.push(step.route as never)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              className="active:opacity-70"
            >
              <CheckCircleIcon done={step.done} />
              <Text style={{ color: step.done ? '#64748B' : '#E2E8F0', fontSize: 13, fontWeight: step.done ? '400' : '500', textDecorationLine: step.done ? 'line-through' : 'none' }}>
                {step.label}
              </Text>
            </Pressable>
          ))}
        </View>
        {nextStep && (
          <Pressable
            onPress={() => router.push(nextStep.route as never)}
            style={{ backgroundColor: '#F59E0B', borderRadius: 10, paddingVertical: 10, alignItems: 'center' }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 13 }}>
              Continue: {nextStep.label}
            </Text>
          </Pressable>
        )}
      </View>
    </Animated.View>
  )
}

function EmptyJobsState() {
  return (
    <Animated.View entering={FadeInDown.delay(300).duration(400)} style={{ backgroundColor: '#131118', borderRadius: 20, borderWidth: 1, borderColor: '#1E1B2E', padding: 32, alignItems: 'center', marginTop: 12 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FF624015', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
        <BriefcaseIcon />
      </View>
      <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Post your first job</Text>
      <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 20 }}>
        Reach thousands of verified Nigerian professionals. Start hiring in minutes.
      </Text>
      <Pressable
        onPress={() => router.push('/(company)/jobs/post' as any)}
        style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 12 }}
        className="active:opacity-80"
      >
        <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Post a job</Text>
      </Pressable>
    </Animated.View>
  )
}

function ApplicationRow({ item, index }: { item: RecentApplication; index: number }) {
  const stageColor = STAGE_COLORS[item.pipeline_stage] ?? '#475569'
  const stageLabel = STAGE_LABELS[item.pipeline_stage] ?? item.pipeline_stage
  const candidateName = item.candidate_profiles?.full_name ?? 'Candidate'
  const avatarUrl = item.candidate_profiles?.avatar_url
  const jobTitle = item.job_postings?.title ?? 'Job'
  const initials = candidateName.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(350)}>
      <Pressable
        onPress={() => router.push(`/(company)/candidates/${item.candidate_profiles?.full_name ?? item.id}` as any)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}
        className="active:opacity-70"
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={{ width: 42, height: 42, borderRadius: 21 }} contentFit="cover" />
        ) : (
          <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: '#94A3B8', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{candidateName}</Text>
          <Text style={{ color: '#64748B', fontSize: 12, marginTop: 1 }} numberOfLines={1}>{jobTitle}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <View style={{ backgroundColor: `${stageColor}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
            <Text style={{ color: stageColor, fontSize: 10, fontWeight: '600' }}>{stageLabel}</Text>
          </View>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.email_opened_at ? '#22C55E' : '#475569' }} />
        </View>
      </Pressable>
    </Animated.View>
  )
}

function NotificationsModal({ visible, onClose, userId }: { visible: boolean; onClose: () => void; userId: string }) {
  const insets = useSafeAreaInsets()
  const queryClient = useQueryClient()

  const { data: notifications, isLoading } = useQuery({
    queryKey: ['company-notifications-modal', userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, read_at, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data as Array<{ id: string; type: string; title: string; body: string; read_at: string | null; created_at: string }>
    },
    enabled: visible && !!userId,
  })

  const markAllRead = useMutation({
    mutationFn: async () => {
      await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', userId).is('read_at', null)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-notifications-modal'] }),
  })

  const unreadCount = (notifications ?? []).filter((n) => !n.read_at).length

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#00000070', justifyContent: 'flex-end' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={{ backgroundColor: '#09080E', borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: '#1E1B2E', maxHeight: '80%', paddingBottom: insets.bottom + 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}>
            <View>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>Notifications</Text>
              {unreadCount > 0 && <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{unreadCount} unread</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              {unreadCount > 0 && (
                <Pressable onPress={() => markAllRead.mutate()} className="active:opacity-70">
                  <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Mark all read</Text>
                </Pressable>
              )}
              <Pressable onPress={onClose} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }} className="active:opacity-70">
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              </Pressable>
            </View>
          </View>
          {isLoading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color="#FF6240" />
            </View>
          ) : !notifications?.length ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <BellIcon />
              </View>
              <Text style={{ color: '#64748B', fontSize: 14 }}>No notifications yet</Text>
            </View>
          ) : (
            <FlatList
              data={notifications}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              renderItem={({ item }) => (
                <Pressable
                  style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#0F0D1A', backgroundColor: item.read_at ? 'transparent' : '#FF624008' }}
                  className="active:opacity-70"
                >
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.read_at ? 'transparent' : '#FF6240', marginTop: 5, flexShrink: 0 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: item.read_at ? '400' : '600', lineHeight: 18 }}>{item.title}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 3, lineHeight: 17 }}>{item.body}</Text>
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 5 }}>{timeAgo(item.created_at)}</Text>
                  </View>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    </Modal>
  )
}

export default function CompanyDashboard() {
  const user = useAuthStore((s) => s.user)
  const [showNotifications, setShowNotifications] = useState(false)
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['company-dashboard', user?.id],
    queryFn: async () => {
      const [jobsRes, appsRes, interviewsRes, profileRes, recentRes] = await Promise.all([
        supabase.from('job_postings').select('id', { count: 'exact', head: true }).eq('company_id', user!.id).eq('status', 'active'),
        supabase.from('job_applications').select('id', { count: 'exact', head: true }).eq('job_postings.company_id', user!.id).gte('submitted_at', weekAgo),
        supabase.from('interview_bookings').select('id', { count: 'exact', head: true }).eq('company_id', user!.id).eq('slot_date', today),
        supabase.from('company_profiles').select('company_name, trust_score').eq('id', user!.id).maybeSingle(),
        supabase.from('job_applications')
          .select('id, pipeline_stage, email_opened_at, submitted_at, job_postings(title), candidate_profiles(full_name, avatar_url)')
          .eq('job_postings.company_id', user!.id)
          .order('submitted_at', { ascending: false })
          .limit(5),
      ])

      const hasJobs = (jobsRes.count ?? 0) > 0

      return {
        activeJobs: jobsRes.count ?? 0,
        newApplicationsThisWeek: appsRes.count ?? 0,
        interviewsToday: interviewsRes.count ?? 0,
        profileViews: 0,
        trustScore: (profileRes.data as any)?.trust_score ?? 0,
        companyName: (profileRes.data as any)?.company_name ?? 'Your Company',
        recentApplications: (recentRes.data as unknown as RecentApplication[]) ?? [],
        hasJobs,
      }
    },
    enabled: !!user?.id,
    refetchInterval: 60_000,
  })

  const trustScore = stats?.trustScore ?? 0
  const trustColor = trustScore >= 80 ? '#22C55E' : trustScore >= 50 ? '#F59E0B' : '#EF4444'
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  const statCards = [
    { label: 'Active Jobs', value: stats?.activeJobs ?? 0, color: '#FF6240' },
    { label: 'New This Week', value: stats?.newApplicationsThisWeek ?? 0, color: '#0DD4C3' },
    { label: 'Interviews Today', value: stats?.interviewsToday ?? 0, color: '#F59E0B' },
    { label: 'Profile Views', value: stats?.profileViews ?? 0, color: '#A78BFA' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {user?.id && (
        <NotificationsModal
          visible={showNotifications}
          onClose={() => setShowNotifications(false)}
          userId={user.id}
        />
      )}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="px-5 pt-6 pb-4 flex-row items-center justify-between">
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#64748B', fontSize: 13 }}>{greeting}</Text>
            <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 }} numberOfLines={1}>
              {isLoading ? '...' : stats?.companyName}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowNotifications(true)}
            style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }}
            className="active:opacity-70"
          >
            <BellIcon />
          </Pressable>
        </View>

        <Animated.View entering={FadeInDown.delay(50).duration(350)} className="px-5 mb-5">
          <View style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500', textTransform: 'uppercase', letterSpacing: 0.5 }}>Trust Score</Text>
              <Text style={{ color: trustColor, fontSize: 18, fontWeight: '800' }}>{trustScore}/100</Text>
            </View>
            <View style={{ height: 6, backgroundColor: '#1E1B2E', borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${trustScore}%`, backgroundColor: trustColor, borderRadius: 3 }} />
            </View>
            <Text style={{ color: '#475569', fontSize: 11, marginTop: 6 }}>
              {trustScore >= 80 ? 'Excellent — candidates trust your listings' : trustScore >= 50 ? 'Good — complete verification to boost further' : 'Complete verification to unlock more features'}
            </Text>
          </View>
        </Animated.View>

        {user?.id && <VerificationBanner userId={user.id} />}

        <Animated.View entering={FadeInDown.delay(100).duration(350)} className="px-5 mb-5">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {statCards.map((card) => (
              <View
                key={card.label}
                style={{ flex: 1, minWidth: '46%', backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 16 }}
              >
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '500', marginBottom: 8 }}>{card.label}</Text>
                <Text style={{ color: card.color, fontSize: 28, fontWeight: '800' }}>{isLoading ? '-' : card.value}</Text>
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(350)} className="px-5 mb-5">
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Quick actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => router.push('/(company)/jobs/post' as any)}
              style={{ flex: 1, backgroundColor: '#FF624015', borderRadius: 14, borderWidth: 1, borderColor: '#FF624030', padding: 14, alignItems: 'center', gap: 8 }}
              className="active:opacity-70"
            >
              <BriefcaseIcon />
              <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Post Job</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(company)/applicants' as any)}
              style={{ flex: 1, backgroundColor: '#0DD4C315', borderRadius: 14, borderWidth: 1, borderColor: '#0DD4C330', padding: 14, alignItems: 'center', gap: 8 }}
              className="active:opacity-70"
            >
              <PeopleIcon />
              <Text style={{ color: '#0DD4C3', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>View ATS</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(company)/candidates/browse' as any)}
              style={{ flex: 1, backgroundColor: '#A78BFA15', borderRadius: 14, borderWidth: 1, borderColor: '#A78BFA30', padding: 14, alignItems: 'center', gap: 8 }}
              className="active:opacity-70"
            >
              <SearchIcon />
              <Text style={{ color: '#A78BFA', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Browse</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(350)} className="px-5">
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Recent applications</Text>

          {!stats?.hasJobs ? (
            <EmptyJobsState />
          ) : stats?.recentApplications.length === 0 ? (
            <View style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#64748B', fontSize: 13 }}>No applications yet</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', paddingHorizontal: 16 }}>
              {stats.recentApplications.map((item, index) => (
                <ApplicationRow key={item.id} item={item} index={index} />
              ))}
              <Pressable
                onPress={() => router.push('/(company)/applicants' as any)}
                style={{ paddingVertical: 14, alignItems: 'center' }}
                className="active:opacity-70"
              >
                <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>View all applicants</Text>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

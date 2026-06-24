import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected' | 'withdrawn'
type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'expired'

interface JobDetail {
  id: string
  title: string
  status: JobStatus
  employment_type: string
  work_mode: string
  city: string | null
  views_count: number
  applications_count: number
  published_at: string | null
  created_at: string
}

interface ApplicationSummary {
  id: string
  pipeline_stage: PipelineStage
  email_opened_at: string | null
  submitted_at: string
  candidate_id: string
  candidate_profiles: { full_name: string; avatar_url: string | null; headline: string | null } | null
}

interface StageBucket {
  stage: PipelineStage
  label: string
  count: number
  color: string
}

const STAGE_CONFIG: { stage: PipelineStage; label: string; color: string }[] = [
  { stage: 'new',                  label: 'New',        color: '#60A5FA' },
  { stage: 'reviewed',             label: 'Reviewed',   color: '#A78BFA' },
  { stage: 'shortlisted',          label: 'Shortlisted', color: '#34D399' },
  { stage: 'interview_scheduled',  label: 'Interview',  color: '#F59E0B' },
  { stage: 'offer_made',           label: 'Offer',      color: '#22C55E' },
  { stage: 'rejected',             label: 'Rejected',   color: '#EF4444' },
]

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string }> = {
  active:  { label: 'Active',   color: '#22C55E' },
  draft:   { label: 'Draft',    color: '#94A3B8' },
  paused:  { label: 'Paused',   color: '#F59E0B' },
  closed:  { label: 'Closed',   color: '#EF4444' },
  expired: { label: 'Expired',  color: '#64748B' },
}

const EMPLOYMENT_LABELS: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time', contract: 'Contract',
  internship: 'Internship', freelance: 'Freelance',
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function EditIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

function FunnelBar({ bucket, max }: { bucket: StageBucket; max: number }) {
  const width = max > 0 ? Math.max(4, (bucket.count / max) * 100) : 4
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <Text style={{ color: '#64748B', fontSize: 11, width: 68 }} numberOfLines={1}>{bucket.label}</Text>
      <View style={{ flex: 1, height: 8, backgroundColor: '#1E1B2E', borderRadius: 4, overflow: 'hidden' }}>
        <View style={{ height: '100%', width: `${width}%`, backgroundColor: bucket.color, borderRadius: 4 }} />
      </View>
      <Text style={{ color: bucket.count > 0 ? '#fff' : '#475569', fontSize: 12, fontWeight: '700', width: 24, textAlign: 'right' }}>{bucket.count}</Text>
    </View>
  )
}

export default function JobApplicantsOverview() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)

  const { data: job, isLoading: jobLoading } = useQuery<JobDetail | null>({
    queryKey: ['job-detail', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, status, employment_type, work_mode, city, views_count, applications_count, published_at, created_at')
        .eq('id', jobId)
        .maybeSingle()
      if (error) throw error
      return data as JobDetail | null
    },
    enabled: !!jobId,
  })

  const { data: applications = [], isLoading: appsLoading } = useQuery<ApplicationSummary[]>({
    queryKey: ['job-applications-overview', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, pipeline_stage, email_opened_at, submitted_at, candidate_id, candidate_profiles(full_name, avatar_url, headline)')
        .eq('job_id', jobId)
        .order('submitted_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data as unknown as ApplicationSummary[]) ?? []
    },
    enabled: !!jobId,
  })

  const stageBuckets: StageBucket[] = STAGE_CONFIG.map((cfg) => ({
    ...cfg,
    count: applications.filter((a) => a.pipeline_stage === cfg.stage).length,
  }))
  const maxCount = Math.max(...stageBuckets.map((b) => b.count), 1)

  const daysPosted = job?.published_at
    ? Math.floor((Date.now() - new Date(job.published_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  const isLoading = jobLoading || appsLoading

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  if (!job) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-5">
        <Text style={{ color: '#64748B', fontSize: 14 }}>Job not found.</Text>
        <Pressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <Text style={{ color: '#FF6240', fontWeight: '600' }}>Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const statusCfg = STATUS_CONFIG[job.status]

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
        <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-70">
          <BackIcon />
        </Pressable>
        <Text style={{ color: '#fff', fontSize: 17, fontWeight: '700', flex: 1 }} numberOfLines={1}>{job.title}</Text>
        <Pressable onPress={() => router.push(`/(company)/jobs/${jobId}/edit` as any)} hitSlop={8} className="active:opacity-70">
          <EditIcon />
        </Pressable>
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Animated.View entering={FadeInDown.delay(50).duration(350)} className="px-5 mb-4">
          <View style={{ backgroundColor: '#131118', borderRadius: 18, borderWidth: 1, borderColor: '#1E1B2E', padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 }} numberOfLines={2}>{job.title}</Text>
                <Text style={{ color: '#64748B', fontSize: 12 }}>{EMPLOYMENT_LABELS[job.employment_type] ?? job.employment_type}{job.city ? ` · ${job.city}` : ''}</Text>
              </View>
              <View style={{ backgroundColor: `${statusCfg.color}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: statusCfg.color, fontSize: 11, fontWeight: '600' }}>{statusCfg.label}</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 0 }}>
              {[
                { label: 'Applications', value: job.applications_count },
                { label: 'Views', value: job.views_count },
                { label: 'Days live', value: daysPosted ?? '—' },
              ].map((stat, i) => (
                <View key={stat.label} style={{ flex: 1, alignItems: 'center', borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: '#1E1B2E' }}>
                  <Text style={{ color: '#FF6240', fontSize: 20, fontWeight: '800' }}>{stat.value}</Text>
                  <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>{stat.label}</Text>
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(350)} className="px-5 mb-4">
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Pipeline</Text>
          <View style={{ backgroundColor: '#131118', borderRadius: 18, borderWidth: 1, borderColor: '#1E1B2E', padding: 16 }}>
            {stageBuckets.map((bucket) => (
              <FunnelBar key={bucket.stage} bucket={bucket} max={maxCount} />
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(350)} className="px-5 mb-4">
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Quick actions</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable
              onPress={() => router.push(`/(company)/jobs/${jobId}/ats` as any)}
              style={{ flex: 1, backgroundColor: '#FF624015', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FF624030' }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700', marginBottom: 3 }}>ATS Table</Text>
              <Text style={{ color: '#FF624080', fontSize: 11 }}>Filter & sort</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/(company)/jobs/${jobId}/kanban` as any)}
              style={{ flex: 1, backgroundColor: '#A78BFA15', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#A78BFA30' }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#A78BFA', fontSize: 13, fontWeight: '700', marginBottom: 3 }}>Kanban</Text>
              <Text style={{ color: '#A78BFA80', fontSize: 11 }}>Drag & drop</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push(`/(company)/interviews/schedule?jobId=${jobId}` as any)}
              style={{ flex: 1, backgroundColor: '#0DD4C315', borderRadius: 14, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#0DD4C330' }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#0DD4C3', fontSize: 13, fontWeight: '700', marginBottom: 3 }}>Schedule</Text>
              <Text style={{ color: '#0DD4C380', fontSize: 11 }}>Interviews</Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(350)} className="px-5">
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Recent applicants</Text>

          {applications.length === 0 ? (
            <View style={{ backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#1E1B2E', padding: 24, alignItems: 'center' }}>
              <Text style={{ color: '#64748B', fontSize: 13 }}>No applications yet</Text>
            </View>
          ) : (
            <View style={{ backgroundColor: '#131118', borderRadius: 18, borderWidth: 1, borderColor: '#1E1B2E', paddingHorizontal: 16 }}>
              {applications.slice(0, 5).map((app, index) => {
                const name = app.candidate_profiles?.full_name ?? 'Candidate'
                const avatar = app.candidate_profiles?.avatar_url
                const headline = app.candidate_profiles?.headline
                const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                const stageCfg = STAGE_CONFIG.find((s) => s.stage === app.pipeline_stage)
                const daysAgo = Math.floor((Date.now() - new Date(app.submitted_at).getTime()) / (1000 * 60 * 60 * 24))

                return (
                  <Pressable
                    key={app.id}
                    onPress={() => router.push(`/(company)/candidates/${app.candidate_id}?applicationId=${app.id}` as any)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: index < 4 ? 1 : 0, borderBottomColor: '#1E1B2E' }}
                    className="active:opacity-70"
                  >
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
                    ) : (
                      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E1B2E', alignItems: 'center', justifyContent: 'center' }}>
                        <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '700' }}>{initials}</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>{name}</Text>
                      {headline && <Text style={{ color: '#64748B', fontSize: 11, marginTop: 1 }} numberOfLines={1}>{headline}</Text>}
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {stageCfg && (
                        <View style={{ backgroundColor: `${stageCfg.color}20`, borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 }}>
                          <Text style={{ color: stageCfg.color, fontSize: 10, fontWeight: '600' }}>{stageCfg.label}</Text>
                        </View>
                      )}
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: app.email_opened_at ? '#22C55E' : '#475569' }} />
                        <Text style={{ color: '#475569', fontSize: 10 }}>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</Text>
                      </View>
                    </View>
                  </Pressable>
                )
              })}
              {applications.length > 5 && (
                <Pressable
                  onPress={() => router.push(`/(company)/jobs/${jobId}/ats` as any)}
                  style={{ paddingVertical: 14, alignItems: 'center' }}
                  className="active:opacity-70"
                >
                  <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>View all {applications.length} applicants</Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

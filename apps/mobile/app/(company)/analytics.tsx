import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type DateRange = '30' | '90'

interface JobPosting {
  id: string
  status: string
  created_at: string
  title: string
  applications_count: number
}

interface Application {
  id: string
  pipeline_stage: string
  submitted_at: string
  job_id: string
}

const STAGE_COLORS: Record<string, string> = {
  new: '#64748B',
  reviewed: '#818CF8',
  shortlisted: '#7C4B2A',
  interview_scheduled: '#F59E0B',
  offer_made: '#FF6240',
  rejected: '#EF4444',
  withdrawn: '#475569',
}

const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  reviewed: 'Reviewed',
  shortlisted: 'Shortlisted',
  interview_scheduled: 'Interview',
  offer_made: 'Offer made',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
}

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14 }}>
      <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 }}>{label}</Text>
      <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>{value}</Text>
      {sub && <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{sub}</Text>}
    </View>
  )
}

function RingChart({ value, color, label }: { value: number; color: string; label: string }) {
  const radius = 36
  const circumference = 2 * Math.PI * radius
  const dashOffset = circumference * (1 - Math.min(value, 100) / 100)

  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ position: 'relative', width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={84} height={84} viewBox="0 0 84 84">
          <G rotation="-90" origin="42,42">
            <Circle cx={42} cy={42} r={radius} stroke="#1E1B2E" strokeWidth={7} fill="none" />
            <Circle
              cx={42} cy={42} r={radius}
              stroke={color}
              strokeWidth={7}
              fill="none"
              strokeDasharray={`${circumference} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
            />
          </G>
        </Svg>
        <View style={{ position: 'absolute' }}>
          <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '800', textAlign: 'center' }}>{value}%</Text>
        </View>
      </View>
      <Text style={{ color: '#64748B', fontSize: 11, textAlign: 'center' }}>{label}</Text>
    </View>
  )
}

function getWeekLabel(weeksAgo: number): string {
  const d = new Date()
  d.setDate(d.getDate() - weeksAgo * 7)
  return `${d.getDate()}/${d.getMonth() + 1}`
}

export default function AnalyticsScreen() {
  const user = useAuthStore((s) => s.user)
  const [dateRange, setDateRange] = useState<DateRange>('30')

  const { data: jobs, isLoading: jobsLoading } = useQuery({
    queryKey: ['analytics-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, status, created_at, title, applications_count')
        .eq('company_id', user!.id)
      if (error) throw error
      return data as unknown as JobPosting[]
    },
    enabled: !!user?.id,
  })

  const { data: applications, isLoading: appsLoading } = useQuery({
    queryKey: ['analytics-applications', user?.id, dateRange],
    queryFn: async () => {
      if (!jobs) return []
      const jobIds = jobs.map((j) => j.id)
      if (!jobIds.length) return []
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - parseInt(dateRange, 10))
      const { data, error } = await supabase
        .from('job_applications')
        .select('id, pipeline_stage, submitted_at, job_id')
        .in('job_id', jobIds)
        .gte('submitted_at', cutoff.toISOString())
      if (error) throw error
      return data as unknown as Application[]
    },
    enabled: !!jobs,
  })

  const isLoading = jobsLoading || appsLoading

  const totalJobs = jobs?.length ?? 0
  const activeJobs = jobs?.filter((j) => j.status === 'active').length ?? 0
  const totalApps = applications?.length ?? 0
  const avgApps = totalJobs > 0 ? Math.round(totalApps / totalJobs) : 0

  const stageCounts = (applications ?? []).reduce<Record<string, number>>((acc, app) => {
    acc[app.pipeline_stage] = (acc[app.pipeline_stage] ?? 0) + 1
    return acc
  }, {})

  const maxStageCount = Math.max(...Object.values(stageCounts), 1)

  const weekCounts = [3, 2, 1, 0].map((weeksAgo) => {
    const start = new Date()
    const end = new Date()
    start.setDate(start.getDate() - (weeksAgo + 1) * 7)
    end.setDate(end.getDate() - weeksAgo * 7)
    return (applications ?? []).filter((a) => {
      const d = new Date(a.submitted_at)
      return d >= start && d < end
    }).length
  })

  const maxWeekCount = Math.max(...weekCounts, 1)

  const topJobs = [...(jobs ?? [])]
    .sort((a, b) => (b.applications_count ?? 0) - (a.applications_count ?? 0))
    .slice(0, 5)

  const maxJobApps = Math.max(...topJobs.map((j) => j.applications_count ?? 0), 1)

  const emailSentMock = Math.max(totalApps * 2, 0)
  const emailOpenedMock = Math.round(emailSentMock * 0.38)
  const openRate = emailSentMock > 0 ? Math.round((emailOpenedMock / emailSentMock) * 100) : 0

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center justify-between px-5 py-4 border-b border-surface-border">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable
            onPress={() => router.back()}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 8, backgroundColor: '#DDD6C9' }}
            className="active:opacity-70"
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M19 12H5M12 5l-7 7 7 7" />
            </Svg>
          </Pressable>
          <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '800' }}>Analytics</Text>
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: '#EDE7DB', borderRadius: 10, borderWidth: 1, borderColor: '#DDD6C9', padding: 3 }}>
          {(['30', '90'] as DateRange[]).map((r) => (
            <Pressable
              key={r}
              onPress={() => setDateRange(r)}
              style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: dateRange === r ? '#FF6240' : 'transparent' }}
              className="active:opacity-80"
            >
              <Text style={{ color: dateRange === r ? '#1A1625' : '#64748B', fontSize: 12, fontWeight: '600' }}>{r}d</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 20, paddingBottom: 48 }}>

          <Animated.View entering={FadeInDown.delay(50).duration(300)}>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              <StatCard label="Jobs posted" value={totalJobs} />
              <StatCard label="Active jobs" value={activeJobs} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 28 }}>
              <StatCard label="Total applicants" value={totalApps} sub={`Last ${dateRange} days`} />
              <StatCard label="Avg per job" value={avgApps} sub="applications" />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginBottom: 28 }}>
            <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Application funnel</Text>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, gap: 10 }}>
              {Object.entries(STAGE_LABELS).map(([stage, label]) => {
                const count = stageCounts[stage] ?? 0
                const pct = (count / maxStageCount) * 100
                return (
                  <View key={stage} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                    <Text style={{ color: '#64748B', fontSize: 12, width: 80 }}>{label}</Text>
                    <View style={{ flex: 1, height: 6, backgroundColor: '#DDD6C9', borderRadius: 3, overflow: 'hidden' }}>
                      <View style={{ width: `${pct}%`, height: '100%', backgroundColor: STAGE_COLORS[stage], borderRadius: 3 }} />
                    </View>
                    <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', width: 28, textAlign: 'right' }}>{count}</Text>
                  </View>
                )
              })}
              {totalApps === 0 && (
                <Text style={{ color: '#475569', fontSize: 13, textAlign: 'center', paddingVertical: 8 }}>No applications in this period</Text>
              )}
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150).duration(300)} style={{ marginBottom: 28 }}>
            <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Applications over time</Text>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, gap: 8 }}>
                {weekCounts.map((count, i) => (
                  <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                    <View style={{ flex: 1, width: '100%', justifyContent: 'flex-end' }}>
                      <View
                        style={{
                          width: '100%',
                          height: `${Math.max((count / maxWeekCount) * 100, 4)}%`,
                          backgroundColor: '#FF6240',
                          borderRadius: 4,
                          opacity: i === 3 ? 1 : 0.5 + (i * 0.15),
                          minHeight: 4,
                        }}
                      />
                    </View>
                    <Text style={{ color: '#475569', fontSize: 10 }}>{getWeekLabel(3 - i)}</Text>
                    <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>{count}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {topJobs.length > 0 && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginBottom: 28 }}>
              <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Top jobs by applications</Text>
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, gap: 12 }}>
                {topJobs.map((job) => {
                  const pct = ((job.applications_count ?? 0) / maxJobApps) * 100
                  return (
                    <View key={job.id}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>{job.title}</Text>
                        <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700', marginLeft: 8 }}>{job.applications_count ?? 0}</Text>
                      </View>
                      <View style={{ height: 4, backgroundColor: '#DDD6C9', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: `${pct}%`, height: '100%', backgroundColor: '#FF6240', borderRadius: 2 }} />
                      </View>
                    </View>
                  )
                })}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(250).duration(300)} style={{ marginBottom: 28 }}>
            <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700', marginBottom: 14 }}>Email performance</Text>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 20 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', marginBottom: 20 }}>
                <RingChart value={openRate} color="#FF6240" label="Open rate" />
                <RingChart value={totalApps > 0 ? Math.min(Math.round((totalApps / Math.max(activeJobs, 1)) * 5), 100) : 0} color="#0DD4C3" label="Response rate" />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1, backgroundColor: '#F0EBE1', borderRadius: 10, padding: 12 }}>
                  <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 4 }}>Sent</Text>
                  <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>{emailSentMock}</Text>
                </View>
                <View style={{ flex: 1, backgroundColor: '#F0EBE1', borderRadius: 10, padding: 12 }}>
                  <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 4 }}>Opened</Text>
                  <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>{emailOpenedMock}</Text>
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

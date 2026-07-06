import { useState } from 'react'
import { View, Text, ScrollView, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type JobStatus = 'draft' | 'active' | 'paused' | 'closed' | 'expired' | 'pending' | 'rejected'
type EmploymentType = 'full_time' | 'part_time' | 'contract' | 'internship' | 'freelance'
type WorkMode = 'remote' | 'hybrid' | 'on_site'

interface JobPosting {
  id: string
  title: string
  department: string | null
  employment_type: EmploymentType
  work_mode: WorkMode
  city: string | null
  applications_count: number
  views_count: number
  status: JobStatus
  created_at: string
  published_at: string | null
}

const STATUS_CONFIG: Record<JobStatus, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: '#22C55E', bg: '#14532D20' },
  draft:    { label: 'Draft',    color: '#5A4F6E', bg: '#1E293B'   },
  paused:   { label: 'Paused',   color: '#F59E0B', bg: '#78350F20' },
  closed:   { label: 'Closed',   color: '#EF4444', bg: '#7F1D1D20' },
  expired:  { label: 'Expired',  color: '#64748B', bg: '#1E293B'   },
  pending:  { label: 'Pending',  color: '#818CF8', bg: '#3730A320' },
  rejected: { label: 'Rejected', color: '#F43F5E', bg: '#881337'   },
}

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  full_time:  'Full-time',
  part_time:  'Part-time',
  contract:   'Contract',
  internship: 'Internship',
  freelance:  'Freelance',
}

const WORK_MODE_LABELS: Record<WorkMode, string> = {
  remote:  'Remote',
  hybrid:  'Hybrid',
  on_site: 'On-site',
}

type FilterTab = 'all' | JobStatus

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',      label: 'All' },
  { key: 'active',   label: 'Active' },
  { key: 'draft',    label: 'Draft' },
  { key: 'paused',   label: 'Paused' },
  { key: 'closed',   label: 'Closed' },
  { key: 'expired',  label: 'Expired' },
  { key: 'pending',  label: 'Pending' },
  { key: 'rejected', label: 'Rejected' },
]

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function EyeIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <Circle cx={12} cy={12} r={3} />
    </Svg>
  )
}

function Circle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d={`M ${cx} ${cy} m -${r} 0 a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 -${r * 2} 0`} />
    </Svg>
  )
}

function UsersIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <Path d="M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

function EditIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <Path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

function JobCard({ job, onToggleStatus, onClose }: { job: JobPosting; onToggleStatus: (id: string, current: JobStatus) => void; onClose: (id: string) => void }) {
  const config = STATUS_CONFIG[job.status] ?? { label: job.status, color: '#64748B', bg: '#1E293B' }
  const daysAgo = job.published_at
    ? Math.floor((Date.now() - new Date(job.published_at).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <View style={{ backgroundColor: '#EDE7DB', borderRadius: 18, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700', flex: 1, marginRight: 10 }} numberOfLines={2}>{job.title}</Text>
          <View style={{ backgroundColor: config.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: config.color, fontSize: 11, fontWeight: '600' }}>{config.label}</Text>
          </View>
        </View>

        {job.department && (
          <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 8 }}>{job.department}</Text>
        )}

        <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <View style={{ backgroundColor: '#DDD6C9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11 }}>{EMPLOYMENT_LABELS[job.employment_type]}</Text>
          </View>
          <View style={{ backgroundColor: '#DDD6C9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11 }}>{WORK_MODE_LABELS[job.work_mode]}</Text>
          </View>
          {job.city && (
            <View style={{ backgroundColor: '#DDD6C9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 11 }}>{job.city}</Text>
            </View>
          )}
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <UsersIcon />
            <Text style={{ color: '#64748B', fontSize: 12 }}>{job.applications_count} applicants</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <EyeIcon />
            <Text style={{ color: '#64748B', fontSize: 12 }}>{job.views_count} views</Text>
          </View>
          {daysAgo !== null && (
            <Text style={{ color: '#475569', fontSize: 12 }}>{daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}</Text>
          )}
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => router.push(`/(company)/jobs/${job.id}` as any)}
            style={{ flex: 1, backgroundColor: '#FF624015', borderRadius: 10, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: '#FF624025' }}
            className="active:opacity-70"
          >
            <UsersIcon />
            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Applicants</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push(`/(company)/jobs/${job.id}/edit` as any)}
            style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 10, paddingVertical: 9, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 5 }}
            className="active:opacity-70"
          >
            <EditIcon />
            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600' }}>Edit</Text>
          </Pressable>
          {(job.status === 'active' || job.status === 'paused') && (
            <Pressable
              onPress={() => onToggleStatus(job.id, job.status)}
              style={{ backgroundColor: '#DDD6C9', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
              className="active:opacity-70"
            >
              <Text style={{ color: job.status === 'active' ? '#F59E0B' : '#22C55E', fontSize: 12, fontWeight: '600' }}>
                {job.status === 'active' ? 'Pause' : 'Resume'}
              </Text>
            </Pressable>
          )}
          {job.status === 'active' && (
            <Pressable
              onPress={() => onClose(job.id)}
              style={{ backgroundColor: '#EF444415', borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#EF444425' }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Close</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

export default function CompanyJobsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  const { data: jobs = [], isLoading, refetch, isRefetching } = useQuery<JobPosting[]>({
    queryKey: ['company-jobs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, department, employment_type, work_mode, city, applications_count, views_count, status, created_at, published_at')
        .eq('company_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as JobPosting[]) ?? []
    },
    enabled: !!user?.id,
  })

  const toggleMutation = useMutation({
    mutationFn: async ({ id, current }: { id: string; current: JobStatus }) => {
      const newStatus = current === 'active' ? 'paused' : 'active'
      const { error } = await supabase.from('job_postings').update({ status: newStatus }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-jobs', user?.id] }),
    onError: () => Alert.alert('Error', 'Could not update job status. Please try again.'),
  })

  const closeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('job_postings').update({ status: 'closed' }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['company-jobs', user?.id] }),
    onError: () => Alert.alert('Error', 'Could not close the job. Please try again.'),
  })

  const handleClose = (id: string) => {
    Alert.alert('Close job?', 'Candidates will no longer be able to apply. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Close job', style: 'destructive', onPress: () => closeMutation.mutate(id) },
    ])
  }

  const filtered = activeFilter === 'all' ? jobs : jobs.filter((j) => j.status === activeFilter)

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 pt-6 pb-4 flex-row items-center justify-between">
        <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700' }}>Job Listings</Text>
        <Pressable
          onPress={() => router.push('/(company)/jobs/post' as any)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}
          className="active:opacity-80"
        >
          <PlusIcon />
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>Post Job</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 4, gap: 8, flexDirection: 'row' }}
        style={{ maxHeight: 44 }}
      >
        {FILTER_TABS.map((tab) => {
          const count = tab.key === 'all' ? jobs.length : jobs.filter((j) => j.status === tab.key).length
          const isActive = activeFilter === tab.key
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActiveFilter(tab.key)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 7,
                borderRadius: 10,
                backgroundColor: isActive ? '#FF6240' : '#EDE7DB',
                borderWidth: 1,
                borderColor: isActive ? '#FF6240' : '#DDD6C9',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
              }}
              className="active:opacity-70"
            >
              <Text style={{ color: isActive ? '#1A1625' : '#64748B', fontSize: 12, fontWeight: '600' }}>{tab.label}</Text>
              <Text style={{ color: isActive ? '#ffffff99' : '#475569', fontSize: 11 }}>{count}</Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <JobCard
              job={item}
              onToggleStatus={(id, current) => toggleMutation.mutate({ id, current })}
              onClose={handleClose}
            />
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 14, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
          onRefresh={refetch}
          refreshing={isRefetching}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 48 }}>
              <Text style={{ color: '#475569', fontSize: 14, marginBottom: 8 }}>No jobs found</Text>
              {activeFilter === 'all' && (
                <Pressable
                  onPress={() => router.push('/(company)/jobs/post' as any)}
                  style={{ backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10, marginTop: 8 }}
                  className="active:opacity-80"
                >
                  <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 14 }}>Post your first job</Text>
                </Pressable>
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  )
}

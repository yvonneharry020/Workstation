import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

interface CompanyDetail {
  id: string
  company_name: string
  industry: string | null
  logo_url: string | null
  is_verified: boolean
  city: string | null
}

interface JobListing {
  id: string
  title: string
  work_mode: string
  employment_type: string
  salary_min: number | null
  salary_max: number | null
  salary_is_confidential: boolean
  published_at: string
}

function timeAgo(d: string): string {
  const days = Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days}d ago`
  if (days < 30) return `${Math.floor(days / 7)}w ago`
  return `${Math.floor(days / 30)}mo ago`
}

function formatSalary(min: number | null, max: number | null, isConfidential: boolean): string {
  if (isConfidential) return 'Salary confidential'
  if (!min && !max) return 'Salary negotiable'
  const fmt = (n: number) =>
    n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}k` : String(n)
  if (min && max) return `₦${fmt(min)} – ₦${fmt(max)}/mo`
  if (min) return `From ₦${fmt(min)}/mo`
  return `Up to ₦${fmt(max!)}/mo`
}

function Pill({ label, color }: { label: string; color?: string }) {
  const bg = color ?? '#DDD6C9'
  return (
    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: bg + (color ? '20' : ''), borderWidth: 1, borderColor: bg + (color ? '40' : '') }}>
      <Text style={{ color: color ?? '#5A4F6E', fontSize: 11, fontWeight: '500', textTransform: 'capitalize' }}>
        {label.replace('_', ' ')}
      </Text>
    </View>
  )
}

function WorkModePill({ mode }: { mode: string }) {
  const colors: Record<string, string> = { remote: '#22C55E', hybrid: '#F59E0B', on_site: '#64748B' }
  const color = colors[mode] ?? '#64748B'
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: color + '20', borderWidth: 1, borderColor: color + '40' }}>
      <Text style={{ color, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>
        {mode.replace('_', ' ')}
      </Text>
    </View>
  )
}

export default function CompanyProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()

  const { data: company, isLoading: loadingCompany } = useQuery<CompanyDetail>({
    queryKey: ['company-profile', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('id', id)
        .single()
      if (error) throw new Error(error.message)
      return data as CompanyDetail
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })

  const { data: jobs = [], isLoading: loadingJobs } = useQuery<JobListing[]>({
    queryKey: ['company-jobs', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, work_mode, employment_type, salary_min, salary_max, salary_is_confidential, published_at')
        .eq('company_id', id)
        .eq('status', 'active')
        .order('published_at', { ascending: false })
        .limit(10)
      if (error) throw new Error(error.message)
      return (data ?? []) as JobListing[]
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })

  if (loadingCompany) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  if (!company) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <Pressable onPress={() => router.back()} style={{ padding: 20 }}>
          <Text style={{ color: '#FF6240' }}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
            Company not found
          </Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            This company profile may have been removed.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const initials = company.company_name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Back */}
        <Pressable onPress={() => router.back()} style={{ marginTop: 8, marginBottom: 20 }} hitSlop={12}>
          <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '500' }}>← Back</Text>
        </Pressable>

        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center', marginBottom: 20 }}>
          {company.logo_url ? (
            <Image
              source={{ uri: company.logo_url }}
              style={{ width: 80, height: 80, borderRadius: 18, marginBottom: 14, backgroundColor: '#DDD6C9' }}
              contentFit="contain"
            />
          ) : (
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 18,
              backgroundColor: '#FF624020',
              borderWidth: 1,
              borderColor: '#FF624040',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 14,
            }}>
              <Text style={{ color: '#FF6240', fontSize: 24, fontWeight: '800' }}>{initials}</Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 6 }}>
            <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700', textAlign: 'center' }}>
              {company.company_name}
            </Text>
            {company.is_verified && <VerifiedBadge size={20} />}
          </View>

          {company.industry ? (
            <View style={{ paddingHorizontal: 12, paddingVertical: 5, borderRadius: 10, backgroundColor: '#DDD6C9', marginBottom: 10 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 13 }}>{company.industry}</Text>
            </View>
          ) : null}

          {company.city ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={{ fontSize: 13 }}>📍</Text>
              <Text style={{ color: '#64748B', fontSize: 13 }}>{company.city}</Text>
            </View>
          ) : null}
        </Animated.View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: '#DDD6C9', marginBottom: 20 }} />

        {/* Open positions */}
        <Animated.View entering={FadeInDown.delay(120).duration(400)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }}>Open Positions</Text>
            {!loadingJobs ? (
              <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: '#FF624020' }}>
                <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>
                  {jobs.length} {jobs.length === 1 ? 'job' : 'jobs'}
                </Text>
              </View>
            ) : null}
          </View>

          {loadingJobs ? (
            <ActivityIndicator color="#FF6240" style={{ marginVertical: 20 }} />
          ) : jobs.length === 0 ? (
            <View style={{
              backgroundColor: '#EDE7DB',
              borderWidth: 1,
              borderColor: '#DDD6C9',
              borderRadius: 14,
              padding: 24,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 28, marginBottom: 10 }}>📭</Text>
              <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600', marginBottom: 4 }}>No open positions</Text>
              <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>
                {company.company_name} has no active job listings right now.
              </Text>
            </View>
          ) : (
            jobs.map((job) => (
              <Pressable
                key={job.id}
                onPress={() => router.push(`/(candidate)/jobs/${job.id}` as Parameters<typeof router.push>[0])}
                style={{
                  backgroundColor: '#EDE7DB',
                  borderWidth: 1,
                  borderColor: '#DDD6C9',
                  borderRadius: 14,
                  padding: 16,
                  marginBottom: 10,
                }}
              >
                <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '600', marginBottom: 8 }}>
                  {job.title}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                  <WorkModePill mode={job.work_mode} />
                  <Pill label={job.employment_type} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>
                    {formatSalary(job.salary_min, job.salary_max, job.salary_is_confidential)}
                  </Text>
                  <Text style={{ color: '#475569', fontSize: 12 }}>{timeAgo(job.published_at)}</Text>
                </View>
              </Pressable>
            ))
          )}
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

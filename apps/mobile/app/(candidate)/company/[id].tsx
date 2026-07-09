import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Dimensions,
  Linking,
} from 'react-native'
import { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { router, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { VerifiedBadge } from '@/components/ui/VerifiedBadge'

const { width: SCREEN_WIDTH } = Dimensions.get('window')
const GALLERY_ITEM_SIZE = (SCREEN_WIDTH - 40 - 8) / 3

interface CompanyDetail {
  id: string
  company_name: string
  industry: string | null
  logo_url: string | null
  cover_banner_url: string | null
  is_verified: boolean
  about: string | null
  headquarters_city: string | null
  headquarters_address: string | null
  business_email: string | null
  business_phone: string | null
  website_url: string | null
  company_size: string | null
  founded_year: number | null
  rc_number: string | null
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

interface GalleryImage {
  id: string
  image_url: string
}

type Tab = 'about' | 'jobs'

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

function Pill({ label }: { label: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: '#DDD6C9' }}>
      <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '500', textTransform: 'capitalize' }}>
        {label.replace('_', ' ')}
      </Text>
    </View>
  )
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function ContactRow({
  iconPath,
  label,
  value,
  onPress,
}: {
  iconPath: string
  label: string
  value: string
  onPress?: () => void
}) {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
      <View style={{ marginTop: 1 }}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={onPress ? '#FF6240' : '#64748B'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d={iconPath} />
        </Svg>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#64748B', fontSize: 11, marginBottom: 2 }}>{label}</Text>
        <Text style={{ color: onPress ? '#FF6240' : '#1A1625', fontSize: 13, fontWeight: '500' }}>{value}</Text>
      </View>
    </View>
  )
  if (onPress) {
    return <Pressable onPress={onPress} className="active:opacity-70">{content}</Pressable>
  }
  return content
}

export default function CompanyProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const [activeTab, setActiveTab] = useState<Tab>('about')
  const [lightboxUri, setLightboxUri] = useState<string | null>(null)

  const { data: company, isLoading: loadingCompany } = useQuery<CompanyDetail>({
    queryKey: ['company-profile-full', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('id, company_name, industry, logo_url, cover_banner_url, is_verified, about, headquarters_city, headquarters_address, business_email, business_phone, website_url, company_size, founded_year, rc_number')
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
        .limit(20)
      if (error) throw new Error(error.message)
      return (data ?? []) as JobListing[]
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 2,
  })

  const { data: gallery = [] } = useQuery<GalleryImage[]>({
    queryKey: ['company-gallery-public', id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_gallery')
        .select('id, image_url')
        .eq('company_id', id)
        .order('created_at', { ascending: true })
        .limit(12)
      return (data ?? []) as GalleryImage[]
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })

  if (loadingCompany) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  if (!company) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
        <Pressable onPress={() => router.back()} style={{ padding: 20 }}>
          <Text style={{ color: '#FF6240' }}>← Back</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }}>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>Company not found</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 8, textAlign: 'center' }}>This company profile may have been removed.</Text>
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

  const hasContactInfo =
    company.business_email ||
    company.business_phone ||
    company.website_url ||
    company.headquarters_address ||
    company.headquarters_city ||
    company.rc_number

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12} className="active:opacity-70">
          <BackIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '600', flex: 1 }} numberOfLines={1}>
          {company.company_name}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={{ position: 'relative', marginBottom: 56 }}>
          {company.cover_banner_url ? (
            <Image
              source={{ uri: company.cover_banner_url }}
              style={{ width: '100%', height: 140, backgroundColor: '#DDD6C9' }}
              contentFit="cover"
            />
          ) : (
            <View style={{ width: '100%', height: 140, backgroundColor: '#EDE7DB', borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }} />
          )}

          {/* Logo overlapping banner */}
          <View style={{
            position: 'absolute',
            bottom: -44,
            left: 20,
            width: 88,
            height: 88,
            borderRadius: 20,
            borderWidth: 3,
            borderColor: '#F5F0E8',
            backgroundColor: '#DDD6C9',
            overflow: 'hidden',
          }}>
            {company.logo_url ? (
              <Image source={{ uri: company.logo_url }} style={{ width: 88, height: 88 }} contentFit="contain" />
            ) : (
              <View style={{ flex: 1, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FF6240', fontSize: 26, fontWeight: '800' }}>{initials}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Name + meta */}
        <Animated.View entering={FadeInDown.duration(350)} style={{ paddingHorizontal: 20, marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6, flexWrap: 'wrap' }}>
            <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>
              {company.company_name}
            </Text>
            {company.is_verified && <VerifiedBadge size={20} />}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {company.industry ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#DDD6C9' }}>
                <Text style={{ color: '#5A4F6E', fontSize: 12 }}>{company.industry}</Text>
              </View>
            ) : null}
            {company.company_size ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#DDD6C9' }}>
                <Text style={{ color: '#5A4F6E', fontSize: 12 }}>{company.company_size} employees</Text>
              </View>
            ) : null}
            {company.founded_year ? (
              <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#DDD6C9' }}>
                <Text style={{ color: '#5A4F6E', fontSize: 12 }}>Est. {company.founded_year}</Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Tab bar */}
        <View style={{
          flexDirection: 'row',
          marginHorizontal: 20,
          marginBottom: 20,
          backgroundColor: '#EDE7DB',
          borderRadius: 14,
          padding: 4,
          borderWidth: 1,
          borderColor: '#DDD6C9',
        }}>
          {(['about', 'jobs'] as Tab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 10,
                alignItems: 'center',
                backgroundColor: activeTab === tab ? '#F5F0E8' : 'transparent',
              }}
              className="active:opacity-80"
            >
              <Text style={{
                fontSize: 14,
                fontWeight: activeTab === tab ? '700' : '500',
                color: activeTab === tab ? '#FF6240' : '#64748B',
              }}>
                {tab === 'jobs'
                  ? `Jobs${!loadingJobs && jobs.length > 0 ? ` (${jobs.length})` : ''}`
                  : 'About'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ABOUT TAB */}
        {activeTab === 'about' && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 20 }}>

            {/* About text */}
            {company.about ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>About</Text>
                <Text style={{ color: '#475569', fontSize: 13, lineHeight: 21 }}>{company.about}</Text>
              </View>
            ) : null}

            {/* Business details */}
            {hasContactInfo ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700', marginBottom: 8 }}>Business Details</Text>
                <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, paddingHorizontal: 16, overflow: 'hidden' }}>
                  {(company.headquarters_address || company.headquarters_city) ? (
                    <ContactRow
                      iconPath="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6z"
                      label="Business Address"
                      value={[company.headquarters_address, company.headquarters_city].filter(Boolean).join(', ')}
                    />
                  ) : null}
                  {company.business_phone ? (
                    <ContactRow
                      iconPath="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 9.91a16 16 0 0 0 6.29 6.29l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"
                      label="Business Phone"
                      value={company.business_phone}
                      onPress={() => Linking.openURL(`tel:${company.business_phone}`)}
                    />
                  ) : null}
                  {company.business_email ? (
                    <ContactRow
                      iconPath="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2zM22 6l-10 7L2 6"
                      label="Business Email"
                      value={company.business_email}
                      onPress={() => Linking.openURL(`mailto:${company.business_email}`)}
                    />
                  ) : null}
                  {company.website_url ? (
                    <ContactRow
                      iconPath="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"
                      label="Website"
                      value={company.website_url.replace(/^https?:\/\//, '')}
                      onPress={() => Linking.openURL(company.website_url!)}
                    />
                  ) : null}
                  {company.rc_number ? (
                    <ContactRow
                      iconPath="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8"
                      label="RC Number"
                      value={company.rc_number}
                    />
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Gallery */}
            {gallery.length > 0 ? (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700', marginBottom: 10 }}>Gallery</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
                  {gallery.map((img) => (
                    <Pressable
                      key={img.id}
                      onPress={() => setLightboxUri(img.image_url)}
                      className="active:opacity-80"
                    >
                      <Image
                        source={{ uri: img.image_url }}
                        style={{ width: GALLERY_ITEM_SIZE, height: GALLERY_ITEM_SIZE, borderRadius: 10, backgroundColor: '#DDD6C9' }}
                        contentFit="cover"
                      />
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            {!company.about && !hasContactInfo && gallery.length === 0 && (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600', marginBottom: 6 }}>No details yet</Text>
                <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center' }}>
                  {company.company_name} hasn't added their full profile yet.
                </Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* JOBS TAB */}
        {activeTab === 'jobs' && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ paddingHorizontal: 20 }}>
            {loadingJobs ? (
              <ActivityIndicator color="#FF6240" style={{ marginVertical: 32 }} />
            ) : jobs.length === 0 ? (
              <View style={{
                backgroundColor: '#EDE7DB',
                borderWidth: 1,
                borderColor: '#DDD6C9',
                borderRadius: 16,
                padding: 28,
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
                  className="active:opacity-80"
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
        )}
      </ScrollView>

      {/* Lightbox for gallery */}
      <Modal visible={!!lightboxUri} transparent animationType="fade" onRequestClose={() => setLightboxUri(null)}>
        <Pressable
          style={{ flex: 1, backgroundColor: '#000000E0', alignItems: 'center', justifyContent: 'center' }}
          onPress={() => setLightboxUri(null)}
        >
          {lightboxUri && (
            <Image
              source={{ uri: lightboxUri }}
              style={{ width: SCREEN_WIDTH - 32, height: SCREEN_WIDTH - 32, borderRadius: 16 }}
              contentFit="contain"
            />
          )}
          <Text style={{ color: '#ffffff80', fontSize: 13, marginTop: 16 }}>Tap to close</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

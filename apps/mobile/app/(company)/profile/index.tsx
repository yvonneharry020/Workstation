import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CompanyProfile {
  id: string
  company_name: string | null
  about: string | null
  culture_description: string | null
  industry: string | null
  company_size: string | null
  founded_year: number | null
  website_url: string | null
  linkedin_url: string | null
  twitter_url: string | null
  instagram_url: string | null
  headquarters_state: number | null
  headquarters_state_text: string | null
  headquarters_city: string | null
  headquarters_address: string | null
  business_phone: string | null
  business_email: string | null
  logo_url: string | null
  cover_banner_url: string | null
  rc_number: string | null
  trust_score: number | null
  cac_verified: boolean
  director_nin_verified: boolean
}

function BackIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function EditIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </Svg>
  )
}

function LinkIcon() {
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3" />
    </Svg>
  )
}

function InfoRow({ label, value }: { label: string; value: string | number | null }) {
  if (!value) return null
  return (
    <View style={{ flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
      <Text style={{ color: '#64748B', fontSize: 13, width: 120, flexShrink: 0 }}>{label}</Text>
      <Text style={{ color: '#1A1625', fontSize: 13, flex: 1 }}>{value}</Text>
    </View>
  )
}

export default function CompanyProfileViewScreen() {
  const user = useAuthStore((s) => s.user)

  const { data: profile, isLoading } = useQuery({
    queryKey: ['company-profile-view', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('*')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as CompanyProfile | null
    },
    enabled: !!user?.id,
  })

  const trustScore = profile?.trust_score ?? 0
  const trustColor = trustScore >= 80 ? '#22C55E' : trustScore >= 50 ? '#F59E0B' : '#EF4444'
  const trustLabel = trustScore >= 80 ? 'Verified' : trustScore >= 50 ? 'Partial' : 'Pending'

  const location = [profile?.headquarters_city, profile?.headquarters_state_text].filter(Boolean).join(', ')

  const openUrl = (url: string | null) => {
    if (!url) return
    const full = url.startsWith('http') ? url : `https://${url}`
    Linking.openURL(full).catch(() => {})
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable
          onPress={() => router.back()}
          style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#EDE7DB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#DDD6C9' }}
          className="active:opacity-70"
        >
          <BackIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 17, fontWeight: '700' }}>Company Profile</Text>
        <Pressable
          onPress={() => router.push('/(company)/profile/edit' as never)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF6240', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 }}
          className="active:opacity-80"
        >
          <EditIcon />
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '600' }}>Edit</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

          {/* Cover banner */}
          <View style={{ height: 160, backgroundColor: '#EDE7DB', position: 'relative' }}>
            {profile?.cover_banner_url ? (
              <Image source={{ uri: profile.cover_banner_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
            ) : (
              <View style={{ flex: 1, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#2D2B3D', fontSize: 12 }}>No cover banner</Text>
              </View>
            )}
            {/* Logo */}
            <View style={{ position: 'absolute', bottom: -36, left: 20, width: 72, height: 72, borderRadius: 18, borderWidth: 3, borderColor: '#F5F0E8', overflow: 'hidden', backgroundColor: '#EDE7DB' }}>
              {profile?.logo_url ? (
                <Image source={{ uri: profile.logo_url }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDD6C9' }}>
                  <Text style={{ color: '#FF6240', fontSize: 24, fontWeight: '800' }}>
                    {(profile?.company_name ?? 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Name + trust score */}
          <View style={{ paddingHorizontal: 20, paddingTop: 48, paddingBottom: 16 }}>
            <Animated.View entering={FadeInDown.delay(50).duration(300)}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>
                    {profile?.company_name ?? 'Your Company'}
                  </Text>
                  {profile?.industry && (
                    <Text style={{ color: '#64748B', fontSize: 14, marginTop: 4 }}>{profile.industry}</Text>
                  )}
                  {location ? (
                    <Text style={{ color: '#475569', fontSize: 13, marginTop: 2 }}>📍 {location}</Text>
                  ) : null}
                </View>
                <View style={{ backgroundColor: `${trustColor}20`, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: `${trustColor}30`, marginLeft: 12 }}>
                  <Text style={{ color: trustColor, fontSize: 12, fontWeight: '700' }}>{trustLabel}</Text>
                  <Text style={{ color: trustColor, fontSize: 11, textAlign: 'center', marginTop: 1 }}>{trustScore}/100</Text>
                </View>
              </View>
            </Animated.View>
          </View>

          {profile?.about && (
            <Animated.View entering={FadeInDown.delay(100).duration(300)} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#EDE7DB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6C9' }}>
              <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>About</Text>
              <Text style={{ color: '#2D2640', fontSize: 14, lineHeight: 22 }}>{profile.about}</Text>
            </Animated.View>
          )}

          {profile?.culture_description && (
            <Animated.View entering={FadeInDown.delay(130).duration(300)} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#EDE7DB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6C9' }}>
              <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Culture</Text>
              <Text style={{ color: '#2D2640', fontSize: 14, lineHeight: 22 }}>{profile.culture_description}</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(160).duration(300)} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#EDE7DB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6C9' }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 }}>Details</Text>
            <InfoRow label="RC Number" value={profile?.rc_number ?? null} />
            <InfoRow label="Business email" value={profile?.business_email ?? null} />
            <InfoRow label="Phone" value={profile?.business_phone ?? null} />
            <InfoRow label="Company size" value={profile?.company_size ?? null} />
            <InfoRow label="Founded" value={profile?.founded_year ?? null} />
            <InfoRow label="Address" value={profile?.headquarters_address ?? null} />
          </Animated.View>

          {(profile?.website_url || profile?.linkedin_url || profile?.twitter_url || profile?.instagram_url) && (
            <Animated.View entering={FadeInDown.delay(200).duration(300)} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#EDE7DB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6C9' }}>
              <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Links</Text>
              <View style={{ gap: 10 }}>
                {profile?.website_url && (
                  <Pressable onPress={() => openUrl(profile.website_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} className="active:opacity-70">
                    <LinkIcon />
                    <Text style={{ color: '#60A5FA', fontSize: 13 }}>{profile.website_url}</Text>
                  </Pressable>
                )}
                {profile?.linkedin_url && (
                  <Pressable onPress={() => openUrl(profile.linkedin_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} className="active:opacity-70">
                    <LinkIcon />
                    <Text style={{ color: '#60A5FA', fontSize: 13 }}>{profile.linkedin_url}</Text>
                  </Pressable>
                )}
                {profile?.twitter_url && (
                  <Pressable onPress={() => openUrl(profile.twitter_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} className="active:opacity-70">
                    <LinkIcon />
                    <Text style={{ color: '#60A5FA', fontSize: 13 }}>{profile.twitter_url}</Text>
                  </Pressable>
                )}
                {profile?.instagram_url && (
                  <Pressable onPress={() => openUrl(profile.instagram_url)} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} className="active:opacity-70">
                    <LinkIcon />
                    <Text style={{ color: '#60A5FA', fontSize: 13 }}>{profile.instagram_url}</Text>
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(240).duration(300)} style={{ marginHorizontal: 20, backgroundColor: '#EDE7DB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#DDD6C9' }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 }}>Verification</Text>
            <View style={{ gap: 10 }}>
              {[
                { label: 'CAC Registration', done: profile?.cac_verified ?? false },
                { label: 'Director Identity', done: profile?.director_nin_verified ?? false },
              ].map((item) => (
                <View key={item.label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: item.done ? '#22C55E20' : '#DDD6C9', borderWidth: 1, borderColor: item.done ? '#22C55E' : '#334155', alignItems: 'center', justifyContent: 'center' }}>
                    {item.done && (
                      <Svg width={10} height={10} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <Path d="M20 6L9 17l-5-5" />
                      </Svg>
                    )}
                  </View>
                  <Text style={{ color: item.done ? '#1A1625' : '#475569', fontSize: 13 }}>{item.label}</Text>
                  <Text style={{ color: item.done ? '#22C55E' : '#F59E0B', fontSize: 11, fontWeight: '600', marginLeft: 'auto' }}>
                    {item.done ? 'Verified' : 'Pending'}
                  </Text>
                </View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>
      )}
    </SafeAreaView>
  )
}

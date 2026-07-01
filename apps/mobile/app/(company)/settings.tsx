import {
  View,
  Text,
  Pressable,
  ScrollView,
  Switch,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { logEvent } from '@/lib/audit'

interface CompanyProfile {
  company_name: string | null
  trust_score: number | null
  gmail_connected: boolean
  gmail_account: string | null
  outlook_connected: boolean
  outlook_account: string | null
}

interface NotificationPrefs {
  push_enabled: boolean
  email_new_application: boolean
  email_status_change: boolean
  email_interview_reminder: boolean
}

function ChevronRightIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
}

function ShieldIcon({ color = '#22C55E' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

function SettingRow({
  label,
  sub,
  right,
  onPress,
  danger,
  iconBg,
  icon,
}: {
  label: string
  sub?: string
  right?: React.ReactNode
  onPress?: () => void
  danger?: boolean
  iconBg?: string
  icon?: React.ReactNode
}) {
  const inner = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 13 }}>
      {icon && (
        <View style={{ width: 30, height: 30, borderRadius: 9, backgroundColor: iconBg ?? '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
          {icon}
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#EF4444' : '#1A1625', fontSize: 14, fontWeight: '500' }}>{label}</Text>
        {sub && <Text style={{ color: '#475569', fontSize: 12, marginTop: 1 }}>{sub}</Text>}
      </View>
      {right ?? (onPress ? <ChevronRightIcon /> : null)}
    </View>
  )

  if (!onPress) return inner

  return (
    <Pressable onPress={onPress} className="active:opacity-70">
      {inner}
    </Pressable>
  )
}

function SectionHeader({ label }: { label: string }) {
  return (
    <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, paddingHorizontal: 4, paddingTop: 20, paddingBottom: 8 }}>
      {label}
    </Text>
  )
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', overflow: 'hidden' }}>
      {children}
    </View>
  )
}

function Divider() {
  return <View style={{ height: 1, backgroundColor: '#DDD6C9', marginLeft: 58 }} />
}

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const reset = useAuthStore((s) => s.reset)
  const queryClient = useQueryClient()

  const { data: profile } = useQuery({
    queryKey: ['company-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('company_name, trust_score, gmail_connected, gmail_account, outlook_connected, outlook_account')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as CompanyProfile | null
    },
    enabled: !!user?.id,
  })

  const { data: prefs } = useQuery({
    queryKey: ['notification-prefs', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_preferences')
        .select('push_enabled, email_new_application, email_status_change, email_interview_reminder')
        .eq('user_id', user!.id)
        .maybeSingle()
      if (error) throw error
      return (data ?? {
        push_enabled: true,
        email_new_application: true,
        email_status_change: true,
        email_interview_reminder: true,
      }) as NotificationPrefs
    },
    enabled: !!user?.id,
  })

  const { data: teamCount } = useQuery({
    queryKey: ['team-count', user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('company_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user!.id)
        .eq('is_active', true)
      if (error) throw error
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  const updatePrefMutation = useMutation({
    mutationFn: async (update: Partial<NotificationPrefs>) => {
      const { error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: user!.id, ...prefs, ...update }, { onConflict: 'user_id' })
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-prefs'] }),
  })

  const trustScore = profile?.trust_score ?? 0
  const trustColor = trustScore >= 80 ? '#22C55E' : trustScore >= 50 ? '#F59E0B' : '#EF4444'

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          try { logEvent({ event: 'user.logout', app: 'company_app' }) } catch {}
          try { await supabase.auth.signOut() } catch {}
          reset()
          router.replace('/(auth)/welcome' as never)
        },
      },
    ])
  }

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate account',
      'Deactivating hides your company from candidates. Contact support to fully delete your data.',
      [{ text: 'Cancel', style: 'cancel' }, { text: 'Contact support', onPress: () => {} }],
    )
  }

  const toggleSwitch = (key: keyof NotificationPrefs) => (value: boolean) => {
    updatePrefMutation.mutate({ [key]: value })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 py-4 border-b border-surface-border">
        <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>Settings</Text>
        {profile?.company_name && (
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{profile.company_name}</Text>
        )}
      </View>

      <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

        <Animated.View entering={FadeInDown.delay(50).duration(300)}>
          <SectionHeader label="Company" />
          <SectionCard>
            <SettingRow
              label="View profile"
              sub="See your company profile"
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <Circle cx="12" cy="12" r="3" />
                </Svg>
              }
              onPress={() => router.push('/(company)/profile/' as never)}
            />
            <Divider />
            <SettingRow
              label="Edit profile"
              sub="Company info, branding, locations"
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </Svg>
              }
              onPress={() => router.push('/(company)/profile/edit')}
            />
            <Divider />
            <SettingRow
              label="Verification status"
              sub={`Trust Score: ${trustScore}/100`}
              icon={<ShieldIcon color={trustColor} />}
              iconBg={`${trustColor}15`}
              right={
                <View style={{ backgroundColor: `${trustColor}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: trustColor, fontSize: 11, fontWeight: '700' }}>
                    {trustScore >= 80 ? 'Verified' : trustScore >= 50 ? 'Partial' : 'Pending'}
                  </Text>
                </View>
              }
            />
            <Divider />
            <SettingRow
              label="Gmail integration"
              sub={profile?.gmail_connected ? (profile.gmail_account ?? 'Connected') : 'Not connected'}
              right={
                <View style={{ backgroundColor: profile?.gmail_connected ? '#22C55E20' : '#DDD6C9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: profile?.gmail_connected ? '#22C55E' : '#64748B', fontSize: 11, fontWeight: '600' }}>
                    {profile?.gmail_connected ? 'Connected' : 'Connect'}
                  </Text>
                </View>
              }
              onPress={() => router.push('/(onboarding)/company/step-6')}
            />
            <Divider />
            <SettingRow
              label="Outlook integration"
              sub={profile?.outlook_connected ? (profile.outlook_account ?? 'Connected') : 'Not connected'}
              right={
                <View style={{ backgroundColor: profile?.outlook_connected ? '#22C55E20' : '#DDD6C9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: profile?.outlook_connected ? '#22C55E' : '#64748B', fontSize: 11, fontWeight: '600' }}>
                    {profile?.outlook_connected ? 'Connected' : 'Connect'}
                  </Text>
                </View>
              }
              onPress={() => router.push('/(onboarding)/company/step-6')}
            />
          </SectionCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <SectionHeader label="Notifications" />
          <SectionCard>
            <SettingRow
              label="Push notifications"
              sub="Alerts on this device"
              right={
                <Switch
                  value={prefs?.push_enabled ?? true}
                  onValueChange={toggleSwitch('push_enabled')}
                  trackColor={{ false: '#DDD6C9', true: '#FF6240' }}
                  thumbColor="#fff"
                />
              }
            />
            <Divider />
            <SettingRow
              label="New application emails"
              right={
                <Switch
                  value={prefs?.email_new_application ?? true}
                  onValueChange={toggleSwitch('email_new_application')}
                  trackColor={{ false: '#DDD6C9', true: '#FF6240' }}
                  thumbColor="#fff"
                />
              }
            />
            <Divider />
            <SettingRow
              label="Status update emails"
              right={
                <Switch
                  value={prefs?.email_status_change ?? true}
                  onValueChange={toggleSwitch('email_status_change')}
                  trackColor={{ false: '#DDD6C9', true: '#FF6240' }}
                  thumbColor="#fff"
                />
              }
            />
            <Divider />
            <SettingRow
              label="Interview reminder emails"
              right={
                <Switch
                  value={prefs?.email_interview_reminder ?? true}
                  onValueChange={toggleSwitch('email_interview_reminder')}
                  trackColor={{ false: '#DDD6C9', true: '#FF6240' }}
                  thumbColor="#fff"
                />
              }
            />
          </SectionCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(150).duration(300)}>
          <SectionHeader label="Team" />
          <SectionCard>
            <SettingRow
              label="Team members"
              sub={`${teamCount ?? 0} active member${teamCount !== 1 ? 's' : ''}`}
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </Svg>
              }
              onPress={() => router.push('/(company)/team')}
            />
          </SectionCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <SectionHeader label="Billing" />
          <SectionCard>
            <SettingRow
              label="Manage subscription"
              sub="Free plan — upgrade to unlock more"
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M2 7h20v14H2zM2 11h20" />
                </Svg>
              }
              onPress={() => router.push('/(company)/billing')}
            />
          </SectionCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <SectionHeader label="Help & Support" />
          <SectionCard>
            <SettingRow
              label="Chat with Support"
              onPress={() => router.push('/(company)/support-chat')}
            />
            <Divider />
            <SettingRow
              label="My Support Tickets"
              onPress={() => router.push('/(company)/support-ticket')}
            />
          </SectionCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <SectionHeader label="Account" />
          <SectionCard>
            <SettingRow
              label="Sign out"
              danger
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
                </Svg>
              }
              iconBg="#EF444415"
              onPress={handleSignOut}
            />
            <Divider />
            <SettingRow label="Deactivate account" danger onPress={handleDeactivate} />
          </SectionCard>
        </Animated.View>

        <Text style={{ color: '#DDD6C9', fontSize: 11, textAlign: 'center', marginTop: 28 }}>Workstation v1.0 · Lagos, Nigeria</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

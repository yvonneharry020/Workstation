import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { logEvent } from '@/lib/audit'

interface CompanyProfile {
  company_name: string | null
}

const DELETE_CONFIRM_WORD = 'DELETE'

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

  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const { data: profile } = useQuery({
    queryKey: ['company-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_profiles')
        .select('company_name')
        .eq('id', user!.id)
        .maybeSingle()
      if (error) throw error
      return data as unknown as CompanyProfile | null
    },
    enabled: !!user?.id,
  })

  const { data: trustData } = useQuery({
    queryKey: ['trust-score', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('trust_scores')
        .select('score')
        .eq('profile_id', user!.id)
        .maybeSingle()
      return (data as any)?.score ?? 0 as number
    },
    enabled: !!user?.id,
  })

  const { data: teamCount } = useQuery({
    queryKey: ['team-count', user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from('company_team_members')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user!.id)
        .eq('is_active', true)
      return count ?? 0
    },
    enabled: !!user?.id,
  })

  const trustScore = trustData ?? 0
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

  const handleDeleteAccount = async () => {
    if (deleteText !== DELETE_CONFIRM_WORD) return
    setIsDeleting(true)
    try {
      logEvent({ event: 'user.account_deleted', app: 'company_app' })
      await supabase.rpc('delete_company_account')
      await supabase.auth.signOut()
      reset()
      setShowDeleteModal(false)
      router.replace('/(auth)/welcome' as never)
    } catch {
      Alert.alert('Error', 'Could not delete your account. Please contact support.')
      setIsDeleting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="px-5 py-4 border-b border-surface-border">
        <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '800' }}>Settings</Text>
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
              label="Google Spreadsheet"
              sub="Export candidate data to Google Sheets"
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <Path d="M14 2v6h6M8 13h8M8 17h8M10 9H8" />
                </Svg>
              }
              iconBg="#22C55E15"
              right={
                <View style={{ backgroundColor: '#DDD6C9', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600' }}>Connect</Text>
                </View>
              }
              onPress={() => router.push('/(company)/integrations/google-sheets' as never)}
            />
          </SectionCard>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <SectionHeader label="Notifications" />
          <SectionCard>
            <SettingRow
              label="Notification Settings"
              sub="Manage push and email alerts"
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <Path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </Svg>
              }
              onPress={() => router.push('/(company)/notification-settings' as never)}
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

        <Animated.View entering={FadeInDown.delay(220).duration(300)}>
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
              label="Change Password"
              icon={
                <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                </Svg>
              }
              onPress={() => router.push('/(company)/change-password' as never)}
            />
            <Divider />
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
            <SettingRow
              label="Delete Account"
              danger
              onPress={() => { setDeleteText(''); setShowDeleteModal(true) }}
            />
          </SectionCard>
        </Animated.View>

        <Text style={{ color: '#DDD6C9', fontSize: 11, textAlign: 'center', marginTop: 28 }}>Workstation v1.0 · Lagos, Nigeria</Text>
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000070', justifyContent: 'center', padding: 24 }} onPress={() => !isDeleting && setShowDeleteModal(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#F5F0E8', borderRadius: 20, padding: 24 }}>
            <Text style={{ color: '#DC2626', fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Delete Account</Text>
            <Text style={{ color: '#1A1625', fontSize: 14, lineHeight: 20, marginBottom: 4 }}>
              This will permanently delete your company account, all job postings, applicant data, and team members.
            </Text>
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600', marginBottom: 20 }}>
              This action cannot be undone.
            </Text>
            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              Type DELETE to confirm
            </Text>
            <TextInput
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder="DELETE"
              placeholderTextColor="#C8BFB0"
              autoCapitalize="characters"
              style={{
                backgroundColor: '#EDE7DB',
                borderRadius: 10,
                borderWidth: 1.5,
                borderColor: deleteText === DELETE_CONFIRM_WORD ? '#DC2626' : '#DDD6C9',
                color: '#1A1625',
                fontSize: 16,
                fontWeight: '700',
                letterSpacing: 2,
                padding: 14,
                marginBottom: 20,
              }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
                className="active:opacity-70"
              >
                <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteAccount}
                disabled={deleteText !== DELETE_CONFIRM_WORD || isDeleting}
                style={{
                  flex: 1,
                  backgroundColor: deleteText === DELETE_CONFIRM_WORD ? '#DC2626' : '#DDD6C9',
                  borderRadius: 12,
                  paddingVertical: 13,
                  alignItems: 'center',
                  opacity: (deleteText !== DELETE_CONFIRM_WORD || isDeleting) ? 0.5 : 1,
                }}
                className="active:opacity-80"
              >
                {isDeleting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Delete forever</Text>
                }
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

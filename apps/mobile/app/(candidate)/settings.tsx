import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useState, useEffect } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { logEvent } from '@/lib/audit'

interface NotifPrefs {
  push_profile_viewed: boolean
  push_application: boolean
  push_email_opened: boolean
  push_interview: boolean
  push_badge: boolean
  push_job_match: boolean
  email_application: boolean
  email_interview: boolean
  email_badge: boolean
  email_job_match: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  push_profile_viewed: true,
  push_application: true,
  push_email_opened: true,
  push_interview: true,
  push_badge: true,
  push_job_match: true,
  email_application: true,
  email_interview: true,
  email_badge: true,
  email_job_match: true,
}

function Toggle({ value, onToggle }: { value: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        width: 44,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? '#FF6240' : '#3D3850',
        padding: 2,
        justifyContent: 'center',
        alignItems: value ? 'flex-end' : 'flex-start',
      }}
    >
      <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' }} />
    </Pressable>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{
      color: '#FF6240',
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: 12,
      marginTop: 24,
    }}>
      {title}
    </Text>
  )
}

function SettingToggleRow({
  label,
  sublabel,
  value,
  onToggle,
}: {
  label: string
  sublabel?: string
  value: boolean
  onToggle: () => void
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1B2E',
      }}
    >
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{ color: '#fff', fontSize: 14 }}>{label}</Text>
        {sublabel ? (
          <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{sublabel}</Text>
        ) : null}
      </View>
      <Toggle value={value} onToggle={onToggle} />
    </Pressable>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}>
      <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 2 }}>{label}</Text>
      <Text style={{ color: '#94A3B8', fontSize: 14 }}>{value}</Text>
    </View>
  )
}

function ActionRow({ label, onPress, destructive }: { label: string; onPress: () => void; destructive?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}
    >
      <Text style={{ color: destructive ? '#EF4444' : '#FF6240', fontSize: 14, fontWeight: '500' }}>
        {label}
      </Text>
    </Pressable>
  )
}

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_PREFS)
  const [isSavingPrefs, setIsSavingPrefs] = useState(false)

  const { data: loadedPrefs, isLoading } = useQuery<NotifPrefs | null>({
    queryKey: ['notif-prefs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notification_preferences')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle()
      return data as NotifPrefs | null
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    if (loadedPrefs) setPrefs(loadedPrefs)
  }, [loadedPrefs])

  const updatePref = async (key: keyof NotifPrefs, value: boolean) => {
    const updated = { ...prefs, [key]: value }
    setPrefs(updated)
    setIsSavingPrefs(true)
    try {
      await supabase
        .from('notification_preferences')
        .upsert({ user_id: user!.id, [key]: value }, { onConflict: 'user_id' })
    } finally {
      setIsSavingPrefs(false)
    }
  }

  const changePassword = async () => {
    const email = user?.email ?? ''
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Email sent', `We've sent a password reset link to ${email}`)
    }
  }

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          logEvent({ event: 'user.logout', app: 'candidate_app' })
          await supabase.auth.signOut()
          router.replace('/(auth)/login')
        },
      },
    ])
  }

  const handleDeactivate = () => {
    Alert.alert(
      'Deactivate account',
      'Your profile will be hidden from employers. You can reactivate at any time by logging back in.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            await supabase
              .from('candidate_profiles')
              .update({ is_open_to_work: false })
              .eq('id', user!.id)
            logEvent({ event: 'user.account_deleted', app: 'candidate_app', severity: 'warning', metadata: { type: 'deactivation' } })
            Alert.alert('Account deactivated', 'Your profile is now hidden from employers.')
          },
        },
      ]
    )
  }

  const handleDeleteData = () => {
    Alert.alert(
      'Delete all data',
      'To delete all your data, please contact our support team at support@workstation.ng. We process data deletion requests within 30 days.',
      [{ text: 'OK' }]
    )
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View style={{
        paddingHorizontal: 20,
        paddingTop: 8,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1B2E',
      }}>
        <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700' }}>Settings</Text>
      </View>

      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 60 }}
      >
        {/* Account */}
        <SectionHeader title="Account" />
        <View style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', borderRadius: 16, paddingHorizontal: 16, overflow: 'hidden' }}>
          <InfoRow label="Email address" value={user?.email ?? '—'} />
          <ActionRow label="Change password →" onPress={changePassword} />
        </View>

        {/* Push notifications */}
        <SectionHeader title="Push Notifications" />
        <View style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', borderRadius: 16, paddingHorizontal: 16, overflow: 'hidden' }}>
          <SettingToggleRow
            label="Profile viewed"
            sublabel="When a company views your profile"
            value={prefs.push_profile_viewed}
            onToggle={() => updatePref('push_profile_viewed', !prefs.push_profile_viewed)}
          />
          <SettingToggleRow
            label="Application updates"
            sublabel="Status changes on your applications"
            value={prefs.push_application}
            onToggle={() => updatePref('push_application', !prefs.push_application)}
          />
          <SettingToggleRow
            label="Email opened alerts"
            sublabel="When a company opens your application email"
            value={prefs.push_email_opened}
            onToggle={() => updatePref('push_email_opened', !prefs.push_email_opened)}
          />
          <SettingToggleRow
            label="Interview scheduled"
            sublabel="New interview invitations"
            value={prefs.push_interview}
            onToggle={() => updatePref('push_interview', !prefs.push_interview)}
          />
          <SettingToggleRow
            label="Badge issued"
            sublabel="When a company issues you a work badge"
            value={prefs.push_badge}
            onToggle={() => updatePref('push_badge', !prefs.push_badge)}
          />
          <SettingToggleRow
            label="Job matches"
            sublabel="New jobs matching your preferences"
            value={prefs.push_job_match}
            onToggle={() => updatePref('push_job_match', !prefs.push_job_match)}
          />
        </View>

        {/* Email notifications */}
        <SectionHeader title="Email Notifications" />
        <View style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#1E1B2E', borderRadius: 16, paddingHorizontal: 16, overflow: 'hidden' }}>
          <SettingToggleRow
            label="Application updates"
            value={prefs.email_application}
            onToggle={() => updatePref('email_application', !prefs.email_application)}
          />
          <SettingToggleRow
            label="Interview reminders"
            value={prefs.email_interview}
            onToggle={() => updatePref('email_interview', !prefs.email_interview)}
          />
          <SettingToggleRow
            label="Badge notifications"
            value={prefs.email_badge}
            onToggle={() => updatePref('email_badge', !prefs.email_badge)}
          />
          <SettingToggleRow
            label="Job matches"
            value={prefs.email_job_match}
            onToggle={() => updatePref('email_job_match', !prefs.email_job_match)}
          />
        </View>

        {isSavingPrefs ? (
          <Text style={{ color: '#64748B', fontSize: 12, textAlign: 'center', marginTop: 8 }}>Saving preferences…</Text>
        ) : null}

        {/* Support */}
        <SectionHeader title="Help & Support" />
        <View style={{
          backgroundColor: '#ffffff08',
          borderWidth: 1,
          borderColor: '#1E1B2E',
          borderRadius: 16,
          paddingHorizontal: 16,
          overflow: 'hidden',
          marginBottom: 16,
        }}>
          <ActionRow
            label="Chat with Support"
            onPress={() => router.push('/(candidate)/support-chat')}
          />
        </View>

        {/* Danger zone */}
        <SectionHeader title="Danger Zone" />
        <View style={{
          backgroundColor: '#EF444408',
          borderWidth: 1,
          borderColor: '#EF444440',
          borderRadius: 16,
          paddingHorizontal: 16,
          overflow: 'hidden',
        }}>
          <ActionRow label="Log out" onPress={handleLogout} destructive />
          <ActionRow label="Deactivate account" onPress={handleDeactivate} destructive />
          <ActionRow label="Delete all my data" onPress={handleDeleteData} destructive />
        </View>

        <Text style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 }}>
          Workstation v1.0.0 · workstation.ng
        </Text>
      </ScrollView>
    </SafeAreaView>
  )
}

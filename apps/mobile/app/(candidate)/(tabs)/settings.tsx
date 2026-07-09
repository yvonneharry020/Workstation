import {
  View, Text, Pressable, ScrollView,
  Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native'
import { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import Svg, { Path } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { logEvent } from '@/lib/audit'

const DELETE_PHRASE = 'DELETE MY ACCOUNT'

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10, marginTop: 24 }}>
      {title}
    </Text>
  )
}

function NavRow({ label, sub, onPress, danger }: { label: string; sub?: string; onPress: () => void; danger?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}
      className="active:opacity-70"
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: danger ? '#EF4444' : '#1A1625', fontSize: 14, fontWeight: '500' }}>{label}</Text>
        {sub && <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>{sub}</Text>}
      </View>
      {!danger && <ChevronIcon />}
    </Pressable>
  )
}

export default function SettingsScreen() {
  const user = useAuthStore((s) => s.user)
  const reset = useAuthStore((s) => s.reset)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const { isLoading } = useQuery({
    queryKey: ['settings-check', user?.id],
    queryFn: async () => {
      const { data } = await supabase.from('candidate_profiles').select('id').eq('id', user!.id).maybeSingle()
      return data
    },
    enabled: !!user?.id,
  })

  const handleLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: async () => {
          try { logEvent({ event: 'user.logout', app: 'candidate_app' }) } catch {}
          try { await supabase.auth.signOut() } catch {}
          reset()
          router.replace('/(auth)/welcome' as never)
        },
      },
    ])
  }

  const handleChangePassword = async () => {
    const email = user?.email ?? ''
    if (!email) return
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert('Email sent', `We've sent a password reset link to ${email}`)
    }
  }

  const handleDeleteAccount = async () => {
    if (deleteText !== DELETE_PHRASE) return
    setIsDeleting(true)
    try {
      logEvent({ event: 'user.account_deleted', app: 'candidate_app', severity: 'warning' })
      await supabase.rpc('delete_candidate_account')
      await supabase.auth.signOut()
      reset()
      setShowDeleteModal(false)
      router.replace('/(auth)/welcome' as never)
    } catch {
      Alert.alert('Error', 'Could not delete your account. Please contact support@workstation.ng')
      setIsDeleting(false)
    }
  }

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '700' }}>Settings</Text>
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 20 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>

        {/* Account */}
        <SectionHeader title="Account" />
        <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, overflow: 'hidden' }}>
          <NavRow label="Change password" sub="Reset via email link" onPress={handleChangePassword} />
          <NavRow label="Profile Template" sub="Choose how companies see your profile" onPress={() => router.push('/(candidate)/profile-template' as never)} />
          <NavRow label="Saved Job Posts" sub="Jobs you've bookmarked" onPress={() => router.push('/(candidate)/saved' as never)} />
        </View>

        {/* Interview Room */}
        <SectionHeader title="Interview" />
        <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, overflow: 'hidden' }}>
          <NavRow label="Interview Room" sub="Join a video or audio interview with a company" onPress={() => router.push('/(candidate)/interview-room' as never)} />
        </View>

        {/* Subscription */}
        <SectionHeader title="Subscription" />
        <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, overflow: 'hidden' }}>
          <NavRow label="Manage Subscription" sub="View your plan and upgrade options" onPress={() => router.push('/(candidate)/subscription' as never)} />
        </View>

        {/* Notifications */}
        <SectionHeader title="Notifications" />
        <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, overflow: 'hidden' }}>
          <NavRow
            label="Push Notifications"
            sub="Profile views, applications, interviews, badges"
            onPress={() => router.push('/(candidate)/push-notifications' as never)}
          />
          <NavRow
            label="Email Notifications"
            sub="Application updates, reminders, job matches"
            onPress={() => router.push('/(candidate)/email-notifications' as never)}
          />
        </View>

        {/* Help */}
        <SectionHeader title="Help & Support" />
        <View style={{ backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', borderRadius: 16, overflow: 'hidden' }}>
          <NavRow label="Chat with Support" onPress={() => router.push('/(candidate)/support-chat')} />
          <NavRow label="My Support Tickets" onPress={() => router.push('/(candidate)/support-ticket')} />
        </View>

        {/* Danger zone */}
        <SectionHeader title="Danger Zone" />
        <View style={{ backgroundColor: '#EF444408', borderWidth: 1, borderColor: '#EF444440', borderRadius: 16, overflow: 'hidden' }}>
          <NavRow label="Log out" onPress={handleLogout} danger />
          <NavRow
            label="Delete Account"
            sub="Permanently delete your data — cannot be undone"
            onPress={() => { setDeleteText(''); setShowDeleteModal(true) }}
            danger
          />
        </View>

        <Text style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 }}>
          Workstation v1.0.0 · workstation.ng
        </Text>
      </ScrollView>

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000070', justifyContent: 'center', padding: 24 }} onPress={() => !isDeleting && setShowDeleteModal(false)}>
          <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: '#F5F0E8', borderRadius: 20, padding: 24 }}>
            <Text style={{ color: '#DC2626', fontSize: 18, fontWeight: '800', marginBottom: 8 }}>Delete Account</Text>
            <Text style={{ color: '#1A1625', fontSize: 14, lineHeight: 20, marginBottom: 4 }}>
              This will permanently delete your profile, applications, CV, and all data. Companies will lose access to your information.
            </Text>
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600', marginBottom: 20 }}>
              This action cannot be undone.
            </Text>
            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>
              Type <Text style={{ fontWeight: '800', letterSpacing: 1 }}>{DELETE_PHRASE}</Text> to confirm
            </Text>
            <TextInput
              value={deleteText}
              onChangeText={setDeleteText}
              placeholder={DELETE_PHRASE}
              placeholderTextColor="#C8BFB0"
              autoCapitalize="characters"
              style={{
                backgroundColor: '#EDE7DB', borderRadius: 10, borderWidth: 1.5,
                borderColor: deleteText === DELETE_PHRASE ? '#DC2626' : '#DDD6C9',
                color: '#1A1625', fontSize: 13, fontWeight: '700', letterSpacing: 1,
                padding: 14, marginBottom: 20,
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
                disabled={deleteText !== DELETE_PHRASE || isDeleting}
                style={{
                  flex: 1, backgroundColor: deleteText === DELETE_PHRASE ? '#DC2626' : '#DDD6C9',
                  borderRadius: 12, paddingVertical: 13, alignItems: 'center',
                  opacity: (deleteText !== DELETE_PHRASE || isDeleting) ? 0.5 : 1,
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

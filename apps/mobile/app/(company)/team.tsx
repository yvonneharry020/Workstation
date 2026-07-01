import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PickerModal } from '@/components/ui/PickerModal'

type MemberRole = 'admin' | 'recruiter' | 'viewer'

interface TeamMember {
  id: string
  company_id: string
  member_id: string | null
  email: string
  role: MemberRole
  invited_at: string
  accepted_at: string | null
  is_active: boolean
  profile?: {
    full_name: string | null
    avatar_url: string | null
  }
}

const ROLE_CONFIG: Record<MemberRole, { label: string; color: string; bg: string }> = {
  admin: { label: 'Admin', color: '#FF6240', bg: '#FF624020' },
  recruiter: { label: 'Recruiter', color: '#0DD4C3', bg: '#0DD4C320' },
  viewer: { label: 'Viewer', color: '#64748B', bg: '#DDD6C9' },
}

const ROLE_OPTIONS: { label: string; value: string }[] = [
  { label: 'Admin — full access', value: 'admin' },
  { label: 'Recruiter — manage jobs & applicants', value: 'recruiter' },
  { label: 'Viewer — read only', value: 'viewer' },
]

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function getInitials(name: string | null | undefined, email: string): string {
  if (name) {
    return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  }
  return email[0]?.toUpperCase() ?? '?'
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days < 1) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function MemberRow({
  member,
  isCurrentUser,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember
  isCurrentUser: boolean
  onChangeRole: (id: string, role: MemberRole) => void
  onRemove: (id: string, email: string) => void
}) {
  const displayName = member.profile?.full_name ?? null
  const initials = getInitials(displayName, member.email)
  const roleConfig = ROLE_CONFIG[member.role]
  const isActive = !!member.accepted_at

  const handleRoleChange = () => {
    if (isCurrentUser) return
    Alert.alert('Change role', `Select a new role for ${displayName ?? member.email}`, [
      { text: 'Admin', onPress: () => onChangeRole(member.id, 'admin') },
      { text: 'Recruiter', onPress: () => onChangeRole(member.id, 'recruiter') },
      { text: 'Viewer', onPress: () => onChangeRole(member.id, 'viewer') },
      { text: 'Cancel', style: 'cancel' },
    ])
  }

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', marginBottom: 8 }}>
      <View style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: isCurrentUser ? '#FF624025' : '#DDD6C9', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ color: isCurrentUser ? '#FF6240' : '#64748B', fontSize: 14, fontWeight: '700' }}>{initials}</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }} numberOfLines={1}>
            {displayName ?? member.email}
            {isCurrentUser && <Text style={{ color: '#64748B', fontWeight: '400' }}> (you)</Text>}
          </Text>
        </View>
        {displayName && (
          <Text style={{ color: '#475569', fontSize: 11 }} numberOfLines={1}>{member.email}</Text>
        )}
        <Text style={{ color: isActive ? '#22C55E' : '#F59E0B', fontSize: 11, marginTop: 2 }}>
          {isActive ? `Active · joined ${timeAgo(member.accepted_at!)}` : `Pending invite · ${timeAgo(member.invited_at)}`}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <Pressable onPress={handleRoleChange} disabled={isCurrentUser} className="active:opacity-70">
          <View style={{ backgroundColor: roleConfig.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
            <Text style={{ color: roleConfig.color, fontSize: 11, fontWeight: '700' }}>{roleConfig.label}</Text>
          </View>
        </Pressable>
        {!isCurrentUser && (
          <Pressable
            onPress={() => onRemove(member.id, member.email)}
            className="active:opacity-70"
          >
            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '500' }}>Remove</Text>
          </Pressable>
        )}
      </View>
    </View>
  )
}

export default function TeamScreen() {
  const { user } = useAuthStore()
  const queryClient = useQueryClient()
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<string>('recruiter')
  const [emailError, setEmailError] = useState('')

  const { data: members, isLoading } = useQuery({
    queryKey: ['team-members', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_team_members')
        .select(`
          id, company_id, member_id, email, role, invited_at, accepted_at, is_active,
          profile:profiles!member_id(full_name, avatar_url)
        `)
        .eq('company_id', user!.id)
        .eq('is_active', true)
        .order('invited_at', { ascending: false })
      if (error) throw error
      return data as unknown as TeamMember[]
    },
    enabled: !!user?.id,
  })

  const changeRoleMutation = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: MemberRole }) => {
      const { error } = await supabase.from('company_team_members').update({ role }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('company_team_members').update({ is_active: false }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team-members'] }),
  })

  const inviteMutation = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: MemberRole }) => {
      const { error } = await supabase.from('company_team_members').insert({
        company_id: user!.id,
        email,
        role,
        invited_at: new Date().toISOString(),
        is_active: true,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members'] })
      setShowInviteModal(false)
      setInviteEmail('')
      setInviteRole('recruiter')
      Alert.alert('Invite sent', 'The team member will receive an email invitation.')
    },
    onError: () => {
      Alert.alert('Error', 'Could not send invitation. Please try again.')
    },
  })

  const handleInvite = () => {
    if (!isValidEmail(inviteEmail)) {
      setEmailError('Enter a valid email address')
      return
    }
    setEmailError('')
    inviteMutation.mutate({ email: inviteEmail.toLowerCase().trim(), role: inviteRole as MemberRole })
  }

  const handleRemove = (id: string, email: string) => {
    Alert.alert('Remove member', `Remove ${email} from your team?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removeMutation.mutate(id) },
    ])
  }

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
          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800' }}>Team Members</Text>
        </View>
        <Pressable
          onPress={() => setShowInviteModal(true)}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FF6240', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }}
          className="active:opacity-80"
        >
          <PlusIcon />
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700' }}>Invite</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : (
        <FlatList
          data={members ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <Animated.View entering={FadeInDown.delay(index * 50).duration(280)}>
              <MemberRow
                member={item}
                isCurrentUser={item.member_id === user?.id || item.email === user?.email}
                onChangeRole={(id, role) => changeRoleMutation.mutate({ id, role })}
                onRemove={handleRemove}
              />
            </Animated.View>
          )}
          contentContainerStyle={{ padding: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View className="items-center justify-center py-20">
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#EDE7DB', borderWidth: 1, borderColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#334155" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
                </Svg>
              </View>
              <Text style={{ color: '#475569', fontSize: 14, fontWeight: '500', marginBottom: 4 }}>No team members yet</Text>
              <Text style={{ color: '#334155', fontSize: 12 }}>Invite colleagues to collaborate</Text>
            </View>
          }
        />
      )}

      <Modal visible={showInviteModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={{ flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <View style={{ backgroundColor: '#F5F0E8', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36, borderTopWidth: 1, borderColor: '#DDD6C9' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>Invite team member</Text>
                <Pressable onPress={() => setShowInviteModal(false)} className="active:opacity-70">
                  <XIcon />
                </Pressable>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 8 }}>Email address</Text>
                <TextInput
                  value={inviteEmail}
                  onChangeText={(v) => { setInviteEmail(v); setEmailError('') }}
                  placeholder="colleague@company.com"
                  placeholderTextColor="#475569"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={{
                    backgroundColor: '#EDE7DB',
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: emailError ? '#EF4444' : '#DDD6C9',
                    color: '#1A1625',
                    fontSize: 15,
                    padding: 14,
                  }}
                />
                {emailError ? (
                  <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{emailError}</Text>
                ) : null}
              </View>

              <PickerModal
                label="Role"
                value={inviteRole}
                options={ROLE_OPTIONS}
                onSelect={setInviteRole}
                placeholder="Select role"
              />

              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 12, padding: 12, marginTop: 12, marginBottom: 20, borderWidth: 1, borderColor: '#DDD6C9' }}>
                <Text style={{ color: '#475569', fontSize: 12, lineHeight: 18 }}>
                  <Text style={{ color: '#FF6240', fontWeight: '600' }}>Admin</Text> — full access to all features{'\n'}
                  <Text style={{ color: '#0DD4C3', fontWeight: '600' }}>Recruiter</Text> — manage jobs and applicants{'\n'}
                  <Text style={{ color: '#64748B', fontWeight: '600' }}>Viewer</Text> — read-only access
                </Text>
              </View>

              <Pressable
                onPress={handleInvite}
                disabled={inviteMutation.isPending}
                style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
                className="active:opacity-80"
              >
                {inviteMutation.isPending
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }}>Send invitation</Text>
                }
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

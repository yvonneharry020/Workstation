import { useState, useEffect } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface EmailTemplate {
  id: string
  name: string
  subject: string
  body: string
  variables: string[]
  is_system: boolean
}

interface Recipient {
  id: string
  full_name: string
  avatar_url: string | null
  email: string | null
}

interface CandidateRow {
  candidate_id: string
  cp: { first_name: string; last_name: string; avatar_url: string | null; profiles: { email: string | null } | null } | null
}

interface CandidateRowWithProfiles {
  candidate_id: string
  profiles: { full_name: string | null; avatar_url: string | null; email: string | null } | null
}

const SYSTEM_TEMPLATES: EmailTemplate[] = [
  {
    id: 'sys-1',
    name: 'Application Received',
    subject: 'We received your application for {{jobTitle}}',
    body: 'Dear {{firstName}},\n\nThank you for applying for the {{jobTitle}} position at {{companyName}}. We have received your application and will review it shortly.\n\nWe will be in touch with next steps.\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-2',
    name: 'Shortlisted',
    subject: 'Great news! You have been shortlisted for {{jobTitle}}',
    body: 'Congratulations {{firstName}},\n\nWe are pleased to inform you that you have been shortlisted for the {{jobTitle}} role at {{companyName}}.\n\nWe will reach out soon to discuss next steps.\n\nBest regards,\n{{companyName}} Recruitment Team',
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
  {
    id: 'sys-3',
    name: 'Interview Invitation',
    subject: 'Interview invitation — {{jobTitle}} at {{companyName}}',
    body: "Dear {{firstName}},\n\nWe'd like to invite you to interview for the {{jobTitle}} position at {{companyName}}. Please check your interview portal for available time slots.\n\nLooking forward to speaking with you.\n\nBest regards,\n{{companyName}} Recruitment Team",
    variables: ['firstName', 'jobTitle', 'companyName'],
    is_system: true,
  },
]

function detectVariables(text: string): string[] {
  const matches = text.match(/\{\{(\w+)\}\}/g) ?? []
  return [...new Set(matches.map((m) => m.slice(2, -2)))]
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function XIcon({ color = '#5A4F6E' }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function UserIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
}

function RecipientChip({ recipient, onRemove }: { recipient: Recipient; onRemove: () => void }) {
  const initials = recipient.full_name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#DDD6C9', borderRadius: 20, paddingLeft: 6, paddingRight: 8, paddingVertical: 5, marginRight: 6, marginBottom: 6 }}>
      {recipient.avatar_url ? (
        <Image source={{ uri: recipient.avatar_url }} style={{ width: 22, height: 22, borderRadius: 11 }} />
      ) : (
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#FF624030', alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#FF6240', fontSize: 9, fontWeight: '700' }}>{initials}</Text>
        </View>
      )}
      <Text style={{ color: '#1A1625', fontSize: 12, fontWeight: '500' }} numberOfLines={1}>{recipient.full_name}</Text>
      <Pressable onPress={onRemove} hitSlop={8}>
        <XIcon />
      </Pressable>
    </View>
  )
}

export default function ComposeEmailScreen() {
  const { candidateIds, jobId, templateKey } = useLocalSearchParams<{ candidateIds?: string; jobId?: string; templateKey?: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates', user?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from('email_templates')
          .select('*')
          .or(`company_id.eq.${user!.id},is_system.eq.true`)
          .order('is_system', { ascending: false })
        if (error) throw error
        return (data as unknown as EmailTemplate[]) ?? []
      } catch {
        return SYSTEM_TEMPLATES
      }
    },
    enabled: !!user?.id,
  })

  const allTemplates = templates.length > 0 ? templates : SYSTEM_TEMPLATES

  const { data: candidateSearch = [] } = useQuery({
    queryKey: ['candidate-search-compose', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return []
      const { data } = await supabase
        .from('job_applications')
        .select('candidate_id, cp:candidate_id(first_name, last_name, avatar_url, profiles(email))')
        .limit(20)
      const rows = (data as unknown as CandidateRow[]) ?? []
      const unique = new Map<string, Recipient>()
      rows.forEach((r) => {
        if (r.cp && !unique.has(r.candidate_id)) {
          unique.set(r.candidate_id, {
            id: r.candidate_id,
            full_name: `${r.cp.first_name} ${r.cp.last_name}`.trim(),
            avatar_url: r.cp.avatar_url,
            email: r.cp.profiles?.email ?? null,
          })
        }
      })
      const term = searchQuery.toLowerCase()
      return [...unique.values()].filter((c) => c.full_name.toLowerCase().includes(term))
    },
    enabled: searchQuery.length >= 2,
  })

  useEffect(() => {
    if (!candidateIds || !user?.id) return
    const ids = candidateIds.split(',').filter(Boolean)
    if (ids.length === 0) return
    supabase
      .from('job_applications')
      .select('candidate_id, profiles:candidate_id(full_name, avatar_url, email)')
      .in('candidate_id', ids)
      .eq('company_id', user.id)
      .then(({ data }) => {
        const rows = (data as unknown as CandidateRowWithProfiles[]) ?? []
        const result: Recipient[] = rows.map((r) => ({
          id: r.candidate_id,
          full_name: r.profiles?.full_name ?? 'Unknown',
          avatar_url: r.profiles?.avatar_url ?? null,
          email: r.profiles?.email ?? null,
        }))
        setRecipients(result)
      })
  }, [candidateIds, user?.id])

  useEffect(() => {
    if (!templateKey) return
    const found = allTemplates.find((t) => t.id === templateKey || t.name.toLowerCase() === templateKey.toLowerCase())
    if (found) {
      setSubject(found.subject)
      setBody(found.body)
    }
  }, [templateKey, allTemplates])

  const sendMutation = useMutation({
    mutationFn: async () => {
      const rows = recipients.map((r) => ({
        company_id: user!.id,
        candidate_id: r.id,
        job_id: jobId ?? null,
        subject,
        body,
        sent_at: new Date().toISOString(),
      }))
      const { error } = await supabase.from('emails_sent').insert(rows)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-history'] })
      Alert.alert('Sent!', `Email sent to ${recipients.length} candidate${recipients.length !== 1 ? 's' : ''}.`)
      router.back()
    },
    onError: () => {
      Alert.alert('Error', 'Failed to send emails. Please try again.')
    },
  })

  const detectedVars = detectVariables(body)
  const firstRecipient = recipients[0]
  const previewBody = firstRecipient
    ? body
        .replace(/\{\{firstName\}\}/g, firstRecipient.full_name.split(' ')[0] ?? firstRecipient.full_name)
        .replace(/\{\{companyName\}\}/g, 'Your Company')
    : body

  const canSend = recipients.length > 0 && subject.trim().length > 0 && body.trim().length > 0

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
          <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
            <ArrowLeftIcon />
          </Pressable>
          <Text className="text-[#1A1625] text-2xl font-bold flex-1">Compose Email</Text>
          <Pressable
            onPress={() => setShowPreview((v) => !v)}
            style={{ backgroundColor: showPreview ? '#FF624020' : '#DDD6C9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 }}
          >
            <Text style={{ color: showPreview ? '#FF6240' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>
              {showPreview ? 'Edit' : 'Preview'}
            </Text>
          </Pressable>
        </View>

        {showPreview ? (
          <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20 }}>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>SUBJECT</Text>
              <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '600', marginBottom: 16 }}>
                {subject || '(no subject)'}
              </Text>
              <View style={{ height: 1, backgroundColor: '#DDD6C9', marginBottom: 16 }} />
              <Text style={{ color: '#1A1625', fontSize: 14, lineHeight: 22 }}>{previewBody || '(no body)'}</Text>
            </View>
            {firstRecipient && (
              <Text style={{ color: '#475569', fontSize: 12, marginTop: 12, textAlign: 'center' }}>
                Previewing with {firstRecipient.full_name}'s data
              </Text>
            )}
          </ScrollView>
        ) : (
          <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 120 }}>
            <View className="px-5 pt-4">
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>RECIPIENTS ({recipients.length})</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', padding: 10, minHeight: 50 }}>
                {recipients.map((r) => (
                  <RecipientChip key={r.id} recipient={r} onRemove={() => setRecipients((prev) => prev.filter((x) => x.id !== r.id))} />
                ))}
                <Pressable
                  onPress={() => setShowAddModal(true)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5 }}
                >
                  <PlusIcon />
                  <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Add more</Text>
                </Pressable>
              </View>
            </View>

            <View className="px-5 mt-5">
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>TEMPLATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {allTemplates.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => { setSubject(t.subject); setBody(t.body) }}
                      style={{ backgroundColor: '#EDE7DB', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: '#DDD6C9' }}
                    >
                      <Text style={{ color: '#1A1625', fontSize: 12, fontWeight: '500' }}>{t.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>

            <View className="px-5 mt-5">
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>SUBJECT</Text>
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder="Email subject line…"
                placeholderTextColor="#475569"
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14 }}
              />
            </View>

            <View className="px-5 mt-5">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600' }}>BODY</Text>
                <Text style={{ color: '#475569', fontSize: 11 }}>{body.length} chars</Text>
              </View>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write your email…"
                placeholderTextColor="#475569"
                multiline
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, minHeight: 180, textAlignVertical: 'top' }}
              />
            </View>

            {detectedVars.length > 0 && (
              <Animated.View entering={FadeInDown.duration(300)} className="px-5 mt-4">
                <View style={{ backgroundColor: '#0DD4C310', borderRadius: 12, borderWidth: 1, borderColor: '#0DD4C330', padding: 12 }}>
                  <Text style={{ color: '#0DD4C3', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>Template variables detected</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    {detectedVars.map((v) => (
                      <View key={v} style={{ backgroundColor: '#0DD4C320', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: '#0DD4C3', fontSize: 11, fontFamily: 'monospace' }}>{`{{${v}}}`}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={{ color: '#64748B', fontSize: 11, marginTop: 6 }}>These will be replaced with each candidate's real data.</Text>
                </View>
              </Animated.View>
            )}
          </ScrollView>
        )}

        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#F5F0E8', borderTopWidth: 1, borderTopColor: '#DDD6C9', padding: 16 }}>
          <Pressable
            onPress={() => sendMutation.mutate()}
            disabled={!canSend || sendMutation.isPending}
            style={{ backgroundColor: canSend ? '#FF6240' : '#3F2020', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: canSend ? '#1A1625' : '#6B3030', fontWeight: '700', fontSize: 15 }}>
                Send to {recipients.length} candidate{recipients.length !== 1 ? 's' : ''}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showAddModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowAddModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
            <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700', flex: 1 }}>Add Recipients</Text>
            <Pressable onPress={() => setShowAddModal(false)}><XIcon color="#fff" /></Pressable>
          </View>
          <View style={{ padding: 16 }}>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search candidates by name…"
              placeholderTextColor="#475569"
              style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14 }}
              autoFocus
            />
          </View>
          <FlatList
            data={candidateSearch}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => {
              const already = recipients.some((r) => r.id === item.id)
              const initials = item.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
              return (
                <Pressable
                  onPress={() => {
                    if (!already) setRecipients((prev) => [...prev, item])
                  }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, opacity: already ? 0.5 : 1 }}
                >
                  {item.avatar_url ? (
                    <Image source={{ uri: item.avatar_url }} style={{ width: 38, height: 38, borderRadius: 19 }} />
                  ) : (
                    <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: '#FF624025', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700' }}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }}>{item.full_name}</Text>
                    {item.email && <Text style={{ color: '#64748B', fontSize: 12 }}>{item.email}</Text>}
                  </View>
                  {already && <Text style={{ color: '#0DD4C3', fontSize: 12 }}>Added</Text>}
                </Pressable>
              )
            }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <UserIcon />
                <Text style={{ color: '#475569', fontSize: 14, marginTop: 12 }}>
                  {searchQuery.length < 2 ? 'Type at least 2 characters to search' : 'No candidates found'}
                </Text>
              </View>
            }
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  )
}

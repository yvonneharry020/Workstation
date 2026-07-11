import {
  View,
  Text,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, router } from 'expo-router'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type Tab = 'messages' | 'application'

interface NotificationItem {
  id: string
  type: string
  title: string | null
  body: string | null
  data: Record<string, unknown> | null
  created_at: string
  is_read: boolean
}

interface ApplicationDetail {
  id: string
  pipeline_stage: string
  cover_note: string | null
  screening_answers: Record<string, string> | null
  submitted_at: string
  job_postings: {
    title: string
    screening_questions: { question: string }[] | null
    company_profiles: {
      company_name: string
      logo_url: string | null
    } | null
  } | null
}

const DEFAULT_STAGE_STYLE = { bg: '#EFF6FF', text: '#3B82F6', label: 'Applied' }

const STAGE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  new:                 DEFAULT_STAGE_STYLE,
  reviewed:            { bg: '#F5F3FF', text: '#8B5CF6', label: 'Reviewing' },
  shortlisted:         { bg: '#F9F1E8', text: '#7C4B2A', label: 'Shortlisted' },
  interview_scheduled: { bg: '#FFFBEB', text: '#F59E0B', label: 'Interview' },
  hired:               { bg: '#F0FDF4', text: '#22C55E', label: 'Hired' },
  rejected:            { bg: '#FEF2F2', text: '#EF4444', label: 'Rejected' },
  withdrawn:           { bg: '#F8FAFC', text: '#64748B', label: 'Withdrawn' },
}

function getMessageTitle(notif: NotificationItem): string {
  if (notif.type === 'interview_scheduled') return 'Interview Appointment'
  if (notif.type === 'application_update') {
    const stage = (notif.data?.new_stage ?? notif.data?.stage ?? '') as string
    if (stage === 'reviewed')   return 'Application Under Review'
    if (stage === 'shortlisted') return "Great News — You've Been Shortlisted"
    if (stage === 'hired')       return 'Offer Received — You\'re Hired!'
    if (stage === 'rejected')    return 'Application Decision'
    return 'Application Update'
  }
  return notif.title ?? 'Message from Company'
}

function getMessageColor(notif: NotificationItem): string {
  if (notif.type === 'interview_scheduled') return '#F59E0B'
  if (notif.type === 'application_update') {
    const stage = (notif.data?.new_stage ?? notif.data?.stage ?? '') as string
    if (stage === 'shortlisted') return '#7C4B2A'
    if (stage === 'hired')       return '#22C55E'
    if (stage === 'rejected')    return '#EF4444'
    if (stage === 'reviewed')    return '#8B5CF6'
  }
  return '#FF6240'
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d={open ? 'M18 15l-6-6-6 6' : 'M6 9l6 6 6-6'} />
    </Svg>
  )
}

function MessageCard({ notif, companyName }: { notif: NotificationItem; companyName: string }) {
  const [expanded, setExpanded] = useState(false)
  const color = getMessageColor(notif)
  const title = getMessageTitle(notif)
  const date = new Date(notif.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      style={{
        backgroundColor: '#F0EBE1', borderRadius: 16, borderWidth: 1,
        borderColor: '#DDD6C9', marginBottom: 10, overflow: 'hidden',
      }}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, backgroundColor: color }} />
      <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingLeft: 18, gap: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#94A3B8', fontSize: 10, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 }}>
            {companyName}
          </Text>
          <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '700', lineHeight: 18 }}>{title}</Text>
          <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>{date}</Text>
        </View>
        <ChevronIcon open={expanded} />
      </View>
      {expanded && notif.body ? (
        <View style={{ paddingHorizontal: 18, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#DDD6C9' }}>
          <Text style={{ color: '#334155', fontSize: 13, lineHeight: 20, marginTop: 12 }}>{notif.body}</Text>
        </View>
      ) : null}
    </Pressable>
  )
}

function WithdrawModal({
  visible,
  onCancel,
  onProceed,
  loading,
}: {
  visible: boolean
  onCancel: () => void
  onProceed: () => void
  loading: boolean
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#00000070', justifyContent: 'center', padding: 24 }}
        onPress={() => !loading && onCancel()}
      >
        <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#F5F0E8', borderRadius: 20, padding: 24 }}>
          <Text style={{ color: '#EF4444', fontSize: 18, fontWeight: '800', marginBottom: 10 }}>Withdraw Application</Text>
          <Text style={{ color: '#1A1625', fontSize: 14, lineHeight: 22, marginBottom: 20 }}>
            If you withdraw this application, the company will no longer see it and you will not be able to apply for this job again. This cannot be undone.
          </Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={{ flex: 1, backgroundColor: '#DDD6C9', borderRadius: 12, paddingVertical: 13, alignItems: 'center' }}
            >
              <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={onProceed}
              disabled={loading}
              style={{
                flex: 1, backgroundColor: '#EF4444', borderRadius: 12,
                paddingVertical: 13, alignItems: 'center',
                opacity: loading ? 0.5 : 1,
              }}
            >
              {loading
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>Proceed</Text>
              }
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

export default function ApplicationDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<Tab>('messages')
  const [showWithdraw, setShowWithdraw] = useState(false)

  const { data: application, isLoading: loadingApp } = useQuery({
    queryKey: ['application-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_applications')
        .select(`
          id, pipeline_stage, cover_note, screening_answers, submitted_at,
          job_postings (
            title, screening_questions,
            company_profiles ( company_name, logo_url )
          )
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as ApplicationDetail
    },
    enabled: !!id,
  })

  const { data: messages = [], isLoading: loadingMessages } = useQuery({
    queryKey: ['application-messages', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('id, type, title, body, data, created_at, is_read')
        .eq('user_id', user!.id)
        .filter('data->>application_id', 'eq', id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as NotificationItem[]
    },
    enabled: !!id && !!user?.id,
  })

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('job_applications')
        .update({ pipeline_stage: 'withdrawn' })
        .eq('id', id)
        .eq('candidate_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      setShowWithdraw(false)
      queryClient.invalidateQueries({ queryKey: ['my-applications', user?.id] })
      queryClient.invalidateQueries({ queryKey: ['application-detail', id] })
      router.back()
    },
    onError: () => {
      Alert.alert('Error', 'Could not withdraw application. Please try again.')
    },
  })

  const job = application?.job_postings
  const company = job?.company_profiles
  const stage = STAGE_STYLES[application?.pipeline_stage ?? 'new'] ?? DEFAULT_STAGE_STYLE
  const screeningQuestions = (job?.screening_questions ?? []) as { question: string }[]
  const screeningAnswers = (application?.screening_answers ?? {}) as Record<string, string>

  const isWithdrawn = application?.pipeline_stage === 'withdrawn'

  if (loadingApp) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>
            {job?.title ?? 'Application'}
          </Text>
          <Text style={{ color: '#64748B', fontSize: 12 }}>{company?.company_name ?? ''}</Text>
        </View>
        <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, backgroundColor: stage.bg, borderWidth: 1, borderColor: `${stage.text}30` }}>
          <Text style={{ color: stage.text, fontSize: 11, fontWeight: '700' }}>{stage.label}</Text>
        </View>
      </View>

      {/* Tab pills */}
      <View style={{ flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 10, gap: 10, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
        {([
          { key: 'messages' as Tab,     label: 'Application Messages' },
          { key: 'application' as Tab,  label: 'My Application' },
        ]).map((t) => {
          const isActive = activeTab === t.key
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={{
                flex: 1, paddingVertical: 9, borderRadius: 12,
                backgroundColor: isActive ? '#FF6240' : '#F0EBE1',
                borderWidth: 1,
                borderColor: isActive ? '#FF6240' : '#DDD6C9',
                alignItems: 'center',
              }}
            >
              <Text style={{ color: isActive ? '#fff' : '#64748B', fontSize: 12, fontWeight: isActive ? '700' : '400' }}>
                {t.label}
              </Text>
            </Pressable>
          )
        })}
      </View>

      {/* Tab content */}
      {activeTab === 'messages' ? (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          {loadingMessages ? (
            <ActivityIndicator color="#FF6240" style={{ marginTop: 40 }} />
          ) : messages.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 24 }}>
              <Text style={{ fontSize: 40, marginBottom: 16 }}>📬</Text>
              <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '600', textAlign: 'center', marginBottom: 8 }}>
                No messages yet
              </Text>
              <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', lineHeight: 20 }}>
                Messages from the company — like interview invitations and status updates — will appear here.
              </Text>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInDown.duration(300)}>
              {messages.map((m) => (
                <MessageCard key={m.id} notif={m} companyName={company?.company_name ?? 'Company'} />
              ))}
            </Animated.View>
          )}
        </ScrollView>
      ) : (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={FadeInDown.duration(300)}>
            {/* Submitted date */}
            <Text style={{ color: '#94A3B8', fontSize: 12, marginBottom: 16 }}>
              Submitted {application?.submitted_at ? new Date(application.submitted_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '—'}
            </Text>

            {/* Cover letter */}
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 16 }}>
              <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                Cover Letter
              </Text>
              <Text style={{ color: application?.cover_note ? '#1A1625' : '#94A3B8', fontSize: 14, lineHeight: 22 }}>
                {application?.cover_note ?? 'No cover letter provided.'}
              </Text>
            </View>

            {/* Screening Q&A */}
            {screeningQuestions.length > 0 && (
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 24 }}>
                <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
                  Screening Questions
                </Text>
                {screeningQuestions.map((q, idx) => {
                  const answer = screeningAnswers[`q${idx}`] ?? screeningAnswers[String(idx)] ?? screeningAnswers[q.question] ?? ''
                  return (
                    <View key={idx} style={{ marginBottom: idx < screeningQuestions.length - 1 ? 16 : 0 }}>
                      <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>
                        {idx + 1}. {q.question}
                      </Text>
                      <Text style={{ color: answer ? '#1A1625' : '#94A3B8', fontSize: 14, lineHeight: 20 }}>
                        {answer || 'No answer provided.'}
                      </Text>
                    </View>
                  )
                })}
              </View>
            )}

            {/* Withdraw button */}
            {!isWithdrawn && (
              <Pressable
                onPress={() => setShowWithdraw(true)}
                style={{
                  backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
                  borderRadius: 14, paddingVertical: 14, alignItems: 'center',
                }}
              >
                <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 14 }}>Withdraw Application</Text>
              </Pressable>
            )}

            {isWithdrawn && (
              <View style={{ backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 14, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#64748B', fontSize: 14, fontWeight: '600' }}>Application Withdrawn</Text>
              </View>
            )}
          </Animated.View>
        </ScrollView>
      )}

      <WithdrawModal
        visible={showWithdraw}
        onCancel={() => setShowWithdraw(false)}
        onProceed={() => withdrawMutation.mutate()}
        loading={withdrawMutation.isPending}
      />
    </SafeAreaView>
  )
}

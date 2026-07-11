import { useState } from 'react'
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
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { Image } from 'expo-image'
import DateTimePicker from '@react-native-community/datetimepicker'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface JobOption {
  id: string
  title: string
}

interface Candidate {
  id: string
  full_name: string
  avatar_url: string | null
  application_id: string
}

interface SlotCreated {
  id: string
  slot_date: string
  start_time: string
  duration_mins: number
  meeting_type: string
  meeting_link: string | null
  company_message: string | null
}

type MeetingType = 'interview' | 'in_person'

const DURATION_OPTIONS = [30, 45, 60]

const MEETING_TYPES: { key: MeetingType; label: string }[] = [
  { key: 'interview', label: 'Interview' },
  { key: 'in_person', label: 'In-person' },
]

function formatDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })
}

function nextNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

function ClockIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#5A4F6E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 6v6l4 2" />
    </Svg>
  )
}

function CheckCircleIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

function AlertCircleIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 8v4M12 16h.01" />
    </Svg>
  )
}

function StepBar({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 16 }}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? '#FF6240' : '#DDD6C9' }} />
      ))}
    </View>
  )
}

function CandidateRow({ candidate }: { candidate: Candidate }) {
  const initials = getInitials(candidate.full_name)
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
      {candidate.avatar_url ? (
        <Image source={{ uri: candidate.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} contentFit="cover" />
      ) : (
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '700' }}>{initials}</Text>
        </View>
      )}
      <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '500', flex: 1 }}>{candidate.full_name}</Text>
    </View>
  )
}

export default function InterviewScheduleScreen() {
  const { jobId: paramJobId, candidateId: paramCandidateId, applicationId: paramApplicationId } =
    useLocalSearchParams<{ jobId?: string; candidateId?: string; applicationId?: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const isIndividual = !!paramCandidateId

  const [step, setStep] = useState(paramJobId ? 2 : 1)
  const [selectedJobId, setSelectedJobId] = useState(paramJobId ?? '')
  const [selectedDate, setSelectedDate] = useState(nextNDays(14)[0])
  const [timeDate, setTimeDate] = useState(() => {
    const d = new Date()
    d.setHours(9, 0, 0, 0)
    return d
  })
  const [showTimePicker, setShowTimePicker] = useState(false)
  const [duration, setDuration] = useState(60)
  const [meetingType, setMeetingType] = useState<MeetingType>('interview')
  const [meetingLink, setMeetingLink] = useState('')
  const [companyMessage, setCompanyMessage] = useState('')
  const [slots, setSlots] = useState<SlotCreated[]>([])
  const [confirmModal, setConfirmModal] = useState({ visible: false, success: false, count: 0 })
  const [showAddressGate, setShowAddressGate] = useState(false)

  const { data: addressVerified } = useQuery({
    queryKey: ['company-address-verified', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_verification')
        .select('documents_status')
        .eq('company_id', user!.id)
        .maybeSingle()
      return data?.documents_status === 'approved'
    },
    enabled: !!user?.id,
  })

  const handleMeetingTypeSelect = (key: MeetingType) => {
    if (key === 'in_person' && !addressVerified) {
      setShowAddressGate(true)
      return
    }
    setMeetingType(key)
  }

  const days = nextNDays(14)
  const startTime = `${String(timeDate.getHours()).padStart(2, '0')}:${String(timeDate.getMinutes()).padStart(2, '0')}`

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['company-active-jobs', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_postings')
        .select('id, title')
        .eq('company_id', user!.id)
        .eq('status', 'active')
      return (data as unknown as JobOption[]) ?? []
    },
    enabled: !!user?.id && step === 1,
  })

  const { data: candidates = [], isLoading: candidatesLoading } = useQuery({
    queryKey: ['interview-candidates', selectedJobId],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_applications')
        .select('id, candidate_id, candidate_profiles!candidate_id(first_name, last_name, avatar_url)')
        .eq('job_id', selectedJobId)
        .eq('pipeline_stage', 'interview_scheduled')
      const rows = (data as unknown as {
        id: string
        candidate_id: string
        candidate_profiles: { first_name: string; last_name: string; avatar_url: string | null } | null
      }[]) ?? []
      return rows.map((r) => ({
        id: r.candidate_id,
        full_name: `${r.candidate_profiles?.first_name ?? ''} ${r.candidate_profiles?.last_name ?? ''}`.trim() || 'Unknown',
        avatar_url: r.candidate_profiles?.avatar_url ?? null,
        application_id: r.id,
      })) as Candidate[]
    },
    enabled: !!selectedJobId && step >= 2 && !isIndividual,
  })

  const { data: individualCandidate } = useQuery({
    queryKey: ['candidate-for-interview', paramCandidateId],
    queryFn: async () => {
      const { data } = await supabase
        .from('candidate_profiles')
        .select('first_name, last_name, avatar_url')
        .eq('id', paramCandidateId!)
        .maybeSingle()
      if (!data) return null
      return {
        id: paramCandidateId!,
        full_name: `${data.first_name ?? ''} ${data.last_name ?? ''}`.trim() || 'Candidate',
        avatar_url: (data as { avatar_url?: string | null }).avatar_url ?? null,
        application_id: paramApplicationId!,
      } as Candidate
    },
    enabled: isIndividual && !!paramCandidateId,
  })

  const reviewList: Candidate[] = isIndividual
    ? (individualCandidate ? [individualCandidate] : [])
    : candidates

  const addSlotMutation = useMutation({
    mutationFn: async () => {
      const [hh, mm] = startTime.split(':')
      const h = parseInt(hh ?? '9', 10)
      const m = parseInt(mm ?? '0', 10)
      const endH = Math.floor((h * 60 + m + duration) / 60)
      const endM = (h * 60 + m + duration) % 60
      const endTime = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

      const { data, error } = await supabase
        .from('interview_slots')
        .insert({
          company_id: user!.id,
          job_id: selectedJobId,
          created_by: user!.id,
          slot_date: selectedDate,
          start_time: startTime,
          end_time: endTime,
          duration_mins: duration,
          meeting_type: meetingType,
          meeting_link: meetingType === 'in_person' ? meetingLink || null : null,
          company_message: companyMessage.trim() || null,
          is_booked: false,
        })
        .select('id, slot_date, start_time, duration_mins, meeting_type, meeting_link, company_message')
        .single()
      if (error) throw error
      return data as unknown as SlotCreated
    },
    onSuccess: (slot) => {
      setSlots((prev) => [...prev, slot])
      queryClient.invalidateQueries({ queryKey: ['interview-calendar'] })
    },
    onError: () => Alert.alert('Error', 'Could not add slot. Please try again.'),
  })

  const deleteSlotMutation = useMutation({
    mutationFn: async (slotId: string) => {
      const { error } = await supabase.from('interview_slots').delete().eq('id', slotId)
      if (error) throw error
    },
    onSuccess: (_, slotId) => setSlots((prev) => prev.filter((s) => s.id !== slotId)),
  })

  const sendInterviewMutation = useMutation({
    mutationFn: async () => {
      const targets = reviewList
      if (targets.length === 0) throw new Error('No candidates to notify')

      let successCount = 0

      for (let i = 0; i < targets.length; i++) {
        const candidate = targets[i]
        const slot = slots.length > 0 ? slots[i % slots.length] : null

        if (slot) {
          const { error: bookErr } = await supabase.from('interview_bookings').insert({
            slot_id: slot.id,
            application_id: candidate.application_id,
            candidate_id: candidate.id,
            company_id: user!.id,
            status: 'booked',
          })
          if (bookErr) throw bookErr
        }

        const dateStr = slot
          ? new Date(slot.slot_date + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })
          : ''
        const timeStr = slot ? slot.start_time.slice(0, 5) : ''
        const body = companyMessage.trim()
          ? `${companyMessage.trim()}${slot ? ` — ${dateStr} at ${timeStr}` : ''}`
          : slot
          ? `Your interview is scheduled for ${dateStr} at ${timeStr} (${slot.duration_mins}min).`
          : 'You have been invited to an interview. Check the app for details.'

        await supabase.from('notifications').insert({
          user_id: candidate.id,
          type: 'interview_scheduled',
          title: 'Interview invitation',
          body,
          data: { slot_id: slot?.id ?? null, application_id: candidate.application_id },
          action_url: null,
        })

        successCount++
      }

      return successCount
    },
    onSuccess: (count) => {
      setConfirmModal({ visible: true, success: true, count })
      queryClient.invalidateQueries({ queryKey: ['interview-calendar'] })
    },
    onError: () => {
      setConfirmModal({ visible: true, success: false, count: 0 })
    },
  })

  const handleModalClose = () => {
    setConfirmModal((prev) => ({ ...prev, visible: false }))
    if (confirmModal.success) {
      if (selectedJobId) {
        router.replace({ pathname: '/(company)/jobs/[id]' as never, params: { id: selectedJobId } })
      } else {
        router.replace('/(company)/(tabs)/applicants' as never)
      }
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable
          onPress={() => { if (step > 1) setStep((s) => s - 1); else router.back() }}
          className="mr-3 active:opacity-70"
        >
          <ArrowLeftIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '800', flex: 1 }}>Interview Scheduler</Text>
        <Text style={{ color: '#475569', fontSize: 13 }}>Step {step}/3</Text>
      </View>
      <StepBar step={step} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }}>

          {/* STEP 1 — Select job */}
          {step === 1 && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Select a Job</Text>
              <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>Which role are you scheduling interviews for?</Text>
              {jobsLoading ? (
                <ActivityIndicator color="#FF6240" />
              ) : (
                jobs.map((job) => (
                  <Pressable
                    key={job.id}
                    onPress={() => { setSelectedJobId(job.id); setStep(2) }}
                    style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1.5, borderColor: selectedJobId === job.id ? '#FF6240' : '#DDD6C9', padding: 16, marginBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }}>{job.title}</Text>
                    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth={2}><Path d="M9 18l6-6-6-6" /></Svg>
                  </Pressable>
                ))
              )}
            </Animated.View>
          )}

          {/* STEP 2 — Create time slots */}
          {step === 2 && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Create Time Slots</Text>
              <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>Add available slots for candidates to book.</Text>

              {/* Date picker */}
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>SELECT DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {days.map((d) => {
                    const isSelected = d === selectedDate
                    const label = new Date(d + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' })
                    return (
                      <Pressable
                        key={d}
                        onPress={() => setSelectedDate(d)}
                        style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: isSelected ? '#FF6240' : '#EDE7DB', borderWidth: 1, borderColor: isSelected ? '#FF6240' : '#DDD6C9', alignItems: 'center', minWidth: 64 }}
                      >
                        <Text style={{ color: isSelected ? '#1A1625' : '#5A4F6E', fontSize: 12, fontWeight: '600' }}>{label.split(' ')[0]}</Text>
                        <Text style={{ color: isSelected ? '#1A1625' : '#64748B', fontSize: 16, fontWeight: '700' }}>{label.split(' ')[1]}</Text>
                      </Pressable>
                    )
                  })}
                </View>
              </ScrollView>

              {/* Time picker */}
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>START TIME</Text>
              <Pressable
                onPress={() => setShowTimePicker(true)}
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '600', letterSpacing: 1 }}>{startTime}</Text>
                <ClockIcon />
              </Pressable>
              {showTimePicker && (
                <DateTimePicker
                  value={timeDate}
                  mode="time"
                  is24Hour
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_, date) => {
                    setShowTimePicker(Platform.OS === 'ios')
                    if (date) setTimeDate(date)
                  }}
                />
              )}

              {/* Duration */}
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>DURATION</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {DURATION_OPTIONS.map((d) => (
                  <Pressable
                    key={d}
                    onPress={() => setDuration(d)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: duration === d ? '#FF624020' : '#EDE7DB', borderWidth: 1, borderColor: duration === d ? '#FF6240' : '#DDD6C9', alignItems: 'center' }}
                  >
                    <Text style={{ color: duration === d ? '#FF6240' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>{d}m</Text>
                  </Pressable>
                ))}
              </View>

              {/* Meeting type */}
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>MEETING TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {MEETING_TYPES.map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => handleMeetingTypeSelect(t.key)}
                    style={{ flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: meetingType === t.key ? '#FF624020' : '#EDE7DB', borderWidth: 1, borderColor: meetingType === t.key ? '#FF6240' : '#DDD6C9', alignItems: 'center' }}
                  >
                    <Text style={{ color: meetingType === t.key ? '#FF6240' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Meeting link — only for in-person */}
              {meetingType === 'in_person' && (
                <>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>MEETING LOCATION / CODE</Text>
                  <TextInput
                    value={meetingLink}
                    onChangeText={setMeetingLink}
                    placeholder="e.g. 12 Victoria Island, Lagos or Room 4B"
                    placeholderTextColor="#475569"
                    autoCapitalize="none"
                    style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
                  />
                </>
              )}

              {/* Message */}
              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>MESSAGE TO CANDIDATE</Text>
              <TextInput
                value={companyMessage}
                onChangeText={setCompanyMessage}
                placeholder="e.g. Please bring a copy of your CV and portfolio…"
                placeholderTextColor="#475569"
                multiline
                textAlignVertical="top"
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, minHeight: 80, marginBottom: 16 }}
              />

              {/* Add slot button */}
              <Pressable
                onPress={() => addSlotMutation.mutate()}
                disabled={addSlotMutation.isPending}
                style={{ backgroundColor: addSlotMutation.isPending ? '#DDD6C9' : '#FF6240', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}
              >
                {addSlotMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: '#1A1625', fontWeight: '700' }}>+ Add slot</Text>
                )}
              </Pressable>

              {/* Slots list */}
              {slots.length > 0 && (
                <View>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 10 }}>SLOTS CREATED ({slots.length})</Text>
                  {slots.map((s) => (
                    <View key={s.id} style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#0DD4C330', padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '600' }}>
                          {formatDate(s.slot_date)} · {s.start_time.slice(0, 5)}
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 12 }}>
                          {s.duration_mins}min · {s.meeting_type === 'interview' ? 'Interview room' : 'In-person'}
                        </Text>
                      </View>
                      <Pressable onPress={() => deleteSlotMutation.mutate(s.id)} hitSlop={10}>
                        <TrashIcon />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Next button */}
              <Pressable
                onPress={() => setStep(3)}
                disabled={slots.length === 0}
                style={{ backgroundColor: slots.length > 0 ? '#FF6240' : '#DDD6C9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 }}
              >
                <Text style={{ color: slots.length > 0 ? '#1A1625' : '#475569', fontWeight: '700', fontSize: 15 }}>
                  Next: Review candidates →
                </Text>
              </Pressable>
            </Animated.View>
          )}

          {/* STEP 3 — Review candidates and send */}
          {step === 3 && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Review & Send</Text>
              <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>
                {isIndividual
                  ? 'Confirm this candidate will receive the interview invite.'
                  : 'Confirm all candidates below will receive the interview invite.'}
              </Text>

              {/* Slots summary */}
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
                  Slots created ({slots.length})
                </Text>
                {slots.map((s) => (
                  <Text key={s.id} style={{ color: '#1A1625', fontSize: 13, fontWeight: '500', marginBottom: 4 }}>
                    {formatDate(s.slot_date)} · {s.start_time.slice(0, 5)} · {s.duration_mins}min
                  </Text>
                ))}
              </View>

              {/* Candidates list */}
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 20 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
                  Candidates receiving invite ({reviewList.length})
                </Text>
                {candidatesLoading && !isIndividual ? (
                  <ActivityIndicator color="#FF6240" style={{ marginVertical: 16 }} />
                ) : reviewList.length === 0 ? (
                  <View style={{ paddingVertical: 24, alignItems: 'center' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>
                      {isIndividual ? 'Loading candidate…' : 'No candidates in the interview stage for this job yet.'}
                    </Text>
                  </View>
                ) : (
                  reviewList.map((c) => <CandidateRow key={c.id} candidate={c} />)
                )}
              </View>

              {/* Send button */}
              <Pressable
                onPress={() => sendInterviewMutation.mutate()}
                disabled={sendInterviewMutation.isPending || reviewList.length === 0}
                style={{
                  backgroundColor: sendInterviewMutation.isPending || reviewList.length === 0 ? '#DDD6C9' : '#FF6240',
                  borderRadius: 14,
                  paddingVertical: 16,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {sendInterviewMutation.isPending ? (
                  <>
                    <ActivityIndicator color="#1A1625" size="small" />
                    <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Sending…</Text>
                  </>
                ) : (
                  <Text style={{ color: reviewList.length > 0 ? '#1A1625' : '#475569', fontWeight: '700', fontSize: 15 }}>
                    Send Interview
                  </Text>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Business address not verified */}
      <Modal visible={showAddressGate} transparent animationType="fade" onRequestClose={() => setShowAddressGate(false)}>
        <Pressable style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'center', padding: 24 }} onPress={() => setShowAddressGate(false)}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#F5F0E8', borderRadius: 20, padding: 28, alignItems: 'center' }}>
            <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#F5970015', borderWidth: 1, borderColor: '#F5970030', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
              <AlertCircleIcon />
            </View>
            <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
              Business address not verified
            </Text>
            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              To invite candidates for an in-person interview, your business address needs to be verified first — this confirms candidates are being sent to a real, registered office.
            </Text>
            <Pressable
              onPress={() => { setShowAddressGate(false); router.push('/(company)/business-verification' as never) }}
              style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 14, width: '100%', alignItems: 'center', marginBottom: 10 }}
            >
              <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Go to Business Verification</Text>
            </Pressable>
            <Pressable onPress={() => setShowAddressGate(false)} style={{ paddingVertical: 6 }}>
              <Text style={{ color: '#64748B', fontSize: 13, fontWeight: '600' }}>Not now</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Success / Failure modal */}
      <Modal
        visible={confirmModal.visible}
        transparent
        animationType="fade"
        onRequestClose={handleModalClose}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'center', padding: 24 }}
          onPress={handleModalClose}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            style={{ backgroundColor: '#F5F0E8', borderRadius: 20, padding: 28, alignItems: 'center' }}
          >
            <View style={{
              width: 72, height: 72, borderRadius: 36,
              backgroundColor: confirmModal.success ? '#22C55E15' : '#EF444415',
              borderWidth: 1,
              borderColor: confirmModal.success ? '#22C55E30' : '#EF444430',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              {confirmModal.success ? <CheckCircleIcon /> : <AlertCircleIcon />}
            </View>

            <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '800', marginBottom: 8, textAlign: 'center' }}>
              {confirmModal.success ? 'Invites sent!' : 'Something went wrong'}
            </Text>

            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
              {confirmModal.success
                ? `${confirmModal.count} candidate${confirmModal.count !== 1 ? 's' : ''} ${confirmModal.count !== 1 ? 'have' : 'has'} been notified about the interview.`
                : 'Could not send interview invites. Please try again.'}
            </Text>

            <Pressable
              onPress={handleModalClose}
              style={{
                backgroundColor: confirmModal.success ? '#22C55E' : '#FF6240',
                borderRadius: 14, paddingVertical: 14,
                width: '100%', alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
                {confirmModal.success ? 'View schedule' : 'Try again'}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  )
}

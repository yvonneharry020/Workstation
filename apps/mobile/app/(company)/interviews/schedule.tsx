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
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface JobOption {
  id: string
  title: string
  application_count: number
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

type MeetingType = 'zoom' | 'google_meet' | 'in_person'

const DURATION_OPTIONS = [30, 45, 60, 90]

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })
}

function nextNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d.toISOString().slice(0, 10)
  })
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
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

function StepBar({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 20, paddingVertical: 16 }}>
      {[1, 2, 3].map((s) => (
        <View key={s} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? '#FF6240' : '#DDD6C9' }} />
      ))}
    </View>
  )
}

export default function InterviewScheduleScreen() {
  const { jobId: paramJobId } = useLocalSearchParams<{ jobId?: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()

  const [step, setStep] = useState(paramJobId ? 2 : 1)
  const [selectedJobId, setSelectedJobId] = useState(paramJobId ?? '')
  const [selectedDate, setSelectedDate] = useState(nextNDays(14)[0])
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState(60)
  const [meetingType, setMeetingType] = useState<MeetingType>('zoom')
  const [meetingLink, setMeetingLink] = useState('')
  const [companyMessage, setCompanyMessage] = useState('')
  const [slots, setSlots] = useState<SlotCreated[]>([])
  const [pairings, setPairings] = useState<Record<string, string>>({})

  const days = nextNDays(14)

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
    queryKey: ['shortlisted-candidates', selectedJobId],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_applications')
        .select('id, candidate_id, candidate_profiles!candidate_id(first_name, last_name, avatar_url)')
        .eq('job_id', selectedJobId)
        .eq('pipeline_stage', 'interview_scheduled')
      const rows = (data as unknown as { id: string; candidate_id: string; candidate_profiles: { first_name: string; last_name: string; avatar_url: string | null } | null }[]) ?? []
      return rows.map((r) => ({
        id: r.candidate_id,
        full_name: `${r.candidate_profiles?.first_name ?? ''} ${r.candidate_profiles?.last_name ?? ''}`.trim() || 'Unknown',
        avatar_url: r.candidate_profiles?.avatar_url ?? null,
        application_id: r.id,
      })) as Candidate[]
    },
    enabled: !!selectedJobId && step >= 2,
  })

  const addSlotMutation = useMutation({
    mutationFn: async () => {
      if (!startTime || !selectedDate) throw new Error('Missing time or date')
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
          meeting_link: meetingType !== 'in_person' ? meetingLink || null : null,
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
      setStartTime('')
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

  const assignMutation = useMutation({
    mutationFn: async ({ slotId, candidateId, applicationId, slot }: { slotId: string; candidateId: string; applicationId: string; slot: SlotCreated }) => {
      const { error: bookErr } = await supabase.from('interview_bookings').insert({
        slot_id: slotId,
        application_id: applicationId,
        candidate_id: candidateId,
        company_id: user!.id,
        status: 'booked',
      })
      if (bookErr) throw bookErr
      const { error: slotErr } = await supabase.from('interview_slots').update({ is_booked: true }).eq('id', slotId)
      if (slotErr) throw slotErr
      const dateStr = new Date(slot.slot_date).toLocaleDateString('en-NG', { weekday: 'long', day: 'numeric', month: 'long' })
      const timeStr = slot.start_time.slice(0, 5)
      const body = slot.company_message
        ? `${slot.company_message} — ${dateStr} at ${timeStr} (${slot.duration_mins}min)`
        : `Your interview is scheduled for ${dateStr} at ${timeStr} (${slot.duration_mins}min).`
      await supabase.from('notifications').insert({
        user_id:    candidateId,
        type:       'interview_scheduled',
        title:      'Interview invitation',
        body,
        data:       { slot_id: slotId, application_id: applicationId },
        action_url: null,
      })
    },
    onSuccess: (_, { slotId, candidateId }) => {
      setPairings((prev) => ({ ...prev, [slotId]: candidateId }))
      queryClient.invalidateQueries({ queryKey: ['interview-calendar'] })
    },
    onError: () => Alert.alert('Error', 'Could not assign candidate.'),
  })

  const handleFinish = () => {
    if (selectedJobId) {
      router.replace({ pathname: '/(company)/jobs/[id]' as never, params: { id: selectedJobId } })
    } else {
      router.replace('/(company)/(tabs)/applicants')
    }
  }

  const MEETING_TYPES: { key: MeetingType; label: string }[] = [
    { key: 'zoom', label: 'Zoom' },
    { key: 'google_meet', label: 'Google Meet' },
    { key: 'in_person', label: 'In Person' },
  ]

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => { if (step > 1) setStep(s => s - 1); else router.back() }} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-[#1A1625] text-lg font-bold flex-1">Interview Scheduler</Text>
        <Text style={{ color: '#475569', fontSize: 13 }}>Step {step}/3</Text>
      </View>
      <StepBar step={step} />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingBottom: 120 }}>

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

          {step === 2 && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Create Time Slots</Text>
              <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>Add available slots for candidates to book.</Text>

              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>SELECT DATE</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {days.map((d) => {
                    const isSelected = d === selectedDate
                    const label = new Date(d).toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric' })
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

              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>START TIME (HH:MM)</Text>
              <TextInput
                value={startTime}
                onChangeText={setStartTime}
                placeholder="09:00"
                placeholderTextColor="#475569"
                keyboardType="numbers-and-punctuation"
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
              />

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

              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>MEETING TYPE</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {MEETING_TYPES.map((t) => (
                  <Pressable
                    key={t.key}
                    onPress={() => setMeetingType(t.key)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: meetingType === t.key ? '#FF624020' : '#EDE7DB', borderWidth: 1, borderColor: meetingType === t.key ? '#FF6240' : '#DDD6C9', alignItems: 'center' }}
                  >
                    <Text style={{ color: meetingType === t.key ? '#FF6240' : '#5A4F6E', fontSize: 11, fontWeight: '600' }}>{t.label}</Text>
                  </Pressable>
                ))}
              </View>

              {meetingType !== 'in_person' && (
                <>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>MEETING LINK</Text>
                  <TextInput
                    value={meetingLink}
                    onChangeText={setMeetingLink}
                    placeholder="https://zoom.us/j/..."
                    placeholderTextColor="#475569"
                    keyboardType="url"
                    autoCapitalize="none"
                    style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, marginBottom: 16 }}
                  />
                </>
              )}

              <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>MESSAGE TO CANDIDATE (OPTIONAL)</Text>
              <TextInput
                value={companyMessage}
                onChangeText={setCompanyMessage}
                placeholder="e.g. Please bring a copy of your CV and portfolio…"
                placeholderTextColor="#475569"
                multiline
                textAlignVertical="top"
                style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 14, minHeight: 80, marginBottom: 16 }}
              />

              <Pressable
                onPress={() => addSlotMutation.mutate()}
                disabled={!startTime || addSlotMutation.isPending}
                style={{ backgroundColor: startTime ? '#FF6240' : '#DDD6C9', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 20 }}
              >
                {addSlotMutation.isPending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: startTime ? '#1A1625' : '#475569', fontWeight: '700' }}>+ Add slot</Text>
                )}
              </Pressable>

              {slots.length > 0 && (
                <View>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 10 }}>SLOTS CREATED ({slots.length})</Text>
                  {slots.map((s) => (
                    <View key={s.id} style={{ backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#0DD4C330', padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ color: '#1A1625', fontSize: 13, fontWeight: '600' }}>{formatDate(s.slot_date)} · {s.start_time.slice(0, 5)}</Text>
                        <Text style={{ color: '#64748B', fontSize: 12 }}>{s.duration_mins}min · {s.meeting_type.replace('_', ' ')}</Text>
                      </View>
                      <Pressable onPress={() => deleteSlotMutation.mutate(s.id)} hitSlop={10}>
                        <TrashIcon />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Pressable
                onPress={() => setStep(3)}
                disabled={slots.length === 0}
                style={{ backgroundColor: slots.length > 0 ? '#FF6240' : '#DDD6C9', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 12 }}
              >
                <Text style={{ color: slots.length > 0 ? '#1A1625' : '#475569', fontWeight: '700', fontSize: 15 }}>Next: Assign candidates</Text>
              </Pressable>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInDown.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>Assign Candidates</Text>
              <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 20 }}>Pair candidates in the interview stage with your available slots.</Text>

              {candidatesLoading ? (
                <ActivityIndicator color="#FF6240" />
              ) : candidates.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                  <Text style={{ color: '#475569', fontSize: 14 }}>No candidates in the interview stage for this job yet.</Text>
                </View>
              ) : (
                slots.filter((s) => !pairings[s.id]).map((slot) => (
                  <View key={slot.id} style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#DDD6C9', padding: 16, marginBottom: 16 }}>
                    <Text style={{ color: '#0DD4C3', fontSize: 13, fontWeight: '700', marginBottom: 10 }}>
                      {formatDate(slot.slot_date)} · {slot.start_time.slice(0, 5)} ({slot.duration_mins}min)
                    </Text>
                    {candidates.filter((c) => !Object.values(pairings).includes(c.id)).map((c) => {
                      const initials = c.full_name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => assignMutation.mutate({ slotId: slot.id, candidateId: c.id, applicationId: c.application_id, slot })}
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}
                        >
                          {c.avatar_url ? (
                            <Image source={{ uri: c.avatar_url }} style={{ width: 34, height: 34, borderRadius: 17 }} />
                          ) : (
                            <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                              <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>{initials}</Text>
                            </View>
                          )}
                          <Text style={{ color: '#1A1625', fontSize: 13, flex: 1 }}>{c.full_name}</Text>
                          <View style={{ backgroundColor: '#FF624020', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
                            <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>Assign</Text>
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                ))
              )}

              {Object.keys(pairings).length > 0 && (
                <View style={{ backgroundColor: '#22C55E10', borderRadius: 14, borderWidth: 1, borderColor: '#22C55E30', padding: 14, marginBottom: 16 }}>
                  <Text style={{ color: '#22C55E', fontWeight: '600', marginBottom: 6 }}>{Object.keys(pairings).length} interviews booked</Text>
                  <Text style={{ color: '#64748B', fontSize: 12 }}>Candidates will be notified via push notification and email.</Text>
                </View>
              )}

              <Pressable
                onPress={handleFinish}
                style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 8 }}
              >
                <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Done — view schedule</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

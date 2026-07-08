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
} from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

type InterviewStatus = 'booked' | 'completed' | 'cancelled' | 'no_show'
type PipelineStage = 'new' | 'reviewed' | 'shortlisted' | 'interview_scheduled' | 'offer_made' | 'rejected' | 'withdrawn'

interface BookingDetail {
  id: string
  status: InterviewStatus
  interview_notes: string | null
  internal_rating: number | null
  candidate_id: string
  application_id: string
  slot_id: string
  interview_slots: {
    slot_date: string
    start_time: string
    duration_mins: number
    meeting_type: string
  } | null
  candidate_profiles: {
    profiles: { full_name: string } | null
  } | null
  job_postings: { id: string; title: string } | null
}

function formatTime(t: string): string {
  const parts = t.split(':')
  const h = Number(parts[0] ?? '0')
  const m = Number(parts[1] ?? '0')
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke={filled ? '#F59E0B' : '#DDD6C9'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </Svg>
  )
}

const STATUS_OPTIONS: { key: InterviewStatus; label: string; color: string }[] = [
  { key: 'completed', label: 'Completed', color: '#22C55E' },
  { key: 'no_show', label: 'No show', color: '#F59E0B' },
  { key: 'cancelled', label: 'Cancelled', color: '#EF4444' },
  { key: 'booked', label: 'Keep as booked', color: '#6366F1' },
]

export default function InterviewNotesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const queryClient = useQueryClient()

  const [notes, setNotes] = useState('')
  const [rating, setRating] = useState(0)
  const [status, setStatus] = useState<InterviewStatus>('booked')
  const [isSaving, setIsSaving] = useState(false)

  const { data: booking, isLoading } = useQuery({
    queryKey: ['interview-booking-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_bookings')
        .select(`
          id, status, interview_notes, internal_rating, candidate_id, application_id, slot_id,
          interview_slots(slot_date, start_time, duration_mins, meeting_type),
          candidate_profiles:candidate_id(profiles:profile_id(full_name)),
          job_postings:job_id(id, title)
        `)
        .eq('id', id)
        .single()
      if (error) throw error
      return data as unknown as BookingDetail
    },
    enabled: !!id,
  })

  useEffect(() => {
    if (booking) {
      setNotes(booking.interview_notes ?? '')
      setRating(booking.internal_rating ?? 0)
      setStatus(booking.status)
    }
  }, [booking])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('interview_bookings')
        .update({ interview_notes: notes, internal_rating: rating || null, status })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['interview-calendar'] })
      queryClient.invalidateQueries({ queryKey: ['interview-booking-detail', id] })
    },
  })

  const handleAutoSave = async () => {
    if (!isSaving) {
      setIsSaving(true)
      await saveMutation.mutateAsync().catch(() => null)
      setIsSaving(false)
    }
  }

  const moveToOffer = async () => {
    if (!booking?.application_id) return
    Alert.alert('Move to Offer', 'Update this candidate\'s application stage to "Offer Made"?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: async () => {
          await supabase
            .from('job_applications')
            .update({ pipeline_stage: 'offer_made' as PipelineStage })
            .eq('id', booking.application_id)
          queryClient.invalidateQueries({ queryKey: ['ats'] })
          router.back()
        },
      },
    ])
  }

  const rejectCandidate = async () => {
    if (!booking?.application_id) return
    Alert.alert('Reject Candidate', 'Mark this candidate as rejected?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          await supabase
            .from('job_applications')
            .update({ pipeline_stage: 'rejected' as PipelineStage })
            .eq('id', booking.application_id)
          queryClient.invalidateQueries({ queryKey: ['ats'] })
          router.back()
        },
      },
    ])
  }

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  const candidateName = booking?.candidate_profiles?.profiles?.full_name ?? 'Candidate'
  const jobTitle = booking?.job_postings?.title ?? 'Position'
  const slotDate = booking?.interview_slots?.slot_date
    ? new Date(booking.interview_slots.slot_date).toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' })
    : ''
  const slotTime = booking?.interview_slots?.start_time ? formatTime(booking.interview_slots.start_time) : ''

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text className="text-[#1A1625] text-base font-bold" numberOfLines={1}>{candidateName}</Text>
          <Text style={{ color: '#64748B', fontSize: 12 }} numberOfLines={1}>{jobTitle}</Text>
        </View>
        {isSaving && <ActivityIndicator color="#94A3B8" size="small" />}
        {saveMutation.isSuccess && !isSaving && (
          <Text style={{ color: '#22C55E', fontSize: 12 }}>Saved</Text>
        )}
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView className="flex-1 px-5" contentContainerStyle={{ paddingVertical: 20 }}>
          <Animated.View entering={FadeInDown.duration(300)}>
            {slotDate && (
              <View style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 20 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 12 }}>{slotDate} · {slotTime}</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2, textTransform: 'capitalize' }}>
                  {booking?.interview_slots?.meeting_type?.replace('_', ' ')} · {booking?.interview_slots?.duration_mins}min
                </Text>
              </View>
            )}

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 12 }}>INTERNAL RATING</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 24 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setRating(n)} hitSlop={8}>
                  <StarIcon filled={n <= rating} />
                </Pressable>
              ))}
              {rating > 0 && (
                <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '600', alignSelf: 'center', marginLeft: 8 }}>
                  {['', 'Poor', 'Below average', 'Good', 'Strong', 'Exceptional'][rating]}
                </Text>
              )}
            </View>

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>INTERVIEW NOTES</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              onBlur={handleAutoSave}
              placeholder="How did the interview go? Key impressions, strengths, concerns..."
              placeholderTextColor="#334155"
              multiline
              style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 14, padding: 16, minHeight: 200, textAlignVertical: 'top', lineHeight: 22, marginBottom: 24 }}
            />

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 12 }}>UPDATE STATUS</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {STATUS_OPTIONS.map((o) => (
                <Pressable
                  key={o.key}
                  onPress={() => setStatus(o.key)}
                  style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: status === o.key ? `${o.color}20` : '#EDE7DB', borderWidth: 1.5, borderColor: status === o.key ? o.color : '#DDD6C9' }}
                >
                  <Text style={{ color: status === o.key ? o.color : '#64748B', fontSize: 13, fontWeight: '600' }}>{o.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', marginBottom: 12 }}>NEXT STEPS</Text>
            <View style={{ gap: 8, marginBottom: 32 }}>
              <Pressable
                onPress={moveToOffer}
                style={{ backgroundColor: '#22C55E15', borderRadius: 14, borderWidth: 1, borderColor: '#22C55E30', paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#22C55E', fontWeight: '700' }}>Move to Offer</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push({ pathname: '/(company)/interviews/schedule', params: { jobId: booking?.job_postings?.id ?? '' } })}
                style={{ backgroundColor: '#6366F115', borderRadius: 14, borderWidth: 1, borderColor: '#6366F130', paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#6366F1', fontWeight: '700' }}>Schedule Follow-up</Text>
              </Pressable>
              <Pressable
                onPress={rejectCandidate}
                style={{ backgroundColor: '#EF444415', borderRadius: 14, borderWidth: 1, borderColor: '#EF444430', paddingVertical: 14, alignItems: 'center' }}
              >
                <Text style={{ color: '#EF4444', fontWeight: '700' }}>Reject Candidate</Text>
              </Pressable>
            </View>

            <Pressable
              onPress={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 16, alignItems: 'center' }}
            >
              {saveMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Save notes</Text>
              )}
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

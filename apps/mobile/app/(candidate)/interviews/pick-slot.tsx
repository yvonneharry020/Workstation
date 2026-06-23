import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface InterviewSlot {
  id: string
  slot_date: string
  start_time: string
  end_time: string
  duration_mins: number
  meeting_type: string
  company_id: string
  job_postings: { title: string; company_profiles: { company_name: string } | null } | null
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function formatTime(t: string): string {
  const parts = t.split(':')
  const h = Number(parts[0] ?? '0')
  const m = Number(parts[1] ?? '0')
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

function CalendarIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

export default function PickSlotScreen() {
  const { applicationId } = useLocalSearchParams<{ applicationId: string }>()
  const user = useAuthStore((s) => s.user)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [isBooking, setIsBooking] = useState(false)

  const { data: application } = useQuery({
    queryKey: ['application-for-slots', applicationId],
    queryFn: async () => {
      const { data } = await supabase
        .from('job_applications')
        .select('job_id')
        .eq('id', applicationId)
        .single()
      return data
    },
    enabled: !!applicationId,
  })

  const { data: slots = [], isLoading } = useQuery({
    queryKey: ['interview-slots', application?.job_id],
    queryFn: async () => {
      const { data } = await supabase
        .from('interview_slots')
        .select('id, slot_date, start_time, end_time, duration_mins, meeting_type, company_id, job_postings(title, company_profiles(company_name))')
        .eq('job_id', application!.job_id)
        .eq('is_booked', false)
        .gte('slot_date', new Date().toISOString().split('T')[0])
        .order('slot_date')
        .order('start_time')
      return (data ?? []) as unknown as InterviewSlot[]
    },
    enabled: !!application?.job_id,
  })

  const uniqueDates = [...new Set(slots.map((s) => s.slot_date))]
  const slotsForDate = slots.filter((s) => s.slot_date === (selectedDate ?? uniqueDates[0]))
  const selectedSlot = slots.find((s) => s.id === selectedSlotId)

  const jobTitle = slots[0]?.job_postings?.title ?? 'Interview'
  const companyName = slots[0]?.job_postings?.company_profiles?.company_name ?? 'Company'
  const duration = slots[0]?.duration_mins ?? 30
  const meetingType = slots[0]?.meeting_type ?? 'video'

  const confirmBooking = async () => {
    if (!selectedSlot) return
    setIsBooking(true)
    try {
      const { data: newBooking, error } = await supabase
        .from('interview_bookings')
        .insert({
          slot_id: selectedSlot.id,
          application_id: applicationId,
          candidate_id: user!.id,
          company_id: selectedSlot.company_id,
        })
        .select('id')
        .single()

      if (error) throw error
      await supabase.from('interview_slots').update({ is_booked: true }).eq('id', selectedSlot.id)
      router.replace(`/(candidate)/interviews/confirmed?bookingId=${newBooking.id}` as Parameters<typeof router.replace>[0])
    } catch {
      Alert.alert('Error', 'Could not confirm booking. Please try again.')
    } finally {
      setIsBooking(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View className="flex-row items-center gap-4 px-5 py-4" style={{ borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M19 12H5M12 5l-7 7 7 7" />
          </Svg>
        </Pressable>
        <Text className="text-white text-base font-semibold">Choose Interview Time</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* Info card */}
        <Animated.View
          entering={FadeInDown.duration(400)}
          className="mx-5 mt-5 mb-4 bg-surface-card border border-surface-border rounded-2xl p-4"
        >
          <View className="flex-row items-start gap-3">
            <CalendarIcon />
            <View className="flex-1">
              <Text className="text-white font-bold text-base">{jobTitle}</Text>
              <Text className="text-slate-400 text-sm mt-0.5">{companyName}</Text>
              <View className="flex-row gap-2 mt-2">
                <View style={{ backgroundColor: '#FF624020', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '600' }}>{duration} min</Text>
                </View>
                <View style={{ backgroundColor: '#1E1B2E', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>{meetingType}</Text>
                </View>
              </View>
            </View>
          </View>
        </Animated.View>

        {isLoading ? (
          <View className="py-16 items-center">
            <Text className="text-slate-500 text-sm">Loading available times…</Text>
          </View>
        ) : slots.length === 0 ? (
          <View className="py-16 items-center px-8">
            <Text className="text-white text-base font-semibold text-center mb-2">No slots available</Text>
            <Text className="text-slate-400 text-sm text-center leading-5">
              The company hasn't set interview times yet. Check back later or contact them through your application.
            </Text>
          </View>
        ) : (
          <>
            {/* Date selector */}
            <View className="px-5 mb-4">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Select Date</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {uniqueDates.map((date) => {
                    const isSelected = (selectedDate ?? uniqueDates[0]) === date
                    return (
                      <Pressable
                        key={date}
                        onPress={() => { setSelectedDate(date); setSelectedSlotId(null) }}
                        style={{
                          paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14,
                          backgroundColor: isSelected ? '#FF6240' : '#131118',
                          borderWidth: 1, borderColor: isSelected ? '#FF6240' : '#1E1B2E',
                        }}
                      >
                        <Text style={{ color: isSelected ? '#fff' : '#94A3B8', fontSize: 13, fontWeight: '600' }}>
                          {formatDate(date)}
                        </Text>
                      </Pressable>
                    )
                  })}
                </View>
              </ScrollView>
            </View>

            {/* Time slots */}
            <View className="px-5">
              <Text className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Select Time</Text>
              <View className="flex-row flex-wrap gap-2">
                {slotsForDate.map((slot) => {
                  const isSelected = selectedSlotId === slot.id
                  return (
                    <Pressable
                      key={slot.id}
                      onPress={() => setSelectedSlotId(slot.id)}
                      style={{
                        width: '47%', paddingVertical: 14, borderRadius: 14,
                        backgroundColor: isSelected ? '#FF624015' : '#131118',
                        borderWidth: 1.5, borderColor: isSelected ? '#FF6240' : '#1E1B2E',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ color: isSelected ? '#FF6240' : '#fff', fontSize: 15, fontWeight: '700' }}>
                        {formatTime(slot.start_time)}
                      </Text>
                      <Text style={{ color: '#64748B', fontSize: 11, marginTop: 2 }}>
                        to {formatTime(slot.end_time)}
                      </Text>
                    </Pressable>
                  )
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 px-5 pb-8 pt-4"
        style={{ backgroundColor: '#09080E', borderTopWidth: 1, borderTopColor: '#1E1B2E' }}
      >
        <Pressable
          onPress={confirmBooking}
          disabled={!selectedSlotId || isBooking}
          className="rounded-2xl py-4 items-center active:opacity-80"
          style={{ backgroundColor: selectedSlotId ? '#FF6240' : '#1E1B2E', opacity: !selectedSlotId || isBooking ? 0.5 : 1 }}
        >
          <Text className="text-white font-bold text-base">
            {isBooking ? 'Booking…' : selectedSlotId ? `Confirm — ${formatTime(selectedSlot!.start_time)}` : 'Select a time slot'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

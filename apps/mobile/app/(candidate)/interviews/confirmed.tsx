import {
  View,
  Text,
  Pressable,
  Alert,
  ScrollView,
} from 'react-native'
import { useEffect } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withSpring,
} from 'react-native-reanimated'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import Svg, { Path, Circle, Polyline } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

interface BookingDetail {
  id: string
  booking_token: string
  status: string
  created_at: string
  interview_slots: {
    slot_date: string
    start_time: string
    end_time: string
    duration_mins: number
    meeting_type: string
    meeting_link: string | null
  } | null
  company_profiles: {
    company_name: string
    logo_url: string | null
  } | null
}

function formatSlotDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(timeStr: string): string {
  const parts = timeStr.split(':')
  const h = Number(parts[0] ?? '0')
  const m = Number(parts[1] ?? '0')
  const suffix = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`
}

function AnimatedCheck() {
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(200, withSpring(1, { damping: 12, stiffness: 180 }))
    opacity.value = withDelay(200, withSpring(1))
  }, [opacity, scale])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[{
        width: 88, height: 88, borderRadius: 44,
        backgroundColor: '#14532D20',
        borderWidth: 2, borderColor: '#22C55E40',
        alignItems: 'center', justifyContent: 'center',
      }, style]}
    >
      <Svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="20 6 9 17 4 12" />
      </Svg>
    </Animated.View>
  )
}

function CalendarIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

function LinkIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  )
}

export default function InterviewConfirmedScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>()

  const { data: booking } = useQuery({
    queryKey: ['interview-booking', bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_bookings')
        .select(`
          id, booking_token, status, created_at,
          interview_slots ( slot_date, start_time, end_time, duration_mins, meeting_type, meeting_link ),
          company_profiles ( company_name, logo_url )
        `)
        .eq('id', bookingId)
        .single()
      if (error) throw error
      return data as unknown as BookingDetail
    },
    enabled: !!bookingId,
  })

  const slot = booking?.interview_slots
  const company = booking?.company_profiles

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 48 }}
      >
        {/* Success animation */}
        <Animated.View entering={FadeInDown.duration(500)} className="items-center mt-12 mb-8">
          <AnimatedCheck />
          <Text
            style={{ color: '#1A1625', fontSize: 28, fontWeight: '800', letterSpacing: -0.5, marginTop: 20, marginBottom: 8, textAlign: 'center' }}
          >
            Interview Booked!
          </Text>
          <Text className="text-slate-400 text-sm text-center leading-5">
            Your interview has been confirmed. Good luck!
          </Text>
        </Animated.View>

        {/* Booking details */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          className="bg-surface-card border border-surface-border rounded-2xl p-5 mb-4"
        >
          {company && (
            <View className="flex-row items-center gap-3 mb-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: '#DDD6C9' }}>
              {company.logo_url ? (
                <Image source={{ uri: company.logo_url }} style={{ width: 48, height: 48, borderRadius: 12 }} contentFit="cover" />
              ) : (
                <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: '#DDD6C9', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#475569', fontSize: 20, fontWeight: '700' }}>{company.company_name.charAt(0)}</Text>
                </View>
              )}
              <View>
                <Text className="text-[#1A1625] font-bold text-base">{company.company_name}</Text>
                <Text className="text-slate-500 text-xs mt-0.5">Interview</Text>
              </View>
            </View>
          )}

          {slot && (
            <View className="gap-3">
              <View className="flex-row items-center gap-3">
                <CalendarIcon />
                <View>
                  <Text className="text-[#1A1625] text-sm font-semibold">{formatSlotDate(slot.slot_date)}</Text>
                  <Text className="text-slate-400 text-xs mt-0.5">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</Text>
                </View>
              </View>

              <View className="flex-row items-center gap-2">
                <View style={{ backgroundColor: '#FF624020', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600' }}>{slot.duration_mins} min</Text>
                </View>
                <View style={{ backgroundColor: '#DDD6C9', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', textTransform: 'capitalize' }}>{slot.meeting_type}</Text>
                </View>
              </View>

              {slot.meeting_link && (
                <Pressable
                  onPress={() => Alert.alert('Meeting link', slot.meeting_link ?? '')}
                  className="flex-row items-center gap-2 active:opacity-70"
                >
                  <LinkIcon />
                  <Text style={{ color: '#0DD4C3', fontSize: 13 }} numberOfLines={1}>{slot.meeting_link}</Text>
                </Pressable>
              )}
            </View>
          )}
        </Animated.View>

        {/* Reference */}
        {booking?.booking_token && (
          <Animated.View
            entering={FadeInUp.delay(450).duration(400)}
            className="bg-surface-card border border-surface-border rounded-2xl px-5 py-4 mb-6"
          >
            <Text className="text-slate-500 text-xs mb-1">Reference number</Text>
            <Text style={{ color: '#1A1625', fontFamily: 'JetBrainsMono_700Bold', fontSize: 15, letterSpacing: 1 }}>
              {booking.booking_token.slice(0, 8).toUpperCase()}
            </Text>
          </Animated.View>
        )}

        {/* Actions */}
        <Animated.View entering={FadeInUp.delay(600).duration(400)} className="gap-3">
          <Pressable
            onPress={() => router.replace('/(candidate)/interviews/history' as Parameters<typeof router.replace>[0])}
            className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-[#1A1625] font-bold text-base">View all interviews</Text>
          </Pressable>

          <Pressable
            onPress={() => router.replace('/(candidate)/applications' as Parameters<typeof router.replace>[0])}
            className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center active:opacity-80"
          >
            <Text className="text-[#1A1625] font-semibold text-base">Back to applications</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

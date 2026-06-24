import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  FlatList,
  Modal,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path } from 'react-native-svg'
import { Image } from 'expo-image'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

type InterviewStatus = 'booked' | 'completed' | 'cancelled' | 'no_show'

interface InterviewBooking {
  id: string
  status: InterviewStatus
  interview_notes: string | null
  internal_rating: number | null
  candidate_id: string
  slot_id: string
  interview_slots: {
    slot_date: string
    start_time: string
    end_time: string
    meeting_type: string
    meeting_link: string | null
  } | null
  candidate_profiles: {
    profiles: { full_name: string; avatar_url: string | null } | null
  } | null
  job_postings: { title: string } | null
}

interface BookingRow {
  id: string
  status: string
  interview_notes: string | null
  internal_rating: number | null
  candidate_id: string
  slot_id: string
  interview_slots: {
    slot_date: string
    start_time: string
    end_time: string
    meeting_type: string
    meeting_link: string | null
  } | null
  candidate_profiles: {
    profiles: { full_name: string; avatar_url: string | null } | null
  } | null
  job_postings: { title: string } | null
}

const STATUS_COLORS: Record<InterviewStatus, string> = {
  booked: '#6366F1',
  completed: '#22C55E',
  cancelled: '#475569',
  no_show: '#F59E0B',
}

function formatTime(t: string): string {
  const parts = t.split(':')
  const h = Number(parts[0] ?? '0')
  const m = Number(parts[1] ?? '0')
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

function weekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function ArrowLeftIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function ChevronLeftIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 18l-6-6 6-6" />
    </Svg>
  )
}

function ChevronRightIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M9 18l6-6-6-6" />
    </Svg>
  )
}

function XIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function VideoIcon({ color }: { color: string }) {
  return (
    <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M15 10l4.553-2.069A1 1 0 0 1 21 8.82v6.36a1 1 0 0 1-1.447.894L15 14M3 8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z" />
    </Svg>
  )
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function InterviewCalendarScreen() {
  const user = useAuthStore((s) => s.user)
  const [weekBase, setWeekBase] = useState(weekStart(new Date()))
  const [selected, setSelected] = useState<InterviewBooking | null>(null)

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekBase, i))
  const weekRange = `${weekBase.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' })} – ${addDays(weekBase, 6).toLocaleDateString('en-NG', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const { data: bookings = [] } = useQuery({
    queryKey: ['interview-calendar', user?.id, isoDate(weekBase)],
    queryFn: async () => {
      const start = isoDate(weekBase)
      const end = isoDate(addDays(weekBase, 6))
      const { data } = await supabase
        .from('interview_bookings')
        .select(`
          id, status, interview_notes, internal_rating, candidate_id, slot_id,
          interview_slots!inner(slot_date, start_time, end_time, meeting_type, meeting_link),
          candidate_profiles:candidate_id(profiles:profile_id(full_name, avatar_url)),
          job_postings:job_id(title)
        `)
        .eq('company_id', user!.id)
        .gte('interview_slots.slot_date', start)
        .lte('interview_slots.slot_date', end)
        .order('interview_slots(start_time)', { ascending: true })
      return (data as unknown as BookingRow[]).map((r) => ({ ...r, status: r.status as InterviewStatus })) as InterviewBooking[]
    },
    enabled: !!user?.id,
  })

  const bookingsByDay = weekDays.reduce<Record<string, InterviewBooking[]>>((acc, d) => {
    const key = isoDate(d)
    acc[key] = bookings.filter((b) => b.interview_slots?.slot_date === key)
    return acc
  }, {})

  const thisWeekList = bookings.sort((a, b) => {
    const at = a.interview_slots?.start_time ?? ''
    const bt = b.interview_slots?.start_time ?? ''
    const ad = a.interview_slots?.slot_date ?? ''
    const bd = b.interview_slots?.slot_date ?? ''
    return ad.localeCompare(bd) || at.localeCompare(bt)
  })

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <View className="flex-row items-center px-5 py-4 border-b border-surface-border">
        <Pressable onPress={() => router.back()} className="mr-3 active:opacity-70">
          <ArrowLeftIcon />
        </Pressable>
        <Text className="text-white text-lg font-bold flex-1">Interview Calendar</Text>
        <Pressable
          onPress={() => router.push('/(company)/interviews/schedule')}
          style={{ backgroundColor: '#FF624015', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: '#FF624030' }}
        >
          <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>+ Schedule</Text>
        </Pressable>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 12, gap: 12 }}>
        <Pressable onPress={() => setWeekBase(addDays(weekBase, -7))} hitSlop={12}><ChevronLeftIcon /></Pressable>
        <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600', flex: 1, textAlign: 'center' }}>{weekRange}</Text>
        <Pressable onPress={() => setWeekBase(addDays(weekBase, 7))} hitSlop={12}><ChevronRightIcon /></Pressable>
        <Pressable onPress={() => setWeekBase(weekStart(new Date()))} style={{ backgroundColor: '#1E1B2E', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 }}>
          <Text style={{ color: '#94A3B8', fontSize: 12 }}>Today</Text>
        </Pressable>
      </View>

      <ScrollView className="flex-1">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingHorizontal: 20 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {weekDays.map((d, i) => {
              const key = isoDate(d)
              const dayBookings = bookingsByDay[key] ?? []
              const isToday = key === isoDate(new Date())
              return (
                <View key={key} style={{ width: 100 }}>
                  <View style={{ alignItems: 'center', paddingVertical: 8, marginBottom: 6 }}>
                    <Text style={{ color: isToday ? '#FF6240' : '#64748B', fontSize: 11, fontWeight: '600' }}>{DAY_LABELS[i]}</Text>
                    <Text style={{ color: isToday ? '#FF6240' : '#94A3B8', fontSize: 18, fontWeight: '700' }}>{d.getDate()}</Text>
                  </View>
                  {dayBookings.map((b) => {
                    const name = b.candidate_profiles?.profiles?.full_name ?? 'Candidate'
                    const time = formatTime(b.interview_slots?.start_time ?? '')
                    const color = STATUS_COLORS[b.status]
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => setSelected(b)}
                        style={{ backgroundColor: `${color}20`, borderRadius: 8, padding: 8, marginBottom: 6, borderLeftWidth: 3, borderLeftColor: color }}
                      >
                        <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>{name.split(' ')[0]}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <VideoIcon color={color} />
                          <Text style={{ color, fontSize: 10 }}>{time}</Text>
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              )
            })}
          </View>
        </ScrollView>

        <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12 }}>
            THIS WEEK ({thisWeekList.length})
          </Text>
          {thisWeekList.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <Text style={{ color: '#475569', fontSize: 14 }}>No interviews scheduled this week</Text>
              <Pressable onPress={() => router.push('/(company)/interviews/schedule')} style={{ marginTop: 12 }}>
                <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>Schedule interviews →</Text>
              </Pressable>
            </View>
          ) : (
            thisWeekList.map((b) => {
              const name = b.candidate_profiles?.profiles?.full_name ?? 'Unknown'
              const initials = name.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase()
              const color = STATUS_COLORS[b.status]
              return (
                <Pressable
                  key={b.id}
                  onPress={() => setSelected(b)}
                  style={{ backgroundColor: '#131118', borderRadius: 14, borderWidth: 1, borderColor: '#1E1B2E', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}
                >
                  {b.candidate_profiles?.profiles?.avatar_url ? (
                    <Image source={{ uri: b.candidate_profiles.profiles.avatar_url }} style={{ width: 40, height: 40, borderRadius: 20 }} />
                  ) : (
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '700' }}>{initials}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>{name}</Text>
                    <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                      {b.interview_slots?.slot_date ? new Date(b.interview_slots.slot_date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : ''} · {formatTime(b.interview_slots?.start_time ?? '')}
                    </Text>
                    {b.job_postings?.title && (
                      <Text style={{ color: '#475569', fontSize: 11, marginTop: 2 }}>{b.job_postings.title}</Text>
                    )}
                  </View>
                  <View style={{ backgroundColor: `${color}20`, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ color, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' }}>{b.status.replace('_', ' ')}</Text>
                  </View>
                </Pressable>
              )
            })
          )}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        {selected && (
          <SafeAreaView style={{ flex: 1, backgroundColor: '#09080E' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#1E1B2E' }}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 }}>Interview Detail</Text>
              <Pressable onPress={() => setSelected(null)}><XIcon /></Pressable>
            </View>
            <ScrollView style={{ flex: 1, padding: 20 }}>
              <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 4 }}>
                {selected.candidate_profiles?.profiles?.full_name ?? 'Unknown Candidate'}
              </Text>
              {selected.job_postings?.title && (
                <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 16 }}>{selected.job_postings.title}</Text>
              )}
              <View style={{ backgroundColor: '#131118', borderRadius: 14, padding: 14, marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>Date & time</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>
                    {selected.interview_slots?.slot_date ? new Date(selected.interview_slots.slot_date).toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : '—'} · {formatTime(selected.interview_slots?.start_time ?? '')}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 13 }}>Type</Text>
                  <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600', textTransform: 'capitalize' }}>
                    {selected.interview_slots?.meeting_type?.replace('_', ' ') ?? '—'}
                  </Text>
                </View>
                {selected.interview_slots?.meeting_link && (
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#94A3B8', fontSize: 13 }}>Link</Text>
                    <Text style={{ color: '#0DD4C3', fontSize: 13 }} numberOfLines={1}>{selected.interview_slots.meeting_link}</Text>
                  </View>
                )}
              </View>
              <View style={{ backgroundColor: `${STATUS_COLORS[selected.status]}20`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <Text style={{ color: STATUS_COLORS[selected.status], fontWeight: '700', textTransform: 'capitalize' }}>{selected.status.replace('_', ' ')}</Text>
              </View>
              {selected.interview_notes && (
                <>
                  <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 6 }}>NOTES</Text>
                  <Text style={{ color: '#E2E8F0', fontSize: 14, lineHeight: 22 }}>{selected.interview_notes}</Text>
                </>
              )}
              <Pressable
                onPress={() => { setSelected(null); router.push({ pathname: '/(company)/interviews/notes/[id]' as never, params: { id: selected.id } }) }}
                style={{ backgroundColor: '#FF624015', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20, borderWidth: 1, borderColor: '#FF624030' }}
              >
                <Text style={{ color: '#FF6240', fontWeight: '700' }}>Open full notes</Text>
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  )
}

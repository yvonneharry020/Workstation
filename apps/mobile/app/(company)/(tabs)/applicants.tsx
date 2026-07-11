import { useState, useCallback } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
  ScrollView,
  StatusBar,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'
import WebView from 'react-native-webview'
import DateTimePicker from '@react-native-community/datetimepicker'
import * as Clipboard from 'expo-clipboard'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

// ─── Types ───────────────────────────────────────────────────────────────────

type InterviewType = 'live' | 'scheduled'

interface InterviewRoom {
  id: string
  company_id: string
  room_name: string
  room_url: string
  label: string
  job_posting_id: string | null
  job_title: string | null
  interview_type: InterviewType
  scheduled_at: string | null
  status: 'active' | 'ended'
  created_at: string
  ended_at: string | null
}

interface ActiveJob {
  id: string
  title: string
}

type ListItem =
  | { type: 'header'; title: string }
  | { type: 'room'; room: InterviewRoom }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-GB', {
    hour: '2-digit', minute: '2-digit',
  })
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function isJoinable(room: InterviewRoom): boolean {
  if (room.status !== 'active') return false
  if (room.interview_type === 'live') return true
  if (!room.scheduled_at) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const scheduledDay = new Date(room.scheduled_at)
  scheduledDay.setHours(0, 0, 0, 0)
  return today >= scheduledDay
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function VideoIcon({ color = '#FF6240', size = 22 }: { color?: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={2} y={7} width={15} height={10} rx={2} />
      <Path d="M17 9l5-3v12l-5-3" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function CopyIcon({ color = '#5A4F6E' }: { color?: string }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={9} y={9} width={13} height={13} rx={2} />
      <Path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </Svg>
  )
}


function ChevronDown({ color = '#1A1625' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

function XIcon({ color = '#1A1625' }: { color?: string }) {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 6L6 18M6 6l12 12" />
    </Svg>
  )
}

function CalendarIcon() {
  return (
    <Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#5A4F6E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={4} width={18} height={18} rx={2} />
      <Path d="M16 2v4M8 2v4M3 10h18" />
    </Svg>
  )
}

// ─── Video call full-screen modal ─────────────────────────────────────────────

function VideoCallModal({ url, onClose }: { url: string; onClose: () => void }) {
  return (
    <Modal visible animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor="#1A1625" />
      <View style={{ flex: 1, backgroundColor: '#1A1625' }}>
        <View style={{
          paddingTop: 52, paddingHorizontal: 16, paddingBottom: 10,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <VideoIcon color="#FF6240" size={18} />
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Interview Room</Text>
          </View>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={{ backgroundColor: '#ffffff25', borderRadius: 20, padding: 6 }}
          >
            <XIcon color="#fff" />
          </Pressable>
        </View>
        <WebView
          source={{ uri: url }}
          style={{ flex: 1 }}
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          allowsBackgroundMediaPlayback
          mediaCapturePermissionGrantType="grantIfSameHostElsePrompt"
          androidLayerType="hardware"
          originWhitelist={['*']}
          onError={(e) => Alert.alert('Connection error', e.nativeEvent.description)}
        />
      </View>
    </Modal>
  )
}

// ─── Job dropdown modal ───────────────────────────────────────────────────────

function JobDropdown({ jobs, selected, onSelect }: {
  jobs: ActiveJob[]
  selected: ActiveJob | null
  onSelect: (job: ActiveJob) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1,
          borderColor: selected ? '#FF624060' : '#DDD6C9',
          paddingHorizontal: 14, paddingVertical: 13,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        }}
      >
        <Text style={{ color: selected ? '#1A1625' : '#94A3B8', fontSize: 14, flex: 1 }} numberOfLines={1}>
          {selected ? selected.title : 'Select active job post…'}
        </Text>
        <ChevronDown color={selected ? '#FF6240' : '#94A3B8'} />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'center', paddingHorizontal: 24 }}
          onPress={() => setOpen(false)}
        >
          <Pressable
            style={{ backgroundColor: '#F5F0E8', borderRadius: 18, overflow: 'hidden', maxHeight: 360 }}
            onPress={() => {}}
          >
            <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#DDD6C9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Active Job Posts</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}><XIcon /></Pressable>
            </View>
            <ScrollView>
              {jobs.length === 0 ? (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: '#64748B', fontSize: 14 }}>No active jobs found</Text>
                </View>
              ) : (
                jobs.map((job) => (
                  <Pressable
                    key={job.id}
                    onPress={() => { onSelect(job); setOpen(false) }}
                    style={{
                      paddingHorizontal: 16, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: '#EDE7DB',
                      backgroundColor: selected?.id === job.id ? '#FF624010' : 'transparent',
                    }}
                  >
                    <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: selected?.id === job.id ? '600' : '400' }}>
                      {job.title}
                    </Text>
                    {selected?.id === job.id && (
                      <Text style={{ color: '#FF6240', fontSize: 11, marginTop: 2 }}>Selected</Text>
                    )}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  )
}

// ─── New room form modal ──────────────────────────────────────────────────────

function NewRoomModal({ visible, onClose, onCreate }: {
  visible: boolean
  onClose: () => void
  onCreate: (params: { job: ActiveJob; type: InterviewType; scheduledAt: Date | null }) => void
}) {
  const user = useAuthStore((s) => s.user)
  const [selectedJob, setSelectedJob] = useState<ActiveJob | null>(null)
  const [interviewType, setInterviewType] = useState<InterviewType>('live')
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date())
  const [showDatePicker, setShowDatePicker] = useState(false)
  const [showTimePicker, setShowTimePicker] = useState(false)

  const { data: activeJobs = [] } = useQuery<ActiveJob[]>({
    queryKey: ['active-jobs-for-interview', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title')
        .eq('company_id', user!.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as ActiveJob[]) ?? []
    },
    enabled: visible && !!user?.id,
  })

  const handleClose = () => {
    setSelectedJob(null)
    setInterviewType('live')
    setScheduledDate(new Date())
    onClose()
  }

  const handleCreate = () => {
    if (!selectedJob) {
      Alert.alert('Select a job', 'Please choose the job post this interview is for.')
      return
    }
    if (interviewType === 'scheduled') {
      const now = new Date()
      now.setHours(0, 0, 0, 0)
      const picked = new Date(scheduledDate)
      picked.setHours(0, 0, 0, 0)
      if (picked < now) {
        Alert.alert('Invalid date', 'Please pick today or a future date for the interview.')
        return
      }
    }
    onCreate({ job: selectedJob, type: interviewType, scheduledAt: interviewType === 'scheduled' ? scheduledDate : null })
    handleClose()
  }

  const minDate = new Date()

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#00000050', justifyContent: 'flex-end' }}
        onPress={handleClose}
      >
        <Pressable
          style={{ backgroundColor: '#F5F0E8', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: 36 }}
          onPress={() => {}}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>New Interview Room</Text>
            <Pressable onPress={handleClose} hitSlop={10}><XIcon /></Pressable>
          </View>

          {/* Job post dropdown */}
          <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '600', marginBottom: 8 }}>Job Post</Text>
          <JobDropdown jobs={activeJobs} selected={selectedJob} onSelect={setSelectedJob} />
          <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 5, marginBottom: 20 }}>
            Only your active job posts are shown
          </Text>

          {/* Live vs Scheduled toggle */}
          <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Interview Type</Text>
          <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
            <Pressable
              onPress={() => setInterviewType('live')}
              style={{
                flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                backgroundColor: interviewType === 'live' ? '#FF6240' : '#EDE7DB',
                borderWidth: 1.5,
                borderColor: interviewType === 'live' ? '#FF6240' : '#DDD6C9',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: interviewType === 'live' ? '#fff' : '#5A4F6E' }}>
                Live (Now)
              </Text>
              <Text style={{ fontSize: 11, marginTop: 2, color: interviewType === 'live' ? '#ffffff99' : '#94A3B8' }}>
                Start immediately
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setInterviewType('scheduled')}
              style={{
                flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center',
                backgroundColor: interviewType === 'scheduled' ? '#FF6240' : '#EDE7DB',
                borderWidth: 1.5,
                borderColor: interviewType === 'scheduled' ? '#FF6240' : '#DDD6C9',
              }}
            >
              <Text style={{ fontSize: 13, fontWeight: '700', color: interviewType === 'scheduled' ? '#fff' : '#5A4F6E' }}>
                Scheduled
              </Text>
              <Text style={{ fontSize: 11, marginTop: 2, color: interviewType === 'scheduled' ? '#ffffff99' : '#94A3B8' }}>
                Pick date & time
              </Text>
            </Pressable>
          </View>

          {/* Date & Time — only for scheduled */}
          {interviewType === 'scheduled' && (
            <View style={{ marginBottom: 20 }}>
              <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '600', marginBottom: 10 }}>Date & Time</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Pressable
                  onPress={() => setShowDatePicker(true)}
                  style={{
                    flex: 1, backgroundColor: '#EDE7DB', borderRadius: 12,
                    borderWidth: 1, borderColor: '#DDD6C9',
                    paddingHorizontal: 12, paddingVertical: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}
                >
                  <CalendarIcon />
                  <Text style={{ color: '#1A1625', fontSize: 13 }}>
                    {scheduledDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setShowTimePicker(true)}
                  style={{
                    flex: 1, backgroundColor: '#EDE7DB', borderRadius: 12,
                    borderWidth: 1, borderColor: '#DDD6C9',
                    paddingHorizontal: 12, paddingVertical: 12,
                    flexDirection: 'row', alignItems: 'center', gap: 8,
                  }}
                >
                  <CalendarIcon />
                  <Text style={{ color: '#1A1625', fontSize: 13 }}>
                    {scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </Pressable>
              </View>

              {showDatePicker && (
                <DateTimePicker
                  value={scheduledDate}
                  mode="date"
                  minimumDate={minDate}
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_e, date) => {
                    setShowDatePicker(false)
                    if (date) {
                      const merged = new Date(date)
                      merged.setHours(scheduledDate.getHours(), scheduledDate.getMinutes())
                      setScheduledDate(merged)
                    }
                  }}
                />
              )}
              {showTimePicker && (
                <DateTimePicker
                  value={scheduledDate}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(_e, time) => {
                    setShowTimePicker(false)
                    if (time) {
                      const merged = new Date(scheduledDate)
                      merged.setHours(time.getHours(), time.getMinutes())
                      setScheduledDate(merged)
                    }
                  }}
                />
              )}
            </View>
          )}

          {/* Info box */}
          <View style={{
            backgroundColor: '#FF624010', borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: '#FF624020', marginBottom: 24,
          }}>
            <Text style={{ color: '#5A4F6E', fontSize: 12, lineHeight: 18 }}>
              {interviewType === 'live'
                ? 'A video room will be created now. You will get a room code to share with the candidate. Up to 10 people can join.'
                : `A room will be created and reserved for ${scheduledDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} at ${scheduledDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}. The Join button will appear on that day.`}
            </Text>
          </View>

          <Pressable
            onPress={handleCreate}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Room</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Room card ────────────────────────────────────────────────────────────────

function RoomCard({ room, onJoin, onEnd }: {
  room: InterviewRoom
  onJoin: () => void
  onEnd: () => void
}) {
  const [copied, setCopied] = useState(false)
  const canJoin = isJoinable(room)
  const isActive = room.status === 'active'
  const isScheduled = room.interview_type === 'scheduled'

  const handleCopy = async () => {
    await Clipboard.setStringAsync(room.room_url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <View style={{
        backgroundColor: '#EDE7DB', borderRadius: 18,
        borderWidth: 1, borderColor: '#DDD6C9',
        padding: 16, marginBottom: 12,
      }}>
        {/* Header row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 }}>
          <View style={{
            width: 40, height: 40, borderRadius: 11,
            backgroundColor: isActive ? '#FF624015' : '#64748B15',
            alignItems: 'center', justifyContent: 'center', marginRight: 10,
          }}>
            <VideoIcon color={isActive ? '#FF6240' : '#64748B'} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '700' }} numberOfLines={1}>
              {room.job_title ?? room.label}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 11, marginTop: 1 }}>
              {isScheduled && room.scheduled_at
                ? `Scheduled · ${formatDate(room.scheduled_at)} at ${formatTime(room.scheduled_at)}`
                : `Created ${formatTimeAgo(room.created_at)}`}
            </Text>
          </View>
          <View style={{
            backgroundColor: isActive ? (room.interview_type === 'live' ? '#22C55E15' : '#818CF815') : '#64748B15',
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
          }}>
            <Text style={{
              fontSize: 11, fontWeight: '600',
              color: isActive ? (room.interview_type === 'live' ? '#22C55E' : '#818CF8') : '#64748B',
            }}>
              {isActive ? (room.interview_type === 'live' ? 'Live' : 'Scheduled') : 'Ended'}
            </Text>
          </View>
        </View>

        {/* Room code row */}
        <Pressable
          onPress={handleCopy}
          style={{
            backgroundColor: '#DDD6C9', borderRadius: 10,
            paddingHorizontal: 12, paddingVertical: 9, marginBottom: 12,
            flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <Text style={{ color: '#5A4F6E', fontSize: 11, flex: 1 }} numberOfLines={1}>
            {room.room_url}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 8 }}>
            <CopyIcon color={copied ? '#22C55E' : '#5A4F6E'} />
            <Text style={{ color: copied ? '#22C55E' : '#5A4F6E', fontSize: 11, fontWeight: '600' }}>
              {copied ? 'Copied!' : 'Copy'}
            </Text>
          </View>
        </Pressable>

        {/* Scheduled info — show date/time reminder */}
        {isScheduled && room.scheduled_at && isActive && !canJoin && (
          <View style={{
            backgroundColor: '#818CF810', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8,
            marginBottom: 12, borderWidth: 1, borderColor: '#818CF820',
          }}>
            <Text style={{ color: '#818CF8', fontSize: 12, fontWeight: '600' }}>
              Join button appears on {formatDate(room.scheduled_at)} at {formatTime(room.scheduled_at)}
            </Text>
          </View>
        )}

        {/* Action buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {canJoin && (
            <Pressable
              onPress={onJoin}
              style={{
                flex: 1, backgroundColor: '#22C55E', borderRadius: 10,
                paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
              }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Join Call</Text>
            </Pressable>
          )}


          {isActive && (
            <Pressable
              onPress={onEnd}
              style={{
                backgroundColor: '#EF444415', borderRadius: 10,
                paddingVertical: 10, paddingHorizontal: 14,
                borderWidth: 1, borderColor: '#EF444430',
              }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>End</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function InterviewsScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [showNewModal, setShowNewModal] = useState(false)
  const [activeRoomUrl, setActiveRoomUrl] = useState<string | null>(null)

  const { data: rooms = [], isLoading, refetch, isRefetching } = useQuery<InterviewRoom[]>({
    queryKey: ['interview-rooms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('interview_rooms')
        .select('*')
        .eq('company_id', user!.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as InterviewRoom[]) ?? []
    },
    enabled: !!user?.id,
  })

  const createMutation = useMutation({
    mutationFn: async ({ job, type, scheduledAt }: {
      job: ActiveJob
      type: InterviewType
      scheduledAt: Date | null
    }) => {
      const { error } = await supabase.functions.invoke('interview-rooms', {
        method: 'POST',
        body: {
          jobPostingId: job.id,
          jobTitle: job.title,
          interviewType: type,
          scheduledAt: scheduledAt?.toISOString() ?? null,
        },
      })
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interview-rooms', user?.id] })
    },
    onError: (err) => {
      Alert.alert('Failed to create room', err instanceof Error ? err.message : 'Something went wrong')
    },
  })

  const endMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase.functions.invoke('interview-rooms', {
        method: 'DELETE',
        body: { roomId: id },
      })
      if (error) throw error
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['interview-rooms', user?.id] }),
    onError: () => Alert.alert('Error', 'Could not end the room. Please try again.'),
  })

  const handleEnd = useCallback((room: InterviewRoom) => {
    Alert.alert(
      'End interview room?',
      'The room will be closed and the link will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End room', style: 'destructive', onPress: () => endMutation.mutate({ id: room.id }) },
      ],
    )
  }, [endMutation])

  const liveRooms = rooms.filter((r) => r.status === 'active' && r.interview_type === 'live')
  const scheduledRooms = rooms.filter((r) => r.status === 'active' && r.interview_type === 'scheduled')
  const endedRooms = rooms.filter((r) => r.status === 'ended')

  const listData: ListItem[] = [
    ...(liveRooms.length > 0 ? [{ type: 'header' as const, title: `Live (${liveRooms.length})` }] : []),
    ...liveRooms.map((r) => ({ type: 'room' as const, room: r })),
    ...(scheduledRooms.length > 0 ? [{ type: 'header' as const, title: `Scheduled (${scheduledRooms.length})` }] : []),
    ...scheduledRooms.map((r) => ({ type: 'room' as const, room: r })),
    ...(endedRooms.length > 0 ? [{ type: 'header' as const, title: 'Ended' }] : []),
    ...endedRooms.map((r) => ({ type: 'room' as const, room: r })),
  ]

  return (
    <SafeAreaView className="flex-1 bg-surface" edges={['top']}>
      <View style={{
        paddingHorizontal: 20, paddingTop: 24, paddingBottom: 14,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <View>
          <Text style={{ color: '#1A1625', fontSize: 28, fontWeight: '700' }}>Interviews</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>Live & scheduled video rooms</Text>
        </View>
        <Pressable
          onPress={() => setShowNewModal(true)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 6,
            backgroundColor: '#FF6240', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9,
          }}
          className="active:opacity-80"
        >
          <PlusIcon />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>New Room</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color="#FF6240" size="large" />
        </View>
      ) : rooms.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 20,
            backgroundColor: '#FF624015', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <VideoIcon color="#FF6240" size={28} />
          </View>
          <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            No interviews yet
          </Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28 }}>
            Create a live room now or schedule one for a future date. Share the link with candidates.
          </Text>
          <Pressable
            onPress={() => setShowNewModal(true)}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingHorizontal: 24, paddingVertical: 13 }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create First Room</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, i) => (item.type === 'room' ? item.room.id : `h-${i}`)}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <Text style={{
                  color: '#5A4F6E', fontSize: 12, fontWeight: '600',
                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 4,
                }}>
                  {item.title}
                </Text>
              )
            }
            return (
              <RoomCard
                room={item.room}
                onJoin={() => setActiveRoomUrl(item.room.room_url)}
                onEnd={() => handleEnd(item.room)}
              />
            )
          }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#FF6240" />}
        />
      )}

      <NewRoomModal
        visible={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreate={(params) => createMutation.mutate(params)}
      />

      {activeRoomUrl && (
        <VideoCallModal url={activeRoomUrl} onClose={() => setActiveRoomUrl(null)} />
      )}

      {createMutation.isPending && (
        <View style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: '#00000060', alignItems: 'center', justifyContent: 'center',
        }}>
          <View style={{
            backgroundColor: '#F5F0E8', borderRadius: 20,
            padding: 28, alignItems: 'center', gap: 14,
          }}>
            <ActivityIndicator color="#FF6240" size="large" />
            <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 15 }}>Creating room…</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  )
}

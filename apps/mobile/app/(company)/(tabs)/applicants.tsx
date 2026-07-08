import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  FlatList,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  TextInput,
  RefreshControl,
  StatusBar,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'
import WebView from 'react-native-webview'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const DAILY_API_KEY = process.env.EXPO_PUBLIC_DAILY_API_KEY ?? ''

interface InterviewRoom {
  id: string
  company_id: string
  room_name: string
  room_url: string
  label: string
  status: 'active' | 'ended'
  created_at: string
  ended_at: string | null
}

type ListItem =
  | { type: 'header'; title: string }
  | { type: 'room'; room: InterviewRoom }

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

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
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function ShareIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
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

async function createDailyRoom(roomName: string): Promise<{ url: string; name: string }> {
  const res = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${DAILY_API_KEY}`,
    },
    body: JSON.stringify({
      name: roomName,
      privacy: 'public',
      properties: {
        max_participants: 10,
        exp: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
        enable_chat: true,
        enable_people_ui: true,
        enable_pip_ui: true,
        start_video_off: false,
        start_audio_off: false,
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json() as { error?: string }
    throw new Error(err?.error ?? 'Failed to create room')
  }
  return res.json() as Promise<{ url: string; name: string }>
}

async function deleteDailyRoom(roomName: string): Promise<void> {
  await fetch(`https://api.daily.co/v1/rooms/${roomName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${DAILY_API_KEY}` },
  })
}

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
            style={{ backgroundColor: '#ffffff20', borderRadius: 20, padding: 6 }}
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

function RoomCard({ room, onJoin, onShare, onEnd }: {
  room: InterviewRoom
  onJoin: () => void
  onShare: () => void
  onEnd: () => void
}) {
  const isActive = room.status === 'active'

  return (
    <Animated.View entering={FadeInDown.duration(350)}>
      <View style={{
        backgroundColor: '#EDE7DB',
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#DDD6C9',
        padding: 16,
        marginBottom: 12,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          <View style={{
            width: 42, height: 42, borderRadius: 12,
            backgroundColor: isActive ? '#FF624015' : '#64748B15',
            alignItems: 'center', justifyContent: 'center', marginRight: 12,
          }}>
            <VideoIcon color={isActive ? '#FF6240' : '#64748B'} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700' }} numberOfLines={1}>
              {room.label}
            </Text>
            <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
              {formatTimeAgo(room.created_at)}
            </Text>
          </View>
          <View style={{
            backgroundColor: isActive ? '#22C55E15' : '#64748B15',
            borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4,
          }}>
            <Text style={{ color: isActive ? '#22C55E' : '#64748B', fontSize: 11, fontWeight: '600' }}>
              {isActive ? 'Live' : 'Ended'}
            </Text>
          </View>
        </View>

        <View style={{
          backgroundColor: '#DDD6C9', borderRadius: 8,
          paddingHorizontal: 10, paddingVertical: 7, marginBottom: 12,
        }}>
          <Text style={{ color: '#5A4F6E', fontSize: 11 }} numberOfLines={1}>
            {room.room_url}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          {isActive && (
            <Pressable
              onPress={onJoin}
              style={{
                flex: 1, backgroundColor: '#FF6240', borderRadius: 10,
                paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
              }}
              className="active:opacity-70"
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Join Call</Text>
            </Pressable>
          )}

          <Pressable
            onPress={onShare}
            style={{
              flex: 1, backgroundColor: '#FF624010', borderRadius: 10,
              paddingVertical: 10, alignItems: 'center', justifyContent: 'center',
              flexDirection: 'row', gap: 5, borderWidth: 1, borderColor: '#FF624025',
            }}
            className="active:opacity-70"
          >
            <ShareIcon />
            <Text style={{ color: '#FF6240', fontWeight: '600', fontSize: 13 }}>Share Link</Text>
          </Pressable>

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

function NewRoomModal({ visible, onClose, onCreate }: {
  visible: boolean
  onClose: () => void
  onCreate: (label: string) => void
}) {
  const [label, setLabel] = useState('')

  const handleCreate = () => {
    onCreate(label.trim() || 'Interview Room')
    setLabel('')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#00000050', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        <Pressable
          style={{ backgroundColor: '#F5F0E8', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24 }}
          onPress={() => {}}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>New Interview Room</Text>
            <Pressable onPress={onClose} hitSlop={10}><XIcon /></Pressable>
          </View>

          <Text style={{ color: '#5A4F6E', fontSize: 13, marginBottom: 8 }}>Room label (optional)</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder="e.g. Senior Dev Interview — Ada"
            placeholderTextColor="#94A3B8"
            style={{
              backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1,
              borderColor: '#DDD6C9', paddingHorizontal: 14, paddingVertical: 13,
              color: '#1A1625', fontSize: 14, marginBottom: 8,
            }}
          />
          <Text style={{ color: '#94A3B8', fontSize: 11, marginBottom: 20 }}>
            Leave blank to use "Interview Room"
          </Text>

          <View style={{
            backgroundColor: '#FF624010', borderRadius: 12, padding: 12,
            borderWidth: 1, borderColor: '#FF624020', marginBottom: 24,
          }}>
            <Text style={{ color: '#5A4F6E', fontSize: 12, lineHeight: 18 }}>
              A video room is created on Daily.co. Share the link with candidates — up to 10 people can join. The room expires after 24 hours.
            </Text>
          </View>

          <Pressable
            onPress={handleCreate}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center' }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Create Room & Join</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

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
    mutationFn: async (label: string) => {
      const roomName = `ivw-${user!.id.slice(0, 8)}-${Date.now()}`
      const daily = await createDailyRoom(roomName)
      const { error } = await supabase.from('interview_rooms').insert({
        company_id: user!.id,
        room_name: daily.name,
        room_url: daily.url,
        label,
        status: 'active',
      })
      if (error) throw error
      return daily.url
    },
    onSuccess: (roomUrl) => {
      void queryClient.invalidateQueries({ queryKey: ['interview-rooms', user?.id] })
      setShowNewModal(false)
      setActiveRoomUrl(roomUrl)
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      Alert.alert('Failed to create room', msg)
    },
  })

  const endMutation = useMutation({
    mutationFn: async ({ id, roomName }: { id: string; roomName: string }) => {
      await deleteDailyRoom(roomName)
      const { error } = await supabase
        .from('interview_rooms')
        .update({ status: 'ended', ended_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['interview-rooms', user?.id] })
    },
    onError: () => Alert.alert('Error', 'Could not end the room. Please try again.'),
  })

  const handleShare = async (room: InterviewRoom) => {
    await Share.share({
      message: `You're invited to a video interview.\n\nJoin here: ${room.room_url}\n\nThe link is valid for 24 hours.`,
      url: room.room_url,
    })
  }

  const handleEnd = (room: InterviewRoom) => {
    Alert.alert(
      'End interview room?',
      'The room will be closed and the link will stop working.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End room',
          style: 'destructive',
          onPress: () => endMutation.mutate({ id: room.id, roomName: room.room_name }),
        },
      ],
    )
  }

  const liveRooms = rooms.filter((r) => r.status === 'active')
  const endedRooms = rooms.filter((r) => r.status === 'ended')

  const listData: ListItem[] = [
    ...(liveRooms.length > 0 ? [{ type: 'header' as const, title: `Active (${liveRooms.length})` }] : []),
    ...liveRooms.map((r) => ({ type: 'room' as const, room: r })),
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
          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700' }}>Interviews</Text>
          <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>Live video rooms for candidates</Text>
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
            Create a room and share the link with candidates. Up to 10 people can join each call.
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
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  marginBottom: 10, marginTop: 4,
                }}>
                  {item.title}
                </Text>
              )
            }
            return (
              <RoomCard
                room={item.room}
                onJoin={() => setActiveRoomUrl(item.room.room_url)}
                onShare={() => handleShare(item.room)}
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
        onCreate={(label) => createMutation.mutate(label)}
      />

      {activeRoomUrl && (
        <VideoCallModal
          url={activeRoomUrl}
          onClose={() => setActiveRoomUrl(null)}
        />
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

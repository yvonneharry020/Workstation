import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
  StatusBar,
} from 'react-native'
import { useState, useEffect, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'
import Animated, {
  FadeIn,
  FadeOut,
  SlideInRight,
  SlideOutRight,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path, Circle, Rect, Polygon } from 'react-native-svg'
import { useAuthStore } from '@/stores/authStore'

type PanelTab = 'chat' | 'participants' | null

interface ChatMessage {
  id: string
  sender: string
  text: string
  time: Date
  isOwnMessage: boolean
}

const MOCK_PARTICIPANTS = ['Adaeze Nwosu (Candidate)', 'Tunde Balogun (Recruiter)']

const MOCK_CHAT: ChatMessage[] = [
  {
    id: 'm1',
    sender: 'Tunde Balogun',
    text: 'Welcome! We will start in just a moment.',
    time: new Date(Date.now() - 120000),
    isOwnMessage: false,
  },
]

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function formatChatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function RecordingDot() {
  const opacity = useSharedValue(1)

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(withTiming(0.2, { duration: 600 }), withTiming(1, { duration: 600 })),
      -1,
    )
  }, [opacity])

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View style={[{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }, style]} />
  )
}

// ─── Control button ─────────────────────────────────────────────────────────

type ControlVariant = 'default' | 'active' | 'danger'

interface ControlButtonProps {
  icon: React.ReactNode
  label: string
  onPress: () => void
  variant?: ControlVariant
  badge?: number
}

function ControlButton({ icon, label, onPress, variant = 'default', badge }: ControlButtonProps) {
  const bgColour = variant === 'danger' ? '#7C2210' : variant === 'active' ? '#FF624025' : '#1E1B2A'
  const borderColour = variant === 'danger' ? '#D9451E' : variant === 'active' ? '#FF6240' : '#3D3850'
  const textColour = variant === 'danger' ? '#FF6240' : variant === 'active' ? '#FF6240' : '#94A3B8'

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 52, height: 52, borderRadius: 26,
        backgroundColor: bgColour, borderWidth: 1.5, borderColor: borderColour,
        alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
        {badge != null && badge > 0 && (
          <View style={{
            position: 'absolute', top: -2, right: -2,
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{badge > 9 ? '9+' : badge}</Text>
          </View>
        )}
      </View>
      <Text style={{ color: textColour, fontSize: 10, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  )
}

// ─── SVG icon components ─────────────────────────────────────────────────────

function MicIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
        <Path d="M17 16.95A7 7 0 0 1 5 12v-2M19 10v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8" />
      </Svg>
    )
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </Svg>
  )
}

function CameraIcon({ off }: { off?: boolean }) {
  if (off) {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M16.84 16.84A5 5 0 0 1 7 16V8m9 0a5 5 0 0 1 1 3v0l4.38-2.19A.5.5 0 0 1 22 9.25v5.5a.5.5 0 0 1-.62.49L17 13" />
        <Path d="M1 1l22 22" />
      </Svg>
    )
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="23 7 16 12 23 17 23 7" />
      <Rect x={1} y={5} width={15} height={14} rx={2} ry={2} />
    </Svg>
  )
}

function ShareIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13" />
    </Svg>
  )
}

function RecordIcon({ active }: { active: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={active ? '#EF4444' : '#94A3B8'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Circle cx={12} cy={12} r={4} fill={active ? '#EF4444' : 'none'} />
    </Svg>
  )
}

function HandIcon({ raised }: { raised: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={raised ? '#FF6240' : '#94A3B8'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <Path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </Svg>
  )
}

function ChatIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

function PeopleIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

function GridIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={3} width={7} height={7} />
      <Rect x={14} y={3} width={7} height={7} />
      <Rect x={3} y={14} width={7} height={7} />
      <Rect x={14} y={14} width={7} height={7} />
    </Svg>
  )
}

function PhoneIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07C9.44 17.29 7.76 15.6 6.06 13.32A19.79 19.79 0 0 1 3 4.72 2 2 0 0 1 4.99 2.5h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L9.07 10.4" />
      <Path d="M23 1L1 23" stroke="#EF4444" />
    </Svg>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ActiveMeetingRoomScreen() {
  const { bookingId, isHost, participantName } = useLocalSearchParams<{
    bookingId: string
    isHost: 'true' | 'false'
    participantName: string
  }>()

  const insets = useSafeAreaInsets()
  const role = useAuthStore((s) => s.role)
  const hostMode = isHost === 'true' || role === 'company'

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [isHandRaised, setIsHandRaised] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelTab>(null)
  const [isGridView, setIsGridView] = useState(false)
  const [callDuration, setCallDuration] = useState(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(MOCK_CHAT)
  const [chatInput, setChatInput] = useState('')
  const [unreadChat, setUnreadChat] = useState(1)

  useEffect(() => {
    const interval = setInterval(() => setCallDuration((d) => d + 1), 1000)
    return () => clearInterval(interval)
  }, [])

  const togglePanel = (tab: PanelTab) => {
    if (tab === 'chat') setUnreadChat(0)
    setActivePanel((prev) => (prev === tab ? null : tab))
  }

  const sendMessage = () => {
    const text = chatInput.trim()
    if (!text) return
    const newMsg: ChatMessage = {
      id: `m${Date.now()}`,
      sender: participantName ?? 'You',
      text,
      time: new Date(),
      isOwnMessage: true,
    }
    setChatMessages((prev) => [...prev, newMsg])
    setChatInput('')
  }

  const handleLeave = () => {
    Alert.alert(
      'Leave meeting?',
      'You will exit the video interview.',
      [
        { text: 'Stay', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: () => {
            router.replace({
              pathname: '/video-room/summary',
              params: {
                bookingId: bookingId ?? '',
                duration: String(callDuration),
                participantCount: '2',
                isRecorded: isRecording ? 'true' : 'false',
                isHost: hostMode ? 'true' : 'false',
              },
            })
          },
        },
      ],
    )
  }

  const toggleRecord = () => {
    if (!hostMode) return
    const next = !isRecording
    setIsRecording(next)
    if (next) Alert.alert('Recording started', 'All participants have been notified.')
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#09080E' }}>
      <StatusBar barStyle="light-content" backgroundColor="#09080E" />

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <View style={{
        position: 'absolute', top: insets.top + 8, left: 16, right: 16, zIndex: 20,
        flexDirection: 'row', alignItems: 'center', gap: 12,
      }}>
        {isRecording && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 6,
              backgroundColor: '#2D0E0E', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
              borderWidth: 1, borderColor: '#991B1B',
            }}
          >
            <RecordingDot />
            <Text style={{ color: '#EF4444', fontSize: 11, fontWeight: '700', letterSpacing: 0.5 }}>REC</Text>
          </Animated.View>
        )}
        <View style={{ flex: 1 }} />
        <View style={{ backgroundColor: '#131118', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#3D3850' }}>
          <Text style={{ color: '#E2E8F0', fontSize: 14, fontWeight: '600', fontVariant: ['tabular-nums'] }}>
            {formatDuration(callDuration)}
          </Text>
        </View>
        <Pressable
          onPress={() => setIsGridView((v) => !v)}
          style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#131118', borderWidth: 1, borderColor: '#3D3850', alignItems: 'center', justifyContent: 'center' }}
        >
          <GridIcon />
        </Pressable>
      </View>

      {/* ── Main video area ───────────────────────────────────────────────── */}
      {isGridView ? (
        <View style={{ flex: 1, padding: 8, paddingTop: insets.top + 60, paddingBottom: 160 }}>
          <View style={{ flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { name: 'Adaeze Nwosu', colour: '#FF6240', isSelf: false },
              { name: participantName ?? 'You', colour: '#0DD4C3', isSelf: true },
            ].map((p) => (
              <View key={p.name} style={{
                width: '48.5%', aspectRatio: 4 / 3,
                backgroundColor: '#131118', borderRadius: 16, borderWidth: 1.5,
                borderColor: p.isSelf ? '#0DD4C3' : '#3D3850',
                alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: `${p.colour}25`, borderWidth: 2, borderColor: p.colour, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: p.colour, fontSize: 20, fontWeight: '800' }}>{p.name.charAt(0)}</Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 11, marginTop: 8 }}>{p.name}</Text>
                {p.isSelf && isCameraOff && (
                  <View style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#EF444430', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                    <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '600' }}>Camera off</Text>
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {/* Speaker tile */}
          <View style={{ flex: 1, backgroundColor: '#0A090F', alignItems: 'center', justifyContent: 'center' }}>
            <View style={{
              width: 100, height: 100, borderRadius: 50,
              backgroundColor: '#FF624020', borderWidth: 3, borderColor: '#FF6240',
              alignItems: 'center', justifyContent: 'center',
              shadowColor: '#FF6240', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 24,
            }}>
              <Text style={{ color: '#FF6240', fontSize: 40, fontWeight: '800' }}>A</Text>
            </View>
            <Text style={{ color: '#E2E8F0', fontSize: 16, fontWeight: '600', marginTop: 16 }}>Adaeze Nwosu</Text>
            <Text style={{ color: '#475569', fontSize: 12, marginTop: 4 }}>Speaking…</Text>
          </View>

          {/* Self-view (bottom-right corner) */}
          <View style={{
            position: 'absolute', bottom: 160, right: 16,
            width: 100, height: 140, borderRadius: 14,
            backgroundColor: isCameraOff ? '#1E1B2A' : '#131118',
            borderWidth: 2, borderColor: '#0DD4C3',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {isCameraOff ? (
              <>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0DD4C320', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#0DD4C3', fontSize: 14, fontWeight: '800' }}>
                    {(participantName ?? 'Y').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: '#475569', fontSize: 9, marginTop: 4 }}>Camera off</Text>
              </>
            ) : (
              <>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0DD4C320', borderWidth: 2, borderColor: '#0DD4C3', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#0DD4C3', fontSize: 14, fontWeight: '800' }}>
                    {(participantName ?? 'Y').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 9, marginTop: 4 }}>You</Text>
              </>
            )}
            {isMuted && (
              <View style={{ position: 'absolute', bottom: 6, left: 6, width: 20, height: 20, borderRadius: 10, backgroundColor: '#EF444440', alignItems: 'center', justifyContent: 'center' }}>
                <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round">
                  <Path d="M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6" />
                </Svg>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ── Side panel (Chat / Participants) ─────────────────────────────── */}
      {activePanel && (
        <Animated.View
          entering={SlideInRight.duration(280)}
          exiting={SlideOutRight.duration(220)}
          style={{
            position: 'absolute', top: 0, bottom: 0, right: 0,
            width: '75%', backgroundColor: '#131118',
            borderLeftWidth: 1, borderLeftColor: '#3D3850',
            paddingTop: insets.top,
            zIndex: 30,
          }}
        >
          {/* Panel header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#3D3850' }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={() => setActivePanel('chat')}>
                <Text style={{ color: activePanel === 'chat' ? '#FF6240' : '#94A3B8', fontSize: 14, fontWeight: '700' }}>Chat</Text>
              </Pressable>
              <Pressable onPress={() => setActivePanel('participants')}>
                <Text style={{ color: activePanel === 'participants' ? '#FF6240' : '#94A3B8', fontSize: 14, fontWeight: '700' }}>People</Text>
              </Pressable>
            </View>
            <Pressable onPress={() => setActivePanel(null)} hitSlop={12}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round">
                <Path d="M18 6L6 18M6 6l12 12" />
              </Svg>
            </Pressable>
          </View>

          {activePanel === 'chat' ? (
            <View style={{ flex: 1 }}>
              <ScrollView style={{ flex: 1, padding: 12 }} contentContainerStyle={{ gap: 12 }}>
                {chatMessages.map((msg) => (
                  <View key={msg.id} style={{ alignItems: msg.isOwnMessage ? 'flex-end' : 'flex-start' }}>
                    {!msg.isOwnMessage && (
                      <Text style={{ color: '#475569', fontSize: 10, marginBottom: 3 }}>{msg.sender}</Text>
                    )}
                    <View style={{
                      backgroundColor: msg.isOwnMessage ? '#FF624020' : '#1E1B2A',
                      borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
                      maxWidth: '85%', borderWidth: 1,
                      borderColor: msg.isOwnMessage ? '#FF640040' : '#3D3850',
                    }}>
                      <Text style={{ color: '#E2E8F0', fontSize: 13, lineHeight: 18 }}>{msg.text}</Text>
                    </View>
                    <Text style={{ color: '#334155', fontSize: 10, marginTop: 3 }}>{formatChatTime(msg.time)}</Text>
                  </View>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#3D3850' }}>
                <TextInput
                  value={chatInput}
                  onChangeText={setChatInput}
                  placeholder="Type a message…"
                  placeholderTextColor="#475569"
                  style={{ flex: 1, height: 40, backgroundColor: '#1E1B2A', borderRadius: 20, paddingHorizontal: 14, color: '#E2E8F0', fontSize: 13, borderWidth: 1, borderColor: '#3D3850' }}
                  onSubmitEditing={sendMessage}
                  returnKeyType="send"
                />
                <Pressable onPress={sendMessage} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center' }}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
                  </Svg>
                </Pressable>
              </View>
            </View>
          ) : (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }}>
              {MOCK_PARTICIPANTS.map((name, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: '#1E1B2A', borderRadius: 12 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: i === 0 ? '#FF624020' : '#0DD4C320', borderWidth: 1.5, borderColor: i === 0 ? '#FF6240' : '#0DD4C3', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: i === 0 ? '#FF6240' : '#0DD4C3', fontSize: 14, fontWeight: '700' }}>{name.charAt(0)}</Text>
                  </View>
                  <Text style={{ color: '#E2E8F0', fontSize: 13, fontWeight: '500', flex: 1 }} numberOfLines={1}>{name}</Text>
                  {i === 1 && (
                    <Text style={{ color: '#475569', fontSize: 11 }}>You</Text>
                  )}
                </View>
              ))}
            </ScrollView>
          )}
        </Animated.View>
      )}

      {/* ── Controls bar ─────────────────────────────────────────────────── */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#0D0C14', borderTopWidth: 1, borderTopColor: '#3D3850',
        paddingBottom: insets.bottom + 12, paddingTop: 16, paddingHorizontal: 20,
      }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <ControlButton
            icon={<MicIcon off={isMuted} />}
            label={isMuted ? 'Unmute' : 'Mute'}
            onPress={() => setIsMuted((v) => !v)}
            variant={isMuted ? 'danger' : 'default'}
          />
          <ControlButton
            icon={<CameraIcon off={isCameraOff} />}
            label={isCameraOff ? 'Start cam' : 'Stop cam'}
            onPress={() => setIsCameraOff((v) => !v)}
            variant={isCameraOff ? 'danger' : 'default'}
          />
          <ControlButton
            icon={<ShareIcon />}
            label="Share"
            onPress={() => Alert.alert('Screen share', 'Screen sharing will be available in the next release.')}
          />
          {hostMode && (
            <ControlButton
              icon={<RecordIcon active={isRecording} />}
              label={isRecording ? 'Stop rec' : 'Record'}
              onPress={toggleRecord}
              variant={isRecording ? 'active' : 'default'}
            />
          )}
          <ControlButton
            icon={<HandIcon raised={isHandRaised} />}
            label={isHandRaised ? 'Lower' : 'Raise'}
            onPress={() => setIsHandRaised((v) => !v)}
            variant={isHandRaised ? 'active' : 'default'}
          />
          <ControlButton
            icon={<ChatIcon />}
            label="Chat"
            onPress={() => togglePanel('chat')}
            variant={activePanel === 'chat' ? 'active' : 'default'}
            badge={activePanel !== 'chat' ? unreadChat : 0}
          />
          <ControlButton
            icon={<PeopleIcon />}
            label="People"
            onPress={() => togglePanel('participants')}
            variant={activePanel === 'participants' ? 'active' : 'default'}
          />
          {/* Leave — distinct red button */}
          <Pressable
            onPress={handleLeave}
            style={({ pressed }) => ({
              alignItems: 'center', gap: 6, opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#7C2210', alignItems: 'center', justifyContent: 'center' }}>
              <PhoneIcon />
            </View>
            <Text style={{ color: '#EF4444', fontSize: 10, fontWeight: '600' }}>Leave</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  Platform,
} from 'react-native'
import { useState } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import { KeyboardAvoidingView } from 'react-native'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { useAuthStore } from '@/stores/authStore'

type NetworkQuality = 'good' | 'fair' | 'poor'

interface WaitingParticipant {
  id: string
  name: string
  joinedAt: Date
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function CameraIcon({ active }: { active: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={active ? '#FF6240' : '#5A4F6E'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 7l-7 5 7 5V7z" />
      <Rect x={1} y={5} width={15} height={14} rx={2} ry={2} />
    </Svg>
  )
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={active ? '#FF6240' : '#5A4F6E'} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <Path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
    </Svg>
  )
}

function SignalIcon({ quality }: { quality: NetworkQuality }) {
  const colour = quality === 'good' ? '#22C55E' : quality === 'fair' ? '#F59E0B' : '#EF4444'
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colour} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M1.5 8.5a13 13 0 0 1 21 0" opacity={quality !== 'poor' ? 1 : 0.3} />
      <Path d="M5 12a9 9 0 0 1 14 0" opacity={quality === 'good' ? 1 : 0.3} />
      <Circle cx={12} cy={17} r={1} />
    </Svg>
  )
}

function UserIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <Circle cx={12} cy={7} r={4} />
    </Svg>
  )
}

function CheckIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M20 6L9 17l-5-5" />
    </Svg>
  )
}

function NetworkQualityLabel({ quality }: { quality: NetworkQuality }) {
  const label = quality === 'good' ? 'Good connection' : quality === 'fair' ? 'Fair connection' : 'Poor connection'
  const colour = quality === 'good' ? '#22C55E' : quality === 'fair' ? '#F59E0B' : '#EF4444'
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <SignalIcon quality={quality} />
      <Text style={{ color: colour, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </View>
  )
}

const MOCK_PARTICIPANTS: WaitingParticipant[] = [
  { id: 'p1', name: 'Adaeze Nwosu', joinedAt: new Date(Date.now() - 90000) },
]

export default function PreMeetingLobbyScreen() {
  const { bookingId, isHost, roomId } = useLocalSearchParams<{
    bookingId: string
    isHost: 'true' | 'false'
    roomId: string
  }>()

  const user = useAuthStore((s) => s.user)
  const role = useAuthStore((s) => s.role)

  const [displayName, setDisplayName] = useState(user?.user_metadata?.full_name ?? '')
  const [cameraReady, setCameraReady] = useState(false)
  const [micReady, setMicReady] = useState(false)
  const [networkQuality] = useState<NetworkQuality>('good')
  const [waitingList, setWaitingList] = useState<WaitingParticipant[]>(
    isHost === 'true' ? MOCK_PARTICIPANTS : [],
  )
  const [isJoining, setIsJoining] = useState(false)

  const hostMode = isHost === 'true' || role === 'company'
  const canJoin = displayName.trim().length > 0

  const handleTestCamera = () => {
    setTimeout(() => setCameraReady(true), 600)
    Alert.alert('Camera check', 'Camera is working properly.')
  }

  const handleTestMic = () => {
    setTimeout(() => setMicReady(true), 600)
    Alert.alert('Microphone check', 'Microphone is working properly.')
  }

  const admitParticipant = (id: string) => {
    setWaitingList((prev) => prev.filter((p) => p.id !== id))
  }

  const denyParticipant = (id: string) => {
    setWaitingList((prev) => prev.filter((p) => p.id !== id))
  }

  const handleJoin = () => {
    if (!canJoin) return
    setIsJoining(true)
    setTimeout(() => {
      router.push({
        pathname: '/video-room/room',
        params: {
          bookingId: bookingId ?? '',
          isHost: hostMode ? 'true' : 'false',
          roomId: roomId ?? 'room-001',
          participantName: displayName.trim(),
        },
      })
    }, 800)
  }

  const userInitial = displayName.trim().charAt(0).toUpperCase() || '?'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#C8BFB0' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <BackIcon />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>Pre-Interview Lobby</Text>
            <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 1 }}>
              {hostMode ? 'You are the host' : 'Waiting for host to admit you'}
            </Text>
          </View>
          <NetworkQualityLabel quality={networkQuality} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 140 }}>
          {/* Camera Preview */}
          <Animated.View entering={FadeInDown.duration(400).delay(100)} style={{ paddingHorizontal: 20, marginTop: 24, marginBottom: 20 }}>
            <View style={{
              height: 220, borderRadius: 20, backgroundColor: '#EDE7DB',
              borderWidth: 1, borderColor: '#C8BFB0',
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {/* Mock camera view — placeholder until LiveKit camera stream is integrated */}
              <View style={{
                width: 80, height: 80, borderRadius: 40,
                backgroundColor: '#FF624020',
                borderWidth: 2, borderColor: '#FF6240',
                alignItems: 'center', justifyContent: 'center',
                marginBottom: 12,
              }}>
                <Text style={{ color: '#FF6240', fontSize: 32, fontWeight: '800' }}>{userInitial}</Text>
              </View>
              <Text style={{ color: '#5A4F6E', fontSize: 13 }}>{displayName || 'Your name'}</Text>
              <View style={{ position: 'absolute', bottom: 12, left: 12, flexDirection: 'row', gap: 8 }}>
                <View style={{
                  backgroundColor: cameraReady ? '#052E1680' : '#2A263880',
                  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}>
                  <CameraIcon active={cameraReady} />
                  <Text style={{ color: cameraReady ? '#22C55E' : '#5A4F6E', fontSize: 11, fontWeight: '600' }}>
                    {cameraReady ? 'Camera OK' : 'Camera'}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: micReady ? '#052E1680' : '#2A263880',
                  borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4,
                  flexDirection: 'row', alignItems: 'center', gap: 4,
                }}>
                  <MicIcon active={micReady} />
                  <Text style={{ color: micReady ? '#22C55E' : '#5A4F6E', fontSize: 11, fontWeight: '600' }}>
                    {micReady ? 'Mic OK' : 'Mic'}
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Device Test Buttons */}
          <Animated.View entering={FadeInDown.duration(400).delay(200)} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              Device Check
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Pressable
                onPress={handleTestCamera}
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: cameraReady ? '#052E16' : '#EDE7DB',
                  borderWidth: 1.5, borderColor: cameraReady ? '#15803D' : '#C8BFB0',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {cameraReady && <CheckIcon />}
                <CameraIcon active={cameraReady} />
                <Text style={{ color: cameraReady ? '#22C55E' : '#1A1625', fontSize: 13, fontWeight: '600' }}>
                  {cameraReady ? 'Camera OK' : 'Test Camera'}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleTestMic}
                style={({ pressed }) => ({
                  flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
                  gap: 6, paddingVertical: 12, borderRadius: 12,
                  backgroundColor: micReady ? '#052E16' : '#EDE7DB',
                  borderWidth: 1.5, borderColor: micReady ? '#15803D' : '#C8BFB0',
                  opacity: pressed ? 0.75 : 1,
                })}
              >
                {micReady && <CheckIcon />}
                <MicIcon active={micReady} />
                <Text style={{ color: micReady ? '#22C55E' : '#1A1625', fontSize: 13, fontWeight: '600' }}>
                  {micReady ? 'Mic OK' : 'Test Mic'}
                </Text>
              </Pressable>
            </View>
          </Animated.View>

          {/* Display Name */}
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 8 }}>Your display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your name"
              placeholderTextColor="#475569"
              style={{
                height: 52, backgroundColor: '#EDE7DB', borderWidth: 1.5,
                borderColor: displayName ? '#564F6A' : '#C8BFB0',
                borderRadius: 16, paddingHorizontal: 16,
                color: '#1A1625', fontSize: 15,
              }}
              maxLength={40}
            />
          </Animated.View>

          {/* In Meeting Already */}
          <Animated.View entering={FadeInDown.duration(400).delay(350)} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 10 }}>
              In the room
            </Text>
            <View style={{ backgroundColor: '#EDE7DB', borderRadius: 16, borderWidth: 1, borderColor: '#C8BFB0', padding: 16 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#0DD4C320', borderWidth: 1.5, borderColor: '#0DD4C3', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#0DD4C3', fontSize: 14, fontWeight: '700' }}>H</Text>
                </View>
                <View>
                  <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }}>Host (Recruiting Team)</Text>
                  <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 1 }}>Waiting for you</Text>
                </View>
                <View style={{ marginLeft: 'auto', backgroundColor: '#052E16', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                  <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '600' }}>Live</Text>
                </View>
              </View>
            </View>
          </Animated.View>

          {/* Host: Waiting Room Management */}
          {hostMode && waitingList.length > 0 && (
            <Animated.View entering={FadeInUp.duration(400)} style={{ paddingHorizontal: 20, marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  Waiting to join
                </Text>
                <View style={{ backgroundColor: '#FF624020', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>{waitingList.length}</Text>
                </View>
              </View>
              <View style={{ gap: 8 }}>
                {waitingList.map((participant) => (
                  <View key={participant.id} style={{
                    backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1,
                    borderColor: '#C8BFB0', padding: 14,
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                  }}>
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#D4CCBE', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }}>
                        {participant.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600' }}>{participant.name}</Text>
                      <Text style={{ color: '#475569', fontSize: 11, marginTop: 1 }}>Waiting · {Math.round((Date.now() - participant.joinedAt.getTime()) / 60000)}m ago</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <Pressable
                        onPress={() => denyParticipant(participant.id)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                          backgroundColor: '#2D0E0E', borderWidth: 1, borderColor: '#991B1B',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '600' }}>Deny</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => admitParticipant(participant.id)}
                        style={({ pressed }) => ({
                          paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
                          backgroundColor: '#052E16', borderWidth: 1, borderColor: '#15803D',
                          opacity: pressed ? 0.7 : 1,
                        })}
                      >
                        <Text style={{ color: '#22C55E', fontSize: 12, fontWeight: '600' }}>Admit</Text>
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </Animated.View>
          )}

          {/* Recording notice */}
          <Animated.View entering={FadeInDown.duration(400).delay(400)} style={{ marginHorizontal: 20, backgroundColor: '#2D1B00', borderWidth: 1, borderColor: '#92400E', borderRadius: 12, padding: 12, flexDirection: 'row', gap: 10 }}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <Circle cx={12} cy={12} r={10} />
              <Path d="M12 8v4M12 16h.01" />
            </Svg>
            <Text style={{ color: '#1A1625', fontSize: 12, flex: 1, lineHeight: 18 }}>
              This interview may be recorded by the company for review purposes. By joining, you consent to recording.
            </Text>
          </Animated.View>
        </ScrollView>

        {/* Join Button — sticky bottom */}
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          backgroundColor: '#F5F0E8', borderTopWidth: 1, borderTopColor: '#C8BFB0',
          paddingHorizontal: 20, paddingBottom: 34, paddingTop: 16,
        }}>
          <Pressable
            onPress={handleJoin}
            disabled={!canJoin || isJoining}
            style={({ pressed }) => ({
              height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: canJoin ? '#FF6240' : '#D4CCBE',
              opacity: pressed ? 0.85 : (!canJoin || isJoining) ? 0.5 : 1,
              shadowColor: '#FF6240',
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: canJoin ? 0.4 : 0,
              shadowRadius: 20,
              elevation: canJoin ? 8 : 0,
            })}
          >
            <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700' }}>
              {isJoining ? 'Joining…' : "I'm Ready — Join Meeting"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

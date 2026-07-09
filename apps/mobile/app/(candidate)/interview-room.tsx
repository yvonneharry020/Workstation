import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  Linking,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useState } from 'react'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path, Rect } from 'react-native-svg'

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function VideoIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M23 7l-7 5 7 5V7z" />
      <Rect x={1} y={5} width={15} height={14} rx={2} ry={2} stroke="#FF6240" strokeWidth={1.5} />
    </Svg>
  )
}

function LinkIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <Path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </Svg>
  )
}

function normalizeRoomUrl(input: string): string {
  const trimmed = input.trim()
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  return `https://${trimmed}`
}

export default function InterviewRoomScreen() {
  const [meetingUrl, setMeetingUrl] = useState('')
  const [joining, setJoining] = useState(false)

  const handleJoin = async () => {
    const raw = meetingUrl.trim()
    if (!raw) {
      Alert.alert('Meeting link required', 'Please paste the meeting link or code your interviewer shared with you.')
      return
    }

    const url = normalizeRoomUrl(raw)
    const canOpen = await Linking.canOpenURL(url).catch(() => false)

    if (!canOpen) {
      Alert.alert(
        'Invalid link',
        'The meeting link you entered does not appear to be valid. Please paste the full link exactly as your interviewer sent it.',
      )
      return
    }

    setJoining(true)
    try {
      await Linking.openURL(url)
    } catch {
      Alert.alert('Could not open link', 'Please copy the link and open it manually in your browser.')
    } finally {
      setJoining(false)
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }}>
      {/* Header */}
      <View style={{
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 20, paddingVertical: 14,
        borderBottomWidth: 1, borderBottomColor: '#DDD6C9',
      }}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
          <BackIcon />
        </Pressable>
        <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700' }}>Interview Room</Text>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon + intro */}
          <Animated.View entering={FadeInDown.duration(350)} style={{ alignItems: 'center', marginBottom: 32 }}>
            <View style={{
              width: 80, height: 80, borderRadius: 24,
              backgroundColor: '#FF624015', borderWidth: 1.5, borderColor: '#FF624030',
              alignItems: 'center', justifyContent: 'center', marginBottom: 16,
            }}>
              <VideoIcon />
            </View>
            <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 8 }}>
              Join your Interview
            </Text>
            <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, maxWidth: 300 }}>
              Paste the meeting link your interviewer sent you to join the video or audio call.
            </Text>
          </Animated.View>

          {/* Input card */}
          <Animated.View
            entering={FadeInDown.delay(80).duration(350)}
            style={{
              backgroundColor: '#EDE7DB', borderRadius: 20,
              borderWidth: 1, borderColor: '#DDD6C9', padding: 20, marginBottom: 16,
            }}
          >
            <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>
              Meeting Link
            </Text>

            <View style={{
              flexDirection: 'row', alignItems: 'center', gap: 10,
              backgroundColor: '#F5F0E8', borderRadius: 14, borderWidth: 1.5,
              borderColor: meetingUrl.trim() ? '#FF624060' : '#DDD6C9',
              paddingHorizontal: 14, paddingVertical: 12,
              marginBottom: 20,
            }}>
              <LinkIcon />
              <TextInput
                value={meetingUrl}
                onChangeText={setMeetingUrl}
                placeholder="Paste meeting link here…"
                placeholderTextColor="#C8BFB0"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="go"
                onSubmitEditing={handleJoin}
                style={{
                  flex: 1, color: '#1A1625', fontSize: 14,
                  fontWeight: '500', padding: 0,
                }}
              />
              {meetingUrl.trim().length > 0 && (
                <Pressable onPress={() => setMeetingUrl('')} hitSlop={8}>
                  <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M18 6L6 18M6 6l12 12" />
                  </Svg>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={handleJoin}
              disabled={joining || !meetingUrl.trim()}
              style={({ pressed }) => ({
                backgroundColor: meetingUrl.trim() ? '#FF6240' : '#DDD6C9',
                borderRadius: 14, paddingVertical: 15, alignItems: 'center',
                opacity: (pressed || joining) ? 0.75 : 1,
              })}
            >
              <Text style={{
                color: meetingUrl.trim() ? '#fff' : '#94A3B8',
                fontSize: 15, fontWeight: '700',
              }}>
                {joining ? 'Opening…' : 'Join Interview'}
              </Text>
            </Pressable>
          </Animated.View>

          {/* Tips card */}
          <Animated.View
            entering={FadeInDown.delay(160).duration(350)}
            style={{
              backgroundColor: '#EDE7DB', borderRadius: 20,
              borderWidth: 1, borderColor: '#DDD6C9', padding: 20,
            }}
          >
            <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
              Before you join
            </Text>
            {[
              'Find a quiet place with good lighting',
              'Test your camera and microphone beforehand',
              'Join 2–3 minutes early to settle in',
              'Have a copy of your CV or portfolio ready',
              'The meeting link is sent by your interviewer — never share it with others',
            ].map((tip, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: i < 4 ? 10 : 0 }}>
                <View style={{
                  width: 20, height: 20, borderRadius: 10, marginTop: 1,
                  backgroundColor: '#FF624015', borderWidth: 1, borderColor: '#FF624030',
                  alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Text style={{ color: '#FF6240', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
                </View>
                <Text style={{ color: '#334155', fontSize: 13, lineHeight: 20, flex: 1 }}>{tip}</Text>
              </View>
            ))}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

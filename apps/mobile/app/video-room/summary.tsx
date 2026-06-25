import {
  View,
  Text,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native'
import { useState, useEffect } from 'react'
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
import Svg, { Path, Circle, Polyline, Polygon } from 'react-native-svg'
import { useAuthStore } from '@/stores/authStore'

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}h ${m}m ${s}s`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function AnimatedCheckmark() {
  const scale = useSharedValue(0)
  const opacity = useSharedValue(0)

  useEffect(() => {
    scale.value = withDelay(300, withSpring(1, { damping: 12, stiffness: 180 }))
    opacity.value = withDelay(300, withSpring(1))
  }, [scale, opacity])

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <Animated.View
      style={[{
        width: 96, height: 96, borderRadius: 48,
        backgroundColor: '#0DD4C315',
        borderWidth: 2, borderColor: '#0DD4C340',
        alignItems: 'center', justifyContent: 'center',
      }, style]}
    >
      <Svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <Polyline points="20 6 9 17 4 12" />
      </Svg>
    </Animated.View>
  )
}

function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <View style={{
      flex: 1, backgroundColor: '#131118', borderRadius: 14,
      borderWidth: 1, borderColor: '#3D3850', padding: 16,
      alignItems: 'center', gap: 8,
    }}>
      {icon}
      <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: '#94A3B8', fontSize: 12, textAlign: 'center' }}>{label}</Text>
    </View>
  )
}

function ClockIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Circle cx={12} cy={12} r={10} />
      <Path d="M12 6v6l4 2" />
    </Svg>
  )
}

function PeopleIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  )
}

function VideoIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="23 7 16 12 23 17 23 7" />
      <Path d="M1 5h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H1a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

function StarIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? '#F59E0B' : 'none'} stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </Svg>
  )
}

function FileIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <Polyline points="14 2 14 8 20 8" />
    </Svg>
  )
}

function ExternalLinkIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <Polyline points="15 3 21 3 21 9" />
      <Path d="M10 14L21 3" />
    </Svg>
  )
}

export default function MeetingEndedSummaryScreen() {
  const { bookingId, duration, participantCount, isRecorded, isHost } = useLocalSearchParams<{
    bookingId: string
    duration: string
    participantCount: string
    isRecorded: 'true' | 'false'
    isHost: 'true' | 'false'
  }>()

  const role = useAuthStore((s) => s.role)
  const hostMode = isHost === 'true' || role === 'company'

  const durationSeconds = parseInt(duration ?? '0', 10)
  const participants = parseInt(participantCount ?? '2', 10)
  const wasRecorded = isRecorded === 'true'

  const [rating, setRating] = useState(0)
  const [impression, setImpression] = useState('')
  const [feedbackText, setFeedbackText] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)

  const submitRating = async () => {
    if (rating === 0) {
      Alert.alert('Rating required', 'Please select a star rating before submitting.')
      return
    }
    setIsSaving(true)
    // Rating is internal — only company sees this; never shown to candidate
    await new Promise((res) => setTimeout(res, 800))
    setIsSaving(false)
    setRatingSubmitted(true)
  }

  const handleGoToNotes = () => {
    router.push({
      pathname: '/(company)/interviews/notes/[id]',
      params: { id: bookingId ?? 'unknown' },
    })
  }

  const handleCandidateHome = () => {
    router.replace('/(candidate)/interviews/history' as Parameters<typeof router.replace>[0])
  }

  const handleCompanyHome = () => {
    router.replace('/(company)/interviews/calendar' as Parameters<typeof router.replace>[0])
  }

  const handleViewRecording = () => {
    router.push({
      pathname: '/video-room/playback',
      params: { bookingId: bookingId ?? '', recordingId: 'rec-001' },
    })
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#09080E' }} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(500)} style={{ alignItems: 'center', paddingTop: 48, paddingBottom: 32, paddingHorizontal: 20 }}>
          <AnimatedCheckmark />
          <Text style={{ color: '#FFFFFF', fontSize: 28, fontWeight: '800', marginTop: 24, letterSpacing: -0.5, textAlign: 'center' }}>
            Interview Complete
          </Text>
          <Text style={{ color: '#94A3B8', fontSize: 15, marginTop: 8, textAlign: 'center', lineHeight: 22 }}>
            The meeting has ended.{'\n'}Here's a summary.
          </Text>
        </Animated.View>

        {/* Stats row */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginBottom: 20 }}>
          <StatCard label="Duration" value={formatDuration(durationSeconds)} icon={<ClockIcon />} />
          <StatCard label="Participants" value={String(participants)} icon={<PeopleIcon />} />
        </Animated.View>

        {/* Recording saved */}
        {wasRecorded && (
          <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#2D1B00', borderWidth: 1, borderColor: '#92400E', borderRadius: 16, padding: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <VideoIcon />
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#F59E0B', fontSize: 14, fontWeight: '700' }}>Recording saved</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Available for 7 days · Company access only</Text>
              </View>
            </View>
            {hostMode && (
              <Pressable
                onPress={handleViewRecording}
                style={({ pressed }) => ({
                  flexDirection: 'row', alignItems: 'center', gap: 8,
                  backgroundColor: '#13110A', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
                  borderWidth: 1, borderColor: '#3D3850',
                  opacity: pressed ? 0.7 : 1, alignSelf: 'flex-start',
                })}
              >
                <ExternalLinkIcon />
                <Text style={{ color: '#0DD4C3', fontSize: 13, fontWeight: '600' }}>View recording</Text>
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Company: Add interview notes */}
        {hostMode && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <Pressable
              onPress={handleGoToNotes}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: '#131118', borderRadius: 16, borderWidth: 1.5,
                borderColor: '#FF6240', padding: 16, opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                <FileIcon />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>Add interview notes</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>Private — only visible to your team</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 18l6-6-6-6" />
              </Svg>
            </Pressable>
          </Animated.View>
        )}

        {/* Company: Internal quick rating (never shown to candidate) */}
        {hostMode && !ratingSubmitted && (
          <Animated.View entering={FadeInUp.delay(400).duration(400)} style={{ marginHorizontal: 20, marginBottom: 20, backgroundColor: '#131118', borderRadius: 16, borderWidth: 1, borderColor: '#3D3850', padding: 20 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', marginBottom: 4 }}>Quick impression</Text>
            <Text style={{ color: '#475569', fontSize: 12, marginBottom: 16 }}>
              Internal only — this rating is never shared with the candidate.
            </Text>
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 20 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Pressable key={star} onPress={() => setRating(star)} hitSlop={8}>
                  <StarIcon filled={star <= rating} />
                </Pressable>
              ))}
            </View>
            {rating > 0 && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <TextInput
                  value={impression}
                  onChangeText={setImpression}
                  placeholder="Add a brief note about the candidate…"
                  placeholderTextColor="#475569"
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: '#1E1B2A', borderWidth: 1.5, borderColor: '#3D3850',
                    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
                    color: '#E2E8F0', fontSize: 14, lineHeight: 20,
                    marginBottom: 14, minHeight: 80, textAlignVertical: 'top',
                  }}
                />
                <Pressable
                  onPress={submitRating}
                  disabled={isSaving}
                  style={({ pressed }) => ({
                    height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: '#FF6240', opacity: isSaving || pressed ? 0.7 : 1,
                  })}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>
                    {isSaving ? 'Saving…' : 'Save rating'}
                  </Text>
                </Pressable>
              </Animated.View>
            )}
          </Animated.View>
        )}

        {hostMode && ratingSubmitted && (
          <Animated.View entering={FadeInDown.duration(300)} style={{ marginHorizontal: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#052E16', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#15803D' }}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Polyline points="20 6 9 17 4 12" />
            </Svg>
            <Text style={{ color: '#22C55E', fontSize: 13, fontWeight: '600' }}>Rating saved — visible only to your team.</Text>
          </Animated.View>
        )}

        {/* Candidate: View upcoming interviews */}
        {!hostMode && (
          <Animated.View entering={FadeInUp.delay(350).duration(400)} style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <Pressable
              onPress={handleCandidateHome}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 14,
                backgroundColor: '#131118', borderRadius: 16, borderWidth: 1,
                borderColor: '#3D3850', padding: 16, opacity: pressed ? 0.75 : 1,
              })}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#0DD4C320', alignItems: 'center', justifyContent: 'center' }}>
                <ClockIcon />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>My upcoming interviews</Text>
                <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 2 }}>View your schedule</Text>
              </View>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 18l6-6-6-6" />
              </Svg>
            </Pressable>
          </Animated.View>
        )}

        {/* Feedback prompt (both roles, optional) */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={{ marginHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ color: '#475569', fontSize: 12, marginBottom: 10, textAlign: 'center' }}>
            Optional · Help improve Workstation
          </Text>
          <TextInput
            value={feedbackText}
            onChangeText={setFeedbackText}
            placeholder="Share feedback about your interview experience…"
            placeholderTextColor="#334155"
            multiline
            numberOfLines={3}
            style={{
              backgroundColor: '#131118', borderWidth: 1, borderColor: '#3D3850',
              borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
              color: '#E2E8F0', fontSize: 14, lineHeight: 20,
              minHeight: 80, textAlignVertical: 'top', marginBottom: 10,
            }}
          />
          {feedbackText.trim().length > 0 && (
            <Pressable
              onPress={() => {
                setFeedbackText('')
                Alert.alert('Thank you', 'Your feedback has been submitted.')
              }}
              style={({ pressed }) => ({
                height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
                borderWidth: 1.5, borderColor: '#0DD4C3', opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text style={{ color: '#0DD4C3', fontSize: 14, fontWeight: '600' }}>Submit feedback</Text>
            </Pressable>
          )}
        </Animated.View>

        {/* Primary CTA */}
        <Animated.View entering={FadeInUp.delay(550).duration(400)} style={{ paddingHorizontal: 20, gap: 12 }}>
          <Pressable
            onPress={hostMode ? handleCompanyHome : handleCandidateHome}
            style={({ pressed }) => ({
              height: 52, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
              backgroundColor: '#FF6240', opacity: pressed ? 0.85 : 1,
              shadowColor: '#FF6240', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.4, shadowRadius: 20,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' }}>
              {hostMode ? 'Back to calendar' : 'Back to applications'}
            </Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

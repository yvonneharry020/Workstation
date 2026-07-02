import {
  View,
  Text,
  Pressable,
  ScrollView,
  Alert,
} from 'react-native'
import { useState, useEffect, useRef, useCallback } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated'
import Svg, { Path, Polygon, Rect } from 'react-native-svg'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const TOTAL_DURATION_SECS = 1860 // 31 minutes — mock recording length

const PLAYBACK_SPEEDS = [0.5, 1, 1.25, 1.5] as const
type PlaybackSpeed = typeof PLAYBACK_SPEEDS[number]

interface Annotation {
  id: string
  timestampSecs: number
  text: string
  author: string
}

const MOCK_ANNOTATIONS: Annotation[] = [
  { id: 'a1', timestampSecs: 120, text: 'Strong introduction — confident and concise.', author: 'Tunde Balogun' },
  { id: 'a2', timestampSecs: 480, text: 'Good answer on leadership experience.', author: 'Tunde Balogun' },
  { id: 'a3', timestampSecs: 900, text: 'Hesitated on technical question — worth noting.', author: 'Tunde Balogun' },
  { id: 'a4', timestampSecs: 1440, text: 'Very strong closing — asked great questions.', author: 'Tunde Balogun' },
]

function formatTime(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = Math.floor(secs % 60)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function BackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 5l-7 7 7 7" />
    </Svg>
  )
}

function PlayIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="#FFFFFF" stroke="none">
      <Polygon points="5 3 19 12 5 21 5 3" />
    </Svg>
  )
}

function PauseIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="#FFFFFF" stroke="none">
      <Rect x={6} y={4} width={4} height={16} />
      <Rect x={14} y={4} width={4} height={16} />
    </Svg>
  )
}

function SkipBackIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="11 19 2 12 11 5 11 19" />
      <Path d="M22 19V5M22 12H13" />
    </Svg>
  )
}

function SkipForwardIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#E2E8F0" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Polygon points="13 19 22 12 13 5 13 19" />
      <Path d="M2 19V5M2 12h9" />
    </Svg>
  )
}

function DownloadIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </Svg>
  )
}

function LockIcon() {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Rect x={3} y={11} width={18} height={11} rx={2} ry={2} />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </Svg>
  )
}

function BookmarkIcon({ active }: { active: boolean }) {
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill={active ? '#FF6240' : 'none'} stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </Svg>
  )
}

interface TimelineProps {
  currentSecs: number
  totalSecs: number
  annotations: Annotation[]
  onSeek: (secs: number) => void
  onAnnotationPress: (annotation: Annotation) => void
}

function Timeline({ currentSecs, totalSecs, annotations, onSeek, onAnnotationPress }: TimelineProps) {
  const progress = totalSecs > 0 ? currentSecs / totalSecs : 0

  return (
    <View style={{ paddingHorizontal: 20, gap: 8 }}>
      {/* Time labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: '#5A4F6E', fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatTime(currentSecs)}</Text>
        <Text style={{ color: '#475569', fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatTime(totalSecs)}</Text>
      </View>

      {/* Progress track */}
      <Pressable
        onPress={(e) => {
          // Approximate seek based on press x position — requires layout measurement in production
          const approxX = e.nativeEvent.locationX
          const trackWidth = 340 // rough estimate; real implementation uses onLayout
          const ratio = Math.min(Math.max(approxX / trackWidth, 0), 1)
          onSeek(Math.floor(ratio * totalSecs))
        }}
        style={{ height: 40, justifyContent: 'center' }}
      >
        {/* Track background */}
        <View style={{ height: 4, backgroundColor: '#D4CCBE', borderRadius: 2 }}>
          {/* Fill */}
          <View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: '#FF6240', borderRadius: 2 }} />
          {/* Playhead thumb */}
          <View style={{
            position: 'absolute', left: `${progress * 100}%`, top: -6,
            width: 16, height: 16, borderRadius: 8,
            backgroundColor: '#FF6240', marginLeft: -8,
            shadowColor: '#FF6240', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 8,
          }} />
        </View>

        {/* Annotation markers on the track */}
        {annotations.map((ann) => {
          const markerProgress = ann.timestampSecs / totalSecs
          return (
            <Pressable
              key={ann.id}
              onPress={() => onAnnotationPress(ann)}
              hitSlop={8}
              style={{
                position: 'absolute', left: `${markerProgress * 100}%`,
                top: -4, marginLeft: -5,
                width: 10, height: 10, borderRadius: 5,
                backgroundColor: '#0DD4C3',
                borderWidth: 1.5, borderColor: '#F5F0E8',
              }}
            />
          )
        })}
      </Pressable>
    </View>
  )
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function InterviewRecordingPlaybackScreen() {
  const { bookingId, _recordingId } = useLocalSearchParams<{
    bookingId: string
    _recordingId: string
  }>()

  const role = useAuthStore((s) => s.role)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isPlaying, setIsPlaying] = useState(false)
  const [currentSecs, setCurrentSecs] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1)
  const [selectedAnnotation, setSelectedAnnotation] = useState<Annotation | null>(null)
  const [_showSpeedPicker, _setShowSpeedPicker] = useState(false)

  // Access guard — recording is company-only
  const isAuthorised = role === 'company'

  const { data: bookingDetail } = useQuery({
    queryKey: ['recording-booking', bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from('interview_bookings')
        .select(`
          id,
          interview_slots ( slot_date, start_time, duration_mins, job_postings ( title ) ),
          candidate_profiles:candidate_id ( first_name, last_name )
        `)
        .eq('id', bookingId)
        .single()
      return data
    },
    enabled: !!bookingId && isAuthorised,
  })

  useEffect(() => {
    if (isPlaying) {
      intervalRef.current = setInterval(() => {
        setCurrentSecs((prev) => {
          const next = prev + playbackSpeed
          if (next >= TOTAL_DURATION_SECS) {
            setIsPlaying(false)
            return TOTAL_DURATION_SECS
          }
          return next
        })
      }, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isPlaying, playbackSpeed])

  const handleSeek = useCallback((secs: number) => {
    setCurrentSecs(secs)
    setSelectedAnnotation(null)
  }, [])

  const handleAnnotationPress = useCallback((annotation: Annotation) => {
    setCurrentSecs(annotation.timestampSecs)
    setIsPlaying(false)
    setSelectedAnnotation(annotation)
  }, [])

  const skipSeconds = (delta: number) => {
    setCurrentSecs((prev) => Math.min(Math.max(prev + delta, 0), TOTAL_DURATION_SECS))
  }

  const handleDownload = () => {
    Alert.alert(
      'Download recording',
      'This will generate a signed download link. The link expires in 24 hours.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Download',
          onPress: () => Alert.alert('Link ready', 'A download link has been sent to your email.'),
        },
      ],
    )
  }

  // Access denied state
  if (!isAuthorised) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#C8BFB0' }}>
          <Pressable onPress={() => router.back()} hitSlop={12}><BackIcon /></Pressable>
          <Text style={{ color: '#1A1625', fontSize: 18, fontWeight: '700' }}>Interview Recording</Text>
        </View>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 20 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#2D1B00', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#92400E' }}>
            <LockIcon />
          </View>
          <Text style={{ color: '#1A1625', fontSize: 20, fontWeight: '700', textAlign: 'center' }}>Access Restricted</Text>
          <Text style={{ color: '#5A4F6E', fontSize: 14, textAlign: 'center', lineHeight: 22 }}>
            Interview recordings are only accessible to verified company accounts. Candidates cannot view recordings of their own interviews.
          </Text>
        </View>
      </SafeAreaView>
    )
  }

  const candidateName = bookingDetail
    ? `${(bookingDetail as any)?.candidate_profiles?.first_name ?? ''} ${(bookingDetail as any)?.candidate_profiles?.last_name ?? ''}`.trim()
    : 'Candidate'
  const jobTitle = (bookingDetail as any)?.interview_slots?.job_postings?.title ?? 'Interview'

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F0E8' }} edges={['top']}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#C8BFB0' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}><BackIcon /></Pressable>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }} numberOfLines={1}>{candidateName || 'Recording'}</Text>
          <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 1 }} numberOfLines={1}>{jobTitle}</Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2D1B00', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#92400E' }}>
          <LockIcon />
          <Text style={{ color: '#F59E0B', fontSize: 11, fontWeight: '600' }}>Company only</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* ── Video player ──────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.duration(400)} style={{ marginHorizontal: 20, marginTop: 20, marginBottom: 16 }}>
          <View style={{
            height: 220, borderRadius: 20, backgroundColor: '#0A0910',
            borderWidth: 1.5, borderColor: '#C8BFB0',
            alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden',
          }}>
            {/* Mock video frame — replaced with actual video player (expo-av / livekit) in production */}
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <View style={{ flexDirection: 'row', gap: 24 }}>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FF624020', borderWidth: 2, borderColor: '#FF6240', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FF6240', fontSize: 28, fontWeight: '800' }}>
                    {(candidateName || 'C').charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#0DD4C320', borderWidth: 2, borderColor: '#0DD4C3', alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#0DD4C3', fontSize: 28, fontWeight: '800' }}>R</Text>
                </View>
              </View>
              <Text style={{ color: '#475569', fontSize: 12 }}>Video preview · {formatTime(currentSecs)}</Text>
            </View>

            {/* Overlay: current time indicator */}
            <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#00000080', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
              <Text style={{ color: '#1A1625', fontSize: 12, fontVariant: ['tabular-nums'] }}>{formatTime(currentSecs)} / {formatTime(TOTAL_DURATION_SECS)}</Text>
            </View>

            {/* Speed badge */}
            {playbackSpeed !== 1 && (
              <View style={{ position: 'absolute', top: 12, right: 12, backgroundColor: '#FF624080', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
                <Text style={{ color: '#1A1625', fontSize: 11, fontWeight: '700' }}>{playbackSpeed}×</Text>
              </View>
            )}
          </View>
        </Animated.View>

        {/* ── Timeline ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)} style={{ marginBottom: 20 }}>
          <Timeline
            currentSecs={currentSecs}
            totalSecs={TOTAL_DURATION_SECS}
            annotations={MOCK_ANNOTATIONS}
            onSeek={handleSeek}
            onAnnotationPress={handleAnnotationPress}
          />
        </Animated.View>

        {/* ── Playback controls ─────────────────────────────────────────── */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)} style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
            <Pressable
              onPress={() => skipSeconds(-10)}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <SkipBackIcon />
            </Pressable>

            <Pressable
              onPress={() => setIsPlaying((v) => !v)}
              style={({ pressed }) => ({
                width: 64, height: 64, borderRadius: 32,
                backgroundColor: '#FF6240', alignItems: 'center', justifyContent: 'center',
                opacity: pressed ? 0.85 : 1,
                shadowColor: '#FF6240', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.45, shadowRadius: 16,
              })}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </Pressable>

            <Pressable
              onPress={() => skipSeconds(10)}
              hitSlop={12}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <SkipForwardIcon />
            </Pressable>
          </View>

          {/* Speed selector */}
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 20 }}>
            <Text style={{ color: '#475569', fontSize: 12, marginRight: 4 }}>Speed:</Text>
            {PLAYBACK_SPEEDS.map((speed) => (
              <Pressable
                key={speed}
                onPress={() => setPlaybackSpeed(speed)}
                style={({ pressed }) => ({
                  paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
                  backgroundColor: playbackSpeed === speed ? '#FF624020' : '#EDE7DB',
                  borderWidth: 1.5, borderColor: playbackSpeed === speed ? '#FF6240' : '#C8BFB0',
                  opacity: pressed ? 0.7 : 1,
                })}
              >
                <Text style={{ color: playbackSpeed === speed ? '#FF6240' : '#5A4F6E', fontSize: 13, fontWeight: '600' }}>
                  {speed}×
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>

        {/* ── Selected annotation callout ──────────────────────────────── */}
        {selectedAnnotation && (
          <Animated.View entering={FadeInDown.duration(250)} style={{ marginHorizontal: 20, marginBottom: 20 }}>
            <View style={{
              backgroundColor: '#0DD4C315', borderRadius: 14, borderWidth: 1.5,
              borderColor: '#0DD4C3', padding: 14, flexDirection: 'row', gap: 10,
            }}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </Svg>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>
                  Note at {formatTime(selectedAnnotation.timestampSecs)} · {selectedAnnotation.author}
                </Text>
                <Text style={{ color: '#1A1625', fontSize: 13, lineHeight: 18 }}>{selectedAnnotation.text}</Text>
              </View>
              <Pressable onPress={() => setSelectedAnnotation(null)} hitSlop={8}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round">
                  <Path d="M18 6L6 18M6 6l12 12" />
                </Svg>
              </Pressable>
            </View>
          </Animated.View>
        )}

        {/* ── Annotation list ───────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={{ color: '#5A4F6E', fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Notes &amp; Annotations
            </Text>
            <View style={{ backgroundColor: '#0DD4C320', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '700' }}>{MOCK_ANNOTATIONS.length}</Text>
            </View>
          </View>
          <View style={{ gap: 8 }}>
            {MOCK_ANNOTATIONS.map((ann) => {
              const isActive = selectedAnnotation?.id === ann.id
              return (
                <Pressable
                  key={ann.id}
                  onPress={() => handleAnnotationPress(ann)}
                  style={({ pressed }) => ({
                    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
                    backgroundColor: isActive ? '#0DD4C315' : '#EDE7DB',
                    borderRadius: 12, borderWidth: 1.5,
                    borderColor: isActive ? '#0DD4C3' : '#C8BFB0',
                    padding: 14, opacity: pressed ? 0.75 : 1,
                  })}
                >
                  <View style={{ backgroundColor: '#0DD4C320', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, alignItems: 'center', minWidth: 44 }}>
                    <Text style={{ color: '#0DD4C3', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }}>
                      {formatTime(ann.timestampSecs)}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#1A1625', fontSize: 13, lineHeight: 18 }} numberOfLines={2}>{ann.text}</Text>
                    <Text style={{ color: '#475569', fontSize: 11, marginTop: 4 }}>{ann.author}</Text>
                  </View>
                  <View style={{ marginTop: 2 }}>
                    <BookmarkIcon active={isActive} />
                  </View>
                </Pressable>
              )
            })}
          </View>
        </Animated.View>

        {/* ── Download ──────────────────────────────────────────────────── */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={{ paddingHorizontal: 20 }}>
          <View style={{ backgroundColor: '#08332F', borderRadius: 14, borderWidth: 1, borderColor: '#00A89A', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#0DD4C3', fontSize: 14, fontWeight: '700' }}>Download recording</Text>
              <Text style={{ color: '#5A4F6E', fontSize: 12, marginTop: 2 }}>
                Signed link · expires 7 days from interview date
              </Text>
            </View>
            <Pressable
              onPress={handleDownload}
              style={({ pressed }) => ({
                flexDirection: 'row', alignItems: 'center', gap: 6,
                backgroundColor: '#EDE7DB', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
                borderWidth: 1, borderColor: '#0DD4C3', opacity: pressed ? 0.7 : 1,
              })}
            >
              <DownloadIcon />
              <Text style={{ color: '#0DD4C3', fontSize: 13, fontWeight: '600' }}>Download</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  )
}

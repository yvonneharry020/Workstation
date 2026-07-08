import {
  View, Text, TextInput, Pressable, ScrollView,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  Alert, AppState, type AppStateStatus, Modal,
} from 'react-native'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface ScreeningQuestion {
  question: string
  required: boolean
}

interface JobScreeningInfo {
  id: string
  title: string
  screening_type: 'normal' | 'timed_quiz'
  quiz_duration_minutes: number | null
  screening_questions: ScreeningQuestion[] | null
  company_profiles: { company_name: string } | null
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function StepDot({ step, active, done }: { step: number; active: boolean; done: boolean }) {
  return (
    <View style={{
      width: 28, height: 28, borderRadius: 14,
      backgroundColor: done ? '#22C55E' : active ? '#FF6240' : '#E2DDD6',
      alignItems: 'center', justifyContent: 'center',
    }}>
      {done ? (
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M20 6L9 17l-5-5" />
        </Svg>
      ) : (
        <Text style={{ color: active ? '#fff' : '#94A3B8', fontSize: 12, fontWeight: '700' }}>{step}</Text>
      )}
    </View>
  )
}

function TimerDisplay({ secondsLeft, totalSeconds }: { secondsLeft: number; totalSeconds: number }) {
  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const pct = secondsLeft / totalSeconds
  const isUrgent = pct < 0.25

  return (
    <View style={{
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: isUrgent ? '#EF444415' : '#F59E0B15',
      borderWidth: 1.5, borderColor: isUrgent ? '#EF444440' : '#F59E0B40',
      borderRadius: 16, paddingVertical: 14, paddingHorizontal: 20,
      marginBottom: 20,
    }}>
      <Text style={{ color: '#94A3B8', fontSize: 11, fontWeight: '600', marginBottom: 4 }}>TIME REMAINING</Text>
      <Text style={{
        color: isUrgent ? '#EF4444' : '#F59E0B',
        fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'],
        letterSpacing: 2,
      }}>
        {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
      </Text>
      {isUrgent && (
        <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 4 }}>⚠ Time is running out!</Text>
      )}
    </View>
  )
}

function WarningModal({
  visible,
  isTimed,
  durationMinutes,
  questionCount,
  companyName,
  onStart,
  onBack,
}: {
  visible: boolean
  isTimed: boolean
  durationMinutes: number | null
  questionCount: number
  companyName: string
  onStart: () => void
  onBack: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Animated.View entering={FadeIn.duration(250)} style={{
          backgroundColor: '#F5F0E8', borderRadius: 24,
          padding: 24, width: '100%', maxWidth: 380,
          borderWidth: 1, borderColor: '#DDD6C9',
        }}>
          {/* Icon */}
          <View style={{
            width: 56, height: 56, borderRadius: 28,
            backgroundColor: isTimed ? '#F59E0B20' : '#6366F120',
            alignItems: 'center', justifyContent: 'center',
            marginBottom: 16, alignSelf: 'center',
          }}>
            {isTimed ? (
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Circle cx="12" cy="12" r="10" />
                <Path d="M12 6v6l4 2" />
              </Svg>
            ) : (
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 11l3 3L22 4" />
                <Path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </Svg>
            )}
          </View>

          <Text style={{ color: '#1A1625', fontWeight: '800', fontSize: 18, textAlign: 'center', marginBottom: 6 }}>
            {isTimed ? 'Timed Screening Quiz' : 'Screening Questions'}
          </Text>
          <Text style={{ color: '#64748B', fontSize: 13, textAlign: 'center', marginBottom: 20, lineHeight: 20 }}>
            {companyName} has set {questionCount} screening question{questionCount !== 1 ? 's' : ''} for this role
          </Text>

          {/* Info rows */}
          <View style={{ backgroundColor: '#EDE9E0', borderRadius: 14, padding: 14, gap: 12, marginBottom: 20 }}>
            {isTimed && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                <Text style={{ fontSize: 16 }}>⏱</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 13 }}>
                    You have {durationMinutes} minute{durationMinutes !== 1 ? 's' : ''}
                  </Text>
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                    A visible countdown timer will run on screen
                  </Text>
                </View>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <Text style={{ fontSize: 16 }}>📋</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 13 }}>
                  {questionCount} question{questionCount !== 1 ? 's' : ''} to answer
                </Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginTop: 2 }}>
                  Answer all required questions before submitting
                </Text>
              </View>
            </View>
            {isTimed && (
              <View style={{ backgroundColor: '#EF444410', borderWidth: 1, borderColor: '#EF444430', borderRadius: 10, padding: 10 }}>
                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 12 }}>⚠ Warning</Text>
                <Text style={{ color: '#EF4444', fontSize: 11, marginTop: 2, lineHeight: 16 }}>
                  If you switch to another app or leave this screen, your application will be automatically submitted with whatever answers you have filled in so far.
                </Text>
              </View>
            )}
          </View>

          <Pressable
            onPress={onStart}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 10 }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>
              {isTimed ? `Start ${durationMinutes}-min Quiz` : 'Start Screening'}
            </Text>
          </Pressable>
          <Pressable
            onPress={onBack}
            style={{ paddingVertical: 12, alignItems: 'center' }}
            className="active:opacity-60"
          >
            <Text style={{ color: '#94A3B8', fontSize: 14 }}>Go back</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  )
}

export default function ApplyStep2Screen() {
  const { jobId, coverLetter } = useLocalSearchParams<{ jobId: string; coverLetter: string }>()
  const user = useAuthStore((s) => s.user)

  const [showWarning, setShowWarning] = useState(true)
  const [started, setStarted] = useState(false)
  const [answers, setAnswers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const submittedRef = useRef(false)

  const { data: job, isLoading } = useQuery({
    queryKey: ['job-apply-step2', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('id, title, screening_type, quiz_duration_minutes, screening_questions, company_profiles(company_name)')
        .eq('id', jobId)
        .single()
      if (error) throw error
      const j = data as unknown as JobScreeningInfo
      const count = j.screening_questions?.length ?? 0
      setAnswers(new Array(count).fill(''))
      if (j.screening_type === 'timed_quiz' && j.quiz_duration_minutes) {
        setTimeLeft(j.quiz_duration_minutes * 60)
      }
      return j
    },
    enabled: !!jobId,
  })

  const handleSubmit = useCallback(async (autoSubmit = false) => {
    if (submittedRef.current) return
    submittedRef.current = true

    if (timerRef.current) clearInterval(timerRef.current)

    const questions = job?.screening_questions ?? []
    if (!autoSubmit) {
      const missingRequired = questions.some((q, i) => q.required && !answers[i]?.trim())
      if (missingRequired) {
        submittedRef.current = false
        Alert.alert('Required answers missing', 'Please answer all required questions before submitting.')
        return
      }
    }

    setIsSubmitting(true)
    try {
      const screeningAnswers: Record<string, string> = {}
      answers.forEach((ans, i) => { screeningAnswers[`q${i}`] = ans })

      const { error } = await supabase.from('job_applications').insert({
        job_id: jobId,
        candidate_id: user!.id,
        cover_note: coverLetter?.trim() || null,
        screening_answers: screeningAnswers,
      })
      if (error) throw error
      router.replace(`/(candidate)/jobs/applied?jobId=${jobId}`)
    } catch (err) {
      submittedRef.current = false
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      Alert.alert('Submission failed', msg)
    } finally {
      setIsSubmitting(false)
    }
  }, [job, answers, jobId, coverLetter, user])

  // Countdown timer
  useEffect(() => {
    if (!started || job?.screening_type !== 'timed_quiz') return
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!)
          void handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [started, job?.screening_type, handleSubmit])

  // Auto-submit when app goes to background (timed quiz only)
  useEffect(() => {
    if (!started || job?.screening_type !== 'timed_quiz') return
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'background' || state === 'inactive') {
        void handleSubmit(true)
      }
    })
    return () => sub.remove()
  }, [started, job?.screening_type, handleSubmit])

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  if (!job) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-5">
        <Text className="text-[#1A1625] font-semibold text-base mb-2">Job not found</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="text-primary-400 text-sm">← Go back</Text>
        </Pressable>
      </SafeAreaView>
    )
  }

  const questions = job.screening_questions ?? []
  const isTimed = job.screening_type === 'timed_quiz'
  const totalSeconds = (job.quiz_duration_minutes ?? 0) * 60
  const companyName = job.company_profiles?.company_name ?? 'the company'

  // No screening questions — submit directly
  if (questions.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center px-6">
        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#22C55E20', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          </View>
          <Text style={{ color: '#1A1625', fontWeight: '800', fontSize: 20, marginBottom: 8, textAlign: 'center' }}>
            Ready to submit
          </Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', marginBottom: 32, lineHeight: 20 }}>
            No screening questions for this role. Click below to send your application to {companyName}.
          </Text>
          <Pressable
            onPress={() => handleSubmit()}
            disabled={isSubmitting}
            style={{ backgroundColor: '#FF6240', borderRadius: 16, paddingVertical: 16, paddingHorizontal: 40, opacity: isSubmitting ? 0.7 : 1 }}
            className="active:opacity-80"
          >
            {isSubmitting ? <ActivityIndicator color="#fff" /> : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Submit Application</Text>
            )}
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Warning modal */}
      <WarningModal
        visible={showWarning}
        isTimed={isTimed}
        durationMinutes={job.quiz_duration_minutes}
        questionCount={questions.length}
        companyName={companyName}
        onStart={() => {
          setShowWarning(false)
          setStarted(true)
        }}
        onBack={() => router.back()}
      />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderColor: '#DDD6C9' }}>
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackIcon />
        </Pressable>
        <View className="flex-1">
          <Text style={{ color: '#94A3B8', fontSize: 11 }}>Step 2 — Screening</Text>
          <Text style={{ color: '#1A1625', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
            {job.title}
          </Text>
        </View>
      </View>

      {/* Step indicator */}
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 8 }}>
        <StepDot step={1} active={false} done />
        <View style={{ flex: 1, height: 2, backgroundColor: '#FF6240', borderRadius: 1 }} />
        <StepDot step={2} active done={false} />
        <View style={{ flex: 1, height: 2, backgroundColor: '#DDD6C9', borderRadius: 1 }} />
        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2DDD6', alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <Path d="M20 6L9 17l-5-5" />
          </Svg>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Timer */}
          {isTimed && started && (
            <TimerDisplay secondsLeft={timeLeft} totalSeconds={totalSeconds} />
          )}

          {/* Questions */}
          {questions.map((q, i) => (
            <Animated.View key={i} entering={FadeInDown.delay(i * 60).duration(350)} style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                <View style={{
                  width: 22, height: 22, borderRadius: 11,
                  backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1, flexShrink: 0,
                }}>
                  <Text style={{ color: '#FF6240', fontSize: 11, fontWeight: '700' }}>{i + 1}</Text>
                </View>
                <Text style={{ color: '#1A1625', fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 }}>
                  {q.question}
                  {q.required && <Text style={{ color: '#EF4444' }}> *</Text>}
                </Text>
              </View>
              <TextInput
                value={answers[i] ?? ''}
                onChangeText={(t) => {
                  setAnswers((prev) => prev.map((a, idx) => idx === i ? t : a))
                }}
                placeholder="Type your answer here…"
                placeholderTextColor="#94A3B8"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                style={{
                  backgroundColor: '#fff', borderRadius: 14,
                  borderWidth: 1, borderColor: answers[i]?.trim() ? '#FF624040' : '#DDD6C9',
                  paddingHorizontal: 14, paddingVertical: 12,
                  color: '#1A1625', fontSize: 14, minHeight: 96,
                }}
              />
            </Animated.View>
          ))}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36,
        borderTopWidth: 1, borderColor: '#DDD6C9', backgroundColor: '#F5F0E8',
      }}>
        {isTimed && started && (
          <Text style={{ color: '#94A3B8', fontSize: 11, textAlign: 'center', marginBottom: 8 }}>
            Leaving the app will auto-submit your current answers
          </Text>
        )}
        <Pressable
          onPress={() => handleSubmit()}
          disabled={isSubmitting}
          style={{ backgroundColor: '#FF6240', borderRadius: 16, paddingVertical: 16, alignItems: 'center', opacity: isSubmitting ? 0.7 : 1 }}
          className="active:opacity-80"
        >
          {isSubmitting
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>Submit Application</Text>
          }
        </Pressable>
      </View>
    </SafeAreaView>
  )
}

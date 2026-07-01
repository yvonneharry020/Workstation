import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native'
import { useState } from 'react'
import { useLocalSearchParams, router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { Image } from 'expo-image'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

interface CvVersion {
  id: string
  name: string
}

interface CandidateProfile {
  first_name: string
  last_name: string
  headline: string | null
  avatar_url: string | null
}

interface ScreeningQuestion {
  question: string
  required: boolean
}

interface JobInfo {
  title: string
  screening_questions: ScreeningQuestion[] | null
  company_profiles: {
    company_name: string
  } | null
}

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function ChevronIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round">
      <Path d="M6 9l6 6 6-6" />
    </Svg>
  )
}

const VERIF_BADGES = [
  { label: 'Phone ✓', color: '#22C55E' },
  { label: 'NIN ✓', color: '#22C55E' },
  { label: 'Liveness ✓', color: '#22C55E' },
]

function CvPicker({
  cvVersions,
  selectedId,
  onSelect,
}: {
  cvVersions: CvVersion[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = cvVersions.find((cv) => cv.id === selectedId)
  const options = [{ id: '', name: 'No CV attached' }, ...cvVersions]

  return (
    <View>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 flex-row items-center justify-between"
      >
        <Text className={selected ? 'text-[#1A1625] text-sm' : 'text-slate-500 text-sm'}>
          {selected ? selected.name : 'No CV attached'}
        </Text>
        <ChevronIcon />
      </Pressable>
      {open && (
        <View className="bg-surface-card border border-surface-border rounded-xl mt-1 overflow-hidden">
          {options.map((cv) => (
            <Pressable
              key={cv.id}
              onPress={() => { onSelect(cv.id); setOpen(false) }}
              className="px-4 py-3 border-b border-surface-border active:opacity-70"
            >
              <Text className={cv.id === selectedId ? 'text-primary-400 font-semibold text-sm' : 'text-[#1A1625] text-sm'}>
                {cv.name}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

export default function ApplyScreen() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>()
  const user = useAuthStore((s) => s.user)
  const [selectedCvId, setSelectedCvId] = useState('')
  const [coverNote, setCoverNote] = useState('')
  const [screeningAnswers, setScreeningAnswers] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data: jobInfo, isLoading: jobLoading } = useQuery({
    queryKey: ['job-apply-info', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('title, screening_questions, company_profiles(company_name)')
        .eq('id', jobId)
        .single()
      if (error) throw error
      const q = (data as unknown as JobInfo).screening_questions ?? []
      setScreeningAnswers(new Array(q.length).fill(''))
      return data as unknown as JobInfo
    },
    enabled: !!jobId,
  })

  const { data: candidate } = useQuery({
    queryKey: ['candidate-apply', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_profiles')
        .select('first_name, last_name, headline, avatar_url')
        .eq('id', user!.id)
        .single()
      if (error) throw error
      return data as unknown as CandidateProfile
    },
    enabled: !!user?.id,
  })

  const { data: cvVersions = [] } = useQuery({
    queryKey: ['cv-versions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('cv_versions')
        .select('id, name')
        .eq('candidate_id', user!.id)
        .order('created_at', { ascending: false })
      return (data ?? []) as CvVersion[]
    },
    enabled: !!user?.id,
  })

  const handleAnswerChange = (index: number, value: string) => {
    setScreeningAnswers((prev) => prev.map((a, i) => (i === index ? value : a)))
  }

  const handleSubmit = async () => {
    const questions = jobInfo?.screening_questions ?? []
    const missingRequired = questions.some((q, i) => q.required && !screeningAnswers[i]?.trim())
    if (missingRequired) {
      Alert.alert('Required fields', 'Please answer all required screening questions.')
      return
    }

    setIsSubmitting(true)
    try {
      const answers: Record<string, string> = {}
      screeningAnswers.forEach((ans, i) => { answers[`q${i}`] = ans })

      const { error } = await supabase.from('job_applications').insert({
        job_id: jobId,
        candidate_id: user!.id,
        cv_version_id: selectedCvId || null,
        cover_note: coverNote.trim() || null,
        screening_answers: answers,
      })
      if (error) throw error
      router.replace(`/(candidate)/jobs/applied?jobId=${jobId}`)
    } catch {
      Alert.alert('Error', 'Could not submit your application. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (jobLoading) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" />
      </SafeAreaView>
    )
  }

  const questions = jobInfo?.screening_questions ?? []
  const initials = candidate
    ? `${candidate.first_name[0]}${candidate.last_name[0]}`.toUpperCase()
    : '??'

  return (
    <SafeAreaView className="flex-1 bg-surface">
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 py-3 border-b border-surface-border">
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <BackIcon />
        </Pressable>
        <View className="flex-1">
          <Text className="text-slate-400 text-xs">Applying for</Text>
          <Text className="text-[#1A1625] font-semibold text-sm" numberOfLines={1}>{jobInfo?.title}</Text>
        </View>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* What company will see */}
          <Animated.View entering={FadeInDown.duration(400)} className="mt-5 mb-5">
            <Text className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
              What the company will see
            </Text>
            <View className="bg-surface-card border border-surface-border rounded-2xl p-4">
              <View className="flex-row items-center gap-3 mb-3">
                {candidate?.avatar_url ? (
                  <Image source={{ uri: candidate.avatar_url }} style={{ width: 52, height: 52, borderRadius: 26 }} contentFit="cover" />
                ) : (
                  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FF624020', alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#FF6240', fontSize: 16, fontWeight: '700' }}>{initials}</Text>
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-[#1A1625] font-semibold text-base">
                    {candidate ? `${candidate.first_name} ${candidate.last_name}` : '—'}
                  </Text>
                  {candidate?.headline && (
                    <Text className="text-slate-400 text-sm mt-0.5" numberOfLines={1}>{candidate.headline}</Text>
                  )}
                </View>
              </View>
              <View className="flex-row flex-wrap gap-2">
                {VERIF_BADGES.map((b) => (
                  <View
                    key={b.label}
                    style={{ backgroundColor: b.color + '20', borderWidth: 1, borderColor: b.color + '40', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}
                  >
                    <Text style={{ color: b.color, fontSize: 11, fontWeight: '600' }}>{b.label}</Text>
                  </View>
                ))}
              </View>
            </View>
          </Animated.View>

          {/* CV picker */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} className="mb-5">
            <Text className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">CV to submit</Text>
            <CvPicker cvVersions={cvVersions} selectedId={selectedCvId} onSelect={setSelectedCvId} />
            {cvVersions.length === 0 && (
              <Text className="text-slate-500 text-xs mt-2">
                No saved CVs.{' '}
                <Text className="text-primary-400" onPress={() => router.push('/(candidate)/cv')}>Create one →</Text>
              </Text>
            )}
          </Animated.View>

          {/* Cover note */}
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="mb-5">
            <View className="flex-row justify-between mb-2">
              <Text className="text-slate-300 text-xs font-semibold uppercase tracking-wider">Cover note</Text>
              <Text className="text-slate-600 text-xs">{coverNote.length}/500</Text>
            </View>
            <TextInput
              value={coverNote}
              onChangeText={(t) => { if (t.length <= 500) setCoverNote(t) }}
              placeholder="Tell the company why you're a great fit for this role…"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-sm"
              style={{ minHeight: 110 }}
            />
          </Animated.View>

          {/* Screening questions */}
          {questions.length > 0 && (
            <Animated.View entering={FadeInDown.delay(300).duration(400)} className="mb-5">
              <Text className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-3">
                Screening questions
              </Text>
              {questions.map((q, i) => (
                <View key={i} className="mb-4">
                  <Text className="text-[#1A1625] text-sm mb-1 leading-5">
                    {q.question}
                    {q.required && <Text className="text-primary-400"> *</Text>}
                  </Text>
                  <TextInput
                    value={screeningAnswers[i] ?? ''}
                    onChangeText={(t) => handleAnswerChange(i, t)}
                    placeholder="Your answer…"
                    placeholderTextColor="#475569"
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-3 text-[#1A1625] text-sm"
                    style={{ minHeight: 76 }}
                  />
                </View>
              ))}
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit button */}
      <View
        className="absolute bottom-0 left-0 right-0 px-5 pt-3 pb-8 border-t border-surface-border"
        style={{ backgroundColor: '#F5F0E8' }}
      >
        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting}
          className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-[#1A1625] font-semibold text-base">Submit Application</Text>
          )}
        </Pressable>
        <Text className="text-slate-600 text-xs text-center mt-2">
          By submitting, the company will receive your profile and selected CV.
        </Text>
      </View>
    </SafeAreaView>
  )
}

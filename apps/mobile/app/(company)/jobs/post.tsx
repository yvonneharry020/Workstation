import { useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Switch,
  Modal,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useForm, Controller, useFieldArray, useWatch, Control, FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { PickerModal } from '@/components/ui/PickerModal'

const TOTAL_STEPS = 4

const EMPLOYMENT_OPTIONS = [
  { label: 'Full-time', value: 'full_time' },
  { label: 'Part-time', value: 'part_time' },
  { label: 'Contract', value: 'contract' },
  { label: 'Internship', value: 'internship' },
  { label: 'Freelance', value: 'freelance' },
]

const WORK_MODE_OPTIONS = [
  { label: 'Remote', value: 'remote' },
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'On-site', value: 'on_site' },
]

const EXPERIENCE_OPTIONS = [
  { label: 'Entry level', value: 'entry' },
  { label: 'Junior (1–2 yrs)', value: 'junior' },
  { label: 'Mid level (3–5 yrs)', value: 'mid' },
  { label: 'Senior (5+ yrs)', value: 'senior' },
  { label: 'Lead', value: 'lead' },
  { label: 'Executive / Director', value: 'executive' },
]

const QUESTION_TYPE_OPTIONS = [
  { label: 'Short text', value: 'short_text' },
  { label: 'Long text', value: 'long_text' },
  { label: 'Multiple choice', value: 'multiple_choice' },
  { label: 'Checkbox', value: 'checkbox' },
  { label: 'Dropdown', value: 'dropdown' },
]

type QuestionType = 'short_text' | 'long_text' | 'multiple_choice' | 'checkbox' | 'dropdown'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS_OF_WEEK = ['Su','Mo','Tu','We','Th','Fr','Sa']

// ─── Calendar ───────────────────────────────────────────────────────────────

function CalendarModal({
  visible,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean
  value: string | null
  onSelect: (iso: string) => void
  onClose: () => void
}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const selectedIso = value
  const selectedDate = selectedIso ? new Date(selectedIso + 'T00:00:00') : null

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const isoFor = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, '0')
    const dd = String(day).padStart(2, '0')
    return `${viewYear}-${mm}-${dd}`
  }

  const isPast = (day: number) => new Date(viewYear, viewMonth, day) < today
  const isSelected = (day: number) => !!selectedDate && isoFor(day) === selectedIso
  const isToday = (day: number) => viewYear === today.getFullYear() && viewMonth === today.getMonth() && day === today.getDate()

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: '#00000060', justifyContent: 'flex-end' }} onPress={onClose}>
        <Pressable onPress={e => e.stopPropagation()} style={{ backgroundColor: '#F5F0E8', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 36 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <Pressable onPress={prevMonth} hitSlop={10} className="active:opacity-60">
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M15 18l-6-6 6-6" />
              </Svg>
            </Pressable>
            <Text style={{ color: '#1A1625', fontSize: 16, fontWeight: '700' }}>{MONTHS[viewMonth]} {viewYear}</Text>
            <Pressable onPress={nextMonth} hitSlop={10} className="active:opacity-60">
              <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <Path d="M9 18l6-6-6-6" />
              </Svg>
            </Pressable>
          </View>

          <View style={{ flexDirection: 'row', marginBottom: 8 }}>
            {DAYS_OF_WEEK.map(d => (
              <Text key={d} style={{ flex: 1, textAlign: 'center', color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>{d}</Text>
            ))}
          </View>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {cells.map((day, idx) => {
              if (!day) return <View key={`empty-${idx}`} style={{ width: '14.28%', aspectRatio: 1 }} />
              const past = isPast(day)
              const selected = isSelected(day)
              const tod = isToday(day)
              return (
                <Pressable
                  key={day}
                  onPress={() => { if (!past) { onSelect(isoFor(day)); onClose() } }}
                  disabled={past}
                  style={{ width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' }}
                >
                  <View style={{
                    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
                    backgroundColor: selected ? '#FF6240' : tod ? '#FF624020' : 'transparent',
                    borderWidth: tod && !selected ? 1 : 0,
                    borderColor: '#FF624050',
                  }}>
                    <Text style={{
                      color: selected ? '#fff' : past ? '#CBD5E1' : '#1A1625',
                      fontSize: 13,
                      fontWeight: selected || tod ? '700' : '400',
                    }}>{day}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  title: z.string().min(3, 'Job title is required'),
  department: z.string().optional(),
  employment_type: z.string().min(1, 'Select employment type'),
  work_mode: z.string().min(1, 'Select work mode'),
  experience_level: z.string().min(1, 'Select experience level'),
  city: z.string().min(2, 'City is required'),
})

const step2Schema = z.object({
  description: z.string().min(100, 'Write at least 100 characters describing the role'),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  salary_is_confidential: z.boolean(),
  salary_min: z.string().optional(),
  salary_max: z.string().optional(),
  application_deadline: z.string().min(1, 'Application deadline is required'),
})

const fullSchema = step1Schema.merge(step2Schema).extend({
  screening_type: z.enum(['normal', 'timed_quiz']),
  quiz_duration_minutes: z.number().min(5).max(180).nullable().optional(),
  screening_questions: z.array(z.object({
    question: z.string().min(1, 'Question text is required'),
    required: z.boolean(),
    type: z.enum(['short_text', 'long_text', 'multiple_choice', 'checkbox', 'dropdown']),
    options: z.array(z.string()).optional(),
  })).max(10),
})

type FormData = z.infer<typeof fullSchema>

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToDisplay(iso: string | null): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#1A1625" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function PlusIcon({ color = '#FF6240' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 5v14M5 12h14" />
    </Svg>
  )
}

function TrashIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
}

function CalendarIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
    </Svg>
  )
}

function SectionLabel({ children }: { children: string }) {
  return <Text style={{ color: '#5A4F6E', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>{children}</Text>
}

function MultilineField({ label, value, onChange, error, placeholder, minHeight = 100 }: {
  label: string
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder: string
  minHeight?: number
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>{label}</Text>
      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        style={{
          backgroundColor: '#EDE7DB',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: error ? '#EF4444' : '#DDD6C9',
          color: '#1A1625',
          fontSize: 14,
          padding: 14,
          minHeight,
          textAlignVertical: 'top',
        }}
      />
      {error && <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{error}</Text>}
    </View>
  )
}

function ProgressBar({ step }: { step: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 6 }}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <View
          key={i}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i + 1 <= step ? '#FF6240' : '#DDD6C9' }}
        />
      ))}
    </View>
  )
}

const STEP_LABELS = ['Role details', 'Job details', 'Screening type', 'Screening questions']

type SuccessJobId = string | null

// ─── Main Screen ─────────────────────────────────────────────────────────────

export default function PostJobScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)
  const [showCalendar, setShowCalendar] = useState(false)
  const [successJobId, setSuccessJobId] = useState<SuccessJobId>(null)
  const [isPublishing, setIsPublishing] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    trigger,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(fullSchema),
    defaultValues: {
      title: '',
      department: '',
      employment_type: '',
      work_mode: '',
      experience_level: '',
      city: '',
      description: '',
      requirements: '',
      benefits: '',
      salary_is_confidential: false,
      salary_min: '',
      salary_max: '',
      application_deadline: '',
      screening_type: 'normal',
      quiz_duration_minutes: null,
      screening_questions: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'screening_questions' })
  const salaryConfidential = watch('salary_is_confidential')
  const screeningType = watch('screening_type')
  const deadlineIso = watch('application_deadline')
  const quizDuration = watch('quiz_duration_minutes')

  const saveMutation = useMutation({
    mutationFn: async ({ data, publish }: { data: FormData; publish: boolean }) => {
      const { data: inserted, error } = await supabase.from('job_postings').insert({
        company_id: user!.id,
        posted_by: user!.id,
        title: data.title,
        department: data.department || null,
        employment_type: data.employment_type,
        work_mode: data.work_mode,
        experience_level: data.experience_level,
        city: data.city,
        description: data.description,
        requirements: data.requirements || null,
        benefits: data.benefits || null,
        salary_is_confidential: data.salary_is_confidential,
        salary_min: data.salary_min ? parseInt(data.salary_min, 10) : null,
        salary_max: data.salary_max ? parseInt(data.salary_max, 10) : null,
        application_deadline: data.application_deadline || null,
        screening_type: data.screening_type,
        quiz_duration_minutes: data.screening_type === 'timed_quiz' ? (data.quiz_duration_minutes ?? null) : null,
        screening_questions: data.screening_questions,
        status: publish ? 'active' : 'draft',
        published_at: publish ? new Date().toISOString() : null,
      }).select('id').single()
      if (error) throw new Error(error.message)
      return { id: inserted.id as string, published: publish }
    },
    onSuccess: ({ id, published }) => {
      queryClient.invalidateQueries({ queryKey: ['company-jobs'] })
      if (published) {
        router.replace('/(company)/jobs' as any)
      } else {
        setSuccessJobId(id)
      }
    },
    onError: (err: Error) => Alert.alert('Could not save job', err.message || 'Please try again.'),
  })

  const handlePublishNow = async () => {
    if (!successJobId) return
    setIsPublishing(true)
    try {
      const { error } = await supabase.from('job_postings').update({ status: 'active', published_at: new Date().toISOString() }).eq('id', successJobId)
      if (error) throw new Error(error.message)
      queryClient.invalidateQueries({ queryKey: ['company-jobs'] })
      router.replace('/(company)/jobs' as any)
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Could not publish the job.')
    } finally {
      setIsPublishing(false)
    }
  }

  const goToStep2 = async () => {
    const valid = await trigger(['title', 'employment_type', 'work_mode', 'experience_level', 'city'])
    if (valid) setStep(2)
  }

  const goToStep3 = async () => {
    const valid = await trigger(['description', 'application_deadline'])
    if (valid) setStep(3)
  }

  const goToStep4 = () => {
    if (screeningType === 'timed_quiz' && (!quizDuration || quizDuration < 5)) {
      Alert.alert('Quiz duration required', 'Please set a quiz duration between 5 and 180 minutes.')
      return
    }
    setStep(4)
  }

  const onSaveDraft = handleSubmit((data) => saveMutation.mutate({ data, publish: false }))
  const onPostJob   = handleSubmit((data) => saveMutation.mutate({ data, publish: true }))

  // ─── Success screen ───────────────────────────────────────────────────────

  if (successJobId) {
    return (
      <SafeAreaView className="flex-1 bg-surface px-5 justify-center">
        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#22C55E15', borderWidth: 1.5, borderColor: '#22C55E40', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          </View>
          <Text style={{ color: '#1A1625', fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Job saved as draft!</Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Publish it now to start receiving applications, or keep it as a draft.
          </Text>
          <Pressable
            onPress={handlePublishNow}
            disabled={isPublishing}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 12 }}
            className="active:opacity-80"
          >
            {isPublishing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Publish now</Text>}
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(company)/jobs' as any)}
            style={{ backgroundColor: '#EDE7DB', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#DDD6C9' }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#5A4F6E', fontWeight: '600', fontSize: 15 }}>Keep as draft</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    )
  }

  // ─── Form ─────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View className="px-5 pt-5 pb-3 flex-row items-center gap-3">
          <Pressable onPress={step === 1 ? () => router.back() : () => setStep(step - 1)} className="active:opacity-70">
            <BackIcon />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar step={step} />
            <Text style={{ color: '#64748B', fontSize: 11 }}>Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}</Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>

          {/* ── Step 1: Role details ── */}
          {step === 1 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Role details</Text>
              <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Tell candidates what position you're hiring for.</Text>

              <Controller
                control={control}
                name="title"
                render={({ field: { onChange, value } }) => (
                  <Input label="Job title" placeholder="e.g. Senior Product Designer" value={value} onChangeText={onChange} error={errors.title?.message} />
                )}
              />
              <Controller
                control={control}
                name="department"
                render={({ field: { onChange, value } }) => (
                  <Input label="Department (optional)" placeholder="e.g. Engineering, Marketing" value={value ?? ''} onChangeText={onChange} />
                )}
              />
              <Controller
                control={control}
                name="employment_type"
                render={({ field: { onChange, value } }) => (
                  <PickerModal label="Employment type" value={value} options={EMPLOYMENT_OPTIONS} onSelect={onChange} placeholder="Select type" error={errors.employment_type?.message} />
                )}
              />
              <Controller
                control={control}
                name="work_mode"
                render={({ field: { onChange, value } }) => (
                  <PickerModal label="Work mode" value={value} options={WORK_MODE_OPTIONS} onSelect={onChange} placeholder="Select mode" error={errors.work_mode?.message} />
                )}
              />
              <Controller
                control={control}
                name="experience_level"
                render={({ field: { onChange, value } }) => (
                  <PickerModal label="Experience level" value={value} options={EXPERIENCE_OPTIONS} onSelect={onChange} placeholder="Select level" error={errors.experience_level?.message} />
                )}
              />
              <Controller
                control={control}
                name="city"
                render={({ field: { onChange, value } }) => (
                  <Input label="City" placeholder="e.g. Lagos, Abuja, Port Harcourt" value={value} onChangeText={onChange} error={errors.city?.message} />
                )}
              />

              <Pressable onPress={goToStep2} style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 }} className="active:opacity-80">
                <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Continue</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Step 2: Job details ── */}
          {step === 2 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Job details</Text>
              <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Give candidates a clear picture of the role and what you offer.</Text>

              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, value } }) => (
                  <MultilineField label="Job description *" value={value} onChange={onChange} error={errors.description?.message} placeholder="Describe the role, responsibilities, and what success looks like..." minHeight={140} />
                )}
              />
              <Controller
                control={control}
                name="requirements"
                render={({ field: { onChange, value } }) => (
                  <MultilineField label="Requirements (optional)" value={value ?? ''} onChange={onChange} placeholder="List skills, qualifications, and experience required..." />
                )}
              />
              <Controller
                control={control}
                name="benefits"
                render={({ field: { onChange, value } }) => (
                  <MultilineField label="Benefits & perks (optional)" value={value ?? ''} onChange={onChange} placeholder="Health insurance, pension, remote allowance, leave days..." />
                )}
              />

              <View style={{ marginBottom: 16 }}>
                <SectionLabel>Salary</SectionLabel>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 12 }}>
                  <Text style={{ color: '#5A4F6E', fontSize: 14 }}>Mark salary as confidential</Text>
                  <Controller
                    control={control}
                    name="salary_is_confidential"
                    render={({ field: { onChange, value } }) => (
                      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#DDD6C9', true: '#FF6240' }} thumbColor="#fff" />
                    )}
                  />
                </View>
                {!salaryConfidential && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                      <Controller
                        control={control}
                        name="salary_min"
                        render={({ field: { onChange, value } }) => (
                          <Input label="Min salary (₦)" placeholder="300000" value={value ?? ''} onChangeText={(v) => onChange(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                        )}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Controller
                        control={control}
                        name="salary_max"
                        render={({ field: { onChange, value } }) => (
                          <Input label="Max salary (₦)" placeholder="500000" value={value ?? ''} onChangeText={(v) => onChange(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                        )}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Calendar date picker */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>Application deadline *</Text>
                <Pressable
                  onPress={() => setShowCalendar(true)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                    backgroundColor: '#EDE7DB', borderRadius: 12, borderWidth: 1,
                    borderColor: errors.application_deadline ? '#EF4444' : '#DDD6C9',
                    padding: 14,
                  }}
                  className="active:opacity-70"
                >
                  <Text style={{ color: deadlineIso ? '#1A1625' : '#94A3B8', fontSize: 14 }}>
                    {deadlineIso ? isoToDisplay(deadlineIso) : 'Select a date'}
                  </Text>
                  <CalendarIcon />
                </Pressable>
                {errors.application_deadline && (
                  <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>{errors.application_deadline.message}</Text>
                )}
              </View>

              <Controller
                control={control}
                name="application_deadline"
                render={() => (
                  <CalendarModal
                    visible={showCalendar}
                    value={deadlineIso || null}
                    onSelect={(iso) => { setValue('application_deadline', iso, { shouldValidate: true }) }}
                    onClose={() => setShowCalendar(false)}
                  />
                )}
              />

              <Pressable onPress={goToStep3} style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 }} className="active:opacity-80">
                <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Continue</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Step 3: Screening type ── */}
          {step === 3 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Screening type</Text>
              <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Choose how candidates will answer your screening questions.</Text>

              <Controller
                control={control}
                name="screening_type"
                render={({ field: { onChange, value } }) => (
                  <View style={{ gap: 12 }}>
                    {([
                      {
                        key: 'normal' as const,
                        title: 'Normal Form',
                        desc: 'Candidates answer questions at their own pace before submitting their application.',
                        icon: '📋',
                      },
                      {
                        key: 'timed_quiz' as const,
                        title: 'Timed Quiz',
                        desc: 'Questions are shown one at a time with a countdown timer. Auto-submitted when time expires.',
                        icon: '⏱️',
                      },
                    ] as const).map(opt => {
                      const selected = value === opt.key
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => onChange(opt.key)}
                          style={{
                            backgroundColor: selected ? '#FF624010' : '#EDE7DB',
                            borderRadius: 16,
                            borderWidth: 2,
                            borderColor: selected ? '#FF6240' : '#DDD6C9',
                            padding: 16,
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 12,
                          }}
                          className="active:opacity-80"
                        >
                          <Text style={{ fontSize: 24 }}>{opt.icon}</Text>
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '700', marginBottom: 4 }}>{opt.title}</Text>
                            <Text style={{ color: '#64748B', fontSize: 13, lineHeight: 18 }}>{opt.desc}</Text>
                          </View>
                          <View style={{
                            width: 20, height: 20, borderRadius: 10, borderWidth: 2,
                            borderColor: selected ? '#FF6240' : '#DDD6C9',
                            backgroundColor: selected ? '#FF6240' : 'transparent',
                            alignItems: 'center', justifyContent: 'center',
                            marginTop: 2,
                          }}>
                            {selected && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                          </View>
                        </Pressable>
                      )
                    })}
                  </View>
                )}
              />

              {screeningType === 'timed_quiz' && (
                <Animated.View entering={FadeInDown.duration(250)} style={{ marginTop: 20 }}>
                  <Text style={{ color: '#5A4F6E', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>Quiz duration (minutes)</Text>
                  <Controller
                    control={control}
                    name="quiz_duration_minutes"
                    render={({ field: { onChange, value } }) => (
                      <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                        {[10, 15, 20, 30, 45, 60].map(min => {
                          const selected = value === min
                          return (
                            <Pressable
                              key={min}
                              onPress={() => onChange(min)}
                              style={{
                                backgroundColor: selected ? '#FF6240' : '#EDE7DB',
                                borderRadius: 10,
                                borderWidth: 1,
                                borderColor: selected ? '#FF6240' : '#DDD6C9',
                                paddingHorizontal: 16, paddingVertical: 10,
                              }}
                              className="active:opacity-80"
                            >
                              <Text style={{ color: selected ? '#fff' : '#5A4F6E', fontSize: 14, fontWeight: '600' }}>{min} min</Text>
                            </Pressable>
                          )
                        })}
                      </View>
                    )}
                  />
                  <Text style={{ color: '#64748B', fontSize: 12, marginTop: 10, lineHeight: 18 }}>
                    ⚠️ Switching apps or locking the screen during a timed quiz will auto-submit the candidate's answers.
                  </Text>
                </Animated.View>
              )}

              <Pressable onPress={goToStep4} style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 24 }} className="active:opacity-80">
                <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Continue</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* ── Step 4: Screening questions ── */}
          {step === 4 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#1A1625', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Screening questions</Text>
              <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>
                Add up to 10 questions for candidates. This is optional but helps you qualify applicants.
              </Text>

              {fields.map((field, index) => (
                <QuestionCard
                  key={field.id}
                  index={index}
                  control={control}
                  onRemove={() => remove(index)}
                  errors={errors}
                />
              ))}

              {fields.length < 10 && (
                <Pressable
                  onPress={() => append({ question: '', required: false, type: 'short_text', options: [] })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FF624030', borderRadius: 14, borderStyle: 'dashed', paddingVertical: 14, justifyContent: 'center', marginBottom: 16 }}
                  className="active:opacity-70"
                >
                  <PlusIcon />
                  <Text style={{ color: '#FF6240', fontSize: 14, fontWeight: '600' }}>Add question</Text>
                </Pressable>
              )}

              {fields.length === 0 && (
                <View style={{ backgroundColor: '#FF624008', borderRadius: 12, borderWidth: 1, borderColor: '#FF624020', padding: 14, marginBottom: 20 }}>
                  <Text style={{ color: '#FF6240', fontSize: 12, fontWeight: '600', marginBottom: 4 }}>Tip</Text>
                  <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>Screening questions help qualify candidates before reviewing their full profile. You can skip this.</Text>
                </View>
              )}

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <Pressable
                  onPress={onSaveDraft}
                  disabled={saveMutation.isPending}
                  style={{ flex: 1, backgroundColor: '#EDE7DB', borderRadius: 14, paddingVertical: 15, alignItems: 'center', borderWidth: 1, borderColor: '#DDD6C9', opacity: saveMutation.isPending ? 0.6 : 1 }}
                  className="active:opacity-80"
                >
                  {saveMutation.isPending
                    ? <ActivityIndicator color="#5A4F6E" size="small" />
                    : <Text style={{ color: '#5A4F6E', fontWeight: '700', fontSize: 15 }}>Save to Draft</Text>
                  }
                </Pressable>
                <Pressable
                  onPress={onPostJob}
                  disabled={saveMutation.isPending}
                  style={{ flex: 1, backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', opacity: saveMutation.isPending ? 0.6 : 1 }}
                  className="active:opacity-80"
                >
                  {saveMutation.isPending
                    ? <ActivityIndicator color="#1A1625" size="small" />
                    : <Text style={{ color: '#1A1625', fontWeight: '700', fontSize: 15 }}>Post Job</Text>
                  }
                </Pressable>
              </View>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

// ─── Question Card ────────────────────────────────────────────────────────────

const NEEDS_OPTIONS: QuestionType[] = ['multiple_choice', 'checkbox', 'dropdown']

function QuestionCard({
  index,
  control,
  onRemove,
  errors,
}: {
  index: number
  control: Control<FormData>
  onRemove: () => void
  errors: FieldErrors<FormData>
}) {
  const [newOption, setNewOption] = useState('')

  const qType = (useWatch({ control, name: `screening_questions.${index}.type` }) ?? 'short_text') as QuestionType
  const needsOptions = NEEDS_OPTIONS.includes(qType)

  return (
    <Animated.View entering={FadeInDown.duration(300)} style={{ backgroundColor: '#EDE7DB', borderRadius: 14, borderWidth: 1, borderColor: '#DDD6C9', padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>Question {index + 1}</Text>
        <Pressable onPress={onRemove} hitSlop={8} className="active:opacity-70">
          <TrashIcon />
        </Pressable>
      </View>

      {/* Question type */}
      <View style={{ marginBottom: 10 }}>
        <Controller
          control={control}
          name={`screening_questions.${index}.type`}
          render={({ field: { onChange, value } }) => (
            <PickerModal
              label="Answer type"
              value={value}
              options={QUESTION_TYPE_OPTIONS}
              onSelect={onChange}
              placeholder="Select type"
            />
          )}
        />
      </View>

      {/* Question text */}
      <Controller
        control={control}
        name={`screening_questions.${index}.question`}
        render={({ field: { onChange, value } }) => (
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="e.g. How many years of React Native experience do you have?"
            placeholderTextColor="#475569"
            multiline
            style={{
              backgroundColor: '#F5F0E8', borderRadius: 10, borderWidth: 1,
              borderColor: errors.screening_questions?.[index]?.question ? '#EF4444' : '#DDD6C9',
              color: '#1A1625', fontSize: 13, padding: 12, marginBottom: 10,
              textAlignVertical: 'top', minHeight: 60,
            }}
          />
        )}
      />

      {/* Options (for MC, checkbox, dropdown) */}
      {needsOptions && (
        <Controller
          control={control}
          name={`screening_questions.${index}.options`}
          render={({ field: { onChange, value: opts } }) => {
            const options = opts ?? []
            return (
              <View style={{ marginBottom: 10 }}>
                <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '600', marginBottom: 6 }}>OPTIONS</Text>
                {options.map((opt, oi) => (
                  <View key={oi} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#94A3B8' }} />
                    <Text style={{ flex: 1, color: '#1A1625', fontSize: 13 }}>{opt}</Text>
                    <Pressable
                      onPress={() => onChange(options.filter((_, i) => i !== oi))}
                      hitSlop={8}
                      className="active:opacity-60"
                    >
                      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth={2} strokeLinecap="round">
                        <Path d="M18 6L6 18M6 6l12 12" />
                      </Svg>
                    </Pressable>
                  </View>
                ))}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TextInput
                    value={newOption}
                    onChangeText={setNewOption}
                    placeholder="Add option…"
                    placeholderTextColor="#94A3B8"
                    style={{ flex: 1, backgroundColor: '#F5F0E8', borderRadius: 8, borderWidth: 1, borderColor: '#DDD6C9', color: '#1A1625', fontSize: 12, paddingHorizontal: 10, paddingVertical: 7 }}
                  />
                  <Pressable
                    onPress={() => {
                      if (!newOption.trim()) return
                      onChange([...options, newOption.trim()])
                      setNewOption('')
                    }}
                    style={{ backgroundColor: '#FF6240', borderRadius: 8, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
                    className="active:opacity-70"
                  >
                    <PlusIcon color="#fff" />
                  </Pressable>
                </View>
              </View>
            )
          }}
        />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ color: '#64748B', fontSize: 12 }}>Required</Text>
        <Controller
          control={control}
          name={`screening_questions.${index}.required`}
          render={({ field: { onChange, value } }) => (
            <Switch value={value} onValueChange={onChange} trackColor={{ false: '#DDD6C9', true: '#FF6240' }} thumbColor="#fff" />
          )}
        />
      </View>
    </Animated.View>
  )
}

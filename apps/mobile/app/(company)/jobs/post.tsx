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
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Animated, { FadeInDown, FadeInRight } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { Input } from '@/components/ui/Input'
import { PickerModal } from '@/components/ui/PickerModal'

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
  application_deadline: z.string().optional(),
})

const fullSchema = step1Schema.merge(step2Schema).extend({
  screening_questions: z.array(z.object({
    question: z.string().min(1),
    required: z.boolean(),
  })).max(5),
})

type FormData = z.infer<typeof fullSchema>

function BackIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 12H5M12 19l-7-7 7-7" />
    </Svg>
  )
}

function PlusIcon() {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
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

function SectionLabel({ children }: { children: string }) {
  return <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 14 }}>{children}</Text>
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
      <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '500', marginBottom: 6 }}>{label}</Text>
      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#475569"
        style={{
          backgroundColor: '#131118',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: error ? '#EF4444' : '#1E1B2E',
          color: '#fff',
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
      {[1, 2, 3].map((s) => (
        <View
          key={s}
          style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: s <= step ? '#FF6240' : '#1E1B2E' }}
        />
      ))}
    </View>
  )
}

type SuccessJobId = string | null

export default function PostJobScreen() {
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [step, setStep] = useState(1)

  const { data: isVerified, isLoading: checkingVerification } = useQuery({
    queryKey: ['company-can-post', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('company_profiles')
        .select('cac_verified')
        .eq('id', user!.id)
        .maybeSingle()
      return (data as any)?.cac_verified === true
    },
    enabled: !!user?.id,
  })
  const [successJobId, setSuccessJobId] = useState<SuccessJobId>(null)
  const [isPublishing, setIsPublishing] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    trigger,
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
      screening_questions: [],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'screening_questions' })
  const salaryConfidential = watch('salary_is_confidential')

  const insertMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const deadlineRaw = data.application_deadline
      let deadline: string | null = null
      if (deadlineRaw && /^\d{2}\/\d{2}\/\d{4}$/.test(deadlineRaw)) {
        const parts = deadlineRaw.split('/')
        deadline = `${parts[2]}-${parts[1]}-${parts[0]}`
      }

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
        application_deadline: deadline,
        screening_questions: data.screening_questions,
        status: 'draft',
      }).select('id').single()
      if (error) throw error
      return inserted.id as string
    },
    onSuccess: (id) => {
      queryClient.invalidateQueries({ queryKey: ['company-jobs'] })
      setSuccessJobId(id)
    },
    onError: () => Alert.alert('Error', 'Could not save the job. Please try again.'),
  })

  const handlePublishNow = async () => {
    if (!successJobId) return
    setIsPublishing(true)
    try {
      await supabase.from('job_postings').update({ status: 'active', published_at: new Date().toISOString() }).eq('id', successJobId)
      queryClient.invalidateQueries({ queryKey: ['company-jobs'] })
      router.replace('/(company)/jobs' as any)
    } catch {
      Alert.alert('Error', 'Could not publish the job.')
    } finally {
      setIsPublishing(false)
    }
  }

  const goToStep2 = async () => {
    const valid = await trigger(['title', 'employment_type', 'work_mode', 'experience_level', 'city'])
    if (valid) setStep(2)
  }

  const goToStep3 = async () => {
    const valid = await trigger(['description'])
    if (valid) setStep(3)
  }

  const onSubmit = handleSubmit((data) => insertMutation.mutate(data))

  if (!checkingVerification && !isVerified) {
    return (
      <SafeAreaView className="flex-1 bg-surface px-5 justify-center">
        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F59E0B15', borderWidth: 1.5, borderColor: '#F59E0B40', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <Path d="M12 8v4M12 16h.01" />
            </Svg>
          </View>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>
            Verification required
          </Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 28, paddingHorizontal: 16 }}>
            Your company must complete CAC verification before posting jobs. This protects candidates and builds trust in your listings.
          </Text>
          <Pressable
            onPress={() => router.replace('/(onboarding)/company/step-2' as never)}
            style={{ backgroundColor: '#F59E0B', borderRadius: 14, paddingHorizontal: 28, paddingVertical: 14, marginBottom: 12 }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#000', fontWeight: '700', fontSize: 15 }}>Start Verification</Text>
          </Pressable>
          <Pressable onPress={() => router.back()} className="active:opacity-70">
            <Text style={{ color: '#475569', fontSize: 13 }}>Go back</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    )
  }

  if (successJobId) {
    return (
      <SafeAreaView className="flex-1 bg-surface px-5 justify-center">
        <Animated.View entering={FadeInDown.duration(400)} style={{ alignItems: 'center' }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#22C55E15', borderWidth: 1.5, borderColor: '#22C55E40', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <Path d="M20 6L9 17l-5-5" />
            </Svg>
          </View>
          <Text style={{ color: '#fff', fontSize: 22, fontWeight: '700', marginBottom: 8, textAlign: 'center' }}>Job saved!</Text>
          <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
            Your job is saved as a draft. Publish it now to start receiving applications, or keep it as a draft.
          </Text>
          <Pressable
            onPress={handlePublishNow}
            disabled={isPublishing}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', marginBottom: 12 }}
            className="active:opacity-80"
          >
            {isPublishing ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Publish now</Text>}
          </Pressable>
          <Pressable
            onPress={() => router.replace('/(company)/jobs' as any)}
            style={{ backgroundColor: '#131118', borderRadius: 14, paddingVertical: 15, width: '100%', alignItems: 'center', borderWidth: 1, borderColor: '#1E1B2E' }}
            className="active:opacity-80"
          >
            <Text style={{ color: '#94A3B8', fontWeight: '600', fontSize: 15 }}>Keep as draft</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View className="px-5 pt-5 pb-3 flex-row items-center gap-3">
          <Pressable onPress={step === 1 ? () => router.back() : () => setStep(step - 1)} className="active:opacity-70">
            <BackIcon />
          </Pressable>
          <View style={{ flex: 1 }}>
            <ProgressBar step={step} />
            <Text style={{ color: '#64748B', fontSize: 11 }}>Step {step} of 3 — {step === 1 ? 'Role details' : step === 2 ? 'Job details' : 'Screening questions'}</Text>
          </View>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 40 }}>
          {step === 1 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Role details</Text>
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
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continue</Text>
              </Pressable>
            </Animated.View>
          )}

          {step === 2 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Job details</Text>
              <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Give candidates a clear picture of the role and what you offer.</Text>

              <Controller
                control={control}
                name="description"
                render={({ field: { onChange, value } }) => (
                  <MultilineField
                    label="Job description *"
                    value={value}
                    onChange={onChange}
                    error={errors.description?.message}
                    placeholder="Describe the role, responsibilities, day-to-day work, and what success looks like in this position..."
                    minHeight={140}
                  />
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
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#131118', borderRadius: 12, borderWidth: 1, borderColor: '#1E1B2E', padding: 14, marginBottom: 12 }}>
                  <Text style={{ color: '#94A3B8', fontSize: 14 }}>Mark salary as confidential</Text>
                  <Controller
                    control={control}
                    name="salary_is_confidential"
                    render={({ field: { onChange, value } }) => (
                      <Switch value={value} onValueChange={onChange} trackColor={{ false: '#1E1B2E', true: '#FF6240' }} thumbColor="#fff" />
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

              <Controller
                control={control}
                name="application_deadline"
                render={({ field: { onChange, value } }) => (
                  <Input
                    label="Application deadline (optional)"
                    placeholder="DD/MM/YYYY"
                    value={value ?? ''}
                    onChangeText={onChange}
                    keyboardType="number-pad"
                  />
                )}
              />

              <Pressable onPress={goToStep3} style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 }} className="active:opacity-80">
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Continue</Text>
              </Pressable>
            </Animated.View>
          )}

          {step === 3 && (
            <Animated.View entering={FadeInRight.duration(300)}>
              <Text style={{ color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6, marginTop: 8 }}>Screening questions</Text>
              <Text style={{ color: '#64748B', fontSize: 14, marginBottom: 24 }}>Add up to 5 questions that candidates answer when they apply. This is optional.</Text>

              {fields.map((field, index) => (
                <Animated.View key={field.id} entering={FadeInDown.duration(300)} style={{ backgroundColor: '#131118', borderRadius: 14, borderWidth: 1, borderColor: '#1E1B2E', padding: 14, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ color: '#64748B', fontSize: 12, fontWeight: '600' }}>Question {index + 1}</Text>
                    <Pressable onPress={() => remove(index)} hitSlop={8} className="active:opacity-70">
                      <TrashIcon />
                    </Pressable>
                  </View>
                  <Controller
                    control={control}
                    name={`screening_questions.${index}.question`}
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        value={value}
                        onChangeText={onChange}
                        placeholder="e.g. How many years of React Native experience do you have?"
                        placeholderTextColor="#475569"
                        style={{ backgroundColor: '#09080E', borderRadius: 10, borderWidth: 1, borderColor: '#1E1B2E', color: '#fff', fontSize: 13, padding: 12, marginBottom: 10 }}
                      />
                    )}
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={{ color: '#64748B', fontSize: 12 }}>Required</Text>
                    <Controller
                      control={control}
                      name={`screening_questions.${index}.required`}
                      render={({ field: { onChange, value } }) => (
                        <Switch value={value} onValueChange={onChange} trackColor={{ false: '#1E1B2E', true: '#FF6240' }} thumbColor="#fff" />
                      )}
                    />
                  </View>
                </Animated.View>
              ))}

              {fields.length < 5 && (
                <Pressable
                  onPress={() => append({ question: '', required: false })}
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
                  <Text style={{ color: '#64748B', fontSize: 12, lineHeight: 18 }}>Screening questions help you qualify candidates before reviewing their full profile. You can skip this and add questions later.</Text>
                </View>
              )}

              <Pressable
                onPress={onSubmit}
                disabled={insertMutation.isPending}
                style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8 }}
                className="active:opacity-80"
              >
                {insertMutation.isPending ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save job</Text>
                )}
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

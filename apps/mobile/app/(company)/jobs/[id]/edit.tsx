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
import { router, useLocalSearchParams } from 'expo-router'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Animated, { FadeInDown } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

const formSchema = z.object({
  title: z.string().min(3, 'Job title is required'),
  department: z.string().optional(),
  employment_type: z.string().min(1, 'Select employment type'),
  work_mode: z.string().min(1, 'Select work mode'),
  experience_level: z.string().min(1, 'Select experience level'),
  city: z.string().min(2, 'City is required'),
  description: z.string().min(100, 'Write at least 100 characters'),
  requirements: z.string().optional(),
  benefits: z.string().optional(),
  salary_is_confidential: z.boolean(),
  salary_min: z.string().optional(),
  salary_max: z.string().optional(),
  application_deadline: z.string().optional(),
  screening_questions: z.array(z.object({
    question: z.string().min(1),
    required: z.boolean(),
  })).max(5),
})

type FormData = z.infer<typeof formSchema>

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

function TrashIcon({ color = '#EF4444' }: { color?: string }) {
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
    </Svg>
  )
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

export default function EditJobScreen() {
  const { id: jobId } = useLocalSearchParams<{ id: string }>()
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const [formReady, setFormReady] = useState(false)

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
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

  const { isLoading } = useQuery({
    queryKey: ['job-edit', jobId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_postings')
        .select('*')
        .eq('id', jobId)
        .single()
      if (error) throw error

      const deadline = data.application_deadline
      let deadlineDisplay = ''
      if (deadline) {
        const parts = deadline.split('-')
        deadlineDisplay = `${parts[2]}/${parts[1]}/${parts[0]}`
      }

      reset({
        title: data.title ?? '',
        department: data.department ?? '',
        employment_type: data.employment_type ?? '',
        work_mode: data.work_mode ?? '',
        experience_level: data.experience_level ?? '',
        city: data.city ?? '',
        description: data.description ?? '',
        requirements: data.requirements ?? '',
        benefits: data.benefits ?? '',
        salary_is_confidential: data.salary_is_confidential ?? false,
        salary_min: data.salary_min?.toString() ?? '',
        salary_max: data.salary_max?.toString() ?? '',
        application_deadline: deadlineDisplay,
        screening_questions: Array.isArray(data.screening_questions) ? data.screening_questions : [],
      })
      setFormReady(true)
      return data
    },
    enabled: !!jobId,
  })

  const updateMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const deadlineRaw = data.application_deadline
      let deadline: string | null = null
      if (deadlineRaw && /^\d{2}\/\d{2}\/\d{4}$/.test(deadlineRaw)) {
        const parts = deadlineRaw.split('/')
        deadline = `${parts[2]}-${parts[1]}-${parts[0]}`
      }

      const { error } = await supabase.from('job_postings').update({
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
      }).eq('id', jobId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-jobs'] })
      queryClient.invalidateQueries({ queryKey: ['job-detail', jobId] })
      Alert.alert('Saved', 'Job updated successfully.', [
        { text: 'OK', onPress: () => router.back() },
      ])
    },
    onError: () => Alert.alert('Error', 'Could not save changes. Please try again.'),
  })

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('job_postings').delete().eq('id', jobId).eq('company_id', user!.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['company-jobs'] })
      router.replace('/(company)/jobs' as any)
    },
    onError: () => Alert.alert('Error', 'Could not delete the job.'),
  })

  const handleDelete = () => {
    Alert.alert(
      'Delete job?',
      'This will permanently remove the job listing and all its data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteMutation.mutate() },
      ],
    )
  }

  if (isLoading || !formReady) {
    return (
      <SafeAreaView className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator color="#FF6240" size="large" />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12 }}>
          <Pressable onPress={() => router.back()} hitSlop={8} className="active:opacity-70">
            <BackIcon />
          </Pressable>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', flex: 1 }}>Edit job</Text>
        </View>

        <ScrollView className="flex-1 px-5" showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48 }}>
          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, marginTop: 4 }}>Role details</Text>

          <Controller control={control} name="title" render={({ field: { onChange, value } }) => (
            <Input label="Job title" placeholder="e.g. Senior Product Designer" value={value} onChangeText={onChange} error={errors.title?.message} />
          )} />
          <Controller control={control} name="department" render={({ field: { onChange, value } }) => (
            <Input label="Department (optional)" placeholder="e.g. Engineering" value={value ?? ''} onChangeText={onChange} />
          )} />
          <Controller control={control} name="employment_type" render={({ field: { onChange, value } }) => (
            <PickerModal label="Employment type" value={value} options={EMPLOYMENT_OPTIONS} onSelect={onChange} placeholder="Select type" error={errors.employment_type?.message} />
          )} />
          <Controller control={control} name="work_mode" render={({ field: { onChange, value } }) => (
            <PickerModal label="Work mode" value={value} options={WORK_MODE_OPTIONS} onSelect={onChange} placeholder="Select mode" error={errors.work_mode?.message} />
          )} />
          <Controller control={control} name="experience_level" render={({ field: { onChange, value } }) => (
            <PickerModal label="Experience level" value={value} options={EXPERIENCE_OPTIONS} onSelect={onChange} placeholder="Select level" error={errors.experience_level?.message} />
          )} />
          <Controller control={control} name="city" render={({ field: { onChange, value } }) => (
            <Input label="City" placeholder="e.g. Lagos" value={value} onChangeText={onChange} error={errors.city?.message} />
          )} />

          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 16, marginTop: 8 }}>Job details</Text>

          <Controller control={control} name="description" render={({ field: { onChange, value } }) => (
            <MultilineField label="Job description *" value={value} onChange={onChange} error={errors.description?.message} placeholder="Describe the role and responsibilities..." minHeight={120} />
          )} />
          <Controller control={control} name="requirements" render={({ field: { onChange, value } }) => (
            <MultilineField label="Requirements (optional)" value={value ?? ''} onChange={onChange} placeholder="Skills and qualifications required..." />
          )} />
          <Controller control={control} name="benefits" render={({ field: { onChange, value } }) => (
            <MultilineField label="Benefits & perks (optional)" value={value ?? ''} onChange={onChange} placeholder="Health, pension, remote allowance..." />
          )} />

          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>Salary</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#131118', borderRadius: 12, borderWidth: 1, borderColor: '#1E1B2E', padding: 14, marginBottom: 12 }}>
              <Text style={{ color: '#94A3B8', fontSize: 14 }}>Mark salary as confidential</Text>
              <Controller control={control} name="salary_is_confidential" render={({ field: { onChange, value } }) => (
                <Switch value={value} onValueChange={onChange} trackColor={{ false: '#1E1B2E', true: '#FF6240' }} thumbColor="#fff" />
              )} />
            </View>
            {!salaryConfidential && (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Controller control={control} name="salary_min" render={({ field: { onChange, value } }) => (
                    <Input label="Min (₦)" placeholder="300000" value={value ?? ''} onChangeText={(v) => onChange(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                  )} />
                </View>
                <View style={{ flex: 1 }}>
                  <Controller control={control} name="salary_max" render={({ field: { onChange, value } }) => (
                    <Input label="Max (₦)" placeholder="500000" value={value ?? ''} onChangeText={(v) => onChange(v.replace(/\D/g, ''))} keyboardType="number-pad" />
                  )} />
                </View>
              </View>
            )}
          </View>

          <Controller control={control} name="application_deadline" render={({ field: { onChange, value } }) => (
            <Input label="Application deadline (optional)" placeholder="DD/MM/YYYY" value={value ?? ''} onChangeText={onChange} keyboardType="number-pad" />
          )} />

          <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12, marginTop: 8 }}>Screening questions</Text>

          {fields.map((field, index) => (
            <Animated.View key={field.id} entering={FadeInDown.duration(300)} style={{ backgroundColor: '#131118', borderRadius: 14, borderWidth: 1, borderColor: '#1E1B2E', padding: 14, marginBottom: 10 }}>
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
                    placeholder="e.g. How many years of experience do you have?"
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
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#FF624030', borderRadius: 14, borderStyle: 'dashed', paddingVertical: 12, justifyContent: 'center', marginBottom: 16 }}
              className="active:opacity-70"
            >
              <PlusIcon />
              <Text style={{ color: '#FF6240', fontSize: 13, fontWeight: '600' }}>Add question</Text>
            </Pressable>
          )}

          <Pressable
            onPress={handleSubmit((data) => updateMutation.mutate(data))}
            disabled={updateMutation.isPending}
            style={{ backgroundColor: '#FF6240', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 8, marginBottom: 12 }}
            className="active:opacity-80"
          >
            {updateMutation.isPending ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Save changes</Text>
            )}
          </Pressable>

          <Pressable
            onPress={handleDelete}
            disabled={deleteMutation.isPending}
            style={{ borderWidth: 1, borderColor: '#EF444440', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 4 }}
            className="active:opacity-70"
          >
            {deleteMutation.isPending ? (
              <ActivityIndicator color="#EF4444" size="small" />
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TrashIcon />
                <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 15 }}>Delete this job</Text>
              </View>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

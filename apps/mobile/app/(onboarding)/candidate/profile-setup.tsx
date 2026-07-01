import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  Alert,
} from 'react-native'
import { useState } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { PickerModal } from '@/components/ui/PickerModal'

const JOB_CATEGORIES = [
  'Software Engineering',
  'Data Science & Analytics',
  'Product Management',
  'UI/UX Design',
  'DevOps & Cloud',
  'Cybersecurity',
  'Business Analysis',
  'Project Management',
  'Marketing & Growth',
  'Sales & Business Dev',
  'Finance & Accounting',
  'Legal & Compliance',
  'Human Resources',
  'Customer Success',
  'Operations',
  'Healthcare & Medical',
  'Education & Training',
  'Engineering (Non-Tech)',
  'Media & Communications',
  'Others',
]

const EXPERIENCE_OPTIONS = [
  { label: 'Less than 1 year', value: '0' },
  { label: '1 – 2 years', value: '1' },
  { label: '3 – 5 years', value: '3' },
  { label: '6 – 10 years', value: '6' },
  { label: '10+ years', value: '10' },
]

const AVAILABILITY_OPTIONS = [
  { label: 'Immediately available', value: 'immediate' },
  { label: 'Available in 2 weeks', value: '2_weeks' },
  { label: 'Available in 1 month', value: '1_month' },
  { label: 'Available in 3 months', value: '3_months' },
  { label: 'Not actively looking', value: 'passive' },
]

const WORK_MODE_OPTIONS = [
  { label: 'Remote only', value: 'remote' },
  { label: 'Hybrid (some office days)', value: 'hybrid' },
  { label: 'On-site / office', value: 'on_site' },
  { label: 'Open to any', value: 'any' },
]

const MAX_CATEGORIES = 3

function CategoryTag({
  label,
  selected,
  onToggle,
}: {
  label: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: selected ? '#FF6240' : '#3D3850',
        backgroundColor: selected ? '#FF624015' : '#131118',
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text
        style={{
          color: selected ? '#FF6240' : '#94A3B8',
          fontSize: 13,
          fontWeight: selected ? '600' : '400',
        }}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default function CandidateProfileSetup() {
  const user = useAuthStore((s) => s.user)

  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [yearsExperience, setYearsExperience] = useState('')
  const [minSalary, setMinSalary] = useState('')
  const [maxSalary, setMaxSalary] = useState('')
  const [workMode, setWorkMode] = useState('')
  const [availability, setAvailability] = useState('')
  const [bio, setBio] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const toggleCategory = (cat: string) => {
    setSelectedCategories((prev) => {
      if (prev.includes(cat)) return prev.filter((c) => c !== cat)
      if (prev.length >= MAX_CATEGORIES) return prev
      return [...prev, cat]
    })
  }

  const isValid =
    selectedCategories.length > 0 &&
    yearsExperience !== '' &&
    workMode !== '' &&
    availability !== ''

  const handleSubmit = async () => {
    if (!isValid) {
      Alert.alert('Incomplete', 'Please complete all required fields.')
      return
    }

    setIsSubmitting(true)
    try {
      if (user?.id) {
        await supabase.from('candidate_profiles').update({
          experience_years: parseInt(yearsExperience),
          desired_salary_min: minSalary ? parseInt(minSalary) * 1000 : null,
          desired_salary_max: maxSalary ? parseInt(maxSalary) * 1000 : null,
          preferred_work_mode: workMode,
          bio: bio.trim() || null,
        }).eq('id', user.id)
      }

      router.push('/(onboarding)/candidate/pending')
    } catch {
      Alert.alert('Error', 'Could not save your profile. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} className="mt-6 mb-6">
            <Text className="text-primary-400 text-base">← Back</Text>
          </Pressable>

          <Animated.View entering={FadeInDown.duration(400)}>
            <Text
              style={{
                color: '#FF6240',
                fontSize: 12,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              Identity verified
            </Text>
            <Text
              style={{
                color: '#fff',
                fontSize: 26,
                fontWeight: '700',
                letterSpacing: -0.3,
                marginBottom: 6,
              }}
            >
              Set up your profile
            </Text>
            <Text className="text-slate-400 text-sm leading-5 mb-8">
              Tell employers what you're looking for. This helps us match you with the right opportunities.
            </Text>

            {/* Job categories */}
            <View className="mb-6">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-slate-300 text-sm font-medium">
                  Job categories <Text style={{ color: '#FF6240' }}>*</Text>
                </Text>
                <Text className="text-slate-500 text-xs">
                  {selectedCategories.length}/{MAX_CATEGORIES} selected
                </Text>
              </View>
              <View className="flex-row flex-wrap">
                {JOB_CATEGORIES.map((cat) => (
                  <CategoryTag
                    key={cat}
                    label={cat}
                    selected={selectedCategories.includes(cat)}
                    onToggle={() => toggleCategory(cat)}
                  />
                ))}
              </View>
              {selectedCategories.length === 0 && (
                <Text className="text-red-400 text-xs mt-1">Select at least one category</Text>
              )}
            </View>

            <PickerModal
              label={<>Years of experience <Text style={{ color: '#FF6240' }}>*</Text></>}
              placeholder="Select experience level"
              value={yearsExperience}
              options={EXPERIENCE_OPTIONS}
              onSelect={setYearsExperience}
            />

            {/* Salary expectation */}
            <View className="mb-5">
              <Text className="text-slate-300 text-sm font-medium mb-2">
                Monthly salary expectation{' '}
                <Text className="text-slate-500 text-xs">(NGN ₦ '000 — optional)</Text>
              </Text>
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <TextInput
                    placeholder="Min (e.g. 300)"
                    placeholderTextColor="#475569"
                    value={minSalary}
                    onChangeText={(t) => setMinSalary(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base"
                  />
                </View>
                <View className="flex-1">
                  <TextInput
                    placeholder="Max (e.g. 600)"
                    placeholderTextColor="#475569"
                    value={maxSalary}
                    onChangeText={(t) => setMaxSalary(t.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base"
                  />
                </View>
              </View>
              <Text className="text-slate-600 text-xs mt-1">
                Values are in thousands — 300 means ₦300,000/month
              </Text>
            </View>

            <PickerModal
              label={<>Preferred work mode <Text style={{ color: '#FF6240' }}>*</Text></>}
              placeholder="Remote, hybrid, on-site…"
              value={workMode}
              options={WORK_MODE_OPTIONS}
              onSelect={setWorkMode}
            />

            <PickerModal
              label={<>Availability <Text style={{ color: '#FF6240' }}>*</Text></>}
              placeholder="When can you start?"
              value={availability}
              options={AVAILABILITY_OPTIONS}
              onSelect={setAvailability}
            />

            {/* Professional summary */}
            <View className="mb-8">
              <Text className="text-slate-300 text-sm font-medium mb-2">
                Professional summary{' '}
                <Text className="text-slate-500 text-xs">(optional)</Text>
              </Text>
              <TextInput
                value={bio}
                onChangeText={(t) => {
                  if (t.length <= 500) setBio(t)
                }}
                placeholder="A few sentences about your background, skills, and what you're looking for…"
                placeholderTextColor="#475569"
                multiline
                numberOfLines={5}
                textAlignVertical="top"
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-sm"
                style={{ minHeight: 110 }}
              />
              <Text className="text-slate-600 text-xs mt-1 text-right">{bio.length}/500</Text>
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={!isValid || isSubmitting}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              style={{ opacity: !isValid || isSubmitting ? 0.4 : 1 }}
            >
              <Text className="text-white font-semibold text-base">
                {isSubmitting ? 'Saving…' : 'Continue'}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

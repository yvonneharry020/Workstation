import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TextInput,
} from 'react-native'
import { useState } from 'react'
import Svg, { Path } from 'react-native-svg'

import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import Animated, { FadeInDown } from 'react-native-reanimated'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import { PickerModal } from '@/components/ui/PickerModal'

const TOTAL_STEPS = 5

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
]

const NIGERIAN_STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'FCT (Abuja)',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi',
  'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo',
  'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
].map((s) => ({ label: s, value: s }))

const today = new Date()
const eighteenYearsAgo = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate())

const schema = z.object({
  firstName: z.string().min(2, 'Enter your first name'),
  lastName: z.string().min(2, 'Enter your last name'),
  otherNames: z.string().optional(),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number (e.g. 08012345678)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Include at least one uppercase letter')
    .regex(/[0-9]/, 'Include at least one number'),
  dobDay: z.string().regex(/^(0?[1-9]|[12]\d|3[01])$/, 'Invalid day'),
  dobMonth: z.string().regex(/^(0?[1-9]|1[0-2])$/, 'Invalid month'),
  dobYear: z
    .string()
    .regex(/^\d{4}$/, 'Enter a 4-digit year')
    .refine((y) => {
      const year = parseInt(y)
      return year >= 1940 && year <= eighteenYearsAgo.getFullYear()
    }, 'You must be at least 18 years old'),
  gender: z.string().min(1, 'Select your gender'),
  stateOfOrigin: z.string().min(1, 'Select your state of origin'),
})

type FormData = z.infer<typeof schema>

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase', met: /[A-Z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
  ]
  const score = checks.filter((c) => c.met).length

  const barColor = score === 3 ? '#22C55E' : score === 2 ? '#F59E0B' : '#EF4444'

  if (!password) return null

  return (
    <View className="mt-1.5 mb-1">
      <View className="flex-row gap-1 mb-1.5">
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 3,
              borderRadius: 2,
              backgroundColor: i < score ? barColor : '#C8BFB0',
            }}
          />
        ))}
      </View>
      <View className="flex-row gap-3">
        {checks.map((c) => (
          <Text key={c.label} style={{ color: c.met ? '#22C55E' : '#64748B', fontSize: 11 }}>
            {c.met ? '✓ ' : '○ '}{c.label}
          </Text>
        ))}
      </View>
    </View>
  )
}

export default function CandidateStep1() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [isAgreed, setIsAgreed] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      otherNames: '',
      email: '',
      phone: '',
      password: '',
      dobDay: '',
      dobMonth: '',
      dobYear: '',
      gender: '',
      stateOfOrigin: '',
    },
  })

  const handleCreate = async (data: FormData) => {
    if (!isAgreed) {
      Alert.alert('Agreement required', 'Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    setIsSubmitting(true)
    try {
      const dob = `${data.dobYear}-${data.dobMonth.padStart(2, '0')}-${data.dobDay.padStart(2, '0')}`

      const { error, data: authData } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            role: 'candidate',
            first_name: data.firstName,
            last_name: data.lastName,
            phone: data.phone,
          },
        },
      })

      if (error) {
        const isRateLimit = error.message.toLowerCase().includes('rate limit')
        const message = isRateLimit
          ? 'Too many attempts. Please wait a few minutes before trying again, or use a different email address.'
          : error.message
        Alert.alert('Account creation failed', message)
        return
      }

      router.push({
        pathname: '/(onboarding)/candidate/step-2' as never,
        params: {
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          otherNames: data.otherNames || '',
          dateOfBirth: dob,
          gender: data.gender,
          phone: data.phone,
          stateOfOrigin: data.stateOfOrigin,
        },
      })
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
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

          {/* Progress bar */}
          <View className="flex-row items-center gap-1 mb-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i === 0 ? '#FF6240' : '#DDD6C9',
                }}
              />
            ))}
          </View>
          <Text className="text-slate-500 text-xs mb-8">Step 1 of {TOTAL_STEPS}</Text>

          <Animated.View entering={FadeInDown.duration(400)}>
            <Text
              style={{
                color: '#1A1625',
                fontSize: 26,
                fontWeight: '700',
                letterSpacing: -0.3,
                marginBottom: 6,
              }}
            >
              Create your account
            </Text>
            <Text className="text-slate-400 text-sm leading-5 mb-6">
              All information must match your National Identification Number (NIN) exactly.
            </Text>

            {/* NIN name warning */}
            <View
              className="rounded-xl px-4 py-3 mb-6 flex-row items-start gap-2"
              style={{ backgroundColor: '#FF624015', borderWidth: 1, borderColor: '#FF624030' }}
            >
              <Text style={{ color: '#FF6240', fontSize: 14, marginTop: 1 }}>⚠</Text>
              <Text style={{ color: '#FF6240', fontSize: 13, flex: 1, lineHeight: 18 }}>
                Your first and last name must match your NIN exactly — including spelling and spacing.
              </Text>
            </View>

            {/* Name row */}
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="First name"
                      placeholder="Adewale"
                      value={value}
                      onChangeText={onChange}
                      error={errors.firstName?.message}
                      autoCapitalize="words"
                      autoComplete="given-name"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { onChange, value } }) => (
                    <Input
                      label="Last name"
                      placeholder="Okafor"
                      value={value}
                      onChangeText={onChange}
                      error={errors.lastName?.message}
                      autoCapitalize="words"
                      autoComplete="family-name"
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="otherNames"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Other names (optional)"
                  placeholder="Middle name or any other name on your NIN"
                  value={value}
                  onChangeText={onChange}
                  autoCapitalize="words"
                />
              )}
            />

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Email address"
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  error={errors.email?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <Input
                  label="Phone number"
                  placeholder="08012345678"
                  value={value}
                  onChangeText={onChange}
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                  hint="Nigerian number only"
                />
              )}
            />

            {/* Password with strength indicator */}
            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <View className="mb-4">
                  <Text className="text-slate-300 text-sm font-medium mb-2">Password</Text>
                  <View className="relative">
                    <TextInput
                      placeholder="Min. 8 chars, 1 uppercase, 1 number"
                      placeholderTextColor="#475569"
                      secureTextEntry={!showPassword}
                      autoComplete="new-password"
                      value={value}
                      onChangeText={onChange}
                      className={`bg-surface-card border rounded-xl px-4 py-4 text-[#1A1625] text-base pr-16 ${errors.password ? 'border-red-500' : 'border-surface-border'}`}
                    />
                    <Pressable
                      onPress={() => setShowPassword((s) => !s)}
                      className="absolute right-4 top-4"
                      hitSlop={10}
                    >
                      <Text style={{ color: '#64748B', fontSize: 13 }}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </Pressable>
                  </View>
                  <PasswordStrength password={value ?? ''} />
                  {errors.password && (
                    <Text className="text-red-400 text-xs mt-1">{errors.password.message}</Text>
                  )}
                </View>
              )}
            />

            {/* Date of Birth */}
            <View className="mb-4">
              <Text className="text-slate-300 text-sm font-medium mb-2">
                Date of birth (must be 18+)
              </Text>
              <View className="flex-row gap-2">
                <View style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name="dobDay"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        placeholder="DD"
                        placeholderTextColor="#475569"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        maxLength={2}
                        className={`bg-surface-card border rounded-xl px-4 py-4 text-[#1A1625] text-base text-center ${errors.dobDay ? 'border-red-500' : 'border-surface-border'}`}
                      />
                    )}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Controller
                    control={control}
                    name="dobMonth"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        placeholder="MM"
                        placeholderTextColor="#475569"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        maxLength={2}
                        className={`bg-surface-card border rounded-xl px-4 py-4 text-[#1A1625] text-base text-center ${errors.dobMonth ? 'border-red-500' : 'border-surface-border'}`}
                      />
                    )}
                  />
                </View>
                <View style={{ flex: 2 }}>
                  <Controller
                    control={control}
                    name="dobYear"
                    render={({ field: { onChange, value } }) => (
                      <TextInput
                        placeholder="YYYY"
                        placeholderTextColor="#475569"
                        value={value}
                        onChangeText={onChange}
                        keyboardType="number-pad"
                        maxLength={4}
                        className={`bg-surface-card border rounded-xl px-4 py-4 text-[#1A1625] text-base text-center ${errors.dobYear ? 'border-red-500' : 'border-surface-border'}`}
                      />
                    )}
                  />
                </View>
              </View>
              {(errors.dobDay || errors.dobMonth || errors.dobYear) && (
                <Text className="text-red-400 text-xs mt-1">
                  {errors.dobDay?.message || errors.dobMonth?.message || errors.dobYear?.message}
                </Text>
              )}
            </View>

            <Controller
              control={control}
              name="gender"
              render={({ field: { onChange, value } }) => (
                <PickerModal
                  label="Gender"
                  placeholder="Select gender"
                  value={value}
                  options={GENDER_OPTIONS}
                  onSelect={onChange}
                  error={errors.gender?.message}
                />
              )}
            />

            <Controller
              control={control}
              name="stateOfOrigin"
              render={({ field: { onChange, value } }) => (
                <PickerModal
                  label="State of origin"
                  placeholder="Select state"
                  value={value}
                  options={NIGERIAN_STATES}
                  onSelect={onChange}
                  error={errors.stateOfOrigin?.message}
                  searchable
                />
              )}
            />

            <Pressable
              onPress={() => setIsAgreed((v) => !v)}
              style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 24 }}
              hitSlop={6}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 5,
                  borderWidth: 1.5,
                  borderColor: isAgreed ? '#FF6240' : '#64748B',
                  backgroundColor: isAgreed ? '#FF624020' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginTop: 1,
                  flexShrink: 0,
                }}
              >
                {isAgreed && (
                  <Svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M20 6L9 17l-5-5" />
                  </Svg>
                )}
              </View>
              <Text style={{ color: '#64748B', fontSize: 12, flex: 1, lineHeight: 18 }}>
                By creating an account you agree to our{' '}
                <Text style={{ color: '#FF6240' }}>Terms of Service</Text> and{' '}
                <Text style={{ color: '#FF6240' }}>Privacy Policy</Text>.
                Your data is protected under NDPR.
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit(handleCreate)}
              disabled={isSubmitting}
              className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              style={{ opacity: isSubmitting ? 0.7 : 1 }}
            >
              <Text className="text-[#1A1625] font-semibold text-base">
                {isSubmitting ? 'Creating account…' : 'Continue'}
              </Text>
            </Pressable>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Input as FormInput } from '@/components/ui/Input'

const PERSONAL_EMAIL_DOMAINS = /^.+@(gmail|yahoo|hotmail|outlook|icloud)\./i

const schema = z.object({
  fullName: z.string().min(2, 'Enter your full legal name'),
  businessEmail: z
    .string()
    .email('Enter a valid email address')
    .refine((v) => !PERSONAL_EMAIL_DOMAINS.test(v), {
      message: 'Use a company email address, not a personal one (Gmail, Yahoo, etc.)',
    }),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number'),
  rcNumber: z
    .string()
    .min(4, 'Enter a valid RC number')
    .regex(/^RC\d{5,}$/i, 'RC number format: RC followed by at least 5 digits (e.g. RC123456)'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Must include at least one uppercase letter')
    .regex(/[0-9]/, 'Must include at least one number'),
})

type FormData = z.infer<typeof schema>

const STEPS_TOTAL = 7

export default function CompanyStep1() {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: '',
      businessEmail: '',
      phone: '',
      rcNumber: '',
      password: '',
    },
  })

  const handleCreate = async (data: FormData) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const { error, data: signUpData } = await supabase.auth.signUp({
        email: data.businessEmail,
        password: data.password,
        options: {
          data: {
            role: 'company',
            full_name: data.fullName,
            phone: data.phone,
          },
        },
      })

      if (error) {
        setSubmitError(error.message)
        return
      }

      const userId = signUpData.user?.id

      if (userId) {
        await supabase.from('company_profiles').upsert({
          id: userId,
          rc_number: data.rcNumber.toUpperCase(),
        })

        await supabase
          .from('profiles')
          .update({ phone: data.phone })
          .eq('id', userId)
      }

      router.replace('/(company)/' as never)
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
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
          className="flex-1 px-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable onPress={() => router.back()} className="mt-6 mb-8">
            <Text className="text-primary-400 text-base">← Back</Text>
          </Pressable>

          <View className="flex-row items-center mb-2">
            {Array.from({ length: STEPS_TOTAL }).map((_, i) => (
              <View
                key={i}
                className={`h-1 flex-1 rounded-full mr-1 ${i === 0 ? 'bg-primary-500' : 'bg-surface-card'}`}
              />
            ))}
          </View>
          <Text className="text-slate-500 text-xs mb-8">Step 1 of {STEPS_TOTAL}</Text>

          <Text className="text-white text-3xl font-bold mb-2">Register your company</Text>
          <Text className="text-slate-400 text-base mb-8">
            You'll verify your RC number in the next step. All details must match your CAC registration.
          </Text>

          <View className="gap-4 mb-6">
            <Controller
              control={control}
              name="fullName"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Your full legal name"
                  placeholder="Chioma Nwosu"
                  value={value}
                  onChangeText={onChange}
                  error={errors.fullName?.message}
                  autoCapitalize="words"
                />
              )}
            />

            <Controller
              control={control}
              name="businessEmail"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Company email address"
                  placeholder="you@yourcompany.com"
                  value={value}
                  onChangeText={onChange}
                  error={errors.businessEmail?.message}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              )}
            />

            <Controller
              control={control}
              name="phone"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Phone number"
                  placeholder="08012345678"
                  value={value}
                  onChangeText={onChange}
                  error={errors.phone?.message}
                  keyboardType="phone-pad"
                />
              )}
            />

            <Controller
              control={control}
              name="rcNumber"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="CAC RC number"
                  placeholder="RC123456"
                  value={value}
                  onChangeText={(v) => onChange(v.toUpperCase())}
                  error={errors.rcNumber?.message}
                  autoCapitalize="characters"
                />
              )}
            />

            <Controller
              control={control}
              name="password"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Password"
                  placeholder="Min. 8 characters, 1 uppercase, 1 number"
                  value={value}
                  onChangeText={onChange}
                  error={errors.password?.message}
                  secureTextEntry
                />
              )}
            />
          </View>

          <Text className="text-slate-500 text-xs mb-8 leading-5">
            By registering you confirm you are authorised to act on behalf of this company.
            All data is processed under NDPR.
          </Text>

          {submitError && (
            <View className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
              <Text className="text-red-400 text-sm text-center">{submitError}</Text>
            </View>
          )}

          <Pressable
            onPress={handleSubmit(handleCreate)}
            disabled={isSubmitting}
            className={`rounded-2xl py-4 items-center mb-12 ${isSubmitting ? 'bg-primary-700' : 'bg-primary-500'}`}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Registering...' : 'Continue'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

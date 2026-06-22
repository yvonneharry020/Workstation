import { useState } from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { supabase } from '@/lib/supabase'
import { Input as FormInput } from '@/components/ui/Input'

const schema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters'),
  lastName: z.string().min(2, 'Last name must be at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  phone: z
    .string()
    .regex(/^(\+234|0)[789][01]\d{8}$/, 'Enter a valid Nigerian phone number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must include at least one uppercase letter')
    .regex(/[0-9]/, 'Password must include at least one number'),
})

type FormData = z.infer<typeof schema>

const STEPS_TOTAL = 7

export default function CandidateStep1() {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      password: '',
    },
  })

  const handleCreate = async (data: FormData) => {
    setIsSubmitting(true)
    try {
      const { error } = await supabase.auth.signUp({
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
        Alert.alert('Account creation failed', error.message)
        return
      }

      await supabase.from('candidate_profiles').upsert({
        id: (await supabase.auth.getUser()).data.user?.id,
        first_name: data.firstName,
        last_name: data.lastName,
      })

      await supabase
        .from('profiles')
        .update({ phone: data.phone })
        .eq('email', data.email)

      router.push('/(onboarding)/candidate/step-2')
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

          <Text className="text-white text-3xl font-bold mb-2">Create your account</Text>
          <Text className="text-slate-400 text-base mb-8">
            Let's start with the basics. All information must be accurate.
          </Text>

          <View className="gap-4 mb-6">
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Controller
                  control={control}
                  name="firstName"
                  render={({ field: { onChange, value } }) => (
                    <FormInput
                      label="First name"
                      placeholder="Ade"
                      value={value}
                      onChangeText={onChange}
                      error={errors.firstName?.message}
                      autoCapitalize="words"
                    />
                  )}
                />
              </View>
              <View className="flex-1">
                <Controller
                  control={control}
                  name="lastName"
                  render={({ field: { onChange, value } }) => (
                    <FormInput
                      label="Last name"
                      placeholder="Okafor"
                      value={value}
                      onChangeText={onChange}
                      error={errors.lastName?.message}
                      autoCapitalize="words"
                    />
                  )}
                />
              </View>
            </View>

            <Controller
              control={control}
              name="email"
              render={({ field: { onChange, value } }) => (
                <FormInput
                  label="Email address"
                  placeholder="you@example.com"
                  value={value}
                  onChangeText={onChange}
                  error={errors.email?.message}
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
            By creating an account you agree to our Terms of Service and Privacy Policy.
            Your data is protected under NDPR.
          </Text>

          <Pressable
            onPress={handleSubmit(handleCreate)}
            disabled={isSubmitting}
            className={`rounded-2xl py-4 items-center mb-12 ${isSubmitting ? 'bg-primary-700' : 'bg-primary-500'}`}
          >
            <Text className="text-white font-bold text-base">
              {isSubmitting ? 'Creating account...' : 'Continue'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

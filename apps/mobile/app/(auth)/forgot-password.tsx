import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { supabase } from '@/lib/supabase'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})

type Form = z.infer<typeof schema>

export default function ForgotPasswordScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    const { error } = await supabase.auth.resetPasswordForEmail(data.email)
    if (error) {
      Alert.alert('Error', error.message)
    } else {
      Alert.alert(
        'Check your email',
        'We sent a password reset link to your email address.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface px-6">
      <Pressable onPress={() => router.back()} className="mt-6 mb-8">
        <Text className="text-primary-400 text-base">← Back</Text>
      </Pressable>

      <Text className="text-white text-3xl font-bold mb-2">Reset password</Text>
      <Text className="text-slate-400 text-base mb-8">
        Enter your email address and we'll send you a reset link.
      </Text>

      <Controller
        control={control}
        name="email"
        render={({ field: { onChange, value } }) => (
          <View className="mb-6">
            <Text className="text-slate-300 text-sm mb-2">Email address</Text>
            <TextInput
              className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base"
              placeholder="you@company.com"
              placeholderTextColor="#475569"
              keyboardType="email-address"
              autoCapitalize="none"
              value={value}
              onChangeText={onChange}
            />
            {errors.email && (
              <Text className="text-red-400 text-sm mt-1">{errors.email.message}</Text>
            )}
          </View>
        )}
      />

      <Pressable
        onPress={handleSubmit(onSubmit)}
        disabled={isSubmitting}
        className="bg-primary-500 rounded-xl py-4 items-center"
      >
        <Text className="text-white font-semibold text-base">
          {isSubmitting ? 'Sending...' : 'Send reset link'}
        </Text>
      </Pressable>
    </SafeAreaView>
  )
}

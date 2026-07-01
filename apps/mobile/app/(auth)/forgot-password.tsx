import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

function MailIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  )
}

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
    const { error } = await supabase.auth.signInWithOtp({
      email: data.email,
      options: {
        shouldCreateUser: false,
      },
    })

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    router.push({
      pathname: '/(auth)/otp-verify',
      params: { email: data.email, mode: 'reset' },
    })
  }

  return (
    <SafeAreaView className="flex-1 bg-surface px-5">
      <Pressable onPress={() => router.back()} className="mt-4 mb-6">
        <Text className="text-primary-400 text-base">← Back</Text>
      </Pressable>

      <Animated.View entering={FadeInUp.delay(50).duration(500)} className="items-center mb-8">
        <View
          className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center mb-5"
          style={{ width: 64, height: 64 }}
        >
          <MailIcon />
        </View>
        <Text
          style={{
            color: '#1A1625',
            fontSize: 26,
            fontWeight: '700',
            textAlign: 'center',
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          Forgot password?
        </Text>
        <Text className="text-slate-400 text-sm text-center leading-5 px-4">
          Enter your email address and we'll send you a one-time code to reset your password.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)}>
        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <View className="mb-6">
              <Text className="text-slate-300 text-sm mb-2">Email address</Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-base"
                placeholder="you@company.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={value}
                onChangeText={onChange}
              />
              {errors.email && (
                <Text className="text-red-400 text-xs mt-1">{errors.email.message}</Text>
              )}
            </View>
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          <Text className="text-[#1A1625] font-semibold text-base">
            {isSubmitting ? 'Sending code…' : 'Send reset code'}
          </Text>
        </Pressable>

        <View className="flex-row justify-center mt-6">
          <Text className="text-slate-400 text-sm">Remember your password? </Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text className="text-primary-400 text-sm font-semibold">Sign in</Text>
          </Pressable>
        </View>
      </Animated.View>
    </SafeAreaView>
  )
}

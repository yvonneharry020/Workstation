import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

function ShieldCheckIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <Path d="M9 12l2 2 4-4" />
    </Svg>
  )
}

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
        <Circle cx={12} cy={12} r={3} />
      </Svg>
    )
  }
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <Path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <Path d="M1 1l22 22" />
    </Svg>
  )
}

const PASSWORD_MIN = 8

const schema = z
  .object({
    password: z
      .string()
      .min(PASSWORD_MIN, `Password must be at least ${PASSWORD_MIN} characters`),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: 'Passwords do not match',
    path: ['confirm'],
  })

type Form = z.infer<typeof schema>

export default function ResetPasswordScreen() {
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Form>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: Form) => {
    const { error } = await supabase.auth.updateUser({ password: data.password })

    if (error) {
      Alert.alert('Error', error.message)
      return
    }

    Alert.alert(
      'Password updated',
      'Your password has been changed. You are now signed in.',
      [{ text: 'Continue', onPress: () => router.replace('/(auth)/welcome') }]
    )
  }

  const requirements = [
    { label: `At least ${PASSWORD_MIN} characters`, done: true },
    { label: 'Mix of letters and numbers recommended', done: false },
  ]

  return (
    <SafeAreaView className="flex-1 bg-surface px-5">
      <Animated.View entering={FadeInUp.delay(50).duration(500)} className="items-center mt-10 mb-8">
        <View
          className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center mb-5"
          style={{ width: 64, height: 64 }}
        >
          <ShieldCheckIcon />
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
          Set new password
        </Text>
        <Text className="text-slate-400 text-sm text-center leading-5 px-4">
          Choose a strong password for your account.
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)}>
        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View className="mb-4">
              <Text className="text-slate-300 text-sm mb-2">New password</Text>
              <View className="relative">
                <TextInput
                  className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-base pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  value={value}
                  onChangeText={onChange}
                />
                <Pressable
                  onPress={() => setShowPassword((v) => !v)}
                  className="absolute right-4 top-4"
                  hitSlop={8}
                >
                  <EyeIcon visible={showPassword} />
                </Pressable>
              </View>
              {errors.password && (
                <Text className="text-red-400 text-xs mt-1">{errors.password.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="confirm"
          render={({ field: { onChange, value } }) => (
            <View className="mb-6">
              <Text className="text-slate-300 text-sm mb-2">Confirm password</Text>
              <View className="relative">
                <TextInput
                  className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-[#1A1625] text-base pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showConfirm}
                  autoComplete="new-password"
                  value={value}
                  onChangeText={onChange}
                />
                <Pressable
                  onPress={() => setShowConfirm((v) => !v)}
                  className="absolute right-4 top-4"
                  hitSlop={8}
                >
                  <EyeIcon visible={showConfirm} />
                </Pressable>
              </View>
              {errors.confirm && (
                <Text className="text-red-400 text-xs mt-1">{errors.confirm.message}</Text>
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
            {isSubmitting ? 'Updating…' : 'Update password'}
          </Text>
        </Pressable>

        <Text className="text-slate-600 text-xs text-center mt-5">
          Your new password will take effect immediately.
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

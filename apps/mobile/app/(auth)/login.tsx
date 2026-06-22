import { View, Text, TextInput, Pressable, ScrollView, Alert } from 'react-native'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import { loginSchema, type LoginSchema } from '@workstation/validators'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginSchema) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    })

    if (error) {
      Alert.alert('Sign in failed', error.message)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-6 pt-6"
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <Text className="text-white text-3xl font-bold mb-2">Welcome back</Text>
        <Text className="text-slate-400 text-base mb-8">
          Sign in to your Workstation account
        </Text>

        <Controller
          control={control}
          name="email"
          render={({ field: { onChange, value } }) => (
            <View className="mb-4">
              <Text className="text-slate-300 text-sm mb-2">Email address</Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base"
                placeholder="you@company.com"
                placeholderTextColor="#475569"
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                value={value}
                onChangeText={onChange}
              />
              {errors.email && (
                <Text className="text-red-400 text-sm mt-1">{errors.email.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View className="mb-6">
              <Text className="text-slate-300 text-sm mb-2">Password</Text>
              <TextInput
                className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base"
                placeholder="••••••••"
                placeholderTextColor="#475569"
                secureTextEntry
                autoComplete="password"
                value={value}
                onChangeText={onChange}
              />
              {errors.password && (
                <Text className="text-red-400 text-sm mt-1">{errors.password.message}</Text>
              )}
            </View>
          )}
        />

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-primary-500 rounded-xl py-4 items-center mb-4"
        >
          <Text className="text-white font-semibold text-base">
            {isSubmitting ? 'Signing in...' : 'Sign in'}
          </Text>
        </Pressable>

        <Pressable onPress={() => router.push('/(auth)/forgot-password')}>
          <Text className="text-primary-400 text-center text-sm mb-8">
            Forgot your password?
          </Text>
        </Pressable>

        <View className="flex-row justify-center pb-8">
          <Text className="text-slate-400 text-sm">Don't have an account? </Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary-400 text-sm font-semibold">Create one</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

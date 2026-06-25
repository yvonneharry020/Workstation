import { View, Text, TextInput, Pressable, ScrollView } from 'react-native'
import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Svg, { Path, Circle } from 'react-native-svg'
import { loginSchema, type LoginSchema } from '@workstation/validators'
import { supabase } from '@/lib/supabase'
import { logEvent } from '@/lib/audit'

function GoogleIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
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

export default function LoginScreen() {
  const [showPassword, setShowPassword] = useState(false)
  const [isGoogleLoading, setIsGoogleLoading] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchema>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = async (data: LoginSchema) => {
    setAuthError(null)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      })
      if (error) {
        logEvent({ event: 'user.login_failed', app: 'candidate_app', severity: 'warning', metadata: { email: data.email } })
        setAuthError(error.message || 'Sign in failed. Please try again.')
        return
      }
      // App type is determined by what profile the user has — log generically as candidate_app
      logEvent({ event: 'user.login', app: 'candidate_app', metadata: { email: data.email } })
      router.replace('/')
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'An unexpected error occurred')
    }
  }

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'workstation://auth/callback',
        },
      })
      if (error) {
        Alert.alert('Google sign in failed', error.message)
      }
    } finally {
      setIsGoogleLoading(false)
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable onPress={() => router.back()} className="mt-4 mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <View className="items-center mb-8">
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              backgroundColor: '#FF6240',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 16,
            }}
          >
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800', lineHeight: 30 }}>
              W
            </Text>
          </View>
          <Text
            style={{
              color: '#fff',
              fontSize: 26,
              fontWeight: '700',
              textAlign: 'center',
              letterSpacing: -0.3,
              marginBottom: 6,
            }}
          >
            Welcome back
          </Text>
          <Text className="text-slate-400 text-sm text-center">
            Sign in to your Workstation account
          </Text>
        </View>

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
                <Text className="text-red-400 text-xs mt-1">{errors.email.message}</Text>
              )}
            </View>
          )}
        />

        <Controller
          control={control}
          name="password"
          render={({ field: { onChange, value } }) => (
            <View className="mb-2">
              <Text className="text-slate-300 text-sm mb-2">Password</Text>
              <View className="relative">
                <TextInput
                  className="bg-surface-card border border-surface-border rounded-xl px-4 py-4 text-white text-base pr-12"
                  placeholder="••••••••"
                  placeholderTextColor="#475569"
                  secureTextEntry={!showPassword}
                  autoComplete="password"
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

        <Pressable
          onPress={() => router.push('/(auth)/forgot-password')}
          className="mb-6"
        >
          <Text className="text-primary-400 text-sm text-right">Forgot password?</Text>
        </Pressable>

        {authError && (
          <View className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 mb-4">
            <Text className="text-red-400 text-sm text-center">{authError}</Text>
          </View>
        )}

        <Pressable
          onPress={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="bg-primary-500 rounded-2xl py-4 items-center mb-5 active:opacity-80"
          style={{ opacity: isSubmitting ? 0.7 : 1 }}
        >
          <Text className="text-white font-semibold text-base">
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>

        <View className="flex-row items-center mb-5">
          <View className="flex-1 h-px bg-surface-border" />
          <Text className="text-slate-500 text-xs px-4">or continue with</Text>
          <View className="flex-1 h-px bg-surface-border" />
        </View>

        <Pressable
          onPress={handleGoogleSignIn}
          disabled={isGoogleLoading}
          className="bg-surface-card border border-surface-border rounded-2xl py-4 flex-row items-center justify-center gap-3 mb-8 active:opacity-70"
          style={{ opacity: isGoogleLoading ? 0.7 : 1 }}
        >
          <GoogleIcon />
          <Text className="text-white font-semibold text-sm">
            {isGoogleLoading ? 'Opening Google…' : 'Continue with Google'}
          </Text>
        </Pressable>

        <View className="flex-row justify-center">
          <Text className="text-slate-400 text-sm">Don't have an account? </Text>
          <Pressable onPress={() => router.push('/(auth)/register')}>
            <Text className="text-primary-400 text-sm font-semibold">Create one</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

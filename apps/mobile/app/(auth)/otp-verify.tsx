import { View, Text, TextInput, Pressable, Alert } from 'react-native'
import { useState, useRef } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'

function LockIcon() {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z" />
      <Path d="M7 11V7a5 5 0 0 1 10 0v4" />
      <Path d="M12 16v2" />
    </Svg>
  )
}

const OTP_LENGTH = 6

export default function OtpVerifyScreen() {
  const { email, mode } = useLocalSearchParams<{ email: string; mode: string }>()
  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const inputRef = useRef<TextInput>(null)

  const maskedEmail = email
    ? email.replace(/(.{2})(.*)(@.*)/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : ''

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH)
    setOtp(cleaned)
  }

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('Invalid code', 'Please enter the 6-digit code we sent to your email.')
      return
    }

    if (!email) {
      Alert.alert('Error', 'Email address missing. Please restart the flow.')
      return
    }

    setIsVerifying(true)
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })

      if (error) {
        Alert.alert('Verification failed', 'The code is incorrect or has expired. Please try again.')
        setOtp('')
        return
      }

      if (mode === 'reset') {
        router.replace('/(auth)/reset-password')
      } else {
        router.replace('/(auth)/welcome')
      }
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!email) return

    setIsResending(true)
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: false },
      })
      if (error) {
        Alert.alert('Error', 'Could not resend the code. Please try again.')
      } else {
        Alert.alert('Code sent', 'A new code has been sent to your email.')
        setOtp('')
      }
    } finally {
      setIsResending(false)
    }
  }

  const digits = otp.split('').concat(Array(OTP_LENGTH - otp.length).fill(''))

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
          <LockIcon />
        </View>
        <Text
          style={{
            color: '#fff',
            fontSize: 26,
            fontWeight: '700',
            textAlign: 'center',
            letterSpacing: -0.3,
            marginBottom: 8,
          }}
        >
          Enter your code
        </Text>
        <Text className="text-slate-400 text-sm text-center leading-5 px-4">
          We sent a 6-digit code to{'\n'}
          <Text className="text-white font-medium">{maskedEmail}</Text>
        </Text>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)}>
        <Pressable
          onPress={() => inputRef.current?.focus()}
          className="flex-row justify-center gap-2 mb-8"
        >
          {digits.map((digit, index) => (
            <View
              key={index}
              style={{
                width: 46,
                height: 54,
                borderRadius: 12,
                backgroundColor: '#131118',
                borderWidth: 1.5,
                borderColor: digit ? '#FF6240' : otp.length === index ? '#564F6A' : '#3D3850',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text
                style={{
                  color: '#fff',
                  fontSize: 22,
                  fontWeight: '700',
                  fontFamily: 'JetBrainsMono_700Bold',
                  letterSpacing: 2,
                }}
              >
                {digit || (otp.length === index ? '|' : '')}
              </Text>
            </View>
          ))}
        </Pressable>

        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={handleOtpChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
          autoFocus
        />

        <Pressable
          onPress={handleVerify}
          disabled={isVerifying || otp.length !== OTP_LENGTH}
          className="bg-primary-500 rounded-2xl py-4 items-center mb-5 active:opacity-80"
          style={{ opacity: isVerifying || otp.length !== OTP_LENGTH ? 0.5 : 1 }}
        >
          <Text className="text-white font-semibold text-base">
            {isVerifying ? 'Verifying…' : 'Verify code'}
          </Text>
        </Pressable>

        <View className="flex-row justify-center items-center gap-1">
          <Text className="text-slate-400 text-sm">Didn't receive a code?</Text>
          <Pressable onPress={handleResend} disabled={isResending} hitSlop={8}>
            <Text
              className="text-primary-400 text-sm font-semibold"
              style={{ opacity: isResending ? 0.5 : 1 }}
            >
              {isResending ? 'Sending…' : 'Resend'}
            </Text>
          </Pressable>
        </View>

        <Text className="text-slate-600 text-xs text-center mt-4">
          Code expires in 15 minutes
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

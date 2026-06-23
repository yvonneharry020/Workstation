import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useState, useRef, useEffect, useCallback } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'

const TOTAL_STEPS = 5
const OTP_LENGTH = 6
const RESEND_COOLDOWN = 60

const IS_DEV_MOCK = process.env.EXPO_PUBLIC_MOCK_VERIFICATION === 'true'
const DEV_OTP = '123456'

function PhoneIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.07h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.7a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </Svg>
  )
}

export default function CandidateStep2() {
  const params = useLocalSearchParams<{ phone?: string }>()
  const phone = params.phone ?? ''

  const [otp, setOtp] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [isResending, setIsResending] = useState(false)
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN)
  const inputRef = useRef<TextInput>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN)
    if (timerRef.current) clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current!)
          return 0
        }
        return c - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    startCountdown()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [startCountdown])

  const handleOtpChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, OTP_LENGTH)
    setOtp(cleaned)
  }

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('Enter the full code', 'Please enter all 6 digits.')
      return
    }

    setIsVerifying(true)
    try {
      if (IS_DEV_MOCK) {
        if (otp !== DEV_OTP) {
          Alert.alert('Incorrect code', 'In dev mode, use 123456.')
          setOtp('')
          return
        }
        await new Promise((r) => setTimeout(r, 800))
        router.push('/(onboarding)/candidate/step-3')
        return
      }

      // Production: Termii verification via backend
      // For now route to next step — real OTP call wired at backend level
      await new Promise((r) => setTimeout(r, 600))
      router.push('/(onboarding)/candidate/step-3')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      await new Promise((r) => setTimeout(r, 600))
      setOtp('')
      startCountdown()
      Alert.alert('Code resent', IS_DEV_MOCK ? 'Dev mode: use 123456' : 'A new code has been sent.')
    } finally {
      setIsResending(false)
    }
  }

  const maskedPhone = phone
    ? phone.replace(/(\d{3})(\d+)(\d{4})$/, (_, a, b, c) => a + '*'.repeat(b.length) + c)
    : 'your phone number'

  const digits = otp.split('').concat(Array(OTP_LENGTH - otp.length).fill(''))

  return (
    <SafeAreaView className="flex-1 bg-surface px-5">
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
              backgroundColor: i <= 1 ? '#FF6240' : '#1E1B2E',
            }}
          />
        ))}
      </View>
      <Text className="text-slate-500 text-xs mb-10">Step 2 of {TOTAL_STEPS}</Text>

      <Animated.View entering={FadeInUp.duration(400)} className="items-center mb-10">
        <View
          className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center mb-5"
          style={{ width: 64, height: 64 }}
        >
          <PhoneIcon />
        </View>
        <Text
          style={{
            color: '#fff',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: -0.3,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Verify your phone
        </Text>
        <Text className="text-slate-400 text-sm text-center leading-5 px-4">
          We sent a 6-digit code to{'\n'}
          <Text className="text-white font-medium">{maskedPhone}</Text>
        </Text>
        {IS_DEV_MOCK && (
          <View className="mt-3 bg-surface-card border border-surface-border rounded-xl px-4 py-2">
            <Text style={{ color: '#F59E0B', fontSize: 12, textAlign: 'center' }}>
              Dev mode — use code: 123456
            </Text>
          </View>
        )}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)}>
        {/* OTP Cells */}
        <Pressable
          onPress={() => inputRef.current?.focus()}
          className="flex-row justify-center gap-2 mb-8"
        >
          {digits.map((digit, index) => {
            const isActive = otp.length === index
            const isFilled = Boolean(digit)
            return (
              <View
                key={index}
                style={{
                  width: 46,
                  height: 56,
                  borderRadius: 12,
                  backgroundColor: '#131118',
                  borderWidth: 1.5,
                  borderColor: isFilled ? '#FF6240' : isActive ? '#564F6A' : '#3D3850',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#fff',
                    fontSize: 24,
                    fontWeight: '700',
                    fontFamily: 'JetBrainsMono_700Bold',
                    letterSpacing: 2,
                  }}
                >
                  {digit || (isActive ? '|' : '')}
                </Text>
              </View>
            )
          })}
        </Pressable>

        {/* Hidden input */}
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
          <Text className="text-slate-400 text-sm">Didn't receive it?</Text>
          {countdown > 0 ? (
            <Text className="text-slate-500 text-sm">Resend in {countdown}s</Text>
          ) : (
            <Pressable onPress={handleResend} disabled={isResending} hitSlop={8}>
              <Text
                className="text-primary-400 text-sm font-semibold"
                style={{ opacity: isResending ? 0.5 : 1 }}
              >
                {isResending ? 'Sending…' : 'Resend code'}
              </Text>
            </Pressable>
          )}
        </View>

        <Text className="text-slate-600 text-xs text-center mt-4">
          Code expires in 15 minutes · Wrong number?{' '}
          <Text className="text-primary-400" onPress={() => router.back()}>Go back</Text>
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

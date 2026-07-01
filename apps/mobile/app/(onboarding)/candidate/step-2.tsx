import { View, Text, Pressable, TextInput, Alert } from 'react-native'
import { useState, useRef, useEffect, useCallback } from 'react'
import { router, useLocalSearchParams } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { stateNameToId } from '@/lib/nigerianStates'

const TOTAL_STEPS = 5
const OTP_LENGTH = 8
const RESEND_COOLDOWN = 60

function MailIcon() {
  return (
    <Svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="#0DD4C3" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <Path d="M22 6l-10 7L2 6" />
    </Svg>
  )
}

export default function CandidateStep2() {
  const params = useLocalSearchParams<{
    email?: string
    firstName?: string
    lastName?: string
    otherNames?: string
    dateOfBirth?: string
    gender?: string
    phone?: string
    stateOfOrigin?: string
  }>()

  const email = params.email ?? ''
  const maskedEmail = email
    ? email.replace(/^(.{2})(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(0, b.length)) + c)
    : 'your email'

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
      Alert.alert('Enter the full code', 'Please enter all 8 digits.')
      return
    }
    if (!email) {
      Alert.alert('Error', 'Missing email address. Please go back and try again.')
      return
    }

    setIsVerifying(true)
    try {
      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: 'email',
      })

      if (verifyError) {
        Alert.alert('Invalid code', verifyError.message || 'The code you entered is incorrect or has expired.')
        setOtp('')
        return
      }

      const userId = verifyData.user?.id
      if (userId) {
        await supabase.from('candidate_profiles').upsert({
          id: userId,
          first_name: params.firstName || null,
          last_name: params.lastName || null,
          other_names: params.otherNames || null,
          date_of_birth: params.dateOfBirth || null,
          gender: params.gender || null,
          state_of_origin_id: params.stateOfOrigin ? stateNameToId(params.stateOfOrigin) : null,
        })

        if (params.phone) {
          await supabase.from('profiles').update({ phone: params.phone }).eq('id', userId)
        }
      }

      router.push('/(onboarding)/candidate/step-3')
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleResend = async () => {
    if (!email) return
    setIsResending(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) {
        Alert.alert('Could not resend', error.message)
        return
      }
      setOtp('')
      startCountdown()
      Alert.alert('Code resent', `A new verification code has been sent to ${maskedEmail}`)
    } catch {
      Alert.alert('Error', 'Could not resend the code. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

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
              backgroundColor: i <= 1 ? '#FF6240' : '#DDD6C9',
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
          <MailIcon />
        </View>
        <Text
          style={{
            color: '#1A1625',
            fontSize: 24,
            fontWeight: '700',
            letterSpacing: -0.3,
            textAlign: 'center',
            marginBottom: 8,
          }}
        >
          Verify your email
        </Text>
        <Text className="text-slate-400 text-sm text-center leading-5 px-4">
          We sent an 8-digit code to{'\n'}
          <Text className="text-[#1A1625] font-medium">{maskedEmail}</Text>
        </Text>
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
                  backgroundColor: '#EDE7DB',
                  borderWidth: 1.5,
                  borderColor: isFilled ? '#FF6240' : isActive ? '#564F6A' : '#C8BFB0',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#1A1625',
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
          <Text className="text-[#1A1625] font-semibold text-base">
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
          Code expires in 10 minutes · Wrong email?{' '}
          <Text className="text-primary-400" onPress={() => router.back()}>Go back</Text>
        </Text>
      </Animated.View>
    </SafeAreaView>
  )
}

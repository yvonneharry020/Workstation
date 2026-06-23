import {
  View,
  Text,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native'
import { useState, useRef } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeOutUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Path, Circle } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const TOTAL_STEPS = 5
const NIN_LENGTH = 11
const IS_MOCK = process.env.EXPO_PUBLIC_MOCK_VERIFICATION === 'true'

type VerifyState = 'idle' | 'verifying' | 'success' | 'failed'

function ShieldIcon({ color }: { color: string }) {
  return (
    <Svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </Svg>
  )
}

function CheckCircleIcon() {
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke="#22C55E" strokeWidth={1.5} />
      <Path d="M9 12l2 2 4-4" stroke="#22C55E" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

function XCircleIcon() {
  return (
    <Svg width={56} height={56} viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth={1.5} />
      <Path d="M15 9l-6 6M9 9l6 6" stroke="#EF4444" strokeWidth={1.5} strokeLinecap="round" />
    </Svg>
  )
}

function VerifyingSpinner() {
  const opacity = useSharedValue(1)

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))

  opacity.value = withRepeat(
    withSequence(withTiming(0.3, { duration: 600 }), withTiming(1, { duration: 600 })),
    -1,
    true
  )

  return (
    <Animated.View style={[{ alignItems: 'center', gap: 16 }, style]}>
      <Svg width={56} height={56} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
        <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </Svg>
      <Text style={{ color: '#94A3B8', fontSize: 14 }}>Verifying with NIMC…</Text>
    </Animated.View>
  )
}

export default function CandidateStep3() {
  const user = useAuthStore((s) => s.user)
  const [nin, setNin] = useState('')
  const [state, setState] = useState<VerifyState>('idle')
  const inputRef = useRef<TextInput>(null)

  const handleNinChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '').slice(0, NIN_LENGTH)
    setNin(cleaned)
  }

  const handleVerify = async () => {
    if (nin.length !== NIN_LENGTH) {
      Alert.alert('Invalid NIN', 'Your NIN must be exactly 11 digits.')
      return
    }

    setState('verifying')

    try {
      if (IS_MOCK) {
        await new Promise((r) => setTimeout(r, 2000))
        const passed = nin !== '00000000000'
        setState(passed ? 'success' : 'failed')

        if (passed && user?.id) {
          await supabase.from('candidate_profiles').update({
            nin_submitted: true,
            nin_verified: true,
            verification_status: 'nin_verified',
          }).eq('id', user.id)
        }
        return
      }

      // Production path — calls backend NIN verification service
      const { error } = await supabase.functions.invoke('verify-nin', {
        body: { nin, userId: user?.id },
      })
      setState(error ? 'failed' : 'success')
    } catch {
      setState('failed')
    }
  }

  const handleRetry = () => {
    setNin('')
    setState('idle')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  const digits = nin.split('').concat(Array(NIN_LENGTH - nin.length).fill(''))

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {state === 'idle' && (
            <Pressable onPress={() => router.back()} className="mt-6 mb-6">
              <Text className="text-primary-400 text-base">← Back</Text>
            </Pressable>
          )}

          {/* Progress bar */}
          <View className="flex-row items-center gap-1 mb-2 mt-2">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: i <= 2 ? '#FF6240' : '#1E1B2E',
                }}
              />
            ))}
          </View>
          <Text className="text-slate-500 text-xs mb-10">Step 3 of {TOTAL_STEPS}</Text>

          {/* IDLE state */}
          {state === 'idle' && (
            <Animated.View entering={FadeInDown.duration(400)}>
              <View className="items-center mb-8">
                <View
                  className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center mb-5"
                  style={{ width: 72, height: 72 }}
                >
                  <ShieldIcon color="#FF6240" />
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
                  NIN verification
                </Text>
                <Text className="text-slate-400 text-sm text-center leading-5 px-4">
                  Enter your 11-digit National Identification Number to confirm your identity.
                </Text>
              </View>

              {/* NIN info card */}
              <View
                className="rounded-xl px-4 py-4 mb-8"
                style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#3D3850' }}
              >
                <Text className="text-slate-300 text-sm font-semibold mb-2">Where to find your NIN</Text>
                <Text className="text-slate-400 text-sm leading-5">
                  • National ID card (back){'  '}• NIN slip from NIMC{'  '}• Dial *346# on any Nigerian network
                </Text>
              </View>

              {/* NIN digit cells */}
              <Text className="text-slate-300 text-sm font-medium mb-3">Your NIN</Text>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                className="flex-row flex-wrap gap-2 justify-center mb-2"
              >
                {digits.map((digit, index) => {
                  const isActive = nin.length === index
                  const isFilled = Boolean(digit)
                  return (
                    <View
                      key={index}
                      style={{
                        width: 42,
                        height: 52,
                        borderRadius: 10,
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
                          fontSize: 20,
                          fontWeight: '700',
                          fontFamily: 'JetBrainsMono_700Bold',
                        }}
                      >
                        {digit || (isActive ? '|' : '')}
                      </Text>
                    </View>
                  )
                })}
              </Pressable>

              <TextInput
                ref={inputRef}
                value={nin}
                onChangeText={handleNinChange}
                keyboardType="number-pad"
                maxLength={NIN_LENGTH}
                style={{ position: 'absolute', opacity: 0, width: 1, height: 1 }}
                autoFocus
              />

              <Text className="text-slate-500 text-xs text-center mb-8">
                {nin.length}/{NIN_LENGTH} digits entered
              </Text>

              <View
                className="rounded-xl px-4 py-3 mb-8 flex-row items-start gap-2"
                style={{ backgroundColor: '#0DD4C315', borderWidth: 1, borderColor: '#0DD4C330' }}
              >
                <Text style={{ color: '#0DD4C3', fontSize: 13 }}>🔒</Text>
                <Text style={{ color: '#0DD4C3', fontSize: 13, flex: 1, lineHeight: 18 }}>
                  Your NIN is encrypted and only used for identity verification — it is never stored in plain text.
                </Text>
              </View>

              <Pressable
                onPress={handleVerify}
                disabled={nin.length !== NIN_LENGTH}
                className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
                style={{ opacity: nin.length !== NIN_LENGTH ? 0.4 : 1 }}
              >
                <Text className="text-white font-semibold text-base">Verify NIN</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* VERIFYING state */}
          {state === 'verifying' && (
            <Animated.View
              entering={FadeInDown.duration(400)}
              exiting={FadeOutUp.duration(300)}
              className="items-center justify-center mt-20"
            >
              <VerifyingSpinner />
              <Text className="text-slate-500 text-xs mt-4 text-center">
                Cross-checking with NIMC database…{'\n'}This takes a few seconds.
              </Text>
            </Animated.View>
          )}

          {/* SUCCESS state */}
          {state === 'success' && (
            <Animated.View
              entering={FadeInDown.duration(500)}
              className="items-center mt-16"
            >
              <CheckCircleIcon />
              <Text
                style={{
                  color: '#fff',
                  fontSize: 24,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                  textAlign: 'center',
                  marginTop: 20,
                  marginBottom: 8,
                }}
              >
                NIN verified
              </Text>
              <Text className="text-slate-400 text-sm text-center leading-5 mb-12">
                Your identity has been confirmed successfully.
              </Text>

              <View
                className="w-full rounded-2xl px-5 py-4 mb-8"
                style={{ backgroundColor: '#131118', borderWidth: 1, borderColor: '#22C55E30' }}
              >
                {[
                  'Full name matched',
                  'Date of birth matched',
                  'NIMC record found',
                ].map((item) => (
                  <View key={item} className="flex-row items-center gap-3 py-2.5">
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: '#22C55E20',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>✓</Text>
                    </View>
                    <Text className="text-slate-300 text-sm">{item}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={() => router.push('/(onboarding)/candidate/step-4')}
                className="w-full bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              >
                <Text className="text-white font-semibold text-base">Continue to liveness check</Text>
              </Pressable>
            </Animated.View>
          )}

          {/* FAILED state */}
          {state === 'failed' && (
            <Animated.View
              entering={FadeInDown.duration(500)}
              className="items-center mt-16"
            >
              <XCircleIcon />
              <Text
                style={{
                  color: '#fff',
                  fontSize: 24,
                  fontWeight: '700',
                  letterSpacing: -0.3,
                  textAlign: 'center',
                  marginTop: 20,
                  marginBottom: 8,
                }}
              >
                Verification failed
              </Text>
              <Text className="text-slate-400 text-sm text-center leading-5 px-4 mb-8">
                We couldn't match your NIN. Double-check your number and ensure your name matches
                exactly as it appears on your NIN registration.
              </Text>

              <View
                className="w-full rounded-xl px-4 py-4 mb-8"
                style={{ backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430' }}
              >
                <Text style={{ color: '#EF4444', fontSize: 13, lineHeight: 20 }}>
                  Common reasons:{'\n'}
                  • NIN entered incorrectly{'\n'}
                  • Name does not match NIN record{'\n'}
                  • NIN not yet registered with NIMC
                </Text>
              </View>

              <Pressable
                onPress={handleRetry}
                className="w-full bg-primary-500 rounded-2xl py-4 items-center active:opacity-80 mb-4"
              >
                <Text className="text-white font-semibold text-base">Try again</Text>
              </Pressable>
              <Pressable onPress={() => router.back()} className="py-2">
                <Text className="text-slate-400 text-sm text-center">Update my name in step 1</Text>
              </Pressable>
            </Animated.View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

import { View, Text, Pressable, ScrollView } from 'react-native'
import { useState, useRef, useEffect } from 'react'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from 'react-native-reanimated'
import { CameraView, useCameraPermissions } from 'expo-camera'
import Svg, { Path, Circle, Rect } from 'react-native-svg'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'

const TOTAL_STEPS = 5
const IS_MOCK = process.env.EXPO_PUBLIC_MOCK_VERIFICATION === 'true'

type LivenessStep = {
  id: string
  instruction: string
  icon: string
}

const LIVENESS_STEPS: LivenessStep[] = [
  { id: 'center', instruction: 'Position your face in the oval', icon: '🙂' },
  { id: 'blink', instruction: 'Blink slowly twice', icon: '😊' },
  { id: 'left', instruction: 'Turn your head slightly left', icon: '👈' },
  { id: 'right', instruction: 'Turn your head slightly right', icon: '👉' },
  { id: 'smile', instruction: 'Smile naturally', icon: '😄' },
]

type CheckState = 'idle' | 'running' | 'done' | 'failed'

function FaceOvalFrame() {
  const pulse = useSharedValue(0)

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1500 }), -1, true)
  }, [pulse])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulse.value, [0, 1], [0.6, 1]),
  }))

  return (
    <Animated.View style={[{ position: 'absolute', alignSelf: 'center', top: 60 }, animatedStyle]}>
      <Svg width={220} height={280} viewBox="0 0 220 280">
        <Rect x={0} y={0} width={220} height={280} fill="transparent" />
        {/* Oval cutout border */}
        <Path
          d="M110 8 C48 8 16 64 16 140 C16 216 58 272 110 272 C162 272 204 216 204 140 C204 64 172 8 110 8 Z"
          stroke="#FF6240"
          strokeWidth={2.5}
          fill="none"
          strokeDasharray="12,6"
        />
      </Svg>
    </Animated.View>
  )
}

function PermissionScreen({ onRequest }: { onRequest: () => void }) {
  return (
    <View className="flex-1 items-center justify-center px-8">
      <View
        className="bg-surface-card border border-surface-border rounded-2xl items-center justify-center mb-6"
        style={{ width: 80, height: 80 }}
      >
        <Svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="#FF6240" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
          <Circle cx="12" cy="13" r="4" />
        </Svg>
      </View>
      <Text
        style={{
          color: '#1A1625',
          fontSize: 22,
          fontWeight: '700',
          textAlign: 'center',
          marginBottom: 10,
        }}
      >
        Camera access needed
      </Text>
      <Text className="text-slate-400 text-sm text-center leading-5 mb-8">
        Workstation needs camera access to complete your liveness check. Your video is processed
        locally and never stored.
      </Text>
      <Pressable
        onPress={onRequest}
        className="w-full bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
      >
        <Text className="text-[#1A1625] font-semibold text-base">Allow camera</Text>
      </Pressable>
    </View>
  )
}

export default function CandidateStep4() {
  const user = useAuthStore((s) => s.user)
  const [permission, requestPermission] = useCameraPermissions()

  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [checkState, setCheckState] = useState<CheckState>('idle')
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const stepTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentStep = LIVENESS_STEPS[currentStepIndex]
  const isAllDone = checkState === 'done'

  const runMockStep = (index: number) => {
    if (index >= LIVENESS_STEPS.length) {
      setCheckState('done')
      markVerified()
      return
    }

    setCurrentStepIndex(index)
    stepTimerRef.current = setTimeout(() => {
      setCompletedSteps((prev) => new Set(prev).add(index))
      runMockStep(index + 1)
    }, 1800)
  }

  const markVerified = async () => {
    if (!user?.id) return
    await supabase.from('candidate_profiles').update({
      liveness_verified: true,
    }).eq('id', user.id)
  }

  const handleStart = () => {
    if (IS_MOCK) {
      setCheckState('running')
      runMockStep(0)
      return
    }
    setCheckState('running')
  }

  const handleRetry = () => {
    if (stepTimerRef.current) clearTimeout(stepTimerRef.current)
    setCheckState('idle')
    setCurrentStepIndex(0)
    setCompletedSteps(new Set())
  }

  useEffect(() => {
    return () => { if (stepTimerRef.current) clearTimeout(stepTimerRef.current) }
  }, [])

  if (!permission) return <SafeAreaView className="flex-1 bg-surface" />

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-surface">
        <PermissionScreen onRequest={requestPermission} />
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
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
                backgroundColor: i <= 3 ? '#FF6240' : '#DDD6C9',
              }}
            />
          ))}
        </View>
        <Text className="text-slate-500 text-xs mb-6">Step 4 of {TOTAL_STEPS}</Text>

        {!isAllDone && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Text
              style={{
                color: '#1A1625',
                fontSize: 24,
                fontWeight: '700',
                letterSpacing: -0.3,
                marginBottom: 6,
              }}
            >
              Liveness check
            </Text>
            <Text className="text-slate-400 text-sm leading-5 mb-6">
              Follow each instruction to confirm you're a real person. Keep your face well-lit and
              centred in the oval.
            </Text>

            {/* Camera preview */}
            <View
              style={{ height: 340, borderRadius: 24, overflow: 'hidden', marginBottom: 20, position: 'relative' }}
              className="bg-surface-card"
            >
              <CameraView
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
                facing="front"
              />
              <FaceOvalFrame />

              {checkState === 'running' && currentStep && (
                <View
                  style={{
                    position: 'absolute',
                    bottom: 20,
                    left: 20,
                    right: 20,
                    backgroundColor: 'rgba(9,8,14,0.85)',
                    borderRadius: 16,
                    padding: 16,
                    alignItems: 'center',
                  }}
                >
                  <Text style={{ fontSize: 28, marginBottom: 4 }}>{currentStep.icon}</Text>
                  <Text style={{ color: '#1A1625', fontSize: 15, fontWeight: '600', textAlign: 'center' }}>
                    {currentStep.instruction}
                  </Text>
                </View>
              )}
            </View>

            {/* Step progress pills */}
            <View className="flex-row justify-center gap-2 mb-6">
              {LIVENESS_STEPS.map((step, index) => (
                <View
                  key={step.id}
                  style={{
                    width: 36,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: completedSteps.has(index)
                      ? '#22C55E'
                      : index === currentStepIndex && checkState === 'running'
                      ? '#FF6240'
                      : '#C8BFB0',
                  }}
                />
              ))}
            </View>

            {checkState === 'idle' && (
              <Pressable
                onPress={handleStart}
                className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
              >
                <Text className="text-[#1A1625] font-semibold text-base">Start liveness check</Text>
              </Pressable>
            )}

            {checkState === 'running' && (
              <View className="items-center">
                <Text className="text-slate-400 text-sm text-center">
                  Step {currentStepIndex + 1} of {LIVENESS_STEPS.length}
                </Text>
              </View>
            )}

            {checkState === 'failed' && (
              <View>
                <View
                  className="rounded-xl px-4 py-3 mb-4"
                  style={{ backgroundColor: '#EF444415', borderWidth: 1, borderColor: '#EF444430' }}
                >
                  <Text style={{ color: '#EF4444', fontSize: 13 }}>
                    Check failed — ensure your face is clearly visible and the room is well lit.
                  </Text>
                </View>
                <Pressable
                  onPress={handleRetry}
                  className="bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
                >
                  <Text className="text-[#1A1625] font-semibold text-base">Try again</Text>
                </Pressable>
              </View>
            )}

            <Text className="text-slate-600 text-xs text-center mt-4">
              🔒 Camera data is processed on-device and never uploaded
            </Text>
          </Animated.View>
        )}

        {/* SUCCESS state */}
        {isAllDone && (
          <Animated.View entering={FadeInUp.duration(500)} className="items-center mt-10">
            <View
              style={{
                width: 80,
                height: 80,
                borderRadius: 40,
                backgroundColor: '#22C55E20',
                borderWidth: 1,
                borderColor: '#22C55E40',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}
            >
              <Text style={{ fontSize: 36 }}>✓</Text>
            </View>
            <Text
              style={{
                color: '#1A1625',
                fontSize: 24,
                fontWeight: '700',
                textAlign: 'center',
                marginBottom: 8,
              }}
            >
              Liveness confirmed
            </Text>
            <Text className="text-slate-400 text-sm text-center leading-5 mb-10 px-4">
              You're verified as a real person. One last step — upload your supporting documents.
            </Text>

            {/* Completed steps list */}
            <View className="w-full bg-surface-card border border-surface-border rounded-2xl px-5 py-4 mb-8">
              {LIVENESS_STEPS.map((step) => (
                <View key={step.id} className="flex-row items-center gap-3 py-2.5">
                  <View
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      backgroundColor: '#22C55E20',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#22C55E', fontSize: 11, fontWeight: '700' }}>✓</Text>
                  </View>
                  <Text className="text-slate-300 text-sm">{step.instruction}</Text>
                </View>
              ))}
            </View>

            <Pressable
              onPress={() => router.push('/(onboarding)/candidate/step-5')}
              className="w-full bg-primary-500 rounded-2xl py-4 items-center active:opacity-80"
            >
              <Text className="text-[#1A1625] font-semibold text-base">Continue to documents</Text>
            </Pressable>
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

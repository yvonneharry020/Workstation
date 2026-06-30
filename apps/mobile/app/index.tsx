import { useEffect, useState } from 'react'
import { View, Text, Platform } from 'react-native'
import { Redirect } from 'expo-router'
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated'
import { useAuthStore } from '@/stores/authStore'
import { Storage } from '@/lib/storage'

function SplashContent() {
  const isWeb = Platform.OS === 'web'
  const logoScale = useSharedValue(isWeb ? 1 : 0.25)
  const logoOpacity = useSharedValue(isWeb ? 1 : 0)
  const titleOpacity = useSharedValue(isWeb ? 1 : 0)
  const taglineOpacity = useSharedValue(isWeb ? 1 : 0)
  const dotsOpacity = useSharedValue(isWeb ? 1 : 0)

  useEffect(() => {
    logoScale.value = withSpring(1, { damping: 14, stiffness: 120 })
    logoOpacity.value = withTiming(1, { duration: 400 })
    titleOpacity.value = withDelay(260, withTiming(1, { duration: 500 }))
    taglineOpacity.value = withDelay(480, withTiming(1, { duration: 500 }))
    dotsOpacity.value = withDelay(700, withTiming(1, { duration: 400 }))
  }, [])

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }))

  const titleStyle = useAnimatedStyle(() => ({ opacity: titleOpacity.value }))
  const taglineStyle = useAnimatedStyle(() => ({ opacity: taglineOpacity.value }))
  const dotsStyle = useAnimatedStyle(() => ({ opacity: dotsOpacity.value }))

  return (
    <View className="flex-1 bg-surface items-center justify-center gap-5">
      <Animated.View style={logoStyle} className="items-center gap-4">
        <View
          className="bg-primary-500 items-center justify-center"
          style={{ width: 72, height: 72, borderRadius: 20 }}
        >
          <Text
            style={{
              fontSize: 34,
              fontFamily: 'PlusJakartaSans_800ExtraBold',
              color: '#fff',
              lineHeight: 40,
            }}
          >
            W
          </Text>
        </View>
      </Animated.View>

      <Animated.View style={titleStyle} className="items-center gap-2">
        <Text
          style={{
            fontSize: 28,
            fontFamily: 'PlusJakartaSans_700Bold',
            color: '#ffffff',
            letterSpacing: 1.5,
          }}
        >
          WORKSTATION
        </Text>
        <View
          style={{
            width: 40,
            height: 2,
            borderRadius: 1,
            backgroundColor: '#FF6240',
          }}
        />
      </Animated.View>

      <Animated.View style={taglineStyle}>
        <Text
          style={{
            fontSize: 13,
            fontFamily: 'Inter_400Regular',
            color: '#564F6A',
            letterSpacing: 0.3,
          }}
        >
          Trust infrastructure for Nigeria.
        </Text>
      </Animated.View>

      <Animated.View style={dotsStyle} className="flex-row gap-1.5 absolute bottom-16">
        {[0, 1, 2].map((i) => (
          <Animated.View
            key={i}
            entering={FadeInDown.delay(700 + i * 120).duration(300)}
            style={{
              width: 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === 0 ? '#FF6240' : '#3D3850',
            }}
          />
        ))}
      </Animated.View>
    </View>
  )
}

export default function Index() {
  const { session, role, isOnboardingComplete, isLoading, isResolvingProfile } = useAuthStore()
  const [hasSeenTutorial, setHasSeenTutorial] = useState<boolean | null>(null)

  useEffect(() => {
    Storage.hasSeenTutorial().then(setHasSeenTutorial)
  }, [])

  if (isLoading || isResolvingProfile || hasSeenTutorial === null) return <SplashContent />

  if (!session) {
    if (!hasSeenTutorial) {
      return <Redirect href="/(tutorial)/tutorial-1" />
    }
    return <Redirect href="/(auth)/welcome" />
  }

  if (role === 'candidate') {
    return isOnboardingComplete
      ? <Redirect href="/(candidate)/" />
      : <Redirect href="/(onboarding)/candidate/step-1" />
  }

  if (role === 'company') {
    return isOnboardingComplete
      ? <Redirect href="/(company)/" />
      : <Redirect href="/(onboarding)/company/step-1" />
  }

  if (role === 'admin') {
    return <Redirect href="/(auth)/welcome" />
  }

  return <Redirect href="/(auth)/welcome" />
}

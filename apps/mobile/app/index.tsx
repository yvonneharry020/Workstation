import { Redirect } from 'expo-router'
import { View, ActivityIndicator } from 'react-native'
import { useAuthStore } from '@/stores/authStore'

export default function Index() {
  const { session, role, isOnboardingComplete, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <View className="flex-1 bg-surface items-center justify-center">
        <ActivityIndicator size="large" color="#6366F1" />
      </View>
    )
  }

  if (!session) {
    return <Redirect href="/(auth)/welcome" />
  }

  if (role === 'candidate') {
    if (!isOnboardingComplete) {
      return <Redirect href="/(onboarding)/candidate/step-1" />
    }
    return <Redirect href="/(candidate)/" />
  }

  if (role === 'company') {
    if (!isOnboardingComplete) {
      return <Redirect href="/(onboarding)/company/step-1" />
    }
    return <Redirect href="/(company)/" />
  }

  if (role === 'admin') {
    return <Redirect href="/(auth)/welcome" />
  }

  return <Redirect href="/(auth)/welcome" />
}

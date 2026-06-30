import { useEffect, useState } from 'react'
import { View, Modal, Platform } from 'react-native'
import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter'
import {
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans'
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono'
import '../global.css'
import { cssInterop } from 'nativewind'
import { SafeAreaView } from 'react-native-safe-area-context'
import Animated from 'react-native-reanimated'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { useNetworkStatus } from '@/lib/useNetworkStatus'
import { usePlatformConfig } from '@/lib/usePlatformConfig'
import { OfflineScreen } from '@/components/system/OfflineScreen'
import { UpdateRequiredScreen } from '@/components/system/UpdateRequiredScreen'
import { MaintenanceScreen } from '@/components/system/MaintenanceScreen'
import type { UserRole } from '@workstation/types'

// Register third-party components so NativeWind className prop is handled correctly.
// These are not in css-interop's built-in registry (only plain RN components are).
cssInterop(SafeAreaView, { className: 'style' })
cssInterop(Animated.View, { className: 'style' })
cssInterop(Animated.Text, { className: 'style' })

if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync()
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

async function resolveProfileState(
  userId: string,
  setRole: (role: UserRole | null) => void,
  setOnboardingComplete: (v: boolean) => void,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()

  if (!profile) {
    setRole(null)
    setOnboardingComplete(false)
    return
  }

  const role = profile.role as UserRole
  setRole(role)

  if (role === 'candidate') {
    const { data: cp } = await supabase
      .from('candidate_profiles')
      .select('first_name')
      .eq('id', userId)
      .single()
    setOnboardingComplete(!!cp?.first_name)
  } else if (role === 'company') {
    const { data: co } = await supabase
      .from('company_profiles')
      .select('id')
      .eq('id', userId)
      .single()
    setOnboardingComplete(!!co?.id)
  } else {
    setOnboardingComplete(true)
  }
}

function SystemOverlay() {
  const isOnline = useNetworkStatus()
  const { isMaintenanceMode, maintenanceMessage, isUpdateRequired } = usePlatformConfig()
  const [retryCount, setRetryCount] = useState(0)

  const showOffline = !isOnline
  const showUpdate = isOnline && isUpdateRequired
  const showMaintenance = isOnline && !isUpdateRequired && isMaintenanceMode
  const isVisible = showOffline || showUpdate || showMaintenance

  return (
    <Modal
      visible={isVisible}
      statusBarTranslucent
      transparent={false}
      animationType="fade"
    >
      <View style={{ flex: 1, backgroundColor: '#09080E' }}>
        {showOffline ? (
          <OfflineScreen onRetry={() => setRetryCount((c) => c + 1)} key={retryCount} />
        ) : showUpdate ? (
          <UpdateRequiredScreen />
        ) : (
          <MaintenanceScreen message={maintenanceMessage} />
        )}
      </View>
    </Modal>
  )
}

export default function RootLayout() {
  const { setSession, setRole, setOnboardingComplete, setLoading, setResolvingProfile, reset } = useAuthStore()

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_700Bold,
  })

  // Safety net: if auth check hangs for any reason, unblock after 3s
  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 3000)
    return () => clearTimeout(timeout)
  }, [setLoading])

  useEffect(() => {
    // On web, useFonts behaves differently — don't gate auth on it
    if (!fontsLoaded && Platform.OS !== 'web') return

    if (Platform.OS !== 'web') {
      SplashScreen.hideAsync()
    }

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        try {
          await resolveProfileState(session.user.id, setRole, setOnboardingComplete)
        } catch {
          // profile fetch failed — proceed without role, app will redirect to auth
        }
      }
      setLoading(false)
    }).catch(() => {
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session?.user) {
        setResolvingProfile(true)
        resolveProfileState(session.user.id, setRole, setOnboardingComplete)
          .catch(() => {
            setRole(null)
            setOnboardingComplete(false)
          })
          .finally(() => setResolvingProfile(false))
      } else {
        reset()
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [fontsLoaded, setSession, setRole, setOnboardingComplete, setLoading, setResolvingProfile, reset])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false }} />
        <SystemOverlay />
      </QueryClientProvider>
    </GestureHandlerRootView>
  )
}

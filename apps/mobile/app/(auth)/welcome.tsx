import { View, Text, Pressable, Image } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function WelcomeScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface px-6">
      <View className="flex-1 justify-center items-center">
        <View className="w-20 h-20 bg-primary-500 rounded-2xl items-center justify-center mb-8">
          <Text className="text-white text-3xl font-bold">W</Text>
        </View>
        <Text className="text-white text-4xl font-bold text-center mb-3">
          Workstation
        </Text>
        <Text className="text-slate-400 text-base text-center leading-6 mb-12">
          The only Nigerian job platform where every company is verified and every candidate is real.
        </Text>
      </View>

      <View className="pb-8 gap-4">
        <Pressable
          onPress={() => router.push('/(auth)/register')}
          className="bg-primary-500 rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-semibold text-base">Create an account</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(auth)/login')}
          className="bg-surface-card border border-surface-border rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-semibold text-base">Sign in</Text>
        </Pressable>

        <Text className="text-slate-500 text-xs text-center mt-2">
          By continuing you agree to our Terms of Service and Privacy Policy
        </Text>
      </View>
    </SafeAreaView>
  )
}

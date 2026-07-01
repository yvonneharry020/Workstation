import { View, Text, Pressable, ScrollView } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function RegisterScreen() {
  return (
    <SafeAreaView className="flex-1 bg-surface">
      <ScrollView className="flex-1 px-6 pt-6" showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} className="mb-8">
          <Text className="text-primary-400 text-base">← Back</Text>
        </Pressable>

        <Text className="text-[#1A1625] text-3xl font-bold mb-2">Create account</Text>
        <Text className="text-slate-400 text-base mb-10">
          Who are you joining as?
        </Text>

        <Pressable
          onPress={() => router.push('/(onboarding)/candidate/step-1')}
          className="bg-surface-card border border-surface-border rounded-2xl p-6 mb-4"
        >
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 bg-primary-500/20 rounded-xl items-center justify-center mr-3">
              <Text className="text-2xl">👤</Text>
            </View>
            <Text className="text-[#1A1625] font-semibold text-lg">I'm looking for a job</Text>
          </View>
          <Text className="text-slate-400 text-sm leading-5">
            Create a verified candidate profile, apply to jobs, track your applications, and build your professional portfolio.
          </Text>
        </Pressable>

        <Pressable
          onPress={() => router.push('/(onboarding)/company/step-1')}
          className="bg-surface-card border border-surface-border rounded-2xl p-6 mb-8"
        >
          <View className="flex-row items-center mb-3">
            <View className="w-10 h-10 bg-primary-500/20 rounded-xl items-center justify-center mr-3">
              <Text className="text-2xl">🏢</Text>
            </View>
            <Text className="text-[#1A1625] font-semibold text-lg">I'm hiring</Text>
          </View>
          <Text className="text-slate-400 text-sm leading-5">
            Verify your company, post jobs, manage applicants with our ATS, and find the right people faster.
          </Text>
        </Pressable>

        <View className="flex-row justify-center pb-8">
          <Text className="text-slate-400 text-sm">Already have an account? </Text>
          <Pressable onPress={() => router.push('/(auth)/login')}>
            <Text className="text-primary-400 text-sm font-semibold">Sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

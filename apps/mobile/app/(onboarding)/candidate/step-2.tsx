import { View, Text, Pressable } from 'react-native'
import { router } from 'expo-router'
import { SafeAreaView } from 'react-native-safe-area-context'

export default function CandidateStep2() {
  return (
    <SafeAreaView className="flex-1 bg-surface px-6">
      <Pressable onPress={() => router.back()} className="mt-6 mb-8">
        <Text className="text-primary-400 text-base">← Back</Text>
      </Pressable>

      <View className="flex-row items-center mb-2">
        {Array.from({ length: 7 }).map((_, i) => (
          <View
            key={i}
            className={`h-1 flex-1 rounded-full mr-1 ${i <= 1 ? 'bg-primary-500' : 'bg-surface-card'}`}
          />
        ))}
      </View>
      <Text className="text-slate-500 text-xs mb-8">Step 2 of 7</Text>

      <Text className="text-white text-3xl font-bold mb-2">Verify your phone</Text>
      <Text className="text-slate-400 text-base">
        Phone OTP verification screen (CO-02) — coming next.
      </Text>
    </SafeAreaView>
  )
}
